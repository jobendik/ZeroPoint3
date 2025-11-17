import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';

const STRAFE_DISTANCE = 3; // meters to strafe
const STRAFE_SPEED_MULTIPLIER = 0.8; // Slightly slower while strafing
class DodgeGoal extends YUKA.CompositeGoal {
    activate() {
        this.clearSubgoals();
        this.strafeStartTime = performance.now();
        const agent = this.agent;
        const entity = agent?.entity;
        if (!entity) {
            Logger.error('[DodgeGoal] No entity found');
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Get current position
        const currentPos = entity.getPosition();
        this.startPosition = currentPos.clone();
        // Calculate strafe direction (perpendicular to forward)
        const forward = entity.forward.clone().scale(-1); // ✅ Invert
        const right = new Vec3();
        right.cross(Vec3.UP, forward).normalize();
        // Strafe left or right
        const strafeDir = this.strafeRight ? right : right.clone().mulScalar(-1);
        // Check if we have space to strafe
        if (this.canMoveInDirection(strafeDir)) {
            // Calculate target position
            this.targetPosition.copy(currentPos);
            this.targetPosition.add(strafeDir.mulScalar(STRAFE_DISTANCE));
            Logger.tactic(`[${entity.name}] 🏃 Starting ${this.strafeRight ? 'RIGHT' : 'LEFT'} strafe`);
            // Command navigation to strafe
            if (agent.navigation?.moveTo) {
                agent.navigation.moveTo(this.targetPosition, STRAFE_SPEED_MULTIPLIER);
            }
            this.status = YUKA.Goal.STATUS.ACTIVE;
        } else {
            // No space - flip direction and set INACTIVE to retry
            Logger.tactic(`[${entity.name}] 🚫 No space to strafe ${this.strafeRight ? 'right' : 'left'}, flipping`);
            this.strafeRight = !this.strafeRight;
            this.status = YUKA.Goal.STATUS.INACTIVE; // Will reactivate next frame!
        }
    }
    execute() {
        if (!this.active()) return;
        const agent = this.agent;
        const entity = agent?.entity;
        if (!entity) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Check if target not shootable anymore (lost sight)
        const isTargetShootable = agent?.targetSystem?.isTargetVisible?.() || false;
        if (!isTargetShootable) {
            Logger.tactic(`[${entity.name}] Target not visible, stopping strafe`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        // Check if we've reached the strafe position
        const currentPos = entity.getPosition();
        const distance = currentPos.distance(this.targetPosition);
        const strafeTime = performance.now() - this.strafeStartTime;
        if (distance < 0.5 || strafeTime > this.maxStrafeTime) {
            // Completed this strafe - set INACTIVE to repeat!
            Logger.tactic(`[${entity.name}] ✅ Strafe ${this.strafeRight ? 'right' : 'left'} complete, repeating`);
            this.status = YUKA.Goal.STATUS.INACTIVE;
        }
    }
    terminate() {
        // Stop movement when goal terminates
        const agent = this.agent;
        if (agent?.navigation?.stopMovement) {
            agent.navigation.stopMovement();
        }
        this.clearSubgoals();
    }
    /**
     * Check if we can move in a direction without hitting obstacles
     * @param {pc.Vec3} direction - Direction to check (normalized)
     * @returns {boolean}
     */ canMoveInDirection(direction) {
        const agent = this.agent;
        const entity = agent?.entity;
        if (!entity) return false;
        const currentPos = entity.getPosition();
        const checkDistance = STRAFE_DISTANCE + 1; // Add buffer
        const targetPos = currentPos.clone().add(direction.clone().mulScalar(checkDistance));
        // Raycast to check for obstacles
        const app = entity.app;
        if (!app?.systems?.rigidbody) return true; // Assume safe if no physics
        // Check ground level
        const fromPos = currentPos.clone();
        fromPos.y += 0.5; // Chest height
        const toPos = targetPos.clone();
        toPos.y += 0.5;
        const result = app.systems.rigidbody.raycastFirst(fromPos, toPos);
        if (result) {
            const hitDistance = fromPos.distance(result.point);
            if (hitDistance < STRAFE_DISTANCE) {
                // Obstacle blocking path
                return false;
            }
        }
        // Check if target position is on navmesh
        if (agent.navigation?.isPositionValid) {
            return agent.navigation.isPositionValid(targetPos);
        }
        return true; // Assume safe if can't validate
    }
    /**
     * @param {Object} owner - YUKA vehicle owner
     * @param {boolean} strafeRight - True to strafe right, false for left
     * @param {Object} agent - PlayCanvas agent script
     */ constructor(owner, strafeRight = true, agent = null){
        super(owner);
        this.strafeRight = strafeRight;
        this.agent = agent || owner.agent || owner;
        this.targetPosition = new Vec3();
        this.startPosition = null;
        this.strafeStartTime = 0;
        this.maxStrafeTime = 2000; // 2 seconds max per strafe
    }
}

export { DodgeGoal };
