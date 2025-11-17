import { Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';
import { BaseMovementGoal } from '../movement/BaseMovementGoal.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class EvasiveApproachGoal extends BaseMovementGoal {
    beforeMove() {
        // Validate target before generating path
        if (!this.target) {
            this.status = YUKA.Goal.STATUS.FAILED;
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: Cannot move - target is undefined`);
            return;
        }
        this.generateEvasivePath();
        if (this.waypoints.length === 0) {
            this.status = YUKA.Goal.STATUS.FAILED;
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] Failed to generate evasive path`);
        } else {
            Logger.tactic(`[${this.agent?.entity?.name || 'Unknown'}] Evasive approach with ${this.waypoints.length} waypoints`);
        }
    }
    generateEvasivePath() {
        // Validate target exists
        if (!this.target) {
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: target is undefined`);
            this.waypoints = [];
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        const currentPos = new Vec3(this.owner.position.x, this.owner.position.y, this.owner.position.z);
        const targetPos = new Vec3(this.target.x, this.target.y, this.target.z);
        const threatPos = this.agent.targetSystem.getTargetPosition();
        this.waypoints = [];
        if (threatPos) {
            // Calculate perpendicular direction to threat
            const toThreat = new Vec3().sub2(currentPos, threatPos).normalize();
            const perpendicular = new Vec3(-toThreat.z, 0, toThreat.x);
            // First waypoint: move perpendicular to threat
            const waypoint1 = this.agent.generateSafeTacticalPosition(currentPos, perpendicular, aiConfig.goals.EVASIVE_PERPENDICULAR_DISTANCE, "evasive");
            if (waypoint1) {
                this.waypoints.push(waypoint1);
            } else {
                Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: Failed to generate first waypoint`);
            }
            // Second waypoint: side approach to target
            const sideApproach = this.agent.generateSafeTacticalPosition(targetPos, perpendicular, aiConfig.goals.EVASIVE_FINAL_APPROACH_DISTANCE, "approach");
            if (sideApproach) {
                this.waypoints.push(sideApproach);
            } else {
                Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: Failed to generate side approach waypoint`);
            }
        }
        // Always add validated final target
        const validTarget = this.agent.navigation?.findValidNavMeshPosition(targetPos, aiConfig.goals.EVASIVE_VALIDATION_RADIUS);
        if (validTarget) {
            this.waypoints.push(validTarget);
        } else {
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: Failed to validate final target position`);
        }
    }
    calculateTargetPosition() {
        // Return first waypoint if available
        if (this.waypoints.length > 0 && this.waypoints[0]) {
            return this.waypoints[0];
        }
        // Fallback: if we have a target but no waypoints, use target directly
        if (this.target) {
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: No waypoints, using direct target`);
            return this.target;
        }
        return null;
    }
    onExecuteTick() {
        if (this.currentWaypoint >= this.waypoints.length || this.waypoints.length === 0) {
            return;
        }
        const wp = this.waypoints[this.currentWaypoint];
        if (!wp) {
            Logger.warn(`[${this.agent?.entity?.name || 'Unknown'}] Invalid waypoint at index ${this.currentWaypoint}`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        const distance = this.owner.position.distanceTo(new YUKA.Vector3(wp.x, wp.y, wp.z));
        // Move to next waypoint if close enough
        if (distance < this._completeDist) {
            this.currentWaypoint++;
            if (this.currentWaypoint < this.waypoints.length) {
                const nextWp = this.waypoints[this.currentWaypoint];
                if (!this.agent?.navigation?.moveTo(nextWp)) {
                    Logger.warn(`[${this.agent.entity.name}] Failed to move to waypoint ${this.currentWaypoint}`);
                    this.status = YUKA.Goal.STATUS.FAILED;
                }
            }
        }
    }
    checkCompletion() {
        return this.currentWaypoint >= this.waypoints.length;
    }
    constructor(owner, target, agent){
        super(owner, agent);
        // Defensive copy: ensure target is properly stored
        if (!target) {
            Logger.warn(`[${agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: target is null/undefined in constructor`);
            this.target = null;
        } else if (target instanceof YUKA.Vector3) {
            // Create defensive copy of YUKA.Vector3
            this.target = new YUKA.Vector3(target.x, target.y, target.z);
        } else if (typeof target === 'object' && target.x !== undefined && target.y !== undefined && target.z !== undefined) {
            // Convert from other vector types
            this.target = new YUKA.Vector3(target.x, target.y, target.z);
        } else {
            Logger.warn(`[${agent?.entity?.name || 'Unknown'}] EvasiveApproachGoal: invalid target type in constructor`);
            this.target = null;
        }
        this.waypoints = [];
        this.currentWaypoint = 0;
        this._completeDist = aiConfig.movement.evasiveCompleteDistance;
    }
}

export { EvasiveApproachGoal };
