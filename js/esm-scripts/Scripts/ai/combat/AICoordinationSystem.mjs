import { Logger } from '../../core/engine/logger.mjs';

/**
 * 🤖 AI COORDINATION SYSTEM (System #6)
 * 
 * Enables squad-level tactical coordination:
 * - Aggressive agents rush and suppress
 * - Balanced agents use leapfrog tactics (cover while allies advance)
 * - Defensive agents hold positions and support
 * - Coordinated flanking maneuvers
 * - Suppressing fire to pin player
 * 
 * Makes AI feel like human team players instead of isolated bots.
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * IMPLEMENTATION STATUS (as of Nov 4, 2025)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * ✅ IMPLEMENTED (Infrastructure Complete):
 * - Singleton system created and exposed to window for debugging
 * - Agent registration/unregistration (called from aiAgent.mjs:282)
 * - Squad formation (max 4 agents per squad)
 * - Team-awareness (only coordinates agents on same team)
 * - Role assignment based on personality (Rusher, Flanker, Suppressor, Defender, Support)
 * - Squad tactics selection (aggressive, balanced, defensive)
 * - Coordination event system (fires 5 event types)
 * - Update loop integrated into game loop (1-second intervals)
 * 
 * ⚠️ NOT IMPLEMENTED (Behavior Integration Missing):
 * - AI agents DO NOT listen to coordination events:
 *   → 'ai:coordinate:advance' - no handler
 *   → 'ai:coordinate:flank' - no handler
 *   → 'ai:coordinate:suppress' - no handler
 *   → 'ai:coordinate:defend' - no handler
 *   → 'ai:coordinate:covering_fire' - no handler
 * - Events fire correctly but have no effect on agent behavior
 * - Agents act independently, not as coordinated squads
 * 
 * 🔧 FOR FULL INTEGRATION (Future Work):
 * 1. Add event listeners in AgentBehavior.mjs or AgentCore.mjs:
 *    ```javascript
 *    this.entity.on('ai:coordinate:advance', () => {
 *        // Boost attack evaluator priority
 *        // Reduce caution temporarily
 *    });
 *    this.entity.on('ai:coordinate:suppress', (data) => {
 *        // Increase fire rate, reduce movement
 *        // Focus on pinning target
 *    });
 *    // ... etc for other events
 *    ```
 * 
 * 2. Modify goal evaluators to respond to coordination state:
 *    - Check aiCoordinationSystem.isAgentAdvancing(this)
 *    - Adjust goal priorities based on role and tactic
 * 
 * 3. Test in open spaces (coordination more visible than corridors)
 * 
 * 4. Add visual debugging:
 *    - Show squad assignments above agent heads
 *    - Color-code agents by role
 *    - Display active coordination tactic
 * 
 * 📊 TESTING NOTES:
 * - Squad formation verified: 4 agents in 1 squad (team 'ai')
 * - Roles assigned correctly based on personality
 * - Events fire every second during combat
 * - System accessible via: window.aiCoordinationSystem
 * - Test commands available: showCoordination(), listSquads()
 * 
 * 💡 GAME MODE COMPATIBILITY:
 * - Team Deathmatch (default): ✅ All AI coordinate against player
 * - FFA modes (future): ✅ Team-awareness prevents cross-team coordination
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */ class AICoordinationSystem {
    /**
     * Register an AI agent for coordination
     */ registerAgent(agent) {
        if (!agent || !agent.entity) return;
        const agentId = agent.entity.getGuid();
        // 🎮 Only coordinate agents on the same team
        // In Team Deathmatch, all AI are team 'ai' and should coordinate
        // In FFA modes, agents have different teams and won't coordinate
        const team = agent.entity.team || 'ai';
        // Extract personality traits
        const personality = this._extractPersonality(agent);
        // Determine tactical role based on personality
        const role = this._assignRole(personality);
        // Store agent data
        this.agents.set(agentId, {
            agent: agent,
            entity: agent.entity,
            team: team,
            personality: personality,
            role: role,
            squadId: null,
            isSuppressing: false,
            isAdvancing: false,
            lastCoordinatedAction: 0
        });
        // Assign to squad (only with same-team agents)
        this._assignToSquad(agentId);
        Logger.debug(`[AICoordinationSystem] Registered ${agent.entity.name} (team: ${team}) as ${role}`);
    }
    /**
     * Unregister an AI agent
     */ unregisterAgent(agent) {
        if (!agent || !agent.entity) return;
        const agentId = agent.entity.getGuid();
        const agentData = this.agents.get(agentId);
        if (agentData && agentData.squadId) {
            this._removeFromSquad(agentId, agentData.squadId);
        }
        this.agents.delete(agentId);
    }
    /**
     * Extract personality traits from agent
     */ _extractPersonality(agent) {
        // Check if agent has personality system
        if (agent.personality && typeof agent.personality === 'object') {
            return {
                aggression: agent.personality.aggression || 0.5,
                caution: agent.personality.caution || 0.5,
                teamwork: agent.personality.teamwork || 0.5
            };
        }
        // Fallback to balanced personality
        return {
            aggression: 0.5,
            caution: 0.5,
            teamwork: 0.5
        };
    }
    /**
     * Assign tactical role based on personality
     */ _assignRole(personality) {
        const { aggression, caution, teamwork } = personality;
        // Aggressive = Rusher or Flanker
        if (aggression > 0.7) {
            return Math.random() > 0.5 ? this.roles.RUSHER : this.roles.FLANKER;
        }
        // Cautious = Defender or Suppressor
        if (caution > 0.7) {
            return Math.random() > 0.5 ? this.roles.DEFENDER : this.roles.SUPPRESSOR;
        }
        // High teamwork = Support
        if (teamwork > 0.7) {
            return this.roles.SUPPORT;
        }
        // Balanced = random role
        const roles = Object.values(this.roles);
        return roles[Math.floor(Math.random() * roles.length)];
    }
    /**
     * Assign agent to a squad
     */ _assignToSquad(agentId) {
        const agentData = this.agents.get(agentId);
        if (!agentData) return;
        // 🎮 Find squad with space on the same team (max 4 per squad)
        let targetSquad = null;
        for (const [squadId, squad] of this.squads){
            if (squad.members.length < 4 && squad.team === agentData.team) {
                targetSquad = squad;
                break;
            }
        }
        // Create new squad if needed
        if (!targetSquad) {
            const squadId = this.nextSquadId++;
            targetSquad = {
                id: squadId,
                team: agentData.team,
                members: [],
                leader: null,
                formation: 'spread',
                tactic: 'balanced' // aggressive, balanced, defensive
            };
            this.squads.set(squadId, targetSquad);
            Logger.debug(`[AICoordinationSystem] Created squad ${squadId} for team '${agentData.team}'`);
        }
        // Add to squad
        targetSquad.members.push(agentId);
        agentData.squadId = targetSquad.id;
        // Set leader (first member or highest aggression)
        if (!targetSquad.leader) {
            targetSquad.leader = agentId;
        }
    }
    /**
     * Remove agent from squad
     */ _removeFromSquad(agentId, squadId) {
        const squad = this.squads.get(squadId);
        if (!squad) return;
        // Remove from members
        const index = squad.members.indexOf(agentId);
        if (index > -1) {
            squad.members.splice(index, 1);
        }
        // Reassign leader if necessary
        if (squad.leader === agentId && squad.members.length > 0) {
            squad.leader = squad.members[0];
        }
        // Delete squad if empty
        if (squad.members.length === 0) {
            this.squads.delete(squadId);
        }
    }
    /**
     * Update coordination logic
     */ update(dt) {
        const now = performance.now();
        // Throttle coordination updates
        if (now - this.lastCoordinationUpdate < this.coordinationUpdateInterval) {
            return;
        }
        this.lastCoordinationUpdate = now;
        // Update each squad
        for (const [squadId, squad] of this.squads){
            this._updateSquadCoordination(squad);
        }
    }
    /**
     * Update squad-level coordination
     */ _updateSquadCoordination(squad) {
        if (squad.members.length < 2) return; // Need at least 2 for coordination
        // Get all squad member agents
        const agents = squad.members.map((id)=>this.agents.get(id)).filter((data)=>data && data.agent && !data.agent.isDead);
        if (agents.length < 2) return;
        // Check if squad is in combat
        const inCombat = agents.some((data)=>data.agent.inCombat);
        if (!inCombat) return;
        // Determine squad tactic based on combined personality
        const avgAggression = agents.reduce((sum, data)=>sum + data.personality.aggression, 0) / agents.length;
        if (avgAggression > 0.6) {
            this._coordinateAggressiveTactic(agents);
        } else if (avgAggression < 0.4) {
            this._coordinateDefensiveTactic(agents);
        } else {
            this._coordinateBalancedTactic(agents);
        }
    }
    /**
     * Coordinate aggressive tactic (rush + flank)
     */ _coordinateAggressiveTactic(agents) {
        // Find player
        const player = agents[0].agent.target;
        if (!player) return;
        // Assign roles: some rush, some flank
        agents.forEach((data, index)=>{
            const agent = data.agent;
            // Skip if recently coordinated
            const now = performance.now();
            if (now - data.lastCoordinatedAction < 5000) return;
            if (index % 2 === 0) {
                // Rusher: advance directly
                this._commandAdvance(agent, data);
            } else {
                // Flanker: circle around
                if (Math.random() < this.behaviorChance.coordinatedFlank) {
                    this._commandFlank(agent, data, player);
                }
            }
            data.lastCoordinatedAction = now;
        });
        Logger.debug('[AICoordinationSystem] Aggressive tactic coordinated');
    }
    /**
     * Coordinate defensive tactic (hold + suppress)
     */ _coordinateDefensiveTactic(agents) {
        // Find player
        const player = agents[0].agent.target;
        if (!player) return;
        agents.forEach((data, index)=>{
            const agent = data.agent;
            // Skip if recently coordinated
            const now = performance.now();
            if (now - data.lastCoordinatedAction < 5000) return;
            if (index % 2 === 0) {
                // Hold position and suppress
                if (Math.random() < this.behaviorChance.suppressiveFire) {
                    this._commandSuppress(agent, data, player);
                }
            } else {
                // Find cover and defend
                this._commandDefend(agent, data);
            }
            data.lastCoordinatedAction = now;
        });
        Logger.debug('[AICoordinationSystem] Defensive tactic coordinated');
    }
    /**
     * Coordinate balanced tactic (leapfrog)
     */ _coordinateBalancedTactic(agents) {
        // Leapfrog movement: half advance while half cover
        const now = performance.now();
        agents.forEach((data, index)=>{
            const agent = data.agent;
            // Skip if recently coordinated
            if (now - data.lastCoordinatedAction < 5000) return;
            if (Math.random() < this.behaviorChance.leapfrogAdvance) {
                if (index % 2 === 0) {
                    // Half advance
                    this._commandAdvance(agent, data);
                } else {
                    // Half provide covering fire
                    this._commandCoveringFire(agent, data);
                }
            }
            data.lastCoordinatedAction = now;
        });
        Logger.debug('[AICoordinationSystem] Balanced tactic coordinated');
    }
    /**
     * Command agent to advance
     */ _commandAdvance(agent, data) {
        data.isAdvancing = true;
        data.isSuppressing = false;
        // Fire event for agent to execute advance
        if (agent.entity && agent.entity.fire) {
            agent.entity.fire('ai:coordinate:advance');
        }
        Logger.debug(`[AICoordinationSystem] ${agent.entity.name} commanded to advance`);
    }
    /**
     * Command agent to flank
     */ _commandFlank(agent, data, player) {
        // Fire event for agent to execute flank
        if (agent.entity && agent.entity.fire) {
            agent.entity.fire('ai:coordinate:flank', {
                target: player
            });
        }
        Logger.debug(`[AICoordinationSystem] ${agent.entity.name} commanded to flank`);
    }
    /**
     * Command agent to suppress (pin player with fire)
     */ _commandSuppress(agent, data, player) {
        data.isSuppressing = true;
        data.isAdvancing = false;
        // Fire event for agent to execute suppression
        if (agent.entity && agent.entity.fire) {
            agent.entity.fire('ai:coordinate:suppress', {
                target: player
            });
        }
        Logger.debug(`[AICoordinationSystem] ${agent.entity.name} commanded to suppress`);
    }
    /**
     * Command agent to defend position
     */ _commandDefend(agent, data) {
        data.isAdvancing = false;
        data.isSuppressing = false;
        // Fire event for agent to find cover and hold
        if (agent.entity && agent.entity.fire) {
            agent.entity.fire('ai:coordinate:defend');
        }
        Logger.debug(`[AICoordinationSystem] ${agent.entity.name} commanded to defend`);
    }
    /**
     * Command agent to provide covering fire
     */ _commandCoveringFire(agent, data) {
        data.isSuppressing = true;
        // Fire event for agent to provide cover
        if (agent.entity && agent.entity.fire) {
            agent.entity.fire('ai:coordinate:covering_fire');
        }
        Logger.debug(`[AICoordinationSystem] ${agent.entity.name} providing covering fire`);
    }
    /**
     * Get agent's current coordination state
     */ getAgentState(agent) {
        if (!agent || !agent.entity) return null;
        const agentId = agent.entity.getGuid();
        return this.agents.get(agentId);
    }
    /**
     * Check if agent is suppressing
     */ isAgentSuppressing(agent) {
        const state = this.getAgentState(agent);
        return state ? state.isSuppressing : false;
    }
    /**
     * Check if agent is advancing
     */ isAgentAdvancing(agent) {
        const state = this.getAgentState(agent);
        return state ? state.isAdvancing : false;
    }
    constructor(){
        this.agents = new Map(); // agent entity → agent data
        this.squads = new Map(); // squad ID → squad data
        this.nextSquadId = 1;
        // Coordination timing
        this.lastCoordinationUpdate = 0;
        this.coordinationUpdateInterval = 1000; // ms - check coordination every second
        // Tactical roles
        this.roles = {
            RUSHER: 'rusher',
            FLANKER: 'flanker',
            SUPPRESSOR: 'suppressor',
            DEFENDER: 'defender',
            SUPPORT: 'support' // Cover allies
        };
        // Coordination behaviors
        this.behaviorChance = {
            coordinatedFlank: 0.4,
            leapfrogAdvance: 0.5,
            suppressiveFire: 0.6 // 60% chance to suppress
        };
        Logger.info('[AICoordinationSystem] Initialized');
    }
}
// Create singleton instance
const aiCoordinationSystem = new AICoordinationSystem();
// Expose to window for debugging/testing (development only)
if (typeof window !== 'undefined') {
    window.aiCoordinationSystem = aiCoordinationSystem;
    Logger.debug('[AICoordinationSystem] Exposed to window.aiCoordinationSystem for debugging');
}

export { AICoordinationSystem, aiCoordinationSystem };
