import { Script, Color, Vec3, math } from '../../../../playcanvas-stable.min.mjs';

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
 * AIVisionDebug - COORDINATE FIX APPLIED
 * 
 * Forward vector is INVERTED to account for 180° model rotation
 */ class AiVisionDebug extends Script {
    initialize() {
        this.agent = this.entity.script.aiAgent;
        if (!this.agent) {
            console.error('[VisionDebug] No aiAgent script found on entity');
            return;
        }
        this.lastLogTime = 0;
        this.frameCount = 0;
        this.colors = {
            visionCone: new Color(0, 1, 0, 0.5),
            raycastBlocked: new Color(1, 0, 0, 1),
            raycastClear: new Color(0, 1, 0, 1),
            forwardVector: new Color(0, 0, 1, 1),
            targetMarker: new Color(1, 1, 0, 1),
            eyePosition: new Color(1, 0, 1, 1)
        };
        console.log('='.repeat(80));
        console.log('[VisionDebug] INITIALIZED - FORWARD VECTOR INVERTED');
        console.log(`Agent: ${this.entity.name}`);
        console.log(`Vision Range: ${this.agent.visionRange}m`);
        console.log(`Vision Angle: ${this.agent.visionAngle}°`);
        console.log('='.repeat(80));
    }
    /**
     * ✅ CRITICAL FIX: Get corrected forward vector
     * Mixamo model faces backward, so we invert entity.forward
     */ getCorrectedForward() {
        const rawForward = this.entity.forward.clone();
        // Invert to get actual facing direction
        return rawForward.scale(-1);
    }
    update(dt) {
        if (!this.agent || !this.agent.visionSystem) return;
        this.frameCount++;
        if (this.enableDebugDraw) {
            this.drawDebugVisuals();
        }
        if (this.enableConsoleLog) {
            const now = performance.now() / 1000;
            if (now - this.lastLogTime >= this.logInterval) {
                this.logDebugInfo();
                this.lastLogTime = now;
            }
        }
    }
    drawDebugVisuals() {
        const visionSys = this.agent.visionSystem;
        if (!visionSys) return;
        const agentPos = this.entity.getPosition();
        const eyeHeight = visionSys.getCurrentEyeHeight();
        const eyePos = agentPos.clone();
        eyePos.y += eyeHeight;
        // Eye position marker
        this.app.drawLine(new Vec3(eyePos.x - 0.1, eyePos.y, eyePos.z), new Vec3(eyePos.x + 0.1, eyePos.y, eyePos.z), this.colors.eyePosition);
        this.app.drawLine(new Vec3(eyePos.x, eyePos.y - 0.1, eyePos.z), new Vec3(eyePos.x, eyePos.y + 0.1, eyePos.z), this.colors.eyePosition);
        if (this.drawForwardVector) {
            this.drawForwardVectorDebug(eyePos);
        }
        if (this.drawVisionCone) {
            this.drawVisionConeDebug(eyePos);
        }
        if (this.drawRaycasts) {
            this.drawRaycastDebug(eyePos);
        }
    }
    drawForwardVectorDebug(eyePos) {
        // ✅ USE CORRECTED FORWARD
        const forward = this.getCorrectedForward();
        const forwardEnd = eyePos.clone();
        forwardEnd.add(forward.scale(2));
        this.app.drawLine(eyePos, forwardEnd, this.colors.forwardVector);
        // Arrow head
        const right = new Vec3().cross(forward, Vec3.UP).normalize();
        const arrowSize = 0.2;
        const arrowBack = forwardEnd.clone().sub(forward.clone().scale(arrowSize));
        const arrowLeft = arrowBack.clone().add(right.clone().scale(-arrowSize));
        const arrowRight = arrowBack.clone().add(right.clone().scale(arrowSize));
        this.app.drawLine(forwardEnd, arrowLeft, this.colors.forwardVector);
        this.app.drawLine(forwardEnd, arrowRight, this.colors.forwardVector);
    }
    drawVisionConeDebug(eyePos) {
        const visionRange = this.agent.visionRange;
        const visionAngle = this.agent.visionAngle;
        // ✅ USE CORRECTED FORWARD
        const forward = this.getCorrectedForward();
        const angleRad = visionAngle * math.DEG_TO_RAD;
        // Right boundary
        const rightBoundary = this.rotateVectorAroundY(forward, angleRad);
        const rightEnd = eyePos.clone().add(rightBoundary.scale(visionRange));
        this.app.drawLine(eyePos, rightEnd, this.colors.visionCone);
        // Left boundary
        const leftBoundary = this.rotateVectorAroundY(forward.clone(), -angleRad);
        const leftEnd = eyePos.clone().add(leftBoundary.scale(visionRange));
        this.app.drawLine(eyePos, leftEnd, this.colors.visionCone);
        // Arc at max range
        const arcSteps = 10;
        for(let i = 0; i < arcSteps; i++){
            const angle1 = -angleRad + i / arcSteps * (2 * angleRad);
            const angle2 = -angleRad + (i + 1) / arcSteps * (2 * angleRad);
            const dir1 = this.rotateVectorAroundY(forward.clone(), angle1);
            const dir2 = this.rotateVectorAroundY(forward.clone(), angle2);
            const point1 = eyePos.clone().add(dir1.scale(visionRange));
            const point2 = eyePos.clone().add(dir2.scale(visionRange));
            this.app.drawLine(point1, point2, this.colors.visionCone);
        }
        // Center line
        const centerEnd = eyePos.clone().add(forward.scale(visionRange));
        this.app.drawLine(eyePos, centerEnd, new Color(0, 0.5, 0, 0.8));
    }
    drawRaycastDebug(eyePos) {
        const visionSys = this.agent.visionSystem;
        const targets = visionSys.getRememberedTargets();
        for (const record of targets){
            if (!record.entity || !record.entity.entity) continue;
            const targetEntity = record.entity.entity;
            if (!targetEntity.getPosition) continue;
            const targetPos = targetEntity.getPosition();
            const result = this.app.systems.rigidbody.raycastFirst(eyePos, targetPos);
            const isBlocked = result && result.entity !== targetEntity;
            const color = isBlocked ? this.colors.raycastBlocked : this.colors.raycastClear;
            this.app.drawLine(eyePos, targetPos, color);
            if (isBlocked && result.point) {
                const hitSize = 0.15;
                this.app.drawLine(new Vec3(result.point.x - hitSize, result.point.y, result.point.z), new Vec3(result.point.x + hitSize, result.point.y, result.point.z), this.colors.raycastBlocked);
                this.app.drawLine(new Vec3(result.point.x, result.point.y - hitSize, result.point.z), new Vec3(result.point.x, result.point.y + hitSize, result.point.z), this.colors.raycastBlocked);
            }
            const markerSize = 0.2;
            this.app.drawLine(new Vec3(targetPos.x - markerSize, targetPos.y, targetPos.z), new Vec3(targetPos.x + markerSize, targetPos.y, targetPos.z), this.colors.targetMarker);
            this.app.drawLine(new Vec3(targetPos.x, targetPos.y - markerSize, targetPos.z), new Vec3(targetPos.x, targetPos.y + markerSize, targetPos.z), this.colors.targetMarker);
        }
    }
    rotateVectorAroundY(vec, angleRad) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        return new Vec3(vec.x * cos - vec.z * sin, vec.y, vec.x * sin + vec.z * cos);
    }
    logDebugInfo() {
        const visionSys = this.agent.visionSystem;
        if (!visionSys) return;
        const agentPos = this.entity.getPosition();
        const agentRot = this.entity.getEulerAngles();
        // ✅ USE CORRECTED FORWARD
        const rawForward = this.entity.forward;
        const correctedForward = this.getCorrectedForward();
        const status = visionSys.getVisionStatus();
        const visibleTargets = visionSys.getVisibleTargets();
        const rememberedTargets = visionSys.getRememberedTargets();
        console.log('\n' + '='.repeat(80));
        console.log(`[VisionDebug] Frame ${this.frameCount} - ${this.entity.name}`);
        console.log('='.repeat(80));
        console.log('\n📍 AGENT POSITION & ROTATION:');
        console.log(`  Position: (${agentPos.x.toFixed(2)}, ${agentPos.y.toFixed(2)}, ${agentPos.z.toFixed(2)})`);
        console.log(`  Rotation: (${agentRot.x.toFixed(1)}°, ${agentRot.y.toFixed(1)}°, ${agentRot.z.toFixed(1)}°)`);
        console.log(`  Raw Forward (entity.forward): (${rawForward.x.toFixed(3)}, ${rawForward.y.toFixed(3)}, ${rawForward.z.toFixed(3)})`);
        console.log(`  ✅ CORRECTED Forward (inverted): (${correctedForward.x.toFixed(3)}, ${correctedForward.y.toFixed(3)}, ${correctedForward.z.toFixed(3)})`);
        console.log(`  Eye Height: ${status.eyeHeight.toFixed(2)}m`);
        console.log('\n🎯 COORDINATE SYSTEM INFO:');
        console.log(`  Mixamo model faces +Z (backward in PlayCanvas)`);
        console.log(`  180° rotation applied: ${!!this.agent.__rotationCorrectionApplied}`);
        console.log(`  ✅ Forward vector INVERTED for correct direction`);
        console.log('\n👁️ VISION CONFIGURATION:');
        console.log(`  Range: ${status.range.toFixed(1)}m`);
        console.log(`  FOV: ${this.agent.visionAngle.toFixed(1)}° (half-angle from forward)`);
        console.log(`  Full FOV: ${(this.agent.visionAngle * 2).toFixed(1)}° (total cone width)`);
        console.log('\n💾 MEMORY & TRACKING:');
        console.log(`  Visible Targets: ${status.visible}`);
        console.log(`  Remembered Targets: ${status.remembered}`);
        console.log(`  Last Known Positions: ${status.lastKnownPositions}`);
        if (visibleTargets.length > 0) {
            console.log('\n🎯 VISIBLE TARGETS:');
            for (const record of visibleTargets){
                if (!record.entity || !record.entity.entity) continue;
                const targetEntity = record.entity.entity;
                const targetPos = targetEntity.getPosition ? targetEntity.getPosition() : null;
                if (!targetPos) continue;
                const distance = agentPos.distance(targetPos);
                const toTarget = new Vec3().sub2(targetPos, agentPos).normalize();
                // ✅ USE CORRECTED FORWARD
                const angle = Math.acos(Math.max(-1, Math.min(1, correctedForward.dot(toTarget)))) * math.RAD_TO_DEG;
                console.log(`  - ${targetEntity.name || 'Unknown'}:`);
                console.log(`      Distance: ${distance.toFixed(2)}m`);
                console.log(`      Angle from CORRECTED forward: ${angle.toFixed(1)}°`);
                console.log(`      Position: (${targetPos.x.toFixed(2)}, ${targetPos.y.toFixed(2)}, ${targetPos.z.toFixed(2)})`);
                console.log(`      In FOV: ${angle <= this.agent.visionAngle ? 'YES ✅' : 'NO ❌'}`);
                const eyePos = agentPos.clone();
                eyePos.y += status.eyeHeight;
                const result = this.app.systems.rigidbody.raycastFirst(eyePos, targetPos);
                const hasLOS = !result || result.entity === targetEntity;
                console.log(`      Line of Sight: ${hasLOS ? 'CLEAR ✅' : 'BLOCKED ❌'}`);
                if (!hasLOS && result) {
                    console.log(`      Blocked by: ${result.entity.name || 'Unknown'}`);
                }
            }
        }
        const notVisibleTargets = rememberedTargets.filter((r)=>!r.visible);
        if (notVisibleTargets.length > 0) {
            console.log('\n👻 REMEMBERED (NOT VISIBLE):');
            for (const record of notVisibleTargets){
                if (!record.entity || !record.entity.entity) continue;
                const targetEntity = record.entity.entity;
                const lastPos = record.lastSensedPosition;
                console.log(`  - ${targetEntity.name || 'Unknown'}:`);
                console.log(`      Last Position: (${lastPos.x.toFixed(2)}, ${lastPos.y.toFixed(2)}, ${lastPos.z.toFixed(2)})`);
                console.log(`      Time Since Seen: ${((this.agent.currentTime || 0) - record.timeLastSensed).toFixed(1)}s`);
            }
        }
        console.log('\n' + '='.repeat(80) + '\n');
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Enable Debug Draw */ _define_property(this, "enableDebugDraw", true);
        /** @attribute @type {boolean} @title Enable Console Logging */ _define_property(this, "enableConsoleLog", true);
        /** @attribute @type {number} @title Log Interval (seconds) */ _define_property(this, "logInterval", 1.0);
        /** @attribute @type {boolean} @title Draw Vision Cone */ _define_property(this, "drawVisionCone", true);
        /** @attribute @type {boolean} @title Draw Raycasts */ _define_property(this, "drawRaycasts", true);
        /** @attribute @type {boolean} @title Draw Forward Vector */ _define_property(this, "drawForwardVector", true);
    }
}
_define_property(AiVisionDebug, "scriptName", 'aiVisionDebug');

export { AiVisionDebug };
