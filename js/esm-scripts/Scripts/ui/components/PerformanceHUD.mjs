import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

/**
 * PerformanceHUD - Live Performance Metrics Display (HTML OVERLAY VERSION)
 * 
 * Displays real-time player progression metrics with EPIC visual effects:
 * - Kill counter with particle explosions
 * - Accuracy percentage with color-coded glow
 * - Survival time with pulsing animation
 * - Kill streak with fire effects
 * - Headshot counter with impact animations
 * 
 * Uses HTML overlays for maximum visual impact!
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
class PerformanceHUD {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        if (this._initialized) {
            Logger.debug('[PerformanceHUD] Already initialized');
            return;
        }
        Logger.info('[PerformanceHUD] Initializing HTML overlay performance display...');
        // Create HTML container
        this._createHTMLContainer();
        // Setup event listeners
        this._setupEventListeners();
        // Initialize with default values
        this._resetDisplay();
        // Start continuous animation loop
        this._startAnimationLoop();
        this._initialized = true;
        Logger.info('[PerformanceHUD] ✅ HTML Overlay Performance HUD ready');
    }
    /**
     * Create HTML container with all stat displays
     */ _createHTMLContainer() {
        this.htmlContainer = document.createElement('div');
        this.htmlContainer.id = 'performance-hud';
        this.htmlContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 9998;
            pointer-events: none;
            font-family: 'Impact', 'Arial Black', sans-serif;
        `;
        // Create stat panels
        this._createKillCounter();
        this._createAccuracyDisplay();
        this._createSurvivalTimer();
        this._createStreakIndicator();
        this._createHeadshotCounter();
        document.body.appendChild(this.htmlContainer);
        Logger.debug('[PerformanceHUD] HTML container created');
    }
    /**
     * Create kill counter with particle effects
     */ _createKillCounter() {
        const panel = this._createStatPanel('💀 KILLS', '0');
        panel.style.background = 'linear-gradient(135deg, rgba(255,0,0,0.2) 0%, rgba(139,0,0,0.1) 100%)';
        panel.style.borderLeft = '4px solid #FF0000';
        this.statElements.killCounter = panel;
        this.statElements.killValue = panel.querySelector('.stat-value');
        this.htmlContainer.appendChild(panel);
    }
    /**
     * Create accuracy display with color-coded glow
     */ _createAccuracyDisplay() {
        const panel = this._createStatPanel('🎯 ACCURACY', '0%');
        panel.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,140,0,0.1) 100%)';
        panel.style.borderLeft = '4px solid #FFD700';
        this.statElements.accuracyDisplay = panel;
        this.statElements.accuracyValue = panel.querySelector('.stat-value');
        this.htmlContainer.appendChild(panel);
    }
    /**
     * Create survival timer with pulsing effect
     */ _createSurvivalTimer() {
        const panel = this._createStatPanel('⏱️ ALIVE', '0:00');
        panel.style.background = 'linear-gradient(135deg, rgba(0,191,255,0.2) 0%, rgba(0,100,200,0.1) 100%)';
        panel.style.borderLeft = '4px solid #00BFFF';
        this.statElements.survivalTimer = panel;
        this.statElements.survivalValue = panel.querySelector('.stat-value');
        this.htmlContainer.appendChild(panel);
    }
    /**
     * Create streak indicator with fire effects
     */ _createStreakIndicator() {
        const panel = this._createStatPanel('🔥 STREAK', '0');
        panel.style.background = 'linear-gradient(135deg, rgba(255,140,0,0.25) 0%, rgba(255,69,0,0.15) 100%)';
        panel.style.borderLeft = '4px solid #FF8C00';
        panel.style.display = 'none'; // Hidden until streak > 0
        this.statElements.streakIndicator = panel;
        this.statElements.streakValue = panel.querySelector('.stat-value');
        this.htmlContainer.appendChild(panel);
    }
    /**
     * Create headshot counter with impact animation
     */ _createHeadshotCounter() {
        const panel = this._createStatPanel('💀 HEADSHOTS', '0');
        panel.style.background = 'linear-gradient(135deg, rgba(255,20,147,0.2) 0%, rgba(138,43,226,0.1) 100%)';
        panel.style.borderLeft = '4px solid #FF1493';
        panel.style.display = 'none'; // Hidden until headshots > 0
        this.statElements.headshotCounter = panel;
        this.statElements.headshotValue = panel.querySelector('.stat-value');
        this.htmlContainer.appendChild(panel);
    }
    /**
     * Create a stat panel with label and value
     */ _createStatPanel(label, initialValue) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: relative;
            padding: 12px 20px;
            margin-bottom: 10px;
            min-width: 200px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
            transition: all 0.3s ease;
            overflow: hidden;
        `;
        panel.innerHTML = `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                z-index: 1;
            ">
                <span class="stat-label" style="
                    font-size: 16px;
                    font-weight: 700;
                    color: rgba(255,255,255,0.9);
                    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                    letter-spacing: 1px;
                ">${label}</span>
                <span class="stat-value" style="
                    font-size: 28px;
                    font-weight: 900;
                    color: #FFFFFF;
                    text-shadow: 
                        0 0 10px rgba(255,255,255,0.8),
                        0 2px 4px rgba(0,0,0,0.9);
                    letter-spacing: 2px;
                ">${initialValue}</span>
            </div>
        `;
        return panel;
    }
    _setupEventListeners() {
        // Session lifecycle
        this.app.on('game:sessionStarted', this._onSessionStarted, this);
        this.app.on('game:sessionEnded', this._onSessionEnded, this);
        // Countdown and game flow
        this.app.on('game:countdownFinished', this._onCountdownFinished, this);
        // Player lifecycle
        this.app.on('game:playerDeath', this._onPlayerDeath, this);
        this.app.on('player:respawned', this._onPlayerRespawned, this);
        // Progression updates
        this.app.on('progression:headshotUpdate', this._onHeadshotUpdate, this);
        this.app.on('progression:accuracyUpdate', this._onAccuracyUpdate, this);
        this.app.on('progression:streakRecord', this._onStreakRecord, this);
        this.app.on('progression:streakReset', this._onStreakReset, this);
        // Kill events
        this.app.on('entity:died', this._onEntityDied, this);
        // Menu state changes - HIDE HUD when menu is open
        this.app.on('menu:opened', this._onMenuOpened, this);
        this.app.on('menu:closed', this._onMenuClosed, this);
        Logger.debug('[PerformanceHUD] Event listeners registered');
    }
    // ============================================================================
    // MENU STATE HANDLERS
    // ============================================================================
    _onMenuOpened() {
        Logger.debug('[PerformanceHUD] Menu opened - hiding HUD');
        this._wasVisibleBeforeMenu = this.htmlContainer && this.htmlContainer.style.display !== 'none';
        this.hide();
    }
    _onMenuClosed() {
        // Show HUD again if it was visible before menu opened
        if (this._wasVisibleBeforeMenu) {
            Logger.debug('[PerformanceHUD] Menu closed - restoring HUD visibility');
            this.show();
        } else {
            Logger.debug('[PerformanceHUD] Menu closed - HUD was already hidden');
        }
    }
    // ============================================================================
    // SESSION LIFECYCLE
    // ============================================================================
    _onSessionStarted() {
        Logger.debug('[PerformanceHUD] Session started - showing HUD (alive timer NOT started yet)');
        this._resetDisplay();
        this._aliveTimerActive = false; // Wait for countdown to finish
        this.show();
    }
    _onSessionEnded() {
        Logger.debug('[PerformanceHUD] Session ended - hiding HUD');
        this._aliveTimerActive = false;
        this.hide();
    }
    _onCountdownFinished() {
        Logger.info('[PerformanceHUD] 🚀 Countdown finished - starting alive timer!');
        this._aliveTimerActive = true;
        this._aliveTimerStartTime = performance.now() / 1000;
        this._currentSurvivalTime = 0;
    }
    _onPlayerDeath(data) {
        Logger.info('[PerformanceHUD] 💀 Player died - pausing alive timer at', this._currentSurvivalTime.toFixed(1), 'seconds');
        this._aliveTimerActive = false;
    }
    _onPlayerRespawned(data) {
        Logger.info('[PerformanceHUD] ✨ Player respawned - restarting alive timer from 0');
        this._aliveTimerActive = true;
        this._aliveTimerStartTime = performance.now() / 1000;
        this._currentSurvivalTime = 0;
        this._updateSurvivalTimer(); // Immediately show 0:00
    }
    _resetDisplay() {
        this._currentKills = 0;
        this._currentAccuracy = 0;
        this._currentSurvivalTime = 0;
        this._currentStreak = 0;
        this._currentHeadshots = 0;
        this._updateKillCounter();
        this._updateAccuracyDisplay();
        this._updateSurvivalTimer();
        this._updateStreakIndicator();
        this._updateHeadshotCounter();
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    _onEntityDied(data) {
        const { attacker } = data;
        // Only update for player kills
        if (!this._isPlayer(attacker)) return;
        // Get progression data
        const progressionMetrics = this.app.gameManager?.progressionMetrics;
        if (!progressionMetrics) return;
        const progression = progressionMetrics.getCurrentProgression();
        // Update kill counter with explosion effect
        this._currentKills = progression.totalKills;
        this._updateKillCounter(true); // true = trigger explosion
        // Update streak
        this._currentStreak = progression.currentStreak;
        this._updateStreakIndicator();
    }
    _onHeadshotUpdate(data) {
        this._currentHeadshots = data.headshots;
        this._updateHeadshotCounter(true); // true = trigger impact animation
    }
    _onAccuracyUpdate(data) {
        this._currentAccuracy = data.accuracy;
        this._updateAccuracyDisplay();
    }
    _onStreakRecord(data) {
        this._currentStreak = data.streak;
        this._updateStreakIndicator(true); // true = trigger epic animation
    }
    _onStreakReset() {
        this._currentStreak = 0;
        this._updateStreakIndicator();
    }
    // ============================================================================
    // UPDATE LOOP & ANIMATION
    // ============================================================================
    update(dt) {
        if (!this._initialized) return;
        this._updateTimer += dt;
        if (this._updateTimer >= this._updateInterval) {
            this._updateTimer = 0;
            Logger.debug('[PerformanceHUD] Running update cycle');
            this._updateLiveData();
        }
        // Update continuous animations
        this._pulseAnimation += dt * 2; // 2 rad/sec
        this._updateContinuousAnimations();
    }
    _startAnimationLoop() {
        // Continuous animation loop for effects
        this._animationFrameId = requestAnimationFrame(()=>this._animationLoop());
    }
    _animationLoop() {
        if (!this._initialized) return;
        // Pulse survival timer
        if (this.statElements.survivalTimer) {
            const pulse = 1 + Math.sin(Date.now() * 0.002) * 0.05;
            this.statElements.survivalValue.style.transform = `scale(${pulse})`;
        }
        // Animate streak glow if active
        if (this._currentStreak > 0 && this.statElements.streakIndicator) {
            const glowPulse = 20 + Math.sin(Date.now() * 0.005) * 10;
            const color = this._getStreakColor();
            this.statElements.streakIndicator.style.boxShadow = `
                0 4px 15px rgba(0,0,0,0.5),
                inset 0 1px 0 rgba(255,255,255,0.1),
                0 0 ${glowPulse}px ${color}
            `;
        }
        this._animationFrameId = requestAnimationFrame(()=>this._animationLoop());
    }
    _updateContinuousAnimations() {
    // Additional animation updates can go here
    }
    _updateLiveData() {
        const progressionMetrics = this.app.gameManager?.gameSession?.progressionMetrics;
        if (!progressionMetrics) {
            Logger.warn('[PerformanceHUD] No progressionMetrics found!');
            return;
        }
        const progression = progressionMetrics.getCurrentProgression();
        Logger.debug('[PerformanceHUD] Updating live data:', {
            survivalTime: progression.survivalTime,
            totalKills: progression.totalKills,
            currentStreak: progression.currentStreak,
            headshots: progression.headshots,
            aliveTimerActive: this._aliveTimerActive
        });
        // Update survival time ONLY if alive timer is active
        if (this._aliveTimerActive) {
            const now = performance.now() / 1000;
            this._currentSurvivalTime = now - this._aliveTimerStartTime;
            this._updateSurvivalTimer();
        }
        // Update kills if changed
        if (this._currentKills !== progression.totalKills) {
            this._currentKills = progression.totalKills;
            this._updateKillCounter();
            Logger.info('[PerformanceHUD] Kills updated to:', this._currentKills);
        }
        // Update streak if changed
        if (this._currentStreak !== progression.currentStreak) {
            this._currentStreak = progression.currentStreak;
            this._updateStreakIndicator();
        }
        // Update accuracy from sessionMetrics (always check)
        const accuracy = this.app.gameManager?.gameSession?.sessionMetrics?.stats?.accuracy || 0;
        if (this._currentAccuracy !== accuracy) {
            this._currentAccuracy = accuracy;
            this._updateAccuracyDisplay();
        }
        // Update headshots if changed
        if (this._currentHeadshots !== progression.headshots) {
            this._currentHeadshots = progression.headshots;
            this._updateHeadshotCounter();
        }
    }
    // ============================================================================
    // UI UPDATES WITH EPIC ANIMATIONS
    // ============================================================================
    _updateKillCounter(triggerExplosion = false) {
        if (!this.statElements.killValue) {
            Logger.warn('[PerformanceHUD] killValue element not found!');
            return;
        }
        this.statElements.killValue.textContent = this._currentKills;
        Logger.debug('[PerformanceHUD] Kill counter updated to:', this._currentKills);
        if (triggerExplosion) {
            this._createParticleExplosion(this.statElements.killCounter, '#FF0000');
            this._pulseElement(this.statElements.killCounter, 1.15, '#FF0000');
        }
    }
    _updateAccuracyDisplay() {
        if (!this.statElements.accuracyValue) return;
        const accuracyFormatted = this._currentAccuracy.toFixed(1);
        this.statElements.accuracyValue.textContent = `${accuracyFormatted}%`;
        // Dynamic color and glow based on accuracy
        let color, glowColor, borderColor;
        if (this._currentAccuracy >= 70) {
            color = '#00FF00';
            glowColor = 'rgba(0, 255, 0, 0.6)';
            borderColor = '#00FF00';
        } else if (this._currentAccuracy >= 50) {
            color = '#FFD700';
            glowColor = 'rgba(255, 215, 0, 0.6)';
            borderColor = '#FFD700';
        } else if (this._currentAccuracy >= 30) {
            color = '#FFA500';
            glowColor = 'rgba(255, 165, 0, 0.6)';
            borderColor = '#FFA500';
        } else {
            color = '#FF4500';
            glowColor = 'rgba(255, 69, 0, 0.6)';
            borderColor = '#FF4500';
        }
        this.statElements.accuracyValue.style.color = color;
        this.statElements.accuracyValue.style.textShadow = `
            0 0 15px ${glowColor},
            0 2px 4px rgba(0,0,0,0.9)
        `;
        this.statElements.accuracyDisplay.style.borderLeftColor = borderColor;
        this.statElements.accuracyDisplay.style.boxShadow = `
            0 4px 15px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.1),
            0 0 20px ${glowColor}
        `;
    }
    _updateSurvivalTimer() {
        if (!this.statElements.survivalValue) {
            Logger.warn('[PerformanceHUD] survivalValue element not found!');
            return;
        }
        const minutes = Math.floor(this._currentSurvivalTime / 60);
        const seconds = Math.floor(this._currentSurvivalTime % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.statElements.survivalValue.textContent = timeString;
        Logger.debug('[PerformanceHUD] Survival timer updated to:', timeString, '(', this._currentSurvivalTime, 'seconds)');
    }
    _updateStreakIndicator(isRecord = false) {
        if (!this.statElements.streakValue) return;
        if (this._currentStreak > 0) {
            this.statElements.streakIndicator.style.display = 'block';
            this.statElements.streakValue.textContent = this._currentStreak;
            // Dynamic styling based on streak level
            const color = this._getStreakColor();
            const glowColor = this._getStreakGlowColor();
            this.statElements.streakValue.style.color = color;
            this.statElements.streakValue.style.textShadow = `
                0 0 20px ${glowColor},
                0 0 40px ${glowColor},
                0 2px 4px rgba(0,0,0,0.9)
            `;
            this.statElements.streakIndicator.style.borderLeftColor = color;
            // Epic animation for records
            if (isRecord) {
                this._animateStreakRecord();
            } else {
                // Regular pulse for streak increase
                this._pulseElement(this.statElements.streakIndicator, 1.1, color);
            }
        } else {
            this.statElements.streakIndicator.style.display = 'none';
        }
    }
    _updateHeadshotCounter(triggerImpact = false) {
        if (!this.statElements.headshotValue) return;
        if (this._currentHeadshots > 0) {
            this.statElements.headshotCounter.style.display = 'block';
            this.statElements.headshotValue.textContent = this._currentHeadshots;
            if (triggerImpact) {
                this._createImpactWave(this.statElements.headshotCounter);
                this._pulseElement(this.statElements.headshotCounter, 1.2, '#FF1493');
            }
        } else {
            this.statElements.headshotCounter.style.display = 'none';
        }
    }
    // ============================================================================
    // VISUAL EFFECTS
    // ============================================================================
    /**
     * Get streak color based on level
     */ _getStreakColor() {
        if (this._currentStreak >= 10) return '#FF00FF'; // Magenta
        if (this._currentStreak >= 7) return '#8B00FF'; // Purple
        if (this._currentStreak >= 5) return '#FF4500'; // Orange-Red
        if (this._currentStreak >= 3) return '#FFD700'; // Gold
        return '#FFA500'; // Orange
    }
    /**
     * Get streak glow color based on level
     */ _getStreakGlowColor() {
        if (this._currentStreak >= 10) return 'rgba(255, 0, 255, 0.8)';
        if (this._currentStreak >= 7) return 'rgba(139, 0, 255, 0.8)';
        if (this._currentStreak >= 5) return 'rgba(255, 69, 0, 0.8)';
        if (this._currentStreak >= 3) return 'rgba(255, 215, 0, 0.8)';
        return 'rgba(255, 165, 0, 0.8)';
    }
    /**
     * Pulse element with scale and glow
     */ _pulseElement(element, maxScale = 1.2, color = '#FFFFFF') {
        if (!element) return;
        const duration = 300;
        const startTime = Date.now();
        const animate = ()=>{
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Bounce curve
            const scale = 1 + (maxScale - 1) * Math.sin(progress * Math.PI);
            element.style.transform = `scale(${scale})`;
            // Glow intensity
            const glowIntensity = 30 + 20 * Math.sin(progress * Math.PI);
            element.style.filter = `brightness(${1 + 0.3 * Math.sin(progress * Math.PI)}) drop-shadow(0 0 ${glowIntensity}px ${color})`;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.transform = 'scale(1)';
                element.style.filter = 'brightness(1)';
            }
        };
        animate();
    }
    /**
     * Create particle explosion effect
     */ _createParticleExplosion(element, color) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Create 12 particles
        for(let i = 0; i < 12; i++){
            const particle = document.createElement('div');
            const angle = i / 12 * Math.PI * 2;
            const velocity = 80 + Math.random() * 40;
            particle.style.cssText = `
                position: fixed;
                left: ${centerX}px;
                top: ${centerY}px;
                width: 8px;
                height: 8px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                z-index: 10002;
                box-shadow: 0 0 10px ${color};
            `;
            document.body.appendChild(particle);
            // Animate particle
            const startTime = Date.now();
            const duration = 800;
            const animate = ()=>{
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const x = centerX + Math.cos(angle) * velocity * progress;
                const y = centerY + Math.sin(angle) * velocity * progress + progress * progress * 200; // Gravity
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.opacity = 1 - progress;
                particle.style.transform = `scale(${1 - progress * 0.5})`;
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    document.body.removeChild(particle);
                }
            };
            animate();
        }
    }
    /**
     * Create impact wave effect
     */ _createImpactWave(element) {
        if (!element) return;
        const wave = document.createElement('div');
        const rect = element.getBoundingClientRect();
        wave.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 3px solid #FF1493;
            border-radius: 10px;
            pointer-events: none;
            z-index: 9997;
        `;
        document.body.appendChild(wave);
        // Animate wave expansion
        const startTime = Date.now();
        const duration = 500;
        const animate = ()=>{
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const scale = 1 + progress * 0.3;
            wave.style.transform = `scale(${scale})`;
            wave.style.opacity = 1 - progress;
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(wave);
            }
        };
        animate();
    }
    /**
     * Animate streak record with epic effects
     */ _animateStreakRecord() {
        if (!this.statElements.streakIndicator) return;
        Logger.info('[PerformanceHUD] 🔥 EPIC STREAK RECORD!', this._currentStreak);
        const element = this.statElements.streakIndicator;
        const color = this._getStreakColor();
        // Multi-pulse with increasing intensity
        let pulseCount = 0;
        const maxPulses = 5;
        const doPulse = ()=>{
            this._pulseElement(element, 1.3 + pulseCount * 0.05, color);
            this._createParticleExplosion(element, color);
            pulseCount++;
            if (pulseCount < maxPulses) {
                setTimeout(doPulse, 250);
            }
        };
        doPulse();
    }
    // ============================================================================
    // VISIBILITY CONTROL
    // ============================================================================
    show() {
        if (this.htmlContainer) {
            this.htmlContainer.style.display = 'block';
            Logger.info('[PerformanceHUD] ✅ HTML overlay shown - display:', this.htmlContainer.style.display);
        } else {
            Logger.error('[PerformanceHUD] ❌ Cannot show - htmlContainer is null!');
        }
    }
    hide() {
        if (this.htmlContainer) {
            this.htmlContainer.style.display = 'none';
            Logger.debug('[PerformanceHUD] HTML overlay hidden');
        }
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    _isPlayer(entity) {
        if (!entity) return false;
        return entity.tags && (entity.tags.has('player') || entity.tags.has('team_player'));
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (!this._initialized) return;
        // Stop animation loop
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
        // Remove event listeners
        this.app.off('game:sessionStarted', this._onSessionStarted, this);
        this.app.off('game:sessionEnded', this._onSessionEnded, this);
        this.app.off('game:countdownFinished', this._onCountdownFinished, this);
        this.app.off('game:playerDeath', this._onPlayerDeath, this);
        this.app.off('player:respawned', this._onPlayerRespawned, this);
        this.app.off('progression:headshotUpdate', this._onHeadshotUpdate, this);
        this.app.off('progression:accuracyUpdate', this._onAccuracyUpdate, this);
        this.app.off('progression:streakRecord', this._onStreakRecord, this);
        this.app.off('progression:streakReset', this._onStreakReset, this);
        this.app.off('entity:died', this._onEntityDied, this);
        this.app.off('menu:opened', this._onMenuOpened, this);
        this.app.off('menu:closed', this._onMenuClosed, this);
        // Remove HTML container
        if (this.htmlContainer && this.htmlContainer.parentNode) {
            this.htmlContainer.parentNode.removeChild(this.htmlContainer);
        }
        this._initialized = false;
        Logger.debug('[PerformanceHUD] HTML overlay cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // HTML container
        this.htmlContainer = null;
        this.statElements = {};
        // State tracking
        this._initialized = false;
        this._updateInterval = 0.1; // Update every 0.1 seconds (smoother)
        this._updateTimer = 0;
        this._wasVisibleBeforeMenu = false; // Track visibility state for menu handling
        this._aliveTimerActive = false; // Track if alive timer should be running
        this._aliveTimerStartTime = 0; // When the current life started
        // Data cache
        this._currentKills = 0;
        this._currentAccuracy = 0;
        this._currentSurvivalTime = 0;
        this._currentStreak = 0;
        this._currentHeadshots = 0;
        // Animation state
        this._pulseAnimation = 0;
        this._streakGlowIntensity = 0;
        Logger.debug('[PerformanceHUD] HTML Overlay instance created');
    }
}
/**
 * PlayCanvas Script Adapter for PerformanceHUD
 */ class PerformanceHUDScript extends Script {
    initialize() {
        this.performanceHUD = new PerformanceHUD(this.app, this.entity);
        this.performanceHUD.initialize();
        // Make available on entity
        this.entity.performanceHUD = this.performanceHUD;
    }
    update(dt) {
        if (this.performanceHUD) {
            this.performanceHUD.update(dt);
        }
    }
    destroy() {
        if (this.performanceHUD) {
            this.performanceHUD.destroy();
            this.performanceHUD = null;
            this.entity.performanceHUD = null;
        }
    }
}
_define_property(PerformanceHUDScript, "scriptName", 'performanceHUD');
_define_property(PerformanceHUDScript, "attributes", {});

export { PerformanceHUD, PerformanceHUDScript };
