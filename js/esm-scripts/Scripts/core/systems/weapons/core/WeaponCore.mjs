import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

const WEAPON_TYPES = [
    'pistol',
    'machinegun',
    'shotgun'
];
const WEAPON_SWITCH_COOLDOWN = aiConfig.weapons.WEAPON_SWITCH_COOLDOWN;
const EYE_HEIGHT = aiConfig.weapons.EYE_HEIGHT_FALLBACK;
class WeaponCore {
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    initialize(app, entity) {
        this.app = app;
        this.entity = entity;
        this.entityId = entity.getGuid();
        this.entityName = entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        this._initializeWeapons();
        this._initializeHitRegistry();
        this.Logger.info(`[${this.entityName}] WeaponCore initialized`);
    }
    _initializeWeapons() {
        // Initialize weapon state from config
        WEAPON_TYPES.forEach((type)=>{
            this.weapons[type] = {
                unlocked: this.config.unlockedWeapons?.[type] ?? type === 'pistol',
                ammo: this.config.startingAmmo?.[type] ?? (type === 'pistol' ? aiConfig.weapons.PISTOL_STARTING_AMMO : 0),
                magazine: this.config.startingMagazines?.[type] ?? (type === 'pistol' ? aiConfig.weapons.PISTOL_MAGAZINE_SIZE : 0)
            };
        });
        // Set starting weapon (validate it exists in WEAPON_TYPES)
        this.currentWeapon = this.config.startingWeapon || 'pistol';
        // ✅ CRITICAL: Validate currentWeapon exists in weapons before accessing
        if (!this.weapons[this.currentWeapon]) {
            this.Logger.warn(`[${this.entityName}] Invalid starting weapon '${this.currentWeapon}' - falling back to pistol`);
            this.currentWeapon = 'pistol';
        }
        // Ensure starting weapon is unlocked
        if (!this.weapons[this.currentWeapon].unlocked) {
            this.weapons[this.currentWeapon].unlocked = true;
            // Give default ammo if none
            if (this.weapons[this.currentWeapon].ammo === 0) {
                this.weapons[this.currentWeapon].ammo = this.config.maxAmmo?.[this.currentWeapon] || aiConfig.weapons.DEFAULT_AMMO_FALLBACK;
            }
            if (this.weapons[this.currentWeapon].magazine === 0) {
                this.weapons[this.currentWeapon].magazine = this.config.magazineSizes?.[this.currentWeapon] || aiConfig.weapons.DEFAULT_MAGAZINE_SIZE_FALLBACK;
            }
        }
        // Set authoritative magazine count
        this.currentMagazine = this.weapons[this.currentWeapon].magazine;
        this.Logger.info(`[${this.entityName}] Starting weapon: ${this.currentWeapon} (mag: ${this.currentMagazine}, reserve: ${this.weapons[this.currentWeapon].ammo})`);
    }
    _initializeHitRegistry() {
        if (!this.app.hitRegistry) {
            this.app.hitRegistry = {
                hits: new Map(),
                getHitCount: (weapon)=>{
                    let count = 0;
                    for (const [, data] of this.hits.entries()){
                        if (data.weapon === weapon) count++;
                    }
                    return count;
                },
                getApplyCount: (weapon)=>{
                    let count = 0;
                    for (const [, data] of this.hits.entries()){
                        if (data.weapon === weapon && data.applied) count++;
                    }
                    return count;
                },
                clear: ()=>{
                    this.hits.clear();
                }
            };
        }
    }
    // ========================================================================
    // WEAPON FIRING
    // ========================================================================
    canFire() {
        if (this.isReloading) return false;
        if (this.currentMagazine <= 0) return false;
        const now = this._getTime();
        const fireRate = this.config.fireRates[this.currentWeapon] || aiConfig.weapons.DEFAULT_FIRE_RATE_FALLBACK;
        return now - this.lastFireTime >= fireRate;
    }
    fire(targetPosition, weaponSocket) {
        // Validate target position
        if (!this._isValidPosition(targetPosition)) {
            this.Logger.error(`[${this.entityName}] Invalid targetPosition:`, targetPosition);
            return false;
        }
        // Auto-reload if magazine empty and ammo available
        if (this.currentMagazine <= 0 && !this.isReloading) {
            const weapon = this.weapons[this.currentWeapon];
            if (weapon && weapon.ammo > 0) {
                this.reload();
                return false;
            }
        }
        if (!this.canFire()) return false;
        // Get weapon stats
        const damage = this.config.weaponDamage[this.currentWeapon] || aiConfig.weapons.DEFAULT_DAMAGE_FALLBACK;
        const range = this.config.weaponRanges[this.currentWeapon] || aiConfig.weapons.DEFAULT_RANGE_FALLBACK;
        let spread = this.config.weaponSpread[this.currentWeapon] || aiConfig.weapons.DEFAULT_SPREAD_FALLBACK;
        // ⏱️ NEW: Apply Last Stand spread reduction if player is in last stand
        if (this.owner && this.owner.tags && this.owner.tags.has('player')) {
            const lastStandEntity = this.app.root.findByName('GameSystems');
            if (lastStandEntity && lastStandEntity.script && lastStandEntity.script.lastStandSystem) {
                const lastStandSystem = lastStandEntity.script.lastStandSystem;
                if (lastStandSystem.isLastStandActive && lastStandSystem.isLastStandActive()) {
                    const reduction = lastStandSystem.getSpreadReduction ? lastStandSystem.getSpreadReduction() : 0;
                    spread *= 1 - reduction; // Apply spread reduction
                }
            }
        }
        // Update state
        this.lastFireTime = this._getTime();
        this.currentMagazine = Math.max(0, this.currentMagazine - 1);
        this.weapons[this.currentWeapon].magazine = this.currentMagazine;
        // Execute shot(s)
        if (this.currentWeapon === 'shotgun') {
            this._fireShotgun(targetPosition, damage, range, spread, weaponSocket);
        } else {
            this._fireSingleShot(targetPosition, damage, range, spread, weaponSocket);
        }
        // Fire events
        this._fireWeaponEvents(targetPosition);
        return true;
    }
    _fireSingleShot(targetPosition, damage, range, spread, weaponSocket) {
        const fireOrigin = this._getFireOrigin(weaponSocket);
        const direction = this._calculateDirection(fireOrigin, targetPosition, spread);
        const hitResult = this._raycast(fireOrigin, direction, range);
        if (hitResult) {
            this._processHit(hitResult, damage);
        }
    }
    _fireShotgun(targetPosition, damage, range, spread, weaponSocket) {
        const pellets = this.config.shotgunPellets || 6;
        // 🎯 BALANCED APPROACH: 
        // - Damage is divided among pellets for total damage cap
        // - But we track which pellets hit the SAME target
        // - If all pellets hit same target = full 100 damage
        // - If pellets spread and hit different targets = damage divided
        const pelletDamage = damage / pellets; // 100 / 6 = 16.67 per pellet
        const fireOrigin = this._getFireOrigin(weaponSocket);
        // Track hits per target to cap damage
        const targetHits = new Map();
        for(let i = 0; i < pellets; i++){
            const direction = this._calculateDirection(fireOrigin, targetPosition, spread);
            const hitResult = this._raycast(fireOrigin, direction, range);
            if (hitResult && hitResult.entity) {
                // Track how many pellets hit this target
                const targetId = hitResult.entity.getGuid();
                const hits = (targetHits.get(targetId) || 0) + 1;
                targetHits.set(targetId, hits);
                // Apply pellet damage
                this._processHit(hitResult, pelletDamage);
            }
        }
        // Log shotgun effectiveness
        if (targetHits.size > 0) {
            const maxHits = Math.max(...targetHits.values());
            const totalDamage = maxHits * pelletDamage;
            console.log(`🎯 [${this.entityName}] Shotgun: ${maxHits}/${pellets} pellets hit, ${totalDamage.toFixed(0)} damage`);
            this.Logger.debug(`[${this.entityName}] Shotgun: ${maxHits}/${pellets} pellets hit, ${totalDamage.toFixed(0)} damage`);
        }
    }
    _calculateDirection(origin, target, spread) {
        const direction = new Vec3().sub2(target, origin).normalize();
        if (spread > 0) {
            direction.x += (Math.random() - 0.5) * spread * 2;
            direction.y += (Math.random() - 0.5) * spread * 2;
            direction.normalize();
        }
        return direction;
    }
    _raycast(origin, direction, range) {
        const endPoint = new Vec3().add2(origin, direction.clone().scale(range));
        const results = this.app.systems.rigidbody.raycastAll(origin, endPoint);
        // Fire visual debug event
        this.app.fire('weapon:shotRay', {
            from: origin.clone(),
            to: endPoint.clone(),
            shooter: this.entityName
        });
        if (!results || results.length === 0) {
            return null;
        }
        // Find first valid hit (not self or children)
        let firstHit = null;
        for (const result of results){
            // Skip self/children
            if (this._isSelfOrChild(result.entity)) {
                continue;
            }
            // Store first hit for decals
            if (!firstHit) {
                firstHit = result;
            }
            // Check for damageable ancestor
            const damageable = this._findDamageableAncestor(result.entity);
            if (damageable) {
                return {
                    ...result,
                    hitEntity: result.entity,
                    entity: damageable,
                    isDamageable: true
                };
            }
        }
        // Return first hit even if not damageable (for wall decals)
        if (firstHit) {
            return {
                ...firstHit,
                hitEntity: firstHit.entity,
                isDamageable: false
            };
        }
        return null;
    }
    _processHit(hitResult, damage) {
        const targetEntity = hitResult.entity;
        const hitPosition = hitResult.point;
        const isDamageable = hitResult.isDamageable;
        // 🎯 HEADSHOT DETECTION: Check if hit entity is a head collision box
        const isHeadshot = this._isHeadshotHit(hitResult);
        const headshotMultiplier = isHeadshot ? 2.0 : 1.0; // 2x damage for headshots
        // Always create visual impact
        this.app.fire('weapon:createImpactEffect', {
            position: hitPosition,
            targetEntity: targetEntity,
            normal: hitResult.normal || new Vec3(0, 1, 0),
            isHeadshot: isHeadshot // Pass headshot info for special effects
        });
        // Fire weapon:impact event for CoverDegradationSystem
        this.app.fire('weapon:impact', {
            hitPosition: hitPosition,
            hitEntity: targetEntity,
            damage: damage * headshotMultiplier,
            weaponType: this.weaponType,
            shooter: this.entity,
            isHeadshot: isHeadshot
        });
        // Only process damage for damageable targets
        if (!isDamageable) {
            return;
        }
        // ✅ FIX #2: PERFECT DAMAGE CONSISTENCY - Apply humanized damage calculation
        // This creates realistic damage variance that humans naturally produce
        let scaledDamage = this._calculateHumanizedDamage(damage, headshotMultiplier, hitResult, targetEntity);
        const isAIAttacker = !!(this.entity.script && this.entity.script.aiAgent);
        const isPlayerAttacker = !!(this.entity.script && (this.entity.script.player || this.entity.script.playerController));
        const isPlayerTarget = !!(targetEntity.script && (targetEntity.script.player || targetEntity.script.playerController));
        // ✅ DYNAMIC DIFFICULTY: Apply AI difficulty scaling ONLY when AI shoots player
        // CRITICAL: Only scale damage when AI attacks player (NOT when player attacks AI)
        if (isAIAttacker && isPlayerTarget && !isPlayerAttacker) {
            // Get AI difficulty from GameManager (0.1 = easiest, 1.0 = hardest)
            const difficulty = this.app.gameManager?.aiDifficulty || 0.7;
            // Scale damage based on difficulty:
            // 0.5 difficulty = 50% damage
            // 0.7 difficulty = 70% damage (default/balanced)
            // 1.0 difficulty = 100% damage (full challenge)
            scaledDamage = scaledDamage * difficulty;
            // Log difficulty scaling occasionally (5% chance to avoid spam)
            if (Math.random() < 0.05) {
                this.Logger.combat(`[${this.entityName}] 🎯 AI→Player difficulty scaling: ${damage}${isHeadshot ? 'x2 (headshot)' : ''} → ${scaledDamage.toFixed(1)} (${(difficulty * 100).toFixed(0)}% difficulty)`);
            }
        } else if (isHeadshot) {
            // Log headshots
            this.Logger.combat(`[${this.entityName}] 💀 HEADSHOT! Damage: ${damage} → ${scaledDamage.toFixed(1)}`);
        }
        // Register hit
        const hitId = this._generateHitId();
        if (this.app.hitRegistry) {
            this.app.hitRegistry.hits.set(hitId, {
                weapon: this.currentWeapon,
                time: performance.now(),
                applied: false,
                attacker: this.entityId,
                target: targetEntity.getGuid(),
                position: hitPosition.clone(),
                damage: scaledDamage
            });
        }
        // Apply damage
        if (targetEntity.script?.healthSystem) {
            this.app.fire('damage:request:apply', {
                target: targetEntity,
                damage: scaledDamage,
                attacker: this.entity,
                hitId,
                position: hitPosition,
                isShotgunPellet: this.currentWeapon === 'shotgun',
                weaponType: this.currentWeapon,
                isHeadshot: isHeadshot // 💀 Pass headshot info to damage system
            });
        }
    }
    /**
     * ✅ FIX #2: PERFECT DAMAGE CONSISTENCY - Calculate humanized damage with realistic variance
     * 
     * Humans don't deal perfect consistent damage. This method simulates:
     * 1. Distance falloff (accuracy drops at range)
     * 2. Movement penalty (harder to aim while moving)
     * 3. Human inconsistency (±15% natural variance)
     * 4. Skill-based consistency (AI skill affects variance)
     * 
     * Expected output examples:
     * - Pistol base 25 damage → 23, 18, 25, 21, 15, 27, 19, 22...
     * - NOT: 25.0, 25.0, 25.0, 25.0, 25.0...
     * 
     * @param {number} baseDamage - Base weapon damage
     * @param {number} headshotMultiplier - Headshot multiplier (1.0 or 2.0)
     * @param {Object} hitResult - Raycast hit result with distance
     * @param {pc.Entity} targetEntity - Target entity
     * @returns {number} Humanized damage value
     */ _calculateHumanizedDamage(baseDamage, headshotMultiplier, hitResult, targetEntity) {
        let damage = baseDamage * headshotMultiplier;
        // Get shooter info (AI or player)
        const isAIShooter = !!(this.entity.script && this.entity.script.aiAgent);
        const shooterVelocity = this.entity.rigidbody ? this.entity.rigidbody.linearVelocity : null;
        const isMoving = shooterVelocity ? shooterVelocity.length() > 0.5 : false;
        // Get weapon range stats
        const weaponRange = this.config.weaponRanges?.[this.currentWeapon] || 50;
        const effectiveRange = weaponRange * 0.6; // 60% of max range is "effective"
        // Calculate distance to target
        const distance = hitResult.point ? this.entity.getPosition().distance(hitResult.point) : 15; // Default to medium range if unknown
        // 1. DISTANCE FALLOFF (50% reduction at max range)
        // Effective range: 100% damage
        // Max range: 50% damage
        if (distance > effectiveRange) {
            const falloffRatio = (distance - effectiveRange) / (weaponRange - effectiveRange);
            const falloffMultiplier = Math.max(0.5, 1.0 - falloffRatio * 0.5);
            damage *= falloffMultiplier;
        }
        // 2. MOVEMENT PENALTY (70-90% when moving)
        // Humans can't aim as well while moving
        if (isMoving) {
            // AI skill affects how much movement impacts aim
            const aimSkill = isAIShooter && this.entity.script.aiAgent?.agent?.aimSkill ? this.entity.script.aiAgent.agent.aimSkill : 0.5;
            const movementPenalty = 0.7 + aimSkill * 0.2; // 70-90% damage while moving
            damage *= movementPenalty;
        }
        // 3. HUMAN INCONSISTENCY (±15% random variance)
        // This is THE MOST IMPORTANT fix - no two shots should be identical
        const varianceMultiplier = 0.85 + Math.random() * 0.30; // 85% to 115%
        damage *= varianceMultiplier;
        // 4. SKILL-BASED CONSISTENCY (better AI = less variance, more consistent damage)
        // This is a small bonus for high-skill AI
        if (isAIShooter && this.entity.script.aiAgent?.agent?.aimSkill) {
            const aimSkill = this.entity.script.aiAgent.agent.aimSkill;
            const skillBonus = aimSkill * 0.1; // Up to +10% damage for perfect aim
            damage *= 1.0 + skillBonus;
        }
        // 5. WEAPON-SPECIFIC MODIFIERS
        // Some weapons are more consistent than others
        if (this.currentWeapon === 'shotgun') {
            // Shotguns have more variance due to spread
            damage *= 0.90 + Math.random() * 0.20; // Extra ±10% variance
        }
        // Round to whole number (no fractional health damage)
        damage = Math.round(damage);
        // Ensure minimum 1 damage (every hit should count)
        return Math.max(1, damage);
    }
    /**
     * 💀 Check if hit was a headshot
     * @param {Object} hitResult - Raycast hit result
     * @returns {boolean} True if headshot
     */ _isHeadshotHit(hitResult) {
        if (!hitResult) {
            return false;
        }
        // 🎯 CRITICAL: Use hitEntity (original hit) NOT entity (damageable parent)
        const hitEntity = hitResult.hitEntity || hitResult.entity;
        if (!hitEntity) {
            return false;
        }
        // 🔍 DEBUG: Log what we hit (safely get tag names)
        let tagNames = 'none';
        if (hitEntity.tags && hitEntity.tags._list) {
            tagNames = hitEntity.tags._list.join(', ');
        }
        console.log(`🔍 [WeaponCore] Hit entity: "${hitEntity.name}", parent: "${hitEntity.parent?.name || 'none'}", tags: [${tagNames}]`);
        // Method 1: Check if the hit entity itself is named "Head"
        if (hitEntity.name && hitEntity.name.toLowerCase() === 'head') {
            console.log(`💀 [WeaponCore] HEADSHOT detected via entity name: ${hitEntity.name}`);
            return true;
        }
        // Method 2: Check if the hit entity has a "head" tag
        if (hitEntity.tags && hitEntity.tags.has('head')) {
            console.log(`💀 [WeaponCore] HEADSHOT detected via entity tag: head`);
            return true;
        }
        // Method 3: Check if hit entity is a child of an entity with a collision named "Head"
        // This handles cases where the collision box is a separate entity
        if (hitEntity.parent) {
            const parent = hitEntity.parent;
            if (parent.name && parent.name.toLowerCase() === 'head') {
                console.log(`💀 [WeaponCore] HEADSHOT detected via parent name: ${parent.name}`);
                return true;
            }
            if (parent.tags && parent.tags.has('head')) {
                console.log(`💀 [WeaponCore] HEADSHOT detected via parent tag: head`);
                return true;
            }
        }
        console.log(`❌ [WeaponCore] NOT a headshot`);
        return false;
    }
    // ========================================================================
    // WEAPON SOCKET POSITION
    // ========================================================================
    _getFireOrigin(weaponSocket) {
        // Use cached position if available (same frame)
        const currentFrame = this.app.frame;
        if (this._cachedSocketPos && this._cacheFrame === currentFrame) {
            return this._cachedSocketPos;
        }
        let fireOrigin;
        if (weaponSocket) {
            fireOrigin = this._calculateSocketPosition(weaponSocket);
        } else {
            // No weapon socket, use fallback
            fireOrigin = this._getFallbackFireOrigin();
        }
        // Cache for this frame
        this._cachedSocketPos = fireOrigin;
        this._cacheFrame = currentFrame;
        return fireOrigin;
    }
    _calculateSocketPosition(weaponSocket) {
        const entityPos = this.entity.getPosition();
        // CRITICAL FIX #1: Verify entity is enabled and has valid parent
        if (!weaponSocket.enabled) {
            this.Logger.warn(`[${this.entityName}] WeaponSocket is disabled, using fallback`);
            return this._getFallbackFireOrigin();
        }
        // CRITICAL FIX #2: Force transform update
        if (weaponSocket.parent) {
            weaponSocket.parent.syncHierarchy();
        }
        weaponSocket.syncHierarchy();
        // Get both local and world positions
        const socketPos = weaponSocket.getPosition();
        const socketLocalPos = weaponSocket.getLocalPosition();
        // CRITICAL FIX #3: Detect if getPosition() is returning local coordinates
        // This happens when transform chain is broken
        const isSameAsLocal = this._positionsAreEqual(socketPos, socketLocalPos);
        const isNearWorldOrigin = this._isNearOrigin(socketPos);
        const distanceFromEntity = socketPos.distance(entityPos);
        const isFarFromEntity = distanceFromEntity > aiConfig.weapons.MAX_SOCKET_DISTANCE_FROM_ENTITY;
        // Check for broken transform
        if (isSameAsLocal && (isNearWorldOrigin || isFarFromEntity)) {
            this.Logger.error(`[${this.entityName}] 🔴 CRITICAL: weaponSocket.getPosition() is broken!`);
            this.Logger.error(`   getPosition(): (${socketPos.x.toFixed(2)}, ${socketPos.y.toFixed(2)}, ${socketPos.z.toFixed(2)})`);
            this.Logger.error(`   getLocalPosition(): (${socketLocalPos.x.toFixed(2)}, ${socketLocalPos.y.toFixed(2)}, ${socketLocalPos.z.toFixed(2)})`);
            this.Logger.error(`   Distance from entity: ${distanceFromEntity.toFixed(2)}m`);
            // CRITICAL FIX #4: Use getWorldTransform() as fallback
            const worldPos = this._getPositionFromWorldTransform(weaponSocket);
            if (worldPos) {
                const newDistance = worldPos.distance(entityPos);
                if (newDistance < aiConfig.weapons.MAX_SOCKET_DISTANCE_FROM_ENTITY) {
                    this.Logger.info(`[${this.entityName}] ✅ Using getWorldTransform() - distance: ${newDistance.toFixed(2)}m`);
                    return this._validateHeight(worldPos, entityPos);
                }
            }
            // Still broken, use fallback
            this.Logger.warn(`[${this.entityName}] ⚠️ getWorldTransform() also invalid, using fallback`);
            return this._getFallbackFireOrigin();
        }
        // Position seems valid, check distance
        if (distanceFromEntity >= aiConfig.weapons.MAX_SOCKET_DISTANCE_FROM_ENTITY) {
            this.Logger.warn(`[${this.entityName}] WeaponSocket too far (${distanceFromEntity.toFixed(2)}m), using fallback`);
            return this._getFallbackFireOrigin();
        }
        // CRITICAL FIX #5 (Issue #3): Validate weapon socket height
        return this._validateHeight(socketPos, entityPos);
    }
    _positionsAreEqual(pos1, pos2, threshold = aiConfig.weapons.POSITION_EQUALITY_THRESHOLD) {
        return Math.abs(pos1.x - pos2.x) < threshold && Math.abs(pos1.y - pos2.y) < threshold && Math.abs(pos1.z - pos2.z) < threshold;
    }
    _isNearOrigin(pos, threshold = aiConfig.weapons.NEAR_ORIGIN_THRESHOLD) {
        return Math.abs(pos.x) < threshold && Math.abs(pos.y) < threshold && Math.abs(pos.z) < threshold;
    }
    _getPositionFromWorldTransform(entity) {
        try {
            const worldTransform = entity.getWorldTransform();
            const worldPos = new Vec3();
            worldTransform.getTranslation(worldPos);
            return worldPos;
        } catch (error) {
            this.Logger.error(`[${this.entityName}] Failed to get world transform:`, error);
            return null;
        }
    }
    _validateHeight(socketPos, entityPos) {
        // ✅ FIX: Use camera/eye position as baseline, not player root (which is at feet/pelvis)
        // Player hierarchy: Player (feet) → Camera (eye) → HandAnchor → WeaponSocket
        // Weapon should be 10-20cm below eye level, NOT compared to feet
        const camera = this.entity.findByName('Camera');
        if (!camera) {
            // No camera found, skip validation (assume correct)
            return socketPos;
        }
        const eyePos = camera.getPosition();
        const EXPECTED_OFFSET_BELOW_EYE = aiConfig.weapons.EXPECTED_OFFSET_BELOW_EYE; // Weapon typically 15cm below eye line
        const TOLERANCE = aiConfig.weapons.EYE_OFFSET_TOLERANCE; // Allow ±10cm variance
        // Calculate expected weapon height (eye - offset)
        const expectedWeaponY = eyePos.y - EXPECTED_OFFSET_BELOW_EYE;
        const heightDiff = socketPos.y - expectedWeaponY;
        // Only warn if socket is significantly lower than expected (more than tolerance)
        if (heightDiff < -TOLERANCE) {
            this.Logger.warn(`[${this.entityName}] ⚠️ WeaponSocket lower than expected!`);
            this.Logger.warn(`   Eye position: (${eyePos.x.toFixed(2)}, ${eyePos.y.toFixed(2)}, ${eyePos.z.toFixed(2)})`);
            this.Logger.warn(`   Socket position: (${socketPos.x.toFixed(2)}, ${socketPos.y.toFixed(2)}, ${socketPos.z.toFixed(2)})`);
            this.Logger.warn(`   Expected weapon Y: ${expectedWeaponY.toFixed(2)}m, Actual: ${socketPos.y.toFixed(2)}m (${heightDiff.toFixed(2)}m below)`);
            // Only auto-correct if significantly wrong (not just a small variance)
            if (heightDiff < -aiConfig.weapons.AUTO_CORRECT_HEIGHT_THRESHOLD) {
                this.Logger.warn(`   Auto-correcting to expected height...`);
                const correctedPos = socketPos.clone();
                correctedPos.y = expectedWeaponY;
                return correctedPos;
            }
        }
        return socketPos;
    }
    _getFallbackFireOrigin() {
        const pos = this.entity.getPosition();
        return new Vec3(pos.x, pos.y + EYE_HEIGHT, pos.z);
    }
    // ========================================================================
    // RELOAD MECHANICS
    // ========================================================================
    reload() {
        if (this.isReloading) return false;
        const weapon = this.weapons[this.currentWeapon];
        if (!weapon) return false;
        const magazineSize = this.config.magazineSizes[this.currentWeapon] || 10;
        const currentMag = weapon.magazine || 0;
        const reserveAmmo = weapon.ammo || 0;
        // Check if reload is needed/possible
        if (currentMag >= magazineSize || reserveAmmo <= 0) {
            return false;
        }
        // Start reload
        this.isReloading = true;
        const reloadTime = this.config.reloadTimes[this.currentWeapon] || 1.5;
        this.reloadEndTime = this._getTime() + reloadTime;
        // Fire start event
        this.app.fire('weapon:reload_start', {
            entity: this.entity,
            weaponType: this.currentWeapon,
            ammo: currentMag,
            totalAmmo: reserveAmmo
        });
        // Schedule reload completion
        this._reloadTimeout = setTimeout(()=>{
            this._completeReload();
        }, reloadTime * 1000);
        return true;
    }
    _completeReload() {
        if (!this.isReloading) return;
        const weapon = this.weapons[this.currentWeapon];
        if (weapon) {
            const magazineSize = this.config.magazineSizes[this.currentWeapon] || 10;
            const current = weapon.magazine || 0;
            const reserve = weapon.ammo || 0;
            const needed = magazineSize - current;
            const taken = Math.min(needed, reserve);
            // Update ammo
            weapon.magazine = current + taken;
            weapon.ammo = Math.max(0, reserve - taken);
            this.currentMagazine = weapon.magazine;
        }
        // Clear reload state
        this.isReloading = false;
        this.reloadEndTime = null;
        this._reloadTimeout = null;
        // Fire completion event
        this.app.fire('weapon:reload_complete', {
            shooter: this.entity,
            entity: this.entity,
            weaponType: this.currentWeapon,
            ammo: this.currentMagazine,
            totalAmmo: weapon ? weapon.ammo : 0
        });
        this.Logger.info(`[${this.entityName}] Reload complete: ${this.currentWeapon} (mag: ${this.currentMagazine}, reserve: ${weapon ? weapon.ammo : 0})`);
    }
    // ========================================================================
    // WEAPON SWITCHING
    // ========================================================================
    switchWeapon(weaponType) {
        if (!WEAPON_TYPES.includes(weaponType)) return false;
        const weapon = this.weapons[weaponType];
        if (!weapon || !weapon.unlocked) return false;
        // Check cooldown
        const now = this._getTime();
        if (now - this.lastWeaponSwitch < WEAPON_SWITCH_COOLDOWN) return false;
        // Switch weapon
        this.currentWeapon = weaponType;
        this.currentMagazine = weapon.magazine || 0;
        this.lastWeaponSwitch = now;
        // Fire event
        this.app.fire('weapon:switched', {
            shooter: this.entity,
            entity: this.entity,
            weaponType,
            ammo: this.currentMagazine,
            totalAmmo: weapon.ammo || 0
        });
        return true;
    }
    // ========================================================================
    // WEAPON MANAGEMENT
    // ========================================================================
    unlockWeapon(weaponType) {
        if (!WEAPON_TYPES.includes(weaponType)) return false;
        if (!this.weapons[weaponType]) {
            this.weapons[weaponType] = {
                ammo: 0,
                magazine: 0,
                unlocked: false
            };
        }
        if (this.weapons[weaponType].unlocked) return false;
        this.weapons[weaponType].unlocked = true;
        this.weapons[weaponType].ammo = this.config.maxAmmo[weaponType] || aiConfig.weapons.DEFAULT_AMMO_FALLBACK;
        this.weapons[weaponType].magazine = this.config.magazineSizes[weaponType] || aiConfig.weapons.DEFAULT_MAGAZINE_SIZE_FALLBACK;
        return true;
    }
    addAmmo(weaponType, amount) {
        if (weaponType === 'all') {
            let totalAdded = 0;
            WEAPON_TYPES.forEach((type)=>{
                if (this.weapons[type]?.unlocked) {
                    totalAdded += this._addAmmoToWeapon(type, amount);
                }
            });
            return totalAdded > 0;
        } else {
            return this._addAmmoToWeapon(weaponType, amount) > 0;
        }
    }
    _addAmmoToWeapon(weaponType, amount) {
        if (!WEAPON_TYPES.includes(weaponType)) return 0;
        const weapon = this.weapons[weaponType];
        if (!weapon) return 0;
        const maxAmmo = this.config.maxAmmo[weaponType] || aiConfig.weapons.DEFAULT_AMMO_FALLBACK;
        const current = weapon.ammo || 0;
        const canAdd = Math.max(0, maxAmmo - current);
        const adding = Math.min(amount, canAdd);
        weapon.ammo = current + adding;
        return adding;
    }
    resetWeapons(startingWeapon) {
        const startWeapon = startingWeapon || this.config.startingWeapon || 'pistol';
        // Reset all weapons to starting state
        WEAPON_TYPES.forEach((type)=>{
            this.weapons[type] = {
                unlocked: this.config.unlockedWeapons?.[type] ?? type === 'pistol',
                ammo: this.config.startingAmmo?.[type] ?? (type === 'pistol' ? aiConfig.weapons.PISTOL_STARTING_AMMO : 0),
                magazine: this.config.startingMagazines?.[type] ?? (type === 'pistol' ? aiConfig.weapons.PISTOL_MAGAZINE_SIZE : 0)
            };
        });
        // Switch to starting weapon
        this.switchWeapon(startWeapon);
        // Clear reload state
        this.isReloading = false;
        this.reloadEndTime = null;
        if (this._reloadTimeout) {
            clearTimeout(this._reloadTimeout);
            this._reloadTimeout = null;
        }
    }
    // ========================================================================
    // QUERY METHODS
    // ========================================================================
    getCurrentKey() {
        return this.currentWeapon || this.config.startingWeapon || 'pistol';
    }
    getCurrent() {
        const key = this.getCurrentKey();
        if (!this.weapons[key]) {
            this.weapons[key] = {
                ammo: 0,
                magazine: 0,
                unlocked: false
            };
        }
        return this.weapons[key];
    }
    getWeaponInfo(weaponType) {
        const type = weaponType || this.getCurrentKey();
        const weapon = this.weapons[type];
        if (!weapon) return null;
        return {
            type,
            unlocked: weapon.unlocked,
            ammo: weapon.ammo,
            magazine: weapon.magazine,
            damage: this.config.weaponDamage[type],
            range: this.config.weaponRanges[type],
            fireRate: this.config.fireRates[type],
            reloadTime: this.config.reloadTimes[type]
        };
    }
    getAllWeaponsInfo() {
        const info = {};
        WEAPON_TYPES.forEach((type)=>{
            info[type] = this.getWeaponInfo(type);
        });
        return info;
    }
    hasAmmo(weaponType) {
        const type = weaponType || this.getCurrentKey();
        const weapon = this.weapons[type];
        if (!weapon || !weapon.unlocked) return false;
        const magazineAmmo = type === this.currentWeapon ? this.currentMagazine : weapon.magazine;
        const reserveAmmo = weapon.ammo || 0;
        return magazineAmmo + reserveAmmo > 0;
    }
    needsReload(weaponType) {
        const type = weaponType || this.getCurrentKey();
        const weapon = this.weapons[type];
        const magazineSize = this.config.magazineSizes[type] || 10;
        return weapon && weapon.magazine < magazineSize && weapon.ammo > 0;
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    _isValidPosition(pos) {
        if (!pos || typeof pos !== 'object') return false;
        return pos.x !== undefined && pos.y !== undefined && pos.z !== undefined;
    }
    _isSelfOrChild(entity) {
        let current = entity;
        while(current){
            if (current === this.entity) return true;
            current = current.parent;
        }
        return false;
    }
    _findDamageableAncestor(entity) {
        let current = entity;
        while(current){
            if (current.script?.healthSystem) return current;
            current = current.parent;
        }
        return null;
    }
    _generateHitId() {
        return `${this.entityId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    _getTime() {
        return performance.now() / 1000;
    }
    _fireWeaponEvents(targetPosition) {
        const weapon = this.weapons[this.currentWeapon];
        // Weapon fired event
        this.app.fire('weapon:fired', {
            shooter: this.entity,
            entity: this.entity,
            weapon: this.currentWeapon,
            weaponType: this.currentWeapon,
            damage: this.config.weaponDamage[this.currentWeapon],
            targetPosition,
            ammo: this.currentMagazine,
            totalAmmo: weapon ? weapon.ammo : 0
        });
        // Sound detection for AI
        this.app.fire('sound:detected', {
            position: this.entity.getPosition().clone(),
            soundType: 'gunshot',
            intensity: 1.0,
            range: 50,
            source: this.entity,
            weaponType: this.currentWeapon
        });
    }
    constructor(config, logger){
        this.config = config;
        this.Logger = logger || console;
        // PlayCanvas references (set in initialize)
        this.app = null;
        this.entity = null;
        this.entityId = null;
        this.entityName = null;
        // Weapon state
        this.weapons = {};
        this.currentWeapon = null;
        this.currentMagazine = 0;
        // Timing
        // ✅ FIX: Initialize to current time to prevent false fire rate blocking on first shot
        this.lastFireTime = performance.now() / 1000;
        this.lastWeaponSwitch = 0;
        // Reload state
        this.isReloading = false;
        this.reloadEndTime = null;
        this._reloadTimeout = null;
        // Cached weapon socket position (per frame)
        this._cachedSocketPos = null;
        this._cacheFrame = -1;
    }
}

export { WeaponCore };
