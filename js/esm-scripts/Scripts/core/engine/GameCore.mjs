///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: Core Module - Game state management, core logic coordination, and main game loop
DOMAIN: core/engine 
DEPENDENCIES: []
EXPORTS: [GameCore]
GPT_CONTEXT: Handles core game state transitions, world management, settings, update loop, and provides the main game coordination logic. Contains essential game state constants, validation, and public API methods for external systems.
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
class GameCore {
    /**
     * Setup pointer lock change listener to handle browser ESC key behavior
     * The browser automatically releases pointer lock when ESC is pressed,
     * so we detect this and trigger the pause menu
     */ _setupPointerLockListener() {
        const canvas = this.app.graphicsDevice?.canvas;
        if (!canvas) return;
        const onPointerLockChange = ()=>{
            const isLocked = document.pointerLockElement === canvas;
            const wasLocked = this._isPointerLocked;
            this._isPointerLocked = isLocked;
            const Logger = this._getLogger();
            const now = Date.now();
            // Debounce to prevent multiple rapid fires (100ms cooldown)
            if (now - this._lastPointerLockChange < 100) {
                Logger.debug('[GameCore] Pointer lock change debounced');
                return;
            }
            this._lastPointerLockChange = now;
            Logger.debug(`[GameCore] Pointer lock change: wasLocked=${wasLocked}, isLocked=${isLocked}, expected=${this._pointerLockExpected}, state=${this.currentState}, paused=${this.uiManager?.core?.isPaused}`);
            // If this was an expected change (we called enable/disable), ignore it
            if (this._pointerLockExpected) {
                Logger.debug('[GameCore] Pointer lock change was expected, ignoring');
                // ✅ CRITICAL FIX: Only clear flag after a delay to allow for sequential operations
                // When resuming, hidePauseMenu() sets flag, then hideCursor() enables pointer lock after 100ms
                // If we clear immediately, the enable operation will be treated as unexpected
                setTimeout(()=>{
                    this._pointerLockExpected = false;
                    Logger.debug('[GameCore] Expected flag cleared after delay');
                }, 200);
                return;
            }
            // Only respond if:
            // 1. Pointer lock was active and is now released (wasLocked && !isLocked)
            // 2. Game is in PLAYING state
            // 3. Game is NOT already paused
            // 4. This is an unexpected change (not programmatic)
            if (wasLocked && !isLocked && this.currentState === GameCore.STATES.PLAYING && !this.uiManager?.core?.isPaused) {
                Logger.debug('[GameCore] Unexpected pointer lock release during gameplay - pausing...');
                // Trigger pause menu
                this._handleEscapeKey();
            }
        };
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('mozpointerlockchange', onPointerLockChange);
        document.addEventListener('webkitpointerlockchange', onPointerLockChange);
    }
    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================
    setState(newState, data) {
        const Logger = this._getLogger();
        // Guard boot
        if (!this.__gmBooted && newState !== GameCore.STATES.MAIN_MENU) {
            Logger.warn(`[GameCore] Attempting to set state to ${newState} before initialization complete`);
            return;
        }
        if (this.currentState === newState) {
            Logger.debug(`[GameCore] Already in state ${newState}, ignoring setState call`);
            return;
        }
        if (this.isTransitioning) {
            Logger.warn(`[GameCore] State transition already in progress, ignoring setState(${newState})`);
            return;
        }
        this.isTransitioning = true;
        const oldState = this.currentState;
        Logger.gameState(`[GameCore] State transition: ${oldState} -> ${newState}`);
        this._onStateExit(oldState);
        this.previousState = this.currentState;
        this.currentState = newState;
        this._onStateEnter(newState, data);
        this.app.fire('game:stateChanged', {
            from: oldState,
            to: newState,
            data
        });
        this.isTransitioning = false;
        Logger.gameState(`[GameCore] State transition complete: ${newState}`);
    }
    _onStateExit(state) {
        const Logger = this._getLogger();
        Logger.gameState(`[GameCore] Exiting state: ${state}`);
        switch(state){
            case GameCore.STATES.PLAYING:
                this._cleanupPlayingState();
                break;
            case GameCore.STATES.MAIN_MENU:
                this._cleanupMainMenuState();
                break;
            case GameCore.STATES.ROUND_SUMMARY:
                this._cleanupRoundSummaryState();
                break;
        }
    }
    _cleanupPlayingState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Cleaning up PLAYING state...');
        if (this.gameManager?.gameLifecycle?._endSessionSafely) this.gameManager.gameLifecycle._endSessionSafely();
        this.app.timeScale = 1;
        if (this.gameManager?.gameLifecycle?._deactivateAllAgents) this.gameManager.gameLifecycle._deactivateAllAgents();
        this._stopAllSoundsSafely();
    }
    _cleanupMainMenuState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Cleaning up MAIN_MENU state...');
        this._cleanupPlayerEntities();
    }
    _cleanupRoundSummaryState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Cleaning up ROUND_SUMMARY state...');
    }
    _onStateEnter(state, data) {
        const Logger = this._getLogger();
        Logger.gameState(`[GameCore] Entering state: ${state}`);
        switch(state){
            case GameCore.STATES.MAIN_MENU:
                this._enterMainMenuState();
                break;
            case GameCore.STATES.PLAYING:
                this._enterPlayingState();
                break;
            case GameCore.STATES.ROUND_SUMMARY:
                this._enterRoundSummaryState(data);
                break;
        }
    }
    // ============================================================================
    // MAIN MENU STATE
    // ============================================================================
    _enterMainMenuState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Entering MAIN_MENU state...');
        if (this.previousState !== null) {
            this._hideAllUIScreens();
        }
        this._cleanupPlayerEntities();
        if (this.uiManager?.showMainMenu) {
            try {
                this.uiManager.showMainMenu();
            } catch (error) {
                Logger.error('[GameCore] Error showing main menu:', error);
            }
        }
        this._hideGameWorld();
        if (this.gameManager.player?.entity) {
            Logger.debug('[GameCore] Disabling player for main menu');
            this.gameManager.player.entity.enabled = false;
        }
    }
    // ============================================================================
    // PLAYING STATE (HUD + Crosshair)
    // ============================================================================
    _enterPlayingState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Entering PLAYING state...');
        // ✅ STEP 1: Hide all previous UI (including main menu)
        this._hideAllUIScreens();
        // ✅ STEP 2: Show game world FIRST (before session starts)
        this._showGameWorld();
        Logger.debug('[GameCore] Game world shown');
        // ✅ STEP 3: Show HUD
        this.uiManager?.showGameHUD?.();
        this.app.fire('ui:hudShown');
        Logger.debug('[GameCore] HUD shown');
        // ✅ STEP 4: Enable pointer lock
        this._enablePointerLockForGameplay();
        // ✅ STEP 5: Enable damage vignette
        this._enableDamageVignette();
        // ✅ STEP 6: Refresh item scan (deferred)
        if (this.gameManager?.gameLifecycle) {
            setTimeout(()=>{
                if (this.gameManager.gameLifecycle && !this.entity.destroyed) {
                    Logger.debug('[GameCore] Refreshing item scan for PLAYING state...');
                    this.gameManager.gameLifecycle._performComprehensiveItemScan();
                    Logger.debug(`[GameCore] Item scan refreshed: ${this.gameManager.items.length} items found`);
                }
            }, 100);
        }
        // ✅ STEP 7: Start session (which starts countdown)
        // Small delay to ensure UI has transitioned
        setTimeout(()=>{
            Logger.debug('[GameCore] Starting session with countdown...');
            this.gameManager?.gameLifecycle?._startSessionSafely?.();
            // ✅ STEP 8: Activate agents (they will be disabled during countdown)
            try {
                this.gameManager?.gameLifecycle?._activateGameplayAgents?.();
                Logger.debug('[GameCore] Agents activated (but disabled for countdown)');
            } catch (e) {
                Logger.error('[GameCore] Error activating agents:', e);
            }
        }, 100);
    }
    /**
     * Enable pointer lock for gameplay
     */ _enablePointerLockForGameplay() {
        const Logger = this._getLogger();
        // Hide cursor and enable pointer lock
        document.body.style.cursor = 'none';
        const canvas = this.app.graphicsDevice?.canvas;
        if (canvas) {
            canvas.style.cursor = 'none';
        }
        // Enable pointer lock with small delay to ensure UI has transitioned
        setTimeout(()=>{
            // ✅ CRITICAL FIX: Only enable if PLAYING and NOT PAUSED
            if (this.app.mouse && this.currentState === GameCore.STATES.PLAYING && !this.uiManager?.core?.isPaused) {
                try {
                    // Mark this as an expected change so listener doesn't trigger pause
                    this._pointerLockExpected = true;
                    this.app.mouse.enablePointerLock();
                    this._isPointerLocked = true; // Track state
                    Logger.debug('[GameCore] Pointer lock enabled for gameplay (expected change)');
                } catch (e) {
                    this._pointerLockExpected = false; // Reset on error
                    Logger.error('[GameCore] Failed to enable pointer lock:', e);
                }
            } else {
                Logger.debug('[GameCore] Skipped pointer lock (paused or not playing)');
            }
        }, 100);
    }
    // ============================================================================
    // ROUND SUMMARY STATE
    // ============================================================================
    _enterRoundSummaryState(data) {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Entering ROUND_SUMMARY state...');
        if (this.uiManager?.showRoundSummary) {
            this.uiManager.showRoundSummary(data);
        }
        this._hideGameWorld();
    }
    _hideAllUIScreens() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Hiding all UI screens...');
        // ✅ Explicitly hide main menu
        if (this.uiManager?.hideMainMenu) {
            this.uiManager.hideMainMenu();
            Logger.debug('[GameCore] Main menu hidden');
        }
        // ✅ Hide summary
        this.app.fire('summary:hide');
        // ✅ Hide pause menu
        if (this.uiManager?.hidePauseMenu) {
            this.uiManager.hidePauseMenu();
        }
        // ✅ Hide countdown (in case it was showing)
        if (this.uiManager?.hideCountdown) {
            this.uiManager.hideCountdown();
        }
        // ✅ Disable damage vignette when hiding UI
        this._disableDamageVignette();
        Logger.debug('[GameCore] All UI screens hidden');
    }
    // ============================================================================
    // DAMAGE VIGNETTE MANAGEMENT
    // ============================================================================
    _enableDamageVignette() {
        const ui = this.app.root.findByName('UI');
        const hud = ui?.findByName('GameHUD');
        const dv = hud?.findByName('DamageVignette');
        if (dv && !dv.enabled) {
            dv.enabled = true;
            const Logger = this._getLogger();
            Logger.debug('[GameCore] DamageVignette enabled');
        }
    }
    _disableDamageVignette() {
        const ui = this.app.root.findByName('UI');
        const hud = ui?.findByName('GameHUD');
        const dv = hud?.findByName('DamageVignette');
        if (dv && dv.enabled) {
            dv.enabled = false;
            const Logger = this._getLogger();
            Logger.debug('[GameCore] DamageVignette disabled');
        }
    }
    // ============================================================================
    // WORLD MANAGEMENT
    // ============================================================================
    _showGameWorld() {
        const Logger = this._getLogger();
        Logger.gameState('[GameCore] Showing game world');
        if (this.gameManager.gameWorld) this.gameManager.gameWorld.enabled = true;
        if (this.gameManager.player?.entity) {
            this.gameManager.player.entity.enabled = true;
            Logger.debug('[GameCore] Player enabled');
        }
    }
    _hideGameWorld() {
        const Logger = this._getLogger();
        Logger.gameState('[GameCore] Hiding game world');
        if (this.gameManager.gameWorld) this.gameManager.gameWorld.enabled = false;
        if (this.gameManager.player?.entity) {
            this.gameManager.player.entity.enabled = false;
            Logger.debug('[GameCore] Player disabled');
        }
        this.gameManager?.gameLifecycle?._deactivateAllAgents?.();
    }
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    update(dt) {
        // ✅ ESC key handling now done via pointer lock change listener
        // This fixes the "2 presses needed" issue caused by browser releasing pointer lock first
        // ✅ NEW: Update game mode
        if (this.gameManager?.gameModeManager) {
            this.gameManager.gameModeManager.update(dt);
        }
        if (this.currentState === GameCore.STATES.PLAYING && this.gameManager?.gameLifecycle?.itemScanComplete && this.app.frame % 60 === 0) {
            this.gameManager.gameLifecycle.updateItemAvailability();
        }
        if (this.gameManager.items && this.app.frame % 900 === 0) {
            this.gameManager.gameLifecycle._conservativeItemCleanup();
        }
    }
    _handleEscapeKey() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] ESC key pressed during PLAYING state, timeScale:', this.app.timeScale);
        // Check if already paused via UICore
        if (this.uiManager?.core?.isPaused) {
            Logger.debug('[GameCore] Already paused, resuming...');
            this.gameManager.gameEvents._onResumeClicked();
        } else {
            Logger.debug('[GameCore] Not paused, pausing...');
            this.gameManager.gameEvents._onPauseClicked();
        }
    }
    // ============================================================================
    // PUBLIC API
    // ============================================================================
    getState() {
        return this.currentState;
    }
    isPlaying() {
        return this.currentState === GameCore.STATES.PLAYING && this.app.timeScale > 0 && !this.isTransitioning;
    }
    getSettings() {
        // ✅ UPDATED: Read from individual gameManager attributes
        return {
            roundDuration: this.gameManager.roundDuration,
            maxAgents: this.gameManager.maxAgents,
            respawnTime: this.gameManager.respawnTime,
            aiDifficulty: this.gameManager.aiDifficulty
        };
    }
    getSpawnPoints() {
        return this.gameManager.spawnPoints || [];
    }
    getAgentTemplate() {
        return this.gameManager.aiAgentTemplate;
    }
    _getRandomSpawnPoint() {
        const spawnPoints = this.getSpawnPoints();
        if (!spawnPoints?.length) return null;
        return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    }
    getPickupsByType(type) {
        const Logger = this._getLogger();
        const results = this.gameManager.items.filter((i)=>i.itemType === type);
        Logger.debug(`[GameCore] getPickupsByType('${type}') found ${results.length} item(s)`);
        return results;
    }
    /**
     * Get the closest available pickup item of a specific type
     * @param {pc.Vec3|YUKA.Vector3} position - The position to search from
     * @param {string} type - The item type to search for ('health', 'pistol', 'machinegun', etc.)
     * @returns {PickupSystem|null} The closest available pickup or null if none found
     */ getClosestItem(position, type) {
        const Logger = this._getLogger();
        // Validate inputs
        if (!position) {
            Logger.warn('[GameCore] getClosestItem() - No position provided');
            return null;
        }
        if (!type) {
            Logger.warn('[GameCore] getClosestItem() - No type provided');
            return null;
        }
        // Get all items of the specified type
        const items = this.gameManager.items?.filter((item)=>{
            return item && item.itemType === type && item.isAvailable === true && item.entity && item.entity.enabled;
        }) || [];
        if (items.length === 0) {
            Logger.debug(`[GameCore] getClosestItem('${type}') - No available items found`);
            return null;
        }
        // Find closest item
        let closestItem = null;
        let minDistance = Infinity;
        for (const item of items){
            try {
                const itemPos = item.entity.getPosition();
                // Calculate distance (handle both PlayCanvas and YUKA vectors)
                let distance;
                if (typeof position.distance === 'function') {
                    // YUKA Vector3 - has distance() method
                    distance = position.distance(itemPos);
                } else if (position.x !== undefined && position.y !== undefined && position.z !== undefined) {
                    // PlayCanvas Vec3 or plain object
                    const dx = position.x - itemPos.x;
                    const dy = position.y - itemPos.y;
                    const dz = position.z - itemPos.z;
                    distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                } else {
                    Logger.warn('[GameCore] getClosestItem() - Invalid position format:', position);
                    continue;
                }
                if (distance < minDistance) {
                    minDistance = distance;
                    closestItem = item;
                }
            } catch (error) {
                Logger.warn(`[GameCore] getClosestItem() - Error calculating distance for item:`, error);
                continue;
            }
        }
        if (closestItem) {
            Logger.debug(`[GameCore] getClosestItem('${type}') - Found ${closestItem.entity.name} at distance ${minDistance.toFixed(2)}`);
        } else {
            Logger.debug(`[GameCore] getClosestItem('${type}') - No valid items found`);
        }
        return closestItem;
    }
    forceAgentActivation() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Manually forcing agent activation...');
        this.gameManager?.gameLifecycle?._activateGameplayAgents?.();
    }
    // ============================================================================
    // SOUND CLEANUP
    // ============================================================================
    _stopAllSoundsSafely() {
        const Logger = this._getLogger();
        try {
            if (this.app.audioManager?.stopAllSounds) {
                this.app.audioManager.stopAllSounds();
            } else {
                this._manuallyStopAllSounds();
            }
        } catch (error) {
            Logger.error('[GameCore] Error stopping sounds:', error);
            this._manuallyStopAllSounds();
        }
    }
    _manuallyStopAllSounds() {
        const Logger = this._getLogger();
        try {
            const soundComponents = this.app.root.findComponents('sound');
            soundComponents.forEach((c)=>c.stop?.());
            Logger.debug('[GameCore] Manually stopped all sound components');
        } catch (e) {
            Logger.error('[GameCore] Error manually stopping sounds:', e);
        }
    }
    _cleanupPlayerEntities() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] Cleaning up player entities...');
        const playerEntities = this.app.root.findByTag('player');
        if (playerEntities.length > 1) {
            Logger.warn(`[GameCore] Found ${playerEntities.length} player entities`);
            playerEntities.forEach((e)=>{
                if (this.gameManager.player && e !== this.gameManager.player.entity) {
                    Logger.debug(`[GameCore] Destroying duplicate: ${e.name}`);
                    try {
                        e.destroy();
                    } catch (err) {
                        Logger.error(err);
                    }
                }
            });
        }
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    debugState() {
        const Logger = this._getLogger();
        Logger.debug('[GameCore] === STATE DEBUG ===');
        Logger.debug(`  Current: ${this.currentState}`);
        Logger.debug(`  Previous: ${this.previousState}`);
        Logger.debug(`  Transitioning: ${this.isTransitioning}`);
        Logger.debug(`  Booted: ${!!this.__gmBooted}`);
        Logger.debug(`  Agents: ${this.gameManager.agents?.length || 0}`);
        Logger.debug('==============================');
        return {
            current: this.currentState,
            previous: this.previousState,
            transitioning: this.isTransitioning,
            booted: !!this.__gmBooted
        };
    }
    /**
     * Debug AI goals for a specific agent
     * @param {string} agentName - Name of the agent entity
     */ debugAIGoals(agentName) {
        const Logger = this._getLogger();
        const agentEntity = this.app.root.findByName(agentName);
        if (!agentEntity) {
            Logger.warn(`[GameCore] Agent '${agentName}' not found`);
            return null;
        }
        const agent = agentEntity.script?.aiAgent;
        if (!agent || !agent.brain) {
            Logger.warn(`[GameCore] Agent '${agentName}' has no AI brain`);
            return null;
        }
        const currentGoal = agent.brain.currentSubgoal();
        const info = {
            agentName: agentName,
            currentGoal: currentGoal?.constructor?.name || 'None',
            subgoals: currentGoal?.subgoals?.map((g)=>g.constructor.name) || [],
            modePriorities: agent._modePriorities || {},
            strategicGoalClass: agent._strategicGoalClass?.name || 'None',
            evaluatorCount: agent.brain.evaluators?.length || 0,
            health: agent.health,
            hasTarget: agent.targetSystem?.hasTarget?.() || false,
            targetVisible: agent.targetSystem?.isTargetVisible?.() || false
        };
        Logger.debug('[GameCore] === AI GOALS DEBUG ===');
        Logger.debug(`  Agent: ${info.agentName}`);
        Logger.debug(`  Current Goal: ${info.currentGoal}`);
        Logger.debug(`  Subgoals: ${info.subgoals.join(' → ') || 'None'}`);
        Logger.debug(`  Strategic Goal: ${info.strategicGoalClass}`);
        Logger.debug(`  Evaluators: ${info.evaluatorCount}`);
        Logger.debug(`  Health: ${info.health}/${agent.maxHealth}`);
        Logger.debug(`  Has Target: ${info.hasTarget}`);
        Logger.debug(`  Target Visible: ${info.targetVisible}`);
        Logger.debug('==============================');
        return info;
    }
    /**
     * Debug current game mode
     */ debugGameMode() {
        const Logger = this._getLogger();
        if (!this.gameManager.gameModeManager) {
            Logger.warn('[GameCore] No game mode manager');
            return null;
        }
        const mode = this.gameManager.gameModeManager.getCurrentMode();
        if (!mode) {
            Logger.warn('[GameCore] No active game mode');
            return null;
        }
        const info = {
            modeName: mode.modeName,
            modeId: mode.modeId,
            isActive: mode.isActive,
            scoreboard: mode.getScoreboardData(),
            victoryCheck: mode.checkVictoryConditions()
        };
        Logger.debug('[GameCore] === GAME MODE DEBUG ===');
        Logger.debug(`  Mode: ${info.modeName} (${info.modeId})`);
        Logger.debug(`  Active: ${info.isActive}`);
        Logger.debug(`  Scoreboard:`, info.scoreboard);
        Logger.debug(`  Victory Check:`, info.victoryCheck);
        Logger.debug('==============================');
        return info;
    }
    // ============================================================================
    // HELPERS
    // ============================================================================
    _getLogger() {
        return this.gameManager._getLogger();
    }
    setUIManager(uiManager) {
        this.uiManager = uiManager;
    }
    setInitialized(initialized) {
        this.__gmBooted = initialized;
    }
    constructor(gameManager){
        this.gameManager = gameManager;
        this.app = gameManager.app;
        this.entity = gameManager.entity;
        this.uiManager = null;
        // Game state properties
        this.currentState = null;
        this.previousState = null;
        this.isTransitioning = false;
        this.__gmBooted = false;
        // Game coordination properties
        this.sessionEndingManually = false;
        this.lastSessionEndTime = 0;
        this.sessionEndCooldown = 1000;
        this.isRematchInProgress = false;
        this.hasEverStartedPlaying = false;
        // Pointer lock state tracking
        this._isPointerLocked = false;
        this._pointerLockExpected = false; // Track if we're intentionally changing pointer lock
        this._lastPointerLockChange = 0;
        this._setupPointerLockListener();
    }
}
// ============================================================================
// GAME STATES CONSTANTS
// ============================================================================
_define_property(GameCore, "STATES", {
    MAIN_MENU: 'main_menu',
    PLAYING: 'playing',
    ROUND_SUMMARY: 'round_summary'
});

export { GameCore };
