import { Script, Color } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

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
 * GameHUD Class - ESM-based HUD Management
 * Internal helper class, not exported
 */ class GameHUD {
    /**
     * Initialize HUD system
     */ initialize() {
        if (this._isInitialized) return;
        Logger.debug('[GameHUD] Initializing ESM version...');
        // Find UI elements based on the specific hierarchy
        this._findUIElements();
        // Verify elements were found
        this._logElementStatus();
        // Set up event listeners for new GameManager system
        this._setupEventListeners();
        // Store original health bar width for scaling
        if (this.healthBar?.element) {
            this._originalHealthWidth = this.healthBar.element.width;
        }
        // Hide countdown initially
        if (this.countdownText) {
            this.countdownText.enabled = false;
        }
        // Initialize with default values
        this._initializeHUD();
        this._isInitialized = true;
        Logger.debug('[GameHUD] ESM version ready');
    }
    /**
     * Find UI elements in the hierarchy
     */ _findUIElements() {
        // GameHUD/TimerPanel/Timer
        // GameHUD/HealthPanel/HealthBar
        // GameHUD/AmmoPanel/AmmoCount
        // GameHUD/CountdownOverlay/CountdownText
        // Timer element
        const timerPanel = this.entity.findByName('TimerPanel');
        this.timerText = timerPanel ? timerPanel.findByName('Timer') : null;
        // Health bar element
        const healthPanel = this.entity.findByName('HealthPanel');
        this.healthBar = healthPanel ? healthPanel.findByName('HealthBar') : null;
        // Ammo counter element
        const ammoPanel = this.entity.findByName('AmmoPanel');
        this.ammoText = ammoPanel ? ammoPanel.findByName('AmmoCount') : null;
        // Countdown text element
        const countdownOverlay = this.entity.findByName('CountdownOverlay');
        this.countdownText = countdownOverlay ? countdownOverlay.findByName('CountdownText') : null;
        // Fallback: try to find elements directly if hierarchy search fails
        if (!this.timerText) this.timerText = this.entity.findByName('Timer');
        if (!this.healthBar) this.healthBar = this.entity.findByName('HealthBar');
        if (!this.ammoText) this.ammoText = this.entity.findByName('AmmoCount');
        if (!this.countdownText) this.countdownText = this.entity.findByName('CountdownText');
    }
    /**
     * Log status of UI elements
     */ _logElementStatus() {
        Logger.debug('[GameHUD] UI Elements Status:');
        Logger.debug('  Timer:', this.timerText ? '✓ Found' : '✗ Missing');
        Logger.debug('  HealthBar:', this.healthBar ? '✓ Found' : '✗ Missing');
        Logger.debug('  AmmoCount:', this.ammoText ? '✓ Found' : '✗ Missing');
        Logger.debug('  CountdownText:', this.countdownText ? '✓ Found' : '✗ Missing');
    }
    /**
     * Setup event listeners (store bound refs so destroy() can off() correctly)
     */ _setupEventListeners() {
        this._handlers = {
            sessionStarted: this._onSessionStarted.bind(this),
            countdownStarted: this._onCountdownStarted.bind(this),
            countdownTick: this._onCountdownTick.bind(this),
            sessionEnded: this._onSessionEnded.bind(this),
            weaponSwitched: this._onWeaponSwitched.bind(this),
            weaponFired: this._onWeaponFired.bind(this),
            weaponReloadComplete: this._onReloadComplete.bind(this),
            healthChanged: this._onHealthChanged.bind(this)
        };
        // Game session
        this.app.on('game:sessionStarted', this._handlers.sessionStarted);
        this.app.on('game:countdownStarted', this._handlers.countdownStarted);
        this.app.on('game:countdownTick', this._handlers.countdownTick);
        this.app.on('game:sessionEnded', this._handlers.sessionEnded);
        // Weapons
        this.app.on('weapon:switched', this._handlers.weaponSwitched);
        this.app.on('weapon:fired', this._handlers.weaponFired);
        this.app.on('weapon:reload_complete', this._handlers.weaponReloadComplete);
        // Health
        this.app.on('player:healthChanged', this._handlers.healthChanged);
    }
    /**
     * Initialize HUD with default values
     */ _initializeHUD() {
        // Set initial values
        this.updateTimer(aiConfig.ui.HUD_DEFAULT_TIMER); // Default 5 minutes
        this.updateHealth(aiConfig.ui.HUD_DEFAULT_HEALTH_CURRENT, aiConfig.ui.HUD_DEFAULT_HEALTH_MAX); // Full health
        this.updateAmmo(aiConfig.ui.HUD_DEFAULT_AMMO_CURRENT, aiConfig.ui.HUD_DEFAULT_AMMO_TOTAL); // Default pistol ammo
    }
    // ============================================================================
    // TIMER UPDATES
    // ============================================================================
    updateTimer(timeRemaining) {
        if (!this.timerText?.element) return;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        this.timerText.element.text = minutes + ':' + seconds.toString().padStart(2, '0');
    }
    // ============================================================================
    // COUNTDOWN
    // ============================================================================
    _onCountdownStarted() {
        Logger.debug('[GameHUD] Countdown started');
        if (this.countdownText) {
            this.countdownText.enabled = true;
        }
    }
    _onCountdownTick(data) {
        if (!this.countdownText?.element) return;
        const timeRemaining = Math.max(0, data.timeRemaining || 0);
        const count = Math.ceil(timeRemaining);
        if (count > 0) {
            this.countdownText.element.text = String(count);
        } else {
            this.countdownText.element.text = 'GO!';
            setTimeout(()=>{
                if (this.countdownText) {
                    this.countdownText.enabled = false;
                }
            }, aiConfig.ui.HUD_COUNTDOWN_GO_HIDE_MS);
        }
    }
    _onSessionStarted() {
        Logger.debug('[GameHUD] Session started');
        // Hide countdown after short delay
        setTimeout(()=>{
            if (this.countdownText) {
                this.countdownText.enabled = false;
            }
        }, aiConfig.ui.HUD_COUNTDOWN_START_HIDE_MS);
    }
    _onSessionEnded() {
        Logger.debug('[GameHUD] Session ended');
    }
    // ============================================================================
    // WEAPON UPDATES
    // ============================================================================
    updateAmmo(current, total) {
        if (!this.ammoText?.element) return;
        this.ammoText.element.text = current + '/' + total;
    }
    _onWeaponSwitched(data) {
        // Only update HUD for player's weapon, not AI agents
        const shooter = data?.shooter || data?.entity;
        if (!shooter || !shooter.tags || !(shooter.tags.has('player') || shooter.tags.has('team_player'))) {
            return; // Ignore AI agent weapon switch
        }
        const w = data?.weapon;
        const cur = data?.ammo !== undefined ? data.ammo : w?.ammo ?? 0;
        const tot = data?.totalAmmo !== undefined ? data.totalAmmo : w?.totalAmmo ?? 0;
        this._lastWeaponEventAt = this.app?.time || Date.now();
        this.updateAmmo(cur, tot);
    }
    _onWeaponFired(data) {
        // Only update HUD for player's weapon, not AI agents
        const shooter = data?.shooter || data?.entity;
        if (!shooter || !shooter.tags || !(shooter.tags.has('player') || shooter.tags.has('team_player'))) {
            return; // Ignore AI agent weapon fire
        }
        const w = data?.weapon;
        const cur = data?.ammo !== undefined ? data.ammo : w?.ammo ?? 0;
        const tot = data?.totalAmmo !== undefined ? data.totalAmmo : w?.totalAmmo ?? 0;
        this._lastWeaponEventAt = this.app?.time || Date.now();
        this.updateAmmo(cur, tot);
    }
    _onReloadComplete(data) {
        // Only update HUD for player's weapon, not AI agents
        const shooter = data?.shooter || data?.entity;
        if (!shooter || !shooter.tags || !(shooter.tags.has('player') || shooter.tags.has('team_player'))) {
            return; // Ignore AI agent reload
        }
        const w = data?.weapon;
        const cur = data?.ammo !== undefined ? data.ammo : w?.ammo ?? 0;
        const tot = data?.totalAmmo !== undefined ? data.totalAmmo : w?.totalAmmo ?? 0;
        this._lastWeaponEventAt = this.app?.time || Date.now();
        this.updateAmmo(cur, tot);
    }
    // ============================================================================
    // HEALTH UPDATES
    // ============================================================================
    updateHealth(current, max) {
        if (!this.healthBar?.element) return;
        const percentage = Math.max(0, Math.min(1, current / Math.max(1, max)));
        // Store original width on first call
        if (this._originalHealthWidth === null) {
            this._originalHealthWidth = this.healthBar.element.width;
        }
        // Update health bar width
        this.healthBar.element.width = this._originalHealthWidth * percentage;
        // Change color based on health percentage
        if (percentage < aiConfig.ui.HUD_HEALTH_CRITICAL_THRESHOLD) {
            this.healthBar.element.color = new Color(1, 0, 0); // Red
        } else if (percentage < aiConfig.ui.HUD_HEALTH_LOW_THRESHOLD) {
            this.healthBar.element.color = new Color(1, 1, 0); // Yellow
        } else {
            this.healthBar.element.color = new Color(0, 1, 0); // Green
        }
    }
    _onHealthChanged(data) {
        const current = data.current ?? 0;
        const max = data.max ?? aiConfig.ui.HUD_DEFAULT_HEALTH_MAX;
        this.updateHealth(current, max);
    }
    // ============================================================================
    // UPDATE LOOP (poll player data + session timer)
    // ============================================================================
    update(dt) {
        if (!this._isInitialized) return;
        // Update timer from GameSession if available
        this._updateTimerFromSession();
        // Poll player data for health and ammo
        this._updatePlayerData();
    }
    _updateTimerFromSession() {
        if (!this.app.gameManager) return;
        const gameSession = this.app.gameManager.gameSession;
        if (gameSession?.isActive) {
            this.updateTimer(Math.max(0, gameSession.timeRemaining));
        }
    }
    /**
     * Update player data from systems (robust to naming differences)
     * Includes small hold window after weapon events to avoid event/poll fighting.
     */ _updatePlayerData() {
        const gm = this.app?.gameManager;
        if (!gm?.player) return;
        const player = gm.player;
        const playerEntity = player.entity || player;
        const scr = playerEntity?.script;
        if (!scr) return;
        // Respect readiness if exposed
        if (typeof player.isReady === 'function' && !player.isReady()) return;
        // -----------------------------
        // HEALTH
        // -----------------------------
        const hs = scr.healthSystem;
        if (hs) {
            const ready = typeof hs.isReady !== 'function' || hs.isReady();
            if (ready) {
                // Accept multiple field names/functions
                const current = hs.currentHealth ?? hs.health ?? (typeof hs.getCurrentHealth === 'function' ? hs.getCurrentHealth() : undefined) ?? aiConfig.ui.HUD_DEFAULT_HEALTH_CURRENT;
                const max = hs.maxHealth ?? (typeof hs.getMaxHealth === 'function' ? hs.getMaxHealth() : undefined) ?? aiConfig.ui.HUD_DEFAULT_HEALTH_MAX;
                // Clamp & coerce
                const curNum = Math.max(0, Number(current) || 0);
                const maxNum = Math.max(1, Number(max) || 1);
                this.updateHealth(curNum, maxNum);
            }
        }
        // -----------------------------
        // AMMO (skip polling briefly after weapon events)
        // -----------------------------
        const nowT = this.app?.time || Date.now();
        const withinHold = nowT - this._lastWeaponEventAt < this._weaponEventHoldMs;
        const ws = scr.weaponSystem;
        if (ws && !withinHold) {
            const ready = typeof ws.isReady !== 'function' || ws.isReady();
            if (ready) {
                // Prefer a consolidated getter if available
                const info = typeof ws.getWeaponInfo === 'function' ? ws.getWeaponInfo() : null;
                // Accept multiple naming styles (currentMagazine/magazine, totalAmmo/ammo)
                const cur = info?.currentMagazine ?? info?.magazine ?? ws.currentMagazine ?? ws.magazine ?? 0;
                const total = info?.totalAmmo ?? info?.ammo ?? ws.totalAmmo ?? ws.ammo ?? 0;
                const curNum = Math.max(0, Number(cur) || 0);
                const totalNum = Math.max(0, Number(total) || 0);
                this.updateAmmo(curNum, totalNum);
            }
        }
    }
    // ============================================================================
    // PUBLIC API FOR UI MANAGER
    // ============================================================================
    showCountdown(count) {
        if (!this.countdownText) return;
        this.countdownText.enabled = true;
        if (this.countdownText.element) {
            this.countdownText.element.text = count > 0 ? String(count) : 'GO!';
        }
    }
    hideCountdown() {
        if (this.countdownText) {
            this.countdownText.enabled = false;
        }
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (!this._isInitialized) return;
        // Remove event listeners (using stored refs)
        if (this._handlers) {
            this.app.off('game:sessionStarted', this._handlers.sessionStarted);
            this.app.off('game:countdownStarted', this._handlers.countdownStarted);
            this.app.off('game:countdownTick', this._handlers.countdownTick);
            this.app.off('game:sessionEnded', this._handlers.sessionEnded);
            this.app.off('weapon:switched', this._handlers.weaponSwitched);
            this.app.off('weapon:fired', this._handlers.weaponFired);
            this.app.off('weapon:reload_complete', this._handlers.weaponReloadComplete);
            this.app.off('player:healthChanged', this._handlers.healthChanged);
        }
        this._handlers = null;
        this._isInitialized = false;
        Logger.debug('[GameHUD] Cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // UI element references
        this.timerText = null;
        this.healthBar = null;
        this.ammoText = null;
        this.countdownText = null;
        // State tracking
        this._originalHealthWidth = null;
        this._isInitialized = false;
        // 🔧 Weapon event vs poll race guard
        this._lastWeaponEventAt = 0;
        this._weaponEventHoldMs = aiConfig.ui.HUD_WEAPON_EVENT_HOLD_MS;
        // Bound handlers container for proper off()
        this._handlers = null;
        Logger.debug('[GameHUD] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for GameHUD (Modern ESM Version)
 * Provides compatibility with PlayCanvas script system
 */ class GameHUDScript extends Script {
    initialize() {
        // Create ESM instance
        this.gameHUD = new GameHUD(this.app, this.entity);
        this.gameHUD.initialize();
    }
    update(dt) {
        if (this.gameHUD) {
            this.gameHUD.update(dt);
        }
    }
    destroy() {
        if (this.gameHUD) {
            this.gameHUD.destroy();
            this.gameHUD = null;
        }
    }
}
_define_property(GameHUDScript, "scriptName", 'gameHUD');
_define_property(GameHUDScript, "attributes", {});

export { GameHUDScript };
