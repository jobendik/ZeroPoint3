import { Logger } from '../../../core/engine/logger.mjs';

/**
 * EmotionalStateSystem.mjs (ESM Module)
 * 
 * Manages AI agent emotional states using the centralized FuzzyLogicSystem.
 * Tracks stress, confidence, fatigue, panic, and composure.
 * Provides modifiers for accuracy, decision-making, and combat behavior.
 * 
 * Features:
 * - Use FuzzyLogicSystem for emotional calculations
 * - Delegate fuzzy calculations to centralized system
 * - Focus on state management and performance tracking
 */ class EmotionalStateSystem {
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    update(dt, context) {
        const now = performance.now();
        const inCombat = context?.inCombat || false;
        const healthRatio = context?.healthRatio || 1.0;
        // Update stress using fuzzy logic
        this._updateStress(dt, inCombat, healthRatio, context);
        // Update panic (spikes faster than stress)
        this._updatePanic(dt, inCombat, healthRatio);
        // Update fatigue
        this._updateFatigue(dt, inCombat);
        // Update confidence using fuzzy logic
        this._updateConfidence(dt);
        // Performance reset every 60 seconds
        if (now - this.performance.lastPerformanceReset > 60000) {
            this._resetPerformance();
        }
        // Update cached modifiers
        this._updateCachedModifiers();
    }
    // ============================================================================
    // STATE UPDATES
    // ============================================================================
    _updateStress(dt, inCombat, healthRatio, context) {
        if (!this.fuzzySystem || !this.fuzzySystem.initialized) {
            this._updateStressFallback(dt, inCombat);
            return;
        }
        try {
            const combatIntensity = this._calculateCombatIntensity(context);
            const targetStress = this.fuzzySystem.evaluateStress(combatIntensity, healthRatio);
            const stressRate = inCombat ? 0.15 : 0.08;
            this.emotionalState.stress = this._lerp(this.emotionalState.stress, targetStress, stressRate * dt);
        } catch (error) {
            Logger.warn('[EmotionalStateSystem] Stress update failed, using fallback:', error);
            this._updateStressFallback(dt, inCombat);
        }
    }
    _updateStressFallback(dt, inCombat) {
        if (inCombat) {
            this.emotionalState.stress = Math.min(1, this.emotionalState.stress + dt * 0.1);
        } else {
            this.emotionalState.stress = Math.max(0, this.emotionalState.stress - dt * 0.05);
        }
    }
    _updatePanic(dt, inCombat, healthRatio) {
        if (healthRatio < 0.2 && inCombat) {
            this.emotionalState.panic = Math.min(1, this.emotionalState.panic + dt * 0.3);
        } else {
            this.emotionalState.panic = Math.max(0, this.emotionalState.panic - dt * 0.2);
        }
    }
    _updateFatigue(dt, inCombat) {
        if (inCombat) {
            this.performance.timeInCombat += dt;
            const fatigueRate = 0.01 + this.emotionalState.stress * 0.02;
            this.emotionalState.fatigue = Math.min(1, this.emotionalState.fatigue + dt * fatigueRate);
        } else {
            const recoveryRate = 0.03 * (1 - this.emotionalState.stress);
            this.emotionalState.fatigue = Math.max(0, this.emotionalState.fatigue - dt * recoveryRate);
        }
    }
    _updateConfidence(dt) {
        if (!this.fuzzySystem || !this.fuzzySystem.initialized) {
            this._updateConfidenceFallback(dt);
            return;
        }
        try {
            const performanceRatio = this._calculatePerformanceRatio();
            const successRate = this._calculateSuccessRate();
            const targetConfidence = this.fuzzySystem.evaluateConfidence(performanceRatio, successRate);
            const confidenceRate = 0.05;
            this.emotionalState.confidence = this._lerp(this.emotionalState.confidence, targetConfidence, confidenceRate * dt);
        } catch (error) {
            Logger.warn('[EmotionalStateSystem] Confidence update failed, using fallback:', error);
            this._updateConfidenceFallback(dt);
        }
    }
    _updateConfidenceFallback(dt) {
        if (this.performance.recentKills > this.performance.recentDeaths) {
            this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + dt * 0.02);
        } else if (this.performance.recentDeaths > this.performance.recentKills) {
            this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - dt * 0.03);
        }
    }
    _updateCachedModifiers() {
        const now = performance.now();
        if (now - this.cachedModifiers.lastUpdate < this.cachedModifiers.updateInterval) {
            return;
        }
        this.cachedModifiers.lastUpdate = now;
        if (!this.fuzzySystem || !this.fuzzySystem.initialized) {
            this._updateModifiersFallback();
            return;
        }
        try {
            const emotionalLoad = (this.emotionalState.stress + this.emotionalState.panic) / 2;
            this.cachedModifiers.accuracyModifier = this.fuzzySystem.evaluateAccuracyModifier(emotionalLoad, this.emotionalState.composure);
            this.cachedModifiers.decisionSpeed = this.fuzzySystem.evaluateDecisionSpeed(emotionalLoad, this.emotionalState.composure);
        } catch (error) {
            Logger.warn('[EmotionalStateSystem] Modifier cache update failed:', error);
            this._updateModifiersFallback();
        }
    }
    _updateModifiersFallback() {
        const emotionalLoad = (this.emotionalState.stress + this.emotionalState.panic) / 2;
        this.cachedModifiers.accuracyModifier = 1.0 - emotionalLoad * 0.3;
        this.cachedModifiers.decisionSpeed = 1.0 + this.emotionalState.panic * 0.5;
    }
    // ============================================================================
    // CALCULATIONS
    // ============================================================================
    _calculateCombatIntensity(context) {
        if (!context) return 0;
        let intensity = 0;
        // Combat state
        if (context.inCombat) intensity += 0.4;
        else if (context.alertness > 0.5) intensity += 0.2;
        // Has target
        if (context.hasTarget) {
            intensity += 0.2;
            if (context.targetVisible) intensity += 0.2;
        }
        // Recently damaged
        if (context.timeSinceDamage < 3) intensity += 0.2;
        else if (context.timeSinceDamage < 6) intensity += 0.1;
        // Multiple threats
        if (context.threatCount > 1) {
            intensity += Math.min(0.3, context.threatCount * 0.1);
        }
        return Math.max(0, Math.min(1, intensity));
    }
    _calculatePerformanceRatio() {
        const kills = this.performance.recentKills || 0;
        const deaths = Math.max(1, this.performance.recentDeaths || 1);
        return kills / (kills + deaths);
    }
    _calculateSuccessRate() {
        const hits = this.performance.recentHits || 0;
        const total = hits + (this.performance.recentMisses || 0);
        if (total === 0) return 0.5;
        return hits / total;
    }
    _resetPerformance() {
        this.performance.recentKills = Math.floor(this.performance.recentKills * 0.5);
        this.performance.recentDeaths = Math.floor(this.performance.recentDeaths * 0.5);
        this.performance.recentHits = Math.floor(this.performance.recentHits * 0.5);
        this.performance.recentMisses = Math.floor(this.performance.recentMisses * 0.5);
        this.performance.lastPerformanceReset = performance.now();
    }
    // ============================================================================
    // PUBLIC API - EMOTIONAL MODIFIERS
    // ============================================================================
    /**
     * Calculate accuracy with emotional and fatigue modifiers
     */ calculateAccuracy(baseAccuracy = 0.75) {
        let accuracy = baseAccuracy;
        // Apply cached emotional modifier
        accuracy *= this.cachedModifiers.accuracyModifier;
        // Apply fatigue degradation
        if (this.fuzzySystem && this.emotionalState.fatigue > 0.1) {
            try {
                const normalizedTime = Math.min(1, this.performance.timeInCombat / 120);
                const degradation = this.fuzzySystem.evaluateFatigueDegradation(normalizedTime, this.emotionalState.fatigue);
                accuracy *= 1 - degradation * 0.4;
            } catch (error) {
                accuracy *= 1 - this.emotionalState.fatigue * 0.3;
            }
        } else {
            accuracy *= 1 - this.emotionalState.fatigue * 0.3;
        }
        // Confidence boost
        if (this.emotionalState.confidence > 0.7) {
            accuracy *= 1.1;
        }
        return Math.max(0.2, Math.min(1.0, accuracy));
    }
    /**
     * Get decision speed modifier
     */ getDecisionSpeedModifier() {
        return this.cachedModifiers.decisionSpeed;
    }
    /**
     * Should agent panic retreat?
     */ shouldPanicRetreat(healthRatio) {
        const panicThreshold = 0.7;
        const confidenceThreshold = 0.4;
        return this.emotionalState.panic > panicThreshold && this.emotionalState.confidence < confidenceThreshold && healthRatio < 0.25;
    }
    /**
     * Get current stress level
     */ getStressLevel() {
        return this.emotionalState.stress;
    }
    /**
     * Get current confidence level
     */ getConfidenceLevel() {
        return this.emotionalState.confidence;
    }
    /**
     * Get current fatigue level
     */ getFatigueLevel() {
        return this.emotionalState.fatigue;
    }
    /**
     * Get accuracy modifier
     */ getAccuracyModifier() {
        return this.cachedModifiers.accuracyModifier;
    }
    // ============================================================================
    // PERFORMANCE TRACKING
    // ============================================================================
    recordKill() {
        this.performance.recentKills++;
        this.performance.successfulEngagements++;
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.1);
        this.emotionalState.stress = Math.max(0, this.emotionalState.stress - 0.15);
    }
    recordDeath() {
        this.performance.recentDeaths++;
        this.performance.failedEngagements++;
        this.performance.timeSinceDeath = 0;
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.2);
        this.emotionalState.stress = 0.5;
        this.emotionalState.panic = 0;
        this.emotionalState.fatigue = 0;
        this.performance.timeInCombat = 0;
    }
    recordHit() {
        this.performance.recentHits++;
    }
    recordMiss() {
        this.performance.recentMisses++;
    }
    recordEngagementSuccess() {
        this.performance.successfulEngagements++;
        this.emotionalState.confidence = Math.min(1, this.emotionalState.confidence + 0.05);
    }
    recordEngagementFailure() {
        this.performance.failedEngagements++;
        this.emotionalState.confidence = Math.max(0, this.emotionalState.confidence - 0.08);
        this.emotionalState.stress = Math.min(1, this.emotionalState.stress + 0.1);
    }
    // ============================================================================
    // UTILITY
    // ============================================================================
    _lerp(current, target, alpha) {
        return current + (target - current) * alpha;
    }
    /**
     * Get full emotional state for debugging
     */ getState() {
        return {
            emotional: {
                ...this.emotionalState
            },
            performance: {
                ...this.performance
            },
            cachedModifiers: {
                ...this.cachedModifiers
            }
        };
    }
    /**
     * Destroy and clean up
     */ destroy() {
        this.agent = null;
        this.entity = null;
        this.fuzzySystem = null;
    }
    constructor(agent, fuzzySystem){
        this.agent = agent;
        this.entity = agent.entity;
        this.fuzzySystem = fuzzySystem;
        // Core emotional metrics
        this.emotionalState = {
            stress: 0.3 + Math.random() * 0.2,
            confidence: 0.6 + Math.random() * 0.2,
            fatigue: 0.0,
            panic: 0.0,
            composure: 0.7 + Math.random() * 0.2 // Ability to stay calm (personality trait)
        };
        // Performance tracking for confidence adjustments
        this.performance = {
            recentKills: 0,
            recentDeaths: 0,
            recentHits: 0,
            recentMisses: 0,
            successfulEngagements: 0,
            failedEngagements: 0,
            timeInCombat: 0,
            timeSinceDeath: 0,
            lastPerformanceReset: performance.now()
        };
        // Performance cache
        this.cachedModifiers = {
            lastUpdate: 0,
            updateInterval: 200,
            accuracyModifier: 1.0,
            decisionSpeed: 1.0
        };
        Logger.debug(`[${this.entity.name}] EmotionalStateSystem initialized: stress=${this.emotionalState.stress.toFixed(2)}, confidence=${this.emotionalState.confidence.toFixed(2)}, composure=${this.emotionalState.composure.toFixed(2)}`);
    }
}

export { EmotionalStateSystem };
