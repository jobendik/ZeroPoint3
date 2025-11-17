import { Script } from '../../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';
import { Logger } from '../../../engine/logger.mjs';

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
 * MuzzleFlash - Weapon muzzle flash effect with particles, light flash, and camera shake
 * 
 * FIXED: Particle systems now properly stop before resetting and replaying.
 * This ensures the muzzle flash appears on EVERY shot, not just the first one.
 */ class MuzzleFlash extends Script {
    initialize() {
        // Find child components
        this.light = this.entity.findByName("PointLight");
        this.smokeVfx = this.entity.findByName("ExplosionSmoke");
        this.debrisVfx = this.entity.findByName("ExplosionDebris");
        // Check for main particle system on this entity
        this.mainVfx = this.entity.particlesystem;
        // Track light flash timing
        this.timeSinceFlash = 0;
        this.isFlashing = false;
        // Camera shake state
        this.camera = null;
        this.cameraOriginalPos = null;
        this.shakeTimeRemaining = 0;
        // Initially disable light
        if (this.light && this.light.light) {
            this.light.light.enabled = false;
        }
        // Find camera (traverse up to find it)
        this._findCamera();
        // Listen for weapon fire events
        this.app.on("weapon:fire", this.flash, this);
        this.entity.on("weapon:fire", this.flash, this);
        this.entity.on("muzzle:flash", this.flash, this);
        Logger.debug(`MuzzleFlash initialized on ${this.entity.name}`);
        this._logSetup();
    }
    _findCamera() {
        // Search upward in hierarchy for camera
        let current = this.entity;
        while(current){
            if (current.camera) {
                this.camera = current;
                Logger.debug(`  - Camera found: ${this.camera.name}`);
                return;
            }
            current = current.parent;
        }
        // Fallback: find by tag or name
        const cameras = this.app.root.findByTag('camera');
        if (cameras && cameras.length > 0) {
            this.camera = cameras[0];
            Logger.debug(`  - Camera found by tag: ${this.camera.name}`);
        } else {
            const cam = this.app.root.findByName('Camera');
            if (cam) {
                this.camera = cam;
                Logger.debug(`  - Camera found by name: ${this.camera.name}`);
            }
        }
    }
    _logSetup() {
        Logger.debug('  - Light:', this.light ? '✓' : '✗');
        Logger.debug('  - Smoke VFX:', this.smokeVfx ? '✓' : '✗');
        Logger.debug('  - Debris VFX:', this.debrisVfx ? '✓' : '✗');
        Logger.debug('  - Main VFX:', this.mainVfx ? '✓' : '✗');
    }
    update(dt) {
        // Handle light flash
        if (this.isFlashing) {
            this.timeSinceFlash += dt;
            // Auto-disable light after flash duration
            if (this.timeSinceFlash > this.lightFlashDuration && this.light && this.light.light) {
                this.light.light.enabled = false;
                this.isFlashing = false;
            }
        }
        // Handle camera shake
        if (this.shakeTimeRemaining > 0 && this.camera) {
            this.shakeTimeRemaining -= dt;
            if (this.shakeTimeRemaining > 0) {
                // Apply random shake offset
                const shakeProgress = this.shakeTimeRemaining / this.shakeDuration;
                const currentShakeAmount = this.shakeAmount * shakeProgress;
                const offsetX = (Math.random() - 0.5) * currentShakeAmount * 2;
                const offsetY = (Math.random() - 0.5) * currentShakeAmount * 2;
                const offsetZ = (Math.random() - 0.5) * currentShakeAmount * 2;
                this.camera.setLocalPosition(this.cameraOriginalPos.x + offsetX, this.cameraOriginalPos.y + offsetY, this.cameraOriginalPos.z + offsetZ);
            } else {
                // Shake finished - restore original position
                if (this.cameraOriginalPos) {
                    this.camera.setLocalPosition(this.cameraOriginalPos);
                    this.cameraOriginalPos = null;
                }
            }
        }
    }
    /**
     * Trigger the muzzle flash effect
     * FIXED: Now properly stops particles before replaying
     */ flash() {
        this.timeSinceFlash = 0;
        this.isFlashing = true;
        // Enable and flash the light
        if (this.light && this.light.light) {
            this.light.light.enabled = true;
            this.light.light.intensity = this.lightIntensity;
        }
        // Play main particle system if exists
        // CRITICAL FIX: Stop before resetting to ensure it can replay
        if (this.mainVfx) {
            if (this.mainVfx.isPlaying) {
                this.mainVfx.stop();
            }
            this.mainVfx.reset();
            this.mainVfx.play();
        }
        // Play smoke VFX
        // CRITICAL FIX: Stop before resetting to ensure it can replay
        if (this.smokeVfx && this.smokeVfx.particlesystem) {
            if (this.smokeVfx.particlesystem.isPlaying) {
                this.smokeVfx.particlesystem.stop();
            }
            this.smokeVfx.particlesystem.reset();
            this.smokeVfx.particlesystem.play();
        }
        // Play debris VFX
        // CRITICAL FIX: Stop before resetting to ensure it can replay
        if (this.debrisVfx && this.debrisVfx.particlesystem) {
            if (this.debrisVfx.particlesystem.isPlaying) {
                this.debrisVfx.particlesystem.stop();
            }
            this.debrisVfx.particlesystem.reset();
            this.debrisVfx.particlesystem.play();
        }
        // Trigger camera shake
        if (this.enableCameraShake && this.camera) {
            this.cameraOriginalPos = this.camera.getLocalPosition().clone();
            this.shakeTimeRemaining = this.shakeDuration;
        }
    }
    destroy() {
        this.app.off("weapon:fire", this.flash, this);
        this.entity.off("weapon:fire", this.flash, this);
        this.entity.off("muzzle:flash", this.flash, this);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @title Light Flash Duration @default 0.05 */ _define_property(this, "lightFlashDuration", aiConfig.weaponEffects.MUZZLE_FLASH_DURATION);
        /** @attribute @type {number} @title Light Intensity @default 3.0 */ _define_property(this, "lightIntensity", aiConfig.weaponEffects.MUZZLE_FLASH_INTENSITY);
        /** @attribute @type {boolean} @title Enable Camera Shake @default true */ _define_property(this, "enableCameraShake", true);
        /** @attribute @type {number} @title Camera Shake Amount @default 0.05 @range [0.01, 0.3] */ _define_property(this, "shakeAmount", aiConfig.weaponEffects.CAMERA_SHAKE_AMOUNT);
        /** @attribute @type {number} @title Camera Shake Duration @default 0.1 @range [0.05, 0.5] */ _define_property(this, "shakeDuration", aiConfig.weaponEffects.CAMERA_SHAKE_DURATION);
    }
}
_define_property(MuzzleFlash, "scriptName", 'muzzleFlash');

export { MuzzleFlash };
