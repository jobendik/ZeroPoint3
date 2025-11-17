import { createScript } from '../../../../playcanvas-stable.min.mjs';

/* global pc */ var ButtonDiagnostics = createScript('buttonDiagnostics');
ButtonDiagnostics.prototype.initialize = function() {
    console.log('=== BUTTON DIAGNOSTICS START ===');
    // Basic entity info
    console.log('Entity name:', this.entity.name);
    console.log('Entity enabled:', this.entity.enabled);
    console.log('Entity position:', this.entity.getPosition().toString());
    // Check components
    this.checkComponents();
    // Check UI hierarchy
    this.checkUIHierarchy();
    // Check for blocking elements
    this.checkForBlockingElements();
    // Test input system
    this.testInputSystem();
    // Set up global test functions
    this.setupGlobalTests();
    console.log('=== BUTTON DIAGNOSTICS END ===');
};
ButtonDiagnostics.prototype.checkComponents = function() {
    console.log('--- COMPONENT CHECK ---');
    // Element component
    if (this.entity.element) {
        console.log('✓ Element component found');
        console.log('  - Type:', this.entity.element.type);
        console.log('  - UseInput:', this.entity.element.useInput);
        console.log('  - Width:', this.entity.element.width);
        console.log('  - Height:', this.entity.element.height);
        console.log('  - Anchor:', this.entity.element.anchor.toString());
        console.log('  - Pivot:', this.entity.element.pivot.toString());
    } else {
        console.log('✗ No element component');
    }
    // Button component
    if (this.entity.button) {
        console.log('✓ Button component found');
        console.log('  - Active:', this.entity.button.active);
        console.log('  - Has transition mode:', !!this.entity.button.transitionMode);
    } else {
        console.log('✗ No button component');
    }
    // Script component
    if (this.entity.script) {
        console.log('✓ Script component found');
        console.log('  - Scripts:', Object.keys(this.entity.script._scriptsData || {}));
        // Check if playButtonHandler exists
        if (this.entity.script.playButtonHandler) {
            console.log('  - playButtonHandler script found and enabled');
        } else {
            console.log('  - playButtonHandler script NOT found');
        }
    }
};
ButtonDiagnostics.prototype.checkUIHierarchy = function() {
    console.log('--- UI HIERARCHY CHECK ---');
    let current = this.entity;
    let level = 0;
    while(current){
        const indent = '  '.repeat(level);
        console.log(`${indent}${current.name} (enabled: ${current.enabled})`);
        // Check if this entity has a screen component
        if (current.screen) {
            console.log(`${indent}  - Has Screen component (enabled: ${current.screen.enabled})`);
        }
        // Check if this entity blocks input
        if (current.element) {
            console.log(`${indent}  - Has Element (useInput: ${current.element.useInput})`);
        }
        current = current.parent;
        level++;
        if (level > 10) {
            console.log('  (stopping hierarchy check - too deep)');
            break;
        }
    }
};
ButtonDiagnostics.prototype.checkForBlockingElements = function() {
    console.log('--- BLOCKING ELEMENTS CHECK ---');
    // Get the screen space position of our button
    const screenPos = this.entity.screen ? this.entity.screen.screenToWorld(this.entity.element.screenCorners[0]) : this.entity.getPosition();
    console.log('Button screen position:', screenPos.toString());
    // Find all UI entities that might be blocking
    const uiEntities = this.app.root.find((function(entity) {
        return entity.element && entity.element.useInput && entity !== this.entity;
    }).bind(this));
    console.log('Found', uiEntities.length, 'other UI input elements');
    uiEntities.forEach((entity, index)=>{
        if (index < 5) {
            console.log(`  ${entity.name} (enabled: ${entity.enabled}, useInput: ${entity.element.useInput})`);
        }
    });
};
ButtonDiagnostics.prototype.testInputSystem = function() {
    console.log('--- INPUT SYSTEM TEST ---');
    // Check if input system is working at all
    if (this.app.mouse) {
        console.log('✓ Mouse input available');
        // Set up temporary mouse test
        const testHandler = (event)=>{
            console.log('MOUSE EVENT DETECTED:', event.type, 'at', event.x, event.y);
        };
        this.app.mouse.on('mousedown', testHandler);
        setTimeout(()=>{
            this.app.mouse.off('mousedown', testHandler);
        }, 10000); // Remove after 10 seconds
        console.log('Mouse test handler active for 10 seconds - try clicking anywhere');
    }
    if (this.app.touch) {
        console.log('✓ Touch input available');
    }
    // Check element input events specifically
    if (this.entity.element) {
        console.log('Setting up element event test...');
        // Test all possible events
        const events = [
            'mousedown',
            'mouseup',
            'click',
            'mouseenter',
            'mouseleave',
            'touchstart',
            'touchend'
        ];
        events.forEach((eventName)=>{
            this.entity.element.on(eventName, ()=>{
                console.log(`🎯 ELEMENT EVENT TRIGGERED: ${eventName}`);
            });
        });
    }
};
ButtonDiagnostics.prototype.setupGlobalTests = function() {
    console.log('--- SETTING UP GLOBAL TESTS ---');
    // Make button testable from console
    window.testButtonDirect = ()=>{
        console.log('=== DIRECT BUTTON TEST ===');
        // Try to trigger click programmatically
        if (this.entity.element && this.entity.element.fire) {
            console.log('Triggering element click event...');
            this.entity.element.fire('click');
        }
        // Try button component
        if (this.entity.button) {
            console.log('Button component state:', this.entity.button.active);
        }
        // Test GameManager connection
        console.log('Testing GameManager connection...');
        if (window.gameManager) {
            console.log('✓ GameManager found globally');
            console.log('Current state:', window.gameManager.getGameState());
        } else {
            console.log('✗ GameManager not found globally');
        }
        console.log('=== DIRECT BUTTON TEST END ===');
    };
    window.forceStartGame = ()=>{
        console.log('=== FORCING GAME START ===');
        if (window.gameManager) {
            window.gameManager.setGameState('countdown');
            console.log('Forced game start');
        } else {
            console.log('No GameManager available');
        }
    };
    console.log('Global test functions available:');
    console.log('  - testButtonDirect() - Test button functionality');
    console.log('  - forceStartGame() - Force game state change');
};
// Update method to continuously monitor
ButtonDiagnostics.prototype.update = function(dt) {
    // Check if button state changed (only log once per change)
    if (this.entity.button) {
        const currentState = this.entity.button.active;
        if (this._lastButtonState !== currentState) {
            console.log('Button active state changed to:', currentState);
            this._lastButtonState = currentState;
        }
    }
};
ButtonDiagnostics.prototype.destroy = function() {
    // Clean up global test functions
    delete window.testButtonDirect;
    delete window.forceStartGame;
};
