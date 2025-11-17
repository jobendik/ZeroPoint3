import { ANIM_EQUAL_TO, ANIM_STATE_ANY, ANIM_PARAMETER_BOOLEAN } from '../../../../playcanvas-stable.min.mjs';

// ============================================================================
// SIMPLIFIED ANIMATION GRAPH - ONLY 4 ANIMATIONS
// ============================================================================
// Use this for testing with minimal Mixamo animations:
// 1. Idle
// 2. Walk (or Run)
// 3. Fire (shooting)
// 4. Death
// ============================================================================
class ProgrammaticAnimationGraph {
    /**
     * Load a SIMPLIFIED animation graph with only 4 states
     * @param {pc.AnimComponent} animComponent - The animation component to configure
     * @param {Object} animationAssets - Object mapping animation names to assets
     */ static loadAnimationGraph(animComponent, animationAssets) {
        console.log('[SimplifiedAnimationGraph] Creating MINIMAL animation state graph (4 animations)...');
        // ═══════════════════════════════════════════════════════════════════════
        // SIMPLIFIED STATE GRAPH - ONLY 4 ANIMATIONS
        // ═══════════════════════════════════════════════════════════════════════
        const animStateGraphData = {
            layers: [
                {
                    name: 'Base Layer',
                    // ───────────────────────────────────────────────────────────
                    // STATES - ONLY 4 REQUIRED
                    // ✅ CRITICAL: Each state MUST have a unique name string!
                    // ───────────────────────────────────────────────────────────
                    states: [
                        {
                            name: 'START'
                        },
                        {
                            name: 'Idle',
                            speed: 1.0,
                            loop: true
                        },
                        {
                            name: 'Walk',
                            speed: 1.0,
                            loop: true
                        },
                        {
                            name: 'Fire',
                            speed: 1.0,
                            loop: true
                        },
                        {
                            name: 'Death',
                            speed: 1.0,
                            loop: false // Death plays once!
                        },
                        {
                            name: 'END'
                        }
                    ],
                    // ───────────────────────────────────────────────────────────
                    // TRANSITIONS - SIMPLIFIED LOGIC
                    // ───────────────────────────────────────────────────────────
                    transitions: [
                        // ─────────────────────────────────────────────────────
                        // START → Idle (auto-entry)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'START',
                            to: 'Idle',
                            time: 0,
                            priority: 0
                        },
                        // ─────────────────────────────────────────────────────
                        // Idle → Walk (when moving)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Idle',
                            to: 'Walk',
                            time: 0.2,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // Walk → Idle (when stopped)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Walk',
                            to: 'Idle',
                            time: 0.2,
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
                        // ANY → Fire (when shooting)
                        // ─────────────────────────────────────────────────────
                        {
                            from: ANIM_STATE_ANY,
                            to: 'Fire',
                            time: 0.1,
                            priority: 10,
                            conditions: [
                                {
                                    parameterName: 'isFiring',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ],
                            exitTime: 0.0 // Interrupt immediately
                        },
                        // ─────────────────────────────────────────────────────
                        // Fire → Idle (when done shooting)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Fire',
                            to: 'Idle',
                            time: 0.2,
                            priority: 0,
                            conditions: [
                                {
                                    parameterName: 'isFiring',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // Fire → Walk (firing while moving)
                        // ─────────────────────────────────────────────────────
                        {
                            from: 'Fire',
                            to: 'Walk',
                            time: 0.1,
                            priority: 5,
                            conditions: [
                                {
                                    parameterName: 'isFiring',
                                    predicate: ANIM_EQUAL_TO,
                                    value: false
                                },
                                {
                                    parameterName: 'isMoving',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ]
                        },
                        // ─────────────────────────────────────────────────────
                        // ANY → Death (HIGHEST PRIORITY - interrupts everything)
                        // ─────────────────────────────────────────────────────
                        {
                            from: ANIM_STATE_ANY,
                            to: 'Death',
                            time: 0.1,
                            priority: 100,
                            conditions: [
                                {
                                    parameterName: 'isDead',
                                    predicate: ANIM_EQUAL_TO,
                                    value: true
                                }
                            ],
                            exitTime: 0.0 // Interrupt immediately
                        }
                    ]
                }
            ],
            // ───────────────────────────────────────────────────────────────────
            // PARAMETERS - Control which animation plays
            // ───────────────────────────────────────────────────────────────────
            parameters: {
                isMoving: {
                    name: 'isMoving',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                isFiring: {
                    name: 'isFiring',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                },
                isDead: {
                    name: 'isDead',
                    type: ANIM_PARAMETER_BOOLEAN,
                    value: false
                }
            }
        };
        // ═══════════════════════════════════════════════════════════════════════
        // LOAD THE STATE GRAPH INTO PLAYCANVAS
        // ═══════════════════════════════════════════════════════════════════════
        console.log('[SimplifiedAnimationGraph] Loading state graph data...');
        animComponent.loadStateGraph(animStateGraphData);
        console.log('[SimplifiedAnimationGraph] ✅ State graph loaded!');
        console.log('[SimplifiedAnimationGraph] Parameters:', Object.keys(animComponent.parameters));
        // ═══════════════════════════════════════════════════════════════════════
        // ASSIGN ANIMATION CLIPS TO STATES
        // ═══════════════════════════════════════════════════════════════════════
        const baseLayer = animComponent.baseLayer;
        if (!baseLayer) {
            console.error('[SimplifiedAnimationGraph] ❌ Failed to get base layer!');
            return false;
        }
        console.log('[SimplifiedAnimationGraph] Assigning animation clips to states...');
        // ✅ USE THE SAME METHOD AS THE WORKING VERSION!
        // Use baseLayer.assignAnimation() instead of directly setting state.animations
        // ───────────────────────────────────────────────────────────────────────
        // Idle Animation
        // ───────────────────────────────────────────────────────────────────────
        if (animationAssets.idle) {
            baseLayer.assignAnimation('Idle', animationAssets.idle);
            console.log('[SimplifiedAnimationGraph] ✅ Assigned Idle animation');
        } else {
            console.warn('[SimplifiedAnimationGraph] ⚠️ Idle animation missing - no asset found');
        }
        // ───────────────────────────────────────────────────────────────────────
        // Walk Animation (can be "Walk" or "Run" from Mixamo)
        // ───────────────────────────────────────────────────────────────────────
        const walkAnim = animationAssets.walk || animationAssets.run; // Accept either
        if (walkAnim) {
            baseLayer.assignAnimation('Walk', walkAnim);
            console.log('[SimplifiedAnimationGraph] ✅ Assigned Walk animation');
        } else {
            console.warn('[SimplifiedAnimationGraph] ⚠️ Walk/Run animation missing - no asset found');
        }
        // ───────────────────────────────────────────────────────────────────────
        // Fire Animation
        // ───────────────────────────────────────────────────────────────────────
        if (animationAssets.fire) {
            baseLayer.assignAnimation('Fire', animationAssets.fire);
            console.log('[SimplifiedAnimationGraph] ✅ Assigned Fire animation');
        } else {
            console.warn('[SimplifiedAnimationGraph] ⚠️ Fire animation missing - no asset found');
        }
        // ───────────────────────────────────────────────────────────────────────
        // Death Animation (NEVER LOOP!)
        // ───────────────────────────────────────────────────────────────────────
        if (animationAssets.death) {
            baseLayer.assignAnimation('Death', animationAssets.death);
            console.log('[SimplifiedAnimationGraph] ✅ Assigned Death animation (loop=false)');
        } else {
            console.warn('[SimplifiedAnimationGraph] ⚠️ Death animation missing - no asset found');
        }
        console.log('[SimplifiedAnimationGraph] ✅ Animation graph setup complete!');
        return true;
    }
}

export { ProgrammaticAnimationGraph };
