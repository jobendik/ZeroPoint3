import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * PauseMenu - ESM Module Version
 * Manages pause menu functionality and button interactions
 * Integrates with ESM-based Core systems
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
 * PauseMenu Class - ESM-based Pause Menu Management
 * Internal helper class, not exported
 */ class PauseMenu {
    /**
     * Initialize pause menu
     */ initialize() {
        if (this._isInitialized) return;
        Logger.debug('[PauseMenu] Initializing ESM version...');
        // Find buttons
        this._findButtons();
        // Setup button event listeners
        this._setupButtonHandlers();
        // Listen for pause menu events
        this._setupEventListeners();
        this._isInitialized = true;
        Logger.debug('[PauseMenu] ESM version ready');
    }
    /**
     * Find button elements
     */ _findButtons() {
        this.resumeButton = this.entity.findByName('ResumeButton');
        this.quitButton = this.entity.findByName('QuitToMenuButton');
        // Log button status
        Logger.debug('[PauseMenu] Button Status:');
        Logger.debug('  Resume:', this.resumeButton ? '✓ Found' : '✗ Missing');
        Logger.debug('  Quit:', this.quitButton ? '✓ Found' : '✗ Missing');
    }
    /**
     * Setup button click handlers
     */ _setupButtonHandlers() {
        // Set up resume button
        if (this.resumeButton?.button) {
            this.resumeButton.button.off('click');
            this.resumeButton.button.on('click', this.onResumeClicked.bind(this));
            if (this.resumeButton.element) {
                this.resumeButton.element.useInput = true;
            }
        } else {
            Logger.warn('[PauseMenu] ResumeButton not found or missing Button component');
        }
        // Set up quit button
        if (this.quitButton?.button) {
            this.quitButton.button.off('click');
            this.quitButton.button.on('click', this.onQuitClicked.bind(this));
            if (this.quitButton.element) {
                this.quitButton.element.useInput = true;
            }
        } else {
            Logger.warn('[PauseMenu] QuitToMenuButton not found or missing Button component');
        }
    }
    /**
     * Setup event listeners
     */ _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Listen for pause menu events
        this.app.on('menu:showPause', this.show.bind(this));
        this.app.on('menu:hidePause', this.hide.bind(this));
        // Listen for game state changes
        this.app.on('game:paused', this.show.bind(this));
        this.app.on('game:resumed', this.hide.bind(this));
        Logger.debug('[PauseMenu] Event listeners bound');
    }
    /**
     * Show pause menu
     */ show() {
        Logger.debug('[PauseMenu] Showing pause menu');
        this.entity.enabled = true;
        if (this.entity.screen) {
            this.entity.screen.enabled = true;
        }
        // Fire event to hide HUD elements
        this.app.fire('menu:opened');
        // Show cursor for menu interaction
        this._showCursor();
    }
    /**
     * Hide pause menu
     */ hide() {
        Logger.debug('[PauseMenu] Hiding pause menu');
        console.log('[PauseMenu] hide() called - disabling entity and screen');
        this.entity.enabled = false;
        if (this.entity.screen) {
            this.entity.screen.enabled = false;
            console.log('[PauseMenu] Screen disabled');
        }
        // Fire event to show HUD elements
        this.app.fire('menu:closed');
        // ✅ DON'T call _hideCursor() here - pointer lock is handled by button click
        console.log('[PauseMenu] hide() complete');
    }
    /**
     * Show cursor for menu interaction
     */ _showCursor() {
        if (this.app.mouse) {
            this.app.mouse.disablePointerLock();
            document.body.style.cursor = 'default';
        }
    }
    /**
     * Hide cursor and enable pointer lock
     */ _hideCursor() {
        if (this.app.mouse) {
            this.app.mouse.enablePointerLock();
        }
        document.body.style.cursor = 'none';
    }
    /**
     * Handle resume button click
     */ onResumeClicked() {
        Logger.debug('[PauseMenu] Resume button clicked');
        console.log('========================================');
        console.log('[PauseMenu] 🔄 RESUME button clicked!');
        // ✅ CRITICAL: Request pointer lock HERE in the click handler
        // This has user gesture context, so it will work!
        console.log('[PauseMenu] Checking for canvas...');
        const canvas = this.app?.graphicsDevice?.canvas;
        if (canvas) {
            console.log('[PauseMenu] ✅ Canvas found:', canvas.tagName, canvas.id);
            // Mark as expected (use correct path: this.app.gameManager)
            const gameManager = this.app.gameManager;
            if (gameManager?.gameCore) {
                gameManager.gameCore._pointerLockExpected = true;
                console.log('[PauseMenu] ✅ Set _pointerLockExpected = true');
            } else {
                console.warn('[PauseMenu] ⚠️ Could not access gameCore (gameManager not ready yet)');
            }
            // Request immediately - we're in user gesture context
            console.log('[PauseMenu] Calling canvas.requestPointerLock()...');
            canvas.requestPointerLock();
            console.log('[PauseMenu] canvas.requestPointerLock() called');
            // Check result after a moment
            setTimeout(()=>{
                console.log('[PauseMenu] After 100ms - Pointer lock element:', document.pointerLockElement);
                console.log('[PauseMenu] Is locked to canvas:', document.pointerLockElement === canvas);
            }, 100);
        } else {
            console.error('[PauseMenu] ❌ Canvas not found! Cannot request pointer lock');
        }
        // Fire resume events - the 'game:resumed' listener will call hide()
        console.log('[PauseMenu] Firing resume events...');
        this.app.fire('ui:resumeClicked');
        this.app.fire('menu:resumeGame');
        this.app.fire('game:resumed');
        // ✅ DON'T call hide() here - the event listener will do it!
        console.log('[PauseMenu] Events fired - listener will hide menu');
        console.log('[PauseMenu] ========================================');
    }
    /**
     * Handle quit button click
     */ onQuitClicked() {
        Logger.debug('[PauseMenu] Quit button clicked');
        console.log('========================================');
        console.log('[PauseMenu] 🚪 QUIT button clicked!');
        // Fire quit event - GameEvents will handle state transition to MAIN_MENU
        // MAIN_MENU state will call showMainMenu() which releases pointer lock
        console.log('[PauseMenu] Firing quit events...');
        this.app.fire('menu:quitToMainMenu');
        this.app.fire('ui:quitClicked');
        console.log('[PauseMenu] Quit events fired - GameCore will handle state transition');
        console.log('[PauseMenu] ========================================');
        // Hide menu - no need to manually handle pointer lock, showMainMenu() does it
        this.hide();
    }
    /**
     * Toggle pause menu visibility
     */ toggle() {
        if (this.entity.enabled) {
            this.hide();
        } else {
            this.show();
        }
    }
    /**
     * Check if pause menu is currently visible
     */ isVisible() {
        return this.entity.enabled;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup event listeners
     */ _cleanup() {
        if (!this._eventsBound) return;
        this.app.off('menu:showPause', this.show.bind(this));
        this.app.off('menu:hidePause', this.hide.bind(this));
        this.app.off('game:paused', this.show.bind(this));
        this.app.off('game:resumed', this.hide.bind(this));
        this._eventsBound = false;
    }
    /**
     * Cleanup button handlers
     */ _cleanupButtonHandlers() {
        if (this.resumeButton?.button) {
            this.resumeButton.button.off('click', this.onResumeClicked.bind(this));
        }
        if (this.quitButton?.button) {
            this.quitButton.button.off('click', this.onQuitClicked.bind(this));
        }
    }
    /**
     * Destroy pause menu
     */ destroy() {
        if (!this._isInitialized) return;
        this._cleanup();
        this._cleanupButtonHandlers();
        this._isInitialized = false;
        Logger.debug('[PauseMenu] Cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Button references
        this.resumeButton = null;
        this.quitButton = null;
        // State
        this._isInitialized = false;
        this._eventsBound = false;
        Logger.debug('[PauseMenu] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for PauseMenu (Modern ESM Version)
 */ class PauseMenuScript extends Script {
    initialize() {
        // Create ESM instance
        this.pauseMenu = new PauseMenu(this.app, this.entity);
        this.pauseMenu.initialize();
        // Make available on entity for external access
        this.entity.pauseMenu = this.pauseMenu;
    }
    show() {
        if (this.pauseMenu) {
            this.pauseMenu.show();
        }
    }
    hide() {
        if (this.pauseMenu) {
            this.pauseMenu.hide();
        }
    }
    toggle() {
        if (this.pauseMenu) {
            this.pauseMenu.toggle();
        }
    }
    destroy() {
        if (this.pauseMenu) {
            this.pauseMenu.destroy();
            this.pauseMenu = null;
            this.entity.pauseMenu = null;
        }
    }
}
_define_property(PauseMenuScript, "scriptName", 'pauseMenu');
// Note: Empty attributes object may be needed for PlayCanvas registration
// even in ESM scripts when no @attribute decorators are present
_define_property(PauseMenuScript, "attributes", {});

export { PauseMenuScript };
