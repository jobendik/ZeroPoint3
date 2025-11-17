import { Script } from '../../../../playcanvas-stable.min.mjs';

/**
 * resumeButton.mjs (ESM REFACTORED VERSION)
 * 
 * PlayCanvas ESM Script for resume button functionality.
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
class ResumeButton extends Script {
    initialize() {
        if (this.entity.button) {
            this.entity.button.on('click', ()=>{
                this.app.fire('ui:resumeClicked');
            });
        }
    }
}
_define_property(ResumeButton, "scriptName", 'resumeButton');

export { ResumeButton };
