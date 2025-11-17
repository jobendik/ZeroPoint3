import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from './BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class PatrolGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        // Convert YUKA vector to PlayCanvas vector
        const pcTarget = new Vec3(this.target.x, this.target.y, this.target.z);
        // Validate and project to navmesh
        const validTarget = this.agent.navigation?.findValidNavMeshPosition ? this.agent.navigation.findValidNavMeshPosition(pcTarget, aiConfig.goals.PATROL_VALIDATION_RADIUS) : pcTarget;
        if (validTarget) {
            Logger.aiDetail(`[${this.agent.entity.name}] PatrolGoal: Moving to waypoint ` + `(${validTarget.x.toFixed(1)}, ${validTarget.z.toFixed(1)})`);
            return validTarget;
        }
        // Fallback: use random position if target invalid
        Logger.warn(`[${this.agent.entity.name}] PatrolGoal: Invalid target, finding random position`);
        return this.agent.navigation?.findValidRandomPosition ? this.agent.navigation.findValidRandomPosition() : null;
    }
    checkCompletion() {
        return this.owner.position.distanceTo(this.target) < aiConfig.goals.PATROL_ARRIVAL_THRESHOLD;
    }
    constructor(owner, target, agent){
        super(owner, agent);
        this.target = target; // YUKA.Vector3
    }
}

export { PatrolGoal };
