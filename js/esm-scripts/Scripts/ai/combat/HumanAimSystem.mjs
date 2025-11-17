import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

class HumanAimSystem {
    // ============================================================================
    // MAIN UPDATE - Called every frame during combat
    // ============================================================================
    update(dt, context) {
        const inCombat = context?.inCombat || false;
        const hasTarget = context?.hasTarget || false;
        // Update warmup
        if (hasTarget && this.isAiming) {
            this._updateAimWarmup(dt, context);
        } else {
            this._cooldownAimWarmup(dt);
        }
        // Update stress (decays over time)
        this._updateStress(dt);
        // Update fatigue
        if (inCombat) {
            this._accumulateFatigue(dt);
        } else {
            this._recoverFromFatigue(dt);
        }
        // Update recoil (decays over time)
        this._updateRecoil(dt);
        // Update spray pattern
        this._updateSprayPattern(dt);
        // Update flick recovery
        this._updateFlickRecovery(dt);
    }
    // ============================================================================
    // AIM CALCULATION - Main entry point for getting aim position
    // ============================================================================
    /**
     * Calculate human-like aim point with all imperfections
     * @param {Vec3} targetPosition - Target's actual position
     * @param {Entity} targetEntity - Target entity (for tracking)
     * @param {number} deltaTime - Frame delta time
     * @returns {Vec3} - Calculated aim point with human errors
     */ calculateAimPoint(targetPosition, targetEntity, deltaTime) {
        if (!targetPosition) {
            Logger.warn(`[${this.entity.name}] calculateAimPoint called with null target`);
            return this.entity.getPosition();
        }
        // Start aiming (begins warmup)
        this.startAiming(targetEntity);
        // 1. Calculate base aim point
        let aimPoint = targetPosition.clone();
        // 2. Apply tracking error (lag behind moving targets)
        aimPoint = this._applyTrackingError(aimPoint, targetEntity, deltaTime);
        // 3. Calculate total error radius
        const totalError = this._calculateTotalError();
        // 4. Apply spread/error
        aimPoint = this._applySpreadError(aimPoint, totalError);
        // 5. Apply recoil offset
        aimPoint = this._applyRecoilOffset(aimPoint);
        // 6. Apply spray compensation (vertical control)
        aimPoint = this._applySprayCompensation(aimPoint);
        // 7. Check for flicks (occasional overcorrection)
        if (this._shouldFlick()) {
            aimPoint = this._applyFlick(aimPoint, targetPosition);
        }
        // 8. Smooth aim transitions (humans don't snap instantly)
        aimPoint = this._smoothAimTransition(aimPoint, deltaTime);
        // Store for next frame
        this.currentAimPoint.copy(aimPoint);
        this.lastTargetPosition = targetPosition.clone();
        // Debug visualization
        if (this.debugEnabled && Math.random() < 0.05) {
            this._logAimDiagnostics(targetPosition, aimPoint, totalError);
        }
        return aimPoint;
    }
    // ============================================================================
    // AIM WARMUP SYSTEM
    // ============================================================================
    startAiming(targetEntity) {
        // Check if target changed (reset warmup)
        if (targetEntity && this.lastTargetEntity !== targetEntity) {
            this.aimWarmup *= 0.4; // Lose 60% of warmup on target switch
            this.lastTargetEntity = targetEntity;
            Logger.aiDetail(`[${this.entity.name}] 🎯 Target switch - warmup reset to ${(this.aimWarmup * 100).toFixed(0)}%`);
        }
        this.isAiming = true;
    }
    stopAiming() {
        this.isAiming = false;
    }
    _updateAimWarmup(dt, context) {
        if (this.aimWarmup >= 1.0) return;
        // Warmup improves over time (reaches 1.0 in ~1.25s)
        const warmupIncrease = dt * this.aimWarmupRate / this.maxWarmupTime;
        // Personality affects warmup speed
        const personality = this.agent.personalitySystem;
        let warmupMultiplier = 1.0;
        if (personality) {
            // Aggressive agents warm up faster, cautious slower
            warmupMultiplier += personality.traits.aggression * 0.3;
            warmupMultiplier -= personality.traits.caution * 0.2;
        }
        this.aimWarmup = Math.min(1.0, this.aimWarmup + warmupIncrease * warmupMultiplier);
    }
    _cooldownAimWarmup(dt) {
        if (this.aimWarmup <= 0) return;
        // Cools down faster than it warms up
        this.aimWarmup = Math.max(0, this.aimWarmup - dt * this.aimCooldownRate);
    }
    // ============================================================================
    // STRESS SYSTEM
    // ============================================================================
    onTakeDamage(damageAmount) {
        // Stress spikes when taking damage
        const stressIncrease = this.stressFromDamage * Math.min(1.0, damageAmount / 20);
        this.stressLevel = Math.min(this.maxStress, this.stressLevel + stressIncrease);
        // Taking damage also breaks aim warmup (flinch)
        this.aimWarmup *= 0.5; // Lose 50% of warmup
        // Add recoil from flinch
        this.recoilAccumulation = Math.min(this.maxRecoil, this.recoilAccumulation + 0.2);
        Logger.aiDetail(`[${this.entity.name}] ⚡ STRESS SPIKE! ${(this.stressLevel * 100).toFixed(0)}% (warmup: ${(this.aimWarmup * 100).toFixed(0)}%)`);
    }
    _updateStress(dt) {
        if (this.stressLevel <= 0) return;
        // Stress decays slowly over time
        this.stressLevel = Math.max(0, this.stressLevel - dt * this.stressDecayRate);
    }
    // ============================================================================
    // FATIGUE SYSTEM
    // ============================================================================
    _accumulateFatigue(dt) {
        if (this.fatigueLevel >= this.maxFatigue) return;
        // Fatigue builds during combat
        this.fatigueLevel = Math.min(this.maxFatigue, this.fatigueLevel + dt * this.fatigueAccumulationRate);
    }
    _recoverFromFatigue(dt) {
        if (this.fatigueLevel <= 0) return;
        // Recovers faster than it builds
        this.fatigueLevel = Math.max(0, this.fatigueLevel - dt * this.fatigueRecoveryRate);
    }
    // ============================================================================
    // RECOIL SYSTEM
    // ============================================================================
    onShot() {
        // Add recoil accumulation per shot
        this.recoilAccumulation = Math.min(this.maxRecoil, this.recoilAccumulation + this.recoilPerShot);
        // Track consecutive shots for spray pattern
        const now = performance.now() / 1000;
        if (now - this.lastShotTime < this.sprayResetTime) {
            this.consecutiveShotsCount++;
        } else {
            this.consecutiveShotsCount = 1; // Reset spray
        }
        this.lastShotTime = now;
        // Reset warmup slightly (shooting adds instability)
        this.aimWarmup *= 0.95;
    }
    _updateRecoil(dt) {
        if (this.recoilAccumulation <= 0) return;
        // Recoil decays over time (humans recover control)
        this.recoilAccumulation = Math.max(0, this.recoilAccumulation - dt * this.recoilDecayRate);
    }
    // ============================================================================
    // SPRAY PATTERN & COMPENSATION
    // ============================================================================
    _updateSprayPattern(dt) {
        const now = performance.now() / 1000;
        // Reset spray pattern if no recent shots
        if (now - this.lastShotTime > this.sprayResetTime) {
            this.consecutiveShotsCount = 0;
            this.verticalRecoilMultiplier = 1.0;
        } else {
            // Increase vertical recoil with consecutive shots (like CS:GO)
            // But skilled AI compensates by pulling down
            const spraySeverity = Math.min(1.0, this.consecutiveShotsCount / 10);
            this.verticalRecoilMultiplier = 1.0 + spraySeverity * 2.0; // Up to 3x vertical kick
        }
    }
    _applySprayCompensation(aimPoint) {
        // Skilled AI compensates for vertical recoil (pulls down)
        const compensationAmount = this.sprayCompensation * this.baseSkill;
        const verticalOffset = this.verticalRecoilMultiplier - 1.0; // How much it kicks up
        const compensation = verticalOffset * compensationAmount;
        // Apply downward compensation
        aimPoint.y -= compensation * 0.5; // Pull aim down to compensate
        return aimPoint;
    }
    // ============================================================================
    // TRACKING ERROR (LAG BEHIND MOVING TARGETS)
    // ============================================================================
    _applyTrackingError(aimPoint, targetEntity, deltaTime) {
        if (!this.lastTargetPosition) {
            this.lastTargetPosition = aimPoint.clone();
            return aimPoint;
        }
        // Calculate target velocity
        const targetVelocity = new Vec3().sub2(aimPoint, this.lastTargetPosition).scale(1 / deltaTime);
        const targetSpeed = targetVelocity.length();
        // Humans lag behind moving targets
        if (targetSpeed > 0.5) {
            const lagDistance = targetSpeed * this.trackingLagFactor;
            // Apply lag (aim behind target's current position)
            const lagDirection = targetVelocity.clone().normalize().scale(-1);
            const lagOffset = lagDirection.scale(lagDistance * (1.0 - this.aimWarmup));
            aimPoint.add(lagOffset);
        }
        return aimPoint;
    }
    // ============================================================================
    // SPREAD & ERROR CALCULATION
    // ============================================================================
    _calculateTotalError() {
        // 1. Base spread (stance, movement)
        const baseSpread = this._calculateBaseSpread();
        // 2. Warmup penalty (cold aim is wild)
        const warmupPenalty = (1.0 - this.aimWarmup) * 0.6; // Up to 60% error when cold
        // 3. Stress error
        const stressError = this.stressLevel * 0.4; // Up to 40% error
        // 4. Fatigue error
        const fatigueError = this.fatigueLevel * 0.25; // Up to 25% error
        // 5. Recoil error
        const recoilError = this.recoilAccumulation * 0.3; // Up to 30% error
        // Combine all errors
        const totalError = baseSpread + warmupPenalty + stressError + fatigueError + recoilError;
        // Skill reduces total error
        const errorReduction = this.baseSkill * 0.5; // Up to 50% reduction
        const finalError = totalError * (1.0 - errorReduction);
        return Math.max(0.01, finalError); // Minimum 1cm error (never perfect)
    }
    _calculateBaseSpread() {
        // Check agent movement state
        const isMoving = this.agent.velocity?.length() > 0.1 || false;
        const isCrouched = this.agent.isCrouching || false;
        if (isCrouched) return this.baseSpreadCrouched;
        if (isMoving) return this.baseSpreadMoving;
        return this.baseSpreadStanding;
    }
    _applySpreadError(aimPoint, errorRadius) {
        // Generate random offset within error cone
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDistance = Math.random() * errorRadius;
        // Apply in a circle around aim point
        const errorOffset = new Vec3(Math.cos(randomAngle) * randomDistance, (Math.random() - 0.5) * randomDistance * 0.5, Math.sin(randomAngle) * randomDistance);
        aimPoint.add(errorOffset);
        return aimPoint;
    }
    // ============================================================================
    // RECOIL OFFSET
    // ============================================================================
    _applyRecoilOffset(aimPoint) {
        // Recoil kicks primarily upward with some horizontal drift
        const verticalKick = this.recoilAccumulation * 0.4 * this.verticalRecoilMultiplier;
        const horizontalDrift = (Math.random() - 0.5) * this.recoilAccumulation * 0.2;
        aimPoint.y += verticalKick;
        aimPoint.x += horizontalDrift;
        return aimPoint;
    }
    // ============================================================================
    // FLICK SYSTEM (OVERCORRECTION)
    // ============================================================================
    _shouldFlick() {
        performance.now() / 1000;
        // Don't flick if recovering from previous flick
        if (this.isRecoveringFromFlick) return false;
        // Random chance to flick
        return Math.random() < this.flickChance;
    }
    _applyFlick(aimPoint, targetPosition) {
        // Overcorrect toward target (flick past it)
        const toTarget = new Vec3().sub2(targetPosition, aimPoint);
        const flickDistance = toTarget.length() * this.flickMagnitude;
        const flickOffset = toTarget.normalize().scale(flickDistance);
        aimPoint.add(flickOffset);
        // Enter recovery state
        this.isRecoveringFromFlick = true;
        this.lastFlickTime = performance.now() / 1000;
        Logger.aiDetail(`[${this.entity.name}] 🎯 FLICK! (overcorrection by ${flickDistance.toFixed(2)}m)`);
        return aimPoint;
    }
    _updateFlickRecovery(dt) {
        if (!this.isRecoveringFromFlick) return;
        const now = performance.now() / 1000;
        if (now - this.lastFlickTime > this.flickRecoveryTime) {
            this.isRecoveringFromFlick = false;
        }
    }
    // ============================================================================
    // AIM SMOOTHING
    // ============================================================================
    _smoothAimTransition(targetAim, deltaTime) {
        // Humans don't snap to target instantly
        // Use lerp for smooth transitions
        if (!this.smoothedAimPoint || this.smoothedAimPoint.length() === 0) {
            this.smoothedAimPoint.copy(targetAim);
            return targetAim;
        }
        // Smoothing factor affected by skill (better players snap faster)
        const smoothingSpeed = this.aimSmoothingFactor * (1.0 + this.baseSkill * 0.5);
        const lerpFactor = Math.min(1.0, smoothingSpeed * deltaTime * 10);
        this.smoothedAimPoint.lerp(this.smoothedAimPoint, targetAim, lerpFactor);
        return this.smoothedAimPoint.clone();
    }
    // ============================================================================
    // DIAGNOSTICS
    // ============================================================================
    _logAimDiagnostics(targetPos, aimPos, totalError) {
        const distance = aimPos.distance(targetPos);
        Logger.aiDetail(`[${this.entity.name}] 🎯 Aim Stats:`, {
            skill: `${(this.baseSkill * 100).toFixed(0)}%`,
            warmup: `${(this.aimWarmup * 100).toFixed(0)}%`,
            stress: `${(this.stressLevel * 100).toFixed(0)}%`,
            fatigue: `${(this.fatigueLevel * 100).toFixed(0)}%`,
            recoil: `${(this.recoilAccumulation * 100).toFixed(0)}%`,
            error: `${(totalError * 100).toFixed(1)}cm`,
            offset: `${distance.toFixed(2)}m`,
            spray: `${this.consecutiveShotsCount} shots`
        });
    }
    getDebugInfo() {
        return {
            baseSkill: (this.baseSkill * 100).toFixed(0) + '%',
            aimWarmup: (this.aimWarmup * 100).toFixed(0) + '%',
            stressLevel: (this.stressLevel * 100).toFixed(0) + '%',
            fatigueLevel: (this.fatigueLevel * 100).toFixed(0) + '%',
            recoilAccumulation: (this.recoilAccumulation * 100).toFixed(0) + '%',
            consecutiveShots: this.consecutiveShotsCount,
            isRecoveringFromFlick: this.isRecoveringFromFlick
        };
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        this.agent = null;
        this.entity = null;
        this.lastTargetEntity = null;
        this.lastTargetPosition = null;
        this.predictedTargetPosition = null;
        this.currentAimPoint = null;
        this.smoothedAimPoint = null;
    }
    constructor(agent, config = {}){
        this.agent = agent;
        this.entity = agent.entity;
        // Base skill (0-1) influenced by personality
        const personality = agent.personalitySystem;
        const aggressionBonus = personality ? personality.traits.aggression * 0.2 : 0.1;
        const accuracyBonus = personality ? personality.traits.accuracy * 0.15 : 0;
        this.baseSkill = config.baseSkill || 0.4 + aggressionBonus + accuracyBonus;
        this.baseSkill = Math.max(0.2, Math.min(0.95, this.baseSkill)); // Clamp 0.2-0.95
        // ✅ AIM WARMUP: Accuracy improves as AI tracks target
        this.aimWarmup = 0; // 0 to 1 (cold → warmed up)
        this.aimWarmupRate = config.warmupRate || 0.8; // Reaches 1.0 in ~1.25s
        this.aimCooldownRate = config.cooldownRate || 2.0; // Cools faster than warms
        this.maxWarmupTime = 1.5; // Takes 1.5s to reach perfect warmup
        this.isAiming = false;
        this.lastTargetEntity = null;
        // ✅ STRESS SYSTEM: Increases with damage, decreases over time
        this.stressLevel = 0; // 0 to 1
        this.stressDecayRate = config.stressDecayRate || 0.15; // Decays slowly
        this.stressFromDamage = config.stressFromDamage || 0.3; // Spike per hit
        this.maxStress = 1.0;
        // ✅ FATIGUE SYSTEM: Builds during extended combat
        this.fatigueLevel = 0; // 0 to 1
        this.fatigueAccumulationRate = config.fatigueRate || 0.05; // Per second in combat
        this.fatigueRecoveryRate = config.fatigueRecovery || 0.08; // Per second out of combat
        this.maxFatigue = 0.8; // Cap at 80% (never completely exhausted)
        // ✅ RECOIL CONTROL: Accumulates with each shot
        this.recoilAccumulation = 0; // 0 to 1
        this.recoilDecayRate = config.recoilDecay || 1.5; // Recovers quickly
        this.recoilPerShot = config.recoilPerShot || 0.15; // Added per shot
        this.maxRecoil = 1.0;
        // ✅ TRACKING ERROR: Lag behind moving targets
        this.lastTargetPosition = null;
        this.predictedTargetPosition = null;
        this.trackingLagFactor = config.trackingLag || 0.3; // 30% lag behind target
        // ✅ FLICK SYSTEM: Occasional overcorrection
        this.flickChance = config.flickChance || 0.05; // 5% chance per shot
        this.flickMagnitude = config.flickMagnitude || 0.8; // How far to overshoot
        this.flickRecoveryTime = 0.3; // 300ms to recover from flick
        this.lastFlickTime = 0;
        this.isRecoveringFromFlick = false;
        // ✅ SPRAY COMPENSATION: Vertical recoil control (like CS:GO)
        this.sprayCompensation = config.sprayCompensation || 0.6; // 60% compensation
        this.verticalRecoilMultiplier = 1.0;
        this.consecutiveShotsCount = 0;
        this.lastShotTime = 0;
        this.sprayResetTime = 1.0; // Reset spray after 1s without shooting
        // Base spread factors
        this.baseSpreadMoving = config.spreadMoving || 0.08;
        this.baseSpreadStanding = config.spreadStanding || 0.03;
        this.baseSpreadCrouched = config.spreadCrouched || 0.015;
        // Current calculated aim point
        this.currentAimPoint = new Vec3();
        this.smoothedAimPoint = new Vec3();
        this.aimSmoothingFactor = config.aimSmoothing || 0.3; // Smooth aim transitions
        // Diagnostic
        this.debugEnabled = config.debug || false;
        Logger.info(`[${this.entity.name}] 🎯 HumanAimSystem initialized - Skill: ${(this.baseSkill * 100).toFixed(0)}%`);
    }
}

export { HumanAimSystem };
