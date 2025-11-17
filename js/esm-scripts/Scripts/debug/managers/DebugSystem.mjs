import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AIDebugSystem {
    // ============================================================================
    // COMPREHENSIVE DEBUG METHODS
    // ============================================================================
    debugCurrentState() {
        const target = this.agent.targetSystem.hasTarget() ? 'YES' : 'NO';
        const health = Math.round(this.agent.health / this.agent.maxHealth * 100);
        const goal = this.agent.brain.currentSubgoal()?.constructor.name || 'NONE';
        const moving = this.agent.isMoving ? 'YES' : 'NO';
        const navReady = this.agent.navigationReady ? 'YES' : 'NO';
        Logger.debug(`[${this.agent.entity.name}] Health:${health}% Target:${target} Goal:${goal} Moving:${moving} NavReady:${navReady}`);
        // Also log detailed target state if available
        this.debugTargetState();
        return {
            health,
            target,
            goal,
            moving,
            navReady
        };
    }
    debugEntityState() {
        const info = {
            name: this.agent.entity.name,
            entityType: this.agent.entity.entityType,
            guid: this.agent.entity.getGuid().substring(0, 8),
            enabled: this.agent.entity.enabled,
            destroyed: this.agent.entity.destroyed,
            position: this.agent.entity.getPosition(),
            health: `${this.agent.health}/${this.agent.maxHealth}`,
            isDead: this.agent.isDead,
            navigationReady: this.agent.navigationReady,
            hasTargetSystem: !!this.agent.targetSystem,
            currentTarget: this.agent.targetSystem ? this.agent.targetSystem.getTargetInfo() : 'No target system',
            tags: this.agent.entity.tags ? Array.from(this.agent.entity.tags.list) : 'No tags',
            scripts: Object.keys(this.agent.entity.script || {})
        };
        Logger.debug(`[${this.agent.entity.name}] Entity State:`, info);
        return info;
    }
    debugTargetingState() {
        if (!this.agent.targetSystem) {
            Logger.debug(`[${this.agent.entity.name}] No targeting system`);
            return {
                error: 'No targeting system'
            };
        }
        const targetInfo = {
            hasTarget: this.agent.targetSystem.hasTarget(),
            currentTarget: this.agent.targetSystem.getTargetInfo(),
            confirmedTargets: this.agent.targetSystem.confirmedTargets.size,
            potentialTargets: this.agent.targetSystem.potentialTargets.size,
            memoryRecords: this.agent.memoryRecords.length,
            visibleEnemies: this.agent.memoryRecords.filter((r)=>r.visible).length
        };
        Logger.debug(`[${this.agent.entity.name}] Targeting State:`, targetInfo);
        // Log individual memory records
        this.agent.memoryRecords.forEach((record, index)=>{
            const entityName = this._getTargetEntityName(record);
            const distance = this.agent.yukaVehicle.position.distanceTo(record.lastSensedPosition);
            Logger.debug(`  Record ${index}: ${entityName} (${record.visible ? 'visible' : 'hidden'}, ${distance.toFixed(1)}m)`);
        });
        return targetInfo;
    }
    debugVisionState() {
        // Use vision system if available
        const potentialTargets = this.agent.visionSystem ? this.agent.visionSystem._gatherPotentialTargets() : [];
        Logger.debug(`[${this.agent.entity.name}] Vision State:`);
        Logger.debug(`  Potential targets found: ${potentialTargets.length}`);
        Logger.debug(`  Vision range: ${this.agent.visionRange}m`);
        Logger.debug(`  Vision angle: ${this.agent.visionAngle}°`);
        potentialTargets.forEach((target, index)=>{
            const targetName = this._getTargetEntityName(target);
            const isValid = this.agent.visionSystem ? this.agent.visionSystem._isValidVisionTarget(target) : false;
            target.entity ? target.entity.getPosition() : 'No position';
            const distance = target.entity ? this.agent.entity.getPosition().distance(target.entity.getPosition()) : 'Unknown';
            Logger.debug(`  Target ${index}: ${targetName} (valid: ${isValid}, distance: ${distance})`);
        });
        return {
            potentialTargetsCount: potentialTargets.length,
            visionRange: this.agent.visionRange,
            visionAngle: this.agent.visionAngle
        };
    }
    debugTargetState() {
        if (this.agent.targetSystem && this.agent.targetSystem.hasTarget()) {
            const currentTarget = this.agent.targetSystem.getTargetEntity();
            const targetName = this._getTargetEntityName(currentTarget);
            // Try to get distance if possible
            let distance = 'Unknown';
            const entity = this._getTargetEntity(currentTarget);
            if (entity && entity.getPosition && this.agent.entity.getPosition) {
                try {
                    distance = this.agent.entity.getPosition().distance(entity.getPosition()).toFixed(1) + 'm';
                } catch (e) {
                    distance = 'Unknown';
                }
            }
            Logger.debug(`[${this.agent.entity.name}] Current target: ${targetName} (distance: ${distance})`);
            return {
                targetName,
                distance
            };
        } else {
            Logger.debug(`[${this.agent.entity.name}] No current target`);
            return {
                error: 'No current target'
            };
        }
    }
    debugNavigationState() {
        const navState = {
            navigationReady: this.agent.navigationReady,
            hasNavigationAdapter: !!this.agent.navigation,
            isMoving: this.agent.isMoving,
            hasPendingTarget: !!this.agent.pendingMoveTarget,
            navigationMethods: this.agent.navigation ? Object.keys(this.agent.navigation).filter((k)=>typeof this.agent.navigation[k] === 'function') : [],
            hasYukaVehicle: !!this.agent.yukaVehicle,
            consecutiveFailures: this.agent.consecutiveFailures || 0
        };
        if (this.agent.lastValidPosition) {
            navState.lastValidPosition = {
                x: this.agent.lastValidPosition.x.toFixed(1),
                y: this.agent.lastValidPosition.y.toFixed(1),
                z: this.agent.lastValidPosition.z.toFixed(1)
            };
        }
        Logger.debug(`[${this.agent.entity.name}] Navigation State:`, navState);
        return navState;
    }
    debugGoalState() {
        const currentGoal = this.agent.brain.currentSubgoal();
        const goalInfo = {
            currentGoal: currentGoal ? currentGoal.constructor.name : 'NONE',
            goalStatus: currentGoal ? currentGoal.status : 'N/A',
            goalAge: currentGoal && this.agent.currentGoalStartTime ? ((performance.now() - this.agent.currentGoalStartTime) / 1000).toFixed(1) + 's' : 'N/A',
            timeSinceLastCompletion: this.agent.lastGoalCompletionTime ? ((performance.now() - this.agent.lastGoalCompletionTime) / 1000).toFixed(1) + 's' : 'N/A',
            isActivelySeekingHealth: this.agent.isActivelySeekingHealth,
            evaluatorCount: this.agent.brain.evaluators.length
        };
        Logger.debug(`[${this.agent.entity.name}] Goal State:`, goalInfo);
        return goalInfo;
    }
    debugSystemsState() {
        const systems = {
            brain: !!this.agent.brain,
            targetSystem: !!this.agent.targetSystem,
            weaponSystem: !!this.agent.weaponSystem,
            healthSystem: !!this.agent.healthSystem,
            visionSystem: !!this.agent.visionSystem,
            goalArbitrator: !!this.agent.goalArbitrator,
            utilities: !!this.agent.utilities,
            eventHandler: !!this.agent.eventHandler,
            stateMachine: !!this.agent.stateMachine,
            vision: !!this.agent.vision,
            memorySystem: !!this.agent.memorySystem
        };
        Logger.debug(`[${this.agent.entity.name}] Systems State:`, systems);
        return systems;
    }
    // ============================================================================
    // COMPREHENSIVE STATUS REPORT
    // ============================================================================
    getFullStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            agent: this.agent.entity.name,
            basic: {
                health: `${this.agent.health}/${this.agent.maxHealth}`,
                healthRatio: (this.agent.health / this.agent.maxHealth).toFixed(2),
                isDead: this.agent.isDead,
                alertness: this.agent.alertness.toFixed(2),
                morale: this.agent.morale.toFixed(2)
            },
            state: {
                currentState: this.agent.stateMachine?.currentState?.type || 'none',
                currentGoal: this.agent.brain.currentSubgoal()?.constructor.name || 'none'
            },
            targeting: this.debugTargetingState(),
            navigation: this.debugNavigationState(),
            goals: this.debugGoalState(),
            systems: this.debugSystemsState()
        };
        return status;
    }
    logFullStatus() {
        const status = this.getFullStatus();
        Logger.debug(`[${this.agent.entity.name}] FULL STATUS REPORT:`, status);
        return status;
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    _getTargetEntityName(target) {
        // Use event handler's comprehensive name extraction if available
        if (this.eventHandler) {
            return this.eventHandler._getTargetEntityName(target);
        }
        // Fallback simple extraction
        return target?.entity?.name || target?.name || 'Unknown';
    }
    _getTargetEntity(target) {
        // Use event handler's entity extraction if available
        if (this.eventHandler) {
            return this.eventHandler._getTargetEntity(target);
        }
        // Fallback
        return target?.entity || target;
    }
    // ============================================================================
    // PERFORMANCE MONITORING
    // ============================================================================
    startPerformanceMonitoring(intervalMs = 5000) {
        if (this.performanceInterval) {
            this.stopPerformanceMonitoring();
        }
        this.performanceInterval = setInterval(()=>{
            const status = this.getFullStatus();
            Logger.performance(`[${this.agent.entity.name}] Performance Check:`, {
                health: status.basic.health,
                state: status.state.currentState,
                goal: status.state.currentGoal,
                targeting: status.targeting.hasTarget,
                navigation: status.navigation.isMoving
            });
        }, intervalMs);
        Logger.debug(`[${this.agent.entity.name}] Performance monitoring started (${intervalMs}ms interval)`);
    }
    stopPerformanceMonitoring() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
            Logger.debug(`[${this.agent.entity.name}] Performance monitoring stopped`);
        }
    }
    // ============================================================================
    // QUICK DEBUG COMMANDS
    // ============================================================================
    debugAll() {
        Logger.debug(`[${this.agent.entity.name}] === COMPLETE DEBUG DUMP ===`);
        this.debugCurrentState();
        this.debugEntityState();
        this.debugTargetingState();
        this.debugVisionState();
        this.debugNavigationState();
        this.debugGoalState();
        this.debugSystemsState();
        Logger.debug(`[${this.agent.entity.name}] === END DEBUG DUMP ===`);
    }
    debugQuick() {
        return this.debugCurrentState();
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        this.stopPerformanceMonitoring();
        Logger.debug(`[${this.agent.entity.name}] Debug system destroyed`);
    }
    constructor(agent){
        this.agent = agent;
        this.eventHandler = agent.eventHandler; // Reference to event handler for name extraction
    }
}

export { AIDebugSystem };
