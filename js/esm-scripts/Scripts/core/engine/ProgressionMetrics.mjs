import { Logger } from './logger.mjs';

class ProgressionMetrics {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        if (this._initialized) {
            Logger.debug('[ProgressionMetrics] Already initialized');
            return;
        }
        Logger.info('[ProgressionMetrics] Initializing progression tracking...');
        // Setup event listeners
        this._setupEventListeners();
        this._initialized = true;
        Logger.info('[ProgressionMetrics] ✅ Progression tracking ready');
    }
    _setupEventListeners() {
        // Kill tracking
        this.app.on('entity:died', this._onEntityDied.bind(this));
        this.app.on('player:killed', this._onPlayerKill.bind(this));
        this.app.on('headshot:confirmed', this._onHeadshotConfirmed.bind(this));
        // Weapon tracking
        this.app.on('weapon:fired', this._onWeaponFired.bind(this));
        this.app.on('weapon:hit', this._onWeaponHit.bind(this));
        // Session lifecycle
        this.app.on('game:sessionStarted', this._onSessionStarted.bind(this));
        this.app.on('game:sessionEnded', this._onSessionEnded.bind(this));
        Logger.debug('[ProgressionMetrics] Event listeners registered');
    }
    // ============================================================================
    // SESSION LIFECYCLE
    // ============================================================================
    _onSessionStarted() {
        Logger.debug('[ProgressionMetrics] Session started - resetting progression');
        // Reset current session data
        this.progression.headshots = 0;
        this.progression.totalKills = 0;
        this.progression.headshotPercentage = 0;
        this.progression.currentStreak = 0;
        this.progression.streakHistory = [];
        this.progression.survivalStartTime = performance.now() / 1000;
        this.progression.currentSurvivalTime = 0;
        this.progression.weaponStats = {};
        this.progression.lastAccuracyUpdate = 0;
        // Reset highlights for this session
        this.progression.highlights = {
            bestKillStreak: {
                count: 0,
                timestamp: 0
            },
            longestShot: {
                distance: 0,
                timestamp: 0
            },
            fastestKill: {
                time: 0,
                timestamp: 0
            },
            mostHeadshots: {
                count: 0,
                timestamp: 0
            }
        };
    }
    _onSessionEnded() {
        Logger.debug('[ProgressionMetrics] Session ended - finalizing progression');
        // Finalize current survival time
        const now = performance.now() / 1000;
        this.progression.currentSurvivalTime = now - this.progression.survivalStartTime;
        // Update longest survival if needed
        if (this.progression.currentSurvivalTime > this.progression.longestSurvivalTime) {
            this.progression.longestSurvivalTime = this.progression.currentSurvivalTime;
        }
        // Calculate final headshot percentage
        this._updateHeadshotPercentage();
        // Determine favorite weapon
        this._determineFavoriteWeapon();
        // Save to persistent storage
        this._saveSessionToHistory();
        Logger.info('[ProgressionMetrics] Session finalized', {
            headshots: this.progression.headshots,
            headshotPct: this.progression.headshotPercentage,
            longestStreak: this.progression.longestStreak,
            survivalTime: Math.round(this.progression.currentSurvivalTime)
        });
    }
    // ============================================================================
    // KILL TRACKING
    // ============================================================================
    _onEntityDied(data) {
        const { entity, attacker, isHeadshot } = data;
        // Only track player kills
        if (!attacker || !this._isPlayer(attacker)) return;
        this.progression.totalKills++;
        // Update kill streak
        this.progression.currentStreak++;
        // Update longest streak
        if (this.progression.currentStreak > this.progression.longestStreak) {
            this.progression.longestStreak = this.progression.currentStreak;
            // Update highlight
            this.progression.highlights.bestKillStreak = {
                count: this.progression.currentStreak,
                timestamp: performance.now() / 1000
            };
            // Fire event for UI notification
            this.app.fire('progression:streakRecord', {
                streak: this.progression.currentStreak
            });
        }
        // Add to streak history
        this.progression.streakHistory.push({
            count: this.progression.currentStreak,
            timestamp: performance.now() / 1000
        });
        // Track headshot if applicable
        if (isHeadshot) {
            this._onHeadshotConfirmed(data);
        }
        Logger.debug('[ProgressionMetrics] Kill tracked', {
            totalKills: this.progression.totalKills,
            currentStreak: this.progression.currentStreak
        });
    }
    _onPlayerKill(data) {
    // Additional player kill tracking if needed
    // This can be used for special kill types (melee, explosive, etc.)
    }
    _onHeadshotConfirmed(data) {
        this.progression.headshots++;
        // Update headshot percentage
        this._updateHeadshotPercentage();
        // Update highlight if this is a new record
        if (this.progression.headshots > this.progression.highlights.mostHeadshots.count) {
            this.progression.highlights.mostHeadshots = {
                count: this.progression.headshots,
                timestamp: performance.now() / 1000
            };
        }
        // Fire event for HUD update
        this.app.fire('progression:headshotUpdate', {
            headshots: this.progression.headshots,
            percentage: this.progression.headshotPercentage
        });
        Logger.debug('[ProgressionMetrics] Headshot tracked', {
            headshots: this.progression.headshots,
            percentage: this.progression.headshotPercentage
        });
    }
    _updateHeadshotPercentage() {
        if (this.progression.totalKills === 0) {
            this.progression.headshotPercentage = 0;
        } else {
            this.progression.headshotPercentage = this.progression.headshots / this.progression.totalKills * 100;
        }
    }
    // Reset kill streak (called when player takes damage or dies)
    resetKillStreak() {
        if (this.progression.currentStreak > 0) {
            Logger.debug('[ProgressionMetrics] Kill streak reset', {
                previousStreak: this.progression.currentStreak
            });
            this.progression.currentStreak = 0;
            // Fire event for UI
            this.app.fire('progression:streakReset');
        }
    }
    // ============================================================================
    // WEAPON TRACKING
    // ============================================================================
    _onWeaponFired(data) {
        const { shooter, weapon, weaponName } = data;
        // Only track player weapon usage
        if (!this._isPlayer(shooter)) return;
        const name = weaponName || weapon?.name || 'Unknown';
        // Initialize weapon stats if needed
        if (!this.progression.weaponStats[name]) {
            this.progression.weaponStats[name] = {
                kills: 0,
                headshots: 0,
                shots: 0,
                hits: 0,
                damage: 0,
                accuracy: 0
            };
        }
        this.progression.weaponStats[name].shots++;
        // Check if we should update accuracy display (every 5 shots)
        const totalShots = this.sessionMetrics?.stats?.shotsFired || 0;
        if (totalShots - this.progression.lastAccuracyUpdate >= this.progression.shotsForAccuracyUpdate) {
            this.progression.lastAccuracyUpdate = totalShots;
            // Fire event for HUD accuracy update
            const currentAccuracy = this.sessionMetrics?.calculateAccuracy() || 0;
            this.app.fire('progression:accuracyUpdate', {
                accuracy: currentAccuracy,
                shots: totalShots
            });
        }
    }
    _onWeaponHit(data) {
        const { shooter, weapon, weaponName } = data;
        // Only track player weapon hits
        if (!this._isPlayer(shooter)) return;
        const name = weaponName || weapon?.name || 'Unknown';
        if (this.progression.weaponStats[name]) {
            this.progression.weaponStats[name].hits++;
            // Update weapon accuracy
            const stats = this.progression.weaponStats[name];
            stats.accuracy = stats.shots > 0 ? stats.hits / stats.shots * 100 : 0;
        }
    }
    _determineFavoriteWeapon() {
        let maxKills = 0;
        let favorite = 'None';
        Object.entries(this.progression.weaponStats).forEach(([name, stats])=>{
            if (stats.kills > maxKills) {
                maxKills = stats.kills;
                favorite = name;
            }
        });
        this.progression.favoriteWeapon = favorite;
        Logger.debug('[ProgressionMetrics] Favorite weapon:', favorite);
    }
    // ============================================================================
    // SURVIVAL TIME TRACKING
    // ============================================================================
    updateSurvivalTime() {
        const now = performance.now() / 1000;
        this.progression.currentSurvivalTime = now - this.progression.survivalStartTime;
        return this.progression.currentSurvivalTime;
    }
    getSurvivalTime() {
        return this.progression.currentSurvivalTime;
    }
    // ============================================================================
    // PERSISTENT STORAGE
    // ============================================================================
    _loadPersistentData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                Logger.debug('[ProgressionMetrics] Loaded persistent data from localStorage');
                return data;
            }
        } catch (error) {
            Logger.warn('[ProgressionMetrics] Failed to load persistent data:', error);
        }
        // Return default structure
        return {
            totalSessions: 0,
            sessionHistory: [],
            personalBests: {
                longestSurvivalTime: 0,
                mostKills: 0,
                bestKDRatio: 0,
                bestAccuracy: 0,
                longestKillStreak: 0,
                mostHeadshots: 0
            },
            allTimeStats: {
                totalKills: 0,
                totalDeaths: 0,
                totalHeadshots: 0,
                totalShotsFired: 0,
                totalShotsHit: 0
            }
        };
    }
    _saveSessionToHistory() {
        const sessionData = {
            timestamp: Date.now(),
            duration: this.progression.currentSurvivalTime,
            kills: this.progression.totalKills,
            deaths: this.sessionMetrics?.stats?.deaths || 0,
            headshots: this.progression.headshots,
            headshotPercentage: this.progression.headshotPercentage,
            accuracy: this.sessionMetrics?.stats?.accuracy || 0,
            longestStreak: this.progression.longestStreak,
            favoriteWeapon: this.progression.favoriteWeapon,
            kdRatio: this._calculateKDRatio()
        };
        // Add to session history (keep last 10)
        this.persistentData.sessionHistory.unshift(sessionData);
        if (this.persistentData.sessionHistory.length > 10) {
            this.persistentData.sessionHistory.pop();
        }
        // Update total sessions
        this.persistentData.totalSessions++;
        // Update personal bests
        this._updatePersonalBests(sessionData);
        // Update all-time stats
        this._updateAllTimeStats();
        // Save to localStorage
        this._savePersistentData();
        Logger.info('[ProgressionMetrics] Session saved to history');
    }
    _updatePersonalBests(sessionData) {
        const bests = this.persistentData.personalBests;
        if (sessionData.duration > bests.longestSurvivalTime) {
            bests.longestSurvivalTime = sessionData.duration;
            Logger.info('[ProgressionMetrics] 🏆 New survival time record!', Math.round(sessionData.duration));
        }
        if (sessionData.kills > bests.mostKills) {
            bests.mostKills = sessionData.kills;
            Logger.info('[ProgressionMetrics] 🏆 New kill record!', sessionData.kills);
        }
        if (sessionData.kdRatio > bests.bestKDRatio) {
            bests.bestKDRatio = sessionData.kdRatio;
            Logger.info('[ProgressionMetrics] 🏆 New K/D ratio record!', sessionData.kdRatio.toFixed(2));
        }
        if (sessionData.accuracy > bests.bestAccuracy) {
            bests.bestAccuracy = sessionData.accuracy;
            Logger.info('[ProgressionMetrics] 🏆 New accuracy record!', sessionData.accuracy.toFixed(1) + '%');
        }
        if (sessionData.longestStreak > bests.longestKillStreak) {
            bests.longestKillStreak = sessionData.longestStreak;
            Logger.info('[ProgressionMetrics] 🏆 New kill streak record!', sessionData.longestStreak);
        }
        if (sessionData.headshots > bests.mostHeadshots) {
            bests.mostHeadshots = sessionData.headshots;
            Logger.info('[ProgressionMetrics] 🏆 New headshot record!', sessionData.headshots);
        }
    }
    _updateAllTimeStats() {
        const allTime = this.persistentData.allTimeStats;
        const session = this.sessionMetrics?.stats;
        if (session) {
            allTime.totalKills += this.progression.totalKills;
            allTime.totalDeaths += session.deaths || 0;
            allTime.totalHeadshots += this.progression.headshots;
            allTime.totalShotsFired += session.shotsFired || 0;
            allTime.totalShotsHit += session.shotsHit || 0;
        }
    }
    _savePersistentData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.persistentData));
            Logger.debug('[ProgressionMetrics] Persistent data saved to localStorage');
        } catch (error) {
            Logger.error('[ProgressionMetrics] Failed to save persistent data:', error);
        }
    }
    // ============================================================================
    // PUBLIC API
    // ============================================================================
    getCurrentProgression() {
        return {
            ...this.progression,
            survivalTime: this.updateSurvivalTime(),
            kdRatio: this._calculateKDRatio()
        };
    }
    getPersonalBests() {
        return this.persistentData.personalBests;
    }
    getSessionHistory() {
        return this.persistentData.sessionHistory;
    }
    getAllTimeStats() {
        return this.persistentData.allTimeStats;
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    _calculateKDRatio() {
        const deaths = this.sessionMetrics?.stats?.deaths || 0;
        const kills = this.progression.totalKills;
        if (deaths === 0) {
            return kills > 0 ? kills : 0;
        }
        return kills / deaths;
    }
    _isPlayer(entity) {
        if (!entity) return false;
        return entity.tags && (entity.tags.has('player') || entity.tags.has('team_player'));
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    cleanup() {
        // Remove event listeners
        this.app.off('entity:died', this._onEntityDied.bind(this));
        this.app.off('player:killed', this._onPlayerKill.bind(this));
        this.app.off('headshot:confirmed', this._onHeadshotConfirmed.bind(this));
        this.app.off('weapon:fired', this._onWeaponFired.bind(this));
        this.app.off('weapon:hit', this._onWeaponHit.bind(this));
        this.app.off('game:sessionStarted', this._onSessionStarted.bind(this));
        this.app.off('game:sessionEnded', this._onSessionEnded.bind(this));
        this._initialized = false;
        Logger.debug('[ProgressionMetrics] Cleaned up');
    }
    constructor(app, sessionMetrics){
        this.app = app;
        this.sessionMetrics = sessionMetrics;
        // Current session progression data
        this.progression = {
            // Headshot tracking
            headshots: 0,
            totalKills: 0,
            headshotPercentage: 0,
            // Kill streak tracking
            currentStreak: 0,
            longestStreak: 0,
            streakHistory: [],
            // Survival tracking
            survivalStartTime: 0,
            currentSurvivalTime: 0,
            longestSurvivalTime: 0,
            // Weapon performance tracking
            weaponStats: {},
            favoriteWeapon: null,
            // Highlight moments
            highlights: {
                bestKillStreak: {
                    count: 0,
                    timestamp: 0
                },
                longestShot: {
                    distance: 0,
                    timestamp: 0
                },
                fastestKill: {
                    time: 0,
                    timestamp: 0
                },
                mostHeadshots: {
                    count: 0,
                    timestamp: 0
                }
            },
            // Accuracy tracking (live updates every 5 shots)
            shotsForAccuracyUpdate: 5,
            lastAccuracyUpdate: 0
        };
        // Persistent storage key
        this.storageKey = 'fps_game_progression';
        // Load persistent data
        this.persistentData = this._loadPersistentData();
        // Initialize flag
        this._initialized = false;
    }
}

export { ProgressionMetrics };
