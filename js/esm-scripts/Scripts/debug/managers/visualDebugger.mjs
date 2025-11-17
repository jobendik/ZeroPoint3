import { Script } from '../../../../playcanvas-stable.min.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
 * 👁️ Visual Debugger - Essential Visual Debugging (ESM)
 * 
 * Streamlined visual debugging system integrated with new ESM architecture.
 * Provides essential UI debugging capabilities without development bloat.
 * 
 * Features:
 * - Real-time agent monitoring
 * - System health visualization  
 * - Performance metrics display
 * - Event history tracking
 * - Integration with DebugManager.mjs
 */ class VisualDebugger extends Script {
    initialize() {
        console.log('[VisualDebugger] Initializing visual debug UI...');
        // Guard against multiple initialization
        if (this.__visualDebuggerBooted) {
            console.log('[VisualDebugger] Already initialized, skipping...');
            return;
        }
        // Initialize core references
        this._initializeReferences();
        // Create debug UI
        if (this.enabled) {
            this._createDebugUI();
            this._setupEventListeners();
        }
        // Register with app for global access
        this.app.visualDebugger = this;
        this.__visualDebuggerBooted = true;
        console.log('[VisualDebugger] ✅ Visual debug UI ready');
    }
    _initializeReferences() {
        // Core system references
        this.debugManager = null;
        this.logger = null;
        this.eventBus = null;
        this.gameManager = null;
        // UI elements
        this.debugPanel = null;
        this.agentCards = new Map();
        this.eventHistory = [];
        this.maxEventHistory = 50;
        // AI decision tracking
        this.decisionLog = [];
        this.maxDecisionLog = 30;
        this.trackedAgents = new Map(); // Track last known state of each agent
        // State management
        this.isExpanded = true;
        this.activeTab = 'overview';
        // Timing
        this._lastUpdate = 0;
        this._startTime = performance.now();
        // Performance tracking
        this.performanceMetrics = {
            fps: 60,
            frameTime: 16.67,
            memoryUsage: 0,
            entityCount: 0,
            activeAgents: 0
        };
        // Find references
        this._findSystemReferences();
    }
    _findSystemReferences() {
        // Find debug manager
        if (this.app.debugManager) {
            this.debugManager = this.app.debugManager;
        }
        // Find logger (global utility)
        if (typeof Logger !== 'undefined') {
            this.logger = Logger;
        }
        // Find event bus
        if (this.app.eventBus) {
            this.eventBus = this.app.eventBus;
        }
        // Find game manager
        if (this.app.gameManager) {
            this.gameManager = this.app.gameManager;
        }
    }
    _createDebugUI() {
        // Create main debug panel - horizontal layout
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'visual-debugger';
        this.debugPanel.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 350px;
            background: rgba(0, 0, 0, 0.95);
            border-top: 2px solid #444;
            color: #fff;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 10px;
            z-index: 10000;
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
        `;
        // Create header (minimal, collapsible)
        this._createHeader();
        // Create content container - horizontal grid
        this.contentContainer = document.createElement('div');
        this.contentContainer.style.cssText = `
            display: grid;
            grid-template-columns: 180px 200px 1fr;
            gap: 8px;
            padding: 8px;
            height: calc(100% - 30px);
            overflow-x: hidden;
            overflow-y: auto;
        `;
        this.debugPanel.appendChild(this.contentContainer);
        // Add to DOM
        document.body.appendChild(this.debugPanel);
        // Initialize dashboard
        this._updateContent();
    }
    _createHeader() {
        const header = document.createElement('div');
        header.style.cssText = `
            background: #1a1a1a;
            padding: 4px 12px;
            border-bottom: 1px solid #555;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 30px;
        `;
        const leftSection = document.createElement('div');
        leftSection.style.cssText = 'display: flex; gap: 20px; align-items: center;';
        const title = document.createElement('span');
        title.textContent = '🧠 AI MIND DASHBOARD';
        title.style.cssText = 'font-weight: bold; font-size: 11px; color: #2196F3;';
        // Quick stats in header
        this.headerStats = document.createElement('span');
        this.headerStats.style.cssText = 'font-size: 9px; color: #888;';
        leftSection.appendChild(title);
        leftSection.appendChild(this.headerStats);
        // Toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = this.isExpanded ? '▼' : '▲';
        toggleBtn.style.cssText = `
            background: #333;
            color: #fff;
            border: none;
            border-radius: 3px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 10px;
        `;
        toggleBtn.onclick = ()=>this._toggleExpanded();
        header.appendChild(leftSection);
        header.appendChild(toggleBtn);
        this.debugPanel.appendChild(header);
        this.toggleButton = toggleBtn;
    }
    _createTabs() {
    // Removed - no tabs in horizontal layout
    }
    _toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        this.contentContainer.style.display = this.isExpanded ? 'grid' : 'none';
        this.toggleButton.textContent = this.isExpanded ? '▼' : '▲';
        if (this.isExpanded) {
            this.debugPanel.style.height = '335px';
        } else {
            this.debugPanel.style.height = '30px';
        }
    }
    _updateTabStyles() {
    // Removed - no tabs in horizontal layout
    }
    _setupEventListeners() {
        // Listen for system events if eventBus is available
        if (this.eventBus) {
            this.eventBus.on('debug:event', (data)=>{
                this._addEvent(data.type, data.message, data.level || 'info');
            }, this);
        }
        // Keyboard shortcuts
        document.addEventListener('keydown', (e)=>{
            if (e.key === 'F12' && e.ctrlKey) {
                e.preventDefault();
                this._toggleExpanded();
            }
        });
    }
    update(dt) {
        if (!this.__visualDebuggerBooted || !this.enabled || !this.isExpanded) return;
        // Update performance metrics
        this._updatePerformanceMetrics(dt);
        // Track AI decision changes
        this._trackAIDecisions();
        // Throttled UI updates
        this._lastUpdate += dt;
        if (this._lastUpdate >= this.updateInterval / 1000) {
            this._updateContent();
            this._lastUpdate = 0;
        }
    }
    _trackAIDecisions() {
        const aiAgents = this._findAllAIAgents();
        aiAgents.forEach((agent)=>{
            const agentId = agent.entity.getGuid();
            const currentState = agent.agentBehavior?._stateMachine?.currentState;
            const stateName = currentState?.constructor?.name?.replace('State', '') || 'Unknown';
            const brain = agent.agentBehavior?.brain || agent.brain;
            // 🔧 FIX: YUKA's Think stores goals in subgoals array, not currentSubgoal
            let currentGoal = 'None';
            if (brain?.subgoals && brain.subgoals.length > 0) {
                // Get the active goal (first in subgoals array)
                const goal = brain.subgoals[0];
                // Try constructor name first
                if (goal.constructor?.name && goal.constructor.name !== 'Function' && goal.constructor.name !== 'Object') {
                    currentGoal = goal.constructor.name.replace('Goal', '').replace('Enhanced', '');
                } else if (goal.name && typeof goal.name === 'string') {
                    currentGoal = goal.name.replace('Goal', '').replace('Enhanced', '');
                } else if (goal.subgoals && goal.subgoals.length > 0) {
                    const firstSubgoal = goal.subgoals[0];
                    if (firstSubgoal.constructor?.name) {
                        currentGoal = firstSubgoal.constructor.name.replace('Goal', '').replace('Enhanced', '');
                    }
                } else if (goal.goalType) {
                    currentGoal = goal.goalType;
                } else if (typeof goal === 'string') {
                    currentGoal = goal;
                } else {
                    // Generic fallback
                    currentGoal = 'Active';
                }
            }
            const weaponSystem = agent.entity.script?.weaponSystem;
            const currentWeapon = weaponSystem?.currentWeapon || 'None';
            const targetSystem = agent.agentBehavior?.targetingSystem || agent.targetSystem;
            const hasTarget = targetSystem?.hasTarget() || false;
            // Get last known state
            const lastKnown = this.trackedAgents.get(agentId);
            if (!lastKnown) {
                // First time seeing this agent
                this.trackedAgents.set(agentId, {
                    state: stateName,
                    goal: currentGoal,
                    weapon: currentWeapon,
                    hasTarget: hasTarget,
                    timestamp: Date.now()
                });
            } else {
                // Check for changes
                if (lastKnown.state !== stateName) {
                    this._logDecision(agent.entity.name, 'State Change', `${lastKnown.state} → ${stateName}`);
                    lastKnown.state = stateName;
                    lastKnown.timestamp = Date.now();
                }
                if (lastKnown.goal !== currentGoal) {
                    this._logDecision(agent.entity.name, 'Goal Change', `${lastKnown.goal} → ${currentGoal}`);
                    lastKnown.goal = currentGoal;
                    lastKnown.timestamp = Date.now();
                }
                if (lastKnown.weapon !== currentWeapon) {
                    this._logDecision(agent.entity.name, 'Weapon Switch', `${lastKnown.weapon} → ${currentWeapon}`);
                    lastKnown.weapon = currentWeapon;
                    lastKnown.timestamp = Date.now();
                }
                if (lastKnown.hasTarget !== hasTarget) {
                    const targetEntity = targetSystem?.getTargetEntity();
                    const targetName = targetEntity?.name || 'Unknown';
                    this._logDecision(agent.entity.name, hasTarget ? 'Target Acquired' : 'Target Lost', hasTarget ? targetName : 'No target');
                    lastKnown.hasTarget = hasTarget;
                    lastKnown.timestamp = Date.now();
                }
            }
        });
    }
    _logDecision(agentName, type, description) {
        const decision = {
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString(),
            agent: agentName,
            type: type,
            description: description
        };
        this.decisionLog.push(decision);
        // Keep only recent decisions
        if (this.decisionLog.length > this.maxDecisionLog) {
            this.decisionLog.shift();
        }
    }
    _updatePerformanceMetrics(dt) {
        // Simple FPS calculation
        this.performanceMetrics.fps = Math.round(1 / dt);
        this.performanceMetrics.frameTime = dt * 1000;
        // Entity count
        this.performanceMetrics.entityCount = this._countActiveEntities();
        // Memory usage (if available)
        if (window.performance && window.performance.memory) {
            this.performanceMetrics.memoryUsage = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
        }
        // Active agent count
        this.performanceMetrics.activeAgents = this._countActiveAgents();
    }
    _countActiveEntities() {
        let count = 0;
        const traverse = (entity)=>{
            if (entity.enabled) count++;
            entity.children.forEach(traverse);
        };
        traverse(this.app.root);
        return count;
    }
    _countActiveAgents() {
        let activeAgents = 0;
        const entities = this.app.root.findComponents('script');
        entities.forEach((entity)=>{
            if (entity.script && entity.script.aiAgent && entity.enabled) {
                activeAgents++;
            }
        });
        return activeAgents;
    }
    _updateContent() {
        if (!this.contentContainer) return;
        // Create horizontal dashboard layout
        this._createHorizontalDashboard();
    }
    _createHorizontalDashboard() {
        const aiAgents = this._findAllAIAgents();
        // Update header stats
        if (this.headerStats) {
            const uptime = ((performance.now() - this._startTime) / 1000).toFixed(0);
            this.headerStats.textContent = `FPS: ${this.performanceMetrics.fps} | Agents: ${aiAgents.length} | Uptime: ${uptime}s`;
        }
        // Clear container
        this.contentContainer.innerHTML = '';
        // LEFT COLUMN: System Overview + Decision Log
        const leftColumn = this._createLeftColumn(aiAgents);
        // CENTER COLUMN: AI Agents Grid
        const centerColumn = this._createCenterColumn(aiAgents);
        // RIGHT COLUMN: Selected Agent Deep Dive
        const rightColumn = this._createRightColumn(aiAgents);
        this.contentContainer.appendChild(leftColumn);
        this.contentContainer.appendChild(centerColumn);
        this.contentContainer.appendChild(rightColumn);
    }
    _createLeftColumn(aiAgents) {
        const column = document.createElement('div');
        column.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            overflow: hidden;
        `;
        // System Status Panel
        const systemPanel = document.createElement('div');
        systemPanel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #2196F3;
        `;
        const gameState = this.gameManager ? this.gameManager.getState() || 'Unknown' : 'No GM';
        systemPanel.innerHTML = `
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 4px; color: #2196F3;">⚙️ SYSTEM</div>
            <div style="font-size: 9px; line-height: 1.4;">
                <div>Game: <span style="color: #4CAF50;">${gameState}</span></div>
                <div>Memory: <span style="color: #FF9800;">${this.performanceMetrics.memoryUsage || 'N/A'} MB</span></div>
                <div>Entities: ${this.performanceMetrics.entityCount}</div>
            </div>
        `;
        // Decision Log Panel
        const logPanel = document.createElement('div');
        logPanel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #FF9800;
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        let logHTML = `<div style="font-weight: bold; font-size: 10px; margin-bottom: 4px; color: #FF9800;">📜 DECISIONS</div>`;
        logHTML += `<div style="flex: 1; overflow-y: auto; font-size: 8px; line-height: 1.3;">`;
        if (this.decisionLog.length > 0) {
            this.decisionLog.slice(-12).reverse().forEach((decision)=>{
                const color = this._getDecisionTypeColor(decision.type);
                const icon = this._getDecisionTypeIcon(decision.type);
                logHTML += `
                    <div style="margin-bottom: 3px; padding: 2px; background: #0a0a0a; border-radius: 2px;">
                        <span style="color: #666;">${decision.time.split(':')[1]}:${decision.time.split(':')[2]}</span>
                        <span style="color: #888;"> ${decision.agent.substring(0, 10)}</span><br/>
                        <span style="color: ${color};">${icon} ${decision.type}: ${decision.description}</span>
                    </div>
                `;
            });
        } else {
            logHTML += '<div style="color: #666; text-align: center; padding: 10px;">No decisions yet...</div>';
        }
        logHTML += `</div>`;
        logPanel.innerHTML = logHTML;
        column.appendChild(systemPanel);
        column.appendChild(logPanel);
        return column;
    }
    _createCenterColumn(aiAgents) {
        const column = document.createElement('div');
        column.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
            overflow-y: auto;
        `;
        if (aiAgents.length === 0) {
            column.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No AI agents active</div>';
            return column;
        }
        // Show all agents in a compact vertical list
        aiAgents.forEach((agent, index)=>{
            const card = this._createCompactAgentCard(agent, index);
            column.appendChild(card);
        });
        return column;
    }
    _createCompactAgentCard(agent, index) {
        const card = document.createElement('div');
        const entity = agent.entity;
        // Enhanced health detection - try multiple methods
        let healthSystem = null;
        let currentHealth = 0;
        let maxHealth = 100;
        // Method 1: Direct script access
        if (entity.script?.healthSystem) {
            healthSystem = entity.script.healthSystem;
        } else if (entity.script?.health) {
            healthSystem = entity.script.health;
        } else if (entity.findScript) {
            healthSystem = entity.findScript('healthSystem') || entity.findScript('health');
        }
        // Extract health values
        if (healthSystem) {
            currentHealth = healthSystem.currentHealth ?? healthSystem.health ?? 0;
            maxHealth = healthSystem.maxHealth ?? healthSystem.max ?? 100;
        }
        // Calculate percentage (avoid division by zero)
        const healthPct = maxHealth > 0 ? Math.round(currentHealth / maxHealth * 100) : 0;
        const healthColor = healthPct > 70 ? '#4CAF50' : healthPct > 30 ? '#FF9800' : '#F44336';
        // DEBUG: Log health detection for first agent periodically
        if (index === 0 && Math.random() < 0.016) {
            console.log('[VisualDebugger] Health check:', {
                entityName: entity.name,
                hasScript: !!entity.script,
                hasHealthSystem: !!healthSystem,
                currentHealth: currentHealth,
                maxHealth: maxHealth,
                healthPct: healthPct,
                allScripts: entity.script ? Object.keys(entity.script) : []
            });
        }
        const stateMachine = agent.agentBehavior?._stateMachine;
        const currentState = stateMachine?.currentState;
        const stateName = currentState?.constructor?.name?.replace('State', '') || '?';
        const brain = agent.agentBehavior?.brain || agent.brain;
        // 🔧 FIX: YUKA's Think stores goals in subgoals array, not currentSubgoal property
        let currentGoal = 'None';
        if (brain?.subgoals && brain.subgoals.length > 0) {
            const goal = brain.subgoals[0]; // First goal in array is the active goal
            // Try constructor name
            if (goal.constructor?.name && goal.constructor.name !== 'Function' && goal.constructor.name !== 'Object') {
                currentGoal = goal.constructor.name.replace('Goal', '').replace('Enhanced', '').substring(0, 8);
            } else if (goal.name && typeof goal.name === 'string') {
                currentGoal = goal.name.replace('Goal', '').replace('Enhanced', '').substring(0, 8);
            } else if (goal.subgoals && goal.subgoals.length > 0) {
                const firstSubgoal = goal.subgoals[0];
                if (firstSubgoal.constructor?.name) {
                    currentGoal = firstSubgoal.constructor.name.replace('Goal', '').replace('Enhanced', '').substring(0, 8);
                }
            } else if (goal.goalType) {
                currentGoal = goal.goalType.substring(0, 8);
            } else if (typeof goal === 'string') {
                currentGoal = goal.substring(0, 8);
            } else {
                // Generic fallback
                currentGoal = 'Active';
            }
        }
        const targetSystem = agent.agentBehavior?.targetingSystem || agent.targetSystem;
        const hasTarget = targetSystem?.hasTarget() || false;
        const isTargetVisible = targetSystem?.isTargetVisible() || false;
        // Defensive checks - try multiple ways to access weapon
        const weaponSystem = entity.script?.weaponSystem || entity.script?.weapon || entity.findScript('weaponSystem');
        weaponSystem?.currentWeapon || 'None';
        // Get weapon info from the proper method (with extra safety check)
        let weaponInfo = null;
        try {
            weaponInfo = weaponSystem?.getWeaponInfo && weaponSystem?.weaponCore ? weaponSystem.getWeaponInfo() : null;
        } catch (e) {
            console.warn('[VisualDebugger] Could not get weapon info:', e.message);
        }
        const magazineAmmo = weaponInfo?.currentMagazine ?? 0;
        const isReloading = weaponSystem?.isReloading || false;
        const combatCore = agent.combatCore;
        const canEngage = combatCore?.canEngageInCombat() || false;
        ((agent.alertness || 0) * 100).toFixed(0);
        const isSelected = this.selectedAgentIndex === index;
        card.style.cssText = `
            background: ${isSelected ? '#252525' : '#1a1a1a'};
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid ${isSelected ? '#9C27B0' : healthColor};
            cursor: pointer;
            transition: background 0.2s;
        `;
        card.onmouseenter = ()=>{
            if (!isSelected) card.style.background = '#222';
        };
        card.onmouseleave = ()=>{
            if (!isSelected) card.style.background = '#1a1a1a';
        };
        card.onclick = ()=>{
            this.selectedAgentIndex = index;
            this._updateContent();
        };
        const targetIcon = hasTarget ? isTargetVisible ? '🔴' : '🟠' : '🟢';
        const weaponIcon = isReloading ? '🔄' : magazineAmmo > 5 ? '🔫' : '❗';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                <div style="font-weight: bold; font-size: 9px; color: #fff;">${entity.name.substring(0, 12)}</div>
                <div style="font-size: 8px; color: ${healthColor};">${healthPct}%</div>
            </div>
            
            <div style="font-size: 7px; line-height: 1.4; margin-bottom: 3px;">
                <div><span style="color: #666;">State:</span> <span style="color: ${this._getStateColor(stateName)}; font-weight: bold;">${stateName}</span></div>
                <div><span style="color: #666;">Goal:</span> <span style="color: #2196F3;">${currentGoal}</span></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 8px; margin-top: 3px;">
                <div>${targetIcon}</div>
                <div>${weaponIcon}</div>
                <div style="color: ${canEngage ? '#4CAF50' : '#F44336'};">${canEngage ? '✓' : '✗'}</div>
            </div>
        `;
        return card;
    }
    _createRightColumn(aiAgents) {
        const column = document.createElement('div');
        column.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto 1fr 1fr;
            gap: 6px;
            overflow: hidden;
        `;
        if (aiAgents.length === 0) {
            column.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">No agent selected</div>';
            return column;
        }
        // Get selected agent (default to first)
        this.selectedAgentIndex = this.selectedAgentIndex || 0;
        if (this.selectedAgentIndex >= aiAgents.length) this.selectedAgentIndex = 0;
        const agent = aiAgents[this.selectedAgentIndex];
        // Agent header (spans both columns)
        const headerPanel = document.createElement('div');
        headerPanel.style.cssText = `
            background: #1a1a1a;
            padding: 4px 6px;
            border-radius: 4px;
            border-left: 3px solid #9C27B0;
            grid-column: 1 / -1;
        `;
        headerPanel.innerHTML = `
            <div style="font-weight: bold; font-size: 10px; color: #9C27B0;">🔍 ${agent.entity.name}</div>
            <div style="font-size: 7px; color: #666;">Click agents to switch • ${aiAgents.length} total</div>
        `;
        // Goal Desirability (top left)
        const goalsPanel = this._createGoalsPanel(agent);
        // Combat Readiness (top right)
        const combatPanel = this._createCombatPanel(agent);
        // Perception (bottom left)
        const perceptionPanel = this._createPerceptionPanel(agent);
        // Emotions & Navigation (bottom right)
        const statsPanel = this._createStatsPanel(agent);
        column.appendChild(headerPanel);
        column.appendChild(goalsPanel);
        column.appendChild(combatPanel);
        column.appendChild(perceptionPanel);
        column.appendChild(statsPanel);
        return column;
    }
    _createGoalsPanel(agent) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #2196F3;
            overflow: hidden;
        `;
        let html = `<div style="font-weight: bold; font-size: 9px; margin-bottom: 4px; color: #2196F3;">🎯 GOALS</div>`;
        const brain = agent.agentBehavior?.brain || agent.brain;
        if (brain && brain.evaluators) {
            html += '<div style="font-size: 7px;">';
            brain.evaluators.slice(0, 5).forEach((evaluator)=>{
                const goalName = evaluator.constructor.name.replace('Enhanced', '').replace('Evaluator', '').replace('Get', '').substring(0, 10);
                let desirability = 0;
                try {
                    if (evaluator.calculateDesirability) {
                        const value = evaluator.calculateDesirability(agent);
                        desirability = typeof value === 'number' && !isNaN(value) ? value : 0;
                    }
                } catch (error) {
                    desirability = 0;
                }
                const barWidth = Math.max(0, Math.min(100, desirability * 100));
                const color = this._getDesirabilityColor(desirability);
                html += `
                    <div style="margin-bottom: 2px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                            <span>${goalName}</span>
                            <span style="color: ${color}; font-weight: bold;">${desirability.toFixed(2)}</span>
                        </div>
                        <div style="background: #0a0a0a; height: 2px; border-radius: 1px; overflow: hidden;">
                            <div style="background: ${color}; width: ${barWidth}%; height: 100%;"></div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div style="font-size: 8px; color: #666;">No goal data</div>';
        }
        panel.innerHTML = html;
        return panel;
    }
    _createCombatPanel(agent) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #F44336;
            overflow: hidden;
        `;
        const combatCore = agent.combatCore;
        const targetSystem = agent.agentBehavior?.targetingSystem || agent.targetSystem;
        // Defensive checks - try multiple ways to access weapon
        const entity = agent.entity;
        const weaponSystem = entity.script?.weaponSystem || entity.script?.weapon || entity.findScript('weaponSystem');
        // DEBUG: Log to console occasionally
        if (Math.random() < 0.02) {
            const weaponInfo = weaponSystem?.getWeaponInfo ? weaponSystem.getWeaponInfo() : null;
            console.log('[VisualDebugger] Weapon check:', {
                entityName: entity.name,
                hasWeaponSystem: !!weaponSystem,
                weaponInfo: weaponInfo,
                currentWeapon: weaponSystem?.currentWeapon,
                isReloading: weaponSystem?.isReloading,
                allScripts: entity.script ? Object.keys(entity.script) : []
            });
        }
        const canEngage = combatCore?.canEngageInCombat() || false;
        const hasTarget = targetSystem?.hasTarget() || false;
        const weaponReady = combatCore?.isWeaponReady() || false;
        const canFire = combatCore?.canFireNow() || false;
        const currentWeapon = weaponSystem?.currentWeapon || 'None';
        // Get weapon info from the proper method
        const weaponInfo = weaponSystem?.getWeaponInfo ? weaponSystem.getWeaponInfo() : null;
        const magazineAmmo = weaponInfo?.currentMagazine ?? 0;
        const totalAmmo = weaponInfo?.totalAmmo ?? 0;
        const isReloading = weaponSystem?.isReloading || false;
        // Ammo color coding
        const magazineCapacity = weaponSystem?.magazineCapacity || weaponSystem?.maxMagazine || 30;
        const ammoPercent = magazineAmmo / magazineCapacity;
        const ammoColor = ammoPercent > 0.5 ? '#4CAF50' : ammoPercent > 0.2 ? '#FF9800' : '#F44336';
        panel.innerHTML = `
            <div style="font-weight: bold; font-size: 9px; margin-bottom: 4px; color: #F44336;">⚔️ COMBAT</div>
            <div style="font-size: 7px; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 3px;">
                    <div>Engage: <span style="color: ${canEngage ? '#4CAF50' : '#F44336'}; font-weight: bold;">${canEngage ? 'YES' : 'NO'}</span></div>
                    <div>Target: <span style="color: ${hasTarget ? '#F44336' : '#4CAF50'}; font-weight: bold;">${hasTarget ? 'YES' : 'NO'}</span></div>
                    <div>Weapon: <span style="color: ${weaponReady ? '#4CAF50' : '#F44336'}; font-weight: bold;">${weaponReady ? 'RDY' : 'NO'}</span></div>
                    <div>Fire: <span style="color: ${canFire ? '#4CAF50' : '#F44336'}; font-weight: bold;">${canFire ? 'YES' : 'NO'}</span></div>
                </div>
                <div style="padding-top: 3px; border-top: 1px solid #333;">
                    <div style="font-size: 8px; color: #fff; font-weight: bold;">🔫 ${currentWeapon.toUpperCase()}</div>
                    <div style="margin-top: 2px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>📦 Ammo:</span>
                            <span style="color: ${ammoColor}; font-weight: bold;">${magazineAmmo}/${totalAmmo}</span>
                        </div>
                        ${isReloading ? '<div style="color: #FF9800; font-weight: bold; margin-top: 1px;">⚠️ RELOADING...</div>' : ''}
                    </div>
                </div>
            </div>
        `;
        return panel;
    }
    _createPerceptionPanel(agent) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #FF9800;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        const visionSystem = agent.agentBehavior?.visionSystem || agent.visionSystem;
        const targetSystem = agent.agentBehavior?.targetingSystem || agent.targetSystem;
        const visibleTargets = visionSystem?.visibleTargets || [];
        const memoryTargets = visionSystem?.memory?.size || 0;
        const hasTarget = targetSystem?.hasTarget() || false;
        const isTargetVisible = targetSystem?.isTargetVisible() || false;
        const targetEntity = targetSystem?.getTargetEntity();
        const targetName = targetEntity?.name || 'None';
        let html = `
            <div style="font-weight: bold; font-size: 9px; margin-bottom: 4px; color: #FF9800;">👁️ PERCEPTION</div>
            <div style="font-size: 7px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Visible:</span>
                    <span style="color: ${visibleTargets.length > 0 ? '#F44336' : '#4CAF50'}; font-weight: bold;">${visibleTargets.length} targets</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Memory:</span>
                    <span style="color: #888; font-weight: bold;">${memoryTargets} entries</span>
                </div>
                <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #333;">
                    <div style="font-size: 8px; margin-bottom: 2px;">🎯 CURRENT TARGET:</div>
                    <div style="font-size: 9px; font-weight: bold; color: ${hasTarget ? '#F44336' : '#4CAF50'}; margin-left: 8px;">
                        ${hasTarget ? targetName.toUpperCase() : 'NONE'}
                    </div>
                    ${hasTarget ? `
                        <div style="margin-left: 8px; margin-top: 2px;">
                            <span style="color: #666;">Visible:</span>
                            <span style="color: ${isTargetVisible ? '#F44336' : '#FF9800'}; font-weight: bold;">${isTargetVisible ? 'YES' : 'NO'}</span>
                        </div>
                    ` : ''}
                </div>
        `;
        if (visibleTargets.length > 0 && visibleTargets.length > 1) {
            html += `<div style="margin-top: 3px; padding-top: 3px; border-top: 1px solid #333;">`;
            html += `<div style="color: #666; margin-bottom: 1px; font-size: 7px;">Other Visible:</div>`;
            visibleTargets.slice(0, 2).forEach((target)=>{
                const targetEntity = target.target || target;
                const targetName = targetEntity.name || 'Unknown';
                html += `<div style="color: #FF9800; margin-left: 8px; font-size: 7px;">• ${targetName.substring(0, 12)}</div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
        panel.innerHTML = html;
        return panel;
    }
    _createStatsPanel(agent) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #1a1a1a;
            padding: 6px;
            border-radius: 4px;
            border-left: 3px solid #9C27B0;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        const emotionalSystem = agent.agentBehavior?.emotionalSystem || agent.emotionalSystem;
        const navReady = agent.navigationReady;
        const vehicle = agent.core?.vehicle;
        const velocity = vehicle?.velocity?.length() || 0;
        const position = agent.entity.getPosition();
        const alertness = ((agent.alertness || 0) * 100).toFixed(0);
        const morale = ((agent.morale || 1.0) * 100).toFixed(0);
        let html = `
            <div style="font-weight: bold; font-size: 9px; margin-bottom: 4px; color: #9C27B0;">📊 STATUS</div>
            <div style="font-size: 7px; line-height: 1.6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 3px;">
                    <div>Alert: <span style="color: ${alertness > 50 ? '#FF9800' : '#4CAF50'}; font-weight: bold;">${alertness}%</span></div>
                    <div>Morale: <span style="color: ${morale > 50 ? '#4CAF50' : '#F44336'}; font-weight: bold;">${morale}%</span></div>
                    <div>Nav: <span style="color: ${navReady ? '#4CAF50' : '#F44336'}; font-weight: bold;">${navReady ? 'RDY' : 'NO'}</span></div>
                    <div>Speed: <span style="color: ${velocity > 0.5 ? '#2196F3' : '#666'}; font-weight: bold;">${velocity.toFixed(1)}</span> m/s</div>
                </div>
        `;
        if (emotionalSystem) {
            const stress = (emotionalSystem.currentState?.stress || 0).toFixed(2);
            const confidence = (emotionalSystem.currentState?.confidence || 0).toFixed(2);
            const aggression = (emotionalSystem.currentState?.aggression || 0).toFixed(2);
            // Color code emotions
            const stressColor = parseFloat(stress) > 0.7 ? '#F44336' : parseFloat(stress) > 0.4 ? '#FF9800' : '#4CAF50';
            const confColor = parseFloat(confidence) > 0.6 ? '#4CAF50' : parseFloat(confidence) > 0.3 ? '#FF9800' : '#F44336';
            const aggrColor = parseFloat(aggression) > 0.7 ? '#F44336' : parseFloat(aggression) > 0.4 ? '#FF9800' : '#4CAF50';
            html += `
                <div style="padding-top: 3px; border-top: 1px solid #333; margin-bottom: 3px;">
                    <div style="color: #888; margin-bottom: 2px; font-size: 7px;">EMOTIONS:</div>
                    <div style="display: flex; justify-content: space-between; font-size: 7px;">
                        <div>😰 <span style="color: ${stressColor}; font-weight: bold;">${stress}</span></div>
                        <div>💪 <span style="color: ${confColor}; font-weight: bold;">${confidence}</span></div>
                        <div>😠 <span style="color: ${aggrColor}; font-weight: bold;">${aggression}</span></div>
                    </div>
                </div>
            `;
        }
        html += `
                <div style="padding-top: 3px; border-top: 1px solid #333; color: #555; font-size: 6px;">
                    📍 (${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)})
                </div>
            </div>
        `;
        panel.innerHTML = html;
        return panel;
    }
    _getDecisionTypeColor(type) {
        if (type.includes('State')) return '#FF9800';
        if (type.includes('Goal')) return '#2196F3';
        if (type.includes('Weapon')) return '#9C27B0';
        if (type.includes('Target Acquired')) return '#F44336';
        if (type.includes('Target Lost')) return '#4CAF50';
        return '#888';
    }
    _getDecisionTypeIcon(type) {
        if (type.includes('State')) return '🎭';
        if (type.includes('Goal')) return '🎯';
        if (type.includes('Weapon')) return '🔫';
        if (type.includes('Target Acquired')) return '⚠️';
        if (type.includes('Target Lost')) return '✅';
        return '•';
    }
    _getDesirabilityColor(value) {
        if (value >= 0.7) return '#F44336'; // High priority - red
        if (value >= 0.4) return '#FF9800'; // Medium priority - orange
        if (value >= 0.2) return '#2196F3'; // Low priority - blue
        return '#4CAF50'; // Very low - green
    }
    _findAllAIAgents() {
        const agents = [];
        const entities = this.app.root.findByTag('enemy') || [];
        entities.forEach((entity)=>{
            const agentScript = entity.script?.aiAgent;
            if (agentScript && entity.enabled) {
                agents.push(agentScript);
            }
        });
        // If no tagged enemies, search all entities
        if (agents.length === 0) {
            const allEntities = [];
            const traverse = (entity)=>{
                allEntities.push(entity);
                entity.children.forEach(traverse);
            };
            traverse(this.app.root);
            allEntities.forEach((entity)=>{
                const agentScript = entity.script?.aiAgent;
                if (agentScript && entity.enabled) {
                    agents.push(agentScript);
                }
            });
        }
        return agents;
    }
    _getStateColor(stateName) {
        const colors = {
            'Patrol': '#4CAF50',
            'Alert': '#FF9800',
            'Combat': '#F44336',
            'Investigate': '#2196F3',
            'Flee': '#9C27B0',
            'SeekHealth': '#FF5722',
            'SeekAmmo': '#FF9800',
            'Unknown': '#888'
        };
        return colors[stateName] || '#888';
    }
    _updateSystemsTab() {
    // Removed - no longer used in horizontal layout
    }
    _updatePerformanceTab() {
    // Removed - no longer used in horizontal layout
    }
    _getSystemHealthSummary() {
        if (!this.debugManager) {
            return '<div style="color: #888;">Debug Manager not available</div>';
        }
        const health = this.debugManager.getSystemHealth();
        let summary = '';
        Object.entries(health).forEach(([system, status])=>{
            const icon = status === 'healthy' ? '✅' : status === 'unhealthy' ? '❌' : '❓';
            summary += `<div>${icon} ${system}: ${status}</div>`;
        });
        return summary || '<div style="color: #888;">No health data available</div>';
    }
    _addEvent(type, message, level = 'info') {
        const event = {
            time: new Date().toLocaleTimeString(),
            type: type,
            message: message,
            level: level,
            timestamp: Date.now()
        };
        this.eventHistory.push(event);
        // Keep only recent events
        if (this.eventHistory.length > this.maxEventHistory) {
            this.eventHistory.shift();
        }
    }
    _getEventColor(level) {
        switch(level){
            case 'error':
                return '#F44336';
            case 'warn':
                return '#FF9800';
            case 'info':
                return '#2196F3';
            case 'debug':
                return '#9CA3AF';
            default:
                return '#E0E0E0';
        }
    }
    // Public API
    logEvent(type, message, level = 'info') {
        this._addEvent(type, message, level);
    }
    toggleVisibility() {
        if (this.debugPanel) {
            this.debugPanel.style.display = this.debugPanel.style.display === 'none' ? 'block' : 'none';
        }
    }
    destroy() {
        console.log('[VisualDebugger] Shutting down visual debug UI');
        // Remove event listeners
        if (this.eventBus) {
            this.eventBus.off('debug:event', null, this);
        }
        // Remove UI
        if (this.debugPanel && this.debugPanel.parentNode) {
            this.debugPanel.parentNode.removeChild(this.debugPanel);
        }
        // Clear references
        this.debugManager = null;
        this.logger = null;
        this.eventBus = null;
        this.gameManager = null;
        // Remove from app
        if (this.app.visualDebugger === this) {
            this.app.visualDebugger = null;
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Enable Visual Debug UI */ _define_property(this, "enabled", true);
        /** @attribute @type {number} @range [50, 1000] @title Update Interval (ms) */ _define_property(this, "updateInterval", 100);
        /** @attribute @type {boolean} @title Show Performance Metrics */ _define_property(this, "showPerformance", true);
        /** @attribute @type {boolean} @title Show Agent Details */ _define_property(this, "showAgents", true);
        /** @attribute @type {boolean} @title Show System Health */ _define_property(this, "showSystemHealth", true);
    }
}
_define_property(VisualDebugger, "scriptName", 'visualDebugger');

export { VisualDebugger };
