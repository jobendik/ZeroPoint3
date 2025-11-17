import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * UICore - Core UI state management and screen coordination
 * Handles UI initialization, screen management, camera control, and cursor management
 */ class UICore {
    /**
     * Initialize UI core
     */ initialize(config = {}) {
        if (this._isInitialized) return;
        Logger.debug('[UICore] Initializing UI core...');
        // Set configuration if provided
        if (config.uiScreens) {
            Object.assign(this.uiScreens, config.uiScreens);
        }
        if (config.cameras) {
            Object.assign(this.cameras, config.cameras);
        }
        this._isInitialized = true;
        Logger.debug('[UICore] UI core ready');
    }
    /**
     * Set game manager reference
     */ setGameManager(gameManager) {
        this.gameManager = gameManager;
        Logger.debug('[UICore] Game manager reference set');
    }
    /**
     * Check if UI is initialized
     */ isInitialized() {
        return this._isInitialized;
    }
    /**
     * Get pause state
     */ isPausedState() {
        return this.isPaused;
    }
    // ============================================================================
    // SCREEN MANAGEMENT
    // ============================================================================
    /**
     * Hide all UI screens
     */ hideAllScreens() {
        Object.values(this.uiScreens).forEach((screen)=>{
            if (screen) screen.enabled = false;
        });
        Logger.debug('[UICore] All screens hidden');
    }
    /**
     * Show main menu
     */ showMainMenu() {
        Logger.debug('[UICore] Showing main menu');
        this.hideAllScreens();
        if (this.uiScreens.mainMenuScreen) {
            this.uiScreens.mainMenuScreen.enabled = true;
        }
        // Fire event to hide HUD elements when main menu shows
        this.app.fire('menu:opened');
        this.enableMenuCamera();
        this.showCursor();
    }
    /**
     * Show game HUD
     */ showGameHUD() {
        console.log('========================================');
        console.log('[UICore] showGameHUD() called');
        Logger.debug('[UICore] Showing game HUD');
        this.hideAllScreens();
        if (this.uiScreens.gameHUD) {
            this.uiScreens.gameHUD.enabled = true;
        }
        // Fire event to show HUD elements when entering game
        this.app.fire('menu:closed');
        this.enablePlayerCamera();
        console.log('[UICore] About to call hideCursor()...');
        this.hideCursor();
        // Fire event for crosshair and other UI components
        this.app.fire('ui:hudShown');
        console.log('[UICore] showGameHUD() complete');
        console.log('========================================');
    }
    /**
     * Show round summary
     */ showRoundSummary() {
        Logger.debug('[UICore] Showing round summary');
        this.hideAllScreens();
        if (this.uiScreens.roundSummaryScreen) {
            this.uiScreens.roundSummaryScreen.enabled = true;
        }
        // Fire event to hide HUD elements
        this.app.fire('menu:opened');
        this.enableMenuCamera();
        this.showCursor();
    }
    /**
     * Show pause menu
     */ showPauseMenu() {
        if (this.isPaused) {
            Logger.debug('[UICore] Already paused, ignoring showPauseMenu');
            return;
        }
        console.log('========================================');
        console.log('[UICore] showPauseMenu() called');
        console.log('[UICore] Pointer lock element BEFORE exit:', document.pointerLockElement);
        Logger.debug('[UICore] Showing pause menu');
        // ✅ CRITICAL: Set isPaused FIRST before any other operations
        // This prevents _enablePointerLockForGameplay() from re-enabling pointer lock
        this.isPaused = true;
        // ✅ Pause game immediately to prevent input processing
        this.app.timeScale = 0;
        // Update GameCore pointer lock tracking if available
        if (this.gameManager?.gameCore) {
            this.gameManager.gameCore._isPointerLocked = false;
            // Mark this as an expected pointer lock change
            this.gameManager.gameCore._pointerLockExpected = true;
        }
        // ✅ CRITICAL: Exit pointer lock synchronously (not async)
        if (document.pointerLockElement) {
            console.log('[UICore] Calling document.exitPointerLock()...');
            document.exitPointerLock();
            Logger.debug('[UICore] Exited pointer lock synchronously');
            console.log('[UICore] document.exitPointerLock() called');
        } else {
            console.log('[UICore] Pointer lock already released (element is null)');
        }
        // ✅ Disable pointer lock in PlayCanvas
        if (this.app.mouse) {
            console.log('[UICore] Calling app.mouse.disablePointerLock()...');
            this.app.mouse.disablePointerLock();
            Logger.debug('[UICore] PlayCanvas pointer lock disabled');
            console.log('[UICore] app.mouse.disablePointerLock() called');
        }
        // Check pointer lock status after a moment
        setTimeout(()=>{
            console.log('[UICore] After 50ms - Pointer lock element:', document.pointerLockElement);
        }, 50);
        setTimeout(()=>{
            console.log('[UICore] After 100ms - Pointer lock element:', document.pointerLockElement);
        }, 100);
        setTimeout(()=>{
            console.log('[UICore] After 200ms - Pointer lock element:', document.pointerLockElement);
        }, 200);
        // Show cursor immediately
        this.showCursor();
        // Enable pause menu screen
        if (this.uiScreens.pauseMenuScreen) {
            this.uiScreens.pauseMenuScreen.enabled = true;
            console.log('[UICore] Pause menu screen enabled');
        }
        // Fire pause event
        this.app.fire('game:paused');
        Logger.debug('[UICore] Pause menu shown, cursor visible, pointer lock released, timeScale=0');
        console.log('[UICore] showPauseMenu() complete');
        console.log('========================================');
    }
    /**
     * Hide pause menu
     */ hidePauseMenu() {
        if (!this.isPaused) {
            Logger.debug('[UICore] Not paused, ignoring hidePauseMenu');
            return;
        }
        console.log('========================================');
        console.log('[UICore] hidePauseMenu() called');
        Logger.debug('[UICore] Hiding pause menu');
        // ✅ Clear isPaused FIRST so pointer lock can be re-enabled
        this.isPaused = false;
        console.log('[UICore] Set isPaused = false');
        if (this.uiScreens.pauseMenuScreen) {
            this.uiScreens.pauseMenuScreen.enabled = false;
        }
        // Resume game
        this.app.timeScale = 1;
        console.log('[UICore] Set timeScale = 1');
        // ✅ CRITICAL: DO NOT touch cursor here - button handler already requested pointer lock
        // Setting body.style.cursor interferes with canvas pointer lock!
        console.log('[UICore] Skipping cursor manipulation (handled by button)');
        // Fire resume event
        this.app.fire('game:resumed');
        Logger.debug('[UICore] Pause menu hidden, timeScale=1');
        console.log('[UICore] hidePauseMenu() complete');
        console.log('========================================');
    }
    /**
     * Toggle pause menu
     */ togglePauseMenu() {
        Logger.debug('[UICore] Toggle pause menu, current isPaused:', this.isPaused);
        if (this.isPaused) {
            this.hidePauseMenu();
        } else {
            this.showPauseMenu();
        }
    }
    // ============================================================================
    // CAMERA MANAGEMENT
    // ============================================================================
    /**
     * Enable menu camera
     */ enableMenuCamera() {
        if (this.cameras.menuCamera) {
            this.cameras.menuCamera.enabled = true;
        }
        if (this.cameras.playerCamera) {
            this.cameras.playerCamera.enabled = false;
        }
    }
    /**
     * Enable player camera
     */ enablePlayerCamera() {
        if (this.cameras.menuCamera) {
            this.cameras.menuCamera.enabled = false;
        }
        if (this.cameras.playerCamera) {
            this.cameras.playerCamera.enabled = true;
        }
    }
    // ============================================================================
    // CURSOR MANAGEMENT
    // ============================================================================
    /**
     * Show cursor
     */ showCursor() {
        Logger.debug('[UICore] Showing cursor...');
        // ✅ CRITICAL: Exit pointer lock first using browser API
        if (document.pointerLockElement) {
            document.exitPointerLock();
            Logger.debug('[UICore] Exited pointer lock via document.exitPointerLock()');
        }
        // Disable pointer lock in PlayCanvas
        if (this.app.mouse) {
            this.app.mouse.disablePointerLock();
        }
        // Make cursor visible with multiple methods to ensure it works
        document.body.style.cursor = 'default';
        document.body.style.pointerEvents = 'auto';
        // Also set on canvas element
        const canvas = this.app.graphicsDevice?.canvas;
        if (canvas) {
            canvas.style.cursor = 'default';
            canvas.style.pointerEvents = 'auto';
        }
        Logger.debug('[UICore] Cursor shown, pointer lock disabled, pointer events enabled');
    }
    /**
     * Hide cursor
     */ hideCursor() {
        console.log('========================================');
        console.log('[UICore] hideCursor() called');
        console.log('[UICore] isPlaying:', this.gameManager?.isPlaying());
        console.log('[UICore] isPaused:', this.isPaused);
        console.log('[UICore] Current pointer lock element:', document.pointerLockElement);
        Logger.debug('[UICore] Hiding cursor...');
        // Only hide cursor and enable pointer lock if we're playing and NOT paused
        if (this.gameManager?.isPlaying() && !this.isPaused) {
            // Make cursor invisible
            document.body.style.cursor = 'none';
            // Also set on canvas element
            const canvas = this.app.graphicsDevice?.canvas;
            if (canvas) {
                canvas.style.cursor = 'none';
                console.log('[UICore] Cursor set to none');
            }
            // ✅ CRITICAL: Enable pointer lock IMMEDIATELY (no delay)
            // The user expects to start playing right away after clicking PLAY/RESUME
            if (this.app.mouse) {
                console.log('[UICore] Attempting to enable pointer lock...');
                const canvas = this.app.graphicsDevice?.canvas;
                if (canvas) {
                    // Mark this as an expected pointer lock change
                    if (this.gameManager?.gameCore) {
                        this.gameManager.gameCore._pointerLockExpected = true;
                        console.log('[UICore] Set _pointerLockExpected = true');
                    }
                    // ✅ CRITICAL: Request pointer lock DIRECTLY on canvas
                    // PlayCanvas method might not work if not in user gesture context
                    console.log('[UICore] Calling canvas.requestPointerLock() directly...');
                    canvas.requestPointerLock();
                    console.log('[UICore] canvas.requestPointerLock() called');
                    Logger.debug('[UICore] Pointer lock requested directly on canvas');
                    // Check result
                    setTimeout(()=>{
                        console.log('[UICore] After requestPointerLock - pointer lock element:', document.pointerLockElement);
                        console.log('[UICore] Is locked:', document.pointerLockElement === canvas);
                    }, 50);
                } else {
                    console.warn('[UICore] Canvas not found, cannot request pointer lock');
                }
            }
            Logger.debug('[UICore] Cursor hidden');
        } else {
            console.log('[UICore] NOT hiding cursor - conditions not met');
            Logger.debug('[UICore] Not playing or paused, cursor remains visible');
        }
        console.log('========================================');
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Destroy UI core
     */ destroy() {
        if (!this._isInitialized) return;
        this._isInitialized = false;
        Logger.debug('[UICore] Core cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // UI Screen references
        this.uiScreens = {
            mainMenuScreen: null,
            pauseMenuScreen: null,
            roundSummaryScreen: null,
            gameHUD: null
        };
        // Camera references
        this.cameras = {
            menuCamera: null,
            playerCamera: null
        };
        // Core state
        this.gameManager = null;
        this.isPaused = false;
        this._isInitialized = false;
        Logger.debug('[UICore] Core instance created');
    }
}

export { UICore };
