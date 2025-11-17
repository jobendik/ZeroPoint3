import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/* global EnhancedAttackGoal, EnhancedGetHealthGoal, EnhancedExploreGoal, EnhancedGetAmmoGoal */ class AIGoalArbitrator {
    // ============================================================================
    // LAYER 1: AI DIRECTOR - MAIN ENTRY POINT
    // ============================================================================
    // This is the strategic controller that evaluates context and guides Yuka
    // Flow: Context Evaluation → Priority Calculation → Guide Yuka → Monitor
    // ============================================================================
    updateGoalArbitration(context) {
        try {
            this.currentFrame = Math.floor(performance.now());
            // Single arbitration per frame enforcement
            if (this._lastArbitrateFrame === this.currentFrame) {
                this._logThrottled('single_frame_block', 'debug', `Arbitration blocked - already arbitrated this frame`);
                return;
            }
            if (!this._canPerformOperation('arbitration')) {
                return;
            }
            const now = performance.now();
            const currentGoal = this._safe(()=>this.agent.brain.currentSubgoal(), null);
            // ═══════════════════════════════════════════════════════════════
            // ✅ PHASE 2: Combat lock removed
            // OLD: Blocked arbitration completely when combat locked
            // NEW: Trust Yuka's evaluators to handle combat priority naturally
            // AttackEvaluator will score high during combat, no need to block
            // ═══════════════════════════════════════════════════════════════
            // Record arbitration
            this._lastArbitrateFrame = this.currentFrame;
            this.lastArbitrationFrame = this.currentFrame;
            this._recordOperation('arbitration');
            // Update tracking
            this._updateGoalTracking(currentGoal, now);
            // ═══════════════════════════════════════════════════════════════
            // COMMITMENT CHECK: Prevent goal thrashing
            // This is GOOD - keeps it. Goals need time to complete.
            // ═══════════════════════════════════════════════════════════════
            // Respect commitment period (prevent thrashing)
            if (currentGoal && currentGoal.status === YUKA.Goal.STATUS.ACTIVE) {
                if (!this._canPreemptGoal(currentGoal, now)) return;
            }
            // Handle goal completion
            this._handleGoalCompletion(currentGoal, now);
            // ═══════════════════════════════════════════════════════════════
            // ✅ PHASE 2: Critical overrides removed
            // OLD: Manually forced goals when health/ammo critical
            // NEW: Evaluators handle emergencies via high desirability
            // - GetHealthEvaluator returns 1.9+ at ≤20% health
            // - GetAmmoEvaluator returns high scores when ammo depleted
            // - Yuka's arbitration will naturally pick these
            // ═══════════════════════════════════════════════════════════════
            // ═══════════════════════════════════════════════════════════════
            // GUIDED ARBITRATION: Hand control to Yuka Brain (Layer 2)
            // 1. Evaluate fuzzy priorities (context hints)
            // 2. Set hints for evaluators
            // 3. Let Yuka's brain.arbitrate() decide
            // 4. Trust the result
            // ═══════════════════════════════════════════════════════════════
            // Standard arbitration (Layer 1 guides, Layer 2 decides)
            this._performArbitration(currentGoal, now, context);
            this.consecutiveArbitrationFailures = 0;
        } catch (error) {
            this._handleArbitrationError(error);
        }
    }
    // ============================================================================
    // LAYER 1: CONTEXT EVALUATION & PRIORITY GUIDANCE
    // ============================================================================
    // These methods evaluate the agent's situation and provide guidance to Yuka
    // They DON'T make decisions - they provide context for evaluators to use
    // ============================================================================
    /**
     * Perform arbitration using context and optional fuzzy priorities
     * This is where Layer 1 (AI Director) hands control to Layer 2 (Yuka Brain)
     */ _performArbitration(currentGoal, now, context) {
        const minInterval = this._getMinArbitrationInterval();
        if (now - this.lastArbitrationTime < minInterval) {
            return;
        }
        this.lastArbitrationTime = now;
        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: Evaluate priorities using fuzzy logic or legacy system
        // Result: { attack, health, ammo, explore } scores (0.0 - 1.0)
        // ═══════════════════════════════════════════════════════════════════
        // 🔧 FIX: Only suppress weapon seeking during ACTIVE VISIBLE combat
        const hasActiveTarget = this.agent.targetSystem?.hasTarget?.() || false;
        const targetVisible = hasActiveTarget && (this.agent.targetSystem?.isTargetVisible?.() || false);
        // Get priorities (from fuzzy system if available)
        const priorities = context && this.agent.fuzzySystem ? this._evaluateFuzzyGoalPriorities(context) : this._evaluateLegacyGoalPriorities(context);
        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: Adjust priorities based on situation
        // This is GUIDANCE, not FORCING. Evaluators will use these as hints.
        // ═══════════════════════════════════════════════════════════════════
        // Only adjust priorities during ACTIVE, VISIBLE combat
        if (hasActiveTarget && targetVisible) {
            priorities.explore = 0.2; // Reduced exploration during active combat
            // Keep attack/health high during active combat
            if (priorities.attack < 0.5) {
                priorities.attack = 0.8; // Boost to maintain combat focus
            }
        }
        if (Logger.isEnabled('DEBUG')) {
            this._logThrottled('priorities', 'debug', `Goal priorities: attack=${priorities.attack.toFixed(2)}, health=${priorities.health.toFixed(2)}, ammo=${priorities.ammo.toFixed(2)}, explore=${priorities.explore.toFixed(2)}`);
        }
        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: Set priority hints for evaluators (Layer 2 guidance)
        // Evaluators will multiply their base desirability by these hints
        // This guides Yuka without overriding it
        // ═══════════════════════════════════════════════════════════════════
        // Apply priorities to evaluators (they use these as hints)
        if (this.agent.brain && this.agent.brain.evaluators) {
            for (const evaluator of this.agent.brain.evaluators){
                const evalType = evaluator.constructor.name.toLowerCase();
                if (evalType.includes('attack')) evaluator._fuzzyPriorityHint = priorities.attack;
                else if (evalType.includes('health')) evaluator._fuzzyPriorityHint = priorities.health;
                else if (evalType.includes('ammo')) evaluator._fuzzyPriorityHint = priorities.ammo;
                else if (evalType.includes('explore')) evaluator._fuzzyPriorityHint = priorities.explore;
                // 🔧 FIX: Only suppress weapon seeking if actively shooting at visible target
                // Allow weapon seeking when target is not visible or when just exploring
                if (evalType.includes('weapon') && hasActiveTarget && targetVisible) {
                    // Even in combat, allow some weapon seeking (humans upgrade during lulls)
                    evaluator._fuzzyPriorityHint = 0.3; // Higher than before
                }
            }
        }
        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: Hand control to Yuka Brain (Layer 2)
        // brain.arbitrate() will:
        // 1. Call all evaluators' calculateDesirability()
        // 2. Pick the one with highest score
        // 3. Call that evaluator's setGoal()
        // 4. The goal is added to brain.subgoals
        // ═══════════════════════════════════════════════════════════════════
        this._executeArbitration(now);
    }
    // ============================================================================
    // LAYER 1: FUZZY LOGIC PRIORITY EVALUATION
    // ============================================================================
    // These methods calculate priority hints (0.0 - 1.0) for each goal type
    // Evaluators (Layer 2) use these hints to adjust their desirability
    // ============================================================================
    _evaluateFuzzyGoalPriorities(context) {
        if (!this.agent.fuzzySystem?.initialized) {
            return this._evaluateLegacyGoalPriorities(context);
        }
        try {
            const survivalNeed = context.getSurvivalNeed();
            const combatOpp = context.getCombatOpportunity();
            const exploreValue = context.getExplorationValue();
            const goalPriority = this.agent.fuzzySystem.evaluateGoalPriority(survivalNeed, combatOpp, exploreValue);
            return {
                attack: this._mapToAttackPriority(goalPriority, combatOpp),
                health: this._mapToHealthPriority(survivalNeed),
                ammo: this._mapToAmmoPriority(context.ammoRatio),
                explore: this._mapToExplorePriority(goalPriority, exploreValue)
            };
        } catch (error) {
            Logger.warn(`[${this.agentName}] Fuzzy goal priorities failed:`, error);
            return this._evaluateLegacyGoalPriorities(context);
        }
    }
    _mapToAttackPriority(goalPriority, combatOpp) {
        if (goalPriority > 0.7) return 0.9 * combatOpp;
        if (goalPriority > 0.4) return 0.5 * combatOpp;
        return 0.2 * combatOpp;
    }
    _mapToHealthPriority(survivalNeed) {
        if (survivalNeed > 0.7) return 0.95;
        if (survivalNeed > 0.4) return 0.6;
        return 0.2;
    }
    _mapToAmmoPriority(ammoRatio) {
        const ammoNeed = 1 - ammoRatio;
        if (ammoNeed > 0.8) return 0.9;
        if (ammoNeed > 0.5) return 0.6;
        return 0.3;
    }
    _mapToExplorePriority(goalPriority, exploreValue) {
        if (goalPriority < 0.3) return 0.7 * exploreValue;
        if (goalPriority < 0.5) return 0.4 * exploreValue;
        return 0.1 * exploreValue;
    }
    _evaluateLegacyGoalPriorities(context) {
        const healthRatio = context?.healthRatio || this.agent.health / Math.max(1, this.agent.maxHealth);
        const hasTarget = context?.hasTarget || !!this.agent.targetSystem?.hasTarget?.();
        const hasAmmo = context?.hasUsableAmmo ?? this._safeHasUsableAmmo();
        return {
            attack: hasTarget && hasAmmo ? 0.8 : 0.2,
            health: healthRatio < 0.4 ? 0.9 : 0.3,
            ammo: !hasAmmo ? 0.85 : 0.3,
            explore: !hasTarget ? 0.6 : 0.2
        };
    }
    // ============================================================================
    // GOAL TRACKING
    // ============================================================================
    _updateGoalTracking(currentGoal, now) {
        if (!this.agent.currentGoal || this.agent.currentGoal !== currentGoal) {
            const oldGoalType = this.agent.currentGoal ? this.agent.currentGoal.constructor.name : 'NONE';
            const newGoalType = currentGoal ? currentGoal.constructor.name : 'NONE';
            if (oldGoalType !== newGoalType) {
                const commitmentSig = `${newGoalType}@${this.currentFrame}`;
                const lastCommitTime = this._commitmentLogHistory.get(commitmentSig) || 0;
                const timeSinceLastCommit = now - lastCommitTime;
                if (timeSinceLastCommit > 1000) {
                    Logger.goal(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} Goal commitment: ${oldGoalType} → ${newGoalType}`);
                    this._commitmentLogHistory.set(commitmentSig, now);
                    for (const [sig, time] of this._commitmentLogHistory.entries()){
                        if (now - time > 10000) {
                            this._commitmentLogHistory.delete(sig);
                        }
                    }
                }
                this._addToEvaluationHistory(oldGoalType, newGoalType, now);
                this._recordGoalTransition(newGoalType);
                this.agent.currentGoal = currentGoal;
                this.agent.currentGoalStartTime = now;
                this.agent.lastGoalCompletionTime = 0;
                this._updateSpecificGoalTracking(currentGoal, oldGoalType, newGoalType, now);
            } else {
                this.agent.currentGoal = currentGoal;
            }
        }
    }
    _updateSpecificGoalTracking(currentGoal, oldGoalType, newGoalType, now) {
        try {
            if (newGoalType.includes('Attack')) {
                this.agent.lastAttackGoalStartTime = now;
                this.agent.attackGoalCount = (this.agent.attackGoalCount || 0) + 1;
            } else if (newGoalType.includes('Health')) {
                this.agent.lastHealthGoalTime = now;
                this.agent.healthGoalCount = (this.agent.healthGoalCount || 0) + 1;
            } else if (newGoalType.includes('Ammo')) {
                this.agent.lastAmmoGoalTime = now;
                this.agent.ammoGoalCount = (this.agent.ammoGoalCount || 0) + 1;
            }
        } catch (error) {
        // Non-critical
        }
    }
    _addToEvaluationHistory(oldGoal, newGoal, timestamp) {
        this.goalEvaluationHistory.push({
            oldGoal: oldGoal,
            newGoal: newGoal,
            timestamp: timestamp,
            frame: this.currentFrame,
            context: this._getCurrentSituationContext()
        });
        if (this.goalEvaluationHistory.length > this.maxEvaluationHistory) {
            this.goalEvaluationHistory.shift();
        }
    }
    _getCurrentSituationContext() {
        try {
            return {
                health: this.agent.health / Math.max(1, this.agent.maxHealth),
                alertness: this.agent.alertness || 0,
                hasTarget: !!this.agent.targetSystem?.hasTarget?.(),
                hasAmmo: this._safeHasUsableAmmo(),
                state: this.agent.stateMachine?.currentState?.type || 'unknown',
                combatLocked: this.agent._combatStateLocked || false,
                isStuck: this.agent.stuckDetection?.getIsStuck() || false
            };
        } catch (error) {
            return {
                error: true
            };
        }
    }
    _canPreemptGoal(currentGoal, now) {
        if (!currentGoal) return true;
        const goalAge = now - (this.agent.currentGoalStartTime || now);
        const goalType = this._getGoalType(currentGoal);
        // ✅ FIX: Always check critical overrides FIRST (health, ammo emergencies)
        if (this.checkCriticalOverride(currentGoal, goalAge)) {
            this._logThrottled('critical_override', 'goal', `CRITICAL override triggered - preempting ${goalType}`);
            return true;
        }
        // ✅ NEW: Check if goal can be interrupted using new interrupt system
        if (typeof currentGoal.canInterrupt === 'function') {
            const canInt = currentGoal.canInterrupt();
            if (!canInt) {
                this._logThrottled('goal_protected', 'aiDetail', `Goal ${goalType} protected by canInterrupt()`);
                return false;
            }
        }
        // ✅ FIX: Allow immediate goal switching when evaluator desirability is critical (>80%)
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        if (healthRatio <= 0.30) {
            // At low health, allow health-seeking goals to interrupt more easily
            const currentGoalName = currentGoal.constructor?.name || '';
            if (!currentGoalName.includes('Health')) {
                this._logThrottled('low_health_switch', 'goal', `Low HP (${Math.round(healthRatio * 100)}%) - allowing goal switch from ${goalType}`);
                return true;
            }
        }
        // Get commitment period (personality can override)
        let commitmentPeriod = this.commitmentPeriods[goalType] || this.commitmentPeriods.general;
        if (this.agent.personalitySystem) {
            const personalityMod = this.agent.personalitySystem.getGoalCommitmentTime(goalType);
            if (personalityMod) commitmentPeriod = personalityMod;
        }
        if (goalAge < commitmentPeriod) {
            this._logThrottled('goal_committed', 'aiDetail', `Goal ${goalType} still committed (${goalAge.toFixed(0)}ms < ${commitmentPeriod}ms)`);
            return false;
        }
        return true;
    }
    _getGoalType(goal) {
        if (!goal) return 'none';
        try {
            const typeName = goal.constructor.name.toLowerCase();
            if (typeName.includes('attack')) return 'attack';
            if (typeName.includes('health')) return 'health';
            if (typeName.includes('ammo')) return 'ammo';
            if (typeName.includes('explore')) return 'explore';
            return 'general';
        } catch  {
            return 'unknown';
        }
    }
    checkCriticalOverride(currentGoal, goalAge) {
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        if (healthRatio <= this.criticalThresholds.emergencyHealth) return true;
        if (!this._hasUsableAmmo() && this.criticalThresholds.ammo === 0) return true;
        if (this._hasTargetDied()) return true;
        // Stuck detection delegated to StuckDetectionSystem
        if (this.agent.stuckDetection?.getIsStuck()) {
            const stuckDuration = this.agent.stuckDetection.getStuckDuration();
            if (stuckDuration > this.criticalThresholds.stuckTime) return true;
        }
        if (this._hasMultipleThreats()) return true;
        return false;
    }
    // ============================================================================
    // CRITICAL OVERRIDES
    // ============================================================================
    // ============================================================================
    // ⚠️ DEPRECATED METHODS - Preserved for reference only (Phase 2 removed)
    // ============================================================================
    // These methods were part of the "manual goal forcing" anti-pattern.
    // They are no longer called. Evaluators now handle emergencies via high
    // desirability scores that win arbitration naturally.
    // 
    // DO NOT USE THESE - They violate Yuka's design principles.
    // ============================================================================
    /**
     * @deprecated Phase 2 - No longer called. GetHealthEvaluator handles this.
     */ _handleCriticalHealthOverride(currentGoal, now, context) {
        const healthRatio = context?.healthRatio || this.agent.health / Math.max(1, this.agent.maxHealth);
        if (healthRatio > this.criticalThresholds.emergencyHealth) return false;
        if (currentGoal instanceof EnhancedGetHealthGoal) return false;
        const healthItem = this._getClosestHealthItem();
        if (!healthItem || !healthItem.isAvailable) return false;
        if (now - this._lastForceHealthTime < 3000) return false;
        if (!this._isHealthItemReachable(healthItem.position)) return false;
        return this._forceHealthGoal(now);
    }
    /** @deprecated Phase 2 */ _getClosestHealthItem() {
        return this._safe(()=>this.agent.utilities?.getClosestHealthItem?.(), null);
    }
    /** @deprecated Phase 2 */ _isHealthItemReachable(healthPos) {
        try {
            if (!healthPos || !this.agent.entity) return false;
            const agentPos = this.agent.entity.getPosition();
            const distance = agentPos.distance(healthPos);
            return distance < 50;
        } catch  {
            return false;
        }
    }
    /** @deprecated Phase 2 */ _forceHealthGoal(now) {
        try {
            this.agent.brain.clearSubgoals();
            if (typeof EnhancedGetHealthGoal !== 'undefined' && this.agent.yukaVehicle) {
                const healthGoal = new EnhancedGetHealthGoal(this.agent.yukaVehicle);
                this.agent.brain.addSubgoal(healthGoal);
                this._lastForceHealthTime = now;
                this._recordGoalTransition('health');
                Logger.goal(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} CRITICAL: Forced health goal at ${(this.agent.health / this.agent.maxHealth * 100).toFixed(0)}% HP`);
                return true;
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Failed to force health goal:`, error);
        }
        return false;
    }
    /**
     * @deprecated Phase 2 - No longer called. Evaluators handle emergencies.
     */ _handleCriticalOverrides(currentGoal, now, context) {
        if (this._shouldForceAmmoGoal(currentGoal, now)) return true;
        if (this._shouldForceWeaponGoal(currentGoal, now)) return true;
        if (this._shouldForceCombatRetreat(currentGoal, now, context)) return true;
        return false;
    }
    /** @deprecated Phase 2 */ _shouldForceAmmoGoal(currentGoal, now) {
        if (!this._safeHasUsableAmmo() && !(currentGoal instanceof EnhancedGetAmmoGoal)) {
            return this._forceAmmoGoal(now);
        }
        return false;
    }
    /** @deprecated Phase 2 */ _shouldForceWeaponGoal(currentGoal, now) {
        const ws = this._safe(()=>this.agent.weaponSystem, null);
        if (!ws || !ws.weapons) return false;
        const hasUnlockedWeapon = Object.values(ws.weapons).some((w)=>w.unlocked);
        if (!hasUnlockedWeapon) {
            return this._forceWeaponGoal(now);
        }
        return false;
    }
    /** @deprecated Phase 2 */ _shouldForceCombatRetreat(currentGoal, now, context) {
        const healthRatio = context?.healthRatio || this.agent.health / Math.max(1, this.agent.maxHealth);
        if (healthRatio < 0.15 && this._hasMultipleThreats()) {
            return this._forceCombatRetreat(now);
        }
        return false;
    }
    /** @deprecated Phase 2 */ _forceAmmoGoal(now) {
        try {
            this.agent.brain.clearSubgoals();
            if (typeof EnhancedGetAmmoGoal !== 'undefined' && this.agent.yukaVehicle) {
                const ammoGoal = new EnhancedGetAmmoGoal(this.agent.yukaVehicle);
                this.agent.brain.addSubgoal(ammoGoal);
                this._recordGoalTransition('ammo');
                Logger.goal(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} CRITICAL: Forced ammo goal - no usable ammo`);
                return true;
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Failed to force ammo goal:`, error);
        }
        return false;
    }
    /** @deprecated Phase 2 */ _forceWeaponGoal(now) {
        try {
            this.agent.brain.clearSubgoals();
            this._recordGoalTransition('weapon');
            Logger.goal(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} CRITICAL: Forced weapon acquisition - no unlocked weapons`);
            return true;
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Failed to force weapon goal:`, error);
        }
        return false;
    }
    /** @deprecated Phase 2 */ _forceCombatRetreat(now) {
        try {
            this.agent.brain.clearSubgoals();
            this._recordGoalTransition('retreat');
            if (this.agent.stateMachine) {
                this.agent.stateMachine.changeTo('flee');
            }
            Logger.goal(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} CRITICAL: Forced combat retreat - low health + multiple threats`);
            return true;
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Failed to force combat retreat:`, error);
        }
        return false;
    }
    // ============================================================================
    // LAYER 2: ARBITRATION EXECUTION (Hand Control to Yuka)
    // ============================================================================
    // This is where we trust Yuka's system to make the right decision
    // We've provided context (priorities), now Yuka picks the best goal
    // ============================================================================
    _executeArbitration(now) {
        if (!this.agent.brain || typeof this.agent.brain.arbitrate !== 'function') {
            if (!this._warnedNoEvaluators) {
                this._logThrottled('no_brain', 'warn', `No brain available for arbitration`);
                this._warnedNoEvaluators = true;
            }
            return;
        }
        try {
            const evaluators = this.agent.brain.evaluators || [];
            if (evaluators.length === 0) {
                if (!this._warnedNoEvaluators) {
                    this._logThrottled('no_evaluators', 'warn', `No goal evaluators available`);
                    this._warnedNoEvaluators = true;
                }
                this._fallbackToExplore();
                return;
            }
            // ═══════════════════════════════════════════════════════════════
            // CRITICAL: This is where Layer 1 (AI Director) hands control to Layer 2 (Yuka Brain)
            // 
            // brain.arbitrate() will:
            // 1. Iterate through all evaluators
            // 2. Call each evaluator.calculateDesirability(owner)
            // 3. Multiply by evaluator.characterBias
            // 4. Pick the evaluator with highest score
            // 5. Call that evaluator.setGoal(owner)
            // 
            // We TRUST this process. Our job (Layer 1) is done.
            // ═══════════════════════════════════════════════════════════════
            // ✅ NEW: Before arbitrating, check if current goal should block new goals
            const currentGoal = this._safe(()=>this.agent.brain.currentSubgoal(), null);
            Logger.goal(`[${this.agentName}] 🎯 Calling brain.arbitrate() - current goal: ${currentGoal ? currentGoal.constructor.name : 'NULL'}`);
            // ═══════════════════════════════════════════════════════════════
            // YUKA'S ARBITRATION: Trust the system
            // ═══════════════════════════════════════════════════════════════
            // Let YUKA's Think.arbitrate() handle calling evaluators with proper owner
            // It will calculate desirabilities and potentially switch goals
            this.agent.brain.arbitrate();
            const newGoal = this._safe(()=>this.agent.brain.currentSubgoal(), null);
            if (newGoal !== currentGoal) {
                Logger.goal(`[${this.agentName}] ✅ Arbitration selected new goal: ${newGoal ? newGoal.constructor.name : 'NULL'}`);
            } else if (!newGoal) {
                Logger.goal(`[${this.agentName}] ⚠️ Arbitration did NOT select any goal! Still NULL after arbitrate()`);
            }
        // ═══════════════════════════════════════════════════════════════
        // ✅ PHASE 2: Post-arbitration check removed
        // OLD: Second-guessed Yuka's decision via shouldInterruptFor()
        // NEW: Trust arbitration result completely
        // - Yuka already picked the best evaluator
        // - Commitment is handled by evaluators via commitment manager
        // - No need to override Yuka's choice
        // ═══════════════════════════════════════════════════════════════
        } catch (error) {
            this._handleArbitrationError(error);
        }
    }
    _fallbackToExplore() {
        try {
            this.agent?.brain?.clearSubgoals();
            if (typeof EnhancedExploreGoal !== 'undefined' && this.agent?.yukaVehicle) {
                this.agent.brain.addSubgoal(new EnhancedExploreGoal(this.agent.yukaVehicle));
                this._recordGoalTransition('explore');
            }
        } catch (e) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Explore fallback failed:`, e);
        }
    }
    _handleGoalCompletion(currentGoal, now) {
        if (currentGoal && (currentGoal.status === YUKA.Goal.STATUS.COMPLETED || currentGoal.status === YUKA.Goal.STATUS.FAILED)) {
            const goalType = this._getGoalType(currentGoal);
            const duration = now - (this.agent.currentGoalStartTime || now);
            Logger.goal(`[${this.agentName}] 🏁 Goal ${goalType} ${currentGoal.status === YUKA.Goal.STATUS.COMPLETED ? 'completed' : 'failed'} after ${duration.toFixed(0)}ms`);
            this._updateCompletionStatistics(goalType, currentGoal.status === YUKA.Goal.STATUS.COMPLETED, duration);
            this.agent.lastGoalCompletionTime = now;
            this.agent.brain.clearSubgoals();
            Logger.goal(`[${this.agentName}] 🧹 Cleared subgoals, brain.currentSubgoal() = ${this.agent.brain.currentSubgoal() ? this.agent.brain.currentSubgoal().constructor.name : 'NULL'}`);
        }
    }
    _updateCompletionStatistics(goalType, completed, duration) {
        if (!this.agent.goalStatistics) {
            this.agent.goalStatistics = {};
        }
        if (!this.agent.goalStatistics[goalType]) {
            this.agent.goalStatistics[goalType] = {
                attempted: 0,
                completed: 0,
                failed: 0,
                totalDuration: 0,
                averageDuration: 0
            };
        }
        const stats = this.agent.goalStatistics[goalType];
        stats.attempted++;
        stats.totalDuration += duration;
        stats.averageDuration = stats.totalDuration / stats.attempted;
        if (completed) {
            stats.completed++;
        } else {
            stats.failed++;
        }
    }
    // ============================================================================
    // SITUATION ASSESSMENT
    // ============================================================================
    _getMinArbitrationInterval() {
        const situation = this._getSituationAssessment();
        // ✅ FIX: Critical health gets fastest response
        if (situation.healthRatio < 0.15) return this.minArbitrationIntervals.critical;
        if (this.agent._combatStateLocked) return this.minArbitrationIntervals.combat;
        if (situation.inCombat) return this.minArbitrationIntervals.combat;
        if (situation.recentlyDamaged) return this.minArbitrationIntervals.damaged;
        if (situation.hasTarget) return this.minArbitrationIntervals.alert;
        if (situation.exploring) return this.minArbitrationIntervals.exploring;
        return this.minArbitrationIntervals.safe;
    }
    _getSituationAssessment() {
        const now = performance.now();
        if (this.lastSituationAssessment && now - this.situationAssessmentAge < this.situationCacheTimeout) {
            return this.lastSituationAssessment;
        }
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        const hasTarget = !!this.agent.targetSystem?.hasTarget?.();
        const recentlyDamaged = now - (this.agent.lastDamageTime || 0) * 1000 < 5000;
        const currentState = this.agent.stateMachine?.currentState?.type;
        this.lastSituationAssessment = {
            healthRatio,
            hasTarget,
            recentlyDamaged,
            inCombat: currentState === 'combat' || this.agent._combatStateLocked,
            exploring: currentState === 'patrol' || currentState === 'investigate',
            needsHealth: healthRatio < 0.4,
            needsAmmo: !this._safeHasUsableAmmo(),
            alertness: this.agent.alertness || 0
        };
        this.situationAssessmentAge = now;
        return this.lastSituationAssessment;
    }
    // ============================================================================
    // UTILITY HELPERS
    // ============================================================================
    _safe(fn, fallback = null) {
        try {
            return fn();
        } catch  {
            return fallback;
        }
    }
    _safeNumber(v, def = 0) {
        return typeof v === 'number' && isFinite(v) ? v : def;
    }
    _safeHasUsableAmmo() {
        return !!this._safe(()=>this.agent.utilities?.hasUsableAmmo(), this._safe(()=>this.agent.hasUsableAmmo(), false));
    }
    _hasUsableAmmo() {
        return this._safeHasUsableAmmo();
    }
    _hasTargetDied() {
        try {
            const target = this.agent.targetSystem?.getTargetEntity?.();
            if (!target) return false;
            const targetEntity = target.entity || target;
            return targetEntity?.script?.healthSystem?.isDead || targetEntity?.script?.healthSystem?.currentHealth <= 0;
        } catch  {
            return false;
        }
    }
    _hasMultipleThreats() {
        try {
            return this.agent.eventHandler?.getActiveThreats?.()?.length > 1;
        } catch  {
            return false;
        }
    }
    // ============================================================================
    // FRAME OPERATIONS
    // ============================================================================
    _canPerformOperation(operation) {
        const lastFrame = this.frameBasedDebounce.get(operation) || -1;
        if (lastFrame === this.currentFrame) {
            this._logThrottled(`${operation}_debounce`, 'debug', `Operation ${operation} blocked - already performed this frame`);
            return false;
        }
        return true;
    }
    _recordOperation(operation) {
        this.frameBasedDebounce.set(operation, this.currentFrame);
    }
    _canTransitionToGoal(goalType) {
        performance.now();
        const recentTransitions = this.goalTransitionHistory.filter((t)=>this.currentFrame - t.frame <= this.GOAL_TRANSITION_WINDOW);
        const duplicateTransition = recentTransitions.find((t)=>t.goalType === goalType && t.frame === this.currentFrame);
        if (duplicateTransition) {
            this._logThrottled('duplicate_transition', 'warn', `BLOCKED duplicate goal transition to ${goalType} in same frame`);
            return false;
        }
        const recentGoalTypes = recentTransitions.map((t)=>t.goalType);
        const currentGoal = this._getGoalType(this._safe(()=>this.agent.brain.currentSubgoal(), null));
        if (recentGoalTypes.length >= 2 && recentGoalTypes.includes(goalType) && recentGoalTypes.includes(currentGoal)) {
            this._logThrottled('ping_pong', 'warn', `BLOCKED ping-pong transition ${currentGoal} ↔ ${goalType}`);
            return false;
        }
        return true;
    }
    _recordGoalTransition(goalType) {
        this.goalTransitionHistory.push({
            goalType: goalType,
            frame: this.currentFrame,
            timestamp: performance.now()
        });
        if (this.goalTransitionHistory.length > 20) {
            this.goalTransitionHistory = this.goalTransitionHistory.slice(-15);
        }
    }
    // ============================================================================
    // LOGGING
    // ============================================================================
    _logThrottled(key, level, message, ...args) {
        const now = performance.now();
        const lastLog = this.logThrottles.get(key) || 0;
        if (now - lastLog > this.LOG_THROTTLE_MS) {
            this.logThrottles.set(key, now);
            this.currentFrame = Math.floor(now);
            const fullMessage = `[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${this.currentFrame} ${message}`;
            switch(level){
                case 'debug':
                    Logger.debug(fullMessage, ...args);
                    break;
                case 'info':
                    Logger.info(fullMessage, ...args);
                    break;
                case 'warn':
                    Logger.warn(fullMessage, ...args);
                    break;
                case 'error':
                    Logger.error(fullMessage, ...args);
                    break;
                case 'goal':
                    Logger.goal(fullMessage, ...args);
                    break;
                case 'combat':
                    Logger.combat(fullMessage, ...args);
                    break;
                case 'aiState':
                    Logger.aiState(fullMessage, ...args);
                    break;
                case 'aiDetail':
                    Logger.aiDetail(fullMessage, ...args);
                    break;
                default:
                    Logger.info(fullMessage, ...args);
                    break;
            }
            return true;
        }
        return false;
    }
    // ============================================================================
    // ERROR HANDLING
    // ============================================================================
    _handleArbitrationError(error) {
        this.consecutiveArbitrationFailures++;
        Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Arbitration error (${this.consecutiveArbitrationFailures}/${this.maxArbitrationFailures}):`, error);
        if (this.consecutiveArbitrationFailures >= this.maxArbitrationFailures) {
            this._attemptArbitrationRecovery();
        }
    }
    _attemptArbitrationRecovery() {
        try {
            Logger.warn(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Attempting arbitration recovery after ${this.consecutiveArbitrationFailures} failures`);
            if (this.agent.brain) {
                this.agent.brain.clearSubgoals();
            }
            this._lastArbitrateFrame = -1;
            this.consecutiveArbitrationFailures = 0;
            this._fallbackToExplore();
        } catch (recoveryError) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Arbitration recovery failed:`, recoveryError);
        }
    }
    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================
    _setupEventListeners() {
        try {
            if (this.agent && this.agent.app && typeof this.agent.app.on === 'function') {
                this.agent.app.on('pickup:failed:already_full', (evt)=>{
                    try {
                        if (!evt || !evt.agentEntity) return;
                        const agentEntity = evt.agentEntity;
                        if (agentEntity !== this.agent.entity) return;
                        this.agent.lastHealthGoalTime = performance.now();
                        this.agent.healthGoalCooldown = Math.max(2000, this.agent.healthGoalCooldown || 2000);
                        this._logThrottled('pickup_failed', 'aiDetail', `Received pickup:failed:already_full -> applying short health cooldown`);
                    } catch (e) {}
                }, this);
            }
        } catch (e) {}
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    getGoalEfficiencyReport() {
        return {
            arbitrator: this.agentName,
            totalArbitrations: this.goalEvaluationHistory.length,
            lastArbitration: this._lastArbitrateFrame,
            currentFrame: this.currentFrame,
            goalStatistics: this.agent.goalStatistics || {},
            situationAssessment: this.lastSituationAssessment,
            hasFuzzySystem: !!this.agent.fuzzySystem,
            hasPersonalitySystem: !!this.agent.personalitySystem,
            hasStuckDetection: !!this.agent.stuckDetection
        };
    }
    getArbitrationStatus() {
        return {
            agentName: this.agentName,
            agentGuid: this.agentGuid.substring(0, 8),
            currentFrame: this.currentFrame,
            lastArbitrateFrame: this._lastArbitrateFrame,
            goalTransitions: this.goalTransitionHistory.length,
            commitmentLogs: this._commitmentLogHistory.size,
            arbitrationFailures: this.consecutiveArbitrationFailures,
            situationAssessment: this.lastSituationAssessment
        };
    }
    debugArbitrationState() {
        const status = this.getArbitrationStatus();
        Logger.debug(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Arbitration state:`, status);
        return status;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        try {
            this.frameBasedDebounce.clear();
            this.goalTransitionHistory = [];
            this._commitmentLogHistory.clear();
            this.logThrottles.clear();
            this.lastLoggedTransitions.clear();
            this.goalEvaluationHistory = [];
            if (this.agent && this.agent.app) {
                this.agent.app.off('pickup:failed:already_full', null, this);
            }
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error during arbitrator destruction:`, error);
        }
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        this.lastArbitrationTime = 0;
        this.criticalOverrideReason = null;
        this._warnedNoEvaluators = false;
        this._lastForceHealthTime = 0;
        // Frame-based enforcement
        this.currentFrame = 0;
        this._lastArbitrateFrame = -1;
        this.lastArbitrationFrame = -1;
        this.frameBasedDebounce = new Map();
        // Goal transition tracking
        this.goalTransitionHistory = [];
        this.lastGoalTransitionFrame = -1;
        this.GOAL_TRANSITION_WINDOW = 3;
        this._lastCommittedGoalSig = null;
        this._commitmentLogHistory = new Map();
        // Logging
        this.logThrottles = new Map();
        this.LOG_THROTTLE_MS = 400;
        this.lastLoggedTransitions = new Map();
        // Arbitration timing
        // ✅ FIX: Increased intervals for FPS stability - less goal thrashing
        this.minArbitrationIntervals = {
            critical: 100,
            combat: 350,
            damaged: 500,
            alert: 800,
            safe: 1500,
            exploring: 2000 // Exploring/patrolling (was 3000ms)
        };
        // Goal commitment periods (can be overridden by personality)
        // ✅ FIX: Increased for FPS realism - human players commit longer to actions
        this.commitmentPeriods = {
            attack: 8000,
            health: 5000,
            ammo: 4000,
            explore: 4000,
            weapon: 10000,
            cover: 6000,
            flank: 12000,
            general: 5000 // 5 seconds (was 3s) - default
        };
        // Legacy thresholds (still used for critical overrides)
        this.criticalThresholds = {
            health: 0.35,
            ammo: 0,
            targetDied: true,
            stuckTime: 10000,
            emergencyHealth: 0.15
        };
        // Tracking
        this.goalEvaluationHistory = [];
        this.maxEvaluationHistory = 20;
        this.consecutiveArbitrationFailures = 0;
        this.maxArbitrationFailures = 3;
        // Situation assessment cache
        this.lastSituationAssessment = null;
        this.situationAssessmentAge = 0;
        this.situationCacheTimeout = 1000;
        Logger.debug(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Goal Arbitrator initialized (refactored)`);
        this._setupEventListeners();
    }
}

export { AIGoalArbitrator };
