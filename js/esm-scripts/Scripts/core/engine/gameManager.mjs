import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from './logger.mjs';
import { GameCore } from './GameCore.mjs';
import { GameEvents } from './GameEvents.mjs';
import { GameLifecycle } from './GameLifecycle.mjs';
import { SoundPropagationSystem } from '../../ai/perception/SoundPropagationSystem.mjs';
import { GameModeManager } from './modes/GameModeManager.mjs';
import { TeamDeathmatchMode } from './modes/TeamDeathmatchMode.mjs';
import { aiCoordinationSystem } from '../../ai/combat/AICoordinationSystem.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: Script Facade - PlayCanvas Script facade for GameManager functionality
DOMAIN: core/engine 
DEPENDENCIES: [GameCore, GameEvents, GameLifecycle]
EXPORTS: [GameManager]
GPT_CONTEXT: PlayCanvas Script facade with individual attributes for proper editor display
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
class GameManager extends Script {
    // ============================================================================
    // INITIALIZATION - PLAYCANVAS LIFECYCLE METHODS
    // ============================================================================
    initialize() {
        // Initialize internal modules
        this.gameCore = new GameCore(this);
        this.gameEvents = new GameEvents(this);
        this.gameLifecycle = new GameLifecycle(this);
        // ✅ NEW: Initialize sound propagation system for AI awareness
        this.soundPropagation = new SoundPropagationSystem(this.app);
        this.soundPropagation.initialize();
        // ✅ NEW: Initialize game mode manager
        this.gameModeManager = new GameModeManager(this);
        // Register available game modes
        this.gameModeManager.registerMode('deathmatch', TeamDeathmatchMode);
        // Select default mode for testing
        this.gameModeManager.selectMode('deathmatch');
        // --- CONNECT UI MANAGER (works regardless of load order) ---
        const bindUI = (ui)=>{
            this.uiManager = ui;
            this.uiManager.setGameManager?.(this);
            this.gameCore?.setUIManager?.(ui);
            Logger.debug('[GameManager] ✅ Connected UIManager to GameManager/GameCore (late-safe)');
        };
        if (this.app.uiManager) {
            bindUI(this.app.uiManager);
        } else {
            this.gameCore?._getLogger?.().debug('[GameManager] No app.uiManager yet; listening for ui:ready…');
            this.app.once?.('ui:ready', bindUI);
        }
        // --- Optional: connect GameSession if present in scene ---
        const sessionEntity = this.app.root.findByName?.('GameSession');
        if (sessionEntity?.script?.gameSession) {
            this.gameSession = sessionEntity.script.gameSession;
            this.gameSession.setGameManager?.(this);
            Logger.debug('[GameManager] ✅ Connected GameSession to GameManager');
        }
        // Continue original initialization
        this._registeredAgents = this._registeredAgents || new Set();
        this._registeredItemGuids = new Set();
        this._registeredPlayer = null;
        this.items = [];
        this.agents = [];
        this.__gmBooted = false;
        this.gameLifecycle.initialize();
    }
    postInitialize() {
        // Delegate to lifecycle module
        this.gameLifecycle.postInitialize();
    }
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    _getLogger() {
        // Use imported Logger if available, otherwise fallback to console
        if (typeof Logger !== 'undefined') {
            return Logger;
        }
        return {
            debug: Logger.debug.bind(console),
            info: console.info.bind(console),
            warn: Logger.warn.bind(console),
            error: Logger.error.bind(console),
            gameState: Logger.debug.bind(console),
            aiState: Logger.debug.bind(console),
            aiDetail: Logger.debug.bind(console)
        };
    }
    // ============================================================================
    // STATE MANAGEMENT - DELEGATE TO GAMECORE
    // ============================================================================
    setState(newState, data) {
        return this.gameCore.setState(newState, data);
    }
    getState() {
        return this.gameCore.getState();
    }
    isPlaying() {
        return this.gameCore.isPlaying();
    }
    // ============================================================================
    // PUBLIC API - DELEGATE TO APPROPRIATE MODULES
    // ============================================================================
    getSettings() {
        // Construct settings object from individual attributes
        return {
            roundDuration: this.roundDuration,
            maxAgents: this.maxAgents,
            respawnTime: this.respawnTime,
            aiDifficulty: this.aiDifficulty
        };
    }
    getSpawnPoints() {
        return this.gameCore.getSpawnPoints();
    }
    getAgentTemplate() {
        return this.gameCore.getAgentTemplate();
    }
    getAllAgents() {
        return this.agents || [];
    }
    getPickupsByType(type) {
        return this.gameCore.getPickupsByType(type);
    }
    getClosestItem(position, type) {
        return this.gameCore.getClosestItem(position, type);
    }
    // ✅ FIX: Add missing getAllItems method for weapon pickup detection
    getAllItems() {
        return this.items || [];
    }
    forceAgentActivation() {
        return this.gameCore.forceAgentActivation();
    }
    // ============================================================================
    // BACKWARD COMPATIBILITY METHODS - LEGACY API SUPPORT
    // ============================================================================
    // Called by pickupSystem.js during destroy()
    unregisterItem(item) {
        return this.gameLifecycle.unregisterItem(item);
    }
    // Called by debug systems - legacy state getter
    getGameState() {
        return this.gameCore.getGameState();
    }
    // Called by debug systems - legacy state setter
    setGameState(newState) {
        return this.gameCore.setGameState(newState);
    }
    // ============================================================================
    // DEBUG METHODS - DELEGATE TO APPROPRIATE MODULES
    // ============================================================================
    debugState() {
        return this.gameCore.debugState();
    }
    debugAgents() {
        return this.gameLifecycle.debugAgents();
    }
    debugItemSystem() {
        return this.gameLifecycle.debugItemSystem();
    }
    refreshItemSystem() {
        return this.gameLifecycle.refreshItemSystem();
    }
    // ============================================================================
    // UPDATE LOOP - DELEGATE TO GAMECORE
    // ============================================================================
    update(dt) {
        this.gameCore.update(dt);
        // 🤖 NEW: Update AI Coordination System for squad tactics
        try {
            aiCoordinationSystem.update(dt);
        } catch (error) {
        // Silent fail - coordination is optional enhancement
        }
    }
    // ============================================================================
    // CLEANUP - DELEGATE TO ALL MODULES
    // ============================================================================
    destroy() {
        const Logger = this._getLogger();
        Logger.debug('[GameManager] Destroying...');
        // Clean up all modules
        if (this.gameEvents) {
            this.gameEvents.cleanupEvents();
        }
        if (this.gameLifecycle) {
            this.gameLifecycle.destroy();
        }
        // Clear module references
        this.gameCore = null;
        this.gameEvents = null;
        this.gameLifecycle = null;
    }
    // ============================================================================
    // PROPERTY GETTERS FOR BACKWARD COMPATIBILITY
    // ============================================================================
    get currentState() {
        return this.gameCore ? this.gameCore.currentState : null;
    }
    set currentState(value) {
        if (this.gameCore) {
            this.gameCore.currentState = value;
        }
    }
    get previousState() {
        return this.gameCore ? this.gameCore.previousState : null;
    }
    set previousState(value) {
        if (this.gameCore) {
            this.gameCore.previousState = value;
        }
    }
    get isTransitioning() {
        return this.gameCore ? this.gameCore.isTransitioning : false;
    }
    set isTransitioning(value) {
        if (this.gameCore) {
            this.gameCore.isTransitioning = value;
        }
    }
    get hasEverStartedPlaying() {
        return this.gameCore ? this.gameCore.hasEverStartedPlaying : false;
    }
    set hasEverStartedPlaying(value) {
        if (this.gameCore) {
            this.gameCore.hasEverStartedPlaying = value;
        }
    }
    get sessionEndingManually() {
        return this.gameCore ? this.gameCore.sessionEndingManually : false;
    }
    set sessionEndingManually(value) {
        if (this.gameCore) {
            this.gameCore.sessionEndingManually = value;
        }
    }
    get lastSessionEndTime() {
        return this.gameCore ? this.gameCore.lastSessionEndTime : 0;
    }
    set lastSessionEndTime(value) {
        if (this.gameCore) {
            this.gameCore.lastSessionEndTime = value;
        }
    }
    get sessionEndCooldown() {
        return this.gameCore ? this.gameCore.sessionEndCooldown : 1000;
    }
    set sessionEndCooldown(value) {
        if (this.gameCore) {
            this.gameCore.sessionEndCooldown = value;
        }
    }
    get isRematchInProgress() {
        return this.gameCore ? this.gameCore.isRematchInProgress : false;
    }
    set isRematchInProgress(value) {
        if (this.gameCore) {
            this.gameCore.isRematchInProgress = value;
        }
    }
    get itemScanComplete() {
        return this.gameLifecycle ? this.gameLifecycle.itemScanComplete : false;
    }
    set itemScanComplete(value) {
        if (this.gameLifecycle) {
            this.gameLifecycle.itemScanComplete = value;
        }
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES - INDIVIDUAL ATTRIBUTES FOR EDITOR DISPLAY
        // ============================================================================
        /** @attribute @type {number} @title Round Duration (seconds) */ _define_property(this, "roundDuration", 300);
        /** @attribute @type {number} @title Max AI Agents */ _define_property(this, "maxAgents", 1);
        /** @attribute @type {number} @title Respawn Time (seconds) */ _define_property(this, "respawnTime", 3);
        /** @attribute @type {number} @min 0.1 @max 1.0 @title AI Difficulty */ _define_property(this, "aiDifficulty", 0.7);
        /** @attribute @type {pc.Entity[]} @title Spawn Points */ _define_property(this, "spawnPoints", []);
        /** @attribute @type {pc.Asset} @assetType {template} @title AI Agent Template */ _define_property(this, "aiAgentTemplate", null);
        /** @attribute @type {pc.Entity} @title Game World Entity */ _define_property(this, "gameWorld", null);
    }
}
_define_property(GameManager, "scriptName", 'gameManager');
// ============================================================================
// GAME STATES - EXPOSED FOR BACKWARD COMPATIBILITY
// ============================================================================
_define_property(GameManager, "STATES", GameCore.STATES);

export { GameManager };
