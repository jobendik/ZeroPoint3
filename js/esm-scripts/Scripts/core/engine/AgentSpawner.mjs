/**
 * AgentSpawner.mjs
 * 
 * Handles AI agent spawning logic
 * Extracted from SessionCore to improve modularity
 */ class AgentSpawner {
    /**
     * Spawn multiple AI agents
     * @param {number} count - Number of agents to spawn
     * @param {Function} getSpawnPoint - Function to get spawn point by index
     * @returns {Array} Array of spawned entities
     */ spawnAgents(count, getSpawnPoint) {
        const spawned = [];
        for(let i = 0; i < count; i++){
            this.logger('debug', `[AgentSpawner] Spawning agent ${i + 1}/${count}...`);
            const entity = this.spawnAgent(i, getSpawnPoint);
            if (entity) {
                spawned.push(entity);
            }
        }
        this.logger('aiState', `[AgentSpawner] Spawned ${spawned.length}/${count} agents`);
        return spawned;
    }
    /**
     * Spawn a single AI agent
     * @param {number} agentIndex - Index of agent being spawned
     * @param {Function} getSpawnPoint - Function to get spawn point by index
     * @returns {pc.Entity|null} Spawned entity or null if failed
     */ spawnAgent(agentIndex, getSpawnPoint) {
        console.log('[AgentSpawner] 🔥 spawnAgent() called, agentIndex:', agentIndex);
        if (!this.gameManager) {
            console.error('[AgentSpawner] ❌ GameManager is null!');
            this.logger('error', '[AgentSpawner] GameManager is null');
            return null;
        }
        const spawnPoint = getSpawnPoint(agentIndex);
        if (!spawnPoint) {
            console.error('[AgentSpawner] ❌ No spawn point for agent', agentIndex);
            this.logger('warn', `[AgentSpawner] No spawn point for agent ${agentIndex}`);
            return null;
        }
        console.log('[AgentSpawner] ✅ Spawn point found:', spawnPoint.name);
        try {
            // Get the agent template resource from GameManager
            console.log('[AgentSpawner] Getting template from gameManager...');
            const template = this.gameManager.getAgentTemplate();
            console.log('[AgentSpawner] Template result:', template);
            if (!template || !template.resource) {
                console.error('[AgentSpawner] ❌ No template resource!', {
                    hasTemplate: !!template,
                    hasResource: template?.resource
                });
                this.logger('error', `[AgentSpawner] No agent template resource available`);
                return null;
            }
            console.log('[AgentSpawner] ✅ Template resource found:', template.name);
            this.logger('debug', `[AgentSpawner] Using template resource: "${template.name}"`);
            // Instantiate a new entity from the template resource (NOT clone!)
            console.log('[AgentSpawner] Calling template.resource.instantiate()...');
            const entity = template.resource.instantiate();
            console.log('[AgentSpawner] Instantiate result:', entity);
            if (!entity) {
                console.error('[AgentSpawner] ❌ Instantiation returned null!');
                this.logger('error', `[AgentSpawner] Entity instantiation failed`);
                return null;
            }
            console.log('[AgentSpawner] ✅ Entity instantiated:', entity.name);
            this.logger('debug', `[AgentSpawner] ✅ Instantiated entity: ${entity.name}`);
            // ✅ FIX: Rename to "AIAgent" (remove number suffix added by PlayCanvas)
            entity.name = 'AIAgent';
            console.log('[AgentSpawner] ✅ Renamed entity to:', entity.name);
            // Get spawn position and rotation
            const spawnPos = spawnPoint.getPosition();
            const spawnRot = spawnPoint.getEulerAngles();
            // Position the entity at spawn point
            entity.setPosition(spawnPos);
            entity.setEulerAngles(spawnRot);
            // Add to scene (must be in scene for scripts to initialize)
            this.app.root.addChild(entity);
            console.log('[AgentSpawner] Entity tags BEFORE team assignment:', Array.from(entity.tags.list()));
            // Assign team tags
            this._assignAgentTeam(entity);
            console.log('[AgentSpawner] Entity tags AFTER team assignment:', Array.from(entity.tags.list()));
            // Keep disabled until countdown finishes
            entity.enabled = false;
            this.logger('aiState', `[AgentSpawner] ✅ Spawned AI at (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`);
            // The entity's aiAgent script will fire 'game:agent:registerRequest' 
            // when it initializes, and GameEvents will add it to gameManager.agents
            return entity;
        } catch (e) {
            this.logger('error', `[AgentSpawner] Error spawning agent: ${e.message}`);
            this.logger('error', `[AgentSpawner] Stack: ${e.stack}`);
            return null;
        }
    }
    /**
     * Assign team tags and properties to agent
     * @param {pc.Entity} entity - Agent entity
     */ _assignAgentTeam(entity) {
        try {
            entity.team = 'ai';
            if (entity.tags) {
                // Remove template tag from spawned instance
                if (entity.tags.has('ai_agent_template')) {
                    entity.tags.remove('ai_agent_template');
                }
                // Add essential tags for spawned AI agents
                if (!entity.tags.has('ai')) entity.tags.add('ai');
                if (!entity.tags.has('ai_agent')) entity.tags.add('ai_agent');
                if (!entity.tags.has('faction_ai')) entity.tags.add('faction_ai');
                if (!entity.tags.has('team_ai')) entity.tags.add('team_ai');
            }
            if (entity.script) {
                entity.script.teamIdentifier = 'ai';
                entity.script.faction = 'ai';
            }
            this.logger('aiDetail', `Assigned AI team to ${entity.name}`);
        } catch (e) {
            this.logger('warn', `Failed to set team for ${entity.name || 'agent'}:`, e);
        }
    }
    constructor(app, gameManager, logger){
        this.app = app;
        this.gameManager = gameManager;
        this.logger = logger;
    }
}

export { AgentSpawner };
