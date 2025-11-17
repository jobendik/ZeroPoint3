import { Vec3 } from '../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { StateChangeManager } from './StateTransition.mjs';
import { Logger } from '../../../core/engine/logger.mjs';

// ============================================================================
// PATROL STATE (unchanged, keeping for context)
// ============================================================================
class PatrolState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent;
        if (!agent) {
            Logger.error('PatrolState.enter: vehicle.agent is undefined.');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        agent.alertness = Math.max(0, agent.alertness - 0.1);
        agent.combatTimer = 0;
        agent.lastStrafeTime = 0;
        agent.strafeDirection = 0;
        agent.isInCover = false;
        this.patrolStartTime = performance.now();
        this.nextExploreTime = performance.now() + (3000 + Math.random() * 4000);
        this.stuckCheckTime = 0;
        this.lastPosition = agent.entity.getPosition().clone();
        this.positionCheckInterval = 3000;
        this.exploreAttempts = 0;
        this.maxExploreAttempts = 3;
        this._hasWarnedNoWeapons = false;
        this._lastWeaponCheckTime = 0;
        agent.stateChangeManager.eventManager.logStateEntry('PATROL');
        // ✅ FIX: Warn if brain is unexpectedly null (should never happen after initialization)
        if (!agent.brain) {
            Logger.warn(`[${agent.stateChangeManager.agentName}] ⚠️ Brain is null in PatrolState.enter() - agent not fully initialized?`);
        } else if (!agent.targetSystem || !agent.targetSystem.hasTarget()) {
            const currentGoal = agent.brain.currentSubgoal();
            if (currentGoal && currentGoal.constructor.name === 'EnhancedAttackGoal') {
                if (!currentGoal.canBePreempted || currentGoal.canBePreempted()) {
                    Logger.goal(`[${agent.stateChangeManager.agentName}] Patrol clearing old attack goal`);
                    agent.brain.clearSubgoals();
                }
            }
        }
        if (agent.utilities) {
            agent.utilities.explorationAttempts = 0;
        }
        if (agent.explorationAttempts === undefined) {
            agent.explorationAttempts = 0;
        }
        if (agent.navigationReady && agent.navigation && agent.navigation.findValidRandomPosition) {
            const initialTarget = agent.navigation.findValidRandomPosition(10, 25);
            if (initialTarget && agent.navigation.moveTo) {
                agent.navigation.moveTo(initialTarget);
                Logger.nav(`[${agent.stateChangeManager.agentName}] Patrol state - starting initial movement`);
            }
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        const now = performance.now();
        if (agent.targetSystem && agent.targetSystem.hasTarget()) {
            const targetPos = agent.targetSystem.getTargetPosition();
            if (targetPos && agent.utilities) {
                if (agent.utilities.shouldRotateTowardTarget()) {
                    const rotationComplete = agent.utilities.rotateTowardTarget(targetPos, 90);
                    Logger.debug(`[${agent.entity.name}] PATROL: Target outside FOV, rotating... (complete: ${rotationComplete})`);
                }
            }
            const ws = agent.weaponSystem;
            if (!ws) {
                this._logWeaponIssue(agent, 'NO_WEAPON_SYSTEM', now);
                return;
            }
            if (!ws._initialized || !ws.__wsBooted || !ws.weapons) {
                this._logWeaponIssue(agent, 'WEAPON_SYSTEM_NOT_INITIALIZED', now);
                return;
            }
            const hasAnyWeapon = Object.keys(ws.weapons).some((key)=>ws.weapons[key] && ws.weapons[key].unlocked);
            if (!hasAnyWeapon) {
                this._logWeaponIssue(agent, 'NO_UNLOCKED_WEAPONS', now);
                return;
            }
            const hasAmmo = agent.utilities ? agent.utilities.hasUsableAmmo() : false;
            if (!hasAmmo) {
                agent.stateChangeManager._logThrottled('no_ammo_patrol', 'aiDetail', `Target detected but no ammo - should seek ammo`);
            }
            const targetEntity = agent.targetSystem.getTargetEntity();
            const isTargetDamageable = targetEntity && targetEntity.script && targetEntity.script.healthSystem && !targetEntity.script.healthSystem.isDead && !targetEntity.script.healthSystem.isRespawning && !targetEntity.script.healthSystem.isBeingDestroyed && targetEntity.script.healthSystem.currentHealth > 0;
            if (!isTargetDamageable) {
                agent.stateChangeManager._logThrottled('target_not_damageable', 'aiDetail', `Target detected but not damageable - staying in patrol`);
                return;
            }
            if (hasAmmo && agent.stateChangeManager.changeToState('alert')) {
                Logger.aiState(`[${agent.stateChangeManager.agentName}] ✅ Target acquired with weapons ready - transitioning to ALERT`);
                return;
            }
        }
        if (agent.investigationTarget) {
            if (agent.stateChangeManager.changeToState('investigate')) {
                return;
            }
        }
        if (now - this.stuckCheckTime > this.positionCheckInterval) {
            this._checkPatrolProgress(agent, now);
            this.stuckCheckTime = now;
        }
        // ✅ FIX: Warn if brain is unexpectedly null during execute
        if (!agent.brain) {
            Logger.warn(`[${agent.stateChangeManager.agentName}] ⚠️ Brain is null in PatrolState.execute() - skipping goal checks`);
            return; // Can't continue without brain
        }
        const currentGoal = agent.brain.currentSubgoal();
        currentGoal && agent.currentGoalStartTime ? now - agent.currentGoalStartTime : 0;
        // ✅ PHASE 1: DISABLED - Goal System now controls health/ammo seeking via GoalStateAdapter
        // These hardcoded checks created conflicts with Goal System's dynamic evaluation
        /*
        // OLD CODE: Hardcoded health/ammo checks
        // ✅ CRITICAL FIX: Check health more frequently and transition even without health items
        if (goalAge > 3000 || (now - this.patrolStartTime) > 5000) {
            const healthRatio = agent.health / Math.max(1, agent.maxHealth);
            
            // At critical/low health, ALWAYS try to transition (don't require health item to exist first)
            if (healthRatio < 0.4) {
                const options = healthRatio <= 0.15 ? { criticalHealthOverride: true } : { lowHealthOverride: true };
                
                // Attempt state transition - let the state transition system decide if health items exist
                if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                    Logger.aiState(`[${agent.stateChangeManager.agentName}] ⚠️ Low health (${Math.round(healthRatio * 100)}%) - transitioning from PATROL to SEEK_HEALTH`);
                    return;
                }
            }
            
            const ws = agent.weaponSystem;
            if (ws && ws.weapons && ws.currentWeapon) {
                const currentWeapon = ws.weapons[ws.currentWeapon];
                if (currentWeapon && currentWeapon.unlocked) {
                    const magazineAmmo = ws.currentMagazine || 0;
                    const reserveAmmo = currentWeapon.ammo || 0;
                    const totalCurrentWeaponAmmo = magazineAmmo + reserveAmmo;
                    
                    if (totalCurrentWeaponAmmo < 5) {
                        agent.stateChangeManager._logThrottled('low_ammo_patrol', 'aiDetail', 
                            `Low ammo in current weapon (${totalCurrentWeaponAmmo} rounds)`);
                        
                        if (agent.stateChangeManager.changeToState('seekAmmo')) {
                            return;
                        }
                    }
                }
            }
        }
        */ if (agent.navigationReady && now > this.nextExploreTime) {
            this._initiateExploration(agent, now);
        }
    }
    _logWeaponIssue(agent, issueType, now) {
        if (now - this._lastWeaponCheckTime < 5000) {
            return;
        }
        this._lastWeaponCheckTime = now;
        const agentName = agent.stateChangeManager.agentName;
        switch(issueType){
            case 'NO_WEAPON_SYSTEM':
                Logger.error(`[${agentName}] ❌ CRITICAL: No weapon system found on AI agent!`);
                Logger.error(`   📋 ACTION REQUIRED: Attach a weapon system script to the AI agent entity.`);
                break;
            case 'WEAPON_SYSTEM_NOT_INITIALIZED':
                Logger.error(`[${agentName}] ❌ CRITICAL: Weapon system exists but is not initialized!`);
                break;
            case 'NO_UNLOCKED_WEAPONS':
                Logger.error(`[${agentName}] ❌ CRITICAL: Weapon system has no unlocked weapons!`);
                break;
        }
        this._hasWarnedNoWeapons = true;
    }
    _checkPatrolProgress(agent, now) {
        const currentPos = agent.entity.getPosition();
        const distanceMoved = this.lastPosition.distance(currentPos);
        if (distanceMoved < 0.8 && agent.isMoving) {
            this._handlePatrolStuck(agent, now);
        }
        this.lastPosition = currentPos.clone();
    }
    _handlePatrolStuck(agent, now) {
        Logger.nav(`[${agent.stateChangeManager.agentName}] Patrol stuck detected - attempting recovery`);
        if (agent.navigation && agent.navigation.stopMovement) {
            agent.navigation.stopMovement();
        }
        let newTarget = null;
        if (agent.navigation && agent.navigation.findValidRandomPosition) {
            newTarget = agent.navigation.findValidRandomPosition(8, 20);
        }
        if (newTarget) {
            if (agent.navigation && agent.navigation.moveTo) {
                agent.navigation.moveTo(newTarget);
            }
            this.nextExploreTime = now + 2000;
        } else {
            this.nextExploreTime = now + 5000;
        }
    }
    _initiateExploration(agent, now) {
        // ✅ FIX: Warn if brain is unexpectedly null
        if (!agent.brain) {
            Logger.warn(`[${agent.stateChangeManager.agentName}] ⚠️ Brain is null in _initiateExploration() - skipping goal check`);
        // Continue with exploration anyway (movement doesn't require brain)
        } else {
            const currentGoal = agent.brain.currentSubgoal();
            if (currentGoal && currentGoal.status === YUKA.Goal.STATUS.ACTIVE) {
                const goalAge = now - agent.currentGoalStartTime;
                if (goalAge < 2000) {
                    this.nextExploreTime = now + 2000;
                    return;
                }
            }
        }
        let exploreTarget = null;
        if (agent.navigation && agent.navigation.findValidRandomPosition) {
            exploreTarget = agent.navigation.findValidRandomPosition(10, 25);
        }
        if (exploreTarget) {
            if (agent.navigation && agent.navigation.moveTo) {
                agent.navigation.moveTo(exploreTarget);
            }
            this.nextExploreTime = now + (8000 + Math.random() * 12000);
            this.exploreAttempts = 0;
        } else {
            this.exploreAttempts++;
            if (this.exploreAttempts >= this.maxExploreAttempts) {
                let fallbackTarget = null;
                if (agent.navigation && agent.navigation.findValidRandomPosition) {
                    fallbackTarget = agent.navigation.findValidRandomPosition(5, 15);
                }
                if (fallbackTarget) {
                    if (agent.navigation && agent.navigation.moveTo) {
                        agent.navigation.moveTo(fallbackTarget);
                    }
                }
                this.exploreAttempts = 0;
                this.nextExploreTime = now + (10000 + Math.random() * 10000);
            } else {
                this.nextExploreTime = now + (2000 + Math.random() * 3000);
            }
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        agent.stateChangeManager.eventManager.logStateExit('PATROL');
    }
    constructor(){
        super();
        this.type = 'patrol'; // ✅ FIX #3: Add type property for state identification
    }
}
// ============================================================================
// ALERT STATE (unchanged)
// ============================================================================
class AlertState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent;
        if (!agent) {
            Logger.error('AlertState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        agent.alertness = Math.min(1, agent.alertness + 0.2);
        this.alertStartTime = performance.now();
        this.maxAlertTime = 18000;
        this.investigationTimeout = 10000;
        this.moveAttempted = false;
        this.lastMoveAttempt = 0;
        this._lastWeaponCheckTime = 0;
        agent.stateChangeManager.eventManager.logStateEntry('ALERT');
        if (agent.investigationTarget && agent.navigationReady) {
            this._attemptInvestigationMovement(agent);
        }
    }
    _attemptInvestigationMovement(agent) {
        let validTarget = null;
        if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
            validTarget = agent.navigation.findValidNavMeshPosition(agent.investigationTarget, 10);
        }
        if (validTarget) {
            let success = false;
            if (agent.navigation && agent.navigation.moveTo) {
                success = agent.navigation.moveTo(validTarget);
            }
            if (success) {
                this.moveAttempted = true;
            } else {
                this.lastMoveAttempt = performance.now();
            }
        } else {
            agent.investigationTarget = null;
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        const alertAge = performance.now() - this.alertStartTime;
        const now = performance.now();
        if (agent.targetSystem && agent.targetSystem.hasTarget() && agent.targetSystem.isTargetVisible()) {
            const targetPos = agent.targetSystem.getTargetPosition();
            if (targetPos && agent.utilities) {
                if (agent.utilities.shouldRotateTowardTarget()) {
                    agent.utilities.rotateTowardTarget(targetPos, 150);
                }
            }
            const targetEntity = agent.targetSystem.getTargetEntity();
            const isTargetDamageable = targetEntity && targetEntity.script && targetEntity.script.healthSystem && !targetEntity.script.healthSystem.isDead && !targetEntity.script.healthSystem.isRespawning && !targetEntity.script.healthSystem.isBeingDestroyed && targetEntity.script.healthSystem.currentHealth > 0;
            if (!isTargetDamageable) {
                return;
            }
            const ws = agent.weaponSystem;
            if (!ws || !ws._initialized || !ws.__wsBooted || !ws.weapons) {
                this._logWeaponIssue(agent, now);
                return;
            }
            const hasAnyWeapon = Object.keys(ws.weapons).some((key)=>ws.weapons[key] && ws.weapons[key].unlocked);
            if (!hasAnyWeapon) {
                this._logWeaponIssue(agent, now);
                return;
            }
            const hasAmmo = agent.utilities ? agent.utilities.hasUsableAmmo() : false;
            if (!hasAmmo) {
                return;
            }
            if (hasAmmo && agent.stateChangeManager.changeToState('combat')) {
                Logger.aiState(`[${agent.stateChangeManager.agentName}] ✅ Engaging combat from alert state`);
                return;
            }
        }
        if (agent.investigationTarget && !this.moveAttempted && now - this.lastMoveAttempt > 3000 && agent.navigationReady) {
            this._attemptInvestigationMovement(agent);
        }
        if (agent.investigationTarget && agent.navigationReady) {
            const distanceToTarget = agent.entity.getPosition().distance(agent.investigationTarget);
            if (distanceToTarget < 4) {
                agent.investigationTarget = null;
            } else if (alertAge > this.investigationTimeout) {
                agent.investigationTarget = null;
            }
        }
        if ((!agent.targetSystem || !agent.targetSystem.hasTarget()) && !agent.investigationTarget && agent.alertness < 0.3) {
            if (agent.stateChangeManager.changeToState('patrol')) {
                return;
            }
        }
        if (alertAge > this.maxAlertTime) {
            agent.investigationTarget = null;
            if (agent.stateChangeManager.changeToState('patrol')) {
                return;
            }
        }
    // ✅ PHASE 1: DISABLED - Goal System now controls health/ammo seeking via GoalStateAdapter
    /*
        // OLD CODE: Hardcoded health/ammo checks
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        if (healthRatio < 0.25 &&
            (!agent.targetSystem || !agent.targetSystem.hasTarget())) {
            const options = healthRatio <= 0.15 ? { criticalHealthOverride: true } : { lowHealthOverride: true };
            if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                return;
            }
        }
        
        const ws = agent.weaponSystem;
        if (ws && ws.weapons && ws.currentWeapon) {
            const currentWeapon = ws.weapons[ws.currentWeapon];
            if (currentWeapon && currentWeapon.unlocked) {
                const magazineAmmo = ws.currentMagazine || 0;
                const reserveAmmo = currentWeapon.ammo || 0;
                const totalCurrentWeaponAmmo = magazineAmmo + reserveAmmo;
                
                if (totalCurrentWeaponAmmo < 5) {
                    if (agent.stateChangeManager.changeToState('seekAmmo')) {
                        return;
                    }
                }
            }
        }
        */ }
    _logWeaponIssue(agent, now) {
        if (now - this._lastWeaponCheckTime < 5000) return;
        this._lastWeaponCheckTime = now;
        Logger.error(`[${agent.stateChangeManager.agentName}] ❌ Cannot transition to combat from ALERT: weapon system issue`);
    }
    exit(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        agent.stateChangeManager.eventManager.logStateExit('ALERT');
    }
    constructor(){
        super();
        this.type = 'alert'; // ✅ FIX #3: Add type property for state identification
    }
}
class CombatState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent;
        if (!agent) {
            Logger.error('CombatState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        agent.alertness = 1.0;
        this.combatStartTime = performance.now();
        this.targetLossTime = 0;
        this.lastCombatMovement = 0;
        this.combatMovementCooldown = 800;
        this.lastKnownTargetPos = null;
        this.pursuingLastKnownPos = false;
        this.lastPursuitAttempt = 0;
        this.pursuitAttempts = 0;
        this.maxPursuitAttempts = 3;
        this.TARGET_LOSS_PURSUIT_TIME = 8000;
        this.PURSUIT_COOLDOWN = 2000;
        this.SEARCH_RADIUS = 15;
        this.COMBAT_MIN_DWELL_MS = 1500;
        this.CRITICAL_HEALTH_OVERRIDE = 0.15;
        this.LOW_HEALTH_OVERRIDE = 0.30;
        this.LOW_HEALTH_OVERRIDE_DELAY = 800;
        agent._combatStateLocked = true;
        Logger.aiState(`[${agent.stateChangeManager.agentName}] Entered COMBAT state`);
        if (agent.brain) {
            agent.brain.clearSubgoals();
        }
        if (agent.targetSystem && agent.targetSystem.hasTarget()) {
            this.lastKnownTargetPos = agent.targetSystem.getTargetPosition();
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        // ✅ TWO BRAINS FIX: State is now PASSIVE - only handles animation/logging
        // Combat execution moved to AttackGoal.execute() for 16ms response time (was 133ms)
        // ✅ GUARD #1: Check if entity is enabled (disabled during countdown)
        if (!agent.entity.enabled) {
            return; // Silent skip during countdown
        }
        // ✅ GUARD #2: Check if session is active (not during countdown)
        try {
            const root = agent.app?.root;
            if (root) {
                const gameManagerEntity = root.findByName('GameManager');
                if (gameManagerEntity && gameManagerEntity.script && gameManagerEntity.script.gameSession) {
                    const sessionInfo = gameManagerEntity.script.gameSession.getSessionInfo();
                    if (sessionInfo.isCountingDown || !sessionInfo.isActive) {
                        return; // Silent skip during countdown/inactive session
                    }
                }
            }
        } catch (error) {
            // Can't verify session - skip this frame
            return;
        }
        // ✅ PASSIVE: Only update animation state
        if (agent.animator) {
            const currentAnim = agent.animator.getState?.();
            if (currentAnim !== 'combat') {
                agent.animator.setState('combat');
            }
        }
    // ✅ REMOVED: All combat system execution (now in AttackGoal)
    // - agent.combatSystem.update()
    // - agent.combatTactics.update()
    // - Health-based flee transitions
    // - Target loss pursuit logic
    // - All decision-making and behavior execution
    // - State tick logging (eventManager.tick no longer needed)
    // The goal system now handles ALL of this with proper latency
    }
    _pursueLastKnownPosition(agent) {
        if (!this.lastKnownTargetPos || !agent.navigationReady) {
            return;
        }
        let pursuitTarget = null;
        if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
            pursuitTarget = agent.navigation.findValidNavMeshPosition(this.lastKnownTargetPos, 10);
        } else {
            pursuitTarget = this.lastKnownTargetPos;
        }
        if (pursuitTarget) {
            let success = false;
            if (agent.navigation && agent.navigation.moveTo) {
                success = agent.navigation.moveTo(pursuitTarget);
            }
            if (success) {
                this.pursuingLastKnownPos = true;
                this.lastPursuitAttempt = performance.now();
                this.pursuitAttempts++;
                const vehicle = agent.agentCore?.getVehicle?.();
                if (vehicle) {
                    vehicle.maxSpeed = vehicle.maxSpeed * 1.5;
                }
                Logger.tactic(`[${agent.entity.name}] Pursuing last known position`);
            }
        }
    }
    _searchAroundPosition(agent, centerPos) {
        if (!agent.navigationReady) return;
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * this.SEARCH_RADIUS;
        const searchPos = new Vec3(centerPos.x + Math.cos(angle) * distance, centerPos.y, centerPos.z + Math.sin(angle) * distance);
        let validSearchPos = null;
        if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
            validSearchPos = agent.navigation.findValidNavMeshPosition(searchPos, 10);
        }
        if (validSearchPos) {
            if (agent.navigation && agent.navigation.moveTo) {
                agent.navigation.moveTo(validSearchPos);
            }
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent;
        if (!agent) return;
        const combatDuration = performance.now() - this.combatStartTime;
        agent.stateChangeManager.eventManager.logStateExit('COMBAT', combatDuration);
        agent._combatStateLocked = false;
        if (agent.combatSystem && agent.combatSystem.onCombatExit) {
            agent.combatSystem.onCombatExit();
        }
    }
    constructor(){
        super();
        this.type = 'combat'; // ✅ FIX #3: Add type property for state identification
    }
}
// ============================================================================
// INVESTIGATE STATE
// ============================================================================
class InvestigateState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) {
            Logger.error('InvestigateState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        agent.alertness = Math.min(1, agent.alertness + 0.1);
        this.investigateStartTime = performance.now();
        this.maxInvestigateTime = 15000;
        this.moveAttempted = false;
        this.lastMoveAttempt = 0;
        agent.stateChangeManager.eventManager.logStateEntry('INVESTIGATE');
        if (agent.investigationTarget && agent.navigationReady) {
            this._attemptInvestigationMovement(agent);
        }
    }
    _attemptInvestigationMovement(agent) {
        let validTarget = null;
        if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
            validTarget = agent.navigation.findValidNavMeshPosition(agent.investigationTarget, 10);
        }
        if (validTarget) {
            let success = false;
            if (agent.navigation && agent.navigation.moveTo) {
                success = agent.navigation.moveTo(validTarget);
            }
            if (success) {
                this.moveAttempted = true;
                agent.stateChangeManager._logThrottled('investigate_move', 'navDetail', `Investigation movement initiated`);
            } else {
                this.lastMoveAttempt = performance.now();
            }
        } else {
            agent.investigationTarget = null;
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        const investigateAge = performance.now() - this.investigateStartTime;
        const now = performance.now();
        if (agent.targetSystem && agent.targetSystem.hasTarget()) {
            // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
            if (agent.stateChangeManager.changeToState('alert')) {
                return;
            }
        }
        // ✅ NEW: Trigger stutter-step movement (uncertainty behavior)
        if (agent.combatTactics && !agent.combatTactics.stutterActive && Math.random() < 0.08) {
            agent.combatTactics.startStutterStep(now / 1000);
        }
        if (agent.investigationTarget && !this.moveAttempted && now - this.lastMoveAttempt > 3000 && agent.navigationReady) {
            this._attemptInvestigationMovement(agent);
        }
        if (agent.investigationTarget && agent.navigationReady) {
            const distanceToTarget = agent.entity.getPosition().distance(agent.investigationTarget);
            if (distanceToTarget < 3) {
                agent.stateChangeManager._logThrottled('investigation_complete', 'aiDetail', `Investigation complete`);
                agent.investigationTarget = null;
                if (agent.stateChangeManager.changeToState('alert')) {
                    return;
                }
            }
        }
        if (investigateAge > this.maxInvestigateTime || !agent.investigationTarget) {
            agent.investigationTarget = null;
            if (agent.stateChangeManager.changeToState('alert')) {
                return;
            }
        }
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        if (healthRatio < 0.25) {
            const options = healthRatio <= 0.15 ? {
                criticalHealthOverride: true
            } : {
                lowHealthOverride: true
            };
            if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                return;
            }
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        agent.stateChangeManager.eventManager.logStateExit('INVESTIGATE');
    }
    constructor(){
        super();
        this.type = 'investigate'; // ✅ FIX #3: Add type property for state identification
    }
}
// ============================================================================
// FLEE STATE
// ============================================================================
class FleeState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) {
            Logger.error('FleeState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        agent.alertness = 1.0;
        this.fleeStartTime = performance.now();
        this.maxFleeTime = 10000;
        this.moveAttempted = false;
        this.lastMoveAttempt = 0;
        this.safeDistance = 30;
        agent.stateChangeManager.eventManager.logStateEntry('FLEE');
        if (agent.navigationReady) {
            this._attemptFleeMovement(agent);
        }
    }
    _attemptFleeMovement(agent) {
        let fleeTarget = null;
        if (agent.navigation && agent.navigation.findTacticalPosition) {
            fleeTarget = agent.navigation.findTacticalPosition('retreat', agent.targetSystem ? agent.targetSystem.getTargetPosition() : null);
        } else if (agent.navigation && agent.navigation.findValidRandomPosition) {
            fleeTarget = agent.navigation.findValidRandomPosition(20, 40);
        }
        if (fleeTarget) {
            let success = false;
            if (agent.navigation && agent.navigation.moveTo) {
                success = agent.navigation.moveTo(fleeTarget);
            }
            if (success) {
                this.moveAttempted = true;
            } else {
                this.lastMoveAttempt = performance.now();
            }
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        const fleeAge = performance.now() - this.fleeStartTime;
        const now = performance.now();
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        if (agent.targetSystem && agent.targetSystem.hasTarget()) {
            const targetPos = agent.targetSystem.getTargetPosition();
            if (targetPos) {
                const distance = agent.entity.getPosition().distance(targetPos);
                if (distance > this.safeDistance) {
                    agent.stateChangeManager._logThrottled('flee_safe', 'aiState', `Reached safe distance`);
                    if (healthRatio < 0.4) {
                        const options = healthRatio <= 0.15 ? {
                            criticalHealthOverride: true
                        } : {
                            lowHealthOverride: true
                        };
                        if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                            return;
                        }
                    }
                    if (agent.stateChangeManager.changeToState('alert')) {
                        return;
                    }
                }
            }
        }
        if (!this.moveAttempted && now - this.lastMoveAttempt > 3000 && agent.navigationReady) {
            this._attemptFleeMovement(agent);
        }
        if (fleeAge > this.maxFleeTime) {
            if (healthRatio < 0.4) {
                const options = healthRatio <= 0.15 ? {
                    criticalHealthOverride: true
                } : {
                    lowHealthOverride: true
                };
                if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                    return;
                }
            }
            if (agent.stateChangeManager.changeToState('alert')) {
                return;
            }
        }
        if (healthRatio < 0.15) {
            if (agent.stateChangeManager.changeToState('seekHealth', {
                criticalHealthOverride: true
            })) {
                return;
            }
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        agent.stateChangeManager.eventManager.logStateExit('FLEE');
    }
    constructor(){
        super();
        this.type = 'flee'; // ✅ FIX #3: Add type property for state identification
    }
}
// ============================================================================
// SEEK HEALTH STATE
// ============================================================================
class SeekHealthState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) {
            Logger.error('SeekHealthState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        // ✅ FIX: Clear any pending timeout from previous state entry
        if (this.pendingTimeoutId) {
            clearTimeout(this.pendingTimeoutId);
            this.pendingTimeoutId = null;
        }
        this.seekStartTime = performance.now();
        this.maxSeekTime = 20000;
        this.moveAttempted = false;
        this.lastMoveAttempt = 0;
        this.targetHealthItem = null;
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        const frameId = Math.floor(performance.now());
        Logger.aiState(`[${agent.stateChangeManager.agentName}#${agent.stateChangeManager.agentGuid.substring(0, 8)}] frame=${frameId} Entered SEEK HEALTH (${(healthRatio * 100).toFixed(0)}% HP)`);
        if (agent.navigationReady) {
            this._findAndMoveToHealth(agent);
        }
    }
    _findAndMoveToHealth(agent) {
        let healthItem = null;
        if (agent.utilities && agent.utilities.getClosestHealthItem) {
            healthItem = agent.utilities.getClosestHealthItem();
        } else if (agent._getClosestHealthItem) {
            healthItem = agent._getClosestHealthItem();
        }
        if (healthItem && healthItem.isAvailable) {
            this.targetHealthItem = healthItem;
            // Get health item position safely
            let itemPos = null;
            if (healthItem.position) {
                itemPos = healthItem.position;
            } else if (healthItem.entity && healthItem.entity.getPosition) {
                itemPos = healthItem.entity.getPosition();
            } else if (healthItem.getPosition) {
                itemPos = healthItem.getPosition();
            }
            if (!itemPos) {
                Logger.warn(`[${agent.entity.name}] Health item has no valid position`);
                return;
            }
            let validTarget = null;
            if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
                validTarget = agent.navigation.findValidNavMeshPosition(itemPos, 5);
            } else {
                validTarget = itemPos;
            }
            if (validTarget) {
                let success = false;
                if (agent.navigation && agent.navigation.moveTo) {
                    success = agent.navigation.moveTo(validTarget);
                }
                if (success) {
                    this.moveAttempted = true;
                } else {
                    this.lastMoveAttempt = performance.now();
                }
            }
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        const seekAge = performance.now() - this.seekStartTime;
        const now = performance.now();
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        if (healthRatio > 0.8) {
            if (agent.stateChangeManager.changeToState('patrol')) {
                return;
            }
        }
        if (agent.targetSystem && agent.targetSystem.hasTarget() && agent.targetSystem.isTargetVisible()) {
            const distance = agent.entity.getPosition().distance(agent.targetSystem.getTargetPosition());
            if (distance < 15 && healthRatio > 0.2) {
                if (agent.stateChangeManager.changeToState('combat')) {
                    return;
                }
            }
        }
        if (this.targetHealthItem && this.targetHealthItem.isAvailable) {
            // Get health item position safely (same logic as _findAndMoveToHealth)
            let itemPos = null;
            if (this.targetHealthItem.position) {
                itemPos = this.targetHealthItem.position;
            } else if (this.targetHealthItem.entity && this.targetHealthItem.entity.getPosition) {
                itemPos = this.targetHealthItem.entity.getPosition();
            } else if (this.targetHealthItem.getPosition) {
                itemPos = this.targetHealthItem.getPosition();
            }
            if (itemPos) {
                const distance = agent.entity.getPosition().distance(itemPos);
                if (distance < 3) {
                    this.targetHealthItem = null;
                    // ✅ FIX: Clear any existing timeout before setting a new one
                    if (this.pendingTimeoutId) {
                        clearTimeout(this.pendingTimeoutId);
                        this.pendingTimeoutId = null;
                    }
                    this.pendingTimeoutId = setTimeout(()=>{
                        // ✅ FIX: Guard against stale execution or missing state machine
                        if (!vehicle || !vehicle.stateMachine || vehicle.stateMachine.currentState !== this) {
                            return;
                        }
                        const newHealthRatio = agent.health / Math.max(1, agent.maxHealth);
                        if (newHealthRatio > 0.6) {
                            if (agent.stateChangeManager.changeToState('patrol')) {
                                return;
                            }
                        } else {
                            this._findAndMoveToHealth(agent);
                        }
                    }, 500);
                    return;
                }
            }
        }
        if (!this.moveAttempted && now - this.lastMoveAttempt > 3000 && agent.navigationReady) {
            this._findAndMoveToHealth(agent);
        }
        if (seekAge > this.maxSeekTime) {
            if (agent.stateChangeManager.changeToState('alert')) {
                return;
            }
        }
        if (this.targetHealthItem && !this.targetHealthItem.isAvailable) {
            this.targetHealthItem = null;
            this._findAndMoveToHealth(agent);
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        // ✅ FIX: Clean up pending timeout on state exit
        if (this.pendingTimeoutId) {
            clearTimeout(this.pendingTimeoutId);
            this.pendingTimeoutId = null;
        }
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        agent.stateChangeManager.eventManager.logStateExit('SEEK HEALTH', null);
        const frameId = Math.floor(performance.now());
        Logger.aiDetail(`[${agent.stateChangeManager.agentName}#${agent.stateChangeManager.agentGuid.substring(0, 8)}] frame=${frameId} Exited SEEK HEALTH (${(healthRatio * 100).toFixed(0)}% HP)`);
    }
    constructor(){
        super();
        this.type = 'seekHealth'; // ✅ FIX #3: Add type property for state identification
        this.pendingTimeoutId = null; // ✅ FIX: Initialize timeout ID for cleanup
    }
}
// ============================================================================
// SEEK AMMO STATE
// ============================================================================
class SeekAmmoState extends YUKA.State {
    enter(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) {
            Logger.error('SeekAmmoState.enter: vehicle.agent is undefined');
            return;
        }
        if (!agent.stateChangeManager) {
            agent.stateChangeManager = new StateChangeManager(agent);
        }
        // ✅ FIX: Clear any pending timeout from previous state entry
        if (this.pendingTimeoutId) {
            clearTimeout(this.pendingTimeoutId);
            this.pendingTimeoutId = null;
        }
        this.seekStartTime = performance.now();
        this.maxSeekTime = 15000;
        this.moveAttempted = false;
        this.lastMoveAttempt = 0;
        this.targetAmmoItem = null;
        agent.stateChangeManager.eventManager.logStateEntry('SEEK AMMO');
        if (agent.navigationReady) {
            this._findAndMoveToAmmo(agent);
        }
    }
    _findAndMoveToAmmo(agent) {
        let ammoItem = null;
        if (agent.utilities && agent.utilities.getClosestAmmoItem) {
            ammoItem = agent.utilities.getClosestAmmoItem();
        } else if (agent._getClosestAmmoItem) {
            ammoItem = agent._getClosestAmmoItem();
        }
        if (ammoItem && ammoItem.isAvailable) {
            this.targetAmmoItem = ammoItem;
            // Get ammo item position safely
            let itemPos = null;
            if (ammoItem.position) {
                itemPos = ammoItem.position;
            } else if (ammoItem.entity && ammoItem.entity.getPosition) {
                itemPos = ammoItem.entity.getPosition();
            } else if (ammoItem.getPosition) {
                itemPos = ammoItem.getPosition();
            }
            if (!itemPos) {
                Logger.warn(`[${agent.entity.name}] Ammo item has no valid position`);
                return;
            }
            let validTarget = null;
            if (agent.navigation && agent.navigation.findValidNavMeshPosition) {
                validTarget = agent.navigation.findValidNavMeshPosition(itemPos, 5);
            } else {
                validTarget = itemPos;
            }
            if (validTarget) {
                let success = false;
                if (agent.navigation && agent.navigation.moveTo) {
                    success = agent.navigation.moveTo(validTarget);
                }
                if (success) {
                    this.moveAttempted = true;
                } else {
                    this.lastMoveAttempt = performance.now();
                }
            }
        }
    }
    execute(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        const seekAge = performance.now() - this.seekStartTime;
        const now = performance.now();
        // FIX: Use utilities.hasUsableAmmo(), not weaponSystem.hasUsableAmmo()
        const hasAmmo = agent.utilities ? agent.utilities.hasUsableAmmo() : false;
        if (hasAmmo) {
            if (agent.stateChangeManager.changeToState('patrol')) {
                return;
            }
        }
        const healthRatio = agent.health / Math.max(1, agent.maxHealth);
        if (healthRatio < 0.25) {
            const options = healthRatio <= 0.15 ? {
                criticalHealthOverride: true
            } : {
                lowHealthOverride: true
            };
            if (agent.stateChangeManager.changeToState('seekHealth', options)) {
                return;
            }
        }
        if (this.targetAmmoItem && this.targetAmmoItem.isAvailable) {
            // Get ammo item position safely (same logic as _findAndMoveToAmmo)
            let itemPos = null;
            if (this.targetAmmoItem.position) {
                itemPos = this.targetAmmoItem.position;
            } else if (this.targetAmmoItem.entity && this.targetAmmoItem.entity.getPosition) {
                itemPos = this.targetAmmoItem.entity.getPosition();
            } else if (this.targetAmmoItem.getPosition) {
                itemPos = this.targetAmmoItem.getPosition();
            }
            if (itemPos) {
                const distance = agent.entity.getPosition().distance(itemPos);
                if (distance < 3) {
                    this.targetAmmoItem = null;
                    // ✅ FIX: Clear any existing timeout before setting a new one
                    if (this.pendingTimeoutId) {
                        clearTimeout(this.pendingTimeoutId);
                        this.pendingTimeoutId = null;
                    }
                    this.pendingTimeoutId = setTimeout(()=>{
                        // ✅ FIX: Guard against stale execution or missing state machine
                        if (!vehicle || !vehicle.stateMachine || vehicle.stateMachine.currentState !== this) {
                            return;
                        }
                        // FIX: Use utilities.hasUsableAmmo(), not weaponSystem.hasUsableAmmo()
                        const hasAmmoNow = agent.utilities ? agent.utilities.hasUsableAmmo() : false;
                        if (hasAmmoNow) {
                            if (agent.stateChangeManager.changeToState('patrol')) {
                                return;
                            }
                        } else {
                            this._findAndMoveToAmmo(agent);
                        }
                    }, 500);
                    return;
                }
            }
        }
        if (!this.moveAttempted && now - this.lastMoveAttempt > 3000 && agent.navigationReady) {
            this._findAndMoveToAmmo(agent);
        }
        if (seekAge > this.maxSeekTime) {
            if (agent.stateChangeManager.changeToState('alert')) {
                return;
            }
        }
        if (this.targetAmmoItem && !this.targetAmmoItem.isAvailable) {
            this.targetAmmoItem = null;
            this._findAndMoveToAmmo(agent);
        }
    }
    exit(vehicle) {
        const agent = vehicle.agent; // ✅ Get the actual agent script from vehicle
        if (!agent) return;
        // ✅ FIX: Clean up pending timeout on state exit
        if (this.pendingTimeoutId) {
            clearTimeout(this.pendingTimeoutId);
            this.pendingTimeoutId = null;
        }
        agent.stateChangeManager.eventManager.logStateExit('SEEK AMMO');
    }
    constructor(){
        super();
        this.type = 'seekAmmo'; // ✅ FIX #3: Add type property for state identification
        this.pendingTimeoutId = null; // ✅ FIX: Initialize timeout ID for cleanup
    }
}
// ============================================================================
// AI STATES FACTORY
// ============================================================================
const AIStates = {
    PatrolState,
    AlertState,
    CombatState,
    InvestigateState,
    FleeState,
    SeekHealthState,
    SeekAmmoState,
    createAllStates () {
        return {
            patrol: new PatrolState(),
            alert: new AlertState(),
            combat: new CombatState(),
            investigate: new InvestigateState(),
            flee: new FleeState(),
            seekHealth: new SeekHealthState(),
            seekAmmo: new SeekAmmoState()
        };
    }
};
Logger.info('✅ StateCore.mjs loaded - All 7 AI state classes with refactored StateChangeManager integration');

export { AIStates, AlertState, CombatState, FleeState, InvestigateState, PatrolState, SeekAmmoState, SeekHealthState };
