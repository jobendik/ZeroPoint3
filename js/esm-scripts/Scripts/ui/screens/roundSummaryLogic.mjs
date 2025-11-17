import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * RoundSummaryLogic - ESM Module Version
 * Manages round summary screen display and statistics
 * Observer pattern implementation for UI display only
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
/**
 * RoundSummaryLogic Class - ESM-based Round Summary Management
 * Internal helper class, not exported
 */ class RoundSummaryLogic {
    /**
     * Initialize round summary system
     */ initialize() {
        if (this._initialized) return;
        this._initialized = true;
        Logger.debug('[RoundSummary] Initializing ESM version...');
        // Find buttons (handled by other systems, but kept for reference)
        this._findButtons();
        // Map stat fields to text entities
        this._setupStatFields();
        // Setup event listeners
        this._setupEventListeners();
        Logger.debug('[RoundSummary] ESM version ready');
    }
    /**
     * Find button references
     */ _findButtons() {
        // Note: The click events for these buttons are handled by ButtonFactory
        // This script only needs references for appearance changes if needed
        this.rematchButton = this.entity.findByName('RematchButton');
        this.quitButton = this.entity.findByName('QuitToMenuButton');
        Logger.debug('[RoundSummary] Button Status:');
        Logger.debug('  Rematch:', this.rematchButton ? '✓ Found' : '✗ Missing');
        Logger.debug('  Quit:', this.quitButton ? '✓ Found' : '✗ Missing');
    }
    /**
     * Setup stat field mapping
     */ _setupStatFields() {
        // Create a map of stat names to the text entities that display them
        this._fields = {
            // Generic fields
            Score: this.entity.findByName('Score'),
            Time: this.entity.findByName('Time'),
            Accuracy: this.entity.findByName('Accuracy'),
            // Extended player fields
            PlayerKills: this.entity.findByName('PlayerKills'),
            PlayerDeaths: this.entity.findByName('PlayerDeaths'),
            PlayerAccuracy: this.entity.findByName('PlayerAccuracy'),
            PlayerDamage: this.entity.findByName('PlayerDamage'),
            PlayerKillStreak: this.entity.findByName('PlayerKillStreak'),
            PlayerDistance: this.entity.findByName('PlayerDistance'),
            PlayerItems: this.entity.findByName('PlayerItems'),
            // Round statistics
            RoundTime: this.entity.findByName('RoundTime'),
            FastestKill: this.entity.findByName('FastestKill'),
            BiggestHit: this.entity.findByName('BiggestHit'),
            TotalFootsteps: this.entity.findByName('TotalFootsteps'),
            WeaponSwitches: this.entity.findByName('WeaponSwitches'),
            BestAI: this.entity.findByName('BestAI'),
            AIAccuracy: this.entity.findByName('AIAccuracy')
        };
        // Log found fields
        const foundFields = Object.entries(this._fields).filter(([_, element])=>element !== null).map(([name, _])=>name);
        Logger.debug(`[RoundSummary] Found ${foundFields.length} stat fields:`, foundFields);
    }
    /**
     * Setup event listeners
     */ _setupEventListeners() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        // Listen to summary events (observer only)
        this.app.on('summary:show', this._onSummaryShow.bind(this));
        this.app.on('summary:hide', this._onSummaryHide.bind(this));
        // Listen to game manager events
        this.app.on('game:roundEnded', this._onRoundEnded.bind(this));
        this.app.on('game:sessionEnded', this._onSessionEnded.bind(this));
        Logger.debug('[RoundSummary] Event listeners setup complete');
    }
    /**
     * Handle summary show event
     */ _onSummaryShow(data) {
        Logger.debug('[RoundSummary] Summary show event received', data);
        this.showSummary(data);
    }
    /**
     * Handle summary hide event
     */ _onSummaryHide() {
        Logger.debug('[RoundSummary] Summary hide event received');
        this.hideSummary();
    }
    /**
     * Handle round ended event
     */ _onRoundEnded(data) {
        Logger.debug('[RoundSummary] Round ended, showing summary', data);
        this.showSummary(data);
    }
    /**
     * Handle session ended event
     */ _onSessionEnded(data) {
        Logger.debug('[RoundSummary] Session ended, showing summary (raw payload)', data);
        // SessionEvents.fireSessionEnded sends a wrapper { stats, reason, timestamp }
        // Normalize to the flat stats object expected by showSummary/_populateSummaryData
        const stats = data?.stats || data;
        Logger.debug('[RoundSummary] Normalized stats for summary:', stats);
        this.showSummary(stats);
    }
    /**
     * Helper function to safely set text on a UI element
     */ _setTextIfPresent(name, value) {
        const node = this._fields[name];
        if (node?.element) {
            node.element.text = String(value);
            Logger.debug(`[RoundSummary] ✓ Set ${name} = ${value}`);
        } else {
            Logger.warn(`[RoundSummary] ✗ Field ${name} not found or missing element`);
        }
    }
    /**
     * Format time duration to MM:SS format
     */ _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return m + ':' + s.toString().padStart(2, '0');
    }
    /**
     * Format accuracy percentage
     */ _formatAccuracy(accuracy) {
        return typeof accuracy === 'number' ? Math.round(accuracy) + '%' : String(accuracy);
    }
    /**
     * Show summary screen with data
     */ showSummary(data) {
        Logger.debug('[RoundSummary] Showing summary screen with data:', data);
        // Enable this entity to make the summary screen visible
        this.entity.enabled = true;
        // Fire event to hide HUD elements
        this.app.fire('menu:opened');
        // Populate text fields with data from the game session
        if (data) {
            this._populateSummaryData(data);
            Logger.debug('[RoundSummary] Summary data populated successfully');
        } else {
            Logger.warn('[RoundSummary] No data provided to showSummary');
        }
        // Fire event for UI manager and other systems
        this.app.fire('ui:summaryShown');
    }
    /**
     * Populate summary data fields
     */ _populateSummaryData(data) {
        Logger.debug('[RoundSummary] Populating data fields...', data);
        // Log each field being processed
        const logField = (fieldName, value)=>{
            Logger.debug(`[RoundSummary]   ${fieldName}: ${value}`);
        };
        // Basic stats
        if (data.score != null) {
            this._setTextIfPresent('Score', data.score);
            logField('score', data.score);
        }
        // Time formatting for multiple time fields
        if (data.time != null || data.duration != null) {
            const timeValue = data.duration != null ? data.duration : data.time;
            const formattedTime = this._formatTime(timeValue);
            this._setTextIfPresent('Time', formattedTime);
            this._setTextIfPresent('RoundTime', formattedTime);
            logField('time/duration', formattedTime);
        }
        // Accuracy formatting
        if (data.accuracy != null) {
            const formattedAccuracy = this._formatAccuracy(data.accuracy);
            this._setTextIfPresent('Accuracy', formattedAccuracy);
            this._setTextIfPresent('PlayerAccuracy', formattedAccuracy);
            logField('accuracy', formattedAccuracy);
        }
        // Player performance stats
        if (data.kills != null) {
            this._setTextIfPresent('PlayerKills', data.kills);
            logField('kills', data.kills);
        }
        if (data.deaths != null) {
            this._setTextIfPresent('PlayerDeaths', data.deaths);
            logField('deaths', data.deaths);
        }
        if (data.damageDealt != null) {
            this._setTextIfPresent('PlayerDamage', Math.round(data.damageDealt));
            logField('damageDealt', Math.round(data.damageDealt));
        }
        if (data.bestKillStreak != null) {
            this._setTextIfPresent('PlayerKillStreak', data.bestKillStreak);
            logField('bestKillStreak', data.bestKillStreak);
        }
        if (data.itemsPickedUp != null) {
            this._setTextIfPresent('PlayerItems', data.itemsPickedUp);
            logField('itemsPickedUp', data.itemsPickedUp);
        }
        // Distance with unit formatting
        if (data.distance != null) {
            this._setTextIfPresent('PlayerDistance', Math.round(data.distance) + 'm');
            logField('distance', Math.round(data.distance) + 'm');
        }
        // Combat stats
        if (data.biggestHit != null) {
            this._setTextIfPresent('BiggestHit', Math.round(data.biggestHit));
            logField('biggestHit', Math.round(data.biggestHit));
        }
        if (data.fastestKill != null) {
            this._setTextIfPresent('FastestKill', data.fastestKill + 's');
            logField('fastestKill', data.fastestKill + 's');
        }
        // Gameplay metrics
        if (data.footsteps != null) {
            this._setTextIfPresent('TotalFootsteps', data.footsteps);
            logField('footsteps', data.footsteps);
        }
        if (data.weaponSwitches != null) {
            this._setTextIfPresent('WeaponSwitches', data.weaponSwitches);
            logField('weaponSwitches', data.weaponSwitches);
        }
        // AI performance
        if (data.bestAI != null) {
            this._setTextIfPresent('BestAI', data.bestAI);
            logField('bestAI', data.bestAI);
        }
        if (data.aiAccuracy != null) {
            this._setTextIfPresent('AIAccuracy', Math.round(data.aiAccuracy) + '%');
            logField('aiAccuracy', Math.round(data.aiAccuracy) + '%');
        }
        Logger.debug('[RoundSummary] Summary data population complete');
    }
    /**
     * Hide summary screen
     */ hideSummary() {
        Logger.debug('[RoundSummary] Hiding summary screen');
        this.entity.enabled = false;
        // Fire event to show HUD elements
        this.app.fire('menu:closed');
        // Fire event for UI manager
        this.app.fire('ui:summaryHidden');
    }
    /**
     * Toggle summary visibility
     */ toggle() {
        if (this.entity.enabled) {
            this.hideSummary();
        } else {
            this.showSummary();
        }
    }
    /**
     * Check if summary is currently visible
     */ isVisible() {
        return this.entity.enabled;
    }
    /**
     * Get current summary data (if needed for external access)
     */ getCurrentData() {
        const data = {};
        // Extract current values from UI fields
        Object.entries(this._fields).forEach(([key, element])=>{
            if (element?.element?.text) {
                data[key] = element.element.text;
            }
        });
        return data;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup event listeners
     */ _cleanup() {
        if (!this._eventsBound) return;
        this.app.off('summary:show', this._onSummaryShow.bind(this));
        this.app.off('summary:hide', this._onSummaryHide.bind(this));
        this.app.off('game:roundEnded', this._onRoundEnded.bind(this));
        this.app.off('game:sessionEnded', this._onSessionEnded.bind(this));
        this._eventsBound = false;
    }
    /**
     * Destroy round summary logic
     */ destroy() {
        if (!this._initialized) return;
        this._cleanup();
        // Clear references
        this._fields = {};
        this.rematchButton = null;
        this.quitButton = null;
        this._initialized = false;
        Logger.debug('[RoundSummary] Cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Button references
        this.rematchButton = null;
        this.quitButton = null;
        // Field mapping for statistics display
        this._fields = {};
        // State tracking
        this._initialized = false;
        this._eventsBound = false;
        Logger.debug('[RoundSummary] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for RoundSummaryLogic (Modern ESM Version)
 */ class RoundSummaryLogicScript extends Script {
    initialize() {
        // Create ESM instance
        this.roundSummary = new RoundSummaryLogic(this.app, this.entity);
        this.roundSummary.initialize();
        // Make available on entity for external access
        this.entity.roundSummary = this.roundSummary;
    }
    showSummary(data) {
        if (this.roundSummary) {
            this.roundSummary.showSummary(data);
        }
    }
    hideSummary() {
        if (this.roundSummary) {
            this.roundSummary.hideSummary();
        }
    }
    destroy() {
        if (this.roundSummary) {
            this.roundSummary.destroy();
            this.roundSummary = null;
            this.entity.roundSummary = null;
        }
    }
}
_define_property(RoundSummaryLogicScript, "scriptName", 'roundSummaryLogic');
_define_property(RoundSummaryLogicScript, "attributes", {});

export { RoundSummaryLogicScript };
