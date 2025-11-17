import { Vec3, math } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

function getAgentHealthRatio(agent) {
    const healthSystem = agent?.entity?.script?.healthSystem;
    if (!healthSystem) {
        Logger.warn('[AgentUtilities] No health system found for agent, defaulting to full health');
        return 1.0;
    }
    if (typeof healthSystem.getHealthPercent === 'function') {
        return healthSystem.getHealthPercent();
    }
    if (healthSystem.currentHealth !== undefined && healthSystem.maxHealth !== undefined) {
        const ratio = Math.max(0, Math.min(1, healthSystem.currentHealth / Math.max(1, healthSystem.maxHealth)));
        return ratio;
    }
    Logger.warn('[AgentUtilities] Could not determine health ratio, defaulting to full health');
    return 1.0;
}
class AIAgentUtilities {
    /**
     * ✅ CRITICAL FIX: Get corrected forward vector
     * Mixamo model faces backward after 180° rotation, so invert entity.forward
     */ getCorrectedForward() {
        const rawForward = this.agent.entity.forward.clone();
        // Invert to get actual facing direction
        return rawForward.scale(-1);
    }
    // ============================================================================
    // HEALTH AND AMMO UTILITIES
    // ============================================================================
    getClosestHealthItem() {
        if (!this.agent.app.gameManager || !this.agent.app.gameManager.getClosestItem) {
            return null;
        }
        return this.agent.app.gameManager.getClosestItem(this.agent.entity.getPosition(), 'health');
    }
    getClosestAmmoItem(ammoType = 'universal_ammo') {
        if (!this.agent.app.gameManager || !this.agent.app.gameManager.getClosestItem) {
            return null;
        }
        return this.agent.app.gameManager.getClosestItem(this.agent.entity.getPosition(), ammoType);
    }
    hasUsableAmmo() {
        if (!this.agent.weaponSystem || !this.agent.weaponSystem.weapons) {
            return false;
        }
        const ws = this.agent.weaponSystem;
        const currentWeapon = ws.weapons[ws.currentWeapon];
        if (!currentWeapon || !currentWeapon.unlocked) {
            return false;
        }
        const magazineAmmo = ws.currentMagazine || 0;
        const reserveAmmo = currentWeapon.ammo || 0;
        const totalAmmo = magazineAmmo + reserveAmmo;
        return totalAmmo > 0;
    }
    hasAdequateAmmo(threshold = 0.3) {
        if (!this.agent.weaponSystem || !this.agent.weaponSystem.weapons) {
            return false;
        }
        const ws = this.agent.weaponSystem;
        const currentWeaponType = ws.currentWeapon;
        const currentWeapon = ws.weapons[currentWeaponType];
        const maxAmmo = ws.maxAmmo?.[currentWeaponType];
        if (!currentWeapon || !currentWeapon.unlocked || !maxAmmo) {
            return false;
        }
        const magazineAmmo = ws.currentMagazine || 0;
        const reserveAmmo = currentWeapon.ammo || 0;
        const totalAmmo = magazineAmmo + reserveAmmo;
        const ammoRatio = totalAmmo / maxAmmo;
        return ammoRatio >= threshold;
    }
    getHealthRatio() {
        const healthSystem = this.agent.entity?.script?.healthSystem;
        if (!healthSystem) {
            Logger.warn('[AgentUtilities] No health system found for agent, defaulting to full health');
            return 1.0;
        }
        if (typeof healthSystem.getHealthPercent === 'function') {
            return healthSystem.getHealthPercent();
        }
        if (healthSystem.currentHealth !== undefined && healthSystem.maxHealth !== undefined) {
            const ratio = Math.max(0, Math.min(1, healthSystem.currentHealth / Math.max(1, healthSystem.maxHealth)));
            return ratio;
        }
        Logger.warn('[AgentUtilities] Could not determine health ratio, defaulting to full health');
        return 1.0;
    }
    // ============================================================================
    // FOV AND ROTATION UTILITIES - FORWARD VECTOR CORRECTED
    // ============================================================================
    setFrameDt(dt) {
        this._frameDt = dt;
    }
    isTargetInFOV(targetPos) {
        if (!targetPos) return false;
        const agentPos = this.agent.entity.getPosition();
        // ✅ USE CORRECTED FORWARD
        const forwardVec = this.getCorrectedForward();
        const toTarget = new Vec3().sub2(targetPos, agentPos).normalize();
        const dotProduct = forwardVec.dot(toTarget);
        const angleRadians = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        const angleDegrees = angleRadians * (180 / Math.PI);
        const maxFOV = this.agent.visionAngle || 75;
        return angleDegrees <= maxFOV;
    }
    getAngleToTarget(targetPos) {
        if (!targetPos) return 999;
        const agentPos = this.agent.entity.getPosition();
        // ✅ USE CORRECTED FORWARD
        const forwardVec = this.getCorrectedForward();
        const toTarget = new Vec3().sub2(targetPos, agentPos).normalize();
        const dotProduct = forwardVec.dot(toTarget);
        const angleRadians = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        const angleDegrees = angleRadians * (180 / Math.PI);
        return angleDegrees;
    }
    /**
     * ✅ DISABLED: Rotation handled by AgentNavigationAdapter
     */ rotateTowardTarget(targetPos, dt, maxRotationSpeedDeg = 120) {
        if (!targetPos || !this.agent?.entity) return false;
        const entity = this.agent.entity;
        const agentPos = entity.getPosition();
        const toTarget = new Vec3().sub2(targetPos, agentPos);
        toTarget.y = 0;
        const len = toTarget.length();
        if (len < 0.001) return true;
        toTarget.scale(1 / len);
        // ✅ USE CORRECTED FORWARD
        const fwd = this.getCorrectedForward();
        const currentYaw = fwd.length() > 0.0001 ? Math.atan2(fwd.x, fwd.z) : entity.getEulerAngles().y * math.DEG_TO_RAD;
        const targetYaw = Math.atan2(toTarget.x, toTarget.z);
        let deltaYaw = targetYaw - currentYaw;
        deltaYaw = (deltaYaw + Math.PI) % (Math.PI * 2) - Math.PI;
        const remainingDeg = Math.abs(deltaYaw) * math.RAD_TO_DEG;
        return remainingDeg < (aiConfig.rotation?.facingThreshold || 5);
    }
    shouldRotateTowardTarget() {
        if (!this.agent.targetSystem?.hasTarget()) return false;
        const targetPos = this.agent.targetSystem.getTargetPosition();
        if (!targetPos) return false;
        return !this.isTargetInFOV(targetPos);
    }
    // [Rest of the methods remain unchanged - they don't use forward vector]
    hasVisibleThreat() {
        if (!this.agent.visionSystem) return false;
        const visibleTargets = this.agent.visionSystem.getVisibleTargets();
        return visibleTargets && visibleTargets.length > 0;
    }
    getThreatLevel() {
        if (!this.hasVisibleThreat()) return 0;
        const healthRatio = this.getHealthRatio();
        const hasAmmo = this.hasUsableAmmo();
        let threatLevel = 0.5;
        if (healthRatio < 0.3) threatLevel += 0.3;
        if (!hasAmmo) threatLevel += 0.2;
        return Math.min(1.0, threatLevel);
    }
    canEngageTarget() {
        if (!this.hasVisibleThreat()) return false;
        const hasAmmo = this.hasUsableAmmo();
        const healthRatio = this.getHealthRatio();
        const canFight = healthRatio > 0.15 && hasAmmo;
        const threatLevel = this.getThreatLevel();
        const combatEffectiveness = this._calculateCombatEffectiveness();
        return canFight && combatEffectiveness > threatLevel * 0.4;
    }
    _calculateCombatEffectiveness() {
        let effectiveness = aiConfig.utilities.EFFECTIVENESS_DEFAULT;
        const healthRatio = this.getHealthRatio();
        effectiveness += (healthRatio - 0.5) * 0.3;
        if (this.hasAdequateAmmo()) effectiveness += 0.2;
        else if (this.hasUsableAmmo()) effectiveness += 0.1;
        else effectiveness -= 0.3;
        effectiveness += (this.agent.alertness - 0.5) * 0.1;
        effectiveness += (this.agent.morale - 0.5) * 0.1;
        return Math.max(0.1, Math.min(1.2, effectiveness));
    }
    isInDanger() {
        const healthRatio = this.getHealthRatio();
        const hasThreat = this.hasVisibleThreat();
        const hasAmmo = this.hasUsableAmmo();
        const threatLevel = this.getThreatLevel();
        if (healthRatio < 0.3) return true;
        if (hasThreat && (!hasAmmo || healthRatio < 0.5)) return true;
        if (threatLevel > 0.8 && healthRatio < 0.7) return true;
        return false;
    }
    shouldSeekCover() {
        return this.isInDanger() && this.hasVisibleThreat() && this.getHealthRatio() < 0.6;
    }
    shouldFlee() {
        const healthRatio = this.getHealthRatio();
        const hasThreat = this.hasVisibleThreat();
        const hasAmmo = this.hasUsableAmmo();
        const threatLevel = this.getThreatLevel();
        if (healthRatio < 0.15) return true;
        if (hasThreat && !hasAmmo && healthRatio < 0.4) return true;
        if (threatLevel > 1.0 && healthRatio < 0.5) return true;
        if (this.agent.morale < 0.2 && hasThreat) return true;
        return false;
    }
    getAgentStatus() {
        let strategicPositionCount = 0;
        let totalStrategicValue = 0;
        for (const [key, visitData] of this.visitedPositions){
            if (visitData.strategicValue > 0.3) {
                strategicPositionCount++;
                totalStrategicValue += visitData.strategicValue;
            }
        }
        const avgStrategicValue = strategicPositionCount > 0 ? (totalStrategicValue / strategicPositionCount).toFixed(2) : '0.00';
        return {
            health: `${this.agent.health}/${this.agent.maxHealth}`,
            healthRatio: this.getHealthRatio().toFixed(2),
            hasAmmo: this.hasUsableAmmo(),
            hasTarget: this.agent.targetSystem?.hasTarget() || false,
            visibleThreat: this.hasVisibleThreat(),
            threatLevel: this.getThreatLevel().toFixed(2),
            canEngage: this.canEngageTarget(),
            isInDanger: this.isInDanger(),
            consecutiveFailures: this.consecutiveFailures,
            backoffMs: this.failureBackoffMs,
            visitedPositions: this.visitedPositions.size,
            strategicPositions: strategicPositionCount,
            avgStrategicValue: avgStrategicValue,
            explorationTargets: this.explorationTargets.length,
            gridSize: this.explorationGridSize
        };
    }
    destroy() {
        this.visitedPositions.clear();
        this.explorationTargets = [];
        this.navValidationCache.clear();
    }
    constructor(agent){
        this.agent = agent;
        this._frameDt = null;
        this.explorationTargets = [];
        this.visitedPositions = new Map();
        this.explorationRadius = aiConfig.utilities.EXPLORATION_RADIUS;
        this.minExplorationDistance = 8;
        this.maxExplorationDistance = aiConfig.utilities.MAX_EXPLORATION_DISTANCE;
        this.explorationMemoryDuration = aiConfig.exploration?.memoryDuration || 90000;
        this.explorationAttempts = 0;
        this.maxExplorationAttempts = aiConfig.utilities.MAX_EXPLORATION_ATTEMPTS;
        this.explorationGridSize = aiConfig.exploration?.gridSize || 3.0;
        this.strategicPositionThresholds = {
            highGround: aiConfig.exploration?.strategic?.highGroundThreshold || 2.0,
            coverProximity: aiConfig.exploration?.strategic?.coverProximityThreshold || 5.0,
            chokePoint: aiConfig.exploration?.strategic?.chokePointRadius || 8.0,
            minValue: aiConfig.exploration?.strategic?.minStrategicValue || 0.3
        };
        this.temporalDecayEnabled = aiConfig.exploration?.temporalDecayEnabled !== false;
        this.strategicRevisitMultiplier = aiConfig.exploration?.strategicRevisitMultiplier || 2.5;
        this.positionSearchConfig = {
            maxAttempts: aiConfig.utilities.MAX_TOTAL_ATTEMPTS,
            searchRadii: [
                1,
                2,
                3,
                5,
                8,
                12,
                18,
                25,
                aiConfig.utilities.EXPLORATION_RADIUS
            ],
            angleSteps: aiConfig.utilities.ANGULAR_STEPS,
            heightTolerance: 3.0,
            retryWithBroaderSearch: true
        };
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        this.failureBackoffMs = 0;
        this.maxBackoffMs = aiConfig.utilities.MAX_BACKOFF_MS;
        this.navValidationCache = new Map();
        this.validationCacheTimeout = aiConfig.utilities.VALIDATION_CACHE_TIMEOUT;
        this.maxCacheSize = aiConfig.utilities.MAX_CACHE_SIZE;
        Logger.debug(`[${this.agent.entity.name}] Utilities initialized with FORWARD VECTOR CORRECTION`);
    }
}

export { AIAgentUtilities as default, getAgentHealthRatio };
