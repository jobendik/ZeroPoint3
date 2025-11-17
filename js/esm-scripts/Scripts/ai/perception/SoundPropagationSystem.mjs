import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class SoundPropagationSystem {
    /**
     * Initialize sound detection listeners
     */ initialize() {
        if (this._eventsBound) {
            Logger.debug('[SoundPropagationSystem] Already initialized');
            return;
        }
        // Listen for sound:detected events from various sources
        this.app.on('sound:detected', this._onSoundDetected, this);
        this._eventsBound = true;
        Logger.info('[SoundPropagationSystem] Event listeners bound');
    }
    /**
     * Handle sound detection event
     * @param {Object} soundData - Sound event data
     * @param {pc.Vec3} soundData.position - Where the sound originated
     * @param {string} soundData.soundType - Type of sound (gunshot, explosion, footsteps)
     * @param {number} soundData.intensity - Sound intensity (0-1)
     * @param {number} soundData.range - Maximum hearing range in meters
     * @param {pc.Entity} soundData.source - Entity that made the sound
     */ _onSoundDetected(soundData) {
        const { position, soundType, intensity, range, source } = soundData;
        if (!position || !soundType) {
            Logger.warn('[SoundPropagationSystem] Invalid sound data:', soundData);
            return;
        }
        Logger.debug(`[SoundPropagationSystem] Sound detected: ${soundType} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}), range=${range}m`);
        // Find all AI agents in the scene
        const aiAgents = this._findAIAgents();
        if (aiAgents.length === 0) {
            Logger.debug('[SoundPropagationSystem] No AI agents found in scene');
            return;
        }
        // Notify each agent within hearing range
        let notifiedCount = 0;
        for (const agent of aiAgents){
            // Skip the source entity (don't hear your own gunshot)
            if (source && agent.entity.getGuid() === source.getGuid()) {
                continue;
            }
            // Check if agent is within hearing range
            const agentPos = agent.entity.getPosition();
            const distance = position.distance(agentPos);
            if (distance <= range) {
                // Calculate how much of the sound reaches this agent
                const distanceFactor = aiConfig.sound.DISTANCE_FACTOR_BASE - distance / range;
                const effectiveIntensity = intensity * distanceFactor;
                // Notify agent's event handler
                this._notifyAgent(agent, {
                    position: position.clone(),
                    soundType,
                    intensity: effectiveIntensity,
                    distance,
                    source
                });
                notifiedCount++;
            }
        }
        if (notifiedCount > 0) {
            Logger.info(`[SoundPropagationSystem] Notified ${notifiedCount} AI agent(s) about ${soundType}`);
        }
    }
    /**
     * Find all AI agents in the scene
     * @returns {Array} Array of aiAgent script instances
     */ _findAIAgents() {
        const agents = [];
        // Find all entities with aiAgent script
        const allEntities = this.app.root.findByTag('ai') || [];
        for (const entity of allEntities){
            const aiAgent = entity.script?.aiAgent;
            if (aiAgent && aiAgent.enabled) {
                agents.push(aiAgent);
            }
        }
        return agents;
    }
    /**
     * Notify a specific AI agent about a detected sound
     * @param {Object} agent - aiAgent script instance
     * @param {Object} soundInfo - Sound information
     */ _notifyAgent(agent, soundInfo) {
        // Check if agent has event handler
        const eventHandler = agent.agentBehavior?.eventHandler;
        if (!eventHandler) {
            Logger.warn(`[SoundPropagationSystem] Agent ${agent.entity.name} has no eventHandler`);
            return;
        }
        // Check if event handler has onSoundDetected method
        if (typeof eventHandler.onSoundDetected !== 'function') {
            Logger.warn(`[SoundPropagationSystem] Agent ${agent.entity.name} eventHandler missing onSoundDetected()`);
            return;
        }
        // Call the agent's sound detection handler
        Logger.debug(`[SoundPropagationSystem] Notifying ${agent.entity.name} about ${soundInfo.soundType} (distance: ${soundInfo.distance.toFixed(1)}m, intensity: ${soundInfo.intensity.toFixed(2)})`);
        eventHandler.onSoundDetected(soundInfo);
    }
    /**
     * Clean up event listeners
     */ destroy() {
        if (this._eventsBound) {
            this.app.off('sound:detected', this._onSoundDetected, this);
            this._eventsBound = false;
        }
        Logger.info('[SoundPropagationSystem] Destroyed');
    }
    constructor(app){
        this.app = app;
        this._eventsBound = false;
        Logger.info('[SoundPropagationSystem] Initialized');
    }
}

export { SoundPropagationSystem };
