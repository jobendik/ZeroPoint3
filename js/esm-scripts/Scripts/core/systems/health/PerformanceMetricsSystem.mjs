import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../engine/logger.mjs';

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
 * 📊 PERFORMANCE METRICS SYSTEM
 * 
 * Tracks player performance and provides motivation/feedback:
 * - Kill/Death ratio tracking
 * - Accuracy percentage (hits / shots fired)
 * - Survival time per life
 * - Kill streaks
 * - Session statistics
 * - Personal bests
 * 
 * Creates goals beyond "survive" and makes deaths feel like learning opportunities.
 */ class PerformanceMetricsSystem extends Script {
    initialize() {
        if (this.__pmsBooted) {
            Logger.debug('[PerformanceMetricsSystem] Already initialized');
            return;
        }
        this.player = null;
        // Session stats
        this.sessionStats = {
            kills: 0,
            deaths: 0,
            shots: 0,
            hits: 0,
            headshots: 0,
            damageDealt: 0,
            damageTaken: 0,
            healthPickups: 0,
            ammoPickups: 0,
            sessionStartTime: performance.now(),
            totalPlayTime: 0
        };
        // Current life stats
        this.currentLife = {
            kills: 0,
            shots: 0,
            hits: 0,
            damageDealt: 0,
            damageTaken: 0,
            lifeStartTime: performance.now(),
            survivalTime: 0
        };
        // Kill streak tracking
        this.currentKillStreak = 0;
        this.bestKillStreak = 0;
        this.killStreakTimestamps = [];
        this.killStreakTimeout = 10000; // ms - streak broken if 10s without kill
        // Personal bests (stored in localStorage if available)
        this.personalBests = this._loadPersonalBests();
        // Weapon stats
        this.weaponStats = {
            pistol: {
                kills: 0,
                shots: 0,
                hits: 0
            },
            machinegun: {
                kills: 0,
                shots: 0,
                hits: 0
            },
            shotgun: {
                kills: 0,
                shots: 0,
                hits: 0
            }
        };
        this._setupEventListeners();
        this._waitForPlayer();
        this.on('destroy', this._cleanup, this);
        this.__pmsBooted = true;
        Logger.info('[PerformanceMetricsSystem] Initialized');
    }
    _waitForPlayer() {
        const check = ()=>{
            const player = this.app.root.findByTag('player')[0];
            if (!player || !player.script || !player.script.player) {
                setTimeout(check, 100);
                return;
            }
            this.player = player;
            Logger.debug('[PerformanceMetricsSystem] Player found');
        };
        check();
    }
    _loadPersonalBests() {
        if (typeof localStorage === 'undefined') {
            return {
                bestKDRatio: 0,
                bestAccuracy: 0,
                longestSurvival: 0,
                mostKills: 0,
                bestKillStreak: 0
            };
        }
        try {
            const stored = localStorage.getItem('fps_personal_bests');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            Logger.warn('[PerformanceMetricsSystem] Failed to load personal bests:', e);
        }
        return {
            bestKDRatio: 0,
            bestAccuracy: 0,
            longestSurvival: 0,
            mostKills: 0,
            bestKillStreak: 0
        };
    }
    _savePersonalBests() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem('fps_personal_bests', JSON.stringify(this.personalBests));
        } catch (e) {
            Logger.warn('[PerformanceMetricsSystem] Failed to save personal bests:', e);
        }
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        // Track kills
        this.app.on('entity:died', this._onEntityDied, this);
        // Track shots and hits
        this.app.on('weapon:fired', this._onWeaponFired, this);
        this.app.on('entity:damaged', this._onEntityDamage, this);
        // Track pickups
        this.app.on('pickup:collected', this._onPickupCollected, this);
        this._eventsBound = true;
    }
    _onEntityDied(data) {
        if (!data || !data.entity) return;
        // Player died
        if (data.entity === this.player) {
            this._onPlayerDeath();
            return;
        }
        // AI died - check if player killed it
        if (data.killer === this.player) {
            this._onPlayerKill(data);
        }
    }
    _onPlayerKill(data) {
        // Increment session kills
        this.sessionStats.kills++;
        this.currentLife.kills++;
        // Update kill streak
        this.currentKillStreak++;
        this.killStreakTimestamps.push(performance.now());
        if (this.currentKillStreak > this.bestKillStreak) {
            this.bestKillStreak = this.currentKillStreak;
        }
        // Track weapon-specific kills
        const weaponType = this._getCurrentWeaponType();
        if (weaponType && this.weaponStats[weaponType]) {
            this.weaponStats[weaponType].kills++;
        }
        // Update UI
        this._updateStatsUI();
        // Check for kill streak milestones
        this._checkKillStreakMilestone();
        Logger.debug(`[PerformanceMetricsSystem] Kill #${this.sessionStats.kills} | Streak: ${this.currentKillStreak}`);
    }
    _onPlayerDeath() {
        // Increment deaths
        this.sessionStats.deaths++;
        // Calculate survival time
        const now = performance.now();
        this.currentLife.survivalTime = (now - this.currentLife.lifeStartTime) / 1000; // seconds
        // Update personal bests
        this._updatePersonalBests();
        // Reset kill streak
        this.currentKillStreak = 0;
        this.killStreakTimestamps = [];
        // Display death screen with stats
        this._showDeathStats();
        // Reset current life stats
        this._resetCurrentLife();
        Logger.info(`[PerformanceMetricsSystem] Player died | K/D: ${this.getKDRatio().toFixed(2)} | Accuracy: ${(this.getAccuracy() * 100).toFixed(1)}%`);
    }
    _onWeaponFired(data) {
        if (!data || !data.target) return;
        // Only track player shots
        if (data.target !== this.player) return;
        // Increment shot counters
        this.sessionStats.shots++;
        this.currentLife.shots++;
        // Track weapon-specific shots
        const weaponType = data.weaponType;
        if (weaponType && this.weaponStats[weaponType]) {
            this.weaponStats[weaponType].shots++;
        }
        // Update UI every 5 shots to avoid spam
        if (this.sessionStats.shots % 5 === 0) {
            this._updateStatsUI();
        }
    }
    _onEntityDamage(data) {
        if (!data || !data.attacker || !data.target) return;
        // Track player hits on enemies
        if (data.attacker === this.player && data.target !== this.player) {
            this.sessionStats.hits++;
            this.currentLife.hits++;
            this.currentLife.damageDealt += data.damage || 0;
            this.sessionStats.damageDealt += data.damage || 0;
            // Track weapon-specific hits
            const weaponType = this._getCurrentWeaponType();
            if (weaponType && this.weaponStats[weaponType]) {
                this.weaponStats[weaponType].hits++;
            }
            // Track headshots (if data includes hit location)
            if (data.hitLocation === 'head') {
                this.sessionStats.headshots++;
            }
        }
        // Track damage taken by player
        if (data.target === this.player) {
            this.currentLife.damageTaken += data.damage || 0;
            this.sessionStats.damageTaken += data.damage || 0;
        }
    }
    _onPickupCollected(data) {
        if (!data || !data.collector) return;
        // Only track player pickups
        if (data.collector !== this.player) return;
        const pickupType = data.type;
        if (pickupType === 'health') {
            this.sessionStats.healthPickups++;
        } else if (pickupType === 'ammo') {
            this.sessionStats.ammoPickups++;
        }
    }
    _getCurrentWeaponType() {
        if (!this.player || !this.player.script || !this.player.script.weaponSystem) {
            return null;
        }
        const weaponSystem = this.player.script.weaponSystem;
        return weaponSystem.getCurrentKey ? weaponSystem.getCurrentKey() : null;
    }
    _checkKillStreakMilestone() {
        const milestones = [
            3,
            5,
            10,
            15,
            20,
            25
        ];
        if (milestones.includes(this.currentKillStreak)) {
            // Fire event for UI notification
            this.app.fire('ui:killstreak_milestone', {
                streak: this.currentKillStreak
            });
            Logger.info(`[PerformanceMetricsSystem] 🔥 KILL STREAK: ${this.currentKillStreak}!`);
        }
    }
    _updatePersonalBests() {
        let updated = false;
        // Check K/D ratio
        const kdRatio = this.getKDRatio();
        if (kdRatio > this.personalBests.bestKDRatio) {
            this.personalBests.bestKDRatio = kdRatio;
            updated = true;
        }
        // Check accuracy
        const accuracy = this.getAccuracy();
        if (accuracy > this.personalBests.bestAccuracy) {
            this.personalBests.bestAccuracy = accuracy;
            updated = true;
        }
        // Check survival time
        if (this.currentLife.survivalTime > this.personalBests.longestSurvival) {
            this.personalBests.longestSurvival = this.currentLife.survivalTime;
            updated = true;
        }
        // Check kill count
        if (this.sessionStats.kills > this.personalBests.mostKills) {
            this.personalBests.mostKills = this.sessionStats.kills;
            updated = true;
        }
        // Check kill streak
        if (this.bestKillStreak > this.personalBests.bestKillStreak) {
            this.personalBests.bestKillStreak = this.bestKillStreak;
            updated = true;
        }
        if (updated) {
            this._savePersonalBests();
            Logger.info('[PerformanceMetricsSystem] 🏆 New personal best!');
        }
    }
    _showDeathStats() {
        const stats = {
            survivalTime: this.currentLife.survivalTime,
            kills: this.currentLife.kills,
            accuracy: this.currentLife.shots > 0 ? this.currentLife.hits / this.currentLife.shots : 0,
            damageDealt: this.currentLife.damageDealt,
            damageTaken: this.currentLife.damageTaken,
            kdRatio: this.getKDRatio(),
            sessionStats: {
                ...this.sessionStats
            },
            personalBests: {
                ...this.personalBests
            }
        };
        this.app.fire('ui:show_death_stats', stats);
    }
    _resetCurrentLife() {
        this.currentLife = {
            kills: 0,
            shots: 0,
            hits: 0,
            damageDealt: 0,
            damageTaken: 0,
            lifeStartTime: performance.now(),
            survivalTime: 0
        };
    }
    _updateStatsUI() {
        const stats = {
            kills: this.sessionStats.kills,
            deaths: this.sessionStats.deaths,
            kdRatio: this.getKDRatio(),
            accuracy: this.getAccuracy(),
            killStreak: this.currentKillStreak,
            survivalTime: (performance.now() - this.currentLife.lifeStartTime) / 1000
        };
        this.app.fire('ui:update_stats', stats);
    }
    /**
     * Get current K/D ratio
     */ getKDRatio() {
        if (this.sessionStats.deaths === 0) {
            return this.sessionStats.kills;
        }
        return this.sessionStats.kills / this.sessionStats.deaths;
    }
    /**
     * Get current accuracy percentage (0-1)
     */ getAccuracy() {
        if (this.sessionStats.shots === 0) return 0;
        return this.sessionStats.hits / this.sessionStats.shots;
    }
    /**
     * Get current survival time in seconds
     */ getCurrentSurvivalTime() {
        return (performance.now() - this.currentLife.lifeStartTime) / 1000;
    }
    /**
     * Get session summary
     */ getSessionSummary() {
        return {
            kills: this.sessionStats.kills,
            deaths: this.sessionStats.deaths,
            kdRatio: this.getKDRatio(),
            accuracy: this.getAccuracy(),
            bestKillStreak: this.bestKillStreak,
            totalPlayTime: (performance.now() - this.sessionStats.sessionStartTime) / 1000,
            weaponStats: {
                ...this.weaponStats
            },
            personalBests: {
                ...this.personalBests
            }
        };
    }
    update(dt) {
        // Update total play time
        this.sessionStats.totalPlayTime = (performance.now() - this.sessionStats.sessionStartTime) / 1000;
        // Check kill streak timeout
        this._checkKillStreakTimeout();
    }
    _checkKillStreakTimeout() {
        if (this.currentKillStreak === 0) return;
        if (this.killStreakTimestamps.length === 0) return;
        const now = performance.now();
        const lastKillTime = this.killStreakTimestamps[this.killStreakTimestamps.length - 1];
        // Break streak if no kill in timeout period
        if (now - lastKillTime > this.killStreakTimeout) {
            Logger.debug(`[PerformanceMetricsSystem] Kill streak broken (timeout) - was ${this.currentKillStreak}`);
            this.currentKillStreak = 0;
            this.killStreakTimestamps = [];
            this._updateStatsUI();
        }
    }
    _cleanup() {
        // Save final stats
        this._updatePersonalBests();
        if (this._eventsBound) {
            this.app.off('entity:died', this._onEntityDied, this);
            this.app.off('weapon:fired', this._onWeaponFired, this);
            this.app.off('entity:damaged', this._onEntityDamage, this);
            this.app.off('pickup:collected', this._onPickupCollected, this);
        }
        this._eventsBound = false;
        this.__pmsBooted = false;
        Logger.debug('[PerformanceMetricsSystem] Cleanup complete');
    }
}
_define_property(PerformanceMetricsSystem, "scriptName", 'performanceMetricsSystem');

export { PerformanceMetricsSystem };
