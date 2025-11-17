import { Logger } from '../../../core/engine/logger.mjs';

/**
 * Manages frame tracking for state changes and event sequencing
 */ class FrameTracker {
    _updateFrame() {
        this.currentFrame = Math.floor(performance.now());
    }
    recordStateChange(targetState) {
        this._updateFrame();
        const frameChanges = this.lastFrameStateChanges.get(this.currentFrame) || [];
        frameChanges.push(targetState);
        this.lastFrameStateChanges.set(this.currentFrame, frameChanges);
        // Clean up old frames (keep last 10)
        const framesToKeep = 10;
        const oldFrames = Array.from(this.lastFrameStateChanges.keys()).filter((f)=>f < this.currentFrame - framesToKeep);
        oldFrames.forEach((f)=>this.lastFrameStateChanges.delete(f));
        this.stateChangeSequence++;
        return this.stateChangeSequence;
    }
    getRecentFrames(count = 3) {
        return [
            this.currentFrame - 2,
            this.currentFrame - 1,
            this.currentFrame
        ].slice(-count);
    }
    getFrameChanges(frame) {
        return this.lastFrameStateChanges.get(frame) || [];
    }
    getCurrentFrame() {
        this._updateFrame();
        return this.currentFrame;
    }
    constructor(){
        this.currentFrame = 0;
        this.lastFrameStateChanges = new Map(); // frame -> [state changes]
        this.stateChangeSequence = 0;
        this._updateFrame();
    }
}
/**
 * Handles throttled logging to prevent log spam while maintaining visibility
 */ class LoggingController {
    /**
     * Throttled logging helper with enhanced frame tracking
     */ logThrottled(key, level, message, ...args) {
        const now = performance.now();
        const lastLog = this.logThrottles.get(key) || 0;
        if (now - lastLog > this.LOG_THROTTLE_MS) {
            this.logThrottles.set(key, now);
            const currentFrame = this.frameTracker.getCurrentFrame();
            const fullMessage = `[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${currentFrame} ${message}`;
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
                case 'aiState':
                    Logger.aiState(fullMessage, ...args);
                    break;
                case 'aiDetail':
                    Logger.aiDetail(fullMessage, ...args);
                    break;
                case 'navDetail':
                    Logger.navDetail(fullMessage, ...args);
                    break;
                case 'nav':
                    Logger.nav(fullMessage, ...args);
                    break;
                case 'goal':
                    Logger.goal(fullMessage, ...args);
                    break;
                case 'tactic':
                    Logger.tactic(fullMessage, ...args);
                    break;
                default:
                    Logger.info(fullMessage, ...args);
                    break;
            }
            return true;
        }
        return false;
    }
    /**
     * Log state transition without throttling
     */ logStateTransition(currentState, targetState, sequence) {
        this.frameTracker.getCurrentFrame();
        if (currentState !== targetState) {
            try {
                if (typeof Logger !== 'undefined' && Logger.aiState) {
                    Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] STATE TRANSITION: ${currentState} → ${targetState} (seq=${sequence})`);
                }
            } catch (error) {
                Logger.error(`Logger.aiState failed:`, error);
            }
        }
    }
    /**
     * Log state entry/exit events
     */ logStateEntry(stateName) {
        const frameId = this.frameTracker.getCurrentFrame();
        Logger.aiState(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Entered ${stateName.toUpperCase()} state`);
    }
    logStateExit(stateName, duration = null) {
        const frameId = this.frameTracker.getCurrentFrame();
        const durationText = duration ? ` (${duration.toFixed(0)}ms)` : '';
        Logger.aiDetail(`[${this.agentName}#${this.agentGuid.substring(0, 8)}] frame=${frameId} Exited ${stateName.toUpperCase()} state${durationText}`);
    }
    constructor(agentName, agentGuid){
        this.agentName = agentName;
        this.agentGuid = agentGuid;
        this.logThrottles = new Map();
        this.LOG_THROTTLE_MS = 300; // 300ms between repetitive logs
        this.frameTracker = new FrameTracker();
    }
}
/**
 * Main state event management system
 */ class StateEventManager {
    /**
     * Record a state change event
     */ recordStateChange(targetState, options = {}) {
        const now = performance.now();
        const sequence = this.frameTracker.recordStateChange(targetState);
        // Update timing records
        this.lastStateChange.set(targetState, now);
        this.stateEnterTime.set(targetState, now);
        // Log the transition
        const currentState = this.agent.stateMachine?.currentState?.type || 'none';
        this.loggingController.logStateTransition(currentState, targetState, sequence);
        return sequence;
    }
    /**
     * Get state age in milliseconds
     */ getStateAge(stateName) {
        if (!stateName) return 999999;
        const enterTime = this.stateEnterTime.get(stateName) || 0;
        return enterTime > 0 ? performance.now() - enterTime : 999999;
    }
    /**
     * Check for ping-pong transitions
     */ isPingPongTransition(currentState, targetState) {
        if (!currentState || !targetState) return false;
        const recentFrames = this.frameTracker.getRecentFrames(3);
        let transitionCount = 0;
        for (const frame of recentFrames){
            const changes = this.frameTracker.getFrameChanges(frame);
            if (changes.includes(currentState) && changes.includes(targetState)) {
                transitionCount++;
            }
        }
        return transitionCount >= 2;
    }
    /**
     * Update death state tracking
     */ updateDeathState(isDead) {
        if (isDead && !this.deathStateActive) {
            this.deathStateActive = true;
            this.lastDeathStateChange = performance.now();
        } else if (!isDead && this.deathStateActive) {
            this.deathStateActive = false;
        }
    }
    /**
     * Get comprehensive state information
     */ getStateInfo() {
        const currentState = this.agent.stateMachine?.currentState?.type || 'none';
        const stateAge = this.getStateAge(currentState);
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        return {
            currentState,
            stateAge,
            healthRatio,
            currentFrame: this.frameTracker.getCurrentFrame(),
            sequence: this.frameTracker.stateChangeSequence,
            deathStateActive: this.deathStateActive
        };
    }
    /**
     * Delegate logging methods for convenience
     */ logThrottled(key, level, message, ...args) {
        return this.loggingController.logThrottled(key, level, message, ...args);
    }
    logStateEntry(stateName) {
        this.loggingController.logStateEntry(stateName);
    }
    logStateExit(stateName, duration) {
        this.loggingController.logStateExit(stateName, duration);
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        this.loggingController = new LoggingController(this.agentName, this.agentGuid);
        this.frameTracker = this.loggingController.frameTracker;
        // State change tracking
        this.lastStateChange = new Map(); // state -> timestamp
        this.stateEnterTime = new Map(); // state -> enter timestamp
        this.lastStateExitTime = 0;
        // Death state tracking
        this.deathStateActive = false;
        this.lastDeathStateChange = 0;
    }
}

export { FrameTracker, LoggingController, StateEventManager };
