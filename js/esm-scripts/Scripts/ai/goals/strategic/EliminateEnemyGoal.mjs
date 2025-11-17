import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedAttackGoal } from '../composite/AttackGoal.mjs';
import { SearchForEnemyGoal } from '../composite/SearchForEnemyGoal.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * STRATEGIC GOAL: Eliminate Enemy Team
 * 
 * This is the ultimate objective for Team Deathmatch mode.
 * The goal coordinates high-level behavior to hunt and eliminate enemies.
 * 
 * Behavior:
 * - If enemy visible → Attack
 * - If enemy not visible → Search known locations
 * - Never "completes" - always active in background
 * 
 * This goal represents the AI's understanding of what it must do to WIN.
 */ class EliminateEnemyGoal extends YUKA.CompositeGoal {
    activate() {
        const agent = this.owner?.agent || this.owner;
        Logger.goal(agent, `[STRATEGIC] Eliminate Enemy - Activating`);
        this.status = YUKA.Goal.STATUS.ACTIVE;
        // Determine immediate tactical approach
        this._planTacticalApproach();
    }
    execute() {
        // ✅ FIX: Don't force perpetual ACTIVE status - let YUKA arbitration work!
        // If this goal has no valid tactical approach, it should complete and allow
        // higher priority goals (like GetWeapon at 54%) to take over
        const agent = this.owner?.agent || this.owner;
        const now = performance.now();
        // Execute current subgoals
        this.executeSubgoals();
        // Re-evaluate tactical approach periodically
        if (now - this.lastEvaluationTime > this.evaluationInterval) {
            this.lastEvaluationTime = now;
            // If no subgoals or they completed, re-plan
            if (this.subgoals.length === 0) {
                this._planTacticalApproach();
                // If we still have no subgoals after planning, complete this goal
                // This allows YUKA to pick a different goal (like GetWeapon)
                if (this.subgoals.length === 0) {
                    Logger.goal(agent, `[STRATEGIC] No tactical approach available - completing to allow goal switch`);
                    this.status = YUKA.Goal.STATUS.COMPLETED;
                    return this.status;
                }
            }
        }
        // Keep active if we have valid subgoals
        this.status = YUKA.Goal.STATUS.ACTIVE;
        return this.status;
    }
    /**
     * Determine the best tactical approach to eliminate enemy
     */ _planTacticalApproach() {
        const agent = this.owner?.agent || this.owner;
        // Check if we have a target
        const hasTarget = agent.targetSystem?.hasTarget?.();
        const targetVisible = hasTarget && agent.targetSystem?.isTargetVisible?.();
        if (targetVisible) {
            // Enemy visible - ENGAGE!
            Logger.goal(agent, `[STRATEGIC → TACTICAL] Enemy visible, engaging`);
            // Store position for later searching
            const target = agent.targetSystem.getCurrentTarget();
            if (target && target.getPosition) {
                this.lastKnownEnemyPosition = target.getPosition().clone();
            }
            // Clear subgoals and attack
            this.clearSubgoals();
            this.addSubgoal(new EnhancedAttackGoal(this.owner));
        } else if (this.lastKnownEnemyPosition) {
            // We know where enemy was - SEARCH that area
            Logger.goal(agent, `[STRATEGIC → TACTICAL] Searching last known position`);
            this.clearSubgoals();
            this.addSubgoal(new SearchForEnemyGoal(this.owner, this.lastKnownEnemyPosition));
        } else {
            // ✅ FIX: No information and no recent contact - DON'T force patrolling
            // Let the goal complete so YUKA can pick higher priority goals (GetWeapon, Explore, etc.)
            // The evaluator will re-select this goal later when there's actual combat
            Logger.goal(agent, `[STRATEGIC → TACTICAL] No target info - deferring to other goals`);
            this.clearSubgoals();
        // Don't add SearchForEnemyGoal here - let evaluators decide what to do
        }
    }
    terminate() {
        const agent = this.owner?.agent || this.owner;
        Logger.goal(agent, `[STRATEGIC] Eliminate Enemy - Terminating`);
        this.clearSubgoals();
    }
    /**
     * Notify goal of enemy death
     */ onEnemyKilled(enemyEntity) {
        const agent = this.owner?.agent || this.owner;
        Logger.goal(agent, `[STRATEGIC] Enemy eliminated! Continuing hunt...`);
        // Clear last known position since enemy is dead
        this.lastKnownEnemyPosition = null;
        // Force re-evaluation of tactical approach
        this.lastEvaluationTime = 0;
    }
    /**
     * Update with new enemy position information
     */ updateEnemyPosition(position) {
        this.lastKnownEnemyPosition = position.clone();
    }
    constructor(owner){
        super(owner);
        this.type = 'strategic';
        this.lastEvaluationTime = 0;
        this.evaluationInterval = aiConfig.evaluators.ELIMINATE_ENEMY_INTERVAL_MS; // Re-evaluate every 3 seconds
        // Note: VisionSystem now tracks last known positions with confidence decay
        // This is kept as a simple fallback for immediate tactical decisions
        this.lastKnownEnemyPosition = null;
    }
}

export { EliminateEnemyGoal };
