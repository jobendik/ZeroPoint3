import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedAttackGoal } from '../composite/AttackGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
// Use global YUKA variable (loaded as external library in PlayCanvas)
/**
 * ATTACK EVALUATOR (UPDATED)
 * ================
 * Calculates the desirability of attacking enemies.
 *
 * KEY FIXES:
 * - Added stalemate detection: If stuck in an AttackGoal for > 10 seconds,
 * desirability is reduced to allow tactical goals (like Flank) to activate.
 */ // Shared utility functions
function _safe(fn, fb = null) {
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
class EnhancedAttackEvaluator extends YUKA.GoalEvaluator {
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) {
            console.warn(`[AttackEvaluator] ❌ No agent or entity!`);
            return 0;
        }
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                targetLostFrames: 0,
                lastTargetVisibleTime: 0,
                lastAttackGoalStart: 0,
                lastAttackGoalEnd: 0,
                consecutiveAttackFailures: 0,
                isCurrentlyAttacking: false,
                attackDesireBoost: 0,
                lastDesirability: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        let desirability = 0;
        // REDUCED cooldown for faster re-engagement
        if (now - (st.lastAttackGoalEnd || 0) < this.cooldownTime) {
            return 0;
        }
        const hasTarget = !!agent?.targetSystem?.hasTarget?.();
        // 🔥 EMERGENCY DEBUG: Always log when called
        if (!this._debugLogCount) this._debugLogCount = 0;
        this._debugLogCount++;
        if (this._debugLogCount % 60 === 1) {
            console.log(`[${agent.entity.name}] 🔥 AttackEvaluator called (#${this._debugLogCount}), hasTarget=${hasTarget}`);
        }
        if (hasTarget) {
            const healthRatio = Math.max(0, Math.min(1, _num(agent.health, 0) / Math.max(1, _num(agent.maxHealth, 100))));
            // SIMPLIFIED: Check for ANY ammo, not just "usable"
            const hasAmmo = agent?.weaponSystem && Object.values(agent.weaponSystem.weapons || {}).some((w)=>w && w.unlocked && (w.ammo > 0 || w.magazine > 0));
            const visible = !!agent?.targetSystem?.isTargetVisible?.();
            // 🔥 EMERGENCY DEBUG: Log critical variables
            if (this._debugLogCount % 60 === 1) {
                console.log(`[${agent.entity.name}] 🔍 Combat check: visible=${visible}, hasAmmo=${hasAmmo}, HP=${(healthRatio * 100).toFixed(0)}%`);
            }
            if (visible) {
                st.targetLostFrames = 0;
                st.lastTargetVisibleTime = now;
                st.targetLostLogged = false; // Reset log flag when target becomes visible again
            } else {
                st.targetLostFrames++;
            }
            // ✅ FIX: If target hasn't been seen for too long, return 0 to allow patrol/explore
            const timeSinceVisible = now - (st.lastTargetVisibleTime || now);
            if (timeSinceVisible > this.targetLostTimeout) {
                // Only log ONCE when timeout first occurs (not every frame)
                if (!st.targetLostLogged) {
                    Logger.combat(`[${agent.entity.name}] 🔍 Target lost for ${(timeSinceVisible / 1000).toFixed(1)}s - switching to patrol/explore`);
                    st.targetLostLogged = true;
                }
                Logger.goal(`[${agent.entity.name}] AttackEvaluator: Target lost timeout - returning 0`);
                return 0; // Let other goals (patrol/explore) take over
            }
            // MORE FORGIVING visibility check for short-term occlusion
            const effectivelyVisible = visible || st.targetLostFrames < this.targetLostHysteresis;
            const visibilityScore = effectivelyVisible ? 1.0 : 0.15; // REDUCED from 0.3 for longer occlusion
            // ✅ HUMAN-LIKE BEHAVIOR: Critically wounded AI (<50% HP) reduces attack priority
            // but doesn't go to zero - they'll still shoot defensively while retreating
            let healthMul;
            if (healthRatio < 0.5) {
                // Critical HP: Reduce attack desire but allow defensive combat
                // Attack evaluator will be lower than health evaluator, so health goal wins
                // But AI can still shoot back if health goal enables defensive combat
                healthMul = visible ? 0.3 : 0.1; // Low but not zero
            } else if (healthRatio <= 0.60) {
                healthMul = visible ? 0.95 : 0.75;
            } else {
                healthMul = 1.0;
            }
            // Calculate base desirability with health consideration
            if (visible && hasAmmo) {
                desirability = 0.95 * healthMul; // Apply health multiplier to base
                // ✅ PHASE 2: Apply personality-based attack preference
                const personality = agent.personalitySystem;
                if (personality) {
                    const hasAdvantage = healthRatio > 0.6 && visible; // Simple advantage check
                    const personalityMultiplier = personality.getAttackDesirabilityMultiplier(healthRatio, hasAdvantage);
                    desirability *= personalityMultiplier;
                }
            } else {
                // Fallback calculation for edge cases
                desirability = this.tweaker * healthMul * (hasAmmo ? 1 : 0.3) * visibilityScore * 0.9;
                // Apply personality for non-ideal conditions
                const personality = agent.personalitySystem;
                if (personality) {
                    const hasAdvantage = healthRatio > 0.6 && visible;
                    const personalityMultiplier = personality.getAttackDesirabilityMultiplier(healthRatio, hasAdvantage);
                    desirability *= personalityMultiplier;
                }
            }
            const currentGoal = agent?.brain?.currentSubgoal?.();
            const isAttackNow = currentGoal && currentGoal.constructor?.name === 'EnhancedAttackGoal';
            if (isAttackNow) {
                st.isCurrentlyAttacking = true;
                const tSinceStart = now - (st.lastAttackGoalStart || 0);
                if (tSinceStart < this.commitmentTime) {
                    desirability *= 1.5;
                } else {
                    desirability *= 1.2;
                }
                // ✅ FIX: Stalemate detection
                // If we've been stuck in the same attack goal for a while, reduce desirability
                // This allows other tactical goals (like Flank) to win arbitration
                if (tSinceStart > this.STALEMATE_DURATION_MS) {
                    desirability *= this.STALEMATE_DESIRABILITY_MULTIPLIER;
                    Logger.aiState(`[${agent.entity.name}] Attack stalemate detected (${(tSinceStart / 1000).toFixed(0)}s) - reducing desire to allow tactics.`);
                }
                // ✅ END OF FIX
                if (currentGoal?.canBePreempted && !currentGoal.canBePreempted()) {
                    desirability = Math.max(desirability, 0.95);
                }
            } else {
                st.isCurrentlyAttacking = false;
                // LESS HARSH failure penalty
                if (st.consecutiveAttackFailures > 0) {
                    const penalty = Math.max(0.8, 1.0 - st.consecutiveAttackFailures * 0.05); // REDUCED penalty
                    desirability *= penalty;
                }
            }
            // Hysteresis for stability
            const wasHigh = st.lastDesirability > this.highPriorityThreshold;
            if (wasHigh && desirability > this.lowPriorityThreshold) {
                desirability = Math.max(desirability, this.lowPriorityThreshold + 0.1);
            } else if (!wasHigh && desirability > this.highPriorityThreshold) {
                st.attackDesireBoost = 0.15; // INCREASED boost
            }
            desirability += st.attackDesireBoost;
            st.attackDesireBoost = Math.max(0, st.attackDesireBoost - 0.02);
            // ✅ STRATEGIC MODULATION: Boost attack when in elimination mode
            if (agent.gameMode && agent.gameMode.type === 'team-deathmatch') {
                desirability *= 1.25; // 25% boost from strategic context
            }
            // DIAGNOSTIC: Log when we have target but low desirability (debug only)
            if (desirability < 0.5 && visible && Logger.isEnabled && Logger.isEnabled('GOALS')) {
                Logger.debug(`[${agent.entity.name}] Low attack desirability ${desirability.toFixed(2)} - visible:${visible}, hasAmmo:${hasAmmo}, health:${(healthRatio * 100).toFixed(0)}%`);
            }
        } else {
            st.isCurrentlyAttacking = false;
            st.targetLostFrames = Math.min(st.targetLostFrames + 1, 100);
            desirability = 0;
            Logger.goal(`[${agent.entity.name}] AttackEvaluator: No target - returning 0`);
        }
        st.lastDesirability = desirability;
        // ✅ COMMITMENT MANAGER: Apply commitment bonus if this is current goal
        try {
            const commitmentBonus = globalCommitmentManager?.getCommitmentBonus?.(agent, 'attack', desirability) || 0;
            if (commitmentBonus > 0) {
                desirability += commitmentBonus;
                Logger.debug(`[${agent.entity.name}] Attack commitment bonus: +${commitmentBonus.toFixed(2)}`);
            }
            // Update commitment manager with current score
            globalCommitmentManager?.updateCurrentGoalScore?.(agent, desirability);
        } catch (e) {
            // Gracefully handle if commitment manager not available
            Logger.debug(`[${agent.entity.name}] Commitment manager not available: ${e.message}`);
        }
        Logger.goal(`[${agent.entity.name}] AttackEvaluator: Final desirability = ${desirability.toFixed(3)} (hasTarget=${hasTarget})`);
        const finalValue = Math.min(1, Math.max(0, desirability) * this.characterBias);
        // 🔥 EMERGENCY DEBUG: Always log final value
        if (this._debugLogCount % 60 === 1) {
            console.log(`[${agent.entity.name}] 🎯 AttackEvaluator RESULT: ${(finalValue * 100).toFixed(1)}% (bias=${this.characterBias})`);
        }
        return finalValue;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) return;
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        const currentGoal = brain.currentSubgoal?.();
        const now = performance.now();
        // ✅ COMMITMENT MANAGER: Check if we should switch goals
        try {
            if (globalCommitmentManager?.evaluateGoalSwitch) {
                const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'attack', st?.lastDesirability || 0, currentGoal);
                if (!switchEval.shouldSwitch) {
                    Logger.debug(`[${agent.entity.name}] Attack goal blocked: ${switchEval.reason}`);
                    return;
                }
            }
        } catch (e) {
            Logger.debug(`[${agent.entity.name}] Commitment manager check failed: ${e.message}`);
        }
        if (currentGoal instanceof EnhancedAttackGoal) {
            if (currentGoal.canBePreempted && !currentGoal.canBePreempted()) return;
            if (st && now - (st.lastAttackGoalStart || 0) < this.commitmentTime) return;
        }
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new EnhancedAttackGoal(owner));
        if (st) {
            st.lastAttackGoalStart = now;
            st.isCurrentlyAttacking = true;
            st.consecutiveAttackFailures = 0;
        }
        Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] NEW COMMITTED ATTACK GOAL`);
    }
    onAttackGoalCompleted(agent, success, reason) {
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) return;
        const now = performance.now();
        st.lastAttackGoalEnd = now;
        st.isCurrentlyAttacking = false;
        if (success) {
            st.consecutiveAttackFailures = 0;
        } else {
            st.consecutiveAttackFailures++;
        }
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = 1.5; // INCREASED for more aggressive behavior
        this.targetLostHysteresis = 15; // Frames before considering target "lost"
        this.targetLostTimeout = 3000; // ✅ NEW: 3 seconds - if target not seen, switch to patrol/explore
        this.commitmentTime = 3000; // ✅ INCREASED from 2000ms → 3000ms (more stable)
        this.cooldownTime = 800; // ✅ INCREASED from 500ms → 800ms (less thrashing)
        this.agentStates = new Map();
        // ✅ FIX: Wider hysteresis gap for more stability
        this.highPriorityThreshold = 0.75; // Increased from 0.7
        this.lowPriorityThreshold = 0.45; // Decreased from 0.5 (wider 0.3 gap)
        // ✅ FIX: Stalemate detection
        this.STALEMATE_DURATION_MS = 10000; // 10 seconds
        this.STALEMATE_DESIRABILITY_MULTIPLIER = 0.5; // Reduce desire by 50%
    }
}

export { EnhancedAttackEvaluator };
