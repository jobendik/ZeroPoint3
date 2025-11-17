import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import * as YUKA from 'yuka';

// FPS-optimized settings
const TARGET_UPDATE_HZ = 10; // Check for better targets 10x/sec
const HUNTING_DURATION_MS = 8000; // Hunt for 8 seconds
const TARGET_SWITCH_COOLDOWN_MS = 250; // Quick reactions like human
class EnhancedTargetSystem {
    /**
     * Main update loop
     */ update(dt) {
        this.updateCount++;
        const now = performance.now();
        // Update hunting behavior
        this._updateHuntingMode(now);
        // Update current target status
        this._updateCurrentTarget(now);
        // Periodic target selection
        if (now - this.lastTargetUpdateTime >= this.targetUpdateInterval) {
            this.lastTargetUpdateTime = now;
            this._selectBestTarget(now);
        }
        // Diagnostics
        if (now - this.lastDiagnosticLog > 5000) {
            this._logDiagnostics();
            this.lastDiagnosticLog = now;
        }
    }
    /**
     * Update current target status
     */ _updateCurrentTarget(now) {
        if (!this.currentTarget) {
            this.targetConfidence = 0;
            this.targetJustForced = false;
            return;
        }
        // ✅ FIX: If target was just force-acquired, give it 500ms grace period
        // This prevents visionSystem from clearing it before combat can engage
        if (this.targetJustForced && now - this.targetForceTime < 500) {
            this.targetConfidence = 1.0;
            return; // Skip all clearing logic
        }
        // Grace period expired
        if (this.targetJustForced && now - this.targetForceTime >= 500) {
            this.targetJustForced = false;
        }
        // Check if target is still visible
        const isVisible = this.currentTarget.visible === true;
        if (isVisible) {
            // Target visible - restore confidence
            this.targetConfidence = 1.0;
            this.targetLossTime = 0;
            this.huntingMode = false;
            // Update last known position
            if (this.currentTarget.lastSensedPosition) {
                this.lastKnownPosition = new Vec3(this.currentTarget.lastSensedPosition.x, this.currentTarget.lastSensedPosition.y, this.currentTarget.lastSensedPosition.z);
            }
        } else {
            // Target not visible
            if (this.targetLossTime === 0) {
                // Just lost sight
                this.targetLossTime = now;
                // Save last known position for hunting
                if (this.currentTarget.lastSensedPosition) {
                    this.lastKnownPosition = new Vec3(this.currentTarget.lastSensedPosition.x, this.currentTarget.lastSensedPosition.y, this.currentTarget.lastSensedPosition.z);
                }
                // Enter hunting mode after short delay
                setTimeout(()=>this._enterHuntingMode(), 500);
                Logger.aiState(`[${this.agentName}] Target lost - will begin hunting`);
            }
            // Decay confidence gradually
            const timeSinceLoss = now - this.targetLossTime;
            this.targetConfidence = Math.max(0, 1.0 - timeSinceLoss / 3000);
            // Clear target after memory fades
            // YUKA's memory system will handle this automatically
            // We just stop tracking when confidence is too low
            if (this.targetConfidence < 0.1) {
                this._clearTarget();
            }
        }
    }
    /**
     * Select best target from memory records
     */ _selectBestTarget(now) {
        // ✅ FIX: Don't clear targets during force-grace period
        if (this.targetJustForced && this.currentTarget && now - this.targetForceTime < 500) {
            return;
        }
        // ✅ YUKA PATTERN: Get valid memory records
        this.agent.memorySystem.getValidMemoryRecords(this.agent.currentTime || 0, this.validMemoryRecords);
        if (this.validMemoryRecords.length === 0) {
            // No targets remembered
            if (this.currentTarget) {
                this._clearTarget();
            }
            return;
        }
        // Calculate priorities for all targets
        const targetPriorities = this._calculateTargetPriorities(this.validMemoryRecords);
        if (targetPriorities.length === 0) {
            return;
        }
        // Sort by priority (highest first)
        targetPriorities.sort((a, b)=>b.priority - a.priority);
        const bestTarget = targetPriorities[0];
        // Check if we should switch targets
        if (this._shouldSwitchTarget(bestTarget, now)) {
            this._setTarget(bestTarget.record, now);
        }
    }
    /**
     * Calculate priority for each memory record
     */ _calculateTargetPriorities(records) {
        const priorities = [];
        const myPosition = this.agent.yukaVehicle.position;
        for (const record of records){
            // Skip if no entity
            const entity = this._getEntityFromRecord(record);
            if (!entity) continue;
            let priority = 0;
            // Visible targets get huge priority boost
            if (record.visible === true) {
                priority += 1000;
            } else {
                // Recently seen targets get priority based on recency
                const timeSinceSeen = (this.agent.currentTime || 0) - record.timeLastSensed;
                priority += Math.max(0, 100 - timeSinceSeen * 10);
            }
            // Distance factor (closer = higher priority)
            if (record.lastSensedPosition) {
                const distance = myPosition.distanceTo(record.lastSensedPosition);
                priority += Math.max(0, 100 - distance * 2);
            }
            // Current target gets stickiness bonus
            if (this.currentTarget === record) {
                priority += 50;
            }
            // Threat level (could be extended)
            priority += this._calculateThreatLevel(entity);
            priorities.push({
                record: record,
                entity: entity,
                priority: priority
            });
        }
        return priorities;
    }
    /**
     * Calculate threat level of target
     */ _calculateThreatLevel(entity) {
        let threat = 0;
        // Players are high priority
        if (entity.tags && entity.tags.has('player')) {
            threat += 50;
        }
        // Add more threat assessment logic here
        // - Is target shooting at me?
        // - Is target low health?
        // - Is target carrying objective?
        return threat;
    }
    /**
     * Determine if we should switch to a new target
     */ _shouldSwitchTarget(newTarget, now) {
        // No current target - always switch
        if (!this.currentTarget) {
            return true;
        }
        // Same target - no switch needed
        if (this.currentTarget === newTarget.record) {
            return false;
        }
        // Cooldown to prevent rapid switching
        if (now - this.lastTargetSwitchTime < this.targetSwitchCooldown) {
            return false;
        }
        // Calculate current target priority
        const currentPriorities = this._calculateTargetPriorities([
            this.currentTarget
        ]);
        const currentPriority = currentPriorities.length > 0 ? currentPriorities[0].priority : 0;
        // Switch if new target significantly better
        const priorityDiff = newTarget.priority - currentPriority;
        // Visible target always wins over non-visible
        if (newTarget.record.visible && !this.currentTarget.visible) {
            return true;
        }
        // Need significant priority advantage to switch
        return priorityDiff > 100;
    }
    /**
     * Set current target
     */ _setTarget(record, now) {
        const oldTarget = this.currentTarget;
        this.currentTarget = record;
        this.currentTargetEntity = this._getEntityFromRecord(record);
        this.lastTargetSwitchTime = now;
        this.targetConfidence = record.visible ? 1.0 : 0.5;
        this.targetLossTime = 0;
        if (oldTarget !== record) {
            this.targetSwitchCount++;
            const targetName = this._getTargetName(this.currentTargetEntity);
            Logger.aiState(`[${this.agentName}] 🎯 Target selected: ${targetName} (${record.visible ? 'visible' : 'remembered'})`);
            // Fire callback
            if (this.agent.onTargetSwitched) {
                this.agent.onTargetSwitched(oldTarget, record);
            }
        }
    }
    /**
     * Clear current target
     */ _clearTarget() {
        if (this.currentTarget) {
            Logger.aiState(`[${this.agentName}] Target cleared`);
            if (this.agent.onTargetLost) {
                this.agent.onTargetLost(this.currentTarget);
            }
        }
        this.currentTarget = null;
        this.currentTargetEntity = null;
        this.targetConfidence = 0;
        this.targetLossTime = 0;
        this.huntingMode = false;
    }
    /**
     * Enter hunting mode
     */ _enterHuntingMode() {
        if (this.huntingMode || !this.lastKnownPosition) {
            return;
        }
        this.huntingMode = true;
        this.huntingTarget = this.lastKnownPosition.clone();
        this.huntingStartTime = performance.now();
        Logger.aiState(`[${this.agentName}] 🔍 Entering HUNTING mode - investigating last known position`);
        // Notify brain/behavior system
        if (this.agent.brain) {
            this.agent.investigationTarget = this.huntingTarget;
        }
    }
    /**
     * Update hunting behavior
     */ _updateHuntingMode(now) {
        if (!this.huntingMode) {
            return;
        }
        const huntingTime = now - this.huntingStartTime;
        // Check if reached hunting target
        if (this.huntingTarget && this.agent.yukaVehicle) {
            const distance = this.agent.yukaVehicle.position.distanceTo(new YUKA.Vector3(this.huntingTarget.x, this.huntingTarget.y, this.huntingTarget.z));
            if (distance < 2.0) {
                Logger.aiState(`[${this.agentName}] Reached hunting location - no target found`);
                this._exitHuntingMode();
                return;
            }
        }
        // Exit hunting after duration
        if (huntingTime > this.huntingDuration) {
            Logger.aiState(`[${this.agentName}] Hunting timeout - resuming patrol`);
            this._exitHuntingMode();
        }
    }
    /**
     * Exit hunting mode
     */ _exitHuntingMode() {
        this.huntingMode = false;
        this.huntingTarget = null;
        this.agent.investigationTarget = null;
    }
    // Public API
    getCorrectedForward() {
        const rawForward = this.agent.entity.forward.clone();
        return rawForward.scale(-1);
    }
    /**
     * Check if we have a target
     */ hasTarget() {
        return this.currentTarget !== null;
    }
    /**
     * Check if target is visible (not just remembered)
     */ isTargetVisible() {
        if (!this.currentTarget) return false;
        if (!this.currentTarget.visible) return false;
        // ✅ CRITICAL FIX: Re-verify target is in FOV
        // Memory persists for seconds, but AI shouldn't "see" behind them!
        const targetPos = this.getTargetPosition();
        if (!targetPos || !this.agent?.entity || !this.agent?.vision) {
            return this.currentTarget.visible;
        }
        const aiPos = this.agent.entity.getPosition();
        const aiForward = this.getCorrectedForward(); // ✅ FIXED
        const toTarget = new Vec3();
        toTarget.sub2(targetPos, aiPos);
        toTarget.normalize();
        const dotProduct = aiForward.dot(toTarget);
        const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        // ✅ FIX: YUKA's fieldOfView is ALREADY the half-angle (max angle from forward)
        // Don't divide by 2! (75° FOV means 75° on each side, not 37.5°)
        const maxFOV = this.agent.vision.fieldOfView || Math.PI / 2; // Default 90°
        // Target must be in FOV to be "visible" for gameplay
        return angleToTarget <= maxFOV;
    }
    /**
     * Get current target position (visible or last known)
     */ getTargetPosition() {
        if (!this.currentTarget) return null;
        if (this.currentTarget.lastSensedPosition) {
            return new Vec3(this.currentTarget.lastSensedPosition.x, this.currentTarget.lastSensedPosition.y, this.currentTarget.lastSensedPosition.z);
        }
        return this.lastKnownPosition;
    }
    /**
     * Get current target entity
     */ getTargetEntity() {
        return this.currentTargetEntity;
    }
    /**
     * Get current target (alias for getTargetEntity for compatibility)
     */ getCurrentTarget() {
        return this.currentTargetEntity;
    }
    /**
     * Get target confidence (1.0 = just seen, 0.0 = forgotten)
     */ getTargetConfidence() {
        return this.targetConfidence;
    }
    /**
     * Force immediate targeting of an entity (used when shot or enemy spotted)
     * Bypasses all cooldowns and immediately sets the target
     * ✅ UPDATED: Now includes skill-based reaction time delay
     * @param {Entity} entity - The entity to target
     */ forceTarget(entity) {
        if (!entity || !entity.entity) {
            Logger.warn(`[${this.agentName}] forceTarget() called with invalid entity`);
            return;
        }
        // ✅ SKILL-BASED REACTION TIME: Add delay based on personality
        const personality = this.agent.personalitySystem;
        let reactionDelay = 0;
        if (personality && personality.reactionSpeed) {
            // reactionSpeed ranges from 0.15s to 0.4s based on adaptability
            reactionDelay = personality.reactionSpeed * 1000; // Convert to milliseconds
            // Add small random variance (±20%)
            reactionDelay *= 0.8 + Math.random() * 0.4;
        } else {
            // Default reaction time if no personality
            reactionDelay = 200 + Math.random() * 100; // 200-300ms
        }
        // Schedule the actual target acquisition after reaction delay
        setTimeout(()=>{
            this._executeForceTarget(entity);
        }, reactionDelay);
        Logger.aiDetail(`[${this.agentName}] Target acquisition scheduled (${reactionDelay.toFixed(0)}ms delay)`);
    }
    /**
     * ✅ NEW: Internal method to execute force target after reaction delay
     */ _executeForceTarget(entity) {
        if (!entity || !entity.entity) {
            return;
        }
        const now = performance.now();
        // Exit hunting mode if active
        if (this.huntingMode) {
            this._exitHuntingMode();
        }
        // Get all valid memory records
        const validRecords = [];
        this.agent.memorySystem.getValidMemoryRecords(this.agent.currentTime || 0, validRecords);
        // Find existing memory record for this entity
        let record = validRecords.find((mem)=>this._getEntityFromRecord(mem) === entity.entity);
        // If no memory record exists, create one (handles "shot from behind" case)
        if (!record) {
            // Expected behavior when surprised/shot from behind - auto-create record
            Logger.debug(`[${this.agentName}] forceTarget() - Creating memory record (blindside attack)`);
            if (this.agent.yukaVehicle && entity.entity) {
                const targetPos = entity.entity.getPosition();
                const yukaPos = new YUKA.Vector3(targetPos.x, targetPos.y, targetPos.z);
                try {
                    // Use the same YUKA entity wrapper as VisionSystem to avoid duplicate records
                    const yukaEntity = this.agent.visionSystem && typeof this.agent.visionSystem._getOrCreateYukaEntity === 'function' ? this.agent.visionSystem._getOrCreateYukaEntity(entity.entity) : (()=>{
                        const e = new YUKA.GameEntity();
                        e.entity = entity.entity;
                        return e;
                    })();
                    // Create a memory record through YUKA's memory system (this will register it internally)
                    const memoryRecord = this.agent.memorySystem.hasRecord(yukaEntity) ? this.agent.memorySystem.getRecord(yukaEntity) : this.agent.memorySystem.createRecord(yukaEntity);
                    memoryRecord.lastSensedPosition = yukaPos;
                    memoryRecord.visible = true;
                    memoryRecord.timeLastSensed = this.agent.currentTime || 0;
                    record = memoryRecord;
                    Logger.combat(`[${this.agentName}] Forced memory record created for attacker from behind`);
                } catch (error) {
                    Logger.error(`[${this.agentName}] Error creating memory record:`, error);
                }
            }
        }
        if (record) {
            // Force immediate target switch (bypass all cooldowns)
            this.currentTarget = record;
            this.currentTargetEntity = entity.entity;
            this.lastTargetSwitchTime = now;
            this.targetConfidence = 1.0;
            this.targetLossTime = 0;
            // ✅ FIX: Mark target as just-forced to prevent immediate clearing
            this.targetJustForced = true;
            this.targetForceTime = now;
            // Mark as visible so combat engages immediately
            record.visible = true;
            Logger.combat(`[${this.agentName}] 🎯 Forced target: ${entity.entity.name} (damage from attacker)`);
        } else {
            Logger.error(`[${this.agentName}] Failed to force target - could not create memory record`);
        }
    }
    /**
     * Check if in hunting mode
     */ isHunting() {
        return this.huntingMode;
    }
    /**
     * Get hunting target position
     */ getHuntingTarget() {
        return this.huntingTarget;
    }
    /**
     * Get system status
     */ getSystemStatus() {
        return {
            hasTarget: this.hasTarget(),
            targetVisible: this.isTargetVisible(),
            targetName: this._getTargetName(this.currentTargetEntity),
            confidence: `${(this.targetConfidence * 100).toFixed(0)}%`,
            hunting: this.huntingMode,
            memoryRecords: this.validMemoryRecords.length,
            targetSwitches: this.targetSwitchCount
        };
    }
    // Utility methods
    _getEntityFromRecord(record) {
        if (!record) return null;
        try {
            // YUKA's memory record stores the entity
            if (record.entity && record.entity.entity) {
                return record.entity.entity;
            }
            if (record.entity) {
                return record.entity;
            }
        } catch (e) {
            Logger.debug(`[${this.agentName}] Error extracting entity from record`);
        }
        return null;
    }
    _getTargetName(entity) {
        if (!entity) return 'None';
        if (entity.name && entity.name !== 'Untitled') {
            return entity.name;
        }
        if (entity.tags) {
            if (entity.tags.has('player')) return 'Player';
            if (entity.tags.has('ai_agent')) return 'AIAgent';
        }
        return 'Target';
    }
    _logDiagnostics() {
        const status = this.getSystemStatus();
        const mode = status.hunting ? 'HUNTING' : 'TRACKING';
        Logger.aiDetail(`[${this.agentName}] Targeting [${mode}]: ` + `${status.targetName}, visible: ${status.targetVisible}, ` + `conf: ${status.confidence}, switches: ${status.targetSwitches}`);
        this.updateCount = 0;
        this.targetSwitchCount = 0;
    }
    /**
     * Clean shutdown
     */ destroy() {
        this._clearTarget();
        this.validMemoryRecords.length = 0;
        Logger.debug(`[${this.agentName}] Targeting system destroyed`);
    }
    /**
     * Convenience wrapper used by AgentBehavior threat scan. Accepts a PlayCanvas entity.
     */ acquireTarget(pcEntity) {
        if (!pcEntity) return;
        // ✅ FIX: Proactive targeting should be INSTANT (AI sees enemy, reacts immediately)
        // The reaction delay in forceTarget() is for "damage from behind" scenarios
        // When AI actively scans and spots an enemy, they should engage instantly
        this._executeForceTarget({
            entity: pcEntity
        });
    }
    // Backward-compat alias used by EventHandler
    _clearCurrentTarget() {
        this._clearTarget();
    }
    constructor(agent){
        this.agent = agent;
        this.agentName = agent.entity.name || 'Unknown';
        // ✅ CRITICAL: Verify YUKA systems exist
        if (!this.agent.memorySystem) {
            Logger.error(`[${this.agentName}] Agent missing memorySystem!`);
        }
        if (!this.agent.yukaVehicle) {
            Logger.error(`[${this.agentName}] Agent missing yukaVehicle!`);
        }
        // Current target (memory record, not entity!)
        this.currentTarget = null;
        this.currentTargetEntity = null;
        // Target selection
        this.targetUpdateInterval = 1000 / TARGET_UPDATE_HZ;
        this.lastTargetUpdateTime = 0;
        this.targetSwitchCooldown = TARGET_SWITCH_COOLDOWN_MS;
        this.lastTargetSwitchTime = 0;
        // Hunting behavior
        this.huntingMode = false;
        this.huntingTarget = null; // Last known position (Vec3)
        this.huntingStartTime = 0;
        this.huntingDuration = HUNTING_DURATION_MS;
        // Target memory
        this.targetLossTime = 0;
        this.targetConfidence = 1.0;
        // ✅ FIX: Prevent target from being cleared immediately after force-acquire
        this.targetJustForced = false;
        this.targetForceTime = 0;
        this.lastKnownPosition = null;
        // Cached memory records
        this.validMemoryRecords = [];
        // Diagnostics
        this.updateCount = 0;
        this.targetSwitchCount = 0;
        this.lastDiagnosticLog = 0;
        Logger.info(`[${this.agentName}] ✅ Targeting System initialized (YUKA-optimized)`);
    }
}

export { EnhancedTargetSystem as default };
