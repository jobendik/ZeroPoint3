import { Logger } from '../../../core/engine/logger.mjs';

class AIStateReflector {
    /**
     * Update reflected state based on active YUKA goal
     * Called every frame to keep state name in sync with goal
     */ update() {
        if (!this.agent.brain) return;
        const activeGoal = this.agent.brain.currentSubgoal();
        const newState = this._mapGoalToState(activeGoal);
        if (newState !== this.currentState) {
            this._changeState(newState);
        }
    }
    /**
     * Map YUKA Goal to state name
     * This is the ONLY place that determines state names
     */ _mapGoalToState(goal) {
        if (!goal) return 'idle';
        // Map goal constructor name to state name
        const goalName = goal.constructor.name;
        // Map YUKA goals to friendly state names
        switch(goalName){
            case 'EnhancedAttackGoal':
                return 'combat';
            case 'EnhancedGetHealthGoal':
                return 'seeking_health';
            case 'EnhancedGetAmmoGoal':
                return 'seeking_ammo';
            case 'EnhancedGetWeaponGoal':
                return 'seeking_weapon';
            case 'EnhancedExploreGoal':
                return 'exploring';
            case 'HuntGoal':
                return 'hunting';
            case 'TacticalRetreatGoal':
                return 'retreating';
            case 'SeekCoverGoal':
                return 'seeking_cover';
            case 'AssaultGoal':
                return 'assaulting';
            // Atomic movement goals
            case 'DirectApproachGoal':
            case 'EvasiveApproachGoal':
            case 'CautiousApproachGoal':
                return 'moving';
            default:
                // Unknown goal - use goal name as state
                return goalName.replace('Goal', '').toLowerCase();
        }
    }
    /**
     * Internal state change (reflection update)
     */ _changeState(newState) {
        const now = performance.now();
        const timeInPreviousState = now - this.stateStartTime;
        // Log state change (throttled)
        if (now - this.lastStateChangeLog > this.STATE_CHANGE_LOG_THROTTLE) {
            Logger.aiState(`[${this.agentName}] State: ${this.currentState} → ${newState} ` + `(was in ${this.currentState} for ${(timeInPreviousState / 1000).toFixed(1)}s)`);
            this.lastStateChangeLog = now;
        }
        // Update state history
        this.stateHistory.push({
            state: this.currentState,
            duration: timeInPreviousState,
            timestamp: now
        });
        // Trim history if too long
        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }
        // Update state tracking
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateStartTime = now;
    }
    /**
     * Get current state name
     */ getState() {
        return this.currentState;
    }
    /**
     * Get previous state name
     */ getPreviousState() {
        return this.previousState;
    }
    /**
     * Get time in current state (milliseconds)
     */ getTimeInState() {
        return performance.now() - this.stateStartTime;
    }
    /**
     * Get state history for debugging
     */ getHistory() {
        return [
            ...this.stateHistory
        ];
    }
    /**
     * Check if agent is in a specific state
     */ isInState(stateName) {
        return this.currentState === stateName;
    }
    /**
     * Get state statistics
     */ getStatistics() {
        const stats = new Map();
        for (const entry of this.stateHistory){
            const state = entry.state;
            if (!stats.has(state)) {
                stats.set(state, {
                    count: 0,
                    totalTime: 0
                });
            }
            const data = stats.get(state);
            data.count++;
            data.totalTime += entry.duration;
        }
        // Add current state
        const currentDuration = this.getTimeInState();
        if (!stats.has(this.currentState)) {
            stats.set(this.currentState, {
                count: 0,
                totalTime: 0
            });
        }
        const currentData = stats.get(this.currentState);
        currentData.count++;
        currentData.totalTime += currentDuration;
        return stats;
    }
    /**
     * Reset state to idle
     */ reset() {
        this.currentState = 'idle';
        this.previousState = 'idle';
        this.stateStartTime = performance.now();
        this.stateHistory = [];
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        // Current reflected state
        this.currentState = 'idle';
        this.previousState = 'idle';
        this.stateStartTime = performance.now();
        // State history for debugging
        this.stateHistory = [];
        this.maxHistoryLength = 20;
        // Logging throttle
        this.lastStateChangeLog = 0;
        this.STATE_CHANGE_LOG_THROTTLE = 500; // 500ms between state change logs
        Logger.debug(`[${this.agentName}] State Reflector initialized (reflective mode.)`);
    }
}

export { AIStateReflector };
