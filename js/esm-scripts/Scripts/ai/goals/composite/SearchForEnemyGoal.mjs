import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { EnhancedExploreGoal } from './ExploreGoal.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * SEARCH FOR ENEMY GOAL (Tactical)
 * 
 * Supports the strategic objective by actively searching for enemies.
 * Different from passive exploration - this has purpose and direction.
 * 
 * Behavior:
 * - If target position provided: Move toward it and search area
 * - If no target: Patrol high-traffic areas looking for enemies
 * 
 * Completes when:
 * - Enemy is found (success)
 * - Search timeout expires (completion)
 */ class SearchForEnemyGoal extends YUKA.CompositeGoal {
    activate() {
        const agent = this.owner?.agent || this.owner;
        this.startTime = performance.now();
        this.status = YUKA.Goal.STATUS.ACTIVE;
        // ✅ ENHANCEMENT: Check VisionSystem for investigation targets (with confidence decay)
        const bestTarget = agent.visionSystem?.getBestInvestigationTarget?.();
        if (bestTarget && bestTarget.confidence > 0.5) {
            // Use vision system's tracked position (more reliable with confidence decay)
            this.targetPosition = bestTarget.position.clone();
            Logger.goal(agent, `Investigating ${bestTarget.source} contact ` + `(confidence: ${(bestTarget.confidence * 100).toFixed(0)}%, ` + `age: ${(bestTarget.age / 1000).toFixed(1)}s)`);
        } else if (this.targetPosition) {
            Logger.goal(agent, `Searching area near last known enemy position`);
        } else {
            Logger.goal(agent, `Patrolling to locate enemies`);
        }
        // Use enhanced explore with purposeful searching
        this.addSubgoal(new EnhancedExploreGoal(this.owner));
    }
    execute() {
        const agent = this.owner?.agent || this.owner;
        const now = performance.now();
        // Check if enemy found
        if (agent.targetSystem?.hasTarget?.()) {
            Logger.goal(agent, `Search successful - enemy located!`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return this.status;
        }
        // Execute search behavior
        this.status = this.executeSubgoals();
        // Timeout check
        if (now - this.startTime > this.searchDuration) {
            Logger.goal(agent, `Search timeout - continuing patrol`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
        }
        return this.status;
    }
    terminate() {
        this.clearSubgoals();
    }
    constructor(owner, targetPosition = null){
        super(owner);
        this.targetPosition = targetPosition;
        this.searchRadius = 15;
        this.searchDuration = 8000; // Search for 8 seconds
        this.startTime = 0;
    }
}

export { SearchForEnemyGoal };
