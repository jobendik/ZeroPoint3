import { Vec2, Vec3, Mat4, Script, math } from '../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../config/ai.config.mjs';
import { StepOffset } from './step-offset.mjs';

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
const LOOK_MAX_ANGLE = aiConfig.player.LOOK_MAX_ANGLE;
new Vec2();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
class CharacterController {
    /**
     * @private
     */ // CharacterController._checkIfGrounded() — replace the whole method
    _checkIfGrounded() {
        const pos = this.entity.getPosition();
        // Prefer real collider data if available; otherwise fall back to an attribute
        const col = this.entity.collision;
        // If capsule: height is the full height, otherwise assume a reasonable default
        const fullHeight = col && typeof col.height === 'number' ? col.height : aiConfig.player.COLLIDER_HEIGHT_FALLBACK;
        const halfHeight = 0.5 * fullHeight;
        // Small margins to avoid false negatives when resting
        const startOffset = aiConfig.player.GROUND_CHECK_START_OFFSET; // push ray start slightly up
        const contactMargin = aiConfig.player.GROUND_CHECK_CONTACT_MARGIN; // extra distance beyond halfHeight
        const start = tmpV1.copy(pos);
        start.y += startOffset;
        const end = tmpV2.copy(pos);
        end.y -= halfHeight + contactMargin;
        this._grounded = !!this._rigidbody.system.raycastFirst(start, end);
    }
    /**
     * @private
     */ _jump() {
        if (this.controls.jump && !this._jumping && this._grounded) {
            this._jumping = true;
            setTimeout(()=>this._jumping = false, aiConfig.player.JUMP_COOLDOWN_MS);
            this._rigidbody.applyImpulse(0, this.jumpForce, 0);
        }
    }
    /**
     * @private
     */ _look() {
        this._camera.setLocalEulerAngles(this.look.x, this.look.y, 0);
    }
    /**
     * @param {number} dt - The delta time.
     */ _move(dt) {
        tmpM1.setFromAxisAngle(Vec3.UP, this.look.y);
        const dir = tmpV1.set(0, 0, 0);
        if (this.controls.forward) {
            dir.add(tmpV2.set(0, 0, -this.controls.forward));
        }
        if (this.controls.backward) {
            dir.add(tmpV2.set(0, 0, this.controls.backward));
        }
        if (this.controls.left) {
            dir.add(tmpV2.set(-this.controls.left, 0, 0));
        }
        if (this.controls.right) {
            dir.add(tmpV2.set(this.controls.right, 0, 0));
        }
        tmpM1.transformVector(dir, dir);
        // Check for step climbing before applying movement
        const horizontalDir = tmpV2.set(dir.x, 0, dir.z);
        if (horizontalDir.length() > 0.01) {
            horizontalDir.normalize();
            this._stepOffset.handleStep(horizontalDir, this._grounded);
        }
        let speed = this._grounded ? this.speedGround : this.speedAir;
        if (this.controls.sprint) {
            speed *= this.sprintMult;
        }
        const accel = dir.mulScalar(speed * dt);
        const velocity = this._rigidbody.linearVelocity.add(accel);
        const damping = this._grounded ? this.velocityDampingGround : this.velocityDampingAir;
        const mult = Math.pow(damping, dt * aiConfig.player.DAMPING_TIME_SCALE_MS);
        velocity.x *= mult;
        velocity.z *= mult;
        this._rigidbody.linearVelocity = velocity;
    }
    /**
     * Update movement state and fire events for weapon system
     * @private
     */ _updateMovementState() {
        // Check if character is currently moving
        const velocity = this._rigidbody.linearVelocity;
        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        const isMoving = horizontalSpeed > this.movementThreshold;
        // Check sprint state
        const isSprinting = this.controls.sprint && isMoving;
        // Fire movement events when state changes
        if (isMoving !== this._wasMoving) {
            if (isMoving) {
                // Started moving
                this.entity.fire('character:startedMoving');
                this.app.fire('character:startedMoving', this.entity);
            } else {
                // Stopped moving
                this.entity.fire('character:stoppedMoving');
                this.app.fire('character:stoppedMoving', this.entity);
            }
            this._wasMoving = isMoving;
        }
        // Fire sprint events when sprint state changes
        if (isSprinting !== this._wasSprinting) {
            this.entity.fire('character:sprintChanged', isSprinting);
            this.app.fire('character:sprintChanged', isSprinting);
            this._wasSprinting = isSprinting;
        }
    }
    /**
     * Get current velocity for footstep detection
     */ getVelocity() {
        return this._rigidbody.linearVelocity;
    }
    /**
     * Check if character is grounded
     */ isGrounded() {
        return this._grounded;
    }
    /**
     * Check if character is moving
     */ isMoving() {
        return this._wasMoving;
    }
    /**
     * Check if character is sprinting
     */ isSprinting() {
        return this._wasSprinting;
    }
    /**
     * Get camera forward vector for weapon targeting
     */ getCameraForward() {
        return this._camera.forward;
    }
    /**
     * Get camera entity
     */ getCamera() {
        return this._camera;
    }
    /**
     * @param {number} dt - The delta time.
     */ update(dt) {
        this._checkIfGrounded();
        this._jump();
        this._look();
        this._move(dt);
        this._updateMovementState();
    }
    destroy() {
        // Clean up event listeners
        this.app.off('cc:look');
        this.app.off('cc:move:forward');
        this.app.off('cc:move:backward');
        this.app.off('cc:move:left');
        this.app.off('cc:move:right');
        this.app.off('cc:jump');
        this.app.off('cc:sprint');
    }
    /**
     * @param {AppBase} app - The application.
     * @param {Entity} camera - The camera entity.
     * @param {Entity} entity - The controller entity.
     */ constructor(app, camera, entity){
        /**
     * @type {Entity}
     * @private
     */ _define_property(this, "_camera", void 0);
        /**
     * @type {RigidBodyComponent}
     * @private
     */ _define_property(this, "_rigidbody", void 0);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_jumping", false);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_grounded", false);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_wasMoving", false);
        /**
     * @type {boolean}
     * @private
     */ _define_property(this, "_wasSprinting", false);
        /**
     * @type {StepOffset}
     * @private
     */ _define_property(this, "_stepOffset", void 0);
        /**
     * @type {AppBase}
     */ _define_property(this, "app", void 0);
        /**
     * @type {Entity}
     */ _define_property(this, "entity", void 0);
        /**
     * @type {Vec2}
     */ _define_property(this, "look", new Vec2());
        /**
     * @type {Record<string, boolean | number>}
     */ _define_property(this, "controls", {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            jump: false,
            sprint: false
        });
        /**
     * @type {number}
     */ _define_property(this, "lookSens", aiConfig.player.LOOK_SENSITIVITY);
        /**
     * @type {number}
     */ _define_property(this, "speedGround", aiConfig.player.SPEED_GROUND);
        /**
     * @type {number}
     */ _define_property(this, "speedAir", aiConfig.player.SPEED_AIR);
        /**
     * @type {number}
     */ _define_property(this, "sprintMult", aiConfig.player.SPRINT_MULTIPLIER);
        /**
     * @type {number}
     */ _define_property(this, "velocityDampingGround", aiConfig.player.VELOCITY_DAMPING_GROUND);
        /**
     * @type {number}
     */ _define_property(this, "velocityDampingAir", aiConfig.player.VELOCITY_DAMPING_AIR);
        /**
     * @type {number}
     */ _define_property(this, "jumpForce", aiConfig.player.JUMP_FORCE);
        /**
     * @type {number}
     */ _define_property(this, "movementThreshold", aiConfig.player.MOVEMENT_THRESHOLD);
        /**
     * @type {number}
     */ _define_property(this, "maxStepHeight", aiConfig.player.MAX_STEP_HEIGHT);
        /**
     * @type {number}
     */ _define_property(this, "stepCheckDistance", aiConfig.player.STEP_CHECK_DISTANCE);
        this.app = app;
        this.entity = entity;
        if (!camera) {
            throw new Error('No camera entity found');
        }
        this._camera = camera;
        if (!entity.rigidbody) {
            throw new Error('No rigidbody component found');
        }
        this._rigidbody = entity.rigidbody;
        // Initialize step offset system
        this._stepOffset = new StepOffset(this._rigidbody, this.maxStepHeight, this.stepCheckDistance);
        // Set up input event listeners
        this.app.on('cc:look', (movX, movY)=>{
            this.look.x = math.clamp(this.look.x - movY * this.lookSens, -LOOK_MAX_ANGLE, LOOK_MAX_ANGLE);
            this.look.y -= movX * this.lookSens;
        });
        this.app.on('cc:move:forward', (val)=>{
            this.controls.forward = val;
        });
        this.app.on('cc:move:backward', (val)=>{
            this.controls.backward = val;
        });
        this.app.on('cc:move:left', (val)=>{
            this.controls.left = val;
        });
        this.app.on('cc:move:right', (val)=>{
            this.controls.right = val;
        });
        this.app.on('cc:jump', (state)=>{
            this.controls.jump = state;
        });
        this.app.on('cc:sprint', (state)=>{
            this.controls.sprint = state;
        });
    }
}
// ESM Script Class
class CharacterControllerScript extends Script {
    initialize() {
        this.controller = new CharacterController(this.app, this.camera, this.entity);
        // Apply attribute values
        this.controller.lookSens = this.lookSens;
        this.controller.speedGround = this.speedGround;
        this.controller.speedAir = this.speedAir;
        this.controller.sprintMult = this.sprintMult;
        this.controller.velocityDampingGround = this.velocityDampingGround;
        this.controller.velocityDampingAir = this.velocityDampingAir;
        this.controller.jumpForce = this.jumpForce;
        this.controller.movementThreshold = this.movementThreshold;
        this.controller.maxStepHeight = this.maxStepHeight;
        this.controller.stepCheckDistance = this.stepCheckDistance;
        this.on('destroy', ()=>this.controller.destroy());
    }
    update(dt) {
        this.controller.update(dt);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {pc.Entity} @title Camera Entity */ _define_property(this, "camera", null);
        /** @attribute @type {number} @default 0.08 @title Look Sensitivity */ _define_property(this, "lookSens", aiConfig.player.LOOK_SENSITIVITY);
        /** @attribute @type {number} @default 50 @title Ground Speed */ _define_property(this, "speedGround", aiConfig.player.SPEED_GROUND);
        /** @attribute @type {number} @default 5 @title Air Speed */ _define_property(this, "speedAir", aiConfig.player.SPEED_AIR);
        /** @attribute @type {number} @default 1.5 @title Sprint Multiplier */ _define_property(this, "sprintMult", aiConfig.player.SPRINT_MULTIPLIER);
        /** @attribute @type {number} @default 0.99 @title Ground Damping */ _define_property(this, "velocityDampingGround", aiConfig.player.VELOCITY_DAMPING_GROUND);
        /** @attribute @type {number} @default 0.99925 @title Air Damping */ _define_property(this, "velocityDampingAir", aiConfig.player.VELOCITY_DAMPING_AIR);
        /** @attribute @type {number} @default 600 @title Jump Force */ _define_property(this, "jumpForce", aiConfig.player.JUMP_FORCE);
        /** @attribute @type {number} @default 0.1 @title Movement Detection Threshold */ _define_property(this, "movementThreshold", aiConfig.player.MOVEMENT_THRESHOLD);
        /** @attribute @type {number} @default 0.5 @title Max Step Height */ _define_property(this, "maxStepHeight", aiConfig.player.MAX_STEP_HEIGHT);
        /** @attribute @type {number} @default 0.6 @title Step Check Distance */ _define_property(this, "stepCheckDistance", aiConfig.player.STEP_CHECK_DISTANCE);
    }
}
_define_property(CharacterControllerScript, "scriptName", 'characterController');

export { CharacterControllerScript };
