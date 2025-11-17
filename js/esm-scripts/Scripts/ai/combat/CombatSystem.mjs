import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { CombatCore } from './CombatCore.mjs';
import { CombatTactics } from './CombatTactics.mjs';
import { CombatTacticsSystem } from './CombatTacticsSystem.mjs';
import { AdvancedTacticsSystem } from './AdvancedTacticsSystem.mjs';
import { Logger } from '../../core/engine/logger.mjs';

class AICombatSystem {
    _verifyDependencies() {
        const ws = this.agent.weaponSystem;
        if (!ws) {
            setTimeout(()=>this._verifyDependencies(), 100);
            return;
        }
        if (typeof ws.isReady === 'function' && !ws.isReady()) {
            setTimeout(()=>this._verifyDependencies(), 100);
            return;
        }
        if (!this.agent.targetSystem) {
            setTimeout(()=>this._verifyDependencies(), 100);
            return;
        }
        this._ready = true;
        Logger.info(`✅ CombatSystem ready for operations (FIXED VERSION)`);
    }
    isReady() {
        return this._initialized === true && this._ready === true;
    }
    // ============================================================================
    // COMPATIBILITY PROPERTIES
    // ============================================================================
    get lastShootTime() {
        return this.combatCore.lastShootTime;
    }
    get burstFireCount() {
        return this.combatCore.burstFireCount;
    }
    get combatTimer() {
        return this.combatTactics.combatTimer;
    }
    get combatStats() {
        return this.combatCore.combatStats;
    }
    get cachedWeaponScores() {
        return this.agent.weaponSelector?.cachedWeaponScores || null;
    }
    // ============================================================================
    // MAIN UPDATE LOOP - ✅ FIXED with Movement Management
    // ============================================================================
    update(dt, context) {
        this.combatTactics.updateCombatTimer(dt);
        if (!context) {
            Logger.error(`[${this.agent.entity.name}] ❌ Combat update blocked: NO CONTEXT`);
            return;
        }
        if (!this.agent.weaponSystem) {
            Logger.error(`[${this.agent.entity.name}] ❌ Combat update blocked: NO WEAPON SYSTEM`);
            return;
        }
        const now = performance.now();
        // Update aim system
        if (this.agent.aimSystem) {
            this.agent.aimSystem.update(dt, context);
        }
        // Update tactics system
        if (this.tacticsSystem) {
            this.tacticsSystem.update(dt, context);
        }
        // Update advanced tactics
        if (this.advancedTactics) {
            this.advancedTactics.update(dt, context);
        }
        // ✅ NEW: Manage movement based on combat situation
        this._manageCombatMovement(dt, context, now);
        // Get target position
        let targetPos = this.combatTactics.getTargetPosition(context, now);
        if (!targetPos) {
            if (window.AI_DEBUG_COMBAT) {
                Logger.debug(`[${this.agent.entity.name}] No target position available`);
            }
            return;
        }
        // Check weapon readiness
        if (!this.combatCore.isWeaponReady()) {
            this.combatCore.handleWeaponNotReady();
            return;
        }
        // Weapon switching
        this.combatTactics.handleWeaponSwitching(context);
        // Calculate combat parameters
        const combatData = this.combatCore.calculateCombatParameters(targetPos, context);
        // Execute shooting (now with animation gating via PATCH_CombatCore)
        const shotFired = this.combatCore.executeShooting(combatData, targetPos);
        if (shotFired && now - this._lastFireSuccessLog > 1000) {
            if (window.AI_DEBUG_COMBAT) {
                Logger.combat(`[${this.agent.entity.name}] 🔫 FIRED WEAPON!`);
            }
            this._lastFireSuccessLog = now;
        }
        // Handle aim lock
        this.combatCore.handleAimLock(targetPos, shotFired);
        this.combatCore.updateCombatStats(dt);
    }
    // ============================================================================
    // ✅ NEW: COMBAT MOVEMENT MANAGEMENT - Exciting Gameplay Tuning
    // ============================================================================
    /**
     * ✅ Manage AI movement during combat
     * Controls when AI should advance, retreat, or hold position
     * 
     * TUNING: Exciting gameplay - aggressive positioning, quick decisions
     */ _manageCombatMovement(dt, context, now) {
        // Throttle movement updates (don't update every frame)
        if (now - this._lastMovementUpdate < this._movementUpdateInterval) {
            return;
        }
        this._lastMovementUpdate = now;
        const navigation = this.agent.navigation;
        if (!navigation) return;
        const distance = context.targetDistance || Infinity;
        const hasTarget = context.hasTarget || false;
        const targetVisible = context.targetVisible || false;
        // Get weapon-specific optimal range
        const optimalRange = this._getOptimalWeaponRange();
        // ✅ EXCITING TUNING: Wider optimal range tolerance (aggressive positioning)
        const optimalMin = optimalRange * 0.65; // Was 0.7
        const optimalMax = optimalRange * 1.35; // Was 1.3
        const tooFar = optimalRange * 1.6; // Was 1.5 (pushes closer)
        const tooClose = optimalRange * 0.4; // Was 0.5 (less conservative)
        // Determine movement strategy based on distance
        if (targetVisible && hasTarget) {
            let newStrategy = this._movementStrategy;
            // Case 1: Target in optimal range → HOLD POSITION
            if (distance >= optimalMin && distance <= optimalMax) {
                newStrategy = 'hold';
                // ✅ EXCITING: Don't completely stop - allow micro-movements
                if (navigation.setSpeedModifier) {
                    navigation.setSpeedModifier(0.3); // 30% speed for strafing
                } else if (navigation.stopMovement) {
                    // Only stop if we can't strafe
                    navigation.stopMovement();
                }
                if (window.AI_DEBUG_MOVEMENT && this._movementStrategy !== newStrategy) {
                    Logger.aiDetail(`[${this.agent.entity.name}] 🎯 HOLD: In optimal range (${distance.toFixed(1)}m)`);
                }
            } else if (distance > tooFar) {
                newStrategy = 'advance';
                // ✅ EXCITING: Fast advance (80% speed)
                if (navigation.setSpeedModifier) {
                    navigation.setSpeedModifier(0.80);
                }
                // Move toward target
                if (navigation.moveTo && context.targetPosition) {
                    navigation.moveTo(context.targetPosition);
                }
                if (window.AI_DEBUG_MOVEMENT && this._movementStrategy !== newStrategy) {
                    Logger.aiDetail(`[${this.agent.entity.name}] ➡️  ADVANCE: Target far (${distance.toFixed(1)}m)`);
                }
            } else if (distance > optimalMax) {
                newStrategy = 'advance';
                // ✅ EXCITING: Slower advance for precision
                if (navigation.setSpeedModifier) {
                    navigation.setSpeedModifier(0.65);
                }
                if (navigation.moveTo && context.targetPosition) {
                    navigation.moveTo(context.targetPosition);
                }
            } else if (distance < tooClose) {
                newStrategy = 'retreat';
                // ✅ EXCITING: Quick retreat (70% speed)
                if (navigation.setSpeedModifier) {
                    navigation.setSpeedModifier(0.70);
                }
                // Move away from target
                if (navigation.moveAwayFrom && context.targetPosition) {
                    navigation.moveAwayFrom(context.targetPosition);
                } else if (navigation.moveTo && context.targetPosition) {
                    // Fallback: move to position behind us
                    const retreatPos = this.entity.getPosition().clone();
                    const awayDir = new Vec3();
                    awayDir.sub2(retreatPos, context.targetPosition);
                    awayDir.normalize();
                    retreatPos.add(awayDir.mulScalar(5)); // 5m back
                    navigation.moveTo(retreatPos);
                }
                if (window.AI_DEBUG_MOVEMENT && this._movementStrategy !== newStrategy) {
                    Logger.aiDetail(`[${this.agent.entity.name}] ⬅️  RETREAT: Target close (${distance.toFixed(1)}m)`);
                }
            } else if (distance < optimalMin) {
                newStrategy = 'retreat';
                // ✅ EXCITING: Gentle retreat
                if (navigation.setSpeedModifier) {
                    navigation.setSpeedModifier(0.50);
                }
            }
            this._movementStrategy = newStrategy;
        } else {
            // No target visible - allow normal search movement
            this._movementStrategy = 'search';
            if (navigation.setSpeedModifier) {
                navigation.setSpeedModifier(1.0); // Full speed during search
            }
        }
        // ✅ EXCITING: Periodic aggressive repositioning
        // Every 3-5 seconds, try to flank or find better position
        if (!this._lastRepositionTime) this._lastRepositionTime = now;
        const timeSinceReposition = now - this._lastRepositionTime;
        const repositionInterval = 3000 + Math.random() * 2000; // 3-5 seconds
        if (timeSinceReposition > repositionInterval && targetVisible && hasTarget) {
            this._attemptTacticalReposition(context);
            this._lastRepositionTime = now;
        }
    }
    /**
     * ✅ NEW: Attempt tactical repositioning (flanking, cover, etc.)
     */ _attemptTacticalReposition(context) {
        // Only reposition if not in combat lock
        const animController = this.agent?.animationController;
        if (animController && animController.isCombatLocked()) {
            return; // Don't reposition while actively firing
        }
        // Randomly choose a tactic
        const tactics = [
            'flank',
            'strafe',
            'advance'
        ];
        const chosenTactic = tactics[Math.floor(Math.random() * tactics.length)];
        const navigation = this.agent.navigation;
        if (!navigation) return;
        const myPos = this.entity.getPosition();
        const targetPos = context.targetPosition;
        if (!targetPos) return;
        let newPos;
        switch(chosenTactic){
            case 'flank':
                // Move to side of target
                const toTarget = new Vec3().sub2(targetPos, myPos);
                const right = new Vec3().cross(toTarget, Vec3.UP).normalize();
                newPos = myPos.clone().add(right.mulScalar(5 * (Math.random() > 0.5 ? 1 : -1)));
                break;
            case 'strafe':
                // Quick sidestep
                const forward = this.entity.forward.clone();
                const strafeRight = new Vec3().cross(forward, Vec3.UP).normalize();
                newPos = myPos.clone().add(strafeRight.mulScalar(3 * (Math.random() > 0.5 ? 1 : -1)));
                break;
            case 'advance':
                // Move closer
                const toTarget2 = new Vec3().sub2(targetPos, myPos).normalize();
                newPos = myPos.clone().add(toTarget2.mulScalar(3));
                break;
        }
        if (newPos && navigation.moveTo) {
            navigation.moveTo(newPos);
            if (window.AI_DEBUG_MOVEMENT) {
                Logger.aiDetail(`[${this.agent.entity.name}] 🎯 Tactical reposition: ${chosenTactic}`);
            }
        }
    }
    /**
     * ✅ Get optimal firing range for current weapon
     * 
     * TUNING: Exciting gameplay - closer ranges for action
     */ _getOptimalWeaponRange() {
        const weaponSystem = this.agent.weaponSystem;
        if (!weaponSystem) return 15;
        const currentWeapon = weaponSystem.currentWeapon || 'pistol';
        // ✅ EXCITING TUNING: Closer combat ranges for intense action
        const ranges = {
            pistol: 10,
            machinegun: 15,
            shotgun: 5 // Very close (was 6)
        };
        return ranges[currentWeapon] || 12;
    }
    // ============================================================================
    // COMBAT CAPABILITY API
    // ============================================================================
    canEngageInCombat() {
        if (!this.isReady()) {
            return false;
        }
        return this.combatCore.canEngageInCombat();
    }
    getCombatEffectiveness() {
        return this.combatCore.getCombatEffectiveness();
    }
    shouldEngageTarget(target) {
        return this.combatCore.shouldEngageTarget(target);
    }
    // ============================================================================
    // COMBAT STATE MANAGEMENT
    // ============================================================================
    onCombatExit() {
        this.combatTactics.onCombatExit();
        this._movementStrategy = 'neutral';
    }
    shouldMaintainCombatLock() {
        return this.combatTactics.shouldMaintainCombatLock();
    }
    // ============================================================================
    // TACTICAL EVENT HANDLERS
    // ============================================================================
    onEnemySpottedCombat(enemy) {
        this.combatTactics.onEnemySpottedCombat(enemy);
    }
    onTargetAcquiredCombat(target) {
        this.combatTactics.onTargetAcquiredCombat(target);
    }
    // ============================================================================
    // STATISTICS API
    // ============================================================================
    getCombatStats() {
        return this.combatCore.getCombatStats();
    }
    resetCombatStats() {
        this.combatCore.resetCombatStats();
    }
    recordHit() {
        this.combatCore.recordHit();
    }
    recordKill() {
        this.combatCore.recordKill();
    }
    // ============================================================================
    // SHOOTING CONTROL API
    // ============================================================================
    pauseShooting(durationSeconds) {
        return this.combatCore.pauseShooting(durationSeconds);
    }
    resumeShooting() {
        return this.combatCore.resumeShooting();
    }
    requestShot() {
        return this.combatCore.requestShot();
    }
    // ============================================================================
    // LEGACY/COMPATIBILITY METHODS
    // ============================================================================
    _requestCombatState(reason) {
        return this.combatTactics.requestCombatState(reason);
    }
    _canEngageCombat() {
        return this.combatTactics.canEngageCombat();
    }
    _hasMinimumAmmo() {
        return this.combatCore.hasMinimumAmmo();
    }
    _isWeaponReady() {
        return this.combatCore.isWeaponReady();
    }
    _handleWeaponNotReady() {
        this.combatCore.handleWeaponNotReady();
    }
    _getTargetPosition(context, now) {
        return this.combatTactics.getTargetPosition(context, now);
    }
    _enterSearchMode() {
        this.combatTactics.enterSearchMode();
    }
    _handleWeaponSwitching(context) {
        this.combatTactics.handleWeaponSwitching(context);
    }
    _calculateCombatParameters(targetPos, context) {
        return this.combatCore.calculateCombatParameters(targetPos, context);
    }
    _calculateDistanceFactor(distance) {
        return this.combatCore.calculateDistanceFactor(distance);
    }
    _executeShooting(combatData, targetPos) {
        return this.combatCore.executeShooting(combatData, targetPos);
    }
    _fireWeapon(aimPos) {
        return this.combatCore.fireWeapon(aimPos);
    }
    _canShootAtTarget() {
        return this.combatCore.canShootAtTarget();
    }
    _updateCombatStats(dt) {
        this.combatCore.updateCombatStats(dt);
    }
    // ============================================================================
    // EXTENDED TACTICAL API
    // ============================================================================
    shouldEngageInCombat() {
        return this.combatTactics.shouldEngageInCombat();
    }
    evaluateEngagementThreat(target) {
        return this.combatTactics.evaluateEngagementThreat(target);
    }
    calculateEngagementPriority(context) {
        return this.combatTactics.calculateEngagementPriority(context);
    }
    shouldMaintainEngagement(context) {
        return this.combatTactics.shouldMaintainEngagement(context);
    }
    getCombatTimingInfo() {
        return this.combatTactics.getCombatTimingInfo();
    }
    getSearchInfo() {
        return this.combatTactics.getSearchInfo();
    }
    // ============================================================================
    // DEBUG API
    // ============================================================================
    debugCombatState() {
        const coreState = {
            canEngage: this.combatCore.canEngageInCombat(),
            effectiveness: (this.combatCore.getCombatEffectiveness() * 100).toFixed(0) + '%',
            lastShot: this.combatCore.lastShootTime ? (performance.now() / 1000 - this.combatCore.lastShootTime).toFixed(1) + 's ago' : 'Never',
            burstCount: this.combatCore.burstFireCount,
            combatStats: this.combatCore.getCombatStats(),
            weaponReady: this.combatCore.isWeaponReady(),
            movementStrategy: this._movementStrategy
        };
        Logger.debug(`[${this.entity.name}] --- Combat State (FIXED VERSION) ---`);
        Object.entries(coreState).forEach(([key, value])=>{
            Logger.debug(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        });
        return coreState;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (this.combatCore) {
            this.combatCore.destroy();
            this.combatCore = null;
        }
        if (this.combatTactics) {
            this.combatTactics.destroy();
            this.combatTactics = null;
        }
        if (this.advancedTactics) {
            this.advancedTactics.destroy();
            this.advancedTactics = null;
        }
        Logger.debug(`[${this.entity.name}] CombatSystem destroyed (FIXED VERSION)`);
    }
    constructor(agent){
        this.agent = agent;
        this.entity = agent.entity;
        // Initialize internal modules
        this.combatCore = new CombatCore(agent);
        this.combatTactics = new CombatTactics(agent);
        const fuzzySystem = agent.fuzzySystem || null;
        this.tacticsSystem = new CombatTacticsSystem(agent, fuzzySystem);
        this.advancedTactics = new AdvancedTacticsSystem(agent);
        this._initialized = true;
        // ✅ NEW: Movement control state
        this._movementStrategy = 'neutral'; // neutral, advance, retreat, hold
        this._lastMovementUpdate = 0;
        this._movementUpdateInterval = 200; // Update every 200ms
        // Diagnostic logging throttles
        this._lastFireAttemptLog = 0;
        this._lastFireSuccessLog = 0;
        this._lastMovementLog = 0;
        this._verifyDependencies();
        Logger.debug(`[${this.entity.name}] CombatSystem initialized (FIXED VERSION with Movement Management)`);
    }
}

export { AICombatSystem as default };
