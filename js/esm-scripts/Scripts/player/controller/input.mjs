import { Script, Vec2 } from '../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
/**
 * Utility function for both touch and gamepad handling of deadzones. Takes a 2-axis joystick
 * position in the range -1 to 1 and applies an upper and lower radial deadzone, remapping values in
 * the legal range from 0 to 1.
 *
 * @param {Vec2} pos - The joystick position.
 * @param {Vec2} remappedPos - The remapped joystick position.
 * @param {number} deadZoneLow - The lower dead zone.
 * @param {number} deadZoneHigh - The upper dead zone.
 */ function applyRadialDeadZone(pos, remappedPos, deadZoneLow, deadZoneHigh) {
    const magnitude = pos.length();
    if (magnitude > deadZoneLow) {
        const legalRange = 1 - deadZoneHigh - deadZoneLow;
        const normalizedMag = Math.min(1, (magnitude - deadZoneLow) / legalRange);
        remappedPos.copy(pos).scale(normalizedMag / magnitude);
    } else {
        remappedPos.set(0, 0);
    }
}
class DesktopInput {
    set enabled(val) {
        this._enabled = val;
        if (val) {
            window.addEventListener('keydown', this._onKeyDown);
            window.addEventListener('keyup', this._onKeyUp);
            window.addEventListener('mousedown', this._onMouseDown);
            window.addEventListener('mouseup', this._onMouseUp);
            window.addEventListener('mousemove', this._onMouseMove);
            // Attach wheel to canvas (not window) to avoid page-wide blocking
            this._canvas.addEventListener('wheel', this._onWheel, this._wheelOpts);
        } else {
            window.removeEventListener('keydown', this._onKeyDown);
            window.removeEventListener('keyup', this._onKeyUp);
            window.removeEventListener('mousedown', this._onMouseDown);
            window.removeEventListener('mouseup', this._onMouseUp);
            window.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener('wheel', this._onWheel, this._wheelOpts);
        }
    }
    get enabled() {
        return this._enabled;
    }
    /**
     * @param {string} key - The key pressed.
     * @param {number} val - The key value.
     * @private
     */ _handleKey(key, val) {
        switch(key.toLowerCase()){
            case 'w':
            case 'arrowup':
                this.app.fire('cc:move:forward', val);
                break;
            case 's':
            case 'arrowdown':
                this.app.fire('cc:move:backward', val);
                break;
            case 'a':
            case 'arrowleft':
                this.app.fire('cc:move:left', val);
                break;
            case 'd':
            case 'arrowright':
                this.app.fire('cc:move:right', val);
                break;
            case ' ':
                this.app.fire('cc:jump', !!val);
                break;
            case 'shift':
                this.app.fire('cc:sprint', !!val);
                break;
            case 'r':
                if (val) this.app.fire('weapon:reload');
                break;
            case '1':
                if (val) this.app.fire('weapon:switch', 'pistol');
                break;
            case '2':
                if (val) this.app.fire('weapon:switch', 'machinegun');
                break;
            case '3':
                if (val) this.app.fire('weapon:switch', 'shotgun');
                break;
        }
    }
    _onWheel(e) {
        // Only react when pointer-locked to game canvas
        if (document.pointerLockElement !== this._canvas) return;
        // Prevent page scroll while playing
        e.preventDefault();
        const now = performance.now();
        if (now - this._lastWheelAt < this._wheelCooldownMs) return; // throttle
        this._lastWheelAt = now;
        // Most mice report positive deltaY when scrolling down
        const dir = e.deltaY > 0 ? +1 : -1;
        // Let Player decide which weapon string to switch to
        this.app.fire('weapon:cycle', dir);
    }
    /**
     * @param {KeyboardEvent} e - The keyboard event.
     * @private
     */ _onKeyDown(e) {
        if (document.pointerLockElement !== this._canvas) {
            return;
        }
        if (e.repeat) {
            return;
        }
        this._handleKey(e.key, 1);
    }
    /**
     * @param {KeyboardEvent} e - The keyboard event.
     * @private
     */ _onKeyUp(e) {
        if (e.repeat) {
            return;
        }
        this._handleKey(e.key, 0);
    }
    _onMouseDown(e) {
        if (document.pointerLockElement !== this._canvas) {
            this._canvas.requestPointerLock();
            return;
        }
        // Handle weapon firing
        if (e.button === 0) {
            this._shooting = true;
            this.app.fire('weapon:fire_start');
        }
    }
    _onMouseUp(e) {
        if (e.button === 0) {
            this._shooting = false;
            this.app.fire('weapon:fire_stop');
        }
    }
    /**
     * @param {MouseEvent} e - The mouse event.
     * @private
     */ _onMouseMove(e) {
        if (document.pointerLockElement !== this._canvas) {
            return;
        }
        const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
        this.app.fire('cc:look', movementX, movementY);
    }
    update(dt) {
        // Handle continuous firing for automatic weapons
        if (this._shooting) {
            this.app.fire('weapon:fire_continuous');
        }
    }
    destroy() {
        this.enabled = false;
    }
    constructor(app){
        /**
     * @type {HTMLCanvasElement}
     * @private
     */ _define_property(this, "_canvas", void 0);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_enabled", true);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_shooting", false);
        /**
     * @type {AppBase}
     */ _define_property(this, "app", void 0);
        this.app = app;
        this._canvas = app.graphicsDevice.canvas;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onWheel = this._onWheel.bind(this);
        // simple throttle to avoid overscrolling spam
        this._lastWheelAt = 0;
        this._wheelCooldownMs = aiConfig.player.WHEEL_SCROLL_COOLDOWN_MS;
        // Options objects stored for symmetric add/remove
        this._wheelOpts = {
            passive: false
        };
        this.enabled = true;
    }
}
class MobileInput {
    set enabled(val) {
        this._enabled = val;
        if (val) {
            this._canvas.addEventListener('touchstart', this._onTouchStart, this._touchOpts);
            this._canvas.addEventListener('touchmove', this._onTouchMove, this._touchOpts);
            this._canvas.addEventListener('touchend', this._onTouchEnd, this._touchOpts);
        } else {
            this._canvas.removeEventListener('touchstart', this._onTouchStart, this._touchOpts);
            this._canvas.removeEventListener('touchmove', this._onTouchMove, this._touchOpts);
            this._canvas.removeEventListener('touchend', this._onTouchEnd, this._touchOpts);
        }
    }
    get enabled() {
        return this._enabled;
    }
    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */ _onTouchStart(e) {
        // NOTE: No preventDefault() — listeners are passive and canvas has touch-action:none
        const xFactor = this._device.width / this._canvas.clientWidth;
        const yFactor = this._device.height / this._canvas.clientHeight;
        const touches = e.changedTouches;
        for(let i = 0; i < touches.length; i++){
            const touch = touches[i];
            if (touch.pageX <= this._canvas.clientWidth / 2 && this._leftStick.identifier === -1) {
                // Left virtual joystick
                this._leftStick.identifier = touch.identifier;
                this._leftStick.center.set(touch.pageX, touch.pageY);
                this._leftStick.pos.set(0, 0);
                this.app.fire('leftjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.pageX > this._canvas.clientWidth / 2 && this._rightStick.identifier === -1) {
                // Right virtual joystick
                this._rightStick.identifier = touch.identifier;
                this._rightStick.center.set(touch.pageX, touch.pageY);
                this._rightStick.pos.set(0, 0);
                this.app.fire('rightjoystick:enable', touch.pageX * xFactor, touch.pageY * yFactor);
                // Handle weapon firing and special actions
                const now = Date.now();
                if (now - this._lastRightTap < this._doubleTapInterval) {
                    // Double tap - jump
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this.app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(()=>this.app.fire('cc:jump', false), aiConfig.player.JUMP_COOLDOWN_MS);
                } else {
                    // Single tap - start firing
                    this._shooting = true;
                    this.app.fire('weapon:fire_start');
                }
                this._lastRightTap = now;
            }
        }
    }
    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */ _onTouchMove(e) {
        // NOTE: No preventDefault() — listeners are passive and canvas has touch-action:none
        const xFactor = this._device.width / this._canvas.clientWidth;
        const yFactor = this._device.height / this._canvas.clientHeight;
        const touches = e.changedTouches;
        for(let i = 0; i < touches.length; i++){
            const touch = touches[i];
            // Update the current positions of the two virtual joysticks
            if (touch.identifier === this._leftStick.identifier) {
                this._leftStick.pos.set(touch.pageX, touch.pageY);
                this._leftStick.pos.sub(this._leftStick.center);
                this._leftStick.pos.scale(1 / this.radius);
                this.app.fire('leftjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.pos.set(touch.pageX, touch.pageY);
                this._rightStick.pos.sub(this._rightStick.center);
                this._rightStick.pos.scale(1 / this.radius);
                this.app.fire('rightjoystick:move', touch.pageX * xFactor, touch.pageY * yFactor);
            }
        }
    }
    /**
     * @private
     * @param {TouchEvent} e - The touch event.
     */ _onTouchEnd(e) {
        // NOTE: No preventDefault() — listeners are passive and canvas has touch-action:none
        const touches = e.changedTouches;
        for(let i = 0; i < touches.length; i++){
            const touch = touches[i];
            // If this touch is one of the sticks, get rid of it...
            if (touch.identifier === this._leftStick.identifier) {
                this._leftStick.identifier = -1;
                this.app.fire('cc:move:forward', 0);
                this.app.fire('cc:move:backward', 0);
                this.app.fire('cc:move:left', 0);
                this.app.fire('cc:move:right', 0);
                this.app.fire('leftjoystick:disable');
            } else if (touch.identifier === this._rightStick.identifier) {
                this._rightStick.identifier = -1;
                // Stop firing when right stick is released
                if (this._shooting) {
                    this._shooting = false;
                    this.app.fire('weapon:fire_stop');
                }
                this.app.fire('rightjoystick:disable');
            }
        }
    }
    /**
     * @param {number} dt - The delta time.
     */ update(dt) {
        // Handle continuous firing for automatic weapons on mobile
        if (this._shooting) {
            this.app.fire('weapon:fire_continuous');
        }
        // Moving
        if (this._leftStick.identifier !== -1) {
            // Apply a lower radial dead zone. We don't need an upper zone like with a real joypad
            applyRadialDeadZone(this._leftStick.pos, this._remappedPos, this.deadZone, aiConfig.player.MOBILE_DEAD_ZONE_UPPER);
            const forward = -this._remappedPos.y;
            if (this._lastForward !== forward) {
                if (forward > 0) {
                    this.app.fire('cc:move:forward', Math.abs(forward));
                    this.app.fire('cc:move:backward', 0);
                }
                if (forward < 0) {
                    this.app.fire('cc:move:forward', 0);
                    this.app.fire('cc:move:backward', Math.abs(forward));
                }
                if (forward === 0) {
                    this.app.fire('cc:move:forward', 0);
                    this.app.fire('cc:move:backward', 0);
                }
                this._lastForward = forward;
            }
            const strafe = this._remappedPos.x;
            if (this._lastStrafe !== strafe) {
                if (strafe > 0) {
                    this.app.fire('cc:move:left', 0);
                    this.app.fire('cc:move:right', Math.abs(strafe));
                }
                if (strafe < 0) {
                    this.app.fire('cc:move:left', Math.abs(strafe));
                    this.app.fire('cc:move:right', 0);
                }
                if (strafe === 0) {
                    this.app.fire('cc:move:left', 0);
                    this.app.fire('cc:move:right', 0);
                }
                this._lastStrafe = strafe;
            }
        }
        // Looking
        if (this._rightStick.identifier !== -1) {
            // Apply a lower radial dead zone. We don't need an upper zone like with a real joypad
            applyRadialDeadZone(this._rightStick.pos, this._remappedPos, this.deadZone, aiConfig.player.MOBILE_DEAD_ZONE_UPPER);
            const movX = this._remappedPos.x * this.turnSpeed;
            const movY = this._remappedPos.y * this.turnSpeed;
            this.app.fire('cc:look', movX, movY);
        }
    }
    destroy() {
        this.enabled = false;
    }
    constructor(app){
        /**
     * @type {GraphicsDevice}
     * @private
     */ _define_property(this, "_device", void 0);
        /**
     * @type {HTMLCanvasElement}
     * @private
     */ _define_property(this, "_canvas", void 0);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_enabled", true);
        /**
     * @type {number}
     * @private
     */ _define_property(this, "_lastRightTap", 0);
        /**
     * @type {number}
     * @private
     */ _define_property(this, "_jumpTimeout", void 0);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_shooting", false);
        /**
     * @type {Vec2}
     * @private
     */ _define_property(this, "_remappedPos", new Vec2());
        /**
     * @type {{ identifier: number, center: Vec2; pos: Vec2 }}
     * @private
     */ _define_property(this, "_leftStick", {
            identifier: -1,
            center: new Vec2(),
            pos: new Vec2()
        });
        /**
     * @type {{ identifier: number, center: Vec2; pos: Vec2 }}
     * @private
     */ _define_property(this, "_rightStick", {
            identifier: -1,
            center: new Vec2(),
            pos: new Vec2()
        });
        /**
     * @type {AppBase}
     */ _define_property(this, "app", void 0);
        /**
     * @type {number}
     */ _define_property(this, "deadZone", aiConfig.player.MOBILE_DEAD_ZONE);
        /**
     * @type {number}
     */ _define_property(this, "turnSpeed", aiConfig.player.MOBILE_TURN_SPEED);
        /**
     * @type {number}
     */ _define_property(this, "radius", aiConfig.player.MOBILE_JOYSTICK_RADIUS);
        /**
     * @type {number}
     */ _define_property(this, "_doubleTapInterval", aiConfig.player.MOBILE_DOUBLE_TAP_INTERVAL_MS);
        /**
     * @type {number}
     */ _define_property(this, "_tripleTapInterval", aiConfig.player.MOBILE_TRIPLE_TAP_INTERVAL_MS);
        this.app = app;
        this._device = app.graphicsDevice;
        this._canvas = app.graphicsDevice.canvas;
        // Ensure the canvas does not trigger browser gestures / scrolling
        try {
            this._canvas.style.touchAction = 'none';
            this._canvas.style.msTouchAction = 'none';
            this._canvas.style.overscrollBehavior = 'none';
        } catch (e) {}
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
        // Options objects stored for symmetric add/remove
        this._touchOpts = {
            passive: true
        };
        this.enabled = true;
    }
}
class GamePadInput {
    /**
     * @param {number} dt - The delta time.
     */ update(dt) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for(let i = 0; i < gamepads.length; i++){
            const gamepad = gamepads[i];
            // Only proceed if we have at least 2 sticks
            if (gamepad && gamepad.mapping === 'standard' && gamepad.axes.length >= 4) {
                // Moving (left stick)
                this._leftStick.pos.set(gamepad.axes[0], gamepad.axes[1]);
                applyRadialDeadZone(this._leftStick.pos, this._remappedPos, this.deadZoneLow, this.deadZoneHigh);
                const forward = -this._remappedPos.y;
                if (this._lastForward !== forward) {
                    if (forward > 0) {
                        this.app.fire('cc:move:forward', Math.abs(forward));
                        this.app.fire('cc:move:backward', 0);
                    }
                    if (forward < 0) {
                        this.app.fire('cc:move:forward', 0);
                        this.app.fire('cc:move:backward', Math.abs(forward));
                    }
                    if (forward === 0) {
                        this.app.fire('cc:move:forward', 0);
                        this.app.fire('cc:move:backward', 0);
                    }
                    this._lastForward = forward;
                }
                const strafe = this._remappedPos.x;
                if (this._lastStrafe !== strafe) {
                    if (strafe > 0) {
                        this.app.fire('cc:move:left', 0);
                        this.app.fire('cc:move:right', Math.abs(strafe));
                    }
                    if (strafe < 0) {
                        this.app.fire('cc:move:left', Math.abs(strafe));
                        this.app.fire('cc:move:right', 0);
                    }
                    if (strafe === 0) {
                        this.app.fire('cc:move:left', 0);
                        this.app.fire('cc:move:right', 0);
                    }
                    this._lastStrafe = strafe;
                }
                // Looking (right stick)
                this._rightStick.pos.set(gamepad.axes[2], gamepad.axes[3]);
                applyRadialDeadZone(this._rightStick.pos, this._remappedPos, this.deadZoneLow, this.deadZoneHigh);
                const movX = this._remappedPos.x * this.turnSpeed;
                const movY = this._remappedPos.y * this.turnSpeed;
                this.app.fire('cc:look', movX, movY);
                // Jumping (A button - bottom button of right cluster)
                if (gamepad.buttons[0].pressed && !this._lastJump) {
                    if (this._jumpTimeout) {
                        clearTimeout(this._jumpTimeout);
                    }
                    this.app.fire('cc:jump', true);
                    this._jumpTimeout = setTimeout(()=>this.app.fire('cc:jump', false), aiConfig.player.JUMP_COOLDOWN_MS);
                }
                this._lastJump = gamepad.buttons[0].pressed;
                // Firing (RT - right trigger)
                const firePressed = gamepad.buttons[7] && gamepad.buttons[7].pressed;
                if (firePressed && !this._lastFire) {
                    this._shooting = true;
                    this.app.fire('weapon:fire_start');
                } else if (!firePressed && this._lastFire) {
                    this._shooting = false;
                    this.app.fire('weapon:fire_stop');
                }
                this._lastFire = firePressed;
                // Handle continuous firing
                if (this._shooting) {
                    this.app.fire('weapon:fire_continuous');
                }
                // Reload (X button)
                if (gamepad.buttons[2] && gamepad.buttons[2].pressed) {
                    this.app.fire('weapon:reload');
                }
                // Weapon switching (D-pad)
                if (gamepad.buttons[12] && gamepad.buttons[12].pressed) {
                    this.app.fire('weapon:switch', 'pistol');
                }
                if (gamepad.buttons[13] && gamepad.buttons[13].pressed) {
                    this.app.fire('weapon:switch', 'shotgun');
                }
                if (gamepad.buttons[14] && gamepad.buttons[14].pressed) {
                    this.app.fire('weapon:switch', 'machinegun');
                }
            }
        }
    }
    destroy() {}
    constructor(app){
        /**
     * @type {number}
     * @private
     */ _define_property(this, "_jumpTimeout", void 0);
        /**
     * @type {number}
     * @private
     */ _define_property(this, "_lastForward", 0);
        /**
     * @type {number}
     * @private
     */ _define_property(this, "_lastStrafe", 0);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_lastJump", false);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_lastFire", false);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_shooting", false);
        /**
     * @type {Vec2}
     * @private
     */ _define_property(this, "_remappedPos", new Vec2());
        /**
     * @type {{ center: Vec2; pos: Vec2 }}
     * @private
     */ _define_property(this, "_leftStick", {
            center: new Vec2(),
            pos: new Vec2()
        });
        /**
     * @type {{ center: Vec2; pos: Vec2 }}
     * @private
     */ _define_property(this, "_rightStick", {
            center: new Vec2(),
            pos: new Vec2()
        });
        /**
     * @type {AppBase}
     */ _define_property(this, "app", void 0);
        /**
     * @type {number}
     */ _define_property(this, "deadZoneLow", aiConfig.player.GAMEPAD_DEAD_ZONE_LOW);
        /**
     * @type {number}
     */ _define_property(this, "deadZoneHigh", aiConfig.player.GAMEPAD_DEAD_ZONE_HIGH);
        /**
     * @type {number}
     */ _define_property(this, "turnSpeed", aiConfig.player.GAMEPAD_TURN_SPEED);
        this.app = app;
    }
}
// ESM Script Classes
class DesktopInputScript extends Script {
    initialize() {
        this.input = new DesktopInput(this.app);
        this.on('enable', ()=>this.input.enabled = true);
        this.on('disable', ()=>this.input.enabled = false);
        this.on('destroy', ()=>this.input.destroy());
    }
    update(dt) {
        this.input.update(dt);
    }
}
_define_property(DesktopInputScript, "scriptName", 'desktopInput');
class MobileInputScript extends Script {
    initialize() {
        this.input = new MobileInput(this.app);
        this.input.deadZone = this.deadZone;
        this.input.turnSpeed = this.turnSpeed;
        this.input.radius = this.radius;
        this.input._doubleTapInterval = this._doubleTapInterval;
        this.on('enable', ()=>this.input.enabled = true);
        this.on('disable', ()=>this.input.enabled = false);
        this.on('destroy', ()=>this.input.destroy());
    }
    update(dt) {
        this.input.update(dt);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @min 0 @max 0.4 @default 0.3 @title Dead Zone */ _define_property(this, "deadZone", aiConfig.player.MOBILE_DEAD_ZONE);
        /** @attribute @type {number} @default 30 @title Turn Speed */ _define_property(this, "turnSpeed", aiConfig.player.MOBILE_TURN_SPEED);
        /** @attribute @type {number} @default 50 @title Radius */ _define_property(this, "radius", aiConfig.player.MOBILE_JOYSTICK_RADIUS);
        /** @attribute @type {number} @default 300 @title Double Tap Interval */ _define_property(this, "_doubleTapInterval", aiConfig.player.MOBILE_DOUBLE_TAP_INTERVAL_MS);
    }
}
_define_property(MobileInputScript, "scriptName", 'mobileInput');
class GamePadInputScript extends Script {
    initialize() {
        this.input = new GamePadInput(this.app);
        this.input.deadZoneLow = this.deadZoneLow;
        this.input.deadZoneHigh = this.deadZoneHigh;
        this.input.turnSpeed = this.turnSpeed;
        this.on('destroy', ()=>this.input.destroy());
    }
    update(dt) {
        this.input.update(dt);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @min 0 @max 0.4 @default 0.1 @title Low Dead Zone */ _define_property(this, "deadZoneLow", aiConfig.player.GAMEPAD_DEAD_ZONE_LOW);
        /** @attribute @type {number} @min 0 @max 0.4 @default 0.1 @title High Dead Zone */ _define_property(this, "deadZoneHigh", aiConfig.player.GAMEPAD_DEAD_ZONE_HIGH);
        /** @attribute @type {number} @default 30 @title Turn Speed */ _define_property(this, "turnSpeed", aiConfig.player.GAMEPAD_TURN_SPEED);
    }
}
_define_property(GamePadInputScript, "scriptName", 'gamePadInput');

export { DesktopInputScript, GamePadInputScript, MobileInputScript };
