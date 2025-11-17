import { app, Vec3, ANIM_PARAMETER_INTEGER } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { ProgrammaticAnimationGraph } from './ProgrammaticAnimationGraph.mjs';

class AnimationController {
    /**
     * Initialize animation controller - finds anim component and sets up defaults
     */ initialize() {
        console.log(`[${this.entity.name}] 🎬 AnimationController.initialize() - PROGRAMMATIC MODE`);
        Logger.info(`[${this.entity.name}] 🎬 AnimationController.initialize() - PROGRAMMATIC MODE`);
        // Find animation component on entity or children
        this.animComponent = this._findAnimationComponent();
        if (!this.animComponent) {
            console.warn(`[${this.entity.name}] ⚠️ No animation component found - animations disabled`);
            Logger.warn(`[${this.entity.name}] ⚠️ No animation component found - animations disabled`);
            return false;
        }
        console.log(`[${this.entity.name}] ✅ Found animation component`);
        // ✅ BYPASS THE BROKEN ASSET - Create state graph programmatically!
        console.log(`[${this.entity.name}] 🚀 Creating animation state graph from code (bypassing PlayCanvas Editor asset)...`);
        // Get animation clips from the animation component's existing animations
        // These should be loaded from the model GLB file
        const animationAssets = this._findAnimationClips();
        // Load the programmatic state graph
        const success = ProgrammaticAnimationGraph.loadAnimationGraph(this.animComponent, animationAssets);
        if (!success) {
            console.error(`[${this.entity.name}] ❌ Failed to load programmatic animation graph!`);
            return false;
        }
        console.log(`[${this.entity.name}] ✅ Programmatic animation graph created successfully!`);
        // ✅ CRITICAL: Ensure animation component is enabled and playing!
        if (!this.animComponent.enabled) {
            this.animComponent.enabled = true;
            console.log(`[${this.entity.name}] Enabled animation component`);
            Logger.info(`[${this.entity.name}] Enabled animation component`);
        }
        // ✅ CRITICAL: Start playing the animation state machine!
        if (this.animComponent.playing === false) {
            this.animComponent.playing = true;
            console.log(`[${this.entity.name}] Started animation playback`);
            Logger.info(`[${this.entity.name}] Started animation playback`);
        }
        // ✅ DIAGNOSTIC: Check current state
        console.log(`[${this.entity.name}] � After setup: activeState="${this.animComponent.baseLayer?.activeState}" activeStateName="${this.animComponent.baseLayer?.activeStateName}" playing=${this.animComponent.playing}`);
        // Parameters should now be available from the programmatic graph
        return this._completeInitialization();
    }
    /**
     * Find animation clips using multiple discovery methods
     * 
     * WHY THIS METHOD EXISTS:
     * ────────────────────────────────────────────────────────────────────────────
     * PlayCanvas has a quirk where GLB animations imported into the Editor don't 
     * automatically populate the animComponent.animationsIndex property on entities.
     * This method works around that limitation by searching the global asset registry.
     * 
     * DISCOVERY PROCESS:
     * ────────────────────────────────────────────────────────────────────────────
     * 1. Check animationsIndex property (usually empty for GLB imports)
     * 2. If empty, search PlayCanvas asset registry for loaded animation assets
     * 3. Match animations by exact filename (idle.glb, walk.glb, etc.)
     * 4. Return object with AnimTrack resources ready for assignment
     * 
     * RETURNS:
     * ────────────────────────────────────────────────────────────────────────────
     * Object with animation clip resources:
     * {
     *   idle: AnimTrack,   // Idle animation resource
     *   walk: AnimTrack,   // Walk animation resource
     *   run: AnimTrack,    // Run animation resource
     *   aim: AnimTrack,    // Aim animation resource
     *   fire: AnimTrack,   // Fire animation resource
     *   jump: AnimTrack    // Jump animation resource (optional)
     * }
     * 
     * ADDING NEW ANIMATIONS:
     * ────────────────────────────────────────────────────────────────────────────
     * 1. Upload animation GLB to PlayCanvas Editor (e.g., crouch.glb)
     * 2. Add search condition below in Method 2:
     * 
     *    else if (lowerName === 'crouch.glb' && !clips.crouch) {
     *      clips.crouch = asset.resource;
     *      console.log(`[${this.entity.name}]     ✅ Found Crouch animation`);
     *    }
     * 
     * 3. Use returned clip in ProgrammaticAnimationGraph.loadAnimationGraph()
     * ────────────────────────────────────────────────────────────────────────────
     */ _findAnimationClips() {
        console.log(`[${this.entity.name}] 🔍 Searching for animation clips...`);
        const clips = {};
        // Method 1: Check animationsIndex (from GLB animations)
        if (this.animComponent.animationsIndex) {
            const animIndex = this.animComponent.animationsIndex;
            // Try to find clips by common naming conventions
            for(const clipName in animIndex){
                const lowerName = clipName.toLowerCase();
                if (lowerName.includes('idle')) {
                    clips.idle = animIndex[clipName];
                } else if (lowerName.includes('walk')) {
                    clips.walk = animIndex[clipName];
                } else if (lowerName.includes('run') || lowerName.includes('jog')) {
                    clips.run = animIndex[clipName];
                } else if (lowerName.includes('aim')) {
                    clips.aim = animIndex[clipName];
                } else if (lowerName.includes('fire') || lowerName.includes('shoot')) {
                    clips.fire = animIndex[clipName];
                } else if (lowerName.includes('jump')) {
                    clips.jump = animIndex[clipName];
                }
            }
        }
        // Method 2: Search asset registry if animationsIndex was empty
        if (Object.keys(clips).length === 0) {
            const app$1 = app || this.animComponent.system.app;
            if (app$1 && app$1.assets) {
                const allAssets = app$1.assets.list();
                // Prioritize Agent folder animations, exclude FPS arms
                const agentAnimAssets = allAssets.filter((asset)=>asset.type === 'animation' && asset.loaded && asset.resource && asset.path && asset.path.includes('Characters/Agent/Animations'));
                const animAssets = agentAnimAssets.length > 0 ? agentAnimAssets : allAssets.filter((asset)=>asset.type === 'animation' && asset.loaded && asset.resource && !asset.path?.includes('FPS') && !asset.name?.toLowerCase().includes('fps'));
                for (const asset of animAssets){
                    const lowerName = asset.name.toLowerCase();
                    // Core animations
                    if (lowerName.includes('idle') && !clips.idle && !lowerName.includes('crouch') && !lowerName.includes('aim')) {
                        clips.idle = asset.resource;
                    } else if (lowerName === 'aiming_idle.glb' && !clips.aimingIdle) {
                        clips.aimingIdle = asset.resource;
                    } else if (lowerName.includes('walk') && !clips.walk && !lowerName.includes('crouch')) {
                        clips.walk = asset.resource;
                    } else if ((lowerName.includes('run') || lowerName.includes('jog')) && !clips.run) {
                        clips.run = asset.resource;
                    } else if ((lowerName.includes('aim') || lowerName.includes('aiming')) && !clips.aim && !lowerName.includes('idle') && !lowerName.includes('walk')) {
                        clips.aim = asset.resource;
                    } else if ((lowerName.includes('fire') || lowerName.includes('shoot')) && !clips.fire) {
                        clips.fire = asset.resource;
                    } else if ((lowerName.includes('death') || lowerName.includes('die') || lowerName.includes('dying')) && !clips.death) {
                        clips.death = asset.resource;
                    } else if (lowerName.includes('reload') && !clips.reload) {
                        clips.reload = asset.resource;
                    } else if (lowerName.includes('strafe') && lowerName.includes('left') && !clips.strafeLeft) {
                        clips.strafeLeft = asset.resource;
                    } else if (lowerName.includes('strafe') && lowerName.includes('right') && !clips.strafeRight) {
                        clips.strafeRight = asset.resource;
                    } else if ((lowerName.includes('hit') || lowerName.includes('damage')) && !clips.hitReaction) {
                        clips.hitReaction = asset.resource;
                    } else if (lowerName.includes('crouch') && lowerName.includes('idle') && !clips.crouchIdle) {
                        clips.crouchIdle = asset.resource;
                    } else if (lowerName.includes('crouch') && lowerName.includes('walk') && !clips.crouchWalk) {
                        clips.crouchWalk = asset.resource;
                    } else if (lowerName === 'stand_to_crouch.glb' && !clips.standToCrouch) {
                        clips.standToCrouch = asset.resource;
                    } else if (lowerName === 'crouch_to_stand.glb' && !clips.crouchToStand) {
                        clips.crouchToStand = asset.resource;
                    } else if (lowerName === 'dodge.glb' && !clips.dodge) {
                        clips.dodge = asset.resource;
                    } else if (lowerName.includes('jump') && !clips.jump) {
                        clips.jump = asset.resource;
                    } else if (lowerName.includes('backpedal') && !clips.backpedal) {
                        clips.backpedal = asset.resource;
                    } else if (lowerName.includes('peek') && lowerName.includes('left') && !clips.peekLeft) {
                        clips.peekLeft = asset.resource;
                    } else if (lowerName.includes('peek') && lowerName.includes('right') && !clips.peekRight) {
                        clips.peekRight = asset.resource;
                    } else if (lowerName.includes('melee') && !clips.melee) {
                        clips.melee = asset.resource;
                    } else if (lowerName.includes('throw') && !clips.throwGrenade) {
                        clips.throwGrenade = asset.resource;
                    } else if (lowerName.includes('sprint') && !clips.sprint) {
                        clips.sprint = asset.resource;
                    }
                }
            }
        }
        console.log(`[${this.entity.name}] Found ${Object.keys(clips).length} animation clips: ${Object.keys(clips).join(', ')}`);
        // Check for missing required animations
        const required = [
            'idle',
            'walk',
            'fire',
            'death'
        ];
        const missing = required.filter((anim)=>!clips[anim]);
        if (missing.length > 0) {
            console.error(`[${this.entity.name}] ❌ Missing required animations: ${missing.join(', ')}`);
        }
        return clips;
    }
    /**
     * Complete initialization once parameters are loaded
     */ _completeInitialization() {
        // Only log if there's a configuration issue
        if (this.entity !== this.animComponent.entity) {
            console.warn(`[${this.entity.name}] ⚠️ Animation component is on different entity: ${this.animComponent.entity.name}`);
        }
        // ✅ NOTE: We use programmatic animation graphs (no _stateGraphAsset needed)
        // The check below is intentionally removed because we bypass Editor assets
        if (!this.animComponent.baseLayer) {
            console.error(`[${this.entity.name}] ❌ No base layer found!`);
            return false;
        }
        // Initialize parameters to default values
        this._initializeParameters();
        // Set initial state
        this._setState('Idle');
        this._initialized = true;
        this._waitingForParameters = false;
        console.log(`[${this.entity.name}] ✅ AnimationController initialized`);
        Logger.debug(`[${this.entity.name}] ✅ AnimationController initialized (enabled=${this.animComponent.enabled}, playing=${this.animComponent.playing})`);
        return true;
    }
    /**
     * Find animation component on entity or children
     */ _findAnimationComponent() {
        // ✅ PRIORITIZE: Animation component on visual root (rotation-separated)
        if (this.agent.visualRoot && this.agent.visualRoot.anim) {
            Logger.info(`[${this.entity.name}] Using animation component from visual root (rotation-separated)`);
            return this.agent.visualRoot.anim;
        }
        // Check entity itself
        if (this.entity.anim) {
            return this.entity.anim;
        }
        // Check characterModel if specified
        if (this.agent.characterModel && this.agent.characterModel.anim) {
            return this.agent.characterModel.anim;
        }
        // Search children for anim component
        const findAnim = (entity)=>{
            if (entity.anim) return entity.anim;
            for(let i = 0; i < entity.children.length; i++){
                const found = findAnim(entity.children[i]);
                if (found) return found;
            }
            return null;
        };
        return findAnim(this.entity);
    }
    /**
     * Initialize animation parameters to safe defaults
     * ✅ FULL VERSION: Uses all parameters from ProgrammaticAnimationGraph (ORIGINAL)
     */ _initializeParameters() {
        if (!this.animComponent) return;
        // ✅ CRITICAL: Reset death state FIRST before anything else!
        this._setParameter('isDead', false);
        console.log(`[${this.entity.name}] ✅ FORCED isDead=false on initialization`);
        if (this.animComponent.baseLayer) {
            console.log(`[${this.entity.name}] ℹ️ Current activeState: ${this.animComponent.baseLayer.activeStateName || 'START'}`);
        }
        // Set all parameters to safe defaults
        this._setParameter('speed', 0);
        this._setParameter('isGrounded', true);
        this._setParameter('isAiming', false);
        this._setParameter('isMoving', false);
        this._setParameter('speedMultiplier', 1);
        this.lastPosition = this.entity.getPosition().clone();
        // ✅ CRITICAL FIX: Force the animation graph to start playing by setting initial parameters
        // Set isMoving=false and speed=0 to trigger the Idle state transition
        if (this.animComponent.baseLayer) {
            try {
                // The programmatic graph has transitions from START -> Idle when isMoving=false
                // By setting these parameters, the state machine should transition automatically
                this._setParameter('isMoving', false);
                this._setParameter('speed', 0);
                console.log(`[${this.entity.name}] ✅ Set initial parameters to trigger Idle state transition`);
            } catch (error) {
                console.warn(`[${this.entity.name}] ⚠️ Failed to set initial parameters:`, error);
            }
        }
        console.log(`[${this.entity.name}] 📊 Final parameter state: isDead=false, speed=0, isMoving=false, activeState=${this.animComponent.baseLayer?.activeStateName}`);
    }
    /**
     * Main update loop - call from aiAgent.update()
     */ update(deltaTime) {
        if (!this.animComponent) {
            return;
        }
        // ✅ DEBUG: Log to verify update() is being called
        if (!this._updateCallCount) this._updateCallCount = 0;
        this._updateCallCount++;
        if (this._updateCallCount === 1 || this._updateCallCount % 60 === 0) {
            console.log(`[${this.entity.name}] 🔄 AnimationController.update() #${this._updateCallCount}, _initialized=${this._initialized}, baseLayer.activeStateName=${this.animComponent.baseLayer?.activeStateName}`);
        }
        // ✅ FIX: If waiting for parameters, try to complete initialization
        if (this._waitingForParameters) {
            // NOTE: parameters is an OBJECT, not an array! Check using Object.keys()
            const hasParameters = this.animComponent.parameters && Object.keys(this.animComponent.parameters).length > 0;
            if (hasParameters) {
                console.log(`[${this.entity.name}] ✅ Parameters now loaded! Completing initialization...`);
                this._completeInitialization();
            } else {
                // Still waiting - skip this update (log only once per second to avoid spam)
                if (!this._lastWaitingLogTime || performance.now() - this._lastWaitingLogTime > 1000) {
                    console.warn(`[${this.entity.name}] ⏳ Still waiting for parameters to load...`);
                    this._lastWaitingLogTime = performance.now();
                }
                return;
            }
        }
        if (!this._initialized) {
            return;
        }
        // Rate limiting - only update 10 times per second
        const now = performance.now() / 1000;
        if (now - this.lastUpdateTime < this.updateInterval) {
            return; // Silently skip if rate limited (normal behavior)
        }
        // Calculate actual time elapsed since last animation update
        const actualDeltaTime = this.lastUpdateTime > 0 ? now - this.lastUpdateTime : deltaTime;
        this.lastUpdateTime = now;
        // Calculate movement speed using ACTUAL elapsed time (not frame deltaTime!)
        this._updateMovementSpeed(actualDeltaTime);
        // Update animation based on AI state
        this._updateAnimationFromState();
        // Update animation parameters
        this._updateParameters();
    }
    /**
     * Calculate current movement speed with smoothing to prevent erratic animation
     * ✅ ENHANCED: Now also calculates lateral (strafe) movement
     */ _updateMovementSpeed(deltaTime) {
        const currentPos = this.entity.getPosition();
        if (this.lastPosition) {
            const distance = currentPos.distance(this.lastPosition);
            const rawSpeed = distance / deltaTime;
            // ✅ FIX: Smooth the speed using exponential moving average
            // This prevents rapid fluctuations that cause jerky animations
            const smoothingFactor = 0.3; // Lower = smoother (0.1-0.5 range)
            this.movementSpeed = smoothingFactor * rawSpeed + (1 - smoothingFactor) * this.movementSpeed;
            // ✅ NEW: Calculate lateral (strafe) movement
            // Get entity's forward direction
            const forward = this.entity.forward.clone();
            forward.y = 0; // Ignore vertical component
            forward.normalize();
            // Get movement direction
            const movement = new Vec3().sub2(currentPos, this.lastPosition);
            movement.y = 0; // Ignore vertical component
            if (movement.length() > 0.001) {
                movement.normalize();
                // Get right direction (perpendicular to forward)
                const right = new Vec3().cross(Vec3.UP, forward).normalize();
                // Calculate lateral speed (dot product with right vector)
                const lateralDot = movement.dot(right);
                this.lateralSpeed = Math.abs(lateralDot) * rawSpeed;
                // Determine strafe direction (-1 = left, 1 = right)
                if (this.lateralSpeed > this.strafeThreshold) {
                    this.strafeDirection = lateralDot > 0 ? 1 : -1; // Positive = right, negative = left
                } else {
                    this.strafeDirection = 0;
                }
            } else {
                this.lateralSpeed = 0;
                this.strafeDirection = 0;
            }
        // console.log(`[${this.entity.name}] 🚶 Movement: speed=${this.movementSpeed.toFixed(2)}m/s, lateral=${this.lateralSpeed.toFixed(2)}m/s, strafe=${this.strafeDirection}`);
        } else {
            // console.log(`[${this.entity.name}] 📍 Initial position recorded`);
            this.movementSpeed = 0;
            this.lateralSpeed = 0;
            this.strafeDirection = 0;
        }
        this.lastPosition = currentPos.clone();
    }
    /**
     * Update animation based on current AI state
     */ _updateAnimationFromState() {
        // console.log(`[${this.entity.name}] 🎭 _updateAnimationFromState() called`);
        const agent = this.agent;
        // Get current YUKA state
        const stateMachine = agent.stateMachine;
        if (!stateMachine || !stateMachine.currentState) {
            return;
        }
        const currentState = stateMachine.currentState;
        const stateName = currentState.type || 'unknown';
        // Map AI states to animations
        switch(stateName){
            case 'patrol':
                this._handlePatrolAnimation();
                break;
            case 'alert':
                this._handleAlertAnimation();
                break;
            case 'combat':
                this._handleCombatAnimation();
                break;
            case 'investigate':
                this._handleInvestigateAnimation();
                break;
            case 'flee':
                this._handleFleeAnimation();
                break;
            case 'seekHealth':
            case 'seekAmmo':
                this._handleSeekAnimation();
                break;
            default:
                this._handleIdleAnimation();
                break;
        }
    }
    /**
     * Handle patrol state animations (idle/walk/run based on movement)
     * ✅ ENHANCED: Now uses run animation for fast movement
     */ _handlePatrolAnimation() {
        this.isAiming = false; // Not aiming while patrolling
        if (this.movementSpeed <= this.idleThreshold) {
            this._setState('Idle');
        } else if (this.movementSpeed >= this.runSpeedThreshold) {
            this._setState('Run');
        } else {
            this._setState('Walk');
        }
    }
    /**
     * Handle alert state animations (spotted threat)
     * ✅ ENHANCED: Uses aim when stationary, movement animations when moving
     * ✅ ADVANCED: Integrates with targeting system for more responsive aiming
     * ✅ STRAFE: Detects lateral movement during alert
     * ✅ FIX: Maintains alert stance when stationary (combat-ready posture)
     */ _handleAlertAnimation() {
        // Check if AI has a target to aim at
        const hasTarget = this.agent?.targetingSystem?.currentTarget !== null;
        // ✅ CRITICAL FIX: Add hysteresis to prevent aim flickering
        const now = performance.now();
        if (hasTarget) {
            this._lastTargetSeenTime = now;
            this._shouldAim = true;
        } else {
            const timeSinceTargetLost = now - (this._lastTargetSeenTime || 0);
            if (timeSinceTargetLost < 500) {
                this._shouldAim = true;
            } else {
                this._shouldAim = false;
            }
        }
        // ✅ NEW: Check for strafe movement (lateral movement while tracking target)
        if (this.strafeDirection !== 0 && this.lateralSpeed > this.strafeThreshold && this._shouldAim) {
            // Strafing left or right while tracking target
            this.isAiming = true;
            const strafeState = this.strafeDirection > 0 ? 'StrafeRight' : 'StrafeLeft';
            this._setState(strafeState);
        } else if (this.movementSpeed <= this.idleThreshold) {
            // Stationary in alert = aiming (if have target) or idle
            this.isAiming = this._shouldAim;
            this._setState(this._shouldAim ? 'Aim' : 'Idle');
        } else if (this.movementSpeed >= this.runSpeedThreshold) {
            this.isAiming = false;
            this._setState('Run');
        } else {
            this.isAiming = false;
            this._setState('Walk');
        }
    }
    /**
     * Handle combat state animations (aiming + firing)
     * ✅ ENHANCED: Uses aim when stationary, movement animations when moving
     * ✅ ADVANCED: Integrates with combat and targeting systems
     * ✅ STRAFE: Detects lateral movement and plays strafe animations
     * ✅ FIX: Maintains combat stance until AttackGoal terminates (no flickering)
     */ _handleCombatAnimation() {
        // ✅ CRITICAL FIX: While in Combat state, ALWAYS maintain aim stance (unless moving)
        // The AttackGoal will terminate after 3s of invisibility, exiting combat state entirely
        // This prevents the "aim → idle → aim → idle" loop when target flickers in/out of sight
        // In combat state, we should be combat-ready at all times
        // Only drop aim when actually moving (run/walk animations)
        // ✅ NEW: Check for strafe movement (lateral movement while aiming)
        if (this.strafeDirection !== 0 && this.lateralSpeed > this.strafeThreshold) {
            // Strafing left or right while aiming at target
            this.isAiming = true;
            const strafeState = this.strafeDirection > 0 ? 'StrafeRight' : 'StrafeLeft';
            this._setState(strafeState);
        } else if (this.movementSpeed <= this.idleThreshold) {
            // Stationary in combat = ALWAYS aiming (combat-ready stance)
            // Don't check hasTarget - if we're in combat state, maintain combat posture
            this.isAiming = true;
            this._setState('Aim');
        } else if (this.movementSpeed >= this.runSpeedThreshold) {
            this.isAiming = false;
            this._setState('Run');
        } else {
            this.isAiming = false;
            this._setState('Walk');
        }
    // Fire animation is triggered by fireTrigger parameter in _updateParameters()
    // The state machine will handle ANY → Fire transition automatically
    }
    /**
     * Handle investigate state animations
     * ✅ ENHANCED: Uses full movement range
     */ _handleInvestigateAnimation() {
        this.isAiming = false; // Not aiming while investigating
        if (this.movementSpeed <= this.idleThreshold) {
            this._setState('Idle');
        } else if (this.movementSpeed >= this.runSpeedThreshold) {
            this._setState('Run');
        } else {
            this._setState('Walk');
        }
    }
    /**
     * Handle flee state animations (running away)
     * ✅ ENHANCED: Always running when fleeing
     */ _handleFleeAnimation() {
        this.isAiming = false; // Not aiming while fleeing
        // Fleeing = always running if moving
        if (this.movementSpeed <= this.idleThreshold) {
            this._setState('Idle');
        } else {
            this._setState('Run'); // Run animation for fleeing
        }
    }
    /**
     * Handle seek state animations (moving to pickup)
     * ✅ ENHANCED: Uses full movement range
     */ _handleSeekAnimation() {
        this.isAiming = false; // Not aiming while seeking items
        if (this.movementSpeed <= this.idleThreshold) {
            this._setState('Idle');
        } else if (this.movementSpeed >= this.runSpeedThreshold) {
            this._setState('Run');
        } else {
            this._setState('Walk');
        }
    }
    /**
     * Handle idle/default animation
     */ _handleIdleAnimation() {
        this.isAiming = false;
        this._setState('Idle');
    }
    /**
     * Update animation parameters based on current state
     * ✅ FULL VERSION: Updates all parameters for complete animation system (ORIGINAL)
     * ✅ ENHANCED: Now integrates with advanced AI systems (targeting, aiming, combat)
     */ _updateParameters() {
        // ✅ CRITICAL FIX: Sync isDead parameter with actual health system!
        const healthSystem = this.entity.script?.healthSystem;
        const actualIsDead = healthSystem?.healthCore?.isDead || false;
        this._setParameter('isDead', actualIsDead);
        // Speed parameter (for blend trees and speed-based transitions)
        this._setParameter('speed', this.movementSpeed);
        // Movement flag - is agent moving at all?
        const isMoving = this.movementSpeed >= this.walkSpeedThreshold;
        this._setParameter('isMoving', isMoving);
        // ✅ ENHANCED: Aim state now considers targeting and aim systems
        // Use aim animation when:
        // 1. Manual isAiming flag is set (from state handlers), OR
        // 2. AI has a target and is in combat/alert state, OR  
        // 3. Aim system is actively aiming
        const hasTarget = this.agent?.targetingSystem?.currentTarget !== null;
        const aimSystem = this.agent?.aimSystem;
        const isActivelyAiming = aimSystem?.isAiming || false;
        const shouldAim = this.isAiming || hasTarget && isActivelyAiming;
        this._setParameter('isAiming', shouldAim);
        // ✅ ENHANCED: Fire trigger based on weapon system state
        // Note: fireTrigger is a TRIGGER type, not boolean - it auto-resets after use
        // Access weaponSystem via entity.script for direct, reliable access
        const weaponSystem = this.entity.script?.weaponSystem;
        const isFiring = weaponSystem?.isFiring || false;
        if (isFiring && this.animComponent) {
            this.animComponent.setTrigger('fireTrigger');
        }
        // ✅ NEW: Set strafe direction parameter for strafe animations
        this._setParameter('strafeDirection', this.strafeDirection);
        // Always grounded (AI doesn't jump currently)
        this._setParameter('isGrounded', true);
        // Animation speed multiplier (keep at 1.0 for now)
        this._setParameter('speedMultiplier', 1.0);
        // ============================================================================
        // TRACK ANIMATION STATES FOR COMBAT INTEGRATION
        // ============================================================================
        // Since baseLayer.activeStateName is unreliable in programmatic mode,
        // we track animation states manually based on what we're triggering
        // Track if firing animation is active (set when fireTrigger fires, cleared after delay)
        if (isFiring && !this._isFiring) {
            this._isFiring = true;
            this._fireStartTime = performance.now();
            // Clear firing state after typical fire animation duration (300ms)
            setTimeout(()=>{
                this._isFiring = false;
            }, 300);
        }
    // Track hit reaction (would be set by damage handler - placeholder for now)
    // this._isHitReactionActive would be set when hitReactionTrigger is fired
    }
    /**
     * Set animation state (for tracking only)
     * ✅ SIMPLIFIED: State transitions are automatic via parameters
     */ _setState(stateName) {
        if (!this.animComponent) return;
        if (this.currentAnimState !== stateName) {
            Logger.debug(`[${this.entity.name}] 🎬 Animation: ${this.currentAnimState} → ${stateName}`);
            this.currentAnimState = stateName;
        // Note: PlayCanvas state machine handles transitions automatically
        // We just update parameters (isMoving, isFiring, isDead)
        // The graph does: Idle ↔ Walk, ANY → Fire, ANY → Death
        }
    }
    /**
     * Set animation parameter (safe wrapper)
     * ✅ FIXED: Use PlayCanvas setBoolean/setFloat/setInteger methods!
     */ _setParameter(paramName, value) {
        if (!this.animComponent) return;
        try {
            // ✅ Use the correct PlayCanvas API methods that trigger transitions!
            if (typeof value === 'boolean') {
                this.animComponent.setBoolean(paramName, value);
            // console.log(`[${this.entity.name}] 🎚️ setBoolean('${paramName}', ${value})`);
            } else if (typeof value === 'number') {
                // Check if parameter exists first
                const param = this.animComponent.findParameter(paramName);
                if (param) {
                    // ✅ Check parameter type and use correct setter
                    if (param.type === ANIM_PARAMETER_INTEGER) {
                        this.animComponent.setInteger(paramName, Math.round(value));
                    // console.log(`[${this.entity.name}] 🎚️ setInteger('${paramName}', ${Math.round(value)})`);
                    } else {
                        // Use setFloat for float parameters
                        this.animComponent.setFloat(paramName, value);
                    // console.log(`[${this.entity.name}] 🎚️ setFloat('${paramName}', ${value.toFixed(2)})`);
                    }
                } else {
                    // Parameter doesn't exist in graph!
                    if (!this._missingParams) this._missingParams = new Set();
                    if (!this._missingParams.has(paramName)) {
                        this._missingParams.add(paramName);
                        Logger.warn(`[${this.entity.name}] ⚠️ Animation parameter '${paramName}' not found in animation graph! Add it to your graph.`);
                    }
                }
            } else {
                // Fallback for older PlayCanvas versions
                if (this.animComponent[paramName] !== undefined) {
                    this.animComponent[paramName] = value;
                } else {
                    Logger.warn(`[${this.entity.name}] Animation component doesn't support parameter: ${paramName}`);
                }
            }
        } catch (error) {
            Logger.warn(`[${this.entity.name}] Failed to set anim parameter ${paramName}: ${error.message}`);
        }
    }
    /**
     * Manual fire trigger - call this when AI shoots
     * ✅ Fire animation handled automatically by fireTrigger in update loop
     */ onWeaponFired() {
        // Fire animation is handled automatically by fireTrigger parameter
        // The update loop sets this based on weaponSystem.isFiring
        Logger.debug(`[${this.entity.name}] 💥 Weapon fired`);
    }
    /**
     * Trigger hit reaction animation when taking damage
     * ✅ NEW: Call this from health system when entity takes damage
     */ onDamageTaken() {
        if (!this.animComponent) return;
        // Trigger hit reaction animation (auto-resets after playing)
        this.animComponent.setTrigger('hitReactionTrigger');
        // Track hit reaction state for combat gating
        this._isHitReactionActive = true;
        setTimeout(()=>{
            this._isHitReactionActive = false;
        }, 500); // Clear after 500ms
        Logger.debug(`[${this.entity.name}] 💥 Hit reaction triggered`);
    }
    /**
     * Trigger reload animation when reloading weapon
     * ✅ NEW: Call this from weapon system when reloading
     */ onWeaponReload() {
        if (!this.animComponent) return;
        // Trigger reload animation (auto-resets after playing)
        this.animComponent.setTrigger('reloadTrigger');
        Logger.debug(`[${this.entity.name}] 🔄 Reload animation triggered`);
    }
    /**
     * ✅ NEW: Debug method to verify advanced AI system integration
     * Call this to check if all AI systems are properly connected to animations
     * ✅ ENHANCED: Now includes strafe detection info
     */ debugSystemConnections() {
        const report = {
            entity: this.entity.name,
            initialized: this._initialized,
            hasAnimComponent: !!this.animComponent,
            systems: {
                stateMachine: !!this.agent?.stateMachine,
                currentState: this.agent?.stateMachine?.currentState?.type || 'none',
                weaponSystem: !!this.entity.script?.weaponSystem,
                targetingSystem: !!this.agent?.targetingSystem,
                hasTarget: this.agent?.targetingSystem?.currentTarget !== null,
                aimSystem: !!this.agent?.aimSystem,
                isAiming: this.agent?.aimSystem?.isAiming || false,
                combatSystem: !!this.agent?.combatSystem,
                combatTactics: !!this.agent?.combatSystem?.tacticsSystem,
                healthSystem: !!this.entity.script?.healthSystem,
                isDead: this.entity.script?.healthSystem?.healthCore?.isDead || false
            },
            animation: {
                currentState: this.currentAnimState,
                movementSpeed: this.movementSpeed.toFixed(2),
                lateralSpeed: this.lateralSpeed.toFixed(2),
                strafeDirection: this.strafeDirection === 0 ? 'none' : this.strafeDirection > 0 ? 'right' : 'left',
                isStrafing: Math.abs(this.strafeDirection) > 0,
                isAimingFlag: this.isAiming,
                isFiring: this.entity.script?.weaponSystem?.isFiring || false
            }
        };
        console.log('🔍 AnimationController System Connections:', report);
        return report;
    }
    // ============================================================================
    // COMBAT INTEGRATION - Animation Gating for Weapons & Movement
    // ============================================================================
    /**
     * Check if weapon can fire based on current animation state
     * Prevents shooting during inappropriate animations (reload, death, etc.)
     * 
     * Called by: CombatCore.executeShooting() before firing weapon
     * Returns: true if animation allows firing, false otherwise
     */ canFireWeapon() {
        // ✅ DIAGNOSTIC: Log every call to see what's happening
        const now = performance.now();
        if (now - (this._lastCanFireLog || 0) > 2000) {
            Logger.combat(`[${this.entity.name}] 🔍 canFireWeapon() check:`);
            Logger.combat(`[${this.entity.name}]   animComponent: ${!!this.animComponent}`);
            Logger.combat(`[${this.entity.name}]   _initialized: ${this._initialized}`);
            this._lastCanFireLog = now;
        }
        if (!this.animComponent || !this._initialized) {
            // Fail-open: if animation system not ready, don't block gameplay
            if (now - (this._lastCanFireLog || 0) > 2000) {
                Logger.combat(`[${this.entity.name}]   ✅ Allowing fire (animation system not ready)`);
            }
            return true;
        }
        const weaponSystem = this.entity.script?.weaponSystem;
        // Block firing if currently reloading
        if (weaponSystem?.isReloading) {
            Logger.combat(`[${this.entity.name}] 🚫 Cannot fire - reloading`);
            return false;
        }
        // Block firing if dead (use getBoolean to get the actual value, not the parameter object!)
        const isDead = this.animComponent.getBoolean('isDead');
        if (isDead) {
            Logger.combat(`[${this.entity.name}] 🚫 Cannot fire - dead (isDead=${isDead})`);
            return false;
        }
        // Block firing during hit reaction (if we're tracking it)
        if (this._isHitReactionActive) {
            Logger.combat(`[${this.entity.name}] 🚫 Cannot fire - hit reaction`);
            return false;
        }
        if (now - (this._lastCanFireLog || 0) > 2000) {
            Logger.combat(`[${this.entity.name}]   ✅ Fire allowed - all checks passed`);
        }
        return true; // OK to fire
    }
    /**
     * Get movement speed modifier based on current animation state
     * Slows AI movement during combat actions for realism
     * 
     * Called by: AgentNavigationAdapter every frame
     * Returns: Speed multiplier (0.0 = stopped, 1.0 = full speed)
     */ getMovementSpeedModifier() {
        if (!this._initialized || !this.animComponent) {
            return 1.0; // Normal speed if animation system not ready
        }
        const weaponSystem = this.entity.script?.weaponSystem;
        // Track previous modifier to detect changes
        const prevModifier = this._lastSpeedModifier || 1.0;
        let modifier = 1.0;
        let reason = 'NORMAL';
        // ✅ CRITICAL FIX: Use getBoolean() to read ACTUAL parameter values, not the parameter object!
        // params.isDead is an OBJECT (always truthy), getBoolean('isDead') returns the actual boolean value
        const isDead = this.animComponent.getBoolean('isDead');
        const isAiming = this.animComponent.getBoolean('isAiming');
        // 1. DEATH STATE (no movement) - HIGHEST PRIORITY
        if (isDead) {
            modifier = 0.0;
            reason = 'DEAD';
        } else if (weaponSystem?.isReloading) {
            modifier = 0.15;
            reason = 'RELOADING';
        } else if (this._isFiring) {
            modifier = 0.25;
            reason = 'FIRING';
        } else if (this.isAiming || isAiming) {
            modifier = 0.50;
            reason = 'AIMING';
        } else if (this._isHitReactionActive) {
            modifier = 0.20;
            reason = 'HIT_REACTION';
        }
        // ✅ DIAGNOSTIC: Log speed modifier changes
        if (modifier !== prevModifier) {
            Logger.nav(`[${this.entity.name}] 🏃 Movement speed: ${(modifier * 100).toFixed(0)}% (${reason})`);
        }
        this._lastSpeedModifier = modifier;
        return modifier;
    }
    /**
     * Check if character can move based on animation state
     * Returns false during animations that require standing still
     * 
     * Called by: Navigation systems before applying movement
     * Returns: true/false, or 'REDUCED' for partial movement
     */ canMove() {
        if (!this._initialized || !this.animComponent) {
            return true; // Allow movement if animation system not ready
        }
        const weaponSystem = this.entity.script?.weaponSystem;
        // ✅ CRITICAL FIX: Use getBoolean() to read ACTUAL parameter values!
        const isDead = this.animComponent.getBoolean('isDead');
        // Completely block movement during death
        if (isDead) {
            return false;
        }
        // Allow reduced movement during combat actions
        if (this.isAiming || this._isFiring || weaponSystem?.isReloading || this._isHitReactionActive) {
            return 'REDUCED';
        }
        // Allow full movement
        return true;
    }
    /**
     * Check if character is in combat-locked stance
     * Used by navigation to know if AI is "engaged" in combat
     * 
     * Returns: true if in aim/fire/reload state
     */ isCombatLocked() {
        if (!this._initialized || !this.animComponent) {
            return false;
        }
        const weaponSystem = this.entity.script?.weaponSystem;
        return this.isAiming || this._isFiring || weaponSystem?.isReloading || false;
    }
    /**
     * Cleanup
     */ destroy() {
        this.animComponent = null;
        this.agent = null;
        this.entity = null;
        this._initialized = false;
    }
    constructor(agent){
        this.agent = agent;
        this.entity = agent.entity;
        this.animComponent = null;
        // Animation state tracking
        this.currentAnimState = 'idle';
        this.lastPosition = null;
        this.movementSpeed = 0;
        this.isAiming = false;
        // Strafe detection
        this.lateralSpeed = 0; // Lateral (left/right) movement speed
        this.strafeDirection = 0; // -1 = left, 1 = right, 0 = none
        // Thresholds (MATCH YOUR EDITOR TRANSITIONS!)
        this.walkSpeedThreshold = 0.1; // Match: speed >= 0.1 for idle→walk
        this.runSpeedThreshold = 2.5; // Match: speed >= 2.5 for walk→run
        this.idleThreshold = 0.05; // Match: speed <= 0.05 for walk→idle
        this.strafeThreshold = 0.5; // Minimum lateral speed to trigger strafe animation
        // Update rate limiting
        this.lastUpdateTime = 0;
        this.updateInterval = 0.1; // Update every 100ms (10Hz)
        this._initialized = false;
        this._waitingForParameters = false; // ✅ FIX: Track if we're waiting for parameters to load
        // ============================================================================
        // COMBAT INTEGRATION - State tracking for animation gating
        // ============================================================================
        // Since baseLayer.activeStateName is unreliable in programmatic mode,
        // we manually track animation states for combat integration
        this._isFiring = false; // Tracks if fire animation is active
        this._fireStartTime = 0; // Timestamp when fire animation started
        this._isHitReactionActive = false; // Tracks if hit reaction is playing
    }
}
Logger.info('✅ AnimationController.mjs loaded - AI animation system ready');

export { AnimationController };
