import { Logger } from '../../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class GoalStateAdapter {
    /**
     * Update adapter - checks current goal and adjusts state accordingly
     * Call this every frame from AgentBehavior.update()
     */ update(dt) {
        const now = performance.now();
        // Throttle goal checks to 10 Hz (human reaction time ~100-200ms)
        if (now - this.lastGoalCheckTime < this.goalCheckInterval) {
            return;
        }
        this.lastGoalCheckTime = now;
        // Get current goal from brain
        const brain = this.agent.brain;
        if (!brain) return;
        const currentGoal = brain.currentSubgoal?.();
        if (!currentGoal) {
            // No goal active - use patrol as default
            this._transitionToState('patrol', 'NO_ACTIVE_GOAL');
            return;
        }
        // Get goal name
        const goalName = currentGoal.constructor.name;
        // Check if goal changed - ONLY LOG WHEN IT ACTUALLY CHANGES
        if (goalName !== this.lastGoalName) {
            Logger.goal(`[${this.agent.entity.name}] Goal changed: ${this.lastGoalName || 'NONE'} → ${goalName}`);
            this.lastGoalName = goalName;
        }
        // Map goal to state
        const targetStateName = this._mapGoalToState(goalName, currentGoal);
        // Get current state - use PUBLIC accessor method via agentBehavior
        const stateMachine = this.agent.agentBehavior?.getStateMachine?.();
        if (!stateMachine) {
            Logger.warn(`[${this.agent.entity.name}] No state machine - cannot transition!`);
            return;
        }
        // ✅ FIX #21: Use constructor name and normalize it
        // Remove "State" suffix and convert to lowercase for comparison
        let currentStateName = stateMachine.currentState?.constructor?.name || '';
        // Normalize: "SeekHealthState" → "seekhealth", "PatrolState" → "patrol"
        currentStateName = currentStateName.toLowerCase().replace(/state$/, '');
        // Normalize target name the same way (already lowercase, but ensure consistency)
        const normalizedTarget = targetStateName.toLowerCase().replace(/state$/, '');
        // Only transition if state needs to change
        if (normalizedTarget !== currentStateName) {
            Logger.goal(`[${this.agent.entity.name}] 🔄 STATE TRANSITION: ${currentStateName} → ${targetStateName} (${goalName})`);
            Logger.goal(`[${this.agent.entity.name}]   Reason: Goal changed from ${this.lastGoalName || 'NONE'} to ${goalName}`);
            Logger.goal(`[${this.agent.entity.name}]   Target: ${this.agent.targetSystem?.hasTarget() ? this.agent.targetSystem.getTargetEntity()?.name : 'NONE'}`);
            Logger.goal(`[${this.agent.entity.name}]   Visible: ${this.agent.targetSystem?.isTargetVisible() ? 'YES' : 'NO'}`);
            this._transitionToState(targetStateName, `GOAL_${goalName}`);
        }
    }
    /**
     * Map a goal name to a state name
     * Uses context to make intelligent decisions
     */ _mapGoalToState(goalName, goalInstance) {
        // Check static mapping first
        let stateName = this.goalStateMap[goalName];
        if (stateName) {
            return stateName;
        }
        // Unknown goal - use context to infer state
        Logger.warn(`[${this.agent.entity.name}] Unknown goal: ${goalName}, inferring state from context`);
        // Has target = combat
        if (this.agent.targetSystem?.hasTarget()) {
            return 'combat';
        }
        // Low health = seek health if available, else flee
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        if (healthRatio < 0.4) {
            const healthItem = this.agent._getClosestHealthItem?.();
            return healthItem && healthItem.isAvailable ? 'seekHealth' : 'flee';
        }
        // Default to patrol
        return 'patrol';
    }
    /**
     * Safely transition to a new state
     */ _transitionToState(stateName, reason) {
        const stateChangeManager = this.agent.stateChangeManager;
        if (!stateChangeManager) {
            Logger.warn(`[${this.agent.entity.name}] No stateChangeManager available`);
            return;
        }
        // Check if already in target state - use PUBLIC accessor
        const stateMachine = this.agent.agentBehavior?.getStateMachine?.();
        // ✅ FIX #21: Normalize both names for comparison
        let currentStateName = stateMachine?.currentState?.constructor?.name || '';
        currentStateName = currentStateName.toLowerCase().replace(/state$/, '');
        const normalizedTarget = stateName.toLowerCase().replace(/state$/, '');
        if (currentStateName === normalizedTarget) {
            return; // Already in target state
        }
        // Attempt transition
        const success = stateChangeManager.changeToState(stateName, {
            reason: reason,
            goalDriven: true
        });
        if (success) {
            Logger.debug(`[${this.agent.entity.name}] State transition success: ${currentStateName} → ${stateName} (${reason})`);
            this.lastStateName = stateName;
        } else {
            Logger.debug(`[${this.agent.entity.name}] State transition blocked: ${currentStateName} → ${stateName} (${reason})`);
        }
    }
    /**
     * Get current goal name for debugging
     */ getCurrentGoalName() {
        return this.lastGoalName || 'NONE';
    }
    /**
     * Get target state name for debugging
     */ getTargetStateName() {
        const currentGoal = this.agent.brain?.currentSubgoal?.();
        if (!currentGoal) return 'patrol';
        const goalName = currentGoal.constructor.name;
        return this._mapGoalToState(goalName, currentGoal);
    }
    constructor(agent){
        this.agent = agent;
        this.lastGoalName = null;
        this.lastStateName = null;
        this.goalCheckInterval = 100; // Check every 100ms (10 Hz)
        this.lastGoalCheckTime = 0;
        // Goal-to-State mapping
        // Maps Goal names to State names
        this.goalStateMap = {
            // ✅ Composite Goals (High-level behavior)
            'EnhancedAttackGoal': 'combat',
            'EnhancedGetHealthGoal': 'seekHealth',
            'EnhancedGetAmmoGoal': 'seekAmmo',
            'EnhancedGetWeaponGoal': 'alert',
            'EnhancedExploreGoal': 'patrol',
            'EnhancedFleeGoal': 'flee',
            'EnhancedTakeCoverGoal': 'flee',
            'EnhancedFlankGoal': 'alert',
            // ✅ Strategic Goals (Ultimate objectives)
            'EliminateEnemyGoal': 'alert',
            'SearchForEnemyGoal': 'alert',
            // ✅ Tactical Goals (Combat maneuvers)
            'TakeCoverGoal': 'flee',
            'FlankGoal': 'alert',
            'HuntGoal': 'alert',
            // ✅ Atomic Goals (Low-level movement/actions)
            'DirectApproachGoal': 'alert',
            'EvasiveApproachGoal': 'alert',
            'CautiousApproachGoal': 'alert',
            'SeekCoverGoal': 'flee',
            'TacticalRetreatGoal': 'flee',
            'TacticalManeuverGoal': 'alert',
            'AssaultGoal': 'combat',
            'AdvanceGoal': 'alert',
            'PatrolGoal': 'patrol'
        };
        Logger.info(`[${agent.entity.name}] GoalStateAdapter initialized`);
    }
}

export { GoalStateAdapter, GoalStateAdapter as default };
