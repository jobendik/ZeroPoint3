import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class TacticalRetreatGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        const vehiclePosition = new Vec3(this.owner.position.x, this.owner.position.y, this.owner.position.z);
        const threatPos = new Vec3(this.threat.x, this.threat.y, this.threat.z);
        const awayFromThreat = new Vec3().sub2(vehiclePosition, threatPos).normalize();
        // Generate safe retreat position
        const retreatPos = this.agent.generateSafeTacticalPosition(vehiclePosition, awayFromThreat, aiConfig.goals.RETREAT_DISTANCE, "retreat");
        // Validate result
        if (!retreatPos) {
            Logger.warn(`[${this.agent.entity.name}] TacticalRetreatGoal: No valid retreat position found`);
            return this.agent.navigation?.findValidRandomPosition() || null;
        }
        return retreatPos;
    }
    checkCompletion() {
        // Complete if target no longer visible (safe)
        if (!this.agent.targetSystem.isTargetVisible()) {
            return true;
        }
        // Complete if reached retreat position
        if (this.targetPosition) {
            return this.getDistanceToTarget(this.targetPosition) < aiConfig.goals.RETREAT_COMPLETION_THRESHOLD;
        }
        return false;
    }
    constructor(owner, threat, agent){
        super(owner, agent);
        this.threat = threat;
        this.actionDescription = "Tactical retreat";
    }
}

export { TacticalRetreatGoal };
