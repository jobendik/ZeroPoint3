import * as YUKA from 'yuka';
import { Logger } from '../../core/engine/logger.mjs';
import AICombatSystem from '../combat/CombatSystem.mjs';
import EnhancedTargetSystem from '../combat/TargetingSystem.mjs';
import AIVisionSystem from '../perception/VisionSystem.mjs';
import { AIEventHandler } from '../perception/EventHandler.mjs';
import '../behavior/state/StateManager.mjs';
import { EmotionalStateSystem } from '../behavior/emotional/EmotionalStateSystem.mjs';
import AIAgentUtilities from '../utils/AgentUtilities.mjs';
import { GoalStateAdapter } from '../behavior/state/GoalStateAdapter.mjs';
import { PersonalitySystem } from '../behavior/decision/PersonalitySystem.mjs';
import { AIGoalArbitrator } from '../behavior/decision/GoalArbitrator.mjs';
import { HumanAimSystem } from '../combat/HumanAimSystem.mjs';
import { CombatDecisionContext } from '../combat/CombatDecisionContext.mjs';
import { EnhancedAttackEvaluator } from '../goals/evaluators/AttackEvaluator.mjs';
import { EnhancedGetHealthEvaluator } from '../goals/evaluators/GetHealthEvaluator.mjs';
import { EnhancedGetAmmoEvaluator } from '../goals/evaluators/GetAmmoEvaluator.mjs';
import { EnhancedExploreEvaluator } from '../goals/evaluators/ExploreEvaluator.mjs';
import { EnhancedGetWeaponEvaluator } from '../goals/evaluators/GetWeaponEvaluator.mjs';
import { TakeCoverEvaluator } from '../goals/evaluators/TakeCoverEvaluator.mjs';
import { FlankEvaluator } from '../goals/evaluators/FlankEvaluator.mjs';
import { HuntEvaluator } from '../goals/evaluators/HuntEvaluator.mjs';
import { PatrolState, AlertState, CombatState, InvestigateState, FleeState, SeekHealthState, SeekAmmoState } from '../behavior/state/StateCore.mjs';
import { StateChangeManager } from '../behavior/state/StateTransition.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/* global Logger */ // ✅ REMOVED: Lazy-loaded evaluators (now using static imports)
// ✅ REMOVED: loadEvaluators() function (no longer needed with static imports)
class AgentBehavior {
    /**
     * Initialize behavior systems
     */ initialize() {
        if (this._initialized) {
            Logger.debug(`[${this.entity.name}] AgentBehavior already initialized`);
            return;
        }
        const name = this.entity.name;
        Logger.debug(`[${name}] Initializing behavior systems...`);
        // Initialize converted ESM systems
        try {
            this.visionSystem = new AIVisionSystem(this.agentScript);
            this.targetingSystem = new EnhancedTargetSystem(this.agentScript);
            this.combatSystem = new AICombatSystem(this.agentScript);
            this.stateManager = new StateChangeManager(this.agentScript);
            this.eventHandler = new AIEventHandler(this.agentScript); // ✅ NEW: Initialize EventHandler
            // ✅ Note: stateChangeManager is accessed via getter in aiAgent.mjs (get stateChangeManager())
            // No need to set it here - the getter returns this.stateManager automatically
            // ✅ Initialize utilities and attach to agent script (not as getter)
            // This allows NavigationAdapter to add its helper methods later
            this.utilities = new AIAgentUtilities(this.agentScript);
            this.agentScript.utilities = this.utilities;
            // ✅ PHASE 2: Initialize Personality System
            // This must happen BEFORE brain initialization so evaluators can use personality
            this.personalitySystem = new PersonalitySystem(this.agentScript);
            this.agentScript.personalitySystem = this.personalitySystem;
            // ✅ NEW: Initialize Human Aim System (after personality)
            this.aimSystem = new HumanAimSystem(this.agentScript, {
                debug: false // Set to true for aim diagnostics
            });
            this.agentScript.aimSystem = this.aimSystem;
            // ✅ NEW: Log personality prominently so players can see AI variety
            const personality = this.personalitySystem;
            const archetype = personality.archetype.name;
            const traits = personality.traits;
            Logger.info(`[${name}] 🎭 AI Personality: ${archetype} ` + `(⚔️ Aggression: ${Math.round(traits.aggression * 100)}%, ` + `🛡️ Caution: ${Math.round(traits.caution * 100)}%, ` + `🎯 Accuracy: ${Math.round(traits.accuracy * 100)}%)`);
            Logger.debug(`[${name}] Core behavior systems initialized`);
        } catch (error) {
            Logger.error(`[${name}] Failed to initialize behavior systems:`, error);
            return;
        }
        // Initialize remaining classic script systems (not yet converted)
        this.fuzzyLogic = this.entity.script?.fuzzyLogicSystem || null;
        this.personality = this.entity.script?.personalitySystem || null;
        this.weaponSelector = this.entity.script?.weaponSelector || null;
        this.combatTactics = this.entity.script?.combatTacticsSystem || null;
        // Initialize EmotionalStateSystem with fuzzyLogic
        try {
            this.emotionalSystem = new EmotionalStateSystem(this.agentScript, this.fuzzyLogic);
            Logger.debug(`[${name}] EmotionalStateSystem initialized`);
        } catch (error) {
            Logger.error(`[${name}] Failed to initialize EmotionalStateSystem:`, error);
            this.emotionalSystem = null;
        }
        this._initialized = true;
        Logger.debug(`[${name}] AgentBehavior systems initialized`);
    }
    /**
     * Initialize YUKA brain with goal evaluators
     */ async initializeBrain() {
        const name = this.entity.name;
        // Ensure core and vehicle exist
        const vehicle = this.agentCore.getVehicle();
        if (!vehicle) {
            Logger.warn(`[${name}] Cannot initialize brain - vehicle not ready`);
            this.brain = null;
            return;
        }
        // Load evaluators asynchronously
        // ✅ REMOVED: loadEvaluators() call (evaluators now loaded statically)
        // Check if evaluators loaded successfully
        if (!EnhancedAttackEvaluator) {
            Logger.warn(`[${name}] Goal evaluators failed to load, skipping YUKA brain`);
            this.brain = null;
            return;
        }
        try {
            // Create YUKA Think (brain) - vehicle.agent already set in agent-core.mjs
            this.brain = new YUKA.Think(vehicle);
            // ✅ NEW: Get evaluators from game mode if available
            const gameManager = this.app.gameManager;
            if (gameManager?.gameModeManager) {
                const mode = gameManager.gameModeManager.getCurrentMode();
                if (mode) {
                    const evaluators = mode.getAIGoalEvaluators();
                    Logger.info(`[${name}] Using ${evaluators.length} evaluators from ${mode.modeName}`);
                    // Add all mode-specific evaluators
                    evaluators.forEach((evaluator)=>{
                        this.brain.addEvaluator(evaluator);
                    });
                } else {
                    Logger.warn(`[${name}] No game mode active, using default evaluators`);
                    this._addDefaultEvaluators();
                }
            } else {
                Logger.warn(`[${name}] GameModeManager not available, using default evaluators`);
                this._addDefaultEvaluators();
            }
            Logger.info(`[${name}] YUKA brain initialized with ${this.brain.evaluators?.length || 0} evaluators`);
        } catch (error) {
            Logger.error(`[${name}] Failed to initialize YUKA brain:`, error);
            this.brain = null;
            return; // ✅ FIX: Don't initialize state machine if brain failed
        }
        // ✅ FIX: Ensure brain actually exists before initializing state machine
        if (!this.brain) {
            Logger.error(`[${name}] Cannot initialize state machine - brain is null!`);
            return;
        }
        // ✅ PHASE 2: Initialize Goal Arbitrator (AI Director - Layer 1)
        // This manages strategic context evaluation and guides Yuka's arbitration
        try {
            this.goalArbitrator = new AIGoalArbitrator(this.agentScript);
            this.agentScript.goalArbitrator = this.goalArbitrator;
            Logger.info(`[${name}] 🎯 Goal Arbitrator initialized (AI Director active)`);
        } catch (error) {
            Logger.error(`[${name}] Failed to initialize Goal Arbitrator:`, error);
            this.goalArbitrator = null;
        }
        // Initialize YUKA StateMachine with state classes
        await this._initializeStateMachine();
    }
    /**
     * Add default evaluators when game mode is not available (fallback)
     */ _addDefaultEvaluators() {
        const name = this.entity.name;
        // Add core evaluators (they will access this Script instance via vehicle.agent)
        this.brain.addEvaluator(new EnhancedAttackEvaluator(this.agentScript.aggressiveness * 1.2));
        this.brain.addEvaluator(new EnhancedGetHealthEvaluator(1.0));
        this.brain.addEvaluator(new EnhancedGetAmmoEvaluator(0.8));
        this.brain.addEvaluator(new EnhancedExploreEvaluator(1.0)); // Fixed: Always use full bias for exploration fallback
        // ✅ REDUCED LOGGING: Only log if debug flag enabled
        if (window.AI_DEBUG_INIT) {
            Logger.debug(`[${name}] 🎯 Character bias values (default):`, {
                aggressiveness: this.agentScript.aggressiveness,
                curiosity: this.agentScript.curiosity,
                explorerBias: 1.0
            });
        }
        // Add weapon evaluator only if weaponSystem exists
        if (this.agentCore.weaponSystem && EnhancedGetWeaponEvaluator) {
            this.brain.addEvaluator(new EnhancedGetWeaponEvaluator(this.agentScript.aggressiveness * 0.9));
        }
        // ✅ PHASE 3: Add tactical evaluators for human-like combat
        if (TakeCoverEvaluator) {
            this.brain.addEvaluator(new TakeCoverEvaluator(0.95)); // High priority when wounded
        }
        if (FlankEvaluator) {
            this.brain.addEvaluator(new FlankEvaluator(0.85)); // Situational tactical move
        }
        if (HuntEvaluator) {
            this.brain.addEvaluator(new HuntEvaluator(0.90)); // Chase wounded enemies
        }
        Logger.debug(`[${name}] Default evaluators added (no game mode)`);
    }
    /**
     * Initialize YUKA StateMachine with AI states
     */ async _initializeStateMachine() {
        const name = this.entity.name;
        const vehicle = this.agentCore.getVehicle();
        if (!vehicle) {
            Logger.warn(`[${name}] Cannot initialize state machine - vehicle not ready`);
            return;
        }
        try {
            // Check if YUKA is available globally
            if (typeof YUKA === 'undefined') {
                Logger.error(`[${name}] YUKA is not available globally - cannot create states`);
                return;
            }
            // ✅ CRITICAL: Attach agent script to vehicle so states can access it
            vehicle.agent = this.agentScript;
            // ✅ CONVERTED: Using static import from StateCore (not StateManager facade)
            // Verify states were loaded
            if (!PatrolState || !AlertState) {
                Logger.error(`[${name}] State classes failed to load from StateCore.mjs`);
                return;
            }
            // Create YUKA StateMachine and store internally
            this._stateMachine = new YUKA.StateMachine(vehicle);
            // Add all states using the imported classes
            const patrolState = new PatrolState();
            const alertState = new AlertState();
            const combatState = new CombatState();
            const investigateState = new InvestigateState();
            const fleeState = new FleeState();
            const seekHealthState = new SeekHealthState();
            const seekAmmoState = new SeekAmmoState();
            // Verify state objects have required methods
            if (!patrolState.enter || !patrolState.execute || !patrolState.exit) {
                Logger.error(`[${name}] PatrolState is missing required methods (enter/execute/exit)`);
                return;
            }
            this._stateMachine.add('patrol', patrolState);
            this._stateMachine.add('alert', alertState);
            this._stateMachine.add('combat', combatState);
            this._stateMachine.add('investigate', investigateState);
            this._stateMachine.add('flee', fleeState);
            this._stateMachine.add('seekHealth', seekHealthState);
            this._stateMachine.add('seekAmmo', seekAmmoState);
            // ✅ FIX #2: DIRECTLY SET currentState (YUKA's changeTo() doesn't work before first update)
            this._stateMachine.currentState = patrolState;
            this._stateMachine.previousState = null;
            // ✅ DIAGNOSTIC: Verify it worked
            const stateType = this._stateMachine.currentState?.type || this._stateMachine.currentState?.constructor?.name || 'UNKNOWN';
            Logger.info(`[${name}] After direct assignment: currentState=${stateType}`);
            if (!this._stateMachine.currentState) {
                Logger.error(`[${name}] ❌ CRITICAL: Direct assignment failed - currentState is STILL null!`);
            } else {
                Logger.info(`[${name}] ✅ StateMachine currentState successfully set to: ${stateType}`);
            }
            // Initialize state properties on agent script
            this.agentScript.alertness = 0;
            this.agentScript.morale = 1.0;
            this.agentScript.combatTimer = 0;
            this.agentScript.lastStrafeTime = 0;
            this.agentScript.strafeDirection = 0;
            this.agentScript.isInCover = false;
            // ✅ PHASE 1: Initialize Goal-State Adapter
            this.goalStateAdapter = new GoalStateAdapter(this.agentScript);
            Logger.info(`[${name}] YUKA StateMachine initialized with Patrol as initial state`);
            Logger.info(`[${name}] GoalStateAdapter initialized - State Machine now responds to Goal System`);
        } catch (error) {
            Logger.error(`[${name}] Failed to initialize StateMachine:`, error);
        }
    }
    /**
     * Update behavior systems
     */ update(dt) {
        // 🔥 EMERGENCY DEBUG: Log AgentBehavior.update calls
        if (!this._behaviorUpdateCount) this._behaviorUpdateCount = 0;
        this._behaviorUpdateCount++;
        if (this._behaviorUpdateCount % 60 === 1) {
            console.log(`[${this.entity.name}] 🔄 AgentBehavior.update() called (#${this._behaviorUpdateCount}), initialized=${this._initialized}, enabled=${this.entity.enabled}`);
        }
        if (!this._initialized) return;
        // ✅ CRITICAL: Don't update if entity is disabled (during countdown)
        if (!this.entity.enabled) {
            if (this._behaviorUpdateCount % 60 === 1) {
                console.log(`[${this.entity.name}] ⛔ Entity DISABLED - skipping behavior update`);
            }
            return;
        }
        // ✅ FIX: Periodic threat scanning for combat readiness
        if (!this._lastThreatScan || performance.now() - this._lastThreatScan > 500) {
            this._scanForThreats();
            this._lastThreatScan = performance.now();
        }
        // ✅ CRITICAL: Update navigation adapter - handles vehicle.update() and position sync
        const navigation = this.agentScript.navigation;
        if (navigation && navigation.update) {
            navigation.update(dt);
        }
        // ✅ REMOVED: vehicle.update() and position sync - now handled by AgentNavigationAdapter
        // AgentNavigationAdapter calls vehicle.update(dt) which applies steering behaviors,
        // then syncs the vehicle position back to the PlayCanvas entity.
        // We don't need to do it here - it would cause duplicate updates and position fights.
        // ✅ REDUCED LOGGING: Only log if debug flag is set
        // Enable with: window.AI_DEBUG_MOVEMENT = true
        const vehicle = this.agentCore.core?.vehicle;
        if (vehicle && window.AI_DEBUG_MOVEMENT && (!this._lastMoveLog || performance.now() - this._lastMoveLog > 5000)) {
            this._lastMoveLog = performance.now();
            const movingStatus = typeof this.agentScript.isMoving === 'function' ? this.agentScript.isMoving() : this.agentScript.isMoving;
            const hasTarget = this.agentScript.targetSystem?.hasTarget?.() || false;
            Logger.debug(`[${this.entity.name}] AI Status: moving=${movingStatus}, hasTarget=${hasTarget}, behaviors=${vehicle.steering.behaviors.length}`);
        }
        // Note: YUKA Regulators track time internally, no need to update them manually
        // They use isReady() to check if enough time has passed since last execution
        // Update vision system (now YUKA vehicle is synced!)
        if (this.visionSystem?.update) {
            this.visionSystem.update(dt);
        }
        // Update targeting system
        if (this.targetingSystem?.update) {
            this.targetingSystem.update(dt);
        }
        // 🔥 YUKA DIVE PATTERN: Combat happens INDEPENDENTLY of goals
        // Goals manage MOVEMENT tactics (strafe, charge, hunt)
        // Combat system handles SHOOTING continuously when target visible
        if (this.agentScript?.combatSystem?.update) {
            try {
                const hasTarget = this.agentScript.targetSystem?.hasTarget?.() || false;
                if (hasTarget) {
                    // Create context for combat
                    const context = new CombatDecisionContext(this.agentScript);
                    this.agentScript.combatSystem.update(dt, context);
                }
            } catch (error) {
                if (this._behaviorUpdateCount % 60 === 1) {
                    Logger.error(`[${this.entity.name}] Combat system update failed:`, error);
                }
            }
        }
        // Update emotional system with context
        if (this.emotionalSystem?.update) {
            const emotionalContext = this._buildEmotionalContext();
            this.emotionalSystem.update(dt, emotionalContext);
        }
        // ✅ PHASE 1: Execute YUKA brain (goals) - This makes DECISIONS
        // 🔥 EMERGENCY DEBUG: Log before calling _executeBrain
        if (this._behaviorUpdateCount % 60 === 1) {
            const hasBrain = !!this.brain;
            const evaluatorCount = this.brain?.evaluators?.length || 0;
            console.log(`[${this.entity.name}] 🧠 About to call _executeBrain(), hasBrain=${hasBrain}, evaluators=${evaluatorCount}`);
        }
        this._executeBrain();
        // ✅ PHASE 1: Update Goal-State Adapter - This translates decisions to states
        if (this.goalStateAdapter) {
            this.goalStateAdapter.update(dt);
        }
        // ✅ FIX: Combat system is updated by CombatState with proper context
        // Don't update it here to avoid "NO CONTEXT" errors
        // The state machine handles combat updates with CombatDecisionContext
        // Update state manager (regulators check no longer needed - states run every frame)
        if (this.stateManager?.update) {
            this.stateManager.update(dt);
        }
    }
    /**
     * ✅ FIX: Scan for nearby threats to enable proactive combat
     */ _scanForThreats() {
        if (!this.targetingSystem) return;
        // Skip if already has target
        if (this.targetingSystem.hasTarget()) return;
        try {
            // ✅ FIX: Search through app root for hostile entities directly
            const allEntities = this.app.root.findByTag('player') || [];
            if (allEntities.length === 0) {
                // Try alternative search - find by script component
                const scriptComponents = this.app.root.findComponents('script');
                for (const scriptComponent of scriptComponents){
                    const entity = scriptComponent.entity;
                    if (this._isHostileEntity(entity)) {
                        allEntities.push(entity);
                    }
                }
            }
            // Find closest hostile entity
            const myPos = this.entity.getPosition();
            let closestHostile = null;
            let closestDistance = Infinity;
            const maxDetectionRange = this.agentScript.visionRange || 25;
            for (const entity of allEntities){
                if (this._isHostileEntity(entity)) {
                    const entityPos = entity.getPosition();
                    const distance = myPos.distance(entityPos);
                    if (distance < maxDetectionRange && distance < closestDistance) {
                        closestDistance = distance;
                        closestHostile = entity;
                    }
                }
            }
            // Acquire target if found
            if (closestHostile) {
                this.targetingSystem.acquireTarget(closestHostile);
                Logger.combat(`[${this.entity.name}] 🎯 Proactive target acquired: ${closestHostile.name} at ${closestDistance.toFixed(1)}m`);
            }
        } catch (error) {
            // Non-critical - just log once
            if (!this._threatScanErrorLogged) {
                Logger.debug(`[${this.entity.name}] Threat scan error:`, error);
                this._threatScanErrorLogged = true;
            }
        }
    }
    /**
     * ✅ FIX: Check if entity is hostile to this agent
     */ _isHostileEntity(entity) {
        if (!entity || !entity.enabled) return false;
        // Don't target self
        if (entity === this.entity) return false;
        // Check for player
        if (entity.script?.player || entity.script?.playerController) {
            return true; // AI is hostile to player by default
        }
        // Check for different teams
        if (entity.team && this.entity.team) {
            return entity.team !== this.entity.team;
        }
        // Check tags
        if (entity.tags?.has('player') || entity.tags?.has('team_player')) {
            return true;
        }
        return false;
    }
    /**
     * Build emotional context for emotional system
     */ _buildEmotionalContext() {
        const currentStateName = this._stateMachine?.currentState?.type || null;
        const now = performance.now();
        // ✅ FIX: Morale recovery over time when not in danger
        const timeSinceDamage = now - (this._lastDamageTime || 0);
        if (timeSinceDamage > 10000 && this.agentScript.morale < 1.0) {
            // Recover morale slowly when safe (10% per 10 seconds)
            this.agentScript.morale = Math.min(1.0, this.agentScript.morale + 0.01);
        }
        return {
            inCombat: currentStateName === 'combat',
            healthRatio: this.agentScript.health / Math.max(1, this.agentScript.maxHealth),
            hasTarget: this.targetingSystem?.hasTarget() || false,
            targetVisible: this.targetingSystem?.isTargetVisible() || false,
            alertness: this.agentScript.alertness || 0,
            timeSinceDamage: timeSinceDamage,
            threatCount: this.targetingSystem?.knownTargets?.size || 0,
            morale: this.agentScript.morale || 1.0
        };
    }
    /**
     * Execute YUKA brain if ready
     */ _executeBrain() {
        // ✅ CRITICAL FIX: Brain MUST execute EVERY FRAME to make decisions!
        // Regulators are for throttling expensive operations like pathfinding,
        // but goal evaluation is cheap and needs to respond immediately to HP changes!
        // ✅ REDUCED LOGGING: Only log once on initialization
        // Enable detailed logging with: window.AI_DEBUG_BRAIN = true
        if (window.AI_DEBUG_BRAIN && !this._brainDebugLogged) {
            Logger.debug(`[${this.entity.name}] Brain status: exists=${!!this.brain}, evaluators=${this.brain?.evaluators?.length || 0}`);
            this._brainDebugLogged = true;
        }
        if (this.brain && this.brain.evaluators?.length > 0) {
            try {
                if (!this._brainExecuteCount) this._brainExecuteCount = 0;
                this._brainExecuteCount++;
                // ✅ REDUCED LOGGING: Only log first execution or if debug flag enabled
                if (window.AI_DEBUG_BRAIN && (this._brainExecuteCount === 1 || this._brainExecuteCount % 300 === 0)) {
                    const currentGoal = this.brain.currentSubgoal?.();
                    const goalName = currentGoal?.constructor.name || 'NONE';
                    Logger.debug(`[${this.entity.name}] Brain executing (count: ${this._brainExecuteCount}, evaluators: ${this.brain.evaluators.length}, goal: ${goalName})`);
                }
                // ✅ PHASE 2: Execute active goals
                this.brain.execute();
                // 🔥 EMERGENCY DEBUG: Always log current goal every second
                if (this._brainExecuteCount % 60 === 1) {
                    const currentGoal = this.brain.currentSubgoal?.();
                    const goalName = currentGoal?.constructor.name || 'NONE';
                    const hasTarget = !!this.agentScript.targetSystem?.hasTarget?.();
                    console.log(`[${this.entity.name}] 🧠 Active Goal: ${goalName}, hasTarget=${hasTarget}`);
                }
                // ✅ PHASE 2: Run Goal Arbitration (AI Director decides when to switch goals)
                // This is the critical integration that makes evaluators run!
                if (this.goalArbitrator) {
                    try {
                        this.goalArbitrator.updateGoalArbitration();
                    } catch (error) {
                        Logger.error(`[${this.entity.name}] Goal arbitration error:`, error);
                    }
                }
                // ✅ REDUCED LOGGING: Only log if debug flag enabled
                if (window.AI_DEBUG_BRAIN && this._brainExecuteCount % 300 === 0) {
                    const currentGoal = this.brain.currentSubgoal?.();
                    const goalName = currentGoal?.constructor.name || 'NONE';
                    // ✅ FIX: Get combat context to access healthRatio
                    const context = this._getCombatContext();
                    const healthRatio = context.healthRatio;
                    // Check what YUKA arbitration decided
                    Logger.debug(`[${this.entity.name}] 🧠 Post-arbitration: goal=${goalName}, HP=${Math.round(healthRatio * 100)}%`);
                    // Sample evaluator desirabilities 
                    if (this.brain.evaluators?.length > 0) {
                        const evaluatorResults = this.brain.evaluators.map((evaluator)=>{
                            try {
                                const vehicle = this.agentCore?.getVehicle();
                                const desirability = evaluator.calculateDesirability?.(vehicle || agent) || 0;
                                return `${evaluator.constructor.name}=${Math.round(desirability * 100)}%`;
                            } catch (e) {
                                return `${evaluator.constructor.name}=ERROR`;
                            }
                        });
                        Logger.debug(`[${this.entity.name}] 📊 Evaluator desirabilities: ${evaluatorResults.join(', ')}`);
                    }
                }
            } catch (error) {
                Logger.error(`[${this.entity.name}] Brain execute error:`, error);
            // ✅ FIX: Don't disable brain on error - just log and continue
            // This allows brain to recover on next frame instead of permanently failing
            }
        }
        // ✅ TWO BRAINS FIX: Reflect goal's currentActivity to state machine
        // This replaces the 100ms throttled GoalStateAdapter with instant reflection
        if (this.agentScript?.stateChangeManager) {
            try {
                this.agentScript.stateChangeManager.updateStateReflection();
            } catch (error) {
                Logger.error(`[${this.entity.name}] State reflection error:`, error);
            }
        }
        // ✅ CRITICAL FIX: State machine MUST update EVERY frame
        // Regulators are for throttling performance-heavy operations like vision checks
        // but state machines are lightweight and need constant updates to maintain state!
        // 🔥 CRITICAL: MUST call update() even when currentState is undefined - that's when
        //    YUKA processes queued transitions! The changeTo() method queues a transition,
        //    and update() executes it. Without update(), currentState stays undefined forever.
        if (this._stateMachine) {
            try {
                this._stateMachine.update();
            } catch (error) {
                Logger.error(`[${this.entity.name}] StateMachine update error:`, error);
            }
        }
    }
    /**
     * Record damage time for emotional system
     */ recordDamage() {
        this._lastDamageTime = performance.now();
    }
    /**
     * Check if behavior systems are initialized
     */ isInitialized() {
        return this._initialized;
    }
    /**
     * Get vision system reference
     */ getVisionSystem() {
        return this.visionSystem;
    }
    /**
     * Get targeting system reference
     */ getTargetingSystem() {
        return this.targetingSystem;
    }
    /**
     * Get combat system reference
     */ getCombatSystem() {
        return this.combatSystem;
    }
    /**
     * Get state manager reference
     */ getStateManager() {
        return this.stateManager;
    }
    /**
     * Get emotional system reference
     */ getEmotionalSystem() {
        return this.emotionalSystem;
    }
    /**
     * Get YUKA brain reference
     */ getBrain() {
        return this.brain;
    }
    /**
     * Get YUKA StateMachine reference
     */ getStateMachine() {
        return this._stateMachine;
    }
    /**
     * Get current state name
     */ getCurrentStateName() {
        return this._stateMachine?.currentState?.type || 'none';
    }
    /**
     * Clean up behavior systems
     */ destroy() {
        const name = this.entity.name;
        Logger.debug(`[${name}] AgentBehavior destroy() called`);
        // Clean up utilities system
        if (this.utilities) {
            this.utilities.destroy();
            this.utilities = null;
        }
        // Also clear from agent script
        if (this.agentScript) {
            this.agentScript.utilities = null;
        }
        // Clean up emotional system
        if (this.emotionalSystem) {
            this.emotionalSystem.destroy();
            this.emotionalSystem = null;
        }
        // Clean up state machine
        if (this._stateMachine) {
            this._stateMachine = null;
        }
        // Clean up other systems
        this.visionSystem = null;
        this.targetingSystem = null;
        this.combatSystem = null;
        this.stateManager = null;
        this.brain = null;
        // Clear classic system references
        this.fuzzyLogic = null;
        this.personality = null;
        this.weaponSelector = null;
        this.combatTactics = null;
        this._initialized = false;
        Logger.debug(`[${name}] AgentBehavior destroyed`);
    }
    constructor(agentScript, agentCore){
        this.agentScript = agentScript;
        this.agentCore = agentCore;
        this.entity = agentScript.entity;
        this.app = agentScript.app;
        // Behavior systems
        this.visionSystem = null;
        this.targetingSystem = null;
        this.combatSystem = null;
        this.stateManager = null;
        this.emotionalSystem = null;
        this.utilities = null;
        this.eventHandler = null; // ✅ NEW: EventHandler for perception events
        // YUKA brain and state machine
        this.brain = null;
        this._stateMachine = null; // Store internally to avoid circular reference
        // ✅ PHASE 1: Goal-State Adapter (makes State Machine respond to Goal System)
        this.goalStateAdapter = null;
        // ✅ PHASE 2: Personality System (individual AI behavior variance)
        this.personalitySystem = null;
        // ✅ PHASE 2: Goal Arbitrator (AI Director - Layer 1)
        this.goalArbitrator = null;
        // Classic script system references (not yet converted to ESM)
        this.fuzzyLogic = null;
        this.personality = null;
        this.weaponSelector = null;
        this.combatTactics = null;
        // Damage tracking for emotional system
        this._lastDamageTime = 0;
        this._initialized = false;
        Logger.debug(`[${this.entity.name}] AgentBehavior created`);
    }
}

export { AgentBehavior };
