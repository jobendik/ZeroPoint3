import { Logger } from '../logger.mjs';

/**
 * GameModeBase - Base class for all game modes
 * 
 * Provides the foundational structure that all game modes must implement.
 * Each game mode defines:
 * - Victory conditions (what defines winning)
 * - AI strategic objectives (what AI tries to accomplish)
 * - Spawn rules (how/when/where entities appear)
 * - Event handlers (responses to game events)
 * - UI configuration (HUD elements and scoreboards)
 * - Lifecycle management (initialization, start, update, end, cleanup)
 */ class GameModeBase {
    // ==========================================
    // VICTORY CONDITIONS
    // ==========================================
    /**
     * Check if game should end based on mode rules
     * @returns {{gameOver: boolean, winner: string|null, reason: string|null, finalScore: Object|null, stats: Object|null}}
     */ checkVictoryConditions() {
        // Override in subclass
        return {
            gameOver: false,
            winner: null,
            reason: null,
            finalScore: null,
            stats: null
        };
    }
    // ==========================================
    // AI CONFIGURATION
    // ==========================================
    /**
     * Get evaluator instances for this mode
     * @returns {Array<GoalEvaluator>}
     */ getAIGoalEvaluators() {
        // Override in subclass
        return [];
    }
    /**
     * Get goal priority weights for this mode
     * @returns {Object} Priority weights (0.0 - 1.0)
     */ getAIGoalPriorities() {
        // Override in subclass
        return {
            strategic: 0.7,
            attack: 0.9,
            health: 1.0,
            ammo: 0.7,
            weapon: 0.5,
            explore: 0.3
        };
    }
    /**
     * Get the strategic goal class for this mode
     * @returns {Class|null} Strategic goal constructor
     */ getStrategicGoalClass() {
        // Override in subclass
        return null;
    }
    // ==========================================
    // SPAWN CONFIGURATION
    // ==========================================
    getPlayerSpawnRules() {
        return {
            respawnTime: 3,
            respawnCount: Infinity,
            spawnProtectionTime: 2
        };
    }
    getAISpawnRules() {
        return {
            respawnTime: 5,
            respawnCount: Infinity,
            spawnProtectionTime: 2
        };
    }
    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    onPlayerKill(killer, victim) {
    // Override in subclass
    }
    onAIKill(killer, victim) {
    // Override in subclass
    }
    onPlayerDeath(victim) {
    // Override in subclass
    }
    onAIDeath(victim) {
    // Override in subclass
    }
    onRoundStart() {
    // Override in subclass
    }
    onRoundEnd(results) {
    // Override in subclass
    }
    // ==========================================
    // UI CONFIGURATION
    // ==========================================
    getHUDElements() {
        return [
            'health',
            'ammo',
            'timer',
            'score'
        ];
    }
    getScoreboardData() {
        return null;
    }
    // ==========================================
    // LIFECYCLE
    // ==========================================
    initialize() {
        Logger.info(`[${this.modeName}] Initializing...`);
    }
    start() {
        this.isActive = true;
        this.startTime = performance.now();
        Logger.info(`[${this.modeName}] Started`);
    }
    update(dt) {
    // Override in subclass for mode-specific logic
    }
    end(results) {
        this.isActive = false;
        Logger.info(`[${this.modeName}] Ended`, results);
    }
    cleanup() {
        this.isActive = false;
        Logger.info(`[${this.modeName}] Cleaned up`);
    }
    constructor(gameManager){
        this.gameManager = gameManager;
        this.app = gameManager.app;
        // Mode identity
        this.modeName = "Unknown Mode";
        this.modeDescription = "";
        this.modeId = "unknown";
        // State
        this.isActive = false;
        this.startTime = 0;
    }
}

export { GameModeBase };
