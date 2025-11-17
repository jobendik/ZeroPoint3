import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class SeekCoverGoal extends BaseMovementGoal {
    calculateTargetPosition() {
        // Use agent's cover detection system
        const coverPos = this.agent.navigation?.findValidCoverPosition();
        // Validate result
        if (!coverPos) {
            Logger.warn(`[${this.agent.entity.name}] SeekCoverGoal: No valid cover position found`);
            // Fallback to random position away from threat
            return this.agent.navigation?.findValidRandomPosition() || null;
        }
        return coverPos;
    }
    onExecuteTick() {
        this.elapsedTime += this.getDeltaTime();
    }
    checkCompletion() {
        // ✅ FIX: Check if actually reached cover position
        if (this.targetPosition) {
            const reachedCover = this.getDistanceToTarget(this.targetPosition) < aiConfig.goals.SEEK_COVER_COMPLETION_DISTANCE;
            if (reachedCover) {
                // Verify cover blocks line of sight to threat
                // Check if threat entity is no longer visible (means we're in cover)
                if (this.agent.targetSystem?.isTargetVisible) {
                    const threatVisible = this.agent.targetSystem.isTargetVisible();
                    if (!threatVisible) {
                        Logger.tactic(`[${this.agent.entity.name}] Successfully reached cover (threat not visible)`);
                        return true;
                    }
                }
                // Fallback: If we reached cover position, consider it complete
                // (targetSystem might not have the threat as current target)
                Logger.tactic(`[${this.agent.entity.name}] Reached cover position`);
                return true;
            }
        }
        // Fallback: Timeout if taking too long (might be stuck)
        if (this.elapsedTime > this.timeoutDuration) {
            Logger.warn(`[${this.agent.entity.name}] SeekCoverGoal timeout after ${this.timeoutDuration}s`);
            return true;
        }
        return false;
    }
    constructor(owner, threat, agent){
        super(owner, agent);
        this.threat = threat;
        this.actionDescription = "Seeking cover";
        this.timeoutDuration = aiConfig.goals.SEEK_COVER_TIMEOUT; // Max seconds to find cover
        this.elapsedTime = 0;
    }
}

export { SeekCoverGoal };
