import * as YUKA from 'yuka';
import { Logger } from '../../../core/engine/logger.mjs';

class FuzzyLogicSystem {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    _initializeAllModules() {
        try {
            // Combat behavior
            this.modules.combat = this._createCombatModule();
            // Survival assessment
            this.modules.survival = this._createSurvivalModule();
            // Weapon selection
            this.modules.weapon = this._createWeaponModule();
            // Goal priority
            this.modules.goalPriority = this._createGoalPriorityModule();
            // Tactical positioning
            this.modules.tactical = this._createTacticalModule();
            // Emotional state modules
            this.modules.stress = this._createStressModule();
            this.modules.confidence = this._createConfidenceModule();
            this.modules.fatigue = this._createFatigueModule();
            this.modules.emotionalImpact = this._createEmotionalImpactModule();
            this.initialized = true;
            Logger.debug('[FuzzyLogicSystem] All modules initialized');
        } catch (error) {
            Logger.error('[FuzzyLogicSystem] Initialization failed:', error);
            this.initialized = false;
        }
    }
    // ============================================================================
    // COMBAT BEHAVIOR MODULE
    // ============================================================================
    _createCombatModule() {
        const module = new YUKA.FuzzyModule();
        // INPUT: Threat Level (0-1)
        const threat = new YUKA.FuzzyVariable();
        threat.add(new YUKA.LeftShoulderFuzzySet(0, 0.15, 0.35, 'low'));
        threat.add(new YUKA.TriangularFuzzySet(0.25, 0.5, 0.75, 'medium'));
        threat.add(new YUKA.RightShoulderFuzzySet(0.65, 0.85, 1.0, 'high'));
        module.addFLV('threat', threat);
        // INPUT: Health Status (0-1)
        const health = new YUKA.FuzzyVariable();
        health.add(new YUKA.LeftShoulderFuzzySet(0, 0.15, 0.3, 'critical'));
        health.add(new YUKA.TriangularFuzzySet(0.25, 0.45, 0.65, 'low'));
        health.add(new YUKA.RightShoulderFuzzySet(0.55, 0.75, 1.0, 'healthy'));
        module.addFLV('health', health);
        // INPUT: Ammo Status (0-1)
        const ammo = new YUKA.FuzzyVariable();
        ammo.add(new YUKA.LeftShoulderFuzzySet(0, 0.1, 0.25, 'depleted'));
        ammo.add(new YUKA.TriangularFuzzySet(0.2, 0.4, 0.6, 'low'));
        ammo.add(new YUKA.RightShoulderFuzzySet(0.5, 0.7, 1.0, 'adequate'));
        module.addFLV('ammo', ammo);
        // OUTPUT: Aggression Level (0-1)
        const aggression = new YUKA.FuzzyVariable();
        aggression.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'defensive'));
        aggression.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'balanced'));
        aggression.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'aggressive'));
        module.addFLV('aggression', aggression);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(new YUKA.FuzzyAND(threat.fuzzySets[2], health.fuzzySets[0]), new YUKA.FuzzyOR(ammo.fuzzySets[0], ammo.fuzzySets[1])), aggression.fuzzySets[0]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(new YUKA.FuzzyAND(threat.fuzzySets[0], health.fuzzySets[2]), ammo.fuzzySets[2]), aggression.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(threat.fuzzySets[1], health.fuzzySets[1]), aggression.fuzzySets[0]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(new YUKA.FuzzyOR(threat.fuzzySets[0], new YUKA.FuzzyOR(threat.fuzzySets[1], threat.fuzzySets[2])), ammo.fuzzySets[0]), aggression.fuzzySets[0]));
        return module;
    }
    // ============================================================================
    // SURVIVAL MODULE
    // ============================================================================
    _createSurvivalModule() {
        const module = new YUKA.FuzzyModule();
        const health = new YUKA.FuzzyVariable();
        health.add(new YUKA.LeftShoulderFuzzySet(0, 0.1, 0.25, 'critical'));
        health.add(new YUKA.TriangularFuzzySet(0.2, 0.4, 0.6, 'low'));
        health.add(new YUKA.RightShoulderFuzzySet(0.5, 0.75, 1.0, 'safe'));
        module.addFLV('health', health);
        const healthDistance = new YUKA.FuzzyVariable();
        healthDistance.add(new YUKA.LeftShoulderFuzzySet(0, 10, 25, 'close'));
        healthDistance.add(new YUKA.TriangularFuzzySet(20, 40, 60, 'medium'));
        healthDistance.add(new YUKA.RightShoulderFuzzySet(50, 75, 100, 'far'));
        module.addFLV('healthDistance', healthDistance);
        const pressure = new YUKA.FuzzyVariable();
        pressure.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'low'));
        pressure.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'moderate'));
        pressure.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'high'));
        module.addFLV('pressure', pressure);
        const urgency = new YUKA.FuzzyVariable();
        urgency.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'low'));
        urgency.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'medium'));
        urgency.add(new YUKA.RightShoulderFuzzySet(0.6, 0.85, 1.0, 'critical'));
        module.addFLV('urgency', urgency);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(new YUKA.FuzzyAND(health.fuzzySets[0], healthDistance.fuzzySets[0]), pressure.fuzzySets[0]), urgency.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(health.fuzzySets[0], pressure.fuzzySets[2]), urgency.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(health.fuzzySets[2], urgency.fuzzySets[0]));
        return module;
    }
    // ============================================================================
    // WEAPON SELECTION MODULE
    // ============================================================================
    _createWeaponModule() {
        const module = new YUKA.FuzzyModule();
        const distance = new YUKA.FuzzyVariable();
        distance.add(new YUKA.LeftShoulderFuzzySet(0, 5, 12, 'close'));
        distance.add(new YUKA.TriangularFuzzySet(10, 20, 35, 'medium'));
        distance.add(new YUKA.RightShoulderFuzzySet(30, 50, 100, 'far'));
        module.addFLV('distance', distance);
        const weaponAmmo = new YUKA.FuzzyVariable();
        weaponAmmo.add(new YUKA.LeftShoulderFuzzySet(0, 0.15, 0.3, 'low'));
        weaponAmmo.add(new YUKA.TriangularFuzzySet(0.25, 0.5, 0.75, 'medium'));
        weaponAmmo.add(new YUKA.RightShoulderFuzzySet(0.65, 0.85, 1.0, 'high'));
        module.addFLV('weaponAmmo', weaponAmmo);
        const accuracyNeed = new YUKA.FuzzyVariable();
        accuracyNeed.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'low'));
        accuracyNeed.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'medium'));
        accuracyNeed.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'high'));
        module.addFLV('accuracyNeed', accuracyNeed);
        const weaponPref = new YUKA.FuzzyVariable();
        weaponPref.add(new YUKA.LeftShoulderFuzzySet(0, 0.15, 0.35, 'shotgun'));
        weaponPref.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'machinegun'));
        weaponPref.add(new YUKA.RightShoulderFuzzySet(0.65, 0.85, 1.0, 'pistol'));
        module.addFLV('weaponType', weaponPref);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(distance.fuzzySets[0], accuracyNeed.fuzzySets[0]), weaponPref.fuzzySets[0]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(distance.fuzzySets[1], weaponAmmo.fuzzySets[1]), weaponPref.fuzzySets[1]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(distance.fuzzySets[2], accuracyNeed.fuzzySets[2]), weaponPref.fuzzySets[2]));
        return module;
    }
    // ============================================================================
    // GOAL PRIORITY MODULE
    // ============================================================================
    _createGoalPriorityModule() {
        const module = new YUKA.FuzzyModule();
        const survivalNeed = new YUKA.FuzzyVariable();
        survivalNeed.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'low'));
        survivalNeed.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'medium'));
        survivalNeed.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'high'));
        module.addFLV('survivalNeed', survivalNeed);
        const combatOpp = new YUKA.FuzzyVariable();
        combatOpp.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'poor'));
        combatOpp.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'moderate'));
        combatOpp.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'excellent'));
        module.addFLV('combatOpportunity', combatOpp);
        const exploreValue = new YUKA.FuzzyVariable();
        exploreValue.add(new YUKA.LeftShoulderFuzzySet(0, 0.25, 0.5, 'low'));
        exploreValue.add(new YUKA.RightShoulderFuzzySet(0.4, 0.7, 1.0, 'high'));
        module.addFLV('exploreValue', exploreValue);
        const goalType = new YUKA.FuzzyVariable();
        goalType.add(new YUKA.LeftShoulderFuzzySet(0, 0.15, 0.3, 'explore'));
        goalType.add(new YUKA.TriangularFuzzySet(0.25, 0.5, 0.75, 'survival'));
        goalType.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'combat'));
        module.addFLV('goalType', goalType);
        // RULES
        module.addRule(new YUKA.FuzzyRule(survivalNeed.fuzzySets[2], goalType.fuzzySets[1]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(combatOpp.fuzzySets[2], survivalNeed.fuzzySets[0]), goalType.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(new YUKA.FuzzyAND(combatOpp.fuzzySets[0], survivalNeed.fuzzySets[0]), exploreValue.fuzzySets[1]), goalType.fuzzySets[0]));
        return module;
    }
    // ============================================================================
    // TACTICAL POSITIONING MODULE
    // ============================================================================
    _createTacticalModule() {
        const module = new YUKA.FuzzyModule();
        const coverDistance = new YUKA.FuzzyVariable();
        coverDistance.add(new YUKA.LeftShoulderFuzzySet(0, 15, 30, 'close'));
        coverDistance.add(new YUKA.TriangularFuzzySet(25, 40, 60, 'medium'));
        coverDistance.add(new YUKA.RightShoulderFuzzySet(50, 75, 100, 'far'));
        module.addFLV('coverDistance', coverDistance);
        const threatDir = new YUKA.FuzzyVariable();
        threatDir.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'directional'));
        threatDir.add(new YUKA.RightShoulderFuzzySet(0.5, 0.75, 1.0, 'surrounded'));
        module.addFLV('threatDirection', threatDir);
        const response = new YUKA.FuzzyVariable();
        response.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'advance'));
        response.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'hold'));
        response.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'retreat'));
        module.addFLV('response', response);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(coverDistance.fuzzySets[0], threatDir.fuzzySets[1]), response.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(coverDistance.fuzzySets[2], threatDir.fuzzySets[0]), response.fuzzySets[0]));
        return module;
    }
    // ============================================================================
    // EMOTIONAL STATE MODULES
    // ============================================================================
    _createStressModule() {
        const module = new YUKA.FuzzyModule();
        const combatIntensity = new YUKA.FuzzyVariable();
        combatIntensity.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'low'));
        combatIntensity.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'medium'));
        combatIntensity.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'high'));
        module.addFLV('combatIntensity', combatIntensity);
        const healthStatus = new YUKA.FuzzyVariable();
        healthStatus.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'critical'));
        healthStatus.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'low'));
        healthStatus.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'healthy'));
        module.addFLV('healthStatus', healthStatus);
        const stressLevel = new YUKA.FuzzyVariable();
        stressLevel.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'calm'));
        stressLevel.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'stressed'));
        stressLevel.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'panicked'));
        module.addFLV('stressLevel', stressLevel);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(combatIntensity.fuzzySets[2], healthStatus.fuzzySets[0]), stressLevel.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(combatIntensity.fuzzySets[0], healthStatus.fuzzySets[2]), stressLevel.fuzzySets[0]));
        return module;
    }
    _createConfidenceModule() {
        const module = new YUKA.FuzzyModule();
        const performanceRatio = new YUKA.FuzzyVariable();
        performanceRatio.add(new YUKA.LeftShoulderFuzzySet(0, 0.3, 0.6, 'poor'));
        performanceRatio.add(new YUKA.TriangularFuzzySet(0.5, 0.7, 0.9, 'average'));
        performanceRatio.add(new YUKA.RightShoulderFuzzySet(0.8, 1.0, 1.5, 'excellent'));
        module.addFLV('performanceRatio', performanceRatio);
        const successRate = new YUKA.FuzzyVariable();
        successRate.add(new YUKA.LeftShoulderFuzzySet(0, 0.25, 0.5, 'low'));
        successRate.add(new YUKA.TriangularFuzzySet(0.4, 0.6, 0.8, 'moderate'));
        successRate.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'high'));
        module.addFLV('successRate', successRate);
        const confidenceLevel = new YUKA.FuzzyVariable();
        confidenceLevel.add(new YUKA.LeftShoulderFuzzySet(0, 0.3, 0.5, 'low'));
        confidenceLevel.add(new YUKA.TriangularFuzzySet(0.4, 0.6, 0.8, 'moderate'));
        confidenceLevel.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'high'));
        module.addFLV('confidenceLevel', confidenceLevel);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(performanceRatio.fuzzySets[2], successRate.fuzzySets[2]), confidenceLevel.fuzzySets[2]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(performanceRatio.fuzzySets[0], successRate.fuzzySets[0]), confidenceLevel.fuzzySets[0]));
        return module;
    }
    _createFatigueModule() {
        const module = new YUKA.FuzzyModule();
        const timeInCombat = new YUKA.FuzzyVariable();
        timeInCombat.add(new YUKA.LeftShoulderFuzzySet(0, 0.2, 0.4, 'fresh'));
        timeInCombat.add(new YUKA.TriangularFuzzySet(0.3, 0.5, 0.7, 'tired'));
        timeInCombat.add(new YUKA.RightShoulderFuzzySet(0.6, 0.8, 1.0, 'exhausted'));
        module.addFLV('timeInCombat', timeInCombat);
        const currentFatigue = new YUKA.FuzzyVariable();
        currentFatigue.add(new YUKA.LeftShoulderFuzzySet(0, 0.25, 0.5, 'low'));
        currentFatigue.add(new YUKA.TriangularFuzzySet(0.4, 0.6, 0.8, 'moderate'));
        currentFatigue.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'high'));
        module.addFLV('currentFatigue', currentFatigue);
        const degradation = new YUKA.FuzzyVariable();
        degradation.add(new YUKA.LeftShoulderFuzzySet(0, 0.1, 0.2, 'minimal'));
        degradation.add(new YUKA.TriangularFuzzySet(0.15, 0.3, 0.5, 'moderate'));
        degradation.add(new YUKA.RightShoulderFuzzySet(0.4, 0.6, 1.0, 'severe'));
        module.addFLV('degradation', degradation);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(timeInCombat.fuzzySets[2], currentFatigue.fuzzySets[2]), degradation.fuzzySets[2]));
        return module;
    }
    _createEmotionalImpactModule() {
        const module = new YUKA.FuzzyModule();
        const emotionalLoad = new YUKA.FuzzyVariable();
        emotionalLoad.add(new YUKA.LeftShoulderFuzzySet(0, 0.3, 0.5, 'low'));
        emotionalLoad.add(new YUKA.TriangularFuzzySet(0.4, 0.6, 0.8, 'moderate'));
        emotionalLoad.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'high'));
        module.addFLV('emotionalLoad', emotionalLoad);
        const composure = new YUKA.FuzzyVariable();
        composure.add(new YUKA.LeftShoulderFuzzySet(0, 0.3, 0.5, 'low'));
        composure.add(new YUKA.TriangularFuzzySet(0.4, 0.6, 0.8, 'moderate'));
        composure.add(new YUKA.RightShoulderFuzzySet(0.7, 0.85, 1.0, 'high'));
        module.addFLV('composure', composure);
        const accuracyMod = new YUKA.FuzzyVariable();
        accuracyMod.add(new YUKA.LeftShoulderFuzzySet(0.4, 0.6, 0.75, 'poor'));
        accuracyMod.add(new YUKA.TriangularFuzzySet(0.7, 0.85, 0.95, 'fair'));
        accuracyMod.add(new YUKA.RightShoulderFuzzySet(0.9, 0.95, 1.0, 'normal'));
        module.addFLV('accuracyMod', accuracyMod);
        const decisionSpeed = new YUKA.FuzzyVariable();
        decisionSpeed.add(new YUKA.LeftShoulderFuzzySet(0.5, 0.7, 0.9, 'slow'));
        decisionSpeed.add(new YUKA.TriangularFuzzySet(0.85, 1.0, 1.15, 'normal'));
        decisionSpeed.add(new YUKA.RightShoulderFuzzySet(1.1, 1.3, 1.5, 'hasty'));
        module.addFLV('decisionSpeed', decisionSpeed);
        // RULES
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(emotionalLoad.fuzzySets[2], composure.fuzzySets[0]), accuracyMod.fuzzySets[0]));
        module.addRule(new YUKA.FuzzyRule(new YUKA.FuzzyAND(emotionalLoad.fuzzySets[2], composure.fuzzySets[0]), decisionSpeed.fuzzySets[2]));
        return module;
    }
    // ============================================================================
    // PUBLIC API - High-level evaluation methods
    // ============================================================================
    /**
     * Evaluate combat aggression
     */ evaluateCombatAggression(threatLevel, healthRatio, ammoRatio, personalityMod = 0) {
        if (!this.initialized || !this.modules.combat) return 0.5;
        try {
            this.modules.combat.fuzzify('threat', threatLevel);
            this.modules.combat.fuzzify('health', healthRatio);
            this.modules.combat.fuzzify('ammo', ammoRatio);
            let aggression = this.modules.combat.defuzzify('aggression');
            // Apply personality modulation
            if (personalityMod !== 0) {
                aggression = aggression * 0.7 + personalityMod * 0.3;
            }
            return Math.max(0, Math.min(1, aggression));
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Combat aggression evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate survival urgency
     */ evaluateSurvivalUrgency(healthRatio, healthItemDistance, combatPressure) {
        if (!this.initialized || !this.modules.survival) return 0.5;
        try {
            this.modules.survival.fuzzify('health', healthRatio);
            this.modules.survival.fuzzify('healthDistance', healthItemDistance);
            this.modules.survival.fuzzify('pressure', combatPressure);
            return this.modules.survival.defuzzify('urgency');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Survival urgency evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate weapon preference
     */ evaluateWeaponPreference(distance, ammoRatio, accuracyNeed) {
        if (!this.initialized || !this.modules.weapon) return 0.5;
        try {
            this.modules.weapon.fuzzify('distance', distance);
            this.modules.weapon.fuzzify('weaponAmmo', ammoRatio);
            this.modules.weapon.fuzzify('accuracyNeed', accuracyNeed);
            return this.modules.weapon.defuzzify('weaponType');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Weapon preference evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate goal priority
     */ evaluateGoalPriority(survivalNeed, combatOpportunity, exploreValue) {
        if (!this.initialized || !this.modules.goalPriority) return 0.5;
        try {
            this.modules.goalPriority.fuzzify('survivalNeed', survivalNeed);
            this.modules.goalPriority.fuzzify('combatOpportunity', combatOpportunity);
            this.modules.goalPriority.fuzzify('exploreValue', exploreValue);
            return this.modules.goalPriority.defuzzify('goalType');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Goal priority evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate tactical response
     */ evaluateTacticalResponse(coverDistance, threatDirection) {
        if (!this.initialized || !this.modules.tactical) return 0.5;
        try {
            this.modules.tactical.fuzzify('coverDistance', coverDistance);
            this.modules.tactical.fuzzify('threatDirection', threatDirection);
            return this.modules.tactical.defuzzify('response');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Tactical response evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate stress level
     */ evaluateStress(combatIntensity, healthRatio) {
        if (!this.initialized || !this.modules.stress) return 0.5;
        try {
            this.modules.stress.fuzzify('combatIntensity', combatIntensity);
            this.modules.stress.fuzzify('healthStatus', healthRatio);
            return this.modules.stress.defuzzify('stressLevel');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Stress evaluation failed:', error);
            return 0.5;
        }
    }
    /**
     * Evaluate confidence
     */ evaluateConfidence(performanceRatio, successRate) {
        if (!this.initialized || !this.modules.confidence) return 0.7;
        try {
            this.modules.confidence.fuzzify('performanceRatio', performanceRatio);
            this.modules.confidence.fuzzify('successRate', successRate);
            return this.modules.confidence.defuzzify('confidenceLevel');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Confidence evaluation failed:', error);
            return 0.7;
        }
    }
    /**
     * Evaluate fatigue degradation
     */ evaluateFatigueDegradation(normalizedCombatTime, currentFatigue) {
        if (!this.initialized || !this.modules.fatigue) return 0;
        try {
            this.modules.fatigue.fuzzify('timeInCombat', normalizedCombatTime);
            this.modules.fatigue.fuzzify('currentFatigue', currentFatigue);
            return this.modules.fatigue.defuzzify('degradation');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Fatigue degradation evaluation failed:', error);
            return 0;
        }
    }
    /**
     * Evaluate emotional impact on accuracy
     */ evaluateAccuracyModifier(emotionalLoad, composure) {
        if (!this.initialized || !this.modules.emotionalImpact) return 1.0;
        try {
            this.modules.emotionalImpact.fuzzify('emotionalLoad', emotionalLoad);
            this.modules.emotionalImpact.fuzzify('composure', composure);
            return this.modules.emotionalImpact.defuzzify('accuracyMod');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Accuracy modifier evaluation failed:', error);
            return 1.0;
        }
    }
    /**
     * Evaluate decision speed modifier
     */ evaluateDecisionSpeed(emotionalLoad, composure) {
        if (!this.initialized || !this.modules.emotionalImpact) return 1.0;
        try {
            this.modules.emotionalImpact.fuzzify('emotionalLoad', emotionalLoad);
            this.modules.emotionalImpact.fuzzify('composure', composure);
            return this.modules.emotionalImpact.defuzzify('decisionSpeed');
        } catch (error) {
            Logger.warn('[FuzzyLogicSystem] Decision speed evaluation failed:', error);
            return 1.0;
        }
    }
    constructor(){
        this.modules = {
            combat: null,
            survival: null,
            weapon: null,
            goalPriority: null,
            tactical: null,
            stress: null,
            confidence: null,
            fatigue: null,
            emotionalImpact: null
        };
        this.initialized = false;
        this._initializeAllModules();
    }
}

export { FuzzyLogicSystem };
