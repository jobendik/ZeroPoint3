import { Script, Vec3, math } from '../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { aiConfig } from '../../config/ai.config.mjs';
import { Logger } from '../../core/engine/logger.mjs';

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * AgentNavigationAdapter - Fixed Version
 * 
 * KEY FIXES:
 * 1. NO vehicle.update() calls - EntityManager handles that
 * 2. NO position syncing - NavigationBootstrap handles that  
 * 3. ONLY manages steering behaviors (FollowPath, Arrive, etc.)
 * 4. Simplified coordinate conversions - only at API boundaries
 */ class AgentNavigationAdapter extends Script {
    initialize() {
        this.navReady = false;
        this.currentPath = null;
        this.currentPathIndex = 0;
        this.targetPosition = null;
        this.isMoving = false;
        this.lastVelocityDirection = new Vec3();
        // Logging throttles
        this._lastSpeedModLog = 0;
    }
    postInitialize() {
        const app = this.app;
        const checkNav = ()=>{
            const nav = app.navigation?.services?.nav;
            if (nav?.ready) {
                this._onNavigationReady();
            } else {
                app.once('navigation:ready', this._onNavigationReady, this);
            }
        };
        checkNav();
    }
    _onNavigationReady() {
        const nav = this.app.navigation.services.nav;
        Logger.nav(`[${this.entity.name}] _onNavigationReady called - nav: ${!!nav}, nav.nav: ${!!nav?.nav}, spatialIndex: ${!!nav?.nav?.spatialIndex}`);
        // ✅ CRITICAL FIX: Verify spatialIndex exists before proceeding
        if (!nav || !nav.nav || !nav.nav.spatialIndex) {
            Logger.error(`[${this.entity.name}] Navigation ready but spatialIndex not initialized! Retrying in 100ms...`);
            setTimeout(()=>this._onNavigationReady(), 100);
            return;
        }
        Logger.nav(`[${this.entity.name}] Navigation AND spatialIndex confirmed ready!`);
        this.navReady = true;
        // Store helper functions
        this.toNav = (w)=>nav.worldToNav(w);
        this.toWorld = (n)=>nav.navToWorld(n);
        this.navMesh = nav.nav;
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent) {
            Logger.warn(`[${this.entity.name}] No aiAgent script found`);
            return;
        }
        // ✅ CRITICAL FIX: Initialize vehicle position BEFORE attaching methods
        const vehicle = aiAgent.agentCore?.getVehicle?.();
        if (vehicle) {
            const pos = this.entity.getPosition();
            const navPos = this.toNav(pos);
            vehicle.position.copy(navPos);
            Logger.nav(`[${this.entity.name}] Vehicle position initialized in NAV space: (${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)})`);
        } else {
            Logger.error(`[${this.entity.name}] CRITICAL: Vehicle not found - agent will have NaN position!`);
        }
        Logger.nav(`[${this.entity.name}] Attaching navigation to aiAgent...`);
        this._attachNavigationMethods(aiAgent);
        Logger.nav(`[${this.entity.name}] Navigation ready and attached`);
        this.entity.fire('agent:navigation:ready');
    }
    _attachNavigationMethods(aiAgent) {
        const navigationMethods = {
            moveTo: this.moveTo.bind(this),
            stopMovement: this.stopMovement.bind(this),
            findPath: this.findPath.bind(this),
            isAtDestination: this.isAtDestination.bind(this),
            projectToNavMesh: this.projectToNavMesh.bind(this),
            findValidNavMeshPosition: this.findValidNavMeshPosition.bind(this),
            findValidRandomPosition: this.findValidRandomPosition.bind(this),
            findValidCoverPosition: this.findValidCoverPosition.bind(this),
            generateSafeTacticalPosition: this.generateSafeTacticalPosition.bind(this),
            findTacticalPosition: this.findTacticalPosition.bind(this),
            isMoving: ()=>this.isMoving,
            toNav: this.toNav.bind(this),
            toWorld: this.toWorld.bind(this)
        };
        // ✅ FIX: Add navMesh as property descriptor to ensure getter always returns current reference
        Object.defineProperty(navigationMethods, 'navMesh', {
            get: ()=>this.navMesh,
            enumerable: true
        });
        if (!aiAgent.agentCore) {
            Logger.error(`[${this.entity.name}] CRITICAL ERROR: agentCore not found!`);
            return;
        }
        aiAgent.agentCore.navigation = navigationMethods;
        aiAgent.navigationReady = true;
        // Legacy compatibility
        aiAgent.moveTo = navigationMethods.moveTo;
        aiAgent.stopMovement = navigationMethods.stopMovement;
        aiAgent.findValidNavMeshPosition = navigationMethods.findValidNavMeshPosition;
        aiAgent.findValidRandomPosition = navigationMethods.findValidRandomPosition;
        aiAgent.findValidCoverPosition = navigationMethods.findValidCoverPosition;
        aiAgent.generateSafeTacticalPosition = navigationMethods.generateSafeTacticalPosition;
        aiAgent.isMoving = navigationMethods.isMoving;
        if (aiAgent.utilities) {
            if (!aiAgent.utilities.getClosestAmmoItem || typeof aiAgent.utilities.getClosestAmmoItem !== 'function') {
                aiAgent.utilities.getClosestAmmoItem = this.getClosestAmmoItem.bind(this);
            }
            if (!aiAgent.utilities.getClosestHealthItem || typeof aiAgent.utilities.getClosestHealthItem !== 'function') {
                aiAgent.utilities.getClosestHealthItem = this.getClosestHealthItem.bind(this);
            }
            aiAgent.utilities.findValidRandomPosition = navigationMethods.findValidRandomPosition;
        }
    }
    /**
     * ✅ FIX: Simplified pathfinding - returns world-space waypoints
     * DirectApproachGoal will convert these to NAV space
     */ findPath(from, to) {
        if (!this.navReady) return null;
        // ✅ CRITICAL FIX: Check navMesh AND spatial index before pathfinding
        if (!this.navMesh) {
            Logger.warn(`[${this.entity.name}] NavMesh not available - cannot find path`);
            return null;
        }
        if (!this.navMesh.spatialIndex) {
            Logger.error(`[${this.entity.name}] CRITICAL: NavMesh spatial index is NULL/UNDEFINED!`);
            Logger.error(`[${this.entity.name}] navMesh type: ${this.navMesh.constructor.name}`);
            Logger.error(`[${this.entity.name}] navMesh keys: ${Object.keys(this.navMesh).join(', ')}`);
            return null;
        }
        Logger.nav(`[${this.entity.name}] findPath() - spatialIndex OK: ${!!this.navMesh.spatialIndex}`);
        const navFrom = this.toNav(from);
        const navTo = this.toNav(to);
        try {
            const path = this.navMesh.findPath(navFrom, navTo);
            return path && path.length > 0 ? path.map((p)=>this.toWorld(p)) : null;
        } catch (error) {
            Logger.error(`[${this.entity.name}] findPath() exception:`, error);
            Logger.error(`[${this.entity.name}] spatialIndex at error time: ${!!this.navMesh.spatialIndex}`);
            return null;
        }
    }
    /**
     * ✅ FIX: moveTo creates FollowPathBehavior safely (removes old ones first)
     * Can be called from goals OR legacy state system
     */ moveTo(targetPos) {
        if (!this.navReady) {
            Logger.warn(`[${this.entity.name}] Navigation not ready`);
            return false;
        }
        const currentPos = this.entity.getPosition();
        const path = this.findPath(currentPos, targetPos);
        if (!path || path.length === 0) {
            const now = performance.now();
            if (!this._lastNoPathWarn || now - this._lastNoPathWarn > aiConfig.navigation.noPathWarningThrottle) {
                Logger.warn(`[${this.entity.name}] No path found to target`);
                this._lastNoPathWarn = now;
            }
            return false;
        }
        const now = performance.now();
        if (!this._lastPathLog || now - this._lastPathLog > aiConfig.navigation.pathLogThrottle) {
            Logger.nav(`[${this.entity.name}] Path found: ${path.length} waypoints, distance: ${currentPos.distance(targetPos).toFixed(2)}m`);
            this._lastPathLog = now;
        }
        this.currentPath = path;
        this.currentPathIndex = 0;
        this.targetPosition = targetPos.clone();
        this.isMoving = true;
        // ✅ FIX: Create FollowPathBehavior (safely removes old ones first)
        this._setupFollowPathBehavior(path);
        return true;
    }
    /**
     * ✅ FIX: Setup FollowPathBehavior (removes duplicates first)
     * This can be called from moveTo() or from goals
     */ _setupFollowPathBehavior(worldPath) {
        const aiAgent = this.entity.script?.aiAgent;
        const vehicle = aiAgent?.agentCore?.getVehicle?.();
        if (!vehicle || !vehicle.steering) {
            Logger.error(`[${this.entity.name}] Vehicle or steering manager not available`);
            return;
        }
        // ✅ CRITICAL: Remove ALL existing FollowPathBehaviors first
        const existingBehaviors = [
            ...vehicle.steering.behaviors || []
        ];
        for (const behavior of existingBehaviors){
            if (behavior.constructor.name === 'FollowPathBehavior') {
                behavior.active = false;
                vehicle.steering.remove(behavior);
                Logger.nav(`[${this.entity.name}] Removed existing FollowPathBehavior to prevent duplicates`);
            }
        }
        // Create new FollowPathBehavior
        const followPathBehavior = new YUKA.FollowPathBehavior();
        followPathBehavior.nextWaypointDistance = aiConfig.navigation.nextWaypointDistance || 0.5;
        // Convert world waypoints to NAV space
        const navPath = worldPath.map((wp)=>this.toNav(wp));
        // Add waypoints to path
        followPathBehavior.path.clear();
        for (const waypoint of navPath){
            followPathBehavior.path.add(waypoint);
        }
        // Add behavior to vehicle
        vehicle.steering.add(followPathBehavior);
        Logger.nav(`[${this.entity.name}] FollowPathBehavior activated with ${navPath.length} waypoints`);
    }
    stopMovement() {
        this.isMoving = false;
        this.currentPath = null;
        this.currentPathIndex = 0;
        this.targetPosition = null;
        // ✅ FIX: Clear ALL FollowPathBehaviors from steering
        // This ensures DirectApproachGoal's behavior is also cleaned up
        const aiAgent = this.entity.script?.aiAgent;
        const vehicle = aiAgent?.agentCore?.getVehicle?.();
        if (vehicle && vehicle.steering) {
            const behaviors = [
                ...vehicle.steering.behaviors || []
            ];
            for (const behavior of behaviors){
                if (behavior.constructor.name === 'FollowPathBehavior') {
                    behavior.active = false;
                    vehicle.steering.remove(behavior);
                    Logger.nav(`[${this.entity.name}] Removed FollowPathBehavior from steering`);
                }
            }
        }
    }
    findValidNavMeshPosition(pos, searchRadius = 1) {
        if (!this.navReady) return null;
        // ✅ FIX: Ensure spatialIndex is initialized before using getRegionForPoint
        if (!this.navMesh || !this.navMesh.spatialIndex) {
            Logger.warn(`[${this.entity.name}] NavMesh spatialIndex not initialized`);
            return null;
        }
        const navPos = this.toNav(pos);
        const region = this.navMesh.getRegionForPoint(navPos, searchRadius);
        if (region) {
            const distance = region.distanceToPoint(navPos);
            const projectedNav = navPos.clone();
            projectedNav.y -= distance * aiConfig.navigation.heightSnap;
            return this.toWorld(projectedNav);
        }
        const randomRegion = this.navMesh.getRandomRegion();
        return randomRegion ? this.toWorld(randomRegion.centroid) : null;
    }
    projectToNavMesh(worldPos) {
        if (!this.navReady) return null;
        // ✅ FIX: Ensure spatialIndex is initialized
        if (!this.navMesh || !this.navMesh.spatialIndex) {
            Logger.warn(`[${this.entity.name}] NavMesh spatialIndex not initialized`);
            return null;
        }
        const navPos = this.toNav(worldPos);
        const region = this.navMesh.getRegionForPoint(navPos, 1);
        if (!region) return null;
        const distance = region.distanceToPoint(navPos);
        navPos.y -= distance * aiConfig.navigation.heightSnap;
        return this.toWorld(navPos);
    }
    findValidRandomPosition(minDist = aiConfig.navigation.randomPositionMinDistance, maxDist = aiConfig.navigation.randomPositionMaxDistance) {
        if (!this.navMesh) return null;
        // ✅ FIX: Ensure spatialIndex is initialized
        if (!this.navMesh.spatialIndex) {
            Logger.warn(`[${this.entity.name}] NavMesh spatialIndex not initialized`);
            return null;
        }
        const maxAttempts = aiConfig.navigation.randomPositionMaxAttempts;
        const currentPos = this.entity.getPosition();
        for(let i = 0; i < maxAttempts; i++){
            const region = this.navMesh.getRandomRegion();
            if (!region) continue;
            const worldPoint = this.toWorld(region.centroid);
            const distance = currentPos.distance(worldPoint);
            if (distance >= minDist && distance <= maxDist) {
                return worldPoint;
            }
        }
        const region = this.navMesh.getRandomRegion();
        return region ? this.toWorld(region.centroid) : null;
    }
    findValidCoverPosition(threatPos = null) {
        if (!this.navReady) return null;
        const aiAgent = this.entity.script?.aiAgent;
        const threat = threatPos || (aiAgent?.targetingSystem?.getTargetPosition?.() ?? null);
        if (!threat) {
            return this.findValidRandomPosition(aiConfig.navigation.fallbackCoverMin, aiConfig.navigation.fallbackCoverMax);
        }
        const currentPos = this.entity.getPosition();
        const awayFromThreat = new Vec3().sub2(currentPos, threat).normalize();
        for(let distance = aiConfig.navigation.coverDistanceStart; distance <= aiConfig.navigation.coverDistanceEnd; distance += aiConfig.navigation.coverDistanceStep){
            const coverPos = new Vec3().copy(currentPos).add(awayFromThreat.scale(distance));
            const validPos = this.findValidNavMeshPosition(coverPos, aiConfig.navigation.validationRadiusMedium);
            if (validPos) {
                return validPos;
            }
        }
        return this.findValidRandomPosition(aiConfig.navigation.fallbackRetreatMin, aiConfig.navigation.fallbackRetreatMax);
    }
    findTacticalPosition(type, threatPos = null) {
        if (!this.navReady) return null;
        const currentPos = this.entity.getPosition();
        switch(type){
            case 'cover':
            case 'retreat':
                return this.findValidCoverPosition(threatPos);
            case 'flank':
                if (!threatPos) return this.findValidRandomPosition(aiConfig.navigation.fallbackFlankMin, aiConfig.navigation.fallbackFlankMax);
                const toThreat = new Vec3().sub2(threatPos, currentPos).normalize();
                const perpendicular = new Vec3(-toThreat.z, 0, toThreat.x);
                return this.generateSafeTacticalPosition(currentPos, perpendicular, aiConfig.navigation.tacticalFlankDistance, 'flank');
            case 'advance':
                if (!threatPos) return this.findValidRandomPosition(aiConfig.navigation.fallbackAdvanceMin, aiConfig.navigation.fallbackAdvanceMax);
                const toward = new Vec3().sub2(threatPos, currentPos).normalize();
                return this.generateSafeTacticalPosition(currentPos, toward, aiConfig.navigation.tacticalAdvanceDistance, 'advance');
            default:
                return this.findValidRandomPosition(aiConfig.navigation.randomPositionMinDistance, aiConfig.navigation.randomPositionMaxDistance);
        }
    }
    generateSafeTacticalPosition(origin, direction, distance, tacticType = 'tactical') {
        if (!this.navReady) return null;
        const targetPos = new Vec3().copy(origin).add(direction.clone().normalize().scale(distance));
        let validPos = this.findValidNavMeshPosition(targetPos, aiConfig.navigation.tacticalPositionSearchRadius);
        if (validPos) return validPos;
        const angles = [
            0,
            45,
            -45,
            90,
            -90,
            135,
            -135,
            180
        ];
        const radians = angles.map((a)=>a * Math.PI / 180);
        for (const angle of radians){
            const rotatedDir = new Vec3(direction.x * Math.cos(angle) - direction.z * Math.sin(angle), direction.y, direction.x * Math.sin(angle) + direction.z * Math.cos(angle));
            const variantPos = new Vec3().copy(origin).add(rotatedDir.normalize().scale(distance * aiConfig.navigation.tacticalPositionVariant));
            validPos = this.findValidNavMeshPosition(variantPos, aiConfig.navigation.tacticalPositionSearchRadius);
            if (validPos) return validPos;
        }
        const closePos = new Vec3().copy(origin).add(direction.clone().normalize().scale(distance * aiConfig.navigation.tacticalPositionClose));
        return this.findValidNavMeshPosition(closePos, aiConfig.navigation.tacticalPositionFallbackRadius);
    }
    getClosestAmmoItem() {
        const gameManager = this.app?.gameManager;
        if (!gameManager || !gameManager.items) return null;
        const currentPos = this.entity.getPosition();
        let closestItem = null;
        let closestDistance = Infinity;
        for (const item of gameManager.items){
            if (!item || !item.entity || item.entity.destroyed) continue;
            const isAmmo = item.itemType === 'ammo' || item.itemType === 'ammunition' || item.entity.tags && (item.entity.tags.has('ammo') || item.entity.tags.has('ammunition'));
            if (!isAmmo) continue;
            let available = true;
            if (typeof item.isAvailable === 'boolean') {
                available = item.isAvailable;
            } else if (typeof item.isAvailable === 'function') {
                try {
                    available = item.isAvailable();
                } catch (e) {
                    available = true;
                }
            }
            if (!available) continue;
            const itemPos = item.entity.getPosition();
            const distance = currentPos.distance(itemPos);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        }
        return closestItem;
    }
    getClosestHealthItem() {
        const gameManager = this.app?.gameManager;
        if (!gameManager || !gameManager.items) return null;
        const currentPos = this.entity.getPosition();
        let closestItem = null;
        let closestDistance = Infinity;
        for (const item of gameManager.items){
            if (!item || !item.entity || item.entity.destroyed) continue;
            const isHealth = item.itemType === 'health' || item.itemType === 'healthPack' || item.itemType === 'medkit' || item.entity.tags && (item.entity.tags.has('health') || item.entity.tags.has('healthPack') || item.entity.tags.has('medkit'));
            if (!isHealth) continue;
            let available = true;
            if (typeof item.isAvailable === 'boolean') {
                available = item.isAvailable;
            } else if (typeof item.isAvailable === 'function') {
                try {
                    available = item.isAvailable();
                } catch (e) {
                    available = true;
                }
            }
            if (!available) continue;
            const itemPos = item.entity.getPosition();
            const distance = currentPos.distance(itemPos);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        }
        return closestItem;
    }
    isAtDestination() {
        if (!this.targetPosition) return true;
        const currentPos = this.entity.getPosition();
        const distance = currentPos.distance(this.targetPosition);
        return distance < this.stopDistance;
    }
    /**
     * ✅ FIX: Simplified rotation - only handles target tracking (not movement)
     * Movement direction rotation is handled by YUKA vehicle automatically
     */ _smoothRotateTowards(currentPos, targetDirection, dt) {
        // 🔥 CRITICAL: Don't override combat rotation!
        if (this.combatRotationLock && performance.now() < this.combatRotationUntil) {
            return; // Combat system is controlling rotation
        }
        if (!targetDirection || targetDirection.lengthSq() < 0.001) return;
        // Flatten and normalize
        targetDirection.y = 0;
        if (targetDirection.lengthSq() < 0.001) return;
        targetDirection.normalize();
        // Get current forward direction
        const currentForward = this.entity.forward.clone();
        currentForward.y = 0;
        if (currentForward.lengthSq() < 0.001) return;
        currentForward.normalize();
        // Calculate angle between current and target
        const dot = currentForward.dot(targetDirection);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        // Already facing the target
        if (angle < aiConfig.navigation.rotationMinThreshold) {
            return;
        }
        // Smooth rotation
        const maxRotation = this.rotationSpeed * dt;
        if (angle <= maxRotation) {
            // Close enough - snap to target
            // ✅ FIX: Only rotate on Y-axis (yaw) to prevent tilting
            const yaw = Math.atan2(targetDirection.x, targetDirection.z) * math.RAD_TO_DEG;
            this.entity.setEulerAngles(0, yaw, 0);
        // ✅ FIX: Don't sync rotation to YUKA - YUKA auto-rotates based on velocity
        } else {
            // Lerp towards target direction
            const t = maxRotation / angle;
            const newForward = new Vec3().lerp(currentForward, targetDirection, t);
            newForward.normalize();
            // ✅ FIX: Only rotate on Y-axis (yaw) to prevent tilting
            const yaw = Math.atan2(newForward.x, newForward.z) * math.RAD_TO_DEG;
            this.entity.setEulerAngles(0, yaw, 0);
        // ✅ FIX: Don't sync rotation to YUKA - YUKA auto-rotates based on velocity
        }
        // ✅ CRITICAL FIX: Sync rotation to rigidbody immediately after changing it
        // This ensures the physics body has the correct rotation
        // NavigationBootstrap will sync position only, we handle rotation here
        if (this.entity.rigidbody) {
            this.entity.rigidbody.teleport(this.entity.getPosition(), this.entity.getRotation());
        }
    }
    /**
     * ✅ FIX: Update to align AI rotation with movement direction
     * The AI should face where it's moving (YUKA velocity) to match animations
     * Uses INSTANT snap for direction changes > 45°, smooth rotation for smaller adjustments
     * ✅ ENHANCED: Now applies animation-based speed modifiers for combat realism
     * ✅ NEW: Context-aware speed - AI SPRINTS when critically wounded and seeking health
     */ update(dt) {
        const aiAgent = this.entity.script?.aiAgent;
        const vehicle = aiAgent?.agentCore?.getVehicle?.();
        if (vehicle) {
            // ✅ NEW: Apply animation-based speed modifiers
            // This makes AI slow down during aim/fire/reload animations
            const animController = aiAgent?.animationController;
            if (animController && animController._initialized) {
                const speedModifier = animController.getMovementSpeedModifier();
                // ✅ NEW: Context-aware base speed
                // If AI is critically wounded and seeking health, use SPRINT speed
                let baseSpeed = this.moveSpeed;
                let isSurvivalSprint = false;
                // ✅ CRITICAL FIX: Sprint when critically wounded (<50% HP)
                // Don't rely on isActivelySeekingHealth flag since goals get preempted by combat
                // AI should sprint whenever low HP, regardless of current goal
                if (vehicle) {
                    const healthRatio = vehicle.health / Math.max(1, vehicle.maxHealth);
                    // 🔍 DEBUG: Log property values every 3 seconds to diagnose issue
                    if (!this._lastHealthDebugLog || performance.now() - this._lastHealthDebugLog > 3000) {
                        Logger.nav(`[${this.entity.name}] 🔍 Health check: HP=${(healthRatio * 100).toFixed(0)}%, health=${vehicle.health}, maxHealth=${vehicle.maxHealth}`);
                        this._lastHealthDebugLog = performance.now();
                    }
                    // ✅ CRITICAL: AI sprints when wounded (<50% HP) for survival
                    // This makes wounded AI move urgently, whether seeking health or retreating
                    if (healthRatio < 0.5 && healthRatio > 0) {
                        // Sprint at 2x normal speed (like player sprint)
                        baseSpeed = this.moveSpeed * 2.0;
                        isSurvivalSprint = true;
                        // Log first time entering sprint mode
                        if (!this._isSprintingForHealth) {
                            Logger.nav(`[${this.entity.name}] 🏃💨 SPRINTING for survival! (HP: ${(healthRatio * 100).toFixed(0)}%)`);
                            this._isSprintingForHealth = true;
                        }
                    } else {
                        this._isSprintingForHealth = false;
                    }
                }
                // ✅ CRITICAL: When sprinting for survival, IGNORE animation speed modifiers
                // A wounded AI desperately running for health doesn't slow down to aim!
                // Apply speed modifier ONLY if not in survival sprint mode
                vehicle.maxSpeed = isSurvivalSprint ? baseSpeed : baseSpeed * speedModifier;
                // Log speed changes occasionally (for debugging)
                if (speedModifier < 1.0 && (!this._lastSpeedModLog || performance.now() - this._lastSpeedModLog > 2000)) {
                    Logger.debug(`[${this.entity.name}] Speed modified: ${(speedModifier * 100).toFixed(0)}% (${vehicle.maxSpeed.toFixed(2)}m/s)`);
                    this._lastSpeedModLog = performance.now();
                }
            } else {
                // No animation controller or not initialized - use base speed
                vehicle.maxSpeed = this.moveSpeed;
            }
            // ✅ CRITICAL FIX: Handle rotation based on context
            // Priority: Target-facing > Movement-facing
            const hasTarget = aiAgent?.targetSystem?.hasTarget?.();
            const targetPos = hasTarget ? aiAgent?.targetSystem?.getTargetPosition() : null;
            if (targetPos) {
                // ========================================
                // TARGET-FACING ROTATION (Combat Mode)
                // ========================================
                const currentPos = this.entity.getPosition();
                const toTarget = new Vec3().sub2(targetPos, currentPos);
                toTarget.y = 0;
                if (toTarget.lengthSq() > 0.01) {
                    toTarget.normalize();
                    const targetYaw = Math.atan2(toTarget.x, toTarget.z) * math.RAD_TO_DEG;
                    const currentYaw = this.entity.getEulerAngles().y;
                    const angleDiff = (targetYaw - currentYaw + 540) % 360 - 180;
                    if (Math.abs(angleDiff) > 2) {
                        const maxRotation = this.rotationSpeed * dt;
                        const rotationStep = Math.min(Math.abs(angleDiff), maxRotation) * Math.sign(angleDiff);
                        const newYaw = currentYaw + rotationStep;
                        this.entity.setEulerAngles(0, newYaw, 0);
                        // ✅ FIX: Don't sync rotation to YUKA - causes flicker
                        // YUKA vehicle auto-rotates based on velocity, overriding our changes
                        // Let PlayCanvas handle visual rotation independently
                        if (this.entity.rigidbody) {
                            this.entity.rigidbody.teleport(this.entity.getPosition(), this.entity.getRotation());
                        }
                    }
                }
            // Skip movement rotation when targeting
            } else if (vehicle.velocity) {
                // ========================================
                // MOVEMENT-FACING ROTATION (Patrol Mode)
                // ========================================
                const velocityMagnitude = vehicle.velocity.length();
                if (velocityMagnitude > 0.1) {
                    const moveDir = new Vec3(vehicle.velocity.x, 0, vehicle.velocity.z);
                    moveDir.normalize();
                    const targetYaw = Math.atan2(moveDir.x, moveDir.z) * math.RAD_TO_DEG;
                    const currentYaw = this.entity.getEulerAngles().y;
                    const angleDiff = (targetYaw - currentYaw + 540) % 360 - 180;
                    const directionChanged = this.lastVelocityDirection.lengthSq() > 0 && moveDir.dot(this.lastVelocityDirection) < 0.7;
                    if (Math.abs(angleDiff) > 2) {
                        let newYaw;
                        if (Math.abs(angleDiff) > 45 || directionChanged) {
                            newYaw = targetYaw; // Instant snap for large changes
                        } else {
                            const maxRotation = this.rotationSpeed * dt;
                            const rotationStep = Math.min(Math.abs(angleDiff), maxRotation) * Math.sign(angleDiff);
                            newYaw = currentYaw + rotationStep;
                        }
                        this.entity.setEulerAngles(0, newYaw, 0);
                        // ✅ FIX: Don't sync rotation to YUKA - causes flicker
                        // YUKA vehicle auto-rotates based on velocity, overriding our changes
                        // Let PlayCanvas handle visual rotation independently
                        if (this.entity.rigidbody) {
                            this.entity.rigidbody.teleport(this.entity.getPosition(), this.entity.getRotation());
                        }
                    }
                    this.lastVelocityDirection.copy(moveDir);
                }
            }
        }
        // ✅ FIX: Check if any FollowPathBehavior is complete
        if (vehicle && vehicle.steering && this.isMoving) {
            const followBehaviors = (vehicle.steering.behaviors || []).filter((b)=>b.constructor.name === 'FollowPathBehavior' && b.active);
            // If all behaviors are finished, mark as not moving
            if (followBehaviors.length > 0 && followBehaviors.every((b)=>b.path.finished())) {
                this.isMoving = false;
                Logger.nav(`[${this.entity.name}] Path completed`);
            }
        }
    }
    /**
     * Sync PlayCanvas entity rotation to YUKA vehicle rotation
     * NOTE: The 180° model correction is already applied at entity initialization in aiAgent.mjs
     * So we don't need to subtract it here - just convert degrees to radians
     * @param {number} playcanvasYawDeg - PlayCanvas entity yaw in degrees
     */ _syncYukaRotation(playcanvasYawDeg) {
        const aiAgent = this.entity.script?.aiAgent;
        const vehicle = aiAgent?.agentCore?.getVehicle?.();
        if (vehicle && vehicle.rotation) {
            // Convert PlayCanvas yaw (degrees) to YUKA yaw (radians)
            // Direct conversion - no 180° offset needed (already applied at init)
            const yukaYaw = playcanvasYawDeg * math.DEG_TO_RAD;
            vehicle.rotation.fromEuler(0, yukaYaw, 0);
        }
    }
    destroy() {
        this.stopMovement();
        this.navReady = false;
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @default 3 @title Agent Move Speed */ _define_property(this, "moveSpeed", aiConfig.navigation.moveSpeed);
        /** @attribute @type {number} @default 0.5 @title Stop Distance */ _define_property(this, "stopDistance", aiConfig.navigation.stopDistance);
        /** @attribute @type {number} @default 180 @title Rotation Speed (degrees/s) */ _define_property(this, "rotationSpeed", aiConfig.navigation.rotationSpeed);
    }
}
_define_property(AgentNavigationAdapter, "scriptName", 'agentNavigationAdapter');

export { AgentNavigationAdapter };
