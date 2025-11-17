///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Menu System Diagnostic Tool
 * Diagnoses pause menu, restart, and round summary issues
 */

var MenuSystemDiagnostic = pc.createScript('menuSystemDiagnostic');

MenuSystemDiagnostic.prototype.initialize = function() {
    console.log('='.repeat(80));
    console.log('MENU SYSTEM DIAGNOSTIC');
    console.log('='.repeat(80));
    
    this.checkUIManager();
    this.checkGameManager();
    this.checkPauseMenu();
    this.checkRoundSummary();
    this.checkButtons();
    this.checkEventSystem();
    this.setupTestListeners();
};

MenuSystemDiagnostic.prototype.checkUIManager = function() {
    console.log('\n[1] UI MANAGER CHECK');
    console.log('-'.repeat(40));
    
    const ui = this.app.root.findByName('UI');
    console.log('UI Entity:', ui ? '✓ Found' : '✗ Missing');
    
    if (ui && ui.script && ui.script.uiManager) {
        console.log('UIManager Script:', '✓ Found');
        const uiManager = ui.script.uiManager;
        console.log('  - uiManager instance:', !!uiManager.uiManager);
        console.log('  - isPaused:', uiManager.isPaused);
        console.log('  - gameManager ref:', !!uiManager.uiManager?.gameManager);
    } else {
        console.log('UIManager Script:', '✗ Missing');
    }
    
    console.log('app.uiManager:', this.app.uiManager ? '✓ Set' : '✗ Missing');
};

MenuSystemDiagnostic.prototype.checkGameManager = function() {
    console.log('\n[2] GAME MANAGER CHECK');
    console.log('-'.repeat(40));
    
    const gm = this.app.root.findByName('GameManager');
    console.log('GameManager Entity:', gm ? '✓ Found' : '✗ Missing');
    
    if (gm && gm.script && gm.script.gameManager) {
        console.log('GameManager Script:', '✓ Found');
        const gameManager = gm.script.gameManager;
        console.log('  - currentState:', gameManager.currentState);
        console.log('  - uiManager ref:', !!gameManager.uiManager);
        console.log('  - gameSession ref:', !!gameManager.gameSession);
    } else {
        console.log('GameManager Script:', '✗ Missing');
    }
    
    console.log('app.gameManager:', this.app.gameManager ? '✓ Set' : '✗ Missing');
};

MenuSystemDiagnostic.prototype.checkPauseMenu = function() {
    console.log('\n[3] PAUSE MENU CHECK');
    console.log('-'.repeat(40));
    
    const ui = this.app.root.findByName('UI');
    const pauseMenu = ui?.findByName('PauseMenuScreen');
    
    console.log('PauseMenuScreen:', pauseMenu ? '✓ Found' : '✗ Missing');
    
    if (pauseMenu) {
        console.log('  - enabled:', pauseMenu.enabled);
        console.log('  - pauseMenu script:', !!pauseMenu.script?.pauseMenu);
        
        if (pauseMenu.script?.pauseMenu) {
            const script = pauseMenu.script.pauseMenu;
            console.log('  - pauseMenu instance:', !!script.pauseMenu);
            console.log('  - initialized:', script.pauseMenu?._isInitialized);
        }
        
        const resumeBtn = pauseMenu.findByName('ResumeButton');
        const quitBtn = pauseMenu.findByName('QuitToMenuButton');
        
        console.log('  - ResumeButton:', resumeBtn ? '✓ Found' : '✗ Missing');
        if (resumeBtn) {
            console.log('    - button component:', !!resumeBtn.button);
            console.log('    - element component:', !!resumeBtn.element);
        }
        
        console.log('  - QuitToMenuButton:', quitBtn ? '✓ Found' : '✗ Missing');
        if (quitBtn) {
            console.log('    - button component:', !!quitBtn.button);
            console.log('    - element component:', !!quitBtn.element);
        }
    }
};

MenuSystemDiagnostic.prototype.checkRoundSummary = function() {
    console.log('\n[4] ROUND SUMMARY CHECK');
    console.log('-'.repeat(40));
    
    const ui = this.app.root.findByName('UI');
    const summary = ui?.findByName('RoundSummaryScreen');
    
    console.log('RoundSummaryScreen:', summary ? '✓ Found' : '✗ Missing');
    
    if (summary) {
        console.log('  - enabled:', summary.enabled);
        console.log('  - roundSummaryLogic script:', !!summary.script?.roundSummaryLogic);
        
        if (summary.script?.roundSummaryLogic) {
            const script = summary.script.roundSummaryLogic;
            console.log('  - roundSummary instance:', !!script.roundSummary);
            console.log('  - initialized:', script.roundSummary?._initialized);
        }
        
        const rematchBtn = summary.findByName('RematchButton') || summary.findByName('RestartButton');
        const quitBtn = summary.findByName('QuitToMenuButton');
        
        console.log('  - Rematch/RestartButton:', rematchBtn ? `✓ Found (${rematchBtn.name})` : '✗ Missing');
        if (rematchBtn) {
            console.log('    - button component:', !!rematchBtn.button);
            console.log('    - rematchButton script:', !!rematchBtn.script?.rematchButton);
        }
        
        console.log('  - QuitToMenuButton:', quitBtn ? '✓ Found' : '✗ Missing');
        if (quitBtn) {
            console.log('    - button component:', !!quitBtn.button);
            console.log('    - quitButton script:', !!quitBtn.script?.quitButton);
        }
    }
};

MenuSystemDiagnostic.prototype.checkButtons = function() {
    console.log('\n[5] BUTTON SCRIPTS CHECK');
    console.log('-'.repeat(40));
    
    // Find all buttons with scripts
    const buttonScripts = [
        'pauseButton',
        'playButton',
        'rematchButton',
        'resumeButton',
        'quitButton'
    ];
    
    buttonScripts.forEach(scriptName => {
        const found = this.app.root.findComponents('script').some(sc => {
            return sc._scriptsIndex && sc._scriptsIndex[scriptName];
        });
        console.log(`${scriptName}:`, found ? '✓ Found' : '✗ Missing');
    });
};

MenuSystemDiagnostic.prototype.checkEventSystem = function() {
    console.log('\n[6] EVENT SYSTEM CHECK');
    console.log('-'.repeat(40));
    
    const gm = this.app.gameManager;
    if (gm && gm.gameEvents) {
        console.log('GameEvents module:', '✓ Found');
        console.log('  - Events bound:', gm.gameEvents._eventsBound);
    } else {
        console.log('GameEvents module:', '✗ Missing');
    }
};

MenuSystemDiagnostic.prototype.setupTestListeners = function() {
    console.log('\n[7] SETTING UP TEST LISTENERS');
    console.log('-'.repeat(40));
    
    const events = [
        'ui:pauseClicked',
        'ui:resumeClicked',
        'ui:rematchClicked',
        'ui:quitClicked',
        'game:paused',
        'game:resumed',
        'game:sessionEnded',
        'game:roundEnded',
        'summary:show',
        'summary:hide'
    ];
    
    events.forEach(eventName => {
        this.app.on(eventName, (data) => {
            console.log(`🔔 EVENT FIRED: ${eventName}`, data || '');
        });
    });
    
    console.log('✓ Test listeners registered for', events.length, 'events');
};

// Add manual test triggers
MenuSystemDiagnostic.prototype.postInitialize = function() {
    console.log('\n[8] MANUAL TEST COMMANDS');
    console.log('-'.repeat(40));
    console.log('Test commands available in console:');
    console.log('  testPause()          - Test pause menu');
    console.log('  testResume()         - Test resume');
    console.log('  testRematch()        - Test rematch');
    console.log('  testQuit()           - Test quit');
    console.log('  testSummary()        - Test round summary');
    console.log('  checkPauseState()    - Check current pause state');
    console.log('  checkCursor()        - Check cursor state');
    console.log('='.repeat(80));
    
    const app = this.app;
    
    // Define as global functions (NOT window.xxx)
    self.testPause = function() {
        console.log('📝 Testing pause...');
        app.fire('ui:pauseClicked');
    };
    
    self.testResume = function() {
        console.log('📝 Testing resume...');
        app.fire('ui:resumeClicked');
    };
    
    self.testRematch = function() {
        console.log('📝 Testing rematch...');
        app.fire('ui:rematchClicked');
    };
    
    self.testQuit = function() {
        console.log('📝 Testing quit...');
        app.fire('ui:quitClicked');
    };
    
    self.testSummary = function() {
        console.log('📝 Testing summary...');
        const testData = {
            score: 1500,
            kills: 10,
            deaths: 2,
            accuracy: 75.5,
            duration: 180
        };
        app.fire('game:sessionEnded', testData);
    };
    
    self.checkPauseState = function() {
        console.log('🔍 PAUSE STATE CHECK:');
        console.log('  - timeScale:', app.timeScale);
        console.log('  - uiManager.isPaused:', app.uiManager?.isPaused);
        console.log('  - uiManager.core.isPaused:', app.uiManager?.core?.isPaused);
        console.log('  - PauseMenuScreen.enabled:', app.root.findByName('UI')?.findByName('PauseMenuScreen')?.enabled);
        console.log('  - gameState:', app.gameManager?.currentState);
    };
    
    self.checkCursor = function() {
        console.log('🔍 CURSOR STATE CHECK:');
        console.log('  - body.style.cursor:', document.body.style.cursor);
        console.log('  - canvas.style.cursor:', app.graphicsDevice?.canvas?.style.cursor);
        console.log('  - pointer lock active:', document.pointerLockElement === app.graphicsDevice?.canvas);
        console.log('  - pointer lock available:', 'pointerLockElement' in document);
    };
    
    console.log('✓ Test functions registered globally');
};
