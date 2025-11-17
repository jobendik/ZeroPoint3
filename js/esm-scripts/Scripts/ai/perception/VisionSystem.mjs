import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';
import * as YUKA from 'yuka';

const VISION_UPDATE_HZ = aiConfig.vision.VISION_UPDATE_HZ;
const TARGET_MEMORY_SPAN = aiConfig.vision.TARGET_MEMORY_SPAN;
const DEFAULT_EYE_HEIGHT = aiConfig.vision.DEFAULT_EYE_HEIGHT;
const DEFAULT_CROUCH_EYE_HEIGHT = aiConfig.vision.DEFAULT_CROUCH_EYE_HEIGHT;
const MIN_EYE_HEIGHT = aiConfig.vision.MIN_EYE_HEIGHT;
const MAX_EYE_HEIGHT = aiConfig.vision.MAX_EYE_HEIGHT;
const MEMORY_CLEANUP_INTERVAL = aiConfig.vision.MEMORY_CLEANUP_INTERVAL;
const MAX_TRACKED_ENTITIES = aiConfig.vision.MAX_TRACKED_ENTITIES;
class AIVisionSystem {
    _initializeEyeHeight(agent) {
        let eyeHeight = DEFAULT_EYE_HEIGHT;
        let source = 'default';
        try {
            if (typeof agent.eyeHeight === 'number' && !isNaN(agent.eyeHeight)) {
                eyeHeight = agent.eyeHeight;
                source = 'agent.eyeHeight';
            } else if (agent.entity && typeof agent.entity.eyeHeight === 'number' && !isNaN(agent.entity.eyeHeight)) {
                eyeHeight = agent.entity.eyeHeight;
                source = 'entity.eyeHeight';
            } else if (agent.entity && agent.entity.script) {
                const aiScript = agent.entity.script.aiAgent || agent.entity.script.aiController;
                if (aiScript && typeof aiScript.eyeHeight === 'number' && !isNaN(aiScript.eyeHeight)) {
                    eyeHeight = aiScript.eyeHeight;
                    source = 'script.eyeHeight';
                }
            }
            if (eyeHeight < MIN_EYE_HEIGHT || eyeHeight > MAX_EYE_HEIGHT) {
                Logger.warn(`[${this.agentName}] Eye height ${eyeHeight.toFixed(2)}m outside valid range, using default`);
                eyeHeight = DEFAULT_EYE_HEIGHT;
                source = 'default (clamped)';
            }
            Logger.debug(`[${this.agentName}] Eye height: ${eyeHeight.toFixed(2)}m (${source})`);
        } catch (error) {
            Logger.warn(`[${this.agentName}] Error initializing eye height:`, error);
            eyeHeight = DEFAULT_EYE_HEIGHT;
        }
        return eyeHeight;
    }
    getCurrentEyeHeight() {
        return this.isCrouching ? this.crouchingEyeHeight : this.eyeHeight;
    }
    setCrouching(isCrouching) {
        if (this.isCrouching !== isCrouching) {
            this.isCrouching = isCrouching;
            Logger.debug(`[${this.agentName}] Crouch state: ${isCrouching}`);
        }
    }
    /**
     * ✅ CRITICAL FIX: Get corrected forward vector
     * Mixamo model faces backward after 180° rotation, so invert entity.forward
     */ getCorrectedForward() {
        const rawForward = this.agent.entity.forward.clone();
        // Invert to get actual facing direction
        return rawForward.scale(-1);
    }
    update(dt) {
        const now = performance.now();
        this._processDelayedReactions(now);
        if (this.visionThrottleEnabled && now - this.lastVisionUpdate < this.visionUpdateInterval) {
            return;
        }
        this.lastVisionUpdate = now;
        this.updateVision();
        if (now - this.lastMemoryCleanup >= this.memoryCleanupInterval) {
            this.cleanupOldMemories();
            this.lastMemoryCleanup = now;
        }
        if (now - this.lastDiagnosticLog > 5000) {
            this._logDiagnostics();
            this.lastDiagnosticLog = now;
        }
    }
    cleanupOldMemories() {
        if (!this.agent.memorySystem) return;
        const memorySystem = this.agent.memorySystem;
        const currentTime = this.agent.currentTime || 0;
        const memorySpan = memorySystem.memorySpan || TARGET_MEMORY_SPAN;
        const recordsToDelete = [];
        const entitiesToRemoveFromCache = [];
        for (const [entity, record] of memorySystem.recordsMap.entries()){
            const timeSinceLastSeen = currentTime - record.timeLastSensed;
            if (timeSinceLastSeen > memorySpan) {
                recordsToDelete.push(entity);
                if (entity && entity.entity && entity.entity.getGuid) {
                    entitiesToRemoveFromCache.push(entity.entity.getGuid());
                }
            }
        }
        let deletedCount = 0;
        for (const entity of recordsToDelete){
            memorySystem.deleteRecord(entity);
            deletedCount++;
        }
        for (const guid of entitiesToRemoveFromCache){
            if (this.yukaEntityCache.has(guid)) {
                this.yukaEntityCache.delete(guid);
            }
        }
        if (memorySystem.records.length > MAX_TRACKED_ENTITIES) {
            const sortedRecords = [
                ...memorySystem.records
            ].sort((a, b)=>a.timeLastSensed - b.timeLastSensed);
            const toRemove = sortedRecords.length - MAX_TRACKED_ENTITIES;
            for(let i = 0; i < toRemove; i++){
                const record = sortedRecords[i];
                memorySystem.deleteRecord(record.entity);
                deletedCount++;
                if (record.entity && record.entity.entity && record.entity.entity.getGuid) {
                    const guid = record.entity.entity.getGuid();
                    this.yukaEntityCache.delete(guid);
                }
            }
        }
        this._cleanupLastKnownPositions();
        if (deletedCount > 0) {
            this.memoryCleanupCount += deletedCount;
        }
    }
    updateVision() {
        const entityManager = this.agent.app.navigation?.entityManager;
        if (!entityManager) {
            return;
        }
        const potentialTargets = this._gatherPotentialTargets(entityManager);
        this.visionCheckCount += potentialTargets.length;
        for (const target of potentialTargets){
            this._updateTargetVision(target);
        }
        const currentTime = this.agent.currentTime || 0;
        this.agent.memorySystem.getValidMemoryRecords(currentTime, this.memoryRecords);
        this._detectLostTargets();
    }
    _updateTargetVision(target) {
        try {
            if (!target || !target.entity) return;
            const targetEntity = target.entity;
            // ✅ CRITICAL FIX: Ensure entity has proper getPosition method
            if (!targetEntity.getPosition || typeof targetEntity.getPosition !== 'function') {
                Logger.warn(`[${this.agentName}] Target entity missing getPosition method`);
                return;
            }
            const yukaEntity = this._getOrCreateYukaEntity(targetEntity);
            if (!yukaEntity) return;
            const memorySystem = this.agent.memorySystem;
            const vision = this.agent.vision;
            if (!memorySystem || !vision) {
                Logger.warn(`[${this.agentName}] Memory or vision system not initialized`);
                return;
            }
            if (!memorySystem.hasRecord(yukaEntity)) {
                memorySystem.createRecord(yukaEntity);
            }
            const record = memorySystem.getRecord(yukaEntity);
            const position = targetEntity.getPosition();
            const currentEyeHeight = this.getCurrentEyeHeight();
            const eyePosition = this.agent.entity.getPosition().clone();
            eyePosition.y += currentEyeHeight;
            const hasLineOfSight = this._checkLineOfSight(eyePosition, position, targetEntity);
            // ✅ CRITICAL FIX: Custom FOV check using corrected forward vector
            // YUKA's Vision.visible() uses vehicle.getDirection() which is wrong after 180° rotation
            // So we implement our own FOV check with inverted forward
            const isVisible = this._checkVisibilityWithCorrectedForward(eyePosition, position, hasLineOfSight);
            const currentTime = this.agent.currentTime || 0;
            if (isVisible) {
                if (!record.visible) {
                    record.timeBecameVisible = currentTime;
                    record.visible = true;
                    this._onTargetSpotted(target, record);
                }
                record.timeLastSensed = currentTime;
                record.lastSensedPosition.copy(position);
            } else {
                if (record.visible) {
                    record.visible = false;
                    this._onTargetLost(target, record);
                }
            }
        } catch (error) {
            Logger.error(`[${this.agentName}] Error in _updateTargetVision:`, error);
        }
    }
    /**
     * ✅ NEW: Get corrected eye position accounting for coordinate system transform
     */ _getCorrectedEyePosition() {
        const eyePosition = this.agent.entity.getPosition().clone();
        eyePosition.y += this.getCurrentEyeHeight();
        return eyePosition;
    }
    /**
     * ✅ CRITICAL FIX: Custom visibility check using corrected forward vector
     * Replaces YUKA's Vision.visible() which uses wrong direction after 180° rotation
     */ _checkVisibilityWithCorrectedForward(eyePosition, targetPosition, hasLineOfSight) {
        // First check line of sight
        if (!hasLineOfSight) {
            return false;
        }
        // Get vision settings
        const vision = this.agent.vision;
        if (!vision) return false;
        const range = vision.range;
        const fieldOfView = vision.fieldOfView; // This is in radians, half-angle
        // Check distance
        const distance = eyePosition.distance(targetPosition);
        if (distance > range) {
            return false;
        }
        // Check FOV using CORRECTED forward vector
        const correctedForward = this.getCorrectedForward();
        const toTarget = new Vec3().sub2(targetPosition, eyePosition).normalize();
        // Calculate angle between forward and target direction
        const dotProduct = correctedForward.dot(toTarget);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        // Check if within FOV (fieldOfView is half-angle in radians)
        return angle <= fieldOfView;
    }
    _checkLineOfSight(fromPosition, toPosition, targetEntity) {
        try {
            const app = this.agent.app;
            const direction = new Vec3();
            direction.sub2(toPosition, fromPosition);
            const distance = direction.length();
            if (distance < 0.1) return false;
            direction.normalize();
            const result = app.systems.rigidbody.raycastFirst(fromPosition, toPosition);
            if (!result) {
                return true;
            }
            if (result.entity === targetEntity) {
                return true;
            }
            const hitDistance = fromPosition.distance(result.point);
            if (hitDistance < distance * 0.95) {
                return false;
            }
            return true;
        } catch (error) {
            Logger.error(`[${this.agentName}] Error in line of sight check:`, error);
            return false;
        }
    }
    _onTargetSpotted(target, record) {
        const targetId = this._getTargetId(target.entity);
        const targetName = this._getTargetName(target.entity);
        const now = performance.now();
        this.knownTargets.set(targetId, {
            entity: target.entity,
            record: record,
            lastSpottedTime: now,
            reactionTriggeredAt: now + this.reactionTime
        });
        this.updateLastKnownPosition(targetId, target.entity.getPosition(), 1.0, 'visual');
        const lastLog = this.lastSpottedLog.get(targetId) || 0;
        if (now - lastLog > 1000) {
            Logger.aiDetail(`[${this.agentName}] 👁️ SPOTTED: ${targetName}`);
            this.lastSpottedLog.set(targetId, now);
        }
        this.targetsSpottedCount++;
    }
    _processDelayedReactions(now) {
        if (!this.agent.onTargetSpotted) return;
        for (const [targetId, targetData] of this.knownTargets.entries()){
            if (!targetData.reactionTriggeredAt) continue;
            if (now >= targetData.reactionTriggeredAt) {
                if (!this.agent.isDead && targetData.entity && !targetData.entity.destroyed) {
                    const target = {
                        entity: targetData.entity,
                        lastSensedTime: now
                    };
                    this.agent.onTargetSpotted(target);
                    Logger.aiDetail(`[${this.agentName}] ⚡ REACTED to ${this._getTargetName(targetData.entity)}`);
                }
                delete targetData.reactionTriggeredAt;
            }
        }
    }
    _onTargetLost(target, record) {
        const targetId = this._getTargetId(target.entity);
        this._getTargetName(target.entity);
        this.updateLastKnownPosition(targetId, record.lastSensedPosition, 0.8, 'memory');
        this.targetsLostCount++;
        if (this.agent.onTargetLost) {
            this.agent.onTargetLost({
                entity: target.entity
            });
        }
    }
    _detectLostTargets() {
        for (const [targetId, targetData] of this.knownTargets.entries()){
            if (targetData.record && targetData.record.visible === false) {
                const now = performance.now();
                now - targetData.lastSpottedTime;
            }
        }
    }
    updateLastKnownPosition(enemyId, pos, confidence = 0.5, source = 'visual') {
        if (!pos || !enemyId) return;
        const now = performance.now();
        this.lastKnownPositions.set(enemyId, {
            position: pos.clone ? pos.clone() : new Vec3(pos.x, pos.y, pos.z),
            timestamp: now,
            confidence: Math.max(0, Math.min(1, confidence)),
            source: source
        });
    }
    getInvestigationTargets(maxAge = this.LAST_KNOWN_MEMORY_DURATION, minConfidence = this.MIN_CONFIDENCE) {
        const now = performance.now();
        const targets = [];
        for (const [enemyId, data] of this.lastKnownPositions.entries()){
            const age = now - data.timestamp;
            if (age > maxAge) continue;
            const decayFactor = 1.0 - age / 1000 * this.CONFIDENCE_DECAY_RATE;
            const currentConfidence = data.confidence * Math.max(0, decayFactor);
            if (currentConfidence < minConfidence) continue;
            const isCurrentlyVisible = this._isEnemyCurrentlyVisible(enemyId);
            if (isCurrentlyVisible) continue;
            targets.push({
                enemyId: enemyId,
                position: data.position.clone(),
                confidence: currentConfidence,
                age: age,
                source: data.source,
                timestamp: data.timestamp
            });
        }
        targets.sort((a, b)=>b.confidence - a.confidence);
        return targets;
    }
    getBestInvestigationTarget() {
        const targets = this.getInvestigationTargets();
        return targets.length > 0 ? targets[0] : null;
    }
    _isEnemyCurrentlyVisible(enemyId) {
        const knownTarget = this.knownTargets.get(enemyId);
        if (!knownTarget || !knownTarget.record) return false;
        return knownTarget.record.visible === true;
    }
    onSoundDetected(soundInfo) {
        if (!soundInfo || !soundInfo.position) return;
        try {
            if (soundInfo.source && soundInfo.source.getGuid) {
                const sourceId = soundInfo.source.getGuid();
                const confidence = Math.min(aiConfig.vision.SOUND_CONFIDENCE_MAX, soundInfo.intensity || aiConfig.vision.SOUND_CONFIDENCE_DEFAULT);
                this.updateLastKnownPosition(sourceId, soundInfo.position, confidence, 'sound');
            }
        } catch (error) {
            Logger.error(`[${this.agentName}] Error processing sound:`, error);
        }
    }
    _cleanupLastKnownPositions() {
        const now = performance.now();
        const toDelete = [];
        for (const [enemyId, data] of this.lastKnownPositions.entries()){
            const age = now - data.timestamp;
            if (age > this.LAST_KNOWN_MEMORY_DURATION) {
                toDelete.push(enemyId);
                continue;
            }
            const decayFactor = 1.0 - age / 1000 * this.CONFIDENCE_DECAY_RATE;
            const currentConfidence = data.confidence * Math.max(0, decayFactor);
            if (currentConfidence < this.MIN_CONFIDENCE) {
                toDelete.push(enemyId);
            }
        }
        for (const enemyId of toDelete){
            this.lastKnownPositions.delete(enemyId);
        }
    }
    _gatherPotentialTargets(entityManager) {
        const targets = [];
        if (entityManager && entityManager.entities) {
            for (const yukaEntity of entityManager.entities){
                const pcEntity = yukaEntity.playcanvasEntity || yukaEntity.entity || yukaEntity;
                if (!pcEntity || !pcEntity.enabled) continue;
                if (pcEntity === this.agent.entity) continue;
                if (pcEntity.destroyed) continue;
                if (this._isValidTarget(pcEntity)) {
                    targets.push({
                        entity: pcEntity
                    });
                }
            }
        }
        if (targets.length === 0) {
            const playerByTag = this.agent.app.root.findByTag('player');
            if (playerByTag && playerByTag.length > 0) {
                for (const playerEntity of playerByTag){
                    if (playerEntity.enabled && !playerEntity.destroyed) {
                        targets.push({
                            entity: playerEntity
                        });
                    }
                }
            }
        }
        if (targets.length === 0) {
            const allEntities = this.agent.app.root.findComponents('script');
            for (const entity of allEntities){
                if (entity === this.agent.entity) continue;
                if (!entity.enabled || entity.destroyed) continue;
                if (entity.script && (entity.script.player || entity.script.playerController)) {
                    targets.push({
                        entity: entity
                    });
                    break;
                }
            }
        }
        return targets;
    }
    _isValidTarget(entity) {
        if (entity.tags && entity.tags.has('player')) return true;
        if (entity.script && (entity.script.player || entity.script.playerController)) return true;
        if (entity.tags && entity.tags.has('ai_agent')) {
            return true;
        }
        return false;
    }
    /**
     * ✅ CRITICAL FIX: Ensure GUID exists before caching
     */ _getOrCreateYukaEntity(pcEntity) {
        if (!pcEntity) return null;
        try {
            // ✅ FIX: Generate GUID if missing
            let entityGuid = null;
            if (pcEntity.getGuid && typeof pcEntity.getGuid === 'function') {
                entityGuid = pcEntity.getGuid();
            }
            // Generate a fallback GUID if missing
            if (!entityGuid) {
                if (!pcEntity._tempGuid) {
                    pcEntity._tempGuid = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    Logger.warn(`[${this.agentName}] Entity ${pcEntity.name || 'Unknown'} missing GUID, assigned temp: ${pcEntity._tempGuid}`);
                }
                entityGuid = pcEntity._tempGuid;
            }
            // Check cache
            if (this.yukaEntityCache.has(entityGuid)) {
                return this.yukaEntityCache.get(entityGuid);
            }
            // Create new YUKA entity
            const yukaEntity = new YUKA.GameEntity();
            yukaEntity.entity = pcEntity;
            yukaEntity.boundingRadius = aiConfig.perception.BOUNDING_RADIUS_DEFAULT;
            // Cache it
            this.yukaEntityCache.set(entityGuid, yukaEntity);
            Logger.debug(`[${this.agentName}] Created YUKA wrapper for ${pcEntity.name || 'Unknown'}`);
            return yukaEntity;
        } catch (error) {
            Logger.error(`[${this.agentName}] Error creating YUKA entity:`, error);
            return null;
        }
    }
    _findTargetForRecord(record) {
        if (!record || !record.entity) return null;
        for (const [_, data] of this.knownTargets.entries()){
            if (data.record === record) {
                return {
                    entity: data.entity
                };
            }
        }
        return null;
    }
    _getTargetId(pcEntity) {
        if (!pcEntity) return 'unknown';
        try {
            if (pcEntity.getGuid && typeof pcEntity.getGuid === 'function') {
                return pcEntity.getGuid();
            }
            if (pcEntity._tempGuid) {
                return pcEntity._tempGuid;
            }
            if (pcEntity._guid) {
                return pcEntity._guid;
            }
            return Math.random().toString(36).substr(2, 9);
        } catch (e) {
            return Math.random().toString(36).substr(2, 9);
        }
    }
    _getTargetName(pcEntity) {
        if (!pcEntity) return 'Unknown';
        if (pcEntity.name && pcEntity.name !== 'Untitled') {
            return pcEntity.name;
        }
        if (pcEntity.tags) {
            if (pcEntity.tags.has('player')) return 'Player';
            if (pcEntity.tags.has('ai_agent')) return 'AIAgent';
        }
        return 'Entity';
    }
    _logDiagnostics() {
        const memoryCount = this.agent.memorySystem ? this.agent.memorySystem.records.length : 0;
        const visibleCount = this.memoryRecords.filter((r)=>r.visible).length;
        this.lastKnownPositions.size;
        Logger.info(`[${this.agentName}] Vision: ${this.visionCheckCount} checks, ` + `${memoryCount} tracked, ${visibleCount} visible, cache: ${this.yukaEntityCache.size}`);
        this.visionCheckCount = 0;
        this.targetsSpottedCount = 0;
        this.targetsLostCount = 0;
        this.memoryCleanupCount = 0;
    }
    getVisibleTargets() {
        return this.memoryRecords.filter((r)=>r.visible === true);
    }
    getRememberedTargets() {
        return [
            ...this.memoryRecords
        ];
    }
    isTargetVisible(pcEntity) {
        if (!pcEntity) return false;
        const yukaEntity = this._getOrCreateYukaEntity(pcEntity);
        if (!yukaEntity) return false;
        if (!this.agent.memorySystem.hasRecord(yukaEntity)) {
            return false;
        }
        const record = this.agent.memorySystem.getRecord(yukaEntity);
        return record.visible === true;
    }
    getVisionStatus() {
        const visibleCount = this.memoryRecords.filter((r)=>r.visible).length;
        const rememberedCount = this.memoryRecords.length;
        return {
            agentName: this.agentName,
            visible: visibleCount,
            remembered: rememberedCount,
            lastKnownPositions: this.lastKnownPositions.size,
            range: this.agent.vision?.range || 0,
            fieldOfView: this.agent.vision?.fieldOfView || 0,
            eyeHeight: this.getCurrentEyeHeight(),
            yukaEntityCacheSize: this.yukaEntityCache.size
        };
    }
    destroy() {
        this.memoryRecords.length = 0;
        this.knownTargets.clear();
        this.lastSpottedLog.clear();
        this.yukaEntityCache.clear();
        this.lastKnownPositions.clear();
        Logger.debug(`[${this.agentName}] Vision system destroyed`);
    }
    constructor(agent){
        this.agent = agent;
        this.agentGuid = agent.entity.getGuid();
        this.agentName = agent.entity.name || `Agent_${this.agentGuid.substring(0, 8)}`;
        this.eyeHeight = this._initializeEyeHeight(agent);
        this.standingEyeHeight = this.eyeHeight;
        this.crouchingEyeHeight = DEFAULT_CROUCH_EYE_HEIGHT;
        this.isCrouching = false;
        if (!this.agent.memorySystem) {
            Logger.error(`[${this.agentName}] Agent missing memorySystem! Must be initialized in agent constructor.`);
        }
        if (!this.agent.vision) {
            Logger.error(`[${this.agentName}] Agent missing vision! Must be initialized in agent constructor.`);
        }
        this.yukaEntityCache = new Map();
        this.lastVisionUpdate = 0;
        const visionStaggerOffset = Math.random() * 200;
        this.visionUpdateInterval = 1000 / VISION_UPDATE_HZ + visionStaggerOffset;
        this.visionThrottleEnabled = true;
        this.reactionTime = 220 + (Math.random() - 0.5) * 100;
        this.lastMemoryCleanup = 0;
        this.memoryCleanupInterval = MEMORY_CLEANUP_INTERVAL;
        this.memoryRecords = [];
        this.knownTargets = new Map();
        this.lastSpottedLog = new Map();
        this.lastKnownPositions = new Map();
        this.visionCheckCount = 0;
        this.targetsSpottedCount = 0;
        this.targetsLostCount = 0;
        this.lastDiagnosticLog = 0;
        this.memoryCleanupCount = 0;
        this.LAST_KNOWN_MEMORY_DURATION = aiConfig.vision.LAST_KNOWN_MEMORY_DURATION;
        this.CONFIDENCE_DECAY_RATE = aiConfig.vision.CONFIDENCE_DECAY_RATE;
        this.MIN_CONFIDENCE = aiConfig.vision.MIN_CONFIDENCE;
        Logger.info(`[${this.agentName}] ✅ Vision System initialized (COORDINATE SYSTEM FIXED)`);
    }
}

export { AIVisionSystem as default };
