import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../engine/logger.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

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
 * ⏱️ LAST STAND SYSTEM - Dramatic "Hero Moment" Mechanic
 * 
 * When player health drops to critical (15%), triggers cinematic effects:
 * - Time dilation (40% speed) - Gives clutch opportunity
 * - Enhanced audio (heartbeat, suppressed environment)
 * - Visual effects (desaturation, pulsing vignette)
 * - Improved accuracy (reduced shake, tighter spread)
 * 
 * Creates memorable Hollywood-style moments where skill overcomes dire situations.
 * Makes near-death experiences thrilling instead of frustrating.
 */ class LastStandSystem extends Script {
    initialize() {
        if (this.__lssBooted) {
            Logger.debug('[LastStandSystem] Already initialized');
            return;
        }
        this.player = null;
        this.playerHealthSystem = null;
        this.audioManager = null;
        // Last Stand state
        this.isInLastStand = false;
        this.lastStandTriggered = false;
        this.normalTimeScale = 1.0;
        this.lastStandTimeScale = 0.4; // 40% speed - slow motion
        // Health thresholds
        this.criticalHealthThreshold = aiConfig.healthEffects?.CRITICAL_HEALTH_THRESHOLD || 0.15; // Default to 0.15 if not found
        this.exitThreshold = 0.25; // Exit last stand at 25% health
        // Visual effects
        this.normalSaturation = 1.0;
        this.lastStandSaturation = 0.3; // 30% saturation - desaturated
        this.vignetteIntensity = 0.8;
        // Audio effects
        this.heartbeatSound = null;
        this.heartbeatInterval = null;
        this.normalMasterVolume = 1.0;
        this.lastStandMasterVolume = 0.6; // Suppress environment audio
        // Accuracy buffs during last stand
        this.accuracyBuff = 0.25; // +25% accuracy
        this.weaponSpreadReduction = 0.3; // -30% weapon spread
        this.screenShakeReduction = 0.5; // -50% screen shake
        this._setupEventListeners();
        this._waitForDependencies();
        this.on('destroy', this._cleanup, this);
        this.__lssBooted = true;
        Logger.info('[LastStandSystem] Initialized');
    }
    _waitForDependencies() {
        const check = ()=>{
            // Wait for audio manager
            if (!this.app.audioManager) {
                setTimeout(check, 100);
                return;
            }
            this.audioManager = this.app.audioManager;
            // Wait for player
            const playerCheck = ()=>{
                const player = this.app.root.findByTag('player')[0];
                if (!player || !player.script || !player.script.player) {
                    setTimeout(playerCheck, 100);
                    return;
                }
                this.player = player;
                // Get health system
                if (player.script && player.script.healthSystem) {
                    this.playerHealthSystem = player.script.healthSystem;
                }
                Logger.debug('[LastStandSystem] Dependencies ready');
            };
            playerCheck();
        };
        check();
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        // Listen for damage to check health threshold
        this.app.on('entity:damaged', this._onEntityDamage, this);
        // Listen for healing to exit last stand
        this.app.on('entity:healed', this._onEntityHealed, this);
        // Listen for death to cleanup
        this.app.on('entity:died', this._onEntityDied, this);
        this._eventsBound = true;
    }
    _onEntityDamage(data) {
        if (!data || !data.target || !this.player) return;
        // Only process player damage
        if (data.target !== this.player) return;
        this._checkLastStandTrigger();
    }
    _onEntityHealed(data) {
        if (!data || !data.target || !this.player) return;
        // Only process player healing
        if (data.target !== this.player) return;
        this._checkLastStandExit();
    }
    _onEntityDied(data) {
        if (!data || !data.entity || !this.player) return;
        // Player died - exit last stand
        if (data.entity === this.player) {
            this._exitLastStand();
        }
    }
    _checkLastStandTrigger() {
        if (!this.playerHealthSystem) return;
        if (this.isInLastStand) return; // Already in last stand
        const healthPercent = this.playerHealthSystem.getHealthPercent();
        // Trigger last stand at critical health
        if (healthPercent <= this.criticalHealthThreshold) {
            this._enterLastStand();
        }
    }
    _checkLastStandExit() {
        if (!this.playerHealthSystem) return;
        if (!this.isInLastStand) return; // Not in last stand
        const healthPercent = this.playerHealthSystem.getHealthPercent();
        // Exit last stand if healed above threshold
        if (healthPercent > this.exitThreshold) {
            this._exitLastStand();
        }
    }
    _enterLastStand() {
        if (this.isInLastStand) return;
        Logger.info('[LastStandSystem] 💀 ENTERING LAST STAND - Fight for your life!');
        this.isInLastStand = true;
        this.lastStandTriggered = true;
        // Apply time dilation
        this._setTimeScale(this.lastStandTimeScale);
        // Apply visual effects
        this._applyVisualEffects();
        // Apply audio effects
        this._applyAudioEffects();
        // Show dramatic UI message
        this._showLastStandUI();
        // Notify other systems
        this.app.fire('laststand:entered');
        this.app.fire('ui:laststand_entered', {
            timeScale: this.lastStandTimeScale,
            duration: -1 // Indefinite until healed/died
        });
    }
    _exitLastStand() {
        if (!this.isInLastStand) return;
        Logger.info('[LastStandSystem] ✅ EXITING LAST STAND - Back to normal');
        this.isInLastStand = false;
        // Restore time scale
        this._setTimeScale(this.normalTimeScale);
        // Restore visual effects
        this._restoreVisualEffects();
        // Restore audio effects
        this._restoreAudioEffects();
        // Hide UI message
        this._hideLastStandUI();
        // Notify other systems
        this.app.fire('laststand:exited');
        this.app.fire('ui:laststand_exited');
    }
    _setTimeScale(scale) {
        // Apply time scale to all relevant systems
        this.app.timeScale = scale;
        Logger.debug(`[LastStandSystem] Time scale set to ${scale}`);
    }
    _applyVisualEffects() {
        // Desaturate scene
        // Note: This requires post-processing effects in PlayCanvas
        // For now, we'll use events to let the rendering system handle it
        this.app.fire('rendering:setSaturation', this.lastStandSaturation);
        // Apply intense vignette with heartbeat pulsing
        this.app.fire('ui:damageVignette', {
            intensity: this.vignetteIntensity,
            duration: -1,
            pulse: true,
            pulseRate: 1.2 // BPM / 60 (72 BPM)
        });
        // Reduce screen shake intensity
        if (this.player && this.player.script && this.player.script.player) {
            const playerScript = this.player.script.player;
            if (playerScript._originalScreenShakeDecay === undefined) {
                playerScript._originalScreenShakeDecay = playerScript.screenShakeDecay;
            }
            // Reduce shake by 50%
            playerScript.screenShakeDecay *= 1 + this.screenShakeReduction;
        }
    }
    _restoreVisualEffects() {
        // Restore saturation
        this.app.fire('rendering:setSaturation', this.normalSaturation);
        // Clear vignette pulse
        this.app.fire('ui:damageVignette', {
            intensity: 0,
            duration: 0.5,
            pulse: false
        });
        // Restore screen shake
        if (this.player && this.player.script && this.player.script.player) {
            const playerScript = this.player.script.player;
            if (playerScript._originalScreenShakeDecay !== undefined) {
                playerScript.screenShakeDecay = playerScript._originalScreenShakeDecay;
                delete playerScript._originalScreenShakeDecay;
            }
        }
    }
    _applyAudioEffects() {
        if (!this.audioManager) return;
        // Store original volume
        this.normalMasterVolume = this.audioManager.masterVolume;
        // Reduce master volume (suppress environmental sounds)
        this.audioManager.setVolume({
            master: this.lastStandMasterVolume
        });
        // Start heartbeat sound loop
        this._startHeartbeat();
    }
    _restoreAudioEffects() {
        if (!this.audioManager) return;
        // Restore master volume
        this.audioManager.setVolume({
            master: this.normalMasterVolume
        });
        // Stop heartbeat
        this._stopHeartbeat();
    }
    _startHeartbeat() {
        if (!this.audioManager) return;
        // Play heartbeat sound in loop
        // Note: You'll need to add a 'heartbeat' sound to your audio assets
        const playHeartbeat = ()=>{
            if (!this.isInLastStand) return;
            this.heartbeatSound = this.audioManager.playSound({
                sound: 'player_hurt',
                volume: 0.4,
                pitch: 0.8
            });
        };
        // Play immediately
        playHeartbeat();
        // Play every 0.83 seconds (72 BPM)
        this.heartbeatInterval = setInterval(()=>{
            if (this.isInLastStand) {
                playHeartbeat();
            }
        }, 833);
    }
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatSound && this.audioManager) {
            this.audioManager.stopSound({
                sound: 'player_hurt'
            });
            this.heartbeatSound = null;
        }
    }
    _showLastStandUI() {
        // Create dramatic overlay message
        if (!this._lastStandUI) {
            const overlay = document.createElement('div');
            overlay.id = 'lastStandOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                text-align: center;
                pointer-events: none;
                animation: lastStandPulse 2s ease-in-out infinite;
            `;
            const title = document.createElement('div');
            title.style.cssText = `
                font-size: 72px;
                font-weight: bold;
                color: #ff0000;
                text-shadow: 0 0 20px #ff0000, 0 0 40px #ff0000, 0 0 60px #ff0000;
                font-family: 'Arial Black', sans-serif;
                letter-spacing: 8px;
                margin-bottom: 20px;
            `;
            title.textContent = '⚠️ LAST STAND ⚠️';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = `
                font-size: 32px;
                font-weight: bold;
                color: #ffffff;
                text-shadow: 0 0 10px #000000;
                font-family: Arial, sans-serif;
            `;
            subtitle.textContent = 'FIGHT FOR YOUR LIFE!';
            overlay.appendChild(title);
            overlay.appendChild(subtitle);
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes lastStandPulse {
                    0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
            this._lastStandUI = overlay;
            // Auto-hide after 3 seconds but keep indicator
            setTimeout(()=>{
                if (this._lastStandUI && this.isInLastStand) {
                    this._lastStandUI.style.animation = 'none';
                    this._lastStandUI.style.opacity = '0.6';
                    this._lastStandUI.style.top = '20px';
                    this._lastStandUI.style.left = '50%';
                    this._lastStandUI.style.transform = 'translate(-50%, 0) scale(0.5)';
                    this._lastStandUI.style.transition = 'all 0.5s ease-out';
                }
            }, 3000);
        }
    }
    _hideLastStandUI() {
        if (this._lastStandUI) {
            this._lastStandUI.style.transition = 'opacity 0.5s ease-out';
            this._lastStandUI.style.opacity = '0';
            setTimeout(()=>{
                if (this._lastStandUI) {
                    this._lastStandUI.remove();
                    this._lastStandUI = null;
                }
            }, 500);
        }
    }
    /**
     * Check if player is currently in last stand mode
     */ isLastStandActive() {
        return this.isInLastStand;
    }
    /**
     * Get accuracy buff for player during last stand
     */ getAccuracyBuff() {
        return this.isInLastStand ? this.accuracyBuff : 0;
    }
    /**
     * Get weapon spread reduction during last stand
     */ getSpreadReduction() {
        return this.isInLastStand ? this.weaponSpreadReduction : 0;
    }
    update(dt) {
        if (!this.player || !this.playerHealthSystem) return;
        // Continuously check health to maintain/exit last stand
        if (this.isInLastStand) {
            this._checkLastStandExit();
        } else {
            this._checkLastStandTrigger();
        }
    }
    _cleanup() {
        // Exit last stand if active
        if (this.isInLastStand) {
            this._exitLastStand();
        }
        if (this._eventsBound) {
            this.app.off('entity:damaged', this._onEntityDamage, this);
            this.app.off('entity:healed', this._onEntityHealed, this);
            this.app.off('entity:died', this._onEntityDied, this);
        }
        this._eventsBound = false;
        this.__lssBooted = false;
        Logger.debug('[LastStandSystem] Cleanup complete');
    }
}
_define_property(LastStandSystem, "scriptName", 'lastStandSystem');

export { LastStandSystem };
