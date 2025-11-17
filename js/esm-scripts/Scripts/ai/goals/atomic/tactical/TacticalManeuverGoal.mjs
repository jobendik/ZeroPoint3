import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class TacticalManeuverGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        const vehiclePosition = this.owner.position;
        const toTarget = new YUKA.Vector3().subVectors(this.target, vehiclePosition).normalize();
        const currentPos = new Vec3(vehiclePosition.x, vehiclePosition.y, vehiclePosition.z);
        if (this.maneuverType === 'strafe') {
            // Strafe perpendicular to target
            const strafeDirection = Math.random() > aiConfig.goals.MANEUVER_CHOICE_THRESHOLD ? 1 : -1;
            const right = new Vec3(-toTarget.z, 0, toTarget.x).normalize();
            const strafePos = this.agent.generateSafeTacticalPosition(currentPos, right, strafeDirection * aiConfig.goals.MANEUVER_STRAFE_DISTANCE, "strafe");
            // Validate result
            if (!strafePos) {
                Logger.warn(`[${this.agent.entity.name}] TacticalManeuverGoal: No valid strafe position found`);
                return this.agent.navigation?.findValidRandomPosition() || null;
            }
            return strafePos;
        } else {
            // Circle around target
            const angle = (Math.random() - aiConfig.goals.MANEUVER_CIRCLE_ANGLE_VARIANCE) * Math.PI * aiConfig.goals.MANEUVER_CIRCLE_ANGLE_VARIANCE;
            const distance = Math.min(toTarget.length(), aiConfig.goals.MANEUVER_CIRCLE_DISTANCE);
            const circleDir = new Vec3(toTarget.x, 0, toTarget.z).normalize();
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const newX = circleDir.x * cos - circleDir.z * sin;
            const newZ = circleDir.x * sin + circleDir.z * cos;
            const rotatedDir = new Vec3(newX, 0, newZ);
            const circlePos = this.agent.generateSafeTacticalPosition(currentPos, rotatedDir, distance, "circle");
            // Validate result
            if (!circlePos) {
                Logger.warn(`[${this.agent.entity.name}] TacticalManeuverGoal: No valid circle position found`);
                return this.agent.navigation?.findValidRandomPosition() || null;
            }
            return circlePos;
        }
    }
    onExecuteTick() {
        this.maneuverTimer += this.getDeltaTime();
    }
    checkCompletion() {
        // ✅ FIX: Check both timer AND position reached
        // Priority 1: Check if we reached our maneuver position
        if (this.targetPosition) {
            const reachedPosition = this.getDistanceToTarget(this.targetPosition) < this.positionTolerance;
            if (reachedPosition) {
                Logger.tactic(`[${this.agent.entity.name}] Completed ${this.maneuverType} maneuver (position reached)`);
                return true;
            }
        }
        // Priority 2: Timeout - maneuver duration elapsed
        if (this.maneuverTimer > this.maneuverDuration) {
            Logger.tactic(`[${this.agent.entity.name}] Completed ${this.maneuverType} maneuver (timer expired)`);
            return true;
        }
        return false;
    }
    constructor(owner, target, agent){
        super(owner, agent);
        this.target = target;
        this.maneuverTimer = 0;
        this.maneuverDuration = aiConfig.goals.MANEUVER_DURATION;
        this.maneuverType = Math.random() > aiConfig.goals.MANEUVER_CHOICE_THRESHOLD ? 'strafe' : 'circle';
        this.actionDescription = `Executing ${this.maneuverType} maneuver`;
        this.positionTolerance = aiConfig.goals.MANEUVER_POSITION_TOLERANCE; // How close to targetPosition we need to be
    }
}

export { TacticalManeuverGoal };
