import { EventHandler, Vec2, Vec3, Vec4, Quat, Color, AppBase, Entity } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Easing Functions
 */ const Linear = (k)=>k;
const QuadraticIn = (k)=>k * k;
const QuadraticOut = (k)=>k * (2 - k);
const QuadraticInOut = (k)=>{
    if ((k *= 2) < 1) return 0.5 * k * k;
    return -0.5 * (--k * (k - 2) - 1);
};
const CubicIn = (k)=>k * k * k;
const CubicOut = (k)=>--k * k * k + 1;
const CubicInOut = (k)=>{
    if ((k *= 2) < 1) return 0.5 * k * k * k;
    return 0.5 * ((k -= 2) * k * k + 2);
};
const QuarticIn = (k)=>k * k * k * k;
const QuarticOut = (k)=>1 - --k * k * k * k;
const QuarticInOut = (k)=>{
    if ((k *= 2) < 1) return 0.5 * k * k * k * k;
    return -0.5 * ((k -= 2) * k * k * k - 2);
};
const QuinticIn = (k)=>k * k * k * k * k;
const QuinticOut = (k)=>--k * k * k * k * k + 1;
const QuinticInOut = (k)=>{
    if ((k *= 2) < 1) return 0.5 * k * k * k * k * k;
    return 0.5 * ((k -= 2) * k * k * k * k + 2);
};
const SineIn = (k)=>{
    if (k === 0) return 0;
    if (k === 1) return 1;
    return 1 - Math.cos(k * Math.PI / 2);
};
const SineOut = (k)=>{
    if (k === 0) return 0;
    if (k === 1) return 1;
    return Math.sin(k * Math.PI / 2);
};
const SineInOut = (k)=>{
    if (k === 0) return 0;
    if (k === 1) return 1;
    return 0.5 * (1 - Math.cos(Math.PI * k));
};
const ExponentialIn = (k)=>k === 0 ? 0 : Math.pow(1024, k - 1);
const ExponentialOut = (k)=>k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
const ExponentialInOut = (k)=>{
    if (k === 0) return 0;
    if (k === 1) return 1;
    if ((k *= 2) < 1) return 0.5 * Math.pow(1024, k - 1);
    return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
};
const CircularIn = (k)=>1 - Math.sqrt(1 - k * k);
const CircularOut = (k)=>Math.sqrt(1 - --k * k);
const CircularInOut = (k)=>{
    if ((k *= 2) < 1) return -0.5 * (Math.sqrt(1 - k * k) - 1);
    return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
};
const ElasticIn = (k)=>{
    const p = 0.4;
    let s, a = 0.1;
    if (k === 0) return 0;
    if (k === 1) return 1;
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else s = p * Math.asin(1 / a) / (2 * Math.PI);
    return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
};
const ElasticOut = (k)=>{
    const p = 0.4;
    let s, a = 0.1;
    if (k === 0) return 0;
    if (k === 1) return 1;
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else s = p * Math.asin(1 / a) / (2 * Math.PI);
    return a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1;
};
const ElasticInOut = (k)=>{
    const p = 0.4;
    let s, a = 0.1;
    if (k === 0) return 0;
    if (k === 1) return 1;
    if (!a || a < 1) {
        a = 1;
        s = p / 4;
    } else s = p * Math.asin(1 / a) / (2 * Math.PI);
    if ((k *= 2) < 1) return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
    return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
};
const BackIn = (k)=>{
    const s = 1.70158;
    return k * k * ((s + 1) * k - s);
};
const BackOut = (k)=>{
    const s = 1.70158;
    return --k * k * ((s + 1) * k + s) + 1;
};
const BackInOut = (k)=>{
    const s = 1.70158 * 1.525;
    if ((k *= 2) < 1) return 0.5 * (k * k * ((s + 1) * k - s));
    return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
};
const BounceOut = (k)=>{
    if (k < 1 / 2.75) {
        return 7.5625 * k * k;
    } else if (k < 2 / 2.75) {
        return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
    } else if (k < 2.5 / 2.75) {
        return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
    }
    return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
};
const BounceIn = (k)=>1 - BounceOut(1 - k);
const BounceInOut = (k)=>{
    if (k < 0.5) return BounceIn(k * 2) * 0.5;
    return BounceOut(k * 2 - 1) * 0.5 + 0.5;
};
/**
 * TweenManager - Handles updating tweens
 */ class TweenManager {
    add(tween) {
        this._add.push(tween);
        return tween;
    }
    update(dt) {
        let i = 0;
        let n = this._tweens.length;
        while(i < n){
            if (this._tweens[i].update(dt)) {
                i++;
            } else {
                this._tweens.splice(i, 1);
                n--;
            }
        }
        if (this._add.length) {
            for(let i = 0; i < this._add.length; i++){
                if (this._tweens.indexOf(this._add[i]) > -1) continue;
                this._tweens.push(this._add[i]);
            }
            this._add.length = 0;
        }
    }
    stopAllTweens() {
        this._tweens.forEach((tween)=>tween.stop());
        this._tweens.length = 0;
        this._add.length = 0;
    }
    trackTween(tween) {
        return this.add(tween);
    }
    constructor(){
        this._tweens = [];
        this._add = [];
    }
}
/**
 * Tween class - Handles property animation
 */ class Tween extends EventHandler {
    _parseProperties(properties) {
        let _properties;
        if (properties instanceof Vec2) {
            _properties = {
                x: properties.x,
                y: properties.y
            };
        } else if (properties instanceof Vec3) {
            _properties = {
                x: properties.x,
                y: properties.y,
                z: properties.z
            };
        } else if (properties instanceof Vec4) {
            _properties = {
                x: properties.x,
                y: properties.y,
                z: properties.z,
                w: properties.w
            };
        } else if (properties instanceof Quat) {
            _properties = {
                x: properties.x,
                y: properties.y,
                z: properties.z,
                w: properties.w
            };
        } else if (properties instanceof Color) {
            _properties = {
                r: properties.r,
                g: properties.g,
                b: properties.b
            };
            if (properties.a !== undefined) {
                _properties.a = properties.a;
            }
        } else {
            _properties = properties;
        }
        return _properties;
    }
    to(properties, duration, easing, delay, repeat, yoyo) {
        this._properties = this._parseProperties(properties);
        this.duration = duration;
        if (easing) this.easing = easing;
        if (delay) this.delay(delay);
        if (repeat) this.repeat(repeat);
        if (yoyo) this.yoyo(yoyo);
        return this;
    }
    from(properties, duration, easing, delay, repeat, yoyo) {
        this._properties = this._parseProperties(properties);
        this.duration = duration;
        if (easing) this.easing = easing;
        if (delay) this.delay(delay);
        if (repeat) this.repeat(repeat);
        if (yoyo) this.yoyo(yoyo);
        this._from = true;
        return this;
    }
    rotate(properties, duration, easing, delay, repeat, yoyo) {
        this._properties = this._parseProperties(properties);
        this.duration = duration;
        if (easing) this.easing = easing;
        if (delay) this.delay(delay);
        if (repeat) this.repeat(repeat);
        if (yoyo) this.yoyo(yoyo);
        this._slerp = true;
        return this;
    }
    start() {
        let prop, _x, _y, _z;
        this.playing = true;
        this.complete = false;
        this.stopped = false;
        this._count = 0;
        this.pending = this._delay > 0;
        if (this._reverse && !this.pending) {
            this.time = this.duration;
        } else {
            this.time = 0;
        }
        if (this._from) {
            for(prop in this._properties){
                if (this._properties.hasOwnProperty(prop)) {
                    this._sv[prop] = this._properties[prop];
                    this._ev[prop] = this.target[prop];
                }
            }
            if (this._slerp) {
                this._toQuat.setFromEulerAngles(this.target.x, this.target.y, this.target.z);
                _x = this._properties.x !== undefined ? this._properties.x : this.target.x;
                _y = this._properties.y !== undefined ? this._properties.y : this.target.y;
                _z = this._properties.z !== undefined ? this._properties.z : this.target.z;
                this._fromQuat.setFromEulerAngles(_x, _y, _z);
            }
        } else {
            for(prop in this._properties){
                if (this._properties.hasOwnProperty(prop)) {
                    this._sv[prop] = this.target[prop];
                    this._ev[prop] = this._properties[prop];
                }
            }
            if (this._slerp) {
                _x = this._properties.x !== undefined ? this._properties.x : this.target.x;
                _y = this._properties.y !== undefined ? this._properties.y : this.target.y;
                _z = this._properties.z !== undefined ? this._properties.z : this.target.z;
                if (this._properties.w !== undefined) {
                    this._fromQuat.copy(this.target);
                    this._toQuat.set(_x, _y, _z, this._properties.w);
                } else {
                    this._fromQuat.setFromEulerAngles(this.target.x, this.target.y, this.target.z);
                    this._toQuat.setFromEulerAngles(_x, _y, _z);
                }
            }
        }
        this._currentDelay = this._delay;
        this.manager.add(this);
        return this;
    }
    pause() {
        this.playing = false;
    }
    resume() {
        this.playing = true;
    }
    stop() {
        this.playing = false;
        this.stopped = true;
    }
    delay(delay) {
        this._delay = delay;
        this.pending = true;
        return this;
    }
    repeat(num, delay) {
        this._count = 0;
        this._numRepeats = num;
        this._repeatDelay = delay || 0;
        return this;
    }
    loop(loop) {
        if (loop) {
            this._count = 0;
            this._numRepeats = Infinity;
        } else {
            this._numRepeats = 0;
        }
        return this;
    }
    yoyo(yoyo) {
        this._yoyo = yoyo;
        return this;
    }
    reverse() {
        this._reverse = !this._reverse;
        return this;
    }
    chain(...tweens) {
        for(let i = 0; i < tweens.length - 1; i++)tweens[i]._chained = tweens[i + 1];
        if (tweens.length > 0) this._chained = tweens[0];
        return this;
    }
    onUpdate(callback) {
        this.on('update', callback);
        return this;
    }
    onComplete(callback) {
        this.on('complete', callback);
        return this;
    }
    onLoop(callback) {
        this.on('loop', callback);
        return this;
    }
    _applyToEntity() {
        if (!this.entity) return;
        // Element component support (legacy)
        if (this.element && this.entity.element) {
            this.entity.element[this.element] = this.target;
            return;
        }
        // NEW: apply hook
        if (this.apply === 'position') {
            this.entity.setLocalPosition(this.target);
        } else if (this.apply === 'eulerAngles') {
            this.entity.setLocalEulerAngles(this.target);
        } else if (this.apply === 'scale') {
            this.entity.setLocalScale(this.target);
        }
        if (this._slerp) {
            this.entity.setLocalRotation(this._quat);
        }
    }
    update(dt) {
        if (this.stopped) return false;
        if (!this.playing) return true;
        if (!this._reverse || this.pending) this.time += dt * this.timeScale;
        else this.time -= dt * this.timeScale;
        // Delay start if required
        if (this.pending) {
            if (this.time > this._currentDelay) {
                if (this._reverse) {
                    this.time = this.duration - (this.time - this._currentDelay);
                } else {
                    this.time -= this._currentDelay;
                }
                this.pending = false;
            } else {
                return true;
            }
        }
        let _extra = 0;
        if (!this._reverse && this.time > this.duration || this._reverse && this.time < 0) {
            this._count++;
            this.complete = true;
            this.playing = false;
            if (this._reverse) {
                _extra = this.duration - this.time;
                this.time = 0;
            } else {
                _extra = this.time - this.duration;
                this.time = this.duration;
            }
        }
        const elapsed = this.duration === 0 ? 1 : this.time / this.duration;
        const a = this.easing(elapsed);
        // Interpolate properties
        for(const prop in this._properties){
            if (this._properties.hasOwnProperty(prop)) {
                const s = this._sv[prop];
                const e = this._ev[prop];
                this.target[prop] = s + (e - s) * a;
            }
        }
        if (this._slerp) {
            this._quat.slerp(this._fromQuat, this._toQuat, a);
        }
        // Apply back to entity
        this._applyToEntity();
        this.fire('update', dt);
        if (this.complete) {
            const repeat = this._repeat(_extra);
            if (!repeat) {
                this.fire('complete', _extra);
                if (this.entity) {
                    this.entity.off('destroy', this.stop, this);
                }
                if (this._chained) this._chained.start();
            } else {
                this.fire('loop');
            }
            return repeat;
        }
        return true;
    }
    _repeat(extra) {
        if (this._count < this._numRepeats) {
            if (this._reverse) this.time = this.duration - extra;
            else this.time = extra;
            this.complete = false;
            this.playing = true;
            this._currentDelay = this._repeatDelay;
            this.pending = true;
            if (this._yoyo) {
                for(const prop in this._properties){
                    const tmp = this._sv[prop];
                    this._sv[prop] = this._ev[prop];
                    this._ev[prop] = tmp;
                }
                if (this._slerp) {
                    this._quat.copy(this._fromQuat);
                    this._fromQuat.copy(this._toQuat);
                    this._toQuat.copy(this._quat);
                }
            }
            return true;
        }
        return false;
    }
    constructor(target, manager, entity){
        super();
        this.manager = manager;
        this.entity = entity || null;
        this.time = 0;
        this.complete = false;
        this.playing = false;
        this.stopped = true;
        this.pending = false;
        this.target = target;
        this.duration = 0;
        this._currentDelay = 0;
        this.timeScale = 1;
        this._reverse = false;
        this._delay = 0;
        this._yoyo = false;
        this._count = 0;
        this._numRepeats = 0;
        this._repeatDelay = 0;
        this._from = false;
        // For rotation tween
        this._slerp = false;
        this._fromQuat = new Quat();
        this._toQuat = new Quat();
        this._quat = new Quat();
        this.easing = Linear;
        this._sv = {}; // start values
        this._ev = {}; // end values
        // NEW: how to apply values back to the entity each frame
        // Supported: 'position' | 'eulerAngles' | 'scale'
        this.apply = undefined;
        // For element component (legacy support)
        this.element = undefined;
    }
}
/**
 * Global manager registry
 */ const managers = new Map();
/**
 * Get or create a TweenManager for an app
 * @param {AppBase} app - The PlayCanvas application
 * @returns {TweenManager}
 */ const getTweenManager = (app)=>{
    if (!app || !(app instanceof AppBase)) {
        throw new Error('getTweenManager expects an instance of AppBase');
    }
    if (!managers.has(app)) {
        const tweenManager = new TweenManager();
        managers.set(app, tweenManager);
        app.on('update', (dt)=>{
            tweenManager.update(dt);
        });
        app.on('destroy', ()=>managers.delete(app));
    }
    return managers.get(app);
};
/**
 * Create a tween for an entity
 * @param {Entity} entity - The entity to tween
 * @param {object} target - The target properties (usually a Vec2/Vec3/Vec4)
 * @param {object} options - { apply?: 'position'|'eulerAngles'|'scale', element?: 'width'|'height'|... }
 * @returns {Tween}
 */ const tweenEntity = (entity, target, options)=>{
    const tweenManager = getTweenManager(entity._app);
    const tween = new Tween(target, tweenManager, entity);
    entity.once('destroy', tween.stop, tween);
    if (options?.element) {
        tween.element = options.element;
    }
    if (options?.apply) {
        tween.apply = options.apply;
    }
    return tween;
};
/**
 * Auto-extend PlayCanvas classes with tween methods
 */ const extendPlayCanvas = ()=>{
    try {
        if (AppBase && !AppBase.prototype.tween) {
            AppBase.prototype.tween = function(target) {
                const tweenManager = getTweenManager(this);
                return new Tween(target, tweenManager);
            };
        }
        if (Entity && !Entity.prototype.tween) {
            Entity.prototype.tween = function(target, options) {
                return tweenEntity(this, target, options);
            };
        }
        Logger.debug('Tween ESM module loaded successfully');
    } catch (e) {
        Logger.warn('Could not extend PlayCanvas classes:', e.message);
    }
};
// Auto-extend on import
extendPlayCanvas();

export { BackIn, BackInOut, BackOut, BounceIn, BounceInOut, BounceOut, CircularIn, CircularInOut, CircularOut, CubicIn, CubicInOut, CubicOut, ElasticIn, ElasticInOut, ElasticOut, ExponentialIn, ExponentialInOut, ExponentialOut, Linear, QuadraticIn, QuadraticInOut, QuadraticOut, QuarticIn, QuarticInOut, QuarticOut, QuinticIn, QuinticInOut, QuinticOut, SineIn, SineInOut, SineOut, Tween, TweenManager, getTweenManager, tweenEntity };
