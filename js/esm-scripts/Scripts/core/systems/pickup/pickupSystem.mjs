import { Script, Vec3 } from '../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';
import { Logger } from '../../engine/logger.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
class PickupSystem extends Script {
    // ============================================================================
    // LIFECYCLE
    // ============================================================================
    initialize() {
        // Import Logger - compatible with both ESM and global access
        this.Logger = globalThis.Logger || console;
        // IDEMPOTENT: Per-entity guard
        if (this.__pickupSystemBooted) {
            return;
        }
        const entityName = this.entity.name || 'UnnamedPickup';
        this.Logger.debug(`[PickupSystem] Pickup '${entityName}' (${this.itemType}) initializing...`);
        // Core state
        this.isAvailable = true;
        this.lastPickupAttempt = 0;
        this.respawnTimeoutId = null;
        // REGISTRATION STATE (robust, idempotent)
        this._gmRegState = 'idle'; // 'idle' | 'registered' | 'failed'
        this._gmRegAttempts = 0;
        this._gmRegTimer = null;
        // RESERVATION SYSTEM
        this.reservedBy = null;
        this.reservationExpiry = 0;
        this.reservationDuration = aiConfig.pickupReservation.RESERVATION_DURATION_MS;
        // Animation state
        this._originPos = this.entity.getPosition().clone();
        this._bobT = Math.random() * Math.PI * 2;
        this._rotY = 0;
        // Visual + collision
        this._setupVisuals();
        this._setupCollision();
        this._setupEventListeners();
        // Register with GameManager (safe + idempotent)
        this._tryRegisterWithGameManager();
        // Mark THIS ENTITY's pickup as ready
        this.__pickupSystemBooted = true;
        this.Logger.debug(`[PickupSystem] Pickup '${entityName}' ready`);
    }
    update(dt) {
        if (!this.isAvailable) return;
        // Reservation upkeep
        this._updateReservation();
        // Anim / glow
        this._updateAnimation(dt);
        this._updateGlow();
        // 🔧 FIX: Proximity-based pickup detection for AI agents
        // This fallback catches cases where collision triggers don't fire properly
        this._checkProximityPickup();
    }
    onDestroy() {
        this._cleanup();
    }
    destroy() {
        this._cleanup();
    }
    _cleanup() {
        // Unregister from GameManager if we successfully registered
        try {
            if (this._gmRegState === 'registered' && this.app && this.app.gameManager) {
                if (typeof this.app.gameManager.unregisterItem === 'function') {
                    this.app.gameManager.unregisterItem(this);
                    if (this.debugMode) this._debugLog('Unregistered from GameManager on destroy');
                }
            }
        } catch (e) {
            this.Logger.warn(`[PickupSystem] Unregister error: ${e.message}`);
        }
        this._cleanupEventListeners();
        this._clearAllTimers();
        if (this.entity.collision) {
            this.entity.collision.off('triggerenter', this.onTriggerEnter, this);
        }
    }
    _clearAllTimers() {
        if (this.respawnTimeoutId) {
            clearTimeout(this.respawnTimeoutId);
            this.respawnTimeoutId = null;
        }
        if (this._glowSetupTimer) {
            clearTimeout(this._glowSetupTimer);
            this._glowSetupTimer = null;
        }
        if (this._animationTimer) {
            clearTimeout(this._animationTimer);
            this._animationTimer = null;
        }
        if (this._gmRegTimer) {
            clearTimeout(this._gmRegTimer);
            this._gmRegTimer = null;
        }
        this.Logger.pickup?.(`[PickupSystem] ${this.entity.name} timers cleared on destroy`) || this.Logger.debug?.(`[PickupSystem] ${this.entity.name} timers cleared on destroy`);
    }
    // ============================================================================
    // GAME MANAGER REGISTRATION (Enhanced with better error handling)
    // ============================================================================
    _tryRegisterWithGameManager() {
        // If we've already settled, stop.
        if (this._gmRegState === 'registered' || this._gmRegState === 'failed') {
            return;
        }
        // Hard guard to prevent parallel retries
        if (this._gmRegTimer) {
            clearTimeout(this._gmRegTimer);
            this._gmRegTimer = null;
        }
        const gm = this.app && this.app.gameManager;
        const entityName = this.entity.name || 'UnnamedPickup';
        // Helper: detect if this instance/entity is already known by GM
        const isAlreadyKnown = ()=>{
            if (!gm) return false;
            // Check multiple possible locations for items array
            const itemsArray = gm.items || gm.pickups || gm._registeredItems;
            if (!Array.isArray(itemsArray)) return false;
            // Same instance?
            if (itemsArray.includes(this)) return true;
            // Same entity?
            return itemsArray.some((i)=>i && i.entity === this.entity);
        };
        // If GM is not ready yet, listen once and retry when ready
        if (!gm || gm.__gmBooted !== true) {
            if (this.debugMode) {
                this.Logger.debug(`[PickupSystem] ${entityName} - GameManager not ready, waiting...`);
            }
            // Listen for GM ready event
            this.app.once('game:manager:ready', ()=>{
                if (this._gmRegState === 'registered' || this._gmRegState === 'failed') return;
                if (this.debugMode) {
                    this.Logger.debug(`[PickupSystem] ${entityName} - GameManager ready event fired, retrying...`);
                }
                this._tryRegisterWithGameManager();
            });
            // Also set a delayed retry as fallback
            this._gmRegTimer = setTimeout(()=>{
                this._gmRegTimer = null;
                this._tryRegisterWithGameManager();
            }, 200);
            return;
        }
        // From here, GM is ready.
        if (this.debugMode) {
            this.Logger.debug(`[PickupSystem] ${entityName} - GameManager is ready, attempting registration...`);
        }
        // Check if already known
        if (isAlreadyKnown()) {
            this._gmRegState = 'registered';
            if (this.debugMode) {
                this.Logger.debug(`[PickupSystem] ${entityName} - Already registered, marking as complete`);
            }
            return;
        }
        // Attempt registration
        let registrationSuccessful = false;
        let registrationError = null;
        try {
            // Try the standard registerItem method
            if (typeof gm.registerItem === 'function') {
                const result = gm.registerItem(this);
                if (this.debugMode) {
                    this.Logger.debug(`[PickupSystem] ${entityName} - registerItem returned: ${result}`);
                }
                // Consider registration successful if:
                // 1. Returns true explicitly
                // 2. Returns undefined (void function that succeeded)
                // 3. Doesn't throw an error
                registrationSuccessful = result === true || result === undefined;
            } else if (typeof gm.addItem === 'function') {
                const result = gm.addItem(this);
                registrationSuccessful = result !== false;
            } else if (typeof gm.addPickup === 'function') {
                const result = gm.addPickup(this);
                registrationSuccessful = result !== false;
            } else if (Array.isArray(gm.items)) {
                // Fallback: directly add to items array if no method exists
                if (!gm.items.includes(this)) {
                    gm.items.push(this);
                    registrationSuccessful = true;
                    if (this.debugMode) {
                        this.Logger.debug(`[PickupSystem] ${entityName} - No registerItem method, added directly to items array`);
                    }
                } else {
                    registrationSuccessful = true;
                }
            } else {
                this.Logger.warn(`[PickupSystem] ${entityName} - GameManager has no registration method or items array`);
            }
        } catch (e) {
            registrationError = e;
            this.Logger.warn(`[PickupSystem] ${entityName} - Registration threw error: ${e.message}`);
            registrationSuccessful = false;
        }
        // Verify registration by checking if we're now in the items array
        if (registrationSuccessful || !registrationError) {
            // Double-check that we're actually registered
            if (isAlreadyKnown()) {
                this._gmRegState = 'registered';
                if (this.debugMode) {
                    this.Logger.debug(`[PickupSystem] ${entityName} - Registration verified successful`);
                }
                this.app.fire('pickup:registered', {
                    item: this,
                    entityName: entityName
                });
                return;
            }
        }
        // If we got here, registration didn't work. Retry with backoff.
        this._gmRegAttempts++;
        if (this._gmRegAttempts >= 3) {
            this._gmRegState = 'failed';
            this.Logger.warn(`[PickupSystem] ${entityName} - Failed to register after ${this._gmRegAttempts} attempts`);
            // Even if registration failed, the pickup can still work locally
            // Just won't be in the global items list
            return;
        }
        const delayMs = 300 * this._gmRegAttempts; // 300, 600, 900ms
        if (this.debugMode) {
            this.Logger.debug(`[PickupSystem] ${entityName} - Retry attempt ${this._gmRegAttempts} in ${delayMs}ms...`);
        }
        this._gmRegTimer = setTimeout(()=>{
            this._gmRegTimer = null;
            this._tryRegisterWithGameManager();
        }, delayMs);
    }
    // ============================================================================
    // SETUP METHODS
    // ============================================================================
    _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Owner of request domain
        this.app.on('pickup:request:attempt', this._onPickupRequestAttempt, this);
        this.app.on('pickup:request:reserve', this._onPickupRequestReserve, this);
        this.app.on('pickup:request:release', this._onPickupRequestRelease, this);
        this._log('Event listeners set up');
    }
    _cleanupEventListeners() {
        if (!this._eventsBound) return;
        this.app.off('pickup:request:attempt', this._onPickupRequestAttempt, this);
        this.app.off('pickup:request:reserve', this._onPickupRequestReserve, this);
        this.app.off('pickup:request:release', this._onPickupRequestRelease, this);
        this._eventsBound = false;
        this._log('Event listeners cleaned up');
    }
    _setupCollision() {
        if (!this.entity.collision) {
            this.entity.addComponent('collision', {
                type: 'box',
                halfExtents: [
                    PickupSystem.DEFAULT_PICKUP_RANGE,
                    PickupSystem.DEFAULT_PICKUP_RANGE,
                    PickupSystem.DEFAULT_PICKUP_RANGE
                ]
            });
            this._log('Added collision component');
        }
        // Trigger volume
        if ('isTrigger' in this.entity.collision) {
            this.entity.collision.isTrigger = true;
        } else {
            this.entity.collision.isTrigger = true;
            this.entity.collision.trigger = true;
        }
        // Keep pickup non-physical
        if (this.entity.rigidbody) {
            this.entity.removeComponent('rigidbody');
        }
        // Avoid double-binding
        this.entity.collision.off('triggerenter', this.onTriggerEnter, this);
        this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
        // 🔧 DIAGNOSTIC: Add trigger leave logging
        this.entity.collision.off('triggerleave', this._onTriggerLeave, this);
        this.entity.collision.on('triggerleave', this._onTriggerLeave, this);
        // 🔧 DIAGNOSTIC: Log collision setup details
        Logger.info(`[PickupSystem] ${this.entity.name} collision setup complete:`, {
            type: this.entity.collision.type,
            isTrigger: this.entity.collision.isTrigger,
            trigger: this.entity.collision.trigger,
            enabled: this.entity.collision.enabled,
            halfExtents: this.entity.collision.halfExtents?.toString()
        });
    }
    // 🔧 DIAGNOSTIC: Track trigger events
    _onTriggerLeave(other) {
        const entityName = other.name || 'Unknown';
        Logger.info(`[PickupSystem] ${this.entity.name} 🚪 TRIGGER LEAVE: ${entityName}`, {
            isAI: other.tags.has('ai') || other.tags.has('team_ai'),
            isPlayer: other.tags.has('player'),
            hasRigidbody: !!other.rigidbody,
            rigidbodyType: other.rigidbody?.type
        });
    }
    _setupVisuals() {
        this._materials = [];
        this._setupGlowMaterials();
    }
    // ============================================================================
    // RESERVATION SYSTEM
    // ============================================================================
    reserveFor(agentId, duration) {
        if (this.reservedBy && this.reservationExpiry > performance.now()) {
            this._log(`Reserve request denied - already reserved by ${this.reservedBy}`);
            return false;
        }
        this.reservedBy = agentId;
        this.reservationExpiry = performance.now() + (duration || this.reservationDuration);
        this._log(`Reserved by agent ${agentId} for ${(duration || this.reservationDuration) / 1000}s`);
        this.app.fire('pickup:completed:reserved', {
            item: this,
            agentId: agentId,
            duration: duration || this.reservationDuration
        });
        return true;
    }
    releaseReservation(agentId) {
        if (this.reservedBy === agentId) {
            const wasReserved = this.reservedBy;
            this.reservedBy = null;
            this.reservationExpiry = 0;
            this._log(`Reservation released by agent ${agentId}`);
            this.app.fire('pickup:completed:released', {
                item: this,
                agentId: agentId,
                wasReservedBy: wasReserved
            });
            return true;
        }
        return false;
    }
    _updateReservation() {
        if (this.reservedBy && this.reservationExpiry > 0) {
            if (performance.now() > this.reservationExpiry) {
                this._log(`Reservation expired for agent ${this.reservedBy}`);
                this.reservedBy = null;
                this.reservationExpiry = 0;
            }
        }
    }
    isReservedBy(agentId) {
        return this.reservedBy === agentId && this.reservationExpiry > performance.now();
    }
    isReserved() {
        return this.reservedBy && this.reservationExpiry > performance.now();
    }
    // ============================================================================
    // ANIMATION AND VISUALS
    // ============================================================================
    _updateAnimation(dt) {
        // Rotation
        if (this.autoRotate) {
            this._rotY = (this._rotY + this.rotationSpeed * dt) % 360;
            this.entity.setEulerAngles(0, this._rotY, 0);
        }
        // Bobbing
        this._bobT += dt * this.bobSpeed;
        const pos = this._originPos.clone();
        pos.y += Math.sin(this._bobT) * this.bobHeight;
        this.entity.setPosition(pos);
    }
    _updateGlow() {
        if (!this._materials.length) return;
        const t = performance.now() * 0.001;
        let pulse = (Math.sin(t * 3) + 1) * 0.5 * 0.3; // 0..0.3
        // Dim glow if reserved by someone else
        if (this.isReserved()) {
            pulse *= 0.3;
        }
        this._materials.forEach((material)=>{
            if (material) {
                material.emissive.set(this.glowColor[0] * pulse, this.glowColor[1] * pulse, this.glowColor[2] * pulse);
                material.update();
            }
        });
    }
    _setupGlowMaterials() {
        // Wait for render component
        if (!this.entity.render || !this.entity.render.meshInstances) {
            if (this._glowSetupTimer) {
                clearTimeout(this._glowSetupTimer);
            }
            this._glowSetupTimer = setTimeout(()=>{
                if (this.__pickupSystemBooted && !this._destroyed) {
                    this._glowSetupTimer = null;
                    this._setupGlowMaterials();
                }
            }, 16);
            return;
        }
        const meshInstances = this.entity.render.meshInstances;
        this._materials = [];
        meshInstances.forEach((meshInst, idx)=>{
            if (meshInst && meshInst.material) {
                const clone = meshInst.material.clone();
                clone.emissive.set(this.glowColor[0] * 0.2, this.glowColor[1] * 0.2, this.glowColor[2] * 0.2);
                clone.update();
                meshInst.material = clone;
                this._materials[idx] = clone;
            }
        });
    }
    // ============================================================================
    // PICKUP LOGIC
    // ============================================================================
    onTriggerEnter(other) {
        // 🔧 DIAGNOSTIC: Log ALL trigger events
        const entityName = other.name || 'Unknown';
        const distance = this.entity.getPosition().distance(other.getPosition());
        Logger.info(`[PickupSystem] ${this.entity.name} 🎯 TRIGGER ENTER: ${entityName} at ${distance.toFixed(2)}m`, {
            isAvailable: this.isAvailable,
            isAI: other.tags.has('ai') || other.tags.has('team_ai'),
            isPlayer: other.tags.has('player'),
            hasRigidbody: !!other.rigidbody,
            rigidbodyType: other.rigidbody?.type,
            hasHealthSystem: !!(other.script && other.script.healthSystem),
            hasWeaponSystem: !!(other.script && other.script.weaponSystem)
        });
        if (!this.isAvailable) return false;
        const now = performance.now() / 1000;
        if (now - this.lastPickupAttempt < PickupSystem.PICKUP_COOLDOWN) return false;
        this.lastPickupAttempt = now;
        const agentId = this._getAgentId(other);
        if (this.isReserved() && !this.isReservedBy(agentId)) {
            this._debugLog(`${other.name} cannot pick up - reserved by ${this.reservedBy}`);
            return false;
        }
        // CRITICAL: Check weapon system readiness for weapon/ammo pickups
        if (this.itemType === 'pistol' || this.itemType === 'machinegun' || this.itemType === 'shotgun' || this.itemType.includes('ammo')) {
            if (!this._isWeaponSystemReady(other)) {
                this.Logger.warn(`[PickupSystem] ${this.entity.name} cannot be picked up - weapon system not ready on ${other.name}`);
                return false;
            }
        }
        const systems = this._getEntitySystems(other);
        if (!systems.healthSystem && !systems.weaponSystem) {
            this._debugLog(`${other.name} has no compatible systems`);
            return false;
        }
        this._debugLog(`${other.name} attempting pickup of ${this.itemType}`);
        const ok = !!this._attemptPickup(other, systems);
        if (ok) {
            this._onPickedUp(other);
            // Auto-switch to newly picked up weapon
            if (this.itemType === 'pistol' || this.itemType === 'machinegun' || this.itemType === 'shotgun') {
                const weaponSystem = systems.weaponSystem;
                if (weaponSystem && typeof weaponSystem.switchWeapon === 'function') {
                    setTimeout(()=>{
                        const success = weaponSystem.switchWeapon(this.itemType);
                        if (success) {
                            this.Logger?.goal?.(`[${other.name}] AUTO-SWITCHED to picked up weapon: ${this.itemType}`);
                            // NEW: tell visuals/UI to play the draw-from-below animation
                            this.app.fire('weapon:equipped', {
                                weaponType: this.itemType,
                                autoEquip: true,
                                by: 'pickup',
                                entity: other,
                                pickup: this.entity
                            });
                        } else {
                            this.Logger?.warn?.(`[${other.name}] Failed to auto-switch to ${this.itemType}`);
                        }
                    }, 100); // keep slightly behind pickup’s internal processing
                }
            }
            return true;
        }
        return false;
    }
    // ENHANCED: Manual pickup method for AI agents
    _manualPickupAttempt(entity) {
        if (!this.isAvailable) {
            this._debugLog(`Manual pickup failed - item not available`);
            return false;
        }
        // 🔧 FIX: More detailed logging for diagnosis
        const entityName = entity.name || 'Unknown';
        this.Logger.goal?.(`[PickupSystem] ${this.entity.name} manual pickup attempt by ${entityName}`);
        const systems = this._getEntitySystems(entity);
        if (!systems.healthSystem && !systems.weaponSystem) {
            this.Logger.warn(`[PickupSystem] ${this.entity.name} manual pickup failed - entity ${entityName} has no compatible systems`);
            return false;
        }
        // 🔧 FIX: Check weapon system readiness for weapon/ammo items
        if ((this.itemType === 'pistol' || this.itemType === 'machinegun' || this.itemType === 'shotgun' || this.itemType.includes('ammo')) && !this._isWeaponSystemReady(entity)) {
            this.Logger.warn(`[PickupSystem] ${this.entity.name} manual pickup failed - weapon system not ready on ${entityName}`);
            return false;
        }
        const ok = !!this._attemptPickup(entity, systems);
        if (ok) {
            this._onPickedUp(entity);
            this.Logger.goal?.(`[PickupSystem] ${this.entity.name} ✅ manual pickup successful for ${entityName}`);
        } else {
            this.Logger.warn(`[PickupSystem] ${this.entity.name} ⚠️ manual pickup failed for ${entityName} - _attemptPickup returned false`);
        }
        return ok;
    }
    _attemptPickup(entity, systems) {
        const { healthSystem, weaponSystem } = systems;
        switch(this.itemType){
            case 'health':
                return this._tryPickupHealth(entity, healthSystem);
            case 'pistol':
            case 'machinegun':
            case 'shotgun':
                return this._tryPickupWeapon(entity, weaponSystem);
            case 'pistol_ammo':
            case 'machinegun_ammo':
            case 'shotgun_ammo':
            case 'universal_ammo':
                return this._tryPickupAmmo(entity, weaponSystem);
            default:
                this.Logger.warn(`[PickupSystem] Unknown item type: ${this.itemType}`);
                return false;
        }
    }
    _tryPickupHealth(entity, healthSystem) {
        if (!healthSystem) {
            this._debugLog('No health system found');
            return false;
        }
        if (typeof healthSystem.heal !== 'function') {
            this._debugLog('Health system has no heal method');
            return false;
        }
        const healAmount = this.value;
        const actualHealed = healthSystem.heal(healAmount);
        if (actualHealed > 0) {
            // 🔥 ENHANCED LOGGING: Make medkit pickups crystal clear
            const entityType = entity.tags.has('team_ai') ? 'AI' : entity.tags.has('player') ? 'PLAYER' : 'UNKNOWN';
            const medkitPos = this.entity.getPosition();
            const entityPos = entity.getPosition();
            const distance = medkitPos.distance(entityPos);
            Logger.pickup(`💊 MEDKIT PICKUP: ${entityType} "${entity.name}" healed ${actualHealed.toFixed(1)} HP from ${distance.toFixed(2)}m away`);
            Logger.pickup(`   Position: Medkit(${medkitPos.x.toFixed(1)}, ${medkitPos.y.toFixed(1)}, ${medkitPos.z.toFixed(1)}) -> Entity(${entityPos.x.toFixed(1)}, ${entityPos.y.toFixed(1)}, ${entityPos.z.toFixed(1)})`);
            Logger.pickup(`   New Health: ${healthSystem.currentHealth.toFixed(1)}/${healthSystem.maxHealth}`);
            this._debugLog(`Healed ${entity.name} for ${actualHealed} HP`);
            // Fire event for UI/effects
            if (this.app.fire) {
                this.app.fire('pickup:health:success', {
                    entity: entity,
                    amount: actualHealed,
                    position: medkitPos.clone(),
                    distance: distance,
                    entityType: entityType
                });
            }
            return true;
        } else {
            this._debugLog(`${entity.name} health already full`);
            return false;
        }
    }
    _tryPickupWeapon(entity, weaponSystem) {
        if (!weaponSystem) {
            this._debugLog('No weapon system found');
            return false;
        }
        if (typeof weaponSystem.unlockWeapon !== 'function') {
            this._debugLog('Weapon system has no unlockWeapon method');
            return false;
        }
        // 🔧 FIX: Better logging for weapon pickup attempts
        const entityName = entity.name || 'Unknown';
        this.Logger.goal?.(`[PickupSystem] ${this.entity.name} attempting to unlock ${this.itemType} for ${entityName}`);
        const success = weaponSystem.unlockWeapon(this.itemType);
        if (success) {
            this.Logger.goal?.(`[PickupSystem] ${this.entity.name} ✅ Unlocked weapon ${this.itemType} for ${entityName}`);
            return true;
        } else {
            // Check if already unlocked
            const weapons = weaponSystem.weapons || {};
            const weaponData = weapons[this.itemType];
            const alreadyUnlocked = weaponData && weaponData.unlocked !== false;
            if (alreadyUnlocked) {
                this.Logger.goal?.(`[PickupSystem] ${this.entity.name} ℹ️ Weapon ${this.itemType} already unlocked for ${entityName}`);
            } else {
                this.Logger.warn(`[PickupSystem] ${this.entity.name} ⚠️ Failed to unlock weapon ${this.itemType} for ${entityName}`);
            }
            return false;
        }
    }
    _tryPickupAmmo(entity, weaponSystem) {
        if (!weaponSystem) {
            this._debugLog('No weapon system found');
            return false;
        }
        if (typeof weaponSystem.addAmmo !== 'function') {
            this._debugLog('Weapon system has no addAmmo method');
            return false;
        }
        let ammoType = this.itemType.replace('_ammo', '');
        if (this.itemType === 'universal_ammo') {
            ammoType = 'all';
        }
        const success = weaponSystem.addAmmo(ammoType, this.value);
        if (success) {
            this._debugLog(`Added ${this.value} ${ammoType} ammo to ${entity.name}`);
            return true;
        } else {
            this._debugLog(`Failed to add ammo ${ammoType} to ${entity.name} (may be full)`);
            return false;
        }
    }
    _onPickedUp(entity) {
        // Release reservation
        if (this.reservedBy) {
            this.reservedBy = null;
            this.reservationExpiry = 0;
        }
        // Play pickup sound
        this.app.fire('audio:play', {
            name: this.pickupSound,
            position: this.entity.getPosition()
        });
        // Visual effects
        this._createPickupEffects();
        // Hide and schedule respawn
        this._makeUnavailable();
        // Events
        this.app.fire('pickup:completed:picked_up', {
            item: this,
            entity: entity,
            itemType: this.itemType,
            value: this.value
        });
        this.app.fire('item:picked_up', {
            itemType: this.itemType,
            entity: entity,
            position: this.entity.getPosition().clone(),
            value: this.value
        });
    }
    _makeUnavailable() {
        this.isAvailable = false;
        this.entity.enabled = false;
        // Schedule respawn
        this.respawnTimeoutId = setTimeout(()=>{
            this.respawnTimeoutId = null;
            this._respawn();
        }, this.respawnTime * aiConfig.pickup.RESPAWN_TIME_MS_MULTIPLIER);
    }
    _respawn() {
        this.isAvailable = true;
        this.entity.enabled = true;
        // Reset visual state
        this._setupGlowMaterials();
        this._log(`Item respawned: ${this.itemType}`);
        // Events
        this.app.fire('pickup:completed:respawned', {
            item: this,
            itemType: this.itemType,
            position: this.entity.getPosition().clone()
        });
        this.app.fire('item:respawned', {
            itemType: this.itemType,
            position: this.entity.getPosition().clone()
        });
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    _onPickupRequestAttempt(data) {
        if (!data.item || data.item !== this) return;
        this.app.fire('pickup:completed:attempt', {
            item: this,
            entity: data.entity,
            success: this._manualPickupAttempt(data.entity)
        });
    }
    _onPickupRequestReserve(data) {
        if (!data.item || data.item !== this) return;
        this.app.fire('pickup:completed:reserve', {
            item: this,
            agentId: data.agentId,
            success: this.reserveFor(data.agentId, data.duration)
        });
    }
    _onPickupRequestRelease(data) {
        if (!data.item || data.item !== this) return;
        this.app.fire('pickup:completed:release', {
            item: this,
            agentId: data.agentId,
            success: this.releaseReservation(data.agentId)
        });
    }
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    _getAgentId(entity) {
        if (entity.script && entity.script.aiAgent) {
            return entity.script.aiAgent.agentId || entity.getGuid();
        }
        return entity.getGuid();
    }
    _getEntitySystems(entity) {
        const systems = {};
        if (entity.script) {
            systems.healthSystem = entity.script.healthSystem || null;
            systems.weaponSystem = entity.script.weaponSystem || null;
        }
        return systems;
    }
    _isWeaponSystemReady(entity) {
        if (!entity.script || !entity.script.weaponSystem) {
            return false;
        }
        const weaponSystem = entity.script.weaponSystem;
        // 🔧 FIX: More lenient weapon system readiness check
        // Allow pickup if weapon system exists and has weapons object
        return weaponSystem && (weaponSystem._initialized === true || weaponSystem.__weaponSystemBooted === true || weaponSystem.weapons && typeof weaponSystem.weapons === 'object');
    }
    /**
     * ✅ RE-ENABLED: Proximity-based pickup for YUKA/kinematic AI agents
     * 
     * CRITICAL: This is REQUIRED because kinematic rigidbodies using setPosition()
     * (teleport) do NOT trigger collision events in PlayCanvas/Ammo.js!
     * 
     * YUKA navigation uses entity.setPosition() which teleports the AI, so triggers
     * never fire even though the AI moves through space visually.
     * 
     * SAFEGUARDS to prevent teleportation bug:
     * 1. Only activate if entity is within reasonable pickup range (3x trigger size)
     * 2. Check if pickup is reserved - respect reservations
     * 3. Require direct line of sight (no wall between entity and pickup)
     * 4. Cooldown system to prevent rapid repeated pickups
     */ _checkProximityPickup() {
        if (!this.isAvailable) return;
        // Only check every few frames for performance
        if (!this._proximityCheckCounter) this._proximityCheckCounter = 0;
        this._proximityCheckCounter++;
        if (this._proximityCheckCounter % 5 !== 0) return; // Check every 5 frames
        // Find all potential entities (AI agents + player)
        const pickupPos = this.entity.getPosition();
        const maxRange = PickupSystem.DEFAULT_PICKUP_RANGE * 3; // 3x trigger size for safety
        // Get all entities with script components
        const root = this.app.root;
        const candidates = root.findByTag('ai').concat(root.findByTag('player'));
        for (const candidate of candidates){
            if (!candidate || !candidate.enabled) continue;
            const distance = pickupPos.distance(candidate.getPosition());
            // SAFEGUARD #1: Must be within reasonable range
            if (distance > maxRange) continue;
            // SAFEGUARD #2: Must be within actual trigger range for pickup
            if (distance > PickupSystem.DEFAULT_PICKUP_RANGE) continue;
            // SAFEGUARD #3: Check reservation
            const agentId = this._getAgentId(candidate);
            if (this.isReserved() && !this.isReservedBy(agentId)) {
                continue;
            }
            // SAFEGUARD #4: Cooldown check (prevent rapid repeated pickups)
            const now = performance.now() / 1000;
            if (now - this.lastPickupAttempt < PickupSystem.PICKUP_COOLDOWN) {
                continue;
            }
            // SAFEGUARD #5: Line of sight check (prevent picking up through walls)
            if (!this._hasLineOfSight(candidate, pickupPos)) {
                continue;
            }
            // All safeguards passed - attempt proximity pickup
            Logger.info(`[PickupSystem] ${this.entity.name} 🎯 PROXIMITY PICKUP TRIGGERED for ${candidate.name} at ${distance.toFixed(2)}m`);
            // Use same logic as trigger enter
            this.lastPickupAttempt = now;
            // Check weapon system readiness
            if ((this.itemType === 'pistol' || this.itemType === 'machinegun' || this.itemType === 'shotgun' || this.itemType.includes('ammo')) && !this._isWeaponSystemReady(candidate)) {
                Logger.warn(`[PickupSystem] ${this.entity.name} proximity pickup blocked - weapon system not ready on ${candidate.name}`);
                continue;
            }
            const systems = this._getEntitySystems(candidate);
            if (!systems.healthSystem && !systems.weaponSystem) {
                continue;
            }
            const ok = !!this._attemptPickup(candidate, systems);
            if (ok) {
                this._onPickedUp(candidate);
                Logger.goal(`[PickupSystem] ${this.entity.name} ✅ Proximity pickup successful for ${candidate.name}`);
                return; // Only pick up once per update
            }
        }
    }
    /**
     * Check if entity has clear line of sight to pickup
     */ _hasLineOfSight(entity, pickupPos) {
        const entityPos = entity.getPosition();
        const direction = new Vec3().sub2(pickupPos, entityPos);
        direction.length();
        // Raycast from entity to pickup
        const result = this.app.systems.rigidbody.raycastFirst(entityPos, pickupPos);
        // No hit = clear line of sight
        if (!result) return true;
        // Hit the pickup itself = clear line of sight
        if (result.entity === this.entity) return true;
        // Hit something else = blocked
        return false;
    }
    _createPickupEffects() {
        // Flash the glow briefly
        this._materials.forEach((material)=>{
            if (material) {
                const originalEmissive = material.emissive.clone();
                material.emissive.set(1, 1, 1);
                material.update();
                setTimeout(()=>{
                    if (material) {
                        material.emissive.copy(originalEmissive);
                        material.update();
                    }
                }, 100);
            }
        });
    }
    // ============================================================================
    // DEBUG/LOGGING
    // ============================================================================
    _log(message) {
        if (this.debugMode) {
            this.Logger.pickup?.(`[PickupSystem-${this.entity.name}] ${message}`) || this.Logger.debug?.(`[PickupSystem-${this.entity.name}] ${message}`);
        }
    }
    _debugLog(message) {
        if (this.debugMode) {
            this.Logger.debug(`[PickupSystem-${this.entity.name}] ${message}`);
        }
    }
    // ============================================================================
    // PUBLIC API (for AI agents)
    // ============================================================================
    attemptPickup(entity) {
        // 🔧 FIX: Enhanced public API with better error handling
        if (!entity) {
            this.Logger.warn(`[PickupSystem] ${this.entity.name} attemptPickup called with null entity`);
            return false;
        }
        const entityName = entity.name || 'Unknown';
        this.Logger.goal?.(`[PickupSystem] ${this.entity.name} attemptPickup() called by ${entityName}`);
        return this._manualPickupAttempt(entity);
    }
    getDistance(fromPosition) {
        return fromPosition.distance(this.entity.getPosition());
    }
    canBePickedUpBy(entity) {
        if (!this.isAvailable) return false;
        if (this.isReserved() && !this.isReservedBy(this._getAgentId(entity))) return false;
        const systems = this._getEntitySystems(entity);
        if (!systems.healthSystem && !systems.weaponSystem) return false;
        // Check weapon system readiness for weapon/ammo items
        if ((this.itemType === 'pistol' || this.itemType === 'machinegun' || this.itemType === 'shotgun' || this.itemType.includes('ammo')) && !this._isWeaponSystemReady(entity)) {
            return false;
        }
        return true;
    }
    getItemInfo() {
        return {
            itemType: this.itemType,
            value: this.value,
            position: this.entity.getPosition().clone(),
            isAvailable: this.isAvailable,
            isReserved: this.isReserved(),
            reservedBy: this.reservedBy
        };
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES
        // ============================================================================
        /** @attribute @type {string} @default 'health' @enum [{"Health Pack":"health"},{"Pistol":"pistol"},{"Machine Gun":"machinegun"},{"Shotgun":"shotgun"},{"Pistol Ammo":"pistol_ammo"},{"Machine Gun Ammo":"machinegun_ammo"},{"Shotgun Ammo":"shotgun_ammo"},{"Universal Ammo":"universal_ammo"}] @title Item Type */ _define_property(this, "itemType", 'health');
        /** @attribute @type {number} @default 60 @title Item Value */ _define_property(this, "value", aiConfig.pickup.DEFAULT_HEALTH_VALUE);
        /** @attribute @type {number} @default 30 @title Respawn Time (seconds) */ _define_property(this, "respawnTime", aiConfig.pickup.RESPAWN_TIME_SECONDS);
        /** @attribute @type {boolean} @default true @title Auto Rotate */ _define_property(this, "autoRotate", true);
        /** @attribute @type {number} @default 90 @title Rotation Speed (deg/sec) */ _define_property(this, "rotationSpeed", aiConfig.pickup.DEFAULT_ROTATION_SPEED);
        /** @attribute @type {number} @default 0.2 @title Bob Height */ _define_property(this, "bobHeight", aiConfig.pickup.DEFAULT_BOB_HEIGHT);
        /** @attribute @type {number} @default 2 @title Bob Speed */ _define_property(this, "bobSpeed", aiConfig.pickup.DEFAULT_BOB_SPEED);
        /** @attribute @type {rgb} @default [0, 1, 0] @title Glow Color */ _define_property(this, "glowColor", [
            0,
            1,
            0
        ]);
        /** @attribute @type {string} @default 'pickup' @title Pickup Sound */ _define_property(this, "pickupSound", 'pickup');
        /** @attribute @type {boolean} @default false @title Debug Mode */ _define_property(this, "debugMode", false);
    }
}
_define_property(PickupSystem, "scriptName", 'pickupSystem');
// ============================================================================
// CONSTANTS
// ============================================================================
_define_property(PickupSystem, "WEAPON_TYPES", [
    'pistol',
    'machinegun',
    'shotgun'
]);
_define_property(PickupSystem, "PICKUP_COOLDOWN", aiConfig.pickup.PICKUP_COOLDOWN);
_define_property(PickupSystem, "DEFAULT_PICKUP_RANGE", aiConfig.pickup.DEFAULT_PICKUP_RANGE) // ✅ Reduced from 1.5m to 0.5m - AI must get much closer
;

export { PickupSystem };
