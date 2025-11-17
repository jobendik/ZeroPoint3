import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

/**
 * PostMatchScreen - Enhanced Post-Death/Session Performance Display
 * 
 * Shows detailed performance breakdown after death or session end:
 * - K/D ratio
 * - Headshot percentage
 * - Longest survival time
 * - Favorite weapon
 * - Highlight moment (best kill streak)
 * - Personal bests comparison
 * 
 * Integrates with ProgressionMetrics and SessionMetrics.
 */ function _define_property(obj, key, value) {
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
class PostMatchScreen {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        if (this._initialized) {
            Logger.debug('[PostMatchScreen] Already initialized');
            return;
        }
        Logger.info('[PostMatchScreen] Initializing post-match screen...');
        // Find UI elements
        this._findUIElements();
        // Verify elements
        this._logElementStatus();
        // Setup event listeners
        this._setupEventListeners();
        // Hide initially
        this.hide();
        this._initialized = true;
        Logger.info('[PostMatchScreen] ✅ Post-match screen ready');
    }
    _findUIElements() {
        // Main stats
        this.killsText = this.entity.findByName('KillsValue');
        this.deathsText = this.entity.findByName('DeathsValue');
        this.kdRatioText = this.entity.findByName('KDRatioValue');
        this.headshotPercentageText = this.entity.findByName('HeadshotPercentage');
        this.accuracyText = this.entity.findByName('AccuracyValue');
        this.survivalTimeText = this.entity.findByName('SurvivalTime');
        this.favoriteWeaponText = this.entity.findByName('FavoriteWeapon');
        // Highlight moment
        this.highlightTitleText = this.entity.findByName('HighlightTitle');
        this.highlightValueText = this.entity.findByName('HighlightValue');
        // Personal bests
        this.bestSurvivalText = this.entity.findByName('BestSurvivalTime');
        this.bestKillsText = this.entity.findByName('BestKills');
        this.bestKDText = this.entity.findByName('BestKD');
        this.bestAccuracyText = this.entity.findByName('BestAccuracy');
        this.bestStreakText = this.entity.findByName('BestStreak');
        // New record badge
        this.newRecordBadge = this.entity.findByName('NewRecordBadge');
        // Buttons (handled by ButtonFactory, but we need references)
        this.continueButton = this.entity.findByName('ContinueButton');
        this.retryButton = this.entity.findByName('RetryButton');
    }
    _logElementStatus() {
        Logger.debug('[PostMatchScreen] UI Elements Status:');
        Logger.debug('  KillsValue:', this.killsText ? '✓' : '✗');
        Logger.debug('  DeathsValue:', this.deathsText ? '✓' : '✗');
        Logger.debug('  KDRatioValue:', this.kdRatioText ? '✓' : '✗');
        Logger.debug('  HeadshotPercentage:', this.headshotPercentageText ? '✓' : '✗');
        Logger.debug('  AccuracyValue:', this.accuracyText ? '✓' : '✗');
        Logger.debug('  SurvivalTime:', this.survivalTimeText ? '✓' : '✗');
        Logger.debug('  FavoriteWeapon:', this.favoriteWeaponText ? '✓' : '✗');
        Logger.debug('  Personal Bests:', this.bestSurvivalText && this.bestKillsText && this.bestKDText && this.bestAccuracyText && this.bestStreakText ? '✓ All Found' : '✗ Some Missing');
    }
    _setupEventListeners() {
        // Session events
        this.app.on('game:sessionEnded', this._onSessionEnded.bind(this));
        this.app.on('player:died', this._onPlayerDied.bind(this));
        // Manual show/hide events
        this.app.on('postMatch:show', this.show.bind(this));
        this.app.on('postMatch:hide', this.hide.bind(this));
        Logger.debug('[PostMatchScreen] Event listeners registered');
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    _onSessionEnded(data) {
        Logger.debug('[PostMatchScreen] Session ended, showing post-match screen');
        // Get progression data
        const progressionMetrics = this.app.gameManager?.progressionMetrics;
        const sessionMetrics = this.app.gameManager?.gameSession?.sessionMetrics;
        if (!progressionMetrics || !sessionMetrics) {
            Logger.warn('[PostMatchScreen] Missing metrics, cannot show screen');
            return;
        }
        // Prepare data for display
        const progression = progressionMetrics.getCurrentProgression();
        const stats = sessionMetrics.getStats();
        const personalBests = progressionMetrics.getPersonalBests();
        const displayData = {
            kills: progression.totalKills,
            deaths: stats.deaths || 0,
            kdRatio: this._calculateKDRatio(progression.totalKills, stats.deaths),
            headshotPercentage: progression.headshotPercentage,
            accuracy: stats.accuracy || 0,
            survivalTime: progression.survivalTime,
            favoriteWeapon: progression.favoriteWeapon || 'None',
            longestStreak: progression.longestStreak,
            personalBests: personalBests,
            highlights: progression.highlights
        };
        // Show the screen with data
        this.showWithData(displayData);
    }
    _onPlayerDied(data) {
        // Optional: Show simplified post-death screen
        // For now, only show full screen on session end
        Logger.debug('[PostMatchScreen] Player died (full screen shows on session end)');
    }
    // ============================================================================
    // DISPLAY LOGIC
    // ============================================================================
    showWithData(data) {
        Logger.info('[PostMatchScreen] Showing post-match screen with data:', data);
        // Populate main stats
        this._setTextIfPresent(this.killsText, data.kills);
        this._setTextIfPresent(this.deathsText, data.deaths);
        this._setTextIfPresent(this.kdRatioText, data.kdRatio.toFixed(2));
        this._setTextIfPresent(this.headshotPercentageText, data.headshotPercentage.toFixed(1) + '%');
        this._setTextIfPresent(this.accuracyText, data.accuracy.toFixed(1) + '%');
        this._setTextIfPresent(this.survivalTimeText, this._formatTime(data.survivalTime));
        this._setTextIfPresent(this.favoriteWeaponText, data.favoriteWeapon);
        // Show highlight moment
        this._displayHighlightMoment(data.highlights, data.longestStreak);
        // Show personal bests
        this._displayPersonalBests(data.personalBests);
        // Check for new records
        const hasNewRecords = this._checkForNewRecords(data, data.personalBests);
        if (hasNewRecords && this.newRecordBadge) {
            this.newRecordBadge.enabled = true;
            this._animateNewRecordBadge();
        } else if (this.newRecordBadge) {
            this.newRecordBadge.enabled = false;
        }
        // Show the screen
        this.show();
    }
    _displayHighlightMoment(highlights, longestStreak) {
        // Determine the best highlight to show
        let highlightTitle = 'Best Moment';
        let highlightValue = 'None';
        // Priority: Longest kill streak > Most headshots > Longest shot
        if (longestStreak > 0) {
            highlightTitle = '🔥 Kill Streak';
            highlightValue = `${longestStreak} in a row!`;
        } else if (highlights.mostHeadshots.count > 0) {
            highlightTitle = '🎯 Headshot Master';
            highlightValue = `${highlights.mostHeadshots.count} headshots`;
        } else if (highlights.longestShot.distance > 0) {
            highlightTitle = '🎯 Longest Shot';
            highlightValue = `${Math.round(highlights.longestShot.distance)}m`;
        } else if (highlights.fastestKill.time > 0) {
            highlightTitle = '⚡ Fastest Kill';
            highlightValue = `${highlights.fastestKill.time.toFixed(1)}s`;
        }
        this._setTextIfPresent(this.highlightTitleText, highlightTitle);
        this._setTextIfPresent(this.highlightValueText, highlightValue);
        Logger.debug('[PostMatchScreen] Highlight moment:', highlightTitle, highlightValue);
    }
    _displayPersonalBests(personalBests) {
        this._setTextIfPresent(this.bestSurvivalText, this._formatTime(personalBests.longestSurvivalTime));
        this._setTextIfPresent(this.bestKillsText, personalBests.mostKills.toString());
        this._setTextIfPresent(this.bestKDText, personalBests.bestKDRatio.toFixed(2));
        this._setTextIfPresent(this.bestAccuracyText, personalBests.bestAccuracy.toFixed(1) + '%');
        this._setTextIfPresent(this.bestStreakText, personalBests.longestKillStreak.toString());
        Logger.debug('[PostMatchScreen] Personal bests displayed');
    }
    _checkForNewRecords(currentData, personalBests) {
        const newRecords = [];
        if (currentData.survivalTime >= personalBests.longestSurvivalTime) {
            newRecords.push('Survival Time');
        }
        if (currentData.kills >= personalBests.mostKills) {
            newRecords.push('Kills');
        }
        if (currentData.kdRatio >= personalBests.bestKDRatio) {
            newRecords.push('K/D Ratio');
        }
        if (currentData.accuracy >= personalBests.bestAccuracy) {
            newRecords.push('Accuracy');
        }
        if (currentData.longestStreak >= personalBests.longestKillStreak) {
            newRecords.push('Kill Streak');
        }
        if (newRecords.length > 0) {
            Logger.info('[PostMatchScreen] 🏆 NEW RECORDS:', newRecords.join(', '));
            return true;
        }
        return false;
    }
    // ============================================================================
    // VISIBILITY CONTROL
    // ============================================================================
    show() {
        if (this.entity) {
            this.entity.enabled = true;
            this._isVisible = true;
            // Fire event to hide HUD elements
            this.app.fire('menu:opened');
            // Fire event
            this.app.fire('ui:postMatchShown');
            Logger.debug('[PostMatchScreen] Screen shown');
        }
    }
    hide() {
        if (this.entity) {
            this.entity.enabled = false;
            this._isVisible = false;
            // Fire event to show HUD elements
            this.app.fire('menu:closed');
            // Fire event
            this.app.fire('ui:postMatchHidden');
            Logger.debug('[PostMatchScreen] Screen hidden');
        }
    }
    isVisible() {
        return this._isVisible;
    }
    // ============================================================================
    // VISUAL EFFECTS
    // ============================================================================
    _animateNewRecordBadge() {
        if (!this.newRecordBadge) return;
        Logger.info('[PostMatchScreen] 🎉 Animating new record badge!');
        // Pulse animation
        let pulseCount = 0;
        const pulseInterval = setInterval(()=>{
            if (!this.newRecordBadge || this.newRecordBadge.destroyed) {
                clearInterval(pulseInterval);
                return;
            }
            const originalScale = this.newRecordBadge.getLocalScale().clone();
            // Scale up
            this.newRecordBadge.setLocalScale(originalScale.x * 1.3, originalScale.y * 1.3, originalScale.z);
            // Scale back down
            setTimeout(()=>{
                if (this.newRecordBadge && !this.newRecordBadge.destroyed) {
                    this.newRecordBadge.setLocalScale(originalScale.x, originalScale.y, originalScale.z);
                }
            }, 300);
            pulseCount++;
            if (pulseCount >= 3) {
                clearInterval(pulseInterval);
            }
        }, 600);
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    _setTextIfPresent(element, value) {
        if (element?.element) {
            element.element.text = String(value);
        }
    }
    _formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    _calculateKDRatio(kills, deaths) {
        if (deaths === 0) {
            return kills > 0 ? kills : 0;
        }
        return kills / deaths;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (!this._initialized) return;
        // Remove event listeners
        this.app.off('game:sessionEnded', this._onSessionEnded.bind(this));
        this.app.off('player:died', this._onPlayerDied.bind(this));
        this.app.off('postMatch:show', this.show.bind(this));
        this.app.off('postMatch:hide', this.hide.bind(this));
        this._initialized = false;
        Logger.debug('[PostMatchScreen] Cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // UI element references - Main Stats
        this.killsText = null;
        this.deathsText = null;
        this.kdRatioText = null;
        this.headshotPercentageText = null;
        this.accuracyText = null;
        this.survivalTimeText = null;
        this.favoriteWeaponText = null;
        // Highlight moment
        this.highlightTitleText = null;
        this.highlightValueText = null;
        // Personal bests section
        this.bestSurvivalText = null;
        this.bestKillsText = null;
        this.bestKDText = null;
        this.bestAccuracyText = null;
        this.bestStreakText = null;
        // New record indicators (icons/badges)
        this.newRecordBadge = null;
        // Buttons
        this.continueButton = null;
        this.retryButton = null;
        // State
        this._initialized = false;
        this._isVisible = false;
        Logger.debug('[PostMatchScreen] Instance created');
    }
}
/**
 * PlayCanvas Script Adapter for PostMatchScreen
 */ class PostMatchScreenScript extends Script {
    initialize() {
        this.postMatchScreen = new PostMatchScreen(this.app, this.entity);
        this.postMatchScreen.initialize();
        // Make available on entity
        this.entity.postMatchScreen = this.postMatchScreen;
    }
    destroy() {
        if (this.postMatchScreen) {
            this.postMatchScreen.destroy();
            this.postMatchScreen = null;
            this.entity.postMatchScreen = null;
        }
    }
}
_define_property(PostMatchScreenScript, "scriptName", 'postMatchScreen');
_define_property(PostMatchScreenScript, "attributes", {});

export { PostMatchScreen, PostMatchScreenScript };
