import { Script } from '../../../../playcanvas-stable.min.mjs';

/**
 * pauseButton.mjs (ESM REFACTORED VERSION)
 * 
 * PlayCanvas ESM Script for pause button functionality.
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
class PauseButton extends Script {
    initialize() {
        if (this.entity.button) {
            this.entity.button.on('click', ()=>{
                this.app.fire('ui:pauseClicked');
            });
        }
    }
}
_define_property(PauseButton, "scriptName", 'pauseButton');

export { PauseButton };
