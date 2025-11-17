import { aiConfig } from '../../config/ai.config.mjs';

/**
 * 🔄 RespawnManager - Death and Respawn System
 * 
 * Handles all death-related functionality including:
 * - Death event processing
 * - Combat/collision disabling for dead entities
 * - Entity hiding after death animations
 * - Respawn scheduling with appropriate delays
 * - Player and AI respawn orchestration
 */ class RespawnManager {
    /**
     * ✅ Set up death event listener
     */ setupDeathListener() {
        console.log('[RespawnManager] 🔧 Setting up death event listener...');
        console.log('[RespawnManager] this._onEntityDied type:', typeof this._onEntityDied);
        console.log('[RespawnManager] this._onEntityDied:', this._onEntityDied);
        this.app.on('entity:died', this._onEntityDied, this);
        console.log('[RespawnManager] ✅ Death event listener registered');
        this._log('debug', '[RespawnManager] Death event listener registered');
    }
    /**
     * ✅ Clean up death event listener
     */ cleanupDeathListener() {
        if (this.app) {
            this.app.off('entity:died', this._onEntityDied, this);
            this._log('debug', '[RespawnManager] Death event listener removed');
        }
    }
    /**
     * ✅ Handle entity death - process AI or player death
     */ _onEntityDied(deathInfo) {
        console.log('[RespawnManager] 🔥🔥🔥 _onEntityDied CALLED!', deathInfo);
        this._log('debug', '🔥 [RespawnManager] _onEntityDied called', deathInfo);
        const entity = deathInfo.entity;
        if (!entity || entity.destroyed) {
            console.log('[RespawnManager] ❌ Entity is null or destroyed, ignoring');
            return;
        }
        console.log('[RespawnManager] Entity:', entity.name, 'Tags:', Array.from(entity.tags?.list() || []));
        // Check entity type
        const isAI = entity.tags && entity.tags.has('ai');
        const hasAIScript = entity.script && entity.script.aiAgent;
        const isPlayer = entity.tags && entity.tags.has('player');
        const hasPlayerScript = entity.script && entity.script.player;
        console.log('[RespawnManager] Type check:', {
            isAI,
            hasAIScript,
            isPlayer,
            hasPlayerScript
        });
        if (isAI || hasAIScript) {
            console.log('[RespawnManager] 💀 Handling AI death');
            this._handleAIDeath(entity, deathInfo);
        } else if (isPlayer || hasPlayerScript) {
            console.log('[RespawnManager] 💀 Handling Player death');
            this._handlePlayerDeath(entity, deathInfo);
        } else {
            console.log('[RespawnManager] ⚠️ Unknown entity type - not handling');
        }
    }
    /**
     * ✅ Handle AI agent death
     */ _handleAIDeath(entity, deathInfo) {
        this._log('aiState', `[RespawnManager] 💀 AI Agent died: ${entity.name}`);
        // Track dead entity
        this.deadEntities.add(entity.getGuid());
        // Phase 1: Disable combat immediately
        this._disableDeadAgentCombat(entity);
        // Phase 2: Hide after death animation + corpse display (5 seconds)
        const DEATH_ANIMATION_AND_CORPSE_DURATION = 5000;
        this._log('debug', `[RespawnManager] ⏳ Waiting ${DEATH_ANIMATION_AND_CORPSE_DURATION}ms for death animation + corpse display`);
        setTimeout(()=>{
            this._hideDeadAgent(entity);
        }, DEATH_ANIMATION_AND_CORPSE_DURATION);
        // Schedule respawn
        this._scheduleAgentRespawn(entity, deathInfo);
    }
    /**
     * ✅ Handle player death
     */ _handlePlayerDeath(entity, deathInfo) {
        this._log('gameState', `[RespawnManager] 💀 Player died: ${entity.name}`);
        // Track dead entity
        this.deadEntities.add(entity.getGuid());
        // Reset kill streak
        if (this.app.gameManager?.gameSession?.progressionMetrics) {
            this.app.gameManager.gameSession.progressionMetrics.resetKillStreak();
        }
        // Activate cinematic death camera
        const bodyPos = entity.getPosition();
        const bodyRot = entity.getRotation();
        const playerStats = {
            killer: deathInfo.attacker,
            killerName: deathInfo.attacker?.name || 'Unknown AI',
            weapon: this._getWeaponDisplayName(deathInfo.weaponType),
            playerKills: this.app.gameManager?.gameSession?.progressionMetrics?.totalKills || 0,
            killStreak: this.app.gameManager?.gameSession?.progressionMetrics?.currentStreak || 0
        };
        if (entity.script?.deathCameraController) {
            entity.script.deathCameraController.activateDeathCamera(bodyPos, bodyRot, playerStats);
            this._log('gameState', '[RespawnManager] 🎬 Cinematic death camera activated');
        } else {
            this._log('warn', '[RespawnManager] No death camera controller - using basic death');
            this._hideDeadPlayer(entity);
        }
        // Schedule respawn
        this._schedulePlayerRespawn(entity, deathInfo);
    }
    /**
     * ✅ Disable combat/collision for dead agent
     */ _disableDeadAgentCombat(entity) {
        try {
            if (!entity || entity.destroyed) {
                this._log('warn', `[RespawnManager] Cannot disable combat - entity is ${entity ? 'destroyed' : 'null'}`);
                return;
            }
            // Disable collision
            if (entity.collision) {
                entity.collision.enabled = false;
                this._log('debug', `[RespawnManager] ✅ Disabled collision for ${entity.name}`);
            }
            // Disable AI script
            if (entity.script?.aiAgent) {
                entity.script.aiAgent.enabled = false;
                this._log('debug', `[RespawnManager] ✅ Disabled AI script for ${entity.name}`);
            }
            // Disable weapon/combat
            if (entity.script?.weaponEffects) {
                entity.script.weaponEffects.enabled = false;
                this._log('debug', `[RespawnManager] ✅ Disabled weaponEffects for ${entity.name}`);
            }
            if (entity.script?.weaponSystem) {
                entity.script.weaponSystem.enabled = false;
                this._log('debug', `[RespawnManager] ✅ Disabled weaponSystem for ${entity.name}`);
            }
        } catch (error) {
            this._log('error', `[RespawnManager] ❌ Error disabling combat: ${error.message}`);
        }
    }
    /**
     * ✅ Hide dead agent after death animation
     */ _hideDeadAgent(entity) {
        try {
            if (!entity || entity.destroyed) {
                this._log('warn', `[RespawnManager] Cannot hide agent - entity ${entity ? 'destroyed' : 'null'}`);
                return;
            }
            // Disable rendering
            if (entity.model) {
                entity.model.enabled = false;
                this._log('debug', `[RespawnManager] ✅ Disabled model rendering for ${entity.name}`);
            }
            // Disable all render components
            const renderComponents = entity.findComponents('render');
            renderComponents.forEach((render)=>{
                render.enabled = false;
            });
            // Move entity far away
            entity.setPosition(0, -1000, 0);
            this._log('debug', `[RespawnManager] ✅ Moved ${entity.name} to underground position`);
        } catch (error) {
            this._log('error', `[RespawnManager] ❌ Error hiding agent: ${error.message}`);
        }
    }
    /**
     * ✅ Hide dead player
     */ _hideDeadPlayer(entity) {
        try {
            if (!entity || entity.destroyed) return;
            // Disable rendering
            if (entity.model) {
                entity.model.enabled = false;
            }
            // Disable all render components
            const renderComponents = entity.findComponents('render');
            renderComponents.forEach((render)=>{
                render.enabled = false;
            });
            // Move underground
            entity.setPosition(0, -1000, 0);
            this._log('debug', `[RespawnManager] ✅ Hidden player: ${entity.name}`);
        } catch (error) {
            this._log('error', `[RespawnManager] ❌ Error hiding player: ${error.message}`);
        }
    }
    /**
     * ✅ Schedule AI agent respawn
     */ _scheduleAgentRespawn(entity, deathInfo) {
        const RESPAWN_DELAY = aiConfig.session.RESPAWN_DELAY || 5000;
        this._log('debug', `[RespawnManager] ⏰ Scheduling AI respawn in ${RESPAWN_DELAY}ms`);
        const timerId = setTimeout(()=>{
            this._respawnAgent(entity, deathInfo);
            this.respawnTimers.delete(entity.getGuid());
        }, RESPAWN_DELAY);
        this.respawnTimers.set(entity.getGuid(), timerId);
    }
    /**
     * ✅ Schedule player respawn
     */ _schedulePlayerRespawn(entity, deathInfo) {
        const DEATH_CAMERA_DURATION = 4200; // Full cinematic experience
        this._log('debug', `[RespawnManager] ⏰ Scheduling player respawn in ${DEATH_CAMERA_DURATION}ms`);
        const timerId = setTimeout(()=>{
            this._respawnPlayer(entity, deathInfo);
            this.respawnTimers.delete(entity.getGuid());
        }, DEATH_CAMERA_DURATION);
        this.respawnTimers.set(entity.getGuid(), timerId);
    }
    /**
     * ✅ Respawn AI agent
     */ _respawnAgent(deadEntity, deathInfo) {
        try {
            if (!deadEntity || deadEntity.destroyed) {
                this._log('warn', '[RespawnManager] Cannot respawn - entity destroyed');
                return;
            }
            this._log('aiState', `[RespawnManager] 🔄 Respawning AI: ${deadEntity.name}`);
            // Get spawn point
            const spawnPoint = this.spawnPointManager.getAISpawnPoint(0);
            if (!spawnPoint) {
                this._log('error', '[RespawnManager] ❌ No spawn point available!');
                return;
            }
            // Reset position
            const spawnPos = spawnPoint.getPosition();
            deadEntity.setPosition(spawnPos.x, spawnPos.y + 0.5, spawnPos.z);
            // Reset rotation
            const spawnRot = spawnPoint.getEulerAngles();
            deadEntity.setEulerAngles(spawnRot.x, spawnRot.y, spawnRot.z);
            // Re-enable collision
            if (deadEntity.collision) {
                deadEntity.collision.enabled = true;
            }
            // Re-enable rendering
            if (deadEntity.model) {
                deadEntity.model.enabled = true;
            }
            // Re-enable all render components
            const renderComponents = deadEntity.findComponents('render');
            renderComponents.forEach((render)=>{
                render.enabled = true;
            });
            console.log(`[RespawnManager] 🎨 Re-enabled ${renderComponents.length} render components for ${deadEntity.name}`);
            // Re-enable scripts
            if (deadEntity.script?.aiAgent) {
                deadEntity.script.aiAgent.enabled = true;
            }
            if (deadEntity.script?.weaponEffects) {
                deadEntity.script.weaponEffects.enabled = true;
            }
            if (deadEntity.script?.weaponSystem) {
                deadEntity.script.weaponSystem.enabled = true;
            }
            // ✅ CRITICAL: Restore health
            if (deadEntity.script?.healthSystem) {
                console.log(`[RespawnManager] 💊 Restoring health for ${deadEntity.name}`);
                deadEntity.script.healthSystem.resetHealth();
                this._log('aiState', `[RespawnManager] 💊 Health restored to ${deadEntity.script.healthSystem.currentHealth}`);
            } else {
                this._log('error', `[RespawnManager] ❌ No healthSystem found on ${deadEntity.name}!`);
            }
            // ✅ CRITICAL: Reset animation state - REINITIALIZE the animation controller
            if (deadEntity.script?.aiAgent?.animationController) {
                const animController = deadEntity.script.aiAgent.animationController;
                console.log(`[RespawnManager] 🎬 Resetting animation state for ${deadEntity.name}`);
                // ✅ CRITICAL FIX: The Death state has NO exit transition in the graph!
                // Since the graph is created programmatically (not from an asset),
                // we need to re-initialize the AnimationController to rebuild the entire state machine
                if (animController.animComponent) {
                    try {
                        console.log(`[RespawnManager] 🔄 Current active state: ${animController.animComponent.baseLayer?.activeStateName}`);
                        // ✅ SOLUTION: Re-initialize the AnimationController
                        // This will reload the programmatic animation graph from scratch
                        // resetting the state machine back to START → Idle
                        console.log(`[RespawnManager] 🔄 Re-initializing AnimationController to reset state machine...`);
                        const success = animController.initialize();
                        if (success) {
                            console.log(`[RespawnManager] ✅ AnimationController re-initialized - state machine reset`);
                            console.log(`[RespawnManager] 🔄 New active state: ${animController.animComponent.baseLayer?.activeStateName}`);
                        } else {
                            console.warn(`[RespawnManager] ⚠️ AnimationController re-initialization failed`);
                        }
                    } catch (error) {
                        console.warn(`[RespawnManager] ⚠️ Error resetting animation:`, error);
                    }
                }
                this._log('aiState', `[RespawnManager] 🎬 Animation controller re-initialized to reset state`);
            }
            // Remove from dead tracking
            this.deadEntities.delete(deadEntity.getGuid());
            this._log('aiState', `[RespawnManager] ✅ AI respawned at ${spawnPos}`);
        } catch (error) {
            this._log('error', `[RespawnManager] ❌ Respawn error: ${error.message}`);
        }
    }
    /**
     * ✅ Respawn player
     */ _respawnPlayer(deadEntity, deathInfo) {
        try {
            if (!deadEntity || deadEntity.destroyed) {
                this._log('warn', '[RespawnManager] Cannot respawn player - entity destroyed');
                return;
            }
            this._log('gameState', `[RespawnManager] 🔄 Respawning player: ${deadEntity.name}`);
            // Deactivate death camera
            if (deadEntity.script?.deathCameraController) {
                deadEntity.script.deathCameraController.deactivateDeathCamera();
            }
            // Get spawn point
            const spawnPoint = this.spawnPointManager.getPlayerSpawnPoint();
            if (!spawnPoint) {
                this._log('error', '[RespawnManager] ❌ No player spawn point available!');
                return;
            }
            // Reset position
            const spawnPos = spawnPoint.getPosition();
            deadEntity.setPosition(spawnPos.x, spawnPos.y + 1.0, spawnPos.z);
            // Reset rotation
            const spawnRot = spawnPoint.getEulerAngles();
            deadEntity.setEulerAngles(spawnRot.x, spawnRot.y, spawnRot.z);
            // ✅ CRITICAL FIX: Call player.respawn() method instead of manually resetting!
            // The player script handles all respawn logic including:
            // - Re-enabling collision
            // - Re-enabling rendering
            // - Resetting health via event 'health:request:reset'
            // - Resetting weapons via event 'weapon:request:reset' (fixes weapon not firing!)
            // - Resetting character controller
            // - Resetting input systems
            // - Syncing YUKA entity
            if (deadEntity.script?.player) {
                console.log(`[RespawnManager] � Calling player.respawn() to restore all systems...`);
                deadEntity.script.player.respawn();
                this._log('gameState', `[RespawnManager] ✅ Player.respawn() executed - all systems restored`);
            } else {
                this._log('error', `[RespawnManager] ❌ No player script found on ${deadEntity.name}!`);
                return;
            }
            // Remove from dead tracking
            this.deadEntities.delete(deadEntity.getGuid());
            this._log('gameState', `[RespawnManager] ✅ Player respawned at ${spawnPos}`);
        } catch (error) {
            this._log('error', `[RespawnManager] ❌ Player respawn error: ${error.message}`);
        }
    }
    /**
     * ✅ Get weapon display name
     */ _getWeaponDisplayName(weaponType) {
        const weaponNames = {
            'pistol': 'Pistol',
            'machinegun': 'Machine Gun',
            'shotgun': 'Shotgun'
        };
        return weaponNames[weaponType] || weaponType || 'Unknown Weapon';
    }
    /**
     * ✅ Cleanup all timers
     */ cleanup() {
        // Clear all respawn timers
        for (const timerId of this.respawnTimers.values()){
            clearTimeout(timerId);
        }
        this.respawnTimers.clear();
        this.deadEntities.clear();
        this.cleanupDeathListener();
    }
    constructor(app, gameManager, logFunction, agentSpawner, spawnPointManager){
        this.app = app;
        this.gameManager = gameManager;
        this.agentSpawner = agentSpawner;
        this.spawnPointManager = spawnPointManager;
        // Dead entities tracking
        this.deadEntities = new Set();
        // Respawn tracking
        this.respawnTimers = new Map();
        this._log = logFunction;
        // ✅ CRITICAL FIX: Bind event handler to preserve 'this' context
        this._onEntityDied = this._onEntityDied.bind(this);
    }
}

export { RespawnManager };
