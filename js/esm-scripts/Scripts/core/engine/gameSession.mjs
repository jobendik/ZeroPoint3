import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from './logger.mjs';
import { SessionCore } from './SessionCore.mjs';
import { SessionMetrics } from './SessionMetrics.mjs';
import { SessionEvents } from './SessionEvents.mjs';
import { ProgressionMetrics } from './ProgressionMetrics.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: FACADE - PlayCanvas Script facade for session management system
DOMAIN: CORE/ENGINE
DEPENDENCIES: [SessionCore, SessionMetrics, SessionEvents]
EXPORTS: [GameSession]
GPT_CONTEXT: PlayCanvas Script facade that coordinates session lifecycle, statistics tracking, and event handling. Maintains exact API compatibility while delegating to internal session management modules.
*/ ///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
 * 🎮 Game Session - Session Lifecycle and Statistics Management (ESM)
 * 
 * PlayCanvas Script facade that coordinates comprehensive session management
 * including lifecycle control, statistics tracking, and event handling through
 * a modular architecture.
 * 
 * Features:
 * - Session lifecycle management (start/end/countdown)
 * - Player and AI entity spawning/respawning
 * - Comprehensive statistics tracking
 * - Entity state management and damage validation
 * - Event-driven architecture
 * - UI integration and updates
 * - Respawn queue system
 */ class GameSession extends Script {
    initialize() {
        Logger.debug('[GameSession] initialize() - boot start');
        // Use custom guard flag (not _initialized - PlayCanvas collision!)
        if (this.__gameSessionBooted) {
            Logger.debug('[GameSession] Already initialized, skipping...');
            return;
        }
        this._log('gameState', '[GameSession] Initializing facade...');
        // Initialize internal modules
        this.sessionCore = new SessionCore(this.app, null); // gameManager will be set later
        this.sessionMetrics = new SessionMetrics(this.app, null);
        this.sessionEvents = new SessionEvents(this.app, this.sessionCore, this.sessionMetrics);
        // Initialize ProgressionMetrics (NEW)
        this.progressionMetrics = new ProgressionMetrics(this.app, this.sessionMetrics);
        // Initialize all modules
        this.sessionCore.initialize();
        this.sessionMetrics.initialize();
        this.sessionEvents.initialize();
        this.progressionMetrics.initialize();
        // Expose ProgressionMetrics globally for KillFeed streak announcements
        window.progressionMetrics = this.progressionMetrics;
        // Set custom completion flag at the END
        this.__gameSessionBooted = true;
        this._log('gameState', '[GameSession] Facade initialized successfully');
        Logger.debug('[GameSession] __gameSessionBooted=true (initialize complete)');
    }
    setGameManager(gameManager) {
        this.gameManager = gameManager;
        // Update gameManager reference in core modules
        if (this.sessionCore) {
            this.sessionCore.gameManager = gameManager;
            // ✅ Update delegated modules
            if (this.sessionCore.agentSpawner) {
                this.sessionCore.agentSpawner.gameManager = gameManager;
            }
            if (this.sessionCore.spawnPointManager) {
                this.sessionCore.spawnPointManager.gameManager = gameManager;
            }
            if (this.sessionCore.stateManager) {
                this.sessionCore.stateManager.gameManager = gameManager;
            }
            if (this.sessionCore.countdownSystem) {
                this.sessionCore.countdownSystem.gameManager = gameManager;
            }
            if (this.sessionCore.respawnManager) {
                this.sessionCore.respawnManager.gameManager = gameManager;
            }
        }
        if (this.sessionMetrics) {
            this.sessionMetrics.gameManager = gameManager;
        }
        if (this.progressionMetrics) {
            this.progressionMetrics.gameManager = gameManager;
        }
        this._log('gameState', '[GameSession] Connected to GameManager');
    }
    // Add readiness checking method
    isReady() {
        return this.__gameSessionBooted === true && this.sessionCore && this.sessionCore.isReady() && this.sessionMetrics && this.sessionMetrics.isReady() && this.sessionEvents && this.sessionEvents.isReady() && this.progressionMetrics && this.progressionMetrics._initialized;
    }
    // ============================================================================
    // SESSION LIFECYCLE
    // ============================================================================
    startSession() {
        Logger.debug('[GameSession] 🎮 startSession() CALLED');
        this._log('gameState', '[GameSession] Starting session...');
        try {
            if (!this.gameManager) {
                this._log('error', '[GameSession] No GameManager reference!');
                return false;
            }
            // CRITICAL: Don't proceed if not fully initialized
            if (!this.__gameSessionBooted) {
                this._log('warn', '[GameSession] Not fully initialized, cannot start session');
                return false;
            }
            // Reset metrics
            this.sessionMetrics.resetStats();
            Logger.debug('[GameSession] ✅ Metrics reset');
            // Clean up events first
            this.sessionEvents.cleanupEvents();
            // Start core session
            const sessionStarted = this.sessionCore.startSession();
            Logger.debug('[GameSession] 🔍 SessionCore.startSession() returned:', sessionStarted);
            if (!sessionStarted) {
                Logger.debug('[GameSession] ❌ SessionCore.startSession() FAILED - CANNOT SETUP EVENTS!');
                return false;
            }
            Logger.debug('[GameSession] ✅ SessionCore started');
            // Setup events after core is ready
            Logger.debug('[GameSession] 🎯 About to call setupEvents()...');
            this.sessionEvents.setupEvents();
            Logger.debug('[GameSession] ✅ setupEvents() COMPLETED');
            // Set session start time for metrics
            this.sessionMetrics.setSessionStartTime(performance.now() / 1000);
            Logger.debug('[GameSession] ✅ Session start time set');
            // Fire session started event
            this.sessionEvents.fireSessionStarted();
            this._log('gameState', '[GameSession] Session started successfully');
            Logger.debug('[GameSession] ✅ SESSION STARTED - Events listening, metrics ready!');
            return true;
        } catch (error) {
            Logger.error('[GameSession] ❌❌❌ EXCEPTION IN startSession():', error);
            Logger.error('[GameSession] Stack trace:', error.stack);
            this._log('error', '[GameSession] Exception in startSession:', error);
            return false;
        }
    }
    endSession(reason) {
        if (reason === undefined) reason = 'unknown';
        Logger.debug(`[GameSession] 🛑 endSession() CALLED (reason: ${reason})`);
        this._log('gameState', `[GameSession] Ending session (reason: ${reason})...`);
        if (this.sessionCore.getSessionInfo().hasEnded) {
            Logger.debug('[GameSession] ⚠️ Session already ended, ignoring');
            this._log('warn', '[GameSession] Session already ended');
            return false;
        }
        // Finalize statistics
        const finalStats = this.sessionMetrics.finalizeStats();
        Logger.debug('[GameSession] 📊 Stats finalized:', {
            kills: finalStats.kills,
            deaths: finalStats.deaths,
            shotsFired: finalStats.shotsFired,
            shotsHit: finalStats.shotsHit
        });
        // End core session
        const sessionEnded = this.sessionCore.endSession(reason);
        if (!sessionEnded) {
            Logger.debug('[GameSession] ❌ SessionCore.endSession() FAILED');
            return false;
        }
        // Cleanup events
        this.sessionEvents.cleanupEvents();
        Logger.debug('[GameSession] 🧹 Events cleaned up');
        // Fire session ended event
        this.sessionEvents.fireSessionEnded(finalStats, reason);
        Logger.debug('[GameSession] 🔔 Session ended event fired');
        this._log('gameState', `[GameSession] Session ended successfully (reason: ${reason})`);
        Logger.debug(`[GameSession] ✅ SESSION ENDED (reason: ${reason})`);
        return true;
    }
    forceEndSession(reason) {
        if (reason === undefined) reason = 'forced';
        this._log('gameState', `[GameSession] Force ending session (reason: ${reason})...`);
        // Reset end state to allow forced end
        this.sessionCore.isEnding = false;
        this.sessionCore.hasEnded = false;
        return this.endSession(reason);
    }
    // ============================================================================
    // UPDATE LOOP WITH READINESS CHECKING
    // ============================================================================
    update(dt) {
        // CRITICAL: Only proceed if fully initialized
        if (!this.__gameSessionBooted) {
            return;
        }
        if (!this.gameManager || !this.sessionCore) return;
        const sessionInfo = this.sessionCore.getSessionInfo();
        if (sessionInfo.isEnding || sessionInfo.hasEnded) return;
        if (!this.gameManager.isPlaying()) return;
        if (sessionInfo.isCountingDown) {
            this.sessionCore.updateCountdown(dt);
            return;
        }
        if (sessionInfo.isActive) {
            const updateResult = this.sessionCore.updateSession(dt);
            if (updateResult.shouldEnd) {
                this.endSession(updateResult.reason);
            }
        }
    }
    // ============================================================================
    // PUBLIC API METHODS
    // ============================================================================
    getStats() {
        if (!this.sessionMetrics) {
            return this._createEmptyStats();
        }
        return this.sessionMetrics.getStats();
    }
    getSessionInfo() {
        if (!this.sessionCore) {
            return {
                isActive: false,
                isEnding: false,
                hasEnded: true,
                isCountingDown: false,
                timeRemaining: 0,
                countdownTimer: 0,
                endReason: 'not_initialized',
                agentCount: 0,
                pendingRespawns: 0
            };
        }
        return this.sessionCore.getSessionInfo();
    }
    // Legacy compatibility method for stats creation
    _createEmptyStats() {
        return {
            duration: 0,
            kills: 0,
            deaths: 0,
            shotsFired: 0,
            shotsHit: 0,
            accuracy: 0,
            damageDealt: 0,
            damageTaken: 0,
            itemsPickedUp: 0,
            distance: 0,
            killStreak: 0,
            bestKillStreak: 0,
            fastestKill: 0,
            biggestHit: 0,
            footsteps: 0,
            weaponSwitches: 0,
            totalDeaths: 0,
            bestAI: 'None',
            aiAccuracy: 0
        };
    }
    // ============================================================================
    // ENTITY STATE MANAGEMENT (Delegated)
    // ============================================================================
    _setEntityState(entity, state) {
        if (this.sessionCore) {
            this.sessionCore.setEntityState(entity, state);
        }
    }
    _getEntityState(entity) {
        if (this.sessionCore) {
            return this.sessionCore.getEntityState(entity);
        }
        return null;
    }
    _canEntityTakeDamage(entity) {
        if (this.sessionCore) {
            return this.sessionCore.canEntityTakeDamage(entity);
        }
        return false;
    }
    // ============================================================================
    // ADDITIONAL PUBLIC METHODS
    // ============================================================================
    getCurrentStats() {
        if (!this.sessionMetrics) {
            return this._createEmptyStats();
        }
        return this.sessionMetrics.getCurrentStats();
    }
    getPerformanceMetrics() {
        if (!this.sessionMetrics) {
            return {};
        }
        return this.sessionMetrics.getPerformanceMetrics();
    }
    getStatsSummary() {
        if (!this.sessionMetrics) {
            return {};
        }
        return this.sessionMetrics.getStatsSummary();
    }
    // Event system access
    processCustomEvent(eventName, eventData) {
        if (!this.sessionEvents) {
            return false;
        }
        return this.sessionEvents.processCustomEvent(eventName, eventData);
    }
    getEventStatistics() {
        if (!this.sessionEvents) {
            return {
                eventsActive: false,
                sessionActive: false
            };
        }
        return this.sessionEvents.getEventStatistics();
    }
    // ============================================================================
    // DIAGNOSTICS AND DEBUG
    // ============================================================================
    validateIntegrity() {
        const issues = [];
        if (!this.sessionCore) {
            issues.push('SessionCore not initialized');
        } else if (!this.sessionCore.isReady()) {
            issues.push('SessionCore not ready');
        }
        if (!this.sessionMetrics) {
            issues.push('SessionMetrics not initialized');
        } else if (!this.sessionMetrics.isReady()) {
            issues.push('SessionMetrics not ready');
        }
        if (!this.sessionEvents) {
            issues.push('SessionEvents not initialized');
        } else if (!this.sessionEvents.isReady()) {
            issues.push('SessionEvents not ready');
        } else {
            const eventIssues = this.sessionEvents.validateEventIntegrity();
            issues.push(...eventIssues);
        }
        if (!this.progressionMetrics) {
            issues.push('ProgressionMetrics not initialized');
        } else if (!this.progressionMetrics._initialized) {
            issues.push('ProgressionMetrics not ready');
        }
        if (!this.gameManager) {
            issues.push('GameManager reference missing');
        }
        return issues;
    }
    getModuleStatus() {
        return {
            facade: this.__gameSessionBooted,
            core: this.sessionCore ? this.sessionCore.isReady() : false,
            metrics: this.sessionMetrics ? this.sessionMetrics.isReady() : false,
            events: this.sessionEvents ? this.sessionEvents.isReady() : false,
            progression: this.progressionMetrics ? this.progressionMetrics._initialized : false,
            gameManager: !!this.gameManager
        };
    }
    // ============================================================================
    // CLEANUP AND DESTRUCTION
    // ============================================================================
    destroy() {
        this._log('debug', '[GameSession] Destroying facade...');
        const sessionInfo = this.getSessionInfo();
        if (sessionInfo.isActive || sessionInfo.isCountingDown) {
            this.forceEndSession('destroy');
        }
        // Cleanup all modules
        if (this.sessionEvents) {
            this.sessionEvents.cleanup();
        }
        if (this.sessionCore) {
            this.sessionCore.cleanup();
        }
        if (this.sessionMetrics) {
            this.sessionMetrics.cleanup();
        }
        if (this.progressionMetrics) {
            this.progressionMetrics.cleanup();
        }
        // Clear references
        this.sessionCore = null;
        this.sessionMetrics = null;
        this.sessionEvents = null;
        this.progressionMetrics = null;
        this.gameManager = null;
        this.__gameSessionBooted = false;
        this._log('debug', '[GameSession] Facade destruction complete');
    }
    // Helper methods
    _log(level, message, data = null) {
        if (typeof Logger !== 'undefined') {
            Logger[level](`[GameSession] ${message}`, data);
        } else {
            Logger.debug(`[GameSession] ${level.toUpperCase()}: ${message}`, data || '');
        }
    }
}
_define_property(GameSession, "scriptName", 'gameSession');

export { GameSession };
