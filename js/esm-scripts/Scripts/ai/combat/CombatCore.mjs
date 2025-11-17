import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

class CombatCore {
    calculateCombatParameters(targetPos, context) {
        const agentPos = this.entity.getPosition();
        const toTarget = new Vec3().sub2(targetPos, agentPos);
        const distance = toTarget.length();
        let accuracy = this.agent.aimAccuracy || aiConfig.combat.aimAccuracy;
        if (this.agent.emotionalSystem && typeof this.agent.emotionalSystem.calculateAccuracy === 'function') {
            accuracy = this.agent.emotionalSystem.calculateAccuracy(accuracy);
        } else {
            if (context.stress) accuracy *= 1 - context.stress * aiConfig.combat.STRESS_ACCURACY_PENALTY;
            if (context.confidence > aiConfig.combat.HIGH_HEALTH_THRESHOLD) accuracy *= 1 + aiConfig.combat.CONFIDENCE_ACCURACY_BONUS;
        }
        // Apply dynamic difficulty modifiers from DynamicDifficultySystem
        if (this.app && this.app.difficultyModifiers && this.app.difficultyModifiers.accuracyMultiplier) {
            accuracy *= this.app.difficultyModifiers.accuracyMultiplier;
        }
        accuracy += (context.alertness || 0) * aiConfig.combat.ALERTNESS_ACCURACY_BONUS;
        accuracy += this.calculateDistanceFactor(distance);
        accuracy += context.healthRatio * aiConfig.combat.HEALTH_ACCURACY_BONUS;
        accuracy -= context.isMoving ? aiConfig.combat.DISTANCE_ACCURACY_PENALTY_MOVING : 0;
        return {
            targetPos,
            distance,
            accuracy: Math.max(0.1, Math.min(0.95, accuracy)),
            directionToTarget: toTarget.normalize()
        };
    }
    calculateDistanceFactor(distance) {
        let optimalRange = aiConfig.combat.OPTIMAL_ENGAGEMENT_RANGE;
        let maxRange = aiConfig.combat.MAX_ENGAGEMENT_RANGE;
        if (this.agent.personalitySystem) {
            const ranges = this.agent.personalitySystem.getPreferredEngagementRange();
            optimalRange = ranges.optimal;
            maxRange = ranges.max;
        }
        if (distance <= optimalRange) return aiConfig.combat.OPTIMAL_DISTANCE_ACCURACY_BONUS;
        if (distance <= maxRange) return aiConfig.combat.OPTIMAL_DISTANCE_ACCURACY_BONUS - (distance - optimalRange) / (maxRange - optimalRange) * aiConfig.combat.MAX_RANGE_ACCURACY_PENALTY;
        return -aiConfig.combat.MAX_RANGE_ACCURACY_PENALTY;
    }
    // ✅ FIXED: Complete executeShooting with diagnostics and AUTOMATIC WEAPON SUPPORT
    executeShooting(combatData, targetPos) {
        // 🔥 CRITICAL FIX: Rotate toward target while shooting (don't block firing!)
        const hasTarget = this.agent.targetSystem?.hasTarget();
        if (hasTarget && targetPos && this.agent.utilities) {
            const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
            const isCriticallyWounded = healthRatio < 0.5;
            // Only rotate if not critically wounded (let health-seeking AI sprint away)
            if (!isCriticallyWounded && this.agent.utilities.shouldRotateTowardTarget()) {
                // Use aggressive rotation speed (360° per second = instant snap)
                // Get dt safely - try entity.app first, then agent.app, fallback to 1/60
                const dt = this.entity?.app?.dt || this.agent?.app?.dt || 1 / 60;
                this.agent.utilities.rotateTowardTarget(targetPos, dt, 360);
            // ✅ DON'T BLOCK SHOOTING! Let AI shoot while rotating (more natural)
            // Only prevent shooting if target is way outside FOV (>90°)
            }
        }
        // ✅ DIAGNOSTIC: Log every call to executeShooting
        const nowMs = performance.now();
        if (nowMs - (this._lastExecuteShootingLog || 0) > 1000) {
            Logger.combat(`[${this.entity.name}] 🎯 executeShooting() called - checking fire conditions`);
            this._lastExecuteShootingLog = nowMs;
        }
        // ✅ NEW: Check if shooting is paused (for advanced tactics like baiting)
        if (this._shootingPaused) {
            const now = performance.now() / 1000;
            if (now < this._shootingPauseUntil) {
                Logger.combat(`[${this.entity.name}] ⏸️ Shooting paused (tactics)`);
                return false; // Still paused
            } else {
                // Pause expired, resume shooting
                this._shootingPaused = false;
                Logger.combat(`[${this.entity.name}] ▶️ Shooting pause expired - resuming`);
            }
        }
        // ✅ ANIMATION GATING: Check if animation allows firing
        const animController = this.agent?.animationController;
        if (animController && animController._initialized) {
            if (!animController.canFireWeapon()) {
                if (performance.now() - this._lastFireBlockLog > 2000) {
                    Logger.combat(`[${this.entity.name}] ❌ Animation blocking shot - wrong state`);
                    this._lastFireBlockLog = performance.now();
                }
                return false;
            }
        }
        // ✅ AMMO CONSERVATION: Get current weapon ammo percentage
        const currentWeaponAmmoRatio = this._getCurrentWeaponAmmoRatio();
        // ✅ FIX: Check per-target cooldown to prevent instant melting
        const targetEntity = this.agent.targetSystem?.getTargetEntity();
        if (targetEntity) {
            const targetGuid = targetEntity.getGuid();
            const now = performance.now() / 1000;
            const lastHitTime = this.lastHitTimeByTarget.get(targetGuid) || 0;
            const timeSinceLastHit = now - lastHitTime;
            if (timeSinceLastHit < this.minTimeBetweenHitsOnSameTarget) {
                // Still in cooldown period for this target
                if (performance.now() - this._lastTargetCooldownLog > 2000) {
                    this.Logger.debug(`[${this.entity.name}] ⏱️ Target cooldown active: ${timeSinceLastHit.toFixed(2)}s / ${this.minTimeBetweenHitsOnSameTarget}s`);
                    this._lastTargetCooldownLog = performance.now();
                }
                return false;
            }
        }
        // ✅ DIAGNOSTIC: Check fire conditions
        const fireChecks = {
            canFireNow: this.canFireNow(),
            canShootAtTarget: this.canShootAtTarget(),
            combatDataValid: !!combatData,
            targetPosValid: !!targetPos
        };
        if (!fireChecks.canFireNow) {
            if (performance.now() - this._lastFireBlockLog > 2000) {
                const ws = this.agent.weaponSystem;
                const now = performance.now() / 1000;
                const timeSinceLastShot = now - this.lastShootTime;
                const weaponType = ws?.currentWeapon || 'pistol';
                // 🎯 AI-ONLY FIRE RATE DIAGNOSTIC (Oct 29, 2025)
                // Show both player base rate and AI-adjusted rate
                const baseFireRate = ws?.fireRates?.[weaponType] || ws?.weaponCore?.config?.fireRates?.[weaponType] || 0.5;
                const aiMultiplier = aiConfig.combat.AI_FIRE_RATE_MULTIPLIER[weaponType] || 1.0;
                const aiFireRate = baseFireRate * aiMultiplier;
                // ✅ CRITICAL FIX: Use authoritative magazine count and reload state
                const facadeReloading = ws?.isReloading || false;
                const coreReloading = ws?.weaponCore?.isReloading || false;
                const magazineAmmo = ws?.weaponCore ? ws.weaponCore.currentMagazine : ws?.currentMagazine || 0;
                // 🔥 FIX: Display cooldown as number, not string, for proper comparison visibility
                this.Logger.debug(`[${this.entity.name}] ❌ Fire blocked - canFireNow:`, {
                    magazineAmmo: Number(magazineAmmo),
                    facadeReloading: facadeReloading,
                    coreReloading: coreReloading,
                    isReloading: facadeReloading || coreReloading,
                    timeSinceLastShot: Number(timeSinceLastShot.toFixed(3)),
                    baseFireRate: Number(baseFireRate.toFixed(3)),
                    aiFireRate: Number(aiFireRate.toFixed(3)),
                    aiMultiplier: aiMultiplier,
                    canFireIn: Number(Math.max(0, aiFireRate - timeSinceLastShot).toFixed(3)),
                    weaponType: weaponType
                });
                this._lastFireBlockLog = performance.now();
            }
            this.handleWeaponNotReady();
            this._continuousFiring = false; // Stop continuous fire if can't shoot
            return false;
        }
        if (!fireChecks.canShootAtTarget) {
            if (performance.now() - this._lastTargetBlockLog > 2000) {
                this.Logger.debug(`[${this.entity.name}] ❌ Fire blocked - canShootAtTarget: target invalid or dead`);
                this._lastTargetBlockLog = performance.now();
            }
            this._continuousFiring = false; // Stop continuous fire if target invalid
            return false;
        }
        // ✅ CRITICAL FIX: Check line-of-sight before shooting to prevent shooting through walls
        if (!this._hasLineOfSightToTarget(targetPos)) {
            if (performance.now() - this._lastLineOfSightBlockLog > 2000) {
                this.Logger.debug(`[${this.entity.name}] ❌ Fire blocked - NO LINE OF SIGHT to target (blocked by wall/obstacle)`);
                this._lastLineOfSightBlockLog = performance.now();
            }
            this._continuousFiring = false; // Stop continuous fire if target is behind wall
            return false;
        }
        const now = performance.now() / 1000;
        const ws = this.agent.weaponSystem;
        const weaponType = ws?.currentWeapon || 'pistol';
        // 🔫 CRITICAL FIX: Get fire rate from weapon system, not agent.config
        let fireRate = ws?.fireRates?.[weaponType] || ws?.weaponCore?.config?.fireRates?.[weaponType] || aiConfig.combat.MIN_SHOOT_INTERVAL;
        // Apply dynamic difficulty modifiers from DynamicDifficultySystem
        // reactionTimeMultiplier < 1.0 = AI shoots slower, > 1.0 = AI shoots faster
        if (this.app && this.app.difficultyModifiers && this.app.difficultyModifiers.reactionTimeMultiplier) {
            fireRate /= this.app.difficultyModifiers.reactionTimeMultiplier;
        }
        // ✅ AMMO CONSERVATION: Adjust fire rate based on ammo levels
        // When ammo < 30%, switch to burst fire (slower rate)
        // When ammo < 10%, conserve heavily (much slower rate)
        if (currentWeaponAmmoRatio < aiConfig.combat.AMMO_LOW_THRESHOLD && currentWeaponAmmoRatio >= aiConfig.combat.AMMO_CRITICAL_THRESHOLD) {
            // Low ammo: burst fire mode
            fireRate *= aiConfig.combat.BURST_FIRE_MULTIPLIER;
            if (Math.random() < 0.05) {
                this.Logger.combat(`[${this.entity.name}] 🎯 AMMO CONSERVATION: Burst fire mode (${(currentWeaponAmmoRatio * 100).toFixed(0)}% ammo)`);
            }
        } else if (currentWeaponAmmoRatio < aiConfig.combat.AMMO_CRITICAL_THRESHOLD && currentWeaponAmmoRatio > 0) {
            // Critical ammo: heavy conservation
            fireRate *= aiConfig.combat.HEAVY_CONSERVATION_MULTIPLIER;
            if (Math.random() < 0.05) {
                this.Logger.combat(`[${this.entity.name}] ⚠️ AMMO CRITICAL: Heavy conservation mode (${(currentWeaponAmmoRatio * 100).toFixed(0)}% ammo)`);
            }
        }
        const minInterval = this.minShootInterval || 0.25;
        // ✅ FIX: For automatic weapons (machinegun), don't use MIN_SHOOT_INTERVAL cap!
        // MIN_SHOOT_INTERVAL was designed for single-shot weapons to prevent spam
        // But machineguns NEED to fire rapidly (0.1s = 10 shots/sec)
        const isAutomaticWeapon = weaponType === 'machinegun';
        const canShoot = isAutomaticWeapon ? now - this.lastShootTime > fireRate // Automatic: use weapon's fire rate directly
         : now - this.lastShootTime > Math.min(minInterval, fireRate); // Semi-auto: cap at minInterval
        // 🔫 AUTOMATIC WEAPON FIX: Machinegun fires continuously like human players
        // (isAutomaticWeapon already defined above)
        // 🔧 DIAGNOSTIC: Log fire rate on first automatic fire
        if (isAutomaticWeapon && !this._continuousFiring) {
            this.Logger.combat(`[${this.entity.name}] 🔫 MACHINEGUN DETECTED - Fire rate: ${(fireRate * 1000).toFixed(0)}ms (${(1 / fireRate).toFixed(1)} rounds/sec)`);
        }
        // For automatic weapons, once we start firing, keep firing until magazine empty or target lost
        if (isAutomaticWeapon) {
            if (!this._continuousFiring) {
                // Start continuous fire
                this._continuousFiring = true;
                this._fireHoldStartTime = now;
                this.Logger.combat(`[${this.entity.name}] 🔫 Starting AUTOMATIC FIRE with ${weaponType}!`);
            }
            // Fire as fast as the fire rate allows
            if (canShoot) {
                // ✅ RAYCAST FIX: targetPos now comes pre-adjusted from CombatTactics.getTargetPosition()
                // ✅ SKILL-BASED AIM JITTER: Add inaccuracy based on personality
                this._applyAimJitter(targetPos);
                // ✅ REMOVED: Don't rotate during shooting - NavigationAdapter handles ALL rotation
                // Instant snaps create flickering when fighting with NavigationAdapter's smooth rotation
                const shotFired = this.fireWeapon(targetPos);
                if (shotFired) {
                    this.lastShootTime = now;
                    this.combatStats.shotsFired++;
                    // ✅ NEW: Notify HumanAimSystem of shot (accumulates recoil, updates spray pattern)
                    if (this.agent.aimSystem) {
                        this.agent.aimSystem.onShot();
                    }
                    // Note: Per-target cooldown is enforced in recordHit(), not here
                    // We don't want to limit fire rate - only limit HIT rate to prevent instant kills
                    if (this.agent.weaponSelector && weaponType) {
                        this.agent.weaponSelector.recordShot(weaponType, false);
                    }
                    // Log occasionally during automatic fire
                    if (Math.random() < 0.1) {
                        const magazineAmmo = ws?.weaponCore ? ws.weaponCore.currentMagazine : ws?.currentMagazine || 0;
                        this.Logger.combat(`[${this.entity.name}] 🔫 AUTOMATIC FIRE (${magazineAmmo} rounds left)`);
                    }
                    // ✅ FIX: Don't restore rotation - let NavigationAdapter maintain facing
                    // The AI should stay facing the target between shots
                    return true;
                } else {
                    // Stop automatic fire if weapon fails to fire (e.g., empty magazine)
                    this._continuousFiring = false;
                    this.Logger.warn(`[${this.entity.name}] ⚠️ Automatic fire stopped - weapon failed to fire`);
                    return false;
                }
            }
            return false; // Waiting for fire rate cooldown
        }
        // 🔫 SEMI-AUTOMATIC WEAPONS: Original burst fire logic for pistol/shotgun
        const shouldShoot = Math.random() < combatData.accuracy;
        const maxBurst = this.maxBurstCount || this.maxBurstSize || aiConfig.combat.MAX_BURST_SIZE;
        const lastBurst = this.lastBurstTime || 0;
        const burstWindow = 2.0; // seconds for burst window
        const canBurstFire = this.burstFireCount < maxBurst && now - lastBurst < burstWindow;
        // ✅ DIAGNOSTIC: Log shoot decision for semi-auto
        if (!canShoot || !shouldShoot) {
            if (performance.now() - this._lastShootDecisionLog > 2000) {
                this.Logger.debug(`[${this.entity.name}] 🎲 Shoot decision:`, {
                    canShoot,
                    shouldShoot,
                    accuracy: combatData?.accuracy ? Number(combatData.accuracy.toFixed(2)) : 0,
                    timeSinceLastShot: Number((now - this.lastShootTime).toFixed(3)),
                    minShootInterval: this.minShootInterval ? Number(this.minShootInterval.toFixed(3)) : 0.25
                });
                this._lastShootDecisionLog = performance.now();
            }
        }
        if (canShoot && (shouldShoot || canBurstFire)) {
            // ✅ RAYCAST FIX: targetPos now comes pre-adjusted from CombatTactics.getTargetPosition()
            // ✅ SKILL-BASED AIM JITTER: Add inaccuracy based on personality
            this._applyAimJitter(targetPos);
            // ✅ REMOVED: Don't rotate during shooting - NavigationAdapter handles ALL rotation
            // Instant snaps create flickering when fighting with NavigationAdapter's smooth rotation
            const shotFired = this.fireWeapon(targetPos);
            if (shotFired) {
                this.Logger.combat(`[${this.entity.name}] 🔫 WEAPON FIRED!`);
                this.lastShootTime = now;
                this.combatStats.shotsFired++;
                // ✅ NEW: Notify HumanAimSystem of shot
                if (this.agent.aimSystem) {
                    this.agent.aimSystem.onShot();
                }
                // Note: Per-target cooldown is enforced in recordHit(), not here
                // We don't want to limit fire rate - only limit HIT rate to prevent instant kills
                if (this.agent.weaponSelector && weaponType) {
                    this.agent.weaponSelector.recordShot(weaponType, false);
                }
                if (canBurstFire) {
                    this.burstFireCount++;
                    if (this.burstFireCount >= maxBurst) {
                        this.lastBurstTime = now;
                        this.burstFireCount = 0;
                    }
                } else {
                    this.burstFireCount = 1;
                    this.lastBurstTime = now;
                }
                // ✅ FIX: Don't restore rotation - let NavigationAdapter maintain facing
                // The AI should stay facing the target between shots
                return true;
            } else {
                // ✅ NOTE: fireWeapon() returns false when fire rate limiting is active
                // This is NORMAL BEHAVIOR - weapons have cooldowns between shots
                // Only log if it's been a while since last successful shot (actual problem)
                const timeSinceLastShot = now - this.lastShootTime;
                if (timeSinceLastShot > 2.0) {
                    this.Logger.warn(`[${this.entity.name}] ⚠️ fireWeapon() failed for ${timeSinceLastShot.toFixed(1)}s - check ammo/weapon state`);
                }
                return false;
            }
        }
        return false;
    }
    // ✅ FIXED: fireWeapon with diagnostics
    fireWeapon(aimPos) {
        const ws = this.agent.weaponSystem;
        if (!ws) {
            this.Logger.error(`[${this.entity.name}] ❌ fireWeapon: No weapon system!`);
            return false;
        }
        // ✅ CRITICAL DIAGNOSTIC: Check if AI has correct weapon system instance
        if (ws.entity !== this.entity) {
            this.Logger.error(`❌❌❌ CRITICAL BUG: [${this.entity.name}] has weapon system belonging to [${ws.entity.name}]!`);
            this.Logger.error(`   This means AI will fire the wrong entity's weapon!`);
            this.Logger.error(`   Agent entity: ${this.entity.name} (${this.entity.getGuid()})`);
            this.Logger.error(`   Weapon system entity: ${ws.entity.name} (${ws.entity.getGuid()})`);
            return false;
        }
        // ✅ RAYCAST FIX: Height adjustment now done in CombatTactics.getTargetPosition()
        // We receive pre-adjusted positions that aim at entity center/upper torso
        // ✅ DIAGNOSTIC: Log weapon system state
        this.Logger.debug(`[${this.entity.name}] 🔫 Attempting weapon system fire:`, {
            hasFireWeapon: typeof ws.fireWeapon === 'function',
            hasShootAt: typeof ws.shootAt === 'function',
            hasShoot: typeof ws.shoot === 'function',
            hasFireAt: typeof ws.fireAt === 'function',
            currentWeapon: ws.currentWeapon,
            currentMagazine: ws.currentMagazine,
            weaponSystemOwner: ws.entity.name,
            aimPos: `(${aimPos.x.toFixed(2)}, ${aimPos.y.toFixed(2)}, ${aimPos.z.toFixed(2)})`
        });
        try {
            // Try primary weapon firing method first
            if (typeof ws.fireWeapon === 'function') {
                const result = ws.fireWeapon(aimPos);
                this.Logger.combat(`[${this.entity.name}] 🔫 fireWeapon() returned: ${result}`);
                // ✅ NEW: Trigger fire animation when weapon fires
                if (result && this.agent.animationController) {
                    this.agent.animationController.onWeaponFired();
                }
                return result;
            }
            // AI-compatible methods (aliases to fireWeapon)
            if (typeof ws.shootAt === 'function') {
                const result = ws.shootAt(aimPos);
                this.Logger.combat(`[${this.entity.name}] 🔫 shootAt() returned: ${result}`);
                // ✅ NEW: Trigger fire animation
                if (result && this.agent.animationController) {
                    this.agent.animationController.onWeaponFired();
                }
                return result;
            }
            if (typeof ws.fireAt === 'function') {
                const result = ws.fireAt(aimPos);
                this.Logger.combat(`[${this.entity.name}] 🔫 fireAt() returned: ${result}`);
                // ✅ NEW: Trigger fire animation
                if (result && this.agent.animationController) {
                    this.agent.animationController.onWeaponFired();
                }
                return result;
            }
            // Legacy fallback (has defensive checks for PlayCanvas lifecycle calls)
            if (typeof ws.fire === 'function') {
                const result = ws.fire(aimPos);
                this.Logger.combat(`[${this.entity.name}] 🔫 fire() returned: ${result}`);
                return result;
            }
            // Old shoot() method if it exists
            if (typeof ws.shoot === 'function') {
                const result = ws.shoot(new Vec3().sub2(aimPos, this.entity.getPosition()).normalize());
                this.Logger.combat(`[${this.entity.name}] 🔫 shoot() returned: ${result}`);
                return result;
            }
            this.Logger.error(`[${this.entity.name}] ❌ Weapon system has NO fire methods!`);
            return false;
        } catch (error) {
            this.Logger.error(`[${this.entity.name}] ❌ Weapon firing error:`, error);
            return false;
        }
    }
    /**
     * ✅ AMMO CONSERVATION: Get current weapon's ammo ratio
     * Returns the percentage of ammo remaining for the current weapon (0.0 to 1.0)
     */ _getCurrentWeaponAmmoRatio() {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons) return 1.0; // Assume full if no weapon system
        const currentWeaponKey = ws.currentWeapon;
        if (!currentWeaponKey) return 1.0;
        const weapon = ws.weapons[currentWeaponKey];
        if (!weapon) return 1.0;
        // Get current ammo (magazine + reserve)
        const magazineAmmo = ws.weaponCore ? ws.weaponCore.currentMagazine : ws.currentMagazine || 0;
        const reserveAmmo = weapon.ammo || 0;
        const totalAmmo = magazineAmmo + reserveAmmo;
        // Get max ammo capacity for this weapon
        const maxAmmo = ws.maxAmmo?.[currentWeaponKey];
        if (!maxAmmo || maxAmmo <= 0) {
            // No max defined, consider any ammo as "full"
            return totalAmmo > 0 ? 1.0 : 0.0;
        }
        return Math.max(0, Math.min(1, totalAmmo / maxAmmo));
    }
    /**
     * ✅ CRITICAL FIX: Check line-of-sight to target before shooting
     * Prevents AI from shooting through walls when target is behind obstacles
     */ _hasLineOfSightToTarget(targetPos) {
        try {
            if (!targetPos || !this.agent.entity) {
                return false;
            }
            // Get weapon firing position (same logic as WeaponCore._getFireOrigin)
            const ws = this.agent.weaponSystem;
            let fireOrigin;
            // Try to get weapon socket position for accurate firing origin
            if (ws && ws.weaponSocket) {
                // Use weapon socket position if available
                fireOrigin = ws.weaponSocket.getPosition();
                // Validate weapon socket position (check for common bugs)
                const entityPos = this.agent.entity.getPosition();
                const distanceFromEntity = fireOrigin.distance(entityPos);
                if (distanceFromEntity > 20) {
                    // Weapon socket position seems invalid, use entity + eye height
                    this.Logger.warn(`[${this.entity.name}] Weapon socket too far from entity (${distanceFromEntity.toFixed(2)}m), using fallback`);
                    fireOrigin = entityPos.clone();
                    fireOrigin.y += 1.6; // Eye height
                }
            } else {
                // Fallback: use entity position + eye height
                fireOrigin = this.agent.entity.getPosition();
                fireOrigin.y += 1.6; // Eye height
            }
            // Perform raycast to check for obstacles between AI and target
            const result = this.agent.app.systems.rigidbody.raycastFirst(fireOrigin, targetPos);
            if (!result) {
                // No obstacle hit - clear line of sight
                return true;
            }
            // Check if we hit the target entity directly
            const targetEntity = this.agent.targetSystem?.getTargetEntity();
            if (result.entity === targetEntity) {
                // We hit the target itself - line of sight is clear
                return true;
            }
            // Check if hit entity is part of the target (child/parent relationship)
            if (targetEntity && this._isEntityRelated(result.entity, targetEntity)) {
                return true;
            }
            // Hit something else (wall, obstacle, etc.) - line of sight blocked
            const distance = fireOrigin.distance(result.point);
            const targetDistance = fireOrigin.distance(targetPos);
            this.Logger.debug(`[${this.entity.name}] Line of sight BLOCKED by "${result.entity?.name || 'unknown'}" at ${distance.toFixed(2)}m (target at ${targetDistance.toFixed(2)}m)`);
            return false;
        } catch (error) {
            this.Logger.warn(`[${this.entity.name}] Line of sight check error:`, error);
            // On error, allow shooting (fail-safe, but log the issue)
            return true;
        }
    }
    /**
     * Helper: Check if two entities are related (parent/child relationship)
     */ _isEntityRelated(entity1, entity2) {
        if (!entity1 || !entity2) return false;
        if (entity1 === entity2) return true;
        // Check if entity1 is a child of entity2
        let current = entity1;
        while(current && current.parent){
            if (current.parent === entity2) return true;
            current = current.parent;
        }
        // Check if entity2 is a child of entity1
        current = entity2;
        while(current && current.parent){
            if (current.parent === entity1) return true;
            current = current.parent;
        }
        return false;
    }
    getCorrectedForward() {
        const rawForward = this.entity.forward.clone();
        return rawForward.scale(-1);
    }
    canShootAtTarget() {
        if (!this.agent.targetSystem?.hasTarget()) return false;
        const targetEntity = this.agent.targetSystem.getTargetEntity();
        if (!targetEntity?.script?.healthSystem) return false;
        const healthSystem = targetEntity.script.healthSystem;
        if (healthSystem.isDead || healthSystem.currentHealth <= 0) return false;
        if (healthSystem.isRespawning || healthSystem.isBeingDestroyed) return false;
        if (!targetEntity.enabled || targetEntity.destroyed) return false;
        // ✅ CRITICAL FIX: AI cannot shoot what it cannot see (FOV check)
        // Real FPS players can't shoot targets behind them!
        const targetPos = this.agent.targetSystem.getTargetPosition();
        if (targetPos && this.entity && this.agent.vision) {
            const aiPos = this.entity.getPosition();
            const aiForward = this.getCorrectedForward(); // ✅ FIXED
            // Vector from AI to target
            const toTarget = new Vec3();
            toTarget.sub2(targetPos, aiPos);
            toTarget.normalize();
            // Angle between AI's forward direction and target direction
            const dotProduct = aiForward.dot(toTarget);
            const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
            // ✅ FIX: YUKA's fieldOfView is ALREADY the half-angle (max angle from forward)
            // Don't divide by 2! (75° FOV means 75° on each side, not 37.5°)
            const maxFOV = this.agent.vision.fieldOfView || Math.PI / 2; // Default 90°
            // 🔥 CRITICAL DEBUG: Log EVERY FOV check
            const angleDeg = angleToTarget * 180 / Math.PI;
            const maxDeg = maxFOV * 180 / Math.PI;
            const canShoot = angleToTarget <= maxFOV;
            Logger.combat(`[${this.entity.name}] 🎯 FOV CHECK: angle=${angleDeg.toFixed(0)}°, max=${maxDeg.toFixed(0)}°, forward=(${aiForward.x.toFixed(2)},${aiForward.z.toFixed(2)}), toTarget=(${toTarget.x.toFixed(2)},${toTarget.z.toFixed(2)}), canShoot=${canShoot}`);
            if (angleToTarget > maxFOV) {
                // Target is behind or outside FOV - cannot shoot
                Logger.combat(`[${this.entity.name}] ❌ Target OUTSIDE FOV - BLOCKING SHOT (angle: ${angleDeg.toFixed(0)}°, max: ${maxDeg.toFixed(0)}°)`);
                return false;
            }
        }
        return true;
    }
    isWeaponReady() {
        const ws = this.agent?.weaponSystem;
        if (!ws) {
            this.Logger.debug(`[${this.entity?.name || 'Unknown'}] No weapon system`);
            return false;
        }
        if (!ws._initialized || !ws.__wsBooted) {
            this.Logger.debug(`[${this.entity.name}] Weapon system not initialized (init=${ws._initialized}, boot=${ws.__wsBooted})`);
            return false;
        }
        if (!ws.weapons) {
            this.Logger.debug(`[${this.entity.name}] No weapons object`);
            return false;
        }
        const currentWeaponKey = ws.currentWeapon;
        if (!currentWeaponKey) {
            this.Logger.debug(`[${this.entity.name}] No current weapon selected`);
            return false;
        }
        const currentWeapon = ws.weapons[currentWeaponKey];
        if (!currentWeapon) {
            this.Logger.debug(`[${this.entity.name}] Current weapon ${currentWeaponKey} not found in weapons`);
            return false;
        }
        if (!currentWeapon.unlocked) {
            this.Logger.debug(`[${this.entity.name}] Weapon ${currentWeaponKey} not unlocked`);
            return false;
        }
        // ✅ CRITICAL FIX: Use authoritative magazine count from core
        const magazineAmmo = ws.weaponCore ? ws.weaponCore.currentMagazine : ws.currentMagazine || 0;
        const reserveAmmo = currentWeapon.ammo || 0;
        const totalAmmo = magazineAmmo + reserveAmmo;
        if (totalAmmo <= 0) {
            this.Logger.debug(`[${this.entity.name}] Weapon ${currentWeaponKey} has no ammo (mag=${magazineAmmo}, reserve=${reserveAmmo})`);
            return false;
        }
        // ✅ CRITICAL FIX: Check both facade and core reload states
        const facadeReloading = ws.isReloading;
        const coreReloading = ws.weaponCore ? ws.weaponCore.isReloading : false;
        const isReloading = facadeReloading || coreReloading;
        if (isReloading) {
            this.Logger.debug(`[${this.entity.name}] Weapon ${currentWeaponKey} is reloading (facade: ${facadeReloading}, core: ${coreReloading})`);
            return false;
        }
        this.Logger.debug(`[${this.entity.name}] Weapon ready: ${currentWeaponKey} (mag=${magazineAmmo}, reserve=${reserveAmmo}, total=${totalAmmo})`);
        return true;
    }
    canFireNow() {
        const ws = this.agent.weaponSystem;
        if (!ws) return false;
        // ✅ CRITICAL FIX: Check both facade and core reload states
        // Sometimes the facade isReloading is stale after reload completion
        const facadeReloading = ws.isReloading;
        const coreReloading = ws.weaponCore ? ws.weaponCore.isReloading : false;
        const isReloading = facadeReloading || coreReloading;
        if (isReloading) {
            this.Logger.debug(`[${this.entity.name}] 🔄 Still reloading - facade: ${facadeReloading}, core: ${coreReloading}`);
            return false;
        }
        // 🔥 FIX: Ensure all time values are numbers, not strings
        const now = performance.now() / 1000; // Convert to seconds (number)
        const weaponType = ws.currentWeapon || 'pistol';
        // 🎯 AI-ONLY FIRE RATE LIMITER (Oct 29, 2025)
        // Get base fire rate from weapon system (same as player uses)
        const baseFireRate = ws.fireRates?.[weaponType] || ws.weaponCore?.config?.fireRates?.[weaponType] || aiConfig.combat.MIN_SHOOT_INTERVAL;
        // Apply AI-specific multiplier to slow down AI fire rate (player unaffected!)
        const aiMultiplier = aiConfig.combat.AI_FIRE_RATE_MULTIPLIER[weaponType] || 1.0;
        const aiFireRate = baseFireRate * aiMultiplier;
        const timeSinceLastShot = now - this.lastShootTime; // Number subtraction
        // 🔥 CRITICAL: Numeric comparison using AI-adjusted fire rate
        if (timeSinceLastShot < aiFireRate) {
            // Log occasionally for debugging
            if (Math.random() < 0.01) {
                this.Logger.debug(`[${this.entity.name}] AI fire rate limit: ${timeSinceLastShot.toFixed(2)}s < ${aiFireRate.toFixed(2)}s (base: ${baseFireRate}s × ${aiMultiplier})`);
            }
            return false;
        }
        // ✅ CRITICAL FIX: Use authoritative magazine count from core
        const magazineAmmo = ws.weaponCore ? ws.weaponCore.currentMagazine : ws.currentMagazine || 0;
        if (magazineAmmo <= 0) {
            this.Logger.debug(`[${this.entity.name}] ❌ No magazine ammo - core: ${ws.weaponCore?.currentMagazine}, facade: ${ws.currentMagazine}`);
            return false;
        }
        return true;
    }
    handleWeaponNotReady() {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons) return;
        const currentWeaponKey = ws.currentWeapon;
        const currentWeapon = ws.weapons[currentWeaponKey];
        // ✅ CRITICAL FIX: Use authoritative magazine count from core
        const magazineAmmo = ws.weaponCore ? ws.weaponCore.currentMagazine : ws.currentMagazine || 0;
        const magazineEmpty = magazineAmmo <= 0;
        const hasAmmo = currentWeapon && (currentWeapon.ammo || 0) > 0;
        // Check both facade and core reload states
        const facadeReloading = ws.isReloading;
        const coreReloading = ws.weaponCore ? ws.weaponCore.isReloading : false;
        const isReloading = facadeReloading || coreReloading;
        if (magazineEmpty && hasAmmo && !isReloading) {
            this.Logger.info(`[${this.entity.name}] 🔄 Auto-reloading ${currentWeaponKey} - mag: ${magazineAmmo}, reserve: ${currentWeapon.ammo}, facade reload: ${facadeReloading}, core reload: ${coreReloading}`);
            if (typeof ws.reload === 'function') {
                ws.reload();
                // ✅ ADVANCED AI: Trigger backstep movement when reloading
                if (this.agent.combatSystem?.tacticsSystem && this.agent.combatDecisionContext) {
                    this.agent.combatSystem.tacticsSystem.executeBackstepForReload(this.agent.combatDecisionContext);
                }
            }
        }
    }
    hasMinimumAmmo() {
        if (!this.agent.weaponSystem || !this.agent.weaponSystem.weapons) {
            return false;
        }
        const ws = this.agent.weaponSystem;
        const currentWeapon = ws.weapons[ws.currentWeapon];
        if (!currentWeapon || !currentWeapon.unlocked) {
            return false;
        }
        const magazineAmmo = ws.currentMagazine || 0;
        const reserveAmmo = currentWeapon.ammo || 0;
        const totalAmmo = magazineAmmo + reserveAmmo;
        return totalAmmo > 0;
    }
    canEngageCombat() {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws._initialized || !ws.__wsBooted || !ws.weapons) {
            return false;
        }
        const hasUnlockedWeapon = Object.keys(ws.weapons).some((key)=>{
            const weapon = ws.weapons[key];
            return weapon && weapon.unlocked === true;
        });
        if (!hasUnlockedWeapon) {
            return false;
        }
        const currentWeapon = ws.getCurrentKey ? ws.getCurrentKey() : ws.currentWeapon;
        const hasAmmo = currentWeapon && ws.weapons[currentWeapon] && (ws.weapons[currentWeapon].ammo > 0 || (ws.currentMagazine || 0) > 0);
        if (!hasAmmo) {
            return false;
        }
        return true;
    }
    canEngageInCombat() {
        if (!this.agent) {
            Logger.warn('[CombatCore] No agent reference');
            return false;
        }
        if (!this.agent.targetSystem) {
            Logger.warn(`[${this.entity.name}] No targetSystem available`);
            return false;
        }
        if (!this.agent.weaponSystem) {
            Logger.warn(`[${this.entity.name}] No weaponSystem available`);
            return false;
        }
        const hasTarget = this.agent.targetSystem.hasTarget();
        const targetPos = hasTarget ? this.agent.targetSystem.getTargetPosition() : null;
        // ✅ CRITICAL FIX: Don't rotate toward enemy when critically wounded
        // Let AI sprint directly to health without combat rotation interference
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        const isCriticallyWounded = healthRatio < 0.5;
        if (hasTarget && targetPos && this.agent.utilities && !isCriticallyWounded) {
            if (this.agent.utilities.shouldRotateTowardTarget()) {
                const rotationComplete = this.agent.utilities.rotateTowardTarget(targetPos);
                Logger.debug(`[${this.entity.name}] Target outside FOV - rotating... (complete: ${rotationComplete})`);
            }
        }
        const isTargetVisible = this.agent.targetSystem.isTargetVisible();
        const hasHealth = this.agent.health > this.agent.maxHealth * aiConfig.combat.CRITICAL_HEALTH_THRESHOLD;
        const hasAmmo = this.hasMinimumAmmo();
        const weaponReady = this.isWeaponReady();
        if (!weaponReady || !hasAmmo) {
            const ws = this.agent.weaponSystem;
            const magazineAmmo = ws?.currentMagazine || 0;
            const currentWeaponKey = ws?.currentWeapon;
            const currentWeapon = ws?.weapons?.[currentWeaponKey];
            const reserveAmmo = currentWeapon?.ammo || 0;
            const totalAmmo = magazineAmmo + reserveAmmo;
            if (hasTarget && isTargetVisible) {
                Logger.combat(`[${this.entity.name}] Combat engagement blocked:`, {
                    hasTarget,
                    isTargetVisible,
                    weaponReady,
                    hasHealth,
                    hasAmmo,
                    currentWeaponKey,
                    weaponUnlocked: currentWeapon?.unlocked === true,
                    magazineAmmo,
                    reserveAmmo,
                    totalAmmo,
                    weaponSystemInitialized: ws?._initialized === true,
                    weaponSystemBooted: ws?.__wsBooted === true
                });
            }
        }
        return hasTarget && isTargetVisible && weaponReady && hasHealth && hasAmmo;
    }
    getCombatEffectiveness() {
        let effectiveness = 0.5;
        const healthRatio = this.agent.health / this.agent.maxHealth;
        effectiveness += (healthRatio - 0.5) * aiConfig.combat.HEALTH_ACCURACY_BONUS * 3; // Scale up health impact
        effectiveness += (this.agent.alertness - 0.5) * aiConfig.combat.ALERTNESS_PRIORITY_MODIFIER;
        if (this.agent.utilities) {
            if (this.agent.utilities.hasAdequateAmmo()) effectiveness += aiConfig.combat.ADEQUATE_AMMO_PRIORITY_BONUS;
            else if (this.agent.utilities.hasUsableAmmo()) effectiveness += aiConfig.combat.ADEQUATE_AMMO_PRIORITY_BONUS / 2;
            else effectiveness -= aiConfig.combat.NO_AMMO_PRIORITY_PENALTY;
        } else {
            effectiveness += this.hasMinimumAmmo() ? aiConfig.combat.ADEQUATE_AMMO_PRIORITY_BONUS / 2 : -aiConfig.combat.NO_AMMO_PRIORITY_PENALTY;
        }
        effectiveness += (this.agent.morale - 0.5) * aiConfig.combat.ALERTNESS_PRIORITY_MODIFIER;
        const targetPos = this.agent.targetSystem?.getTargetPosition();
        if (targetPos) {
            const distance = this.entity.getPosition().distance(targetPos);
            let optimalRange = aiConfig.combat.OPTIMAL_ENGAGEMENT_RANGE;
            let maxRange = aiConfig.combat.MAX_ENGAGEMENT_RANGE;
            if (this.agent.personalitySystem) {
                const ranges = this.agent.personalitySystem.getPreferredEngagementRange();
                optimalRange = ranges.optimal;
                maxRange = ranges.max;
            }
            if (distance <= optimalRange) effectiveness += aiConfig.combat.OPTIMAL_DISTANCE_ACCURACY_BONUS;
            else if (distance > maxRange) effectiveness -= aiConfig.combat.LONG_RANGE_PRIORITY_PENALTY;
        }
        return Math.max(0, Math.min(1.2, effectiveness));
    }
    shouldEngageTarget(target) {
        if (!target) return false;
        if (this.agent.eventHandler && !this.agent.eventHandler._isValidTarget(target)) return false;
        const effectiveness = this.getCombatEffectiveness();
        let threatLevel = 1.0;
        if (this.agent.eventHandler?.getThreatLevel) {
            const entity = this.agent.eventHandler._getTargetEntity(target);
            threatLevel = this.agent.eventHandler.getThreatLevel(entity?.getGuid()) || 1.0;
        }
        return effectiveness > aiConfig.combat.MIN_ENGAGEMENT_EFFECTIVENESS + threatLevel * aiConfig.combat.THREAT_LEVEL_PRIORITY_MULTIPLIER;
    }
    handleAimLock(targetPos, shotFired) {
        // ✅ REMOVED: Aim lock rotation snapping
        // This was causing the backwards shooting visual glitch
        // NavigationAdapter now handles ALL rotation smoothly
        return;
    }
    updateCombatStats(dt) {
        this.combatStats.totalCombatTime += dt;
    }
    getCombatStats() {
        return {
            ...this.combatStats
        };
    }
    resetCombatStats() {
        this.combatStats = {
            totalCombatTime: 0,
            shotsFired: 0,
            hitsLanded: 0,
            movementCount: 0,
            engagementCount: 0
        };
    }
    recordHit() {
        this.combatStats.hitsLanded++;
        const currentWeapon = this.agent.weaponSystem?.currentWeapon;
        if (this.agent.weaponSelector && currentWeapon) {
            this.agent.weaponSelector.recordShot(currentWeapon, true);
        }
        this.agent.emotionalSystem?.recordHit();
        // ✅ FIX: Update per-target hit time HERE (when shot actually hits)
        // This enforces cooldown between HITS, not between SHOTS
        const targetEntity = this.agent.targetSystem?.getTargetEntity();
        if (targetEntity) {
            const now = performance.now() / 1000;
            this.lastHitTimeByTarget.set(targetEntity.getGuid(), now);
        }
    }
    recordKill() {
        const currentWeapon = this.agent.weaponSystem?.currentWeapon;
        if (this.agent.weaponSelector && currentWeapon) {
            this.agent.weaponSelector.recordKill(currentWeapon);
        }
        this.agent.emotionalSystem?.recordKill();
    }
    /**
     * ✅ UPGRADED: Apply human-like aim with full imperfection model
     * Uses HumanAimSystem for realistic aim patterns
     */ _applyAimJitter(targetPos) {
        // Use new HumanAimSystem if available
        if (this.agent.aimSystem) {
            const targetEntity = this.agent.targetSystem?.getTargetEntity() || null;
            const deltaTime = this.entity.app?.deltaTime || 0.016;
            // Get human-like aim point with all imperfections
            const humanAimPoint = this.agent.aimSystem.calculateAimPoint(targetPos, targetEntity, deltaTime);
            return humanAimPoint;
        }
        // FALLBACK: Old personality-based jitter (if HumanAimSystem not available)
        const personality = this.agent.personalitySystem;
        if (!personality) {
            return targetPos; // No jitter if no personality system
        }
        // Calculate jitter amount based on accuracy trait (0-1)
        // Low accuracy (0.3) = 20% deviation, High accuracy (0.9) = 2% deviation
        const accuracyTrait = personality.traits.accuracy;
        const maxJitter = 0.20; // Maximum 20% deviation
        const jitterAmount = maxJitter * (1.0 - accuracyTrait);
        // Get distance to target for scaling jitter
        const myPos = this.entity.getPosition();
        const distance = myPos.distance(targetPos);
        // Jitter increases with distance
        const distanceScaling = Math.min(distance / 20, 1.5); // Cap at 1.5x
        const finalJitter = jitterAmount * distanceScaling;
        // Apply random jitter in 3D space
        const jitterX = (Math.random() - 0.5) * finalJitter * distance;
        const jitterY = (Math.random() - 0.5) * finalJitter * distance * 0.5; // Less vertical jitter
        const jitterZ = (Math.random() - 0.5) * finalJitter * distance;
        const jitteredTarget = targetPos.clone();
        jitteredTarget.x += jitterX;
        jitteredTarget.y += jitterY;
        jitteredTarget.z += jitterZ;
        return jitteredTarget;
    }
    /**
     * ✅ NEW: Pause shooting for a duration (used by AdvancedTacticsSystem for baiting)
     */ pauseShooting(durationSeconds) {
        this._shootingPaused = true;
        this._shootingPauseUntil = performance.now() / 1000 + durationSeconds;
        this.Logger.debug(`[${this.entity.name}] 🛑 Shooting paused for ${durationSeconds.toFixed(1)}s`);
    }
    /**
     * ✅ NEW: Resume shooting immediately
     */ resumeShooting() {
        this._shootingPaused = false;
        this._shootingPauseUntil = 0;
        this.Logger.debug(`[${this.entity.name}] ▶️ Shooting resumed`);
    }
    /**
     * ✅ NEW: Request a shot to be fired (used by AdvancedTacticsSystem)
     */ requestShot(accuracyOverride = null) {
        // Force a shot on next executeShooting call by resetting cooldowns
        this.lastShootTime = 0;
        this.burstFireCount = 0;
        if (accuracyOverride !== null) {
            // Temporarily override accuracy for this shot
            this._accuracyOverride = accuracyOverride;
        }
    }
    destroy() {
        this.combatStats = null;
        this._originalForward = null;
        this.lastHitTimeByTarget?.clear(); // ✅ FIX: Clean up target cooldown tracking
        this.Logger.debug(`[${this.entity.name}] CombatCore destroyed`);
    }
    constructor(agent){
        this.agent = agent;
        this.entity = agent.entity;
        // ✅ FIX: Initialize Logger reference safely with fallbacks
        this.Logger = globalThis.Logger || Logger || console;
        // ✅ FIX: Ensure Logger has all methods we need
        if (!this.Logger.combat) {
            this.Logger.combat = this.Logger.info || this.Logger.log || console.log;
        }
        if (!this.Logger.debug) {
            this.Logger.debug = this.Logger.log || console.log;
        }
        if (!this.Logger.warn) {
            this.Logger.warn = this.Logger.log || console.warn;
        }
        if (!this.Logger.error) {
            this.Logger.error = console.error;
        }
        if (!this.Logger.info) {
            this.Logger.info = this.Logger.log || console.log;
        }
        // ✅ OPTIMIZED FOR REALISTIC FPS AI (Oct 23, 2025)
        // Human players use varied burst patterns
        // ✅ FIX: Initialize to current time to prevent false "failed for Xs" warnings on first shot
        this.lastShootTime = performance.now() / 1000;
        this.burstFireCount = 0;
        this.maxBurstSize = aiConfig.combat.MAX_BURST_SIZE;
        this.maxBurstCount = aiConfig.combat.MAX_BURST_SIZE;
        this.burstCooldown = aiConfig.combat.BURST_COOLDOWN;
        this.lastBurstTime = 0;
        this.minShootInterval = aiConfig.combat.MIN_SHOOT_INTERVAL;
        // ✅ FIX: Per-target attack cooldown to prevent instant player melting
        // This tracks the last time we hit each specific target to enforce a minimum time between hits
        this.lastHitTimeByTarget = new Map(); // targetGuid -> timestamp
        this.minTimeBetweenHitsOnSameTarget = aiConfig.combat.MIN_TIME_BETWEEN_HITS_SAME_TARGET;
        // 🔫 AUTOMATIC WEAPON FIX (Oct 23, 2025)
        // Track continuous firing for automatic weapons like machinegun
        this._continuousFiring = false;
        this._fireHoldStartTime = 0;
        // ✅ OPTIMIZED: Human-like aim transitions
        this._originalForward = null;
        this._aimLockTime = 0;
        this._aimLockDuration = aiConfig.combat.AIM_LOCK_DURATION;
        // ✅ NEW: Shooting pause control (for advanced tactics like baiting)
        this._shootingPaused = false;
        this._shootingPauseUntil = 0;
        // Statistics
        this.combatStats = {
            totalCombatTime: 0,
            shotsFired: 0,
            hitsLanded: 0,
            movementCount: 0,
            engagementCount: 0
        };
        // ✅ NEW: Diagnostic logging throttles
        this._lastFireBlockLog = 0;
        this._lastTargetBlockLog = 0;
        this._lastShootDecisionLog = 0;
        this._lastFireAttemptLog = 0;
        this._lastFireSuccessLog = 0;
        this._lastLineOfSightBlockLog = 0; // ✅ NEW: For line-of-sight blocking
        this._lastTargetCooldownLog = 0; // ✅ NEW: For target cooldown logging
        this.Logger.debug(`[${this.entity.name}] CombatCore initialized`);
    }
}

export { CombatCore };
