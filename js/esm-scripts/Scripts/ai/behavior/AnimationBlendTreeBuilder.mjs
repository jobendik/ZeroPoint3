import { ANIM_BLEND_2D_CARTESIAN, ANIM_BLEND_2D_DIRECTIONAL } from '../../../../playcanvas-stable.min.mjs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANIMATION BLEND TREE BUILDER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Create smooth animation blending instead of hard state transitions.
 * Blends between animations based on continuous parameters (speed, direction, etc.)
 * 
 * WHY USE BLEND TREES?
 * ✅ Smooth transitions - No jarring animation switches
 * ✅ Natural movement - Animations interpolate at any speed
 * ✅ Better performance - Single state instead of multiple transitions
 * ✅ Easier to tune - Just adjust blend points, not transition conditions
 * 
 * BLEND TREE TYPES:
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. 1D Blend Tree (pc.ANIM_BLEND_1D)
 *    - Single parameter (e.g., speed)
 *    - Use for: Idle → Walk → Run progression
 *    - Example: Blend from idle (0.0) to walk (2.0) to run (5.0)
 * 
 * 2. 2D Cartesian Blend Tree (pc.ANIM_BLEND_2D_CARTESIAN)
 *    - Two parameters (e.g., posX, posY)
 *    - Use for: 4-directional movement, emotes
 *    - Example: Blend between 4 animations in 2D space
 * 
 * 3. 2D Directional Blend Tree (pc.ANIM_BLEND_2D_DIRECTIONAL)
 *    - Two parameters for directional movement
 *    - Use for: Forward/backward/strafe locomotion
 *    - Syncs animation durations for consistent footstep timing
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 * USAGE EXAMPLE - 1D LOCOMOTION (RECOMMENDED FOR FPS):
 * ──────────────────────────────────────────────────────────────────────────────
 * const builder = new AnimationBlendTreeBuilder('Movement', '1D', 'speed');
 * 
 * builder
 *   .addAnimation('Idle', 0.0)      // Speed 0.0 m/s
 *   .addAnimation('Walk', 2.5)      // Speed 2.5 m/s
 *   .addAnimation('Run', 5.0);      // Speed 5.0 m/s
 * 
 * const stateData = builder.build();
 * 
 * // At runtime: Just set speed parameter
 * animComponent.setFloat('speed', 3.5);
 * // → Automatically blends 40% Walk + 60% Run
 * ──────────────────────────────────────────────────────────────────────────────
 * 
 * USAGE EXAMPLE - 2D DIRECTIONAL (ADVANCED):
 * ──────────────────────────────────────────────────────────────────────────────
 * const builder = new AnimationBlendTreeBuilder('Locomotion', '2D_DIRECTIONAL', ['speedX', 'speedZ']);
 * 
 * builder
 *   .addAnimation('Idle', [0.0, 0.0])
 *   .addAnimation('WalkForward', [0.0, 1.0])
 *   .addAnimation('WalkBackward', [0.0, -1.0])
 *   .addAnimation('StrafeLeft', [-1.0, 0.0])
 *   .addAnimation('StrafeRight', [1.0, 0.0])
 *   .setSyncDurations(true);  // Keep footsteps in sync
 * 
 * const stateData = builder.build();
 * ──────────────────────────────────────────────────────────────────────────────
 */ class AnimationBlendTreeBuilder {
    /**
     * Add an animation to the blend tree
     * 
     * @param {string} name - Animation name (must match clip assignment name)
     * @param {number|Array<number>} point - Blend point value(s)
     * @param {Object} options - Optional settings
     * @param {number} options.speed - Animation playback speed multiplier (default: 1.0)
     * @returns {AnimationBlendTreeBuilder} This builder for chaining
     * 
     * @example
     * // 1D blend tree
     * builder.addAnimation('Idle', 0.0);
     * builder.addAnimation('Walk', 2.5);
     * builder.addAnimation('Run', 5.0);
     * 
     * @example
     * // 2D blend tree
     * builder.addAnimation('WalkForward', [0.0, 1.0]);
     * builder.addAnimation('StrafeLeft', [-1.0, 0.0]);
     * 
     * @example
     * // Animation with custom speed
     * builder.addAnimation('WalkBackward', [0.0, -1.0], { speed: -1.0 });
     */ addAnimation(name, point, options = {}) {
        // Validate point format
        if (this.blendType === '1D') {
            if (typeof point !== 'number') {
                throw new Error(`[AnimationBlendTreeBuilder] 1D blend tree requires number point, got ${typeof point}`);
            }
        } else {
            if (!Array.isArray(point) || point.length !== 2) {
                throw new Error('[AnimationBlendTreeBuilder] 2D blend tree requires [x, y] point array');
            }
        }
        const child = {
            name,
            point: this.blendType === '1D' ? point : point
        };
        // Add optional speed multiplier
        if (options.speed !== undefined) {
            child.speed = options.speed;
        }
        this.children.push(child);
        const pointStr = this.blendType === '1D' ? point.toFixed(1) : `[${point[0].toFixed(1)}, ${point[1].toFixed(1)}]`;
        console.log(`[AnimationBlendTreeBuilder] ✅ Added animation: ${name} at point ${pointStr}`);
        return this;
    }
    /**
     * Set whether the blend tree should loop
     * 
     * @param {boolean} loop - Loop animations (default: true)
     * @returns {AnimationBlendTreeBuilder} This builder for chaining
     */ setLoop(loop) {
        this.loop = loop;
        return this;
    }
    /**
     * Set overall playback speed for the blend tree
     * 
     * @param {number} speed - Speed multiplier (default: 1.0)
     * @returns {AnimationBlendTreeBuilder} This builder for chaining
     */ setSpeed(speed) {
        this.speed = speed;
        return this;
    }
    /**
     * Enable duration synchronization (for 2D directional blend trees)
     * Keeps animations in sync (e.g., footsteps aligned)
     * 
     * @param {boolean} sync - Sync durations (default: false)
     * @returns {AnimationBlendTreeBuilder} This builder for chaining
     * 
     * @example
     * // For locomotion with consistent footstep timing
     * builder.setSyncDurations(true);
     */ setSyncDurations(sync) {
        this.syncDurations = sync;
        return this;
    }
    /**
     * Build the blend tree state data
     * 
     * @returns {Object} PlayCanvas blend tree state configuration
     * 
     * @example
     * const stateData = builder.build();
     * // Use in state graph:
     * // states: [stateData]
     */ build() {
        // Validation
        if (this.children.length === 0) {
            throw new Error('[AnimationBlendTreeBuilder] No animations added to blend tree');
        }
        if (this.blendType === '1D' && this.children.length < 2) {
            throw new Error('[AnimationBlendTreeBuilder] 1D blend tree requires at least 2 animations');
        }
        // Map friendly type names to PlayCanvas constants
        const typeMap = {
            '1D': '1D',
            '2D_CARTESIAN': ANIM_BLEND_2D_CARTESIAN,
            '2D_DIRECTIONAL': ANIM_BLEND_2D_DIRECTIONAL
        };
        // Build blend tree configuration
        const blendTree = {
            type: typeMap[this.blendType],
            children: this.children
        };
        // Add parameters
        if (this.blendType === '1D') {
            blendTree.parameter = this.parameters[0];
        } else {
            blendTree.parameters = this.parameters;
        }
        // Add optional syncDurations (for 2D directional)
        if (this.syncDurations && this.blendType === '2D_DIRECTIONAL') {
            blendTree.syncDurations = true;
        }
        // Build state data
        const stateData = {
            name: this.stateName,
            speed: this.speed,
            loop: this.loop,
            blendTree: blendTree
        };
        console.log(`[AnimationBlendTreeBuilder] 🏗️ Built blend tree state: ${this.stateName}`);
        console.log(`  - Type: ${this.blendType}`);
        console.log(`  - Parameters: ${this.parameters.join(', ')}`);
        console.log(`  - Animations: ${this.children.length}`);
        return stateData;
    }
    /**
     * Get required parameters for this blend tree
     * Use this to add parameters to the animation graph
     * 
     * @returns {Object} Parameter definitions for AnimationGraphBuilder
     * 
     * @example
     * const params = blendTreeBuilder.getRequiredParameters();
     * // Returns: { speed: { type: 'FLOAT', value: 0 } }
     * 
     * // Add to animation graph:
     * graphBuilder.addParameter('speed', 'FLOAT', 0);
     */ getRequiredParameters() {
        const params = {};
        for (const paramName of this.parameters){
            params[paramName] = {
                type: 'FLOAT',
                value: 0
            };
        }
        return params;
    }
    /**
     * Create a blend tree builder
     * 
     * @param {string} stateName - Name of the state (e.g., 'Movement', 'Locomotion')
     * @param {string} blendType - '1D', '2D_CARTESIAN', or '2D_DIRECTIONAL'
     * @param {string|Array<string>} parameters - Parameter name(s) for blending
     * 
     * @example
     * // 1D blend tree (speed-based)
     * const builder = new AnimationBlendTreeBuilder('Movement', '1D', 'speed');
     * 
     * @example
     * // 2D blend tree (direction-based)
     * const builder = new AnimationBlendTreeBuilder('Locomotion', '2D_DIRECTIONAL', ['speedX', 'speedZ']);
     */ constructor(stateName, blendType, parameters){
        this.stateName = stateName;
        this.blendType = blendType;
        this.parameters = Array.isArray(parameters) ? parameters : [
            parameters
        ];
        this.children = [];
        this.speed = 1.0;
        this.loop = true;
        this.syncDurations = false;
        // Validate blend type
        const validTypes = [
            '1D',
            '2D_CARTESIAN',
            '2D_DIRECTIONAL'
        ];
        if (!validTypes.includes(blendType)) {
            throw new Error(`[AnimationBlendTreeBuilder] Invalid blend type '${blendType}'. Use: ${validTypes.join(', ')}`);
        }
        // Validate parameters
        if (blendType === '1D' && this.parameters.length !== 1) {
            throw new Error('[AnimationBlendTreeBuilder] 1D blend tree requires exactly 1 parameter');
        }
        if ((blendType === '2D_CARTESIAN' || blendType === '2D_DIRECTIONAL') && this.parameters.length !== 2) {
            throw new Error('[AnimationBlendTreeBuilder] 2D blend tree requires exactly 2 parameters');
        }
        console.log(`[AnimationBlendTreeBuilder] Creating ${blendType} blend tree: ${stateName}`);
    }
}
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRESET BLEND TREES FOR COMMON USE CASES
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /**
 * Create a preset 1D locomotion blend tree (Idle → Walk → Run)
 * This is the most common use case for FPS games
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.walkSpeed - Speed threshold for walk animation (default: 2.5)
 * @param {number} options.runSpeed - Speed threshold for run animation (default: 5.0)
 * @returns {AnimationBlendTreeBuilder} Configured builder
 * 
 * @example
 * const builder = AnimationBlendTreeBuilder.createLocomotionBlendTree();
 * const stateData = builder.build();
 * 
 * // At runtime:
 * animComponent.setFloat('speed', 3.5);
 * // → Automatically blends between Walk and Run
 */ AnimationBlendTreeBuilder.createLocomotionBlendTree = function(options = {}) {
    const walkSpeed = options.walkSpeed || 2.5;
    const runSpeed = options.runSpeed || 5.0;
    const builder = new AnimationBlendTreeBuilder('Movement', '1D', 'speed');
    builder.addAnimation('Idle', 0.0).addAnimation('Walk', walkSpeed).addAnimation('Run', runSpeed).setLoop(true).setSpeed(1.0);
    console.log('[AnimationBlendTreeBuilder] 🎮 Created preset locomotion blend tree');
    return builder;
};
/**
 * Create a preset 2D directional locomotion blend tree
 * Use for games with full directional movement (forward/back/strafe)
 * 
 * @returns {AnimationBlendTreeBuilder} Configured builder
 * 
 * @example
 * const builder = AnimationBlendTreeBuilder.create2DLocomotionBlendTree();
 * const stateData = builder.build();
 * 
 * // At runtime:
 * animComponent.setFloat('speedX', 0.5);   // Strafe right
 * animComponent.setFloat('speedZ', 1.0);   // Move forward
 * // → Blends between animations based on direction
 */ AnimationBlendTreeBuilder.create2DLocomotionBlendTree = function() {
    const builder = new AnimationBlendTreeBuilder('Locomotion', '2D_DIRECTIONAL', [
        'speedX',
        'speedZ'
    ]);
    builder.addAnimation('Idle', [
        0.0,
        0.0
    ]).addAnimation('WalkForward', [
        0.0,
        1.0
    ]).addAnimation('WalkBackward', [
        0.0,
        -1.0
    ], {
        speed: -1.0
    }).addAnimation('StrafeLeft', [
        -1.0,
        0.0
    ]).addAnimation('StrafeRight', [
        1.0,
        0.0
    ]).setSyncDurations(true).setLoop(true).setSpeed(1.0);
    console.log('[AnimationBlendTreeBuilder] 🎮 Created preset 2D locomotion blend tree');
    return builder;
};

export { AnimationBlendTreeBuilder };
