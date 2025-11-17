import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\\Users\\joben\\.vscode\\extensions\\playcanvas.playcanvas-0.2.2\\node_modules\\playcanvas\\build\\playcanvas.d.ts" />
class CautiousApproachGoal extends BaseMovementGoal {
    // ---------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------
    _pcFromYukaVec3(v) {
        return new Vec3(v.x, v.y, v.z);
    }
    /**
   * Unified position getter - tries YUKA position first, then PlayCanvas getPosition()
   * Returns raw position object (YUKA.Vector3 or pc.Vec3) or null
   */ _getRawPosition(obj) {
        if (!obj) return null;
        // YUKA vehicle - has .position property (YUKA.Vector3)
        if (obj.position && typeof obj.position.x === 'number') {
            return obj.position;
        }
        // PlayCanvas entity - has .getPosition() method (returns pc.Vec3)
        if (typeof obj.getPosition === 'function') {
            return obj.getPosition();
        }
        // Nested entity (agent.entity)
        if (obj.entity && typeof obj.entity.getPosition === 'function') {
            return obj.entity.getPosition();
        }
        return null;
    }
    /**
   * Gets owner position as YUKA.Vector3
   */ _getOwnerPositionYuka() {
        const rawPos = this._getRawPosition(this.owner);
        if (!rawPos) return null;
        // If it's already a YUKA.Vector3, clone it
        if (rawPos instanceof YUKA.Vector3) {
            return new YUKA.Vector3(rawPos.x, rawPos.y, rawPos.z);
        }
        // Otherwise convert from PlayCanvas Vec3
        return new YUKA.Vector3(rawPos.x, rawPos.y, rawPos.z);
    }
    _randInterval(min, max) {
        return min + Math.random() * (max - min);
    }
    // ---------------------------------------------------------------------------
    // Hooks used by BaseMovementGoal
    // ---------------------------------------------------------------------------
    beforeMove() {
        // Reduce owner max speed while this goal is active
        if (typeof this.owner?.maxSpeed === 'number') {
            this._originalMaxSpeed = this.owner.maxSpeed;
            this.owner.maxSpeed = Math.max(aiConfig.goals.CAUTIOUS_SPEED_MIN, this.owner.maxSpeed * this._speedFactor);
        }
        // Initialize timers
        this._time = 0;
        this._isPaused = false;
        this._pauseStartAbs = 0;
        this._nextPauseAbs = this._randInterval(aiConfig.goals.CAUTIOUS_FIRST_PAUSE_MIN, aiConfig.goals.CAUTIOUS_FIRST_PAUSE_MAX); // first pause window after start
    }
    calculateTargetPosition() {
        if (!this.target) {
            Logger.warn('[CautiousApproachGoal] No target supplied');
            return null;
        }
        const pcTarget = this._pcFromYukaVec3(this.target);
        const projected = this.agent?.navigation?.findValidNavMeshPosition?.(pcTarget, aiConfig.goals.CAUTIOUS_VALIDATION_RADIUS);
        if (!projected) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] CautiousApproach: target off-navmesh`);
            return null;
        }
        this._targetPcProjected = projected;
        return projected;
    }
    /**
   * Called every frame by BaseMovementGoal with a stable dt via getDeltaTime()
   * Frame-based timing ensures no setTimeout race conditions
   */ onExecuteTick() {
        // Safety check: ensure goal is still active
        if (this.status !== YUKA.Goal.STATUS.ACTIVE) return;
        const dt = this.getDeltaTime?.() ?? 0;
        if (dt <= 0) return;
        this._time += dt;
        // If currently paused, check for resume based on elapsed pause duration
        if (this._isPaused) {
            if (this._time - this._pauseStartAbs >= this._pauseDuration) {
                // Resume movement - verify goal still active and navigation ready
                if (this.status !== YUKA.Goal.STATUS.ACTIVE) return;
                if (!this.agent?.navigationReady) return;
                this._isPaused = false;
                // Schedule next pause at an absolute time in the future
                this._nextPauseAbs = this._time + this._randInterval(this._pauseIntervalMin, this._pauseIntervalMax);
                if (this._targetPcProjected) {
                    this.agent.navigation.moveTo(this._targetPcProjected);
                }
            }
            return; // do nothing else while paused
        }
        // Not paused: decide if it's time to pause
        if (this._time >= this._nextPauseAbs) {
            this._isPaused = true;
            this._pauseStartAbs = this._time;
            // Halt movement during surveillance pause
            this.agent?.navigation?.stopMovement?.();
            return;
        }
    }
    checkCompletion() {
        // Prefer adapter's arrival check
        if (typeof this.agent?.navigation?.isAtDestination === 'function') {
            if (this.agent.navigation.isAtDestination()) return true;
        }
        // Fallback proximity
        const pos = this._getOwnerPositionYuka();
        if (!pos || !this.target) return false;
        return pos.distanceTo(this.target) <= this._completeDist;
    }
    onTerminate() {
        // Restore original max speed if we changed it
        if (typeof this._originalMaxSpeed === 'number') {
            this.owner.maxSpeed = this._originalMaxSpeed;
            this._originalMaxSpeed = undefined;
        }
        // Ensure movement is stopped when goal ends
        try {
            this.agent?.navigation?.stopMovement?.();
        } catch (_) {}
    }
    /**
   * @param {any} owner  YUKA vehicle or facade
   * @param {YUKA.Vector3|{x:number,y:number,z:number}} target
   * @param {any} agent  AI facade with .navigation/.navigationReady
   */ constructor(owner, target, agent){
        super(owner, agent);
        // Normalize target to YUKA.Vector3
        this.target = target && typeof target.x === 'number' ? target instanceof YUKA.Vector3 ? target.clone() : new YUKA.Vector3(target.x, target.y, target.z) : null;
        // Behavior tuning - using config constants
        this._speedFactor = aiConfig.movement.cautiousSpeedMultiplier; // 70% speed while approaching
        this._completeDist = aiConfig.movement.cautiousCompleteDistance; // meters
        this._pauseDuration = aiConfig.movement.cautiousPauseDuration; // seconds (fixed)
        this._pauseIntervalMin = aiConfig.goals.CAUTIOUS_PAUSE_INTERVAL_MIN; // seconds (next pause spacing)
        this._pauseIntervalMax = aiConfig.goals.CAUTIOUS_PAUSE_INTERVAL_MAX; // seconds
        // Pause state (frame-time based)
        this._time = 0; // running time since activate()
        this._isPaused = false;
        this._pauseStartAbs = 0; // absolute time when pause started
        this._nextPauseAbs = 0; // absolute time for next pause
        // Movement state
        this._targetPcProjected = null;
        this._originalMaxSpeed = undefined;
    }
}

export { CautiousApproachGoal, CautiousApproachGoal as default };
