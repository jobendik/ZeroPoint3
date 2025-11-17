import { Script } from '../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * YUKA EntityManager Service - FIXED Player Registration
 * 
 * CRITICAL FIXES:
 * 1. Multiple fallback methods to register player
 * 2. Automatic player detection if event is missed
 * 3. Creates YUKA entity for player if missing
 * 4. Comprehensive diagnostics
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
/* global Logger */ class EntityManagerService extends Script {
    initialize() {
        const app = this.app;
        // Use existing EntityManager or create new one
        app.navigation = app.navigation || {};
        if (!app.navigation.entityManager) {
            app.navigation.entityManager = new YUKA.EntityManager();
            Logger.info('[EntityManagerService] Created new YUKA EntityManager');
        } else {
            Logger.info('[EntityManagerService] Using existing YUKA EntityManager');
        }
        const entityManager = app.navigation.entityManager;
        // Track registered entities for syncing
        this.registeredEntities = new Map(); // YUKA entity -> PlayCanvas entity
        // Player tracking
        this.playerRegistered = false;
        this.playerRegistrationAttempts = 0;
        this.maxPlayerRegistrationAttempts = 10;
        Logger.info('[EntityManagerService] YUKA EntityManager created');
        // Listen for agent registration events
        app.on('ai:agent:spawned', this._onAgentSpawned, this);
        app.on('ai:agent:destroyed', this._onAgentDestroyed, this);
        // ðŸ”¥ NEW: Multiple player registration methods
        app.on('player:ready', this._onPlayerReady, this);
        app.on('player:spawned', this._onPlayerReady, this); // Alternative event
        app.on('player:initialized', this._onPlayerReady, this); // Another alternative
        // ðŸ”¥ NEW: Fallback - try to find player after short delay
        setTimeout(()=>this._findAndRegisterPlayer(), 1000);
        setTimeout(()=>this._findAndRegisterPlayer(), 3000);
        setTimeout(()=>this._findAndRegisterPlayer(), 5000);
        // Fire ready event
        app.fire('entityManager:ready', entityManager);
        Logger.info('[EntityManagerService] EntityManager service ready');
    }
    /**
     * ðŸ”¥ NEW: Proactively find and register player if event was missed
     */ _findAndRegisterPlayer() {
        // Skip if already registered
        if (this.playerRegistered) {
            return;
        }
        this.playerRegistrationAttempts++;
        if (this.playerRegistrationAttempts > this.maxPlayerRegistrationAttempts) {
            Logger.error('[EntityManagerService] âŒ Failed to register player after max attempts');
            return;
        }
        Logger.debug(`[EntityManagerService] ðŸ” Searching for player (attempt ${this.playerRegistrationAttempts})...`);
        // Method 1: Find by tag
        let playerEntity = this.app.root.findByTag('player')[0];
        // Method 2: Find by name
        if (!playerEntity) {
            playerEntity = this.app.root.findByName('Player');
        }
        // Method 3: Find by script
        if (!playerEntity) {
            const entities = this.app.root.findComponents('script');
            for (const entity of entities){
                if (entity.script && (entity.script.player || entity.script.playerController)) {
                    playerEntity = entity;
                    break;
                }
            }
        }
        if (playerEntity) {
            Logger.info(`[EntityManagerService] âœ… Found player entity: ${playerEntity.name}`);
            this._registerPlayer(playerEntity);
        } else {
            Logger.warn(`[EntityManagerService] âš ï¸ Player entity not found (attempt ${this.playerRegistrationAttempts}/${this.maxPlayerRegistrationAttempts})`);
        }
    }
    /**
     * Handle AI agent spawned
     */ _onAgentSpawned(agentEntity) {
        const aiAgent = agentEntity.script?.aiAgent;
        if (!aiAgent) {
            Logger.warn('[EntityManagerService] Agent spawned but no aiAgent script found');
            return;
        }
        // Get the YUKA vehicle from the agent
        const vehicle = aiAgent.yukaVehicle;
        if (!vehicle) {
            Logger.warn(`[EntityManagerService] Agent ${agentEntity.name} has no YUKA vehicle`);
            return;
        }
        // ✅ CRITICAL FIX: Check if vehicle is already registered
        const entityManager = this.app.navigation?.entityManager;
        if (entityManager) {
            // Check if vehicle is already in EntityManager (it is added in agent-core.mjs)
            if (entityManager.entities.includes(vehicle)) {
                Logger.debug(`[EntityManagerService] Agent ${agentEntity.name} vehicle already in EntityManager - skipping duplicate add`);
                // Just track it in our registry
                this.registeredEntities.set(vehicle, agentEntity);
                return;
            }
            // Not registered yet, add it
            entityManager.add(vehicle);
            this.registeredEntities.set(vehicle, agentEntity);
            Logger.debug(`[EntityManagerService] Added AI agent ${agentEntity.name} to EntityManager`);
        }
    }
    /**
     * Handle AI agent destroyed
     */ _onAgentDestroyed(agentEntity) {
        const aiAgent = agentEntity.script?.aiAgent;
        if (!aiAgent) return;
        const vehicle = aiAgent.yukaVehicle;
        if (!vehicle) return;
        // Remove from EntityManager
        const entityManager = this.app.navigation?.entityManager;
        if (entityManager) {
            entityManager.remove(vehicle);
            this.registeredEntities.delete(vehicle);
            Logger.debug(`[EntityManagerService] Removed AI agent ${agentEntity.name} from EntityManager`);
        }
    }
    /**
     * Handle player ready event (any variant)
     */ _onPlayerReady(playerEntity) {
        if (this.playerRegistered) {
            Logger.debug('[EntityManagerService] Player already registered');
            return;
        }
        if (!playerEntity) {
            Logger.warn('[EntityManagerService] Player ready but no entity provided');
            return;
        }
        this._registerPlayer(playerEntity);
    }
    /**
     * ðŸ”¥ NEW: Unified player registration method
     */ _registerPlayer(playerEntity) {
        if (this.playerRegistered) {
            return; // Already done
        }
        Logger.info(`[EntityManagerService] ðŸŽ¯ Registering player: ${playerEntity.name}`);
        // Get or create YUKA entity for player
        let playerYukaEntity = null;
        // Try to get existing YUKA entity from player script
        const playerScript = playerEntity.script?.player || playerEntity.script?.playerController;
        if (playerScript?.yukaEntity) {
            playerYukaEntity = playerScript.yukaEntity;
            Logger.debug('[EntityManagerService] Using existing player yukaEntity');
        }
        // ðŸ”¥ NEW: Create YUKA entity if missing
        if (!playerYukaEntity) {
            Logger.warn('[EntityManagerService] Player has no yukaEntity - creating one!');
            playerYukaEntity = new YUKA.GameEntity();
            // Store it on player script for future reference
            if (playerScript) {
                playerScript.yukaEntity = playerYukaEntity;
            }
        }
        // âœ… CRITICAL: Configure player YUKA entity for AI perception
        playerYukaEntity.entityType = 'player';
        playerYukaEntity.playcanvasEntity = playerEntity;
        playerYukaEntity.name = 'Player';
        playerYukaEntity.boundingRadius = 1;
        // Sync current position
        const playerPos = playerEntity.getPosition();
        playerYukaEntity.position.set(playerPos.x, playerPos.y, playerPos.z);
        // âœ… CRITICAL: Sync rotation for proper forward direction
        const playerRot = playerEntity.getRotation();
        playerYukaEntity.rotation.set(playerRot.x, playerRot.y, playerRot.z, playerRot.w);
        // Calculate forward vector (PlayCanvas -Z forward to YUKA +Z forward)
        const pcForward = playerEntity.forward;
        playerYukaEntity.forward = new YUKA.Vector3(pcForward.x, pcForward.y, -pcForward.z);
        Logger.info(`[EntityManagerService] Player position: (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)})`);
        Logger.info(`[EntityManagerService] Player forward: (${playerYukaEntity.forward.x.toFixed(2)}, ${playerYukaEntity.forward.y.toFixed(2)}, ${playerYukaEntity.forward.z.toFixed(2)})`);
        // Add to EntityManager
        const entityManager = this.app.navigation?.entityManager;
        if (entityManager) {
            // Check if already registered (shouldn't happen but be safe)
            if (!entityManager.entities.includes(playerYukaEntity)) {
                entityManager.add(playerYukaEntity);
                this.registeredEntities.set(playerYukaEntity, playerEntity);
                // Store reference for easy access
                this.app.navigation.playerYukaEntity = playerYukaEntity;
                this.playerRegistered = true;
                Logger.info('[EntityManagerService] âœ… Player successfully added to YUKA EntityManager');
                Logger.info(`[EntityManagerService] ðŸ“Š EntityManager now has ${entityManager.entities.length} entities`);
                // Log all entities for debugging
                this._logAllEntities();
            } else {
                Logger.warn('[EntityManagerService] Player YUKA entity already in EntityManager');
                this.playerRegistered = true;
            }
        } else {
            Logger.error('[EntityManagerService] âŒ EntityManager not available!');
        }
    }
    /**
     * ðŸ”¥ NEW: Log all entities in EntityManager for debugging
     */ _logAllEntities() {
        const entityManager = this.app.navigation?.entityManager;
        if (!entityManager) return;
        Logger.info('[EntityManagerService] ðŸ“‹ All registered entities:');
        let index = 1;
        for (const yukaEntity of entityManager.entities){
            const name = yukaEntity.name || 'Unnamed';
            const type = yukaEntity.entityType || 'Unknown';
            const pos = yukaEntity.position;
            Logger.info(`[EntityManagerService]   ${index}. ${name} (${type}) at (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
            index++;
        }
    }
    /**
     * Update EntityManager and sync positions every frame
     * âœ… CRITICAL: This must run BEFORE VisionSystem.update() for accurate perception!
     */ update(dt) {
        const entityManager = this.app.navigation?.entityManager;
        if (!entityManager) return;
        // âœ… CRITICAL: Sync positions and rotations: PlayCanvas -> YUKA (EVERY FRAME!)
        for (const [yukaEntity, pcEntity] of this.registeredEntities){
            if (pcEntity && pcEntity.enabled && !pcEntity.destroyed) {
                // Sync position
                const pos = pcEntity.getPosition();
                yukaEntity.position.set(pos.x, pos.y, pos.z);
                // âœ… CRITICAL: Sync rotation for proper forward direction
                const rot = pcEntity.getRotation();
                yukaEntity.rotation.set(rot.x, rot.y, rot.z, rot.w);
                // Sync forward vector (convert PlayCanvas -Z forward to YUKA +Z forward)
                const fwd = pcEntity.forward;
                if (yukaEntity.forward) {
                    yukaEntity.forward.set(fwd.x, fwd.y, -fwd.z);
                }
            }
        }
        // âœ… CRITICAL: Update EntityManager (required for perception to work!)
        entityManager.update(dt);
    }
    /**
     * ðŸ”¥ NEW: Get registration status for debugging
     */ getStatus() {
        const entityManager = this.app.navigation?.entityManager;
        return {
            entityManagerExists: !!entityManager,
            totalEntities: entityManager?.entities.length || 0,
            playerRegistered: this.playerRegistered,
            registrationAttempts: this.playerRegistrationAttempts,
            registeredEntitiesCount: this.registeredEntities.size
        };
    }
    /**
     * Cleanup
     */ destroy() {
        const app = this.app;
        // Remove event listeners
        app.off('ai:agent:spawned', this._onAgentSpawned, this);
        app.off('ai:agent:destroyed', this._onAgentDestroyed, this);
        app.off('player:ready', this._onPlayerReady, this);
        app.off('player:spawned', this._onPlayerReady, this);
        app.off('player:initialized', this._onPlayerReady, this);
        // Clear EntityManager
        const entityManager = app.navigation?.entityManager;
        if (entityManager) {
            entityManager.clear();
        }
        this.registeredEntities.clear();
        Logger.info('[EntityManagerService] EntityManager service destroyed');
    }
}
_define_property(EntityManagerService, "scriptName", 'entityManagerService');

export { EntityManagerService };
