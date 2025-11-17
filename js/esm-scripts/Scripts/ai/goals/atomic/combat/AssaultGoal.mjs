import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AssaultGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        const vehiclePosition = new Vec3(this.owner.position.x, this.owner.position.y, this.owner.position.z);
        const targetPos = new Vec3(this.target.x, this.target.y, this.target.z);
        const toTarget = new Vec3().sub2(targetPos, vehiclePosition).normalize();
        // Generate assault position 4 units from target
        const assaultPos = this.agent.generateSafeTacticalPosition(targetPos, toTarget.scale(-1), aiConfig.goals.ASSAULT_APPROACH_DISTANCE, "assault");
        // Validate result
        if (!assaultPos) {
            Logger.warn(`[${this.agent.entity.name}] AssaultGoal: No valid assault position found`);
            return this.agent.navigation?.findValidRandomPosition() || null;
        }
        return assaultPos;
    }
    checkCompletion() {
        // ✅ FIX: Check if reached assault position OR within engagement range of target
        // Priority 1: Check if we reached our calculated assault position
        if (this.targetPosition) {
            const reachedPosition = this.getDistanceToTarget(this.targetPosition) < this.positionTolerance;
            if (reachedPosition) {
                Logger.tactic(`[${this.agent.entity.name}] Reached assault position`);
                return true;
            }
        }
        // Priority 2: Check if we're within engagement range of the actual target
        // (We might have approached from a different angle but still in good position)
        const distanceToTarget = this.owner.position.distanceTo(this.target);
        if (distanceToTarget < this.engagementRange) {
            Logger.tactic(`[${this.agent.entity.name}] Within assault engagement range (${distanceToTarget.toFixed(1)}m)`);
            return true;
        }
        return false;
    }
    constructor(owner, target, agent){
        super(owner, agent);
        this.target = target;
        this.actionDescription = "Assault attack";
        this.engagementRange = aiConfig.goals.ASSAULT_COMPLETION_DISTANCE; // Desired assault distance
        this.positionTolerance = aiConfig.goals.ASSAULT_APPROACH_DISTANCE; // How close to targetPosition we need to be
    }
}

export { AssaultGoal };
