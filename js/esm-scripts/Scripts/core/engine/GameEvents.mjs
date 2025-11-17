import { GameCore } from './GameCore.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class GameEvents {
    // ============================================================================
    // EVENT SETUP & HANDLERS
    // ============================================================================
    setupEvents() {
        // Guard against duplicate setup
        if (this._eventsBound) {
            const Logger = this._getLogger();
            Logger.debug('[GameEvents] Events already setup, skipping duplicate setup');
            return;
        }
        this._eventsBound = true;
        const on = this.app.on.bind(this.app);
        // UI events
        on('ui:playClicked', this._onPlayClicked, this);
        on('ui:rematchClicked', this._onRematchClicked, this);
        on('ui:quitClicked', this._onQuitClicked, this);
        on('ui:pauseClicked', this._onPauseClicked, this);
        on('ui:resumeClicked', this._onResumeClicked, this);
        // Registration from systems
        on('game:agent:register:request', this._onAgentRegisterRequest, this);
        on('game:player:register:request', this._onPlayerRegisterRequest, this);
        // Session lifecycle
        on('game:sessionEnded', this._onSessionEnded, this);
        // Agent ready events
        on('ai:agent:ready', this._onAgentReady, this);
        on('ai:agent:spawned', this._onAgentSpawned, this);
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Events bound');
    }
    // ============================================================================
    // UI EVENT HANDLERS
    // ============================================================================
    _onPlayClicked() {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Play clicked');
        if (this.gameManager.gameCore.currentState === GameCore.STATES.MAIN_MENU) {
            this.gameManager.gameCore.setState(GameCore.STATES.PLAYING);
            this.gameManager.gameCore.hasEverStartedPlaying = true;
        }
    }
    _onRematchClicked() {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Rematch clicked');
        if (this.gameManager.gameCore.isRematchInProgress) return;
        this.gameManager.gameCore.isRematchInProgress = true;
        this._forceEndCurrentSession();
        setTimeout(()=>{
            this.gameManager.gameCore.setState(GameCore.STATES.PLAYING);
            this.gameManager.gameCore.isRematchInProgress = false;
        }, 100);
    }
    _onQuitClicked() {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Quit clicked');
        // ✅ CRITICAL: Set flag to skip round summary when quitting
        // User wants to go directly to main menu, not see stats
        if (this.gameManager.gameCore) {
            this.gameManager.gameCore._skipRoundSummary = true;
            Logger.debug('[GameEvents] Set _skipRoundSummary flag - going directly to main menu');
        }
        this.gameManager.gameCore.setState(GameCore.STATES.MAIN_MENU);
    }
    _onPauseClicked() {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Pause clicked');
        if (this.gameManager.gameCore.currentState === GameCore.STATES.PLAYING) {
            // Check if already paused
            if (this.gameManager.gameCore.uiManager?.core?.isPaused) {
                Logger.debug('[GameEvents] Already paused, ignoring duplicate pause request');
                return;
            }
            Logger.debug('[GameEvents] Pausing game...');
            if (this.gameManager.gameCore.uiManager) {
                this.gameManager.gameCore.uiManager.showPauseMenu();
            }
        }
    }
    _onResumeClicked() {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Resume clicked');
        if (this.gameManager.gameCore.currentState === GameCore.STATES.PLAYING) {
            // Check if actually paused
            if (!this.gameManager.gameCore.uiManager?.core?.isPaused) {
                Logger.debug('[GameEvents] Not paused, ignoring resume request');
                return;
            }
            Logger.debug('[GameEvents] Resuming game...');
            if (this.gameManager.gameCore.uiManager) {
                this.gameManager.gameCore.uiManager.hidePauseMenu();
            }
        }
    }
    // ============================================================================
    // SESSION EVENT HANDLERS
    // ============================================================================
    _onSessionEnded(sessionData) {
        const Logger = this._getLogger();
        Logger.gameState('[GameEvents] Session ended:', sessionData);
        // ✅ CRITICAL: Check if user quit to main menu - skip round summary
        if (this.gameManager.gameCore?._skipRoundSummary) {
            Logger.gameState('[GameEvents] User quit to main menu - skipping round summary');
            this.gameManager.gameCore._skipRoundSummary = false; // Reset flag
            return; // Don't show round summary, already going to main menu
        }
        // Extract stats from sessionData if wrapped
        const stats = sessionData?.stats || sessionData;
        // ✅ ENHANCED LOGGING: Show ALL stats being passed
        Logger.gameState('[GameEvents] ========== SESSION STATS ==========');
        Logger.gameState('[GameEvents] Raw sessionData type:', typeof sessionData);
        Logger.gameState('[GameEvents] Has stats property:', sessionData?.stats ? 'YES' : 'NO');
        Logger.gameState('[GameEvents] Extracted stats:', JSON.stringify(stats, null, 2));
        Logger.gameState('[GameEvents] Stats breakdown:');
        Logger.gameState('[GameEvents]   - kills:', stats?.kills);
        Logger.gameState('[GameEvents]   - deaths:', stats?.deaths);
        Logger.gameState('[GameEvents]   - accuracy:', stats?.accuracy);
        Logger.gameState('[GameEvents]   - damageDealt:', stats?.damageDealt);
        Logger.gameState('[GameEvents]   - duration:', stats?.duration);
        Logger.gameState('[GameEvents]   - shotsFired:', stats?.shotsFired);
        Logger.gameState('[GameEvents]   - shotsHit:', stats?.shotsHit);
        Logger.gameState('[GameEvents]   - itemsPickedUp:', stats?.itemsPickedUp);
        Logger.gameState('[GameEvents]   - bestKillStreak:', stats?.bestKillStreak);
        Logger.gameState('[GameEvents]   - biggestHit:', stats?.biggestHit);
        Logger.gameState('[GameEvents]   - footsteps:', stats?.footsteps);
        Logger.gameState('[GameEvents]   - weaponSwitches:', stats?.weaponSwitches);
        Logger.gameState('[GameEvents]   - distance:', stats?.distance);
        Logger.gameState('[GameEvents]   - bestAI:', stats?.bestAI);
        Logger.gameState('[GameEvents]   - aiAccuracy:', stats?.aiAccuracy);
        Logger.gameState('[GameEvents] ====================================');
        // ✅ FIX: Defer state transition to avoid race condition with cleanup
        // Allow any ongoing state transition to complete first
        setTimeout(()=>{
            if (!this.gameManager?.entity?.destroyed) {
                Logger.debug('[GameEvents] Setting ROUND_SUMMARY state with stats:', stats);
                this.gameManager.gameCore.setState(GameCore.STATES.ROUND_SUMMARY, stats);
            }
        }, 100);
    }
    // ============================================================================
    // AGENT/PLAYER REGISTRATION EVENT HANDLERS
    // ============================================================================
    _onAgentReady(agent) {
        const Logger = this._getLogger();
        Logger.aiState(`[GameEvents] Agent ready: ${agent?.entity?.name}`);
        // Debug current game state
        const currentState = this.gameManager?.gameCore?.currentState;
        Logger.debug(`[GameEvents] Current game state: ${currentState}`);
        Logger.debug(`[GameEvents] Is PLAYING: ${currentState === GameCore.STATES.PLAYING}`);
        // If we're in playing state, try to activate this agent
        if (currentState === GameCore.STATES.PLAYING) {
            Logger.debug(`[GameEvents] Game is PLAYING, checking if agent activatable...`);
            const isActivatable = this.gameManager.gameLifecycle._isAgentActivatable(agent);
            Logger.debug(`[GameEvents] Agent ${agent?.entity?.name} activatable: ${isActivatable}`);
            if (isActivatable) {
                Logger.aiState(`[GameEvents] ✅ Activating agent: ${agent?.entity?.name}`);
                this.gameManager.gameLifecycle._activateAgent(agent);
                Logger.aiState(`[GameEvents] Agent activation complete: ${agent?.entity?.name}`);
            } else {
                Logger.aiState(`[GameEvents] ❌ Agent NOT activatable: ${agent?.entity?.name}`);
            }
        } else {
            // Expected during game start - agents activate when match begins
            Logger.debug(`[GameEvents] Game not in PLAYING state (state=${currentState}), deferring agent activation`);
        }
    }
    _onAgentSpawned(agentEntity) {
        const Logger = this._getLogger();
        Logger.aiState(`[GameEvents] Agent spawned: ${agentEntity?.name}`);
        // Get the agent script from the entity
        const agentScript = agentEntity?.script?.aiAgent;
        if (!agentScript) {
            Logger.error('[GameEvents] Agent spawned but no aiAgent script found!');
            return;
        }
        // Register the agent
        this._onAgentRegisterRequest(agentScript);
    }
    _onAgentRegisterRequest(agentScript) {
        const Logger = this._getLogger();
        const guid = agentScript?.entity?.getGuid?.() || agentScript?.entity?.name || agentScript?.name;
        if (!guid) {
            Logger.error('[GameEvents] Agent register request missing GUID');
            return;
        }
        // ✅ FIX: Skip registration if this is a template entity
        // Template entities should be disabled in the scene, but this is a safety check
        if (agentScript.entity?.tags?.has('ai_agent_template')) {
            Logger.debug('[GameEvents] ⚠️ Skipping registration - entity has ai_agent_template tag (template should be disabled!)');
            return;
        }
        if (this.gameManager._registeredAgents.has(guid)) {
            // Idempotent skip - already registered
            return;
        }
        this.gameManager._registeredAgents.add(guid);
        // Enhanced agent team assignment during registration
        if (agentScript && agentScript.entity) {
            try {
                // Method 1: Direct team property
                agentScript.entity.team = 'ai';
                // Method 2: Tag-based team identification
                if (agentScript.entity.tags) {
                    if (!agentScript.entity.tags.has('ai')) agentScript.entity.tags.add('ai');
                    if (!agentScript.entity.tags.has('enemy')) agentScript.entity.tags.add('enemy');
                    if (!agentScript.entity.tags.has('team_ai')) agentScript.entity.tags.add('team_ai');
                }
                // Method 3: Script-based team identification
                if (agentScript.entity.script) {
                    agentScript.entity.script.teamIdentifier = 'ai';
                    agentScript.entity.script.faction = 'ai';
                }
                Logger.gameState(`[GameEvents] Assigned comprehensive AI team identifiers to ${agentScript.entity.name} during registration`);
            } catch (e) {
                Logger.warn(`[GameEvents] Failed to set agent team identifiers during registration for ${agentScript.entity.name || 'agent'}:`, e);
            }
        }
        Logger.gameState('[GameEvents] Agent registered with team=ai:', agentScript?.entity?.name || 'unknown');
        // Initialize agents array if needed
        if (!this.gameManager.agents) {
            this.gameManager.agents = [];
        }
        // Add script to agents array
        this.gameManager.agents.push(agentScript);
        Logger.debug(`[GameEvents] ✅ Registered agent script (total: ${this.gameManager.agents.length})`);
        if (this.gameManager.gameCore.currentState !== GameCore.STATES.PLAYING) {
            agentScript.entity.enabled = false;
            Logger.aiDetail(`[GameEvents] Agent ${agentScript?.entity?.name || 'unknown'} disabled (not in PLAYING state)`);
        }
        // Emit informational event
        this.app.fire('game:agent:registered', agentScript);
    }
    _onPlayerRegisterRequest(playerScript) {
        const Logger = this._getLogger();
        // 🔥 FIX: Improved duplicate prevention
        if (!playerScript || !playerScript.entity) {
            Logger.error('[GameEvents] Invalid player registration request: no entity');
            return;
        }
        const guid = playerScript.entity.getGuid();
        // Check if already registered by GUID
        if (this.gameManager._registeredPlayer === guid) {
            Logger.debug('[GameEvents] Player already registered (GUID match), ignoring duplicate request');
            return;
        }
        // Check if same instance
        if (this.gameManager.player === playerScript) {
            Logger.debug('[GameEvents] Player already registered (same instance), ignoring duplicate request');
            this.gameManager._registeredPlayer = guid; // Ensure GUID is tracked
            return;
        }
        Logger.gameState(`[GameEvents] 🎯 Registering player: ${playerScript.entity.name} (GUID: ${guid.substring(0, 8)})`);
        // Track registration
        this.gameManager._registeredPlayer = guid;
        // Handle duplicate player replacement
        if (this.gameManager.player && this.gameManager.player !== playerScript) {
            Logger.warn('[GameEvents] Player already registered, replacing with new player');
            if (this.gameManager.player.entity && this.gameManager.player.entity !== playerScript.entity) {
                Logger.debug('[GameEvents] Disabling previous player entity');
                this.gameManager.player.entity.enabled = false;
            }
        }
        // Enhanced player team assignment during registration
        if (playerScript && playerScript.entity) {
            try {
                // Method 1: Direct team property
                playerScript.entity.team = 'player';
                // Method 2: Tag-based team identification
                if (playerScript.entity.tags) {
                    if (!playerScript.entity.tags.has('player')) playerScript.entity.tags.add('player');
                    if (!playerScript.entity.tags.has('team_player')) playerScript.entity.tags.add('team_player');
                }
                // Method 3: Script-based team identification
                if (playerScript.entity.script) {
                    playerScript.entity.script.teamIdentifier = 'player';
                    playerScript.entity.script.faction = 'player';
                }
                Logger.gameState(`[GameEvents] Assigned comprehensive PLAYER team identifiers to ${playerScript.entity.name} during registration`);
            } catch (e) {
                Logger.warn(`[GameEvents] Failed to set player team identifiers during registration for ${playerScript.entity.name || 'player'}:`, e);
            }
        }
        Logger.gameState('[GameEvents] ✅ Player registered with team=player:', playerScript?.entity?.name || 'unknown');
        this.gameManager.player = playerScript;
        if (this.gameManager.gameCore.currentState !== GameCore.STATES.PLAYING) {
            playerScript.entity.enabled = false;
            Logger.debug('[GameEvents] Player disabled (not in PLAYING state)');
        }
        // Emit informational event
        this.app.fire('game:player:registered', playerScript);
    }
    // ============================================================================
    // SESSION MANAGEMENT HELPERS
    // ============================================================================
    _forceEndCurrentSession() {
        const Logger = this._getLogger();
        Logger.debug('[GameEvents] Force ending current session...');
        if (this.gameManager.gameSession) {
            this.gameManager.gameSession.forceEndSession('rematch');
        }
        this.app.timeScale = 1;
        this.gameManager.gameCore._stopAllSoundsSafely();
    }
    // ============================================================================
    // EVENT CLEANUP
    // ============================================================================
    cleanupEvents() {
        const Logger = this._getLogger();
        Logger.debug('[GameEvents] Cleaning up events...');
        if (this._eventsBound) {
            // Remove all event listeners
            this.app.off('ui:playClicked', this._onPlayClicked, this);
            this.app.off('ui:rematchClicked', this._onRematchClicked, this);
            this.app.off('ui:quitClicked', this._onQuitClicked, this);
            this.app.off('ui:pauseClicked', this._onPauseClicked, this);
            this.app.off('ui:resumeClicked', this._onResumeClicked, this);
            this.app.off('game:agent:register:request', this._onAgentRegisterRequest, this);
            this.app.off('game:player:register:request', this._onPlayerRegisterRequest, this);
            this.app.off('game:sessionEnded', this._onSessionEnded, this);
            this.app.off('ai:agent:ready', this._onAgentReady, this);
            this.app.off('ai:agent:spawned', this._onAgentSpawned, this);
            this._eventsBound = false;
        }
    }
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    _getLogger() {
        return this.gameManager._getLogger();
    }
    isEventsBound() {
        return this._eventsBound;
    }
    constructor(gameManager){
        this.gameManager = gameManager;
        this.app = gameManager.app;
        this.entity = gameManager.entity;
        // Event binding state
        this._eventsBound = false;
    }
}

export { GameEvents };
