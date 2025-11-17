import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../engine/logger.mjs';

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
 * 💥 COVER DEGRADATION SYSTEM (System #7)
 * 
 * Makes cover destructible over time:
 * - Cover takes damage from bullet impacts
 * - Visual feedback (cracks, sparks, darkening)
 * - After ~50 hits: "damaged" state (visual cracks, 70% protection)
 * - After ~100 hits: "destroyed" state (30% protection)
 * - Forces repositioning during prolonged firefights
 * 
 * Creates dynamic combat where positions become untenable.
 * Prevents camping and makes firefights evolve.
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * IMPLEMENTATION STATUS (as of Nov 4, 2025)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * ✅ IMPLEMENTED (Code Complete):
 * - Cover object registration and tracking
 * - Hit counter per cover object
 * - State transitions: intact → damaged (50 hits) → destroyed (100 hits)
 * - Protection multipliers: 100% → 70% → 30%
 * - Visual feedback: material darkening based on damage
 * - Impact effects event firing (sparks, dust)
 * - Cover degradation notifications for AI agents
 * - Protection query methods for damage calculations
 * - Cover reset functionality for new rounds
 * 
 * ⚠️ NEEDS VERIFICATION / INTEGRATION:
 * 1. **Scene Setup Required:**
 *    - Need entities tagged with 'cover' in scene
 *    - Cover objects must have model components
 *    - Test: Check if any cover objects exist currently
 * 
 * 2. **Event Integration:**
 *    - Listens for 'weapon:impact' event
 *    - Fires 'cover:degraded' for AI
 *    - Fires 'effects:cover_impact' for particles
 *    - Test: Verify weapon system fires impact events with hitEntity
 * 
 * 3. **Visual Effects:**
 *    - Material darkening implemented
 *    - Particle effects need external particle system
 *    - Could add: crack textures, debris, destruction animation
 * 
 * 4. **AI Integration:**
 *    - System fires 'cover:degraded' events
 *    - AI needs to listen and re-evaluate cover safety
 *    - Test: Verify AI responds to degraded cover
 * 
 * 🔧 FOR FULL INTEGRATION (Future Work):
 * 1. Create cover objects in scene with 'cover' tag
 * 2. Verify weapon system integration (weapon:impact events)
 * 3. Create particle effects system to handle effects:cover_impact
 * 4. Add AI cover evaluation based on getCoverProtection()
 * 5. Add visual crack decals or texture swapping
 * 6. Test with sustained fire (50-100 hits per cover)
 * 
 * 📊 TESTING PLAN:
 * ```javascript
 * // Check if system exists
 * const coverSystem = pc.app.root.findByName('CoverDegradationSystem');
 * 
 * // Find cover objects
 * const covers = pc.app.root.findByTag('cover');
 * console.log('Cover objects:', covers.length);
 * 
 * // Test cover registration
 * covers.forEach(c => coverSystem.script.coverDegradationSystem.registerCover(c));
 * 
 * // Check tracked covers
 * console.log('Tracked covers:', coverSystem.script.coverDegradationSystem.coverObjects.size);
 * 
 * // Simulate damage
 * const testCover = covers[0];
 * for(let i = 0; i < 60; i++) {
 *     pc.app.fire('weapon:impact', { hitEntity: testCover, hitPosition: testCover.getPosition() });
 * }
 * console.log('Cover state:', coverSystem.script.coverDegradationSystem.getCoverState(testCover));
 * ```
 * 
 * 💡 DESIGN NOTES:
 * - Threshold values (50/100) tunable for gameplay balance
 * - Could add self-repair over time (currently disabled in update())
 * - Protection multipliers affect damage calculations elsewhere
 * - System is stateless - cover resets each round
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */ class CoverDegradationSystem extends Script {
    initialize() {
        if (this.__cdsBooted) {
            Logger.debug('[CoverDegradationSystem] Already initialized');
            return;
        }
        // Track cover objects and their damage
        this.coverObjects = new Map(); // entity → cover data
        // Damage thresholds
        this.damagedThreshold = 50; // Hits before "damaged" state
        this.destroyedThreshold = 100; // Hits before "destroyed" state
        // Protection multipliers by state
        this.protectionMultipliers = {
            intact: 1.0,
            damaged: 0.7,
            destroyed: 0.3 // 30% protection
        };
        // Visual effects
        this.crackIntensity = {
            intact: 0,
            damaged: 0.5,
            destroyed: 1.0
        };
        this._setupEventListeners();
        this._scanForCoverObjects();
        this.on('destroy', this._cleanup, this);
        this.__cdsBooted = true;
        Logger.info('[CoverDegradationSystem] Initialized');
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        // Listen for bullet impacts
        this.app.on('weapon:impact', this._onBulletImpact, this);
        // Listen for cover registration
        this.app.on('cover:register', this._onCoverRegister, this);
        this._eventsBound = true;
    }
    /**
     * Scan scene for cover objects
     */ _scanForCoverObjects() {
        // Find all entities tagged as cover
        const coverEntities = this.app.root.findByTag('cover');
        for (const entity of coverEntities){
            this.registerCover(entity);
        }
        Logger.debug(`[CoverDegradationSystem] Found ${coverEntities.length} cover objects`);
    }
    /**
     * Register a cover object for tracking
     */ registerCover(entity) {
        if (!entity) return;
        const coverData = {
            entity: entity,
            hits: 0,
            state: 'intact',
            lastHitTime: 0,
            position: entity.getPosition().clone(),
            originalMaterial: null
        };
        // Store original material for visual effects
        if (entity.model && entity.model.meshInstances.length > 0) {
            coverData.originalMaterial = entity.model.meshInstances[0].material;
        }
        this.coverObjects.set(entity.getGuid(), coverData);
        Logger.debug(`[CoverDegradationSystem] Registered cover: ${entity.name}`);
    }
    /**
     * Handle cover registration event
     */ _onCoverRegister(entity) {
        this.registerCover(entity);
    }
    /**
     * Handle bullet impact on cover
     */ _onBulletImpact(data) {
        if (!data || !data.hitEntity) return;
        const hitEntity = data.hitEntity;
        const coverId = hitEntity.getGuid();
        const coverData = this.coverObjects.get(coverId);
        // Not a tracked cover object
        if (!coverData) {
            // Check if it's a cover object we haven't registered yet
            if (hitEntity.tags && hitEntity.tags.has('cover')) {
                this.registerCover(hitEntity);
                return; // Will catch on next hit
            }
            return;
        }
        // Increment hit counter
        coverData.hits++;
        coverData.lastHitTime = performance.now();
        // Check for state change
        const previousState = coverData.state;
        this._updateCoverState(coverData);
        // Apply visual effects if state changed
        if (coverData.state !== previousState) {
            this._applyVisualEffects(coverData);
            // Notify agents using this cover
            this._notifyCoverDegraded(coverData);
        }
        // Spawn visual feedback (sparks, dust)
        if (data.hitPosition) {
            this._spawnImpactEffects(coverData, data.hitPosition);
        }
    }
    /**
     * Update cover state based on hits
     */ _updateCoverState(coverData) {
        if (coverData.hits >= this.destroyedThreshold) {
            coverData.state = 'destroyed';
        } else if (coverData.hits >= this.damagedThreshold) {
            coverData.state = 'damaged';
        } else {
            coverData.state = 'intact';
        }
    }
    /**
     * Apply visual effects to damaged cover
     */ _applyVisualEffects(coverData) {
        const entity = coverData.entity;
        if (!entity || !entity.model) return;
        // Darken material based on damage
        const intensity = this.crackIntensity[coverData.state];
        const darkenFactor = 1 - intensity * 0.4; // Up to 40% darker
        // Apply to all mesh instances
        entity.model.meshInstances.forEach((meshInstance)=>{
            if (!meshInstance.material) return;
            // Clone material to avoid affecting other objects
            const mat = meshInstance.material.clone();
            // Darken diffuse color
            if (mat.diffuse) {
                mat.diffuse.r *= darkenFactor;
                mat.diffuse.g *= darkenFactor;
                mat.diffuse.b *= darkenFactor;
                mat.update();
            }
            meshInstance.material = mat;
        });
        // Add visual "cracks" (could be decals, but we'll use color for now)
        Logger.debug(`[CoverDegradationSystem] Applied visual effects to ${entity.name} (${coverData.state}, ${coverData.hits} hits)`);
    }
    /**
     * Spawn impact effects (sparks, dust)
     */ _spawnImpactEffects(coverData, position) {
        const state = coverData.state;
        // More dramatic effects for damaged/destroyed cover
        let sparkIntensity = 0.5;
        let dustIntensity = 0.3;
        if (state === 'damaged') {
            sparkIntensity = 0.8;
            dustIntensity = 0.6;
        } else if (state === 'destroyed') {
            sparkIntensity = 1.0;
            dustIntensity = 0.9;
        }
        // Fire event for visual effects system to create particles
        this.app.fire('effects:cover_impact', {
            position: position,
            sparkIntensity: sparkIntensity,
            dustIntensity: dustIntensity,
            state: state
        });
    }
    /**
     * Notify AI agents that cover has degraded
     */ _notifyCoverDegraded(coverData) {
        const entity = coverData.entity;
        const state = coverData.state;
        // Fire event for AI agents to reconsider this cover
        this.app.fire('cover:degraded', {
            coverEntity: entity,
            state: state,
            protectionMultiplier: this.protectionMultipliers[state]
        });
        Logger.info(`[CoverDegradationSystem] ⚠️ Cover ${entity.name} degraded to ${state} (${coverData.hits} hits)`);
    }
    /**
     * Get protection multiplier for a cover object
     */ getCoverProtection(entity) {
        if (!entity) return 0;
        const coverId = entity.getGuid();
        const coverData = this.coverObjects.get(coverId);
        if (!coverData) return 1.0; // Unknown cover = full protection
        return this.protectionMultipliers[coverData.state];
    }
    /**
     * Get cover state
     */ getCoverState(entity) {
        if (!entity) return null;
        const coverId = entity.getGuid();
        const coverData = this.coverObjects.get(coverId);
        return coverData ? coverData.state : null;
    }
    /**
     * Reset all cover objects (for new game/round)
     */ resetAllCover() {
        for (const [coverId, coverData] of this.coverObjects){
            coverData.hits = 0;
            coverData.state = 'intact';
            coverData.lastHitTime = 0;
            // Restore original material
            if (coverData.originalMaterial && coverData.entity && coverData.entity.model) {
                coverData.entity.model.meshInstances.forEach((meshInstance)=>{
                    meshInstance.material = coverData.originalMaterial;
                });
            }
        }
        Logger.info('[CoverDegradationSystem] All cover reset');
    }
    update(dt) {
    // Could add gradual self-repair over time if desired
    // For now, cover stays damaged until reset
    }
    _cleanup() {
        if (this._eventsBound) {
            this.app.off('weapon:impact', this._onBulletImpact, this);
            this.app.off('cover:register', this._onCoverRegister, this);
        }
        this._eventsBound = false;
        this.__cdsBooted = false;
        Logger.debug('[CoverDegradationSystem] Cleanup complete');
    }
}
_define_property(CoverDegradationSystem, "scriptName", 'coverDegradationSystem');

export { CoverDegradationSystem };
