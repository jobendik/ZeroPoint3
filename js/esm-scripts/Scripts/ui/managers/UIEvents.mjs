import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * UIEvents - UI event handling and user interactions
 * Handles button handlers, keyboard events, and UI event management
 */ class UIEvents {
    /**
     * Setup all UI event handlers
     */ setupEventHandlers(uiScreens, uiCore) {
        this._setupButtonHandlers(uiScreens, uiCore);
        this._setupKeyboardListeners(uiCore);
        Logger.debug('[UIEvents] All event handlers setup complete');
    }
    /**
     * Setup button handlers for all UI screens
     */ _setupButtonHandlers(uiScreens, uiCore) {
        if (this._buttonHandlersSetup) return;
        this._buttonHandlersSetup = true;
        // Main Menu Play Button
        this._setupPlayButton(uiScreens.mainMenuScreen);
        // Pause Menu Buttons
        this._setupPauseMenuButtons(uiScreens.pauseMenuScreen, uiCore);
        // Round Summary Buttons
        this._setupSummaryButtons(uiScreens.roundSummaryScreen);
        Logger.debug('[UIEvents] Button handlers setup complete');
    }
    /**
     * Setup play button event handler
     */ _setupPlayButton(mainMenuScreen) {
        const playButton = mainMenuScreen?.findByName('PlayButton');
        if (playButton?.button) {
            playButton.button.off('click');
            playButton.button.on('click', ()=>{
                Logger.debug('[UIEvents] Play button clicked');
                this.app.fire('ui:playClicked');
            });
        }
    }
    /**
     * Setup pause menu button event handlers
     */ _setupPauseMenuButtons(pauseMenuScreen, uiCore) {
        if (!pauseMenuScreen) return;
        const resumeButton = pauseMenuScreen.findByName('ResumeButton');
        const quitButton = pauseMenuScreen.findByName('QuitToMenuButton');
        if (resumeButton?.button) {
            resumeButton.button.off('click');
            resumeButton.button.on('click', ()=>{
                Logger.debug('[UIEvents] Resume button clicked');
                // Fire resume event for GameEvents to handle
                this.app.fire('ui:resumeClicked');
                uiCore.hidePauseMenu();
            });
        }
        if (quitButton?.button) {
            quitButton.button.off('click');
            quitButton.button.on('click', ()=>{
                Logger.debug('[UIEvents] Quit button clicked');
                uiCore.hidePauseMenu();
                this.app.fire('ui:quitClicked');
            });
        }
    }
    /**
     * Setup round summary button event handlers
     */ _setupSummaryButtons(roundSummaryScreen) {
        if (!roundSummaryScreen) return;
        // Try both possible button names
        const rematchButton = roundSummaryScreen.findByName('RematchButton') || roundSummaryScreen.findByName('RestartButton');
        const quitButton = roundSummaryScreen.findByName('QuitToMenuButton');
        if (rematchButton?.button) {
            rematchButton.button.off('click');
            rematchButton.button.on('click', ()=>{
                Logger.debug('[UIEvents] Rematch button clicked');
                this.app.fire('ui:rematchClicked');
            });
            Logger.debug(`[UIEvents] Rematch button (${rematchButton.name}) handler attached`);
        } else {
            Logger.warn('[UIEvents] Rematch button not found or missing button component');
        }
        if (quitButton?.button) {
            quitButton.button.off('click');
            quitButton.button.on('click', ()=>{
                Logger.debug('[UIEvents] Summary quit button clicked');
                this.app.fire('ui:quitClicked');
            });
            Logger.debug('[UIEvents] Summary quit button handler attached');
        } else {
            Logger.warn('[UIEvents] Summary quit button not found or missing button component');
        }
    }
    /**
     * Setup keyboard event listeners
     * ✅ REMOVED: Keyboard listeners no longer needed - ESC key handling moved to GameCore.mjs
     * This prevents duplicate handlers that caused the "3 presses needed" bug
     */ _setupKeyboardListeners(uiCore) {
        if (this._keyboardListenerSetup) return;
        this._keyboardListenerSetup = true;
        // Store reference to UI core for potential future use
        this.uiCore = uiCore;
        Logger.debug('[UIEvents] Keyboard listeners setup (currently disabled - handled by GameCore)');
    }
    /**
     * Handle key down events
     * ✅ REMOVED: ESC key handling moved to GameCore.mjs to prevent duplicate handlers
     * GameCore already handles ESC key with proper debouncing in its update loop
     */ _onKeyDown(event) {
    // Intentionally empty - ESC key handled by GameCore.mjs
    }
    // ============================================================================
    // EVENT UTILITIES
    // ============================================================================
    /**
     * Fire UI event with data
     */ fireUIEvent(eventName, data = null) {
        this.app.fire(eventName, data);
        Logger.debug(`[UIEvents] Fired event: ${eventName}`);
    }
    /**
     * Listen to UI event
     */ listenToUIEvent(eventName, callback) {
        this.app.on(eventName, callback);
        Logger.debug(`[UIEvents] Listening to event: ${eventName}`);
    }
    /**
     * Remove UI event listener
     */ removeUIEventListener(eventName, callback) {
        this.app.off(eventName, callback);
        Logger.debug(`[UIEvents] Removed listener for event: ${eventName}`);
    }
    /**
     * Setup button click handler with cleanup
     */ setupButtonHandler(button, clickHandler) {
        if (button?.button) {
            button.button.off('click');
            button.button.on('click', clickHandler);
        }
    }
    /**
     * Remove button click handler
     */ removeButtonHandler(button) {
        if (button?.button) {
            button.button.off('click');
        }
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup button handlers
     */ cleanupButtonHandlers(uiScreens) {
        if (!this._buttonHandlersSetup) return;
        const allButtons = [
            uiScreens.mainMenuScreen?.findByName('PlayButton'),
            uiScreens.pauseMenuScreen?.findByName('ResumeButton'),
            uiScreens.pauseMenuScreen?.findByName('QuitToMenuButton'),
            uiScreens.roundSummaryScreen?.findByName('RestartButton'),
            uiScreens.roundSummaryScreen?.findByName('QuitToMenuButton')
        ];
        allButtons.forEach((button)=>{
            if (button?.button) {
                button.button.off('click');
            }
        });
        this._buttonHandlersSetup = false;
        Logger.debug('[UIEvents] Button handlers cleaned up');
    }
    /**
     * Cleanup keyboard listeners
     * ✅ UPDATED: No longer cleaning up keyboard listeners since we don't set them up
     */ cleanupKeyboardListeners() {
        if (this._keyboardListenerSetup) {
            // No actual listener to remove since we don't attach one anymore
            this._keyboardListenerSetup = false;
        }
        Logger.debug('[UIEvents] Keyboard listeners cleaned up (no-op - handled by GameCore)');
    }
    /**
     * Destroy UI events manager
     */ destroy(uiScreens) {
        this.cleanupButtonHandlers(uiScreens);
        this.cleanupKeyboardListeners();
        this.uiCore = null;
        Logger.debug('[UIEvents] Events cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Event management state
        this._buttonHandlersSetup = false;
        this._keyboardListenerSetup = false;
        // Store bound methods for cleanup
        this._boundKeyDownHandler = this._onKeyDown.bind(this);
        Logger.debug('[UIEvents] Events instance created');
    }
}

export { UIEvents };
