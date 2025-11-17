import { Color, Entity, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT, Vec2 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

/**
 * UIComponents - UI component management and element handling
 * Handles UI element caching, HUD updates, and component interactions
 */ class UIComponents {
    /**
     * Cache UI elements for efficient access
     */ cacheUIElements(uiScreens) {
        Logger.info('[UIComponents] 🔍 Caching UI elements...');
        // HUD Elements
        const hud = uiScreens.gameHUD;
        if (hud) {
            Logger.info('[UIComponents] Found gameHUD, searching for elements...');
            this.hudElements = {
                timer: hud.findByName('Timer'),
                healthBar: hud.findByName('HealthBar'),
                ammoCount: hud.findByName('AmmoCount'),
                countdownText: hud.findByName('CountdownText'),
                damageVignette: hud.findByName('DamageVignette')
            };
            // Log which elements were found
            Logger.info('[UIComponents] Cached HUD elements:', {
                timer: !!this.hudElements.timer,
                healthBar: !!this.hudElements.healthBar,
                ammoCount: !!this.hudElements.ammoCount,
                countdownText: !!this.hudElements.countdownText,
                damageVignette: !!this.hudElements.damageVignette
            });
            if (!this.hudElements.countdownText) {
                Logger.warn('[UIComponents] ⚠️ CountdownText element NOT FOUND in gameHUD!');
                Logger.warn('[UIComponents] Please ensure a UI element named "CountdownText" exists in the scene');
                Logger.warn('[UIComponents] Will attempt to create fallback countdown display');
            } else {
                Logger.info('[UIComponents] ✅ CountdownText element found successfully');
            }
            if (this.hudElements.healthBar?.element) {
                this._originalHealthWidth = this.hudElements.healthBar.element.width;
            }
        } else {
            Logger.error('[UIComponents] ❌ gameHUD not found in uiScreens!');
        }
        // Summary Elements
        const summary = uiScreens.roundSummaryScreen;
        if (summary) {
            this.summaryElements = {
                kills: summary.findByName('PlayerKills'),
                deaths: summary.findByName('PlayerDeaths'),
                accuracy: summary.findByName('PlayerAccuracy'),
                damageDealt: summary.findByName('PlayerDamage'),
                killStreak: summary.findByName('PlayerKillStreak'),
                itemsPickedUp: summary.findByName('PlayerItems'),
                roundTime: summary.findByName('RoundTime'),
                biggestHit: summary.findByName('BiggestHit')
            };
        }
        Logger.debug('[UIComponents] UI elements cached');
    }
    // ============================================================================
    // HUD UPDATES
    // ============================================================================
    /**
     * Update timer display
     */ updateTimer(timeRemaining) {
        if (!this.hudElements?.timer?.element) return;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        this.hudElements.timer.element.text = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    /**
     * Update health display
     */ updateHealth(current, max) {
        if (!this.hudElements?.healthBar?.element) return;
        const percentage = Math.max(0, Math.min(1, current / Math.max(1, max)));
        // Update width
        this.hudElements.healthBar.element.width = this._originalHealthWidth * percentage;
        // Update color based on health percentage
        if (percentage < 0.25) {
            this.hudElements.healthBar.element.color = new Color(1, 0, 0); // Red
        } else if (percentage < 0.5) {
            this.hudElements.healthBar.element.color = new Color(1, 1, 0); // Yellow
        } else {
            this.hudElements.healthBar.element.color = new Color(0, 1, 0); // Green
        }
    }
    /**
     * Update ammo display
     */ updateAmmo(current, total) {
        if (!this.hudElements?.ammoCount?.element) return;
        this.hudElements.ammoCount.element.text = `${current}/${total}`;
    }
    /**
     * Show countdown
     */ showCountdown(count) {
        if (!this.hudElements?.countdownText) {
            Logger.warn('[UIComponents] CountdownText element not found - creating fallback');
            this._createFallbackCountdown();
        }
        if (!this.hudElements?.countdownText) {
            Logger.error('[UIComponents] Failed to create countdown element - cannot show countdown');
            return;
        }
        Logger.debug(`[UIComponents] Showing countdown: ${count}`);
        this.hudElements.countdownText.enabled = true;
        if (this.hudElements.countdownText.element) {
            this.hudElements.countdownText.element.text = count > 0 ? String(count) : 'GO!';
            Logger.debug(`[UIComponents] Countdown text set to: ${this.hudElements.countdownText.element.text}`);
        } else {
            Logger.warn('[UIComponents] CountdownText entity exists but has no element component');
        }
    }
    /**
     * Hide countdown
     */ hideCountdown() {
        if (this.hudElements?.countdownText) {
            this.hudElements.countdownText.enabled = false;
        }
    }
    // ============================================================================
    // DAMAGE VIGNETTE MANAGEMENT
    // ============================================================================
    /**
     * Show damage vignette effect
     */ showDamageVignette(intensity = aiConfig.ui.DAMAGE_VIGNETTE_INTENSITY_DEFAULT, duration = aiConfig.ui.DAMAGE_VIGNETTE_DURATION_DEFAULT) {
        if (!this.hudElements?.damageVignette) {
            Logger.warn('[UIComponents] DamageVignette element not found - creating fallback overlay');
            this._createFallbackVignette();
        }
        const vignette = this.hudElements.damageVignette;
        if (!vignette) return;
        // Clear any existing vignette timer
        if (this._vignetteTimer) {
            clearTimeout(this._vignetteTimer);
            this._vignetteTimer = null;
        }
        // Show vignette immediately
        vignette.enabled = true;
        if (vignette.element) {
            // Set red color with specified intensity
            vignette.element.color = new Color(1, 0, 0, intensity);
            vignette.element.opacity = intensity;
        }
        // Fade out over duration
        this._fadeVignetteOut(duration);
        Logger.debug(`[UIComponents] Damage vignette shown - intensity: ${intensity}, duration: ${duration}s`);
    }
    /**
     * Hide damage vignette immediately
     */ hideDamageVignette() {
        if (this._vignetteTimer) {
            clearTimeout(this._vignetteTimer);
            this._vignetteTimer = null;
        }
        if (this.hudElements?.damageVignette) {
            this.hudElements.damageVignette.enabled = false;
        }
    }
    /**
     * Create fallback damage vignette if not found in UI hierarchy
     */ _createFallbackVignette() {
        try {
            const hudScreen = this.entity.findByName('GameHUD') || this.app.root.findByName('GameHUD');
            if (!hudScreen) {
                Logger.error('[UIComponents] Cannot create fallback vignette - GameHUD not found');
                return;
            }
            // Create damage vignette overlay entity
            const vignetteEntity = new Entity('DamageVignette');
            vignetteEntity.addComponent('element', {
                type: ELEMENTTYPE_IMAGE,
                anchor: [
                    0,
                    0,
                    1,
                    1
                ],
                margin: [
                    0,
                    0,
                    0,
                    0
                ],
                pivot: [
                    0.5,
                    0.5
                ],
                color: new Color(1, 0, 0, 0),
                opacity: 0,
                useInput: false
            });
            // Add to HUD screen
            hudScreen.addChild(vignetteEntity);
            // Cache the element
            this.hudElements.damageVignette = vignetteEntity;
            // Initially disable
            vignetteEntity.enabled = false;
            Logger.debug('[UIComponents] Fallback damage vignette created successfully');
        } catch (error) {
            Logger.error('[UIComponents] Failed to create fallback vignette:', error);
        }
    }
    /**
     * Create fallback countdown text if not found in UI hierarchy
     */ _createFallbackCountdown() {
        try {
            const hudScreen = this.entity.findByName('GameHUD') || this.app.root.findByName('GameHUD');
            if (!hudScreen) {
                Logger.error('[UIComponents] Cannot create fallback countdown - GameHUD not found');
                return;
            }
            // Create countdown text overlay entity
            const countdownEntity = new Entity('CountdownText');
            countdownEntity.addComponent('element', {
                type: ELEMENTTYPE_TEXT,
                anchor: [
                    0.5,
                    0.5,
                    0.5,
                    0.5
                ],
                pivot: [
                    0.5,
                    0.5
                ],
                fontSize: 128,
                fontAsset: this.app.assets.find('Arial', 'font')?.id,
                text: '3',
                color: new Color(1, 1, 1),
                opacity: 1,
                useInput: false,
                alignment: new Vec2(0.5, 0.5),
                autoWidth: false,
                autoHeight: false,
                width: 400,
                height: 200
            });
            // Add to HUD screen
            hudScreen.addChild(countdownEntity);
            // Cache the element
            this.hudElements.countdownText = countdownEntity;
            // Initially disable
            countdownEntity.enabled = false;
            Logger.info('[UIComponents] ✅ Fallback countdown text created successfully');
        } catch (error) {
            Logger.error('[UIComponents] Failed to create fallback countdown:', error);
        }
    }
    /**
     * Fade vignette out over specified duration
     */ _fadeVignetteOut(duration) {
        const vignette = this.hudElements.damageVignette;
        if (!vignette?.element) return;
        const startOpacity = vignette.element.opacity || 0;
        const startTime = performance.now();
        const animate = ()=>{
            if (!vignette || !vignette.element || vignette.destroyed) return;
            const elapsed = (performance.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out fade
            const opacity = startOpacity * (1 - progress);
            vignette.element.opacity = opacity;
            if (vignette.element.color) {
                vignette.element.color.a = opacity;
            }
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - hide vignette
                vignette.enabled = false;
                this._vignetteTimer = null;
            }
        };
        animate();
    }
    /**
     * Reset HUD to default values
     */ resetHUD() {
        this.updateTimer(300);
        this.updateHealth(100, 100);
        this.updateAmmo(12, 120);
        this.hideDamageVignette();
    }
    // ============================================================================
    // SUMMARY STATS MANAGEMENT
    // ============================================================================
    /**
     * Update summary statistics
     */ updateSummaryStats(stats) {
        if (!this.summaryElements) return;
        const setText = (elementName, value)=>{
            const element = this.summaryElements[elementName];
            if (element?.element) {
                element.element.text = String(value);
            }
        };
        // Format and display stats
        if (stats.kills !== undefined) setText('kills', stats.kills);
        if (stats.deaths !== undefined) setText('deaths', stats.deaths);
        if (stats.accuracy !== undefined) setText('accuracy', Math.round(stats.accuracy) + '%');
        if (stats.damageDealt !== undefined) setText('damageDealt', Math.round(stats.damageDealt));
        if (stats.bestKillStreak !== undefined) setText('killStreak', stats.bestKillStreak);
        if (stats.itemsPickedUp !== undefined) setText('itemsPickedUp', stats.itemsPickedUp);
        if (stats.biggestHit !== undefined) setText('biggestHit', Math.round(stats.biggestHit));
        if (stats.duration !== undefined) {
            const minutes = Math.floor(stats.duration / 60);
            const seconds = Math.floor(stats.duration % 60);
            setText('roundTime', `${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
        Logger.debug('[UIComponents] Summary stats updated');
    }
    // ============================================================================
    // COMPONENT UTILITIES
    // ============================================================================
    /**
     * Find UI element by name in screens
     */ findElement(screenName, elementName, uiScreens) {
        const screen = uiScreens[screenName];
        return screen ? screen.findByName(elementName) : null;
    }
    /**
     * Set element visibility
     */ setElementVisibility(element, visible) {
        if (element) {
            element.enabled = visible;
        }
    }
    /**
     * Set element text
     */ setElementText(element, text) {
        if (element?.element) {
            element.element.text = String(text);
        }
    }
    /**
     * Set element color
     */ setElementColor(element, color) {
        if (element?.element && color instanceof Color) {
            element.element.color = color;
        }
    }
    /**
     * Get cached HUD elements
     */ getHUDElements() {
        return this.hudElements;
    }
    /**
     * Get cached summary elements
     */ getSummaryElements() {
        return this.summaryElements;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Clear cached elements
     */ clearCache() {
        this.hudElements = {};
        this.summaryElements = {};
        this._originalHealthWidth = null;
        Logger.debug('[UIComponents] Element cache cleared');
    }
    /**
     * Destroy UI components
     */ destroy() {
        // Clean up vignette timer
        if (this._vignetteTimer) {
            clearTimeout(this._vignetteTimer);
            this._vignetteTimer = null;
        }
        this.clearCache();
        Logger.debug('[UIComponents] Components cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Cache for UI elements
        this.hudElements = {};
        this.summaryElements = {};
        this._originalHealthWidth = null;
        Logger.debug('[UIComponents] Components instance created');
    }
}

export { UIComponents };
