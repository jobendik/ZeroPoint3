import { ANIM_EQUAL_TO, ANIM_GREATER_THAN, ANIM_LESS_THAN, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_STATE_ANY, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_TRIGGER, ANIM_PARAMETER_INTEGER } from '../../../../playcanvas-stable.min.mjs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PROGRAMMATIC ANIMATION GRAPH SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Creates PlayCanvas animation state graphs entirely from code, bypassing the 
 * unreliable PlayCanvas Editor animation graph asset system.
 * 
 * WHY PROGRAMMATIC?
 * - PlayCanvas Editor assets are unreliable (parameters disappear, transitions lost)
 * - Full control over state machine structure
 * - Easy debugging with console logs
 * - Version control friendly (code, not binary assets)
 * - No "corrupted asset" nightmares
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ AnimationController.initialize()                                    │
 * │   ↓ Calls _findAnimationClips() → finds clips from asset registry  │
 * │   ↓ Calls ProgrammaticAnimationGraph.loadAnimationGraph()          │
 * └─────────────────────────────────────────────────────────────────────┘
 *           ↓
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ ProgrammaticAnimationGraph.loadAnimationGraph()                     │
 * │   1. Defines state graph structure (states, transitions, parameters)│
 * │   2. Calls animComponent.loadStateGraph(data)                       │
 * │   3. Gets baseLayer from component                                  │
 * │   4. Assigns animation clips to states via baseLayer.assignAnimation│
 * └─────────────────────────────────────────────────────────────────────┘
 *           ↓
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Runtime: State Machine Active                                       │
 * │   - Parameters updated each frame (speed, isMoving, etc.)           │
 * │   - Transitions evaluated based on conditions                       │
 * │   - Animation clips play when states activate                       │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * STATE GRAPH STRUCTURE:
 * {
 *   layers: [                           // Multiple layers possible (we use 1)
 *     {
 *       name: 'Base Layer',
 *       states: [                        // All animation states
 *         { name: 'Idle', speed: 1.0 },
 *         { name: 'Walk', speed: 1.0 },
 *         ...
 *       ],
 *       transitions: [                   // Rules for state changes
 *         {
 *           from: 'Idle',
 *           to: 'Walk',
 *           time: 0.1,                  // Blend time in seconds
 *           priority: 0,                // Higher = more important
 *           conditions: [               // Must ALL be true to transition
 *             {
 *               parameterName: 'speed',
 *               predicate: pc.ANIM_GREATER_THAN,
 *               value: 0.1
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ],
 *   parameters: {                        // Shared across all states
 *     speed: {
 *       name: 'speed',
 *       type: pc.ANIM_PARAMETER_FLOAT,
 *       value: 0
 *     }
 *   }
 * }
 * 
 * HOW TO ADD NEW ANIMATIONS:
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Add animation FBX/GLB to PlayCanvas Editor (e.g., "crouch.glb")
 * 2. Add state to states array (line ~20):
 *    { name: 'Crouch', speed: 1.0 }
 * 
 * 3. Add parameter if needed (line ~240):
 *    isCrouching: {
 *      name: 'isCrouching',
 *      type: pc.ANIM_PARAMETER_BOOLEAN,
 *      value: false
 *    }
 * 
 * 4. Add transitions (line ~35):
 *    {
 *      from: 'Idle',
 *      to: 'Crouch',
 *      time: 0.2,
 *      conditions: [{ parameterName: 'isCrouching', predicate: pc.ANIM_EQUAL_TO, value: true }]
 *    }
 * 
 * 5. Add clip assignment (line ~280):
 *    if (animationAssets.crouch) {
 *      baseLayer.assignAnimation('Crouch', animationAssets.crouch);
 *    }
 * 
 * 6. Update AnimationController._findAnimationClips() to find the clip:
 *    else if (lowerName === 'crouch.glb' && !clips.crouch) {
 *      clips.crouch = asset.resource;
 *    }
 * 
 * PLAYCANVAS PREDICATES REFERENCE:
 * ──────────────────────────────────────────────────────────────────────────────
 * pc.ANIM_EQUAL_TO           // parameter === value
 * pc.ANIM_NOT_EQUAL_TO       // parameter !== value
 * pc.ANIM_LESS_THAN          // parameter < value
 * pc.ANIM_LESS_THAN_EQUAL_TO // parameter <= value
 * pc.ANIM_GREATER_THAN       // parameter > value
 * pc.ANIM_GREATER_THAN_EQUAL_TO // parameter >= value
 * 
 * PARAMETER TYPES:
 * ──────────────────────────────────────────────────────────────────────────────
 * pc.ANIM_PARAMETER_BOOLEAN  // true/false
 * pc.ANIM_PARAMETER_FLOAT    // number
 * pc.ANIM_PARAMETER_INTEGER  // whole number
 * pc.ANIM_PARAMETER_TRIGGER  // one-shot event (auto-resets to false)
 * 
 * SPECIAL TRANSITION FEATURES:
 * ──────────────────────────────────────────────────────────────────────────────
 * from: 'ANY'        // Transition from any state (useful for interrupts)
 * priority: 1        // Higher numbers = higher priority (default 0)
 * exitTime: 0.8      // Wait until animation is 80% complete before transitioning
 * time: 0.1          // Blend time between animations (seconds)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */ class ProgrammaticAnimationGraph {
    /**
     * Load animation state graph programmatically into the animation component
     * 
     * @param {pc.AnimComponent} animComponent - The PlayCanvas animation component
     * @param {Object} animationAssets - Object containing animation clip assets
     *   Expected format: { idle: AnimTrack, walk: AnimTrack, run: AnimTrack, ... }
     *   These come from AnimationController._findAnimationClips()
     * 
     * @returns {boolean} Success status
     * 
     * @example
     * const clips = this._findAnimationClips(); // { idle: AnimTrack, walk: AnimTrack, ... }
     * ProgrammaticAnimationGraph.loadAnimationGraph(this.animComponent, clips);
     */ static loadAnimationGraph(animComponent, animationAssets) {
        console.log('[ProgrammaticAnimationGraph] Creating animation state graph from code...');
        // ═══════════════════════════════════════════════════════════════════════
        // DEFINE ANIMATION STATE GRAPH DATA STRUCTURE
        // ═══════════════════════════════════════════════════════════════════════
        const animStateGraphData = {
            // PlayCanvas supports multiple animation layers (like Unity)
            // We use one layer for simplicity
            layers: [
                {
                    name: 'Base Layer',
                    // ───────────────────────────────────────────────────────────
                    // STATES: All possible animation states
                    // ───────────────────────────────────────────────────────────
                    // START = Entry point (auto-transitions to Idle)
                    // END = Exit point (rarely used)
                    // speed = Playback speed multiplier (1.0 = normal speed)
                    // ───────────────────────────────────────────────────────────
                    states: [
                        // ═══ CORE STATES ═══
                        {
                            name: 'START'
                        },
                        {
                            name: 'Idle',
                            speed: 1.0
                        },
                        {
                            name: 'Walk',
                            speed: 1.0
                        },
                        {
                            name: 'Run',
                            speed: 1.0
                        },
                        {
                            name: 'Aim',
                            speed: 1.0
                        },
                        {
                            name: 'Fire',
                            speed: 1.0
                        },
                        {
                            name: 'Jump',
                            speed: 1.0
                        },
                        // ═══ COMBAT STATES ═══
                        {
                            name: 'Reload',
                            speed: 1.0
                        },
                        {
                            name: 'StrafeLeft',
                            speed: 1.0
                        },
                        {
                            name: 'StrafeRight',
                            speed: 1.0
                        },
                        {
                            name: 'HitReaction',
                            speed: 1.2
                        },
                        {
                            name: 'Crouch',
                            speed: 1.0
                        },
                        {
                            name: 'CrouchWalk',
                            speed: 0.8
                        },
                        {
                            name: 'StandToCrouch',
                            speed: 1.0,
                            loop: false
                        },
                        {
                            name: 'CrouchToStand',
                            speed: 1.0,
                            loop: false
                        },
                        {
                            name: 'Dodge',
                            speed: 1.2,
                            loop: false
                        },
                        {
                            name: 'AimingIdle',
                            speed: 1.0
                        },
                        // ═══ TACTICAL STATES ═══
                        {
                            name: 'Backpedal',
                            speed: 0.9
                        },
                        {
                            name: 'PeekLeft',
                            speed: 1.0
                        },
                        {
                            name: 'PeekRight',
                            speed: 1.0
                        },
                        {
                            name: 'Melee',
                            speed: 1.2
                        },
                        {
                            name: 'Throw',
                            speed: 1.0
                        },
                        {
                            name: 'Sprint',
                            speed: 1.3
                        },
                        // ═══ SPECIAL STATES ═══
                        {
                            name: 'Death',
                            speed: 1.0,
                            loop: false
                        },
                        {
                            name: 'END'
                        } // Exit point
                    ],
                    // ───────────────────────────────────────────────────────────
                    // TRANSITIONS: Rules for changing between states
                    // ───────────────────────────────────────────────────────────
                    // from = Source state name (or 'ANY' for wildcard)
                    // to = Destination state name
                    // time = Blend time in seconds (smooth transition)
                    // priority = Higher numbers interrupt lower priorities
                    // conditions = Array of rules (ALL must be true)
                    // exitTime = Wait until animation X% complete (optional)
                    // ───────────────────────────────────────────────────────────
                    transitions: [
                        // ─────────────────────────────────────────────────────
                        // ENTRY: Auto-transition from START to Idle
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'START',
                            to: 'Idle',
                            time: 0,
                            priority: 0
                        },
                        // ─────────────────────────────────────────────────────
                        // IDLE → WALK: Agent starts moving slowly
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Idle',
                            to: 'Walk',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                },
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_GREATER_THAN,
                                    value: 0.1 // Moving at all
                                },
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_LESS_THAN,
                                    value: 2.5 // But not running yet
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // IDLE → RUN: Agent starts running immediately
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Idle',
                            to: 'Run',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                },
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_GREATER_THAN_EQUAL_TO,
                                    value: 2.5 // Running speed threshold
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // IDLE → AIM: Agent aims without moving
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Idle',
                            to: 'Aim',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // WALK → IDLE: Agent stops moving
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Walk',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_LESS_THAN_EQUAL_TO,
                                    value: 0.1 // Almost stopped
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // WALK → RUN: Agent speeds up
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Walk',
                            to: 'Run',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_GREATER_THAN_EQUAL_TO,
                                    value: 2.5
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // RUN → WALK: Agent slows down
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Run',
                            to: 'Walk',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_LESS_THAN,
                                    value: 2.5 // Below run threshold
                                },
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_GREATER_THAN,
                                    value: 0.1 // But still moving
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // RUN → IDLE: Agent stops from running
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Run',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'speed',
                                    predicate: ANIM_LESS_THAN_EQUAL_TO,
                                    value: 0.1
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // AIM → IDLE: Agent stops aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Aim',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // ANY → FIRE: Interrupt any state to shoot
                        // ─────────────────────────────────────────────────────
                        // Priority 1 = Can interrupt normal movement
                        // fireTrigger = Auto-resets after transitioning
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Fire',
                            time: 0.05,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'fireTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // FIRE → IDLE: Return to idle after shooting
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Fire',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            exitTime: 0.8 // Wait until 80% through fire animation
                        },
                        // ─────────────────────────────────────────────────────
                        // ANY → JUMP: Interrupt any state to jump
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Jump',
                            time: 0.05,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'jumpTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // JUMP → IDLE: Land and return to idle
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Jump',
                            to: 'Idle',
                            time: 0.2,
                            priority: 0,
                            exitTime: 0.8
                        },
                        // ═════════════════════════════════════════════════════
                        // RELOAD TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → RELOAD: Reload weapon from any state
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Reload',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'reloadTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // RELOAD → IDLE: Return to idle after reload complete
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Reload',
                            to: 'Idle',
                            time: 0.15,
                            priority: 0,
                            exitTime: 0.95 // Wait for reload animation to almost finish
                        },
                        // ═════════════════════════════════════════════════════
                        // STRAFE TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → STRAFE LEFT: Strafe left from any state
                        // ─────────────────────────────────────────────────────
                        {
                            from: ANIM_STATE_ANY,
                            to: 'StrafeLeft',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: -1
                                },
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // ANY → STRAFE RIGHT: Strafe right from any state
                        // ─────────────────────────────────────────────────────
                        {
                            from: ANIM_STATE_ANY,
                            to: 'StrafeRight',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 1
                                },
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // WALK → STRAFE LEFT: While moving, strafe left
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Walk',
                            to: 'StrafeLeft',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: -1
                                },
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // WALK → STRAFE RIGHT: While moving, strafe right
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Walk',
                            to: 'StrafeRight',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 1
                                },
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // STRAFE LEFT → AIM: Stop strafing, still aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'StrafeLeft',
                            to: 'Aim',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 0
                                },
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // STRAFE LEFT → WALK: Stop strafing, stop aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'StrafeLeft',
                            to: 'Walk',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 0
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // STRAFE RIGHT → AIM: Stop strafing, still aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'StrafeRight',
                            to: 'Aim',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 0
                                },
                                {
                                    parameterName: 'isAiming',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // STRAFE RIGHT → WALK: Stop strafing, stop aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'StrafeRight',
                            to: 'Walk',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'strafeDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 0
                                }
                            ]
                        },
                        // ═════════════════════════════════════════════════════
                        // CROUCH TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // IDLE → STAND TO CROUCH: Enter crouch transition
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Idle',
                            to: 'StandToCrouch',
                            time: 0.05,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isCrouching',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // STAND TO CROUCH → CROUCH: Complete crouch transition
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'StandToCrouch',
                            to: 'Crouch',
                            time: 0.05,
                            priority: 0,
                            exitTime: 0.9 // Wait until animation almost done
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH → CROUCH TO STAND: Exit crouch transition
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Crouch',
                            to: 'CrouchToStand',
                            time: 0.05,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isCrouching',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH TO STAND → IDLE: Complete stand transition
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'CrouchToStand',
                            to: 'Idle',
                            time: 0.05,
                            priority: 0,
                            exitTime: 0.9 // Wait until animation almost done
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH → CROUCH WALK: Start moving while crouched
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Crouch',
                            to: 'CrouchWalk',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isCrouching',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                },
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH WALK → CROUCH: Stop moving while crouched
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'CrouchWalk',
                            to: 'Crouch',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH WALK → WALK: Stand up while moving
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'CrouchWalk',
                            to: 'Walk',
                            time: 0.15,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isCrouching',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ═════════════════════════════════════════════════════
                        // PEEK TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // CROUCH → PEEK LEFT: Peek from cover left
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Crouch',
                            to: 'PeekLeft',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isPeeking',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                },
                                {
                                    parameterName: 'peekDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: -1
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // CROUCH → PEEK RIGHT: Peek from cover right
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Crouch',
                            to: 'PeekRight',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isPeeking',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                },
                                {
                                    parameterName: 'peekDirection',
                                    predicate: ANIM_EQUAL_TO,
                                    value: 1
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // PEEK LEFT → CROUCH: Return to cover
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'PeekLeft',
                            to: 'Crouch',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isPeeking',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // PEEK RIGHT → CROUCH: Return to cover
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'PeekRight',
                            to: 'Crouch',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isPeeking',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ═════════════════════════════════════════════════════
                        // BACKPEDAL TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // AIM → BACKPEDAL: Walk backwards while aiming
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Aim',
                            to: 'Backpedal',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isBackpedaling',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // BACKPEDAL → AIM: Stop backpedaling
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Backpedal',
                            to: 'Aim',
                            time: 0.1,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isBackpedaling',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ═════════════════════════════════════════════════════
                        // SPRINT TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // RUN → SPRINT: Emergency fast movement
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Run',
                            to: 'Sprint',
                            time: 0.05,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'sprintTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // SPRINT → RUN: Return to normal running
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Sprint',
                            to: 'Run',
                            time: 0.15,
                            priority: 0,
                            exitTime: 0.9 // Wait for sprint animation to almost complete
                        },
                        // ═════════════════════════════════════════════════════
                        // HIT REACTION TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → HIT REACTION: Flinch when taking damage
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'HitReaction',
                            time: 0.05,
                            priority: 2,
                            conditions: [
                                {
                                    parameterName: 'hitReactionTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // HIT REACTION → IDLE: Recover from hit
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'HitReaction',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            exitTime: 0.8 // Wait for hit reaction to mostly complete
                        },
                        // ═════════════════════════════════════════════════════
                        // MELEE TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → MELEE: Close combat attack
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Melee',
                            time: 0.05,
                            priority: 2,
                            conditions: [
                                {
                                    parameterName: 'meleeTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // MELEE → IDLE: Return to idle after melee
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Melee',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            exitTime: 0.85 // Wait for melee animation to mostly complete
                        },
                        // ═════════════════════════════════════════════════════
                        // GRENADE THROW TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → THROW: Throw grenade
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Throw',
                            time: 0.1,
                            priority: 1,
                            conditions: [
                                {
                                    parameterName: 'throwTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // THROW → IDLE: Return to idle after throw
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Throw',
                            to: 'Idle',
                            time: 0.15,
                            priority: 0,
                            exitTime: 0.9 // Wait for throw animation to almost complete
                        },
                        // ═════════════════════════════════════════════════════
                        // DODGE TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → DODGE: Quick evasive dodge (panic/reactive)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Dodge',
                            time: 0.05,
                            priority: 2,
                            conditions: [
                                {
                                    parameterName: 'dodgeTrigger',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // DODGE → IDLE: Return to idle after dodge
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Dodge',
                            to: 'Idle',
                            time: 0.1,
                            priority: 0,
                            exitTime: 0.85 // Exit slightly before animation completes for snappier feel
                        },
                        // ═════════════════════════════════════════════════════
                        // DEATH TRANSITIONS
                        // ═════════════════════════════════════════════════════
                        // ─────────────────────────────────────────────────────
                        // ANY → DEATH: Agent dies (highest priority)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'ANY',
                            to: 'Death',
                            time: 0.1,
                            priority: 999,
                            conditions: [
                                {
                                    parameterName: 'isDead',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        }
                    ]
                }
            ],
            // ───────────────────────────────────────────────────────────────────
            // PARAMETERS: Shared variables that drive state transitions
            // ───────────────────────────────────────────────────────────────────
            // These are set by AnimationController.update() each frame
            // ───────────────────────────────────────────────────────────────────
            parameters: {
                // ═══ CORE MOVEMENT PARAMETERS ═══
                // Movement speed in meters/second (calculated from position delta)
                speed: {
                    name: 'speed',
                    type: ANIM_PARAMETER_FLOAT,
                    value: 0
                },
                // Is agent moving? (speed > 0.1)
                isMoving: {
                    name: 'isMoving',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                // Is agent on ground? (for jump logic)
                isGrounded: {
                    name: 'isGrounded',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: true
                },
                // Is agent in aiming mode?
                isAiming: {
                    name: 'isAiming',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                // Speed multiplier for animation playback
                // Used to match animation speed to actual movement speed
                speedMultiplier: {
                    name: 'speedMultiplier',
                    type: ANIM_PARAMETER_FLOAT,
                    value: 1.0
                },
                // ═══ COMBAT TRIGGERS ═══
                // Trigger: Fire weapon (auto-resets)
                fireTrigger: {
                    name: 'fireTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Jump (auto-resets)
                jumpTrigger: {
                    name: 'jumpTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Reload weapon (auto-resets)
                reloadTrigger: {
                    name: 'reloadTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Hit reaction when taking damage (auto-resets)
                hitReactionTrigger: {
                    name: 'hitReactionTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Melee attack (auto-resets)
                meleeTrigger: {
                    name: 'meleeTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Throw grenade (auto-resets)
                throwTrigger: {
                    name: 'throwTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Sprint (auto-resets)
                sprintTrigger: {
                    name: 'sprintTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // Trigger: Dodge (auto-resets) - Quick evasive movement
                dodgeTrigger: {
                    name: 'dodgeTrigger',
                    type: ANIM_PARAMETER_TRIGGER,
                    value: false
                },
                // ═══ DEATH STATE PARAMETER ═══
                // Is agent dead? (triggers death animation)
                isDead: {
                    name: 'isDead',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                // ═══ TACTICAL MOVEMENT PARAMETERS ═══
                // Is agent crouching? (cover system)
                isCrouching: {
                    name: 'isCrouching',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                // Is agent peeking from cover?
                isPeeking: {
                    name: 'isPeeking',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                // Peek direction: -1=left, 0=none, 1=right
                peekDirection: {
                    name: 'peekDirection',
                    type: ANIM_PARAMETER_INTEGER,
                    value: 0
                },
                // Strafe direction: -1=left, 0=none, 1=right
                strafeDirection: {
                    name: 'strafeDirection',
                    type: ANIM_PARAMETER_INTEGER,
                    value: 0
                },
                // Is agent backpedaling (walking backwards)?
                isBackpedaling: {
                    name: 'isBackpedaling',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                }
            }
        };
        // ═══════════════════════════════════════════════════════════════════════
        // LOAD STATE GRAPH INTO PLAYCANVAS ANIMATION COMPONENT
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[ProgrammaticAnimationGraph] Loading state graph data...');
        animComponent.loadStateGraph(animStateGraphData);
        console.log('[ProgrammaticAnimationGraph] State graph loaded successfully!');
        console.log('[ProgrammaticAnimationGraph] Parameters:', Object.keys(animComponent.parameters));
        // ═══════════════════════════════════════════════════════════════════════
        // GET BASE LAYER (where we assign animation clips to states)
        // ═══════════════════════════════════════════════════════════════════════
        const baseLayer = animComponent.baseLayer;
        if (!baseLayer) {
            console.error('[ProgrammaticAnimationGraph] ❌ Failed to get base layer after loading state graph!');
            return false;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // ASSIGN ANIMATION CLIPS TO STATES
        // ═══════════════════════════════════════════════════════════════════════
        // Animation clips come from AnimationController._findAnimationClips()
        // which searches the PlayCanvas asset registry for loaded animations
        // ═══════════════════════════════════════════════════════════════════════
        if (animationAssets && Object.keys(animationAssets).length > 0) {
            console.log('[ProgrammaticAnimationGraph] Assigning animation clips to states...');
            // Idle animation (standing still with weapon)
            if (animationAssets.idle) {
                baseLayer.assignAnimation('Idle', animationAssets.idle);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Idle animation');
            }
            // Walk animation (slow movement)
            if (animationAssets.walk) {
                baseLayer.assignAnimation('Walk', animationAssets.walk);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Walk animation');
            }
            // Run animation (fast movement)
            if (animationAssets.run) {
                baseLayer.assignAnimation('Run', animationAssets.run);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Run animation');
            }
            // Aim animation (aiming weapon while stationary)
            if (animationAssets.aim) {
                baseLayer.assignAnimation('Aim', animationAssets.aim);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Aim animation');
            }
            // Fire animation (shooting weapon)
            if (animationAssets.fire) {
                baseLayer.assignAnimation('Fire', animationAssets.fire);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Fire animation');
            }
            // Jump animation
            if (animationAssets.jump) {
                baseLayer.assignAnimation('Jump', animationAssets.jump);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Jump animation');
            }
            // ═════════════════════════════════════════════════════════════════
            // COMBAT ANIMATIONS
            // ═════════════════════════════════════════════════════════════════
            // Reload animation (reload weapon)
            if (animationAssets.reload) {
                baseLayer.assignAnimation('Reload', animationAssets.reload);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Reload animation');
            }
            // Strafe left animation (sidestep left while aiming)
            if (animationAssets.strafeLeft) {
                baseLayer.assignAnimation('StrafeLeft', animationAssets.strafeLeft);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned StrafeLeft animation');
            }
            // Strafe right animation (sidestep right while aiming)
            if (animationAssets.strafeRight) {
                baseLayer.assignAnimation('StrafeRight', animationAssets.strafeRight);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned StrafeRight animation');
            }
            // Hit reaction animation (flinch when taking damage)
            if (animationAssets.hitReaction) {
                baseLayer.assignAnimation('HitReaction', animationAssets.hitReaction);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned HitReaction animation');
            }
            // Crouch idle animation (crouch behind cover)
            if (animationAssets.crouchIdle) {
                baseLayer.assignAnimation('Crouch', animationAssets.crouchIdle);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Crouch animation');
            }
            // Crouch walk animation (move while crouched)
            if (animationAssets.crouchWalk) {
                baseLayer.assignAnimation('CrouchWalk', animationAssets.crouchWalk);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned CrouchWalk animation');
            }
            // Stand to crouch transition animation
            if (animationAssets.standToCrouch) {
                baseLayer.assignAnimation('StandToCrouch', animationAssets.standToCrouch);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned StandToCrouch transition animation');
            }
            // Crouch to stand transition animation
            if (animationAssets.crouchToStand) {
                baseLayer.assignAnimation('CrouchToStand', animationAssets.crouchToStand);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned CrouchToStand transition animation');
            }
            // Dodge animation (quick evasive movement)
            if (animationAssets.dodge) {
                baseLayer.assignAnimation('Dodge', animationAssets.dodge);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Dodge animation');
            }
            // Aiming idle animation (combat-ready stance)
            if (animationAssets.aimingIdle) {
                baseLayer.assignAnimation('AimingIdle', animationAssets.aimingIdle);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned AimingIdle animation');
            }
            // ═════════════════════════════════════════════════════════════════
            // TACTICAL ANIMATIONS
            // ═════════════════════════════════════════════════════════════════
            // Backpedal animation (walk backwards)
            if (animationAssets.backpedal) {
                baseLayer.assignAnimation('Backpedal', animationAssets.backpedal);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Backpedal animation');
            }
            // Peek left animation (peek from cover left)
            if (animationAssets.peekLeft) {
                baseLayer.assignAnimation('PeekLeft', animationAssets.peekLeft);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned PeekLeft animation');
            }
            // Peek right animation (peek from cover right)
            if (animationAssets.peekRight) {
                baseLayer.assignAnimation('PeekRight', animationAssets.peekRight);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned PeekRight animation');
            }
            // Melee animation (close combat attack)
            if (animationAssets.melee) {
                baseLayer.assignAnimation('Melee', animationAssets.melee);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Melee animation');
            }
            // Throw animation (throw grenade)
            if (animationAssets.throwGrenade) {
                baseLayer.assignAnimation('Throw', animationAssets.throwGrenade);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Throw animation');
            }
            // Sprint animation (emergency fast movement)
            if (animationAssets.sprint) {
                baseLayer.assignAnimation('Sprint', animationAssets.sprint);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Sprint animation');
            }
            // ═════════════════════════════════════════════════════════════════
            // SPECIAL ANIMATIONS
            // ═════════════════════════════════════════════════════════════════
            // Death animation
            if (animationAssets.death) {
                baseLayer.assignAnimation('Death', animationAssets.death);
                console.log('[ProgrammaticAnimationGraph] ✅ Assigned Death animation');
                // ✅ NOTE: Death state already has loop=false from graph definition
                // PlayCanvas sets this from the state definition - no need to modify after creation
                console.log('[ProgrammaticAnimationGraph] ℹ️ Death animation loop=false (set in graph definition)');
            }
        } else {
            console.warn('[ProgrammaticAnimationGraph] ⚠️ No animation clips provided - states will have no animations!');
        }
        // ═══════════════════════════════════════════════════════════════════════
        // VERIFICATION: Log setup status
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[ProgrammaticAnimationGraph] Verification:');
        console.log('  - Base Layer:', baseLayer ? 'EXISTS' : 'MISSING');
        console.log('  - Active State:', baseLayer?.activeState || 'NONE');
        console.log('  - Parameters count:', Object.keys(animComponent.parameters).length);
        return true;
    }
}

export { ProgrammaticAnimationGraph };
