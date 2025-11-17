import { Script } from '../../../../../../playcanvas-stable.min.mjs';
import { WeaponCore } from './WeaponCore.mjs';
import { WeaponEffects } from './WeaponEffects.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
================================================================================
CONTRACT: WeaponSystem.mjs
================================================================================
PURPOSE:
    PlayCanvas Script facade providing weapon functionality with full editor
    integration. Acts as the public API for weapon operations while delegating
    core mechanics to WeaponCore and visual effects to WeaponEffects.

ARCHITECTURE:
    ┌─────────────────┐
    │  WeaponSystem   │  ← PlayCanvas Script (this file)
    │    (Facade)     │     - Editor attributes
    │                 │     - PlayCanvas lifecycle
    │                 │     - Event handling
    └────────┬────────┘     - Public API
             │
        ┌────┴────┐
        │         │
    ┌───▼───┐ ┌──▼────────┐
    │ Core  │ │  Effects  │
    │Logic  │ │Visual/SFX │
    └───────┘ └───────────┘

RESPONSIBILITIES:
    - Provide editor-configurable attributes for weapon setup
    - Initialize and manage WeaponCore and WeaponEffects modules
    - Handle PlayCanvas Script lifecycle (initialize, postInitialize, onDestroy)
    - Listen for and respond to weapon-related events
    - Maintain backward compatibility with existing systems
    - Sync weapon state between core logic and facade

BACKWARD COMPATIBILITY:
    The following properties/methods are maintained for external systems:
    - this._initialized (boolean) - Module creation complete
    - this.__wsBooted (boolean) - Full initialization complete
    - this.weapons (object) - Mirrored from weaponCore
    - this.currentWeapon (string) - Mirrored from weaponCore
    - this.currentMagazine (number) - Mirrored from weaponCore
    - this.isReloading (boolean) - Mirrored from weaponCore
    - isReady() - Returns true when fully initialized and ready for use
    
    All public methods include defensive checks to handle calls before
    initialization is complete, returning safe default values.

DELEGATION:
    - WeaponCore: All weapon mechanics (firing, reloading, ammo, switching)
    - WeaponEffects: Visual models, muzzle flashes, impact effects, sounds

USAGE (External Systems):
    // Fire weapon
    entity.script.weaponSystem.fireWeapon(targetPosition);
    
    // Reload
    entity.script.weaponSystem.reload();
    
    // Switch weapon
    entity.script.weaponSystem.switchWeapon('machinegun');
    
    // Query state
    const info = entity.script.weaponSystem.getWeaponInfo();
    const hasAmmo = entity.script.weaponSystem.hasAmmo();
    
    // Check readiness
    if (entity.script.weaponSystem.isReady()) {
        // Safe to use weapon system
    }

EVENTS LISTENED:
    - weapon:request:fire_start        // Fire single shot
    - weapon:request:fire_continuous   // Fire continuous (auto weapons)
    - weapon:request:reload           // Reload current weapon
    - weapon:request:switch           // Switch to different weapon
    - weapon:request:reset            // Reset to starting state
    - weapon:reload_complete          // Sync state after reload
    - weapon:createImpactEffect       // Create visual impact effects

EVENTS FIRED:
    - weaponSystem:ready              // When system is fully initialized

STATE SYNCHRONIZATION:
    The facade maintains mirrors of core state for compatibility:
    - this.weapons = this.weaponCore.weapons
    - this.currentWeapon = this.weaponCore.currentWeapon
    - this.currentMagazine = this.weaponCore.currentMagazine
    - this.isReloading = this.weaponCore.isReloading

INITIALIZATION FLOW:
    1. initialize() - Set up attributes, create modules, find weapon socket
       - Sets this._initialized = true
    2. postInitialize() - Update weapon models, finalize initialization
       - Sets this.__wsBooted = true
    3. Fire 'weaponSystem:ready' event
    
NOTES:
    - AI agents: weapon socket auto-discovered from entity hierarchy
    - Player: weapon socket typically the camera entity
    - Team assignment: Automatically sets entity.team for friendly fire checks
    - Weapon models: Auto-discovered if not explicitly assigned in editor
    - Defensive design: All public methods safe to call before initialization
================================================================================
*/ function _define_property(obj, key, value) {
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
class WeaponSystem extends Script {
    // ========================================================================
    // LIFECYCLE - INITIALIZATION
    // ========================================================================
    initialize() {
        this.Logger = globalThis.Logger || console;
        // CRITICAL: Backward compatibility flags for external systems
        this._initialized = false;
        this.__wsBooted = false;
        // Detect entity type
        this.isAI = !!this.entity.script?.aiAgent;
        this.isPlayer = !!(this.entity.script?.playerController || this.entity.script?.fpsPlayer || this.entity.script?.player);
        this.entityId = this.entity.getGuid();
        this.entityName = this.entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        // Set team for friendly fire checks
        if (this.isPlayer) {
            this.entity.team = 'player';
            this.entity.tags?.add('team_player');
        } else if (this.isAI) {
            this.entity.team = 'ai';
            this.entity.tags?.add('team_ai');
        }
        // Initialize attributes
        this._initializeAttributes();
        // Create internal modules
        this._createModules();
        // Auto-find weapon socket if needed
        if (!this.weaponSocket) {
            this.weaponSocket = this._findWeaponSocket();
        }
        // Setup event listeners
        this._setupEventListeners();
        // Mark as initialized (modules created)
        this._initialized = true;
        this.Logger.info(`[${this.entityName}] WeaponSystem initialized`);
    }
    async postInitialize() {
        try {
            // ✅ FIX: Re-detect entity type in case aiAgent wasn't loaded during initialize()
            // This can happen if weaponSystem is initialized before aiAgent
            if (this.isAI === undefined || this.isAI === false) {
                this.isAI = !!this.entity.script?.aiAgent;
                if (this.isAI) {
                    this.Logger.info(`[${this.entityName}] ✅ AI agent detected in postInitialize (was missed in initialize)`);
                    this.entity.team = 'ai';
                    this.entity.tags?.add('team_ai');
                    // Re-find weapon socket now that we know it's an AI
                    this.weaponSocket = this._findWeaponSocket();
                }
            }
            // DEFENSIVE: Verify weaponEffects exists before using
            if (!this.weaponEffects) {
                this.Logger.error(`[${this.entityName}] WeaponEffects not initialized!`);
                return;
            }
            // ✅ NEW: Reparent weapons to hand bone for AI agents
            this.Logger.info(`[${this.entityName}] 🔍 Reparenting check - isAI: ${this.isAI}, weaponSocket: ${this.weaponSocket?.name}, method exists: ${!!this.weaponEffects._reparentWeaponsToHand}`);
            if (this.isAI && this.weaponSocket) {
                this.Logger.info(`[${this.entityName}] 🔄 Calling _reparentWeaponsToHand()...`);
                this.weaponEffects._reparentWeaponsToHand();
            } else {
                this.Logger.warn(`[${this.entityName}] ⚠️ Skipping reparenting - isAI: ${this.isAI}, weaponSocket: ${this.weaponSocket?.name}`);
            }
            // Show initial weapon model
            // Note: WeaponEffects.initialize() already discovered models
            this.updateWeaponModel();
            // Mark as fully booted (ready for use)
            this.__wsBooted = true;
            // Fire ready event
            this.entity.fire('weaponSystem:ready', this.entity);
            this.app.fire('weaponSystem:ready', this.entity);
            this.Logger.info(`[${this.entityName}] WeaponSystem ready`);
        } catch (error) {
            this.Logger.error(`[${this.entityName}] WeaponSystem initialization error:`, error);
        }
    }
    /**
     * Check if weapon system is fully initialized and ready to use
     * Required by external systems (AIAgent, etc.)
     */ isReady() {
        return this._initialized === true && this.__wsBooted === true;
    }
    _initializeAttributes() {
        // Ensure all attribute objects exist
        const defaults = {
            unlockedWeapons: {},
            startingAmmo: {},
            startingMagazines: {},
            maxAmmo: {},
            magazineSizes: {},
            weaponDamage: {},
            fireRates: {},
            weaponRanges: {},
            weaponSpread: {},
            reloadTimes: {},
            weaponModels: {},
            muzzleFlashEntities: {}
        };
        Object.keys(defaults).forEach((attr)=>{
            this[attr] = this[attr] || defaults[attr];
        });
        // Set weapon-specific defaults
        WeaponSystem.WEAPON_TYPES.forEach((type)=>{
            if (!(type in this.unlockedWeapons)) {
                this.unlockedWeapons[type] = type === 'pistol';
            }
            if (!(type in this.startingAmmo)) {
                this.startingAmmo[type] = type === 'pistol' ? aiConfig.weapons.PISTOL_STARTING_AMMO : 0;
            }
            if (!(type in this.startingMagazines)) {
                this.startingMagazines[type] = type === 'pistol' ? aiConfig.weapons.PISTOL_MAGAZINE_SIZE : 0;
            }
            if (!(type in this.maxAmmo)) this.maxAmmo[type] = aiConfig.weapons.DEFAULT_AMMO_FALLBACK;
            if (!(type in this.magazineSizes)) this.magazineSizes[type] = aiConfig.weapons.DEFAULT_MAGAZINE_SIZE_FALLBACK;
            if (!(type in this.weaponDamage)) this.weaponDamage[type] = aiConfig.weapons.DEFAULT_DAMAGE_FALLBACK;
            if (!(type in this.fireRates)) this.fireRates[type] = aiConfig.weapons.DEFAULT_FIRE_RATE_FALLBACK;
            if (!(type in this.weaponRanges)) this.weaponRanges[type] = aiConfig.weapons.DEFAULT_RANGE_FALLBACK;
            if (!(type in this.weaponSpread)) this.weaponSpread[type] = aiConfig.weapons.DEFAULT_SPREAD_FALLBACK;
            if (!(type in this.reloadTimes)) this.reloadTimes[type] = aiConfig.weapons.DEFAULT_RELOAD_TIME_FALLBACK;
        });
    }
    _createModules() {
        // Build configuration for WeaponCore
        const coreConfig = {
            startingWeapon: this.startingWeapon,
            unlockedWeapons: this.unlockedWeapons,
            startingAmmo: this.startingAmmo,
            startingMagazines: this.startingMagazines,
            maxAmmo: this.maxAmmo,
            magazineSizes: this.magazineSizes,
            weaponDamage: this.weaponDamage,
            fireRates: this.fireRates,
            weaponRanges: this.weaponRanges,
            weaponSpread: this.weaponSpread,
            reloadTimes: this.reloadTimes,
            shotgunPellets: this.shotgunPellets
        };
        // Build configuration for WeaponEffects
        // CRITICAL: Include visual references and debug mode
        const effectsConfig = {
            weaponModels: this.weaponModels,
            muzzleFlashEntities: this.muzzleFlashEntities,
            debugMode: this.debugMode
        };
        // Create internal modules
        this.weaponCore = new WeaponCore(coreConfig, this.Logger);
        this.weaponEffects = new WeaponEffects(effectsConfig, this.Logger);
        // DEFENSIVE: Verify modules were created
        if (!this.weaponCore) {
            this.Logger.error(`[${this.entityName}] Failed to create WeaponCore!`);
        }
        if (!this.weaponEffects) {
            this.Logger.error(`[${this.entityName}] Failed to create WeaponEffects!`);
        }
        // Initialize modules
        this.weaponCore.initialize(this.app, this.entity);
        this.weaponEffects.initialize(this.app, this.entity);
        // Sync state to facade for compatibility
        this._syncWeaponState();
    }
    _findWeaponSocket() {
        // For AI: search for weapon socket in entity hierarchy
        if (this.isAI) {
            // ✅ PRIORITY 1: Find hand bones in Mixamo skeleton
            const rightHandBone = this.entity.findByName('mixamorig:RightHand');
            const leftHandBone = this.entity.findByName('mixamorig:LeftHand');
            if (rightHandBone) {
                // Store left hand for two-handed weapons
                this.leftHandBone = leftHandBone;
                if (leftHandBone) {
                    this.Logger.info(`[${this.entityName}] ✅ Found both hand bones - two-handed weapons supported`);
                } else {
                    this.Logger.info(`[${this.entityName}] ✅ Found RightHand bone - weapon will attach to hand`);
                }
                return rightHandBone;
            }
            // PRIORITY 2: Common AI weapon socket names
            const socketNames = [
                'WeaponSocket_R',
                'WeaponSocket',
                'WeaponHolder',
                'WeaponMount'
            ];
            for (const name of socketNames){
                const socket = this.entity.findByName(name);
                if (socket) {
                    this.Logger.info(`[${this.entityName}] Found weapon socket: ${name}`);
                    return socket;
                }
            }
            // PRIORITY 3: Try WeaponContainer's parent
            const container = this.entity.findByName('WeaponContainer');
            if (container?.parent && container.parent !== this.entity) {
                this.Logger.info(`[${this.entityName}] Using WeaponContainer's parent as socket`);
                return container.parent;
            }
            this.Logger.warn(`[${this.entityName}] ⚠️ No weapon socket or RightHand bone found - weapon will attach to entity root (chest)`);
        }
        // For player: use camera if available
        if (this.isPlayer && this.cameraEntity) {
            return this.cameraEntity;
        }
        return null;
    }
    // ========================================================================
    // STATE SYNCHRONIZATION
    // ========================================================================
    _syncWeaponState() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            this.weapons = {};
            this.currentWeapon = this.startingWeapon || 'pistol';
            this.currentMagazine = 0;
            this.isReloading = false;
            return;
        }
        // Mirror state from weaponCore for backward compatibility
        this.weapons = this.weaponCore.weapons;
        this.currentWeapon = this.weaponCore.currentWeapon;
        this.currentMagazine = this.weaponCore.currentMagazine;
        this.isReloading = this.weaponCore.isReloading;
    }
    // ========================================================================
    // PUBLIC API - WEAPON ACTIONS
    // ========================================================================
    fireWeapon(targetPosition) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            this.Logger.warn(`[${this.entityName}] fireWeapon called before initialization`);
            return false;
        }
        const success = this.weaponCore.fire(targetPosition, this.weaponSocket);
        // Sync state after firing
        if (success) {
            this._syncWeaponState();
            // ✅ FIX: Set isFiring flag for animation system
            this.isFiring = true;
            // Clear the flag after animation controller has time to read it
            // AnimationController updates at 10Hz (100ms), so we need at least 200ms
            if (this._firingTimeout) {
                clearTimeout(this._firingTimeout);
            }
            this._firingTimeout = setTimeout(()=>{
                this.isFiring = false;
            }, 200); // 200ms ensures AnimationController catches the flag
            // Play visual effects
            if (this.weaponEffects) {
                this.weaponEffects.playMuzzleFlash(this.currentWeapon);
            }
        }
        return success;
    }
    canFire() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return false;
        }
        return this.weaponCore.canFire();
    }
    reload() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            this.Logger.warn(`[${this.entityName}] reload called before initialization`);
            return false;
        }
        const success = this.weaponCore.reload();
        // Sync state after reload attempt
        this._syncWeaponState();
        // Play reload sound
        if (success && this.weaponEffects) {
            this.weaponEffects.playReloadSound(this.currentWeapon);
        }
        // Trigger reload animation for AI
        if (success && this.entity.script?.aiAgent?.animationController) {
            this.entity.script.aiAgent.animationController.onWeaponReload();
        }
        return success;
    }
    switchWeapon(weaponType) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            this.Logger.warn(`[${this.entityName}] switchWeapon called before initialization`);
            return false;
        }
        const success = this.weaponCore.switchWeapon(weaponType);
        if (success) {
            // Sync state after switch
            this._syncWeaponState();
            // Update visual weapon model
            this.updateWeaponModel();
        }
        return success;
    }
    unlockWeapon(weaponType) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            this.Logger.warn(`[${this.entityName}] unlockWeapon called before initialization`);
            return false;
        }
        const success = this.weaponCore.unlockWeapon(weaponType);
        this._syncWeaponState();
        return success;
    }
    addAmmo(weaponType, amount) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return false;
        }
        const result = this.weaponCore.addAmmo(weaponType, amount);
        this._syncWeaponState();
        return result;
    }
    // ========================================================================
    // PUBLIC API - QUERY METHODS
    // ========================================================================
    getCurrentKey() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return this.startingWeapon || 'pistol';
        }
        return this.weaponCore.getCurrentKey();
    }
    getCurrent() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return {
                ammo: 0,
                magazine: 0,
                unlocked: false
            };
        }
        return this.weaponCore.getCurrent();
    }
    getWeaponInfo(weaponType) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return {
                weaponType: weaponType || 'pistol',
                currentMagazine: 0,
                totalAmmo: 0
            };
        }
        const key = weaponType || this.weaponCore.getCurrentKey();
        const coreInfo = this.weaponCore.getWeaponInfo(key);
        if (!coreInfo) {
            return {
                weaponType: key || null,
                currentMagazine: 0,
                totalAmmo: 0
            };
        }
        // Return normalized format for HUD
        return {
            weaponType: coreInfo.type,
            currentMagazine: coreInfo.magazine,
            totalAmmo: coreInfo.ammo
        };
    }
    getAllWeaponsInfo() {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return {
                pistol: null,
                machinegun: null,
                shotgun: null
            };
        }
        return this.weaponCore.getAllWeaponsInfo();
    }
    hasAmmo(weaponType) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return false;
        }
        return this.weaponCore.hasAmmo(weaponType);
    }
    needsReload(weaponType) {
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (!this.weaponCore) {
            return false;
        }
        return this.weaponCore.needsReload(weaponType);
    }
    // ========================================================================
    // VISUAL UPDATES
    // ========================================================================
    updateWeaponModel() {
        // DEFENSIVE: Handle calls before weaponEffects is initialized
        if (!this.weaponEffects) {
            if (this.debugMode) {
                this.Logger.warn(`[${this.entityName}] updateWeaponModel called before WeaponEffects initialized`);
            }
            return;
        }
        const currentWeaponType = this.getCurrentKey();
        this.weaponEffects.updateWeaponModel(currentWeaponType);
    }
    // ========================================================================
    // EVENT HANDLING
    // ========================================================================
    _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Weapon action requests
        this.app.on('weapon:request:fire_start', this._onFireRequest, this);
        this.app.on('weapon:request:fire_continuous', this._onFireContinuous, this);
        this.app.on('weapon:request:reload', this._onReloadRequest, this);
        this.app.on('weapon:request:switch', this._onSwitchRequest, this);
        this.app.on('weapon:request:reset', this._onResetRequest, this);
        // State sync events
        this.app.on('weapon:reload_complete', this._onReloadComplete, this);
        this.app.on('weapon:createImpactEffect', this._onCreateImpact, this);
    }
    _cleanupEventListeners() {
        if (!this._eventsBound) return;
        this.app.off('weapon:request:fire_start', this._onFireRequest, this);
        this.app.off('weapon:request:fire_continuous', this._onFireContinuous, this);
        this.app.off('weapon:request:reload', this._onReloadRequest, this);
        this.app.off('weapon:request:switch', this._onSwitchRequest, this);
        this.app.off('weapon:request:reset', this._onResetRequest, this);
        this.app.off('weapon:reload_complete', this._onReloadComplete, this);
        this.app.off('weapon:createImpactEffect', this._onCreateImpact, this);
        this._eventsBound = false;
    }
    _onFireRequest(data) {
        if (!this._isTargetedAtThis(data)) return;
        if (data.targetPosition) {
            this.fireWeapon(data.targetPosition);
        }
    }
    _onFireContinuous(data) {
        if (!this._isTargetedAtThis(data)) return;
        if (data.targetPosition && this.canFire()) {
            this.fireWeapon(data.targetPosition);
        }
    }
    _onReloadRequest(data) {
        if (!this._isTargetedAtThis(data)) return;
        this.reload();
    }
    _onSwitchRequest(data) {
        if (!this._isTargetedAtThis(data)) return;
        if (data.weaponType) {
            this.switchWeapon(data.weaponType);
        }
    }
    _onResetRequest(data) {
        if (!this._isTargetedAtThis(data)) return;
        // DEFENSIVE: Handle calls before weaponCore is initialized
        if (this.weaponCore) {
            this.weaponCore.resetWeapons(this.startingWeapon);
            this._syncWeaponState();
        }
    }
    _onReloadComplete(data) {
        if (data?.entity !== this.entity) return;
        this._syncWeaponState();
    }
    _onCreateImpact(data) {
        if (!data?.position) return;
        // DEFENSIVE: Handle calls before weaponEffects is initialized
        if (this.weaponEffects) {
            this.weaponEffects.createImpactEffect(data.position, data.normal, data.targetEntity);
        }
    }
    _isTargetedAtThis(data) {
        if (!data) return false;
        return data.target === this.entity || data.entity === this.entity || data.entityId === this.entityId || data.entityName === this.entityName;
    }
    // ========================================================================
    // CLEANUP
    // ========================================================================
    onDestroy() {
        this._cleanupEventListeners();
        if (this.weaponEffects) {
            this.weaponEffects.cleanup();
        }
        this.Logger.info(`[${this.entityName}] WeaponSystem destroyed`);
    }
    constructor(...args){
        super(...args);
        // ========================================================================
        // EDITOR ATTRIBUTES - WEAPON CONFIGURATION
        // ========================================================================
        /** @attribute @type {string} @default 'pistol' @enum [{"Pistol":"pistol"},{"Machine Gun":"machinegun"},{"Shotgun":"shotgun"}] */ _define_property(this, "startingWeapon", 'pistol');
        /** @attribute @type {pc.Entity} @title Weapon Socket */ _define_property(this, "weaponSocket", null);
        /** @attribute @type {pc.Entity} @title Camera Entity */ _define_property(this, "cameraEntity", null);
        // Starting State
        /** @attribute @type {json} @schema [{"name":"pistol","type":"boolean","default":true},{"name":"machinegun","type":"boolean","default":false},{"name":"shotgun","type":"boolean","default":false}] */ _define_property(this, "unlockedWeapons", {
            pistol: true,
            machinegun: false,
            shotgun: false
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":120},{"name":"machinegun","type":"number","default":0},{"name":"shotgun","type":"number","default":0}] */ _define_property(this, "startingAmmo", {
            pistol: aiConfig.weapons.PISTOL_STARTING_AMMO,
            machinegun: aiConfig.weapons.MACHINEGUN_STARTING_AMMO,
            shotgun: aiConfig.weapons.SHOTGUN_STARTING_AMMO
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":12},{"name":"machinegun","type":"number","default":0},{"name":"shotgun","type":"number","default":0}] */ _define_property(this, "startingMagazines", {
            pistol: aiConfig.weapons.PISTOL_MAGAZINE_SIZE,
            machinegun: 0,
            shotgun: 0
        });
        // Weapon Stats
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":120},{"name":"machinegun","type":"number","default":150},{"name":"shotgun","type":"number","default":30}] */ _define_property(this, "maxAmmo", {
            pistol: aiConfig.weapons.PISTOL_MAX_AMMO,
            machinegun: aiConfig.weapons.MACHINEGUN_MAX_AMMO,
            shotgun: aiConfig.weapons.SHOTGUN_MAX_AMMO
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":12},{"name":"machinegun","type":"number","default":30},{"name":"shotgun","type":"number","default":8}] */ _define_property(this, "magazineSizes", {
            pistol: aiConfig.weapons.PISTOL_MAGAZINE_SIZE,
            machinegun: aiConfig.weapons.MACHINEGUN_MAGAZINE_SIZE,
            shotgun: aiConfig.weapons.SHOTGUN_MAGAZINE_SIZE
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":25},{"name":"machinegun","type":"number","default":15},{"name":"shotgun","type":"number","default":80}] */ _define_property(this, "weaponDamage", {
            pistol: aiConfig.weapons.PISTOL_DAMAGE,
            machinegun: aiConfig.weapons.MACHINEGUN_DAMAGE,
            shotgun: aiConfig.weapons.SHOTGUN_DAMAGE
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":0.3},{"name":"machinegun","type":"number","default":0.1},{"name":"shotgun","type":"number","default":0.8}] */ _define_property(this, "fireRates", {
            pistol: aiConfig.weapons.PISTOL_FIRE_RATE,
            machinegun: aiConfig.weapons.MACHINEGUN_FIRE_RATE,
            shotgun: aiConfig.weapons.SHOTGUN_FIRE_RATE
        }) // ✅ REVERTED: These are for PLAYER - AI has separate limiting in CombatCore.mjs
        ;
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":50},{"name":"machinegun","type":"number","default":75},{"name":"shotgun","type":"number","default":15}] */ _define_property(this, "weaponRanges", {
            pistol: aiConfig.weapons.PISTOL_RANGE,
            machinegun: aiConfig.weapons.MACHINEGUN_RANGE,
            shotgun: aiConfig.weapons.SHOTGUN_RANGE
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":0.02},{"name":"machinegun","type":"number","default":0.04},{"name":"shotgun","type":"number","default":0.15}] */ _define_property(this, "weaponSpread", {
            pistol: aiConfig.weapons.PISTOL_SPREAD,
            machinegun: aiConfig.weapons.MACHINEGUN_SPREAD,
            shotgun: aiConfig.weapons.SHOTGUN_SPREAD
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"number","default":1.5},{"name":"machinegun","type":"number","default":2.5},{"name":"shotgun","type":"number","default":2.0}] */ _define_property(this, "reloadTimes", {
            pistol: aiConfig.weapons.PISTOL_RELOAD_TIME,
            machinegun: aiConfig.weapons.MACHINEGUN_RELOAD_TIME,
            shotgun: aiConfig.weapons.SHOTGUN_RELOAD_TIME
        });
        /** @attribute @type {number} @default 6 */ _define_property(this, "shotgunPellets", aiConfig.weapons.SHOTGUN_PELLETS);
        // Visual References
        /** @attribute @type {json} @schema [{"name":"pistol","type":"entity"},{"name":"machinegun","type":"entity"},{"name":"shotgun","type":"entity"}] */ _define_property(this, "weaponModels", {
            pistol: null,
            machinegun: null,
            shotgun: null
        });
        /** @attribute @type {json} @schema [{"name":"pistol","type":"entity"},{"name":"machinegun","type":"entity"},{"name":"shotgun","type":"entity"}] */ _define_property(this, "muzzleFlashEntities", {
            pistol: null,
            machinegun: null,
            shotgun: null
        });
        /** @attribute @type {boolean} @default false */ _define_property(this, "debugMode", false);
    }
}
_define_property(WeaponSystem, "scriptName", 'weaponSystem');
_define_property(WeaponSystem, "WEAPON_TYPES", [
    'pistol',
    'machinegun',
    'shotgun'
]);

export { WeaponSystem };
