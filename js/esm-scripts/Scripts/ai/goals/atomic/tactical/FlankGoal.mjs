import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { Logger } from '../../../../core/engine/logger.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class FlankGoal extends BaseMovementGoal {
    beforeMove() {
        // Must have target
        if (!this.agent.targetSystem?.hasTarget?.()) {
            Logger.warn(`[${this.agent.entity.name}] Cannot flank: no target`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        this.targetEntity = this.agent.targetSystem.currentTarget;
    }
    calculateTargetPosition() {
        if (!this.targetEntity) {
            Logger.warn(`[${this.agent.entity.name}] No target for flanking`);
            return null;
        }
        const agentPos = this.agent.entity.getPosition();
        const targetPos = this.targetEntity.getPosition();
        // Vector from target to agent
        const toAgent = new Vec3().sub2(agentPos, targetPos);
        toAgent.normalize();
        // Randomly choose left or right flank
        const flankDir = Math.random() < aiConfig.goals.MANEUVER_CHOICE_THRESHOLD ? 1 : -1;
        // Use personality to determine flank angle
        let angle = aiConfig.goals.FLANK_ANGLE_DEFAULT; // Default perpendicular
        const personality = this.agent.personalitySystem;
        if (personality) {
            // Aggressive: rear flanks
            // Tactical: side flanks
            if (personality.traits.aggression > aiConfig.goals.FLANK_AGGRESSION_THRESHOLD) {
                angle = aiConfig.goals.FLANK_ANGLE_AGGRESSIVE_MIN + Math.random() * aiConfig.goals.FLANK_ANGLE_AGGRESSIVE_VARIANCE;
            } else {
                angle = aiConfig.goals.FLANK_ANGLE_TACTICAL_MIN + Math.random() * aiConfig.goals.FLANK_ANGLE_TACTICAL_VARIANCE;
            }
        }
        // Rotate toAgent vector by flank angle
        const rad = angle * flankDir * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotated = new Vec3();
        rotated.x = toAgent.x * cos - toAgent.z * sin;
        rotated.z = toAgent.x * sin + toAgent.z * cos;
        rotated.normalize();
        // Calculate flank position
        const flankPos = targetPos.clone().add(rotated.mulScalar(this.flankDistance));
        flankPos.y = agentPos.y; // Keep same height
        // Validate position on navmesh
        const validPos = this.agent.navigation?.findValidNavMeshPosition(flankPos, aiConfig.goals.FLANK_VALIDATION_RADIUS);
        if (!validPos) {
            Logger.warn(`[${this.agent.entity.name}] Flank position not on navmesh, using fallback`);
            return this.agent.navigation?.findValidRandomPosition();
        }
        Logger.tactic(`[${this.agent.entity.name}] Flanking at ${Math.round(angle)}° (${flankDir > 0 ? 'RIGHT' : 'LEFT'})`);
        return validPos;
    }
    onExecuteTick() {
        this.timer += this.getDeltaTime();
        // Abort if lost target
        if (!this.agent.targetSystem?.hasTarget?.()) {
            Logger.goal(`[${this.agent.entity.name}] Flank aborted: lost target`);
            this.status = YUKA.Goal.STATUS.FAILED;
        }
    }
    checkCompletion() {
        // Timeout
        if (this.timer > this.maxDuration) {
            Logger.goal(`[${this.agent.entity.name}] Flank timeout`);
            return true;
        }
        // Reached position
        if (this.targetPosition) {
            const distance = this.agent.entity.getPosition().distance(this.targetPosition);
            if (distance < this.arrivalThreshold) {
                Logger.goal(`[${this.agent.entity.name}] Reached flank position`);
                return true;
            }
        }
        return false;
    }
    constructor(owner, agent){
        super(owner, agent);
        this.flankDistance = aiConfig.goals.FLANK_DISTANCE;
        this.arrivalThreshold = aiConfig.goals.FLANK_ARRIVAL_THRESHOLD;
        this.maxDuration = aiConfig.goals.FLANK_MAX_DURATION;
        this.timer = 0;
        this.targetEntity = null;
        this.actionDescription = "Flanking target";
    }
}

export { FlankGoal };
