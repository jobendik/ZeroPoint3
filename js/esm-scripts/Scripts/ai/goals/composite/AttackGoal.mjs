import { Vec3 } from '../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../../core/engine/logger.mjs';
import * as YUKA from 'yuka';
import { HuntGoal } from '../atomic/movement/HuntGoal.mjs';
import { PatrolGoal } from '../atomic/movement/PatrolGoal.mjs';
import { AdvanceGoal } from '../atomic/movement/AdvanceGoal.mjs';
import { AssaultGoal } from '../atomic/combat/AssaultGoal.mjs';
import { TacticalRetreatGoal } from '../atomic/tactical/TacticalRetreatGoal.mjs';
import { DodgeGoal } from '../atomic/tactical/DodgeGoal.mjs';
import { ChargeGoal } from '../atomic/tactical/ChargeGoal.mjs';
import { getCombatPriority, GOAL_PRIORITIES, applyGoalInterruptMixin } from '../GoalInterruptMixin.mjs';

// Shared utility functions
function _safe(fn, fallback = undefined) {
    try {
        return fn();
    } catch  {
        return fallback;
    }
}
function _num(val, fallback = 0) {
    const n = Number(val);
    return !isNaN(n) && isFinite(n) ? n : fallback;
}
class EnhancedAttackGoal extends YUKA.CompositeGoal {
    activate() {
        this.clearSubgoals();
        this.goalStartTime = performance.now();
        this.targetLossTime = 0;
        this.lastValidTargetTime = performance.now();
        this.isHunting = false;
        this.terminationReason = null;
        // ✅ FIX #3: Reset post-kill linger state
        this.postKillLinger = false;
        this.postKillLingerStartTime = 0;
        this.postKillLingerDuration = 0;
        this.postKillPhase = 'none';
        this.postKillPhaseStartTime = 0;
        const agent = this.owner?.agent ?? this.owner;
        try {
            if (Logger.goal && Logger.isEnabled('GOALS')) {
                Logger.goal(agent, `GOAL: AttackGoal activated (YUKA DIVE pattern)`);
            }
        } catch (error) {
            Logger.error(`Logger.goal failed during AttackGoal activation:`, error);
        }
        // 🔥 YUKA DIVE PATTERN: Choose tactic IMMEDIATELY in activate()
        // This is the key difference - don't wait for execute()
        this.chooseTacticYukaDive();
        this.status = YUKA.Goal.STATUS.ACTIVE;
        this.lastTacticTime = performance.now() / 1000;
    }
    execute() {
        const agent = this.owner?.agent ?? this.owner;
        performance.now() / 1000;
        const goalAge = performance.now() - this.goalStartTime;
        if (!agent) {
            Logger.error('[AttackGoal] execute() - agent is undefined');
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // 🔥 YUKA DIVE PATTERN: Goals handle MOVEMENT, combat happens separately in AgentBehavior
        // No need to update combat systems here!
        // Set current activity for state reflection
        agent.currentActivity = 'combat';
        // Check for force termination (critical health, no ammo, target dead)
        if (this.shouldForceTerminate(agent, goalAge)) {
            // ✅ FIX #3: ROBOTIC POST-KILL BEHAVIOR - Start post-kill linger instead of instant termination
            if (this.terminationReason === 'target_dead' && !this.postKillLinger) {
                this.startPostKillBehavior(agent);
            // Don't terminate yet - execute linger behavior
            } else {
                // Other termination reasons (health/ammo) - terminate immediately
                try {
                    if (Logger.goal && Logger.isEnabled('GOALS')) {
                        Logger.goal(agent, `AttackGoal force terminated: ${this.terminationReason || 'unknown reason'}`);
                    }
                } catch (error) {
                    Logger.error(`Logger.goal termination failed:`, error);
                }
                this.status = YUKA.Goal.STATUS.COMPLETED;
                return;
            }
        }
        // ✅ FIX #3: Execute post-kill linger behavior
        if (this.postKillLinger) {
            const dt = agent.app?.dt || 0.016;
            this.executePostKillActions(agent, dt);
            return; // Skip normal combat logic during linger
        }
        // ✅ CRITICAL FIX: Check target visibility BEFORE subgoal execution
        // The hasSubgoals() block returns early, so we must check here first!
        const hasTarget = !!(agent.targetSystem && agent.targetSystem.hasTarget && agent.targetSystem.hasTarget());
        const isTargetVisible = hasTarget && agent.targetSystem.isTargetVisible && agent.targetSystem.isTargetVisible();
        // ✅ DEBUG: Log target state every 60 frames when has target
        if (hasTarget && goalAge % 1000 < 16) {
            Logger.combat(`[${agent.entity.name}] 🎯 Target state: visible=${isTargetVisible}, lastValidTime=${((performance.now() - this.lastValidTargetTime) / 1000).toFixed(1)}s ago`);
        }
        // ✅ FIX: Simplified target loss logic - trust TargetingSystem grace period
        if (hasTarget) {
            if (isTargetVisible) {
                // Reset hunting state
                this.isHunting = false;
                this.lastValidTargetTime = performance.now();
                // Update last known position
                const targetPos = agent.targetSystem.getTargetPosition();
                if (targetPos) {
                    this.lastTargetPosition = targetPos.clone ? targetPos.clone() : targetPos;
                }
            } else {
                // Not visible but still has target (in grace period)
                // Consider hunting if we have a last position
                const timeSinceVisible = performance.now() - this.lastValidTargetTime;
                // ✅ FIX: Extend grace period to 10 seconds (player might be behind cover)
                // Don't give up so easily - keep hunting!
                if (timeSinceVisible > 10000) {
                    Logger.goal(`[${agent.entity.name}] 🔄 Target not visible for ${(timeSinceVisible / 1000).toFixed(1)}s - clearing target`, agent);
                    // Clear the target to allow exploration/patrol goals to activate
                    if (agent.targetSystem && typeof agent.targetSystem._clearTarget === 'function') {
                        agent.targetSystem._clearTarget();
                    } else if (agent.targetSystem) {
                        agent.targetSystem.currentTarget = null;
                        agent.targetSystem.currentTargetEntity = null;
                    }
                    // Terminate this goal immediately
                    this.status = YUKA.Goal.STATUS.COMPLETED;
                    return;
                }
                // Otherwise start hunting if we have a last position
                if (timeSinceVisible > 1000 && this.lastTargetPosition && !this.isHunting) {
                    Logger.tactic(`[${agent.entity.name}] Target not visible for ${(timeSinceVisible / 1000).toFixed(1)}s, hunting`);
                    this.isHunting = true;
                }
            }
        } else {
            // ✅ FIX: hasTarget=false means grace period expired, terminate quickly
            if (goalAge > this.minGoalDuration) {
                Logger.goal(`AttackGoal terminated: no target (grace period expired)`, agent);
                this.status = YUKA.Goal.STATUS.COMPLETED;
                return;
            }
        }
        // Check maximum duration
        if (goalAge > this.maxGoalDuration) {
            Logger.goal(`AttackGoal terminated: max duration (${(goalAge / 1000).toFixed(1)}s)`, agent);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        // 🔥 YUKA DIVE PATTERN: Execute subgoals and replan based on their status
        if (this.hasSubgoals()) {
            const currentSubgoal = this.currentSubgoal();
            const subgoalStatus = this.executeSubgoals();
            // YUKA DIVE PATTERN: Special handling for DodgeGoal (repeating behavior)
            if (currentSubgoal instanceof DodgeGoal && currentSubgoal.inactive()) {
                // DodgeGoal went INACTIVE - reactivate with same tactic choice logic
                Logger.tactic(`[${agent.entity.name}] 🔄 DodgeGoal inactive, rechoosing tactic`);
                this.status = YUKA.Goal.STATUS.ACTIVE;
                this.clearSubgoals();
                this.chooseTacticYukaDive();
                return;
            }
            // Handle completion/failure
            if (subgoalStatus === YUKA.Goal.STATUS.COMPLETED || subgoalStatus === YUKA.Goal.STATUS.FAILED) {
                Logger.tactic(`[${agent.entity.name}] Subgoal ${subgoalStatus === YUKA.Goal.STATUS.COMPLETED ? 'completed' : 'failed'}, choosing new tactic`);
                this.clearSubgoals();
                this.chooseTacticYukaDive();
                return;
            }
            // Subgoal still running
            return;
        }
        // No subgoals - choose one
        this.chooseTacticYukaDive();
    }
    shouldForceTerminate(agent, goalAge) {
        if (!agent) {
            Logger.error('[AttackGoal] shouldForceTerminate() - agent is undefined');
            return false;
        }
        const minAbsoluteTime = 1000;
        if (goalAge < minAbsoluteTime) {
            return false;
        }
        const maxHealth = _num(agent.maxHealth, 100);
        const currentHealth = _num(agent.health, 0);
        const healthRatio = maxHealth > 0 ? currentHealth / maxHealth : 1;
        const isActivelySeekingHealth = agent.isActivelySeekingHealth ?? false;
        // Critical health
        if (healthRatio < 0.15 && !isActivelySeekingHealth) {
            this.terminationReason = 'critical_health';
            Logger.goal(`[AttackGoal] Force terminate - CRITICAL HEALTH (${(healthRatio * 100).toFixed(0)}%)`, agent);
            return true;
        }
        // Check ammo
        if (goalAge > 2000) {
            const hasUsableAmmo = _safe(()=>typeof agent.hasUsableAmmo === 'function' ? agent.hasUsableAmmo() : false, false);
            if (!hasUsableAmmo) {
                const ws = agent.weaponSystem ?? null;
                const currentName = ws?.currentWeapon ?? null;
                const currentWeapon = currentName ? ws?.weapons?.[currentName] ?? null : null;
                // ✅ FIX: Check BOTH magazine AND reserve ammo (same logic as hasUsableAmmo)
                const magazineAmmo = _num(ws?.currentMagazine, 0);
                const reserveAmmo = _num(currentWeapon?.ammo, 0);
                const totalAmmo = magazineAmmo + reserveAmmo;
                if (totalAmmo <= 0) {
                    this.terminationReason = 'no_ammo';
                    Logger.goal(`[AttackGoal] Force terminate - NO AMMO (mag=${magazineAmmo}, reserve=${reserveAmmo}, total=${totalAmmo})`, agent);
                    return true;
                }
            }
        }
        // Check target status
        const targetEntity = _safe(()=>agent.targetSystem?.getTargetEntity?.(), null);
        const targetHS = targetEntity?.script?.healthSystem ?? null;
        if (targetHS) {
            const targetIsDead = targetHS.isDead === true;
            const targetHealthDepleted = _num(targetHS.currentHealth, 1) <= 0;
            const targetBeingDestroyed = targetHS.isBeingDestroyed === true;
            const targetRespawning = targetHS.isRespawning === true;
            if (targetIsDead || targetHealthDepleted || targetBeingDestroyed || targetRespawning) {
                this.terminationReason = 'target_dead';
                Logger.goal(`[AttackGoal] Force terminate - TARGET ELIMINATED`, agent);
                return true;
            }
        }
        return false;
    }
    /**
     * ✅ FIX #3: ROBOTIC POST-KILL BEHAVIOR - Start post-kill linger sequence
     * Humans don't instantly return to patrol after a kill. They:
     * 1. Stop firing (don't waste ammo)
     * 2. Scan area for threats (1-2 seconds)
     * 3. Reload if needed
     * 4. Reposition slightly
     * 5. THEN resume patrol
     */ startPostKillBehavior(agent) {
        this.postKillLinger = true;
        this.postKillLingerStartTime = performance.now();
        // Calculate linger duration based on personality (2-4 seconds)
        const personalityCaution = agent.personalitySystem?.personality?.caution || 0.5;
        this.postKillLingerDuration = 2000 + personalityCaution * 2000; // 2-4 seconds
        // Start with scan phase
        this.postKillPhase = 'scan';
        this.postKillPhaseStartTime = performance.now();
        // Stop firing immediately (combat system will handle this naturally)
        // The combat system checks for target validity, so no explicit stopFiring needed
        Logger.aiState(`[${agent.entity.name}] ✅ Starting post-kill linger (${(this.postKillLingerDuration / 1000).toFixed(1)}s) - scan → reload → reposition`);
    }
    /**
     * ✅ FIX #3: ROBOTIC POST-KILL BEHAVIOR - Execute post-kill action sequence
     */ executePostKillActions(agent, dt) {
        const now = performance.now();
        const lingerElapsed = now - this.postKillLingerStartTime;
        const phaseElapsed = now - this.postKillPhaseStartTime;
        // Check if linger complete
        if (lingerElapsed >= this.postKillLingerDuration) {
            Logger.aiState(`[${agent.entity.name}] ✅ Post-kill linger complete - resuming normal behavior`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        // Execute phase-specific behavior
        switch(this.postKillPhase){
            case 'scan':
                // Phase 1: Scan area for threats (1-2 seconds)
                if (phaseElapsed < 1500) {
                    // Look around slowly - simulate checking for threats
                    // Use 'alert' state (which means scanning for threats)
                    agent.currentActivity = 'alert';
                } else {
                    // Move to reload phase
                    this.postKillPhase = 'reload';
                    this.postKillPhaseStartTime = now;
                    Logger.aiDetail(`[${agent.entity.name}] Post-kill: scan → reload`);
                }
                break;
            case 'reload':
                // Phase 2: Reload if needed (or brief pause)
                const needsReload = agent.weaponSystem?.currentMagazine < agent.weaponSystem?.magazineSizes?.[agent.weaponSystem?.currentWeapon] * 0.5;
                if (needsReload && agent.weaponSystem?.reload) {
                    agent.weaponSystem.reload();
                }
                // Brief pause (500ms minimum)
                if (phaseElapsed > 500) {
                    this.postKillPhase = 'reposition';
                    this.postKillPhaseStartTime = now;
                    Logger.aiDetail(`[${agent.entity.name}] Post-kill: reload → reposition`);
                }
                break;
            case 'reposition':
                // Phase 3: Small tactical reposition
                // Let the agent move slightly (the navigation system handles this)
                agent.currentActivity = 'repositioning';
                // This phase completes when overall linger time is up
                if (lingerElapsed >= this.postKillLingerDuration * 0.9) {
                    this.postKillPhase = 'complete';
                    Logger.aiDetail(`[${agent.entity.name}] Post-kill: reposition → complete`);
                }
                break;
            case 'complete':
                // Phase 4: Ready to resume normal behavior
                this.status = YUKA.Goal.STATUS.COMPLETED;
                break;
        }
    }
    /**
     * 🔥 YUKA DIVE PATTERN: Choose tactics like official DIVE example
     * This creates FPS-like behavior with strafing!
     */ chooseTacticYukaDive() {
        const agent = this.owner?.agent ?? this.owner;
        if (!agent || !agent.entity) {
            Logger.error('[AttackGoal] chooseTacticYukaDive() - no agent');
            return;
        }
        const isTargetShootable = agent?.targetSystem?.isTargetVisible?.() || false;
        // YUKA DIVE PATTERN: If target visible, pick combat tactic
        if (isTargetShootable) {
            const entity = agent.entity;
            const forward = entity.forward.clone();
            const right = new Vec3();
            right.cross(Vec3.UP, forward).normalize();
            const left = right.clone().mulScalar(-1);
            // Check if we can strafe left
            const dodgeGoalLeft = new DodgeGoal(this.owner, false, agent);
            if (dodgeGoalLeft.canMoveInDirection(left)) {
                Logger.tactic(`[${entity.name}] 🎯 YUKA DIVE: Strafe LEFT available`);
                this.addSubgoal(dodgeGoalLeft);
                return;
            }
            // Check if we can strafe right
            const dodgeGoalRight = new DodgeGoal(this.owner, true, agent);
            if (dodgeGoalRight.canMoveInDirection(right)) {
                Logger.tactic(`[${entity.name}] 🎯 YUKA DIVE: Strafe RIGHT available`);
                this.addSubgoal(dodgeGoalRight);
                return;
            }
            // Can't strafe - CHARGE!
            Logger.tactic(`[${entity.name}] 🎯 YUKA DIVE: No strafe space, CHARGING`);
            this.addSubgoal(new ChargeGoal(this.owner, agent));
        } else {
            // Target not visible - HUNT!
            const lastPos = agent?.targetSystem?.getTargetPosition?.() || agent?.visionSystem?.getBestInvestigationTarget?.()?.position;
            if (lastPos) {
                Logger.tactic(`[${agent.entity.name}] 🎯 YUKA DIVE: Target not visible, HUNTING`);
                this.addSubgoal(new HuntGoal(this.owner, lastPos, agent));
            } else {
                Logger.tactic(`[${agent.entity.name}] 🎯 YUKA DIVE: No last position, completing`);
                this.status = YUKA.Goal.STATUS.COMPLETED;
            }
        }
    }
    getTacticCommitmentTime() {
        const agent = this.owner?.agent ?? this.owner;
        const currentHealth = _num(agent?.health, 100);
        const maxHealth = _num(agent?.maxHealth, 100);
        const healthRatio = maxHealth > 0 ? currentHealth / maxHealth : 1;
        if (this.isHunting) {
            return 4.0;
        }
        if (healthRatio < 0.3) {
            return 1.0;
        } else if (this.commitmentLevel === 'high') {
            return 3.0;
        } else {
            return 2.0;
        }
    }
    chooseTactic() {
        const agent = this.owner?.agent ?? this.owner;
        if (!agent) {
            Logger.error('[AttackGoal] chooseTactic() - agent is undefined');
            return;
        }
        const hasTarget = !!(agent.targetSystem && agent.targetSystem.hasTarget && agent.targetSystem.hasTarget());
        const targetPos = hasTarget && agent.targetSystem.getTargetPosition ? agent.targetSystem.getTargetPosition() : null;
        const isTargetVisible = !!(hasTarget && agent.targetSystem.isTargetVisible && agent.targetSystem.isTargetVisible());
        const currentHealth = _num(agent.health, 100);
        const maxHealth = _num(agent.maxHealth, 100);
        const healthRatio = maxHealth > 0 ? currentHealth / maxHealth : 1;
        const hasAmmo = _safe(()=>typeof agent.hasUsableAmmo === 'function' ? agent.hasUsableAmmo() : true, true);
        // ✅ FIX: Hunt if not visible but we still have target (grace period active)
        if (!isTargetVisible && hasTarget && this.lastTargetPosition) {
            if (!this.isHunting) {
                Logger.tactic(`[${agent.entity.name}] TACTIC: Target not visible, hunting last known position`);
                this.isHunting = true;
            }
            this.addSubgoal(new HuntGoal(this.owner, this.lastTargetPosition, agent));
            return;
        }
        // No valid target position
        if (!targetPos) {
            Logger.tactic(`[${agent.entity.name}] TACTIC: No target position, patrolling`);
            const patrolPos = _safe(()=>typeof agent.navigation?.findValidRandomPosition === 'function' ? agent.navigation.findValidRandomPosition() : null, null);
            if (patrolPos) {
                const yukaPos = new YUKA.Vector3(patrolPos.x, patrolPos.y, patrolPos.z);
                this.addSubgoal(new PatrolGoal(this.owner, yukaPos, agent));
            }
            return;
        }
        // Target IS visible - reset hunting and engage
        this.isHunting = false;
        const agentPos = agent.yukaVehicle?.position ?? new YUKA.Vector3(0, 0, 0);
        const targetPosYuka = targetPos instanceof YUKA.Vector3 ? targetPos : new YUKA.Vector3(targetPos.x, targetPos.y, targetPos.z);
        const distance = agentPos.distanceTo(targetPosYuka);
        // Ammo check - note: GetAmmoGoal needs to be imported separately if used
        if (!hasAmmo) {
            Logger.tactic(`[${agent.entity.name}] TACTIC: No ammo, seeking ammunition`);
            // GetAmmoGoal would be added here if imported
            return;
        }
        // Retreat only if VERY low health AND close
        if (healthRatio < 0.25 && distance < 6) {
            Logger.tactic(`[${agent.entity.name}] TACTIC: Critical health at close range, tactical retreat`);
            this.addSubgoal(new TacticalRetreatGoal(this.owner, targetPos, agent));
            return;
        }
        // Combat tactics based on distance
        if (distance > 30) {
            Logger.tactic(`[${agent.entity.name}] TACTIC: Target far (${distance.toFixed(1)}m), advancing`);
            this.addSubgoal(new AdvanceGoal(this.owner, targetPos, agent));
        } else if (distance < 8 && healthRatio > 0.5) {
            Logger.tactic(`[${agent.entity.name}] TACTIC: Close range (${distance.toFixed(1)}m), aggressive assault`);
            this.addSubgoal(new AssaultGoal(this.owner, targetPos, agent));
        } else {
            Logger.tactic(`[${agent.entity.name}] TACTIC: Optimal range (${distance.toFixed(1)}m), direct assault`);
            this.addSubgoal(new AssaultGoal(this.owner, targetPos, agent));
        }
    }
    terminate() {
        const goalDuration = (performance.now() - this.goalStartTime) / 1000;
        const agent = this.owner?.agent ?? this.owner;
        const agentName = agent?.entity?.name ?? 'Unknown';
        this.clearSubgoals();
        try {
            Logger.goal(`GOAL: AttackGoal terminated after ${goalDuration.toFixed(1)}s (reason: ${this.terminationReason || 'normal'})`, agent);
        } catch (error) {
            Logger.debug(`[AttackGoal] ${agentName} terminated after ${goalDuration.toFixed(1)}s`);
        }
    }
    canBePreempted() {
        const goalAge = performance.now() - this.goalStartTime;
        // Never during minimum commitment (first 1 second)
        if (goalAge < 1000) {
            return false;
        }
        // ✅ CRITICAL FIX: Allow preemption at low health (not just critical)
        const agent = this.owner?.agent ?? this.owner;
        const currentHealth = _num(agent?.health, 100);
        const maxHealth = _num(agent?.maxHealth, 100);
        const healthRatio = maxHealth > 0 ? currentHealth / maxHealth : 1;
        // At 40% health or below, allow preemption for defensive actions
        if (healthRatio <= 0.40) {
            return true;
        }
        return false;
    }
    // ✅ NEW: Dynamic priority adjustment based on combat situation
    getPriority() {
        const agent = this.owner?.agent ?? this.owner;
        if (!agent) return this.priority;
        const healthRatio = _num(agent?.health, 100) / Math.max(1, _num(agent?.maxHealth, 100));
        const hasTarget = !!(agent.targetSystem && agent.targetSystem.hasTarget && agent.targetSystem.hasTarget());
        const isTargetVisible = hasTarget && agent.targetSystem.isTargetVisible && agent.targetSystem.isTargetVisible();
        const hasAmmo = _safe(()=>typeof agent.hasUsableAmmo === 'function' ? agent.hasUsableAmmo() : true, true);
        // Use helper to calculate dynamic combat priority
        return getCombatPriority(isTargetVisible, healthRatio, hasAmmo);
    }
    // ✅ NEW: Allow interrupt when health becomes critical during combat
    canInterrupt() {
        const agent = this.owner?.agent ?? this.owner;
        if (!agent) return true;
        const goalAge = performance.now() - this.goalStartTime;
        const healthRatio = _num(agent?.health, 100) / Math.max(1, _num(agent?.maxHealth, 100));
        // Never interrupt during first second (commitment period)
        if (goalAge < 1000) {
            return false;
        }
        // Always allow interrupt at critical health (survival takes priority)
        if (healthRatio <= 0.15) {
            Logger.goal(`[${agent.entity?.name}] Attack goal allows interrupt - CRITICAL HEALTH (${(healthRatio * 100).toFixed(0)}%)`);
            return true;
        }
        // Default: use base mixin logic
        return true;
    }
    constructor(owner){
        super(owner);
        this.lastTacticTime = 0;
        this.tacticDuration = 2;
        this.lastTargetPosition = null;
        // Aggressive goal commitment
        this.goalStartTime = 0;
        this.minGoalDuration = 1500; // 1.5 seconds minimum
        this.maxGoalDuration = 30000; // 30 seconds maximum (increased!)
        this.forceTerminationReasons = new Set([
            'critical_health',
            'no_ammo',
            'target_dead'
        ]);
        this.commitmentLevel = 'normal';
        // ✅ FIX: Rely on TargetingSystem's grace period (no local tracking needed)
        this.targetLossTime = 0;
        this.lastValidTargetTime = 0;
        this.isHunting = false;
        // Termination reason tracking
        this.terminationReason = null;
        // ✅ FIX #3: ROBOTIC POST-KILL BEHAVIOR - Post-kill linger system
        this.postKillLinger = false;
        this.postKillLingerStartTime = 0;
        this.postKillLingerDuration = 0;
        this.postKillPhase = 'none'; // 'scan', 'reload', 'reposition', 'complete'
        this.postKillPhaseStartTime = 0;
        // ✅ NEW: Goal interrupt system
        this.priority = GOAL_PRIORITIES.COMBAT_OFFENSIVE; // Base priority
        this.interruptible = true; // Can be interrupted by higher priority goals
        this.minPriorityGap = 15; // Requires significant priority difference to interrupt
        applyGoalInterruptMixin(this);
    }
}

export { EnhancedAttackGoal };
