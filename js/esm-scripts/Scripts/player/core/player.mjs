import { Script, BODYGROUP_DYNAMIC, BODYMASK_ALL, Vec3 } from '../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { aiConfig } from '../../config/ai.config.mjs';
import { Logger } from '../../core/engine/logger.mjs';

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
class PlayerScript extends Script {
    initialize() {
        Logger.debug('[Player] initialize() - boot start');
        if (this.entity.destroyed) {
            Logger.warn('[Player] Entity is destroyed, skipping initialization');
            return;
        }
        if (this.__playerBooted) {
            Logger.debug('[Player] Already initialized, skipping...');
            return;
        }
        if (this.app.gameManager && this.app.gameManager.player && this.app.gameManager.player.entity === this.entity) {
            Logger.debug('[Player] Already registered with GameManager, skipping duplicate');
            this.__playerBooted = true;
            return;
        }
        Logger.info('[Player] Initializing...');
        this._setupPlayerIdentification();
        this._setupPlayerCollision();
        if (!this._waitForDependencies()) {
            Logger.debug('[Player] Dependencies not ready, deferring initialization');
            return;
        }
        this.weaponSystem = this.entity.script && this.entity.script.weaponSystem;
        this.healthSystem = this.entity.script && this.entity.script.healthSystem;
        this.characterController = this.entity.script && this.entity.script.characterController;
        if (!this.weaponSystem) Logger.error('[Player] Missing weaponSystem script');
        if (!this.healthSystem) Logger.error('[Player] Missing healthSystem script');
        if (!this.characterController) Logger.error('[Player] Missing characterController script');
        this.isAlive = true;
        this.startPosition = this.entity.getPosition().clone();
        this.isRespawning = false;
        this.lastDeathTime = 0;
        this.lastRespawnTime = 0;
        this.minRespawnInterval = aiConfig.player.RESPAWN_COOLDOWN_MS;
        // Screen effects (only screen shake managed here; vignette handled by controller)
        this.screenShakeActive = false;
        this.screenShakeIntensity = 0;
        this.screenShakeDecay = 0;
        this._lastFootstepTime = 0;
        this._footstepInterval = aiConfig.player.FOOTSTEP_INTERVAL_MS;
        // ✅ CRITICAL: Create YUKA entity for AI perception
        this.yukaEntity = new YUKA.GameEntity();
        // Get current position and rotation
        const pos = this.entity.getPosition();
        const rot = this.entity.getRotation();
        this.yukaEntity.position.set(pos.x, pos.y, pos.z);
        this.yukaEntity.rotation.set(rot.x, rot.y, rot.z, rot.w);
        // ✅ CRITICAL: Set forward vector (convert PlayCanvas -Z to YUKA +Z)
        const fwd = this.entity.forward;
        this.yukaEntity.forward = new YUKA.Vector3(fwd.x, fwd.y, -fwd.z);
        // ✅ CRITICAL: Set all required properties for AI perception
        this.yukaEntity.agent = this;
        this.yukaEntity.entity = this.entity;
        this.yukaEntity.entityName = 'Player';
        this.yukaEntity.entityType = 'player'; // ✅ CRITICAL for AI vision system
        this.yukaEntity.playcanvasEntity = this.entity; // ✅ CRITICAL for reverse lookup
        this.yukaEntity.name = 'Player';
        this.yukaEntity.boundingRadius = aiConfig.player.YUKA_BOUNDING_RADIUS;
        Logger.debug('[Player] YUKA entity created at position:', pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));
        this._setupScreenEffects();
        this._setupEventListeners();
        this._registerWithGameManager();
        // ✅ FPS MODE: Hide PlayerModel (should only be visible during death cam)
        this._hidePlayerModel();
        // ✅ CINEMATIC DEATH: Add death camera controller programmatically
        this._setupDeathCameraController();
        this.on('destroy', this._cleanup, this);
        this.__playerBooted = true;
        Logger.info('[Player] Initialized successfully');
        // 🔥 CRITICAL FIX: Fire player:ready event immediately
        // This ensures EntityManager can register the player even if SessionCore doesn't fire it
        // SessionCore can still fire it later for positioning - multiple firings are safe
        this._firePlayerReadyEvent();
    }
    /**
     * 🔥 IMPROVED: Fire player:ready event for EntityManager registration
     * Fires immediately with a single fallback to reduce log spam
     */ _firePlayerReadyEvent() {
        // Fire immediately
        Logger.debug('[Player] 🎯 Firing player:ready event for EntityManager registration');
        this.app.fire('player:ready', this.entity);
        this.app.fire('player:spawned', this.entity);
        this.app.fire('player:initialized', this.entity);
        // 🔥 FIX: Single fallback at 1 second instead of multiple
        // This reduces log spam while still ensuring EntityManager gets the event
        setTimeout(()=>{
            if (!this.entity.destroyed) {
                Logger.debug('[Player] 🎯 Firing delayed player:ready event (fallback)');
                this.app.fire('player:ready', this.entity);
            }
        }, aiConfig.player.READY_EVENT_FALLBACK_DELAY_MS);
    }
    _setupPlayerIdentification() {
        const e = this.entity;
        e.entityType = 'player';
        // ✅ CRITICAL FIX: Set player team for AI target acquisition
        e.team = 'player';
        if (e.tags) {
            e.tags.add('player');
            e.tags.add('character');
            // ✅ CRITICAL FIX: Add team_player tag so AI can identify player as enemy
            e.tags.add('team_player');
            // ✅ Also add damageable tag for health system
            e.tags.add('damageable');
        }
        this.playerId = typeof e.getGuid === 'function' ? e.getGuid() : `player_${Date.now()}`;
        this.displayName = e.name && e.name !== 'Untitled' ? e.name : 'Player';
        if (this.app.gameManager) {
            const gm = this.app.gameManager;
            if (!gm.player || gm.player.entity === e) {
                gm.player = this;
            }
        }
        Logger.debug('[Player] Identification set', {
            id: this.playerId,
            name: this.displayName,
            team: e.team,
            tags: e.tags ? Array.from(e.tags.list()).join(', ') : 'none'
        });
    }
    _waitForDependencies() {
        const name = this.entity.name || 'Player';
        if (this.entity.script && this.entity.script.weaponSystem) {
            const weaponSystem = this.entity.script.weaponSystem;
            const wsInitialized = weaponSystem._initialized === true;
            const wsBooted = weaponSystem.__wsBooted === true;
            const hasWeapons = weaponSystem.weapons && typeof weaponSystem.weapons === 'object';
            if (!wsBooted || !hasWeapons) {
                Logger.debug(`[${name}] Waiting for weapon system (initialized: ${wsInitialized}, booted: ${wsBooted}, hasWeapons: ${hasWeapons})`);
                setTimeout(()=>{
                    if (!this.__playerBooted && !this.entity.destroyed) {
                        this.initialize();
                    }
                }, aiConfig.player.DEPENDENCY_CHECK_DELAY_MS);
                return false;
            }
        }
        if (this.entity.script && this.entity.script.healthSystem) {
            const healthSystem = this.entity.script.healthSystem;
            if (healthSystem.isReady && !healthSystem.isReady()) {
                Logger.debug(`[${name}] Waiting for health system to initialize...`);
                setTimeout(()=>{
                    if (!this.__playerBooted && !this.entity.destroyed) {
                        this.initialize();
                    }
                }, aiConfig.player.DEPENDENCY_CHECK_DELAY_MS);
                return false;
            }
        }
        Logger.debug(`[${name}] All dependencies ready`);
        return true;
    }
    isReady() {
        if (!this.__playerBooted) return false;
        if (this.entity.script && this.entity.script.weaponSystem) {
            const weaponSystem = this.entity.script.weaponSystem;
            if (typeof weaponSystem.isReady === 'function' && !weaponSystem.isReady()) {
                return false;
            }
        }
        if (this.entity.script && this.entity.script.healthSystem) {
            const healthSystem = this.entity.script.healthSystem;
            if (typeof healthSystem.isReady === 'function' && !healthSystem.isReady()) {
                return false;
            }
        }
        return true;
    }
    _setupPlayerCollision() {
        if (!this.entity.collision) {
            this.entity.addComponent('collision', {
                type: 'box',
                halfExtents: [
                    aiConfig.player.COLLISION_HALF_EXTENTS_X,
                    aiConfig.player.COLLISION_HALF_EXTENTS_Y,
                    aiConfig.player.COLLISION_HALF_EXTENTS_Z
                ]
            });
            Logger.debug('[Player] Added collision component for pickup detection');
        }
        this.entity.collision.trigger = false;
        if (this.entity.rigidbody) {
            this.entity.rigidbody.group = BODYGROUP_DYNAMIC;
            this.entity.rigidbody.mask = BODYMASK_ALL;
        }
        Logger.debug('[Player] Player collision setup complete for pickup detection');
    }
    _setupScreenEffects() {
        this.playerCamera = this.entity.findByName('Camera') || this.characterController && this.characterController.controller && this.characterController.controller.getCamera();
        if (!this.playerCamera) {
            Logger.warn('[Player] No camera found for screen effects');
            return;
        }
        // ✅ FIX: Enable scene depth map for particle effects (MuzzleFlash, ExplosionDebris)
        // This fixes: "A uSceneDepthMap texture is used by the shader but a scene depth texture is not available"
        if (this.playerCamera.camera) {
            this.playerCamera.camera.requestSceneDepthMap(true);
            Logger.debug('[Player] Scene depth map enabled on camera (required for soft particles)');
        }
        this._setupDamageVignette();
        this.originalCameraPosition = this.playerCamera.getLocalPosition().clone();
        Logger.debug('[Player] Screen effects initialized');
    }
    _setupDamageVignette() {
        // Prefer the editor hierarchy:
        // UI > GameHUD > DamageVignette > Image
        const ui = this.app.root.findByName('UI');
        const hud = ui?.findByName('GameHUD');
        const dv = hud?.findByName('DamageVignette');
        const img = dv?.findByName('Image');
        // Keep a handle (optional), but do NOT manipulate it here.
        this.damageVignette = img || dv || null;
        Logger.debug('[Player] Damage vignette wired to editor entity:', {
            ui: !!ui,
            hud: !!hud,
            dv: !!dv,
            img: !!img
        });
    }
    /**
     * ✅ CINEMATIC DEATH: Setup death camera controller programmatically
     * This ensures the death camera system is always available without manual Editor setup
     */ _setupDeathCameraController() {
        // Check if script is already attached
        if (this.entity.script && this.entity.script.deathCameraController) {
            Logger.debug('[Player] Death camera controller already attached');
            return;
        }
        // Check if script exists in registry
        if (!this.app.scripts || !this.app.scripts.has('deathCameraController')) {
            Logger.warn('[Player] ⚠️ DeathCameraController script not found in registry - cinematic death disabled');
            Logger.warn('[Player] Make sure DeathCameraController.mjs is loaded before player.mjs');
            return;
        }
        // Add script component if needed
        if (!this.entity.script) {
            this.entity.addComponent('script');
        }
        // Create script instance
        try {
            this.entity.script.create('deathCameraController');
            Logger.info('[Player] ✅ Death camera controller added programmatically');
        } catch (error) {
            Logger.error('[Player] Failed to add death camera controller:', error.message);
        }
    }
    /**
     * ✅ FPS MODE: Hide the PlayerModel entity (should only be visible during death cam)
     */ _hidePlayerModel() {
        const playerModel = this.entity.findByName('PlayerModel');
        if (playerModel) {
            playerModel.enabled = false;
            Logger.debug('[Player] PlayerModel hidden (FPS mode - only visible during death cam)');
        } else {
            Logger.debug('[Player] No PlayerModel child found to hide');
        }
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        this.app.on('weapon:fire_start', this._onFireStart, this);
        this.app.on('weapon:fire_continuous', this._onFireContinuous, this);
        this.app.on('weapon:reload', this._onReloadRequested, this);
        this.app.on('weapon:switch', this._onWeaponSwitchRequested, this);
        this.app.on('weapon:cycle', this._onWeaponCycle, this);
        this.app.on('character:startedMoving', this._onStartedMoving, this);
        this.app.on('character:stoppedMoving', this._onStoppedMoving, this);
    }
    _onWeaponCycle(direction) {
        if (!this._canControl() || !this.weaponSystem) return;
        const current = this.weaponSystem.getCurrentKey && this.weaponSystem.getCurrentKey() || null;
        let order = this.weaponSystem.getWeaponOrder && this.weaponSystem.getWeaponOrder() || null;
        if (!order || !Array.isArray(order) || order.length === 0) {
            order = this.weaponSystem.weapons ? Object.keys(this.weaponSystem.weapons) : [
                'pistol',
                'machinegun',
                'shotgun'
            ];
        }
        const isUnlocked = (k)=>{
            if (!this.weaponSystem.weapons || !this.weaponSystem.weapons[k]) return false;
            const w = this.weaponSystem.weapons[k];
            return w.unlocked !== false;
        };
        const unlocked = order.filter(isUnlocked);
        if (unlocked.length === 0) return;
        let idx = Math.max(0, unlocked.indexOf(current));
        idx = (idx + (direction > 0 ? 1 : -1) + unlocked.length) % unlocked.length;
        const nextKey = unlocked[idx];
        if (nextKey && nextKey !== current) {
            this.app.fire('weapon:request:switch', {
                target: this.entity,
                weaponType: nextKey
            });
        }
    }
    _onFireStart() {
        if (!this._canControl()) return;
        const targetPosition = this._calculateTargetPosition();
        this.app.fire('weapon:request:fire_start', {
            target: this.entity,
            targetPosition: targetPosition
        });
    }
    _onFireContinuous() {
        if (!this._canControl()) return;
        const targetPosition = this._calculateTargetPosition();
        this.app.fire('weapon:request:fire_continuous', {
            target: this.entity,
            targetPosition: targetPosition
        });
    }
    _onReloadRequested() {
        if (!this._canControl()) return;
        this.app.fire('weapon:request:reload', {
            target: this.entity
        });
    }
    _onWeaponSwitchRequested(weaponType) {
        if (!this._canControl()) return;
        Logger.debug('[Player] requesting weapon switch ->', weaponType);
        this.app.fire('weapon:request:switch', {
            target: this.entity,
            weaponType: weaponType
        });
    }
    _onStartedMoving(entity) {
        if (entity !== this.entity) return;
        this._isMoving = true;
        this.app.fire('player:moving', this.entity); // <-- NEW
    }
    _onStoppedMoving(entity) {
        if (entity !== this.entity) return;
        this._isMoving = false;
        this.app.fire('player:stopped', this.entity); // <-- NEW
    }
    _registerWithGameManager() {
        const tryReg = ()=>{
            if (this.app.gameManager && this.app.gameManager.__gmBooted === true) {
                this.app.fire('game:player:register:request', this);
                Logger.debug('[Player] Registration request sent to initialized GameManager');
            } else {
                this.app.once('game:manager:ready', ()=>{
                    if (this.app.gameManager && this.app.gameManager.__gmBooted === true) {
                        this.app.fire('game:player:register:request', this);
                        Logger.debug('[Player] Registration request sent to GameManager (after ready)');
                    } else {
                        setTimeout(tryReg, 150);
                    }
                });
            }
        };
        tryReg();
    }
    update(dt) {
        if (!this.__playerBooted) return;
        if (!this.isAlive) return;
        if (this.weaponSystem && !this.weaponSystem.isReady()) return;
        // ✅ NEW: Check isPaused flag (set during countdown)
        if (this.isPaused) {
            return; // Player input disabled during countdown
        }
        // ✅ CRITICAL: Sync player position, rotation, and forward vector to YUKA entity every frame
        // This is required for AI agents to detect and track the player accurately
        if (this.yukaEntity) {
            const pos = this.entity.getPosition();
            this.yukaEntity.position.set(pos.x, pos.y, pos.z);
            // ✅ CRITICAL: Sync rotation for proper forward direction (AI agents need this)
            const rot = this.entity.getRotation();
            this.yukaEntity.rotation.set(rot.x, rot.y, rot.z, rot.w);
            // ✅ CRITICAL: Sync forward vector (convert PlayCanvas -Z to YUKA +Z)
            const fwd = this.entity.forward;
            this.yukaEntity.forward.set(fwd.x, fwd.y, -fwd.z);
        }
        if (this._isMoving) {
            this._updateFootsteps();
        }
        this._updateScreenEffects(dt);
    }
    _updateFootsteps() {
        if (!this.characterController || !this.characterController.controller) return;
        const controller = this.characterController.controller;
        const velocity = controller.getVelocity();
        const isGrounded = controller.isGrounded();
        if (isGrounded && velocity.length() > aiConfig.player.FOOTSTEP_VELOCITY_THRESHOLD) {
            const now = performance.now();
            if (now - this._lastFootstepTime > this._footstepInterval) {
                this._lastFootstepTime = now;
                this.app.fire('footstep', {
                    entity: this.entity,
                    position: this.entity.getPosition()
                });
            }
        }
    }
    _updateScreenEffects(dt) {
        if (this.screenShakeActive && this.playerCamera) {
            this.screenShakeIntensity -= this.screenShakeDecay * dt;
            if (this.screenShakeIntensity <= 0) {
                this.screenShakeActive = false;
                this.screenShakeIntensity = 0;
                this.playerCamera.setLocalPosition(this.originalCameraPosition);
            } else {
                const offsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
                const offsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
                const offsetZ = (Math.random() - 0.5) * this.screenShakeIntensity * 0.5;
                const shakePos = this.originalCameraPosition.clone();
                shakePos.add(new Vec3(offsetX, offsetY, offsetZ));
                this.playerCamera.setLocalPosition(shakePos);
            }
        }
    // ✅ Damage vignette fade is now handled by the damageVignetteController script.
    // No manual opacity manipulation here.
    }
    takeDamage(damage, attacker) {
        this._triggerScreenShake(Math.min(damage * aiConfig.player.DAMAGE_TO_SHAKE_FACTOR, aiConfig.player.SCREEN_SHAKE_INTENSITY_MAX));
        this._triggerDamageVignette();
        this._triggerControllerVibration(damage);
    }
    _triggerScreenShake(intensity) {
        if (!this.playerCamera) return;
        this.screenShakeActive = true;
        this.screenShakeIntensity = intensity;
        this.screenShakeDecay = intensity * aiConfig.player.SCREEN_SHAKE_DECAY_MULTIPLIER;
        if (!this.originalCameraPosition) {
            this.originalCameraPosition = this.playerCamera.getLocalPosition().clone();
        }
    }
    _triggerDamageVignette() {
        this.app.fire('ui:damageVignette', {
            intensity: aiConfig.player.VIGNETTE_INTENSITY_NORMAL,
            duration: aiConfig.player.VIGNETTE_DURATION_NORMAL
        });
    }
    _triggerControllerVibration(damage) {
        if (navigator.getGamepads) {
            const gamepads = navigator.getGamepads();
            for(let i = 0; i < gamepads.length; i++){
                const gamepad = gamepads[i];
                if (gamepad && gamepad.vibrationActuator) {
                    const intensity = Math.min(damage * aiConfig.player.VIBRATION_DAMAGE_FACTOR, aiConfig.player.VIBRATION_INTENSITY_MAX);
                    const duration = Math.min(damage * aiConfig.player.VIBRATION_DURATION_FACTOR, aiConfig.player.VIBRATION_DURATION_MAX_MS);
                    gamepad.vibrationActuator.playEffect('dual-rumble', {
                        startDelay: 0,
                        duration: duration,
                        weakMagnitude: intensity * aiConfig.player.VIBRATION_WEAK_MULTIPLIER,
                        strongMagnitude: intensity
                    });
                }
            }
        }
    }
    onDeath(killer) {
        if (!this.isAlive) return;
        const now = performance.now();
        if (now - this.lastDeathTime < aiConfig.player.DEATH_EVENT_DEBOUNCE_MS) {
            Logger.debug('[Player] Death event too soon after last death, ignoring...');
            return;
        }
        this.lastDeathTime = now;
        this.isAlive = false;
        this._clearInputOnDeath();
        this._triggerScreenShake(aiConfig.player.SCREEN_SHAKE_INTENSITY_DEATH);
        // ✅ Trigger intense vignette on death via event (controller handles display)
        this.app.fire('ui:damageVignette', {
            intensity: aiConfig.player.VIGNETTE_INTENSITY_DEATH,
            duration: aiConfig.player.VIGNETTE_DURATION_DEATH
        });
        // ❌ REMOVED: Don't fire 'entity:died' here - HealthSystem already fires it
        // Firing it here causes duplicate death events which get caught by debounce logic
        // The HealthSystem is responsible for firing the global 'entity:died' event
        Logger.debug('[Player] onDeath() - handled player-specific death logic (HealthSystem fires entity:died event)');
    }
    _clearInputOnDeath() {
        Logger.debug('[Player] Clearing input on death...');
        this.app.fire('cc:move:forward', 0);
        this.app.fire('cc:move:backward', 0);
        this.app.fire('cc:move:left', 0);
        this.app.fire('cc:move:right', 0);
        this.app.fire('cc:jump', false);
        this.app.fire('cc:sprint', false);
        this.app.fire('weapon:fire_stop');
        if (this.characterController && this.characterController.controller) {
            const controller = this.characterController.controller;
            controller.controls = {
                forward: 0,
                backward: 0,
                left: 0,
                right: 0,
                jump: false,
                sprint: false
            };
            if (this.entity.rigidbody) {
                this.entity.rigidbody.linearVelocity = Vec3.ZERO;
                this.entity.rigidbody.angularVelocity = Vec3.ZERO;
            }
        }
    }
    respawn() {
        const now = performance.now();
        if (this.isRespawning) {
            Logger.debug('[Player] Already respawning, ignoring duplicate respawn call...');
            return;
        }
        if (now - this.lastRespawnTime < this.minRespawnInterval) {
            Logger.debug('[Player] Respawn called too soon after last respawn, ignoring...');
            return;
        }
        this.isRespawning = true;
        this.lastRespawnTime = now;
        Logger.info('[Player] Respawning player with input reset...');
        this._resetAllInputOnRespawn();
        this.isAlive = true;
        this.screenShakeActive = false;
        this.screenShakeIntensity = 0;
        // ✅ CRITICAL FIX: Clear damage vignette on respawn
        this._clearDamageVignette();
        // ✅ CRITICAL FIX: Clear blood decal effects on respawn
        this._clearBloodEffects();
        if (this.playerCamera && this.originalCameraPosition) {
            this.playerCamera.setLocalPosition(this.originalCameraPosition);
        }
        // ✅ CRITICAL FIX: Reset health and weapons FIRST
        this.app.fire('health:request:reset', {
            target: this.entity
        });
        this.app.fire('weapon:request:reset', {
            target: this.entity
        });
        // ✅ CRITICAL FIX: Force weapon model visibility reset AFTER weapon reset event
        // This ensures the pistol is visible and all other weapons are hidden
        setTimeout(()=>{
            this._forceWeaponModelReset();
        }, 100); // Small delay to let weapon:switched event propagate
        this._resetCharacterControllerOnRespawn();
        this.startPosition = this.entity.getPosition().clone();
        this._isMoving = false;
        this._lastFootstepTime = 0;
        // 🔥 NEW: Sync YUKA entity after respawn
        if (this.yukaEntity) {
            const pos = this.entity.getPosition();
            this.yukaEntity.position.set(pos.x, pos.y, pos.z);
            Logger.debug('[Player] YUKA entity synced after respawn');
        }
        setTimeout(()=>{
            this.isRespawning = false;
            Logger.debug('[Player] Respawn complete with input reset');
        }, aiConfig.player.DEPENDENCY_CHECK_DELAY_MS);
    }
    /**
     * ✅ Clear damage vignette effect (for respawn/reset)
     */ _clearDamageVignette() {
        // Find the damage vignette controller and force it to clear
        const ui = this.app.root.findByName('UI');
        const hud = ui?.findByName('GameHUD');
        const dv = hud?.findByName('DamageVignette');
        const img = dv?.findByName('Image');
        // Try to find the controller
        const ctrl = dv?.script?.damageVignetteController || img?.script?.damageVignetteController;
        if (ctrl && ctrl._setOpacity) {
            // Kill any active animations
            if (ctrl._killTweens) {
                ctrl._killTweens();
            }
            // Force opacity to 0
            ctrl._setOpacity(0);
            Logger.debug('[Player] Damage vignette cleared on respawn');
        } else {
            Logger.debug('[Player] No damage vignette controller found to clear');
        }
    }
    /**
     * ✅ CRITICAL FIX: Clear blood decal effects (for respawn/reset)
     * Blood decals are created as child entities named 'BloodDecal' attached to the player
     */ _clearBloodEffects() {
        let bloodDecalsRemoved = 0;
        // Find and destroy all blood decal children
        const children = this.entity.children.slice(); // Copy array to avoid modification during iteration
        for (const child of children){
            if (child.name === 'BloodDecal') {
                child.destroy();
                bloodDecalsRemoved++;
            }
        }
        if (bloodDecalsRemoved > 0) {
            Logger.debug(`[Player] Cleared ${bloodDecalsRemoved} blood decal effects on respawn`);
        }
    }
    /**
     * ✅ CRITICAL FIX: Force weapon model reset (for respawn/reset)
     * Ensures ONLY the pistol model is visible, hiding all others
     * This is called AFTER weapon:request:reset to override any stale state
     */ _forceWeaponModelReset() {
        // Find the weapon container (it's under Camera > HandAnchor > WeaponContainer)
        let weaponParent = this.entity.findByName('WeaponContainer');
        if (!weaponParent) {
            // Try alternate name
            weaponParent = this.entity.findByName('WeaponModels');
        }
        if (!weaponParent) {
            Logger.warn('[Player] ⚠️ No WeaponContainer/WeaponModels parent found');
            return;
        }
        let pistolFound = false;
        let weaponsHidden = 0;
        // Helper function to enable entity and all children recursively
        const enableEntityTree = (entity)=>{
            entity.enabled = true;
            entity.children.forEach((child)=>enableEntityTree(child));
        };
        // Helper function to disable entity and all children recursively
        const disableEntityTree = (entity)=>{
            entity.enabled = false;
            entity.children.forEach((child)=>disableEntityTree(child));
        };
        // Iterate through all weapon model children
        const weaponChildren = weaponParent.children.slice();
        for (const weaponModel of weaponChildren){
            const weaponName = weaponModel.name.toLowerCase();
            // Enable ONLY the pistol (and all its children), disable everything else
            if (weaponName.includes('pistol')) {
                enableEntityTree(weaponModel);
                Logger.debug(`[Player] ✅ Enabled Pistol weapon model and all children`);
                pistolFound = true;
            } else {
                disableEntityTree(weaponModel);
                weaponsHidden++;
                Logger.debug(`[Player] ❌ Disabled ${weaponModel.name} weapon model and all children`);
            }
        }
        if (weaponsHidden > 0) {
            Logger.debug(`[Player] Hidden ${weaponsHidden} non-pistol weapon models`);
        }
        if (!pistolFound) {
            Logger.warn('[Player] ⚠️ Pistol weapon model not found in weapon container!');
        } else {
            Logger.debug('[Player] ✅ Weapon models reset - only Pistol visible with all children enabled');
        }
    }
    _resetAllInputOnRespawn() {
        Logger.debug('[Player] Resetting all input systems on respawn...');
        const scriptComps = this.app.root.findComponents('script');
        scriptComps.forEach((sc)=>{
            const s = sc.entity.script;
            if (!s) return;
            [
                'desktopInput',
                'mobileInput',
                'gamePadInput'
            ].forEach((k)=>{
                if (s[k] && typeof s[k].reset === 'function') s[k].reset();
            });
        });
    }
    _resetCharacterControllerOnRespawn() {
        Logger.debug('[Player] Resetting character controller on respawn...');
        if (this.characterController) {
            if (this.characterController.reset) {
                this.characterController.reset();
            } else if (this.characterController.controller && this.characterController.controller.reset) {
                this.characterController.controller.reset();
            } else if (this.characterController.controller) {
                const controller = this.characterController.controller;
                controller.controls = {
                    forward: 0,
                    backward: 0,
                    left: 0,
                    right: 0,
                    jump: false,
                    sprint: false
                };
                controller.look.set(0, 0);
                controller._jumping = false;
                controller._grounded = false;
                controller._wasMoving = false;
                controller._wasSprinting = false;
                if (this.entity.rigidbody) {
                    this.entity.rigidbody.linearVelocity = Vec3.ZERO;
                    this.entity.rigidbody.angularVelocity = Vec3.ZERO;
                }
            }
        }
    }
    reset() {
        Logger.debug('[Player] Resetting player state...');
        this.isAlive = true;
        this.isRespawning = false;
        this.lastDeathTime = 0;
        this.lastRespawnTime = 0;
        this._isMoving = false;
        this._lastFootstepTime = 0;
        this.screenShakeActive = false;
        this.screenShakeIntensity = 0;
        this.screenShakeDecay = 0;
        // ✅ CRITICAL FIX: Clear damage vignette on reset
        this._clearDamageVignette();
        // ✅ CRITICAL FIX: Clear blood decal effects on reset
        this._clearBloodEffects();
        if (this.playerCamera && this.originalCameraPosition) {
            this.playerCamera.setLocalPosition(this.originalCameraPosition);
        }
        // ✅ CRITICAL FIX: Reset health and weapons FIRST
        this.app.fire('health:request:reset', {
            target: this.entity
        });
        this.app.fire('weapon:request:reset', {
            target: this.entity
        });
        // ✅ CRITICAL FIX: Force weapon model visibility reset AFTER weapon reset event
        setTimeout(()=>{
            this._forceWeaponModelReset();
        }, 100);
        if (this.characterController && this.characterController.reset) {
            this.characterController.reset();
        } else if (this.characterController && this.characterController.controller && this.characterController.controller.reset) {
            this.characterController.controller.reset();
        }
        this.startPosition = this.entity.getPosition().clone();
        // 🔥 NEW: Sync YUKA entity after reset
        if (this.yukaEntity) {
            const pos = this.entity.getPosition();
            this.yukaEntity.position.set(pos.x, pos.y, pos.z);
            Logger.debug('[Player] YUKA entity synced after reset');
        }
    }
    _canControl() {
        if (!this.app.gameManager) return false;
        if (!this.isAlive) return false;
        if (this.isRespawning) return false;
        if (!this.app.gameManager.__gmBooted) return false;
        return this.app.gameManager.isPlaying();
    }
    getCameraForward() {
        if (this.characterController && this.characterController.controller) {
            return this.characterController.controller.getCameraForward();
        }
        return Vec3.FORWARD;
    }
    /**
     * ✅ CRITICAL FIX: Calculate proper target position for weapon firing
     * Previously getCameraForward() returned a direction vector, not a position!
     * This caused weapons to fire straight down instead of toward the crosshair.
     */ _calculateTargetPosition() {
        // Get camera position and forward direction
        const cameraPosition = this.characterController?.controller?.getCamera()?.getPosition() || this.entity.getPosition();
        const forwardDirection = this.getCameraForward();
        // Project forward from camera to create target position
        // Use a reasonable distance (50 units) for weapon targeting
        const targetDistance = aiConfig.player.WEAPON_TARGET_DISTANCE;
        const targetPosition = cameraPosition.clone().add(forwardDirection.clone().scale(targetDistance));
        return targetPosition;
    }
    getPosition() {
        return this.entity.getPosition();
    }
    isGrounded() {
        if (this.characterController && this.characterController.controller) {
            return this.characterController.controller.isGrounded();
        }
        return true;
    }
    getVelocity() {
        if (this.characterController && this.characterController.controller) {
            return this.characterController.controller.getVelocity();
        }
        return new Vec3();
    }
    isMoving() {
        if (this.characterController && this.characterController.controller) {
            return this.characterController.controller.isMoving();
        }
        return false;
    }
    isSprinting() {
        if (this.characterController && this.characterController.controller) {
            return this.characterController.controller.isSprinting();
        }
        return false;
    }
    getWeaponInfo() {
        if (this.weaponSystem) {
            return this.weaponSystem.getWeaponInfo();
        }
        return null;
    }
    hasUsableWeapon() {
        if (this.weaponSystem) {
            return this.weaponSystem.hasUsableWeapon();
        }
        return false;
    }
    needsAmmo(threshold) {
        if (this.weaponSystem) {
            return this.weaponSystem.needsAmmo(threshold);
        }
        return true;
    }
    getHealthPercent() {
        if (this.healthSystem) {
            return this.healthSystem.getHealthPercent();
        }
        return 1.0;
    }
    isLowHealth(threshold) {
        if (this.healthSystem) {
            return this.healthSystem.isLowHealth(threshold);
        }
        return false;
    }
    canPickupHealth() {
        if (this.healthSystem) {
            return this.healthSystem.canPickupHealth();
        }
        return false;
    }
    debugPlayerState() {
        const info = {
            name: this.entity.name,
            entityType: this.entity.entityType,
            guid: this.entity.getGuid().substring(0, 8),
            enabled: this.entity.enabled,
            destroyed: this.entity.destroyed,
            position: this.entity.getPosition(),
            isAlive: this.isAlive,
            isRespawning: this.isRespawning,
            isReady: this.isReady(),
            canControl: this._canControl(),
            tags: this.entity.tags ? Array.from(this.entity.tags.list) : 'No tags',
            scripts: Object.keys(this.entity.script || {}),
            health: this.healthSystem ? `${this.healthSystem.currentHealth}/${this.healthSystem.maxHealth}` : 'No health system',
            weapon: this.weaponSystem ? this.weaponSystem.getWeaponInfo() : 'No weapon system',
            weaponReady: this.weaponSystem ? this.weaponSystem.isReady() : 'No weapon system',
            gameManagerReady: this.app.gameManager ? this.app.gameManager.__gmBooted : 'No game manager',
            yukaEntity: this.yukaEntity ? 'YES' : 'NO',
            yukaPosition: this.yukaEntity ? `(${this.yukaEntity.position.x.toFixed(2)}, ${this.yukaEntity.position.y.toFixed(2)}, ${this.yukaEntity.position.z.toFixed(2)})` : 'N/A'
        };
        Logger.debug('[Player] Player State:', info);
        return info;
    }
    _cleanup() {
        if (!this._eventsBound) return;
        this.app.off('weapon:fire_start', this._onFireStart, this);
        this.app.off('weapon:fire_continuous', this._onFireContinuous, this);
        this.app.off('weapon:reload', this._onReloadRequested, this);
        this.app.off('weapon:switch', this._onWeaponSwitchRequested, this);
        this.app.off('character:startedMoving', this._onStartedMoving, this);
        this.app.off('character:stoppedMoving', this._onStoppedMoving, this);
        this.app.off('weapon:cycle', this._onWeaponCycle, this);
        this._eventsBound = false;
        if (this.damageVignette) {
            this.damageVignette.destroy();
        }
        this.__playerBooted = false;
    }
}
_define_property(PlayerScript, "scriptName", 'player');

export { PlayerScript };
