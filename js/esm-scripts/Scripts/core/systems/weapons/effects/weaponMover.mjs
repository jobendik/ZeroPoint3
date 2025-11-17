import { Script, Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { findGraphicsEntity, storeOriginalTransform, findPlayerEntity } from './weaponEffectsUtils.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';
import { Logger } from '../../../engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
 * Weapon Mover - Handles weapon breathing and movement bobbing animations
 * 
 * CRITICAL FIX: This script now works COOPERATIVELY with weaponAnimator instead of fighting it.
 * 
 * The original issue: weaponMover was resetting position to originalPosition every frame,
 * which overwrote weaponAnimator's recoil tweens. This caused weapons to disappear or behave incorrectly.
 * 
 * Solution: Store offset values separately and apply them as TINY adjustments that don't
 * interfere with the animator. The offsets are applied to ROTATION only to avoid position conflicts.
 */ class WeaponMover extends Script {
    initialize() {
        // Find graphics entity using shared utility
        this.graphicsEntity = findGraphicsEntity(this.entity, this.entity);
        if (!this.graphicsEntity) {
            Logger.error('[WeaponMover] Failed to find graphics entity for', this.entity.name);
            return;
        }
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Found graphics entity:', this.graphicsEntity.name, 'for weapon:', this.entity.name);
            Logger.debug('  - Has render component:', !!this.graphicsEntity.render);
            Logger.debug('  - Has model component:', !!this.graphicsEntity.model);
            Logger.debug('  - Is enabled:', this.graphicsEntity.enabled);
        }
        // Store original transform for reference only
        this.originalTransform = storeOriginalTransform(this.graphicsEntity);
        // Animation state
        this.breathingTime = 0;
        this.bobbingTime = 0;
        this.isActive = false;
        this.isMoving = false;
        this.isSprinting = false;
        // Store current offset values (applied additively)
        this.currentPosOffset = new Vec3(0, 0, 0);
        this.currentRotOffset = new Vec3(0, 0, 0);
        // Get player entity
        this.playerEntity = findPlayerEntity(this.entity);
        // Listen for movement events
        if (this.playerEntity) {
            this.playerEntity.on('character:startedMoving', this.onStartedMoving, this);
            this.playerEntity.on('character:stoppedMoving', this.onStoppedMoving, this);
            this.playerEntity.on('character:sprintChanged', this.onSprintChanged, this);
            this.app.on('character:startedMoving', this.onGlobalStartedMoving, this);
            this.app.on('character:stoppedMoving', this.onGlobalStoppedMoving, this);
            this.app.on('character:sprintChanged', this.onGlobalSprintChanged, this);
        }
        // Auto-activate when weapon enabled
        if (this.autoActivate) {
            this.checkIfWeaponActive();
        }
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Initialization complete for', this.entity.name);
            Logger.debug('  - Graphics entity:', this.graphicsEntity.name);
            Logger.debug('  - Player entity:', this.playerEntity ? this.playerEntity.name : 'not found');
            Logger.debug('  - Is active:', this.isActive);
            Logger.debug('  - Weapon entity enabled:', this.entity.enabled);
            Logger.debug('  - Graphics entity enabled:', this.graphicsEntity.enabled);
        }
    }
    checkIfWeaponActive() {
        this.isActive = this.entity.enabled;
        this.entity.on('enable', this.onWeaponEnabled, this);
        this.entity.on('disable', this.onWeaponDisabled, this);
    }
    onWeaponEnabled() {
        this.isActive = true;
        // Reset timing when weapon is enabled
        this.breathingTime = 0;
        this.bobbingTime = 0;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Activated for', this.entity.name);
        }
    }
    onWeaponDisabled() {
        this.isActive = false;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Deactivated for', this.entity.name);
        }
    }
    onStartedMoving() {
        this.isMoving = true;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Player started moving');
        }
    }
    onStoppedMoving() {
        this.isMoving = false;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Player stopped moving');
        }
    }
    onSprintChanged(isSprinting) {
        this.isSprinting = isSprinting;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] Sprint changed:', isSprinting);
            Logger.debug('  - Weapon entity:', this.entity.name, 'enabled:', this.entity.enabled);
            Logger.debug('  - Graphics entity:', this.graphicsEntity.name, 'enabled:', this.graphicsEntity.enabled);
        }
    }
    onGlobalStartedMoving(entity) {
        if (entity === this.playerEntity) {
            this.isMoving = true;
        }
    }
    onGlobalStoppedMoving(entity) {
        if (entity === this.playerEntity) {
            this.isMoving = false;
        }
    }
    onGlobalSprintChanged(isSprinting) {
        this.isSprinting = isSprinting;
    }
    update(dt) {
        if (!this.graphicsEntity || !this.isActive) return;
        // CRITICAL FIX: Don't animate if graphics entity is disabled (weapon not active)
        // This prevents trying to animate weapons that are switched out
        if (!this.graphicsEntity.enabled) {
            if (this.debugMode) {
                Logger.debug('[WeaponMover] Skipping update - graphics entity disabled for', this.entity.name);
            }
            return;
        }
        // CRITICAL FIX: Read CURRENT position/rotation instead of using cached original
        // This allows weaponAnimator to control the base position while we add small offsets
        const currentPos = this.graphicsEntity.getLocalPosition().clone();
        const currentRot = this.graphicsEntity.getLocalEulerAngles().clone();
        // Calculate NEW offset values (don't accumulate with old ones)
        let newPosOffset = new Vec3(0, 0, 0);
        let newRotOffset = new Vec3(0, 0, 0);
        // Apply breathing when idle
        if (this.breathingEnabled && !this.isMoving) {
            this.breathingTime += dt * this.breathingSpeed;
            // Gentle vertical breathing - REDUCED to minimal offset
            newPosOffset.y = Math.sin(this.breathingTime) * this.breathingIntensity * 0.5;
            // Slight rotation for natural feel
            newRotOffset.x = Math.sin(this.breathingTime * 0.7) * this.breathingIntensity * 25;
            newRotOffset.z = Math.cos(this.breathingTime * 0.5) * this.breathingIntensity * 15;
        }
        // Apply bobbing when moving
        if (this.bobbingEnabled && this.isMoving) {
            this.bobbingTime += dt * this.bobbingSpeed;
            let intensity = this.bobbingIntensity;
            if (this.isSprinting) {
                intensity *= aiConfig.weaponEffects.SPRINT_INTENSITY_MULTIPLIER;
                this.bobbingTime += dt * this.bobbingSpeed * (aiConfig.weaponEffects.SPRINT_SPEED_MULTIPLIER - 1.0);
            }
            // Figure-8 motion - REDUCED intensity to avoid conflicts
            newPosOffset.x = Math.sin(this.bobbingTime) * intensity * 0.5;
            newPosOffset.y = Math.abs(Math.sin(this.bobbingTime * 2)) * intensity * 0.25;
            // Rotation bobbing
            newRotOffset.x = Math.sin(this.bobbingTime * 1.3) * intensity * 50;
            newRotOffset.y = Math.cos(this.bobbingTime * 0.8) * intensity * 40;
            newRotOffset.z = Math.sin(this.bobbingTime * 1.1) * intensity * 15;
        }
        // Remove old offsets
        currentPos.sub(this.currentPosOffset);
        currentRot.sub(this.currentRotOffset);
        // Apply new offsets
        currentPos.add(newPosOffset);
        currentRot.add(newRotOffset);
        // Store new offsets for next frame
        this.currentPosOffset.copy(newPosOffset);
        this.currentRotOffset.copy(newRotOffset);
        // Apply final transform
        this.graphicsEntity.setLocalPosition(currentPos);
        this.graphicsEntity.setLocalEulerAngles(currentRot);
    }
    setActive(active) {
        this.isActive = active;
        if (this.debugMode) {
            Logger.debug('[WeaponMover] setActive:', active);
        }
    }
    setMoving(moving) {
        this.isMoving = moving;
    }
    setSprinting(sprinting) {
        this.isSprinting = sprinting;
    }
    resetPosition() {
        this.breathingTime = 0;
        this.bobbingTime = 0;
        this.currentPosOffset.set(0, 0, 0);
        this.currentRotOffset.set(0, 0, 0);
    }
    updateOriginalPosition() {
        if (this.graphicsEntity) {
            this.originalTransform = storeOriginalTransform(this.graphicsEntity);
        }
    }
    destroy() {
        if (this.playerEntity) {
            this.playerEntity.off('character:startedMoving', this.onStartedMoving, this);
            this.playerEntity.off('character:stoppedMoving', this.onStoppedMoving, this);
            this.playerEntity.off('character:sprintChanged', this.onSprintChanged, this);
        }
        this.app.off('character:startedMoving', this.onGlobalStartedMoving, this);
        this.app.off('character:stoppedMoving', this.onGlobalStoppedMoving, this);
        this.app.off('character:sprintChanged', this.onGlobalSprintChanged, this);
        this.entity.off('enable', this.onWeaponEnabled, this);
        this.entity.off('disable', this.onWeaponDisabled, this);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {pc.Entity} @title Graphics Entity */ _define_property(this, "graphicsEntity", null);
        /** @attribute @type {boolean} @title Enable Breathing @default true */ _define_property(this, "breathingEnabled", true);
        /** @attribute @type {number} @title Breathing Intensity @default 0.002 @range [0, 0.01] */ _define_property(this, "breathingIntensity", aiConfig.weaponEffects.BREATHING_INTENSITY);
        /** @attribute @type {number} @title Breathing Speed @default 1.5 @range [0.5, 5.0] */ _define_property(this, "breathingSpeed", aiConfig.weaponEffects.BREATHING_SPEED);
        /** @attribute @type {boolean} @title Enable Movement Bobbing @default true */ _define_property(this, "bobbingEnabled", true);
        /** @attribute @type {number} @title Bobbing Intensity @default 0.015 @range [0, 0.05] */ _define_property(this, "bobbingIntensity", aiConfig.weaponEffects.BOBBING_INTENSITY);
        /** @attribute @type {number} @title Bobbing Speed @default 8.0 @range [2.0, 20.0] */ _define_property(this, "bobbingSpeed", aiConfig.weaponEffects.BOBBING_SPEED);
        /** @attribute @type {boolean} @title Auto Activate When Weapon Enabled @default true */ _define_property(this, "autoActivate", true);
        /** @attribute @type {boolean} @title Debug Mode @default false */ _define_property(this, "debugMode", false);
    }
}
_define_property(WeaponMover, "scriptName", 'weaponMover');

export { WeaponMover };
