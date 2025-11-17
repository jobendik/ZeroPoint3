import { createScript } from '../../../../playcanvas-stable.min.mjs';

/* global pc */ // Attach this to any entity for debugging - remove after fixing
var DebugMenu = createScript('debugMenu');
DebugMenu.prototype.initialize = function() {
    console.log('[Debug] Menu debug script started');
    // Listen to all menu events
    this.app.on('menu:startGame', ()=>console.log('[Debug] Event: menu:startGame'));
    this.app.on('menu:pauseGame', ()=>console.log('[Debug] Event: menu:pauseGame'));
    this.app.on('menu:resumeGame', ()=>console.log('[Debug] Event: menu:resumeGame'));
    this.app.on('menu:quitToMainMenu', ()=>console.log('[Debug] Event: menu:quitToMainMenu'));
    // Listen to game state changes
    this.app.on('game:stateChanged', (data)=>{
        console.log('[Debug] Game state changed from', data.from, 'to', data.to);
    });
    // Check if GameManager exists
    setTimeout(()=>{
        if (this.app.gameManager) {
            console.log('[Debug] GameManager found, current state:', this.app.gameManager.getGameState());
        } else {
            console.error('[Debug] GameManager not found on app!');
        }
    }, 1000);
};
