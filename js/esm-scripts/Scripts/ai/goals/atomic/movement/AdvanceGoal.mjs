import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { BaseMovementGoal } from './BaseMovementGoal.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AdvanceGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        // Validate inputs
        if (!this.owner || !this.owner.position) {
            Logger.error('[AdvanceGoal] Owner position undefined');
            return null;
        }
        if (!this.target) {
            Logger.error('[AdvanceGoal] Target undefined');
            return null;
        }
        const vehiclePosition = new Vec3(this.owner.position.x, this.owner.position.y, this.owner.position.z);
        const targetPos = new Vec3(this.target.x, this.target.y, this.target.z);
        const toTarget = new Vec3().sub2(targetPos, vehiclePosition).normalize();
        // Generate advance position toward target
        const advancePos = this.agent.generateSafeTacticalPosition(vehiclePosition, toTarget, aiConfig.goals.ADVANCE_DISTANCE, 'advance');
        // Validate result
        if (!advancePos) {
            Logger.warn('[AdvanceGoal] No valid advance position found');
            return null;
        }
        return advancePos;
    }
    checkCompletion() {
        // ✅ FIX: Check if reached advance position OR within engagement range
        // Priority 1: Check if we reached our calculated advance position
        if (this.targetPosition) {
            const reachedPosition = this.getDistanceToTarget(this.targetPosition) < 3;
            if (reachedPosition) {
                Logger.tactic(`[${this.agent.entity.name}] Reached advance position`);
                return true;
            }
        }
        // Priority 2: Check if we're within engagement range of target
        // (Goal is to advance toward target, so being close enough to engage is success)
        const distanceToTarget = this.owner.position.distanceTo(this.target);
        if (distanceToTarget < 15) {
            Logger.tactic(`[${this.agent.entity.name}] Within engagement range (${distanceToTarget.toFixed(1)}m)`);
            return true;
        }
        return false;
    }
    constructor(owner, target, agent){
        super(owner, agent);
        this.target = target;
        this.actionDescription = "Advancing on target";
    }
}

export { AdvanceGoal };
