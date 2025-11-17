import { Script, EVENT_KEYDOWN, EVENT_KEYUP, EVENT_MOUSEDOWN, EVENT_MOUSEUP, KEY_1, KEY_2, KEY_3, KEY_R, KEY_SPACE, MOUSEBUTTON_LEFT } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../engine/logger.mjs';

function _define_property(obj, key, value) {
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
class WeaponInputHandler extends Script {
    initialize() {
        this.owner = this.targetEntity || this.entity;
        this.weaponSystem = this.owner.script && this.owner.script.weaponSystem ? this.owner.script.weaponSystem : null;
        this._ready = !!(this.weaponSystem && this.weaponSystem.ready);
        this._pending = [];
        this._bound = [];
        this._on(this.app, 'weaponSystem:ready', function(entity) {
            if (entity === this.owner) {
                this._ready = true;
                this._flushPending();
            }
        }, this);
        if (this.useLegacyAppEvents) {
            this._on(this.app, 'weapon:switch', this.onWeaponSwitch, this);
            this._on(this.app, 'weapon:reload', this.onReload, this);
            this._on(this.app, 'weapon:fire:start', this.onFireStart, this);
            this._on(this.app, 'weapon:fire:stop', this.onFireStop, this);
            this._on(this.app, 'weapon:input:switch', this.onWeaponSwitch, this);
            this._on(this.app, 'weapon:input:reload', this.onReload, this);
            this._on(this.app, 'weapon:input:fire:start', this.onFireStart, this);
            this._on(this.app, 'weapon:input:fire:stop', this.onFireStop, this);
        }
        if (this.enableKeyboard) {
            if (this.app.keyboard) {
                this._on(this.app.keyboard, EVENT_KEYDOWN, this._onKeyDown, this);
                this._on(this.app.keyboard, EVENT_KEYUP, this._onKeyUp, this);
            }
            if (this.app.mouse) {
                this._on(this.app.mouse, EVENT_MOUSEDOWN, this._onMouseDown, this);
                this._on(this.app.mouse, EVENT_MOUSEUP, this._onMouseUp, this);
            }
        }
    }
    destroy() {
        for(var i = 0; i < this._bound.length; i++){
            var b = this._bound[i];
            if (b && b.obj && b.evt && b.fn) {
                b.obj.off(b.evt, b.fn, b.ctx || this);
            }
        }
        this._bound.length = 0;
        this._pending.length = 0;
    }
    _on(obj, evt, fn, ctx) {
        obj.on(evt, fn, ctx || this);
        this._bound.push({
            obj: obj,
            evt: evt,
            fn: fn,
            ctx: ctx
        });
    }
    _emitRequest(name, data) {
        var payload = data || {};
        if (!payload.target && !payload.entity && !payload.targetEntity) {
            payload.target = this.owner;
        }
        this.app.fire(name, payload);
    }
    _deferOr(fn) {
        if (this._ready) {
            fn();
        } else {
            this._pending.push(fn);
        }
    }
    _flushPending() {
        if (!this._pending.length) return;
        var q = this._pending.slice();
        this._pending.length = 0;
        for(var i = 0; i < q.length; i++){
            try {
                q[i]();
            } catch (e) {
                Logger.warn('[WeaponInputHandler] deferred action failed:', e);
            }
        }
    }
    _resolveWeaponType(input) {
        if (!input && input !== 0) return null;
        if (typeof input === 'string') {
            return input;
        }
        if (typeof input === 'number') {
            if (input === 1) return this.slot1 || 'pistol';
            if (input === 2) return this.slot2 || 'machinegun';
            if (input === 3) return this.slot3 || 'shotgun';
            return null;
        }
        if (typeof input === 'object') {
            if (input.weaponType) return input.weaponType;
            if (input.weapon) return input.weapon;
            if (typeof input.slot === 'number') return this._resolveWeaponType(input.slot);
            if (typeof input.index === 'number') return this._resolveWeaponType(input.index);
        }
        return null;
    }
    onWeaponSwitch(data) {
        var weaponType = this._resolveWeaponType(data);
        if (!weaponType) return;
        var self = this;
        this._deferOr(function() {
            var payload = {
                weaponType: weaponType,
                targetPosition: data && data.targetPosition ? data.targetPosition : undefined
            };
            self._emitRequest('weapon:request:switch', payload);
        });
    }
    onReload(data) {
        var self = this;
        this._deferOr(function() {
            self._emitRequest('weapon:request:reload', data || {});
        });
    }
    onFireStart(data) {
        var self = this;
        this._deferOr(function() {
            self._emitRequest('weapon:request:fire_start', data || {});
        });
    }
    onFireStop(data) {
        var self = this;
        this._deferOr(function() {
            self._emitRequest('weapon:request:fire_stop', data || {});
        });
    }
    _onKeyDown(e) {
        if (e.key === KEY_1) {
            this.onWeaponSwitch(1);
            return;
        }
        if (e.key === KEY_2) {
            this.onWeaponSwitch(2);
            return;
        }
        if (e.key === KEY_3) {
            this.onWeaponSwitch(3);
            return;
        }
        if (e.key === KEY_R) {
            this.onReload();
            return;
        }
        if (e.key === KEY_SPACE) {
            this.onFireStart();
            return;
        }
    }
    _onKeyUp(e) {
        if (e.key === KEY_SPACE) {
            this.onFireStop();
        }
    }
    _onMouseDown(e) {
        if (e.button === MOUSEBUTTON_LEFT) {
            this.onFireStart();
        }
    }
    _onMouseUp(e) {
        if (e.button === MOUSEBUTTON_LEFT) {
            this.onFireStop();
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {pc.Entity} @title Weapon Owner */ _define_property(this, "targetEntity", null);
        /** @attribute @type {boolean} @default true @title Enable Keyboard Fallback */ _define_property(this, "enableKeyboard", true);
        /** @attribute @type {boolean} @default true @title Listen to Legacy App Events */ _define_property(this, "useLegacyAppEvents", true);
        /** @attribute @type {string} @default pistol @title Key 1 → */ _define_property(this, "slot1", 'pistol');
        /** @attribute @type {string} @default machinegun @title Key 2 → */ _define_property(this, "slot2", 'machinegun');
        /** @attribute @type {string} @default shotgun @title Key 3 → */ _define_property(this, "slot3", 'shotgun');
    }
}
_define_property(WeaponInputHandler, "scriptName", 'weaponInputHandler');

export { WeaponInputHandler };
