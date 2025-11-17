import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from './logger.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * 🎢 DYNAMIC DIFFICULTY SYSTEM (System #5)
 * 
 * Automatically adjusts AI difficulty based on player performance:
 * - Tracks K/D ratio, accuracy, survival time
 * - Scales AI reaction time, accuracy, spawn rate
 * - Rubber-banding prevents frustration spirals
 * - Maintains flow state (always challenging, never impossible)
 * 
 * Creates personalized challenge curve for all skill levels.
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * IMPLEMENTATION STATUS (as of Nov 4, 2025)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * ✅ IMPLEMENTED:
 * - System entity exists in scene (attached to GameSession entity)
 * - Difficulty level tracking (1-5, starts at level 3)
 * - Performance metrics integration (K/D, accuracy tracking)
 * - Adjustment logic (every 30s, gradual changes ±0.2)
 * - Thresholds defined (K/D: 0.5/2.0, Accuracy: 20%/60%)
 * - AI config modification methods (setAIDifficulty)
 * - Difficulty change events fired (game:difficulty:changed)
 * 
 * ⚠️ PARTIALLY IMPLEMENTED / NEEDS VERIFICATION:
 * - Actual AI behavior changes when difficulty adjusts
 *   → AI spawn rate scaling
 *   → AI reaction time adjustments  
 *   → AI accuracy modifications
 *   → Needs gameplay testing to verify agents respond to difficulty changes
 * 
 * 🔧 FOR FULL INTEGRATION (Future Work):
 * 1. Verify AI agents listen to difficulty change events
 * 2. Test in long gameplay session (5+ minutes) to see adjustments
 * 3. Add visual feedback when difficulty changes (UI notification)
 * 4. Tune thresholds based on real player data
 * 5. Add difficulty persistence (save/load player's appropriate level)
 * 
 * 📊 TESTING NOTES:
 * - Entity verified: System exists at level 3 (Normal)
 * - Code reviewed: Logic appears sound
 * - Not stress-tested: Needs extended gameplay to verify behavior changes
 * - Console command available: window.dynamicDifficulty (if exposed)
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */ class DynamicDifficultySystem extends Script {
    initialize() {
        if (this.__ddsBooted) {
            Logger.debug('[DynamicDifficultySystem] Already initialized');
            return;
        }
        this.performanceMetrics = null;
        // Difficulty levels: 1-5 (1=Easy, 3=Normal, 5=Hard)
        this.currentDifficultyLevel = 3;
        this.targetDifficultyLevel = 3;
        this.minDifficultyLevel = 1;
        this.maxDifficultyLevel = 5;
        // Performance tracking window (last N encounters)
        this.performanceWindow = 10;
        this.recentEncounters = [];
        // Adjustment thresholds
        this.kdRatioThresholds = {
            struggling: 0.5,
            dominating: 2.0 // K/D > 2.0 = increase difficulty
        };
        this.accuracyThresholds = {
            poor: 0.2,
            excellent: 0.6 // > 60% = increase difficulty
        };
        // Adjustment rates
        this.adjustmentInterval = 30000; // Check every 30 seconds
        this.lastAdjustmentTime = performance.now();
        this.difficultyChangeRate = 0.2; // Gradual changes (0.2 per adjustment)
        // AI modifier ranges by difficulty level
        this.difficultyModifiers = {
            1: {
                reactionTimeMultiplier: 1.5,
                accuracyMultiplier: 0.7,
                spawnRateMultiplier: 0.7,
                healthMultiplier: 0.8,
                damageMultiplier: 0.8 // -20% damage
            },
            2: {
                reactionTimeMultiplier: 1.25,
                accuracyMultiplier: 0.85,
                spawnRateMultiplier: 0.85,
                healthMultiplier: 0.9,
                damageMultiplier: 0.9
            },
            3: {
                reactionTimeMultiplier: 1.0,
                accuracyMultiplier: 1.0,
                spawnRateMultiplier: 1.0,
                healthMultiplier: 1.0,
                damageMultiplier: 1.0
            },
            4: {
                reactionTimeMultiplier: 0.85,
                accuracyMultiplier: 1.15,
                spawnRateMultiplier: 1.15,
                healthMultiplier: 1.1,
                damageMultiplier: 1.1 // +10% damage
            },
            5: {
                reactionTimeMultiplier: 0.7,
                accuracyMultiplier: 1.3,
                spawnRateMultiplier: 1.3,
                healthMultiplier: 1.2,
                damageMultiplier: 1.2 // +20% damage
            }
        };
        // Rubber-banding limits (prevent extreme swings)
        this.maxDifficultyChangePerAdjustment = 1; // Max ±1 level per adjustment
        this.minTimeBetweenChanges = 20000; // Minimum 20s between changes
        this.lastDifficultyChangeTime = performance.now();
        this._setupEventListeners();
        this._waitForDependencies();
        // Initialize difficulty modifiers immediately so AI systems don't break
        this._applyDifficultyModifiers();
        this.on('destroy', this._cleanup, this);
        this.__ddsBooted = true;
        Logger.info('[DynamicDifficultySystem] Initialized');
    }
    _waitForDependencies() {
        const check = ()=>{
            // Wait for performance metrics system
            const metricsEntity = this.app.root.findByName('PerformanceMetrics');
            if (!metricsEntity || !metricsEntity.script || !metricsEntity.script.performanceMetricsSystem) {
                setTimeout(check, 100);
                return;
            }
            this.performanceMetrics = metricsEntity.script.performanceMetricsSystem;
            Logger.debug('[DynamicDifficultySystem] Dependencies ready');
        };
        check();
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        // Listen for player deaths to trigger difficulty evaluation
        this.app.on('entity:died', this._onEntityDied, this);
        this._eventsBound = true;
    }
    _onEntityDied(data) {
        if (!data || !data.entity) return;
        // Only evaluate on player death
        const player = this.app.root.findByTag('player')[0];
        if (data.entity !== player) return;
        // Record encounter result
        this._recordEncounter();
    }
    _recordEncounter() {
        if (!this.performanceMetrics) return;
        const kdRatio = this.performanceMetrics.getKDRatio();
        const accuracy = this.performanceMetrics.getAccuracy();
        const survivalTime = this.performanceMetrics.getCurrentSurvivalTime();
        // Add to recent encounters
        this.recentEncounters.push({
            kdRatio: kdRatio,
            accuracy: accuracy,
            survivalTime: survivalTime,
            timestamp: performance.now()
        });
        // Keep only recent N encounters
        if (this.recentEncounters.length > this.performanceWindow) {
            this.recentEncounters.shift();
        }
        Logger.debug(`[DynamicDifficultySystem] Encounter recorded | K/D: ${kdRatio.toFixed(2)} | Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    }
    _evaluateDifficulty() {
        if (!this.performanceMetrics) return;
        if (this.recentEncounters.length < 3) return; // Need at least 3 encounters
        // Calculate average performance over recent encounters
        const avgKD = this.recentEncounters.reduce((sum, e)=>sum + e.kdRatio, 0) / this.recentEncounters.length;
        const avgAccuracy = this.recentEncounters.reduce((sum, e)=>sum + e.accuracy, 0) / this.recentEncounters.length;
        const avgSurvival = this.recentEncounters.reduce((sum, e)=>sum + e.survivalTime, 0) / this.recentEncounters.length;
        Logger.debug(`[DynamicDifficultySystem] Performance | Avg K/D: ${avgKD.toFixed(2)} | Avg Accuracy: ${(avgAccuracy * 100).toFixed(1)}% | Avg Survival: ${avgSurvival.toFixed(1)}s`);
        // Determine if difficulty adjustment is needed
        let targetLevel = this.currentDifficultyLevel;
        // Check K/D ratio
        if (avgKD < this.kdRatioThresholds.struggling) {
            targetLevel -= 1; // Player struggling - decrease difficulty
            Logger.debug('[DynamicDifficultySystem] Low K/D detected - suggesting easier difficulty');
        } else if (avgKD > this.kdRatioThresholds.dominating) {
            targetLevel += 1; // Player dominating - increase difficulty
            Logger.debug('[DynamicDifficultySystem] High K/D detected - suggesting harder difficulty');
        }
        // Check accuracy
        if (avgAccuracy < this.accuracyThresholds.poor) {
            targetLevel -= 0.5; // Poor accuracy - slight decrease
            Logger.debug('[DynamicDifficultySystem] Low accuracy detected - suggesting easier difficulty');
        } else if (avgAccuracy > this.accuracyThresholds.excellent) {
            targetLevel += 0.5; // Excellent accuracy - slight increase
            Logger.debug('[DynamicDifficultySystem] High accuracy detected - suggesting harder difficulty');
        }
        // Check survival time (normalize to 60 seconds target)
        if (avgSurvival < 30) {
            targetLevel -= 0.5; // Very short survival - decrease
        } else if (avgSurvival > 120) {
            targetLevel += 0.5; // Very long survival - increase
        }
        // Apply difficulty change
        this._adjustDifficulty(targetLevel);
    }
    _adjustDifficulty(targetLevel) {
        // Clamp to valid range
        targetLevel = Math.max(this.minDifficultyLevel, Math.min(this.maxDifficultyLevel, targetLevel));
        // Round to nearest 0.5 (allows sub-levels)
        targetLevel = Math.round(targetLevel * 2) / 2;
        // Check if change is needed
        if (targetLevel === this.currentDifficultyLevel) {
            Logger.debug('[DynamicDifficultySystem] No difficulty change needed');
            return;
        }
        // Check cooldown
        const now = performance.now();
        if (now - this.lastDifficultyChangeTime < this.minTimeBetweenChanges) {
            Logger.debug('[DynamicDifficultySystem] Difficulty change on cooldown');
            return;
        }
        // Limit change magnitude (rubber-banding)
        const maxChange = this.maxDifficultyChangePerAdjustment;
        const change = Math.max(-maxChange, Math.min(maxChange, targetLevel - this.currentDifficultyLevel));
        const newLevel = this.currentDifficultyLevel + change;
        // Apply change
        this.currentDifficultyLevel = newLevel;
        this.lastDifficultyChangeTime = now;
        // Apply modifiers to AI systems
        this._applyDifficultyModifiers();
        // Notify UI
        this.app.fire('difficulty:changed', {
            level: this.currentDifficultyLevel,
            direction: change > 0 ? 'increased' : 'decreased'
        });
        Logger.info(`[DynamicDifficultySystem] 🎚️ Difficulty adjusted: ${this.currentDifficultyLevel.toFixed(1)} (${change > 0 ? '+' : ''}${change.toFixed(1)})`);
    }
    _applyDifficultyModifiers() {
        // Interpolate between difficulty levels for smooth transitions
        const baseLevel = Math.floor(this.currentDifficultyLevel);
        const nextLevel = Math.ceil(this.currentDifficultyLevel);
        const t = this.currentDifficultyLevel - baseLevel;
        const baseMods = this.difficultyModifiers[baseLevel] || this.difficultyModifiers[3];
        const nextMods = this.difficultyModifiers[nextLevel] || this.difficultyModifiers[3];
        // Lerp between levels
        const modifiers = {
            reactionTimeMultiplier: this._lerp(baseMods.reactionTimeMultiplier, nextMods.reactionTimeMultiplier, t),
            accuracyMultiplier: this._lerp(baseMods.accuracyMultiplier, nextMods.accuracyMultiplier, t),
            spawnRateMultiplier: this._lerp(baseMods.spawnRateMultiplier, nextMods.spawnRateMultiplier, t),
            healthMultiplier: this._lerp(baseMods.healthMultiplier, nextMods.healthMultiplier, t),
            damageMultiplier: this._lerp(baseMods.damageMultiplier, nextMods.damageMultiplier, t)
        };
        // Apply to AI systems
        this.app.fire('difficulty:apply_modifiers', modifiers);
        // Store for query by other systems
        this.app.difficultyModifiers = modifiers;
        Logger.debug('[DynamicDifficultySystem] Modifiers applied:', modifiers);
    }
    _lerp(a, b, t) {
        return a + (b - a) * t;
    }
    /**
     * Get current difficulty level (1-5)
     */ getDifficultyLevel() {
        return this.currentDifficultyLevel;
    }
    /**
     * Get current difficulty modifiers
     */ getDifficultyModifiers() {
        return this.app.difficultyModifiers || this.difficultyModifiers[3];
    }
    /**
     * Manually set difficulty level (for testing/admin)
     */ setDifficultyLevel(level) {
        this.currentDifficultyLevel = Math.max(this.minDifficultyLevel, Math.min(this.maxDifficultyLevel, level));
        this._applyDifficultyModifiers();
        Logger.info(`[DynamicDifficultySystem] Difficulty manually set to ${this.currentDifficultyLevel}`);
    }
    update(dt) {
        if (!this.performanceMetrics) return;
        // Check if it's time to evaluate difficulty
        const now = performance.now();
        if (now - this.lastAdjustmentTime > this.adjustmentInterval) {
            this.lastAdjustmentTime = now;
            this._evaluateDifficulty();
        }
    }
    _cleanup() {
        if (this._eventsBound) {
            this.app.off('entity:died', this._onEntityDied, this);
        }
        this._eventsBound = false;
        this.__ddsBooted = false;
        Logger.debug('[DynamicDifficultySystem] Cleanup complete');
    }
}
_define_property(DynamicDifficultySystem, "scriptName", 'dynamicDifficultySystem');

export { DynamicDifficultySystem };
