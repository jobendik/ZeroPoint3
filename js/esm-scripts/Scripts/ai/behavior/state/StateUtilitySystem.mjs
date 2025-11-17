import { Logger } from '../../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Calculates desirability scores for all AI states
 */ class StateUtilitySystem {
    /**
     * Calculate desirability scores for all states
     * @returns {Object} Object with state names as keys and scores as values
     */ calculateAllScores() {
        const scores = {
            patrol: this.calculatePatrolDesirability(),
            alert: this.calculateAlertDesirability(),
            combat: this.calculateCombatDesirability(),
            flee: this.calculateFleeDesirability(),
            seekHealth: this.calculateHealthDesirability(),
            seekAmmo: this.calculateAmmoDesirability(),
            investigate: this.calculateInvestigateDesirability()
        };
        return scores;
    }
    /**
     * Get the most desirable state
     * @param {Object} options - Optional constraints (e.g., exclude certain states)
     * @returns {Object} { state: string, score: number, scores: Object }
     */ getBestState(options = {}) {
        const scores = this.calculateAllScores();
        // Apply exclusions if specified
        if (options.exclude) {
            options.exclude.forEach((state)=>delete scores[state]);
        }
        // Sort by score (descending)
        const sorted = Object.entries(scores).sort((a, b)=>b[1] - a[1]);
        const [bestState, bestScore] = sorted[0];
        const [secondState, secondScore] = sorted[1] || [
            null,
            0
        ];
        // Check if difference is significant enough to warrant change
        const currentState = this.agent.stateMachine?.currentState?.type;
        if (currentState && currentState !== bestState) {
            const currentScore = scores[currentState] || 0;
            const scoreDifference = bestScore - currentScore;
            // If current state is still reasonably good, don't change
            if (scoreDifference < this.TRANSITION_THRESHOLD) {
                return {
                    state: currentState,
                    score: currentScore,
                    scores,
                    reason: 'insufficient_difference',
                    difference: scoreDifference
                };
            }
        }
        return {
            state: bestState,
            score: bestScore,
            scores,
            runner_up: {
                state: secondState,
                score: secondScore
            }
        };
    }
    // ========================================================================
    // DESIRABILITY CALCULATORS (0.0 to 1.0)
    // ========================================================================
    /**
     * Calculate desirability of FLEE state
     * High when: low health, visible threat, health pack available
     */ calculateFleeDesirability() {
        let score = 0;
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        // Critical health (< 15%) → very high flee desire
        if (healthRatio < 0.15) {
            score = 0.95;
        } else if (healthRatio < 0.30) {
            score = 0.75;
        } else if (healthRatio < 0.50 && isTargetVisible) {
            score = 0.50;
        } else {
            score = 0.05;
        }
        // Boost if health pack available
        const healthItem = this._getClosestHealthItem();
        if (healthItem && healthRatio < 0.50) {
            score += 0.15;
        }
        // Reduce if no visible threat
        if (!isTargetVisible && healthRatio > 0.15) {
            score *= 0.3;
        }
        // Personality: cautious agents flee earlier
        const personality = this.agent.personalitySystem;
        if (personality && healthRatio < 0.50) {
            const caution = personality.traits?.caution || 0.5;
            score += (caution - 0.5) * 0.2;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of COMBAT state
     * High when: have target, have ammo, good health, weapons ready
     */ calculateCombatDesirability() {
        let score = 0;
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        const hasAmmo = this.agent.utilities?.hasUsableAmmo?.() || false;
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        // No target = no combat
        if (!hasTarget) return 0;
        // Base score if target is visible
        if (isTargetVisible) {
            score = 0.60;
        } else {
            score = 0.20; // Target exists but not visible
        }
        // Ammo check
        if (!hasAmmo) {
            score *= 0.2; // Severely reduce combat desire without ammo
        } else {
            score += 0.20; // Boost for having ammo
        }
        // Health influences combat desire
        if (healthRatio > 0.70) {
            score += 0.15; // Confident when healthy
        } else if (healthRatio < 0.30) {
            score *= 0.4; // Reluctant when low health
        }
        // Weapon system check
        const ws = this.agent.weaponSystem;
        const hasValidWeapon = ws && ws._initialized && ws.weapons && Object.keys(ws.weapons).some((key)=>ws.weapons[key]?.unlocked);
        if (!hasValidWeapon) {
            return 0; // Can't fight without weapons
        }
        // Personality: aggressive agents prefer combat
        const personality = this.agent.personalitySystem;
        if (personality) {
            const aggression = personality.traits?.aggression || 0.5;
            score += (aggression - 0.5) * 0.25;
        }
        // Tactical situation: am I outnumbered?
        const nearbyEnemies = this._countNearbyEnemies(20);
        if (nearbyEnemies > 2) {
            score *= 0.7; // Reduce desire when outnumbered
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of SEEK_HEALTH state
     * High when: low health, health pack available, no immediate threat
     */ calculateHealthDesirability() {
        let score = 0;
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        const healthItem = this._getClosestHealthItem();
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        // No health pack = no seeking
        if (!healthItem || !healthItem.isAvailable) return 0;
        // Already healthy = no seeking
        if (healthRatio > 0.80) return 0;
        // Health-based base score
        if (healthRatio < 0.30) {
            score = 0.70;
        } else if (healthRatio < 0.50) {
            score = 0.50;
        } else if (healthRatio < 0.70) {
            score = 0.30;
        } else {
            score = 0.15;
        }
        // Distance to health pack matters
        const distance = this._getDistanceToHealthItem(healthItem);
        if (distance < 10) {
            score += 0.15; // Close = more desirable
        } else if (distance > 30) {
            score *= 0.6; // Far = less desirable
        }
        // Reduce if actively engaged with visible enemy
        if (isTargetVisible && healthRatio > 0.20) {
            score *= 0.4;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of SEEK_AMMO state
     * High when: low ammo, ammo pack available, not in immediate danger
     */ calculateAmmoDesirability() {
        let score = 0;
        const hasAmmo = this.agent.utilities?.hasUsableAmmo?.() || false;
        const ammoItem = this._getClosestAmmoItem();
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        // No ammo pack = no seeking
        if (!ammoItem || !ammoItem.isAvailable) return 0;
        // Already have ammo = low desire
        if (hasAmmo) {
            // Check current ammo levels
            const ws = this.agent.weaponSystem;
            if (ws && ws.currentWeapon && ws.weapons) {
                const currentWeapon = ws.weapons[ws.currentWeapon];
                if (currentWeapon) {
                    const magazineAmmo = ws.currentMagazine || 0;
                    const reserveAmmo = currentWeapon.ammo || 0;
                    const totalAmmo = magazineAmmo + reserveAmmo;
                    // Low ammo even though hasUsableAmmo
                    if (totalAmmo < 15) {
                        score = 0.45;
                    } else if (totalAmmo < 30) {
                        score = 0.25;
                    } else {
                        return 0.05; // Well stocked
                    }
                }
            }
        } else {
            // No ammo at all
            score = 0.65;
        }
        // Distance to ammo matters
        const distance = this._getDistanceToAmmoItem(ammoItem);
        if (distance < 10) {
            score += 0.15;
        } else if (distance > 30) {
            score *= 0.6;
        }
        // Reduce if low health (should seek health first)
        if (healthRatio < 0.30) {
            score *= 0.3;
        }
        // Reduce if actively engaged
        if (isTargetVisible) {
            score *= 0.5;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of ALERT state
     * High when: target detected but not visible, investigating
     */ calculateAlertDesirability() {
        let score = 0;
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        const hasInvestigation = !!this.agent.investigationTarget;
        const alertness = this.agent.alertness || 0;
        // Investigation target = high alert desire
        if (hasInvestigation) {
            score = 0.55;
        }
        // Target exists but not visible = alert
        if (hasTarget && !isTargetVisible) {
            score = 0.50;
        }
        // High alertness from sounds/events
        if (alertness > 0.6) {
            score = Math.max(score, alertness * 0.6);
        }
        // If target is visible, combat is better
        if (isTargetVisible) {
            score *= 0.3;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of PATROL state
     * High when: no threats, good health, nothing to do
     */ calculatePatrolDesirability() {
        let score = 0.40; // Base patrol desirability
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const healthRatio = this.agent.health / Math.max(1, this.agent.maxHealth);
        const hasAmmo = this.agent.utilities?.hasUsableAmmo?.() || false;
        const alertness = this.agent.alertness || 0;
        // No threats = patrol is good
        if (!hasTarget) {
            score = 0.50;
        } else {
            score = 0.15; // Has target = patrol less desirable
        }
        // Healthy = patrol is fine
        if (healthRatio > 0.70) {
            score += 0.15;
        } else if (healthRatio < 0.50) {
            score *= 0.5;
        }
        // Low ammo reduces patrol desire
        if (!hasAmmo) {
            score *= 0.6;
        }
        // High alertness = patrol less desirable
        if (alertness > 0.5) {
            score *= 1 - alertness * 0.4;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate desirability of INVESTIGATE state
     * High when: heard sound, investigation target set, no visible threat
     */ calculateInvestigateDesirability() {
        let score = 0;
        const hasInvestigation = !!this.agent.investigationTarget;
        const hasTarget = this.agent.targetSystem?.hasTarget?.();
        const isTargetVisible = hasTarget && this.agent.targetSystem?.isTargetVisible?.();
        // No investigation target = no desire
        if (!hasInvestigation) return 0;
        // Base score for having investigation target
        score = 0.45;
        // Distance to investigation point
        if (this.agent.investigationTarget) {
            const distance = this.agent.entity.getPosition().distance(this.agent.investigationTarget);
            if (distance < 15) {
                score += 0.10; // Close = more urgent
            }
        }
        // Reduce if visible threat (combat is better)
        if (isTargetVisible) {
            score *= 0.2;
        }
        return Math.max(0, Math.min(1, score));
    }
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    _getClosestHealthItem() {
        if (this.agent.utilities?.getClosestHealthItem) {
            return this.agent.utilities.getClosestHealthItem();
        } else if (this.agent._getClosestHealthItem) {
            return this.agent._getClosestHealthItem();
        }
        return null;
    }
    _getClosestAmmoItem() {
        if (this.agent.utilities?.getClosestAmmoItem) {
            return this.agent.utilities.getClosestAmmoItem();
        } else if (this.agent._getClosestAmmoItem) {
            return this.agent._getClosestAmmoItem();
        }
        return null;
    }
    _getDistanceToHealthItem(healthItem) {
        if (!healthItem) return 999;
        const agentPos = this.agent.entity.getPosition();
        let itemPos = null;
        if (healthItem.position) {
            itemPos = healthItem.position;
        } else if (healthItem.entity?.getPosition) {
            itemPos = healthItem.entity.getPosition();
        } else if (healthItem.getPosition) {
            itemPos = healthItem.getPosition();
        }
        return itemPos ? agentPos.distance(itemPos) : 999;
    }
    _getDistanceToAmmoItem(ammoItem) {
        if (!ammoItem) return 999;
        const agentPos = this.agent.entity.getPosition();
        let itemPos = null;
        if (ammoItem.position) {
            itemPos = ammoItem.position;
        } else if (ammoItem.entity?.getPosition) {
            itemPos = ammoItem.entity.getPosition();
        } else if (ammoItem.getPosition) {
            itemPos = ammoItem.getPosition();
        }
        return itemPos ? agentPos.distance(itemPos) : 999;
    }
    _countNearbyEnemies(radius) {
        // TODO: Implement proper enemy counting
        // For now, return 1 if has target, 0 otherwise
        return this.agent.targetSystem?.hasTarget?.() ? 1 : 0;
    }
    /**
     * Log all state scores for debugging
     */ logScores(scores = null) {
        if (!scores) scores = this.calculateAllScores();
        const sorted = Object.entries(scores).sort((a, b)=>b[1] - a[1]).map(([state, score])=>`${state}:${score.toFixed(2)}`).join(', ');
        Logger.aiDetail(`[${this.agentName}] State scores: ${sorted}`);
    }
    constructor(agent){
        this.agent = agent;
        this.agentName = agent.entity?.name || 'Agent';
        // Minimum score difference to trigger state change (prevents oscillation)
        this.TRANSITION_THRESHOLD = 0.15;
        // Score weights for different factors
        this.WEIGHTS = {
            health: 1.2,
            threat: 1.0,
            resources: 0.8,
            tactical: 0.7,
            personality: 0.5 // Agent personality influence
        };
    }
}

export { StateUtilitySystem, StateUtilitySystem as default };
