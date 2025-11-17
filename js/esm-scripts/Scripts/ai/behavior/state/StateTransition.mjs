import { Logger } from '../../../core/engine/logger.mjs';
import { StateEventManager } from './StateEvents.mjs';
import { StateUtilitySystem } from './StateUtilitySystem.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Controls debouncing and timing for state transitions
 */ class DebounceController {
    /**
     * Check if state change is blocked by debouncing
     */ checkDebounce(targetState, currentFrame) {
        const now = performance.now();
        // Same-frame protection
        if (this._lastStateChangeFrame === currentFrame) {
            return {
                blocked: true,
                reason: 'same_frame',
                message: 'already changed this frame'
            };
        }
        // 100ms debounce for same state
        if (this._lastAcceptedState === targetState) {
            const timeSinceLastChange = now - this._lastStateChangeAtMs;
            if (timeSinceLastChange < this.STATE_CHANGE_DEBOUNCE) {
                return {
                    blocked: true,
                    reason: 'debounce',
                    message: `debounced (${timeSinceLastChange.toFixed(0)}ms < ${this.STATE_CHANGE_DEBOUNCE}ms)`
                };
            }
        }
        return {
            blocked: false
        };
    }
    /**
     * Check minimum dwell time
     */ checkMinimumDwell(currentState, targetState, stateAge, options = {}) {
        if (currentState && currentState !== targetState && stateAge < this.MINIMUM_DWELL_MS) {
            if (!this.canExitStateEarly(currentState, targetState, stateAge, options)) {
                return {
                    blocked: true,
                    reason: 'dwell',
                    message: `minimum dwell (${stateAge}ms < ${this.MINIMUM_DWELL_MS}ms)`
                };
            }
        }
        return {
            blocked: false
        };
    }
    /**
     * Check if state can exit early based on special conditions
     */ canExitStateEarly(currentState, targetState, stateAge, options) {
        // Death always allowed
        if (targetState === 'death') return true;
        // ✅ FIX: Goal-driven transitions should override dwell time
        // When the brain picks a new goal, we MUST allow state transitions
        if (options.goalDriven) {
            return true; // Allow immediate transition for goal changes
        }
        // Critical/low health overrides
        if (options.criticalHealthOverride) return true;
        if (options.lowHealthOverride && stateAge >= this.LOW_HEALTH_OVERRIDE_DELAY) return true;
        // Combat specific health overrides
        if (currentState === 'combat' && options.healthRatio !== undefined) {
            if (options.healthRatio <= this.CRITICAL_HEALTH_THRESHOLD) return true;
            if (options.healthRatio <= this.LOW_HEALTH_THRESHOLD && stateAge >= this.LOW_HEALTH_OVERRIDE_DELAY) return true;
        }
        // Seek states can exit early for combat/death
        if ((currentState === 'seekHealth' || currentState === 'seekAmmo') && (targetState === 'combat' || targetState === 'death')) {
            return stateAge >= 500;
        }
        return false;
    }
    /**
     * Record successful state change
     */ recordChange(targetState, currentFrame) {
        const now = performance.now();
        this._lastStateChangeFrame = currentFrame;
        this._lastStateChangeAtMs = now;
        this._lastAcceptedState = targetState;
    }
    constructor(){
        this.STATE_CHANGE_DEBOUNCE = 100; // 100ms debounce between same-state requests
        this.MINIMUM_DWELL_MS = 1500; // ≥1500ms as per requirements
        // Central state change gate variables
        this._lastStateChangeFrame = -1;
        this._lastStateChangeAtMs = 0;
        this._lastAcceptedState = null;
        // Health-based override thresholds
        this.CRITICAL_HEALTH_THRESHOLD = 0.15; // 15% health allows immediate override
        this.LOW_HEALTH_THRESHOLD = 0.30; // 30% health allows override after delay
        this.CRITICAL_OVERRIDE_DELAY = 0; // Immediate for critical
        this.LOW_HEALTH_OVERRIDE_DELAY = 800; // 800ms delay for low health
    }
}
/**
 * Validates state transition rules and exceptions
 */ class TransitionValidator {
    /**
     * Check for exception conditions that override normal transition rules
     */ checkExceptions(targetState, options = {}) {
        // Exception 1: Death state always allowed immediately
        if (targetState === 'death' || this.agent.isDead || this.agent.health <= 0) {
            return {
                allowed: true,
                reason: 'death'
            };
        }
        // Exception 2: Hard reset (system-level override)
        if (options.hardReset) {
            return {
                allowed: true,
                reason: 'hard_reset'
            };
        }
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        // Exception 3: Critical health override (≤15% HP)
        if (options.criticalHealthOverride && healthRatio <= 0.15) {
            return {
                allowed: true,
                reason: 'critical_health',
                healthRatio
            };
        }
        // Exception 4: Low health override (≤30% HP after delay)
        if (options.lowHealthOverride && healthRatio <= 0.30) {
            const currentState = this.agent.stateMachine?.currentState?.type;
            if (currentState) {
                const stateAge = this.getStateAge(currentState);
                if (stateAge >= 800) {
                    return {
                        allowed: true,
                        reason: 'low_health',
                        healthRatio,
                        stateAge
                    };
                }
            }
        }
        return {
            allowed: false
        };
    }
    /**
     * Get current state age
     */ getStateAge(stateName) {
        // This will be injected by StateChangeManager
        return this._getStateAge ? this._getStateAge(stateName) : 999999;
    }
    constructor(agent){
        this.agent = agent;
    }
}
/**
 * Enhanced AI State Change Manager with Comprehensive Debouncing
 */ class StateChangeManager {
    /**
     * Get the most desirable state using utility-based evaluation
     * This replaces complex nested if/else logic with score-based selection
     * @param {Object} options - Optional constraints
     * @returns {Object} { state: string, score: number, scores: Object }
     */ getBestStateByUtility(options = {}) {
        const result = this.utilitySystem.getBestState(options);
        // Log scores for debugging (throttled)
        if (options.debug) {
            this.utilitySystem.logScores(result.scores);
        }
        return result;
    }
    /**
     * Attempt to transition to the most desirable state
     * Uses utility-based evaluation instead of hardcoded rules
     * @param {Object} options - Optional constraints and logging
     * @returns {boolean} True if state changed
     */ evaluateAndTransition(options = {}) {
        const bestResult = this.getBestStateByUtility(options);
        // If system recommends staying in current state, do nothing
        if (bestResult.reason === 'insufficient_difference') {
            this._logThrottled('utility_no_change', 'debug', `Staying in ${bestResult.state} (score: ${bestResult.score.toFixed(2)}, diff: ${bestResult.difference.toFixed(2)})`);
            return false;
        }
        const currentState = this.agent.stateMachine?.currentState?.type;
        // Attempt state change
        if (bestResult.state !== currentState) {
            const changed = this.changeToState(bestResult.state, {
                ...options,
                utilityDriven: true,
                utilityScore: bestResult.score
            });
            if (changed) {
                Logger.aiState(`[${this.agentName}] Utility-driven transition: ${currentState} → ${bestResult.state} ` + `(score: ${bestResult.score.toFixed(2)})`);
                // Log runner-up for context
                if (bestResult.runner_up) {
                    Logger.debug(`[${this.agentName}] Runner-up: ${bestResult.runner_up.state} ` + `(score: ${bestResult.runner_up.score.toFixed(2)})`);
                }
            }
            return changed;
        }
        return false;
    }
    /**
     * Central state change gate with comprehensive debouncing
     */ canChangeToState(targetState, options = {}) {
        const currentFrame = this.eventManager.frameTracker.getCurrentFrame();
        // Check for exception conditions first
        const exceptionCheck = this.transitionValidator.checkExceptions(targetState, options);
        if (exceptionCheck.allowed) {
            this.eventManager.logThrottled(`${exceptionCheck.reason}_override`, 'aiState', `${exceptionCheck.reason.toUpperCase()} override allowing state change to ${targetState}${exceptionCheck.healthRatio ? ` (${(exceptionCheck.healthRatio * 100).toFixed(0)}% HP)` : ''}`);
            return true;
        }
        // Core Gate 1: Check debouncing and frame protection  
        const debounceCheck = this.debounceController.checkDebounce(targetState, currentFrame);
        if (debounceCheck.blocked) {
            this.eventManager.logThrottled(`${debounceCheck.reason}_block`, 'debug', `State change to ${targetState} blocked - ${debounceCheck.message}`);
            return false;
        }
        // Core Gate 2: Check minimum dwell time
        const currentState = this.agent.stateMachine?.currentState?.type;
        if (currentState) {
            const stateAge = this.eventManager.getStateAge(currentState);
            const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
            const dwellCheck = this.debounceController.checkMinimumDwell(currentState, targetState, stateAge, {
                ...options,
                healthRatio
            });
            if (dwellCheck.blocked) {
                this.eventManager.logThrottled(`dwell_${currentState}`, 'debug', `State change to ${targetState} blocked by ${dwellCheck.message}`);
                return false;
            }
        }
        // Core Gate 3: Ping-pong prevention
        if (this.eventManager.isPingPongTransition(currentState, targetState)) {
            Logger.warn(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${currentFrame} BLOCKED ping-pong transition ${currentState} ↔ ${targetState}`);
            return false;
        }
        return true;
    }
    /**
     * Execute state change after validation
     */ changeToState(targetState, options = {}) {
        if (!this.agent.stateMachine) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Cannot change state - no state machine`);
            return false;
        }
        if (!this.canChangeToState(targetState, options)) {
            return false;
        }
        try {
            // Record the change in all tracking systems
            const currentFrame = this.eventManager.frameTracker.getCurrentFrame();
            this.eventManager.recordStateChange(targetState, options);
            this.debounceController.recordChange(targetState, currentFrame);
            // Update death state tracking
            this.eventManager.updateDeathState(targetState === 'death' || this.agent.isDead);
            // Execute the actual state change
            this.agent.stateMachine.changeTo(targetState);
            return true;
        } catch (error) {
            Logger.error(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] Error changing to state ${targetState}:`, error);
            return false;
        }
    }
    /**
     * Force state change with override options
     */ forceStateChange(targetState, reason = 'forced') {
        Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] FORCED state change to ${targetState} (${reason})`);
        return this.changeToState(targetState, {
            hardReset: true,
            allowSameFrame: true,
            reason: reason
        });
    }
    /**
     * Get comprehensive state information
     */ getStateInfo() {
        return this.eventManager.getStateInfo();
    }
    /**
     * ✅ TWO BRAINS FIX: Reflect goal's currentActivity to state machine
     * This creates a unidirectional flow: Goal decides → State reflects
     * No more conflicts or latency issues
     */ updateStateReflection() {
        if (!this.agent || !this.agent.currentActivity) {
            return; // No activity to reflect
        }
        const desiredActivity = this.agent.currentActivity;
        const currentState = this.agent.stateMachine?.currentState?.type;
        // If already in the correct state, nothing to do
        if (desiredActivity === currentState) {
            return;
        }
        // Map activity to state name (they're usually the same, but be explicit)
        const activityToStateMap = {
            'combat': 'combat',
            'patrol': 'patrol',
            'alert': 'alert',
            'investigate': 'investigate',
            'seekHealth': 'seekHealth',
            'seekAmmo': 'seekAmmo',
            'flee': 'flee'
        };
        const targetState = activityToStateMap[desiredActivity] || desiredActivity;
        // Use existing changeToState method to handle transitions properly
        // This respects debouncing but removes the 100ms adapter throttle
        this.changeToState(targetState, {
            goalDriven: true,
            reason: `Reflecting activity: ${desiredActivity}`
        });
    }
    /**
     * Delegate logging for backward compatibility
     */ _logThrottled(key, level, message, ...args) {
        return this.eventManager.logThrottled(key, level, message, ...args);
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        // Initialize subsystems
        this.eventManager = new StateEventManager(agent);
        this.debounceController = new DebounceController();
        this.transitionValidator = new TransitionValidator(agent);
        this.utilitySystem = new StateUtilitySystem(agent);
        // Inject state age function into validator
        this.transitionValidator._getStateAge = (stateName)=>this.eventManager.getStateAge(stateName);
        Logger.debug(`[${this.agentName}] StateChangeManager initialized with utility-based state selection`);
    }
}

export { DebounceController, StateChangeManager, StateUtilitySystem, TransitionValidator };
