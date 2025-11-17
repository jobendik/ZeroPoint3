import { createScript } from '../../../../playcanvas-stable.min.mjs';

/* global pc */ var DebugGameWorld = createScript('debugGameWorld');
DebugGameWorld.prototype.initialize = function() {
    // Set up global debug function
    window.debugGameWorldVisibility = ()=>{
        console.log('=== GAMEWORLD VISIBILITY DEBUG ===');
        // Check GameManager reference
        const gm = window.gameManager || this.app.gameManager;
        if (!gm) {
            console.error('GameManager not found!');
            return;
        }
        console.log('GameManager found:', gm);
        console.log('Current state:', gm.getGameState());
        // Check GameWorld reference
        console.log('GameWorld reference:', gm.gameWorld);
        if (gm.gameWorld) {
            console.log('GameWorld name:', gm.gameWorld.name);
            console.log('GameWorld enabled:', gm.gameWorld.enabled);
            console.log('GameWorld children count:', gm.gameWorld.children.length);
            // Check first few children
            console.log('GameWorld children:');
            gm.gameWorld.children.slice(0, 5).forEach((child, i)=>{
                console.log(`  ${i}: ${child.name} (enabled: ${child.enabled})`);
            });
        } else {
            console.error('GameWorld reference is null!');
            // Try to find GameWorld by name
            const foundGameWorld = this.app.root.findByName('GameWorld');
            if (foundGameWorld) {
                console.log('Found GameWorld by name search:', foundGameWorld.name);
                console.log('GameWorld enabled:', foundGameWorld.enabled);
            } else {
                console.error('Could not find GameWorld entity by name either!');
            }
        }
        // Check what 3D entities are currently enabled
        console.log('\n=== ENABLED 3D ENTITIES ===');
        const enabled3DEntities = this.app.root.find(function(entity) {
            return entity.enabled && (entity.model || entity.render || entity.light);
        });
        console.log(`Found ${enabled3DEntities.length} enabled 3D entities:`);
        enabled3DEntities.slice(0, 10).forEach((entity, i)=>{
            const parent = entity.parent ? entity.parent.name : 'Root';
            console.log(`  ${i}: ${entity.name} (parent: ${parent})`);
        });
        console.log('=== DEBUG COMPLETE ===');
    };
    // Auto-run debug after a delay
    setTimeout(()=>{
        window.debugGameWorldVisibility();
    }, 3000);
    console.log('[DebugGameWorld] Debug function available: debugGameWorldVisibility()');
};
