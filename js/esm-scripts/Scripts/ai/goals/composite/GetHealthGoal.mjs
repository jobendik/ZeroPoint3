import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { DirectApproachGoal } from '../atomic/approach/DirectApproachGoal.mjs';
import { EvasiveApproachGoal } from '../atomic/approach/EvasiveApproachGoal.mjs';
import { getHealthPriorityByRatio, GOAL_PRIORITIES, applyGoalInterruptMixin } from '../GoalInterruptMixin.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
function _ensureAgentDiagnostics(agent) {
    if (!agent) return;
    agent.__diag = agent.__diag || {
        lastWarn: Object.create(null),
        backoffUntil: Object.create(null)
    };
}
function _warnThrottled(agent, key, message, intervalMs = 3000) {
    if (!agent) {
        Logger.warn(message);
        return;
    }
    _ensureAgentDiagnostics(agent);
    const now = performance.now();
    const last = agent.__diag.lastWarn[key] || 0;
    if (now - last >= intervalMs) {
        agent.__diag.lastWarn[key] = now;
        Logger.warn(message);
    } else {
        Logger.debug && Logger.debug(message);
    }
}
function _setBackoff(agent, key, ms) {
    if (!agent) return;
    _ensureAgentDiagnostics(agent);
    agent.__diag.backoffUntil[key] = performance.now() + ms;
}
function _isInBackoff(agent, key) {
    if (!agent) return false;
    _ensureAgentDiagnostics(agent);
    return performance.now() < (agent.__diag.backoffUntil[key] || 0);
}
/**
 * EnhancedGetHealthGoal - Composite goal for health seeking behavior
 * 
 * Manages the entire health seeking sequence:
 * - Finding available health items
 * - Validating and projecting positions to navmesh
 * - Reserving items to prevent conflicts
 * - Navigating to health items
 * - Handling pickup detection and timeouts
 * - Loop prevention to avoid retrying failed items
 * - Recovery from movement failures
 */ class EnhancedGetHealthGoal extends YUKA.CompositeGoal {
    /**
     * Get effective health for the agent
     */ getEffectiveHealth(agent) {
        return agent ? agent.health : 0;
    }
    canBeInterrupted() {
        const agent = this.owner.agent;
        if (!agent) return true;
        const now = performance.now();
        const goalAge = now - this.goalStartTime;
        const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
        // ✅ CRITICAL FIX: Check for active threats FIRST
        // AI must be able to defend itself even when seeking health
        const hasTarget = agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && agent.targetSystem?.isTargetVisible?.();
        const isUnderFire = agent.combatCore?.isUnderFire?.() || false;
        // If AI is being shot at or has visible enemy, ALWAYS allow interruption for combat
        if (isUnderFire || isTargetVisible) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal CAN be interrupted - under threat (underFire=${isUnderFire}, visibleEnemy=${isTargetVisible})`);
            return true;
        }
        // Only protect goal if health is CRITICALLY low (<15%) and no immediate threats
        if (healthRatio < 0.15) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal protected - critically low HP (${(healthRatio * 100).toFixed(0)}%) and no immediate threat`);
            return false;
        }
        // Don't protect goal for very long - 3 seconds max
        if (goalAge > 3000) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal CAN be interrupted - too old (${(goalAge / 1000).toFixed(1)}s)`);
            return true;
        }
        // If at pickup location and about to collect, protect briefly
        if ((this.hasReachedTarget || this.waitingForPickup) && goalAge < 1000) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal protected - at pickup location (${(goalAge / 1000).toFixed(1)}s)`);
            return false;
        }
        // Default: allow interruption
        return true;
    }
    _setHealthCooldown(agent) {
        if (agent && agent.goalArbitration) {
            agent.goalArbitration.lastHealthGoalEnd = performance.now();
        }
    }
    activate() {
        const agent = this.owner.agent;
        if (_isInBackoff(agent, 'health:noItems')) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // ✅ FIX: Clear position validation failure flag on new activation
        this.positionValidationFailed = false;
        this.clearSubgoals();
        this.resetGoalState();
        if (agent) agent.isActivelySeekingHealth = true;
        this.initialHealth = this.getEffectiveHealth(agent);
        // 🔍 DEBUG: Verify flag is being set
        Logger.debug(`[${agent?.entity?.name || 'Agent'}] 🏥 Set isActivelySeekingHealth=true on vehicle (HP: ${this.getEffectiveHealth(agent)}/${agent?.maxHealth})`);
        const healthy = agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth >= 0.98;
        if (healthy) {
            this.status = YUKA.Goal.STATUS.COMPLETED;
            agent.isActivelySeekingHealth = false;
            agent.healthTargetPosition = null;
            const now = performance.now();
            try {
                agent.lastHealthGoalTime = now;
                agent.healthGoalCooldown = agent.healthGoalCooldown || 2000;
            } catch (e) {}
            this._setHealthCooldown(agent);
            if (agent && agent.healthEvaluator && typeof agent.healthEvaluator.onHealthGoalCompleted === 'function') {
                try {
                    agent.healthEvaluator.onHealthGoalCompleted(agent, true, 'already_healthy');
                } catch (e) {}
            }
            Logger.aiState(`[${agent.entity.name}] HealthGoal.activate: already healthy -> COMPLETE`);
            return;
        }
        Logger.goal(`GOAL: Enhanced GetHealthGoal activated (health: ${this.getEffectiveHealth(agent)}/${agent ? agent.maxHealth : '?'}, attempt: ${this.currentAttempt + 1}).`, agent, 'color: #00ff99; font-weight:bold;');
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Checking cooldown - lastFailureTime: ${this.lastFailureTime}, failureCooldown: ${this.failureCooldown}`);
        const now = performance.now();
        if (now - this.lastFailureTime < this.failureCooldown) {
            this.deferralCount = (this.deferralCount || 0) + 1;
            Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: In cooldown, deferralCount: ${this.deferralCount}`);
            if (this.deferralCount % 20 === 1) {
                Logger.debug && Logger.debug(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health goal on in-goal cooldown, failing immediately`);
            }
            if (agent) agent.isActivelySeekingHealth = false;
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        this.deferralCount = 0;
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Finding health item...`);
        const healthItem = this.findUntriedHealthItem(agent);
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Found health item:`, healthItem ? 'YES' : 'NO');
        if (!healthItem) {
            const injured = agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth < 0.98;
            Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: No health item found, injured: ${injured}`);
            if (injured) {
                _warnThrottled(agent, 'health:noItemsWarn', `[${agent && agent.entity ? agent.entity.name : 'Agent'}] No untried health items found (tried ${this.attemptedItems.size})`, this.warnIntervalMs);
                _setBackoff(agent, 'health:noItems', this.noItemsBackoffMs);
                if (agent) agent.isActivelySeekingHealth = false;
                this.status = YUKA.Goal.STATUS.FAILED;
            } else {
                this.status = YUKA.Goal.STATUS.COMPLETED;
                if (agent) {
                    agent.isActivelySeekingHealth = false;
                    this._setHealthCooldown(agent);
                }
                Logger.aiState(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] HealthGoal.activate: no items but healthy -> COMPLETE`);
            }
            return;
        }
        this.targetHealthPack = healthItem;
        if (healthItem && healthItem.entity && typeof healthItem.entity.getGuid === 'function') {
            this.attemptedItems.add(healthItem.entity.getGuid());
        }
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Target health pack set, validating position...`);
        const rawPos = healthItem.entity.getPosition();
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Raw position:`, rawPos);
        const valid = this.validateAndProjectPosition(agent, rawPos);
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Validation result:`, valid ? 'SUCCESS' : 'FAILED');
        if (!valid) {
            _warnThrottled(agent, 'health:posInvalidWarn', `[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health position validation failed`, this.warnIntervalMs);
            this.positionValidationFailed = true;
            if (agent) agent.isActivelySeekingHealth = false;
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        this.lastValidatedPosition = valid.clone();
        if (agent) agent.healthTargetPosition = valid.clone();
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Position validated, checking health again...`);
        if (agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth >= 0.98) {
            Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Agent became healthy during activation, completing`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            agent.isActivelySeekingHealth = false;
            agent.healthTargetPosition = null;
            this._setHealthCooldown(agent);
            Logger.aiState(`[${agent.entity.name}] HealthGoal: skipping reservation (already healthy)`);
            return;
        }
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Reserving health item...`);
        this.reserveHealthItem(agent, healthItem);
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Creating movement subgoal...`);
        const target = new YUKA.Vector3(valid.x, valid.y, valid.z);
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Target vector:`, target);
        // ✅ FIX: Use approach goal with VERY CLOSE completion distance
        // Medkit collision trigger is only 0.5m halfExtents (1.0m box total)
        // Must get AI within collision range, not just "close"
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Creating approach goal with tight completion distance`);
        const hasTarget = !!(agent && agent.targetSystem && agent.targetSystem.hasTarget && agent.targetSystem.hasTarget());
        const isVisible = !!(hasTarget && agent.targetSystem.isTargetVisible && agent.targetSystem.isTargetVisible());
        const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
        const isCritical = healthRatio < 0.5;
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Enemy check - hasTarget=${hasTarget}, isVisible=${isVisible}, HP=${(healthRatio * 100).toFixed(0)}%`);
        // Create approach goal
        let approachGoal;
        // ✅ HUMAN-LIKE: Use evasive movement when critically wounded OR enemy visible
        // Humans zigzag when wounded even if not currently being shot at
        if (hasTarget && isVisible || isCritical) {
            Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Creating EvasiveApproachGoal (critical=${isCritical}, visible=${isVisible})`);
            approachGoal = new EvasiveApproachGoal(this.owner, target, agent);
        } else {
            Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Creating DirectApproachGoal`);
            approachGoal = new DirectApproachGoal(this.owner, target, agent);
        }
        // ✅ CRITICAL FIX: Override completion distance to ensure AI enters trigger volume
        // Medkit trigger is 0.5m halfExtents, so we need to get within 0.3m to guarantee overlap
        approachGoal._completeDist = 0.3;
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Set approach completion distance to 0.3m (trigger is 0.5m)`);
        this.addSubgoal(approachGoal);
        Logger.debug(`[GetHealthGoal] 🏥 ACTIVATE DEBUG: Movement setup completed`);
    }
    findUntriedHealthItem(agent) {
        Logger.debug(`[GetHealthGoal] 🏥 FIND ITEM DEBUG: Starting search for ${agent?.entity?.name || 'Unknown'}`);
        if (!agent || !agent.app || !agent.app.gameManager) {
            Logger.debug(`[GetHealthGoal] 🏥 FIND ITEM DEBUG: No game manager available`);
            Logger.debug(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] No game manager available`);
            return null;
        }
        Logger.debug(`[GetHealthGoal] 🏥 FIND ITEM DEBUG: Getting valid health items...`);
        const validHealthItems = this.getValidHealthItems(agent.app.gameManager);
        Logger.debug(`[GetHealthGoal] 🏥 FIND ITEM DEBUG: Found ${validHealthItems.length} valid health items`);
        if (validHealthItems.length === 0) {
            Logger.debug(`[GetHealthGoal] 🏥 FIND ITEM DEBUG: No valid health items found`);
            if (agent.app && agent.app.frame % 300 === 0) {
                Logger.debug(`[${agent.entity.name}] No valid health items found in game manager (total items: ${agent.app.gameManager.items.length})`);
            }
            return null;
        }
        const agentPos = agent.entity.getPosition();
        let bestItem = null;
        let bestDistance = Infinity;
        for (const item of validHealthItems){
            const itemGuid = item.entity.getGuid();
            if (this.attemptedItems.has(itemGuid)) continue;
            if (!item.canBePickedUpBy(agent.entity)) continue;
            const distance = agentPos.distance(item.entity.getPosition());
            if (distance < bestDistance) {
                bestDistance = distance;
                bestItem = item;
            }
        }
        if (!bestItem && agent.app && agent.app.frame % 300 === 0) {
            Logger.debug(`[${agent.entity.name}] No untried health items found (${validHealthItems.length} valid items, ${this.attemptedItems.size} already tried)`);
        }
        return bestItem;
    }
    getValidHealthItems(gameManager) {
        Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Starting validation`);
        if (!gameManager || !gameManager.getAllItems) {
            Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: No gameManager or getAllItems method`);
            return [];
        }
        const allItems = gameManager.getAllItems();
        Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Total items from getAllItems(): ${allItems.length}`);
        const validItems = [];
        const now = performance.now();
        for (const item of gameManager.getAllItems()){
            if (!item) {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Skipping null item`);
                continue;
            }
            const entity = item.entity || item.owner || item.entityRef || item._entity || null;
            if (!entity) {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Skipping item with no entity`);
                continue;
            }
            if (entity.destroyed === true) {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Skipping destroyed entity`);
                continue;
            }
            if (entity.enabled === false) {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Skipping disabled entity`);
                continue;
            }
            let isHealthItem = false;
            if (item.itemType === 'health') {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by itemType`);
                isHealthItem = true;
            } else if (entity.tags && entity.tags.has) {
                if (entity.tags.has('health') || entity.tags.has('medkit') || entity.tags.has('health_pack')) {
                    Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by tags`);
                    isHealthItem = true;
                }
            } else if (typeof entity.name === 'string') {
                const name = entity.name.toLowerCase();
                if (name.includes('health') || name.includes('medkit') || name.includes('med_pack')) {
                    Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by name: ${entity.name}`);
                    isHealthItem = true;
                }
            } else if (entity.script && (entity.script.healthPickup || entity.script.medKit || entity.script.pickupSystem)) {
                if (entity.script.pickupSystem && entity.script.pickupSystem.itemType === 'health') {
                    Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by pickupSystem.itemType`);
                    isHealthItem = true;
                } else if (entity.script.healthPickup || entity.script.medKit) {
                    Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by healthPickup/medKit script`);
                    isHealthItem = true;
                }
            } else if (entity.findComponent) {
                const healthComponent = entity.findComponent('health') || entity.findComponent('medkit') || entity.findComponent('healthpack');
                if (healthComponent) {
                    Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Found health item by component`);
                    isHealthItem = true;
                }
            }
            if (!isHealthItem) {
                Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Item ${entity.name || 'unnamed'} is not a health item`);
                continue;
            }
            let available = true;
            if (typeof item.isAvailable === 'boolean') {
                available = item.isAvailable;
            } else if (typeof item.isAvailable === 'function') {
                try {
                    available = item.isAvailable();
                } catch (e) {
                    available = true;
                }
            } else if (item.available !== undefined) {
                available = !!item.available;
            } else if (item.enabled !== undefined) {
                available = !!item.enabled;
            }
            if (!available) continue;
            if (item.reservedBy && typeof item.reservedBy === 'string') {
                const agentGuid = this.owner?.agent?.entity?.getGuid?.();
                if (item.reservedBy !== agentGuid) {
                    const reservationExpiry = item.reservationExpiry || 0;
                    if (now < reservationExpiry) {
                        continue;
                    }
                }
            }
            Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Adding valid health item: ${entity.name || 'unnamed'}`);
            validItems.push(item);
        }
        Logger.debug(`[GetHealthGoal] 🏥 GET VALID ITEMS DEBUG: Returning ${validItems.length} valid health items`);
        return validItems;
    }
    isValidPickupItem(item) {
        return !!(item && item.entity && !item.entity.destroyed && item.entity.enabled && typeof item.canBePickedUpBy === 'function' && typeof item.itemType === 'string' && Object.prototype.hasOwnProperty.call(item, 'isAvailable') && typeof item.entity.getGuid === 'function' && item.entity.script && item.entity.script.pickupSystem === item);
    }
    validateAndProjectPosition(agent, rawPos) {
        const searchRadii = [
            3,
            6,
            10,
            15
        ];
        for (const radius of searchRadii){
            const valid = agent.navigation?.findValidNavMeshPosition(rawPos, radius);
            if (valid) {
                const distance = rawPos.distance(valid);
                if (distance < radius * 0.8) {
                    Logger.aiDetail(`[${agent.entity.name}] Position validated at distance ${distance.toFixed(1)}`);
                    return valid;
                }
            }
        }
        // ✅ FIX: Only warn once per goal, not every frame
        _warnThrottled(agent, 'health:posValidationFailed', `[${agent.entity.name}] Position validation failed for all radii`, 5000);
        return null;
    }
    reserveHealthItem(agent, healthItem) {
        if (!healthItem || !agent || !agent.entity) return false;
        try {
            const agentGuid = agent.entity.getGuid ? agent.entity.getGuid() : null;
            const itemGuid = healthItem.entity && healthItem.entity.getGuid ? healthItem.entity.getGuid() : null;
            if (!agentGuid || !itemGuid) return false;
            const reservationTime = 15000;
            const now = performance.now();
            if (typeof healthItem.reserveFor === 'function') {
                healthItem.reserveFor(agentGuid, reservationTime);
                Logger.aiDetail(`[${agent.entity.name}] Reserved health item via reserveFor()`);
                return true;
            }
            healthItem.reservedBy = agentGuid;
            healthItem.reservationExpiry = now + reservationTime;
            healthItem.reservationReason = 'health_seeking';
            if (agent.app && typeof agent.app.fire === 'function') {
                agent.app.fire('pickup:reserve', {
                    itemId: itemGuid,
                    agentId: agentGuid,
                    reservationId: `health_${now}`,
                    ttlMs: reservationTime,
                    goalType: 'health'
                });
            }
            Logger.aiDetail(`[${agent.entity.name}] Reserved health item ${itemGuid.substring(0, 8)} for ${reservationTime / 1000}s`);
            return true;
        } catch (error) {
            Logger.warn(`[${agent.entity ? agent.entity.name : 'Agent'}] Health item reservation failed:`, error);
            return false;
        }
    }
    releaseHealthItem(agent, healthItem, reason = 'completed') {
        if (!healthItem || !agent) return;
        try {
            const agentGuid = agent.entity && agent.entity.getGuid ? agent.entity.getGuid() : null;
            const itemGuid = healthItem.entity && healthItem.entity.getGuid ? healthItem.entity.getGuid() : null;
            if (healthItem.reservedBy === agentGuid) {
                delete healthItem.reservedBy;
                delete healthItem.reservationExpiry;
                delete healthItem.reservationReason;
            }
            if (typeof healthItem.releaseReservation === 'function') {
                healthItem.releaseReservation(agentGuid);
            }
            if (agent.app && typeof agent.app.fire === 'function' && itemGuid) {
                agent.app.fire('pickup:release', {
                    itemId: itemGuid,
                    agentId: agentGuid,
                    reason: reason
                });
            }
            Logger.aiDetail(`[${agent.entity ? agent.entity.name : 'Agent'}] Released health item reservation (${reason})`);
        } catch (error) {
            Logger.warn(`[${agent.entity ? agent.entity.name : 'Agent'}] Health item release failed:`, error);
        }
    }
    execute() {
        const agent = this.owner.agent;
        const now = performance.now();
        // Set current activity for state reflection
        if (agent) {
            agent.currentActivity = 'seekHealth';
        }
        if (agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth >= 0.98) {
            this._completeHealthy(agent, 'now healthy in execute');
            return;
        }
        if (agent) {
            const healthGain = this.getEffectiveHealth(agent) - this.initialHealth;
            const dynamicThreshold = Math.max(8, (agent.maxHealth || 100) * 0.12);
            if (healthGain >= dynamicThreshold) {
                Logger.aiState(`[${agent.entity.name}] Health pickup detected (+${healthGain}), completing goal`);
                this._completeHealthy(agent, 'healed delta');
                return;
            }
        }
        if (now - this.lastHealthCheck > this.healthCheckInterval) {
            this.lastHealthCheck = now;
            const ratio = agent && agent.maxHealth > 0 ? this.getEffectiveHealth(agent) / agent.maxHealth : 1;
            if (ratio >= 0.98) {
                Logger.aiState(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health sufficient (${(ratio * 100).toFixed(0)}%), completing goal`);
                this._completeHealthy(agent, 'periodic check');
                return;
            }
        }
        // ✅ REMOVED: Distance-based detection was causing AI to stop too early
        // The DirectApproachGoal now has _completeDist = 0.3m which ensures AI gets
        // close enough to trigger the collision. We don't need manual proximity detection.
        // ✅ FIX: While waiting, just check if item was picked up
        // Don't manually trigger pickup - wait for collision
        if (this.waitingForPickup) {
            const waitTime = now - this.waitStartTime;
            // Check if the item was picked up (by us or someone else)
            if (this.targetHealthPack && !this.targetHealthPack.isAvailable) {
                Logger.aiDetail(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health pack consumed, goal completing`);
                this._completeHealthy(agent, 'consumed while waiting');
                return;
            }
            // Check if we gained health (pickup happened via collision)
            if (agent) {
                const healthGain = this.getEffectiveHealth(agent) - this.initialHealth;
                const dynamicThreshold = Math.max(8, (agent.maxHealth || 100) * 0.12);
                if (healthGain >= dynamicThreshold) {
                    Logger.aiState(`[${agent.entity.name}] Health pickup detected via collision (+${healthGain}), completing goal`);
                    this._completeHealthy(agent, 'collision pickup');
                    return;
                }
            }
            // Timeout after waiting too long
            if (waitTime > this.maxWaitTime) {
                _warnThrottled(agent, 'health:timeoutWarn', `[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health pickup timeout after ${(waitTime / 1000).toFixed(1)}s - collision didn't trigger`, this.warnIntervalMs);
                if (agent) this.handlePickupTimeout(agent);
                return;
            }
            return;
        }
        const status = this.executeSubgoals();
        // ✅ HUMAN-LIKE BEHAVIOR: Defensive combat while retreating to health
        // Real FPS players shoot back while running for health - they don't just passively flee
        if (agent && agent.combatSystem && typeof agent.combatSystem.update === 'function') {
            const hasTarget = agent.targetSystem && agent.targetSystem.hasTarget && agent.targetSystem.hasTarget();
            const isVisible = hasTarget && agent.targetSystem.isTargetVisible && agent.targetSystem.isTargetVisible();
            // Only shoot if enemy is visible and we're being pursued
            // This creates suppressive fire while retreating - very human-like
            if (hasTarget && isVisible) {
                const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
                const context = {
                    isCritical: healthRatio < 0.5,
                    isRetreating: true,
                    allowMovement: true,
                    suppressiveFire: true // Lower accuracy acceptable - just keep enemy cautious
                };
                // Execute defensive combat - shoot while moving to health
                agent.combatSystem.update(0.016, context); // Approximate dt
                if (!this._loggedDefensiveCombat) {
                    Logger.aiDetail(`[${agent.entity.name}] 🔫 Defensive fire while retreating to health (HP: ${(healthRatio * 100).toFixed(0)}%)`);
                    this._loggedDefensiveCombat = true;
                }
            } else {
                this._loggedDefensiveCombat = false;
            }
        }
        if (status === YUKA.Goal.STATUS.COMPLETED) {
            if (!this.waitingForPickup) {
                this.hasReachedTarget = true;
                this.waitingForPickup = true;
                this.waitStartTime = now;
                Logger.aiDetail(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Movement goal completed (AI at medkit), waiting for collision trigger`);
            }
        } else if (status === YUKA.Goal.STATUS.FAILED) {
            _warnThrottled(agent, 'health:moveFailWarn', `[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health movement failed`, this.warnIntervalMs);
            if (agent) this.handleMovementFailure(agent);
        }
    }
    _completeHealthy(agent, reason) {
        this._releaseReservationIfAny(agent);
        if (agent) {
            agent.isActivelySeekingHealth = false;
            agent.healthTargetPosition = null;
            const now = performance.now();
            this._setHealthCooldown(agent);
            try {
                agent.lastHealthGoalTime = now;
                agent.healthGoalCooldown = agent.healthGoalCooldown || 2000;
            } catch (e) {}
            if (agent.healthEvaluator && typeof agent.healthEvaluator.onHealthGoalCompleted === 'function') {
                try {
                    agent.healthEvaluator.onHealthGoalCompleted(agent, true, reason);
                } catch (e) {
                    Logger.warn && Logger.warn(`[${agent.entity.name}] healthEvaluator.onHealthGoalCompleted threw: ${e}`);
                }
            }
        }
        this.status = YUKA.Goal.STATUS.COMPLETED;
        const name = agent && agent.entity && agent.entity.name ? agent.entity.name : 'Agent';
        Logger.aiState(`[${name}] HealthGoal COMPLETE (${reason})`);
    }
    _releaseReservationIfAny(agent) {
        if (!this.targetHealthPack) return;
        const a = agent || this.owner && this.owner.agent;
        if (!a) return;
        if (this.targetHealthPack.releaseReservation) {
            this.targetHealthPack.releaseReservation(a.entity.getGuid());
        } else if (a.app) {
            a.app.fire('pickup:release', {
                itemId: this.targetHealthPack.entity.getGuid(),
                agentId: a.entity.getGuid()
            });
        }
    }
    /**
     * ✅ REMOVED: Manual pickup attempts were bypassing collision system
     * 
     * The old attemptManualPickup() was directly calling onTriggerEnter()
     * which bypassed the physics collision system entirely.
     * 
     * Now the AI simply navigates close to the medkit and waits for the
     * natural collision trigger to fire when the AI's collider overlaps
     * with the medkit's trigger volume.
     */ handlePickupTimeout(agent) {
        if (agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth >= 0.98) {
            this._completeHealthy(agent, 'timeout but healthy');
            return;
        }
        this.currentAttempt++;
        this.lastFailureTime = performance.now();
        this.waitingForPickup = false;
        this.hasReachedTarget = false;
        _setBackoff(agent, 'health:retry', 500);
        Logger.debug && Logger.debug(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Pickup timeout, attempt ${this.currentAttempt}/${this.maxAttempts}`);
        if (this.currentAttempt < this.maxAttempts) {
            const nextItem = this.findUntriedHealthItem(agent);
            if (nextItem) {
                Logger.aiState(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Trying alternative health item`);
                this.targetHealthPack = nextItem;
                if (nextItem.entity && typeof nextItem.entity.getGuid === 'function') {
                    this.attemptedItems.add(nextItem.entity.getGuid());
                }
                const rawPos = nextItem.entity.getPosition();
                const valid = this.validateAndProjectPosition(agent, rawPos);
                if (valid) {
                    agent.healthTargetPosition = valid.clone();
                    this.reserveHealthItem(agent, nextItem);
                    const target = new YUKA.Vector3(valid.x, valid.y, valid.z);
                    this.clearSubgoals();
                    this.addSubgoal(new DirectApproachGoal(this.owner, target, agent));
                    this.manualPickupAttempts = 0;
                    this.lastManualAttempt = 0;
                    return;
                }
            }
        }
        _warnThrottled(agent, 'health:allFailWarn', `[${agent && agent.entity ? agent.entity.name : 'Agent'}] All health pickup attempts failed`, this.warnIntervalMs);
        if (agent) {
            agent.isActivelySeekingHealth = false;
            const now = performance.now();
            try {
                agent.lastHealthGoalTime = now;
                agent.healthGoalCooldown = 3000;
            } catch (e) {}
            if (agent.healthEvaluator && typeof agent.healthEvaluator.onHealthGoalCompleted === 'function') {
                try {
                    agent.healthEvaluator.onHealthGoalCompleted(agent, false, 'pickup_timeout');
                } catch (e) {
                    Logger.warn && Logger.warn(`[${agent.entity.name}] healthEvaluator.onHealthGoalCompleted threw: ${e}`);
                }
            }
        }
        this.status = YUKA.Goal.STATUS.FAILED;
    }
    handleMovementFailure(agent) {
        if (agent && agent.maxHealth > 0 && this.getEffectiveHealth(agent) / agent.maxHealth >= 0.98) {
            this._completeHealthy(agent, 'movement failed but healthy');
            return;
        }
        Logger.debug && Logger.debug(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] Health movement failed, trying recovery`);
        if (this.targetHealthPack && this.lastValidatedPosition && agent && agent.navigation?.findValidNavMeshPosition) {
            const alternativePos = agent.navigation.findValidNavMeshPosition(this.lastValidatedPosition, 8);
            if (alternativePos && alternativePos.distance(this.lastValidatedPosition) > 2) {
                Logger.aiDetail(`[${agent.entity.name}] Found alternative route to health item`);
                const target = new YUKA.Vector3(alternativePos.x, alternativePos.y, alternativePos.z);
                this.clearSubgoals();
                this.addSubgoal(new DirectApproachGoal(this.owner, target, agent));
                return;
            }
        }
        this.handlePickupTimeout(agent);
    }
    resetGoalState() {
        this.hasReachedTarget = false;
        this.waitingForPickup = false;
        this.waitStartTime = 0;
        this.positionValidationFailed = false;
        this.lastValidatedPosition = null;
    }
    terminate() {
        const agent = this.owner.agent;
        this._releaseReservationIfAny(agent);
        if (agent) {
            agent.isActivelySeekingHealth = false;
            agent.healthTargetPosition = null;
        }
        this.clearSubgoals();
        const totalAttempts = this.attemptedItems.size;
        Logger.aiDetail(`[${agent && agent.entity ? agent.entity.name : 'Agent'}] GetHealthGoal terminated after ${totalAttempts} attempts`);
    }
    canRetry() {
        const now = performance.now();
        const cooldownExpired = now - this.lastFailureTime > this.failureCooldown;
        const hasUntriedItems = this.attemptedItems.size < this.maxAttempts;
        return cooldownExpired && hasUntriedItems && !this.positionValidationFailed;
    }
    reset() {
        this.attemptedItems.clear();
        this.currentAttempt = 0;
        this.lastFailureTime = 0;
        this.resetGoalState();
        this.positionValidationFailed = false;
    }
    canBePreempted() {
        const agent = this.owner.agent;
        if (!agent) return true;
        const goalAge = performance.now() - this.goalStartTime;
        const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
        // ✅ CRITICAL FIX: Check for active threats FIRST
        // AI must be able to defend itself even when seeking health
        const hasTarget = agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && agent.targetSystem?.isTargetVisible?.();
        const isUnderFire = agent.combatCore?.isUnderFire?.() || false;
        // If AI is being shot at or has visible enemy, ALWAYS allow preemption for combat
        if (isUnderFire || isTargetVisible) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal CAN be preempted - under threat (underFire=${isUnderFire}, visibleEnemy=${isTargetVisible})`);
            return true;
        }
        // Only protect goal if health is CRITICALLY low (<15%) and no immediate threats
        if (healthRatio < 0.15) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal cannot be preempted - critically low HP (${(healthRatio * 100).toFixed(0)}%) and no immediate threat`);
            return false;
        }
        // Don't protect goal for very long - 3 seconds max
        if (goalAge > 3000) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal CAN be preempted - too old (${(goalAge / 1000).toFixed(1)}s)`);
            return true;
        }
        // If at health pack and about to collect, protect briefly
        if (this.targetHealthPack && this.hasReachedTarget && goalAge < 1000) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal cannot be preempted - at health pack (${(goalAge / 1000).toFixed(1)}s)`);
            return false;
        }
        // Default: allow preemption
        return true;
    }
    // ✅ NEW: Dynamic priority based on health ratio
    getPriority() {
        const agent = this.owner.agent;
        if (!agent) return this.priority;
        const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
        // Use helper to get health-based priority
        return getHealthPriorityByRatio(healthRatio);
    }
    // ✅ NEW: Health goals can be interrupted by COMBAT when under fire
    // But NOT by exploration or low-priority resource gathering
    canInterrupt() {
        const agent = this.owner.agent;
        if (!agent) return true;
        const goalAge = performance.now() - (this.goalStartTime || 0);
        const healthRatio = this.getEffectiveHealth(agent) / Math.max(1, agent.maxHealth);
        // Check for active threats - always interruptible if under fire
        const hasTarget = agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && agent.targetSystem?.isTargetVisible?.();
        const isUnderFire = agent.combatCore?.isUnderFire?.() || false;
        // If under fire or has visible enemy, MUST be able to defend
        if (isUnderFire || isTargetVisible) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal allows interrupt - under threat`);
            return true;
        }
        // If critically low health (<15%) and no immediate threats, protect the goal
        if (healthRatio < 0.15) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal protected from interrupt - critical HP and safe`);
            return false;
        }
        // If at pickup location, protect briefly
        if ((this.hasReachedTarget || this.waitingForPickup) && goalAge < 1000) {
            Logger.aiDetail(`[${agent.entity.name}] Health goal protected - at pickup`);
            return false;
        }
        // Default: use base mixin logic
        return true;
    }
    constructor(owner){
        super(owner);
        this.targetHealthPack = null;
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 1000;
        this.hasReachedTarget = false;
        this.waitingForPickup = false;
        this.maxWaitTime = 5000;
        this.waitStartTime = 0;
        this.initialHealth = 0;
        // ✅ OPTIMIZED: Human-like persistence for health seeking
        this.attemptedItems = new Set();
        this.maxAttempts = 4; // ✅ More attempts - humans are persistent when wounded
        this.currentAttempt = 0;
        this.lastFailureTime = 0;
        this.failureCooldown = 1500; // ✅ Faster retry like desperate players
        // Position validation
        this.lastValidatedPosition = null;
        this.positionValidationFailed = false;
        // Logging/backoff
        this.warnIntervalMs = 3000;
        this.noItemsBackoffMs = 4000;
        // ✅ NEW: Goal interrupt system
        // Priority is dynamic based on health ratio
        this.priority = GOAL_PRIORITIES.RESOURCE_NORMAL; // Default, will be adjusted
        this.interruptible = true; // BUT only by critical threats (combat)
        this.minPriorityGap = 20; // Requires high priority to interrupt (e.g., critical survival)
        applyGoalInterruptMixin(this);
    }
}

export { EnhancedGetHealthGoal };
