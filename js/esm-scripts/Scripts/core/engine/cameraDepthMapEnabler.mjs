import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from './logger.mjs';

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
 * CameraDepthMapEnabler - Enables scene depth map on camera for effects
 * 
 * This script fixes the error:
 * "A uSceneDepthMap texture is used by the shader but a scene depth texture is not available"
 * 
 * Required for:
 * - Soft particles (MuzzleFlash, ExplosionDebris)
 * - Depth-based effects
 * - Post-processing effects that need depth
 * 
 * Usage:
 * 1. Attach this script to your main Camera entity
 * 2. The script will automatically enable scene depth mapping
 * 3. All materials using uSceneDepthMap will now work correctly
 */ class CameraDepthMapEnabler extends Script {
    initialize() {
        if (!this.entity.camera) {
            Logger.error('[CameraDepthMapEnabler] This script must be attached to an entity with a camera component.');
            return;
        }
        if (this.autoEnable) {
            this.enableDepthMap();
        }
    }
    /**
     * Enable scene depth map on this camera
     */ enableDepthMap() {
        const camera = this.entity.camera;
        if (!camera) {
            Logger.error('[CameraDepthMapEnabler] No camera component found.');
            return false;
        }
        // Enable scene depth map
        camera.requestSceneDepthMap(true);
        if (this.logStatus) {
            Logger.debug(`[CameraDepthMapEnabler] Scene depth map enabled on camera: ${this.entity.name}`);
            Logger.debug('  - Depth map enabled:', camera.depthMapEnabled || 'unknown');
            Logger.debug('  - This fixes: "uSceneDepthMap texture is not available" errors');
            Logger.debug('  - Enables: Soft particles, depth-based effects, post-processing');
        }
        return true;
    }
    /**
     * Disable scene depth map on this camera
     */ disableDepthMap() {
        const camera = this.entity.camera;
        if (!camera) {
            Logger.error('[CameraDepthMapEnabler] No camera component found');
            return false;
        }
        // Disable scene depth map
        camera.requestSceneDepthMap(false);
        if (this.logStatus) {
            Logger.debug(`[CameraDepthMapEnabler] Scene depth map disabled on camera: ${this.entity.name}`);
        }
        return true;
    }
    /**
     * Check if depth map is enabled
     */ isDepthMapEnabled() {
        const camera = this.entity.camera;
        return camera && camera.depthMapEnabled === true;
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Auto Enable @default true @description Automatically enable depth map on initialize */ _define_property(this, "autoEnable", true);
        /** @attribute @type {boolean} @title Log Status @default true @description Log depth map status to console */ _define_property(this, "logStatus", true);
    }
}
_define_property(CameraDepthMapEnabler, "scriptName", 'cameraDepthMapEnabler');

export { CameraDepthMapEnabler };
