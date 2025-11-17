import { Script } from '../../../../playcanvas-stable.min.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * playButton.mjs (ESM REFACTORED VERSION)
 * 
 * PlayCanvas ESM Script for play button functionality.
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
class PlayButton extends Script {
    initialize() {
        if (this.entity.button) {
            this.entity.button.on('click', ()=>{
                // Fire the play clicked event - game state machine will handle pointer lock
                this.app.fire('ui:playClicked');
            });
        } else {
            console.error('[PlayButton] Button component not found on entity!');
        }
    }
}
_define_property(PlayButton, "scriptName", 'playButton');

export { PlayButton };
