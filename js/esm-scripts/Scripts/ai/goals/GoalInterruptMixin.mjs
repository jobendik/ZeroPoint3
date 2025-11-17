import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Standard goal priority levels
 * Higher numbers = higher priority
 */ const GOAL_PRIORITIES = {
    CRITICAL_SURVIVAL: 100,
    HIGH_SURVIVAL: 80,
    COMBAT_DEFENSIVE: 70,
    COMBAT_OFFENSIVE: 60,
    RESOURCE_CRITICAL: 50,
    RESOURCE_HIGH: 40,
    RESOURCE_NORMAL: 30,
    TACTICAL: 20,
    EXPLORATION: 10,
    IDLE: 0 // Do nothing
};
/**
 * Apply interrupt mixin to a goal instance
 * Adds canInterrupt() and shouldInterruptFor() methods
 * 
 * @param {YUKA.Goal} goal - Goal instance to enhance
 */ function applyGoalInterruptMixin(goal) {
    if (!goal) return;
    // Add methods if they don't exist
    if (!goal.canInterrupt) {
        goal.canInterrupt = function() {
            return canInterrupt.call(this);
        };
    }
    if (!goal.shouldInterruptFor) {
        goal.shouldInterruptFor = function(newGoal) {
            return shouldInterruptFor.call(this, newGoal);
        };
    }
    if (!goal.getPriority) {
        goal.getPriority = function() {
            return getPriority.call(this);
        };
    }
    if (!goal.getInterruptContext) {
        goal.getInterruptContext = function() {
            return getInterruptContext.call(this);
        };
    }
    // Set default priority if not set
    if (goal.priority === undefined) {
        goal.priority = GOAL_PRIORITIES.TACTICAL;
    }
    // Set default interruptible flag if not set
    if (goal.interruptible === undefined) {
        goal.interruptible = true;
    }
}
/**
 * Check if this goal can be interrupted
 * Goals can override 'interruptible' property to false to prevent interruption
 * 
 * @returns {boolean} True if goal can be interrupted
 */ function canInterrupt() {
    // Check explicit interruptible flag
    if (this.interruptible === false) {
        return false;
    }
    // Check if goal has a minimum duration requirement
    if (this.minDuration && this.goalStartTime) {
        const elapsed = performance.now() - this.goalStartTime;
        if (elapsed < this.minDuration) {
            Logger.aiDetail(`[Goal] ${this.constructor.name} cannot interrupt - within min duration (${elapsed.toFixed(0)}ms < ${this.minDuration}ms)`);
            return false;
        }
    }
    // Check if goal is in critical phase (at target, about to complete)
    if (this.hasReachedTarget || this.waitingForPickup) {
        Logger.aiDetail(`[Goal] ${this.constructor.name} cannot interrupt - at target/pickup`);
        return false;
    }
    // Default: goal can be interrupted
    return true;
}
/**
 * Check if this goal should be interrupted for a new goal
 * Compares priorities and considers situational factors
 * 
 * @param {YUKA.Goal} newGoal - The goal that wants to interrupt
 * @returns {boolean} True if should interrupt for new goal
 */ function shouldInterruptFor(newGoal) {
    if (!newGoal) return false;
    // First check if this goal CAN be interrupted at all
    if (!this.canInterrupt()) {
        return false;
    }
    // Get priorities
    const currentPriority = this.getPriority();
    const newPriority = typeof newGoal.getPriority === 'function' ? newGoal.getPriority() : newGoal.priority || GOAL_PRIORITIES.TACTICAL;
    // New goal must have higher priority
    if (newPriority <= currentPriority) {
        Logger.aiDetail(`[Goal] ${this.constructor.name} (priority ${currentPriority}) NOT interrupted by ${newGoal.constructor.name} (priority ${newPriority})`);
        return false;
    }
    // Check priority difference threshold (prevent minor priority differences from interrupting)
    const priorityDiff = newPriority - currentPriority;
    const minPriorityGap = this.minPriorityGap || 10; // Require at least 10 point difference
    if (priorityDiff < minPriorityGap) {
        Logger.aiDetail(`[Goal] ${this.constructor.name} NOT interrupted - priority gap too small (${priorityDiff} < ${minPriorityGap})`);
        return false;
    }
    Logger.goal(`[Goal] ${this.constructor.name} (priority ${currentPriority}) INTERRUPTED by ${newGoal.constructor.name} (priority ${newPriority}, gap ${priorityDiff})`);
    return true;
}
/**
 * Get current priority of this goal
 * Can be overridden by goals for dynamic priority adjustment
 * 
 * @returns {number} Current priority value
 */ function getPriority() {
    // Use base priority if no dynamic adjustment
    return this.priority || GOAL_PRIORITIES.TACTICAL;
}
/**
 * Get interrupt context for debugging
 * 
 * @returns {object} Context information
 */ function getInterruptContext() {
    return {
        goalType: this.constructor.name,
        priority: this.getPriority(),
        interruptible: this.interruptible !== false,
        canInterrupt: this.canInterrupt(),
        age: this.goalStartTime ? performance.now() - this.goalStartTime : 0,
        status: this.status,
        hasReachedTarget: this.hasReachedTarget || false,
        waitingForPickup: this.waitingForPickup || false
    };
}
/**
 * Helper: Get goal priority by health ratio
 * Used by health-seeking goals to adjust priority dynamically
 * 
 * @param {number} healthRatio - 0.0 to 1.0
 * @returns {number} Priority value
 */ function getHealthPriorityByRatio(healthRatio) {
    if (healthRatio <= 0.15) return GOAL_PRIORITIES.CRITICAL_SURVIVAL;
    if (healthRatio <= 0.30) return GOAL_PRIORITIES.HIGH_SURVIVAL;
    if (healthRatio <= 0.50) return GOAL_PRIORITIES.RESOURCE_HIGH;
    return GOAL_PRIORITIES.RESOURCE_NORMAL;
}
/**
 * Helper: Get goal priority by ammo ratio
 * Used by ammo-seeking goals to adjust priority dynamically
 * 
 * @param {number} ammoRatio - 0.0 to 1.0
 * @param {boolean} inCombat - Is agent currently in combat
 * @returns {number} Priority value
 */ function getAmmoPriorityByRatio(ammoRatio, inCombat = false) {
    if (ammoRatio <= 0) return GOAL_PRIORITIES.RESOURCE_CRITICAL;
    if (inCombat && ammoRatio <= 0.20) return GOAL_PRIORITIES.RESOURCE_HIGH;
    if (ammoRatio <= 0.30) return GOAL_PRIORITIES.RESOURCE_HIGH;
    return GOAL_PRIORITIES.RESOURCE_NORMAL;
}
/**
 * Helper: Get combat priority by situation
 * Used by combat goals to adjust priority dynamically
 * 
 * @param {boolean} targetVisible - Is target visible
 * @param {number} healthRatio - Agent's health ratio 0.0 to 1.0
 * @param {boolean} hasAmmo - Does agent have ammo
 * @returns {number} Priority value
 */ function getCombatPriority(targetVisible, healthRatio, hasAmmo) {
    // No ammo = can't fight effectively
    if (!hasAmmo) return GOAL_PRIORITIES.TACTICAL;
    // Low health = defensive combat
    if (healthRatio <= 0.30) return GOAL_PRIORITIES.COMBAT_DEFENSIVE;
    // Visible target = offensive combat
    if (targetVisible) return GOAL_PRIORITIES.COMBAT_OFFENSIVE;
    // Default combat priority
    return GOAL_PRIORITIES.TACTICAL;
}

export { GOAL_PRIORITIES, applyGoalInterruptMixin, getAmmoPriorityByRatio, getCombatPriority, getHealthPriorityByRatio };
