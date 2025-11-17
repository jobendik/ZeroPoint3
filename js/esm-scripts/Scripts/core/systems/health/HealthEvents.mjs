///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: INTERNAL MODULE - Event handling, notifications, and health state changes
DOMAIN: Health System
DEPENDENCIES: ['pc', 'globalThis.Logger']
EXPORTS: ['HealthEvents']
GPT_CONTEXT: Manages all event-driven aspects of the health system including event listener setup/cleanup, entity registration for damage tracking, request handlers for health/damage operations, target validation, and event notifications. This module serves as the communication layer between the health system and external systems while being independent of core health logic and visual effects.
*/ class HealthEvents {
    // ============================================================================
    // ENTITY REGISTRATION
    // ============================================================================
    registerAsDamageable() {
        if (!this.app.damageableEntities) {
            this.app.damageableEntities = [];
        }
        // Track by GUID to prevent duplicates
        if (!this.app.damageableEntityGuids) {
            this.app.damageableEntityGuids = new Set();
        }
        const entityGuid = this.entityId;
        // Check GUID-based registry first
        if (this.app.damageableEntityGuids.has(entityGuid)) {
            this.Logger.health?.(`[HealthEvents] Entity ${entityGuid.substring(0, 8)} already registered (GUID check)`) || this.Logger.debug?.(`[HealthEvents] Entity ${entityGuid.substring(0, 8)} already registered (GUID check)`);
            return;
        }
        // Check reference-based registry (belt and suspenders)
        if (this.app.damageableEntities.includes(this.entity)) {
            this.Logger.health?.(`[HealthEvents] Entity ${entityGuid.substring(0, 8)} already registered (reference check)`) || this.Logger.debug?.(`[HealthEvents] Entity ${entityGuid.substring(0, 8)} already registered (reference check)`);
            this.app.damageableEntityGuids.add(entityGuid);
            return;
        }
        // Register in both registries
        this.app.damageableEntities.push(this.entity);
        this.app.damageableEntityGuids.add(entityGuid);
        this.Logger.health?.(`[HealthEvents] Registered ${this.entityName}#${entityGuid.substring(0, 8)} as damageable entity`) || this.Logger.debug?.(`[HealthEvents] Registered ${this.entityName}#${entityGuid.substring(0, 8)} as damageable entity`);
    }
    unregisterAsDamageable() {
        if (this.app.damageableEntities) {
            const index = this.app.damageableEntities.indexOf(this.entity);
            if (index !== -1) {
                this.app.damageableEntities.splice(index, 1);
            }
        }
        if (this.app.damageableEntityGuids && this.entityId) {
            this.app.damageableEntityGuids.delete(this.entityId);
        }
        this.Logger.health?.(`[HealthEvents] Unregistered ${this.entityName}#${this.entityId.substring(0, 8)} from damageable entities`) || this.Logger.debug?.(`[HealthEvents] Unregistered ${this.entityName}#${this.entityId.substring(0, 8)} from damageable entities`);
    }
    // ============================================================================
    // EVENT LISTENER MANAGEMENT
    // ============================================================================
    setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Listen to health/damage REQUEST events (we are the owner)
        this.app.on('health:request:apply', this._onHealthRequestApply, this);
        this.app.on('health:request:reset', this._onHealthRequestReset, this);
        this.app.on('damage:request:apply', this._onDamageRequestApply, this);
        this.Logger.health?.(`[HealthEvents] ${this.entityName} event listeners set up`) || this.Logger.debug?.(`[HealthEvents] ${this.entityName} event listeners set up`);
    }
    cleanupEventListeners() {
        if (!this._eventsBound) return;
        this.app.off('health:request:apply', this._onHealthRequestApply, this);
        this.app.off('health:request:reset', this._onHealthRequestReset, this);
        this.app.off('damage:request:apply', this._onDamageRequestApply, this);
        this._eventsBound = false;
        this.Logger.health?.(`[HealthEvents] ${this.entityName} event listeners cleaned up`) || this.Logger.debug?.(`[HealthEvents] ${this.entityName} event listeners cleaned up`);
    }
    // ============================================================================
    // REQUEST HANDLERS (Owner of health/damage domain)
    // ============================================================================
    _onHealthRequestApply(data) {
        if (!this._isTargetedAtThisEntity(data)) return;
        this.Logger.health?.(`[HealthEvents] ${this.entityName} received health:request:apply`) || this.Logger.debug?.(`[HealthEvents] ${this.entityName} received health:request:apply`);
        // Forward to health system callback if set
        if (this.onHealthRequest) {
            this.onHealthRequest('apply', data.amount || 0);
        }
    }
    _onHealthRequestReset(data) {
        if (!this._isTargetedAtThisEntity(data)) return;
        this.Logger.health?.(`[HealthEvents] ${this.entityName} received health:request:reset`) || this.Logger.debug?.(`[HealthEvents] ${this.entityName} received health:request:reset`);
        // Forward to health system callback if set
        if (this.onHealthRequest) {
            this.onHealthRequest('reset');
        }
    }
    _onDamageRequestApply(data) {
        // Try to enrich data from hit registry first
        if (data.hitId && this.app.hitRegistry) {
            const hitRecord = this.app.hitRegistry.hits.get(data.hitId);
            if (hitRecord) {
                // Enrich missing data from registry
                if (!data.target && hitRecord.target === this.entityId) {
                    data.target = this.entity;
                    this.Logger.health?.(`[HealthEvents] Enriched target from hit registry for ${data.hitId}`) || this.Logger.debug?.(`[HealthEvents] Enriched target from hit registry for ${data.hitId}`);
                }
                if (!data.attacker && hitRecord.attacker) {
                    const attackerEntity = this.app.root.findByGuid(hitRecord.attacker);
                    if (attackerEntity) {
                        data.attacker = attackerEntity;
                        this.Logger.health?.(`[HealthEvents] Enriched attacker from hit registry for ${data.hitId}`) || this.Logger.debug?.(`[HealthEvents] Enriched attacker from hit registry for ${data.hitId}`);
                    }
                }
            }
        }
        if (!this._isTargetedAtThisEntity(data)) {
            return;
        }
        // Validate we have minimum required data
        if (!data.damage || data.damage <= 0) {
            this.Logger.health?.(`[${this.entityName}] REJECTED damage:request:apply - invalid damage: ${data.damage}`) || this.Logger.debug?.(`[${this.entityName}] REJECTED damage:request:apply - invalid damage: ${data.damage}`);
            return;
        }
        this.Logger.health?.(`[${this.entityName}] received damage:request:apply with hitId=${data.hitId || 'MISSING'} damage=${data.damage}`) || this.Logger.debug?.(`[${this.entityName}] received damage:request:apply with hitId=${data.hitId || 'MISSING'} damage=${data.damage}`);
        // Enhanced friendly fire blocking at event level
        let attackerGuid = null;
        try {
            if (data.attacker && typeof data.attacker.getGuid === 'function') attackerGuid = data.attacker.getGuid();
            else if (data.attackerId) attackerGuid = data.attackerId;
            else if (data.attackerGuid) attackerGuid = data.attackerGuid;
            else if (data.hitId && this.app.hitRegistry) {
                const hr = this.app.hitRegistry.hits.get(data.hitId);
                if (hr && hr.attacker) attackerGuid = hr.attacker;
            }
        } catch (e) {
            attackerGuid = null;
        }
        // Self-damage check
        if (attackerGuid && attackerGuid === this.entityId) {
            this.Logger.health?.(`[HealthEvents] Ignoring self-damage request for ${this.entityName} from attacker=${attackerGuid.substring(0, 8)} hitId=${data.hitId || 'NONE'}`) || this.Logger.debug?.(`[HealthEvents] Ignoring self-damage request for ${this.entityName} from attacker=${attackerGuid.substring(0, 8)} hitId=${data.hitId || 'NONE'}`);
            return;
        }
        // Final friendly fire check at damage application level
        if (data.attacker && this._isFriendlyFire(data.attacker, this.entity)) {
            const attackerName = data.attacker.name || `Entity_${data.attacker.getGuid().substring(0, 8)}`;
            this.Logger.health?.(`[HealthEvents] Ignoring friendly fire from ${attackerName} to ${this.entityName} hitId=${data.hitId || 'NONE'}`) || this.Logger.debug?.(`[HealthEvents] Ignoring friendly fire from ${attackerName} to ${this.entityName} hitId=${data.hitId || 'NONE'}`);
            return;
        }
        // 🔥 DAMAGE VIGNETTE FIX: Trigger vignette
        if ((this.entity.name === 'Player' || this.entityName === 'Player') && this.entity.script && this.entity.script.player) {
            try {
                this.entity.script.player.takeDamage(data.damage || 0, data.attacker);
            } catch (error) {
                console.error(`[HealthEvents] ❌ IMMEDIATE vignette trigger FAILED:`, error);
            }
        }
        // Forward to health system callback if set
        if (this.onDamageRequest) {
            // 🔥 DEFINITIVE VIGNETTE FIX: Capture health before/after to guarantee UI events
            const prevHealth = this.entity.script?.healthSystem?.healthCore?.currentHealth || 100;
            const isPlayerEntity = this.entity.name === 'Player' || this.entityName === 'Player';
            // 🎯 Pass isShotgunPellet flag to bypass per-attacker invincibility
            if (data.isShotgunPellet) {
                console.log(`🎯 [HealthEvents] Forwarding shotgun pellet flag for ${this.entityName}, damage=${data.damage}`);
            }
            // 💀 HEADSHOT SYSTEM: Pass isHeadshot flag through to damage processing
            this.onDamageRequest(data.damage || 0, data.attacker, data.hitId, data.frameId, data.isShotgunPellet, data.isHeadshot);
            const newHealth = this.entity.script?.healthSystem?.healthCore?.currentHealth || 100;
            const appliedDamage = Math.max(0, prevHealth - newHealth);
            // Always fire UI events if damage was actually applied, regardless of what healthCore returned
            if (appliedDamage > 0) {
                const payload = {
                    victimGuid: this.entityId,
                    victimName: this.entityName,
                    isPlayer: isPlayerEntity,
                    attackerName: data.attacker?.name || 'Unknown',
                    amount: appliedDamage,
                    prevHealth: prevHealth,
                    newHealth: newHealth,
                    killed: newHealth <= 0,
                    time: performance.now() / 1000
                };
                // Fire generic damage event
                this.entity.fire('damage:applied', payload);
                // Fire player-specific damage event for vignette
                if (isPlayerEntity) {
                    this.entity.fire('ui:player:damaged', payload);
                    // Also fire at app level for global listeners
                    if (this.app) {
                        this.app.fire('ui:player:damaged', payload);
                    }
                }
            }
        } else {
            console.error(`[HealthEvents] ❌ NO onDamageRequest callback set!`);
        }
    }
    // ============================================================================
    // TARGET VALIDATION
    // ============================================================================
    _isTargetedAtThisEntity(data) {
        if (!data) {
            return false;
        }
        // If no target specified AT ALL, reject (no broadcast behavior)
        if (!data.target && !data.entity && !data.entityId && !data.entityName) {
            return false;
        }
        // Priority 1: Direct entity reference (most reliable)
        if (data.target === this.entity) {
            return true;
        }
        if (data.entity === this.entity) {
            return true;
        }
        // Priority 2: GUID matching (very reliable)
        if (data.entityId === this.entityId) {
            return true;
        }
        if (data.target && data.target.getGuid && data.target.getGuid() === this.entityId) {
            return true;
        }
        // Not the target - this is expected behavior
        return false;
    }
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
        // Script-based identification (fallback)
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
    // EVENT NOTIFICATIONS
    // ============================================================================
    fireEntityDamaged(damageInfo) {
        console.log(`[HealthEvents] 🔥 fireEntityDamaged() CALLED for ${this.entityName}`, {
            isBeingDestroyed: this.isBeingDestroyed,
            hasDamageInfo: !!damageInfo,
            damage: damageInfo?.actualDamage,
            attacker: damageInfo?.attacker?.name
        });
        if (this.isBeingDestroyed || !damageInfo) {
            console.log(`[HealthEvents] ❌ fireEntityDamaged ABORTED - isBeingDestroyed=${this.isBeingDestroyed}, hasDamageInfo=${!!damageInfo}`);
            return;
        }
        try {
            console.log(`[HealthEvents] 🚀 FIRING entity:damaged event for ${this.entityName}, damage=${damageInfo.actualDamage}`);
            this.app.fire('entity:damaged', {
                entity: this.entity,
                attacker: damageInfo.attacker,
                damage: damageInfo.actualDamage,
                position: this.entity.getPosition(),
                targetId: this.entityId,
                targetName: this.entityName,
                hitId: damageInfo.hitId
            });
            console.log(`[HealthEvents] ✅ entity:damaged event FIRED successfully for ${this.entityName}`);
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error firing entity:damaged event: ${error}`);
        }
    }
    fireEntityDied(deathInfo) {
        if (this.isBeingDestroyed || !deathInfo) return;
        try {
            this.app.fire('entity:died', {
                entity: this.entity,
                attacker: deathInfo.attacker,
                position: deathInfo.position,
                targetId: this.entityId,
                targetName: this.entityName,
                isHeadshot: deathInfo.isHeadshot || false // 💀 HEADSHOT SYSTEM: Pass headshot flag to kill feed
            });
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error firing entity:died event: ${error}`);
        }
    }
    firePlayerHealthChanged(currentHealth, maxHealth) {
        if (this.isBeingDestroyed || !this.isPlayer) return;
        try {
            this.app.fire('player:healthChanged', {
                entity: this.entity,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                healthPercent: currentHealth / maxHealth
            });
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error firing player:healthChanged event: ${error}`);
        }
    }
    fireDebugDamage(damageInfo) {
        if (this.isBeingDestroyed || !damageInfo) return;
        try {
            this.app.fire('debug:damage', {
                entity: this.entityName,
                entityId: this.entityId,
                damage: damageInfo.actualDamage,
                newHealth: damageInfo.newHealth,
                attacker: damageInfo.attackerName,
                attackerId: damageInfo.attackerId,
                hitId: damageInfo.hitId
            });
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error firing debug:damage event: ${error}`);
        }
    }
    // ============================================================================
    // SYSTEM NOTIFICATIONS
    // ============================================================================
    notifySystemsOfDamage(damageInfo) {
        if (this.isBeingDestroyed || !damageInfo) return;
        try {
            // ✅ FIX: Reduced logging - only log actual damage, not spam controller references
            if (this.isPlayer) {
                this.Logger.debug?.(`[HealthEvents] 🩸 Player damaged by ${damageInfo.attackerName} for ${damageInfo.actualDamage} damage`) || this.Logger.info(`[HealthEvents] 🩸 Player damaged by ${damageInfo.attackerName} for ${damageInfo.actualDamage} damage`);
                // Try playerController first (if properly linked)
                if (this.playerController && this.playerController.takeDamage) {
                    this.playerController.takeDamage(damageInfo.actualDamage, damageInfo.attacker);
                } else if (this.entity.script && this.entity.script.player && this.entity.script.player.takeDamage) {
                    this.entity.script.player.takeDamage(damageInfo.actualDamage, damageInfo.attacker);
                } else {
                    // Only log error once per initialization, not on every damage
                    if (!this._loggedControllerError) {
                        this.Logger.error(`[HealthEvents] ❌ FAILED to notify player of damage - no valid player controller found!`);
                        this._loggedControllerError = true;
                    }
                }
            }
            // Notify AI agent
            if (this.isAI && this.aiAgent && this.aiAgent.takeDamage) {
                this.Logger.health?.(`[HealthEvents] Notifying AI agent of damage from ${damageInfo.attackerName}`) || this.Logger.debug?.(`[HealthEvents] Notifying AI agent of damage from ${damageInfo.attackerName}`);
                this.aiAgent.takeDamage(damageInfo.actualDamage, damageInfo.attacker);
            }
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error notifying systems of damage: ${error}`);
        }
    }
    notifySystemsOfDeath(deathInfo) {
        if (this.isBeingDestroyed || !deathInfo) return;
        try {
            // Notify AI agent
            if (this.isAI && this.aiAgent && this.aiAgent.onDeath) {
                this.aiAgent.onDeath(deathInfo.attacker);
            }
            // Notify player controller
            if (this.isPlayer && this.playerController && this.playerController.onDeath) {
                this.playerController.onDeath(deathInfo.attacker);
            }
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error notifying systems of death: ${error}`);
        }
    }
    // ============================================================================
    // LIFECYCLE MANAGEMENT
    // ============================================================================
    onEntityDestroy() {
        this.isBeingDestroyed = true;
        this.cleanupEventListeners();
        this.unregisterAsDamageable();
    }
    linkToSystems(weaponSystem, aiAgent, playerController) {
        this.weaponSystem = weaponSystem;
        this.aiAgent = aiAgent;
        this.playerController = playerController;
    }
    fireReadyEvent() {
        try {
            this.entity.fire('healthSystem:ready', this);
        } catch (error) {
            this.Logger.error(`[HealthEvents] Error firing ready event: ${error}`);
        }
    }
    // ============================================================================
    // CALLBACK SETTERS (For facade to connect)
    // ============================================================================
    setCallbacks(callbacks) {
        this.onDamageRequest = callbacks.onDamageRequest;
        this.onHealthRequest = callbacks.onHealthRequest;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        this.isBeingDestroyed = true;
        this.cleanupEventListeners();
        this.unregisterAsDamageable();
        // Clear callbacks
        this.onDamageRequest = null;
        this.onHealthRequest = null;
        this.Logger.health?.(`[HealthEvents] ${this.entityName} events destroyed`) || this.Logger.debug?.(`[HealthEvents] ${this.entityName} events destroyed`);
    }
    constructor(entity, app, config = {}){
        this.entity = entity;
        this.app = app; // Explicitly passed app reference
        this.Logger = globalThis.Logger || console;
        // Entity identification
        this.entityId = entity.getGuid();
        this.entityName = entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        // Event state
        this._eventsBound = false;
        this.isBeingDestroyed = false;
        // Entity type detection for notifications
        this.isAI = !!(entity.script && entity.script.aiAgent);
        this.isPlayer = !!(entity.script && (entity.script.player || entity.script.playerController || entity.script.fpsPlayer));
        // System references (will be set by facade)
        this.weaponSystem = null;
        this.aiAgent = null;
        this.playerController = null;
    }
}

export { HealthEvents };
