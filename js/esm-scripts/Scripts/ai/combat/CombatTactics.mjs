import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

class CombatTactics {
    getTargetPosition(context, now) {
        let targetPos = null;
        let isTargetVisible = false;
        if (context.hasTarget && context.targetVisible) {
            // ✅ RAYCAST FIX: Get actual entity position instead of ground position
            const targetEntity = this.agent.targetSystem?.getTargetEntity();
            if (targetEntity && targetEntity.getPosition) {
                // Use entity's actual position (centered) and add slight upward bias for upper torso/head
                targetPos = targetEntity.getPosition().clone();
                targetPos.y += 0.8; // Aim at upper torso/head height (tune: 0.5 - 1.0)
                Logger.aiDetail(`[${this.entity.name}] 🎯 Aiming at entity position: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
            } else {
                // Fallback to context position with height adjustment
                targetPos = context.targetPosition;
                if (targetPos && targetPos.y < 1.0) {
                    targetPos = targetPos.clone();
                    targetPos.y += 1.5; // Adjust ground positions to center mass
                    Logger.aiDetail(`[${this.entity.name}] 🎯 Adjusted ground position to: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
                }
            }
            isTargetVisible = true;
            if (targetPos) {
                this._lastValidTargetPos = targetPos.clone ? targetPos.clone() : new Vec3(targetPos.x, targetPos.y, targetPos.z);
                this._lastValidTargetTime = now;
                this._searchingForTarget = false;
            }
        }
        if (!isTargetVisible && this._lastValidTargetPos) {
            const timeSinceLoss = now - this._lastValidTargetTime;
            if (timeSinceLoss < this._targetPreservationTime) {
                targetPos = this._lastValidTargetPos;
                isTargetVisible = true;
                if (!this._searchingForTarget) {
                    this.enterSearchMode();
                }
                Logger.aiDetail(`[${this.entity.name}] Using preserved target position (${(timeSinceLoss / 1000).toFixed(1)}s ago)`);
            } else {
                this._searchingForTarget = false;
                this._lastValidTargetPos = null;
            }
        }
        return targetPos;
    }
    enterSearchMode() {
        this._searchingForTarget = true;
        this._searchStartTime = performance.now();
        Logger.aiState(`[${this.entity.name}] Combat: Target temporarily lost, searching last known position`);
        if (this._lastValidTargetPos && this.agent.navigationReady) {
            const myPos = this.entity.getPosition();
            if (myPos.distance(this._lastValidTargetPos) > aiConfig.combat.LAST_KNOWN_POSITION_APPROACH_DISTANCE) {
                this.agent.moveTo(this._lastValidTargetPos);
            }
        }
    }
    handleWeaponSwitching(context) {
        if (!this.agent.weaponSelector) return;
        const currentWeapon = context.currentWeapon;
        if (!currentWeapon || currentWeapon === 'none') return;
        const switchDecision = this.agent.weaponSelector.shouldSwitchWeapon(currentWeapon, context);
        if (switchDecision.shouldSwitch) {
            this.agent.weaponSelector.performSwitch(switchDecision.newWeapon, switchDecision.reason);
        }
    }
    // CombatTactics.mjs - Update requestCombatState()
    requestCombatState(reason) {
        const now = performance.now();
        if (!this.agent.stateMachine) {
            Logger.error(`[${this.entity.name}] Cannot request combat - no state machine`);
            return false;
        }
        const currentState = this.agent.stateMachine.currentState?.type;
        // Already in combat
        if (currentState === 'combat') {
            return false;
        }
        // Check cooldown
        if (now - this.lastCombatExit < aiConfig.combat.COMBAT_REENTRY_COOLDOWN) {
            Logger.debug(`[${this.entity.name}] Combat cooldown active (${((now - this.lastCombatExit) / 1000).toFixed(1)}s)`);
            return false;
        }
        // ✅ DETAILED CHECK: Log why we can/cannot engage
        const canEngage = this.canEngageCombat();
        if (!canEngage) {
            const ws = this.agent.weaponSystem;
            Logger.combat(`[${this.entity.name}] Cannot request combat:`, {
                reason,
                hasWeaponSystem: !!ws,
                wsInitialized: ws?._initialized,
                wsBooted: ws?.__wsBooted,
                hasWeapons: !!ws?.weapons,
                currentWeapon: ws?.currentWeapon,
                currentMagazine: ws?.currentMagazine,
                weaponsList: ws?.weapons ? Object.keys(ws.weapons) : []
            });
            return false;
        }
        // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
        // Request state change
        const success = this.agent.stateMachine.changeTo('combat');
        if (success) {
            Logger.combat(`[${this.entity.name}] ✅ Entered combat state (${reason})`);
        } else {
            Logger.warn(`[${this.entity.name}] ❌ Failed to enter combat state (${reason})`);
        }
        return success;
    }
    canEngageCombat() {
        const ws = this.agent.weaponSystem;
        if (!ws?._initialized || !ws.__wsBooted || !ws.weapons) return false;
        const hasUnlockedWeapon = Object.keys(ws.weapons).some((key)=>ws.weapons[key]?.unlocked);
        if (!hasUnlockedWeapon) return false;
        const currentWeapon = ws.getCurrentKey ? ws.getCurrentKey() : ws.currentWeapon;
        return currentWeapon && ws.weapons[currentWeapon] && (ws.weapons[currentWeapon].ammo > 0 || (ws.currentMagazine || 0) > 0);
    }
    onCombatExit() {
        this.lastCombatExit = performance.now();
        this._searchingForTarget = false;
    }
    shouldMaintainCombatLock() {
        const now = performance.now();
        if (!this.agent.stateMachine) {
            Logger.warn(`[${this.entity.name}] Cannot check combat lock - stateMachine not initialized`);
            return false;
        }
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        if (isTargetVisible) return true;
        if (this.agent.targetSystem?.getTargetConfidence) {
            const confidence = this.agent.targetSystem.getTargetConfidence();
            if (confidence > aiConfig.combat.ALERTNESS_PRIORITY_MODIFIER) return true;
        }
        if (this._lastValidTargetTime && now - this._lastValidTargetTime < this._targetPreservationTime) {
            return true;
        }
        if (this.agent.visionSystem?.currentTargetVisible === true) return true;
        if (this.agent.visionSystem?._lastSeenTime) {
            const timeSinceSeen = now - this.agent.visionSystem._lastSeenTime;
            if (timeSinceSeen < aiConfig.combat.LAST_KNOWN_POSITION_APPROACH_DISTANCE * 1000) return true;
        }
        return false;
    }
    onEnemySpottedCombat(enemy) {
        this.agent.alertness = Math.min(1, this.agent.alertness + aiConfig.combat.NO_AMMO_PRIORITY_PENALTY);
        const currentState = this.agent.stateMachine?.currentState?.type;
        if (currentState === 'combat') {
            this.agent.targetSystem?.forceTarget(enemy);
            return;
        }
        const currentGoal = this.agent.brain?.currentSubgoal();
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        if (currentGoal?.constructor.name === 'EnhancedGetHealthGoal') {
            const goalAge = performance.now() - (this.agent.currentGoalStartTime || 0);
            if (healthRatio < aiConfig.combat.AMMO_CRITICAL_THRESHOLD * 2 || healthRatio < aiConfig.combat.DANGER_HEALTH_THRESHOLD + 0.05 && goalAge < aiConfig.combat.COMBAT_REENTRY_COOLDOWN) {
                this.agent.targetSystem?.forceTarget(enemy);
                return;
            }
        }
        if (this.agent.targetSystem && enemy) {
            this.agent.targetSystem.forceTarget(enemy);
            if (this.requestCombatState('enemy_spotted') && this.agent.brain && typeof globalThis.EnhancedAttackGoal !== 'undefined') {
                const currentGoal2 = this.agent.brain.currentSubgoal();
                const canPreempt = !currentGoal2 || currentGoal2.constructor.name !== 'EnhancedGetHealthGoal' || typeof currentGoal2.canBePreempted === 'function' && currentGoal2.canBePreempted();
                if (!(currentGoal2 instanceof globalThis.EnhancedAttackGoal) && canPreempt) {
                    this.agent.brain.clearSubgoals();
                    this.agent.brain.addSubgoal(new globalThis.EnhancedAttackGoal(this.agent.yukaVehicle));
                    this.agent.currentGoalStartTime = performance.now();
                    if (this.agent.goalArbitrator) {
                        this.agent.goalArbitrator.lastArbitrationTime = performance.now() + 1500;
                    }
                }
            }
        }
    }
    onTargetAcquiredCombat(target) {
        if (this.requestCombatState('target_acquired') && this.agent.brain && typeof globalThis.EnhancedAttackGoal !== 'undefined') {
            const currentGoal = this.agent.brain.currentSubgoal();
            if (!(currentGoal instanceof globalThis.EnhancedAttackGoal)) {
                this.agent.brain.clearSubgoals();
                this.agent.brain.addSubgoal(new globalThis.EnhancedAttackGoal(this.agent.yukaVehicle));
                this.agent.currentGoalStartTime = performance.now();
                if (this.agent.goalArbitrator) {
                    this.agent.goalArbitrator.lastArbitrationTime = performance.now();
                }
            }
            this.combatTimer = 0;
        }
    }
    // ============================================================================
    // TACTICAL DECISION MAKING
    // ============================================================================
    shouldEngageInCombat() {
        const hasTarget = this.agent.targetSystem && this.agent.targetSystem.hasTarget();
        const isTargetVisible = hasTarget && this.agent.targetSystem.isTargetVisible();
        const hasHealth = this.agent.health > this.agent.maxHealth * aiConfig.combat.CRITICAL_HEALTH_THRESHOLD;
        return hasTarget && isTargetVisible && hasHealth;
    }
    evaluateEngagementThreat(target) {
        if (!target) return 1.0;
        let threatLevel = 1.0;
        if (this.agent.eventHandler && this.agent.eventHandler.getThreatLevel) {
            const entity = this.agent.eventHandler._getTargetEntity(target);
            const entityId = entity?.getGuid();
            if (entityId) {
                threatLevel = this.agent.eventHandler.getThreatLevel(entityId) || 1.0;
            }
        }
        return threatLevel;
    }
    calculateEngagementPriority(context) {
        let priority = 0.5;
        // Health factor
        const healthRatio = this.agent.health / this.agent.maxHealth;
        if (healthRatio > aiConfig.combat.HIGH_HEALTH_THRESHOLD - 0.1) {
            priority += aiConfig.combat.HIGH_HEALTH_PRIORITY_BONUS;
        } else if (healthRatio < aiConfig.combat.DANGER_HEALTH_THRESHOLD) {
            priority -= aiConfig.combat.LOW_HEALTH_PRIORITY_PENALTY;
        }
        // Alertness factor
        priority += (this.agent.alertness - 0.5) * aiConfig.combat.ALERTNESS_PRIORITY_MODIFIER;
        // Ammo factor
        if (this.agent.utilities) {
            if (this.agent.utilities.hasAdequateAmmo()) {
                priority += aiConfig.combat.ADEQUATE_AMMO_PRIORITY_BONUS;
            } else if (!this.agent.utilities.hasUsableAmmo()) {
                priority -= aiConfig.combat.NO_AMMO_PRIORITY_PENALTY;
            }
        }
        // Target visibility and distance
        if (context.hasTarget && context.targetVisible) {
            priority += aiConfig.combat.TARGET_VISIBLE_PRIORITY_BONUS;
            if (context.targetPosition) {
                const distance = this.entity.getPosition().distance(context.targetPosition);
                if (distance < aiConfig.combat.CLOSE_RANGE_THRESHOLD) {
                    priority += aiConfig.combat.CLOSE_RANGE_PRIORITY_BONUS;
                } else if (distance > aiConfig.combat.LONG_RANGE_THRESHOLD) {
                    priority -= aiConfig.combat.LONG_RANGE_PRIORITY_PENALTY;
                }
            }
        }
        return Math.max(0, Math.min(1, priority));
    }
    shouldMaintainEngagement(context) {
        if (!this.shouldEngageInCombat()) {
            return false;
        }
        const priority = this.calculateEngagementPriority(context);
        return priority > aiConfig.combat.ENGAGEMENT_MAINTAIN_THRESHOLD;
    }
    // ============================================================================
    // TACTICAL UTILITIES
    // ============================================================================
    updateCombatTimer(dt) {
        this.combatTimer += dt;
    }
    getCombatTimingInfo() {
        return {
            combatTimer: this.combatTimer,
            lastCombatExit: this.lastCombatExit,
            searchingForTarget: this._searchingForTarget,
            hasPreservedTarget: this._lastValidTargetPos !== null,
            targetPreservationTimeRemaining: this._lastValidTargetPos ? Math.max(0, this._targetPreservationTime - (performance.now() - this._lastValidTargetTime)) : 0
        };
    }
    getSearchInfo() {
        return {
            searching: this._searchingForTarget,
            searchStartTime: this._searchStartTime,
            searchDuration: this._searchDuration,
            lastValidTargetPos: this._lastValidTargetPos ? {
                ...this._lastValidTargetPos
            } : null,
            preservationTimeRemaining: this._lastValidTargetPos ? Math.max(0, this._targetPreservationTime - (performance.now() - this._lastValidTargetTime)) : 0
        };
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    debugTacticalState() {
        const engagementPriority = this.agent.targetSystem ? this.calculateEngagementPriority({
            hasTarget: this.agent.targetSystem.hasTarget(),
            targetVisible: this.agent.targetSystem.isTargetVisible(),
            targetPosition: this.agent.targetSystem.getTargetPosition()
        }) : 0;
        const tacticalState = {
            canEngage: this.shouldEngageInCombat(),
            engagementPriority: (engagementPriority * 100).toFixed(0) + '%',
            combatTimer: this.combatTimer.toFixed(1) + 's',
            searchingForTarget: this._searchingForTarget,
            targetPreservationActive: this._lastValidTargetPos !== null,
            combatTimingInfo: this.getCombatTimingInfo(),
            searchInfo: this.getSearchInfo()
        };
        Logger.debug(`[${this.entity.name}] --- Tactical State ---`);
        Object.entries(tacticalState).forEach(([key, value])=>{
            Logger.debug(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        });
        return tacticalState;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        this._lastValidTargetPos = null;
        this._searchingForTarget = false;
        Logger.debug(`[${this.entity.name}] CombatTactics destroyed`);
    }
    constructor(agent){
        this.agent = agent;
        this.entity = agent.entity;
        // Combat tracking
        this.combatTimer = 0;
        this.lastCombatExit = 0;
        // Target preservation (for brief line-of-sight losses)
        this._lastValidTargetPos = null;
        this._lastValidTargetTime = 0;
        this._targetPreservationTime = aiConfig.combat.TARGET_PRESERVATION_TIME;
        // Search mode
        this._searchingForTarget = false;
        this._searchStartTime = 0;
        this._searchDuration = aiConfig.combat.SEARCH_DURATION;
        Logger.debug(`[${this.entity.name}] CombatTactics initialized`);
    }
}

export { CombatTactics };
