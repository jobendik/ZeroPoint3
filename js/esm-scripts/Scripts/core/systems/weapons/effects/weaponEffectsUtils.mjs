///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
// weaponEffectsUtils.mjs - Shared utilities for weapon effects systems
/**
 * Shared utilities for weapon effects components
 * Consolidates common patterns found across multiple weapon effect files
 */ /**
 * Find the player entity by traversing up the hierarchy
 * Consolidated from weaponVisualManager.js and weaponMover.js
 * @param {pc.Entity} startEntity - Entity to start searching from
 * @returns {pc.Entity|null} - The player entity or null if not found
 */ function findPlayerEntity(startEntity) {
    // Traverse up to find player entity
    let current = startEntity;
    while(current.parent){
        current = current.parent;
        if (current.tags && current.tags.has('player')) {
            return current;
        }
        if (current.script && (current.script.weaponSystem || current.script.player)) {
            return current;
        }
    }
    return null;
}
/**
 * Find the graphics entity for weapon effects
 * Consolidated from weaponMover.js and weaponAnimator.js
 * 
 * UPDATED: Now handles the actual hierarchy structure:
 * WeaponContainer -> Pistol/MachineGun/Shotgun (these ARE the graphics entities)
 * 
 * @param {pc.Entity} weaponEntity - The weapon entity to search in
 * @param {pc.Entity} fallbackEntity - Entity to use if Graphics not found
 * @returns {pc.Entity} - The graphics entity or fallback
 */ function findGraphicsEntity(weaponEntity, fallbackEntity = null) {
    // First try to find a "Graphics" child (legacy support)
    let graphicsEntity = weaponEntity.findByName('Graphics');
    if (!graphicsEntity) {
        // NEW: Check if the weapon entity itself is the graphics entity
        // (i.e., it's named Pistol, MachineGun, Shotgun, etc. and has a render/model component)
        if (weaponEntity && (weaponEntity.render || weaponEntity.model)) {
            return weaponEntity;
        }
        // NEW: Look for first child with render or model component
        // This handles the case where weaponEntity is the container
        if (weaponEntity && weaponEntity.children) {
            for(let i = 0; i < weaponEntity.children.length; i++){
                const child = weaponEntity.children[i];
                if (child.render || child.model) {
                    return child;
                }
            }
        }
        // Fallback to provided entity or weapon entity itself
        graphicsEntity = fallbackEntity || weaponEntity;
    }
    return graphicsEntity;
}
/**
 * Store original transform of an entity
 * Consolidated pattern from multiple files
 * @param {pc.Entity} entity - Entity to store transform for
 * @returns {Object} - Object with originalPosition and originalRotation
 */ function storeOriginalTransform(entity) {
    return {
        originalPosition: entity.getLocalPosition().clone(),
        originalRotation: entity.getLocalEulerAngles().clone()
    };
}
/**
 * Reset entity to its original transform
 * @param {pc.Entity} entity - Entity to reset
 * @param {Object} originalTransform - Original transform object
 */ function resetToOriginalTransform(entity, originalTransform) {
    if (entity && originalTransform) {
        entity.setLocalPosition(originalTransform.originalPosition);
        entity.setLocalEulerAngles(originalTransform.originalRotation);
    }
}
/**
 * Tween management utilities
 * Consolidated from weaponAnimator.js
 */ class TweenManager {
    /**
     * Track a tween for management
     * @param {*} tween - Tween to track
     */ trackTween(tween) {
        this.currentTweens.push(tween);
        const self = this;
        tween.on('destroy', function() {
            const index = self.currentTweens.indexOf(tween);
            if (index !== -1) {
                self.currentTweens.splice(index, 1);
            }
        });
    }
    /**
     * Stop all tracked tweens
     */ stopAllTweens() {
        this.currentTweens.forEach(function(tween) {
            try {
                tween.stop();
            } catch (e) {
            // Ignore errors from stopping already-stopped tweens
            }
        });
        this.currentTweens = [];
    }
    /**
     * Get count of active tweens
     * @returns {number} - Number of active tweens
     */ getActiveTweenCount() {
        return this.currentTweens.length;
    }
    constructor(){
        this.currentTweens = [];
    }
}
/**
 * Weapon type detection utility
 * Consolidated from weaponAnimator.js and weaponVisualManager.js
 * @param {string} entityName - Entity name to analyze
 * @returns {string} - Detected weapon type
 */ function detectWeaponType(entityName) {
    const name = entityName.toLowerCase();
    if (name.includes('pistol') || name.includes('handgun')) {
        return 'pistol';
    } else if (name.includes('machine') || name.includes('auto') || name.includes('rifle')) {
        return 'machinegun';
    } else if (name.includes('shotgun') || name.includes('pump')) {
        return 'shotgun';
    } else if (name.includes('rocket') || name.includes('launcher')) {
        return 'rocketlauncher';
    }
    return 'pistol'; // Default fallback
}
/**
 * Map weapon entity names to standardized types
 * Consolidated from weaponVisualManager.js
 * @param {string} weaponName - Raw weapon entity name
 * @returns {string} - Standardized weapon type
 */ function mapWeaponEntityName(weaponName) {
    let weaponType = weaponName.toLowerCase();
    // Map common variations
    if (weaponType.includes('machine') || weaponType.includes('auto')) {
        weaponType = 'machinegun';
    } else if (weaponType.includes('pistol') || weaponType.includes('handgun')) {
        weaponType = 'pistol';
    } else if (weaponType.includes('shotgun') || weaponType.includes('pump')) {
        weaponType = 'shotgun';
    } else if (weaponType.includes('rocket')) {
        weaponType = 'rocketlauncher';
    }
    return weaponType;
}
/**
 * Find particle entities in a container
 * Consolidated from muzzleFlash.js
 * @param {pc.Entity} containerEntity - Entity to search in
 * @returns {pc.Entity[]} - Array of particle entities found
 */ function findParticleEntities(containerEntity) {
    const particleEntities = [];
    // Common particle system names
    const particleNames = [
        'CoreBurst',
        'Sparks',
        'Smoke',
        'Flash',
        'Burst',
        'Particles'
    ];
    particleNames.forEach((name)=>{
        const entity = containerEntity.findByName(name);
        if (entity && entity.particlesystem) {
            particleEntities.push(entity);
        }
    });
    // If no named particles found, search children
    if (particleEntities.length === 0) {
        containerEntity.children.forEach((child)=>{
            if (child.particlesystem) {
                particleEntities.push(child);
            }
        });
    }
    return particleEntities;
}
/**
 * Weapon-specific flash style configurations
 * Consolidated from muzzleFlash.js
 * @param {string} weaponType - Type of weapon
 * @returns {Object} - Flash style configuration
 */ function getFlashStyleForWeapon(weaponType) {
    switch(weaponType){
        case 'pistol':
            return {
                duration: 0.08,
                intensity: 1.5,
                color: [
                    1,
                    0.9,
                    0.6
                ]
            };
        case 'machinegun':
            return {
                duration: 0.06,
                intensity: 2.0,
                color: [
                    1,
                    0.8,
                    0.4
                ]
            };
        case 'shotgun':
            return {
                duration: 0.12,
                intensity: 3.0,
                color: [
                    1,
                    0.7,
                    0.3
                ]
            };
        case 'rocketlauncher':
            return {
                duration: 0.15,
                intensity: 4.0,
                color: [
                    1,
                    0.6,
                    0.2
                ]
            };
        default:
            return {
                duration: 0.1,
                intensity: 2.0,
                color: [
                    1,
                    0.8,
                    0.4
                ]
            };
    }
}

export { TweenManager, detectWeaponType, findGraphicsEntity, findParticleEntities, findPlayerEntity, getFlashStyleForWeapon, mapWeaponEntityName, resetToOriginalTransform, storeOriginalTransform };
