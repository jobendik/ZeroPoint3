import { GameModeBase } from './GameModeBase.mjs';
import { Logger } from '../logger.mjs';
import { EnhancedAttackEvaluator } from '../../../ai/goals/evaluators/AttackEvaluator.mjs';
import { EnhancedGetHealthEvaluator } from '../../../ai/goals/evaluators/GetHealthEvaluator.mjs';
import { EnhancedGetAmmoEvaluator } from '../../../ai/goals/evaluators/GetAmmoEvaluator.mjs';
import { EnhancedGetWeaponEvaluator } from '../../../ai/goals/evaluators/GetWeaponEvaluator.mjs';
import { EnhancedExploreEvaluator } from '../../../ai/goals/evaluators/ExploreEvaluator.mjs';
import { EliminateEnemyEvaluator } from '../../../ai/goals/evaluators/EliminateEnemyEvaluator.mjs';
import { TakeCoverEvaluator } from '../../../ai/goals/evaluators/TakeCoverEvaluator.mjs';
import { FlankEvaluator } from '../../../ai/goals/evaluators/FlankEvaluator.mjs';
import { HuntEvaluator } from '../../../ai/goals/evaluators/HuntEvaluator.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * TEAM DEATHMATCH MODE
 * 
 * Classic team-based elimination gameplay:
 * - Player vs AI Team
 * - Score points for kills
 * - First to reach score limit wins
 * - Time limit as backup victory condition
 * 
 * AI Strategic Objective: Eliminate all enemy players
 * 
 * Key Features:
 * - Kill tracking and scoring
 * - Victory condition checking
 * - Strategic AI goal coordination
 * - Mode-specific event handling
 */ class TeamDeathmatchMode extends GameModeBase {
    // ==========================================
    // VICTORY CONDITIONS
    // ==========================================
    checkVictoryConditions() {
        // Player reaches score limit
        if (this.playerScore >= this.scoreLimit) {
            return {
                gameOver: true,
                winner: 'player',
                reason: 'score_limit_reached',
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                },
                stats: {
                    playerKills: this.playerKills,
                    playerDeaths: this.playerDeaths,
                    aiKills: this.aiKills,
                    aiDeaths: this.aiDeaths
                }
            };
        }
        // AI team reaches score limit
        if (this.aiScore >= this.scoreLimit) {
            return {
                gameOver: true,
                winner: 'ai',
                reason: 'score_limit_reached',
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                },
                stats: {
                    playerKills: this.playerKills,
                    playerDeaths: this.playerDeaths,
                    aiKills: this.aiKills,
                    aiDeaths: this.aiDeaths
                }
            };
        }
        // Check for complete elimination (optional - more dramatic ending)
        const aliveAI = this._countAliveAI();
        const playerAlive = this._isPlayerAlive();
        if (aliveAI === 0 && !playerAlive) {
            // Everyone dead - score determines winner
            return {
                gameOver: true,
                winner: this.playerScore > this.aiScore ? 'player' : 'ai',
                reason: 'mutual_elimination',
                finalScore: {
                    player: this.playerScore,
                    ai: this.aiScore
                },
                stats: {
                    playerKills: this.playerKills,
                    playerDeaths: this.playerDeaths,
                    aiKills: this.aiKills,
                    aiDeaths: this.aiDeaths
                }
            };
        }
        return {
            gameOver: false
        };
    }
    _countAliveAI() {
        // Count AI that are either alive OR currently respawning
        // This prevents match from ending during the respawn window
        return this.gameManager.getAllAgents().filter((agent)=>{
            if (!agent || !agent.entity || agent.entity.destroyed) {
                return false; // Entity doesn't exist
            }
            // ✅ Count as "alive" if actually alive
            if (agent.healthSystem && agent.healthSystem.isAlive()) {
                return true;
            }
            // ✅ ALSO count as "alive" if currently respawning (waiting to respawn)
            // This prevents "mutual elimination" from triggering during respawn window
            const sessionCore = this.gameManager?.gameSession?.sessionCore;
            if (sessionCore && sessionCore.respawningEntities) {
                const isRespawning = sessionCore.respawningEntities.has(agent.entity.getGuid());
                if (isRespawning) {
                    return true; // Count respawning AI as "alive" for match logic
                }
            }
            return false; // Actually dead and not respawning
        }).length;
    }
    _isPlayerAlive() {
        const player = this.gameManager.player;
        return player && player.entity && !player.entity.destroyed && player.healthSystem && player.healthSystem.isAlive();
    }
    // ==========================================
    // AI CONFIGURATION
    // ==========================================
    /**
     * Get evaluators for AI goal arbitration system
     * 
     * Priority system (higher = more important):
     * - Attack (1.2): Engage visible enemies immediately
     * - GetHealth (1.0): Seek health when wounded (internally scales up to 2.0 in emergency)
     * - TakeCover (0.95): Flee when under fire
     * - GetWeapon (0.9): Upgrade to better weapons
     * - Hunt (0.90): Actively chase last known enemy position
     * - Flank (0.85): Tactical positioning during combat
     * - GetAmmo (0.8): Restock ammunition when low
     * - Explore (0.5): Patrol when nothing else to do (INCREASED - never idle)
     * 
     * NOTE: No strategic goal needed - evaluators handle everything:
     * - Enemy visible? → Attack
     * - Enemy spotted but hidden? → Hunt
     * - Wounded? → TakeCover + GetHealth
     * - Low ammo? → GetAmmo
     * - Better weapon available? → GetWeapon
     * - Under fire? → TakeCover/Flank
     * - Nothing to do? → Explore (never idle)
     */ getAIGoalEvaluators() {
        return [
            // STRATEGIC: Ultimate objective - hunt and eliminate enemies
            new EliminateEnemyEvaluator(1.0),
            // COMBAT: Engage enemies
            new EnhancedAttackEvaluator(1.2),
            new HuntEvaluator(0.90),
            new FlankEvaluator(0.85),
            // SURVIVAL: Stay alive
            new EnhancedGetHealthEvaluator(1.0),
            new TakeCoverEvaluator(0.95),
            // EQUIPMENT: Improve loadout
            new EnhancedGetWeaponEvaluator(0.9),
            new EnhancedGetAmmoEvaluator(0.8),
            // FALLBACK: Never idle (INCREASED PRIORITY)
            new EnhancedExploreEvaluator(0.5) // Patrol when nothing else to do
        ];
    }
    getAIGoalPriorities() {
        return {
            // Combat priorities
            attack: 1.2,
            hunt: 0.90,
            flank: 0.85,
            // Survival priorities
            getHealth: 1.0,
            takeCover: 0.95,
            // Equipment priorities
            getWeapon: 0.9,
            getAmmo: 0.8,
            // Fallback (INCREASED)
            explore: 0.5
        };
    }
    /**
     * STRATEGIC GOAL CLASS (Optional)
     * 
     * Returns null because this mode uses the evaluator-based approach:
     * - EliminateEnemyEvaluator provides the strategic objective
     * - Evaluator arbitration ensures tactical and strategic goals work together
     * - All evaluators compete fairly based on priorities
     * 
     * If you wanted to use EliminateEnemyGoal instead, uncomment below:
     * return EliminateEnemyGoal;
     * 
     * Note: Using an evaluator (EliminateEnemyEvaluator) is preferred because:
     * - It participates in the arbitration system naturally
     * - It can be dynamically scaled based on situation
     * - It doesn't require separate goal management
     */ getStrategicGoalClass() {
        return null; // Using EliminateEnemyEvaluator instead (see getAIGoalEvaluators)
    }
    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    onPlayerKill(killer, victim) {
        // Player killed an AI
        this.playerScore++;
        this.playerKills++;
        this.aiDeaths++;
        Logger.info(`[Deathmatch] Player kill! Score: ${this.playerScore}/${this.scoreLimit}`);
        // Notify UI
        this.app.fire('mode:score:update', {
            team: 'player',
            score: this.playerScore,
            kills: this.playerKills,
            killer: killer,
            victim: victim
        });
        // Check victory
        const victory = this.checkVictoryConditions();
        if (victory.gameOver) {
            this.app.fire('mode:victory', victory);
        }
    }
    onAIKill(killer, victim) {
        // AI killed the player
        this.aiScore++;
        this.aiKills++;
        this.playerDeaths++;
        Logger.info(`[Deathmatch] AI kill! Score: ${this.aiScore}/${this.scoreLimit}`);
        // Notify UI
        this.app.fire('mode:score:update', {
            team: 'ai',
            score: this.aiScore,
            kills: this.aiKills,
            killer: killer,
            victim: victim
        });
        // Check victory
        const victory = this.checkVictoryConditions();
        if (victory.gameOver) {
            this.app.fire('mode:victory', victory);
        }
    }
    onPlayerDeath(victim) {
        this.playerDeaths++;
        Logger.debug(`[Deathmatch] Player died (total deaths: ${this.playerDeaths})`);
    }
    onAIDeath(victim) {
        this.aiDeaths++;
        Logger.debug(`[Deathmatch] AI died (total deaths: ${this.aiDeaths})`);
    }
    // ==========================================
    // UI CONFIGURATION
    // ==========================================
    getHUDElements() {
        return [
            'health',
            'ammo',
            'timer',
            'score',
            'killFeed'
        ];
    }
    getScoreboardData() {
        return {
            playerScore: this.playerScore,
            aiScore: this.aiScore,
            scoreLimit: this.scoreLimit,
            playerKills: this.playerKills,
            playerDeaths: this.playerDeaths,
            aiKills: this.aiKills,
            aiDeaths: this.aiDeaths,
            playerKD: this.playerDeaths > 0 ? (this.playerKills / this.playerDeaths).toFixed(2) : this.playerKills.toFixed(2)
        };
    }
    // ==========================================
    // LIFECYCLE
    // ==========================================
    initialize() {
        super.initialize();
        // Reset scores
        this.playerScore = 0;
        this.aiScore = 0;
        this.playerKills = 0;
        this.playerDeaths = 0;
        this.aiKills = 0;
        this.aiDeaths = 0;
        // ✅ FIX: Track recent deaths to prevent duplicate scoring
        this.recentDeaths = new Map(); // entityId -> timestamp
        this.deathDebounceTime = 100; // 100ms window to detect duplicates
        // Set up event listeners
        this._setupEventListeners();
        Logger.info('[TeamDeathmatch] Mode initialized');
    }
    _setupEventListeners() {
        // Listen for kill events
        this.app.on('entity:died', (deathInfo)=>{
            if (!this.isActive) return;
            const victim = deathInfo.entity;
            const killer = deathInfo.killer;
            // ✅ FIX: Prevent duplicate death scoring
            if (!this._shouldProcessDeath(victim)) {
                return;
            }
            const victimIsPlayer = victim.tags?.has('player');
            const killerIsPlayer = killer?.tags?.has('player');
            if (victimIsPlayer && !killerIsPlayer) {
                // Player killed by AI
                this.onAIKill(killer, victim);
            } else if (!victimIsPlayer && killerIsPlayer) {
                // AI killed by Player
                this.onPlayerKill(killer, victim);
            }
        }, this);
    }
    /**
     * ✅ FIX: Check if death should be processed (prevents duplicate scoring)
     */ _shouldProcessDeath(entity) {
        if (!entity) return false;
        try {
            const entityId = entity.getGuid();
            const now = performance.now();
            // Check if we recently processed this entity's death
            const lastDeathTime = this.recentDeaths.get(entityId);
            if (lastDeathTime && now - lastDeathTime < this.deathDebounceTime) {
                const entityName = entity.name || entityId.substring(0, 8);
                Logger.warn(`[Deathmatch] ⚠️ Duplicate death detected for ${entityName} - ignoring (${(now - lastDeathTime).toFixed(0)}ms since last)`);
                return false;
            }
            // Record this death
            this.recentDeaths.set(entityId, now);
            // Clean up old entries (older than 1 second)
            this._cleanupRecentDeaths(now);
            return true;
        } catch (e) {
            Logger.error('[Deathmatch] Error checking death duplicate:', e);
            return true; // Process it if we can't check
        }
    }
    /**
     * ✅ FIX: Clean up old death timestamps
     */ _cleanupRecentDeaths(now) {
        for (const [entityId, timestamp] of this.recentDeaths.entries()){
            if (now - timestamp > 1000) {
                this.recentDeaths.delete(entityId);
            }
        }
    }
    start() {
        super.start();
        // Fire mode-specific start event
        this.app.fire('mode:deathmatch:started');
    }
    update(dt) {
    // Mode-specific update logic (if needed)
    }
    end(results) {
        super.end(results);
        // Cleanup event listeners
        this.app.off('entity:died', null, this);
    }
    constructor(gameManager){
        super(gameManager);
        this.modeName = "Team Deathmatch";
        this.modeDescription = "Eliminate the enemy team to score points. First to 10 kills wins!";
        this.modeId = "deathmatch";
        // Scoring
        this.playerScore = 0;
        this.aiScore = 0;
        this.scoreLimit = 10;
        // Stats
        this.playerKills = 0;
        this.playerDeaths = 0;
        this.aiKills = 0;
        this.aiDeaths = 0;
    }
}

export { TeamDeathmatchMode };
