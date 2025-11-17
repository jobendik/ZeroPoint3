import { Logger } from '../logger.mjs';

/**
 * GameModeManager - Mode Selection and Lifecycle Manager
 * 
 * Orchestrates the game mode system by:
 * - Registering available game modes
 * - Selecting and activating modes
 * - Configuring AI agents for the current mode
 * - Managing mode lifecycle (start, update, end)
 * - Providing mode information to other systems
 */ class GameModeManager {
    /**
     * Register a game mode
     * @param {string} modeId - Unique identifier for the mode
     * @param {Class} ModeClass - Game mode class constructor
     */ registerMode(modeId, ModeClass) {
        this.availableModes.set(modeId, ModeClass);
        Logger.info(`[GameModeManager] Registered mode: ${modeId}`);
    }
    /**
     * Select and activate a game mode
     * @param {string} modeId - ID of the mode to activate
     * @returns {boolean} Success status
     */ selectMode(modeId) {
        if (!this.availableModes.has(modeId)) {
            Logger.error(`[GameModeManager] Mode '${modeId}' not found`);
            return false;
        }
        // Cleanup previous mode
        if (this.currentMode) {
            Logger.info(`[GameModeManager] Cleaning up previous mode`);
            this.currentMode.cleanup();
        }
        // Create new mode instance
        const ModeClass = this.availableModes.get(modeId);
        this.currentMode = new ModeClass(this.gameManager);
        this.selectedModeId = modeId;
        // Initialize mode
        this.currentMode.initialize();
        Logger.info(`[GameModeManager] Selected mode: ${this.currentMode.modeName}`);
        // Fire event
        this.app.fire('gamemode:selected', {
            modeId: modeId,
            mode: this.currentMode
        });
        return true;
    }
    /**
     * Configure AI agents for current mode
     * Applies strategic goals, evaluators, and priority weights
     * 
     * NOTE: This is primarily a fallback for agents that were already spawned
     * before game mode was selected. New agents should get evaluators directly
     * from mode during brain initialization.
     */ configureAIForMode() {
        if (!this.currentMode) {
            Logger.warn('[GameModeManager] No mode selected, cannot configure AI');
            return;
        }
        const StrategicGoalClass = this.currentMode.getStrategicGoalClass();
        const evaluators = this.currentMode.getAIGoalEvaluators();
        const priorities = this.currentMode.getAIGoalPriorities();
        Logger.info('[GameModeManager] Configuring AI for mode:', {
            mode: this.currentMode.modeName,
            hasStrategicGoal: !!StrategicGoalClass,
            evaluatorCount: evaluators.length,
            useEvaluatorArbitration: !StrategicGoalClass
        });
        // Get all AI agents
        const agents = this.gameManager.getAllAgents();
        let configuredCount = 0;
        agents.forEach((agent)=>{
            if (!agent || !agent.brain) {
                Logger.debug(`[GameModeManager] Skipping agent without brain: ${agent?.entity?.name || 'unknown'}`);
                return;
            }
            // ✅ FIXED: Only set strategic goal if mode provides one
            // If null, let evaluator arbitration system handle everything
            if (StrategicGoalClass) {
                agent._strategicGoalClass = StrategicGoalClass;
                Logger.debug(`[GameModeManager] Agent ${agent.entity.name} - Strategic goal set`);
            } else {
                // Remove any existing strategic goal to allow evaluator arbitration
                agent._strategicGoalClass = null;
                Logger.debug(`[GameModeManager] Agent ${agent.entity.name} - Using evaluator arbitration`);
            }
            // ✅ IMPROVED: Only replace if agent has wrong evaluators
            // Check if agent already has the correct evaluators from mode
            const hasCorrectEvaluators = this._hasCorrectEvaluators(agent.brain, evaluators);
            if (!hasCorrectEvaluators) {
                Logger.info(`[GameModeManager] Agent ${agent.entity.name} has wrong evaluators, updating...`);
                // Clear and replace evaluators
                agent.brain.evaluators = [];
                evaluators.forEach((evaluator)=>{
                    agent.brain.addEvaluator(evaluator);
                });
                configuredCount++;
            } else {
                Logger.debug(`[GameModeManager] Agent ${agent.entity.name} already has correct evaluators`);
            }
            // Store priorities for arbitrator
            agent._modePriorities = {
                ...priorities
            };
        });
        Logger.info(`[GameModeManager] Configured ${configuredCount}/${agents.length} AI agents for ${this.currentMode.modeName}`);
    }
    /**
     * Check if agent brain has correct evaluators for current mode
     * @private
     */ _hasCorrectEvaluators(brain, modeEvaluators) {
        if (!brain.evaluators || brain.evaluators.length !== modeEvaluators.length) {
            return false;
        }
        // Check if all evaluator types match
        const brainTypes = new Set(brain.evaluators.map((e)=>e.constructor.name));
        const modeTypes = new Set(modeEvaluators.map((e)=>e.constructor.name));
        if (brainTypes.size !== modeTypes.size) return false;
        for (const type of modeTypes){
            if (!brainTypes.has(type)) return false;
        }
        return true;
    }
    /**
     * Get current active mode
     * @returns {GameModeBase|null}
     */ getCurrentMode() {
        return this.currentMode;
    }
    /**
     * Get list of available mode IDs
     * @returns {Array<string>}
     */ getAvailableModes() {
        return Array.from(this.availableModes.keys());
    }
    /**
     * Get mode info for UI
     * @param {string} modeId - Mode ID
     * @returns {Object|null} Mode information
     */ getModeInfo(modeId) {
        const ModeClass = this.availableModes.get(modeId);
        if (!ModeClass) return null;
        // Create temporary instance to get info
        const tempMode = new ModeClass(this.gameManager);
        return {
            id: modeId,
            name: tempMode.modeName,
            description: tempMode.modeDescription
        };
    }
    /**
     * Start current mode
     * @returns {boolean} Success status
     */ startMode() {
        if (!this.currentMode) {
            Logger.error('[GameModeManager] No mode selected');
            return false;
        }
        this.currentMode.start();
        this.app.fire('gamemode:started', this.currentMode);
        return true;
    }
    /**
     * Update current mode
     * @param {number} dt - Delta time in seconds
     */ update(dt) {
        if (this.currentMode && this.currentMode.isActive) {
            this.currentMode.update(dt);
        }
    }
    /**
     * End current mode
     * @param {Object} results - Results data
     */ endMode(results) {
        if (!this.currentMode) return;
        this.currentMode.end(results);
        this.app.fire('gamemode:ended', {
            mode: this.currentMode,
            results
        });
    }
    constructor(gameManager){
        this.gameManager = gameManager;
        this.app = gameManager.app;
        this.availableModes = new Map();
        this.currentMode = null;
        this.selectedModeId = null;
        Logger.info('[GameModeManager] Initialized');
    }
}

export { GameModeManager };
