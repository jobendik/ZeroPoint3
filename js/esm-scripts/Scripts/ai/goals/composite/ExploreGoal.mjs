import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';
import { PatrolGoal } from '../atomic/movement/PatrolGoal.mjs';
import { GOAL_PRIORITIES, applyGoalInterruptMixin } from '../GoalInterruptMixin.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * EnhancedExploreGoal - Composite goal for exploration behavior
 * 
 * Patrol behavior using subgoals:
 * - Finds random valid positions on navmesh
 * - Creates PatrolGoal subgoals to move to those positions
 * - Continuously picks new waypoints when subgoals complete
 * - Handles navigation failures gracefully with retry logic
 */ class EnhancedExploreGoal extends YUKA.CompositeGoal {
    activate() {
        this.clearSubgoals();
        const agent = this.owner.agent;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Find a random valid position to explore
        const randomPos = agent.navigation?.findValidRandomPosition ? agent.navigation.findValidRandomPosition() : null;
        if (!randomPos) {
            Logger.warn(`[${agent.entity.name}] EXPLORATION GOAL: Failed to find valid random position`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        this.currentWaypoint = randomPos;
        const yukaPos = new YUKA.Vector3(randomPos.x, randomPos.y, randomPos.z);
        // Create PatrolGoal subgoal to handle movement
        this.addSubgoal(new PatrolGoal(this.owner, yukaPos, agent));
        this.status = YUKA.Goal.STATUS.ACTIVE;
        Logger.goal(`[${agent.entity.name}] EXPLORATION GOAL: Started (waypoint: ${randomPos.x.toFixed(1)}, ${randomPos.y.toFixed(1)}, ${randomPos.z.toFixed(1)})`);
    }
    execute() {
        const agent = this.owner.agent;
        if (!agent) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return this.status;
        }
        // Set current activity for state reflection
        agent.currentActivity = 'patrol';
        // Process subgoals
        if (this.hasSubgoals()) {
            const status = this.executeSubgoals();
            if (status === YUKA.Goal.STATUS.COMPLETED) {
                // Waypoint reached, pick new waypoint
                Logger.aiDetail(`[${agent.entity.name}] EXPLORATION: Waypoint reached, picking new destination`);
                const randomPos = agent.navigation?.findValidRandomPosition ? agent.navigation.findValidRandomPosition() : null;
                if (randomPos) {
                    this.currentWaypoint = randomPos;
                    const yukaPos = new YUKA.Vector3(randomPos.x, randomPos.y, randomPos.z);
                    this.clearSubgoals();
                    this.addSubgoal(new PatrolGoal(this.owner, yukaPos, agent));
                } else {
                    // Can't find new waypoint, fail
                    Logger.warn(`[${agent.entity.name}] EXPLORATION: Failed to find new waypoint`);
                    this.status = YUKA.Goal.STATUS.FAILED;
                }
            } else if (status === YUKA.Goal.STATUS.FAILED) {
                // Patrol failed, try to recover by finding new waypoint
                Logger.warn(`[${agent.entity.name}] EXPLORATION: Patrol failed, attempting recovery`);
                const randomPos = agent.navigation?.findValidRandomPosition ? agent.navigation.findValidRandomPosition() : null;
                if (randomPos) {
                    this.currentWaypoint = randomPos;
                    const yukaPos = new YUKA.Vector3(randomPos.x, randomPos.y, randomPos.z);
                    this.clearSubgoals();
                    this.addSubgoal(new PatrolGoal(this.owner, yukaPos, agent));
                } else {
                    this.status = YUKA.Goal.STATUS.FAILED;
                }
            }
        } else {
            // No subgoals, reactivate
            Logger.aiDetail(`[${agent.entity.name}] EXPLORATION: No subgoals, reactivating`);
            this.activate();
        }
        return this.status;
    }
    terminate() {
        this.clearSubgoals();
        const agent = this.owner.agent;
        if (agent) {
            Logger.goal(`[${agent.entity.name}] EXPLORATION GOAL: Terminated`);
        }
    }
    // ✅ NEW: Exploration is ALWAYS interruptible - lowest priority goal
    canInterrupt() {
        return true; // Always allow interruption
    }
    // ✅ NEW: Override to ensure exploration never blocks higher priority goals
    shouldInterruptFor(newGoal) {
        // Exploration should ALWAYS yield to any other goal type
        if (!newGoal) return false;
        const newPriority = typeof newGoal.getPriority === 'function' ? newGoal.getPriority() : newGoal.priority || GOAL_PRIORITIES.TACTICAL;
        // If new goal has ANY higher priority, interrupt
        if (newPriority > GOAL_PRIORITIES.EXPLORATION) {
            const agent = this.owner?.agent;
            Logger.goal(`[${agent?.entity?.name || 'Agent'}] Exploration interrupted by ${newGoal.constructor.name} (priority ${newPriority})`);
            return true;
        }
        return false;
    }
    constructor(owner){
        super(owner);
        this.explorationTimer = 0;
        this.explorationDuration = 5;
        this.currentWaypoint = null;
        // ✅ NEW: Goal interrupt system
        // Exploration has lowest priority - easily interrupted
        this.priority = GOAL_PRIORITIES.EXPLORATION;
        this.interruptible = true; // Very interruptible
        this.minPriorityGap = 5; // Low threshold - any slightly higher priority can interrupt
        applyGoalInterruptMixin(this);
    }
}

export { EnhancedExploreGoal };
