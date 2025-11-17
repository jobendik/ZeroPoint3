import { AgentSpawner } from './AgentSpawner.mjs';
import { SpawnPointManager } from './SpawnPointManager.mjs';
import { RespawnManager } from './RespawnManager.mjs';
import { CountdownSystem } from './CountdownSystem.mjs';
import { SessionStateManager } from './SessionStateManager.mjs';
import { aiConfig } from '../../config/ai.config.mjs';
import { Logger } from './logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class SessionCore {
    initialize() {
        if (this.__sessionCoreReady) {
            this._log('debug', '[SessionCore] Already initialized, skipping...');
            return;
        }
        this._log('gameState', '[SessionCore] Initializing...');
        // ✅ Initialize modular systems
        this.agentSpawner = new AgentSpawner(this.app, this.gameManager, this._log.bind(this));
        this.spawnPointManager = new SpawnPointManager(this.gameManager, this._log.bind(this));
        this.stateManager = new SessionStateManager(this.app, this.gameManager, this._log.bind(this));
        this.countdownSystem = new CountdownSystem(this.app, this.gameManager, this._log.bind(this));
        this.respawnManager = new RespawnManager(this.app, this.gameManager, this._log.bind(this), this.agentSpawner, this.spawnPointManager);
        // ❌ REMOVED: Death listener registration moved to _finishCountdown()
        // (app event system not ready yet during initialize())
        this.__sessionCoreReady = true;
        this._log('gameState', '[SessionCore] Initialized successfully');
    }
    isReady() {
        return this.__sessionCoreReady === true;
    }
    // ============================================================================
    // DELEGATED PROPERTIES (for backward compatibility)
    // ============================================================================
    get deadEntities() {
        return this.respawnManager?.deadEntities || new Set();
    }
    get entityStates() {
        return this.stateManager?.entityStates || new Map();
    }
    get countdownTimer() {
        return this.countdownSystem?.countdownTimer || 0;
    }
    set countdownTimer(value) {
        if (this.countdownSystem) {
            this.countdownSystem.countdownTimer = value;
        }
    }
    get isCountingDown() {
        return this.countdownSystem?.isActive() || false;
    }
    set isCountingDown(value) {
        if (this.countdownSystem) {
            if (value) {
                this.countdownSystem.startCountdown();
            } else {
                this.countdownSystem.isCountingDown = false;
            }
        }
    }
    // ============================================================================
    // SESSION LIFECYCLE
    // ============================================================================
    startSession() {
        this._log('gameState', '[SessionCore] Starting session...');
        // ✅ DIAGNOSTIC: Check UIManager state
        const uiMgr = this.gameManager?.uiManager;
        this._log('debug', '[SessionCore] 🔍 UIManager diagnostic:');
        this._log('debug', `  - UIManager exists: ${!!uiMgr}`);
        this._log('debug', `  - showCountdown exists: ${typeof uiMgr?.showCountdown}`);
        this._log('debug', `  - hideCountdown exists: ${typeof uiMgr?.hideCountdown}`);
        this._log('debug', `  - showMainMenu exists: ${typeof uiMgr?.showMainMenu}`);
        this._log('debug', `  - hideMainMenu exists: ${typeof uiMgr?.hideMainMenu}`);
        this._log('debug', `  - showGameHUD exists: ${typeof uiMgr?.showGameHUD}`);
        if (!this.gameManager) {
            this._log('error', '[SessionCore] No GameManager reference!');
            return false;
        }
        if (!this.__sessionCoreReady) {
            this._log('warn', '[SessionCore] Not fully initialized, cannot start session');
            return false;
        }
        if (this.isActive || this.isCountingDown) {
            this._log('warn', '[SessionCore] ⚠️ Session already active/starting - ignoring duplicate start!');
            return false;
        }
        // Clean up existing agents
        this._log('debug', `[SessionCore] Clearing ${this.gameManager.agents?.length || 0} existing agents...`);
        this._cleanupAgents();
        if (this.gameManager.agents) {
            this.gameManager.agents.forEach((agent)=>{
                if (agent && agent.entity && !agent.entity.destroyed) {
                    try {
                        agent.entity.destroy();
                        this._log('debug', `[SessionCore] Destroyed agent: ${agent.entity.name}`);
                    } catch (e) {
                        this._log('warn', '[SessionCore] Error destroying agent:', e);
                    }
                }
            });
            this.gameManager.agents = [];
            this._log('debug', '[SessionCore] GameManager agents array cleared');
        }
        if (this.gameManager._registeredAgents) {
            this.gameManager._registeredAgents.clear();
            this._log('debug', '[SessionCore] Registration tracking cleared');
        }
        // Reset state
        this.isActive = false;
        this.isEnding = false;
        this.hasEnded = false;
        this.isCountingDown = false;
        // Reset all session data
        this.startTime = aiConfig.session.UPDATE_TIMER_INITIAL;
        this.timeRemaining = this.gameManager.getSettings().roundDuration;
        this.countdownTimer = aiConfig.session.COUNTDOWN_DURATION;
        this.agents = [];
        this.pendingRespawns = [];
        this.endReason = null;
        // Clear tracking in delegated modules
        if (this.stateManager) {
            this.stateManager.entityStates.clear();
            this.stateManager.deadEntities.clear();
        }
        if (this.respawnManager) {
            this.respawnManager.deadEntities.clear();
        }
        this.recentDeaths.clear(); // ✅ Clear death tracking on session start
        // ✅ Spawn all entities BEFORE countdown
        this._log('gameState', '[SessionCore] Spawning entities...');
        this._spawnAllEntities();
        // Start countdown
        this._startCountdown();
        this._log('gameState', '[SessionCore] Session started successfully');
        return true;
    }
    endSession(reason) {
        if (reason === undefined) reason = 'unknown';
        this._log('gameState', `[SessionCore] Ending session (reason: ${reason})...`);
        if (this.hasEnded) {
            this._log('warn', '[SessionCore] Session already ended');
            return false;
        }
        this.isEnding = true;
        this.endReason = reason;
        this.isActive = false;
        this.isCountingDown = false;
        // ✅ Clean up death event listener
        this._cleanupDeathListener();
        this._cleanupAgents();
        this.deadEntities.clear();
        this.respawningEntities.clear();
        this.entityStates.clear();
        this.hasEnded = true;
        this._log('gameState', `[SessionCore] Session ended successfully (reason: ${reason})`);
        return true;
    }
    forceEndSession(reason) {
        if (reason === undefined) reason = 'forced';
        this._log('gameState', `[SessionCore] Force ending session (reason: ${reason})...`);
        this.isEnding = false;
        this.hasEnded = false;
        return this.endSession(reason);
    }
    // ============================================================================
    // ENTITY STATE MANAGEMENT (Delegated to SessionStateManager)
    // ============================================================================
    setEntityState(entity, state) {
        this.stateManager?.setEntityState(entity, state);
    }
    getEntityState(entity) {
        return this.stateManager?.getEntityState(entity);
    }
    canEntityTakeDamage(entity) {
        return this.stateManager?.canEntityTakeDamage(entity) || false;
    }
    // ============================================================================
    // COUNTDOWN SYSTEM (Delegated to CountdownSystem)
    // ============================================================================
    _startCountdown() {
        this.countdownSystem?.startCountdown();
    }
    updateCountdown(dt) {
        if (this.countdownSystem?.updateCountdown(dt)) {
            this._finishCountdown();
        }
    }
    _finishCountdown() {
        this._log('gameState', '[SessionCore] ✅ Countdown finished - activating session!');
        // Set session active BEFORE enabling entities
        this.isCountingDown = false;
        this.isActive = true;
        this.startTime = performance.now() / 1000;
        this._log('gameState', '[SessionCore] 🟢 Session is now ACTIVE');
        // ✅ CRITICAL FIX: Register death event listener NOW (after app is fully ready)
        console.log('[SessionCore] 🔍 Checking respawnManager:', !!this.respawnManager);
        if (this.respawnManager) {
            console.log('[SessionCore] 🔍 RespawnManager exists, setting up listener...');
            try {
                // ❌ REMOVED: Cleanup can interfere with registration in the same tick
                // this.respawnManager.cleanupDeathListener();
                console.log('[SessionCore] Calling setupDeathListener...');
                this.respawnManager.setupDeathListener(); // Register with fully initialized app
                console.log('[SessionCore] setupDeathListener() call completed');
                this._log('debug', '[SessionCore] ✅ Death event listener registered after countdown');
                console.log('[SessionCore] ✅ Death listener setup completed');
            } catch (error) {
                console.error('[SessionCore] ❌ ERROR setting up death listener:', error);
                this._log('error', `[SessionCore] Death listener error: ${error.message}`);
            }
        } else {
            console.error('[SessionCore] ❌ RESPAWN MANAGER IS NULL! Cannot register death listener!');
            this._log('error', '[SessionCore] ❌ RespawnManager is null at countdown finish!');
        }
        // Fire countdown finished event
        this.app.fire('game:countdownFinished', {
            timestamp: performance.now()
        });
        this._log('debug', '[SessionCore] 🚀 Fired game:countdownFinished event');
        // Hide countdown UI
        if (this.gameManager.uiManager) {
            this.gameManager.uiManager.hideCountdown();
        }
        // ✅ CRITICAL: Set up ONE-TIME click handler to lock pointer
        // We can't lock here because there's no user gesture
        // Browser requires pointer lock to be requested during a user event
        console.log('[SessionCore] Checking for canvas...', {
            hasApp: !!this.app,
            hasGraphicsDevice: !!this.app?.graphicsDevice,
            hasCanvas: !!this.app?.graphicsDevice?.canvas
        });
        const canvas = this.app?.graphicsDevice?.canvas;
        if (canvas) {
            console.log('[SessionCore] ✅ Canvas found! Setting up one-time click handler for pointer lock...');
            console.log('[SessionCore] Canvas element:', canvas.tagName, canvas.id);
            const lockOnClick = (event)=>{
                console.log('[SessionCore] 🖱️ Click detected - requesting pointer lock NOW...');
                console.log('[SessionCore] Event:', event.type, event.target);
                // Mark as expected
                if (this.gameManager?.gameCore) {
                    this.gameManager.gameCore._pointerLockExpected = true;
                    console.log('[SessionCore] Set _pointerLockExpected = true');
                }
                // Request pointer lock
                console.log('[SessionCore] Calling canvas.requestPointerLock()...');
                canvas.requestPointerLock();
                // Check result
                setTimeout(()=>{
                    console.log('[SessionCore] Pointer lock element after request:', document.pointerLockElement);
                }, 100);
                console.log('[SessionCore] ✅ Pointer lock requested, listener will auto-remove');
            };
            // Add the listener with { once: true } for auto-removal
            canvas.addEventListener('mousedown', lockOnClick, {
                once: true
            });
            console.log('[SessionCore] ✅ Click handler added to canvas with once:true');
            this._log('gameState', '[SessionCore] 🔒 Click-to-lock handler ready');
        } else {
            console.error('[SessionCore] ❌ Canvas not found! Cannot set up click handler');
        }
        // ✅ NEW: Configure AI for current game mode
        if (this.gameManager.gameModeManager) {
            this.gameManager.gameModeManager.configureAIForMode();
            this._log('gameState', '[SessionCore] 🎯 AI configured for game mode');
        }
        // ✅ NEW: Start the game mode
        if (this.gameManager.gameModeManager) {
            this.gameManager.gameModeManager.startMode();
            this._log('gameState', '[SessionCore] 🎮 Game mode started');
        }
        // ✅ NOW enable all entities
        this._log('gameState', '[SessionCore] 🎯 Enabling all entities...');
        this._enableAllEntitiesAfterCountdown();
        // Clear tracking
        this.deadEntities.clear();
        this.respawningEntities.clear();
        this._log('gameState', '[SessionCore] 🚀 Session fully activated - combat ready!');
    }
    /**
     * ✅ NEW: Enable all entities after countdown completes
     */ _enableAllEntitiesAfterCountdown() {
        this._log('debug', '[SessionCore] 🔓 Enabling all entities after countdown...');
        let enabledCount = 0;
        // Enable player
        const player = this.gameManager.player;
        if (player && player.entity && !player.entity.destroyed) {
            player.entity.enabled = true;
            this.setEntityState(player.entity, 'alive');
            this._log('debug', '[SessionCore] ✅ Player enabled');
            enabledCount++;
        }
        // ✅ CRITICAL FIX: Enable spawned AI entities directly from scene
        // GameEvents registration may not have happened yet, so we enable by tag instead
        const spawnedAgents = this.app.root.findByTag('ai_agent');
        const agentsToEnable = spawnedAgents.filter((entity)=>!entity.tags.has('ai_agent_template') && // Not the template
            !entity.enabled // Not already enabled
        );
        if (agentsToEnable.length > 0) {
            this._log('debug', `[SessionCore] Found ${agentsToEnable.length} spawned AI agents to enable (by tag)`);
            agentsToEnable.forEach((entity)=>{
                entity.enabled = true;
                this.setEntityState(entity, 'alive');
                this._log('debug', `[SessionCore] ✅ Enabled spawned AI agent: ${entity.name}`);
                enabledCount++;
            });
        } else {
            this._log('warn', '[SessionCore] ⚠️ No spawned AI agents found by tag!');
        }
        this._log('gameState', `[SessionCore] ✅ Enabled ${enabledCount} entities - combat ready!`);
    }
    // ============================================================================
    // SESSION UPDATE
    // ============================================================================
    updateSession(dt) {
        if (this.isEnding || this.hasEnded) return;
        this.timeRemaining -= dt;
        this.updateTimer += dt;
        if (this.updateTimer >= this.updateInterval) {
            this._updateUI();
            this.updateTimer = 0;
        }
        this.processRespawns(dt);
        this._cleanupOrphanedStates();
        // ✅ NEW: Check mode-specific victory conditions
        if (this.gameManager.gameModeManager) {
            const mode = this.gameManager.gameModeManager.getCurrentMode();
            if (mode) {
                const victoryCheck = mode.checkVictoryConditions();
                if (victoryCheck.gameOver) {
                    return {
                        shouldEnd: true,
                        reason: victoryCheck.reason,
                        winner: victoryCheck.winner,
                        results: victoryCheck
                    };
                }
            }
        }
        if (this.timeRemaining <= 0) {
            return {
                shouldEnd: true,
                reason: 'timer_expired'
            };
        }
        return {
            shouldEnd: false
        };
    }
    _cleanupOrphanedStates() {
        const now = performance.now();
        const stateTimeout = aiConfig.session.STATE_TRANSITION_TIMEOUT_MS;
        this.entityStates.forEach((state, entityId)=>{
            if (!state.entity || state.entity.destroyed || now - state.timestamp > stateTimeout && state.state === 'destroyed') {
                this.entityStates.delete(entityId);
                this.deadEntities.delete(entityId);
                this.respawningEntities.delete(entityId);
            }
        });
    }
    _updateUI() {
        if (!this.gameManager.uiManager) return;
        this.gameManager.uiManager.updateTimer(Math.max(0, this.timeRemaining));
        const player = this.gameManager.player;
        if (player && player.entity) {
            if (player.healthSystem || player.entity.script && player.entity.script.healthSystem) {
                const health = player.healthSystem || player.entity.script.healthSystem;
                this.gameManager.uiManager.updateHealth(health.currentHealth, health.maxHealth);
            }
            if (player.weaponSystem || player.entity.script && player.entity.script.weaponSystem) {
                const weapon = player.weaponSystem || player.entity.script.weaponSystem;
                const weaponInfo = weapon.getWeaponInfo ? weapon.getWeaponInfo() : weapon;
                if (weaponInfo) {
                    this.gameManager.uiManager.updateAmmo(weaponInfo.currentMagazine || weaponInfo.ammo || 0, weaponInfo.totalAmmo || 0);
                }
            }
        }
    }
    // ============================================================================
    // ENTITY SPAWNING - ✅ FIXED: SEPARATE SPAWN POINTS
    // ============================================================================
    _spawnAllEntities() {
        this._log('debug', '[SessionCore] Spawning all entities...');
        try {
            this._initializePlayer();
        } catch (e) {
            this._log('error', `[SessionCore] Error initializing player: ${e.message}`);
            this._log('error', `[SessionCore] Stack: ${e.stack}`);
        }
        try {
            this._spawnAgents();
        } catch (e) {
            this._log('error', `[SessionCore] Error spawning agents: ${e.message}`);
            this._log('error', `[SessionCore] Stack: ${e.stack}`);
        }
        this._log('debug', '[SessionCore] All entities spawned');
    }
    _initializePlayer() {
        const player = this.gameManager.player;
        if (!player || !player.entity) {
            this._log('debug', '[SessionCore] No player to initialize');
            return;
        }
        try {
            if (player.entity.destroyed) {
                this._log('warn', '[SessionCore] Player entity is destroyed, cannot respawn');
                return;
            }
            const entityId = player.entity.getGuid();
            // ✅ FIX: Check if player script has already initialized (prevents duplicate init)
            const playerScript = player.entity.script && player.entity.script.player;
            if (playerScript && playerScript.__playerBooted) {
                this._log('debug', '[SessionCore] Player already initialized by script, syncing position only');
                // Just sync position/state without firing duplicate events
                const currentPos = player.entity.getPosition();
                if (!player.entity._originalPlayerPosition) {
                    player.entity._originalPlayerPosition = currentPos.clone();
                }
                // Sync YUKA entity
                if (playerScript.yukaEntity) {
                    playerScript.yukaEntity.position.set(currentPos.x, currentPos.y, currentPos.z);
                    const rot = player.entity.getRotation();
                    playerScript.yukaEntity.rotation.set(rot.x, rot.y, rot.z, rot.w);
                    const fwd = player.entity.forward;
                    playerScript.yukaEntity.forward.set(fwd.x, fwd.y, -fwd.z);
                }
                this._assignPlayerTeam(player.entity);
                return; // Skip duplicate event firing
            }
            if (this.respawningEntities.has(entityId)) {
                this._log('debug', '[SessionCore] Player already respawning, skipping...');
                return;
            }
            this.respawningEntities.add(entityId);
            this.setEntityState(player.entity, 'respawning');
            // ✅ Player stays at its editor-placed position - no spawn point needed
            const currentPos = player.entity.getPosition();
            // ✅ Store original player position for respawn
            if (!player.entity._originalPlayerPosition) {
                player.entity._originalPlayerPosition = currentPos.clone();
            }
            this._log('gameState', `[SessionCore] ✅ Player ready at editor position (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${currentPos.z.toFixed(2)})`);
            // Sync YUKA entity if player has one (reuse playerScript from above)
            if (playerScript && playerScript.yukaEntity) {
                playerScript.yukaEntity.position.set(currentPos.x, currentPos.y, currentPos.z);
                const rot = player.entity.getRotation();
                playerScript.yukaEntity.rotation.set(rot.x, rot.y, rot.z, rot.w);
                const fwd = player.entity.forward;
                playerScript.yukaEntity.forward.set(fwd.x, fwd.y, -fwd.z);
                this._log('debug', '[SessionCore] Player YUKA entity synced');
            }
            this._assignPlayerTeam(player.entity);
            // Respawn player (restore health)
            if (player.respawn) {
                player.respawn();
            } else if (playerScript && playerScript.respawn) {
                playerScript.respawn();
            } else if (player.entity.script && player.entity.script.healthSystem) {
                player.entity.script.healthSystem.currentHealth = player.entity.script.healthSystem.maxHealth;
            }
            // Update state tracking
            this.deadEntities.delete(entityId);
            this.respawningEntities.delete(entityId);
            this.setEntityState(player.entity, 'spawned_disabled');
            // Fire player:ready event
            this._log('gameState', '[SessionCore] 🎯 Firing player:ready event');
            this.app.fire('player:ready', player.entity);
            this.app.fire('player:spawned', player.entity);
            setTimeout(()=>{
                this._log('debug', '[SessionCore] 🎯 Firing delayed player:ready (fallback)');
                this.app.fire('player:ready', player.entity);
            }, 100);
            this._log('debug', '[SessionCore] ✅ Player ready (disabled until countdown ends)');
        } catch (e) {
            this._log('error', '[SessionCore] Error respawning player:', e);
            if (player.entity) {
                try {
                    const entityId = player.entity.getGuid();
                    this.respawningEntities.delete(entityId);
                } catch (e2) {
                // Entity destroyed
                }
            }
        }
    }
    _assignPlayerTeam(entity) {
        try {
            entity.team = 'player';
            if (entity.tags) {
                if (!entity.tags.has('faction_player')) entity.tags.add('faction_player');
                if (!entity.tags.has('team_player')) entity.tags.add('team_player');
            }
            if (entity.script) {
                entity.script.teamIdentifier = 'player';
                entity.script.faction = 'player';
            }
            this._log('aiDetail', `Assigned player team to ${entity.name}`);
        } catch (e) {
            this._log('warn', `Failed to set player team:`, e);
        }
    }
    _spawnAgents() {
        console.log('[SessionCore] 🔥 _spawnAgents() CALLED');
        // Ensure agents array is initialized and empty
        if (!this.gameManager.agents) {
            this.gameManager.agents = [];
            console.log('[SessionCore] Initialized gameManager.agents array');
        }
        const settings = this.gameManager.getSettings();
        const existingAgentCount = this.gameManager.agents.length;
        const agentsToSpawn = Math.max(0, settings.maxAgents - existingAgentCount);
        console.log('[SessionCore] Spawn calculation:', {
            maxAgents: settings.maxAgents,
            existingAgentCount,
            agentsToSpawn
        });
        this._log('aiState', `[SessionCore] Spawning agents - maxAgents: ${settings.maxAgents}, existing: ${existingAgentCount}, toSpawn: ${agentsToSpawn}`);
        if (agentsToSpawn <= 0) {
            console.error('[SessionCore] ❌ SKIPPING SPAWN - already have agents!');
            this._log('warn', `[SessionCore] ⚠️ Already have ${existingAgentCount} agents, skipping spawn (this shouldn't happen!)`);
            return;
        }
        // Reset session agents array
        this.agents = [];
        console.log('[SessionCore] Calling agentSpawner.spawnAgents...');
        // Use AgentSpawner to spawn agents
        const spawnedEntities = this.agentSpawner.spawnAgents(agentsToSpawn, (index)=>this.spawnPointManager.getAISpawnPoint(index));
        console.log('[SessionCore] spawnAgents returned:', spawnedEntities);
        console.log('[SessionCore] Spawned entity count:', spawnedEntities.length);
        // Set up weapon refresh for each spawned agent
        spawnedEntities.forEach((entity)=>{
            console.log('[SessionCore] Setting up entity:', entity.name);
            entity.once('ready', ()=>{
                const aiAgent = entity.script?.aiAgent;
                if (aiAgent && !this.agents.includes(aiAgent)) {
                    this.agents.push(aiAgent);
                    this._log('aiDetail', `Agent registered: ${entity.name}`);
                }
                // Force weapon update after initialization
                const weaponSystem = entity.script?.weaponSystem;
                if (weaponSystem && weaponSystem.updateWeaponModel) {
                    weaponSystem.updateWeaponModel();
                    this._log('debug', `[SessionCore] Weapon refreshed for ${entity.name}`);
                }
            });
        });
        console.log('[SessionCore] ✅ _spawnAgents() COMPLETE');
    }
    // ============================================================================
    // AI RESPAWN SYSTEM
    // ============================================================================
    // ✅ Find any available spawn point for respawn (fallback method)
    _findAnyAvailableSpawnPoint() {
        const spawnPoints = this.gameManager.getSpawnPoints();
        if (!spawnPoints || spawnPoints.length === 0) {
            this._log('error', '[SessionCore] ❌ NO SPAWN POINTS available for respawn!');
            return null;
        }
        // Just use the first valid spawn point
        for(let i = 0; i < spawnPoints.length; i++){
            const spawnPoint = spawnPoints[i];
            if (spawnPoint && typeof spawnPoint.getPosition === 'function') {
                this._log('debug', `[SessionCore] Using fallback spawn point [${i}] "${spawnPoint.name || 'unnamed'}"`);
                return spawnPoint;
            }
        }
        this._log('error', '[SessionCore] ❌ No valid spawn points found for respawn!');
        return null;
    }
    // ❌ REMOVED: _getPlayerSpawnPoint() - player uses editor position
    // ❌ REMOVED: Old _getRandomSpawnPoint() - no longer used
    // ============================================================================
    // RESPAWN SYSTEM
    // ============================================================================
    processRespawns(dt) {
        for(let i = this.pendingRespawns.length - 1; i >= 0; i--){
            const respawn = this.pendingRespawns[i];
            respawn.timer -= dt;
            if (respawn.timer <= 0) {
                this._executeRespawn(respawn);
                this.pendingRespawns.splice(i, 1);
            }
        }
    }
    _executeRespawn(respawn) {
        if (respawn.type === 'agent') {
            // For agent respawns, use next available agent index
            const nextIndex = this.agents.length;
            this._spawnAgent(nextIndex);
        } else if (respawn.type === 'player') {
            this._initializePlayer();
        }
    }
    scheduleRespawn(type, delay, entityId) {
        if (entityId) {
            const existingRespawn = this.pendingRespawns.find((r)=>r.entityId === entityId);
            if (existingRespawn) {
                this._log('debug', `Respawn already scheduled for ${type}, skipping`);
                return;
            }
        }
        this.pendingRespawns.push({
            type: type,
            timer: delay,
            entityId: entityId
        });
        this._log('debug', `Scheduled ${type} respawn in ${delay}s`);
    }
    // ============================================================================
    // ENTITY DEATH
    // ============================================================================
    handleEntityDeath(entityId, entity) {
        Logger.debug(`[SessionCore] handleEntityDeath() called for ${entity?.name}, entityId=${entityId}`);
        if (!entityId) {
            this._log('warn', '[SessionCore] handleEntityDeath called without entityId');
            return false;
        }
        // ✅ FIX: Time-based duplicate death prevention
        // Prevent the SAME death event from being processed multiple times in the same frame
        // BUT allow the entity to die again after respawning (after debounce time)
        const now = performance.now();
        const lastDeathTime = this.recentDeaths.get(entityId);
        if (lastDeathTime && now - lastDeathTime < this.deathDebounceTime) {
            Logger.debug(`[SessionCore] ⚠️ Duplicate death detected for ${entity?.name} - ignoring (last death ${(now - lastDeathTime).toFixed(0)}ms ago)`);
            this._log('debug', '[SessionCore] Death event too recent, ignoring duplicate');
            return false; // Block duplicate processing
        }
        // Record this death timestamp
        this.recentDeaths.set(entityId, now);
        // Clean up old death timestamps (keep map from growing indefinitely)
        this._cleanupRecentDeaths(now);
        // Set entity state
        this.setEntityState(entity, 'dead');
        Logger.debug(`[SessionCore] ✅ Death processed for ${entity?.name} - will record in metrics`);
        // ✅ Note: Respawn scheduling is handled by _onEntityDied() listener
        // This method is only for death event deduplication and stats coordination
        return true; // Allow stats recording
    }
    /**
     * ✅ Clean up old death timestamps to prevent memory leak
     */ _cleanupRecentDeaths(now) {
        const cleanupThreshold = this.deathDebounceTime * 10; // Keep last 1 second of deaths
        for (const [entityId, timestamp] of this.recentDeaths.entries()){
            if (now - timestamp > cleanupThreshold) {
                this.recentDeaths.delete(entityId);
            }
        }
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * ✅ Cleanup death event listener
     */ _cleanupDeathListener() {
        if (this.respawnManager) {
            this.respawnManager.cleanupDeathListener();
        }
    }
    _cleanupAgents() {
        this.agents.forEach((agent)=>{
            if (agent && agent.entity) {
                try {
                    const entityId = agent.entity.getGuid();
                    this.deadEntities.delete(entityId);
                    this.respawningEntities.delete(entityId);
                    this.entityStates.delete(entityId);
                    if (agent.entity._spawnTimeoutId) {
                        clearTimeout(agent.entity._spawnTimeoutId);
                        agent.entity._spawnTimeoutId = null;
                    }
                    agent.entity.destroy();
                } catch (e) {
                    this._log('warn', '[SessionCore] Error cleaning up agent:', e);
                }
            }
        });
        this.agents = [];
    }
    /**
     * Get display-friendly weapon name for death screen
     */ _getWeaponDisplayName(weaponType) {
        const weaponNames = {
            'pistol': 'Combat Pistol',
            'machinegun': 'Heavy Machinegun',
            'shotgun': 'Combat Shotgun',
            'rocketlauncher': 'Rocket Launcher'
        };
        return weaponNames[weaponType] || 'Unknown Weapon';
    }
    /**
     * ✅ Cleanup all blood splatter effects from an entity
     */ _cleanupBloodEffects(entity) {
        if (!entity || entity.destroyed) return;
        try {
            // Find all child entities named 'BloodDecal'
            const bloodDecals = entity.find((child)=>child.name === 'BloodDecal');
            if (bloodDecals && bloodDecals.length > 0) {
                bloodDecals.forEach((decal)=>{
                    if (decal && !decal.destroyed) {
                        decal.destroy();
                    }
                });
                this._log('debug', `[SessionCore] Cleaned up ${bloodDecals.length} blood effects from ${entity.name}`);
            }
        } catch (e) {
            this._log('warn', `[SessionCore] Error cleaning up blood effects: ${e.message}`);
        }
    }
    cleanup() {
        this._cleanupAgents();
        this.deadEntities.clear();
        this.respawningEntities.clear();
        this.entityStates.clear();
        this.recentDeaths.clear(); // ✅ Clear death tracking
        this.pendingRespawns.forEach((respawn)=>{
            if (respawn.timeoutId) {
                clearTimeout(respawn.timeoutId);
            }
        });
        this.pendingRespawns = [];
        this.isActive = false;
        this.isEnding = false;
        this.hasEnded = true;
        this.__sessionCoreReady = false;
    }
    // ============================================================================
    // SESSION INFO
    // ============================================================================
    getSessionInfo() {
        return {
            isActive: this.isActive,
            isEnding: this.isEnding,
            hasEnded: this.hasEnded,
            isCountingDown: this.isCountingDown,
            timeRemaining: this.timeRemaining,
            countdownTimer: this.countdownTimer,
            endReason: this.endReason,
            agentCount: this.agents.length,
            pendingRespawns: this.pendingRespawns.length
        };
    }
    _log(level, message, data = null) {
        if (typeof Logger !== 'undefined' && Logger[level]) {
            // Don't add [SessionCore] prefix if message already has a prefix
            if (message.startsWith('[')) {
                Logger[level](message, data);
            } else {
                Logger[level](`[SessionCore] ${message}`, data);
            }
        } else {
            console.log(`[SessionCore] ${level.toUpperCase()}: ${message}`, data || '');
        }
    }
    constructor(app, gameManager){
        this.app = app;
        this.gameManager = gameManager;
        // Session state
        this.isActive = false;
        this.isEnding = false;
        this.hasEnded = false;
        this.startTime = aiConfig.session.UPDATE_TIMER_INITIAL;
        this.timeRemaining = aiConfig.session.UPDATE_TIMER_INITIAL;
        // Agents and spawning
        this.agents = [];
        this.pendingRespawns = [];
        this.respawningEntities = new Set(); // Track entities currently respawning
        // ✅ FIX: Track recent death events to prevent duplicate processing
        this.recentDeaths = new Map(); // entityId -> timestamp
        this.deathDebounceTime = aiConfig.session.DEATH_DEBOUNCE_MS; // Prevent duplicate death within 100ms
        // Timers
        this.updateTimer = aiConfig.session.UPDATE_TIMER_INITIAL;
        this.updateInterval = aiConfig.session.UPDATE_INTERVAL;
        this.endReason = null;
        this.__sessionCoreReady = false;
        // Modular systems (initialized in initialize())
        this.agentSpawner = null;
        this.spawnPointManager = null;
        this.respawnManager = null;
        this.countdownSystem = null;
        this.stateManager = null;
    }
}

export { SessionCore };
