import { Vec3 } from '../../../../playcanvas-stable.min.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Step Offset System
 * Allows character to smoothly climb stairs and small obstacles
 */ const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
class StepOffset {
    /**
     * Check and handle step climbing
     * @param {Vec3} moveDirection - Normalized horizontal movement direction
     * @param {boolean} isGrounded - Whether character is currently grounded
     * @returns {boolean} - True if step was detected and handled
     */ handleStep(moveDirection, isGrounded) {
        if (!isGrounded || moveDirection.length() < 0.01) {
            return false;
        }
        const pos = this.rigidbody.entity.getPosition();
        const velocity = this.rigidbody.linearVelocity;
        // Only check if moving horizontally but velocity is low (indicating collision)
        const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        if (horizontalSpeed > 1.0) {
            return false; // Already moving fine
        }
        // Get capsule dimensions
        const collision = this.rigidbody.entity.collision;
        const capsuleHeight = collision?.height || 2.0;
        const capsuleRadius = collision?.radius || 0.5;
        const halfHeight = capsuleHeight * 0.5;
        // Step 1: Check if there's a wall/obstacle in front at ground level
        const forwardStart = tmpV1.copy(pos);
        forwardStart.y -= halfHeight - capsuleRadius - 0.1; // Just above feet
        const forwardEnd = tmpV2.copy(forwardStart).add(tmpV3.copy(moveDirection).mulScalar(this.stepCheckDistance));
        const wallHit = this.rigidbody.system.raycastFirst(forwardStart, forwardEnd);
        if (!wallHit) {
            return false; // No obstacle
        }
        // Step 2: Check if there's a walkable surface above the obstacle
        const stepCheckStart = tmpV1.copy(pos);
        stepCheckStart.y -= halfHeight - this.maxStepHeight; // At max step height
        stepCheckStart.add(tmpV3.copy(moveDirection).mulScalar(this.stepCheckDistance));
        const stepCheckEnd = tmpV2.copy(stepCheckStart);
        stepCheckEnd.y -= this.maxStepHeight + 0.2; // Ray down to find step surface
        const stepHit = this.rigidbody.system.raycastFirst(stepCheckStart, stepCheckEnd);
        if (!stepHit) {
            return false; // No step surface found (might be a tall wall)
        }
        // Calculate step height
        const groundY = pos.y - halfHeight;
        const stepY = stepHit.point.y;
        const stepHeight = stepY - groundY;
        // Verify it's a climbable step
        if (stepHeight < this.minStepHeight || stepHeight > this.maxStepHeight) {
            return false;
        }
        // Step 3: Lift the character up by the step height
        const liftAmount = stepHeight + 0.05; // Add small margin to clear step
        const newPos = pos.clone();
        newPos.y += liftAmount;
        this.rigidbody.teleport(newPos);
        // Optional: Apply small forward impulse to help climb
        const forwardBoost = tmpV3.copy(moveDirection).mulScalar(2);
        this.rigidbody.applyImpulse(forwardBoost.x, 0, forwardBoost.z);
        return true;
    }
    /**
     * @param {import('playcanvas').RigidBodyComponent} rigidbody
     * @param {number} maxStepHeight - Maximum height of step that can be climbed (default: 0.5)
     * @param {number} stepCheckDistance - Forward distance to check for steps (default: 0.6)
     */ constructor(rigidbody, maxStepHeight = 0.5, stepCheckDistance = 0.6){
        this.rigidbody = rigidbody;
        this.maxStepHeight = maxStepHeight;
        this.stepCheckDistance = stepCheckDistance;
        this.minStepHeight = 0.05; // Ignore very small bumps
    }
}

export { StepOffset };
