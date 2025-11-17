import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedExploreGoal } from '../composite/ExploreGoal.mjs';
import { EnhancedAttackGoal } from '../composite/AttackGoal.mjs';
import { EnhancedGetHealthGoal } from '../composite/GetHealthGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * ExploreEvaluator.mjs
 * 
 * Evaluates the desirability of exploration behavior for AI agents.
 * Manages exploration timing, combat cooldowns, and sampling backoff mechanisms.
 * 
 * Features:
 * - Combat cooldown tracking (8 seconds after combat)
 * - Exploration cooldown (1.5 seconds between attempts)
 * - Sampling backoff (2-12 seconds exponential backoff on failed position sampling)
 * - Health and ammo state checking
 * - Investigation target prioritization
 * - Consecutive failure tracking
 */ // Shared utility functions
function _safe(fn, fallback = undefined) {
    try {
        return fn();
    } catch  {
        return fallback;
    }
}
function _num(val, fallback = 0) {
    const n = Number(val);
    return !isNaN(n) && isFinite(n) ? n : fallback;
}
/**
 * EnhancedExploreEvaluator - Calculates exploration desirability
 * 
 * Exploration is desirable when:
 * - No current target engaged
 * - Outside combat cooldown window (8 seconds)
 * - Outside exploration cooldown window (1.5 seconds)
 * - Health and ammo levels are adequate
 * - Not blocked by sampling backoff
 * 
 * Desirability is increased by:
 * - Investigation targets nearby
 * - High health levels
 * - Low alertness
 * 
 * Desirability is decreased by:
 * - Consecutive exploration failures
 * - Low health or ammo
 * - High alertness
 */ class EnhancedExploreEvaluator extends YUKA.GoalEvaluator {
    /**
     * Calculate desirability of exploration (0-1 score)
     * Returns 0 if exploration should be blocked
     */ calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) return 0;
        const now = performance.now();
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastCombatTime: 0,
                lastExplorationTime: 0,
                consecutiveExplorationFailures: 0,
                samplingBackoffMs: 0,
                lastSamplingFailure: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        // Check sampling backoff - block exploration if in backoff period
        if (st.samplingBackoffMs > 0 && now - st.lastSamplingFailure < st.samplingBackoffMs) {
            Logger.goal(`[${agent.entity.name}] ExploreEvaluator: Sampling backoff active (${st.samplingBackoffMs}ms) - returning 0`);
            return 0;
        }
        // Block exploration if agent has a target
        if (agent?.targetSystem?.hasTarget?.()) {
            st.lastCombatTime = now;
            Logger.goal(`[${agent.entity.name}] ExploreEvaluator: Has target - returning 0`);
            return 0;
        }
        // Reduce for combat cooldown but don't eliminate completely
        let combatPenalty = 1.0;
        if (now - (st.lastCombatTime || 0) < this.combatCooldownTime) {
            combatPenalty = 0.3; // Reduce but don't eliminate
        }
        // Reduce for exploration cooldown but don't eliminate completely  
        let explorationPenalty = 1.0;
        if (now - (st.lastExplorationTime || 0) < (this.explorationCooldown || 0)) {
            explorationPenalty = 0.4; // Reduce but don't eliminate
        }
        // Check health - low health reduces but doesn't eliminate exploration
        const maxH = Math.max(1, _num(agent.maxHealth, 100));
        const hR = Math.max(0, Math.min(1, _num(agent.health, maxH) / maxH));
        let healthMultiplier = 0.3 + hR * 0.7; // Never below 0.3
        // Check ammo - no usable ammo reduces but doesn't eliminate exploration
        let ammoMultiplier = agent?.hasUsableAmmo?.() ? 1.0 : 0.4;
        // High alertness reduces but doesn't eliminate exploration
        let alertnessMultiplier = 1.0;
        if (_num(agent.alertness, 0) > 0.7) {
            alertnessMultiplier = 0.5; // Reduce but don't eliminate
        }
        // Start with enhanced base desirability for better fallback behavior
        let desirability = Math.max(this.tweaker, 0.5) * combatPenalty * explorationPenalty * healthMultiplier * ammoMultiplier * alertnessMultiplier; // Boosted minimum for testing
        // Boost desirability if there's an investigation target nearby
        if (agent.investigationTarget) {
            const d = _num(_safe(()=>agent.entity.getPosition().distance(agent.investigationTarget), Infinity), Infinity);
            if (d < 50) {
                desirability *= 3.0; // Strong boost for nearby investigation targets
            } else {
                agent.investigationTarget = null; // Clear distant targets
            }
        }
        // Apply additional health scaling (healthier agents explore more)
        desirability *= 0.3 + hR * 0.7;
        // Apply navigation readiness multiplier (reduce but don't eliminate)
        if (!agent.navigationReady) {
            desirability *= 0.3; // Reduce but allow basic movement
        }
        // Apply failure penalty for consecutive exploration failures
        if (st.consecutiveExplorationFailures > 0) {
            const penalty = Math.max(0.3, 1.0 - st.consecutiveExplorationFailures * 0.2);
            desirability *= penalty;
        }
        // Reduce for combat/health goals but don't eliminate completely
        const currentGoal = agent?.brain?.currentSubgoal?.();
        if (currentGoal instanceof EnhancedAttackGoal || currentGoal instanceof EnhancedGetHealthGoal) {
            desirability *= 0.1; // Very low but not zero - allows fallback if other goals fail
        }
        // Boost exploration when healthy, calm, and well-armed
        if (hR > 0.8 && _num(agent.alertness, 0) < 0.3 && !!agent?.hasAdequateAmmo?.()) {
            desirability *= 1.5;
        }
        const finalDesirability = Math.min(1, Math.max(0, desirability) * this.characterBias);
        // ✅ COMMITMENT MANAGER: Apply commitment bonus if this is current goal
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'explore', finalDesirability);
        let adjustedDesirability = finalDesirability;
        if (commitmentBonus > 0) {
            adjustedDesirability += commitmentBonus;
            Logger.debug(`[${agent.entity.name}] Explore commitment bonus: +${commitmentBonus.toFixed(2)}`);
        }
        // Update commitment manager with current score
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        Logger.goal(`[${agent.entity.name}] ExploreEvaluator: Final desirability = ${adjustedDesirability.toFixed(3)} (base=${desirability.toFixed(3)}, commitment=${commitmentBonus.toFixed(3)})`);
        return adjustedDesirability;
    }
    /**
     * Create and set exploration goal if conditions are met
     */ setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) {
            Logger?.debug?.(`[ExploreEvaluator] setGoal blocked - agent or brain missing`);
            return;
        }
        const currentGoal = brain.currentSubgoal?.();
        // ✅ COMMITMENT MANAGER: Check if we should switch goals
        const exploreDesirability = 0.6; // Base exploration desirability
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'explore', exploreDesirability, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] Explore goal blocked: ${switchEval.reason}`);
            return;
        }
        // Reduce restrictions - only block if actively attacking a target
        if (agent?.targetSystem?.hasTarget?.() && agent?.targetSystem?.isAttacking?.()) {
            Logger?.debug?.(`[ExploreEvaluator] setGoal blocked - actively attacking target`);
            return;
        }
        // Allow exploration even with limited navigation (agent can try to move)
        // if (!agent.navigationReady) return;
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastCombatTime: 0,
                lastExplorationTime: 0,
                consecutiveExplorationFailures: 0,
                samplingBackoffMs: 0,
                lastSamplingFailure: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        // Reduce sampling backoff restrictions (allow more frequent attempts)
        if (st.samplingBackoffMs > 2000 && now - st.lastSamplingFailure < st.samplingBackoffMs) {
            Logger?.debug?.(`[ExploreEvaluator] setGoal blocked - sampling backoff (${st.samplingBackoffMs}ms)`);
            return;
        }
        st.lastExplorationTime = now;
        // Create new exploration goal if not already exploring or if previous goal completed/failed
        if (!(currentGoal instanceof EnhancedExploreGoal) || currentGoal.status === YUKA.Goal.STATUS.COMPLETED || currentGoal.status === YUKA.Goal.STATUS.FAILED) {
            brain.clearSubgoals?.();
            brain.addSubgoal?.(new EnhancedExploreGoal(owner));
            Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] ✅ NEW EXPLORATION GOAL SET`);
        } else {
            Logger?.debug?.(`[ExploreEvaluator] Already has active exploration goal`);
        }
    }
    /**
     * Record a sampling failure and apply exponential backoff
     * Called when random position sampling fails
     */ onSamplingFailure(agent) {
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) return;
        const now = performance.now();
        st.lastSamplingFailure = now;
        st.consecutiveExplorationFailures++;
        // Exponential backoff: 2s, 4s, 8s, 12s (max)
        st.samplingBackoffMs = Math.min(this.SAMPLING_BACKOFF_MAX, this.SAMPLING_BACKOFF_BASE * Math.pow(2, Math.min(st.consecutiveExplorationFailures - 1, 3)));
        Logger?.debug?.(`[${agent.entity?.name}] Exploration sampling backoff: ${(st.samplingBackoffMs / 1000).toFixed(1)}s`);
    }
    /**
     * Handle exploration goal completion/failure
     * Resets failure count on success, increments on failure
     */ onExplorationGoalCompleted(agent, success, reason) {
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) return;
        if (success) {
            // Reset failure tracking on successful exploration
            st.consecutiveExplorationFailures = 0;
            st.samplingBackoffMs = 0;
        } else {
            // Increment failure count
            st.consecutiveExplorationFailures++;
            // Apply sampling backoff if failure was due to position sampling
            if (reason && reason.includes('position')) {
                this.onSamplingFailure(agent);
            }
        }
    }
    /**
     * Notify evaluator that agent has entered combat
     * Updates combat time for cooldown tracking
     */ notifyCombatStart(agent) {
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastCombatTime: 0,
                lastExplorationTime: 0,
                consecutiveExplorationFailures: 0,
                samplingBackoffMs: 0,
                lastSamplingFailure: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        st.lastCombatTime = performance.now();
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = 0.6; // Temporarily boosted for testing goal arbitration
        this.combatCooldownTime = 8000; // 8 seconds after combat before exploration
        this.explorationCooldown = 1500; // 1.5 seconds between exploration attempts (reduced from 3 seconds)
        this.agentStates = new Map(); // Per-agent state tracking
        // Sampling failure backoff configuration
        this.SAMPLING_BACKOFF_BASE = 2000; // 2 seconds base backoff (reduced from 3 seconds)
        this.SAMPLING_BACKOFF_MAX = 12000; // 12 seconds max backoff (reduced from 15 seconds)
    }
}

export { EnhancedExploreEvaluator };
