import { Script } from '../../../playcanvas-stable.min.mjs';

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
 * EntityGuidEnsurer - Ensures all entities have valid GUIDs
 * 
 * This script should be attached to any entity that will be tracked by the AI vision system,
 * especially the Player entity.
 * 
 * The issue: PlayCanvas entities don't always have GUIDs assigned, which causes the
 * vision system to fail when trying to cache YUKA entity wrappers.
 * 
 * This script generates and assigns a GUID if one is missing.
 */ class EntityGuidEnsurer extends Script {
    initialize() {
        this.ensureGuid();
    }
    ensureGuid() {
        let guid = null;
        // Try to get existing GUID
        if (this.entity.getGuid && typeof this.entity.getGuid === 'function') {
            try {
                guid = this.entity.getGuid();
            } catch (e) {
                console.warn(`[EntityGuidEnsurer] Error calling getGuid on ${this.entity.name}:`, e);
            }
        }
        // If no GUID, check for _guid property
        if (!guid && this.entity._guid) {
            guid = this.entity._guid;
        }
        // If still no GUID, generate one
        if (!guid) {
            guid = this.generateGuid();
            // Try to assign it
            if (this.entity._guid === undefined) {
                this.entity._guid = guid;
                console.log(`[EntityGuidEnsurer] ✅ Assigned GUID to ${this.entity.name}: ${guid}`);
            }
            // Also create a getGuid method if it doesn't exist
            if (!this.entity.getGuid) {
                this.entity.getGuid = ()=>this.entity._guid;
                console.log(`[EntityGuidEnsurer] ✅ Added getGuid() method to ${this.entity.name}`);
            }
        } else {
            console.log(`[EntityGuidEnsurer] ✅ Entity ${this.entity.name} already has GUID: ${guid.substring(0, 8)}...`);
        }
    }
    /**
     * Generate a unique GUID
     */ generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        });
    }
}
_define_property(EntityGuidEnsurer, "scriptName", 'entityGuidEnsurer');

export { EntityGuidEnsurer };
