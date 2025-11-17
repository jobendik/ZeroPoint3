import { Logger } from '../../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * PersonalitySystem.mjs (ESM REFACTORED VERSION)
 * 
 * Manages agent personality traits that modulate behavior across all systems.
 * Extracted from GoalArbitrator and agent attributes.
 * 
 * Personality affects:
 * - Combat aggression (via fuzzy logic modulation)
 * - Risk tolerance (health/ammo thresholds)
 * - Accuracy preferences (precision vs speed)
 * - Tactical decisions (flanking, retreating, advancing)
 * - Goal priorities (aggressive vs defensive)
 */ function _define_property(obj, key, value) {
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
 * Personality archetypes for AI agents (PHASE 2)
 */ const PersonalityArchetypes = {
    AGGRESSIVE: {
        name: 'Aggressive',
        aggression: 0.85,
        caution: 0.20,
        accuracy: 0.50,
        adaptability: 0.60,
        teamwork: 0.30,
        curiosity: 0.50
    },
    CAUTIOUS: {
        name: 'Cautious',
        aggression: 0.30,
        caution: 0.85,
        accuracy: 0.70,
        adaptability: 0.50,
        teamwork: 0.70,
        curiosity: 0.30
    },
    TACTICAL: {
        name: 'Tactical',
        aggression: 0.55,
        caution: 0.60,
        accuracy: 0.90,
        adaptability: 0.60,
        teamwork: 0.75,
        curiosity: 0.40
    },
    BALANCED: {
        name: 'Balanced',
        aggression: 0.55,
        caution: 0.50,
        accuracy: 0.60,
        adaptability: 0.60,
        teamwork: 0.50,
        curiosity: 0.50
    },
    BERSERKER: {
        name: 'Berserker',
        aggression: 0.95,
        caution: 0.10,
        accuracy: 0.40,
        adaptability: 0.70,
        teamwork: 0.15,
        curiosity: 0.60
    },
    SNIPER: {
        name: 'Sniper',
        aggression: 0.40,
        caution: 0.75,
        accuracy: 0.90,
        adaptability: 0.40,
        teamwork: 0.30,
        curiosity: 0.30
    }
};
class PersonalitySystem {
    /**
     * ✅ PHASE 2: Select a random personality archetype
     */ _selectRandomArchetype() {
        const archetypes = [
            {
                key: 'BALANCED',
                weight: 30
            },
            {
                key: 'TACTICAL',
                weight: 25
            },
            {
                key: 'AGGRESSIVE',
                weight: 20
            },
            {
                key: 'CAUTIOUS',
                weight: 15
            },
            {
                key: 'SNIPER',
                weight: 7
            },
            {
                key: 'BERSERKER',
                weight: 3
            }
        ];
        const totalWeight = archetypes.reduce((sum, a)=>sum + a.weight, 0);
        let random = Math.random() * totalWeight;
        for (const archetype of archetypes){
            random -= archetype.weight;
            if (random <= 0) {
                return PersonalityArchetypes[archetype.key];
            }
        }
        return PersonalityArchetypes.BALANCED;
    }
    /**
     * ✅ PHASE 2: Calculate HP threshold for fleeing
     */ _calculateFleeThreshold() {
        const base = 0.30;
        const aggressionModifier = (0.5 - this.traits.aggression) * 0.3;
        const cautionModifier = (this.traits.caution - 0.5) * 0.4;
        const threshold = base + aggressionModifier + cautionModifier;
        return Math.max(0.10, Math.min(0.70, threshold));
    }
    /**
     * ✅ PHASE 2: Calculate pursuit tenacity
     */ _calculatePursuitTenacity() {
        return this.traits.aggression * 0.7 + 0.2;
    }
    /**
     * ✅ PHASE 2: Calculate cover usage frequency
     */ _calculateCoverUsage() {
        return this.traits.accuracy * 0.7 + this.traits.caution * 0.3;
    }
    /**
     * ✅ PHASE 2: Calculate reaction speed (decision delay)
     */ _calculateReactionSpeed() {
        const base = 0.150;
        const variance = (1.0 - this.traits.adaptability) * 0.250;
        return base + variance;
    }
    /**
     * Update derived behavioral modifiers from core traits
     */ _updateModifiers() {
        this.modifiers = {
            // Combat behavior
            aggressionBonus: this.traits.aggression * 0.3,
            defensiveBonus: this.traits.caution * 0.25,
            // Decision-making
            riskTolerance: 1 - this.traits.caution,
            reactionSpeedModifier: 1 - this.traits.accuracy * 0.2,
            // Goal priorities
            healthThresholdModifier: this.traits.caution * 0.15,
            ammoConservation: this.traits.caution * 0.2,
            // Tactical preferences
            flankingPreference: this.traits.aggression * 0.4,
            coverPreference: this.traits.caution * 0.5,
            advanceThreshold: this.traits.aggression * 0.3,
            retreatThreshold: this.traits.caution * 0.3,
            // Weapon switching
            weaponSwitchHesitation: this.traits.caution * 800,
            // Exploration
            explorationRadius: 15 + this.traits.curiosity * 20,
            explorationFrequency: this.traits.curiosity * 0.4
        };
    }
    /**
     * Apply a personality profile
     */ applyProfile(profile) {
        Object.assign(this.traits, profile);
        this._updateModifiers();
        Logger.debug('[PersonalitySystem] Applied profile:', this.getProfile());
    }
    // ============================================================================
    // PHASE 2: EVALUATOR SUPPORT METHODS
    // ============================================================================
    /**
     * Get health desirability multiplier for GetHealthEvaluator
     */ getHealthDesirabilityMultiplier(healthRatio) {
        if (healthRatio > this.fleeThreshold) {
            return 0.5 + this.traits.caution * 0.5;
        } else {
            const urgency = 1.0 - healthRatio / this.fleeThreshold;
            return 1.0 + urgency * this.traits.caution * 1.5;
        }
    }
    /**
     * Get attack desirability multiplier for AttackEvaluator
     */ getAttackDesirabilityMultiplier(healthRatio, hasAdvantage) {
        // Start with aggression trait as base multiplier
        let multiplier = this.traits.aggression;
        // Apply health penalty only when very low (< 30%) and not aggressive
        if (healthRatio < 0.3) {
            const healthPenalty = (1.0 - healthRatio) * (1.0 - this.traits.aggression);
            multiplier *= 1.0 - healthPenalty * 0.3; // Reduced from 0.5 to 0.3
        }
        // ✅ FIX: Less punishing for no advantage - even cautious AI should attack visible targets
        // In FPS games, having a clear shot IS an advantage
        if (!hasAdvantage) {
            // Range: 0.75 to 1.0 instead of 0.5 to 1.0
            multiplier *= 0.75 + this.traits.aggression * 0.25;
        }
        // ✅ FIX: Ensure minimum multiplier of 0.6 for visible targets
        // This prevents overly passive behavior in combat situations
        return Math.max(0.6, multiplier);
    }
    /**
     * Get weapon preference
     */ getWeaponPreference() {
        if (this.traits.aggression > 0.7) {
            return 'high_dps';
        } else if (this.traits.accuracy > 0.7) {
            return 'tactical';
        } else {
            return 'balanced';
        }
    }
    /**
     * Get movement style
     */ getMovementStyle() {
        if (this.traits.aggression > 0.7) {
            return 'aggressive';
        } else if (this.traits.accuracy > 0.7) {
            return 'tactical';
        } else if (this.traits.caution > 0.7) {
            return 'defensive';
        } else {
            return 'balanced';
        }
    }
    /**
     * Apply random variance
     */ applyRandomVariance(baseValue) {
        const variance = (Math.random() - 0.5) * 2 * (1.0 - this.traits.adaptability);
        return baseValue * (1.0 + variance * 0.3);
    }
    /**
     * Get debug info
     */ getDebugInfo() {
        return {
            archetype: this.archetype.name,
            aggression: this.traits.aggression.toFixed(2),
            caution: this.traits.caution.toFixed(2),
            accuracy: this.traits.accuracy.toFixed(2),
            fleeThreshold: `${Math.round(this.fleeThreshold * 100)}%`,
            pursuitTenacity: this.pursuitTenacity.toFixed(2),
            coverUsage: this.coverUsage.toFixed(2),
            reactionSpeed: `${Math.round(this.reactionSpeed * 1000)}ms`
        };
    }
    // ============================================================================
    // COMBAT MODULATION
    // ============================================================================
    /**
     * Get aggression modifier for fuzzy logic
     */ getAggressionModifier() {
        return this.traits.aggression;
    }
    /**
     * Get caution modifier for decision-making
     */ getCautionModifier() {
        return this.traits.caution;
    }
    /**
     * Should agent prefer aggressive tactics?
     */ shouldBeAggressive(healthRatio, ammoRatio) {
        const baseAggression = this.traits.aggression;
        const situationalBonus = healthRatio > 0.7 && ammoRatio > 0.5 ? 0.2 : 0;
        const situationalPenalty = healthRatio < 0.3 || ammoRatio < 0.2 ? 0.3 : 0;
        return baseAggression + situationalBonus - situationalPenalty > 0.5;
    }
    /**
     * Should agent retreat in this situation?
     */ shouldRetreat(healthRatio, threatLevel) {
        const retreatThreshold = 0.3 + this.modifiers.retreatThreshold;
        const cautionFactor = this.traits.caution * threatLevel;
        return healthRatio < retreatThreshold || cautionFactor > 0.7;
    }
    // ============================================================================
    // WEAPON PREFERENCES
    // ============================================================================
    /**
     * Get weapon switch hesitation time (milliseconds)
     */ getWeaponSwitchDelay() {
        return Math.max(500, 1500 - this.modifiers.weaponSwitchHesitation);
    }
    /**
     * Get preferred engagement range based on personality
     */ getPreferredEngagementRange() {
        // Aggressive: close range, Cautious: long range
        const baseRange = 20;
        const modifier = (this.traits.aggression - this.traits.caution) * 10;
        return {
            min: Math.max(5, baseRange - modifier - 5),
            optimal: baseRange + modifier,
            max: baseRange + modifier + 15
        };
    }
    /**
     * Should prioritize accuracy over fire rate?
     */ preferAccuracy() {
        return this.traits.accuracy > 0.6;
    }
    // ============================================================================
    // GOAL PRIORITIES
    // ============================================================================
    /**
     * Get health threshold for seeking health items
     */ getHealthSeekThreshold() {
        // Cautious agents seek health earlier
        return 0.5 + this.modifiers.healthThresholdModifier;
    }
    /**
     * Get ammo threshold for seeking ammo
     */ getAmmoSeekThreshold() {
        // Cautious agents conserve ammo more
        return 0.3 + this.modifiers.ammoConservation;
    }
    /**
     * Get exploration priority modifier
     */ getExplorationPriority() {
        return this.traits.curiosity;
    }
    // ============================================================================
    // TACTICAL DECISIONS
    // ============================================================================
    /**
     * Should use flanking tactics?
     */ shouldFlank(distance, healthRatio) {
        if (healthRatio < 0.3) return false; // Too risky
        if (distance < 10) return false; // Too close
        return Math.random() < this.modifiers.flankingPreference;
    }
    /**
     * Should seek cover?
     */ shouldSeekCover(healthRatio, underFire) {
        const coverThreshold = 0.6 - this.modifiers.coverPreference;
        if (underFire) return healthRatio < 0.8;
        return healthRatio < coverThreshold;
    }
    /**
     * Should advance toward enemy?
     */ shouldAdvance(distance, healthRatio, ammoRatio) {
        if (healthRatio < 0.4 || ammoRatio < 0.2) return false;
        if (distance < 8) return false; // Too close already
        const advanceScore = this.traits.aggression * 0.6 + healthRatio * 0.2 + ammoRatio * 0.2;
        return advanceScore > 0.6;
    }
    // ============================================================================
    // DECISION-MAKING SPEED
    // ============================================================================
    /**
     * Get decision-making speed modifier
     */ getDecisionSpeedModifier() {
        return this.modifiers.reactionSpeedModifier;
    }
    /**
     * Get goal commitment time (how long to stick with a goal)
     */ getGoalCommitmentTime(goalType) {
        const baseTimes = {
            attack: 4500,
            health: 3500,
            ammo: 3000,
            explore: 2500,
            weapon: 8000
        };
        const baseTime = baseTimes[goalType] || 3000;
        // Adaptable agents switch goals faster
        const adaptabilityModifier = 1 - this.traits.adaptability * 0.3;
        return baseTime * adaptabilityModifier;
    }
    // ============================================================================
    // UTILITY
    // ============================================================================
    /**
     * Get personality profile for debugging
     */ getProfile() {
        return {
            traits: {
                ...this.traits
            },
            type: this._classifyPersonality()
        };
    }
    /**
     * Classify personality type based on traits
     */ _classifyPersonality() {
        const { aggression, caution, accuracy } = this.traits;
        if (aggression > 0.7 && caution < 0.3) return 'AGGRESSIVE';
        if (caution > 0.7 && aggression < 0.3) return 'DEFENSIVE';
        if (accuracy > 0.7) return 'PRECISION';
        if (aggression > 0.6 && accuracy < 0.5) return 'RUSHER';
        return 'BALANCED';
    }
    /**
     * Adjust trait dynamically (for learning/adaptation)
     */ adjustTrait(traitName, delta) {
        if (this.traits[traitName] === undefined) {
            Logger.warn(`[PersonalitySystem] Unknown trait: ${traitName}`);
            return;
        }
        this.traits[traitName] = Math.max(0, Math.min(1, this.traits[traitName] + delta));
        this._updateModifiers();
    }
    /**
     * Get all behavioral modifiers
     */ getModifiers() {
        return {
            ...this.modifiers
        };
    }
    constructor(agentOrConfig = {}){
        // Handle both agent object and config object
        const config = agentOrConfig.entity ? {} : agentOrConfig;
        const agent = agentOrConfig.entity ? agentOrConfig : null;
        // ✅ PHASE 2: Select archetype if not provided
        this.archetype = null;
        if (config.archetype && PersonalityArchetypes[config.archetype]) {
            this.archetype = PersonalityArchetypes[config.archetype];
        } else {
            this.archetype = this._selectRandomArchetype();
        }
        // Core personality traits (0-1 scale) - use archetype or fallback to random
        this.traits = {
            aggression: config.aggression ?? this.archetype.aggression,
            caution: config.caution ?? this.archetype.caution,
            accuracy: config.accuracy ?? this.archetype.accuracy,
            adaptability: config.adaptability ?? this.archetype.adaptability,
            teamwork: config.teamwork ?? this.archetype.teamwork,
            curiosity: config.curiosity ?? this.archetype.curiosity
        };
        // Derived behavioral modifiers
        this._updateModifiers();
        // ✅ PHASE 2: Calculate flee threshold
        this.fleeThreshold = this._calculateFleeThreshold();
        this.pursuitTenacity = this._calculatePursuitTenacity();
        this.coverUsage = this._calculateCoverUsage();
        this.reactionSpeed = this._calculateReactionSpeed();
        const entityName = agent?.entity?.name || 'AI';
        Logger.info(`[${entityName}] Personality: ${this.archetype.name} (Aggression: ${this.traits.aggression.toFixed(2)}, Caution: ${this.traits.caution.toFixed(2)}, Flee: ${Math.round(this.fleeThreshold * 100)}%)`);
    }
}
// ============================================================================
// PERSONALITY PROFILES (Presets)
// ============================================================================
_define_property(PersonalitySystem, "AGGRESSIVE_PROFILE", {
    aggression: 0.8,
    caution: 0.2,
    accuracy: 0.5,
    adaptability: 0.6,
    teamwork: 0.4,
    curiosity: 0.5
});
_define_property(PersonalitySystem, "DEFENSIVE_PROFILE", {
    aggression: 0.3,
    caution: 0.8,
    accuracy: 0.7,
    adaptability: 0.5,
    teamwork: 0.6,
    curiosity: 0.3
});
_define_property(PersonalitySystem, "BALANCED_PROFILE", {
    aggression: 0.5,
    caution: 0.5,
    accuracy: 0.6,
    adaptability: 0.6,
    teamwork: 0.5,
    curiosity: 0.5
});
_define_property(PersonalitySystem, "SNIPER_PROFILE", {
    aggression: 0.4,
    caution: 0.7,
    accuracy: 0.9,
    adaptability: 0.4,
    teamwork: 0.3,
    curiosity: 0.3
});
_define_property(PersonalitySystem, "BERSERKER_PROFILE", {
    aggression: 0.9,
    caution: 0.1,
    accuracy: 0.4,
    adaptability: 0.7,
    teamwork: 0.2,
    curiosity: 0.6
});

export { PersonalityArchetypes, PersonalitySystem };
