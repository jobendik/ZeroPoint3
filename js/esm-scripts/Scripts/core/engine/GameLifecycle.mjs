///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: Lifecycle Module - Game initialization, agent lifecycle, item system management, and resource cleanup
DOMAIN: core/engine 
DEPENDENCIES: []
EXPORTS: [GameLifecycle]
GPT_CONTEXT: Manages complete game lifecycle including initialization sequences, agent activation/deactivation, comprehensive item system scanning and management, session lifecycle coordination, and proper resource cleanup. Handles critical boot sequences and system readiness validation.
*/ class GameLifecycle {
    // ============================================================================
    // INITIALIZATION SEQUENCE
    // ============================================================================
    initialize() {
        const Logger = this._getLogger();
        try {
            Logger.debug('[GameLifecycle] initialize() - boot start');
        } catch (e) {}
        // Establish global access - CRITICAL for backward compatibility
        this.app.gameManager = this.gameManager;
        if (typeof window !== 'undefined') window.gameManager = this.gameManager;
        if (this.gameManager.__gmBooted) {
            Logger.debug('[GameLifecycle] initialize() - early exit (already initialized)');
            return;
        }
        // Known starting state; don't touch world/session yet
        this.gameManager.gameCore.currentState = this.gameManager.gameCore.constructor.STATES.MAIN_MENU;
        if (typeof Logger !== 'undefined' && Logger.gameState) {
            Logger.gameState('[GameLifecycle] BOOT → starting init pipeline');
        }
        // Boot flags / state
        this._isInitializing = true;
        this.gameManager._registeredAgents = this.gameManager._registeredAgents || new Set();
        this.gameManager._registeredItemGuids = new Set();
        this.gameManager._registeredPlayer = null;
        this.gameManager.gameCore.previousState = null;
        this.gameManager.gameCore.isTransitioning = false;
        this.gameManager.gameSession = null;
        this.gameManager.player = null;
        this.gameManager.gameCore.hasEverStartedPlaying = false;
        // Items / agents
        this.gameManager.items = [];
        this.gameManager.agents = [];
        this.itemScanComplete = false;
        // Session coordination
        this.gameManager.gameCore.sessionEndingManually = false;
        this.gameManager.gameCore.lastSessionEndTime = 0;
        this.gameManager.gameCore.sessionEndCooldown = 1000;
        this.gameManager.gameCore.isRematchInProgress = false;
        // Let pickups queue up safely
        if (!this._announcedReady) {
            this._announcedReady = true;
            this.app.fire('game:manager:ready', this.gameManager);
        }
        // UI manager
        this.gameManager.uiManager = this.entity.script.uiManager;
        if (!this.gameManager.uiManager) {
            Logger.error('[GameLifecycle] UIManager script not found!');
            return;
        }
        this.gameManager.uiManager.setGameManager(this.gameManager);
        this.gameManager.gameCore.setUIManager(this.gameManager.uiManager);
        // Systems + events
        this._initializeItemSystemImproved();
        this.gameManager.gameEvents.setupEvents();
    // NOTE: Do NOT show world or connect GameSession here. Wait for postInitialize().
    }
    postInitialize() {
        const Logger = this._getLogger();
        Logger.gameState('[GameLifecycle] postInitialize()');
        // Now it's safe to enter UI/world state
        this.gameManager.gameCore.currentState = this.gameManager.gameCore.constructor.STATES.MAIN_MENU;
        Logger.gameState(`[GameLifecycle] Final currentState confirmation: ${this.gameManager.gameCore.currentState}`);
        this.gameManager.gameCore._enterMainMenuState();
        // Connect session after all scripts in the scene have initialized
        this._connectGameSessionSafely();
        // 🔥 FIX: Defer item scan to allow pickup scripts to fully initialize
        // Increased delay to 1000ms to ensure all pickupSystem scripts have completed initialize()
        setTimeout(()=>{
            if (!this.entity.destroyed) {
                Logger.debug('[GameLifecycle] Running deferred item scan...');
                this._performComprehensiveItemScan();
                Logger.debug(`[GameLifecycle] Deferred scan complete: ${this.gameManager.items.length} items found`);
                // Fire event to notify systems that items are ready
                this.app.fire('game:items:scanned', {
                    count: this.gameManager.items.length
                });
            }
        }, 1000);
        // Finish boot
        this._isInitializing = false;
        this.app.fire('game:stateChanged', {
            from: null,
            to: this.gameManager.gameCore.currentState,
            data: null
        });
        Logger.gameState(`[GameLifecycle] Initialized successfully in state: ${this.gameManager.gameCore.currentState}`);
        this.gameManager.__gmBooted = true;
        this.gameManager.gameCore.setInitialized(true);
        if (typeof Logger !== 'undefined' && Logger.gameState) {
            Logger.gameState('[GameLifecycle] __gmBooted=true (postInitialize complete)');
        }
    }
    // ============================================================================
    // GAMESESSION SAFE CONNECTION
    // ============================================================================
    _connectGameSessionSafely() {
        const Logger = this._getLogger();
        Logger.gameState('[GameLifecycle] Connecting GameSession safely...');
        this.gameManager.gameSession = this.entity.script.gameSession;
        if (!this.gameManager.gameSession) {
            Logger.error('[GameLifecycle] GameSession script not found!');
            return;
        }
        // Connect GameSession
        this.gameManager.gameSession.setGameManager(this.gameManager);
        // CRITICAL: Force any active session to end before we're ready
        if (this.gameManager.gameSession.isActive) {
            Logger.warn('[GameLifecycle] GameSession was auto-started during initialization, forcing cleanup');
            this.gameManager.gameSession.forceEndSession('initialization_cleanup');
        }
        // Reset GameSession state to be safe
        this.gameManager.gameSession.isActive = false;
        this.gameManager.gameSession.isEnding = false;
        this.gameManager.gameSession.hasEnded = false;
        this.gameManager.gameSession.isCountingDown = false;
        Logger.gameState('[GameLifecycle] GameSession connected and cleaned up');
    }
    // ============================================================================
    // AGENT ACTIVATION - CONSOLIDATED
    // ============================================================================
    _activateGameplayAgents() {
        const Logger = this._getLogger();
        Logger.aiState('[GameLifecycle] Activating gameplay agents...');
        let activatedCount = 0;
        let pendingCount = 0;
        Logger.debug('[GameLifecycle] gameManager exists:', !!this.gameManager);
        Logger.debug('[GameLifecycle] agents exists:', !!this.gameManager?.agents);
        Logger.debug('[GameLifecycle] agents length:', this.gameManager?.agents?.length);
        if (!this.gameManager.agents || this.gameManager.agents.length === 0) {
            Logger.aiState('[GameLifecycle] No agents registered yet');
            return;
        }
        this.gameManager.agents.forEach((agent, index)=>{
            Logger.debug(`[GameLifecycle] Checking agent ${index}:`, agent.entity?.name);
            Logger.debug(`  - __aiAgentInitialized: ${agent.__aiAgentInitialized}`);
            Logger.debug(`  - entity exists: ${!!agent.entity}`);
            Logger.debug(`  - entity destroyed: ${agent.entity?.destroyed}`);
            if (this._isAgentFullyReady(agent)) {
                Logger.debug(`  - Agent ${index} IS ready, activating...`);
                this._activateAgent(agent);
                activatedCount++;
            } else {
                pendingCount++;
                Logger.aiDetail(`[GameLifecycle] Agent ${index} (${agent.entity?.name}) not ready`);
            }
        });
        Logger.aiState(`[GameLifecycle] Activated ${activatedCount} agents, ${pendingCount} pending`);
    }
    _isAgentFullyReady(agent) {
        if (!agent || !agent.entity || agent.entity.destroyed) {
            return false;
        }
        // Only require AI agent initialization
        if (!agent.__aiAgentInitialized) {
            return false;
        }
        return true;
    }
    _isSystemReady(system, systemName) {
        if (!system) return true;
        if (typeof system.isReady === 'function') {
            try {
                return system.isReady();
            } catch (e) {
                return false;
            }
        }
        if (systemName === 'weaponSystem') {
            return system.__wsBooted === true;
        }
        if (systemName === 'healthSystem') {
            return system.__healthSystemBooted === true;
        }
        return system._initialized === true;
    }
    _isAgentActivatable(agent) {
        if (!agent || !agent.entity) {
            return false;
        }
        if (agent.entity.destroyed) {
            return false;
        }
        // More permissive dead check - only exclude if explicitly dead
        if (agent.isDead === true) {
            return false;
        }
        // Check if agent is properly initialized
        if (!agent.__aiAgentInitialized) {
            return false;
        }
        return true;
    }
    _activateAgent(agent) {
        if (!agent || !agent.entity) return false;
        // Enable the entity
        agent.entity.enabled = true;
        // Mark as not dead if it was incorrectly marked
        if (agent.isDead !== false) {
            agent.isDead = false;
        }
        const Logger = this._getLogger();
        Logger.aiDetail(`[GameLifecycle] Activated agent: ${agent.entity.name}`);
        return true;
    }
    _deactivateAllAgents() {
        const Logger = this._getLogger();
        Logger.aiState('[GameLifecycle] Deactivating all agents...');
        // Defensive check
        if (!this.gameManager.agents) {
            this.gameManager.agents = [];
            return;
        }
        this.gameManager.agents.forEach((agent)=>{
            if (agent && agent.entity) {
                if (agent.stopMovement) {
                    try {
                        agent.stopMovement();
                    } catch (e) {}
                }
                agent.entity.enabled = false;
            }
        });
    }
    // ============================================================================
    // ENHANCED ITEM SYSTEM - CONSOLIDATED
    // ============================================================================
    _initializeItemSystemImproved() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] Initializing enhanced item system...');
        // Initialize arrays safely
        this.gameManager.items = this.gameManager.items || [];
        this.itemScanComplete = false;
        // 🔥 FIX: Don't scan immediately - defer until after all scripts initialize
        // This prevents scanning before pickup scripts are ready
        Logger.debug('[GameLifecycle] Item scan deferred until postInitialize');
        // Set up periodic updates
        this._scheduleItemUpdates();
        Logger.debug('[GameLifecycle] Item system initialized (scan deferred)');
    }
    _performComprehensiveItemScan() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] Performing comprehensive item scan...');
        const oldCount = this.gameManager.items.length;
        this.gameManager.items = [];
        this.gameManager._registeredItemGuids.clear();
        // Find all pickup entities
        const pickupEntities = this._findPickupEntities();
        for (const entity of pickupEntities){
            this._registerPickupEntity(entity);
        }
        this.itemScanComplete = true;
        Logger.debug(`[GameLifecycle] Comprehensive scan: ${oldCount} -> ${this.gameManager.items.length} items`);
        this._logItemBreakdown();
    }
    _findPickupEntities() {
        // Multiple search strategies for maximum coverage
        const entities = new Set();
        // Strategy 1: Find by tags
        const taggedEntities = [
            ...this.app.root.findByTag('pickup'),
            ...this.app.root.findByTag('item'),
            ...this.app.root.findByTag('ammo'),
            ...this.app.root.findByTag('health'),
            ...this.app.root.findByTag('weapon')
        ];
        taggedEntities.forEach((e)=>entities.add(e));
        // Strategy 2: Find by script components
        const scriptedEntities = this.app.root.findComponents('script');
        for (const scriptComp of scriptedEntities){
            const scripts = scriptComp._scriptsIndex;
            if (scripts && (scripts.pickup || scripts.pickupSystem)) {
                entities.add(scriptComp.entity);
            }
        }
        return Array.from(entities);
    }
    _registerPickupEntity(entity) {
        const Logger = this._getLogger();
        if (!entity || entity.destroyed) {
            return;
        }
        const guid = entity.getGuid();
        if (this.gameManager._registeredItemGuids.has(guid)) {
            return;
        }
        // 🔥 CRITICAL FIX: The script is named 'pickupSystem', not 'pickup'
        const pickupScript = entity.script?.pickupSystem || entity.script?.pickup;
        if (!pickupScript) {
            // Only log if we have debug enabled
            return;
        }
        // 🔥 FIX: Don't require __pickupSystemBooted during initial scan
        // The flag might not be set yet if we're scanning during postInitialize
        // We just need the script to exist
        // Register the pickup
        this.gameManager.items.push(pickupScript);
        this.gameManager._registeredItemGuids.add(guid);
        Logger.debug(`[GameLifecycle] ✅ Registered pickup: ${entity.name} (${pickupScript.itemType || 'unknown'})`);
    }
    _scheduleItemUpdates() {
        // Update item availability every second when playing
        if (this._itemUpdateInterval) {
            clearInterval(this._itemUpdateInterval);
        }
        this._itemUpdateInterval = setInterval(()=>{
            if (this.gameManager.gameCore.currentState === this.gameManager.gameCore.constructor.STATES.PLAYING) {
                this.updateItemAvailability();
            }
        }, 1000);
    }
    updateItemAvailability() {
        if (!this.gameManager.items || !this.itemScanComplete) return;
        // Conservative cleanup - only remove clearly invalid items
        this._conservativeItemCleanup();
    }
    _conservativeItemCleanup() {
        if (!this.gameManager.items) return;
        const Logger = this._getLogger();
        const initialCount = this.gameManager.items.length;
        this.gameManager.items = this.gameManager.items.filter((item)=>{
            // Bare sjekk om item og dens entity eksisterer og ikke er ødelagt
            return item && item.entity && !item.entity.destroyed;
        });
        const removedCount = initialCount - this.gameManager.items.length;
        if (removedCount > 0) {
            Logger.debug(`[GameLifecycle] Conservative cleanup removed ${removedCount} invalid items`);
        }
    }
    _logItemBreakdown() {
        const Logger = this._getLogger();
        const breakdown = {};
        this.gameManager.items.forEach((item)=>{
            const type = item.itemType || 'unknown';
            breakdown[type] = (breakdown[type] || 0) + 1;
        });
        Logger.debug('[GameLifecycle] Item breakdown:', breakdown);
    }
    _isValidPickupInstance(item) {
        if (!item || !item.entity || item.entity.destroyed) return false;
        // 🔥 FIX: Check for both pickupSystem and pickup script names
        return item.entity.script?.pickupSystem === item || item.entity.script?.pickup === item;
    }
    // ============================================================================
    // SESSION MANAGEMENT
    // ============================================================================
    _startSessionSafely() {
        const Logger = this._getLogger();
        if (!this.gameManager.gameSession) {
            Logger.debug('[GameLifecycle] ❌ _startSessionSafely FAILED - No gameSession reference');
            Logger.error('[GameLifecycle] No gameSession reference for safe starting');
            return;
        }
        // 1) Vis verden + HUD, skjul Main Menu (display only)
        this._prepareWorldForCountdownDisplay();
        Logger.debug('[GameLifecycle] 🎬 _startSessionSafely() CALLED');
        Logger.gameState('[GameLifecycle] Starting session...');
        this.gameManager.gameSession.isActive = false;
        this.gameManager.gameSession.isEnding = false;
        this.gameManager.gameSession.hasEnded = false;
        this.gameManager.gameSession.isCountingDown = false;
        const success = this.gameManager.gameSession.startSession();
        if (success) {
            Logger.debug('[GameLifecycle] ✅ Session started successfully');
            Logger.gameState('[GameLifecycle] Session started successfully');
        } else {
            Logger.debug('[GameLifecycle] ❌ Session start FAILED');
            Logger.error('[GameLifecycle] Failed to start session');
        }
    }
    _endSessionSafely() {
        const Logger = this._getLogger();
        if (!this.gameManager.gameSession) {
            Logger.warn('[GameLifecycle] No gameSession reference for safe ending');
            return;
        }
        this.gameManager.gameSession.forceEndSession('state_change');
    }
    // Viser spillverdenen mens vi fortsatt “fryser” gameplay under nedtellingen
    _prepareWorldForCountdownDisplay() {
        const Logger = this._getLogger();
        // a) Sett visuell state til PLAYING (display), så Main Menu ikke skjuler verden
        const GC = this.gameManager.gameCore.constructor;
        this.gameManager.gameCore.currentState = GC.STATES.PLAYING;
        // b) UI: Skjul main menu, vis HUD + ev. pointer lock prompt
        const ui = this.gameManager.uiManager;
        if (ui) {
            if (ui.hideMainMenu) ui.hideMainMenu();
            if (ui.showHUD) ui.showHUD(true);
            if (ui.showCountdownOverlay) ui.showCountdownOverlay(true); // hvis du har dette
        }
        // c) Valgfritt signal til andre systemer
        this.app.fire('ui:world:visible', true);
        Logger.gameState('[GameLifecycle] 🌍 World is now visible for countdown (display only)');
    }
    // ============================================================================
    // BACKWARD COMPATIBILITY METHODS - LEGACY API SUPPORT
    // ============================================================================
    // Called by pickupSystem.js during destroy()
    unregisterItem(item) {
        const Logger = this._getLogger();
        if (!item || !this.gameManager.items) return;
        const index = this.gameManager.items.indexOf(item);
        if (index !== -1) {
            this.gameManager.items.splice(index, 1);
            Logger.debug(`[GameLifecycle] Unregistered item: ${item.entity?.name || 'unknown'}`);
        }
        // Also remove from GUID registry if present
        if (item.entity && this.gameManager._registeredItemGuids) {
            const guid = item.entity.getGuid();
            this.gameManager._registeredItemGuids.delete(guid);
        }
    }
    // ============================================================================
    // DEBUG METHODS - PRESERVED FOR DEVELOPMENT
    // ============================================================================
    debugAgents() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] === AGENT DEBUG ===');
        Logger.debug(`  Total registered agents: ${this.gameManager.agents ? this.gameManager.agents.length : 0}`);
        Logger.debug(`  Current state: ${this.gameManager.gameCore.currentState}`);
        if (this.gameManager.agents && this.gameManager.agents.length > 0) {
            this.gameManager.agents.forEach((agent, index)=>{
                Logger.debug(`  Agent ${index}:`);
                Logger.debug(`    Name: ${agent.entity?.name || 'unknown'}`);
                Logger.debug(`    Enabled: ${agent.entity?.enabled || false}`);
                Logger.debug(`    Initialized: ${agent.__aiAgentInitialized || false}`);
                Logger.debug(`    Dead: ${agent.isDead}`);
                Logger.debug(`    Destroyed: ${agent.entity?.destroyed || false}`);
                Logger.debug(`    Activatable: ${this._isAgentActivatable(agent)}`);
            });
        }
        Logger.debug('=== END AGENT DEBUG ===');
    }
    debugItemSystem() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] === ITEM SYSTEM DEBUG ===');
        Logger.debug(`  Total items registered: ${this.gameManager.items.length}`);
        const itemCounts = {};
        const invalidItems = [];
        const disconnectedItems = [];
        this.gameManager.items.forEach((item, index)=>{
            if (this._isValidPickupInstance(item)) {
                itemCounts[item.itemType] = (itemCounts[item.itemType] || 0) + 1;
            } else {
                if (item && item.entity && !item.entity.destroyed) {
                    disconnectedItems.push({
                        index,
                        item,
                        entity: item.entity.name
                    });
                } else {
                    invalidItems.push({
                        index,
                        item
                    });
                }
            }
        });
        Logger.debug('  Item breakdown:', itemCounts);
        if (invalidItems.length > 0) {
            Logger.debug(`  Invalid/destroyed items found: ${invalidItems.length}`);
            invalidItems.forEach(({ index, item })=>{
                Logger.debug(`    [${index}]:`, item);
            });
        }
        if (disconnectedItems.length > 0) {
            Logger.debug(`  Disconnected items found: ${disconnectedItems.length}`);
            disconnectedItems.forEach(({ index, item, entity })=>{
                Logger.debug(`    [${index}]: ${entity} - script connection broken`);
            });
        }
        Logger.debug('=== END ITEM SYSTEM DEBUG ===');
    }
    refreshItemSystem() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] Refreshing item system...');
        const oldCount = this.gameManager.items.length;
        this._performComprehensiveItemScan();
        Logger.debug(`[GameLifecycle] Item system refreshed: ${oldCount} -> ${this.gameManager.items.length} items`);
        this._logItemBreakdown();
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        const Logger = this._getLogger();
        Logger.debug('[GameLifecycle] Destroying...');
        // Clear item update interval
        if (this._itemUpdateInterval) {
            clearInterval(this._itemUpdateInterval);
            this._itemUpdateInterval = null;
        }
        this.gameManager.items = [];
        this.gameManager.agents = [];
        this.gameManager.gameCore.isTransitioning = false;
        this.gameManager.gameCore.sessionEndingManually = false;
        this._isInitializing = false;
        this.gameManager.__gmBooted = false;
        this.gameManager._registeredItemGuids = new Set();
    }
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    _getLogger() {
        return this.gameManager._getLogger();
    }
    constructor(gameManager){
        this.gameManager = gameManager;
        this.app = gameManager.app;
        this.entity = gameManager.entity;
        // Initialization state
        this._isInitializing = false;
        this._announcedReady = false;
        // Item system properties
        this.itemScanComplete = false;
        this._itemUpdateInterval = null;
        // Agent activation tracking
        this._pendingAgentActivation = false;
        this._activationRetryCount = 0;
    }
}

export { GameLifecycle };
