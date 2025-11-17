import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

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
     * 🔬 COMPREHENSIVE AI SYSTEM DIAGNOSTICS
     * 
     * This script performs deep inspection of EVERY component of the AI system:
     * - YUKA integration & entity sync
     * - Physics & collision state
     * - Navigation & pathfinding
     * - Goal system lifecycle
     * - State transitions
     * - Perception system
     * - Animation synchronization
     * - Performance metrics
     * - Memory leaks
     * - Event system integrity
     * 
     * USAGE: Attach to AI agent entity, set diagnostic level, enable specific tests
     */ class AISystemDiagnostics extends Script {
    // ============================================================================
    // LIFECYCLE
    // ============================================================================
    initialize() {
        this.agentName = this.entity.name || 'UnnamedAgent';
        this.frameCount = 0;
        // 🔍 CRITICAL: Detect if this is a respawn/reload scenario
        const isRespawn = this._detectRespawnScenario();
        this.diagnosticResults = {
            timestamp: Date.now(),
            agent: this.agentName,
            isRespawn: isRespawn,
            respawnIssues: [],
            issues: [],
            warnings: [],
            passed: [],
            metrics: {}
        };
        // Flickering detection state
        this.flickerMonitor = {
            positionHistory: [],
            rotationHistory: [],
            stateHistory: [],
            animationHistory: [],
            rapidChanges: 0,
            suspiciousPatterns: []
        };
        // Performance tracking
        this.perfMetrics = {
            frameTimeHistory: [],
            updateCallCount: 0,
            goalExecutionCount: 0,
            stateTransitionCount: 0,
            lastFrameTime: performance.now()
        };
        // Monitoring control
        this.monitorFlickering = false; // Will be enabled after initial diagnostics
        this.reportInterval = 60; // Report every 60 frames (1 second at 60fps)
        // Component cache
        this.components = {
            aiAgent: null,
            brain: null,
            navigation: null,
            perception: null,
            combat: null,
            healthSystem: null,
            weaponSystem: null,
            rigidbody: null,
            collision: null,
            animation: null
        };
        Logger.info(`\n${'🔬'.repeat(40)}`);
        Logger.info(`🔬 [AI DIAGNOSTICS] Initialized for ${this.agentName}`);
        Logger.info(`📋 Diagnostic Level: ${this.diagnosticLevel.toUpperCase()}`);
        if (isRespawn) {
            Logger.warn(`⚠️ RESPAWN/RELOAD DETECTED - This AI may be using cached/old scripts!`);
            Logger.warn(`   This is a common source of flickering and debugging confusion!`);
        }
        Logger.info(`${'🔬'.repeat(40)}\n`);
        // Mark that we need to run diagnostics - will happen when AI is fully ready
        this._needsInitialDiagnostics = true;
        this._diagnosticsRun = false;
        this._diagnosticTimer = null;
        // Listen for AI agent ready event (fires after brain/goals/state machine initialize)
        this.entity.on('ai:agent:ready', ()=>{
            // Cancel any previous timer if this is a re-initialization
            if (this._diagnosticTimer) {
                clearTimeout(this._diagnosticTimer);
                this._diagnosticTimer = null;
                Logger.warn('[AI DIAGNOSTICS] Cancelled previous diagnostic timer (entity re-initialized)');
            }
            Logger.info(`\n🔬 [AI DIAGNOSTICS] AI agent fully initialized - waiting 15 seconds before running diagnostics...\n`);
            // Wait 15 seconds before running diagnostics
            this._diagnosticTimer = setTimeout(()=>{
                // CRITICAL: Verify entity still exists and is enabled before running
                if (!this.entity || !this.entity.enabled || this.entity.destroyed) {
                    Logger.warn('[AI DIAGNOSTICS] Entity destroyed/disabled before diagnostic could run - cancelling');
                    this._diagnosticTimer = null;
                    return;
                }
                Logger.info(`\n🔬 [AI DIAGNOSTICS] 15 second delay complete - running comprehensive diagnostics\n`);
                this._runInitialDiagnostics();
                this._diagnosticsRun = true;
                this._needsInitialDiagnostics = false;
                this._diagnosticTimer = null;
                // Enable continuous monitoring after initial diagnostics
                if (this.diagnosticLevel === 'full' || this.diagnosticLevel === 'deep') {
                    this.monitorFlickering = true;
                    Logger.info(`\n🔄 [AI DIAGNOSTICS] Continuous flickering monitor ACTIVATED`);
                    Logger.info(`   Tracking: Position, Rotation, State, Animation`);
                    Logger.info(`   Detection: Rapid changes, teleportation, state oscillation`);
                    Logger.info(`   Reports: Every ${this.reportInterval} frames (~1 second)\n`);
                }
            }, 15000); // 15 seconds = 15000 milliseconds
        }, this);
    }
    // ============================================================================
    // RESPAWN DETECTION
    // ============================================================================
    _detectRespawnScenario() {
        try {
            // Check 1: Look for multiple instances of this diagnostic script globally
            if (this.app && this.app.root && typeof this.app.root.findByName === 'function') {
                const allDiagnostics = this.app.root.findByName(this.agentName);
                if (allDiagnostics && allDiagnostics.length > 1) {
                    Logger.error(`🚨 MULTIPLE AI INSTANCES DETECTED: ${allDiagnostics.length} entities named "${this.agentName}"`);
                    return true;
                }
            }
            // Check 2: Look for duplicate script instances on THIS entity
            if (this.entity && this.entity.script && this.entity.script.scripts) {
                const scriptInstances = this.entity.script.scripts;
                let diagnosticCount = 0;
                for (const script of scriptInstances){
                    if (script && script.constructor && script.constructor.name === 'AISystemDiagnostics') {
                        diagnosticCount++;
                    }
                }
                if (diagnosticCount > 1) {
                    Logger.error(`🚨 DUPLICATE DIAGNOSTIC SCRIPTS: ${diagnosticCount} instances on ${this.agentName}`);
                    return true;
                }
            }
            // Check 3: Check if entity was recently created (respawn indicator)
            if (this.entity && this.app) {
                const entityAge = performance.now() - (this.entity._creationTime || 0);
                if (entityAge < 1000 && this.app.timeScale > 0) {
                    // Entity less than 1 second old and game is running
                    Logger.warn(`⚠️ Recent entity creation detected (${(entityAge / 1000).toFixed(2)}s ago) - possible respawn`);
                    return true;
                }
            }
            // Check 4: Look for old debug scripts that should be disabled
            const oldDebugScripts = this._findOldDebugScripts();
            if (oldDebugScripts && oldDebugScripts.length > 0) {
                Logger.error(`🚨 OLD DEBUG SCRIPTS STILL ACTIVE:`);
                oldDebugScripts.forEach((script)=>{
                    Logger.error(`   - ${script.name} (${script.enabled ? 'ENABLED' : 'disabled'})`);
                });
                return true;
            }
            return false;
        } catch (error) {
            Logger.warn(`⚠️ Error detecting respawn scenario: ${error.message}`);
            return false;
        }
    }
    _findOldDebugScripts() {
        const oldScripts = [];
        try {
            if (!this.entity || !this.entity.script || !this.entity.script.scripts) {
                return oldScripts;
            }
            const oldDebugScriptNames = [
                'debugLogger',
                'aiDebugger',
                'combatDebugger',
                'navigationDebugger',
                'goalDebugger',
                'stateDebugger',
                'perceptionDebugger'
            ];
            for (const script of this.entity.script.scripts){
                if (script && script.constructor && script.constructor.scriptName) {
                    if (oldDebugScriptNames.includes(script.constructor.scriptName)) {
                        oldScripts.push({
                            name: script.constructor.scriptName,
                            enabled: script.enabled || false
                        });
                    }
                }
            }
        } catch (error) {
            Logger.warn(`⚠️ Error finding old debug scripts: ${error.message}`);
        }
        return oldScripts;
    }
    postInitialize() {
    // Diagnostics will run when 'ai:agent:ready' event fires
    // This ensures all systems (brain, goals, state machine) are fully initialized
    }
    update(dt) {
        if (!this.enabled) return;
        // Safety check: Ensure perfMetrics is initialized
        if (!this.perfMetrics) {
            // Re-initialize perfMetrics if missing (could happen on hot-reload or script re-attachment)
            this.perfMetrics = {
                frameTimeHistory: [],
                updateCallCount: 0,
                goalExecutionCount: 0,
                stateTransitionCount: 0,
                lastFrameTime: performance.now()
            };
            Logger.debug(`[AI DIAGNOSTICS] perfMetrics re-initialized for ${this.agentName || this.entity?.name || 'Unknown'}`);
        }
        // Ensure frameCount is initialized
        if (typeof this.frameCount !== 'number') {
            this.frameCount = 0;
        }
        // Fallback timeout: If event doesn't fire within 5 seconds, run diagnostics anyway
        if (this._needsInitialDiagnostics && !this._diagnosticsRun && this.frameCount > 300) {
            Logger.warn(`\n⚠️ [AI DIAGNOSTICS] Timeout - AI agent ready event never fired`);
            Logger.warn(`   Running diagnostics anyway to capture current state\n`);
            this._runInitialDiagnostics();
            this._diagnosticsRun = true;
            this._needsInitialDiagnostics = false;
        }
        this.frameCount++;
        this.perfMetrics.updateCallCount++;
        // Track frame time
        const now = performance.now();
        const frameTime = now - this.perfMetrics.lastFrameTime;
        this.perfMetrics.frameTimeHistory.push(frameTime);
        if (this.perfMetrics.frameTimeHistory.length > 60) {
            this.perfMetrics.frameTimeHistory.shift();
        }
        this.perfMetrics.lastFrameTime = now;
        // Monitor flickering continuously
        if (this.monitorFlickering) {
            this._monitorFlickering();
        }
        // Periodic comprehensive reports
        if (this.frameCount % this.reportInterval === 0) {
            this._runPeriodicDiagnostics();
            this._generateReport();
        }
        // Deep inspection mode - run every frame
        if (this.diagnosticLevel === 'deep') {
            this._runDeepInspection(dt);
        }
    }
    destroy() {
        // Clean up diagnostic timer if entity is destroyed
        if (this._diagnosticTimer) {
            clearTimeout(this._diagnosticTimer);
            this._diagnosticTimer = null;
            Logger.info(`[AI DIAGNOSTICS] Cleaned up diagnostic timer for ${this.agentName} (entity destroyed)`);
        }
        // Remove event listeners
        if (this.entity) {
            this.entity.off('ai:agent:ready', null, this);
        }
        Logger.info(`[AI DIAGNOSTICS] Diagnostic tool destroyed for ${this.agentName}`);
    }
    // ============================================================================
    // INITIAL DIAGNOSTICS (Run once at startup)
    // ============================================================================
    _runInitialDiagnostics() {
        Logger.info(`\n${'='.repeat(80)}`);
        Logger.info(`🔬 AI SYSTEM DIAGNOSTICS - INITIAL SCAN`);
        Logger.info(`Agent: ${this.agentName}`);
        Logger.info(`Time: ${new Date().toLocaleTimeString()}`);
        Logger.info(`${'='.repeat(80)}\n`);
        // 1. Component Discovery
        this._discoverComponents();
        // 2. Run all enabled tests
        if (this.testYukaIntegration) this._testYukaIntegration();
        if (this.testPhysics) this._testPhysicsSystem();
        if (this.testNavigation) this._testNavigationSystem();
        if (this.testGoalSystem) this._testGoalSystem();
        if (this.testStateMachine) this._testStateMachine();
        if (this.testPerception) this._testPerceptionSystem();
        if (this.testAnimation) this._testAnimationSystem();
        if (this.testPerformance) this._testPerformanceBaseline();
        // NEW: Deep architectural analysis (runs after AI is fully initialized)
        this._testArchitecturalIntegrity();
        // 3. Generate initial report
        this._generateInitialReport();
        // 4. Auto-fix if enabled
        if (this.autoFixIssues) {
            this._attemptAutoFix();
        }
    }
    // ============================================================================
    // COMPONENT DISCOVERY
    // ============================================================================
    _discoverComponents() {
        Logger.info(`🔍 [COMPONENT DISCOVERY] Scanning AI entity...`);
        // 🔍 LIST ALL SCRIPTS ON THIS ENTITY (Critical for debugging respawn issues)
        if (this.entity.script) {
            Logger.info(`\n📜 ALL SCRIPTS ATTACHED TO ${this.agentName}:`);
            const allScripts = this.entity.script.scripts || [];
            if (allScripts.length === 0) {
                Logger.warn(`   ⚠️ No scripts found!`);
            } else {
                allScripts.forEach((script, index)=>{
                    if (script) {
                        const scriptName = script.constructor.scriptName || script.constructor.name;
                        const enabled = script.enabled ? '✅ ENABLED' : '❌ DISABLED';
                        const order = script.order !== undefined ? ` [Order: ${script.order}]` : '';
                        Logger.info(`   ${index + 1}. ${scriptName} ${enabled}${order}`);
                        // Flag old debug scripts
                        const oldDebugNames = [
                            'debugLogger',
                            'aiDebugger',
                            'combatDebugger',
                            'navigationDebugger',
                            'goalDebugger',
                            'stateDebugger'
                        ];
                        if (oldDebugNames.includes(scriptName)) {
                            Logger.error(`      🚨 OLD DEBUG SCRIPT DETECTED - Should be removed!`);
                            this.diagnosticResults.respawnIssues.push(`Old debug script active: ${scriptName}`);
                        }
                    }
                });
            }
            Logger.info(``);
        }
        // Check all script components
        if (this.entity.script) {
            this.components.aiAgent = this.entity.script.aiAgent || null;
            this.components.navigation = this.entity.script.agentNavigationAdapter || null;
            this.components.perception = this.entity.script.agentPerception || null;
            this.components.combat = this.entity.script.combatSystem || null;
            this.components.healthSystem = this.entity.script.healthSystem || null;
            this.components.weaponSystem = this.entity.script.weaponSystem || null;
        }
        // Check PlayCanvas components
        this.components.rigidbody = this.entity.rigidbody || null;
        this.components.collision = this.entity.collision || null;
        this.components.animation = this.entity.anim || this.entity.animation || null;
        // Check YUKA brain - look in agentBehavior first (modular architecture)
        if (this.components.aiAgent) {
            // Modern modular architecture: brain is in agentBehavior
            if (this.components.aiAgent.agentBehavior && this.components.aiAgent.agentBehavior.brain) {
                this.components.brain = this.components.aiAgent.agentBehavior.brain;
                Logger.info(`   🔍 Found YUKA brain in agentBehavior`);
            } else if (this.components.aiAgent.brain) {
                this.components.brain = this.components.aiAgent.brain;
                Logger.info(`   🔍 Found YUKA brain on aiAgent`);
            }
            // Check for stateMachine in agentBehavior
            if (this.components.aiAgent.agentBehavior && this.components.aiAgent.agentBehavior.stateMachine) {
                this.components.stateMachine = this.components.aiAgent.agentBehavior.stateMachine;
                Logger.info(`   🔍 Found stateMachine in agentBehavior`);
            }
            // Vision system is on aiAgent itself (not in agentBehavior)
            if (this.components.aiAgent.visionRange && this.components.aiAgent.visionAngle) {
                this.components.vision = {
                    viewDistance: this.components.aiAgent.visionRange,
                    viewAngle: this.components.aiAgent.visionAngle,
                    memorySpan: this.components.aiAgent.memorySpan
                };
                Logger.info(`   🔍 Found vision config in aiAgent`);
            }
            // Some AI architectures have perception/combat as internal properties
            if (!this.components.perception && this.components.aiAgent.perception) {
                this.components.perception = this.components.aiAgent.perception;
                Logger.info(`   🔍 Found perception system inside aiAgent`);
            }
            if (!this.components.combat && this.components.aiAgent.combat) {
                this.components.combat = this.components.aiAgent.combat;
                Logger.info(`   🔍 Found combat system inside aiAgent`);
            }
        }
        // Report findings
        const found = Object.entries(this.components).filter(([key, val])=>val !== null).map(([key])=>key);
        const missing = Object.entries(this.components).filter(([key, val])=>val === null).map(([key])=>key);
        Logger.info(`✅ Found components: ${found.join(', ')}`);
        if (missing.length > 0) {
            Logger.warn(`⚠️ Missing components: ${missing.join(', ')}`);
            this.diagnosticResults.warnings.push(`Missing components: ${missing.join(', ')}`);
        }
    }
    // ============================================================================
    // YUKA INTEGRATION TESTS
    // ============================================================================
    _testYukaIntegration() {
        Logger.info(`\n📐 [YUKA INTEGRATION TEST]`);
        const issues = [];
        const checks = [];
        // Check 1: YUKA Vehicle exists
        if (!this.components.aiAgent) {
            issues.push('❌ CRITICAL: No aiAgent script found');
            Logger.error('❌ CRITICAL: No aiAgent script found');
            return;
        }
        // YUKA vehicle can be accessed via multiple paths depending on AI architecture
        let vehicle = null;
        if (this.components.aiAgent.vehicle) {
            vehicle = this.components.aiAgent.vehicle;
        } else if (this.components.aiAgent._vehicle) {
            vehicle = this.components.aiAgent._vehicle;
        } else if (this.components.brain && this.components.brain.owner) {
            vehicle = this.components.brain.owner;
        }
        if (!vehicle) {
            issues.push('❌ CRITICAL: YUKA vehicle not initialized');
            Logger.error('❌ CRITICAL: YUKA vehicle not initialized');
            Logger.error(`   aiAgent exists: ${!!this.components.aiAgent}`);
            Logger.error(`   aiAgent.vehicle: ${this.components.aiAgent.vehicle}`);
            Logger.error(`   aiAgent._vehicle: ${this.components.aiAgent._vehicle}`);
            Logger.error(`   brain exists: ${!!this.components.brain}`);
            Logger.error(`   brain.owner: ${this.components.brain ? this.components.brain.owner : 'N/A'}`);
        } else {
            checks.push('✅ YUKA vehicle exists');
            Logger.info('✅ YUKA vehicle exists');
            // Check 2: Position accessor
            if (vehicle.position) {
                checks.push(`✅ Vehicle position: (${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)})`);
                Logger.info(`✅ Vehicle position: (${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)})`);
            } else {
                issues.push('❌ Vehicle has no position property');
                Logger.error('❌ Vehicle has no position property');
            }
            // Check 3: Entity sync
            const entityPos = this.entity.getPosition();
            if (vehicle.position) {
                const distance = Math.sqrt(Math.pow(vehicle.position.x - entityPos.x, 2) + Math.pow(vehicle.position.y - entityPos.y, 2) + Math.pow(vehicle.position.z - entityPos.z, 2));
                if (distance > 0.1) {
                    issues.push(`⚠️ WARNING: Vehicle/Entity position mismatch (${distance.toFixed(3)}m apart)`);
                    Logger.warn(`⚠️ WARNING: Vehicle/Entity position mismatch (${distance.toFixed(3)}m apart)`);
                    Logger.warn(`   Vehicle: (${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)})`);
                    Logger.warn(`   Entity:  (${entityPos.x.toFixed(2)}, ${entityPos.y.toFixed(2)}, ${entityPos.z.toFixed(2)})`);
                } else {
                    checks.push('✅ Vehicle/Entity positions synchronized');
                    Logger.info('✅ Vehicle/Entity positions synchronized');
                }
            }
            // Check 4: Navigation adapter
            if (this.components.navigation) {
                if (this.components.navigation.entity === this.entity) {
                    checks.push('✅ Navigation adapter linked correctly');
                    Logger.info('✅ Navigation adapter linked correctly');
                } else {
                    issues.push('⚠️ Navigation adapter entity mismatch');
                    Logger.warn('⚠️ Navigation adapter entity mismatch');
                }
            }
            // Check 5: Brain connection
            if (this.components.brain) {
                if (this.components.brain.owner === vehicle) {
                    checks.push('✅ Brain linked to vehicle');
                    Logger.info('✅ Brain linked to vehicle');
                } else {
                    issues.push('❌ CRITICAL: Brain owner mismatch - this causes DirectApproachGoal errors!');
                    Logger.error('❌ CRITICAL: Brain owner mismatch - this causes DirectApproachGoal errors!');
                }
            }
        }
        // Store results
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // PHYSICS SYSTEM TESTS
    // ============================================================================
    _testPhysicsSystem() {
        Logger.info(`\n⚛️ [PHYSICS SYSTEM TEST]`);
        const issues = [];
        const checks = [];
        // Check 1: Rigidbody exists
        if (!this.components.rigidbody) {
            issues.push('⚠️ No rigidbody component');
            Logger.warn('⚠️ No rigidbody component');
        } else {
            checks.push('✅ Rigidbody component exists');
            Logger.info('✅ Rigidbody component exists');
            // Check 2: Rigidbody type
            // PlayCanvas rigidbody types: BODYTYPE_STATIC = 'static', BODYTYPE_DYNAMIC = 'dynamic', BODYTYPE_KINEMATIC = 'kinematic'
            const type = this.components.rigidbody.type;
            let typeName = 'UNKNOWN';
            if (type === 'static' || type === 0) {
                typeName = 'STATIC';
            } else if (type === 'kinematic' || type === 1) {
                typeName = 'KINEMATIC';
            } else if (type === 'dynamic' || type === 2) {
                typeName = 'DYNAMIC';
            }
            checks.push(`✅ Rigidbody type: ${typeName} (${type})`);
            Logger.info(`✅ Rigidbody type: ${typeName} (${type})`);
            if (type === 1) {
                Logger.info('   ℹ️ KINEMATIC bodies using setPosition() do NOT fire trigger events!');
            }
            // Check 3: Collision groups
            checks.push(`✅ Collision group: ${this.components.rigidbody.group}`);
            checks.push(`✅ Collision mask: ${this.components.rigidbody.mask}`);
            Logger.info(`✅ Collision group: ${this.components.rigidbody.group}`);
            Logger.info(`✅ Collision mask: ${this.components.rigidbody.mask}`);
            // Check 4: Enabled state
            if (this.components.rigidbody.enabled) {
                checks.push('✅ Rigidbody enabled');
                Logger.info('✅ Rigidbody enabled');
            } else {
                issues.push('❌ Rigidbody DISABLED');
                Logger.error('❌ Rigidbody DISABLED');
            }
            // Check 5: Mass (for kinematic, should be 0)
            if (type === 1 && this.components.rigidbody.mass > 0) {
                issues.push('⚠️ Kinematic body has non-zero mass');
                Logger.warn('⚠️ Kinematic body has non-zero mass');
            }
        }
        // Check 6: Collision component
        if (!this.components.collision) {
            issues.push('⚠️ No collision component');
            Logger.warn('⚠️ No collision component');
        } else {
            checks.push('✅ Collision component exists');
            Logger.info('✅ Collision component exists');
            Logger.info(`   Type: ${this.components.collision.type}`);
            Logger.info(`   Trigger: ${this.components.collision.isTrigger || false}`);
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // NAVIGATION SYSTEM TESTS
    // ============================================================================
    _testNavigationSystem() {
        Logger.info(`\n🧭 [NAVIGATION SYSTEM TEST]`);
        const issues = [];
        const checks = [];
        if (!this.components.navigation) {
            issues.push('❌ No navigation adapter found');
            Logger.error('❌ No navigation adapter found');
            this.diagnosticResults.issues.push(...issues);
            return;
        }
        const nav = this.components.navigation;
        // Check 1: Navmesh reference (can be in multiple places)
        let hasNavmesh = false;
        let navmeshLocation = '';
        if (nav.navmesh) {
            hasNavmesh = true;
            navmeshLocation = 'nav.navmesh';
        } else if (nav._navmesh) {
            hasNavmesh = true;
            navmeshLocation = 'nav._navmesh';
        } else if (nav.navMesh) {
            hasNavmesh = true;
            navmeshLocation = 'nav.navMesh';
        } else if (nav._navMesh) {
            hasNavmesh = true;
            navmeshLocation = 'nav._navMesh';
        }
        if (hasNavmesh) {
            checks.push(`✅ Navmesh reference exists (${navmeshLocation})`);
            Logger.info(`✅ Navmesh reference exists (${navmeshLocation})`);
        } else {
            issues.push('❌ CRITICAL: No navmesh reference');
            Logger.error('❌ CRITICAL: No navmesh reference');
            Logger.error(`   Checked: navmesh, _navmesh, navMesh, _navMesh - all undefined`);
        }
        // Check 2: Movement method
        Logger.info('🔍 Checking movement method...');
        const navProto = Object.getPrototypeOf(nav);
        const hasSetPosition = navProto.hasOwnProperty('_updatePosition') || typeof nav._updatePosition === 'function';
        if (hasSetPosition) {
            checks.push('✅ Navigation adapter has _updatePosition method');
            Logger.info('✅ Navigation adapter has _updatePosition method');
            Logger.warn('   ⚠️ If using setPosition() internally, triggers won\'t fire!');
        }
        // Check 3: Path following state
        let vehicle = null;
        if (this.components.aiAgent.vehicle) {
            vehicle = this.components.aiAgent.vehicle;
        } else if (this.components.aiAgent._vehicle) {
            vehicle = this.components.aiAgent._vehicle;
        } else if (this.components.brain && this.components.brain.owner) {
            vehicle = this.components.brain.owner;
        }
        if (vehicle && vehicle.steering) {
            const hasFollowPath = vehicle.steering.behaviors.some((b)=>b.constructor.name === 'FollowPathBehavior');
            if (hasFollowPath) {
                checks.push('✅ FollowPathBehavior active');
                Logger.info('✅ FollowPathBehavior active');
            } else {
                // NOTE: This AI uses Goal-based navigation (PatrolGoal, HuntGoal, etc.)
                // NOT YUKA's FollowPathBehavior - this is by design!
                Logger.info('ℹ️ No FollowPathBehavior (uses Goal-based navigation instead) - this is NORMAL');
                checks.push('ℹ️ Navigation: Goal-based system (not FollowPathBehavior)');
            }
        }
        // Check 4: Stuck detection
        if (nav.stuckDetection !== undefined) {
            checks.push(`✅ Stuck detection: ${nav.stuckDetection}`);
            Logger.info(`✅ Stuck detection: ${nav.stuckDetection}`);
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // GOAL SYSTEM TESTS
    // ============================================================================
    _testGoalSystem() {
        Logger.info(`\n🎯 [GOAL SYSTEM TEST]`);
        const issues = [];
        const checks = [];
        if (!this.components.brain) {
            issues.push('❌ No brain found');
            Logger.error('❌ No brain found');
            this.diagnosticResults.issues.push(...issues);
            return;
        }
        const brain = this.components.brain;
        // Check 1: Evaluators
        if (brain.evaluators && brain.evaluators.length > 0) {
            checks.push(`✅ ${brain.evaluators.length} evaluators registered`);
            Logger.info(`✅ ${brain.evaluators.length} evaluators registered:`);
            brain.evaluators.forEach((ev)=>{
                Logger.info(`   - ${ev.constructor.name}`);
            });
        } else {
            issues.push('❌ No goal evaluators registered');
            Logger.error('❌ No goal evaluators registered');
        }
        // Check 2: Current goal (NOTE: May be null until first arbitration - this is NORMAL)
        const currentGoal = brain.currentGoal || brain._currentGoal;
        if (currentGoal) {
            const goalName = currentGoal.constructor.name;
            const goalStatus = currentGoal.status;
            const statusName = goalStatus === 0 ? 'INACTIVE' : goalStatus === 1 ? 'ACTIVE' : goalStatus === 2 ? 'COMPLETED' : goalStatus === 3 ? 'FAILED' : 'UNKNOWN';
            checks.push(`✅ Current goal: ${goalName}`);
            checks.push(`✅ Goal status: ${statusName} (${goalStatus})`);
            Logger.info(`✅ Current goal: ${goalName}`);
            Logger.info(`✅ Goal status: ${statusName} (${goalStatus})`);
            // Check 3: Subgoals
            if (currentGoal.subgoals && currentGoal.subgoals.length > 0) {
                checks.push(`✅ ${currentGoal.subgoals.length} subgoals`);
                Logger.info(`✅ ${currentGoal.subgoals.length} subgoals:`);
                currentGoal.subgoals.forEach((sg, idx)=>{
                    const sgStatus = sg.status === 0 ? 'INACTIVE' : sg.status === 1 ? 'ACTIVE' : sg.status === 2 ? 'COMPLETED' : sg.status === 3 ? 'FAILED' : 'UNKNOWN';
                    Logger.info(`   ${idx + 1}. ${sg.constructor.name} [${sgStatus}]`);
                });
            }
            // Check 4: Goal activation state
            if (goalStatus === 1) {
                // Goal is active - check if it's actually executing
                if (typeof currentGoal.execute === 'function') {
                    checks.push('✅ Goal has execute method');
                    Logger.info('✅ Goal has execute method');
                } else {
                    issues.push('❌ CRITICAL: Active goal has no execute method!');
                    Logger.error('❌ CRITICAL: Active goal has no execute method!');
                }
            }
            // Check 5: Goal timeout issues
            if (currentGoal.startTime && currentGoal.maxDuration) {
                const elapsed = (performance.now() - currentGoal.startTime) / 1000;
                const remaining = currentGoal.maxDuration - elapsed;
                if (remaining < 0) {
                    issues.push(`⚠️ Goal exceeded max duration by ${Math.abs(remaining).toFixed(1)}s`);
                    Logger.warn(`⚠️ Goal exceeded max duration by ${Math.abs(remaining).toFixed(1)}s`);
                } else if (remaining < 5) {
                    issues.push(`⚠️ Goal expiring soon (${remaining.toFixed(1)}s remaining)`);
                    Logger.warn(`⚠️ Goal expiring soon (${remaining.toFixed(1)}s remaining)`);
                } else {
                    checks.push(`✅ Goal time remaining: ${remaining.toFixed(1)}s`);
                    Logger.info(`✅ Goal time remaining: ${remaining.toFixed(1)}s`);
                }
            }
        } else {
            // No current goal - this is NORMAL if brain hasn't arbitrated yet
            Logger.info('ℹ️ No current goal yet (brain will arbitrate on next update) - this is NORMAL');
            checks.push('ℹ️ Goal system ready (waiting for first arbitration)');
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // STATE MACHINE TESTS
    // ============================================================================
    _testStateMachine() {
        Logger.info(`\n🔄 [STATE MACHINE TEST]`);
        const issues = [];
        const checks = [];
        const agent = this.components.aiAgent;
        if (!agent) {
            issues.push('❌ No AI agent');
            Logger.error('❌ No AI agent');
            this.diagnosticResults.issues.push(...issues);
            return;
        }
        // Check 1: Current state - look in multiple places
        let currentState = null;
        // Try stateMachine object first (YUKA architecture)
        if (this.components.stateMachine && this.components.stateMachine.currentState) {
            currentState = this.components.stateMachine.currentState.constructor.name;
        } else if (agent.agentBehavior && agent.agentBehavior.stateMachine && agent.agentBehavior.stateMachine.currentState) {
            currentState = agent.agentBehavior.stateMachine.currentState.constructor.name;
        } else if (agent.currentState || agent._currentState) {
            currentState = agent.currentState || agent._currentState;
        }
        if (currentState) {
            checks.push(`✅ Current state: ${currentState}`);
            Logger.info(`✅ Current state: ${currentState}`);
        } else {
            // No current state found - this might be timing issue
            Logger.info('ℹ️ No current state detected yet (state machine may not be initialized) - checking architecture...');
            checks.push('ℹ️ State machine initializing');
        }
        // Check 2: State transition rate
        if (agent._stateTransitions) {
            const transitionCount = agent._stateTransitions.length || 0;
            checks.push(`✅ ${transitionCount} state transitions recorded`);
            Logger.info(`✅ ${transitionCount} state transitions recorded`);
            // Check for rapid state switching (flickering indicator)
            if (transitionCount > 10) {
                const recentTransitions = agent._stateTransitions.slice(-10);
                const timeSpan = recentTransitions[9].time - recentTransitions[0].time;
                const transitionsPerSecond = 10 / (timeSpan / 1000);
                if (transitionsPerSecond > 5) {
                    issues.push(`🚨 CRITICAL: Rapid state switching detected (${transitionsPerSecond.toFixed(1)} transitions/sec)`);
                    Logger.error(`🚨 CRITICAL: Rapid state switching detected (${transitionsPerSecond.toFixed(1)} transitions/sec)`);
                    Logger.error(`   Recent transitions:`);
                    recentTransitions.forEach((t)=>{
                        Logger.error(`   - ${t.from} → ${t.to}`);
                    });
                }
            }
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // PERCEPTION SYSTEM TESTS
    // ============================================================================
    _testPerceptionSystem() {
        Logger.info(`\n👁️ [PERCEPTION SYSTEM TEST]`);
        const issues = [];
        const checks = [];
        const agent = this.components.aiAgent;
        if (!agent) {
            issues.push('⚠️ No AI agent');
            Logger.warn('⚠️ No AI agent');
            this.diagnosticResults.issues.push(...issues);
            return;
        }
        // Vision config is on aiAgent as attributes
        if (agent.visionRange) {
            checks.push(`✅ Vision range: ${agent.visionRange}m`);
            Logger.info(`✅ Vision range: ${agent.visionRange}m`);
        } else {
            issues.push('⚠️ No vision range configured');
            Logger.warn('⚠️ No vision range configured');
        }
        if (agent.visionAngle) {
            checks.push(`✅ Vision angle: ${agent.visionAngle}°`);
            Logger.info(`✅ Vision angle: ${agent.visionAngle}°`);
        } else {
            issues.push('⚠️ No vision angle configured');
            Logger.warn('⚠️ No vision angle configured');
        }
        // Memory system is in agentCore
        const memorySystem = agent.agentCore?.core?.memorySystem;
        if (memorySystem && memorySystem.records) {
            const recordCount = memorySystem.records.length;
            checks.push(`✅ ${recordCount} memory records`);
            Logger.info(`✅ ${recordCount} memory records`);
        } else {
            Logger.info(`   ℹ️ Memory system integrated in YUKA (no separate perception component)`);
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // ANIMATION SYSTEM TESTS
    // ============================================================================
    _testAnimationSystem() {
        Logger.info(`\n🎬 [ANIMATION SYSTEM TEST]`);
        const issues = [];
        const checks = [];
        if (!this.components.animation) {
            issues.push('⚠️ No animation component');
            Logger.warn('⚠️ No animation component');
            this.diagnosticResults.issues.push(...issues);
            return;
        }
        const anim = this.components.animation;
        // Check 1: Current animation
        if (anim.currAnim || anim.baseLayer?.activeState) {
            const animName = anim.currAnim || anim.baseLayer?.activeState?.name;
            checks.push(`✅ Current animation: ${animName}`);
            Logger.info(`✅ Current animation: ${animName}`);
        }
        // Check 2: Animation state layers
        if (anim.baseLayer) {
            checks.push('✅ Base animation layer exists');
            Logger.info('✅ Base animation layer exists');
        }
        // Check 3: Transition state
        if (anim.baseLayer?.transitioning) {
            checks.push('⚠️ Animation currently transitioning');
            Logger.warn('⚠️ Animation currently transitioning');
        }
        this.diagnosticResults.issues.push(...issues);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // PERFORMANCE BASELINE TESTS
    // ============================================================================
    _testPerformanceBaseline() {
        Logger.info(`\n⚡ [PERFORMANCE BASELINE TEST]`);
        const checks = [];
        // Calculate baseline metrics
        const avgFrameTime = this.perfMetrics.frameTimeHistory.length > 0 ? this.perfMetrics.frameTimeHistory.reduce((a, b)=>a + b, 0) / this.perfMetrics.frameTimeHistory.length : 0;
        this.diagnosticResults.metrics.avgFrameTime = avgFrameTime;
        this.diagnosticResults.metrics.updateCallCount = this.perfMetrics.updateCallCount;
        checks.push(`✅ Average frame time: ${avgFrameTime.toFixed(2)}ms`);
        Logger.info(`✅ Average frame time: ${avgFrameTime.toFixed(2)}ms`);
        this.diagnosticResults.passed.push(...checks);
    }
    // ============================================================================
    // FLICKERING MONITOR (Runs continuously)
    // ============================================================================
    _monitorFlickering() {
        // ✅ FIX: Safety check - stop monitoring if entity is destroyed or AI agent is gone
        if (!this.entity || !this.entity.enabled || !this.components) {
            return;
        }
        // Update component cache if aiAgent is missing (e.g., after death/respawn)
        if (!this.components.aiAgent && this.entity.script) {
            this.components.aiAgent = this.entity.script.aiAgent || null;
        }
        const pos = this.entity.getPosition();
        const rot = this.entity.getRotation();
        const agent = this.components.aiAgent;
        // Record position
        this.flickerMonitor.positionHistory.push({
            time: performance.now(),
            x: pos.x,
            y: pos.y,
            z: pos.z
        });
        // Record rotation
        this.flickerMonitor.rotationHistory.push({
            time: performance.now(),
            x: rot.x,
            y: rot.y,
            z: rot.z,
            w: rot.w
        });
        // Record state
        if (agent) {
            this.flickerMonitor.stateHistory.push({
                time: performance.now(),
                state: agent.currentState || agent._currentState || 'unknown'
            });
        }
        // Keep only last 60 frames
        if (this.flickerMonitor.positionHistory.length > 60) {
            this.flickerMonitor.positionHistory.shift();
            this.flickerMonitor.rotationHistory.shift();
            this.flickerMonitor.stateHistory.shift();
        }
        // Analyze for rapid changes every 10 frames
        if (this.frameCount % 10 === 0 && this.flickerMonitor.positionHistory.length > 10) {
            this._analyzeFlickerPatterns();
        }
    }
    _analyzeFlickerPatterns() {
        const recent = this.flickerMonitor.positionHistory.slice(-10);
        const states = this.flickerMonitor.stateHistory.slice(-10);
        // Check for position oscillation
        let rapidMovements = 0;
        for(let i = 1; i < recent.length; i++){
            const distance = Math.sqrt(Math.pow(recent[i].x - recent[i - 1].x, 2) + Math.pow(recent[i].y - recent[i - 1].y, 2) + Math.pow(recent[i].z - recent[i - 1].z, 2));
            if (distance > 0.5) {
                rapidMovements++;
            }
        }
        if (rapidMovements > 5) {
            const pattern = `Rapid position changes: ${rapidMovements} large movements in 10 frames`;
            if (!this.flickerMonitor.suspiciousPatterns.includes(pattern)) {
                this.flickerMonitor.suspiciousPatterns.push(pattern);
                this.flickerMonitor.rapidChanges++;
                Logger.warn(`\n🚨🚨🚨 FLICKERING DETECTED 🚨🚨🚨`);
                Logger.warn(`   ${pattern}`);
                Logger.warn(`   Frame: ${this.frameCount}, Time: ${new Date().toLocaleTimeString()}`);
            }
        }
        // Check for state oscillation
        const uniqueStates = [
            ...new Set(states.map((s)=>s.state))
        ];
        if (uniqueStates.length > 3) {
            const pattern = `State oscillation: ${uniqueStates.length} different states in 10 frames`;
            if (!this.flickerMonitor.suspiciousPatterns.includes(pattern)) {
                this.flickerMonitor.suspiciousPatterns.push(pattern);
                this.flickerMonitor.rapidChanges++;
                Logger.warn(`\n🚨🚨🚨 STATE FLICKERING DETECTED 🚨🚨🚨`);
                Logger.warn(`   ${pattern}`);
                Logger.warn(`   States: ${states.map((s)=>s.state).join(' → ')}`);
                Logger.warn(`   Frame: ${this.frameCount}, Time: ${new Date().toLocaleTimeString()}`);
            }
        }
        // Check for position teleportation
        for(let i = 1; i < recent.length; i++){
            const distance = Math.sqrt(Math.pow(recent[i].x - recent[i - 1].x, 2) + Math.pow(recent[i].y - recent[i - 1].y, 2) + Math.pow(recent[i].z - recent[i - 1].z, 2));
            if (distance > 2.0) {
                const pattern = `Position teleportation: ${distance.toFixed(2)}m in one frame`;
                if (!this.flickerMonitor.suspiciousPatterns.includes(pattern)) {
                    this.flickerMonitor.suspiciousPatterns.push(pattern);
                    this.flickerMonitor.rapidChanges++;
                    Logger.error(`\n🚨🚨🚨 TELEPORTATION DETECTED 🚨🚨🚨`);
                    Logger.error(`   ${pattern}`);
                    Logger.error(`   From: (${recent[i - 1].x.toFixed(2)}, ${recent[i - 1].y.toFixed(2)}, ${recent[i - 1].z.toFixed(2)})`);
                    Logger.error(`   To:   (${recent[i].x.toFixed(2)}, ${recent[i].y.toFixed(2)}, ${recent[i].z.toFixed(2)})`);
                    Logger.error(`   Frame: ${this.frameCount}, Time: ${new Date().toLocaleTimeString()}`);
                }
            }
        }
    }
    // ============================================================================
    // PERIODIC DIAGNOSTICS
    // ============================================================================
    _runPeriodicDiagnostics() {
        // Quick health checks
        this._checkComponentHealth();
        this._checkMemoryLeaks();
        this._updatePerformanceMetrics();
    }
    _checkComponentHealth() {
        // ✅ FIX: Safety check - skip if components is undefined/null
        if (!this.components) {
            return;
        }
        // Verify all components still exist
        for (const [name, component] of Object.entries(this.components)){
            if (component !== null) {
                // Check if component is still valid
                if (component.entity && !component.entity.enabled) {
                    Logger.warn(`⚠️ Component ${name} entity is disabled`);
                }
            }
        }
    }
    _checkMemoryLeaks() {
        // ✅ FIX: Safety check - skip if components is undefined/null
        if (!this.components) {
            return;
        }
        // Check for growing arrays/objects
        const agent = this.components.aiAgent;
        if (agent && agent._eventListeners) {
            const listenerCount = agent._eventListeners.length || 0;
            if (listenerCount > 100) {
                Logger.warn(`⚠️ Possible memory leak: ${listenerCount} event listeners`);
            }
        }
    }
    _updatePerformanceMetrics() {
        const avgFrameTime = this.perfMetrics.frameTimeHistory.reduce((a, b)=>a + b, 0) / this.perfMetrics.frameTimeHistory.length;
        if (avgFrameTime > 16.67) {
            Logger.warn(`⚠️ Poor performance: ${avgFrameTime.toFixed(2)}ms avg frame time (target: 16.67ms)`);
        }
    }
    // ============================================================================
    // DEEP INSPECTION MODE
    // ============================================================================
    _runDeepInspection(dt) {
        // Log every single update call
        if (this.frameCount % 60 === 0) {
            Logger.info(`\n🔬 [DEEP INSPECTION] Frame ${this.frameCount}`);
            // Check YUKA vehicle position sync
            const agent = this.components.aiAgent;
            if (agent && agent.vehicle) {
                const vehiclePos = agent.vehicle.position;
                const entityPos = this.entity.getPosition();
                const sync = Math.sqrt(Math.pow(vehiclePos.x - entityPos.x, 2) + Math.pow(vehiclePos.y - entityPos.y, 2) + Math.pow(vehiclePos.z - entityPos.z, 2));
                Logger.info(`   Vehicle/Entity sync: ${sync.toFixed(4)}m`);
                if (sync > 0.01) {
                    Logger.warn(`   ⚠️ Sync drift detected!`);
                }
            }
            // Check goal execution
            if (this.components.brain && this.components.brain.currentGoal) {
                const goal = this.components.brain.currentGoal;
                Logger.info(`   Goal: ${goal.constructor.name} [Status: ${goal.status}]`);
            }
        }
    }
    // ============================================================================
    // REPORT GENERATION
    // ============================================================================
    _generateInitialReport() {
        Logger.info(`\n${'='.repeat(80)}`);
        Logger.info(`📊 INITIAL DIAGNOSTIC REPORT`);
        Logger.info(`${'='.repeat(80)}\n`);
        // 🚨 RESPAWN ISSUES (Most critical - shown first)
        if (this.diagnosticResults.isRespawn || this.diagnosticResults.respawnIssues.length > 0) {
            Logger.info(`🚨 RESPAWN/RELOAD ISSUES (${this.diagnosticResults.respawnIssues.length}):`);
            if (this.diagnosticResults.respawnIssues.length > 0) {
                this.diagnosticResults.respawnIssues.forEach((issue)=>Logger.error(`   ${issue}`));
            } else {
                Logger.warn(`   Respawn detected but no specific issues found yet`);
            }
            Logger.info(`\n   💡 RECOMMENDATION: Check if AI entity is being spawned from a template`);
            Logger.info(`      that has old debug scripts attached. The template needs updating!`);
            Logger.info(``);
        }
        Logger.info(`✅ PASSED CHECKS (${this.diagnosticResults.passed.length}):`);
        this.diagnosticResults.passed.forEach((check)=>Logger.info(`   ${check}`));
        if (this.diagnosticResults.warnings.length > 0) {
            Logger.info(`\n⚠️ WARNINGS (${this.diagnosticResults.warnings.length}):`);
            this.diagnosticResults.warnings.forEach((warn)=>Logger.warn(`   ${warn}`));
        }
        if (this.diagnosticResults.issues.length > 0) {
            Logger.info(`\n❌ ISSUES (${this.diagnosticResults.issues.length}):`);
            this.diagnosticResults.issues.forEach((issue)=>Logger.error(`   ${issue}`));
        }
        if (this.flickerMonitor.suspiciousPatterns.length > 0) {
            Logger.info(`\n🚨 FLICKERING PATTERNS DETECTED (${this.flickerMonitor.suspiciousPatterns.length}):`);
            this.flickerMonitor.suspiciousPatterns.forEach((pattern)=>Logger.error(`   ${pattern}`));
        }
        Logger.info(`\n${'='.repeat(80)}\n`);
    }
    _generateReport() {
        if (this.diagnosticLevel === 'quick') return;
        Logger.info(`\n📊 [PERIODIC REPORT] Frame ${this.frameCount}`);
        const avgFrameTime = this.perfMetrics.frameTimeHistory.reduce((a, b)=>a + b, 0) / this.perfMetrics.frameTimeHistory.length;
        Logger.info(`   Avg Frame Time: ${avgFrameTime.toFixed(2)}ms`);
        Logger.info(`   Update Calls: ${this.perfMetrics.updateCallCount}`);
        // Show detailed flickering status
        if (this.monitorFlickering && this.flickerMonitor) {
            const posChanges = this.flickerMonitor.positionHistory.length;
            const stateChanges = this.flickerMonitor.stateHistory.length;
            const rapidChanges = this.flickerMonitor.rapidChanges;
            Logger.info(`   👁️ Monitoring: Pos samples=${posChanges}, State samples=${stateChanges}, Rapid=${rapidChanges}`);
            if (this.flickerMonitor.suspiciousPatterns.length > 0) {
                Logger.error(`   🚨 FLICKERING DETECTED: ${this.flickerMonitor.suspiciousPatterns.length} patterns!`);
                this.flickerMonitor.suspiciousPatterns.forEach((pattern)=>{
                    Logger.error(`      ${pattern}`);
                });
            }
        }
        if (this.flickerMonitor && this.flickerMonitor.suspiciousPatterns.length > 0) {
            Logger.info(`   🚨 Flickering patterns: ${this.flickerMonitor.suspiciousPatterns.length}`);
        }
    }
    // ============================================================================
    // AUTO-FIX ATTEMPTS
    // ============================================================================
    _attemptAutoFix() {
        Logger.info(`\n🔧 [AUTO-FIX] Attempting to fix detected issues...`);
        let fixCount = 0;
        // Fix 1: Sync vehicle position
        const agent = this.components.aiAgent;
        if (agent && agent.vehicle) {
            const vehiclePos = agent.vehicle.position;
            const entityPos = this.entity.getPosition();
            const distance = Math.sqrt(Math.pow(vehiclePos.x - entityPos.x, 2) + Math.pow(vehiclePos.y - entityPos.y, 2) + Math.pow(vehiclePos.z - entityPos.z, 2));
            if (distance > 0.1) {
                vehiclePos.x = entityPos.x;
                vehiclePos.y = entityPos.y;
                vehiclePos.z = entityPos.z;
                Logger.info(`   ✅ Fixed vehicle/entity position sync`);
                fixCount++;
            }
        }
        // Fix 2: Re-enable disabled rigidbody
        if (this.components.rigidbody && !this.components.rigidbody.enabled) {
            this.components.rigidbody.enabled = true;
            Logger.info(`   ✅ Re-enabled rigidbody`);
            fixCount++;
        }
        Logger.info(`\n🔧 Auto-fix complete: ${fixCount} fixes applied`);
    }
    // ============================================================================
    // DEEP ARCHITECTURAL INTEGRITY TEST
    // ============================================================================
    _testArchitecturalIntegrity() {
        Logger.info(`\n🏗️ [ARCHITECTURAL INTEGRITY TEST]`);
        Logger.info(`   Testing system integration, design patterns, and code quality...`);
        const issues = [];
        const warnings = [];
        const checks = [];
        const agent = this.components.aiAgent;
        if (!agent) {
            Logger.error(`❌ CRITICAL: No aiAgent - cannot test architecture`);
            return;
        }
        // ====================================================================
        // TEST 1: Goal System Architecture
        // ====================================================================
        Logger.info(`\n📋 [1/7] Goal System Architecture...`);
        const brain = agent.agentBehavior?.brain || agent.brain;
        if (!brain) {
            issues.push('❌ No brain/goal arbitrator - AI cannot make decisions');
            Logger.error('❌ No brain/goal arbitrator - AI cannot make decisions');
        } else {
            checks.push('✅ Goal arbitrator exists');
            const evaluators = brain.evaluators || [];
            if (evaluators.length === 0) {
                issues.push('❌ Brain has NO evaluators - AI cannot evaluate goals');
                Logger.error('❌ Brain has NO evaluators - AI cannot evaluate goals');
            } else {
                checks.push(`✅ Brain has ${evaluators.length} evaluators`);
                Logger.info(`✅ Brain has ${evaluators.length} evaluators`);
                let misconfiguredCount = 0;
                evaluators.forEach((evaluator)=>{
                    if (!evaluator.characterBias || evaluator.characterBias === 0) {
                        misconfiguredCount++;
                    }
                });
                if (misconfiguredCount > 0) {
                    warnings.push(`⚠️ ${misconfiguredCount}/${evaluators.length} evaluators have no characterBias`);
                    Logger.warn(`⚠️ ${misconfiguredCount}/${evaluators.length} evaluators have no characterBias`);
                }
            }
            if (!brain.currentGoal || brain.currentGoal === 'none') {
                // No current goal - check if this is just because arbitration hasn't run yet
                Logger.info('ℹ️ No current goal yet - brain will arbitrate on next update (NORMAL)');
                checks.push('ℹ️ Goal arbitration pending');
            } else {
                checks.push(`✅ Current goal: ${brain.currentGoal}`);
                Logger.info(`✅ Current goal: ${brain.currentGoal}`);
            }
        }
        // ====================================================================
        // TEST 2: State Machine Architecture
        // ====================================================================
        Logger.info(`\n🔄 [2/7] State Machine Architecture...`);
        const stateMachine = agent.agentBehavior?.stateMachine || agent.stateMachine;
        if (!stateMachine) {
            issues.push('❌ No state machine - AI has no behavior states');
            Logger.error('❌ No state machine - AI has no behavior states');
        } else {
            checks.push('✅ State machine exists');
            const currentState = stateMachine.currentState;
            if (!currentState) {
                issues.push('❌ State machine has NO current state - AI is frozen');
                Logger.error('❌ State machine has NO current state - AI is frozen');
            } else {
                const stateName = currentState.name || currentState.constructor?.name || 'unknown';
                checks.push(`✅ Current state: ${stateName}`);
                Logger.info(`✅ Current state: ${stateName}`);
                if (typeof currentState.execute !== 'function') {
                    issues.push(`❌ Current state "${stateName}" has no execute() method`);
                    Logger.error(`❌ Current state "${stateName}" has no execute() method`);
                }
            }
            const states = stateMachine.states || [];
            if (states.length === 0) {
                issues.push('❌ State machine has NO registered states');
                Logger.error('❌ State machine has NO registered states');
            } else {
                checks.push(`✅ ${states.length} states registered`);
                Logger.info(`✅ ${states.length} states registered`);
            }
        }
        // ====================================================================
        // TEST 3: Vision/Perception Integration
        // ====================================================================
        Logger.info(`\n👁️ [3/7] Vision/Perception Integration...`);
        // Vision config is stored directly on aiAgent as attributes
        const visionRange = agent.visionRange;
        const visionAngle = agent.visionAngle;
        if (!visionRange || visionRange === 0) {
            issues.push('❌ Vision has no visionRange - AI cannot see');
            Logger.error('❌ Vision has no visionRange - AI cannot see');
        } else {
            checks.push(`✅ Vision range: ${visionRange}m`);
            Logger.info(`✅ Vision range: ${visionRange}m`);
        }
        if (!visionAngle || visionAngle === 0) {
            issues.push('❌ Vision has no visionAngle - AI cannot see');
            Logger.error('❌ Vision has no visionAngle - AI cannot see');
        } else {
            checks.push(`✅ Vision angle: ${visionAngle}°`);
            Logger.info(`✅ Vision angle: ${visionAngle}°`);
        }
        // Memory system
        const memorySystem = agent.agentCore?.core?.memorySystem;
        if (memorySystem) {
            checks.push('✅ Memory system exists');
            const recordCount = memorySystem.records?.length || 0;
            Logger.info(`✅ Memory system: ${recordCount} records`);
        } else {
            Logger.info(`   ℹ️ Memory system: integrated in YUKA brain`);
        }
        // ====================================================================
        // TEST 4: Weapon System Integration
        // ====================================================================
        Logger.info(`\n🔫 [4/7] Weapon System Integration...`);
        const weaponSystem = agent.weaponSystem;
        if (!weaponSystem) {
            issues.push('❌ No weapon system - AI cannot fight');
            Logger.error('❌ No weapon system - AI cannot fight');
        } else {
            checks.push('✅ Weapon system exists');
            if (!weaponSystem.__initialized) {
                issues.push('❌ Weapon system NOT initialized');
                Logger.error('❌ Weapon system NOT initialized');
            } else {
                checks.push('✅ Weapon system initialized');
            }
            const currentWeapon = weaponSystem.currentWeapon;
            if (!currentWeapon) {
                issues.push('❌ AI has NO weapon equipped - cannot engage in combat');
                Logger.error('❌ AI has NO weapon equipped - cannot engage in combat');
            } else {
                checks.push(`✅ Equipped weapon: ${currentWeapon}`);
                Logger.info(`✅ Equipped weapon: ${currentWeapon}`);
                const ammo = weaponSystem.getTotalAmmo?.(currentWeapon);
                if (ammo === 0) {
                    warnings.push('⚠️ Weapon has NO AMMO');
                    Logger.warn('⚠️ Weapon has NO AMMO');
                } else if (ammo) {
                    checks.push(`✅ Weapon ammo: ${ammo}`);
                    Logger.info(`✅ Weapon ammo: ${ammo}`);
                }
            }
        }
        // ====================================================================
        // TEST 5: Navigation System Integration
        // ====================================================================
        Logger.info(`\n🧭 [5/7] Navigation System Integration...`);
        const nav = agent.agentNavigationAdapter || this.components.navigation;
        if (!nav) {
            issues.push('❌ No navigation adapter - AI cannot move intelligently');
            Logger.error('❌ No navigation adapter - AI cannot move intelligently');
        } else {
            checks.push('✅ Navigation adapter exists');
            const navMesh = nav.navMesh || nav.navmesh;
            if (!navMesh) {
                issues.push('❌ Navigation has NO navmesh - AI cannot pathfind');
                Logger.error('❌ Navigation has NO navmesh - AI cannot pathfind');
            } else {
                checks.push('✅ Navmesh exists');
                Logger.info('✅ Navmesh connected');
            }
            const vehicle = agent.yukaVehicle;
            if (vehicle && nav.vehicle !== vehicle) {
                warnings.push('⚠️ Navigation adapter not linked to YUKA vehicle');
                Logger.warn('⚠️ Navigation adapter not linked to YUKA vehicle');
            }
        }
        // ====================================================================
        // TEST 6: Event System Integration
        // ====================================================================
        Logger.info(`\n📡 [6/7] Event System Integration...`);
        if (!this.entity.fire || typeof this.entity.fire !== 'function') {
            issues.push('❌ Entity has no fire() method - events broken');
            Logger.error('❌ Entity has no fire() method - events broken');
        } else {
            checks.push('✅ Event system available');
            Logger.info('✅ Event system available');
        }
        // ====================================================================
        // TEST 7: Physics Integration
        // ====================================================================
        Logger.info(`\n⚛️ [7/7] Physics Integration...`);
        const rigidbody = this.components.rigidbody;
        const collision = this.components.collision;
        if (!rigidbody) {
            issues.push('❌ No rigidbody - AI cannot interact with physics');
            Logger.error('❌ No rigidbody - AI cannot interact with physics');
        } else if (!rigidbody.enabled) {
            issues.push('❌ Rigidbody is DISABLED');
            Logger.error('❌ Rigidbody is DISABLED');
        } else {
            checks.push('✅ Rigidbody enabled');
            const type = rigidbody.type;
            const typeStr = typeof type === 'string' ? type : type === 1 ? 'kinematic' : type === 0 ? 'static' : 'dynamic';
            if (typeStr !== 'kinematic' && type !== 1) {
                warnings.push(`⚠️ Rigidbody is ${typeStr} - should be kinematic`);
                Logger.warn(`⚠️ Rigidbody is ${typeStr} - should be kinematic`);
            } else {
                checks.push('✅ Rigidbody type: kinematic');
            }
        }
        if (!collision) {
            issues.push('❌ No collision component');
            Logger.error('❌ No collision component');
        } else {
            checks.push('✅ Collision component exists');
        }
        // ====================================================================
        // FINAL REPORT
        // ====================================================================
        Logger.info(`\n${'='.repeat(80)}`);
        Logger.info(`🏗️ ARCHITECTURAL INTEGRITY REPORT`);
        Logger.info(`${'='.repeat(80)}`);
        Logger.info(`✅ Checks Passed: ${checks.length}`);
        Logger.info(`⚠️ Warnings: ${warnings.length}`);
        Logger.info(`❌ Critical Issues: ${issues.length}`);
        if (issues.length > 0) {
            Logger.info(`\n❌ CRITICAL ARCHITECTURAL ISSUES:`);
            issues.forEach((issue)=>Logger.error(`   ${issue}`));
        }
        if (warnings.length > 0) {
            Logger.info(`\n⚠️ ARCHITECTURAL WARNINGS:`);
            warnings.forEach((warning)=>Logger.warn(`   ${warning}`));
        }
        Logger.info(`\n${'='.repeat(80)}\n`);
        this.diagnosticResults.architecturalIssues = issues;
        this.diagnosticResults.architecturalWarnings = warnings;
        this.diagnosticResults.architecturalChecks = checks;
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES
        // ============================================================================
        /** @attribute @type {boolean} @default true @title Enable Diagnostics */ _define_property(this, "enabled", true);
        /** @attribute @type {string} @default 'full' @enum [{"Quick Check":"quick"},{"Standard":"standard"},{"Full Analysis":"full"},{"Deep Inspection":"deep"}] @title Diagnostic Level */ _define_property(this, "diagnosticLevel", 'full');
        /** @attribute @type {boolean} @default true @title Test YUKA Integration */ _define_property(this, "testYukaIntegration", true);
        /** @attribute @type {boolean} @default true @title Test Physics System */ _define_property(this, "testPhysics", true);
        /** @attribute @type {boolean} @default true @title Test Navigation */ _define_property(this, "testNavigation", true);
        /** @attribute @type {boolean} @default true @title Test Goal System */ _define_property(this, "testGoalSystem", true);
        /** @attribute @type {boolean} @default true @title Test State Machine */ _define_property(this, "testStateMachine", true);
        /** @attribute @type {boolean} @default true @title Test Perception */ _define_property(this, "testPerception", true);
        /** @attribute @type {boolean} @default true @title Test Animation Sync */ _define_property(this, "testAnimation", true);
        /** @attribute @type {boolean} @default true @title Test Performance */ _define_property(this, "testPerformance", true);
        /** @attribute @type {boolean} @default true @title Monitor Flickering */ _define_property(this, "monitorFlickering", true);
        /** @attribute @type {number} @default 60 @title Report Interval (frames) */ _define_property(this, "reportInterval", 60);
        /** @attribute @type {boolean} @default false @title Auto-Fix Issues */ _define_property(this, "autoFixIssues", false);
    }
}
_define_property(AISystemDiagnostics, "scriptName", 'aiSystemDiagnostics');

export { AISystemDiagnostics };
