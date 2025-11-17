import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { FlankGoal } from '../atomic/tactical/FlankGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * FLANK EVALUATOR (UPDATED)
 * ==========================
 * Evaluates the desirability of flanking the target.
 *
 * KEY FIXES:
 * - Integrated with `globalCommitmentManager` to prevent goal thrashing.
 * This evaluator now respects and participates in the goal commitment system.
 */ function _safe(fn, fb = null) {
    try {
        const v = fn();
        return v === undefined ? fb : v;
    } catch  {
        return fb;
    }
}
function _num(v, d = 0) {
    return typeof v === 'number' && isFinite(v) ? v : d;
}
class FlankEvaluator extends YUKA.GoalEvaluator {
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) return 0;
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                engagementStartTime: 0,
                lastFlankAttempt: 0,
                samePositionTime: 0,
                lastPosition: null,
                lastDesirability: 0 // ✅ FIX: Cache desirability
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        let desirability = 0;
        // Must have visible target
        const hasTarget = agent?.targetSystem?.hasTarget?.();
        const visible = agent?.targetSystem?.isTargetVisible?.();
        if (!hasTarget || !visible) {
            st.engagementStartTime = 0;
            return 0;
        }
        // Track engagement duration
        if (st.engagementStartTime === 0) {
            st.engagementStartTime = now;
        }
        const engagementDuration = now - st.engagementStartTime;
        // Cooldown between flank attempts
        if (now - st.lastFlankAttempt < 8000) {
            return 0;
        }
        // Must be engaged long enough (stuck in firefight)
        if (engagementDuration < this.minEngagementTime) {
            return 0;
        }
        // Get health ratio
        const healthRatio = Math.max(0, Math.min(1, _num(agent.health, 0) / Math.max(1, _num(agent.maxHealth, 100))));
        // Don't flank if too wounded
        if (healthRatio < 0.4) {
            return 0;
        }
        // Get distance to target
        const target = agent.targetSystem.currentTarget;
        const targetEntity = target?.entity;
        const distance = targetEntity && typeof targetEntity.getPosition === 'function' ? agent.entity.getPosition().distance(targetEntity.getPosition()) : 999;
        // Check if in optimal flanking range
        let distanceScore = 0;
        if (distance >= this.optimalFlankDistance.min && distance <= this.optimalFlankDistance.max) {
            distanceScore = 1.0;
        } else if (distance < this.optimalFlankDistance.min) {
            distanceScore = 0.3; // Too close - flanking risky
        } else {
            // Too far - diminishing returns
            const overshoot = distance - this.optimalFlankDistance.max;
            distanceScore = Math.max(0, 1.0 - overshoot / 20);
        }
        // Check if agent has been static (good candidate for repositioning)
        const currentPos = agent.entity.getPosition().clone();
        if (st.lastPosition) {
            const moved = currentPos.distance(st.lastPosition);
            if (moved < 2) {
                st.samePositionTime += 100; // Assuming 100ms update rate
            } else {
                st.samePositionTime = 0;
            }
        }
        st.lastPosition = currentPos;
        const staticBonus = Math.min(1.0, st.samePositionTime / 3000); // Max bonus after 3s static
        // Base desirability from engagement duration
        const engagementScore = Math.min(1.0, (engagementDuration - this.minEngagementTime) / 5000);
        // Get personality modifiers
        const personality = agent.personalitySystem;
        let personalityMultiplier = 1.0;
        if (personality) {
            // Tactical and aggressive agents flank more
            const tactical = personality.traits.accuracy || 0.5; // Using accuracy as tactical proxy
            const aggression = personality.traits.aggression || 0.5;
            // Flanking preference from personality
            if (personality.shouldFlank && personality.shouldFlank(distance, healthRatio)) {
                personalityMultiplier = 1.5;
            } else {
                personalityMultiplier = tactical * 0.6 + aggression * 0.4;
            }
        }
        // Combine factors
        desirability = engagementScore * distanceScore * (0.7 + staticBonus * 0.3) * personalityMultiplier * this.tweaker;
        // Check if already flanking
        const currentGoal = agent?.brain?.currentSubgoal?.();
        const isFlankingNow = currentGoal && currentGoal.constructor?.name === 'FlankGoal';
        if (isFlankingNow) {
            desirability *= 1.3; // Maintain commitment
        }
        const finalDesirability = Math.min(1, Math.max(0, desirability) * this.characterBias);
        // ✅ FIX: Integrate with commitment manager
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'flank', finalDesirability);
        let adjustedDesirability = finalDesirability + commitmentBonus;
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        st.lastDesirability = adjustedDesirability; // Cache for setGoal
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) return;
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        const currentGoal = brain.currentSubgoal?.();
        // ✅ FIX: Check commitment manager before switching
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'flank', st?.lastDesirability || 0, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] Flank goal blocked: ${switchEval.reason}`);
            return;
        }
        // ✅ END OF FIX
        const yukaVehicle = agent.agentCore?.getVehicle();
        if (!yukaVehicle) {
            Logger.warn(`[${agent.entity.name}] Cannot flank - no YUKA vehicle`);
            return;
        }
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new FlankGoal(yukaVehicle, agent));
        if (st) {
            st.lastFlankAttempt = performance.now();
            st.engagementStartTime = 0; // Reset engagement timer
        }
        Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] FLANKING TARGET`);
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = 0.9; // Lower than attack - flanking is situational
        this.agentStates = new Map();
        this.minEngagementTime = 5000; // Must be engaged for 5s before flanking
        this.optimalFlankDistance = {
            min: 10,
            max: 30
        }; // Meters
    }
}

export { FlankEvaluator };
