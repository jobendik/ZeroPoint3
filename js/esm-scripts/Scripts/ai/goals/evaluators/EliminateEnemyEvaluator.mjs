import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EliminateEnemyGoal } from '../strategic/EliminateEnemyGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

/**
 * ELIMINATE ENEMY EVALUATOR (Strategic)
 * * Evaluates the desirability of the strategic objective.
 * In Team Deathmatch, this represents the core mission: eliminate enemies.
 */ class EliminateEnemyEvaluator extends YUKA.GoalEvaluator {
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) return 0;
        let desirability = this.tweaker;
        // Get agent state
        const healthRatio = Math.max(0, Math.min(1, agent.health / Math.max(1, agent.maxHealth)));
        const hasAmmo = agent?.hasUsableAmmo?.() || false;
        const hasTarget = agent?.targetSystem?.hasTarget?.();
        const targetVisible = hasTarget && agent.targetSystem?.isTargetVisible?.();
        // CRITICAL: Survival overrides strategic goal
        if (healthRatio < 0.25) {
            desirability *= 0.2;
        } else if (healthRatio < 0.5) {
            desirability *= 0.5;
        }
        // No ammo reduces strategic effectiveness
        if (!hasAmmo) {
            desirability *= 0.3;
        }
        // BOOST: Enemy visible - strategic goal aligns with tactical opportunity
        if (targetVisible) {
            desirability *= 1.5;
        } else if (hasTarget) {
            desirability *= 1.2;
        }
        // Apply personality modifiers if available
        if (agent.personalitySystem) {
            const aggression = agent.personalitySystem.aggressiveness || 0.7;
            desirability *= 0.7 + aggression * 0.3;
        }
        const finalDesirability = Math.min(1, Math.max(0, desirability) * this.characterBias);
        // ✅ FIX: Integrate with commitment manager
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'eliminate', finalDesirability);
        let adjustedDesirability = finalDesirability + commitmentBonus;
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        // ✅ FIX: Cache desirability for setGoal
        const agentId = _safe(()=>agent.entity.getGuid());
        if (agentId) {
            let st = this.agentStates.get(agentId);
            if (!st) {
                st = {};
                this.agentStates.set(agentId, st);
            }
            st.lastDesirability = adjustedDesirability;
        }
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) return;
        const currentGoal = brain.currentSubgoal?.();
        // ✅ FIX: Check commitment manager before switching
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : {
            lastDesirability: this.tweaker
        };
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'eliminate', st.lastDesirability || this.tweaker, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] EliminateEnemy goal blocked: ${switchEval.reason}`);
            return;
        }
        // ✅ END OF FIX
        // Don't interrupt if already pursuing this strategic goal
        if (currentGoal instanceof EliminateEnemyGoal) {
            return;
        }
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new EliminateEnemyGoal(owner));
        Logger.goal(agent, `[NEW STRATEGIC GOAL] Eliminate Enemy Team`);
    }
    constructor(characterBias = 1.0){
        super(characterBias);
        this.tweaker = 0.7; // Base strategic priority
        // ✅ FIX: Cache desirability for setGoal
        this.agentStates = new Map();
    }
}
// Helper
function _safe(fn, fb = null) {
    try {
        const v = fn();
        return v === undefined ? fb : v;
    } catch  {
        return fb;
    }
}

export { EliminateEnemyEvaluator };
