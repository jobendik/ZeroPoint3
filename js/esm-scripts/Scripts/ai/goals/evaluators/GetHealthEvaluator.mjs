import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedGetHealthGoal } from '../composite/GetHealthGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * GET HEALTH EVALUATOR
 * ====================
 * Calculates the desirability of seeking health pickups based on:
 * - Current health ratio
 * - Enemy visibility
 * - Health pickup availability
 * - Distance to health pickup
 * 
 * Returns desirability score 0.0-2.0 (can exceed 1.0 for emergencies)
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
// ✅ OPTIMIZED FOR REALISTIC FPS AI (Oct 23, 2025)
// Human FPS players seek health proactively, not desperately
// Skilled players retreat at ~60% HP, panic at ~25%
const HEALTH_EMERGENCY = 0.20; // 20% - Panic mode (immediate retreat)
const HEALTH_CRITICAL = 0.40; // 40% - High risk (strong retreat priority)
const HEALTH_LOW = 0.60; // 60% - Tactical retreat (seek health proactively)
class EnhancedGetHealthEvaluator extends YUKA.GoalEvaluator {
    _findBestHealthItem(agent) {
        if (!agent?.app?.gameManager) return null;
        const list = [];
        for (const item of agent.app.gameManager.getAllItems() || []){
            if (!item?.entity || item.entity.destroyed || !item.entity.enabled) continue;
            // Item must look like a health item and be available
            const typeStr = (item.itemType || item.entity.name || '').toLowerCase();
            const typeLooksLikeHealth = typeStr.includes('health') || typeStr.includes('medkit') || typeStr.includes('med_pack') || typeStr.includes('medical') || item.itemType === 'health';
            if (!typeLooksLikeHealth) continue;
            let available = true;
            if (typeof item.isAvailable === 'boolean') available = item.isAvailable;
            else if (typeof item.isAvailable === 'function') {
                try {
                    available = !!item.isAvailable();
                } catch  {
                    available = true;
                }
            }
            if (!available) continue;
            // Check reservation
            const agentGuid = _safe(()=>agent.entity.getGuid(), null);
            const now = performance.now();
            if (item.reservedBy && item.reservedBy !== agentGuid && now < (item.reservationExpiry || 0)) continue;
            list.push(item);
        }
        if (list.length === 0) return null;
        // Find closest health item
        const pos = agent.entity.getPosition();
        let best = null, bestDistance = Infinity;
        for (const it of list){
            const d = pos.distance(it.entity.getPosition());
            if (d < bestDistance) {
                bestDistance = d;
                best = it;
            }
        }
        return best;
    }
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) {
            Logger.warn(`[GetHealthEvaluator] No valid agent found`);
            return 0;
        }
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastHealthGoalStart: 0,
                lastHealthGoalEnd: 0,
                consecutiveHealthFailures: 0,
                enemyVisibleFrames: 0,
                lastEnemyVisibleTime: 0,
                healthGoalCooldown: 0,
                isInCommitmentPeriod: false,
                _debugCounter: 0 // Only log every N evaluations
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        const maxH = Math.max(1, _num(agent.maxHealth, 100));
        const healthRatio = Math.max(0, Math.min(1, _num(agent.health, maxH) / maxH));
        // Clean up any simulation artifacts
        if (agent) {
            agent._simulatedHealth = undefined;
            agent._isHealthSimulated = false;
        }
        // Reduced logging - only log every 100 evaluations OR when critically wounded
        st._debugCounter = (st._debugCounter || 0) + 1;
        const shouldLog = st._debugCounter % 100 === 0 || healthRatio <= 0.30;
        if (shouldLog) {
            Logger.health(`[${agent.entity?.name}] HP=${(healthRatio * 100).toFixed(1)}%, cooldown=${(now - (st.lastHealthGoalEnd || 0)).toFixed(0)}ms`);
        }
        if (now - (st.lastHealthGoalEnd || 0) < (st.healthGoalCooldown || 0)) {
            return 0;
        }
        const hasTarget = !!agent?.targetSystem?.hasTarget?.();
        const visible = hasTarget && !!agent?.targetSystem?.isTargetVisible?.();
        if (visible) {
            st.enemyVisibleFrames++;
            st.lastEnemyVisibleTime = now;
        } else {
            st.enemyVisibleFrames = Math.max(0, st.enemyVisibleFrames - 1);
        }
        let desirability = 0;
        const isEnemyVisibleRecently = st.enemyVisibleFrames < this.enemyVisibilityHysteresis;
        // Apply personality-based flee thresholds
        const personality = agent.personalitySystem;
        personality ? personality.fleeThreshold : 0.30; // Default 30% if no personality
        // Use actual health ratio
        const effectiveHealthRatio = healthRatio;
        // ✅ CORRECT: Human FPS behavior - Retreat and heal when wounded!
        // Real players at critical HP: Disengage → Find cover → Heal
        // TakeCoverEvaluator handles "break line of sight" (score ~1.08 at 20% HP)
        // GetHealthEvaluator handles "find medkit after disengaging" (should be high but < TakeCover)
        // AttackEvaluator handles "suppressive fire while retreating" (should be moderate)
        if (effectiveHealthRatio <= this.emergencyHealthThreshold) {
            // PANIC MODE - desperately need health, but TakeCover will win if under fire
            desirability = isEnemyVisibleRecently ? 0.95 : 1.9; // High but < TakeCover (1.08)
        } else if (effectiveHealthRatio < this.criticalHealthThreshold) {
            // CRITICAL - strong health seeking, but cover takes priority when visible
            desirability = isEnemyVisibleRecently ? 0.85 : 1.5; // High but < TakeCover (0.91)
        } else if (effectiveHealthRatio < this.proactiveHealthThreshold) {
            // MODERATE - proactive health seeking when safe
            desirability = isEnemyVisibleRecently ? 0.65 : 1.3;
        } else if (effectiveHealthRatio < 0.75) {
            desirability = isEnemyVisibleRecently ? 0.4 : 0.7;
        } else if (effectiveHealthRatio < this.comfortableHealthThreshold) {
            desirability = isEnemyVisibleRecently ? 0.2 : 0.4;
        } else {
            return 0;
        }
        // ✅ PHASE 2: Apply personality multiplier to base desirability
        if (personality) {
            const personalityMultiplier = personality.getHealthDesirabilityMultiplier(healthRatio);
            desirability *= personalityMultiplier;
        }
        // Check for health pickup availability - ENHANCED DETECTION like GetWeaponEvaluator
        const healthItem = this._findBestHealthItem(agent);
        const hasHealthPickup = !!healthItem;
        if (!hasHealthPickup) {
            // ✅ CRITICAL FIX: Without health pickup, MASSIVELY reduce GetHealth desirability
            // but this allows TakeCoverEvaluator to take over for survival behavior
            // GetHealth should NOT compete with Attack/Cover when no pickup exists
            // The goal is to make Cover/Retreat the dominant survival strategy
            if (effectiveHealthRatio <= 0.25) {
                // At critical HP, GetHealth is NOT the answer (no pickup to get!)
                // Reduce to near-zero so TakeCover/Retreat can win arbitration
                desirability *= 0.05; // Was 0.8 - now defers to Cover evaluator
            } else if (effectiveHealthRatio <= 0.40) {
                // At low HP, still defer to cover-seeking
                desirability *= 0.1;
            } else {
                // At moderate HP, reduce significantly (opportunistic only)
                desirability *= 0.2;
            }
        } else {
            // Health pickup available - apply distance and reservation factors
            const dist = _num(_safe(()=>agent.entity.getPosition().distance(healthItem.entity.getPosition()), Infinity), Infinity);
            // ✅ FIX: Humans will run much farther for health when wounded
            // Increased from 50m to 150m range
            const distanceFactor = Math.max(0.4, 1 - dist / 150);
            desirability *= distanceFactor;
            const reservedBy = _safe(()=>healthItem.reservedBy);
            const myGuid = _safe(()=>agent.entity.getGuid());
            if (reservedBy && myGuid && reservedBy !== myGuid) {
                if (_safe(()=>healthItem.reservationExpiry > now, false)) {
                    desirability *= 0.2;
                }
            }
            if (reservedBy && myGuid && reservedBy === myGuid) {
                desirability *= 1.3;
            }
        }
        const failBonus = Math.min(0.2, (st.consecutiveHealthFailures || 0) * 0.05);
        desirability += failBonus;
        const finalDesirability = Math.max(0, desirability * this.characterBias);
        // ✅ COMMITMENT MANAGER: Apply commitment bonus if this is current goal
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'health', finalDesirability);
        let adjustedDesirability = finalDesirability;
        if (commitmentBonus > 0) {
            adjustedDesirability += commitmentBonus;
            if (shouldLog || effectiveHealthRatio <= 0.50) {
                Logger.debug(`[${agent.entity.name}] Health commitment bonus: +${commitmentBonus.toFixed(2)}`);
            }
        }
        // Update commitment manager with current score
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        // ✅ FIX: Store desirability for commitment manager
        if (st) {
            st.lastDesirability = adjustedDesirability;
        }
        // Only log significant health events
        if (shouldLog || effectiveHealthRatio <= 0.50 || adjustedDesirability > 0.8) {
            Logger.health(`[${agent.entity?.name}] HP=${Math.round(effectiveHealthRatio * 100)}%, desire=${adjustedDesirability.toFixed(2)}, hasPickup=${hasHealthPickup}, enemyVisible=${isEnemyVisibleRecently}`);
        }
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) {
            Logger.debug('[GetHealthEvaluator] SetGoal blocked: No agent or brain');
            return;
        }
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        const currentGoal = brain.currentSubgoal?.();
        const now = performance.now();
        // ✅ COMMITMENT MANAGER: Check if we should switch goals
        const healthRatio = agent?.health / Math.max(1, agent?.maxHealth || 100);
        // Fix operator precedence: use parentheses for ternary
        const currentDesirability = st?.lastDesirability || (healthRatio <= 0.25 ? 2.0 : 1.0);
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'health', currentDesirability, currentGoal);
        if (!switchEval.shouldSwitch) {
            // ✅ FIX: Only log occasionally to reduce spam
            if (Math.random() < 0.01) {
                Logger.debug(`[${agent.entity.name}] Health goal blocked by commitment: ${switchEval.reason}`);
            }
            return;
        }
        // Rate limit setGoal calls to prevent thrashing
        const lastAttemptAge = st ? now - (st._lastSetGoalAttempt || 0) : Infinity;
        if (st && lastAttemptAge < 500) {
            return;
        }
        // ✅ REMOVED: Redundant checks - evaluateGoalSwitch already handles this
        // The commitment manager now handles all goal switching logic
        Logger.goal(`[${agent.entity?.name}] 🏥 NEW HEALTH GOAL - Seeking medical attention`);
        if (st) st._lastSetGoalAttempt = now;
        if (st) {
            st.lastHealthGoalStart = now;
            st.isInCommitmentPeriod = true;
            st.enemyVisibleFrames = 0;
        }
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new EnhancedGetHealthGoal(owner));
    }
    onHealthGoalCompleted(agent, success, reason) {
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) return;
        const now = performance.now();
        st.lastHealthGoalEnd = now;
        st.isInCommitmentPeriod = false;
        if (success) {
            st.consecutiveHealthFailures = 0;
            st.healthGoalCooldown = 2000;
            Logger.goal(`[${agent.entity?.name}] 🏥 Health goal completed successfully`);
        } else {
            st.consecutiveHealthFailures++;
            st.healthGoalCooldown = Math.min(8000, 3000 + st.consecutiveHealthFailures * 1000);
            Logger.debug(`[${agent.entity?.name}] Health goal failed (${reason}), cooldown: ${st.healthGoalCooldown}ms`);
        }
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = 1.0;
        this.commitmentTime = 2000; // ✅ OPTIMIZED: Quick decision like human players
        this.criticalHealthThreshold = HEALTH_CRITICAL;
        this.proactiveHealthThreshold = HEALTH_LOW;
        this.emergencyHealthThreshold = HEALTH_EMERGENCY;
        this.comfortableHealthThreshold = 0.80;
        this.enemyVisibilityHysteresis = 6; // ✅ OPTIMIZED: Faster response to enemy presence
        this.EMERGENCY_DESIRABILITY = 2.0;
        this.CRITICAL_VISIBLE_DESIRABILITY = 1.4;
        this.CRITICAL_HIDDEN_DESIRABILITY = 1.2;
        this.PROACTIVE_VISIBLE_DESIRABILITY = 1.15;
        this.PROACTIVE_HIDDEN_DESIRABILITY = 1.0;
        this.agentStates = new Map();
    }
}

export { EnhancedGetHealthEvaluator };
