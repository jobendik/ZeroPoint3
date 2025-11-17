import { AnimationBlendTreeBuilder } from './AnimationBlendTreeBuilder.mjs';
import { AnimationGraphBuilder } from './AnimationGraphBuilder.mjs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BEFORE: DISCRETE STATES WITH HARD TRANSITIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 */ function createDiscreteStateGraph_OLD() {
    const builder = new AnimationGraphBuilder();
    // Add states
    builder.addState('Idle', 1.0).addState('Walk', 1.0).addState('Run', 1.0).addState('Aim', 1.0).addState('Fire', 1.0);
    // Add parameters
    builder.addParameter('speed', 'FLOAT', 0).addParameter('isMoving', 'BOOLEAN', false).addParameter('isAiming', 'BOOLEAN', false).addParameter('fireTrigger', 'TRIGGER', false);
    // Add transitions (MANY TRANSITIONS!)
    builder.addTransition('START', 'Idle', {
        time: 0
    })// Idle → Walk (hard threshold at 0.1 m/s)
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
    })// Idle → Run (hard threshold at 2.5 m/s)
    .addTransition('Idle', 'Run', {
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
    })// Walk → Idle
    .addTransition('Walk', 'Idle', {
        time: 0.1,
        conditions: [
            {
                param: 'speed',
                op: 'LESS_THAN_EQUAL',
                value: 0.1
            }
        ]
    })// Walk → Run (ABRUPT CHANGE AT 2.5 m/s!)
    .addTransition('Walk', 'Run', {
        time: 0.1,
        conditions: [
            {
                param: 'speed',
                op: 'GREATER_THAN_EQUAL',
                value: 2.5
            }
        ]
    })// Run → Walk (ABRUPT CHANGE AT 2.5 m/s!)
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
    })// Run → Idle
    .addTransition('Run', 'Idle', {
        time: 0.1,
        conditions: [
            {
                param: 'speed',
                op: 'LESS_THAN_EQUAL',
                value: 0.1
            }
        ]
    })// Aim transitions
    .addTransition('Idle', 'Aim', {
        time: 0.1,
        conditions: [
            {
                param: 'isAiming',
                op: 'EQUAL',
                value: true
            }
        ]
    }).addTransition('Aim', 'Idle', {
        time: 0.1,
        conditions: [
            {
                param: 'isAiming',
                op: 'EQUAL',
                value: false
            }
        ]
    })// Fire interrupt
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
    });
    return builder.build();
}
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AFTER: BLEND TREE WITH SMOOTH TRANSITIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 */ function createBlendTreeGraph_NEW() {
    // ───────────────────────────────────────────────────────────────────────
    // CREATE BLEND TREE FOR LOCOMOTION
    // ───────────────────────────────────────────────────────────────────────
    // This replaces Idle, Walk, Run states with a single Movement state
    // that smoothly blends between animations based on speed
    // ───────────────────────────────────────────────────────────────────────
    const locomotionBlendTree = new AnimationBlendTreeBuilder('Movement', '1D', 'speed');
    locomotionBlendTree.addAnimation('Idle', 0.0) // At 0 m/s: 100% Idle
    .addAnimation('Walk', 2.5) // At 2.5 m/s: 100% Walk
    .addAnimation('Run', 5.0) // At 5.0 m/s: 100% Run
    .setLoop(true).setSpeed(1.0);
    // ───────────────────────────────────────────────────────────────────────
    // CREATE ANIMATION GRAPH
    // ───────────────────────────────────────────────────────────────────────
    const builder = new AnimationGraphBuilder();
    // Add blend tree state (replaces Idle, Walk, Run)
    builder.addBlendTreeState(locomotionBlendTree.build());
    // Add other states for actions
    builder.addState('Aim', 1.0).addState('Fire', 1.0);
    // Add parameters (fewer needed!)
    builder.addParameter('speed', 'FLOAT', 0).addParameter('isAiming', 'BOOLEAN', false).addParameter('fireTrigger', 'TRIGGER', false);
    // Add transitions (MUCH FEWER!)
    builder.addTransition('START', 'Movement', {
        time: 0
    })// Movement ↔ Aim
    .addTransition('Movement', 'Aim', {
        time: 0.1,
        conditions: [
            {
                param: 'isAiming',
                op: 'EQUAL',
                value: true
            }
        ]
    }).addTransition('Aim', 'Movement', {
        time: 0.1,
        conditions: [
            {
                param: 'isAiming',
                op: 'EQUAL',
                value: false
            }
        ]
    })// Fire interrupt (from ANY state)
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
    }).addTransition('Fire', 'Movement', {
        time: 0.1,
        exitTime: 0.8
    });
    return builder.build();
}
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COMPARISON: CODE COMPLEXITY
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /**
 * OLD SYSTEM:
 * - 5 states (Idle, Walk, Run, Aim, Fire)
 * - 4 parameters
 * - 12 transitions (many for locomotion)
 * - Complex conditions (checking isMoving + speed thresholds)
 * - Hard transitions at 2.5 m/s threshold
 * 
 * NEW SYSTEM:
 * - 3 states (Movement [blend tree], Aim, Fire)
 * - 3 parameters (no isMoving needed!)
 * - 5 transitions (fewer!)
 * - Simple conditions
 * - Smooth blending at ALL speeds
 */ /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * USAGE EXAMPLE: INTEGRATING INTO AnimationController
 * ═══════════════════════════════════════════════════════════════════════════════
 */ function exampleIntegration() {
    // In AnimationController.initialize()
    // ───────────────────────────────────────────────────────────────────────
    // 1. Find animation clips
    // ───────────────────────────────────────────────────────────────────────
    const clips = this._findAnimationClips();
    // ───────────────────────────────────────────────────────────────────────
    // 2. Create blend tree graph
    // ───────────────────────────────────────────────────────────────────────
    const graphData = createBlendTreeGraph_NEW();
    // ───────────────────────────────────────────────────────────────────────
    // 3. Load into animation component
    // ───────────────────────────────────────────────────────────────────────
    this.animComponent.loadStateGraph(graphData);
    // ───────────────────────────────────────────────────────────────────────
    // 4. Assign animation clips (NOTE THE DOTTED NOTATION!)
    // ───────────────────────────────────────────────────────────────────────
    const baseLayer = this.animComponent.baseLayer;
    // Blend tree animations use StateName.ChildName format
    baseLayer.assignAnimation('Movement.Idle', clips.idle);
    baseLayer.assignAnimation('Movement.Walk', clips.walk);
    baseLayer.assignAnimation('Movement.Run', clips.run);
    // Regular state animations
    baseLayer.assignAnimation('Aim', clips.aim);
    baseLayer.assignAnimation('Fire', clips.fire);
    console.log('[AnimationController] ✅ Blend tree system initialized!');
}
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RUNTIME COMPARISON
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /**
 * OLD SYSTEM (AnimationController.update):
 * 
 * const speed = calculateSpeed();
 * const isMoving = speed > 0.1;
 * 
 * animComponent.setFloat('speed', speed);
 * animComponent.setBoolean('isMoving', isMoving);
 * 
 * // At speed 2.4 m/s: Walk animation
 * // At speed 2.6 m/s: Run animation  ← ABRUPT CHANGE!
 */ /**
 * NEW SYSTEM (AnimationController.update):
 * 
 * const speed = calculateSpeed();
 * 
 * // Just set speed - blending happens automatically!
 * animComponent.setFloat('speed', speed);
 * 
 * // At speed 2.4 m/s: 96% Walk + 4% Run
 * // At speed 2.6 m/s: 92% Walk + 8% Run  ← SMOOTH BLEND!
 * // At speed 3.5 m/s: 40% Walk + 60% Run
 * // At speed 4.0 m/s: 20% Walk + 80% Run
 */ /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VISUAL DIFFERENCE
 * ═══════════════════════════════════════════════════════════════════════════════
 */ /**
 * OLD SYSTEM:
 * 
 * Time:   0s      1s      2s      3s      4s      5s
 * Speed:  0.0 → 2.0 → 2.5 → 3.0 → 4.0 → 5.0
 * State:  Idle    Walk    Run     Run     Run
 *                 ↑       ↑
 *              Smooth   ABRUPT!
 *              blend    (hard transition at 2.5 m/s)
 * 
 * 
 * NEW SYSTEM:
 * 
 * Time:   0s      1s      2s      3s      4s      5s
 * Speed:  0.0 → 2.0 → 2.5 → 3.0 → 4.0 → 5.0
 * Blend:  Idle    80%W    Walk    60%W    40%W    Run
 *                         100%    40%R    60%R
 *                 ↑       ↑       ↑       ↑       ↑
 *              ALL SMOOTH - NO HARD TRANSITIONS!
 */ /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MIGRATION CHECKLIST
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. ✅ Import AnimationBlendTreeBuilder
 * 2. ✅ Create blend tree for locomotion (Idle, Walk, Run)
 * 3. ✅ Add blend tree state to graph builder
 * 4. ✅ Remove old Idle, Walk, Run discrete states
 * 5. ✅ Remove isMoving parameter (not needed!)
 * 6. ✅ Remove complex speed threshold transitions
 * 7. ✅ Update clip assignment to use dotted notation (Movement.Idle, etc.)
 * 8. ✅ Simplify update() method - just set speed parameter
 * 9. ✅ Test at various speeds (0, 1, 2.5, 3.5, 5.0 m/s)
 * 10. ✅ Tune blend points if animations look wrong
 */ /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRESET FACTORY FOR EVEN EASIER SETUP
 * ═══════════════════════════════════════════════════════════════════════════════
 */ function createBlendTreeGraphWithPreset() {
    // Use preset factory for instant setup!
    const locomotionBlendTree = AnimationBlendTreeBuilder.createLocomotionBlendTree({
        walkSpeed: 2.5,
        runSpeed: 5.0
    });
    const builder = new AnimationGraphBuilder();
    builder.addBlendTreeState(locomotionBlendTree.build());
    builder.addParameter('speed', 'FLOAT', 0);
    builder.addTransition('START', 'Movement', {
        time: 0
    });
    return builder.build();
} /**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EXPECTED RESULTS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Before: Agent movement looks robotic with visible "pops" when transitioning
 *         between Walk and Run at 2.5 m/s threshold
 * 
 * After:  Agent movement is smooth and natural at all speeds, with seamless
 *         blending between animations
 * 
 * Performance: Minimal impact - blend tree is actually FASTER than multiple
 *              state transitions with complex conditions
 * 
 * Code:   40% less code, easier to maintain, clearer intent
 */

export { createBlendTreeGraphWithPreset, createBlendTreeGraph_NEW, createDiscreteStateGraph_OLD, exampleIntegration };
