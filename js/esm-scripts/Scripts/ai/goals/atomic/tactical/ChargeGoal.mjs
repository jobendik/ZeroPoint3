import * as YUKA from 'yuka';
import { Logger } from '../../../../core/engine/logger.mjs';

class ChargeGoal extends YUKA.CompositeGoal {
    activate() {
        this.clearSubgoals();
        this.chargeStartTime = performance.now();
        this.lastUpdateTime = 0;
        const agent = this.agent;
        const targetEntity = agent?.targetSystem?.getTargetEntity?.();
        if (!targetEntity) {
            Logger.error('[ChargeGoal] No target entity');
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        // Get target's current position
        this.targetPosition = targetEntity.getPosition().clone();
        Logger.tactic(`[${agent.entity.name}] ⚡ CHARGING at target!`);
        // Start moving toward target
        if (agent.navigation?.moveTo) {
            agent.navigation.moveTo(this.targetPosition, 1.0); // Full speed
        }
        this.status = YUKA.Goal.STATUS.ACTIVE;
    }
    execute() {
        if (!this.active()) return;
        const agent = this.agent;
        const entity = agent?.entity;
        if (!entity) {
            this.status = YUKA.Goal.STATUS.FAILED;
            return;
        }
        const now = performance.now();
        const chargeTime = now - this.chargeStartTime;
        // Stop if target not shootable (lost sight)
        const isTargetShootable = agent?.targetSystem?.isTargetVisible?.() || false;
        if (!isTargetShootable) {
            Logger.tactic(`[${entity.name}] Lost sight during charge, stopping`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
            return;
        }
        // Update path periodically (target is moving)
        if (now - this.lastUpdateTime > this.updateInterval) {
            const targetEntity = agent?.targetSystem?.getTargetEntity?.();
            if (targetEntity) {
                this.targetPosition = targetEntity.getPosition().clone();
                if (agent.navigation?.moveTo) {
                    agent.navigation.moveTo(this.targetPosition, 1.0);
                }
            }
            this.lastUpdateTime = now;
        }
        // Check if we're close enough or timeout
        const currentPos = entity.getPosition();
        const distance = currentPos.distance(this.targetPosition);
        if (distance < 3.0) {
            // Close enough - charge complete
            Logger.tactic(`[${entity.name}] ✅ Charge complete (${distance.toFixed(1)}m)`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
        } else if (chargeTime > this.maxChargeTime) {
            // Timeout
            Logger.tactic(`[${entity.name}] ⏱️ Charge timeout`);
            this.status = YUKA.Goal.STATUS.COMPLETED;
        }
    }
    terminate() {
        // Don't stop movement - let AI continue engaging
        this.clearSubgoals();
    }
    /**
     * @param {Object} owner - YUKA vehicle owner
     * @param {Object} agent - PlayCanvas agent script
     */ constructor(owner, agent = null){
        super(owner);
        this.agent = agent || owner.agent || owner;
        this.targetPosition = null;
        this.chargeStartTime = 0;
        this.maxChargeTime = 5000; // 5 seconds max
        this.lastUpdateTime = 0;
        this.updateInterval = 500; // Update path every 500ms
    }
}

export { ChargeGoal };
