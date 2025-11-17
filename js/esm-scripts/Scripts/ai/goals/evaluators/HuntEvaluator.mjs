import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { HuntGoal } from '../atomic/movement/HuntGoal.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * HUNT EVALUATOR (PHASE 3)
 * =========================
 * Evaluates the desirability of hunting wounded/fleeing targets:
 * - Target lost visibility recently (they're fleeing)
 * - Target is wounded (kill opportunity)
 * - Agent has health/ammo advantage
 * - Personality (aggressive agents hunt more, uses pursuitTenacity)
 * 
 * Uses existing HuntGoal which integrates with navigation system
 * 
 * Human-like: Aggressive players chase wounded enemies to secure kills
 * 
 * Returns desirability score 0.0-1.0
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
class HuntEvaluator extends YUKA.GoalEvaluator {
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent || !agent.entity) return 0;
        const agentId = _safe(()=>agent.entity.getGuid());
        let st = agentId ? this.agentStates.get(agentId) : null;
        if (!st) {
            st = {
                lastKnownTargetPosition: null,
                lastTargetVisibleTime: 0,
                targetLostDuration: 0,
                lastHuntTime: 0
            };
            if (agentId) this.agentStates.set(agentId, st);
        }
        const now = performance.now();
        let desirability = 0;
        // Cooldown between hunts
        if (now - st.lastHuntTime < 6000) {
            return 0;
        }
        // Must have target
        const hasTarget = agent?.targetSystem?.hasTarget?.();
        if (!hasTarget) {
            st.lastKnownTargetPosition = null;
            return 0;
        }
        const visible = agent?.targetSystem?.isTargetVisible?.();
        const target = agent.targetSystem.currentTarget;
        // Track target visibility
        if (visible) {
            st.lastTargetVisibleTime = now;
            // Store as YUKA Vector3 for HuntGoal compatibility
            // ✅ FIX: currentTarget is a target record object with .entity property
            const targetEntity = target?.entity;
            if (targetEntity && typeof targetEntity.getPosition === 'function') {
                const pcPos = targetEntity.getPosition();
                st.lastKnownTargetPosition = new YUKA.Vector3(pcPos.x, pcPos.y, pcPos.z);
            } else if (target?.lastSensedPosition) {
                // Fallback: Use lastSensedPosition from target record
                st.lastKnownTargetPosition = new YUKA.Vector3(target.lastSensedPosition.x, target.lastSensedPosition.y, target.lastSensedPosition.z);
            }
            st.targetLostDuration = 0;
        } else {
            st.targetLostDuration = now - st.lastTargetVisibleTime;
        }
        // Hunt trigger: Target was visible recently but lost sight (2-10 seconds ago)
        const huntWindow = st.targetLostDuration > 2000 && st.targetLostDuration < 10000;
        if (!huntWindow) {
            return 0;
        }
        // Don't hunt if no last known position
        if (!st.lastKnownTargetPosition) {
            return 0;
        }
        // Get agent health ratio
        const healthRatio = Math.max(0, Math.min(1, _num(agent.health, 0) / Math.max(1, _num(agent.maxHealth, 100))));
        // Don't hunt if too wounded
        if (healthRatio < 0.5) {
            return 0;
        }
        // Check if agent has ammo
        const hasAmmo = agent?.weaponSystem && Object.values(agent.weaponSystem.weapons || {}).some((w)=>w && w.unlocked && (w.ammo > 0 || w.magazine > 0));
        if (!hasAmmo) {
            return 0;
        }
        // Base desirability from hunt window timing
        // Peak desirability at 4 seconds after losing target
        const timeSinceLost = st.targetLostDuration / 1000; // Convert to seconds
        let timeScore = 0;
        if (timeSinceLost < 4) {
            timeScore = timeSinceLost / 4; // Ramp up 0-4s
        } else {
            timeScore = Math.max(0, 1.0 - (timeSinceLost - 4) / 6); // Decay 4-10s
        }
        // Distance to last known position
        const distanceToLastKnown = agent.entity.getPosition().distance(st.lastKnownTargetPosition);
        let distanceScore = aiConfig.evaluators.HUNT_DISTANCE_SCORE_DEFAULT;
        if (distanceToLastKnown > aiConfig.perception.EVENT_SEARCH_RADIUS) {
            distanceScore = Math.max(0.3, 1.0 - (distanceToLastKnown - aiConfig.perception.EVENT_SEARCH_RADIUS) / 20);
        }
        // Get personality modifiers
        const personality = agent.personalitySystem;
        let personalityMultiplier = aiConfig.evaluators.HUNT_PERSONALITY_MULTIPLIER;
        if (personality) {
            // Use pursuitTenacity (how far agent chases)
            const pursuitTenacity = personality.pursuitTenacity || 0.5;
            const aggression = personality.traits.aggression || 0.5;
            // Aggressive hunters
            personalityMultiplier = (pursuitTenacity * 0.7 + aggression * 0.3) * 1.5;
            // Cautious agents don't hunt unless overwhelming advantage
            if (personality.traits.caution > 0.7 && healthRatio < 0.8) {
                personalityMultiplier *= 0.3;
            }
        }
        // Health advantage (agent is healthy = more confident hunt)
        const healthAdvantage = Math.max(0.5, healthRatio);
        // Combine factors
        desirability = timeScore * distanceScore * healthAdvantage * personalityMultiplier * this.tweaker;
        // Check if already hunting
        const currentGoal = agent?.brain?.currentSubgoal?.();
        const isHuntingNow = currentGoal && currentGoal.constructor?.name === 'HuntGoal';
        if (isHuntingNow) {
            desirability *= 1.3; // Maintain commitment
        }
        return Math.min(1, Math.max(0, desirability) * this.characterBias);
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) return;
        const agentId = _safe(()=>agent.entity.getGuid());
        const st = agentId ? this.agentStates.get(agentId) : null;
        // Pass last known position to goal (YUKA Vector3)
        const lastKnownPos = st?.lastKnownTargetPosition; // Already a YUKA Vector3
        const yukaVehicle = agent.agentCore?.getVehicle();
        if (!yukaVehicle) {
            Logger.warn(`[${agent.entity.name}] Cannot hunt - no YUKA vehicle`);
            return;
        }
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new HuntGoal(yukaVehicle, lastKnownPos, agent));
        if (st) {
            st.lastHuntTime = performance.now();
        }
        Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] HUNTING TARGET`);
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = aiConfig.evaluators.HUNT_TWEAKER;
        this.agentStates = new Map();
    }
}

export { HuntEvaluator };
