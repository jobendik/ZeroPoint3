/**
 * AI Goal Debugger - Visual Debug Panel for Goal-Driven AI
 * 
 * Displays real-time information about AI agent goals and decision-making:
 * - Active goal and sub-goals
 * - Goal evaluator desirability scores (all 5 evaluators)
 * - State machine current state
 * - Goal/State conflicts detection
 * - Performance metrics
 * 
 * Usage: Attach to a ScreenSpace entity
 */

var AIGoalDebugger = pc.createScript('aiGoalDebugger');

// Script attributes
AIGoalDebugger.attributes.add('showDebugger', {
    type: 'boolean',
    default: true,
    title: 'Enable Debug Display'
});

AIGoalDebugger.attributes.add('updateRate', {
    type: 'number',
    default: 0.2,
    min: 0.1,
    max: 20.0,
    title: 'Update Rate (seconds)'
});

AIGoalDebugger.attributes.add('showAllAgents', {
    type: 'boolean',
    default: false,
    title: 'Show All Agents'
});

AIGoalDebugger.attributes.add('maxAgentsDisplay', {
    type: 'number',
    default: 3,
    min: 1,
    max: 10,
    title: 'Max Agents Display'
});

AIGoalDebugger.attributes.add('showDesirabilityScores', {
    type: 'boolean',
    default: true,
    title: 'Show Desirability Scores'
});

AIGoalDebugger.attributes.add('detectConflicts', {
    type: 'boolean',
    default: true,
    title: 'Detect Conflicts'
});

// Initialize
AIGoalDebugger.prototype.initialize = function() {
    console.log('[AIGoalDebugger] Initializing goal visualization system...');
    
    // State tracking
    this._agents = [];
    this._lastUpdate = 0;
    this._frameCount = 0;
    this._overlay = null;
    this._content = null;
    
    // Create HTML overlay
    this._createHTMLOverlay();
    
    console.log('[AIGoalDebugger] ✅ Goal debugger ready');
};

AIGoalDebugger.prototype._createHTMLOverlay = function() {
    // Create HTML overlay for better text rendering
        this._overlay = document.createElement('div');
        this._overlay.id = 'ai-goal-debugger-overlay';
        this._overlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            width: 450px;
            max-height: 90vh;
            background: rgba(0, 0, 0, 0.85);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 15px;
            border: 2px solid #00ff00;
            border-radius: 8px;
            z-index: 10000;
            overflow-y: auto;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
            pointer-events: none;
        `;
        
        document.body.appendChild(this._overlay);
        
        // Add title
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            color: #ffff00;
            border-bottom: 2px solid #00ff00;
            padding-bottom: 5px;
            margin-bottom: 10px;
            text-align: center;
        `;
        title.textContent = '🎯 AI GOAL SYSTEM DEBUGGER';
        this._overlay.appendChild(title);
        
        // Add content container
        this._content = document.createElement('div');
        this._content.id = 'goal-debugger-content';
        this._overlay.appendChild(this._content);
        
        // Add keyboard shortcut hint
        const hint = document.createElement('div');
        hint.style.cssText = `
            font-size: 10px;
            color: #888;
            margin-top: 10px;
            text-align: center;
            border-top: 1px solid #444;
            padding-top: 5px;
        `;
        hint.textContent = 'Press [G] to toggle visibility';
        this._overlay.appendChild(hint);
        
        // Keyboard toggle
        this._setupKeyboardToggle();
    };
    
    AIGoalDebugger.prototype._setupKeyboardToggle = function() {
        var self = this;
        window.addEventListener('keydown', function(e) {
            if (e.key === 'g' || e.key === 'G') {
                self._overlay.style.display = self._overlay.style.display === 'none' ? 'block' : 'none';
            }
        });
    };
    
    AIGoalDebugger.prototype.update = function(dt) {
        if (!this.showDebugger) return;
        
        this._lastUpdate += dt;
        this._frameCount++;
        
        if (this._lastUpdate >= this.updateRate) {
            this._updateDebugDisplay();
            this._lastUpdate = 0;
        }
    };
    
    AIGoalDebugger.prototype._updateDebugDisplay = function() {
        // Find all AI agents
        this._findAgents();
        
        if (this._agents.length === 0) {
            this._content.innerHTML = '<div style="color: #ff6600;">⚠ No AI agents found in scene</div>';
            return;
        }
        
        // Build debug output
        let html = '';
        
        // System overview
        html += this._buildSystemOverview();
        
        // Agent details
        const agentsToShow = this.showAllAgents ? this._agents : this._agents.slice(0, this.maxAgentsDisplay);
        
        for (const agent of agentsToShow) {
            html += this._buildAgentDebugInfo(agent);
        }
        
        this._content.innerHTML = html;
    };
    
    AIGoalDebugger.prototype._findAgents = function() {
        this._agents = [];
        
        // Method 1: Find by 'enemy' tag (primary method)
        var taggedEntities = this.app.root.findByTag('enemy');
        if (taggedEntities && taggedEntities.length > 0) {
            for (var i = 0; i < taggedEntities.length; i++) {
                var entity = taggedEntities[i];
                if (entity.script && entity.script.aiAgent && entity.enabled) {
                    this._agents.push(entity.script.aiAgent);
                }
            }
        }
        
        // Method 2: If no tagged enemies found, search all entities with script component
        if (this._agents.length === 0) {
            var allEntities = [];
            var self = this;
            
            var traverse = function(entity) {
                allEntities.push(entity);
                for (var j = 0; j < entity.children.length; j++) {
                    traverse(entity.children[j]);
                }
            };
            
            traverse(this.app.root);
            
            for (var k = 0; k < allEntities.length; k++) {
                var entity = allEntities[k];
                if (entity.script && entity.script.aiAgent && entity.enabled) {
                    this._agents.push(entity.script.aiAgent);
                }
            }
        }
    };
    
    AIGoalDebugger.prototype._buildSystemOverview = function() {
        const activeAgents = this._agents.length;
        const fps = Math.round(1 / this.app.dt);
        
        // Check if Goal-State Adapter is active
        let adapterActive = false;
        if (this._agents.length > 0) {
            const firstAgent = this._agents[0];
            // Fixed: property is 'agentBehavior' not 'behavior'
            adapterActive = firstAgent.agentBehavior?.goalStateAdapter ? true : false;
        }
        
        return `
            <div style="background: rgba(0, 100, 0, 0.3); padding: 8px; margin-bottom: 10px; border-left: 3px solid #00ff00;">
                <div style="color: #ffff00;">📊 SYSTEM STATUS</div>
                <div style="margin-top: 5px;">
                    Active Agents: <span style="color: #00ffff;">${activeAgents}</span> | 
                    FPS: <span style="color: ${fps < 30 ? '#ff0000' : '#00ff00'}">${fps}</span>
                </div>
                <div style="margin-top: 3px; color: ${adapterActive ? '#00ff00' : '#ffaa00'};">
                    🔗 Goal-State Adapter: <span style="font-weight: bold;">${adapterActive ? 'ACTIVE ✓' : 'DISABLED'}</span>
                </div>
                ${adapterActive ? '<div style="color: #aaaaaa; font-size: 10px; margin-top: 2px;">State Machine responds to Goal System</div>' : ''}
            </div>
        `;
    };
    
    AIGoalDebugger.prototype._buildAgentDebugInfo = function(agent) {
        var name = agent.entity.name;
        
        // Enhanced health detection - try multiple methods
        var healthSystem = null;
        var currentHealth = 0;
        var maxHealth = 100;
        var entity = agent.entity;
        
        // Try to find health system
        if (entity.script && entity.script.healthSystem) {
            healthSystem = entity.script.healthSystem;
        } else if (entity.script && entity.script.health) {
            healthSystem = entity.script.health;
        } else if (entity.findScript) {
            healthSystem = entity.findScript('healthSystem') || entity.findScript('health');
        }
        
        // Extract health values
        if (healthSystem) {
            currentHealth = healthSystem.currentHealth !== undefined ? healthSystem.currentHealth : (healthSystem.health || 0);
            maxHealth = healthSystem.maxHealth !== undefined ? healthSystem.maxHealth : (healthSystem.max || 100);
        }
        
        // Calculate percentage (avoid division by zero)
        var health = maxHealth > 0 ? Math.round((currentHealth / maxHealth) * 100) : 0;
        var healthColor = health > 60 ? '#00ff00' : health > 30 ? '#ffaa00' : '#ff0000';
        
        // Get current goal - use YUKA Think's currentSubgoal() method
        var brain = agent.agentBehavior && agent.agentBehavior.brain ? agent.agentBehavior.brain : agent.brain;
        var currentGoal = null;
        
        if (brain) {
            // YUKA Think provides currentSubgoal() method
            if (typeof brain.currentSubgoal === 'function') {
                currentGoal = brain.currentSubgoal();
            }
            // Fallback: check subgoals array directly
            else if (brain.subgoals && brain.subgoals.length > 0) {
                currentGoal = brain.subgoals[0];
            }
        }
        
        var goalName = this._getGoalName(currentGoal);
        var goalStatus = this._getGoalStatus(currentGoal);
        
        // Get state machine info
        var stateMachine = agent.agentBehavior && agent.agentBehavior._stateMachine ? agent.agentBehavior._stateMachine : null;
        var currentState = 'none';
        if (stateMachine && stateMachine.currentState) {
            var stateName = stateMachine.currentState.constructor ? stateMachine.currentState.constructor.name : '';
            currentState = stateName.replace('State', '') || 'none';
        }
        
        // Detect conflicts
        var conflict = this.detectConflicts ? this._detectConflict(goalName, currentState) : null;
        
        // Get personality info
        var personalityInfo = null;
        if (agent.personalitySystem || (agent.agentBehavior && agent.agentBehavior.personalitySystem)) {
            var personality = agent.personalitySystem || agent.agentBehavior.personalitySystem;
            personalityInfo = {
                archetype: personality.archetype ? personality.archetype.name : 'Unknown',
                aggression: personality.aggression !== undefined ? Math.round(personality.aggression * 100) : 50,
                caution: personality.caution !== undefined ? Math.round(personality.caution * 100) : 50,
                fleeThreshold: personality.fleeThreshold !== undefined ? Math.round(personality.fleeThreshold * 100) : 30
            };
        }
        
        var html = `
            <div style="background: rgba(20, 20, 40, 0.8); padding: 10px; margin-bottom: 10px; border-left: 4px solid ${healthColor}; border-radius: 4px;">
                <div style="font-weight: bold; color: #ffffff; margin-bottom: 5px;">
                    🤖 ${name} 
                    <span style="color: ${healthColor}; font-size: 11px;">[${health}% HP]</span>
                    ${personalityInfo ? `<span style="color: #aaaaff; font-size: 10px; margin-left: 10px;">🎭 ${personalityInfo.archetype}</span>` : ''}
                </div>
        `;
        
        // Goal information
        html += `
                <div style="margin-left: 10px; margin-top: 5px;">
                    <div style="color: #00ffff;">
                        🎯 Goal: <span style="color: #ffff00; font-weight: bold;">${goalName}</span>
                        <span style="color: #888; font-size: 10px;">[${goalStatus}]</span>
                    </div>
        `;
        
        // State machine
        html += `
                    <div style="color: #00ffff; margin-top: 3px;">
                        🔄 State: <span style="color: #00ff00;">${currentState}</span>
                    </div>
        `;
        
        // Personality stats (if available)
        if (personalityInfo) {
            var aggrColor = personalityInfo.aggression > 70 ? '#ff4444' : personalityInfo.aggression > 50 ? '#ffaa44' : '#44ff44';
            var cautionColor = personalityInfo.caution > 70 ? '#44ff44' : personalityInfo.caution > 50 ? '#ffaa44' : '#ff4444';
            
            html += `
                    <div style="margin-top: 5px; padding: 4px; background: rgba(0, 0, 0, 0.3); border-radius: 3px;">
                        <div style="color: #aaaaaa; font-size: 9px;">PERSONALITY:</div>
                        <div style="font-size: 10px; margin-top: 2px;">
                            <span style="color: ${aggrColor};">⚔️ ${personalityInfo.aggression}%</span> | 
                            <span style="color: ${cautionColor};">🛡️ ${personalityInfo.caution}%</span> | 
                            <span style="color: #aaaaff;">💔 ${personalityInfo.fleeThreshold}%</span>
                        </div>
                    </div>
            `;
        }
        
        // Conflict warning
        if (conflict) {
            html += `
                    <div style="color: #ff0000; margin-top: 5px; background: rgba(255, 0, 0, 0.2); padding: 3px; border-radius: 3px;">
                        ⚠ CONFLICT: ${conflict}
                    </div>
            `;
        }
        
        // Desirability scores
        if (this.showDesirabilityScores && brain) {
            html += this._buildDesirabilityScores(agent, brain);
        }
        
        // Sub-goals
        if (currentGoal && currentGoal.subgoals && currentGoal.subgoals.length > 0) {
            html += `
                    <div style="margin-top: 5px; color: #aaaaff; font-size: 11px;">
                        └─ Subgoals: ${currentGoal.subgoals.length} active
                    </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    };
    
    AIGoalDebugger.prototype._buildDesirabilityScores = function(agent, brain) {
        var evaluators = brain.evaluators || [];
        if (evaluators.length === 0) return '';
        
        var html = `
                    <div style="margin-top: 8px; padding: 5px; background: rgba(0, 0, 0, 0.4); border-radius: 3px;">
                        <div style="color: #aaaaaa; font-size: 10px; margin-bottom: 3px;">EVALUATOR DESIRABILITY:</div>
        `;
        
        // Calculate desirability for each evaluator
        var scores = [];
        for (var i = 0; i < evaluators.length; i++) {
            var evaluator = evaluators[i];
            var name = this._getEvaluatorName(evaluator);
            var desirability = 0;
            
            try {
                // Get the vehicle from agentCore if available, otherwise use agent directly
                var owner = agent.agentCore && agent.agentCore.getVehicle ? agent.agentCore.getVehicle() : agent;
                if (evaluator.calculateDesirability) {
                    desirability = evaluator.calculateDesirability(owner) || 0;
                }
            } catch (e) {
                desirability = 0;
            }
            
            scores.push({ name: name, desirability: desirability });
        }
        
        // Sort by desirability (highest first)
        scores.sort(function(a, b) { return b.desirability - a.desirability; });
        
        // Display scores with bars
        for (var j = 0; j < scores.length; j++) {
            var score = scores[j];
            var percentage = Math.round(score.desirability * 100);
            var barWidth = Math.round(score.desirability * 100);
            var barColor = score.desirability > 0.7 ? '#00ff00' : score.desirability > 0.4 ? '#ffaa00' : '#666666';
            
            html += `
                        <div style="margin-bottom: 2px;">
                            <span style="color: #cccccc; font-size: 10px; display: inline-block; width: 80px;">${score.name}:</span>
                            <span style="display: inline-block; width: 100px; height: 8px; background: #222; border: 1px solid #444; position: relative; vertical-align: middle;">
                                <span style="display: block; height: 100%; width: ${barWidth}%; background: ${barColor};"></span>
                            </span>
                            <span style="color: ${barColor}; font-size: 10px; margin-left: 5px;">${percentage}%</span>
                        </div>
            `;
        }
        
        html += `
                    </div>
        `;
        
        return html;
    };
    
    AIGoalDebugger.prototype._getGoalName = function(goal) {
        if (!goal) return 'None';
        
        var goalName = 'Unknown';
        
        // Try constructor name first
        if (goal.constructor && goal.constructor.name && goal.constructor.name !== 'Function' && goal.constructor.name !== 'Object') {
            goalName = goal.constructor.name;
        }
        // Try goal's own name property
        else if (goal.name && typeof goal.name === 'string') {
            goalName = goal.name;
        }
        // Check if it's a CompositeGoal with subgoals
        else if (goal.subgoals && goal.subgoals.length > 0) {
            var firstSubgoal = goal.subgoals[0];
            if (firstSubgoal.constructor && firstSubgoal.constructor.name) {
                goalName = firstSubgoal.constructor.name;
            }
        }
        // Last resort: check goal type
        else if (goal.goalType) {
            goalName = goal.goalType;
        }
        else if (typeof goal === 'string') {
            goalName = goal;
        }
        
        // Debug logging to see what we're getting
        if (goalName === 'Unknown' || goalName === 'Object' || goalName === 'Function') {
            console.log('[AIGoalDebugger] Goal detection debug:', {
                hasConstructor: !!goal.constructor,
                constructorName: goal.constructor ? goal.constructor.name : 'none',
                hasName: !!goal.name,
                goalName: goal.name,
                hasSubgoals: goal.subgoals && goal.subgoals.length > 0,
                hasGoalType: !!goal.goalType,
                goalKeys: Object.keys(goal).join(', ')
            });
        }
        
        // Clean up name
        return goalName
            .replace('Enhanced', '')
            .replace('Goal', '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
    };
    
    AIGoalDebugger.prototype._getGoalStatus = function(goal) {
        if (!goal) return 'N/A';
        
        var status = goal.status;
        
        // Map YUKA status codes (both numeric and string versions)
        if (status === 0 || status === 'inactive') return 'INACTIVE';
        if (status === 1 || status === 'active') return 'ACTIVE';
        if (status === 2 || status === 'completed') return 'COMPLETED';
        if (status === 3 || status === 'failed') return 'FAILED';
        
        // Debug log to see what we're getting
        if (status !== undefined) {
            console.log('[AIGoalDebugger] Unknown status:', status, typeof status);
        }
        
        return status !== undefined ? 'STATUS:' + status : 'UNKNOWN';
    };
    
    AIGoalDebugger.prototype._getEvaluatorName = function(evaluator) {
        const name = evaluator.constructor?.name || 'Unknown';
        
        return name
            .replace('Enhanced', '')
            .replace('Evaluator', '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
    };
    
    AIGoalDebugger.prototype._detectConflict = function(goalName, stateName) {
        // Detect common goal/state conflicts
        
        // Case 1: State Machine wants combat, but Goal system wants something else
        if (stateName === 'combat' && !goalName.toLowerCase().includes('attack')) {
            return `State=${stateName} but Goal=${goalName} (should be Attack)`;
        }
        
        // Case 2: State Machine wants patrol, but Goal system is doing combat
        if (stateName === 'patrol' && goalName.toLowerCase().includes('attack')) {
            return `State=${stateName} but Goal=${goalName} (combat goal active during patrol)`;
        }
        
        // Case 3: State Machine wants seekHealth, but Goal system disagrees
        if (stateName === 'seekHealth' && !goalName.toLowerCase().includes('health')) {
            return `State=${stateName} but Goal=${goalName} (should be Get Health)`;
        }
        
        // Case 4: State Machine wants seekAmmo, but Goal system disagrees
        if (stateName === 'seekAmmo' && !goalName.toLowerCase().includes('ammo')) {
            return `State=${stateName} but Goal=${goalName} (should be Get Ammo)`;
        }
        
        return null;
    };
    
    AIGoalDebugger.prototype.destroy = function() {
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
    };
