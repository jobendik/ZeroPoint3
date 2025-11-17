import { Script } from '../../../../playcanvas-stable.min.mjs';
import { UICore } from './UICore.mjs';
import { UIComponents } from './UIComponents.mjs';
import { UIEvents } from './UIEvents.mjs';
import { CountdownOverlay } from '../components/CountdownOverlay.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';
import { PerformanceHUD } from '../components/PerformanceHUD.mjs';
import { PostMatchScreen } from '../screens/PostMatchScreen.mjs';
import { DeathEffects } from '../components/DeathEffects.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: FACADE_SCRIPT - PlayCanvas Script facade for modular UI management system
DOMAIN: UI
DEPENDENCIES: ['./UICore.mjs', './UIComponents.mjs', './UIEvents.mjs', '../../core/engine/logger.mjs']
EXPORTS: ['UIManagerScript']
GPT_CONTEXT: PlayCanvas Script facade that coordinates UICore, UIComponents, and UIEvents modules while maintaining exact API compatibility
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
/**
 * UIManager - Refactored modular UI management
 * Coordinates UICore, UIComponents, and UIEvents modules
 */ class UIManager {
    /**
     * Initialize UI Manager with all modules
     */ initialize(config = {}) {
        if (this.core.isInitialized()) {
            Logger.debug('[UIManager] Already initialized, skipping');
            return;
        }
        Logger.info('[UIManager] 🎮 Initializing modular version...');
        // Initialize core module
        this.core.initialize(config);
        // Cache UI elements in components module
        Logger.info('[UIManager] 📦 Caching UI elements...');
        this.components.cacheUIElements(this.core.uiScreens);
        Logger.info('[UIManager] ✅ UI elements cached');
        // Setup event handlers
        this.events.setupEventHandlers(this.core.uiScreens, this.core);
        // Initialize progression UI components
        this._initializeProgressionUI();
        Logger.info('[UIManager] ✅ Modular version ready');
    }
    /**
     * Initialize progression UI components (PerformanceHUD and PostMatchScreen)
     */ _initializeProgressionUI() {
        Logger.info('[UIManager] 📊 Initializing progression UI components...');
        // Initialize PerformanceHUD if gameHUD is available
        if (this.core.uiScreens.gameHUD) {
            this.performanceHUD = new PerformanceHUD(this.app, this.core.uiScreens.gameHUD);
            this.performanceHUD.initialize();
            Logger.info('[UIManager] ✅ PerformanceHUD initialized');
        } else {
            Logger.warn('[UIManager] ⚠️ gameHUD not found, PerformanceHUD not initialized');
        }
        // Initialize PostMatchScreen if roundSummaryScreen is available
        if (this.core.uiScreens.roundSummaryScreen) {
            this.postMatchScreen = new PostMatchScreen(this.app, this.core.uiScreens.roundSummaryScreen);
            this.postMatchScreen.initialize();
            Logger.info('[UIManager] ✅ PostMatchScreen initialized');
        } else {
            Logger.warn('[UIManager] ⚠️ roundSummaryScreen not found, PostMatchScreen not initialized');
        }
    }
    /**
     * Set game manager reference
     */ setGameManager(gameManager) {
        this.core.setGameManager(gameManager);
        Logger.debug('[UIManager] Game manager reference set');
    }
    // ============================================================================
    // SCREEN MANAGEMENT (Delegated to UICore)
    // ============================================================================
    /**
     * Show main menu
     */ showMainMenu() {
        this.core.showMainMenu();
    }
    /**
     * Show game HUD
     */ showGameHUD() {
        this.core.showGameHUD();
        this.components.resetHUD();
    }
    /**
     * Show round summary
     */ showRoundSummary(stats) {
        Logger.debug('[UIManager] Showing round summary with stats:', stats);
        // Log the stats structure for debugging
        if (stats) {
            Logger.debug('[UIManager] Stats structure:', {
                kills: stats.kills,
                deaths: stats.deaths,
                accuracy: stats.accuracy,
                duration: stats.duration,
                damageDealt: stats.damageDealt
            });
        } else {
            Logger.warn('[UIManager] No stats provided to showRoundSummary!');
        }
        this.core.showRoundSummary();
        if (stats) {
            this.components.updateSummaryStats(stats);
            // Also fire event for RoundSummaryLogic to handle
            this.app.fire('summary:show', stats);
        } else {
            // Fire event without stats
            this.app.fire('summary:show', null);
        }
    }
    /**
     * Show pause menu
     */ showPauseMenu() {
        this.core.showPauseMenu();
    }
    /**
     * Hide pause menu
     */ hidePauseMenu() {
        this.core.hidePauseMenu();
    }
    /**
     * Toggle pause menu
     */ togglePauseMenu() {
        this.core.togglePauseMenu();
    }
    /**
     * Get pause state
     */ get isPaused() {
        return this.core.isPausedState();
    }
    // ============================================================================
    // HUD UPDATES (Delegated to UIComponents)
    // ============================================================================
    /**
     * Update timer display
     */ updateTimer(timeRemaining) {
        this.components.updateTimer(timeRemaining);
    }
    /**
     * Update health display
     */ updateHealth(current, max) {
        this.components.updateHealth(current, max);
    }
    /**
     * Update ammo display
     */ updateAmmo(current, total) {
        this.components.updateAmmo(current, total);
    }
    /**
     * Show countdown with dramatic animated overlay
     */ showCountdown(count) {
        // Use new impressive countdown overlay
        // ✅ Subtract 1 so 4 seconds shows as "3-2-1-GO" instead of "4-3-2-1"
        const displayCount = Math.max(0, count - 1);
        Logger.info(`[UIManager] 🎬 Showing dramatic countdown: ${displayCount} (timer: ${count})`);
        // Start the full animated countdown sequence
        if (typeof displayCount === 'number' && displayCount >= 0) {
            this.countdownOverlay.startCountdown(displayCount, ()=>{
                Logger.info('[UIManager] Countdown complete - ready to play!');
            });
        }
    }
    /**
     * Hide countdown
     */ hideCountdown() {
        Logger.debug('[UIManager] Hiding countdown');
        this.countdownOverlay.cancel();
    }
    /**
     * Show damage vignette effect - delegates to player's existing vignette system
     */ showDamageVignette(intensity = aiConfig.ui.DAMAGE_VIGNETTE_INTENSITY_DEFAULT, duration = aiConfig.ui.DAMAGE_VIGNETTE_DURATION_DEFAULT) {
        // 1) Try controller on the editor entity
        const hud = this.core.uiScreens.gameHUD;
        const dv = hud?.findByName('DamageVignette');
        const img = dv?.findByName('Image');
        const ctrl = dv?.script?.damageVignetteController || img?.script?.damageVignetteController;
        if (ctrl && typeof ctrl.flash === 'function') {
            ctrl.flash(intensity, duration);
            return;
        }
        // 2) Fall back to event the controller listens for
        this.app.fire('ui:damageVignette', {
            intensity,
            duration
        });
    }
    /**
     * Hide damage vignette immediately - delegates to player
     */ hideDamageVignette() {
        const player = this._findPlayer();
        if (player && player.damageVignette) {
            player.damageVignetteActive = false;
            if (player.damageVignette.enabled) {
                player.damageVignette.enabled = false;
            }
            Logger.debug('[UIManager] Damage vignette hidden via player');
        }
    }
    /**
     * Find the player entity/script
     */ _findPlayer() {
        // Try app.gameManager.player first (most reliable)
        if (this.app.gameManager && this.app.gameManager.player) {
            return this.app.gameManager.player;
        }
        // Try finding by tag
        const playerEntity = this.app.root.findByTag('player')[0];
        if (playerEntity && playerEntity.script && playerEntity.script.player) {
            return playerEntity.script.player;
        }
        // Try finding by name
        const playerByName = this.app.root.findByName('Player');
        if (playerByName && playerByName.script && playerByName.script.player) {
            return playerByName.script.player;
        }
        return null;
    }
    // ============================================================================
    // EVENT MANAGEMENT (Delegated to UIEvents)
    // ============================================================================
    /**
     * Fire UI event
     */ fireUIEvent(eventName, data = null) {
        this.events.fireUIEvent(eventName, data);
    }
    /**
     * Listen to UI event
     */ listenToUIEvent(eventName, callback) {
        this.events.listenToUIEvent(eventName, callback);
    }
    /**
     * Remove UI event listener
     */ removeUIEventListener(eventName, callback) {
        this.events.removeUIEventListener(eventName, callback);
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Destroy UI manager and all modules
     */ destroy() {
        if (!this.core.isInitialized()) return;
        // Cleanup progression UI components
        if (this.performanceHUD) {
            this.performanceHUD.destroy();
            this.performanceHUD = null;
        }
        if (this.postMatchScreen) {
            this.postMatchScreen.destroy();
            this.postMatchScreen = null;
        }
        this.events.destroy(this.core.uiScreens);
        this.components.destroy();
        this.core.destroy();
        Logger.debug('[UIManager] Modular system cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Initialize internal modules
        this.core = new UICore(app, entity);
        this.components = new UIComponents(app, entity);
        this.events = new UIEvents(app, entity);
        this.countdownOverlay = new CountdownOverlay(app);
        // Initialize progression UI components
        this.performanceHUD = null; // Will be initialized when gameHUD is available
        this.postMatchScreen = null; // Will be initialized when roundSummaryScreen is available
        // ✅ Initialize death effects system
        this.deathEffects = new DeathEffects(this);
        Logger.debug('[UIManager] Modular instance created with countdown overlay, progression UI, and death effects');
    }
}
/**
 * PlayCanvas Script Adapter for UIManager (Modular ESM Version)
 * Maintains exact compatibility with original API
 */ class UIManagerScript extends Script {
    initialize() {
        this.uiManager = new UIManager(this.app, this.entity);
        const uiScreens = {
            mainMenuScreen: this.mainMenuScreen,
            pauseMenuScreen: this.pauseMenuScreen,
            roundSummaryScreen: this.roundSummaryScreen,
            gameHUD: this.gameHUD
        };
        const cameras = {
            menuCamera: this.menuCamera,
            playerCamera: this.playerCamera
        };
        this.uiManager.initialize({
            uiScreens,
            cameras
        });
        // ✅ Ensure HUD and Crosshair are initialized at startup
        if (this.gameHUD?.script?.gameHUD) {
            this.gameHUD.script.gameHUD.initialize();
        }
        const crosshairEntity = this.app.root.findByName('DynamicCrosshair');
        if (crosshairEntity?.script?.dynamicCrosshair) {
            crosshairEntity.script.dynamicCrosshair.initialize();
        }
        this.app.uiManager = this.uiManager;
        // 🔴 ADD THIS: notify late listeners (e.g., GameManager) that UI is ready
        this.app.fire('ui:ready', this.uiManager);
        Logger.ui('[UIManagerScript] ✅ UIManager initialized and HUD connected');
    }
    setGameManager(gameManager) {
        if (this.uiManager) {
            this.uiManager.setGameManager(gameManager);
        }
    }
    // Delegate all public methods to internal uiManager instance
    showMainMenu() {
        return this.uiManager?.showMainMenu();
    }
    showGameHUD() {
        return this.uiManager?.showGameHUD();
    }
    showRoundSummary(stats) {
        return this.uiManager?.showRoundSummary(stats);
    }
    showPauseMenu() {
        return this.uiManager?.showPauseMenu();
    }
    hidePauseMenu() {
        return this.uiManager?.hidePauseMenu();
    }
    togglePauseMenu() {
        return this.uiManager?.togglePauseMenu();
    }
    get isPaused() {
        return this.uiManager?.isPaused || false;
    }
    updateTimer(timeRemaining) {
        return this.uiManager?.updateTimer(timeRemaining);
    }
    updateHealth(current, max) {
        return this.uiManager?.updateHealth(current, max);
    }
    updateAmmo(current, total) {
        return this.uiManager?.updateAmmo(current, total);
    }
    showCountdown(count) {
        return this.uiManager?.showCountdown(count);
    }
    hideCountdown() {
        return this.uiManager?.hideCountdown();
    }
    showDamageVignette(intensity, duration) {
        return this.uiManager?.showDamageVignette(intensity, duration);
    }
    hideDamageVignette() {
        return this.uiManager?.hideDamageVignette();
    }
    // ═══════════════════════════════════════════════════════════════════
    // DEATH EFFECTS API (Cinematic Death Experience)
    // ═══════════════════════════════════════════════════════════════════
    showDeathImpact() {
        return this.uiManager?.deathEffects?.showImpact();
    }
    showDeathCamera() {
        return this.uiManager?.deathEffects?.showDeathCamera();
    }
    showDeathStats(deathInfo) {
        return this.uiManager?.deathEffects?.showStats(deathInfo);
    }
    showRespawnCountdown() {
        return this.uiManager?.deathEffects?.showCountdown();
    }
    showRespawnFlash() {
        return this.uiManager?.deathEffects?.showRespawnFlash();
    }
    hideDeathEffects() {
        return this.uiManager?.deathEffects?.hideAll();
    }
    // ═══════════════════════════════════════════════════════════════════
    fireUIEvent(eventName, data) {
        return this.uiManager?.fireUIEvent(eventName, data);
    }
    listenToUIEvent(eventName, callback) {
        return this.uiManager?.listenToUIEvent(eventName, callback);
    }
    removeUIEventListener(eventName, callback) {
        return this.uiManager?.removeUIEventListener(eventName, callback);
    }
    swap(old) {
        // Hot-reload support - transfer state from old instance
        if (old.uiManager) {
            this.uiManager = old.uiManager;
            this.app.uiManager = this.uiManager;
            Logger.debug('[UIManagerScript] Hot-reload: state transferred');
        }
    }
    destroy() {
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }
        if (this.app.uiManager === this.uiManager) {
            this.app.uiManager = null;
        }
        Logger.debug('[UIManagerScript] PlayCanvas Script facade destroyed');
    }
    constructor(...args){
        super(...args);
        // UI Screen References
        /** @attribute @type {pc.Entity} @title Main Menu Screen */ _define_property(this, "mainMenuScreen", null);
        /** @attribute @type {pc.Entity} @title Pause Menu Screen */ _define_property(this, "pauseMenuScreen", null);
        /** @attribute @type {pc.Entity} @title Round Summary Screen */ _define_property(this, "roundSummaryScreen", null);
        /** @attribute @type {pc.Entity} @title Game HUD */ _define_property(this, "gameHUD", null);
        // Camera References
        /** @attribute @type {pc.Entity} @title Menu Camera */ _define_property(this, "menuCamera", null);
        /** @attribute @type {pc.Entity} @title Player Camera */ _define_property(this, "playerCamera", null);
    }
}
_define_property(UIManagerScript, "scriptName", 'uiManager');

export { UIManagerScript, UIManagerScript as default };
