import { createAgentCore } from '../utils/agent-core.mjs';
import { initializeSystems, waitForSystems } from '../utils/agent-systems.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AgentCore {
    /**
     * Initialize core agent systems
     */ initialize() {
        if (this._initialized) {
            Logger.debug(`[${this.entity.name}] AgentCore already initialized`);
            return;
        }
        const name = this.entity.name;
        Logger.debug(`[${name}] AgentCore initialize() starting...`);
        // Initialize core (YUKA vehicle, regulators, etc.)
        this.core = createAgentCore(this.agentScript);
        Logger.debug(`[${name}] Core created with vehicle and regulators`);
        // Navigation will be attached by AgentNavigationAdapter
        this.navigation = null;
        this._initialized = true;
        // Wait for navigation before proceeding
        this._waitForNavigation();
    }
    /**
     * Wait for navigation system to be ready
     */ _waitForNavigation() {
        const name = this.entity.name;
        // Check if navigation adapter is already ready (timing issue fix)
        const aiAgent = this.agentScript;
        if (aiAgent.navigationReady === true) {
            Logger.debug(`[${name}] Navigation adapter already ready, proceeding immediately`);
            this._initializeSystems();
            return;
        }
        const checkNav = ()=>{
            const nav = this.app.navigation?.services?.nav;
            if (nav?.ready) {
                this._onNavigationReady();
            } else {
                this.app.once('navigation:ready', ()=>this._onNavigationReady(), this);
            }
        };
        checkNav();
    }
    /**
     * Handle navigation ready state
     */ _onNavigationReady() {
        const name = this.entity.name;
        Logger.debug(`[${name}] Navigation ready, waiting for AgentNavigationAdapter...`);
        // Check if adapter is already ready before setting up listener
        const aiAgent = this.agentScript;
        if (aiAgent.navigationReady === true) {
            Logger.debug(`[${name}] Navigation adapter already ready, proceeding immediately`);
            this._initializeSystems();
            return;
        }
        // Set up listener for navigation adapter
        this.entity.once('agent:navigation:ready', ()=>{
            Logger.debug(`[${name}] Navigation adapter ready`);
            this._initializeSystems();
        });
        // Fallback timeout in case event is missed (should rarely trigger now)
        setTimeout(()=>{
            if (aiAgent.navigationReady === true && !this._systemsReady) {
                Logger.debug(`[${name}] Navigation adapter ready via timeout check - recovering`);
                this._initializeSystems();
            }
        }, 500);
    }
    /**
     * Initialize weapon and health systems
     */ _initializeSystems() {
        // Prevent duplicate calls
        if (this._systemsInitializing) {
            Logger.debug(`[${this.entity.name}] Systems already initializing - skipping duplicate call`);
            return;
        }
        this._systemsInitializing = true;
        const name = this.entity.name;
        Logger.debug(`[${name}] Initializing core systems...`);
        // ✅ CRITICAL: Initialize weapon and health systems with COMPLETE initialization
        const systems = initializeSystems(this.agentScript);
        // ✅ Cache system references immediately (even if not fully ready yet)
        this.weaponSystem = systems.weapon;
        this.healthSystem = systems.health;
        // Log initial system status
        this._logSystemStatus('initial');
        // Wait for systems to be ready
        waitForSystems(this.agentScript, systems, ()=>{
            this._onSystemsReady();
        });
    }
    /**
     * Handle systems ready state
     */ _onSystemsReady() {
        this._systemsReady = true;
        const name = this.entity.name;
        Logger.info(`[${name}] AgentCore systems ready!`);
        // ✅ CRITICAL: Re-cache system references to ensure they're current
        // (they may have been modified during initialization)
        if (this.entity.script) {
            if (this.entity.script.weaponSystem) {
                this.weaponSystem = this.entity.script.weaponSystem;
            }
            if (this.entity.script.healthSystem) {
                this.healthSystem = this.entity.script.healthSystem;
            }
        }
        // Log final system status
        this._logSystemStatus('ready');
        // Fire ready events
        this.entity.fire('ai:agent:core:ready', this);
        // Call completion callback if set
        if (this._onInitCompleteCallback) {
            this._onInitCompleteCallback();
        }
    }
    /**
     * ✅ NEW: Log system status for debugging
     */ _logSystemStatus(stage) {
        const name = this.entity.name;
        Logger.info(`[${name}] 🔍 System Status (${stage}):`);
        // Weapon system
        if (this.weaponSystem) {
            const ws = this.weaponSystem;
            const initialized = ws._initialized === true;
            const booted = ws.__wsBooted === true;
            const hasWeapons = ws.weapons && Object.keys(ws.weapons).length > 0;
            const currentWeapon = ws.currentWeapon || 'none';
            Logger.info(`[${name}]   Weapon System:`);
            Logger.info(`[${name}]     - Exists: ✅`);
            Logger.info(`[${name}]     - Initialized: ${initialized ? '✅' : '❌'}`);
            Logger.info(`[${name}]     - Booted: ${booted ? '✅' : '❌'}`);
            Logger.info(`[${name}]     - Has Weapons: ${hasWeapons ? '✅' : '❌'}`);
            Logger.info(`[${name}]     - Current Weapon: ${currentWeapon}`);
            if (hasWeapons && ws.weapons[currentWeapon]) {
                const weapon = ws.weapons[currentWeapon];
                const unlocked = weapon.unlocked === true;
                const totalAmmo = (weapon.ammo || 0) + (ws.currentMagazine || 0);
                Logger.info(`[${name}]     - Weapon Unlocked: ${unlocked ? '✅' : '❌'}`);
                Logger.info(`[${name}]     - Total Ammo: ${totalAmmo}`);
            }
        } else {
            Logger.warn(`[${name}]   Weapon System: ❌ NOT FOUND`);
        }
        // Health system
        if (this.healthSystem) {
            Logger.info(`[${name}]   Health System: ✅`);
        } else {
            Logger.info(`[${name}]   Health System: ⚠️ Not found (using fallback)`);
        }
        // Navigation
        if (this.navigation) {
            Logger.info(`[${name}]   Navigation: ✅`);
        } else if (this.agentScript.navigationReady) {
            Logger.info(`[${name}]   Navigation: ✅ (via adapter)`);
        } else {
            Logger.warn(`[${name}]   Navigation: ⚠️ Not ready`);
        }
    }
    /**
     * Set callback for initialization completion
     */ onInitComplete(callback) {
        this._onInitCompleteCallback = callback;
        // If already ready, call immediately
        if (this._systemsReady) {
            callback();
        }
    }
    /**
     * Sync YUKA vehicle position to PlayCanvas entity
     */ syncToPlayCanvas() {
        if (!this.core) return;
        this.core.syncToPlayCanvas();
    }
    /**
     * Get current frame counter
     */ getFrameCounter() {
        return this._frameCounter;
    }
    /**
     * Increment frame counter
     */ incrementFrame() {
        this._frameCounter++;
    }
    /**
     * Check if core is initialized
     */ isInitialized() {
        return this._initialized;
    }
    /**
     * Check if systems are ready
     */ areSystemsReady() {
        return this._systemsReady;
    }
    /**
     * Get YUKA vehicle reference
     */ getVehicle() {
        return this.core?.vehicle;
    }
    /**
     * Get regulators reference
     */ getRegulators() {
        return this.core?.regulators;
    }
    /**
     * ✅ NEW: Get weapon system with validation
     */ getWeaponSystem() {
        // Try cached reference first
        if (this.weaponSystem) {
            return this.weaponSystem;
        }
        // Try to get from entity.script as fallback
        if (this.entity.script?.weaponSystem) {
            this.weaponSystem = this.entity.script.weaponSystem;
            return this.weaponSystem;
        }
        return null;
    }
    /**
     * ✅ NEW: Validate weapon system is ready for combat
     */ isWeaponSystemReady() {
        const ws = this.getWeaponSystem();
        if (!ws) return false;
        // Must be initialized AND booted
        if (!ws._initialized || !ws.__wsBooted) return false;
        // Must have weapons
        if (!ws.weapons || Object.keys(ws.weapons).length === 0) return false;
        // Must have at least one unlocked weapon
        const hasUnlockedWeapon = Object.keys(ws.weapons).some((key)=>ws.weapons[key] && ws.weapons[key].unlocked === true);
        return hasUnlockedWeapon;
    }
    /**
     * Clean up core systems
     */ destroy() {
        const name = this.entity.name;
        Logger.debug(`[${name}] AgentCore destroy() called`);
        // Clean up core
        if (this.core) {
            this.core.destroy();
            this.core = null;
        }
        // Clear references
        this.weaponSystem = null;
        this.healthSystem = null;
        this.navigation = null;
        this._onInitCompleteCallback = null;
        this._initialized = false;
        this._systemsReady = false;
        this._systemsInitializing = false;
        Logger.debug(`[${name}] AgentCore destroyed`);
    }
    constructor(agentScript){
        this.agentScript = agentScript;
        this.entity = agentScript.entity;
        this.app = agentScript.app;
        // Core state flags
        this._eventsBound = false;
        this._frameCounter = 0;
        this._initialized = false;
        this._systemsReady = false;
        this._systemsInitializing = false;
        // Core YUKA integration
        this.core = null;
        // System references
        this.weaponSystem = null;
        this.healthSystem = null;
        this.navigation = null;
        // Callbacks
        this._onInitCompleteCallback = null;
        Logger.debug(`[${this.entity.name}] AgentCore created`);
    }
}

export { AgentCore };
