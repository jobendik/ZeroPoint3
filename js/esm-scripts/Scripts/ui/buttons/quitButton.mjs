import { Script } from '../../../../playcanvas-stable.min.mjs';

/**
 * quitButton.mjs (ESM REFACTORED VERSION)
 * 
 * PlayCanvas ESM Script for quit button functionality.
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
class QuitButton extends Script {
    initialize() {
        if (this.entity.button) {
            this.entity.button.on('click', ()=>{
                this.app.fire('ui:quitClicked');
            });
        }
    }
}
_define_property(QuitButton, "scriptName", 'quitButton');

export { QuitButton };
