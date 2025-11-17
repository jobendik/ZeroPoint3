import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * DirectApproachGoal - Fixed Version
 * 
 * KEY FIXES:
 * 1. Uses FollowPathBehavior for movement (YUKA handles physics)
 * 2. NO manual position updates
 * 3. Simplified coordinate handling
 * 4. Just monitors path completion
 */ class DirectApproachGoal extends YUKA.Goal {
    /**
     * Validate goal has required context
     */ _hasValidContext() {
        if (!this.owner) {
            Logger.warn('[DirectApproachGoal] Missing owner (YUKA Vehicle)');
            return false;
        }
        if (!this.owner.position) {
            Logger.warn('[DirectApproachGoal] Owner missing position');
            return false;
        }
        if (!this.agent) {
            Logger.warn('[DirectApproachGoal] Missing agent facade');
            return false;
        }
        if (!this.agent.navigation || !this.agent.navigationReady) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] Navigation not ready`);
            return false;
        }
        if (!this.target) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] Target position not set`);
            return false;
        }
        return true;
    }
    /**
     * ✅ FIX: Get navMesh from navigation adapter
     */ _getNavMesh() {
        return this.agent?.navigation?.navMesh;
    }
    /**
     * ✅ FIX: Compute path using YUKA's findPath IN NAV SPACE
     * Returns NAV-space waypoints for FollowPathBehavior
     */ _computePath(fromNav, toNav) {
        const navMesh = this._getNavMesh();
        if (!navMesh) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] NavMesh not available`);
            return null;
        }
        // fromNav and toNav are already in NAV space
        const navPath = navMesh.findPath(fromNav, toNav);
        if (!navPath || navPath.length === 0) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] No path found`);
            return null;
        }
        Logger.nav(`[${this.agent?.entity?.name ?? 'AI'}] Path found: ${navPath.length} waypoints in NAV space`);
        return navPath;
    }
    /**
     * ✅ FIX: Setup FollowPathBehavior with NAV-space waypoints
     * Reuses existing behavior if available, otherwise creates new one
     */ _setupPathBehavior(navPath) {
        // Get vehicle and steering manager
        const vehicle = this.owner;
        if (!vehicle || !vehicle.steering) {
            Logger.error(`[${this.agent?.entity?.name ?? 'AI'}] Vehicle or steering missing`);
            return false;
        }
        // ✅ OPTIMIZATION: Reuse existing FollowPathBehavior if one exists
        // (moveTo() in AgentNavigationAdapter already creates one)
        const existingBehaviors = vehicle.steering.behaviors || [];
        const existingFollowPath = existingBehaviors.find((b)=>b.constructor.name === 'FollowPathBehavior');
        if (existingFollowPath) {
            // Reuse existing behavior, just update the path
            Logger.nav(`[${this.agent?.entity?.name ?? 'AI'}] Reusing existing FollowPathBehavior`);
            this.followPathBehavior = existingFollowPath;
        } else {
            // Create NEW FollowPathBehavior only if none exists
            Logger.nav(`[${this.agent?.entity?.name ?? 'AI'}] Creating new FollowPathBehavior`);
            this.followPathBehavior = new YUKA.FollowPathBehavior();
            this.followPathBehavior.nextWaypointDistance = aiConfig.navigation.nextWaypointDistance || 0.5;
            // Add to vehicle steering
            vehicle.steering.add(this.followPathBehavior);
        }
        // Clear and load new path
        this.followPathBehavior.path.clear();
        // ✅ FIX: All waypoints from navMesh are now guaranteed to be YUKA.Vector3
        for(let i = 0; i < navPath.length; i++){
            const waypoint = navPath[i];
            // Safety check: Ensure it's a YUKA.Vector3 (auto-convert if needed)
            if (!(waypoint instanceof YUKA.Vector3)) {
                // Auto-convert without warning (this is handled gracefully)
                this.followPathBehavior.path.add(new YUKA.Vector3(waypoint.x, waypoint.y, waypoint.z));
            } else {
                this.followPathBehavior.path.add(waypoint);
            }
        }
        // Activate behavior (already added to steering if new)
        this.followPathBehavior.active = true;
        Logger.nav(`[${this.agent?.entity?.name ?? 'AI'}] Path loaded: ${navPath.length} NAV waypoints, behavior ACTIVE`);
        return true;
    }
    /**
     * ✅ FIX: Simplified activate - just setup path and let YUKA handle movement
     */ activate() {
        if (!this._hasValidContext()) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Get current position in NAV space (vehicle.position is already NAV)
        const fromNav = this.owner.position.clone();
        // ✅ FIX: Target might be YUKA.Vector3 (from navToWorld) or PlayCanvas Vec3
        // Convert to NAV space - toNav accepts any object with x,y,z properties
        const targetNav = this.agent.navigation.toNav(this.target);
        Logger.aiDetail(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach activate:`);
        Logger.aiDetail(`  - From (NAV): (${fromNav.x.toFixed(2)}, ${fromNav.y.toFixed(2)}, ${fromNav.z.toFixed(2)})`);
        Logger.aiDetail(`  - To (NAV): (${targetNav.x.toFixed(2)}, ${targetNav.y.toFixed(2)}, ${targetNav.z.toFixed(2)})`);
        // Compute path in NAV space
        const navPath = this._computePath(fromNav, targetNav);
        if (!navPath) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: No path to target`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Setup FollowPathBehavior
        if (!this._setupPathBehavior(navPath)) {
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Failed to setup path behavior`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Store NAV-space target for distance checks
        this.targetNav = targetNav;
        // Reset retry tracking
        this._pathRetryCount = 0;
        this._lastPathTime = performance.now();
        this.status = YUKA.Goal.STATUS.ACTIVE;
        Logger.aiDetail(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Activated with ${navPath.length} NAV waypoints`);
    }
    /**
     * ✅ FIX: Simplified execute - just monitor path completion
     * EntityManager handles vehicle.update() automatically
     */ execute(dt = 0) {
        if (this.status !== YUKA.Goal.STATUS.ACTIVE) return;
        if (dt <= 0) return;
        // Get current position in NAV space (vehicle.position is NAV)
        const curPosNav = this.owner.position;
        if (!curPosNav) {
            Logger.warn('[DirectApproachGoal] Owner position invalid during execute');
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Check if path is finished
        if (this.followPathBehavior && this.followPathBehavior.path.finished()) {
            const distToTarget = curPosNav.distanceTo(this.targetNav);
            if (distToTarget <= this._completeDist) {
                // Successfully reached target
                Logger.aiDetail(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Completed (${distToTarget.toFixed(2)}m from target)`);
                this.status = YUKA.Goal.STATUS.COMPLETED;
                return;
            }
            // Path finished but not at target - try recomputing path
            const now = performance.now();
            const timeSinceLastPath = now - this._lastPathTime;
            if (this._pathRetryCount < this._maxPathRetries && timeSinceLastPath > this._pathRetryDelay) {
                Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Path finished but ${distToTarget.toFixed(2)}m from target - recomputing (attempt ${this._pathRetryCount + 1}/${this._maxPathRetries})`);
                const newPath = this._computePath(curPosNav, this.targetNav);
                if (newPath && this._setupPathBehavior(newPath)) {
                    this._pathRetryCount++;
                    this._lastPathTime = now;
                    return;
                }
            }
            // Failed to reach target after retries
            Logger.warn(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Cannot reach target (${distToTarget.toFixed(2)}m away)`);
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Check distance for early completion
        const distToTarget = curPosNav.distanceTo(this.targetNav);
        if (distToTarget <= this._completeDist) {
            Logger.aiDetail(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Early completion (${distToTarget.toFixed(2)}m from target)`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
    // Status remains ACTIVE - EntityManager handles vehicle updates automatically
    }
    /**
     * ✅ FIX: Clean termination - deactivate behavior
     */ terminate() {
        // Deactivate FollowPathBehavior
        if (this.followPathBehavior) {
            this.followPathBehavior.active = false;
            // Remove from vehicle steering
            const vehicle = this.owner;
            if (vehicle && vehicle.steering) {
                vehicle.steering.remove(this.followPathBehavior);
            }
            Logger.aiDetail(`[${this.agent?.entity?.name ?? 'AI'}] DirectApproach: Behavior deactivated and removed`);
            this.followPathBehavior = null;
        }
    }
    constructor(owner, target, agent){
        super(owner);
        this.agent = agent ?? null;
        // Normalize target to YUKA.Vector3
        if (target && typeof target.x === 'number') {
            this.target = target instanceof YUKA.Vector3 ? target.clone() : new YUKA.Vector3(target.x, target.y, target.z);
        } else {
            this.target = null;
        }
        // Completion distance
        this._completeDist = aiConfig.movement.directCompleteDistance || 4.5;
        // ✅ FIX: Track the FollowPathBehavior we create
        this.followPathBehavior = null;
        // Path retry tracking
        this._pathRetryCount = 0;
        this._maxPathRetries = 2;
        this._lastPathTime = 0;
        this._pathRetryDelay = 2000;
    }
}

export { DirectApproachGoal, DirectApproachGoal as default };
