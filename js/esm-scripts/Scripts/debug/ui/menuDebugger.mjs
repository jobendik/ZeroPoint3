import { createScript } from '../../../../playcanvas-stable.min.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
var MenuDebugger = createScript('menuDebugger');
MenuDebugger.prototype.initialize = function() {
    console.log('[MenuDebugger] Starting menu system diagnosis...');
    // Wait a moment for GameManager to initialize
    setTimeout(()=>{
        this.diagnoseMenuSystem();
    }, 2000);
    // Monitor all UI-related events
    this.setupEventMonitoring();
    // Add manual test commands
    this.setupManualCommands();
};
MenuDebugger.prototype.diagnoseMenuSystem = function() {
    console.log('\n=== MENU SYSTEM DIAGNOSIS ===');
    // 1. Check GameManager
    const gameManager = this.app.gameManager;
    if (!gameManager) {
        console.error('[MenuDebugger] ❌ GameManager not found!');
        return;
    }
    console.log('[MenuDebugger] ✅ GameManager found');
    // 2. Check UI entity references
    console.log('\n--- UI Entity References ---');
    const uiRefs = {
        'mainMenuUI': gameManager.mainMenuUI,
        'pauseMenuUI': gameManager.pauseMenuUI,
        'roundSummaryUI': gameManager.roundSummaryUI,
        'gameHUD': gameManager.gameHUD,
        'gameWorld': gameManager.gameWorld
    };
    let missingRefs = [];
    Object.keys(uiRefs).forEach((key)=>{
        if (uiRefs[key]) {
            console.log(`[MenuDebugger] ✅ ${key}: ${uiRefs[key].name} (enabled: ${uiRefs[key].enabled})`);
        } else {
            console.log(`[MenuDebugger] ❌ ${key}: NOT SET`);
            missingRefs.push(key);
        }
    });
    // 3. Check cameras
    console.log('\n--- Camera References ---');
    if (gameManager.menuCamera) {
        console.log(`[MenuDebugger] ✅ menuCamera: ${gameManager.menuCamera.name} (enabled: ${gameManager.menuCamera.enabled})`);
    } else {
        console.log('[MenuDebugger] ❌ menuCamera: NOT SET');
    }
    if (gameManager.playerCamera) {
        console.log(`[MenuDebugger] ✅ playerCamera: ${gameManager.playerCamera.name} (enabled: ${gameManager.playerCamera.enabled})`);
    } else {
        console.log('[MenuDebugger] ❌ playerCamera: NOT SET');
    }
    // 4. Try to find UI entities by name if references are missing
    if (missingRefs.length > 0) {
        console.log('\n--- Searching for Missing UI Entities ---');
        this.findMissingUIEntities(missingRefs);
    }
    // 5. Current game state
    console.log('\n--- Current State ---');
    console.log(`[MenuDebugger] Game State: ${gameManager.getGameState()}`);
    // 6. Test the UI update function directly
    console.log('\n--- Testing UI Update Function ---');
    this.testUIUpdate(gameManager);
    console.log('\n=== DIAGNOSIS COMPLETE ===\n');
    if (missingRefs.length > 0) {
        console.warn(`[MenuDebugger] ⚠️ FOUND ISSUE: Missing UI references: ${missingRefs.join(', ')}`);
        console.warn('[MenuDebugger] ⚠️ This is likely why your menu isn\'t disappearing!');
    }
};
MenuDebugger.prototype.findMissingUIEntities = function(missingRefs) {
    // Common UI entity names to search for
    const commonNames = {
        'mainMenuUI': [
            'MainMenuScreen',
            'MainMenu',
            'MenuScreen',
            'StartScreen'
        ],
        'pauseMenuUI': [
            'PauseMenuScreen',
            'PauseMenu'
        ],
        'roundSummaryUI': [
            'RoundSummaryScreen',
            'RoundSummary',
            'Summary'
        ],
        'gameHUD': [
            'GameHUD',
            'HUD',
            'UI'
        ],
        'gameWorld': [
            'GameWorld',
            'World',
            'Level',
            'Scene'
        ]
    };
    missingRefs.forEach((ref)=>{
        console.log(`Searching for ${ref}...`);
        const possibleNames = commonNames[ref] || [
            ref
        ];
        for (let name of possibleNames){
            const found = this.app.root.findByName(name);
            if (found) {
                console.log(`[MenuDebugger] 🔍 Found potential ${ref}: ${found.name} (enabled: ${found.enabled})`);
                // Check if it has Screen component
                if (found.screen) {
                    console.log(`[MenuDebugger] 📱 Has Screen component (enabled: ${found.screen.enabled})`);
                }
            }
        }
    });
};
MenuDebugger.prototype.testUIUpdate = function(gameManager) {
    if (typeof gameManager._updateUIForState !== 'function') {
        console.error('[MenuDebugger] ❌ _updateUIForState method not found!');
        return;
    }
    console.log('[MenuDebugger] Testing _updateUIForState with current state...');
    // Override _setUIEnabled to add logging
    const originalSetUIEnabled = gameManager._setUIEnabled;
    gameManager._setUIEnabled = function(ui, enabled) {
        const entityName = ui ? ui.name || ui.entity?.name || 'unknown' : 'null';
        console.log(`[MenuDebugger] _setUIEnabled called: ${entityName} -> ${enabled}`);
        if (ui) {
            const beforeState = ui.enabled;
            originalSetUIEnabled.call(this, ui, enabled);
            const afterState = ui.enabled;
            console.log(`[MenuDebugger] Entity state change: ${beforeState} -> ${afterState}`);
        } else {
            console.log(`[MenuDebugger] ❌ Cannot set UI enabled - entity is null!`);
        }
    };
    // Test the current state update
    gameManager._updateUIForState(gameManager.getGameState());
    // Restore original function
    gameManager._setUIEnabled = originalSetUIEnabled;
};
MenuDebugger.prototype.setupEventMonitoring = function() {
    // Monitor game state changes
    this.app.on('game:stateChanged', (data)=>{
        console.log(`[MenuDebugger] 🎮 State Change: ${data.from} -> ${data.to}`);
        // Log UI visibility after state change
        setTimeout(()=>{
            this.logCurrentUIState();
        }, 100);
    });
    // Monitor play button clicks
    this.app.on('menu:startGame', ()=>{
        console.log('[MenuDebugger] 🎯 Play button clicked - menu should disappear now');
    });
};
MenuDebugger.prototype.logCurrentUIState = function() {
    const gameManager = this.app.gameManager;
    if (!gameManager) return;
    console.log('\n--- Current UI State ---');
    const entities = [
        'mainMenuUI',
        'pauseMenuUI',
        'roundSummaryUI',
        'gameHUD',
        'gameWorld'
    ];
    entities.forEach((key)=>{
        const entity = gameManager[key];
        if (entity) {
            console.log(`[MenuDebugger] ${key}: enabled=${entity.enabled}`);
            if (entity.screen) {
                console.log(`[MenuDebugger] ${key}.screen: enabled=${entity.screen.enabled}`);
            }
        } else {
            console.log(`[MenuDebugger] ${key}: NOT SET`);
        }
    });
    console.log('--- End UI State ---\n');
};
MenuDebugger.prototype.setupManualCommands = function() {
    // Add global debug commands
    window.menuDebug = {
        diagnose: ()=>{
            this.diagnoseMenuSystem();
        },
        showMenu: ()=>{
            console.log('[MenuDebugger] Manual: Showing main menu');
            const gm = this.app.gameManager;
            if (gm && gm.setGameState) {
                gm.setGameState('main_menu');
            }
        },
        startGame: ()=>{
            console.log('[MenuDebugger] Manual: Starting game');
            const gm = this.app.gameManager;
            if (gm && gm.setGameState) {
                gm.setGameState('countdown');
            }
        },
        toggleMainMenu: (show)=>{
            console.log(`[MenuDebugger] Manual: Toggle main menu ${show ? 'ON' : 'OFF'}`);
            const gm = this.app.gameManager;
            if (gm && gm.mainMenuUI) {
                gm.mainMenuUI.enabled = show;
                if (gm.mainMenuUI.screen) {
                    gm.mainMenuUI.screen.enabled = show;
                }
                console.log(`[MenuDebugger] Main menu is now: ${gm.mainMenuUI.enabled}`);
            } else {
                console.log('[MenuDebugger] ❌ mainMenuUI not found');
            }
        },
        logUIState: ()=>{
            this.logCurrentUIState();
        }
    };
    console.log('[MenuDebugger] 🛠️ Manual debug commands available:');
    console.log('  window.menuDebug.diagnose() - Run full diagnosis');
    console.log('  window.menuDebug.showMenu() - Force show menu');
    console.log('  window.menuDebug.startGame() - Force start game');
    console.log('  window.menuDebug.toggleMainMenu(true/false) - Toggle main menu');
    console.log('  window.menuDebug.logUIState() - Log current UI state');
};
