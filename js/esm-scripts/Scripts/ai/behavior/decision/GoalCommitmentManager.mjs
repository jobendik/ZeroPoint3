import { Logger } from '../../../core/engine/logger.mjs';

/**
 * Configuration for commitment behavior
 */ const COMMITMENT_CONFIG = {
    // Hysteresis: How much better a new goal must be to override current goal
    HYSTERESIS_MULTIPLIER: 1.35,
    HYSTERESIS_CRITICAL: 1.20,
    // Goal completion tracking
    COMPLETION_BONUS_MAX: 0.25,
    COMPLETION_DECAY_RATE: 0.05,
    // Commitment duration tracking
    MIN_COMMITMENT_TIME: 1000,
    COMMITMENT_SCALING: {
        'attack': 2500,
        'health': 2000,
        'ammo': 1800,
        'weapon': 3000,
        'cover': 1500,
        'explore': 2500,
        'default': 2000 // 2 seconds default
    },
    // Decay over time
    COMMITMENT_DECAY_START: 3000,
    COMMITMENT_DECAY_RATE: 0.08 // Decay 8% per second after start time
};
/**
 * Tracks commitment state for a single agent
 */ class AgentCommitmentState {
    /**
     * Update progress towards current goal
     */ updateProgress(progress) {
        const now = performance.now();
        this.goalProgress = Math.max(0, Math.min(1, progress));
        this.lastProgressUpdate = now;
        // Track progress history for analysis
        this.progressHistory.push({
            time: now,
            progress
        });
        if (this.progressHistory.length > 10) {
            this.progressHistory.shift();
        }
    }
    /**
     * Calculate completion bonus based on progress
     */ getCompletionBonus() {
        if (this.goalProgress <= 0) return 0;
        const now = performance.now();
        const timeSinceUpdate = now - this.lastProgressUpdate;
        // Base bonus from progress
        let bonus = this.goalProgress * COMMITMENT_CONFIG.COMPLETION_BONUS_MAX;
        // Decay bonus if no recent progress
        if (timeSinceUpdate > 2000) {
            const decayTime = (timeSinceUpdate - 2000) / 1000; // seconds
            const decayFactor = Math.pow(0.95, decayTime);
            bonus *= decayFactor;
        }
        return bonus;
    }
    /**
     * Get time-based commitment decay
     */ getCommitmentDecay() {
        const now = performance.now();
        const commitmentAge = now - this.currentGoalStartTime;
        if (commitmentAge < COMMITMENT_CONFIG.COMMITMENT_DECAY_START) {
            return 0; // No decay yet
        }
        const decayTime = (commitmentAge - COMMITMENT_CONFIG.COMMITMENT_DECAY_START) / 1000;
        const decay = COMMITMENT_CONFIG.COMMITMENT_DECAY_RATE * decayTime;
        return Math.min(0.5, decay); // Cap at 50% decay
    }
    constructor(agentId, agentName){
        this.agentId = agentId;
        this.agentName = agentName;
        // Current goal tracking
        this.currentGoalType = null;
        this.currentGoalStartTime = 0;
        this.currentGoalLastScore = 0;
        // Completion tracking
        this.goalProgress = 0; // 0-1 progress towards goal
        this.lastProgressUpdate = 0;
        this.progressHistory = []; // Track progress over time
        // Commitment strength
        this.commitmentBonus = 0; // Current commitment bonus (0-1)
        this.lastCommitmentUpdate = 0;
        // Goal switch history
        this.goalSwitchHistory = [];
        this.lastGoalSwitch = 0;
        this.consecutiveSwitches = 0;
    }
}
/**
 * Global goal commitment manager
 */ class GoalCommitmentManager {
    /**
     * Get or create state for an agent
     */ _getState(agent) {
        const agentId = agent?.entity?.getGuid?.();
        if (!agentId) return null;
        let state = this.agentStates.get(agentId);
        if (!state) {
            const agentName = agent?.entity?.name || 'Unknown';
            state = new AgentCommitmentState(agentId, agentName);
            this.agentStates.set(agentId, state);
        }
        return state;
    }
    /**
     * Check if agent should switch from current goal to new goal
     * Returns: { shouldSwitch: boolean, adjustedScore: number, reason: string }
     */ evaluateGoalSwitch(agent, newGoalType, newGoalScore, currentGoal) {
        const state = this._getState(agent);
        if (!state) {
            return {
                shouldSwitch: true,
                adjustedScore: newGoalScore,
                reason: 'no_state'
            };
        }
        const now = performance.now();
        const currentGoalType = this._getGoalType(currentGoal);
        // No current goal - always allow switch
        if (!currentGoalType || !currentGoal) {
            // ✅ FIX: Only record if actually switching to a new goal
            if (state.currentGoalType !== newGoalType) {
                this._recordGoalSwitch(state, newGoalType, newGoalScore);
            }
            return {
                shouldSwitch: true,
                adjustedScore: newGoalScore,
                reason: 'no_current_goal'
            };
        }
        // Same goal type - no switch needed
        // ✅ FIX: Don't record as a goal switch - it's the same goal!
        if (currentGoalType === newGoalType) {
            // Just update the score for the current goal
            state.currentGoalLastScore = newGoalScore;
            return {
                shouldSwitch: false,
                adjustedScore: newGoalScore,
                reason: 'same_goal'
            };
        }
        // Check minimum commitment time
        const commitmentAge = now - state.currentGoalStartTime;
        const minCommitment = COMMITMENT_CONFIG.COMMITMENT_SCALING[currentGoalType] || COMMITMENT_CONFIG.COMMITMENT_SCALING.default;
        if (commitmentAge < minCommitment) {
            // Still within minimum commitment period
            return {
                shouldSwitch: false,
                adjustedScore: newGoalScore,
                reason: `min_commitment (${(minCommitment - commitmentAge).toFixed(0)}ms remaining)`
            };
        }
        // Calculate adjusted current goal score with bonuses
        const completionBonus = state.getCompletionBonus();
        const commitmentDecay = state.getCommitmentDecay();
        const currentGoalAdjusted = state.currentGoalLastScore + completionBonus - commitmentDecay;
        // Determine hysteresis threshold
        const isCritical = this._isCriticalSituation(agent);
        const hysteresisMultiplier = isCritical ? COMMITMENT_CONFIG.HYSTERESIS_CRITICAL : COMMITMENT_CONFIG.HYSTERESIS_MULTIPLIER;
        // Apply hysteresis - new goal must be significantly better
        const requiredScore = currentGoalAdjusted * hysteresisMultiplier;
        if (newGoalScore >= requiredScore) {
            // New goal is significantly better - record the switch
            this._recordGoalSwitch(state, newGoalType, newGoalScore);
            Logger.goal(`[${state.agentName}] Goal switch: ${currentGoalType}→${newGoalType} ` + `(new: ${newGoalScore.toFixed(2)} vs required: ${requiredScore.toFixed(2)}, ` + `completion: +${completionBonus.toFixed(2)}, decay: -${commitmentDecay.toFixed(2)})`);
            return {
                shouldSwitch: true,
                adjustedScore: newGoalScore,
                reason: `hysteresis_passed (${newGoalScore.toFixed(2)} > ${requiredScore.toFixed(2)})`
            };
        } else {
            // Stick with current goal
            return {
                shouldSwitch: false,
                adjustedScore: currentGoalAdjusted,
                reason: `hysteresis_blocked (${newGoalScore.toFixed(2)} < ${requiredScore.toFixed(2)})`
            };
        }
    }
    /**
     * Calculate commitment bonus for current goal
     * This is added to the current goal's desirability to prevent switching
     */ getCommitmentBonus(agent, goalType, baseScore) {
        const state = this._getState(agent);
        if (!state) return 0;
        const now = performance.now();
        const currentGoalType = state.currentGoalType;
        // Only apply bonus if this is the current committed goal
        if (currentGoalType !== goalType) return 0;
        const commitmentAge = now - state.currentGoalStartTime;
        const minCommitment = COMMITMENT_CONFIG.COMMITMENT_SCALING[goalType] || COMMITMENT_CONFIG.COMMITMENT_SCALING.default;
        // Within commitment period - strong bonus
        if (commitmentAge < minCommitment) {
            const completionBonus = state.getCompletionBonus();
            const remainingCommitment = (minCommitment - commitmentAge) / minCommitment;
            // Bonus decreases as we approach end of commitment period
            return (completionBonus + 0.2) * remainingCommitment;
        }
        // Past commitment period - weaker bonus from completion only
        return state.getCompletionBonus();
    }
    /**
     * Update progress for current goal
     */ updateGoalProgress(agent, progress) {
        const state = this._getState(agent);
        if (state) {
            state.updateProgress(progress);
        }
    }
    /**
     * Notify that current goal has updated its score
     */ updateCurrentGoalScore(agent, score) {
        const state = this._getState(agent);
        if (state) {
            state.currentGoalLastScore = score;
        }
    }
    /**
     * Check if agent is in critical situation (allows easier goal switching)
     */ _isCriticalSituation(agent) {
        // Critical health
        const healthRatio = agent?.health / Math.max(1, agent?.maxHealth || 100);
        if (healthRatio <= 0.25) return true;
        // Under fire
        const lastDamageTime = agent?._lastDamageTime || 0;
        if (performance.now() - lastDamageTime < 2000) return true;
        // No ammo
        const hasAmmo = agent?.weaponSystem && Object.values(agent.weaponSystem.weapons || {}).some((w)=>w && w.unlocked && (w.ammo > 0 || w.magazine > 0));
        if (!hasAmmo) return true;
        return false;
    }
    /**
     * Record a goal switch
     */ _recordGoalSwitch(state, newGoalType, newScore) {
        const now = performance.now();
        // Track switch history
        state.goalSwitchHistory.push({
            time: now,
            from: state.currentGoalType,
            to: newGoalType,
            score: newScore
        });
        if (state.goalSwitchHistory.length > 20) {
            state.goalSwitchHistory.shift();
        }
        // Track consecutive switches (potential thrashing)
        // ✅ FIX: Count switches in a 2-second window more accurately
        const recentSwitches = state.goalSwitchHistory.filter((s)=>now - s.time < 2000);
        const switchCount = recentSwitches.length;
        if (switchCount >= 10) {
            // ✅ FIX: Only warn once per thrashing period
            const lastThrashWarn = state._lastThrashWarn || 0;
            if (now - lastThrashWarn > 5000) {
                state._lastThrashWarn = now;
                Logger.warn(`[${state.agentName}] Goal thrashing detected: ` + `${switchCount} switches in 2 seconds`);
            }
        }
        state.lastGoalSwitch = now;
        state.currentGoalType = newGoalType;
        state.currentGoalStartTime = now;
        state.currentGoalLastScore = newScore;
        state.goalProgress = 0;
        state.lastProgressUpdate = now;
    }
    /**
     * Get goal type from goal instance
     */ _getGoalType(goal) {
        if (!goal) return null;
        const className = goal.constructor?.name || '';
        // Map class names to goal types
        if (className.includes('Attack')) return 'attack';
        if (className.includes('Health')) return 'health';
        if (className.includes('Ammo')) return 'ammo';
        if (className.includes('Weapon')) return 'weapon';
        if (className.includes('Cover') || className.includes('Seek')) return 'cover';
        if (className.includes('Explore')) return 'explore';
        if (className.includes('Hunt')) return 'hunt';
        if (className.includes('Flank')) return 'flank';
        return 'unknown';
    }
    /**
     * Clear state for an agent (when agent is destroyed)
     */ clearAgent(agent) {
        const agentId = agent?.entity?.getGuid?.();
        if (agentId) {
            this.agentStates.delete(agentId);
        }
    }
    /**
     * Periodic cleanup of old states
     */ cleanup() {
        const now = performance.now();
        if (now - this._lastCleanup < 30000) return; // Only cleanup every 30s
        this._lastCleanup = now;
        // Remove states that haven't been updated in 5 minutes
        for (const [agentId, state] of this.agentStates.entries()){
            if (now - state.currentGoalStartTime > 300000) {
                this.agentStates.delete(agentId);
            }
        }
    }
    /**
     * Get diagnostic info for debugging
     */ getDiagnostics(agent) {
        const state = this._getState(agent);
        if (!state) return null;
        const now = performance.now();
        return {
            currentGoal: state.currentGoalType,
            commitmentAge: now - state.currentGoalStartTime,
            progress: state.goalProgress,
            completionBonus: state.getCompletionBonus(),
            commitmentDecay: state.getCommitmentDecay(),
            lastScore: state.currentGoalLastScore,
            consecutiveSwitches: state.consecutiveSwitches,
            recentSwitches: state.goalSwitchHistory.slice(-5)
        };
    }
    constructor(){
        this.agentStates = new Map();
        this._lastCleanup = performance.now();
    }
}
// Global singleton instance
const globalCommitmentManager = new GoalCommitmentManager();

export { GoalCommitmentManager, globalCommitmentManager };
