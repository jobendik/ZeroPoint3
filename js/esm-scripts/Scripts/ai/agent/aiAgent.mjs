import { Script, BODYGROUP_DYNAMIC, BODYMASK_ALL, BODYTYPE_KINEMATIC } from '../../../../playcanvas-stable.min.mjs';
import { AgentCore } from './AgentCore.mjs';
import { AgentBehavior } from './AgentBehavior.mjs';
import { aiCoordinationSystem } from '../combat/AICoordinationSystem.mjs';
import { AIPlayerProfile } from '../../core/systems/multiplayer/AIPlayerProfile.mjs';
import { AnimationController } from '../behavior/AnimationController.mjs';

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
/* global Logger */ class AiAgent extends Script {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        // ✅ CRITICAL FIX: Rotate AI agent 180° FIRST, before any other checks
        // The imported model faces backwards, so we flip it once at initialization
        // This must happen BEFORE creating AgentCore so YUKA vehicle gets correct rotation
        if (!this.__rotationCorrectionApplied) {
            const currentRotation = this.entity.getEulerAngles();
            this.entity.setEulerAngles(currentRotation.x, currentRotation.y + 180, currentRotation.z);
            this.__rotationCorrectionApplied = true;
            Logger.info(`[${this.entity.name}] ✅ Applied 180° rotation correction to face forward`);
        }
        // Prevent double initialization
        if (this.__aiAgentInitialized === true) {
            Logger.debug(`[${this.entity.name}] Already initialized - skipping duplicate init`);
            return;
        }
        const name = this.entity.name || 'AIAgent';
        console.log(`[aiAgent] 🔥 Initialize called for ${name}`);
        Logger.debug(`[${name}] ESM AI Agent initialize() starting...`);
        this.__aiAgentInitialized = false;
        // ============================================================================
        // PLAYER PROFILE (for UI/scoreboard disguise)
        // ============================================================================
        this.profile = new AIPlayerProfile();
        Logger.debug(`[${name}] 🎭 AI Disguise: "${this.profile.getDisplayName()}" (${this.profile.platform}, ${this.profile.ping}ms, Lvl ${this.profile.level})`);
        // Initialize navigation flag (will be set by AgentNavigationAdapter)
        this.navigationReady = false;
        // Initialize utilities object (will be populated by NavigationAdapter and AgentBehavior)
        this.utilities = {};
        // Initialize state properties for YUKA state machine
        // These must be on the aiAgent instance, not nested objects
        this.alertness = 0;
        this.morale = 1.0;
        this.combatTimer = 0;
        this.lastStrafeTime = 0;
        this.strafeDirection = 0;
        this.isInCover = false;
        this.investigationTarget = null;
        // ✅ YUKA OPTIMIZATION: Track current game time for memory system
        this.currentTime = 0;
        // ✅ FIX: Track death state to prevent spam logging
        this._hasLoggedDeath = false;
        // ✅ FIX: Ensure proper collision and team setup EARLY
        this._ensureCollisionSetup();
        // Initialize modular components
        this.agentCore = new AgentCore(this);
        this.agentBehavior = new AgentBehavior(this, this.agentCore);
        // ✅ NEW: Initialize animation controller
        this.animationController = new AnimationController(this);
        // Initialize core systems
        this.agentCore.initialize();
        // Initialize behavior systems
        this.agentBehavior.initialize();
        // ✅ NEW: Initialize animations (after entity is ready) with error handling
        try {
            Logger.debug(`[${name}] Attempting to initialize AnimationController...`);
            const animInitResult = this.animationController.initialize();
            Logger.debug(`[${name}] AnimationController.initialize() returned: ${animInitResult}`);
        } catch (error) {
            Logger.error(`[${name}] ❌ AnimationController initialization failed:`, error);
            console.error(`[${name}] AnimationController error:`, error);
        }
        // Set up initialization completion callback
        this.agentCore.onInitComplete(()=>{
            this._completeInitialization();
        });
    }
    // ✅ NEW: Ensure AI has proper collision setup
    _ensureCollisionSetup() {
        const name = this.entity.name;
        // Set team tags early
        this.entity.team = 'ai';
        if (!this.entity.tags.has('team_ai')) {
            this.entity.tags.add('team_ai');
        }
        if (!this.entity.tags.has('damageable')) {
            this.entity.tags.add('damageable');
        }
        if (!this.entity.tags.has('ai')) {
            this.entity.tags.add('ai');
        }
        // ✅ FIX: VERIFY collision component (created in editor, NOT programmatically)
        if (!this.entity.collision) {
            Logger.error(`[${name}] ❌ NO COLLISION COMPONENT! Please add one in the PlayCanvas editor.`);
        } else if (!this.entity.collision.enabled) {
            Logger.warn(`[${name}] Collision component is disabled - enabling it`);
            this.entity.collision.enabled = true;
            Logger.info(`[${name}] ✅ Collision component enabled`);
        } else {
            Logger.info(`[${name}] ✅ Collision component exists (type=${this.entity.collision.type}, trigger=${!!this.entity.collision.trigger})`);
        }
        // ✅ FIX: VERIFY rigidbody component (created in editor, NOT programmatically)
        if (!this.entity.rigidbody) {
            Logger.error(`[${name}] ❌ NO RIGIDBODY COMPONENT! Please add one in the PlayCanvas editor.`);
        } else {
            Logger.info(`[${name}] ✅ Rigidbody component exists (type=${this.entity.rigidbody.type}, enabled=${this.entity.rigidbody.enabled})`);
        }
        // ✅ CRITICAL FIX: Configure physics immediately, no delay!
        // Physics body must exist before combat starts
        this._configureRigidbodyPhysics();
        Logger.info(`[${name}] Collision setup check:`, {
            hasCollision: !!this.entity.collision,
            hasRigidbody: !!this.entity.rigidbody,
            team: this.entity.team,
            tags: this.entity.tags.list()
        });
    }
    /**
     * Configure rigidbody physics body (called immediately to ensure body exists)
     */ _configureRigidbodyPhysics() {
        const name = this.entity.name;
        if (!this.entity || !this.entity.rigidbody) {
            Logger.warn(`[${name}] Entity or rigidbody destroyed before physics config`);
            return;
        }
        // ✅ CRITICAL FIX: Configure physics immediately when enabled
        // Don't defer - physics body must exist for raycasts to work!
        if (!this.entity.enabled) {
            Logger.info(`[${name}] Entity disabled - setting up enable listener for physics config`);
            // Set up a one-time enable listener
            this.entity.once('enable', ()=>{
                // Configure immediately on enable, no delay!
                this._configureRigidbodyPhysics();
            });
            return;
        }
        const KINEMATIC_TYPE = BODYTYPE_KINEMATIC;
        // Check if physics body exists
        const hadBody = !!this.entity.rigidbody.body;
        Logger.info(`[${name}] Physics body exists before config: ${hadBody}`);
        // ✅ CRITICAL: Set collision group and mask FIRST
        // These must be set before enabling for proper physics world registration
        this.entity.rigidbody.group = BODYGROUP_DYNAMIC;
        this.entity.rigidbody.mask = BODYMASK_ALL;
        // Force recreate physics body if needed
        if (!hadBody || !this.entity.rigidbody.enabled) {
            // Disable first if enabled
            if (this.entity.rigidbody.enabled) {
                this.entity.rigidbody.enabled = false;
            }
            // Set type while disabled (kinematic property is read-only, derived from type)
            this.entity.rigidbody.type = KINEMATIC_TYPE;
            // Re-enable to create physics body
            this.entity.rigidbody.enabled = true;
        }
        // Verify physics body was created
        const hasBodyNow = !!this.entity.rigidbody.body;
        const typeNames = {
            1: 'kinematic',
            2: 'dynamic',
            4: 'static'
        };
        const typeName = typeNames[this.entity.rigidbody.type] || this.entity.rigidbody.type;
        Logger.info(`[${name}] Physics body exists after config: ${hasBodyNow}`);
        Logger.info(`[${name}] Rigidbody: type=${typeName}, group=${this.entity.rigidbody.group}, mask=${this.entity.rigidbody.mask}`);
        // ✅ CRITICAL FIX: Freeze X and Z rotation to prevent tilting (only allow Y-axis rotation)
        // This prevents physics from making AI agents fall over or tilt backward
        if (this.entity.rigidbody.body) {
            // Set angular factor to allow ONLY Y-axis rotation
            // angularFactor: (X, Y, Z) where 0 = locked, 1 = free
            // MUST use Ammo.btVector3 object, not individual parameters!
            const angularFactor = new Ammo.btVector3(0, 1, 0); // Lock X and Z, free Y
            this.entity.rigidbody.body.setAngularFactor(angularFactor);
            Ammo.destroy(angularFactor); // Clean up Ammo object
            // Also set linear factor for XZ movement only (lock Y to prevent flying)
            const linearFactor = new Ammo.btVector3(1, 0, 1); // Allow X and Z, lock Y
            this.entity.rigidbody.body.setLinearFactor(linearFactor);
            Ammo.destroy(linearFactor); // Clean up Ammo object
            Logger.info(`[${name}] ✅ Rotation constraints applied: Y-axis only (prevents tilting)`);
        }
        // Teleport to sync position
        if (this.entity.rigidbody.body) {
            const pos = this.entity.getPosition();
            const rot = this.entity.getRotation();
            this.entity.rigidbody.teleport(pos, rot);
            Logger.info(`[${name}] ✅ Physics body configured and synced IMMEDIATELY`);
        } else {
            Logger.error(`[${name}] ❌ Physics body doesn't exist after enable!`);
            Logger.error(`[${name}] This entity will NOT be detectable by raycasts!`);
        }
    }
    // ============================================================================
    // POST-INITIALIZATION
    // ============================================================================
    postInitialize() {
        const name = this.entity.name;
        Logger.debug(`[${name}] ESM postInitialize() - verifying system initialization`);
        // ✅ FIX: Ensure physics is configured immediately, not deferred
        this._ensureCollisionSetup();
        // Store reference to visual root for animation controller
        this._setupVisualRotationSeparation();
        // Verify systems are set up correctly (keep diagnostic delay for non-critical checks)
        this._verifySystemsInitialized();
    }
    /**
     * Store reference to visual root entity for AnimationController
     * The visual root contains the model and skeleton hierarchy
     */ _setupVisualRotationSeparation() {
        const name = this.entity.name;
        // Find the model mesh entity (the visual geometry)
        let modelEntity = this.entity.findByName('ely_vanguardsoldier_kerwinatienza_Mesh') || this.entity.findByName('characterModel') || this.entity.children.find((c)=>c.model);
        if (!modelEntity) {
            Logger.warn(`[${name}] ⚠️ No model entity found`);
            return;
        }
        // Store reference for animation controller to use
        this.visualRoot = modelEntity;
        Logger.info(`[${name}] ✅ Visual root: "${modelEntity.name}"`);
    }
    /**
     * Verify systems are properly initialized (diagnostic only)
     */ _verifySystemsInitialized() {
        const name = this.entity.name;
        // Give systems a moment to complete async initialization
        setTimeout(()=>{
            const wsReady = this.agentCore?.isWeaponSystemReady();
            const ws = this.weaponSystem;
            if (!ws) {
                Logger.error(`[${name}] ⚠️⚠️⚠️ FINAL CHECK: No weapon system found!`);
                Logger.error(`[${name}]   Please attach weaponSystem script to AI entity in editor.`);
            } else if (!wsReady) {
                Logger.error(`[${name}] ⚠️⚠️⚠️ FINAL CHECK: Weapon system exists but not ready!`);
                Logger.error(`[${name}]   Initialized: ${ws._initialized ? 'YES' : 'NO'}`);
                Logger.error(`[${name}]   Booted: ${ws.__wsBooted ? 'YES' : 'NO'}`);
                Logger.error(`[${name}]   Weapons: ${ws.weapons ? Object.keys(ws.weapons).length : 0}`);
                if (ws.weapons) {
                    const unlocked = Object.keys(ws.weapons).filter((k)=>ws.weapons[k]?.unlocked);
                    Logger.error(`[${name}]   Unlocked: ${unlocked.length} (${unlocked.join(', ')})`);
                }
            } else {
                Logger.info(`[${name}] ✅ All systems verified and ready for combat!`);
            }
        }, 500);
    }
    // ============================================================================
    // INITIALIZATION COMPLETION
    // ============================================================================
    async _completeInitialization() {
        const name = this.entity.name;
        Logger.info(`[${name}] ESM AI Agent initialization complete!`);
        // Initialize YUKA brain (async to load evaluators)
        await this.agentBehavior.initializeBrain();
        // Mark as fully initialized
        this.__aiAgentInitialized = true;
        // 🤖 NEW: Register with AI Coordination System for squad tactics
        try {
            aiCoordinationSystem.registerAgent(this);
            Logger.debug(`[${name}] ✅ Registered with AI Coordination System`);
        } catch (error) {
            Logger.warn(`[${name}] Failed to register with coordination system:`, error);
        }
        // Fire ready events
        this.entity.fire('ai:agent:ready', this);
        this.app.fire('ai:agent:ready', this);
        this.app.fire('ai:agent:spawned', this.entity);
        Logger.info(`[${name}] ✅ AI Agent fully operational`);
        // Final weapon check
        if (!this.weaponSystem || !this.weaponSystem.currentWeapon) {
            Logger.error(`[${name}] ⚠️⚠️⚠️ FINAL CHECK: AI agent is operational but has NO WEAPON!`);
            Logger.error(`   The AI will NOT be able to engage in combat without fixing the weapon system.`);
        }
    }
    // ============================================================================
    // PUBLIC API - CORE ACCESSORS
    // ============================================================================
    // YUKA system accessors (CRITICAL for subsystems!)
    get yukaVehicle() {
        return this.agentCore?.getVehicle();
    }
    get vision() {
        return this.agentCore?.core?.vision;
    }
    get memorySystem() {
        return this.agentCore?.core?.memorySystem;
    }
    get memoryRecords() {
        return this.memorySystem?.records || [];
    }
    // Timing method (CRITICAL for subsystems!)
    _getGameTime() {
        return this.agentCore?.core?.getTime() || performance.now() / 1000;
    }
    // Core system accessors
    get core() {
        return this.agentCore?.core;
    }
    get weaponSystem() {
        return this.agentCore?.weaponSystem;
    }
    get healthSystem() {
        return this.agentCore?.healthSystem;
    }
    // Behavior system accessors  
    get visionSystem() {
        return this.agentBehavior?.getVisionSystem();
    }
    get targetingSystem() {
        return this.agentBehavior?.getTargetingSystem();
    }
    get targetSystem() {
        return this.agentBehavior?.getTargetingSystem();
    }
    get combatSystem() {
        return this.agentBehavior?.getCombatSystem();
    }
    get stateManager() {
        return this.agentBehavior?.getStateManager();
    }
    get stateChangeManager() {
        return this.agentBehavior?.getStateManager();
    }
    get emotionalSystem() {
        return this.agentBehavior?.getEmotionalSystem();
    }
    get brain() {
        return this.agentBehavior?.getBrain();
    }
    get stateMachine() {
        return this.agentBehavior?.getStateMachine();
    }
    // Classic system references (for backward compatibility)
    get fuzzyLogic() {
        return this.agentBehavior?.fuzzyLogic;
    }
    get personality() {
        return this.agentBehavior?.personality;
    }
    get weaponSelector() {
        return this.agentBehavior?.weaponSelector;
    }
    get combatTactics() {
        return this.agentBehavior?.combatTactics;
    }
    // Health accessor for compatibility
    get health() {
        return this.healthSystem?.currentHealth || this.maxHealth;
    }
    // ============================================================================
    // NAVIGATION INTERFACE - CRITICAL FOR GOALS AND BEHAVIORS
    // ============================================================================
    /**
     * Navigation object accessor - provides direct access to navigation methods
     * This is the primary interface used by YUKA goals
     */ get navigation() {
        return this.agentCore?.navigation || null;
    }
    /**
     * Check if agent is currently moving
     * Required by DirectApproachGoal and other movement goals
     */ isMoving() {
        return this.navigation?.isMoving ? this.navigation.isMoving() : false;
    }
    /**
     * Check if agent has reached destination
     * Required by DirectApproachGoal
     */ isAtDestination() {
        return this.navigation?.isAtDestination ? this.navigation.isAtDestination() : true;
    }
    /**
     * Move to target position using navigation
     * Wrapper for navigation.moveTo()
     */ moveTo(targetPos) {
        if (!this.navigation || !this.navigationReady) {
            Logger.warn(`[${this.entity.name}] Cannot move - navigation not ready`);
            return false;
        }
        return this.navigation.moveTo(targetPos);
    }
    /**
     * Stop all movement
     * Wrapper for navigation.stopMovement()
     */ stopMovement() {
        if (this.navigation) {
            this.navigation.stopMovement();
        }
    }
    /**
     * Find valid navigation mesh position
     * Wrapper for navigation.findValidNavMeshPosition()
     */ findValidNavMeshPosition(pos, searchRadius = 1) {
        if (!this.navigation || !this.navigationReady) {
            return null;
        }
        return this.navigation.findValidNavMeshPosition(pos, searchRadius);
    }
    /**
     * Find random position on navmesh
     * Wrapper for navigation.findValidRandomPosition()
     */ findValidRandomPosition(minDist = 5, maxDist = 20) {
        if (!this.navigation || !this.navigationReady) {
            return null;
        }
        return this.navigation.findValidRandomPosition(minDist, maxDist);
    }
    /**
     * Find cover position away from threat
     * Wrapper for navigation.findValidCoverPosition()
     */ findValidCoverPosition(threatPos = null) {
        if (!this.navigation || !this.navigationReady) {
            return null;
        }
        return this.navigation.findValidCoverPosition(threatPos);
    }
    /**
     * Generate tactical position based on type
     * Wrapper for navigation.generateSafeTacticalPosition()
     */ generateSafeTacticalPosition(origin, direction, distance, tacticType = 'tactical') {
        if (!this.navigation || !this.navigationReady) {
            return null;
        }
        return this.navigation.generateSafeTacticalPosition(origin, direction, distance, tacticType);
    }
    // ============================================================================
    // UPDATE LOOP - ✅ FIXED
    // ============================================================================
    update(dt) {
        // 🔥 EMERGENCY DEBUG: Log if update is called
        if (!this._updateLogCount) this._updateLogCount = 0;
        this._updateLogCount++;
        if (this._updateLogCount % 60 === 1) {
            console.log(`[${this.entity.name}] ⏰ AI UPDATE CALLED (#${this._updateLogCount}), isPaused=${this.isPaused}, initialized=${this.__aiAgentInitialized}, coreInit=${this.agentCore?.isInitialized()}`);
        }
        if (!this.__aiAgentInitialized) return;
        if (!this.agentCore?.isInitialized()) return;
        // ✅ CRITICAL: Check if agent is dead - STOP ALL UPDATES!
        const healthSystem = this.entity.script?.healthSystem;
        if (healthSystem && healthSystem.healthCore && healthSystem.healthCore.isDead) {
            // Agent is dead - STOP EVERYTHING including animation controller
            // The death animation is controlled by the Animation Component directly via isDead parameter
            // We don't need to update AnimationController when dead!
            // ✅ FIX: Only log death ONCE, not every frame
            if (!this._hasLoggedDeath) {
                console.log(`[aiAgent] 💀 Agent ${this.entity.name} is DEAD - skipping all updates`);
                this._hasLoggedDeath = true;
            }
            return; // Don't update ANYTHING when dead!
        }
        // ✅ Reset death log flag when alive (for respawn)
        this._hasLoggedDeath = false;
        // ✅ CRITICAL FIX: Sync health values to YUKA vehicle for goals/evaluators
        // GetHealthGoal and other systems read agent.health and agent.maxHealth
        const vehicle = this.agentCore?.core?.vehicle;
        if (vehicle && healthSystem?.healthCore) {
            vehicle.health = healthSystem.healthCore.currentHealth || 0;
            vehicle.maxHealth = healthSystem.healthCore.maxHealth || 100;
            // 🔍 DEBUG: Log sync and flag status
            if (!this._lastHealthSyncLog || performance.now() - this._lastHealthSyncLog > 3000) {
                Logger.debug(`[${this.entity.name}] 💉 Health synced to vehicle: ${vehicle.health}/${vehicle.maxHealth}, seeking=${vehicle.isActivelySeekingHealth}`);
                this._lastHealthSyncLog = performance.now();
            }
        }
        // ✅ YUKA OPTIMIZATION: Update game time for memory system
        this.currentTime += dt;
        // ✅ CRITICAL FIX: DO NOT sync PlayCanvas → YUKA here!
        // NavigationBootstrap already handles YUKA vehicle updates via EntityManager
        // Syncing here creates a circular dependency that prevents animation speed calculation
        // The forward vector sync for vision is handled in AgentBehavior instead
        // ✅ UPDATED: Keep AI logic running but check pause state
        // Don't skip update entirely - let AI maintain physics presence
        if (this.isPaused) {
            // 🔥 EMERGENCY DEBUG: Log when paused
            if (this._updateLogCount % 60 === 1) {
                console.log(`[${this.entity.name}] ⏸️ AI IS PAUSED - skipping behavior updates`);
            }
            // Still update core systems for physics sync, just skip behavior
            if (this.agentCore) {
                this.agentCore.incrementFrame();
                // Ensure physics body stays in sync even when paused
                if (this.entity.rigidbody && !this.entity.rigidbody.enabled) {
                    this.entity.rigidbody.enabled = true;
                    Logger.warn(`[${this.entity.name}] Re-enabled rigidbody during pause`);
                }
            }
            return; // Skip behavior updates when paused
        }
        // Increment frame counter
        this.agentCore.incrementFrame();
        // 🔥 EMERGENCY DEBUG: Log before calling agentBehavior.update
        if (this._updateLogCount % 60 === 1) {
            console.log(`[${this.entity.name}] 🧠 About to call agentBehavior.update(), behaviorInit=${this.agentBehavior?.isInitialized()}`);
        }
        // Update behavior systems
        if (this.agentBehavior?.isInitialized()) {
            this.agentBehavior.update(dt);
        }
        // ✅ NEW: Update animations based on state
        // This runs AFTER NavigationBootstrap has synced YUKA vehicle → PlayCanvas entity
        // So AnimationController will see the actual position change from movement
        if (this.animationController) {
            this.animationController.update(dt);
        }
    }
    // ============================================================================
    // PUBLIC METHODS
    // ============================================================================
    /**
     * Record damage for emotional system
     */ recordDamage() {
        this.agentBehavior?.recordDamage();
    }
    // ============================================================================
    // DAMAGE HANDLING - Called by HealthSystem
    // ============================================================================
    /**
     * Called by HealthEvents when AI takes damage
     * This is the entry point from the health system
     */ takeDamage(damage, attacker) {
        const name = this.entity.name || 'AIAgent';
        // Extract attacker entity
        let attackerEntity = null;
        let attackerName = 'Unknown';
        if (attacker) {
            if (attacker.entity) {
                attackerEntity = attacker.entity;
                attackerName = attackerEntity.name || 'Unknown Entity';
            } else if (attacker.name) {
                attackerEntity = attacker;
                attackerName = attacker.name;
            }
        }
        // Call EventHandler to process damage reaction
        if (this.agentBehavior?.eventHandler) {
            try {
                this.agentBehavior.eventHandler.onDamage(damage, attacker);
            } catch (error) {
                Logger.error(`[${name}] Error in eventHandler.onDamage():`, error);
            }
        }
        // Backup: Force target the attacker directly
        if (attackerEntity && this.targetSystem?.forceTarget) {
            try {
                this.targetSystem.forceTarget({
                    entity: attackerEntity
                });
            } catch (error) {
                Logger.error(`[${name}] Error in targetSystem.forceTarget():`, error);
            }
        }
        // Force combat state transition if not already in combat
        if (this.stateMachine) {
            const currentState = this.stateMachine.currentState?.type || 'unknown';
            if (currentState !== 'combat') {
                try {
                    this.stateMachine.changeTo('combat');
                } catch (error) {
                    Logger.error(`[${name}] Error changing to combat state:`, error);
                }
            }
        }
        Logger.combat(`[${name}] Took ${damage} damage from ${attackerName}`);
    }
    // ============================================================================
    // YUKA VISION SYSTEM CALLBACKS
    // ============================================================================
    /**
     * Called when enemy is spotted by vision system
     */ onEnemySpotted(target) {
        const targetName = target?.entity?.name || 'Unknown';
        Logger.aiState(`[${this.entity.name}] 🎯 Enemy spotted: ${targetName} - Engaging!`);
        // Play alert sound if sound system exists
        if (this.entity.sound) {
            // Play alert sound asset if configured
            const alertSlot = this.entity.sound.slot('alert');
            if (alertSlot) {
                alertSlot.play();
            }
        }
        // Increase alertness
        this.alertness = Math.min(1.0, this.alertness + 0.3);
        // Fire event for other systems
        this.entity.fire('ai:enemy:spotted', target);
    }
    /**
     * Alias used by VisionSystem callbacks; forwards to onEnemySpotted
     */ onTargetSpotted(target) {
        this.onEnemySpotted(target);
    }
    /**
     * Called when target is lost from sight
     */ onTargetLost(target) {
        const targetName = target?.entity?.name || target?.name || 'Unknown';
        Logger.aiState(`[${this.entity.name}] ❓ Target lost: ${targetName} - Beginning search`);
        // Play search sound if sound system exists
        if (this.entity.sound) {
            const searchSlot = this.entity.sound.slot('search');
            if (searchSlot) {
                searchSlot.play();
            }
        }
        // Fire event for other systems
        this.entity.fire('ai:target:lost', target);
    }
    /**
     * Called when switching between targets
     */ onTargetSwitched(oldTarget, newTarget) {
        const oldName = oldTarget?.entity?.name || 'None';
        const newName = newTarget?.entity?.name || 'Unknown';
        Logger.aiDetail(`[${this.entity.name}] 🔄 Target switched: ${oldName} → ${newName}`);
        // Fire event for other systems
        this.entity.fire('ai:target:switched', {
            oldTarget,
            newTarget
        });
    }
    // ============================================================================
    // PLAYER PROFILE HELPERS
    // ============================================================================
    /**
     * Get the AI's display name (with clan tag if applicable)
     * Use this in UI, scoreboards, killfeed instead of entity.name
     */ getDisplayName() {
        return this.profile ? this.profile.getDisplayName() : this.entity.name;
    }
    /**
     * Get the AI's profile data for scoreboards/UI
     */ getProfileData() {
        if (!this.profile) return null;
        return {
            name: this.profile.getDisplayName(),
            platform: this.profile.platform,
            ping: this.profile.ping,
            level: this.profile.level,
            isBot: true // For debugging/admin view
        };
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        const name = this.entity.name;
        Logger.debug(`[${name}] ESM AI Agent destroy() called`);
        // 🤖 NEW: Unregister from AI Coordination System
        try {
            aiCoordinationSystem.unregisterAgent(this);
            Logger.debug(`[${name}] ✅ Unregistered from AI Coordination System`);
        } catch (error) {
            Logger.warn(`[${name}] Failed to unregister from coordination system:`, error);
        }
        // Clean up behavior systems
        if (this.agentBehavior) {
            this.agentBehavior.destroy();
            this.agentBehavior = null;
        }
        // Clean up animation controller
        if (this.animationController) {
            this.animationController.destroy();
            this.animationController = null;
        }
        // Clean up core systems
        if (this.agentCore) {
            this.agentCore.destroy();
            this.agentCore = null;
        }
        // Fire destroy event
        this.app.fire('ai:agent:destroyed', this.entity);
        this.__aiAgentInitialized = false;
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES
        // ============================================================================
        /** @attribute @type {number} @title Max Health */ _define_property(this, "maxHealth", 100);
        /** @attribute @type {number} @title Vision Range */ _define_property(this, "visionRange", 25);
        /** @attribute @type {number} @title Vision Angle (degrees) */ _define_property(this, "visionAngle", 75);
        /** @attribute @type {number} @title Memory Span (seconds) */ _define_property(this, "memorySpan", 8);
        /** @attribute @type {number} @title Reaction Time (seconds) */ _define_property(this, "reactionTime", 0.4);
        /** @attribute @type {number} @title Aim Accuracy (0-1) */ _define_property(this, "aimAccuracy", 0.75);
        /** @attribute @type {pc.Entity} @title Character Model */ _define_property(this, "characterModel", null);
        /** @attribute @type {number} @title Aggressiveness (0-1) */ _define_property(this, "aggressiveness", 0.7);
        /** @attribute @type {number} @title Curiosity (0-1) */ _define_property(this, "curiosity", 0.5);
        /** @attribute @type {number} @title Cautiousness (0-1) */ _define_property(this, "cautiousness", 0.6);
        /** @attribute @type {number} @title Move Speed */ _define_property(this, "moveSpeed", 3);
    }
}
_define_property(AiAgent, "scriptName", 'aiAgent');

export { AiAgent };
