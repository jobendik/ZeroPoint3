import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedGetAmmoGoal } from '../composite/GetAmmoGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * EnhancedGetAmmoEvaluator.mjs (ESM)
 *
 * CONTRACT with GetAmmoGoal:
 * - Desirability based on TOTAL ammo ratio (mag + reserve) vs capacity.
 * - Goal set uses EnhancedGetAmmoGoal (NOT weapon goal).
 * - Cooldowns to avoid thrash; low-HP suppression.
 */ function _num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
}
function _safe(fn, fb = null) {
    try {
        const v = fn();
        return v === undefined ? fb : v;
    } catch  {
        return fb;
    }
}
function totalAmmo(agent) {
    const ws = agent?.weaponSystem;
    if (!ws?.weapons) return 0;
    let t = 0;
    for (const k of Object.keys(ws.weapons)){
        const w = ws.weapons[k];
        t += _num(w?.ammo, 0) + _num(w?.magazine, 0);
    }
    return t;
}
function maxCapacity(agent) {
    const ws = agent?.weaponSystem;
    if (!ws?.weapons) return 0;
    let cap = 0;
    const caps = ws.maxAmmo || null;
    if (caps && typeof caps === 'object') {
        for (const k of Object.keys(ws.weapons))cap += _num(caps[k], 0);
    } else {
        // Soft bound if no explicit caps present
        for (const k of Object.keys(ws.weapons)){
            const w = ws.weapons[k];
            cap += (_num(w?.ammo, 0) + _num(w?.magazine, 0)) * 6;
        }
    }
    return cap;
}
class EnhancedGetAmmoEvaluator extends YUKA.GoalEvaluator {
    _urgency(agent) {
        const cap = Math.max(1, maxCapacity(agent));
        const totalRatio = totalAmmo(agent) / cap;
        // ✅ AMMO CONSERVATION: Also check current weapon ammo
        // This gives higher urgency when current weapon is low, even if total ammo is okay
        const ws = agent?.weaponSystem;
        let currentWeaponRatio = 1.0;
        if (ws?.weapons && ws?.currentWeapon) {
            const currentWeapon = ws.weapons[ws.currentWeapon];
            const maxAmmo = ws.maxAmmo?.[ws.currentWeapon];
            if (currentWeapon && maxAmmo && maxAmmo > 0) {
                const magazineAmmo = ws.currentMagazine || 0;
                const reserveAmmo = currentWeapon.ammo || 0;
                const totalCurrent = magazineAmmo + reserveAmmo;
                currentWeaponRatio = totalCurrent / maxAmmo;
            }
        }
        // Calculate urgency based on both total ammo AND current weapon ammo
        // Use the worse of the two to determine urgency
        const totalNeed = Math.max(0, (this.minRatio - totalRatio) / this.minRatio);
        const currentWeaponNeed = Math.max(0, (this.minRatio - currentWeaponRatio) / this.minRatio);
        // Weight current weapon more heavily (60%) since it's what we're actively using
        const urgency = currentWeaponNeed * 0.6 + totalNeed * 0.4;
        return Math.min(1, urgency);
    }
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        if (!agent?.entity) return 0;
        const id = _safe(()=>agent.entity.getGuid(), null);
        let st = id ? this.agentStates.get(id) : null;
        if (!st) {
            st = {
                lastStart: 0,
                lastEnd: 0,
                fails: 0,
                cooldownMs: 0
            };
            if (id) this.agentStates.set(id, st);
        }
        const now = performance.now();
        if (now - st.lastEnd < st.cooldownMs) return 0;
        // ✅ CRITICAL FIX: Use personality flee threshold like GetWeaponEvaluator
        // Don't chase ammo when health is below flee threshold - survival first!
        const maxH = Math.max(1, _num(agent.maxHealth, 100));
        const hpR = Math.max(0, Math.min(1, _num(agent.health, maxH) / maxH));
        // Get personality flee threshold (default 30% if no personality)
        const personality = agent.personalitySystem;
        const fleeThreshold = personality ? personality.fleeThreshold : 0.30;
        if (hpR <= fleeThreshold) {
            Logger.goal?.(`[${agent.entity?.name}] ⚠️ Critical HP (${Math.round(hpR * 100)}%) - ZERO ammo desirability (survival first!)`);
            return 0;
        }
        // Core urgency on TOTAL ammo ratio
        let desirability = this._urgency(agent) * this.tweaker;
        // Enemy visible → stronger incentive to top up (but capped)
        const hasT = !!agent?.targetSystem?.hasTarget?.();
        const vis = hasT && !!agent?.targetSystem?.isTargetVisible?.();
        if (vis) desirability = Math.max(desirability, 0.6);
        // No ammo pickups in world? Downweight heavily.
        const gm = agent?.app?.gameManager;
        const p = agent?.entity?.getPosition?.();
        const anyAmmo = !!gm?.getClosestItem?.(p, 'ammo') || !!agent?.navigation?.getClosestAmmoItem?.();
        if (!anyAmmo) desirability *= 0.15;
        // Penalize repeated failures
        if (st.fails > 0) {
            const penalty = Math.max(0.3, 1 - st.fails * 0.15);
            desirability *= penalty;
        }
        const finalDesirability = Math.min(1, Math.max(0, desirability) * this.characterBias);
        // ✅ COMMITMENT MANAGER: Apply commitment bonus if this is current goal
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'ammo', finalDesirability);
        let adjustedDesirability = finalDesirability;
        if (commitmentBonus > 0) {
            adjustedDesirability += commitmentBonus;
            Logger.debug(`[${agent.entity.name}] Ammo commitment bonus: +${commitmentBonus.toFixed(2)}`);
        }
        // Update commitment manager with current score
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!brain) return;
        const id = _safe(()=>agent.entity.getGuid(), null);
        const st = id ? this.agentStates.get(id) : null;
        const now = performance.now();
        const currentGoal = brain.currentSubgoal?.();
        // ✅ COMMITMENT MANAGER: Check if we should switch goals
        const ammoDesirability = st ? this._urgency(agent) : 0.5;
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'ammo', ammoDesirability, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] Ammo goal blocked: ${switchEval.reason}`);
            return;
        }
        if (st && now - (st.lastStart || 0) < this.commitmentTimeMs) return;
        if (st) {
            st.lastStart = now;
        }
        // ✅ Correct goal type + pass reason + ratio threshold used by the goal
        brain.clearSubgoals?.();
        brain.addSubgoal?.(new EnhancedGetAmmoGoal(owner, {
            reason: 'low_total_ammo',
            minRatio: this.minRatio
        }));
        Logger?.goal?.(`[${agent.entity?.name || 'Agent'}] AMMO GOAL started`);
    }
    // Optional hook you can call from goal termination sites
    onAmmoGoalCompleted(agent, success) {
        const id = _safe(()=>agent.entity.getGuid(), null);
        const st = id ? this.agentStates.get(id) : null;
        if (!st) return;
        const now = performance.now();
        st.lastEnd = now;
        if (success) {
            st.fails = 0;
            st.cooldownMs = 1500;
        } else {
            st.fails = Math.min(8, (st.fails || 0) + 1);
            st.cooldownMs = Math.min(15000, 3000 + st.fails * 1500);
        }
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = 1.0;
        this.commitmentTimeMs = 1500;
        this.agentStates = new Map();
        this.minRatio = 0.25; // < 25% total ammo → want ammo
    }
}

export { EnhancedGetAmmoEvaluator };
