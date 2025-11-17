import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { DirectApproachGoal } from '../atomic/approach/DirectApproachGoal.mjs';
import { EvasiveApproachGoal } from '../atomic/approach/EvasiveApproachGoal.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * EnhancedGetWeaponGoal.mjs (ESM)
 *
 * CONTRACT with evaluator:
 * - Evaluator selects this goal when a (more optimal) weapon is desired.
 * - Goal must NOT instantly complete just because *some* weapon is unlocked.
 * - Success when: (a) desired type acquired (if provided), OR
 *                 (b) weapon quality >= best available target quality.
 * - Short min commitment to avoid start→terminate thrash.
 */ // ------------ helpers ------------
function _safe(fn, fb = undefined) {
    try {
        return fn();
    } catch  {
        return fb;
    }
}
function _num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
}
function isWeaponNameLike(name, key) {
    if (!name) return false;
    const n = String(name).toLowerCase();
    const k = String(key).toLowerCase();
    return n.includes(k);
}
function weaponQualityFromString(str) {
    const s = (str || '').toLowerCase();
    if (s.includes('shotgun')) return 10;
    if (s.includes('machine_gun') || s.includes('machinegun')) return 8;
    if (s.includes('pistol')) return 5;
    return 7;
}
function weaponQualityFromItem(item) {
    const label = item?.itemType || item?.entity?.name || '';
    return weaponQualityFromString(label);
}
function currentWeaponQuality(ws) {
    const label = ws?.currentWeapon || '';
    return weaponQualityFromString(label);
}
function hasAmmoForWeapon(w) {
    return _num(w?.ammo, 0) + _num(w?.magazine, 0) > 0;
}
// ---------------------------------
class EnhancedGetWeaponGoal extends YUKA.CompositeGoal {
    _alreadyOptimal(ws) {
        // If a preferred type was requested, treat success only if we *have that type* with ammo.
        if (this.preferredWeaponType) {
            const cur = ws?.currentWeapon;
            const curW = ws?.weapons?.[cur];
            if (!cur || !curW) return false;
            return isWeaponNameLike(cur, this.preferredWeaponType) && hasAmmoForWeapon(curW);
        }
        // Otherwise, compare current quality vs best available on map.
        const curQ = currentWeaponQuality(ws);
        const bestItem = this._findBestWeaponItem(this.owner?.agent);
        const bestQ = bestItem ? weaponQualityFromItem(bestItem) : curQ; // if none on map, current is "best"
        return curQ >= bestQ && hasAmmoForWeapon(ws?.weapons?.[ws.currentWeapon]);
    }
    _findBestWeaponItem(agent) {
        if (!agent?.app?.gameManager) return null;
        const ws = agent.weaponSystem;
        const list = [];
        for (const item of agent.app.gameManager.items || []){
            if (!item?.entity || item.entity.destroyed || !item.entity.enabled) continue;
            // Item must look like a weapon and be available (unreserved or expired).
            const typeStr = (item.itemType || item.entity.name || '').toLowerCase();
            // ✅ CRITICAL FIX: Exclude ammo items - only target actual weapons!
            // Ammo items contain "_ammo" in their name (e.g., "shotgun_ammo", "machinegun_ammo", "pistol_ammo")
            const isAmmo = typeStr.includes('_ammo') || typeStr.includes(' ammo');
            // For ammo items, only consider them if we have that weapon unlocked
            if (isAmmo) {
                const weaponType = typeStr.replace('_ammo', '').replace(' ammo', '').trim();
                const hasWeaponUnlocked = ws?.weapons?.[weaponType]?.unlocked === true;
                if (!hasWeaponUnlocked) {
                    continue; // Skip ammo for weapons we don't have
                }
            }
            const typeLooksLikeWeapon = typeStr.includes('weapon') || typeStr.includes('shotgun') || typeStr.includes('machinegun') || typeStr.includes('machine_gun') || typeStr.includes('pistol');
            if (!typeLooksLikeWeapon) continue;
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
            // reservation
            const agentGuid = _safe(()=>agent.entity.getGuid(), null);
            const now = performance.now();
            if (item.reservedBy && item.reservedBy !== agentGuid && now < (item.reservationExpiry || 0)) continue;
            // preferred type filter (if provided)
            if (this.preferredWeaponType && !isWeaponNameLike(typeStr, this.preferredWeaponType)) continue;
            // 🔧 FIX: Only skip if we have this EXACT weapon type AND it's not an upgrade
            if (ws && ws.weapons) {
                const weaponName = item.itemType;
                const existingWeapon = ws.weapons[weaponName];
                if (existingWeapon && existingWeapon.unlocked !== false) {
                    // We have this weapon - but should we still pick it up?
                    const hasAmmo = hasAmmoForWeapon(existingWeapon);
                    const currentQ = currentWeaponQuality(ws);
                    const thisQ = weaponQualityFromItem(item);
                    // Skip only if we have ammo AND this isn't a quality upgrade
                    if (hasAmmo && thisQ <= currentQ) {
                        continue; // Already have this weapon with ammo and it's not better
                    }
                }
            }
            list.push(item);
        }
        if (list.length === 0) return null;
        // Score = quality / (1 + 0.1*distance)
        const pos = agent.entity.getPosition();
        let best = null, bestScore = -Infinity;
        for (const it of list){
            const q = weaponQualityFromItem(it);
            const d = pos.distance(it.entity.getPosition());
            const score = q / (1 + 0.1 * d);
            if (score > bestScore) {
                bestScore = score;
                best = it;
            }
        }
        return best;
    }
    _reserve(item, agent, seconds = 10) {
        try {
            const now = performance.now();
            item.reservedBy = agent.entity.getGuid();
            item.reservationExpiry = now + seconds * 1000;
            item.reservationReason = 'weapon_seek';
            return true;
        } catch  {
            return false;
        }
    }
    _release(item, agent) {
        try {
            if (!item) return;
            const guid = _safe(()=>agent.entity.getGuid(), null);
            if (item.reservedBy && item.reservedBy === guid) {
                delete item.reservedBy;
                delete item.reservationExpiry;
                delete item.reservationReason;
            }
        } catch  {}
    }
    activate() {
        const agent = this.owner?.agent;
        this.goalStartTime = performance.now();
        this.clearSubgoals();
        this._hasLoggedActivation = false;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // --- This section is unchanged ---
        const ws = agent.weaponSystem;
        const currentWeapon = ws?.currentWeapon;
        const hasPistolOnly = currentWeapon && currentWeapon.toLowerCase().includes('pistol');
        const hasUnlockedWeapon = ws && ws.weapons && Object.values(ws.weapons).some((w)=>w && w.unlocked === true && hasAmmoForWeapon(w));
        const currentQuality = currentWeaponQuality(ws);
        const bestAvailableWeapon = this._findBestWeaponItem(agent);
        const bestAvailableQuality = bestAvailableWeapon ? weaponQualityFromItem(bestAvailableWeapon) : 0;
        const hasOptimalWeapon = hasUnlockedWeapon && currentQuality >= bestAvailableQuality;
        if (hasOptimalWeapon && bestAvailableQuality > 0) {
            Logger.info(`[${agent.entity?.name || 'Agent'}] ✅ WEAPON GOAL: Have optimal weapon (${currentWeapon}, quality=${currentQuality}) vs available (quality=${bestAvailableQuality}), completing immediately`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        if (hasPistolOnly && bestAvailableQuality > currentQuality) {
            Logger.info(`[${agent.entity?.name || 'Agent'}] 🔫 WEAPON GOAL: Have pistol only (quality=${currentQuality}) - seeking upgrade (available quality=${bestAvailableQuality})`);
        }
        this._initialConditions = {
            currentWeapon: ws?.currentWeapon,
            currentQuality: currentWeaponQuality(ws),
            hasAmmo: ws?.weapons?.[ws?.currentWeapon] ? hasAmmoForWeapon(ws.weapons[ws.currentWeapon]) : false
        };
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Searching for best weapon...`);
        this.targetWeapon = this._findBestWeaponItem(agent);
        if (!this.targetWeapon) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: no weapons available on map`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Found weapon: ${this.targetWeapon.itemType || this.targetWeapon.entity?.name}`);
        const agentPos = agent.entity.getPosition();
        const targetPos = this.targetWeapon.entity.getPosition();
        const distance = agentPos.distance(targetPos);
        const travelTime = distance / 4.0 * 1000; // ms
        const baseTime = 10000; // 10s base
        const pickupTime = 8000; // 8s for pickup
        const retryBuffer = 10000; // 10s for retries
        this.maxGoalDurationMs = Math.max(45000, baseTime + travelTime + pickupTime + retryBuffer);
        this.dynamicTimeout = true;
        Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Distance ${distance.toFixed(2)}m, timeout set to ${(this.maxGoalDurationMs / 1000).toFixed(1)}s`);
        this.attempted.add(_safe(()=>this.targetWeapon.entity.getGuid(), ''));
        const reserveSuccess = this._reserve(this.targetWeapon, agent, 15);
        if (!reserveSuccess) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Failed to reserve weapon`);
        } else {
            Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Reserved weapon ${this.targetWeapon.itemType}`);
        }
        // --- End of unchanged section ---
        // ✅ ==== REFACTORED BLOCK ====
        // Use the navigation adapter's helper function to project the weapon position
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Projecting weapon position onto navmesh...`);
        const rawPos = this.targetWeapon.entity.getPosition();
        // Use the helper function from AgentNavigationAdapter.js
        // We pass the raw pc.Vec3 and the 5.0m search radius
        const target = agent.navigation.findValidNavMeshPosition(rawPos, 5.0);
        // CRITICAL: If the target is null, the item is not on the navmesh. Fail the goal.
        if (!target) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: No navmesh region found near weapon (name: ${this.targetWeapon.itemType}). Item is likely off-mesh. Failing goal.`);
            this._release(this.targetWeapon, agent); // Release reservation
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // We have a valid, projected pc.Vec3. DirectApproachGoal will handle it.
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Target projected from Y=${rawPos.y.toFixed(2)} to Y=${target.y.toFixed(2)}`);
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Final Target: (${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`);
        // ✅ ==== END OF REFACTORED BLOCK ====
        // --- This section is unchanged ---
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Checking combat state...`);
        const hasTarget = !!agent?.targetSystem?.hasTarget?.();
        const visible = hasTarget && !!agent?.targetSystem?.isTargetVisible?.();
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Combat state: hasTarget=${hasTarget}, visible=${visible}`);
        let approachGoal;
        try {
            if (hasTarget && visible) {
                Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Creating EvasiveApproachGoal...`);
                approachGoal = new EvasiveApproachGoal(this.owner, target, agent);
                Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: EvasiveApproachGoal created successfully`);
            } else {
                Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Creating DirectApproachGoal...`);
                // 'target' is the projected pc.Vec3, which DirectApproachGoal's constructor handles
                approachGoal = new DirectApproachGoal(this.owner, target, agent);
                Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: DirectApproachGoal created successfully`);
            }
        } catch (error) {
            Logger.error(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: FATAL ERROR creating approach goal:`, error);
            this._release(this.targetWeapon, agent);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Setting completion distance to 0.3m...`);
        approachGoal._completeDist = 0.3;
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Adding subgoal...`);
        this.addSubgoal(approachGoal);
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Subgoal added successfully`);
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Setting status to ACTIVE...`);
        this.status = YUKA.Goal.STATUS.ACTIVE;
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Status set to ACTIVE successfully`);
        if (!this._hasLoggedActivation) {
            const targetType = this.targetWeapon?.itemType || this.targetWeapon?.entity?.name || 'unknown';
            const distance = agent.entity.getPosition().distance(this.targetWeapon.entity.getPosition());
            Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Activated (seeking ${targetType} at ${distance.toFixed(2)}m, current: ${this._initialConditions.currentWeapon})`);
            this._hasLoggedActivation = true;
        }
    }
    execute() {
        const agent = this.owner?.agent;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // ✅ FIX: CHECK EVERY FRAME IF WE HAVE A GOOD WEAPON (not just pistol)
        // This allows YUKA brain to re-arbitrate when we get MachineGun/Shotgun
        const ws = agent.weaponSystem;
        const currentWeapon = ws?.currentWeapon;
        const hasPistolOnly = currentWeapon && currentWeapon.toLowerCase().includes('pistol');
        const hasUnlockedWeapon = ws && ws.weapons && Object.values(ws.weapons).some((w)=>w && w.unlocked === true && hasAmmoForWeapon(w));
        // Only complete if we have a NON-PISTOL weapon with ammo
        const hasGoodWeapon = hasUnlockedWeapon && !hasPistolOnly;
        if (hasGoodWeapon) {
            Logger.info(`[${agent.entity?.name || 'Agent'}] ✅ WEAPON GOAL: Have good weapon (${currentWeapon}), completing to allow re-arbitration`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        const now = performance.now();
        const age = now - this.goalStartTime;
        // FIX: Only check for completion after minimum runtime
        // This prevents the instant termination loop
        if (age >= this.minGoalDurationMs && now - this._lastCheck > this._checkInterval) {
            this._lastCheck = now;
            const ws = agent.weaponSystem;
            if (ws?.weapons) {
                // Check if we've improved our weapon situation
                const currentQ = currentWeaponQuality(ws);
                const initialQ = this._initialConditions?.currentQuality || 0;
                const hasImproved = currentQ > initialQ;
                // Check if we picked up the preferred type
                if (this.preferredWeaponType && isWeaponNameLike(ws.currentWeapon, this.preferredWeaponType)) {
                    Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: acquired preferred weapon type (${ws.currentWeapon})`);
                    this._release(this.targetWeapon, agent);
                    this.status = YUKA.Goal.STATUS.COMPLETED;
                    return;
                }
                // Check if we're now optimal
                if (this._alreadyOptimal(ws)) {
                    Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: optimal weapon achieved (${ws.currentWeapon})`);
                    this._release(this.targetWeapon, agent);
                    this.status = YUKA.Goal.STATUS.COMPLETED;
                    return;
                }
                // Check if we've at least improved
                if (hasImproved && hasAmmoForWeapon(ws.weapons[ws.currentWeapon])) {
                    Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: weapon improved (${this._initialConditions.currentWeapon} → ${ws.currentWeapon})`);
                    this._release(this.targetWeapon, agent);
                    this.status = YUKA.Goal.STATUS.COMPLETED;
                    return;
                }
            }
        }
        // ✅ REMOVED: Distance-based detection (matches GetHealthGoal pattern)
        // The DirectApproachGoal has _completeDist = 0.3m which ensures AI gets
        // close enough to trigger the collision. We rely on navigation completion.
        // ✅ FIX: While waiting for pickup, check if weapon was acquired
        if (this.waitingForPickup) {
            const waited = now - this.waitStartTime;
            // Check if the item was consumed (by us or someone else)
            if (this.targetWeapon && typeof this.targetWeapon.isAvailable === 'boolean' && !this.targetWeapon.isAvailable) {
                Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Item consumed via trigger, checking success...`);
                this._lastCheck = now - this._checkInterval; // Force success check on next frame
                return;
            }
            // Check if we acquired the weapon (quality improved)
            const currentQ = currentWeaponQuality(ws);
            const initialQ = this._initialConditions?.currentQuality || 0;
            if (currentQ > initialQ) {
                Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Weapon acquired via collision (${this._initialConditions.currentWeapon} → ${ws.currentWeapon})`);
                this._release(this.targetWeapon, agent);
                this.status = YUKA.Goal.STATUS.COMPLETED;
                return;
            }
            // Timeout if trigger collision doesn't occur within reasonable time
            if (waited > this.maxPickupWaitTime) {
                Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Pickup timeout after ${(waited / 1000).toFixed(1)}s - collision didn't trigger`);
                this._release(this.targetWeapon, agent);
                this._retryOrFail(agent);
                return;
            }
            return; // Stay in waiting state
        }
        // Drive subgoals
        const s = this.executeSubgoals();
        // ✅ FIX: When navigation completes, start waiting for collision trigger (matches GetHealthGoal)
        if (s === YUKA.Goal.STATUS.COMPLETED) {
            if (!this.waitingForPickup) {
                this.waitingForPickup = true;
                this.waitStartTime = now;
                Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Navigation completed (AI at weapon), waiting for collision trigger...`);
            }
            return;
        }
        // 🚫 REMOVED: Direct movement fallback that walks through walls
        // The AI should use navmesh pathfinding only - if navmesh can't reach the weapon,
        // the goal should fail and try a different weapon or different goal
        // Check if DirectApproachGoal failed
        if (s === YUKA.Goal.STATUS.FAILED && age > this.minGoalDurationMs) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: DirectApproachGoal failed - weapon unreachable via navmesh`);
            this._release(this.targetWeapon, agent);
            this._retryOrFail(agent);
            return;
        }
        // Hard timeout
        if (age > this.maxGoalDurationMs) {
            const distance = this.targetWeapon ? agent.entity.getPosition().distance(this.targetWeapon.entity.getPosition()) : 0;
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: max duration reached (${(age / 1000).toFixed(1)}s/${(this.maxGoalDurationMs / 1000).toFixed(1)}s), distance: ${distance.toFixed(2)}m`);
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Current Goal: 'EnhancedGetWeaponGoal', Status: 'failed', Attempt: ${this.attempt}/${this.maxAttempts}`);
            this._release(this.targetWeapon, agent);
            this.status = YUKA.Goal.STATUS.FAILED;
        }
    }
    _retryOrFail(agent) {
        this.attempt += 1;
        Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Retry logic triggered (attempt ${this.attempt}/${this.maxAttempts})`);
        if (this.attempt >= this.maxAttempts) {
            this._release(this.targetWeapon, agent);
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Max retry attempts reached, failing goal`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Try another weapon
        const next = this._findBestWeaponItem(agent);
        if (!next) {
            this._release(this.targetWeapon, agent);
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: No alternative weapons found, failing goal`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        const nextGuid = _safe(()=>next.entity.getGuid(), '');
        const currentGuid = _safe(()=>this.targetWeapon?.entity.getGuid(), '');
        if (nextGuid === currentGuid) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Same weapon selected for retry, failing goal`);
            this._release(this.targetWeapon, agent);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        this._release(this.targetWeapon, agent);
        this.targetWeapon = next;
        this.attempted.add(nextGuid);
        const pos = next.entity.getPosition();
        const agentPos = agent.entity.getPosition();
        const distance = agentPos.distance(pos);
        Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: Switching to alternative weapon (${next.itemType}) at ${distance.toFixed(2)}m`);
        // ✅ ==== REFACTORED BLOCK ====
        // Use the navigation adapter's helper function to project the new target position
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL (RETRY): Projecting new target onto navmesh...`);
        // Use the helper function from AgentNavigationAdapter.js
        const target = agent.navigation.findValidNavMeshPosition(pos, 5.0); // 5m search radius
        // CRITICAL: If the new target is null, it's also not on the navmesh. Fail.
        if (!target) {
            Logger.warn(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL (RETRY): No navmesh region found near new weapon (name: ${this.targetWeapon.itemType}). Failing goal.`);
            this._release(this.targetWeapon, agent); // Release reservation
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        Logger.info(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL (RETRY): Projected from Y=${pos.y.toFixed(2)} to Y=${target.y.toFixed(2)}`);
        // ✅ ==== END OF REFACTORED BLOCK ====
        this.clearSubgoals();
        // 'target' is the projected pc.Vec3
        const retryApproach = new DirectApproachGoal(this.owner, target, agent);
        retryApproach._completeDist = 0.3; // Ensure AI enters 0.5m trigger volume
        this.addSubgoal(retryApproach);
        this.waitingForPickup = false;
        this._reserve(next, agent, 15);
        Logger.goal(`[${agent.entity?.name || 'Agent'}] WEAPON GOAL: retry attempt ${this.attempt}/${this.maxAttempts}`);
    }
    /**
   * 🔧 FIX: Try multiple pickup methods to ensure reliability
   */ terminate() {
        const agent = this.owner?.agent;
        this._release(this.targetWeapon, agent);
        this.clearSubgoals();
        const dur = (performance.now() - this.goalStartTime) / 1000;
        if (agent) {
            const ws = agent.weaponSystem;
            const finalWeapon = ws?.currentWeapon || 'none';
            const initialWeapon = this._initialConditions?.currentWeapon || 'none';
            Logger.goal(`[${agent?.entity?.name || 'Agent'}] WEAPON GOAL: Terminated after ${dur.toFixed(1)}s (${initialWeapon} → ${finalWeapon})`);
            // Notify evaluator of completion
            if (agent.brain?.evaluators) {
                for (const evaluator of agent.brain.evaluators){
                    if (evaluator.onWeaponGoalCompleted) {
                        evaluator.onWeaponGoalCompleted(agent, this.status === YUKA.Goal.STATUS.COMPLETED);
                    }
                }
            }
        } else {
            Logger.goal(`[Agent] WEAPON GOAL: Terminated after ${dur.toFixed(1)}s`);
        }
    }
    canBePreempted() {
        // Allow preemption only after min commitment and not during pickup
        const age = performance.now() - this.goalStartTime;
        if (age < this.minGoalDurationMs) return false;
        if (this.waitingForPickup) return false;
        return true;
    }
    /**
   * @param {object} owner
   * @param {string|null} preferredWeaponType  (e.g., 'shotgun' | 'machinegun' | 'pistol')
   */ constructor(owner, preferredWeaponType = null){
        super(owner);
        this.preferredWeaponType = preferredWeaponType; // may be null
        this.targetWeapon = null;
        // ✅ OPTIMIZED FOR REALISTIC FPS AI (Oct 23, 2025)
        this.goalStartTime = 0;
        this.minGoalDurationMs = 1500; // ✅ Faster commitment - humans decide quickly
        this.maxGoalDurationMs = 45000; // 🔧 FIX: 45s allows navigation through obstacles + retries
        this.dynamicTimeout = false; // 🔧 FIX: Will calculate based on distance
        // ✅ OPTIMIZED: Weapon pickup settings (matches GetHealthGoal pattern)
        this.waitingForPickup = false;
        this.waitStartTime = 0;
        this.maxPickupWaitTime = 5000; // Match GetHealthGoal's maxWaitTime
        // ✅ OPTIMIZED: More persistent - humans really want better weapons
        this.attempted = new Set();
        this.maxAttempts = 4; // ✅ More attempts
        this.attempt = 0;
        this._lastCheck = 0;
        this._checkInterval = 500; // Check less frequently
        this._hasLoggedActivation = false;
        this._evaluatorRequestedGoal = true; // Flag indicating evaluator determined this was needed
        this._initialConditions = null; // Store initial conditions to compare later
    }
}

export { EnhancedGetWeaponGoal };
