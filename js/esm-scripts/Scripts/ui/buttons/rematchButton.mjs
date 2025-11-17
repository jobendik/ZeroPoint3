import { Script } from '../../../../playcanvas-stable.min.mjs';

/**
 * rematchButton.mjs (ESM REFACTORED VERSION)
 * 
 * PlayCanvas ESM Script for rematch button functionality.
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
class RematchButton extends Script {
    initialize() {
        if (this.entity.button) {
            this.entity.button.on('click', ()=>{
                // Use the improved rematch system instead of scene reload
                this.app.fire('ui:rematchClicked');
            });
        }
    }
}
_define_property(RematchButton, "scriptName", 'rematchButton');

export { RematchButton };
