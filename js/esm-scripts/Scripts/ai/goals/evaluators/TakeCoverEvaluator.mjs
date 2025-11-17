import * as playcanvasStable_min from '../../../../../playcanvas-stable.min.mjs';
import { app } from '../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { getAgentHealthRatio } from '../../utils/AgentUtilities.mjs';
import { SeekCoverGoal } from '../atomic/tactical/SeekCoverGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

/**
 * TAKE COVER EVALUATOR (PHASE 3)
 * ===============================
 * Evaluates the desirability of seeking cover based on:
 * - Current health status
 * - Whether agent is under fire
 * - Personality (cautious agents seek cover more)
 * - Distance to nearest cover
 * - Current tactical situation
 * * NOTE: This script was already correctly implemented with the
 * commitment manager and requires no logical changes.
 */ function _safe(fn, fb = null) {
    try {
        const v = fn();
        return v === undefined ? fb : v;
    } catch  {
        return fb;
    }
}
class TakeCoverEvaluator extends YUKA.GoalEvaluator {
    /**
     * Listen for cover:degraded events to re-evaluate agents using that cover
     * @private
     */ _setupCoverDegradationListener() {
        if (typeof playcanvasStable_min !== 'undefined' && app) {
            app.on('cover:degraded', (data)=>{
                this._onCoverDegraded(data);
            }, this);
        }
    }
    /**
     * Handle cover degradation event
     * @private
     * @param {Object} data - Event data with coverEntity, state, protectionMultiplier
     */ _onCoverDegraded(data) {
        const { coverEntity, state, protectionMultiplier } = data;
        // If cover is heavily damaged or destroyed, agents near it should consider fleeing
        if (protectionMultiplier < 0.5) {
            Logger.tactic(`[TakeCoverEvaluator] Cover ${coverEntity.name} degraded to ${state} (${Math.round(protectionMultiplier * 100)}%) - alerting nearby agents`);
            // Find agents near this cover
            this._alertAgentsNearCover(coverEntity, state);
        }
    }
    /**
     * Alert agents near degraded cover to re-evaluate their position
     * @private
     * @param {pc.Entity} coverEntity - The degraded cover entity
     * @param {string} state - Cover state (damaged/destroyed)
     */ _alertAgentsNearCover(coverEntity, state) {
        const coverPos = coverEntity.getPosition();
        const alertRadius = 5.0; // Alert agents within 5 units
        // Iterate through tracked agents
        for (const [agentId, agentState] of this.agentStates.entries()){
            // Find the actual agent entity
            const agentEntity = app.root.findByGuid(agentId);
            if (!agentEntity || !agentEntity.script || !agentEntity.script.aiAgent) {
                continue;
            }
            const agent = agentEntity.script.aiAgent;
            const agentPos = agentEntity.getPosition();
            const distance = agentPos.distance(coverPos);
            // If agent is near this cover, force re-evaluation
            if (distance < alertRadius) {
                Logger.tactic(`[TakeCoverEvaluator] Agent ${agentEntity.name} is near degraded cover - forcing re-evaluation`);
                // Reset cover seek time to allow immediate re-evaluation
                agentState.lastCoverSeekTime = 0;
                // If agent is currently in a cover goal, interrupt it
                const currentGoal = agent?.brain?.currentSubgoal?.();
                if (currentGoal && currentGoal.constructor?.name === 'SeekCoverGoal') {
                    Logger.tactic(`[TakeCoverEvaluator] Interrupting ${agentEntity.name}'s cover goal due to cover degradation`);
                    agent.brain?.clearSubgoals?.();
                }
            }
        }
    }
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) return 0;
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastDamageTaken: 0,
                damageCount: 0,
                lastCoverSeekTime: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        let desirability = 0;
        // Cooldown: Don't spam cover seeking
        if (now - st.lastCoverSeekTime < 2000) {
            return 0;
        }
        const healthRatio = getAgentHealthRatio(agent);
        Logger.aiState(`[TakeCoverEvaluator] Agent health: ratio=${healthRatio.toFixed(2)}, healthSystem=${!!agent.entity?.script?.healthSystem}`);
        const underFire = now - st.lastDamageTaken < 2000 && st.damageCount > 0;
        const hasVisibleTarget = agent?.targetSystem?.hasTarget?.() && agent?.targetSystem?.isTargetVisible?.();
        let healthUrgency = 0;
        if (healthRatio <= aiConfig.combat.CRITICAL_HEALTH_THRESHOLD) {
            healthUrgency = aiConfig.evaluators.COVER_URGENCY_CRITICAL;
            Logger.aiState(`[TakeCoverEvaluator] 🚨 CRITICAL HP (${Math.round(healthRatio * 100)}%) - MAX cover urgency`);
        } else if (healthRatio <= aiConfig.combat.LOW_HEALTH_THRESHOLD) {
            healthUrgency = aiConfig.evaluators.COVER_URGENCY_WOUNDED;
            Logger.aiState(`[TakeCoverEvaluator] ⚠️ WOUNDED (${Math.round(healthRatio * 100)}%) - HIGH cover urgency`);
        } else if (healthRatio <= aiConfig.combat.MODERATE_HEALTH_THRESHOLD) {
            healthUrgency = aiConfig.evaluators.COVER_URGENCY_MODERATE;
        } else if (healthRatio <= aiConfig.combat.HIGH_HEALTH_THRESHOLD) {
            healthUrgency = aiConfig.evaluators.COVER_URGENCY_LIGHT;
        } else {
            healthUrgency = underFire ? aiConfig.evaluators.COVER_URGENCY_FULL_UNDER_FIRE : 0.0;
        }
        if (underFire) {
            healthUrgency = Math.max(healthUrgency, aiConfig.evaluators.COVER_URGENCY_UNDER_FIRE_BOOST);
            Logger.aiState(`[TakeCoverEvaluator] 🔥 UNDER FIRE - boosted urgency to ${healthUrgency.toFixed(2)}`);
        }
        const personality = agent.personalitySystem;
        if (personality) {
            const coverUsage = personality.coverUsage || 0.7;
            if (personality.shouldSeekCover && personality.shouldSeekCover(healthRatio, underFire)) {
                healthUrgency = Math.max(healthUrgency, 0.7);
            }
            desirability = healthUrgency * coverUsage * this.tweaker;
            if (desirability > 0.3) {
                Logger.aiState(`[TakeCoverEvaluator] Cover desirability=${Math.round(desirability * 100)}%:`, {
                    healthRatio: Math.round(healthRatio * 100) + '%',
                    healthUrgency,
                    underFire,
                    coverUsage,
                    tweaker: this.tweaker,
                    shouldSeekCover: personality.shouldSeekCover?.(healthRatio, underFire)
                });
            }
        } else {
            desirability = healthUrgency * 0.8 * this.tweaker;
            if (desirability > 0.3) {
                Logger.aiState(`[TakeCoverEvaluator] No personality - Cover desirability=${Math.round(desirability * 100)}%:`, {
                    healthRatio: Math.round(healthRatio * 100) + '%',
                    healthUrgency,
                    underFire,
                    defaultCoverUsage: 0.8,
                    tweaker: this.tweaker
                });
            }
        }
        if (hasVisibleTarget) {
            if (healthRatio <= 0.25) {
                desirability *= 0.9;
            } else if (healthRatio <= 0.4) {
                desirability *= 0.8;
            } else {
                desirability *= 0.6;
            }
        }
        const currentGoal = agent?.brain?.currentSubgoal?.();
        const isCoverNow = currentGoal && currentGoal.constructor?.name === 'TakeCoverGoal';
        if (isCoverNow) {
            desirability *= 1.3;
        }
        const finalDesirability = Math.min(1, Math.max(0, desirability) * this.characterBias);
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'cover', finalDesirability);
        let adjustedDesirability = finalDesirability;
        if (commitmentBonus > 0) {
            adjustedDesirability += commitmentBonus;
            Logger.debug(`[${agent.entity.name}] Cover commitment bonus: +${commitmentBonus.toFixed(2)}`);
        }
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        if (adjustedDesirability > 0.1) {
            Logger.aiState(`[TakeCoverEvaluator] 🛡️ FINAL: ${Math.round(adjustedDesirability * 100)}% (health: ${Math.round(healthRatio * 100)}%, underFire: ${underFire})`);
        }
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) {
            Logger?.debug?.(`[TakeCoverEvaluator] setGoal blocked - agent or brain missing`);
            return;
        }
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        const currentGoal = brain.currentSubgoal?.();
        const healthRatio = agent?.health / Math.max(1, agent?.maxHealth || 100);
        const underFire = st && performance.now() - st.lastDamageTaken < 2000;
        const coverDesirability = healthRatio <= 0.25 ? 1.0 : underFire ? 0.95 : 0.8;
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'cover', coverDesirability, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] Cover goal blocked: ${switchEval.reason}`);
            return;
        }
        const threat = agent.targetSystem?.getTargetPosition() || agent.entity.getPosition();
        const yukaVehicle = agent.agentCore?.getVehicle();
        if (!yukaVehicle) {
            Logger.warn(`[${agent.entity.name}] Cannot seek cover - no YUKA vehicle`);
            return;
        }
        try {
            brain.clearSubgoals?.();
            brain.addSubgoal?.(new SeekCoverGoal(yukaVehicle, threat, agent));
            if (st) {
                st.lastCoverSeekTime = performance.now();
            }
            Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] ✅ SEEKING COVER GOAL SET`);
        } catch (error) {
            Logger.error(`[TakeCoverEvaluator] Failed to create SeekCoverGoal:`, error);
        }
    }
    /**
     * This method MUST be called by an external system (like EventHandler)
     * when the agent takes damage.
     */ onDamageTaken(agent, damage) {
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) return;
        const now = performance.now();
        st.lastDamageTaken = now;
        st.damageCount++;
        // Reset damage count after 3 seconds
        setTimeout(()=>{
            if (st) st.damageCount = Math.max(0, st.damageCount - 1);
        }, 3000);
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = aiConfig.evaluators.COVER_TWEAKER;
        this.agentStates = new Map();
        // Listen for cover degradation events
        this._setupCoverDegradationListener();
    }
}

export { TakeCoverEvaluator };
