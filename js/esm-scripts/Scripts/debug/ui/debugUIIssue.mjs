import { createScript } from '../../../../playcanvas-stable.min.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
// Enhanced Debug Script - Add this to identify the UI issue
/* global pc */ var DebugUIIssue = createScript('debugUIIssue');
DebugUIIssue.prototype.initialize = function() {
    console.log('[DebugUI] Starting enhanced UI debugging');
    // Track all game state changes
    this.app.on('game:stateChanged', (data)=>{
        console.log('[DebugUI] *** GAME STATE CHANGED ***');
        console.log('[DebugUI] From:', data.from, 'To:', data.to);
        console.log('[DebugUI] Timestamp:', Date.now());
    });
    // Track all menu events
    this.app.on('menu:startGame', ()=>{
        console.log('[DebugUI] *** MENU EVENT: startGame ***');
        console.trace('Event fired from:');
    });
    this.app.on('menu:pauseGame', ()=>{
        console.log('[DebugUI] *** MENU EVENT: pauseGame ***');
    });
    this.app.on('menu:resumeGame', ()=>{
        console.log('[DebugUI] *** MENU EVENT: resumeGame ***');
    });
    this.app.on('menu:quitToMainMenu', ()=>{
        console.log('[DebugUI] *** MENU EVENT: quitToMainMenu ***');
    });
    // Monitor UI entity visibility changes
    this._monitorUIEntities();
    // Check GameManager configuration
    setTimeout(()=>{
        this._checkGameManagerConfig();
    }, 1000);
};
DebugUIIssue.prototype._monitorUIEntities = function() {
    // Find all UI entities
    const ui = this.app.root.findByName('UI');
    if (!ui) {
        console.error('[DebugUI] UI root entity not found!');
        return;
    }
    const mainMenu = ui.findByName('MainMenuScreen');
    const pauseMenu = ui.findByName('PauseMenuScreen');
    const gameHUD = ui.findByName('GameHUD');
    const roundSummary = ui.findByName('RoundSummaryScreen');
    console.log('[DebugUI] Found UI entities:');
    console.log('[DebugUI] MainMenuScreen:', mainMenu ? 'Found' : 'NOT FOUND');
    console.log('[DebugUI] PauseMenuScreen:', pauseMenu ? 'Found' : 'NOT FOUND');
    console.log('[DebugUI] GameHUD:', gameHUD ? 'Found' : 'NOT FOUND');
    console.log('[DebugUI] RoundSummaryScreen:', roundSummary ? 'Found' : 'NOT FOUND');
    // Monitor their enabled state changes
    this._watchEntity(mainMenu, 'MainMenuScreen');
    this._watchEntity(pauseMenu, 'PauseMenuScreen');
    this._watchEntity(gameHUD, 'GameHUD');
    this._watchEntity(roundSummary, 'RoundSummaryScreen');
};
DebugUIIssue.prototype._watchEntity = function(entity, name) {
    if (!entity) return;
    console.log('[DebugUI]', name, 'initial state - enabled:', entity.enabled);
    // Safer approach: poll the entity.enabled flag each frame and log changes.
    // Overriding the 'enabled' property via Object.defineProperty can interfere
    // with the engine and cause reserved-name warnings; polling is low-impact
    // for debug builds and avoids engine-level conflicts.
    this._monitoredEntities = this._monitoredEntities || new Map();
    this._monitoredEntities.set(entity, {
        name: name,
        enabled: !!entity.enabled
    });
    // Ensure the update listener exists once
    if (!this._watcherInstalled) {
        this._watcherInstalled = true;
        this.app.on('update', (function(dt) {
            try {
                for (const [ent, meta] of this._monitoredEntities){
                    if (!ent) continue;
                    const current = !!ent.enabled;
                    if (current !== meta.enabled) {
                        console.log(`[DebugUI] *** ${meta.name} enabled changed: ${meta.enabled} -> ${current} ***`);
                        console.trace('Changed by:');
                        meta.enabled = current;
                    }
                }
            } catch (e) {
            // Defensive: ignore any errors in debug watcher
            }
        }).bind(this));
    }
};
DebugUIIssue.prototype._checkGameManagerConfig = function() {
    console.log('[DebugUI] Checking GameManager configuration...');
    if (!this.app.gameManager) {
        console.error('[DebugUI] GameManager not found on app!');
        return;
    }
    const gm = this.app.gameManager;
    console.log('[DebugUI] GameManager found, checking UI references:');
    console.log('[DebugUI] mainMenuUI:', gm.mainMenuUI ? 'Set' : 'NOT SET');
    console.log('[DebugUI] pauseMenuUI:', gm.pauseMenuUI ? 'Set' : 'NOT SET');
    console.log('[DebugUI] gameHUD:', gm.gameHUD ? 'Set' : 'NOT SET');
    console.log('[DebugUI] roundSummaryUI:', gm.roundSummaryUI ? 'Set' : 'NOT SET');
    console.log('[DebugUI] gameWorld:', gm.gameWorld ? 'Set' : 'NOT SET');
    // Check if setGameState method exists and works
    if (typeof gm.setGameState === 'function') {
        console.log('[DebugUI] setGameState method exists');
        console.log('[DebugUI] Current state:', gm.getGameState ? gm.getGameState() : 'UNKNOWN');
        // Check if _updateUIForState exists
        if (typeof gm._updateUIForState === 'function') {
            console.log('[DebugUI] _updateUIForState method exists');
        } else {
            console.error('[DebugUI] _updateUIForState method MISSING!');
        }
    } else {
        console.error('[DebugUI] setGameState method MISSING!');
    }
    // Test the UI state update manually
    console.log('[DebugUI] Testing manual UI state update...');
    if (gm._updateUIForState) {
        gm._updateUIForState('main_menu');
    }
};
// Also add keyboard debugging
DebugUIIssue.prototype.initialize = function() {
    // ... existing code ...
    // Monitor keyboard events that might trigger state changes
    window.addEventListener('keydown', (e)=>{
        console.log('[DebugUI] Keydown:', e.key, 'Code:', e.keyCode);
        if (e.key === 'Escape' || e.keyCode === 27) {
            console.log('[DebugUI] *** ESC KEY PRESSED ***');
        }
    }, true);
    // Monitor mouse clicks that might trigger button events
    window.addEventListener('click', (e)=>{
        console.log('[DebugUI] Click event at:', e.clientX, e.clientY);
        console.log('[DebugUI] Target:', e.target);
    }, true);
};
