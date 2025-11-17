/*
CONTRACT: CORE - Entity state management
DOMAIN: CORE/ENGINE
DEPENDENCIES: []
EXPORTS: [SessionStateManager]
GPT_CONTEXT: Manages entity state tracking, validation, and damage eligibility. Tracks entity states (alive, dead, respawning) and provides state query methods.
*/ /**
 * 📊 SessionStateManager - Entity State Tracking
 * 
 * Manages entity states throughout the session:
 * - Entity state tracking (alive, dead, respawning)
 * - Damage eligibility validation
 * - State queries and updates
 */ class SessionStateManager {
    /**
     * ✅ Set entity state
     */ setEntityState(entity, state) {
        if (!entity) {
            this._log('warn', '[SessionStateManager] Cannot set state - entity is null');
            return;
        }
        const guid = entity.getGuid();
        const oldState = this.entityStates.get(guid) || 'unknown';
        this.entityStates.set(guid, state);
        // Update dead entities tracking
        if (state === 'dead') {
            this.deadEntities.add(guid);
        } else if (state === 'alive') {
            this.deadEntities.delete(guid);
        }
        this._log('debug', `[SessionStateManager] Entity ${entity.name} state: ${oldState} → ${state}`);
    }
    /**
     * ✅ Get entity state
     */ getEntityState(entity) {
        if (!entity) {
            this._log('warn', '[SessionStateManager] Cannot get state - entity is null');
            return 'unknown';
        }
        const guid = entity.getGuid();
        return this.entityStates.get(guid) || 'alive';
    }
    /**
     * ✅ Check if entity can take damage
     */ canEntityTakeDamage(entity) {
        if (!entity || entity.destroyed) {
            return false;
        }
        const state = this.getEntityState(entity);
        // Only alive entities can take damage
        if (state !== 'alive') {
            return false;
        }
        // Check if entity is in dead entities set (redundant check)
        if (this.deadEntities.has(entity.getGuid())) {
            return false;
        }
        // Check health component
        if (entity.script?.health) {
            const health = entity.script.health;
            // Dead entities cannot take damage
            if (health.isDead || health.isDead()) {
                return false;
            }
            // Invulnerable entities cannot take damage
            if (health.isInvulnerable && health.isInvulnerable()) {
                return false;
            }
        }
        return true;
    }
    /**
     * ✅ Check if entity is dead
     */ isEntityDead(entity) {
        if (!entity) return true;
        const guid = entity.getGuid();
        return this.deadEntities.has(guid) || this.getEntityState(entity) === 'dead';
    }
    /**
     * ✅ Check if entity is alive
     */ isEntityAlive(entity) {
        return !this.isEntityDead(entity) && this.getEntityState(entity) === 'alive';
    }
    /**
     * ✅ Mark entity as dead
     */ markEntityDead(entity) {
        if (!entity) return;
        const guid = entity.getGuid();
        this.deadEntities.add(guid);
        this.setEntityState(entity, 'dead');
    }
    /**
     * ✅ Mark entity as alive
     */ markEntityAlive(entity) {
        if (!entity) return;
        const guid = entity.getGuid();
        this.deadEntities.delete(guid);
        this.setEntityState(entity, 'alive');
    }
    /**
     * ✅ Get all dead entities
     */ getDeadEntities() {
        return Array.from(this.deadEntities);
    }
    /**
     * ✅ Get entity count by state
     */ getEntityCountByState(state) {
        let count = 0;
        for (const [guid, entityState] of this.entityStates){
            if (entityState === state) count++;
        }
        return count;
    }
    /**
     * ✅ Clear all states
     */ clearAllStates() {
        this.entityStates.clear();
        this.deadEntities.clear();
        this._log('debug', '[SessionStateManager] All entity states cleared');
    }
    /**
     * ✅ Get state statistics
     */ getStateStats() {
        const stats = {
            total: this.entityStates.size,
            alive: this.getEntityCountByState('alive'),
            dead: this.getEntityCountByState('dead'),
            respawning: this.getEntityCountByState('respawning'),
            unknown: this.getEntityCountByState('unknown')
        };
        return stats;
    }
    constructor(app, gameManager, logFunction){
        this.app = app;
        this.gameManager = gameManager;
        // Entity state tracking
        this.entityStates = new Map(); // guid -> state
        this.deadEntities = new Set(); // Set of dead entity GUIDs
        this._log = logFunction;
    }
}

export { SessionStateManager };
