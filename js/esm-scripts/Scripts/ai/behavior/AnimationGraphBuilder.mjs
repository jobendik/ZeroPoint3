import { ANIM_EQUAL_TO, ANIM_NOT_EQUAL_TO, ANIM_LESS_THAN, ANIM_LESS_THAN_EQUAL_TO, ANIM_GREATER_THAN, ANIM_GREATER_THAN_EQUAL_TO, ANIM_PARAMETER_BOOLEAN, ANIM_PARAMETER_FLOAT, ANIM_PARAMETER_INTEGER, ANIM_PARAMETER_TRIGGER } from '../../../../playcanvas-stable.min.mjs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANIMATION GRAPH BUILDER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Fluent API for building PlayCanvas animation state graphs programmatically.
 * Makes adding new animations as simple as possible with a chainable interface.
 * 
 * BENEFITS:
 * ✅ Simple, readable syntax (method chaining)
 * ✅ Automatic error checking and validation
 * ✅ Reduces boilerplate code
 * ✅ Type-safe parameter and predicate handling
 * ✅ Clear error messages for debugging.
 * 
 * USAGE EXAMPLE:
 * ──────────────────────────────────────────────────────────────────────────────
 * const builder = new AnimationGraphBuilder();
 * 
 * // Define states
 * builder
 *   .addState('Idle')
 *   .addState('Walk')
 *   .addState('Run')
 *   .addState('Crouch');
 * 
 * // Define parameters
 * builder
 *   .addParameter('speed', 'FLOAT', 0)
 *   .addParameter('isMoving', 'BOOLEAN', false)
 *   .addParameter('isCrouching', 'BOOLEAN', false);
 * 
 * // Define transitions
 * builder
 *   .addTransition('START', 'Idle', { time: 0 })
 *   .addTransition('Idle', 'Walk', {
 *     time: 0.1,
 *     conditions: [
 *       { param: 'isMoving', op: 'EQUAL', value: true },
 *       { param: 'speed', op: 'GREATER_THAN', value: 0.1 }
 *     ]
 *   })
 *   .addTransition('Idle', 'Crouch', {
 *     time: 0.2,
 *     conditions: [
 *       { param: 'isCrouching', op: 'EQUAL', value: true }
 *     ]
 *   });
 * 
 * // Build the graph data
 * const graphData = builder.build();
 * 
 * // Load into animation component
 * animComponent.loadStateGraph(graphData);
 * 
 * // Assign animation clips
 * const baseLayer = animComponent.baseLayer;
 * baseLayer.assignAnimation('Idle', idleClip);
 * baseLayer.assignAnimation('Walk', walkClip);
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 * ADVANCED FEATURES:
 * ──────────────────────────────────────────────────────────────────────────────
 * // High-priority interrupt transitions (fire, reload, etc.)
 * builder.addTransition('ANY', 'Fire', {
 *   time: 0.05,
 *   priority: 1,  // Higher priority interrupts lower
 *   conditions: [{ param: 'fireTrigger', op: 'EQUAL', value: true }]
 * });
 * 
 * // Transitions that wait for animation to finish
 * builder.addTransition('Fire', 'Idle', {
 *   time: 0.1,
 *   exitTime: 0.8  // Wait until 80% through animation
 * });
 * 
 * // Multiple conditions (ALL must be true)
 * builder.addTransition('Walk', 'Run', {
 *   time: 0.1,
 *   conditions: [
 *     { param: 'speed', op: 'GREATER_THAN', value: 2.5 },
 *     { param: 'isGrounded', op: 'EQUAL', value: true }
 *   ]
 * });
 * ──────────────────────────────────────────────────────────────────────────────
 */ class AnimationGraphBuilder {
    /**
     * Add an animation state to the graph
     * 
     * @param {string} name - State name (e.g., 'Idle', 'Walk', 'Run')
     * @param {number} speed - Animation playback speed (default: 1.0)
     * @returns {AnimationGraphBuilder} This builder for chaining
     * 
     * @example
     * builder.addState('Crouch', 1.0);  // Crouch animation at normal speed
     * builder.addState('Sprint', 1.2);  // Sprint animation 20% faster
     */ addState(name, speed = 1.0) {
        // Validation
        if (!name || typeof name !== 'string') {
            throw new Error('[AnimationGraphBuilder] State name must be a non-empty string');
        }
        if (this.states.some((s)=>s.name === name)) {
            throw new Error(`[AnimationGraphBuilder] State '${name}' already exists`);
        }
        if (typeof speed !== 'number' || speed <= 0) {
            throw new Error('[AnimationGraphBuilder] State speed must be a positive number');
        }
        this.states.push({
            name,
            speed
        });
        console.log(`[AnimationGraphBuilder] ✅ Added state: ${name} (speed: ${speed})`);
        return this;
    }
    /**
     * Add a parameter that controls state transitions
     * 
     * @param {string} name - Parameter name (e.g., 'speed', 'isMoving')
     * @param {string} type - Parameter type: 'BOOLEAN', 'FLOAT', 'INTEGER', 'TRIGGER'
     * @param {any} defaultValue - Initial value
     * @returns {AnimationGraphBuilder} This builder for chaining
     * 
     * @example
     * builder.addParameter('speed', 'FLOAT', 0);           // Movement speed
     * builder.addParameter('isMoving', 'BOOLEAN', false);  // Is agent moving?
     * builder.addParameter('fireTrigger', 'TRIGGER', false); // Shoot weapon
     */ addParameter(name, type, defaultValue) {
        // Validation
        if (!name || typeof name !== 'string') {
            throw new Error('[AnimationGraphBuilder] Parameter name must be a non-empty string');
        }
        if (this.parameters[name]) {
            throw new Error(`[AnimationGraphBuilder] Parameter '${name}' already exists`);
        }
        // Map friendly type names to PlayCanvas constants
        const typeMap = {
            'BOOLEAN': ANIM_PARAMETER_BOOLEAN,
            'FLOAT': ANIM_PARAMETER_FLOAT,
            'INTEGER': ANIM_PARAMETER_INTEGER,
            'TRIGGER': ANIM_PARAMETER_TRIGGER
        };
        const pcType = typeMap[type];
        if (!pcType) {
            throw new Error(`[AnimationGraphBuilder] Invalid parameter type '${type}'. Use: BOOLEAN, FLOAT, INTEGER, or TRIGGER`);
        }
        this.parameters[name] = {
            name,
            type: pcType,
            value: defaultValue
        };
        console.log(`[AnimationGraphBuilder] ✅ Added parameter: ${name} (${type}, default: ${defaultValue})`);
        return this;
    }
    /**
     * Add a transition between two states
     * 
     * @param {string} fromState - Source state name (or 'ANY' for wildcard)
     * @param {string} toState - Destination state name
     * @param {Object} options - Transition configuration
     * @param {number} options.time - Blend time in seconds (default: 0.1)
     * @param {number} options.priority - Priority (higher interrupts lower, default: 0)
     * @param {number} options.exitTime - Wait until X% through animation (0-1, optional)
     * @param {Array} options.conditions - Array of condition objects
     * @returns {AnimationGraphBuilder} This builder for chaining
     * 
     * @example
     * // Simple transition with one condition
     * builder.addTransition('Idle', 'Walk', {
     *   time: 0.1,
     *   conditions: [
     *     { param: 'isMoving', op: 'EQUAL', value: true }
     *   ]
     * });
     * 
     * // Complex transition with multiple conditions
     * builder.addTransition('Walk', 'Run', {
     *   time: 0.1,
     *   conditions: [
     *     { param: 'speed', op: 'GREATER_THAN', value: 2.5 },
     *     { param: 'isGrounded', op: 'EQUAL', value: true }
     *   ]
     * });
     * 
     * // Interrupt transition from ANY state
     * builder.addTransition('ANY', 'Fire', {
     *   time: 0.05,
     *   priority: 1,
     *   conditions: [
     *     { param: 'fireTrigger', op: 'EQUAL', value: true }
     *   ]
     * });
     * 
     * // Transition that waits for animation to finish
     * builder.addTransition('Fire', 'Idle', {
     *   time: 0.1,
     *   exitTime: 0.8  // Wait until 80% complete
     * });
     */ addTransition(fromState, toState, options = {}) {
        // Validation
        if (!fromState || typeof fromState !== 'string') {
            throw new Error('[AnimationGraphBuilder] fromState must be a non-empty string');
        }
        if (!toState || typeof toState !== 'string') {
            throw new Error('[AnimationGraphBuilder] toState must be a non-empty string');
        }
        // Check states exist (except for 'ANY' wildcard)
        if (fromState !== 'ANY' && fromState !== 'START' && fromState !== 'END' && !this.states.some((s)=>s.name === fromState)) {
            throw new Error(`[AnimationGraphBuilder] fromState '${fromState}' does not exist. Add it with addState() first.`);
        }
        if (toState !== 'END' && !this.states.some((s)=>s.name === toState)) {
            throw new Error(`[AnimationGraphBuilder] toState '${toState}' does not exist. Add it with addState() first.`);
        }
        // Build transition object
        const transition = {
            from: fromState,
            to: toState,
            time: options.time !== undefined ? options.time : 0.1,
            priority: options.priority !== undefined ? options.priority : 0
        };
        // Add optional exitTime
        if (options.exitTime !== undefined) {
            if (typeof options.exitTime !== 'number' || options.exitTime < 0 || options.exitTime > 1) {
                throw new Error('[AnimationGraphBuilder] exitTime must be a number between 0 and 1');
            }
            transition.exitTime = options.exitTime;
        }
        // Add conditions if provided
        if (options.conditions && options.conditions.length > 0) {
            transition.conditions = options.conditions.map((cond)=>{
                // Validate condition
                if (!cond.param || !this.parameters[cond.param]) {
                    throw new Error(`[AnimationGraphBuilder] Condition references unknown parameter '${cond.param}'. Add it with addParameter() first.`);
                }
                // Map friendly operator names to PlayCanvas constants
                const opMap = {
                    'EQUAL': ANIM_EQUAL_TO,
                    'NOT_EQUAL': ANIM_NOT_EQUAL_TO,
                    'LESS_THAN': ANIM_LESS_THAN,
                    'LESS_THAN_EQUAL': ANIM_LESS_THAN_EQUAL_TO,
                    'GREATER_THAN': ANIM_GREATER_THAN,
                    'GREATER_THAN_EQUAL': ANIM_GREATER_THAN_EQUAL_TO
                };
                const pcOp = opMap[cond.op];
                if (!pcOp) {
                    throw new Error(`[AnimationGraphBuilder] Invalid operator '${cond.op}'. Use: EQUAL, NOT_EQUAL, LESS_THAN, LESS_THAN_EQUAL, GREATER_THAN, GREATER_THAN_EQUAL`);
                }
                return {
                    parameterName: cond.param,
                    predicate: pcOp,
                    value: cond.value
                };
            });
        }
        this.transitions.push(transition);
        const condStr = options.conditions ? ` (${options.conditions.length} conditions)` : '';
        console.log(`[AnimationGraphBuilder] ✅ Added transition: ${fromState} → ${toState}${condStr}`);
        return this;
    }
    /**
     * Build the final state graph data structure
     * 
     * @returns {Object} PlayCanvas animation state graph data
     * 
     * @example
     * const graphData = builder.build();
     * animComponent.loadStateGraph(graphData);
     */ build() {
        // Validation
        if (this.states.length <= 2) {
            throw new Error('[AnimationGraphBuilder] No states added! Use addState() to add animation states.');
        }
        if (this.transitions.length === 0) {
            console.warn('[AnimationGraphBuilder] ⚠️ No transitions added. State machine may not work correctly.');
        }
        if (Object.keys(this.parameters).length === 0) {
            console.warn('[AnimationGraphBuilder] ⚠️ No parameters added. Transitions may not work correctly.');
        }
        console.log('[AnimationGraphBuilder] 🏗️ Building animation state graph...');
        console.log(`  - States: ${this.states.length}`);
        console.log(`  - Transitions: ${this.transitions.length}`);
        console.log(`  - Parameters: ${Object.keys(this.parameters).length}`);
        return {
            layers: [
                {
                    name: 'Base Layer',
                    states: this.states,
                    transitions: this.transitions
                }
            ],
            parameters: this.parameters
        };
    }
    /**
     * Create a pre-configured builder with common FPS game states
     * This is a convenience factory for typical FPS animations
     * 
     * @returns {AnimationGraphBuilder} Configured builder
     * 
     * @example
     * const builder = AnimationGraphBuilder.createFPSTemplate();
     * // Already has: Idle, Walk, Run, Aim, Fire, Jump states
     * // Already has: speed, isMoving, isAiming, etc. parameters
     * // Add your custom states/transitions:
     * builder.addState('Crouch').addTransition(...);
     */ static createFPSTemplate() {
        const builder = new AnimationGraphBuilder();
        // Add standard FPS states
        builder.addState('Idle', 1.0).addState('Walk', 1.0).addState('Run', 1.0).addState('Aim', 1.0).addState('Fire', 1.0).addState('Jump', 1.0);
        // Add standard FPS parameters
        builder.addParameter('speed', 'FLOAT', 0).addParameter('isMoving', 'BOOLEAN', false).addParameter('isGrounded', 'BOOLEAN', true).addParameter('isAiming', 'BOOLEAN', false).addParameter('jumpTrigger', 'TRIGGER', false).addParameter('fireTrigger', 'TRIGGER', false).addParameter('speedMultiplier', 'FLOAT', 1.0);
        // Add standard FPS transitions
        builder// Entry transition
        .addTransition('START', 'Idle', {
            time: 0
        })// Idle transitions
        .addTransition('Idle', 'Walk', {
            time: 0.1,
            conditions: [
                {
                    param: 'isMoving',
                    op: 'EQUAL',
                    value: true
                },
                {
                    param: 'speed',
                    op: 'GREATER_THAN',
                    value: 0.1
                },
                {
                    param: 'speed',
                    op: 'LESS_THAN',
                    value: 2.5
                }
            ]
        }).addTransition('Idle', 'Run', {
            time: 0.1,
            conditions: [
                {
                    param: 'isMoving',
                    op: 'EQUAL',
                    value: true
                },
                {
                    param: 'speed',
                    op: 'GREATER_THAN_EQUAL',
                    value: 2.5
                }
            ]
        }).addTransition('Idle', 'Aim', {
            time: 0.1,
            conditions: [
                {
                    param: 'isAiming',
                    op: 'EQUAL',
                    value: true
                }
            ]
        })// Walk transitions
        .addTransition('Walk', 'Idle', {
            time: 0.1,
            conditions: [
                {
                    param: 'speed',
                    op: 'LESS_THAN_EQUAL',
                    value: 0.1
                }
            ]
        }).addTransition('Walk', 'Run', {
            time: 0.1,
            conditions: [
                {
                    param: 'speed',
                    op: 'GREATER_THAN_EQUAL',
                    value: 2.5
                }
            ]
        })// Run transitions
        .addTransition('Run', 'Walk', {
            time: 0.1,
            conditions: [
                {
                    param: 'speed',
                    op: 'LESS_THAN',
                    value: 2.5
                },
                {
                    param: 'speed',
                    op: 'GREATER_THAN',
                    value: 0.1
                }
            ]
        }).addTransition('Run', 'Idle', {
            time: 0.1,
            conditions: [
                {
                    param: 'speed',
                    op: 'LESS_THAN_EQUAL',
                    value: 0.1
                }
            ]
        })// Aim transitions
        .addTransition('Aim', 'Idle', {
            time: 0.1,
            conditions: [
                {
                    param: 'isAiming',
                    op: 'EQUAL',
                    value: false
                }
            ]
        })// Fire transitions (interrupt from ANY state)
        .addTransition('ANY', 'Fire', {
            time: 0.05,
            priority: 1,
            conditions: [
                {
                    param: 'fireTrigger',
                    op: 'EQUAL',
                    value: true
                }
            ]
        }).addTransition('Fire', 'Idle', {
            time: 0.1,
            exitTime: 0.8
        })// Jump transitions (interrupt from ANY state)
        .addTransition('ANY', 'Jump', {
            time: 0.05,
            priority: 1,
            conditions: [
                {
                    param: 'jumpTrigger',
                    op: 'EQUAL',
                    value: true
                }
            ]
        }).addTransition('Jump', 'Idle', {
            time: 0.2,
            exitTime: 0.8
        });
        console.log('[AnimationGraphBuilder] 🎮 Created FPS template with standard states/transitions');
        return builder;
    }
    constructor(){
        this.states = [];
        this.transitions = [];
        this.parameters = {};
        // Always include START and END states
        this.states.push({
            name: 'START'
        });
        this.states.push({
            name: 'END'
        });
    }
}

export { AnimationGraphBuilder };
