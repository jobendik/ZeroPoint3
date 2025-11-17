import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { Linear, SineOut } from '../weapons/effects/tween.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';
import { Logger } from '../../engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * DamageVignetteController.mjs
 * ESM version compatible with your tween.mjs system.
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
class DamageVignetteController extends Script {
    initialize() {
        // Find the element on self or child named "Image" or first descendant with element
        const pickFirstElement = (root)=>{
            if (root.element) return root.element;
            const imageChild = root.findByName?.('Image');
            if (imageChild?.element) return imageChild.element;
            const any = root.find?.((n)=>!!n.element);
            return any?.element || null;
        };
        this._el = pickFirstElement(this.entity);
        if (!this._el) {
            Logger.warn('[DamageVignette] No Element found on self/children.');
            return;
        }
        this._setOpacity(0);
        this._tweenChain = null;
        this._onEvent = (data = {})=>this.flash(data.intensity, data.duration);
        if (this.app && this.eventName) {
            this.app.on(this.eventName, this._onEvent);
        }
    }
    destroy() {
        if (this.app && this._onEvent) this.app.off(this.eventName, this._onEvent);
        this._killTweens();
    }
    _setOpacity(v) {
        if (this._el) {
            const opacity = isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
            this._el.opacity = opacity;
        }
    }
    _killTweens() {
        if (this._tweenChain?.stop) this._tweenChain.stop();
        this._tweenChain = null;
    }
    /**
     * Trigger a vignette flash animation.
     * @param {number} intensity Opacity (0–1)
     * @param {number} totalDur Total duration in seconds
     */ flash(intensity, totalDur) {
        if (!this._el) {
            Logger.warn('[DamageVignette] ❌ Cannot flash - no element!');
            return;
        }
        let maxOp = typeof intensity === 'number' && !isNaN(intensity) ? intensity : this.maxOpacity;
        maxOp = Math.max(0, Math.min(1, maxOp));
        let fi = this.fadeIn, ho = this.hold, fo = this.fadeOut;
        if (typeof totalDur === 'number' && totalDur > 0) {
            const k = totalDur / (fi + ho + fo || 1e-6);
            fi *= k;
            ho *= k;
            fo *= k;
        }
        // Smart stacking
        const currentOp = this._el.opacity || 0;
        if (this.stackSmartly && currentOp > 0 && maxOp < currentOp) {
            maxOp = currentOp;
        }
        this._killTweens();
        const startOp = currentOp;
        // Create a simple object to tween (not relying on this.entity for tween state)
        const tweenTarget = {
            opacity: startOp
        };
        // Fade In
        const t1 = this.entity.tween(tweenTarget).to({
            opacity: maxOp
        }, fi, Linear).onUpdate(()=>this._setOpacity(tweenTarget.opacity));
        // Hold
        const t2 = this.entity.tween(tweenTarget).to({
            opacity: maxOp
        }, ho, Linear);
        // Fade Out
        const t3 = this.entity.tween(tweenTarget).to({
            opacity: 0
        }, fo, SineOut).onUpdate(()=>this._setOpacity(tweenTarget.opacity)).onComplete(()=>this._setOpacity(0));
        // Chain them using tween.mjs's chaining logic
        t1.chain(t2, t3);
        t1.start();
        this._tweenChain = t1;
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @min 0 @max 1 @title Max Opacity */ _define_property(this, "maxOpacity", aiConfig.healthEffects.VIGNETTE_MAX_OPACITY);
        /** @attribute @type {number} @min 0 @title Fade In (s) */ _define_property(this, "fadeIn", aiConfig.healthEffects.VIGNETTE_FADE_IN);
        /** @attribute @type {number} @min 0 @title Hold (s) */ _define_property(this, "hold", aiConfig.healthEffects.VIGNETTE_HOLD);
        /** @attribute @type {number} @min 0 @title Fade Out (s) */ _define_property(this, "fadeOut", aiConfig.healthEffects.VIGNETTE_FADE_OUT);
        /** @attribute @type {string} @title App Event to Listen For */ _define_property(this, "eventName", 'ui:damageVignette');
        /** @attribute @type {boolean} @title Smart Stack Flashes */ _define_property(this, "stackSmartly", true);
    }
}
_define_property(DamageVignetteController, "scriptName", 'damageVignetteController');

export { DamageVignetteController };
