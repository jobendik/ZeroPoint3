import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from './BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class HuntGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        // ✅ FIX: Null-safety check for lastKnownPosition
        if (!this.lastKnownPosition) {
            Logger.warn(`[${this.agent.entity.name}] No lastKnownPosition - using random position`);
            return this.agent.navigation?.findValidRandomPosition();
        }
        const pcTarget = new Vec3(this.lastKnownPosition.x, this.lastKnownPosition.y, this.lastKnownPosition.z);
        const validTarget = this.agent.navigation?.findValidNavMeshPosition(pcTarget, 5);
        if (validTarget) {
            Logger.aiDetail(`[${this.agent.entity.name}] Hunting validated position`);
            return validTarget;
        }
        // Fallback to random position
        Logger.warn(`[${this.agent.entity.name}] Hunt target invalid, using random position`);
        return this.agent.navigation?.findValidRandomPosition();
    }
    onExecuteTick() {
        this.huntTimer += this.getDeltaTime();
    }
    checkCompletion() {
        // Complete if target becomes visible again
        if (this.agent.targetSystem.isTargetVisible()) {
            return true;
        }
        // Timeout after max hunt time
        if (this.huntTimer > this.maxHuntTime) {
            return true;
        }
        // Complete if we've reached the last known position
        if (this.lastKnownPosition) {
            return this.owner.position.distanceTo(this.lastKnownPosition) < aiConfig.goals.HUNT_ARRIVAL_THRESHOLD;
        }
        return false;
    }
    constructor(owner, lastKnownPosition, agent){
        super(owner, agent);
        this.lastKnownPosition = lastKnownPosition;
        this.huntTimer = 0;
        this.maxHuntTime = aiConfig.goals.HUNT_MAX_TIME; // 8 seconds maximum
    }
}

export { HuntGoal };
