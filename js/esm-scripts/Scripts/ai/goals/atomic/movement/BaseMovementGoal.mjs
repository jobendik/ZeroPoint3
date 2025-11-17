import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class BaseMovementGoal extends YUKA.Goal {
    /**
     * Calculate where to move. Must be implemented by subclass.
     * @returns {pc.Vec3|null} Target position or null if invalid
     */ calculateTargetPosition() {
        throw new Error(`${this.constructor.name} must implement calculateTargetPosition()`);
    }
    /**
     * Check if goal is complete. Must be implemented by subclass.
     * @returns {boolean} True if goal should complete
     */ checkCompletion() {
        throw new Error(`${this.constructor.name} must implement checkCompletion()`);
    }
    /**
     * Optional: Custom logic before movement starts
     */ beforeMove() {
    // Override in subclass if needed
    }
    /**
     * Optional: Custom logic on each execute tick
     */ onExecuteTick() {
    // Override in subclass if needed
    }
    /**
     * Optional: Custom cleanup before navigation stops
     */ onTerminate() {
    // Override in subclass if needed
    }
    // === Core YUKA Goal Methods ===
    activate() {
        this.status = YUKA.Goal.STATUS.ACTIVE;
        // Check navigation availability
        if (!this.agent || !this.agent.navigationReady) {
            Logger.warn(`[${this.agent?.entity?.name}] ${this.constructor.name}: Navigation not ready`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Run any pre-move setup
        this.beforeMove();
        // Calculate target position
        this.targetPosition = this.calculateTargetPosition();
        if (!this.targetPosition) {
            Logger.warn(`[${this.agent.entity.name}] ${this.constructor.name}: Could not calculate valid position`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Attempt movement using new navigation adapter
        const success = this.agent.navigation?.moveTo(this.targetPosition);
        if (!success) {
            Logger.warn(`[${this.agent.entity.name}] ${this.constructor.name}: moveTo() failed - no path found`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Log action if description provided
        if (this.actionDescription) {
            Logger.tactic(`[${this.agent.entity.name}] ${this.actionDescription}`);
        }
    }
    execute() {
        if (this.status === YUKA.Goal.STATUS.FAILED) return;
        // Run custom per-tick logic
        this.onExecuteTick();
        // Check completion condition
        if (this.checkCompletion()) {
            this.status = YUKA.Goal.STATUS.COMPLETED;
        }
    }
    terminate() {
        // Run custom cleanup
        this.onTerminate();
        // Stop navigation using new adapter
        if (this.agent) {
            this.agent.navigation?.stopMovement();
        }
    }
    // === Helper Methods ===
    /**
     * Get distance from owner to a target position
     * @param {pc.Vec3|YUKA.Vector3} target - Target position
     * @returns {number} Distance in units
     */ getDistanceToTarget(target) {
        const targetVec = target instanceof YUKA.Vector3 ? target : new YUKA.Vector3(target.x, target.y, target.z);
        return this.owner.position.distanceTo(targetVec);
    }
    /**
     * Get delta time for this frame
     * @returns {number} Delta time in seconds
     */ getDeltaTime() {
        return this.agent?.app?.dt && typeof this.agent.app.dt === 'number' ? this.agent.app.dt : 0.016;
    }
    constructor(owner, agent){
        super(owner);
        this.agent = agent;
        this.targetPosition = null;
        this.actionDescription = null; // Set in subclass for logging
    }
}

export { BaseMovementGoal };
