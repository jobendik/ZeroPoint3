import { Logger } from './logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * 📊 SessionMetrics - Session Statistics and Performance Tracking
 * 
 * Comprehensive statistics management system that tracks and calculates
 * all session-related metrics including combat statistics, accuracy,
 * performance metrics, and gameplay analytics.
 * 
 * Features:
 * - Comprehensive statistics tracking (kills, deaths, accuracy, damage)
 * - Real-time metric updates during gameplay
 * - Performance metrics and analytics
 * - Final statistics calculation and reporting
 * - Statistics validation and data integrity
 * - Public statistics API
 */ class SessionMetrics {
    initialize() {
        if (this.__sessionMetricsReady) {
            this._log('debug', '[SessionMetrics] Already initialized, skipping...');
            return;
        }
        this._log('gameState', '[SessionMetrics] Initializing...');
        this.stats = this._createEmptyStats();
        this.__sessionMetricsReady = true;
        this._log('gameState', '[SessionMetrics] Initialized successfully');
    }
    isReady() {
        return this.__sessionMetricsReady === true;
    }
    // ============================================================================
    // STATISTICS INITIALIZATION
    // ============================================================================
    _createEmptyStats() {
        return {
            duration: 0,
            kills: 0,
            deaths: 0,
            shotsFired: 0,
            shotsHit: 0,
            accuracy: 0,
            damageDealt: 0,
            damageTaken: 0,
            itemsPickedUp: 0,
            distance: 0,
            killStreak: 0,
            bestKillStreak: 0,
            fastestKill: 0,
            biggestHit: 0,
            footsteps: 0,
            weaponSwitches: 0,
            totalDeaths: 0,
            bestAI: 'None',
            aiAccuracy: 0
        };
    }
    resetStats() {
        this._log('debug', '[SessionMetrics] Resetting statistics...');
        this.stats = this._createEmptyStats();
        this.startTime = 0;
    }
    setSessionStartTime(startTime) {
        this.startTime = startTime;
        this._log('debug', `[SessionMetrics] Session start time set to: ${startTime}`);
    }
    // ============================================================================
    // COMBAT STATISTICS
    // ============================================================================
    recordEntityDeath(data) {
        Logger.debug('[SessionMetrics] 💀 recordEntityDeath() CALLED', {
            entity: data?.entity?.name,
            attacker: data?.attacker?.name,
            isPlayer: data?.entity === this.gameManager.player.entity,
            isPlayerKill: data?.attacker === this.gameManager.player.entity,
            isHeadshot: data?.isHeadshot || false
        });
        if (!data || !data.entity) return;
        const entity = data.entity;
        const attacker = data.attacker;
        // Increment total deaths counter
        this.stats.totalDeaths++;
        // Check if player died
        if (entity === this.gameManager.player.entity) {
            this.stats.deaths++;
            this.stats.killStreak = 0; // Reset kill streak on player death
            this._log('health', '[SessionMetrics] Player death recorded');
            Logger.debug('[SessionMetrics] ✅ PLAYER DEATH recorded - deaths now:', this.stats.deaths);
        } else if (attacker === this.gameManager.player.entity) {
            this.stats.kills++;
            this.stats.killStreak++;
            // Update best kill streak
            if (this.stats.killStreak > this.stats.bestKillStreak) {
                this.stats.bestKillStreak = this.stats.killStreak;
            }
            this._log('aiState', `[SessionMetrics] Player kill recorded (streak: ${this.stats.killStreak})`);
            Logger.debug('[SessionMetrics] ✅ PLAYER KILL recorded - kills now:', this.stats.kills, 'streak:', this.stats.killStreak);
        }
        this._log('debug', `[SessionMetrics] Death recorded - Total deaths: ${this.stats.totalDeaths}`);
    }
    recordEntityDamage(data) {
        if (!data || !data.entity || !data.attacker || typeof data.damage !== 'number') {
            this._log('debug', '[SessionMetrics] Invalid damage event data, ignoring');
            return;
        }
        const entity = data.entity;
        const attacker = data.attacker;
        const damage = data.damage;
        // Track damage dealt by player
        if (attacker === this.gameManager.player.entity) {
            this.stats.damageDealt += damage;
            // Track shots hit (player successfully damaged an enemy)
            this.stats.shotsHit++;
            // Track biggest hit
            if (damage > this.stats.biggestHit) {
                this.stats.biggestHit = damage;
            }
            this._log('debug', `[SessionMetrics] Player dealt ${damage} damage (total: ${this.stats.damageDealt}, shotsHit: ${this.stats.shotsHit})`);
        }
        // Track damage taken by player
        if (entity === this.gameManager.player.entity) {
            this.stats.damageTaken += damage;
            this.stats.killStreak = 0; // Reset kill streak when taking damage
            this._log('debug', `[SessionMetrics] Player took ${damage} damage (total: ${this.stats.damageTaken})`);
        }
    }
    // ============================================================================
    // WEAPON STATISTICS
    // ============================================================================
    recordWeaponFired(data) {
        if (!data || !data.shooter) return;
        // Only track player weapon usage
        if (data.shooter === this.gameManager.player.entity) {
            this.stats.shotsFired++;
            // Track hits if provided
            if (data.shotsHit && data.shotsHit > 0) {
                this.stats.shotsHit += data.shotsHit;
            }
            this._log('debug', `[SessionMetrics] Weapon fired - Total shots: ${this.stats.shotsFired}, hits: ${this.stats.shotsHit}`);
        }
    }
    recordWeaponSwitch(data) {
        if (!data) return;
        this.stats.weaponSwitches++;
        this._log('debug', `[SessionMetrics] Weapon switch recorded - Total: ${this.stats.weaponSwitches}`);
    }
    // ============================================================================
    // GAMEPLAY STATISTICS
    // ============================================================================
    recordItemPickup(data) {
        if (!data || !data.picker) return;
        // Only track player pickups
        if (data.picker === this.gameManager.player.entity) {
            this.stats.itemsPickedUp++;
            this._log('debug', `[SessionMetrics] Item pickup recorded - Total: ${this.stats.itemsPickedUp}`);
        }
    }
    recordFootstep(data) {
        this.stats.footsteps++;
    // Don't log footsteps as they're very frequent
    }
    // ============================================================================
    // ACCURACY CALCULATION
    // ============================================================================
    calculateAccuracy() {
        if (this.stats.shotsFired === 0) {
            this.stats.accuracy = 0;
        } else {
            this.stats.accuracy = this.stats.shotsHit / this.stats.shotsFired * 100;
        }
        return this.stats.accuracy;
    }
    // ============================================================================
    // SESSION METRICS FINALIZATION
    // ============================================================================
    finalizeStats() {
        const now = performance.now() / 1000;
        // Calculate session duration
        this.stats.duration = this.startTime > 0 ? now - this.startTime : 0;
        // Calculate final accuracy
        this.calculateAccuracy();
        // Calculate distance traveled if player data is available
        this._calculateDistanceTraveled();
        // Validate stats integrity
        this._validateStats();
        this._log('gameState', '[SessionMetrics] Final stats calculated:', {
            duration: Math.round(this.stats.duration),
            kills: this.stats.kills,
            deaths: this.stats.deaths,
            accuracy: Math.round(this.stats.accuracy * 100) / 100,
            damageDealt: this.stats.damageDealt,
            damageTaken: this.stats.damageTaken
        });
        return this.stats;
    }
    _calculateDistanceTraveled() {
        const player = this.gameManager.player;
        if (player && player.entity && player.startPosition) {
            try {
                this.stats.distance = player.entity.getPosition().distance(player.startPosition);
                this._log('debug', `[SessionMetrics] Distance traveled: ${Math.round(this.stats.distance)}m`);
            } catch (e) {
                this._log('debug', '[SessionMetrics] Could not calculate distance traveled:', e);
                this.stats.distance = 0;
            }
        } else {
            this.stats.distance = 0;
        }
    }
    _validateStats() {
        // Ensure all numeric stats are valid numbers
        Object.keys(this.stats).forEach((key)=>{
            if (typeof this.stats[key] === 'number') {
                if (!isFinite(this.stats[key]) || isNaN(this.stats[key])) {
                    this._log('warn', `[SessionMetrics] Invalid stat value for ${key}: ${this.stats[key]}, resetting to 0`);
                    this.stats[key] = 0;
                }
                // Ensure non-negative values for certain stats
                if ([
                    'kills',
                    'deaths',
                    'shotsFired',
                    'shotsHit',
                    'itemsPickedUp',
                    'footsteps',
                    'weaponSwitches',
                    'totalDeaths'
                ].includes(key)) {
                    if (this.stats[key] < 0) {
                        this._log('warn', `[SessionMetrics] Negative value for ${key}: ${this.stats[key]}, resetting to 0`);
                        this.stats[key] = 0;
                    }
                }
            }
        });
        // Validate accuracy bounds
        if (this.stats.accuracy < 0) this.stats.accuracy = 0;
        if (this.stats.accuracy > 100) this.stats.accuracy = 100;
        // Validate shots hit cannot exceed shots fired
        if (this.stats.shotsHit > this.stats.shotsFired) {
            this._log('warn', `[SessionMetrics] Shots hit (${this.stats.shotsHit}) exceeds shots fired (${this.stats.shotsFired}), correcting...`);
            this.stats.shotsHit = this.stats.shotsFired;
            this.calculateAccuracy();
        }
        // Validate kill streak cannot exceed kills
        if (this.stats.bestKillStreak > this.stats.kills) {
            this._log('warn', `[SessionMetrics] Best kill streak (${this.stats.bestKillStreak}) exceeds total kills (${this.stats.kills}), correcting...`);
            this.stats.bestKillStreak = this.stats.kills;
        }
    }
    // ============================================================================
    // PERFORMANCE METRICS
    // ============================================================================
    calculateKillDeathRatio() {
        if (this.stats.deaths === 0) {
            return this.stats.kills > 0 ? this.stats.kills : 0;
        }
        return this.stats.kills / this.stats.deaths;
    }
    calculateDamagePerSecond() {
        if (this.stats.duration === 0) return 0;
        return this.stats.damageDealt / this.stats.duration;
    }
    calculateShotsPerSecond() {
        if (this.stats.duration === 0) return 0;
        return this.stats.shotsFired / this.stats.duration;
    }
    getPerformanceMetrics() {
        return {
            killDeathRatio: this.calculateKillDeathRatio(),
            damagePerSecond: this.calculateDamagePerSecond(),
            shotsPerSecond: this.calculateShotsPerSecond(),
            averageDamagePerHit: this.stats.shotsHit > 0 ? this.stats.damageDealt / this.stats.shotsHit : 0,
            killsPerMinute: this.stats.duration > 0 ? this.stats.kills / this.stats.duration * 60 : 0
        };
    }
    // ============================================================================
    // STATISTICS API
    // ============================================================================
    getStats() {
        // Return a deep copy to prevent external modification
        return JSON.parse(JSON.stringify(this.stats));
    }
    getCurrentStats() {
        // Return current stats with live accuracy calculation
        const currentStats = {
            ...this.stats
        };
        currentStats.accuracy = this.calculateAccuracy();
        return currentStats;
    }
    getStatValue(statName) {
        return this.stats[statName] || 0;
    }
    incrementStat(statName, amount = 1) {
        if (typeof this.stats[statName] === 'number') {
            this.stats[statName] += amount;
            this._log('debug', `[SessionMetrics] ${statName} incremented by ${amount} (total: ${this.stats[statName]})`);
        } else {
            this._log('warn', `[SessionMetrics] Cannot increment non-numeric stat: ${statName}`);
        }
    }
    setStat(statName, value) {
        if (this.stats.hasOwnProperty(statName)) {
            const oldValue = this.stats[statName];
            this.stats[statName] = value;
            this._log('debug', `[SessionMetrics] ${statName} set from ${oldValue} to ${value}`);
        } else {
            this._log('warn', `[SessionMetrics] Cannot set unknown stat: ${statName}`);
        }
    }
    // ============================================================================
    // STATISTICS SUMMARY
    // ============================================================================
    getStatsSummary() {
        const performance1 = this.getPerformanceMetrics();
        return {
            session: {
                duration: Math.round(this.stats.duration),
                endReason: 'completed' // This would be set by the calling system
            },
            combat: {
                kills: this.stats.kills,
                deaths: this.stats.deaths,
                killDeathRatio: Math.round(performance1.killDeathRatio * 100) / 100,
                bestKillStreak: this.stats.bestKillStreak,
                damageDealt: this.stats.damageDealt,
                damageTaken: this.stats.damageTaken,
                biggestHit: this.stats.biggestHit
            },
            accuracy: {
                shotsFired: this.stats.shotsFired,
                shotsHit: this.stats.shotsHit,
                accuracy: Math.round(this.stats.accuracy * 100) / 100,
                averageDamagePerHit: Math.round(performance1.averageDamagePerHit * 100) / 100
            },
            activity: {
                itemsPickedUp: this.stats.itemsPickedUp,
                weaponSwitches: this.stats.weaponSwitches,
                distance: Math.round(this.stats.distance),
                footsteps: this.stats.footsteps
            },
            performance: performance1
        };
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    cleanup() {
        this._log('debug', '[SessionMetrics] Cleaning up...');
        this.stats = this._createEmptyStats();
        this.startTime = 0;
        this.__sessionMetricsReady = false;
    }
    // Helper method
    _log(level, message, data = null) {
        if (typeof Logger !== 'undefined') {
            Logger[level](`[SessionMetrics] ${message}`, data);
        } else {
            Logger.debug(`[SessionMetrics] ${level.toUpperCase()}: ${message}`, data || '');
        }
    }
    constructor(app, gameManager){
        this.app = app;
        this.gameManager = gameManager;
        // Statistics
        this.stats = this._createEmptyStats();
        // Session timing
        this.startTime = 0;
        // Initialization flag
        this.__sessionMetricsReady = false;
    }
}

export { SessionMetrics };
