import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { getAgentHealthRatio } from '../../utils/AgentUtilities.mjs';
import { EnhancedGetWeaponGoal } from '../composite/GetWeaponGoal.mjs';
import { globalCommitmentManager } from '../../behavior/decision/GoalCommitmentManager.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * GET WEAPON EVALUATOR (UPDATED)
 * ====================
 * Calculates the desirability of switching weapons or finding weapon pickups.
 *
 * KEY FIXES:
 * - Added `agentSuccessCooldown` to prevent "thrashing" (rapidly switching
 * between weapon goals) after a successful pickup.
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
class EnhancedGetWeaponEvaluator extends YUKA.GoalEvaluator {
    _getWS(agent) {
        return _safe(()=>agent.weaponSystem, null);
    }
    _isWSReady(ws) {
        return ws && ws.__wsBooted === true && ws.weapons && typeof ws.weapons === 'object' && ws.currentWeapon && typeof ws.currentWeapon === 'string';
    }
    _weaponNames(ws) {
        const wobj = ws && typeof ws.weapons === 'object' ? ws.weapons : null;
        if (!wobj) return this._lastKnownWeaponNames.slice();
        const names = [];
        for(const k in wobj)if (Object.prototype.hasOwnProperty.call(wobj, k)) names.push(k);
        this._lastKnownWeaponNames = names.slice();
        return names;
    }
    _isUnlocked(ws, name) {
        const w = _safe(()=>ws.weapons?.[name], null);
        return !!(w && w.unlocked !== false);
    }
    _ammoInfo(ws, name) {
        const w = _safe(()=>ws.weapons?.[name], null);
        const ammo = _num(w?.ammo, 0);
        const maxCap = _num(_safe(()=>ws.maxAmmo?.[name], 0), 0);
        const ratio = maxCap > 0 ? Math.max(0, Math.min(1, ammo / maxCap)) : ammo > 0 ? 0.5 : 0;
        return {
            ammo,
            maxCap,
            ratio
        };
    }
    _context(agent) {
        const hasTarget = !!_safe(()=>agent.targetSystem?.hasTarget(), false);
        const targetVisible = hasTarget && !!_safe(()=>agent.targetSystem?.isTargetVisible(), false);
        let targetDistance = null;
        if (hasTarget && agent.targetSystem) {
            const targetPos = _safe(()=>agent.targetSystem.getTargetPosition(), null);
            const agentPos = _safe(()=>agent.entity.getPosition(), null);
            if (targetPos && agentPos) {
                targetDistance = agentPos.distance(targetPos);
            }
        }
        return {
            hasTarget,
            targetVisible,
            targetDistance
        };
    }
    _weaponScore(ws, name, ctx) {
        const { ammo } = this._ammoInfo(ws, name);
        if (ammo <= 0) return 0;
        // Use combat system's fuzzy weapon scores if available
        const agent = this.owner?.agent || this.owner;
        if (agent?.combatSystem?.cachedWeaponScores) {
            const fuzzyScore = agent.combatSystem.cachedWeaponScores.get(name);
            if (fuzzyScore !== undefined) {
                return fuzzyScore * this.characterBias;
            }
        }
        // Fallback scoring
        const lname = (name || '').toLowerCase();
        const distance = ctx.targetDistance;
        const isPistol = lname.includes('pistol');
        const isShotgun = lname.includes('shotgun');
        const isMachinegun = lname.includes('machine') || lname.includes('smg');
        let rangePref = aiConfig.evaluators.WEAPON_RANGE_PREF_DEFAULT;
        if (distance !== null && ctx.hasTarget) {
            if (distance < aiConfig.evaluators.WEAPON_RANGE_CLOSE) {
                if (isShotgun) rangePref = aiConfig.evaluators.WEAPON_SHOTGUN_CLOSE_PREF;
                else if (isMachinegun) rangePref = aiConfig.evaluators.WEAPON_MACHINEGUN_CLOSE_PREF;
                else if (isPistol) rangePref = aiConfig.evaluators.WEAPON_PISTOL_CLOSE_PREF;
            } else if (distance < aiConfig.evaluators.WEAPON_RANGE_MID) {
                if (isMachinegun) rangePref = aiConfig.evaluators.WEAPON_MACHINEGUN_MID_PREF;
                else if (isShotgun) rangePref = aiConfig.evaluators.WEAPON_SHOTGUN_MID_PREF;
                else if (isPistol) rangePref = aiConfig.evaluators.WEAPON_PISTOL_MID_PREF;
            } else {
                if (isMachinegun) rangePref = aiConfig.evaluators.WEAPON_MACHINEGUN_FAR_PREF;
                else if (isShotgun) rangePref = aiConfig.evaluators.WEAPON_SHOTGUN_FAR_PREF;
                else if (isPistol) rangePref = aiConfig.evaluators.WEAPON_PISTOL_FAR_PREF;
            }
        } else {
            if (isShotgun) rangePref = aiConfig.evaluators.WEAPON_SHOTGUN_DEFAULT_PREF;
            else if (isMachinegun) rangePref = aiConfig.evaluators.WEAPON_MACHINEGUN_DEFAULT_PREF;
            else if (isPistol) rangePref = aiConfig.evaluators.WEAPON_PISTOL_DEFAULT_PREF;
        }
        const { ratio } = this._ammoInfo(ws, name);
        const ammoScale = 0.3 + ratio * 0.7;
        let ctxMul = aiConfig.evaluators.WEAPON_CONTEXT_MULTIPLIER;
        if (ctx.hasTarget && ctx.targetVisible) {
            ctxMul = aiConfig.evaluators.WEAPON_CONTEXT_BOOST;
        }
        let s = this.tweaker * ammoScale * rangePref * ctxMul;
        return Math.max(0, Math.min(1, s)) * this.characterBias;
    }
    _isInBackoff(agentId, now) {
        if (!agentId) return false;
        const backoffState = this.agentBackoffState.get(agentId);
        if (!backoffState) return false;
        const timeSinceLastAttempt = now - backoffState.lastAttempt;
        return timeSinceLastAttempt < backoffState.backoffMs;
    }
    calculateDesirability(owner) {
        const agent = owner?.agent || owner;
        // 🔧 DEBUG: Reduced verbosity - only log when Logger.isEnabled('GOAL')
        if (Logger.isEnabled && Logger.isEnabled('GOAL')) {
            const agentName = agent?.entity?.name || 'Unknown';
            Logger.goal?.(`[${agentName}] Weapon evaluator calculating...`);
        }
        if (!agent || !agent.entity) {
            return 0;
        }
        // ✅ FIX: Check success cooldown first to prevent thrashing
        const agentId = _safe(()=>agent.entity.getGuid());
        const now = performance.now();
        const successCooldownEnd = this.agentSuccessCooldown.get(agentId) || 0;
        if (now < successCooldownEnd) {
            // On success cooldown, don't seek any weapons
            Logger.goal?.(`[${agent.entity.name}] Weapon evaluator on SUCCESS COOLDOWN - returning 0`);
            return 0;
        }
        // ✅ CRITICAL FIX: Don't seek weapons when dying OR when enemy spotted!
        // Get health ratio from health system properly using utility function
        const healthRatio = getAgentHealthRatio(agent);
        // Get personality flee threshold (default 30% if no personality)
        const personality = agent.personalitySystem;
        const fleeThreshold = personality ? personality.fleeThreshold : 0.30;
        // Check if under active fire
        const ctx = this._context(agent);
        // ✅ FIX: If we have ANY target (spotted enemy), FIGHT FIRST - don't seek weapons!
        // Humans shoot enemies on sight, they don't go shopping for better guns mid-combat
        if (ctx.hasTarget) {
            const ws = this._getWS(agent);
            const currentName = _safe(()=>ws?.currentWeapon, null);
            const curInfo = currentName ? this._ammoInfo(ws, currentName) : {
                ammo: 0
            };
            // Only seek weapons if current weapon is TOTALLY useless (no ammo)
            if (curInfo.ammo <= 0) {
                Logger.goal?.(`[${agent.entity?.name}] ⚠️ Enemy spotted but NO AMMO - allowing weapon switch (reduced priority)`);
                // Continue evaluation but reduce final result dramatically
                return 0.15 * this.characterBias; // Very low priority
            } else {
                Logger.goal?.(`[${agent.entity?.name}] ⚠️ Enemy spotted with weapon (${currentName}) - FIGHT, don't seek pickups!`);
                return 0; // ZERO - combat takes absolute priority
            }
        }
        // If health is below flee threshold, dramatically reduce weapon seeking priority
        if (healthRatio <= fleeThreshold) {
            // At critical HP, only seek weapons if we have literally NO weapon
            const ws = this._getWS(agent);
            const currentName = _safe(()=>ws?.currentWeapon, null);
            const curInfo = currentName ? this._ammoInfo(ws, currentName) : {
                ammo: 0
            };
            if (!currentName || curInfo.ammo <= 0) {
                // Absolutely no weapon - allow seeking but reduced priority
                Logger.goal?.(`[${agent.entity?.name}] ⚠️ Critical HP (${Math.round(healthRatio * 100)}%) but NO WEAPON - reduced weapon seeking`);
                // Return small value to allow weapon goals but health will win
                return 0.1 * this.characterBias;
            } else {
                // Has weapon with ammo - survival takes absolute priority
                Logger.goal?.(`[${agent.entity?.name}] ⚠️ Critical HP (${Math.round(healthRatio * 100)}%) - ZERO weapon desirability (has ${currentName})`);
                Logger.aiState(`[GetWeaponEvaluator] 🚨 LOW HP (${Math.round(healthRatio * 100)}%) - Returning 0 (has weapon: ${currentName})`);
                return 0;
            }
        }
        // Check backoff first
        if (this._isInBackoff(agentId, now)) {
            const cached = {
                value: 0,
                timestamp: now
            };
            this.agentDesirabilityCache.set(agentId, cached);
            Logger.goal?.(`[${agent.entity?.name}] Weapon evaluator in backoff - returning 0`);
            return 0;
        }
        // Evaluation throttling
        const lastEval = this.agentLastEvaluation.get(agentId) || 0;
        if (now - lastEval < this.EVALUATION_THROTTLE_MS) {
            const cached = this.agentDesirabilityCache.get(agentId);
            if (cached && now - cached.timestamp < this.DESIRABILITY_CACHE_MS) {
                return cached.value;
            }
        }
        this.agentLastEvaluation.set(agentId, now);
        const ws = this._getWS(agent);
        if (!ws || !this._isWSReady(ws)) {
            const cached = {
                value: 0,
                timestamp: now
            };
            this.agentDesirabilityCache.set(agentId, cached);
            return 0;
        }
        const names = this._weaponNames(ws);
        if (!names.length) {
            const cached = {
                value: 0,
                timestamp: now
            };
            this.agentDesirabilityCache.set(agentId, cached);
            return 0;
        }
        const currentName = _safe(()=>ws.currentWeapon, null);
        // ctx already declared earlier - reuse it
        const curInfo = currentName ? this._ammoInfo(ws, currentName) : {
            ammo: 0,
            ratio: 0
        };
        if (ctx.hasTarget && ctx.targetVisible && curInfo.ammo > 0) {
            const currentScore = this._weaponScore(ws, currentName, ctx);
            // Only suppress excellent weapons (pistol always upgradeable)
            if (currentScore >= 0.92 && !currentName.toLowerCase().includes('pistol')) {
                const cached = {
                    value: 0.05 * this.characterBias,
                    timestamp: now
                };
                this.agentDesirabilityCache.set(agentId, cached);
                return cached.value;
            }
        }
        const currentScore = currentName ? this._weaponScore(ws, currentName, ctx) : 0;
        const hasDecentWeapon = currentScore >= this.MIN_WEAPON_SCORE;
        const hasPistolOnly = currentName && currentName.toLowerCase().includes('pistol');
        Logger.goal?.(`[${agent.entity.name}] Current weapon: ${currentName}, score: ${currentScore.toFixed(3)}, hasDecent: ${hasDecentWeapon}, hasPistolOnly: ${hasPistolOnly}`);
        if (hasPistolOnly && healthRatio > 0.7) {
            const pistolUpgradeDesirability = 0.6 * this.characterBias;
            Logger.goal?.(`[${agent.entity.name}] 🔫 PISTOL UPGRADE PRIORITY: ${pistolUpgradeDesirability.toFixed(2)} (healthy agent needs better weapon)`);
            const cached = {
                value: pistolUpgradeDesirability,
                timestamp: now
            };
            this.agentDesirabilityCache.set(agentId, cached);
            return pistolUpgradeDesirability;
        }
        const switchState = this.agentWeaponSwitchStates.get(agentId);
        const inSwitchCooldown = switchState && now - switchState.lastSwitchTime < this.WEAPON_SWITCH_COOLDOWN;
        let best = 0;
        let bestWeaponName = null;
        if (!inSwitchCooldown) {
            Logger.goal?.(`[${agent.entity.name}] Checking ${names.length} weapons for switching...`);
            for(let i = 0; i < names.length; i++){
                const n = names[i];
                if (!n || n === currentName) continue;
                const isUnlocked = this._isUnlocked(ws, n);
                Logger.goal?.(`[${agent.entity.name}]   - ${n}: unlocked=${isUnlocked}`);
                if (!isUnlocked) continue;
                const score = this._weaponScore(ws, n, ctx);
                Logger.goal?.(`[${agent.entity.name}]     Score: ${score.toFixed(3)}`);
                if (!ctx.hasTarget && hasDecentWeapon && currentScore > 0) {
                    // Only 5% improvement needed when not in combat
                    if (score > currentScore * 1.05) {
                        if (score > best) {
                            best = score;
                            bestWeaponName = n;
                        }
                    }
                } else {
                    if (score > best) {
                        best = score;
                        bestWeaponName = n;
                    }
                }
            }
        }
        Logger.goal?.(`[${agent.entity.name}] After weapon switch check: best=${best.toFixed(2)}, bestWeaponName=${bestWeaponName}`);
        const needsWeaponPickup = best === 0 && !hasDecentWeapon || hasPistolOnly && best === 0;
        Logger.goal?.(`[${agent.entity.name}] Weapon eval state: best=${best.toFixed(2)}, hasDecent=${hasDecentWeapon}, hasPistolOnly=${hasPistolOnly}, needsPickup=${needsWeaponPickup}`);
        if (needsWeaponPickup) {
            const gameManager = agent.app?.gameManager;
            Logger.goal?.(`[${agent.entity.name}] Checking for weapon pickups... gameManager=${!!gameManager}`);
            if (gameManager) {
                let allItems = [];
                if (typeof gameManager.getAllItems === 'function') {
                    allItems = gameManager.getAllItems() || [];
                    Logger.goal?.(`[${agent.entity.name}] Items from getAllItems(): ${allItems.length}`);
                } else if (Array.isArray(gameManager.items)) {
                    allItems = gameManager.items;
                    Logger.goal?.(`[${agent.entity.name}] Items from gameManager.items: ${allItems.length}`);
                } else {
                    Logger.warn(`[${agent.entity.name}] ❌ No items accessible from gameManager!`);
                }
                if (allItems.length > 0) {
                    Logger.goal?.(`[${agent.entity.name}] Sample items:`, allItems.slice(0, 3).map((item)=>({
                            type: item.itemType,
                            available: item.isAvailable,
                            entity: item.entity?.name
                        })));
                    const weaponPickups = allItems.filter((item)=>{
                        if (!item || !item.entity || item.entity.destroyed || !item.entity.enabled) return false;
                        const matchesType = [
                            'pistol',
                            'machinegun',
                            'shotgun'
                        ].includes(item.itemType);
                        let available = true;
                        if (typeof item.isAvailable === 'boolean') {
                            available = item.isAvailable;
                        } else if (typeof item.isAvailable === 'function') {
                            try {
                                available = item.isAvailable();
                            } catch  {
                                available = true;
                            }
                        }
                        if (matchesType || available) {
                            Logger.goal?.(`[${agent.entity.name}]   Item: ${item.itemType}, available: ${available}, matches: ${matchesType}`);
                        }
                        return matchesType && available;
                    });
                    Logger.goal?.(`[${agent.entity.name}] Weapon pickups found: ${weaponPickups.length}`);
                    if (weaponPickups.length > 0) {
                        best = hasPistolOnly ? 0.7 : 0.5;
                        bestWeaponName = 'pickup';
                        Logger.goal?.(`[${agent.entity.name}] ✅ WEAPON PICKUP AVAILABLE: ${weaponPickups.length} weapons, priority=${best.toFixed(2)}, current: ${currentName}`);
                    }
                }
            }
        }
        let finalDesirability = Math.min(1.0, best * this.characterBias);
        if (currentName && currentName.toLowerCase().includes('pistol') && bestWeaponName) {
            const bestLname = bestWeaponName.toLowerCase();
            if (bestLname.includes('machine') || bestLname.includes('shotgun')) {
                finalDesirability = Math.min(1.0, finalDesirability * 2.5);
                Logger.goal?.(`[${agent.entity.name}] WEAPON UPGRADE priority: pistol → ${bestWeaponName} (${finalDesirability.toFixed(2)})`);
            }
        }
        if (this._fuzzyPriorityHint !== undefined && this._fuzzyPriorityHint < 1.0) {
            const hintScale = Math.max(0.5, this._fuzzyPriorityHint); // Minimum 50% scaling
            finalDesirability *= hintScale;
            Logger.goal?.(`[${agent.entity.name}] Weapon desirability scaled by hint: ${this._fuzzyPriorityHint.toFixed(2)} → ${finalDesirability.toFixed(2)}`);
        }
        const cached = {
            value: finalDesirability,
            timestamp: now
        };
        this.agentDesirabilityCache.set(agentId, cached);
        const commitmentBonus = globalCommitmentManager.getCommitmentBonus(agent, 'weapon', finalDesirability);
        let adjustedDesirability = finalDesirability;
        if (commitmentBonus > 0) {
            adjustedDesirability += commitmentBonus;
            Logger.debug(`[${agent.entity.name}] Weapon commitment bonus: +${commitmentBonus.toFixed(2)}`);
        }
        globalCommitmentManager.updateCurrentGoalScore(agent, adjustedDesirability);
        Logger.goal?.(`[${agent.entity.name}] ═══ FINAL WEAPON DESIRABILITY: ${adjustedDesirability.toFixed(3)} (base=${finalDesirability.toFixed(2)}, bonus=${commitmentBonus.toFixed(2)}) ═══`);
        return adjustedDesirability;
    }
    setGoal(owner) {
        const agent = owner?.agent || owner;
        const brain = agent?.brain;
        if (!agent || !brain) return;
        const agentId = _safe(()=>agent.entity.getGuid());
        const now = performance.now();
        const currentGoal = brain.currentSubgoal?.();
        const cached = this.agentDesirabilityCache.get(agentId);
        const weaponDesirability = cached ? cached.value : 0.5;
        const switchEval = globalCommitmentManager.evaluateGoalSwitch(agent, 'weapon', weaponDesirability, currentGoal);
        if (!switchEval.shouldSwitch) {
            Logger.debug(`[${agent.entity.name}] Weapon goal blocked: ${switchEval.reason}`);
            return;
        }
        if (this._isInBackoff(agentId, now)) return;
        const lastGoalCreation = this.agentLastGoalCreation.get(agentId) || 0;
        if (now - lastGoalCreation < this.GOAL_CREATION_COOLDOWN) return;
        const ws = this._getWS(agent);
        const names = this._weaponNames(ws);
        const currentName = _safe(()=>ws.currentWeapon, null);
        const ctx = this._context(agent);
        let switchSuccess = false;
        if (ws && this._isWSReady(ws) && names.length > 0) {
            switchSuccess = this._tryWeaponSwitch(agent, ws, names, currentName, ctx, now);
        }
        if (!switchSuccess && !this._isInBackoff(agentId, now)) {
            this._createWeaponPickupGoal(agent, brain, agentId, now);
        }
    }
    _tryWeaponSwitch(agent, ws, names, currentName, ctx, now) {
        const agentId = _safe(()=>agent.entity.getGuid());
        let switchState = agentId ? this.agentWeaponSwitchStates.get(agentId) : null;
        if (!switchState && agentId) {
            switchState = {
                lastSwitchTime: 0,
                lastWeapon: null
            };
            this.agentWeaponSwitchStates.set(agentId, switchState);
        }
        let bestScore = -Infinity;
        let bestName = null;
        let currentScore = currentName ? this._weaponScore(ws, currentName, ctx) : 0;
        let hasDecentWeapon = currentScore >= this.MIN_WEAPON_SCORE;
        for(let i = 0; i < names.length; i++){
            const name = names[i];
            if (!name || name === currentName) continue;
            if (!this._isUnlocked(ws, name)) continue;
            const s = this._weaponScore(ws, name, ctx);
            if (s > bestScore) {
                bestScore = s;
                bestName = name;
            }
        }
        if (!bestName || bestScore <= 0) return false;
        if (switchState && now - switchState.lastSwitchTime < this.WEAPON_SWITCH_COOLDOWN) {
            return false;
        }
        if (!ctx.hasTarget && hasDecentWeapon && currentScore > 0) {
            const improvementRatio = bestScore / currentScore;
            if (improvementRatio < 1 + this.HYSTERESIS_THRESHOLD) {
                return false;
            }
        }
        if (switchState) {
            switchState.lastSwitchTime = now;
            switchState.lastWeapon = currentName;
        }
        try {
            if (typeof ws.switchWeapon === 'function') {
                const success = ws.switchWeapon(bestName);
                if (success) {
                    Logger?.goal?.(`[${agent.entity?.name}] WEAPON SWITCHED: ${currentName} → ${bestName}`);
                    return true;
                }
            }
        } catch (e) {
        // Silent failure
        }
        return false;
    }
    _createWeaponPickupGoal(agent, brain, agentId, now) {
        try {
            const owner = brain.owner;
            if (!owner) {
                Logger.warn('[GetWeaponEvaluator] Cannot create goal - brain.owner is null');
                return false;
            }
            brain.clearSubgoals?.();
            const weaponGoal = new EnhancedGetWeaponGoal(owner);
            brain.addSubgoal?.(weaponGoal);
            if (agentId) {
                this.agentLastGoalCreation.set(agentId, now);
            }
            Logger?.goal?.(`[${agent.entity?.name}] WEAPON PICKUP GOAL CREATED`);
            return true;
        } catch (e) {
            this._recordBackoffFailure(agentId, now, 'goal_creation_failed');
            return false;
        }
    }
    _recordBackoffFailure(agentId, now, reason) {
        if (!agentId) return;
        let backoffState = this.agentBackoffState.get(agentId);
        if (!backoffState) {
            backoffState = {
                lastAttempt: 0,
                backoffMs: 0,
                consecutiveFailures: 0,
                lastReason: null
            };
        }
        backoffState.consecutiveFailures++;
        backoffState.lastAttempt = now;
        backoffState.lastReason = reason;
        backoffState.backoffMs = Math.min(this.BACKOFF_MAX, this.BACKOFF_BASE * Math.pow(this.BACKOFF_MULTIPLIER, Math.min(backoffState.consecutiveFailures - 1, 3)) // Cap at 3 failures for backoff calc
        );
        this.agentBackoffState.set(agentId, backoffState);
        Logger?.goal?.(`[Agent] Weapon goal backoff: ${(backoffState.backoffMs / 1000).toFixed(1)}s after ${backoffState.consecutiveFailures} failures (${reason})`);
    }
    onWeaponGoalCompleted(agent, success) {
        const agentId = _safe(()=>agent.entity.getGuid());
        if (!agentId) return;
        if (success) {
            this.agentBackoffState.delete(agentId);
            Logger?.goal?.(`[${agent.entity?.name}] Weapon goal SUCCESS - backoff cleared`);
            // ✅ FIX: Set the success cooldown
            const now = performance.now();
            this.agentSuccessCooldown.set(agentId, now + this.SUCCESS_COOLDOWN_MS);
            Logger?.goal?.(`[${agent.entity?.name}] Applying weapon SUCCESS COOLDOWN for ${(this.SUCCESS_COOLDOWN_MS / 1000).toFixed(1)}s`);
        } else {
            const now = performance.now();
            this._recordBackoffFailure(agentId, now, 'goal_failed');
        }
    }
    cleanup() {
        const now = performance.now();
        const maxAge = 60000;
        // ✅ FIX: Add success cooldown map to cleanup
        for (const [agentId, timestamp] of this.agentSuccessCooldown.entries()){
            if (now - timestamp > maxAge) this.agentSuccessCooldown.delete(agentId);
        }
        for (const [agentId, timestamp] of this.agentLastEvaluation.entries()){
            if (now - timestamp > maxAge) this.agentLastEvaluation.delete(agentId);
        }
        for (const [agentId, cached] of this.agentDesirabilityCache.entries()){
            if (now - cached.timestamp > maxAge) this.agentDesirabilityCache.delete(agentId);
        }
        for (const [agentId, state] of this.agentWeaponSwitchStates.entries()){
            if (now - state.lastSwitchTime > maxAge) this.agentWeaponSwitchStates.delete(agentId);
        }
        for (const [agentId, state] of this.agentBackoffState.entries()){
            if (now - state.lastAttempt > maxAge) this.agentBackoffState.delete(agentId);
        }
        for (const [agentId, timestamp] of this.agentLastGoalCreation.entries()){
            if (now - timestamp > maxAge) this.agentLastGoalCreation.delete(agentId);
        }
    }
    constructor(characterBias = 1){
        super(characterBias);
        this.tweaker = aiConfig.evaluators.WEAPON_TWEAKER;
        this._lastKnownWeaponNames = [];
        // Weapon switching state
        this.agentWeaponSwitchStates = new Map();
        this.WEAPON_SWITCH_COOLDOWN = aiConfig.evaluators.WEAPON_SWITCH_COOLDOWN_MS;
        this.HYSTERESIS_THRESHOLD = aiConfig.evaluators.WEAPON_HYSTERESIS_THRESHOLD;
        this.MIN_WEAPON_SCORE = aiConfig.evaluators.WEAPON_MIN_SCORE;
        // Unified backoff state
        this.agentBackoffState = new Map();
        this.BACKOFF_BASE = aiConfig.evaluators.WEAPON_BACKOFF_BASE;
        this.BACKOFF_MAX = aiConfig.evaluators.WEAPON_BACKOFF_MAX;
        this.BACKOFF_MULTIPLIER = aiConfig.evaluators.WEAPON_BACKOFF_MULTIPLIER;
        // ✅ FIX: Added success cooldown to prevent thrashing
        this.agentSuccessCooldown = new Map();
        this.SUCCESS_COOLDOWN_MS = aiConfig.evaluators.WEAPON_SUCCESS_COOLDOWN_MS || 30000; // 30 seconds
        // Evaluation throttling
        this.agentLastEvaluation = new Map();
        this.EVALUATION_THROTTLE_MS = aiConfig.evaluators.WEAPON_EVALUATION_THROTTLE_MS;
        // Desirability cache
        this.agentDesirabilityCache = new Map();
        this.DESIRABILITY_CACHE_MS = aiConfig.evaluators.WEAPON_DESIRABILITY_CACHE_MS;
        // Goal creation tracking
        this.agentLastGoalCreation = new Map();
        this.GOAL_CREATION_COOLDOWN = aiConfig.evaluators.WEAPON_GOAL_CREATION_COOLDOWN;
    }
}

export { EnhancedGetWeaponEvaluator };
