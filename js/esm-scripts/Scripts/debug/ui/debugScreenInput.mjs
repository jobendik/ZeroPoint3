import { createScript } from '../../../../playcanvas-stable.min.mjs';

var DebugScreenInput = createScript('debugScreenInput');
DebugScreenInput.prototype.initialize = function() {
    // Check if this entity has a screen component
    if (this.entity.screen) {
        console.log('[DebugScreen] Screen component found and enabled:', this.entity.screen.enabled);
        // Listen for screen input events
        this.entity.element.on('mousedown', function(event) {
            console.log('[DebugScreen] Screen received mousedown at:', event.x, event.y);
        });
        this.entity.element.on('click', function(event) {
            console.log('[DebugScreen] Screen received click at:', event.x, event.y);
        });
    } else {
        console.error('[DebugScreen] No Screen component found on:', this.entity.name);
    }
    // Find all buttons in children
    const buttons = this.entity.findComponents('button');
    console.log('[DebugScreen] Found buttons:', buttons.length);
    buttons.forEach((btn)=>{
        console.log('[DebugScreen] Button:', btn.entity.name, 'useInput:', btn.entity.element?.useInput);
    });
};
