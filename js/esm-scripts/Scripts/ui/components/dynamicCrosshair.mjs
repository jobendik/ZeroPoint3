import { Script, Vec3 } from '../../../../playcanvas-stable.min.mjs';
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
 * DynamicCrosshair Class - Full-featured ESM Implementation
 * Internal helper class, not exported
 */ class DynamicCrosshair {
    /**
     * Initialize crosshair system
     */ initialize() {
        if (this._isInitialized) return;
        Logger.debug('[DynamicCrosshair] Initializing full-featured version...');
        this._createCrosshairElement();
        this._setupEventListeners();
        this._applyInitialStyles();
        // Initialize with pistol configuration
        this.currentWeapon = 'pistol';
        this.currentSpread = this.weaponConfig.pistol.baseSpread;
        this.targetSpread = this.weaponConfig.pistol.baseSpread;
        // Start hidden by default, will be shown when game starts
        this.setVisible(false);
        this._isInitialized = true;
        Logger.debug('[DynamicCrosshair] Full-featured version ready with weapon:', this.currentWeapon);
    }
    /**
     * Create CSS-based crosshair element
     */ _createCrosshairElement() {
        const doc = window.parent ? window.parent.document : document;
        const body = doc.body;
        // Remove any existing crosshair
        const existing = doc.getElementById('crosshair-container');
        if (existing) existing.remove();
        // Create crosshair container with fixed dimensions to contain absolute children
        this.crosshairElement = doc.createElement('div');
        this.crosshairElement.id = 'crosshair-container';
        this.crosshairElement.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            pointer-events: none !important;
            z-index: 99999 !important;
            width: 100px !important;
            height: 100px !important;
        `;
        // Create individual crosshair elements
        this.crosshairElements = {
            top: this._createCrosshairPart('top'),
            bottom: this._createCrosshairPart('bottom'),
            left: this._createCrosshairPart('left'),
            right: this._createCrosshairPart('right'),
            center: this._createCrosshairPart('center')
        };
        // Append elements to container
        Object.values(this.crosshairElements).forEach((el)=>{
            this.crosshairElement.appendChild(el);
        });
        body.appendChild(this.crosshairElement);
        Logger.debug('[DynamicCrosshair] Created crosshair elements in DOM');
    }
    /**
     * Create individual crosshair part element
     */ _createCrosshairPart(position) {
        const doc = window.parent ? window.parent.document : document;
        const el = doc.createElement('div');
        el.className = `crosshair-element crosshair-${position}`;
        el.style.cssText = `
            position: absolute !important;
            background-color: white !important;
            transition: all 0.1s ease-out !important;
        `;
        return el;
    }
    /**
     * Apply CSS styles for crosshair
     */ _applyInitialStyles() {
        const doc = window.parent ? window.parent.document : document;
        // Inject global styles to ensure crosshair overlays everything (run once)
        if (!window.crosshairStylesInjected) {
            const style = doc.createElement('style');
            style.id = 'crosshair-global-styles';
            style.textContent = `
                html, body {
                    position: relative !important;
                    overflow: visible !important;
                    z-index: 0 !important;
                }
                #application-canvas {
                    position: absolute !important;
                    z-index: 1 !important;
                }
                #crosshair-container {
                    z-index: 99999 !important;
                }
            `;
            doc.head.appendChild(style);
            window.crosshairStylesInjected = true;
            Logger.debug('[DynamicCrosshair] Injected global CSS for overlay');
        }
        // Set up cross style by default
        this._updateCrosshairStyle();
    }
    /**
     * Update crosshair style based on current weapon
     */ _updateCrosshairStyle() {
        const config = this.weaponConfig[this.currentWeapon];
        if (!config) return;
        // Apply style based on weapon configuration
        switch(config.style){
            case 'dot':
                this._setupDotStyle();
                break;
            case 'cross':
                this._setupCrossStyle();
                break;
            case 'circle':
                this._setupCircleStyle();
                break;
            case 'square':
                this._setupSquareStyle();
                break;
            default:
                this._setupCrossStyle();
                break;
        }
    }
    /**
     * Setup event listeners
     */ _setupEventListeners() {
        // Store bound handlers for proper cleanup
        this._handlers = {
            gameStart: this._onGameStart.bind(this),
            gameEnd: this._onGameEnd.bind(this),
            hudShown: this._onHUDShown.bind(this),
            weaponSwitched: this._onWeaponSwitched.bind(this),
            weaponFired: this._onWeaponFired.bind(this),
            playerMoving: ()=>{
                this.isMoving = true;
            },
            playerStopped: ()=>{
                this.isMoving = false;
            }
        };
        // Game state events
        this.app.on('game:sessionStarted', this._handlers.gameStart);
        this.app.on('game:sessionEnded', this._handlers.gameEnd);
        this.app.on('ui:hudShown', this._handlers.hudShown);
        // Weapon events
        this.app.on('weapon:switched', this._handlers.weaponSwitched);
        this.app.on('weapon:fired', this._handlers.weaponFired);
        // Player movement events (simplified)
        this.app.on('player:moving', this._handlers.playerMoving);
        this.app.on('player:stopped', this._handlers.playerStopped);
    }
    /**
     * Update crosshair state and visuals
     */ update(dt) {
        if (!this._isInitialized || !this.isVisible) return;
        if (!this.crosshairElement) return;
        // Update movement detection via position tracking
        this._updateMovementDetection(dt);
        // Query player weapon if available
        this._updateCurrentWeaponFromSystem();
        // Calculate spread and update visuals
        this._updateSpread(dt);
        this._applyCrosshairVisuals();
    }
    /**
     * Update movement detection based on position tracking
     */ _updateMovementDetection(dt) {
        // Get player entity from script attribute or fallback to gameManager
        const player = this._getPlayerEntity();
        if (!player) return;
        const currentPosition = player.getPosition();
        if (!currentPosition) return;
        // Initialize last position on first update
        if (!this.lastPosition || this.lastPosition.length() === 0) {
            this.lastPosition.copy(currentPosition);
            return;
        }
        // Calculate velocity
        this.velocity.copy(currentPosition).sub(this.lastPosition).scale(1.0 / dt);
        const speed = this.velocity.length();
        // Detect walking vs running based on speed thresholds
        this.isRunning = speed > this.runThreshold;
        this.isMoving = speed > this.walkThreshold;
        this.lastPosition.copy(currentPosition);
    }
    /**
     * Update current weapon from weapon system
     */ _updateCurrentWeaponFromSystem() {
        const player = this._getPlayerEntity();
        if (!player) return;
        const weaponSystem = player?.script?.weaponSystem;
        if (weaponSystem) {
            const weaponCore = weaponSystem.weaponCore || weaponSystem;
            const currentWeapon = weaponCore.currentWeapon;
            if (currentWeapon && currentWeapon !== this.currentWeapon && this.weaponConfig[currentWeapon]) {
                this.currentWeapon = currentWeapon;
                this.currentSpread = this.weaponConfig[currentWeapon].baseSpread;
                this.targetSpread = this.weaponConfig[currentWeapon].baseSpread;
            }
        }
    }
    /**
     * Get player entity from script attribute or fallback to gameManager
     */ _getPlayerEntity() {
        // First try: Use playerEntity attribute if set
        if (this.script.playerEntity) {
            return this.script.playerEntity;
        }
        // Second try: Use gameManager.player if available
        const player = this.app?.gameManager?.player;
        if (player) {
            return player.entity || player;
        }
        // No player found
        return null;
    }
    /**
     * Update spread calculations
     */ _updateSpread(dt) {
        const config = this.weaponConfig[this.currentWeapon];
        if (!config) return;
        // Calculate target spread based on state
        let targetSpread = config.baseSpread;
        // Add movement spread (multiplicative, with running being more intense)
        if (this.isRunning) {
            // Running: Apply movement multiplier + extra running penalty
            targetSpread = config.baseSpread * config.movementMult * this.movementSpreadMultiplier * 1.5;
        } else if (this.isMoving) {
            // Walking: Apply normal movement multiplier
            targetSpread = config.baseSpread * config.movementMult * this.movementSpreadMultiplier;
        }
        // Add shooting spread (decays over time)
        const currentTime = Date.now() / 1000.0;
        const timeSinceShoot = currentTime - this.lastShootTime;
        if (timeSinceShoot < this.shootingDecayTime) {
            const shootDecayFactor = 1.0 - timeSinceShoot / this.shootingDecayTime;
            const shootingSpread = config.baseSpread * config.shootingMult * this.shootingSpreadMultiplier * shootDecayFactor;
            // Add shooting spread on top of movement spread (additive for maximum spread)
            targetSpread = targetSpread + shootingSpread;
        }
        // Smooth transition to target spread
        this.targetSpread = targetSpread;
        this.currentSpread += (this.targetSpread - this.currentSpread) * dt * this.recoverySpeed;
    }
    /**
     * Apply visual updates to crosshair
     */ _applyCrosshairVisuals() {
        if (!this.crosshairElement || !this.crosshairElements) return;
        const config = this.weaponConfig[this.currentWeapon];
        if (!config) {
            Logger.warn(`[DynamicCrosshair] No config found for weapon: ${this.currentWeapon}`);
            return;
        }
        const spread = Math.round(this.currentSpread);
        const elements = this.crosshairElements;
        // Update positions based on current style
        if (config.style === 'circle') {
            // For circle, scale the circle size
            const size = Math.max(16, spread * 1.5);
            elements.center.style.width = `${size}px`;
            elements.center.style.height = `${size}px`;
        } else if (config.style === 'dot') {
            // Dot doesn't spread much, but might pulse slightly
            const pulseSize = config.thickness * 2 + (spread - config.baseSpread) * 0.1;
            const finalSize = Math.max(config.thickness * 2, pulseSize);
            elements.center.style.width = `${finalSize}px`;
            elements.center.style.height = `${finalSize}px`;
        } else {
            // For cross and square styles, move elements outward from the 50px center
            elements.top.style.top = `${50 - spread}px`;
            elements.bottom.style.top = `${50 + spread}px`;
            elements.left.style.left = `${50 - spread}px`;
            elements.right.style.left = `${50 + spread}px`;
        }
        // Update colors for all visible elements
        Object.values(elements).forEach((el)=>{
            if (el.style.display !== 'none') {
                if (config.style === 'circle') {
                    el.style.backgroundColor = 'transparent'; // Always force transparent for circle
                    el.style.borderColor = config.color;
                } else {
                    el.style.backgroundColor = config.color;
                    el.style.borderColor = 'none'; // Ensure border is removed if switching from circle
                }
            }
        });
    }
    /**
     * Setup cross style crosshair
     */ _setupCrossStyle() {
        if (!this.crosshairElements) return;
        const elements = this.crosshairElements;
        const config = this.weaponConfig[this.currentWeapon];
        const thickness = config.thickness;
        const length = aiConfig.ui.PISTOL_LINE_LENGTH;
        // Show all elements
        Object.values(elements).forEach((el)=>{
            el.style.display = 'block';
            el.style.backgroundColor = config.color;
            el.style.border = 'none';
            el.style.borderRadius = '0';
        });
        // Top line - positioned at top center, moves up with spread
        elements.top.style.width = `${thickness}px`;
        elements.top.style.height = `${length}px`;
        elements.top.style.left = '50%';
        elements.top.style.transform = 'translate(-50%, -100%)';
        // Bottom line - positioned at bottom center, moves down with spread
        elements.bottom.style.width = `${thickness}px`;
        elements.bottom.style.height = `${length}px`;
        elements.bottom.style.left = '50%';
        elements.bottom.style.transform = 'translate(-50%, 0%)';
        // Left line - positioned at left center, moves left with spread
        elements.left.style.width = `${length}px`;
        elements.left.style.height = `${thickness}px`;
        elements.left.style.top = '50%';
        elements.left.style.transform = 'translate(-100%, -50%)';
        // Right line - positioned at right center, moves right with spread
        elements.right.style.width = `${length}px`;
        elements.right.style.height = `${thickness}px`;
        elements.right.style.top = '50%';
        elements.right.style.transform = 'translate(0%, -50%)';
        // Center dot - stays at exact center
        elements.center.style.width = `${thickness}px`;
        elements.center.style.height = `${thickness}px`;
        elements.center.style.borderRadius = '50%';
        elements.center.style.left = '50%';
        elements.center.style.top = '50%';
        elements.center.style.transform = 'translate(-50%, -50%)';
    }
    /**
     * Setup dot style crosshair
     */ _setupDotStyle() {
        if (!this.crosshairElements) return;
        const elements = this.crosshairElements;
        const config = this.weaponConfig[this.currentWeapon];
        const thickness = config.thickness;
        // Hide all except center
        elements.top.style.display = 'none';
        elements.bottom.style.display = 'none';
        elements.left.style.display = 'none';
        elements.right.style.display = 'none';
        // Center dot
        elements.center.style.display = 'block';
        elements.center.style.width = `${thickness * 2}px`;
        elements.center.style.height = `${thickness * 2}px`;
        elements.center.style.borderRadius = '50%';
        elements.center.style.backgroundColor = config.color;
        elements.center.style.border = 'none';
        elements.center.style.left = '50%';
        elements.center.style.top = '50%';
        elements.center.style.transform = 'translate(-50%, -50%)';
    }
    /**
     * Setup circle style crosshair
     */ _setupCircleStyle() {
        if (!this.crosshairElements) return;
        const elements = this.crosshairElements;
        const config = this.weaponConfig[this.currentWeapon];
        const thickness = config.thickness;
        // Hide lines, show center as circle outline
        elements.top.style.display = 'none';
        elements.bottom.style.display = 'none';
        elements.left.style.display = 'none';
        elements.right.style.display = 'none';
        // Center circle outline
        elements.center.style.display = 'block';
        elements.center.style.width = '16px';
        elements.center.style.height = '16px';
        elements.center.style.borderRadius = '50%';
        elements.center.style.backgroundColor = 'transparent';
        elements.center.style.border = `${thickness}px solid ${config.color}`;
        elements.center.style.left = '50%';
        elements.center.style.top = '50%';
        elements.center.style.transform = 'translate(-50%, -50%)';
    }
    /**
     * Setup square style crosshair
     */ _setupSquareStyle() {
        if (!this.crosshairElements) return;
        const elements = this.crosshairElements;
        const config = this.weaponConfig[this.currentWeapon];
        const size = aiConfig.ui.SHOTGUN_DOT_SIZE;
        // Show corner elements as small squares
        elements.top.style.display = 'block';
        elements.bottom.style.display = 'block';
        elements.left.style.display = 'block';
        elements.right.style.display = 'block';
        elements.center.style.display = 'none';
        // Configure as small squares
        [
            elements.top,
            elements.bottom,
            elements.left,
            elements.right
        ].forEach((el)=>{
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.borderRadius = '0';
            el.style.backgroundColor = config.color;
            el.style.border = 'none';
        });
        // Position squares
        elements.top.style.left = '50%';
        elements.top.style.transform = 'translate(-50%, -100%)';
        elements.bottom.style.left = '50%';
        elements.bottom.style.transform = 'translate(-50%, 0%)';
        elements.left.style.top = '50%';
        elements.left.style.transform = 'translate(-100%, -50%)';
        elements.right.style.top = '50%';
        elements.right.style.transform = 'translate(0%, -50%)';
    }
    /**
     * Set crosshair visibility
     */ setVisible(visible) {
        this.isVisible = visible;
        if (this.crosshairElement) {
            this.crosshairElement.style.display = visible ? 'block' : 'none';
            Logger.debug(`[DynamicCrosshair] Visibility set to: ${visible}`);
            // Extra debugging for visibility issues
            if (visible && this.crosshairElement) {
                const rect = this.crosshairElement.getBoundingClientRect();
                Logger.debug(`[DynamicCrosshair] Element position - top: ${rect.top}, left: ${rect.left}, width: ${rect.width}, height: ${rect.height}`);
                Logger.debug(`[DynamicCrosshair] Z-index: ${this.crosshairElement.style.zIndex}`);
            }
        } else {
            Logger.warn('[DynamicCrosshair] Cannot set visibility - crosshairElement is null');
        }
    }
    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    /**
     * Handle game start
     */ _onGameStart() {
        this.setVisible(true);
        // Query player's current weapon on game start
        this._queryPlayerWeapon();
        // Initialize position tracking
        this._initializePositionTracking();
    }
    /**
     * Query and sync with player's current weapon
     */ _queryPlayerWeapon() {
        const player = this._getPlayerEntity();
        if (!player) return;
        const weaponSystem = player?.script?.weaponSystem;
        if (weaponSystem) {
            const weaponCore = weaponSystem.weaponCore || weaponSystem;
            const currentWeapon = weaponCore.currentWeapon;
            if (currentWeapon && this.weaponConfig[currentWeapon]) {
                this.currentWeapon = currentWeapon;
                this.currentSpread = this.weaponConfig[currentWeapon].baseSpread;
                Logger.debug(`[DynamicCrosshair] Synced with player weapon: ${currentWeapon}`);
            }
        }
    }
    /**
     * Initialize position tracking for movement detection
     */ _initializePositionTracking() {
        const player = this._getPlayerEntity();
        if (!player) return;
        const playerPos = player.getPosition();
        if (playerPos) {
            this.lastPosition.copy(playerPos);
            Logger.debug('[DynamicCrosshair] Initialized position tracking');
        }
    }
    /**
     * Handle game end
     */ _onGameEnd() {
        this.setVisible(false);
    }
    /**
     * Handle HUD shown
     */ _onHUDShown() {
        // Only show if game is active
        const isPlaying = this.app.gameManager?.currentState === 'playing';
        this.setVisible(isPlaying);
    }
    /**
     * Handle weapon switch
     */ _onWeaponSwitched(data) {
        // Only respond to player's weapon switch, not AI agents
        const shooter = data?.shooter || data?.entity;
        if (!shooter || !shooter.tags || !(shooter.tags.has('player') || shooter.tags.has('team_player'))) {
            return; // Ignore AI agent weapon switch
        }
        // weaponType is sent directly in the event data, not nested in weapon.type
        const weaponType = (data?.weaponType || data?.weapon?.type || '').toLowerCase();
        if (weaponType && this.weaponConfig[weaponType]) {
            this.currentWeapon = weaponType;
            this.currentSpread = this.weaponConfig[weaponType].baseSpread; // Reset spread on weapon switch
            this._updateCrosshairStyle(); // Update visual style for new weapon
            Logger.debug(`[DynamicCrosshair] Switched to weapon: ${weaponType}`);
        }
    }
    /**
     * Handle weapon fired
     */ _onWeaponFired(data) {
        // Only respond to player's weapon fire, not AI agents
        const shooter = data?.shooter || data?.entity;
        if (!shooter || !shooter.tags || !(shooter.tags.has('player') || shooter.tags.has('team_player'))) {
            return; // Ignore AI agent weapon fire
        }
        this.lastShootTime = Date.now() / 1000.0;
        // Immediately increase spread for shooting
        const config = this.weaponConfig[this.currentWeapon];
        if (config) {
            const shootingSpread = config.baseSpread * config.shootingMult;
            this.targetSpread = Math.max(this.targetSpread, shootingSpread);
        }
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup crosshair
     */ destroy() {
        if (!this._isInitialized) return;
        // Remove DOM elements
        if (this.crosshairElement) {
            this.crosshairElement.remove();
            this.crosshairElement = null;
        }
        // Remove styles (use correct ID)
        const doc = window.parent ? window.parent.document : document;
        const style = doc.getElementById('crosshair-global-styles');
        if (style) style.remove();
        // Remove event listeners using stored handlers
        if (this._handlers) {
            this.app.off('game:sessionStarted', this._handlers.gameStart);
            this.app.off('game:sessionEnded', this._handlers.gameEnd);
            this.app.off('ui:hudShown', this._handlers.hudShown);
            this.app.off('weapon:switched', this._handlers.weaponSwitched);
            this.app.off('weapon:fired', this._handlers.weaponFired);
            this.app.off('player:moving', this._handlers.playerMoving);
            this.app.off('player:stopped', this._handlers.playerStopped);
            this._handlers = null;
        }
        this._isInitialized = false;
        Logger.debug('[DynamicCrosshair] Cleaned up');
    }
    constructor(app, entity, scriptInstance){
        this.app = app;
        this.entity = entity;
        this.script = scriptInstance; // Store script instance to access attributes
        // Build weapon configurations from script attributes
        this.weaponConfig = {
            pistol: {
                baseSpread: this.script.pistolBaseSpread,
                movementMult: this.script.pistolMovementMult,
                shootingMult: this.script.pistolShootingMult,
                style: this.script.pistolStyle,
                color: this.script.pistolColor,
                thickness: this.script.pistolThickness
            },
            machinegun: {
                baseSpread: this.script.machinegunBaseSpread,
                movementMult: this.script.machinegunMovementMult,
                shootingMult: this.script.machinegunShootingMult,
                style: this.script.machinegunStyle,
                color: this.script.machinegunColor,
                thickness: this.script.machinegunThickness
            },
            shotgun: {
                baseSpread: this.script.shotgunBaseSpread,
                movementMult: this.script.shotgunMovementMult,
                shootingMult: this.script.shotgunShootingMult,
                style: this.script.shotgunStyle,
                color: this.script.shotgunColor,
                thickness: this.script.shotgunThickness
            }
        };
        // State
        this.currentWeapon = 'pistol';
        this.currentSpread = aiConfig.ui.CROSSHAIR_DEFAULT_SPREAD;
        this.targetSpread = aiConfig.ui.CROSSHAIR_DEFAULT_SPREAD;
        this.isMoving = false;
        this.isRunning = false;
        this.lastShootTime = 0;
        this.isVisible = false;
        this.shootingDecayTime = aiConfig.ui.CROSSHAIR_SHOOTING_DECAY_TIME; // Time for shooting spread to decay
        // Store configuration values
        this.recoverySpeed = this.script.recoverySpeed;
        this.movementSpreadMultiplier = this.script.movementSpreadMultiplier;
        this.shootingSpreadMultiplier = this.script.shootingSpreadMultiplier;
        // Movement tracking
        this.lastPosition = new Vec3();
        this.velocity = new Vec3();
        this.walkThreshold = aiConfig.ui.CROSSHAIR_WALK_THRESHOLD; // Speed threshold for walking detection
        this.runThreshold = aiConfig.ui.CROSSHAIR_RUN_THRESHOLD; // Speed threshold for running detection
        // DOM elements
        this.crosshairElement = null;
        this.crosshairElements = null;
        this._isInitialized = false;
        Logger.debug('[DynamicCrosshair] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for DynamicCrosshair (Modern ESM Version)
 */ class DynamicCrosshairScript extends Script {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        Logger.debug('[DynamicCrosshair] Initializing script adapter...');
        // Pass script instance to constructor so it can access attributes
        this.crosshair = new DynamicCrosshair(this.app, this.entity, this);
        this.crosshair.initialize();
        // Check if game is already running and show crosshair
        const isPlaying = this.app.gameManager?.currentState === 'playing';
        if (isPlaying) {
            Logger.debug('[DynamicCrosshair] Game already running, showing crosshair');
            this.crosshair.setVisible(true);
            this.crosshair._queryPlayerWeapon();
            this.crosshair._initializePositionTracking();
        }
        Logger.debug('[DynamicCrosshair] Script adapter initialized successfully');
    }
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    update(dt) {
        if (this.crosshair) {
            this.crosshair.update(dt);
        }
    }
    // ============================================================================
    // HOT-RELOAD SUPPORT
    // ============================================================================
    swap(old) {
        // Hot-reload support - transfer state from old instance
        if (old.crosshair) {
            // Transfer the crosshair instance to preserve DOM elements and state
            this.crosshair = old.crosshair;
            // Update references in the crosshair instance
            this.crosshair.entity = this.entity;
            this.crosshair.script = this;
            // Update weapon configuration from new script attributes
            this.crosshair.weaponConfig = {
                pistol: {
                    baseSpread: this.pistolBaseSpread,
                    movementMult: this.pistolMovementMult,
                    shootingMult: this.pistolShootingMult,
                    style: this.pistolStyle,
                    color: this.pistolColor,
                    thickness: this.pistolThickness
                },
                machinegun: {
                    baseSpread: this.machinegunBaseSpread,
                    movementMult: this.machinegunMovementMult,
                    shootingMult: this.machinegunShootingMult,
                    style: this.machinegunStyle,
                    color: this.machinegunColor,
                    thickness: this.machinegunThickness
                },
                shotgun: {
                    baseSpread: this.shotgunBaseSpread,
                    movementMult: this.shotgunMovementMult,
                    shootingMult: this.shotgunShootingMult,
                    style: this.shotgunStyle,
                    color: this.shotgunColor,
                    thickness: this.shotgunThickness
                }
            };
            // Update global configuration values
            this.crosshair.recoverySpeed = this.recoverySpeed;
            this.crosshair.movementSpreadMultiplier = this.movementSpreadMultiplier;
            this.crosshair.shootingSpreadMultiplier = this.shootingSpreadMultiplier;
            // Refresh the crosshair style to apply any visual changes
            this.crosshair._updateCrosshairStyle();
            Logger.debug('[DynamicCrosshair] Hot-reload: state and configuration transferred');
        }
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (this.crosshair) {
            this.crosshair.destroy();
            this.crosshair = null;
        }
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES - INDIVIDUAL ATTRIBUTES FOR EDITOR DISPLAY
        // ============================================================================
        /** @attribute @type {pc.Entity} @title Player Entity @description Reference to the player entity (optional - will auto-detect if not set) */ _define_property(this, "playerEntity", null);
        /** @attribute @type {boolean} @title Debug Mode */ _define_property(this, "debugMode", false);
        /** @attribute @type {number} @min 1.0 @max 10.0 @title Recovery Speed @description How fast crosshair returns to normal */ _define_property(this, "recoverySpeed", aiConfig.ui.CROSSHAIR_RECOVERY_SPEED);
        /** @attribute @type {number} @min 0.5 @max 5.0 @title Global Movement Spread Multiplier */ _define_property(this, "movementSpreadMultiplier", aiConfig.ui.CROSSHAIR_MOVEMENT_MULT);
        /** @attribute @type {number} @min 0.5 @max 3.0 @title Global Shooting Spread Multiplier */ _define_property(this, "shootingSpreadMultiplier", aiConfig.ui.CROSSHAIR_SHOOTING_MULT);
        // Pistol attributes
        /** @attribute @type {number} @min 1 @max 80 @title Pistol: Base Spread */ _define_property(this, "pistolBaseSpread", aiConfig.ui.PISTOL_BASE_SPREAD);
        /** @attribute @type {number} @min 0.5 @max 8.0 @title Pistol: Movement Multiplier */ _define_property(this, "pistolMovementMult", aiConfig.ui.PISTOL_MOVEMENT_MULT);
        /** @attribute @type {number} @min 0.5 @max 5.0 @title Pistol: Shooting Multiplier */ _define_property(this, "pistolShootingMult", aiConfig.ui.PISTOL_SHOOTING_MULT);
        /** @attribute @type {string} @title Pistol: Crosshair Style @enum {dot, cross, circle, square} */ _define_property(this, "pistolStyle", 'cross');
        /** @attribute @type {string} @title Pistol: Color */ _define_property(this, "pistolColor", '#ffffff');
        /** @attribute @type {number} @min 1 @max 10 @title Pistol: Thickness */ _define_property(this, "pistolThickness", aiConfig.ui.PISTOL_THICKNESS);
        // Machine Gun attributes
        /** @attribute @type {number} @min 1 @max 80 @title Machine Gun: Base Spread */ _define_property(this, "machinegunBaseSpread", aiConfig.ui.MACHINEGUN_BASE_SPREAD);
        /** @attribute @type {number} @min 0.5 @max 8.0 @title Machine Gun: Movement Multiplier */ _define_property(this, "machinegunMovementMult", aiConfig.ui.MACHINEGUN_MOVEMENT_MULT);
        /** @attribute @type {number} @min 0.5 @max 5.0 @title Machine Gun: Shooting Multiplier */ _define_property(this, "machinegunShootingMult", aiConfig.ui.MACHINEGUN_SHOOTING_MULT);
        /** @attribute @type {string} @title Machine Gun: Crosshair Style @enum {dot, cross, circle, square} */ _define_property(this, "machinegunStyle", 'cross');
        /** @attribute @type {string} @title Machine Gun: Color */ _define_property(this, "machinegunColor", '#ffff00');
        /** @attribute @type {number} @min 1 @max 10 @title Machine Gun: Thickness */ _define_property(this, "machinegunThickness", aiConfig.ui.MACHINEGUN_THICKNESS);
        // Shotgun attributes
        /** @attribute @type {number} @min 1 @max 80 @title Shotgun: Base Spread */ _define_property(this, "shotgunBaseSpread", aiConfig.ui.SHOTGUN_BASE_SPREAD);
        /** @attribute @type {number} @min 0.5 @max 8.0 @title Shotgun: Movement Multiplier */ _define_property(this, "shotgunMovementMult", aiConfig.ui.SHOTGUN_MOVEMENT_MULT);
        /** @attribute @type {number} @min 0.5 @max 5.0 @title Shotgun: Shooting Multiplier */ _define_property(this, "shotgunShootingMult", aiConfig.ui.SHOTGUN_SHOOTING_MULT);
        /** @attribute @type {string} @title Shotgun: Crosshair Style @enum {dot, cross, circle, square} */ _define_property(this, "shotgunStyle", 'circle');
        /** @attribute @type {string} @title Shotgun: Color */ _define_property(this, "shotgunColor", '#ff8800');
        /** @attribute @type {number} @min 1 @max 10 @title Shotgun: Thickness */ _define_property(this, "shotgunThickness", aiConfig.ui.SHOTGUN_THICKNESS);
    }
}
_define_property(DynamicCrosshairScript, "scriptName", 'dynamicCrosshair');

export { DynamicCrosshairScript, DynamicCrosshairScript as default };
