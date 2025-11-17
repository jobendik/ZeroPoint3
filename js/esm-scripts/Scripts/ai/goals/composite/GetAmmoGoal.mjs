import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { DirectApproachGoal } from '../atomic/approach/DirectApproachGoal.mjs';
import { getAmmoPriorityByRatio, GOAL_PRIORITIES, applyGoalInterruptMixin } from '../GoalInterruptMixin.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
function _num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
}
function getTotalUsableAmmo(agent) {
    const ws = agent?.weaponSystem;
    if (!ws || !ws.weapons) return 0;
    let total = 0;
    for (const k of Object.keys(ws.weapons)){
        const w = ws.weapons[k];
        total += _num(w?.ammo, 0) + _num(w?.magazine, 0);
    }
    return total;
}
function getMaxAmmoCapacity(agent) {
    const ws = agent?.weaponSystem;
    if (!ws || !ws.weapons) return 0;
    // If you keep max capacities per weapon, prefer that.
    // Fallback: assume each weapon's current+reserve is at/near max seen so far.
    let max = 0;
    const caps = ws.maxAmmo || null;
    if (caps && typeof caps === 'object') {
        for (const k of Object.keys(ws.weapons)){
            max += _num(caps[k], 0);
        }
    } else {
        // Soft upper bound: 6 mags of current content per weapon (very conservative)
        for (const k of Object.keys(ws.weapons)){
            const w = ws.weapons[k];
            const guess = (_num(w?.ammo, 0) + _num(w?.magazine, 0)) * 6;
            max += guess;
        }
    }
    return max;
}
class EnhancedGetAmmoGoal extends YUKA.CompositeGoal {
    _needsAmmo(agent) {
        const total = getTotalUsableAmmo(agent);
        const cap = Math.max(1, getMaxAmmoCapacity(agent));
        const ratio = total / cap;
        return ratio < this.minRatio;
    }
    _findClosestAmmoItem(agent) {
        // Prefer a central query if you have it; fall back to a nav helper if present.
        const gm = agent?.app?.gameManager;
        if (gm?.getClosestItem) {
            const p = agent.entity.getPosition();
            const item = gm.getClosestItem(p, 'ammo');
            return item && (typeof item.isAvailable === 'function' ? item.isAvailable() : item.isAvailable !== false) ? item : null;
        }
        return agent?.navigation?.getClosestAmmoItem?.() || null;
    }
    activate() {
        this.goalStartTime = performance.now();
        this.clearSubgoals();
        this._hasLoggedActivation = false;
        const agent = this.owner?.agent;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // FIX: Don't immediately complete if evaluator requested this goal
        // Only do quick completion check if we've been running for minimum time
        // This prevents the instant termination issue
        // Pick target ammo
        this.targetAmmo = this._findClosestAmmoItem(agent);
        if (!this.targetAmmo) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: no available ammo pickups`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Move to ammo
        const pos = this.targetAmmo.entity?.getPosition?.();
        if (!pos) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        const target = new YUKA.Vector3(pos.x, pos.y, pos.z);
        this.addSubgoal(new DirectApproachGoal(this.owner, target, agent));
        this.status = YUKA.Goal.STATUS.ACTIVE;
        if (!this._hasLoggedActivation) {
            const total = getTotalUsableAmmo(agent);
            const cap = Math.max(1, getMaxAmmoCapacity(agent));
            const ratio = total / cap;
            Logger.goal(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: Activated (reason: ${this.reason}, ratio: ${(ratio * 100).toFixed(1)}%)`);
            this._hasLoggedActivation = true;
        }
    }
    execute() {
        const agent = this.owner?.agent;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Set current activity for state reflection
        agent.currentActivity = 'seekAmmo';
        const now = performance.now();
        const age = now - this.goalStartTime;
        // FIX: Only check for completion after minimum runtime
        // This prevents the instant termination loop
        if (age >= this.minGoalDurationMs && now - this._lastCheck > this._checkInterval) {
            this._lastCheck = now;
            // Check if we've achieved our goal
            if (!this._needsAmmo(agent)) {
                const total = getTotalUsableAmmo(agent);
                const cap = Math.max(1, getMaxAmmoCapacity(agent));
                const ratio = total / cap;
                Logger.goal(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: completed (ratio now ${(ratio * 100).toFixed(1)}%)`);
                this.status = YUKA.Goal.STATUS.COMPLETED;
                return;
            }
            // Check if target pickup disappeared
            if (this.targetAmmo && !this._isAmmoItemAvailable(this.targetAmmo)) {
                // Try to find another ammo pickup
                this.targetAmmo = this._findClosestAmmoItem(agent);
                if (!this.targetAmmo) {
                    Logger.warn(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: no more ammo pickups available`);
                    this.status = YUKA.Goal.STATUS.FAILED;
                    return;
                }
                // Update movement to new target
                this.clearSubgoals();
                const pos = this.targetAmmo.entity?.getPosition?.();
                if (pos) {
                    const target = new YUKA.Vector3(pos.x, pos.y, pos.z);
                    this.addSubgoal(new DirectApproachGoal(this.owner, target, agent));
                    Logger.goal(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: switching to new ammo target`);
                }
            }
        }
        // Drive subgoals (movement)
        if (this.hasSubgoals()) {
            const s = this.executeSubgoals();
            if (s === YUKA.Goal.STATUS.FAILED && age >= this.minGoalDurationMs) {
                this.status = s;
            }
        }
        // Hard timeout
        if (age > this.timeoutMs) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: timeout (${(age / 1000).toFixed(1)}s)`);
            this.status = YUKA.Goal.STATUS.FAILED;
        }
    }
    _isAmmoItemAvailable(item) {
        if (!item) return false;
        if (typeof item.isAvailable === 'function') {
            try {
                return item.isAvailable();
            } catch  {
                return false;
            }
        }
        return item.isAvailable !== false;
    }
    terminate() {
        this.clearSubgoals();
        const agent = this.owner?.agent;
        if (agent) {
            const dur = (performance.now() - this.goalStartTime) / 1000;
            const total = getTotalUsableAmmo(agent);
            const cap = Math.max(1, getMaxAmmoCapacity(agent));
            const ratio = total / cap;
            Logger.goal(`[${agent.entity?.name || 'Agent'}] AMMO GOAL: Terminated after ${dur.toFixed(1)}s (final ratio: ${(ratio * 100).toFixed(1)}%)`);
            // Notify evaluator of completion
            if (agent.brain?.evaluators) {
                const ammoEval = agent.brain.evaluators.find((e)=>e.constructor.name.includes('Ammo'));
                if (ammoEval && typeof ammoEval.onAmmoGoalCompleted === 'function') {
                    try {
                        ammoEval.onAmmoGoalCompleted(agent, this.status === YUKA.Goal.STATUS.COMPLETED);
                    } catch (e) {
                        Logger.warn(`[${agent.entity?.name}] ammoEval.onAmmoGoalCompleted threw:`, e);
                    }
                }
            }
        }
    }
    // ✅ NEW: Dynamic priority based on ammo ratio and combat state
    getPriority() {
        const agent = this.owner?.agent;
        if (!agent) return this.priority;
        const total = getTotalUsableAmmo(agent);
        const cap = Math.max(1, getMaxAmmoCapacity(agent));
        const ammoRatio = total / cap;
        // Check if in combat
        const hasTarget = agent.targetSystem?.hasTarget?.() || false;
        const inCombat = hasTarget || agent.stateMachine?.currentState?.type === 'combat';
        // Use helper to get ammo-based priority
        return getAmmoPriorityByRatio(ammoRatio, inCombat);
    }
    // ✅ NEW: Ammo goals can be interrupted by critical health or visible enemies
    canInterrupt() {
        const agent = this.owner?.agent;
        if (!agent) return true;
        const goalAge = performance.now() - (this.goalStartTime || 0);
        // Enforce minimum duration
        if (goalAge < this.minGoalDurationMs) {
            return false;
        }
        // If we have NO ammo at all, protect this goal more
        const total = getTotalUsableAmmo(agent);
        if (total === 0) {
            // Even with no ammo, allow interrupt if health is critical
            const healthRatio = agent.health / Math.max(1, agent.maxHealth);
            if (healthRatio <= 0.15) {
                Logger.aiDetail(`[${agent.entity?.name}] Ammo goal allows interrupt - critical health`);
                return true;
            }
            Logger.aiDetail(`[${agent.entity?.name}] Ammo goal protected - NO AMMO at all`);
            return false;
        }
        // Default: use base mixin logic
        return true;
    }
    /**
   * @param {object} owner - brain owner (agent wrapper)
   * @param {{reason?: string, minRatio?: number}} opts
   */ constructor(owner, opts = {}){
        super(owner);
        this.reason = opts.reason || 'low_ammo';
        // Consider success once we exceed this total-ammo ratio
        this.minRatio = typeof opts.minRatio === 'number' ? opts.minRatio : 0.25;
        this.targetAmmo = null;
        this.goalStartTime = 0;
        this.minGoalDurationMs = 2000; // INCREASED: Minimum 2 seconds to prevent thrashing
        this.timeoutMs = 10000;
        this._lastCheck = 0;
        this._checkInterval = 500; // Check less frequently
        this._hasLoggedActivation = false;
        this._evaluatorRequestedGoal = true; // Flag indicating evaluator determined this was needed
        // ✅ NEW: Goal interrupt system
        // Priority is dynamic based on ammo ratio and combat state
        this.priority = GOAL_PRIORITIES.RESOURCE_NORMAL; // Default, will be adjusted
        this.interruptible = true; // Can be interrupted by critical health or combat
        this.minPriorityGap = 15; // Requires moderate priority to interrupt
        applyGoalInterruptMixin(this);
    }
}

export { EnhancedGetAmmoGoal };
