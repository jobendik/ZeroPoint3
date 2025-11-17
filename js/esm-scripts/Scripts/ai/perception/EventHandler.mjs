import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AIEventHandler {
    // ============================================================================
    // LOGGING UTILITIES
    // ============================================================================
    _logThrottled(key, level, message, ...args) {
        const now = performance.now();
        const lastLog = this.logThrottles.get(key) || 0;
        if (now - lastLog > this.LOG_THROTTLE_MS) {
            this.logThrottles.set(key, now);
            const frameId = Math.floor(now);
            const fullMessage = `[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} ${message}`;
            switch(level){
                case 'debug':
                    Logger.debug(fullMessage, ...args);
                    break;
                case 'info':
                    Logger.info(fullMessage, ...args);
                    break;
                case 'warn':
                    Logger.warn(fullMessage, ...args);
                    break;
                case 'error':
                    Logger.error(fullMessage, ...args);
                    break;
                case 'combat':
                    Logger.combat(fullMessage, ...args);
                    break;
                case 'aiState':
                    Logger.aiState(fullMessage, ...args);
                    break;
                case 'health':
                    Logger.health(fullMessage, ...args);
                    break;
                default:
                    Logger.info(fullMessage, ...args);
                    break;
            }
            return true;
        }
        return false;
    }
    // ============================================================================
    // FRIENDLY FIRE DETECTION
    // ============================================================================
    _isFriendlyFire(attackerEntity, targetEntity) {
        if (!attackerEntity || !targetEntity) return false;
        // Self-damage check
        try {
            if (attackerEntity.getGuid() === targetEntity.getGuid()) {
                return true;
            }
        } catch (e) {
            if (attackerEntity === targetEntity) return true;
        }
        // Team-based checks
        if (attackerEntity.team && targetEntity.team) {
            if (attackerEntity.team === targetEntity.team) {
                return true;
            }
            if (attackerEntity.team === 'ai' && targetEntity.team === 'ai') {
                return true;
            }
        }
        // Tag-based team identification
        if (attackerEntity.tags && targetEntity.tags) {
            const attackerIsAI = attackerEntity.tags.has('team_ai') || attackerEntity.tags.has('faction_ai');
            const targetIsAI = targetEntity.tags.has('team_ai') || targetEntity.tags.has('faction_ai');
            if (attackerIsAI && targetIsAI) {
                return true;
            }
            const attackerIsPlayer = attackerEntity.tags.has('team_player') || attackerEntity.tags.has('player');
            const targetIsPlayer = targetEntity.tags.has('team_player') || targetEntity.tags.has('player');
            if (attackerIsPlayer && targetIsPlayer) {
                return true;
            }
        }
        // Script-based identification
        const attackerIsAI = !!(attackerEntity.script && attackerEntity.script.aiAgent);
        const targetIsAI = !!(targetEntity.script && targetEntity.script.aiAgent);
        const attackerIsPlayer = !!(attackerEntity.script && (attackerEntity.script.player || attackerEntity.script.playerController));
        const targetIsPlayer = !!(targetEntity.script && (targetEntity.script.player || targetEntity.script.playerController));
        if (attackerIsAI && targetIsAI) {
            return true;
        }
        if (attackerIsPlayer && targetIsPlayer) {
            return true;
        }
        return false;
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    onEnemySpotted(enemy) {
        try {
            // Boost alertness
            this.agent.alertness = Math.min(aiConfig.events.ALERTNESS_MAX, this.agent.alertness + aiConfig.events.DAMAGE_ALERTNESS_BOOST);
            const hasAmmo = this.agent.utilities ? this.agent.utilities.hasUsableAmmo() : this.agent.hasUsableAmmo();
            const ws = this.agent.weaponSystem;
            const hasAnyWeapon = ws && ws.weapons && Object.keys(ws.weapons).some((key)=>ws.weapons[key] && ws.weapons[key].unlocked);
            const currentState = this.agent.stateMachine?.currentState?.type;
            if (!hasAnyWeapon) {
                this._logThrottled('no_weapons', 'aiState', `Enemy spotted but no weapons - staying in ${currentState || 'current'} state`);
                if (currentState === 'patrol' || !currentState) {
                    this.agent.currentActivity = 'alert';
                }
                return;
            }
            if (!hasAmmo) {
                this._logThrottled('no_ammo', 'aiState', `Enemy spotted but no ammo - staying in ${currentState || 'current'} state`);
                if (currentState === 'patrol' || !currentState) {
                    this.agent.currentActivity = 'alert';
                }
                return;
            }
            if (currentState === 'patrol' || !currentState) {
                this.agent.currentActivity = 'alert';
            }
            const enemyName = this.getTargetEntityName(enemy);
            const frameId = Math.floor(performance.now());
            Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Enemy spotted: ${enemyName}`);
            const threatLevel = this._assessThreatLevel(enemy);
            this._updateActiveThreats(enemy, threatLevel);
            this._recordEventPattern('enemy_spotted', enemyName);
            if (threatLevel > 1.2) {
                Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} High threat detected: ${enemyName} (${threatLevel.toFixed(2)})`);
                if (this.agent.targetSystem) {
                    const targetEntity = this._extractPlayCanvasEntity(enemy);
                    if (targetEntity) {
                        this.agent.targetSystem.forceTarget({
                            entity: targetEntity
                        });
                    }
                }
                if (this.agent.stateMachine) {
                    this.agent.currentActivity = 'combat';
                }
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling enemy spotted:`, error);
        }
    }
    onSoundDetected(source) {
        try {
            if (this.agent.visionSystem && typeof this.agent.visionSystem.onSoundDetected === 'function') {
                this.agent.visionSystem.onSoundDetected(source);
            }
            if (this.agent.alertness < aiConfig.events.ENEMY_SPOTTED_ALERTNESS_THRESHOLD) {
                this.agent.alertness = Math.min(aiConfig.events.ALERTNESS_MAX, this.agent.alertness + aiConfig.events.SOUND_ALERTNESS_BOOST);
                let investigationTarget = null;
                let sourceName = 'Unknown';
                if (source.entity) {
                    investigationTarget = source.entity.getPosition().clone();
                    sourceName = this.getTargetEntityName({
                        entity: source.entity
                    });
                } else if (source.position) {
                    investigationTarget = source.position.clone();
                    sourceName = 'Unknown Position';
                }
                if (investigationTarget) {
                    if (this.agent.navigation && this.agent.navigation.findValidNavMeshPosition) {
                        const validPos = this.agent.navigation.findValidNavMeshPosition(investigationTarget, 10);
                        if (validPos) {
                            this.agent.investigationTarget = validPos;
                        } else {
                            Logger.warn(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Sound source position not reachable: ${sourceName}`);
                            return;
                        }
                    } else {
                        this.agent.investigationTarget = investigationTarget;
                    }
                    this._logThrottled('sound_detected', 'aiDetail', `Sound detected from: ${sourceName}`);
                    this._addToSoundHistory(source, sourceName);
                    const currentState = this.agent.stateMachine?.currentState?.type;
                    if (currentState === 'patrol' || currentState === 'alert') {
                        this.agent.currentActivity = 'investigate';
                    }
                    this._recordEventPattern('sound_detected', sourceName);
                }
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling sound detection:`, error);
        }
    }
    /**
     * This is the updated onDamage method.
     * It now includes the logic to notify the TakeCoverEvaluator.
     */ onDamage(damage, attacker) {
        if (this.agent.isDead) return;
        try {
            const frameId = Math.floor(performance.now());
            let attackerEntity = this._extractPlayCanvasEntity(attacker);
            // ✅ FIX: If attacker is invalid, try to find nearby hostile entity
            if (!attackerEntity || !this._isValidAttacker(attackerEntity)) {
                attackerEntity = this._findNearbyAttacker();
                if (!attackerEntity) {
                    this._logThrottled('no_valid_attacker', 'warn', `Damage received but no valid attacker found`);
                // Still process damage even without valid attacker
                }
            }
            let attackerName = this._getAttackerName(attacker);
            let attackerId = 'unknown';
            if (attackerEntity) {
                try {
                    attackerId = attackerEntity.getGuid();
                    const baseName = this.getTargetEntityName({
                        entity: attackerEntity
                    });
                    attackerName = baseName !== 'UnknownEntity' ? `${baseName}#${attackerId.substring(0, 8)}` : `Entity_${attackerId.substring(0, 8)}`;
                } catch (e) {
                    attackerId = 'invalid';
                    attackerName = 'InvalidAttacker';
                }
            }
            // Check for friendly fire
            if (attackerEntity && this._isFriendlyFire(attackerEntity, this.agent.entity)) {
                const now = performance.now();
                if (now - this.lastFriendlyFireWarning > this.FRIENDLY_FIRE_WARNING_THROTTLE) {
                    this.lastFriendlyFireWarning = now;
                    Logger.health(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} IGNORED friendly fire from ${attackerName}`);
                }
                return;
            }
            // ✅ ================== NEW LOGIC BLOCK ==================
            // --- 1. Notify TakeCoverEvaluator ---
            // This is critical for making the AI react defensively.
            try {
                if (this.agent.brain && this.agent.brain.evaluators) {
                    const coverEvaluator = this.agent.brain.evaluators.find((e)=>e.constructor.name === 'TakeCoverEvaluator');
                    if (coverEvaluator && typeof coverEvaluator.onDamageTaken === 'function') {
                        coverEvaluator.onDamageTaken(this.agent, damage);
                        this._logThrottled('notify_cover', 'debug', `Notified TakeCoverEvaluator of ${damage} damage.`);
                    }
                }
            } catch (error) {
                Logger.error(`[${this.agentName}] Error notifying TakeCoverEvaluator of damage:`, error);
            }
            // --- 2. Trigger Reactive Strafing (IMMEDIATE DODGE) ---
            // ✅ NEW: Make AI strafe immediately when shot at (human-like defensive micro)
            try {
                // ✅ FIX: Use tacticsSystem from combatSystem (not combatTactics)
                const tacticsSystem = this.agent.combatSystem?.tacticsSystem;
                if (tacticsSystem && typeof tacticsSystem.triggerReactiveStrafe === 'function') {
                    const strafeTriggered = tacticsSystem.triggerReactiveStrafe();
                    if (strafeTriggered) {
                        this._logThrottled('reactive_strafe', 'combat', `⚡ Triggered reactive strafe (damage: ${damage})`);
                    }
                }
            } catch (error) {
                Logger.error(`[${this.agentName}] Error triggering reactive strafe:`, error);
            }
            // ✅ ================ END NEW LOGIC BLOCK ==================
            const previousHealth = this.agent.health;
            const currentHealth = this.agent.health; // Health already updated by HealthSystem
            if (typeof damage !== 'number' || damage <= 0) {
                Logger.warn(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Invalid damage value: ${damage}`);
                return;
            }
            this.agent.alertness = aiConfig.events.ALERTNESS_MAX;
            if (this.agent.health > 0) {
                this.agent.morale = Math.max(aiConfig.events.MORALE_MIN, this.agent.morale - aiConfig.events.MORALE_DAMAGE_PENALTY);
            }
            const nowSec = performance.now() / 1000;
            const dt = Math.max(0.001, nowSec - (this.lastDamageTime || nowSec));
            this.lastDamageTime = nowSec;
            this.agent.lastDamageTime = this.lastDamageTime;
            this.healthChangeRate = (this.agent.health - this.lastHealthRatio * this.agent.maxHealth) / dt;
            this.lastHealthRatio = this.agent.health / this.agent.maxHealth;
            // ✅ FIX: Always try to acquire target when damaged (combat readiness)
            if (attackerEntity && this.agent.targetSystem) {
                // Wrap entity in object with entity property (TargetingSystem expects { entity: PlayCanvasEntity })
                this.agent.targetSystem.forceTarget({
                    entity: attackerEntity
                });
                Logger.combat(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Target forced on attacker: ${attackerName}`);
                const threatLevel = this._assessThreatLevel({
                    entity: attackerEntity
                });
                this._updateActiveThreats({
                    entity: attackerEntity
                }, threatLevel + aiConfig.events.THREAT_BOOST);
                // ✅ FIX: Transition to combat state when damaged
                const currentState = this.agent.stateMachine?.currentState?.type;
                if (this.agent.stateMachine && currentState !== 'combat') {
                    // ✅ TWO BRAINS FIX: Set activity for state reflection instead of direct state change
                    this.agent.currentActivity = 'combat';
                }
            }
            this._addToDamageHistory(damage, attackerName, previousHealth, this.agent.health);
            if (this.agent.health > 0) {
                this._processDamageResponse(damage, previousHealth, attackerEntity);
            }
            Logger.health(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Took ${damage} damage from ${attackerName} -> ${this.agent.health}/${this.agent.maxHealth} (${(this.agent.health / this.agent.maxHealth * 100).toFixed(0)}%)`);
            this._fireDamageEvent(damage, attacker, attackerEntity, previousHealth, frameId);
            if (this.agent.health <= 0) {
                this.onDeath(attacker);
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error processing damage:`, error);
        }
    }
    /**
     * ✅ FIX: Find nearby hostile entity when damage source is invalid
     */ _findNearbyAttacker() {
        try {
            const myPos = this.agent.entity.getPosition();
            const searchRadius = aiConfig.perception.EVENT_SEARCH_RADIUS; // Search within 30 units
            let closestHostile = null;
            let closestDistance = Infinity;
            // ✅ FIX: Search for player first (primary target)
            const playerEntities = this.agent.app.root.findByTag('player');
            if (playerEntities && playerEntities.length > 0) {
                for (const playerEntity of playerEntities){
                    if (!playerEntity || !playerEntity.enabled) continue;
                    const playerPos = playerEntity.getPosition();
                    const distance = myPos.distance(playerPos);
                    if (distance < searchRadius && distance < closestDistance) {
                        closestDistance = distance;
                        closestHostile = playerEntity;
                    }
                }
            }
            // If no player found, search all script entities
            if (!closestHostile) {
                const allScriptComponents = this.agent.app.root.findComponents('script');
                for (const scriptComponent of allScriptComponents){
                    const entity = scriptComponent.entity;
                    // Skip self
                    if (entity === this.agent.entity) continue;
                    // Check if hostile
                    if (this._isHostileToAgent(entity)) {
                        const entityPos = entity.getPosition();
                        const distance = myPos.distance(entityPos);
                        if (distance < searchRadius && distance < closestDistance) {
                            closestDistance = distance;
                            closestHostile = entity;
                        }
                    }
                }
            }
            if (closestHostile) {
                Logger.combat(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] 🎯 Found nearby attacker: ${closestHostile.name} at ${closestDistance.toFixed(1)}m`);
            }
            return closestHostile;
        } catch (error) {
            Logger.warn(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error finding nearby attacker:`, error);
            return null;
        }
    }
    /**
     * ✅ FIX: Check if entity is hostile to this agent
     */ _isHostileToAgent(entity) {
        if (!entity || !entity.enabled) return false;
        // Check for player
        if (entity.script?.player || entity.script?.playerController) {
            return true; // AI is hostile to player by default
        }
        // Check for different teams
        if (entity.team && this.agent.entity.team) {
            return entity.team !== this.agent.entity.team;
        }
        // Check tags
        if (entity.tags?.has('player') || entity.tags?.has('team_player')) {
            return true;
        }
        // Don't target other AI unless they have different teams
        if (entity.script?.aiAgent) {
            if (entity.team && this.agent.entity.team) {
                return entity.team !== this.agent.entity.team;
            }
            return false; // Default to friendly for AI without teams
        }
        return false;
    }
    onDeath(attacker) {
        if (this.deathProcessed) return;
        this.deathProcessed = true;
        try {
            const frameId = Math.floor(performance.now());
            const attackerEntity = this._extractPlayCanvasEntity(attacker);
            const deathCause = this._analyzeDeathCause(attacker);
            Logger.health(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} DEATH - cause: ${deathCause}`);
            this.agent.isDead = true;
            if (this.agent.targetSystem) {
                this.agent.targetSystem._clearCurrentTarget();
            }
            if (this.agent.brain) {
                this.agent.brain.clearSubgoals();
            }
            this.agent.stopMovement();
            this._fireDeathEvent(attacker, attackerEntity, deathCause, frameId);
            this._scheduleEntityDestruction();
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error processing death:`, error);
        }
    }
    onTargetAcquired(target) {
        try {
            const targetName = this.getTargetEntityName(target);
            const frameId = Math.floor(performance.now());
            Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Target acquired: ${targetName}`);
            this.agent.alertness = Math.min(aiConfig.events.ALERTNESS_MAX, this.agent.alertness + aiConfig.events.SOUND_ALERTNESS_BOOST);
            this._updateActiveThreats(target, aiConfig.events.BASE_THREAT_LEVEL);
            this._recordEventPattern('target_acquired', targetName);
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling target acquired:`, error);
        }
    }
    onTargetLost(target) {
        try {
            const targetName = this.getTargetEntityName(target);
            this._logThrottled('target_lost', 'aiDetail', `Target lost: ${targetName}`);
            this.agent.alertness = Math.max(aiConfig.events.ALERTNESS_MIN, this.agent.alertness - aiConfig.events.ALERTNESS_DECAY);
            this._reduceActiveThread(target, aiConfig.events.THREAT_REDUCTION);
            this._recordEventPattern('target_lost', targetName);
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling target lost:`, error);
        }
    }
    onTargetSwitched(oldTarget, newTarget) {
        try {
            const oldTargetName = this.getTargetEntityName(oldTarget);
            const newTargetName = this.getTargetEntityName(newTarget);
            const frameId = Math.floor(performance.now());
            Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Target switched: ${oldTargetName} → ${newTargetName}`);
            this._recordEventPattern('target_switched', `${oldTargetName}_to_${newTargetName}`);
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling target switch:`, error);
        }
    }
    onPotentialTargetDetected(target) {
        try {
            const targetName = this.getTargetEntityName(target);
            this._logThrottled('potential_target', 'aiDetail', `Potential target detected: ${targetName}`);
            this._recordEventPattern('potential_target', targetName);
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error handling potential target:`, error);
        }
    }
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    _extractPlayCanvasEntity(obj) {
        if (!obj) return null;
        if (obj.getPosition && typeof obj.getPosition === 'function') {
            return obj;
        }
        if (obj.entity && typeof obj.entity.getPosition === 'function') {
            return obj.entity;
        }
        if (obj.agent && obj.agent.entity && typeof obj.agent.entity.getPosition === 'function') {
            return obj.agent.entity;
        }
        if (obj.script && obj.script.entity && typeof obj.script.entity.getPosition === 'function') {
            return obj.script.entity;
        }
        return null;
    }
    _isValidAttacker(attackerEntity) {
        if (!attackerEntity) return false;
        if (attackerEntity.destroyed) return false;
        try {
            if (typeof attackerEntity.getPosition !== 'function') return false;
            if (attackerEntity === this.agent.entity) return false;
            try {
                if (attackerEntity.getGuid && this.agent.entity.getGuid) {
                    if (attackerEntity.getGuid() === this.agent.entity.getGuid()) {
                        return false;
                    }
                }
            } catch (e) {}
            if (this._isFriendlyFire(attackerEntity, this.agent.entity)) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }
    _processDamageResponse(damage, previousHealth, attackerEntity) {
        if (this.agent.health <= 0) return;
        const healthRatio = this.agent.health / this.agent.maxHealth;
        const damageRatio = damage / this.agent.maxHealth;
        const frameId = Math.floor(performance.now());
        if (damageRatio > aiConfig.events.HEAVY_DAMAGE_THRESHOLD || healthRatio < aiConfig.events.LOW_HEALTH_THRESHOLD) {
            this._logThrottled('critical_damage', 'combat', `CRITICAL DAMAGE - seeking emergency action (${(healthRatio * 100).toFixed(0)}% HP)`);
            if (healthRatio < aiConfig.events.CRITICAL_HEALTH_THRESHOLD) {
                const healthItem = this.agent.utilities ? this.agent.utilities.getClosestHealthItem() : this.agent._getClosestHealthItem();
                if (healthItem && healthItem.isAvailable) {
                    Logger.health(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Emergency health seeking after critical damage`);
                    if (this.agent.stateMachine) {
                        this.agent.currentActivity = 'seekHealth';
                    }
                }
            }
        } else if (damageRatio > aiConfig.events.MODERATE_DAMAGE_THRESHOLD) {
            this._logThrottled('heavy_damage', 'combat', `HEAVY DAMAGE - defensive response (${(healthRatio * 100).toFixed(0)}% HP)`);
            if (this.agent.navigation && this.agent.navigation.findTacticalPosition) {
                const coverPos = this.agent.navigation.findTacticalPosition('cover', this.agent.targetSystem ? this.agent.targetSystem.getTargetPosition() : null);
                if (coverPos && this.agent.navigation.moveTo) {
                    this.agent.navigation.moveTo(coverPos);
                    this.agent.isInCover = true;
                }
            }
        }
        if (this.damageHistory.length >= 3) {
            const recentDamage = this.damageHistory.slice(-3);
            const totalRecentDamage = recentDamage.reduce((sum, entry)=>sum + entry.damage, 0);
            if (totalRecentDamage > this.agent.maxHealth * aiConfig.events.SEVERE_DAMAGE_THRESHOLD) {
                this.agent.morale = Math.max(aiConfig.events.MORALE_DAMAGE_THRESHOLD_MIN, this.agent.morale - aiConfig.events.MORALE_HEAVY_DAMAGE_PENALTY);
                this._logThrottled('morale_reduced', 'combat', `Morale reduced due to sustained damage (${totalRecentDamage.toFixed(0)} total)`);
            }
        }
    }
    _assessThreatLevel(enemy) {
        try {
            if (!enemy) return 0;
            let threatLevel = aiConfig.events.THREAT_REDUCTION;
            const entity = this._extractPlayCanvasEntity(enemy);
            if (!entity) return threatLevel;
            const enemyPos = entity.getPosition();
            const myPos = this.agent.entity.getPosition();
            const distance = enemyPos.distance(myPos);
            threatLevel += Math.max(0, 1 - distance / 30);
            if (entity.script && entity.script.healthSystem) {
                const healthRatio = entity.script.healthSystem.currentHealth / entity.script.healthSystem.maxHealth;
                threatLevel += healthRatio * 0.3;
            }
            if (entity.script && entity.script.weaponSystem) {
                threatLevel += 0.4;
                if (entity.script.weaponSystem.weapons) {
                    const hasAmmo = Object.values(entity.script.weaponSystem.weapons).some((weapon)=>weapon.ammo > 0 || weapon.magazine > 0);
                    if (hasAmmo) threatLevel += 0.3;
                }
            }
            const entityId = entity.getGuid ? entity.getGuid() : 'unknown';
            if (entityId !== 'unknown') {
                this.threatAssessments.set(entityId, {
                    level: threatLevel,
                    timestamp: performance.now(),
                    distance: distance
                });
            }
            return Math.min(3.0, threatLevel);
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error assessing threat level:`, error);
            return 0.5;
        }
    }
    _updateActiveThreats(target, threatLevel) {
        try {
            const entity = this._extractPlayCanvasEntity(target);
            if (!entity) return;
            const entityId = entity.getGuid ? entity.getGuid() : 'unknown';
            if (entityId === 'unknown') return;
            this.activeThreats.set(entityId, {
                entity: entity,
                level: threatLevel,
                lastUpdate: performance.now()
            });
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error updating active threats:`, error);
        }
    }
    _reduceActiveThread(entity, reductionFactor = 0.1) {
        try {
            const entityId = entity.getGuid ? entity.getGuid() : 'unknown';
            if (entityId === 'unknown') return;
            const threat = this.activeThreats.get(entityId);
            if (threat) {
                threat.level = Math.max(0, threat.level - reductionFactor);
                if (threat.level <= 0.1) {
                    this.activeThreats.delete(entityId);
                }
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error reducing threat:`, error);
        }
    }
    _removeActiveThread(entity) {
        try {
            const entityId = entity.getGuid ? entity.getGuid() : 'unknown';
            if (entityId !== 'unknown') {
                this.activeThreats.delete(entityId);
            }
        } catch (error) {}
    }
    _updateThreatLevels() {
        const now = performance.now();
        if (now - this.lastThreatUpdate < this.threatUpdateInterval) return;
        try {
            for (const [entityId, threat] of this.activeThreats.entries()){
                const age = now - threat.lastUpdate;
                const decayAmount = age / 1000 * this.threatDecayRate;
                threat.level = Math.max(0, threat.level - decayAmount);
                if (threat.level <= 0.1) {
                    this.activeThreats.delete(entityId);
                }
            }
            this.lastThreatUpdate = now;
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error updating threat levels:`, error);
        }
    }
    // ============================================================================
    // TARGET NAMING SYSTEM
    // ============================================================================
    getTargetEntityName(target) {
        if (!target) return 'None';
        if (target.entity && target.entity.name && target.entity.name !== 'Untitled' && target.entity.name.trim()) {
            return target.entity.name;
        }
        const entity = this._extractPlayCanvasEntity(target);
        if (!entity) {
            if (target.name && typeof target.name === 'string' && target.name !== 'Untitled' && target.name.trim()) {
                return target.name;
            }
            if (target.target && target.target.name && target.target.name !== 'Untitled') {
                return target.target.name;
            }
            if (target._entity && target._entity.name && target._entity.name !== 'Untitled') {
                return target._entity.name;
            }
            if (target.owner && target.owner.name && target.owner.name !== 'Untitled') {
                return target.owner.name;
            }
            if (target.id) {
                return `Entity_${String(target.id).substring(0, 8)}`;
            }
            if (target.uuid) {
                return `Entity_${String(target.uuid).substring(0, 8)}`;
            }
            if (target.guid) {
                return `Entity_${String(target.guid).substring(0, 8)}`;
            }
            return 'NoEntity';
        }
        if (entity.name && typeof entity.name === 'string' && entity.name !== 'Untitled' && entity.name.trim()) {
            return entity.name;
        }
        if (entity.tags) {
            if (entity.tags.has('player') || entity.tags.has('team_player')) return 'Player';
            if (entity.tags.has('ai_agent') || entity.tags.has('team_ai') || entity.tags.has('faction_ai')) return 'AIAgent';
            if (entity.tags.has('enemy')) return 'Enemy';
            if (entity.tags.has('character')) return 'Character';
        }
        if (entity.script) {
            if (entity.script.player || entity.script.playerController || entity.script.fpsPlayer) return 'Player';
            if (entity.script.aiAgent) return 'AIAgent';
            if (entity.script.enemy) return 'Enemy';
        }
        if (entity.isPlayer) return 'Player';
        if (entity.isAIAgent) return 'AIAgent';
        if (entity.isEnemy) return 'Enemy';
        if (entity.entityType) return entity.entityType;
        if (entity.render && entity.collision) {
            if (entity.script && Object.keys(entity.script._scripts || {}).length > 0) {
                return 'ScriptedEntity';
            }
            return 'RenderableEntity';
        }
        try {
            if (entity.getGuid && typeof entity.getGuid === 'function') {
                const guid = entity.getGuid();
                if (this.agent && this.agent.app && this.agent.app.root) {
                    const playerEntity = this.agent.app.root.findByName('Player');
                    if (playerEntity && playerEntity.getGuid() === guid) {
                        return 'Player';
                    }
                    if (entity.parent && entity.parent.name && entity.parent.name.includes('AI')) {
                        return `AIAgent_${guid.substring(0, 8)}`;
                    }
                }
                return `Entity_${guid.substring(0, 8)}`;
            }
        } catch (e) {}
        if (entity.enabled !== undefined) {
            return entity.enabled ? 'ActiveEntity' : 'DisabledEntity';
        }
        return 'Entity';
    }
    _getTargetEntityName(target) {
        return this.getTargetEntityName(target);
    }
    _getAttackerName(attacker) {
        return this.getTargetEntityName({
            entity: this._extractPlayCanvasEntity(attacker)
        });
    }
    _analyzeDeathCause(attacker) {
        if (!attacker) return 'unknown';
        const attackerName = this.getTargetEntityName({
            entity: this._extractPlayCanvasEntity(attacker)
        });
        return attackerName;
    }
    // ============================================================================
    // DATA TRACKING
    // ============================================================================
    _addToDamageHistory(damage, attackerName, previousHealth, currentHealth) {
        this.damageHistory.push({
            timestamp: performance.now(),
            damage: damage,
            attacker: attackerName,
            previousHealth: previousHealth,
            currentHealth: currentHealth,
            healthRatio: currentHealth / this.agent.maxHealth
        });
        if (this.damageHistory.length > this.maxDamageHistory) {
            this.damageHistory.shift();
        }
    }
    _addToSoundHistory(source, sourceName) {
        this.soundDetectionHistory.push({
            timestamp: performance.now(),
            source: source,
            sourceName: sourceName,
            position: source.position || (source.entity ? source.entity.getPosition() : null)
        });
        if (this.soundDetectionHistory.length > this.maxSoundHistory) {
            this.soundDetectionHistory.shift();
        }
    }
    _recordEventPattern(eventType, eventData) {
        try {
            const now = performance.now();
            if (!this.eventResponsePatterns.has(eventType)) {
                this.eventResponsePatterns.set(eventType, []);
            }
            const patterns = this.eventResponsePatterns.get(eventType);
            patterns.push({
                timestamp: now,
                data: eventData,
                context: {
                    health: this.agent.health / this.agent.maxHealth,
                    alertness: this.agent.alertness,
                    state: this.agent.stateMachine?.currentState?.type || 'unknown'
                }
            });
            if (patterns.length > 10) {
                patterns.shift();
            }
            this.eventFrequency.set(eventType, (this.eventFrequency.get(eventType) || 0) + 1);
        } catch (error) {}
    }
    _fireDamageEvent(damage, originalAttacker, attackerEntity, previousHealth, frameId) {
        const eventData = {
            entity: this.agent.entity,
            attacker: originalAttacker,
            attackerEntity: attackerEntity,
            damage: damage,
            previousHealth: previousHealth,
            currentHealth: this.agent.health,
            position: this.agent.entity.getPosition(),
            healthRatio: this.agent.health / this.agent.maxHealth,
            timestamp: performance.now(),
            frameId: frameId,
            targetId: this.agentGuid,
            targetName: this.agentName
        };
        this.agent.app.fire('ai:damaged', eventData);
    }
    _fireDeathEvent(originalAttacker, attackerEntity, deathCause, frameId) {
        const eventData = {
            entity: this.agent.entity,
            attacker: originalAttacker,
            attackerEntity: attackerEntity,
            deathCause: deathCause,
            position: this.agent.entity.getPosition(),
            timestamp: performance.now(),
            frameId: frameId,
            targetId: this.agentGuid,
            targetName: this.agentName
        };
        this.agent.app.fire('ai:death', eventData);
    }
    _scheduleEntityDestruction() {
        setTimeout(()=>{
            try {
                if (this.agent.entity && !this.agent.entity.destroyed) {
                    this.agent.entity.destroy();
                }
            } catch (error) {
                Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error during entity destruction:`, error);
            }
        }, 2000);
    }
    // ============================================================================
    // PUBLIC API
    // ============================================================================
    getThreatLevel(entityId) {
        return this.threatAssessments.get(entityId)?.level || 0;
    }
    getActiveThreats() {
        this._updateThreatLevels();
        return Array.from(this.activeThreats.values()).map((threat)=>({
                entity: threat.entity,
                level: threat.level,
                age: performance.now() - threat.lastUpdate
            }));
    }
    getEventPatterns() {
        const patterns = {};
        for (const [type, events] of this.eventResponsePatterns.entries()){
            if (events.length > 0) {
                patterns[type] = {
                    count: events.length,
                    frequency: this.eventFrequency.get(type) || 0,
                    recent: events.slice(-3)
                };
            }
        }
        return patterns;
    }
    clearThreatAssessments() {
        this.threatAssessments.clear();
        this.activeThreats.clear();
        this.eventResponsePatterns.clear();
        this.eventFrequency.clear();
    }
    debugEventState() {
        const status = {
            agentName: this.agentName,
            agentGuid: this.agentGuid.substring(0, 8),
            alertness: this.agent.alertness,
            health: `${this.agent.health}/${this.agent.maxHealth}`,
            activeThreats: this.activeThreats.size,
            damageHistory: this.damageHistory.length,
            soundHistory: this.soundDetectionHistory.length,
            eventPatterns: Object.keys(this.getEventPatterns()).length,
            deathProcessed: this.deathProcessed
        };
        Logger.debug(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Event state:`, status);
        return status;
    }
    destroy() {
        try {
            this.clearThreatAssessments();
            this.damageHistory = [];
            this.soundDetectionHistory = [];
            this.logThrottles.clear();
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error during event handler destruction:`, error);
        }
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        this.threatAssessments = new Map();
        this.lastDamageTime = 0;
        this.damageHistory = [];
        this.maxDamageHistory = aiConfig.events.MAX_DAMAGE_HISTORY;
        this.soundDetectionHistory = [];
        this.maxSoundHistory = aiConfig.events.MAX_SOUND_HISTORY;
        this.activeThreats = new Map();
        this.threatDecayRate = aiConfig.events.THREAT_DECAY_RATE;
        this.lastThreatUpdate = 0;
        this.threatUpdateInterval = aiConfig.events.THREAT_UPDATE_INTERVAL;
        this.eventResponsePatterns = new Map();
        this.eventFrequency = new Map();
        this.deathProcessed = false;
        this.lastHealthRatio = aiConfig.events.INITIAL_HEALTH_RATIO;
        this.healthChangeRate = 0;
        // Throttled logging system
        this.logThrottles = new Map();
        this.LOG_THROTTLE_MS = aiConfig.events.LOG_THROTTLE_MS;
        // Friendly fire prevention state
        this.lastFriendlyFireWarning = 0;
        this.FRIENDLY_FIRE_WARNING_THROTTLE = aiConfig.events.FRIENDLY_FIRE_WARNING_THROTTLE;
        Logger.debug(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Enhanced Event Handler initialized..`);
    }
}
// Export unified target naming helper for use by other modules
function getUnifiedTargetName(target, fallbackAgent = null) {
    if (fallbackAgent && fallbackAgent.eventHandler) {
        return fallbackAgent.eventHandler.getTargetEntityName(target);
    }
    if (!target) return 'None';
    let entity = null;
    if (target.getPosition && typeof target.getPosition === 'function') {
        entity = target;
    } else if (target.entity && typeof target.entity.getPosition === 'function') {
        entity = target.entity;
    }
    if (entity) {
        if (entity.name && entity.name !== 'Untitled' && entity.name.trim()) {
            return entity.name;
        }
        if (entity.tags) {
            if (entity.tags.has('player') || entity.tags.has('team_player')) return 'Player';
            if (entity.tags.has('ai_agent') || entity.tags.has('team_ai')) return 'AIAgent';
        }
        if (entity.script) {
            if (entity.script.player || entity.script.playerController) return 'Player';
            if (entity.script.aiAgent) return 'AIAgent';
        }
        try {
            if (entity.getGuid) {
                return `Entity_${entity.getGuid().substring(0, 8)}`;
            }
        } catch (e) {}
    }
    return 'Entity';
}

export { AIEventHandler, getUnifiedTargetName };
