import { Script } from '../../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';

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
 * Left Hand Follower - Handles left hand IK following for weapon attachment
 * Converted from classic script to ESM format
 */ class LeftHandFollower extends Script {
    update(dt) {
        if (!this.leftHandAttach) return;
        // Follow pos/rot (world space) with smoothing
        const t = Math.min(1, this.followLerp * dt);
        // Position
        const currentPos = this.entity.getPosition().clone();
        const targetPos = this.leftHandAttach.getPosition();
        currentPos.lerp(currentPos, targetPos, t);
        this.entity.setPosition(currentPos);
        // Rotation
        const currentRot = this.entity.getRotation().clone();
        const targetRot = this.leftHandAttach.getRotation();
        currentRot.slerp(currentRot, targetRot, t);
        this.entity.setRotation(currentRot);
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {pc.Entity} @title LeftHand Attach (on weapon) @description Empty node from the weapon model */ _define_property(this, "leftHandAttach", null);
        /** @attribute @type {number} @title Follow Lerp @default 12 @description Optional smoothing factor */ _define_property(this, "followLerp", aiConfig.weaponEffects.LEFT_HAND_FOLLOW_LERP);
    }
}
_define_property(LeftHandFollower, "scriptName", 'leftHandFollower');

export { LeftHandFollower };
