///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * CombatDecisionContext.mjs (ESM REFACTORED VERSION)
 * 
 * Shared context object for combat decision-making.
 * Prevents duplicate calculations across:
 * - CombatSystem
 * - GoalArbitrator
 * - EmotionalStateSystem
 * - WeaponSelector
 * - CombatTacticsSystem
 * 
 * Created once per frame or decision cycle, then passed to all systems.
 */ class CombatDecisionContext {
    // ============================================================================
    // THREAT ASSESSMENT
    // ============================================================================
    _calculateThreatCount() {
        try {
            return this.agent.eventHandler?.getActiveThreats?.()?.length || 0;
        } catch  {
            return this.hasTarget ? 1 : 0;
        }
    }
    _calculateThreatLevel() {
        let threat = 0;
        // Base threat from having target
        if (this.hasTarget) threat += 0.3;
        if (this.targetVisible) threat += 0.2;
        // Distance-based threat
        if (this.targetDistance) {
            if (this.targetDistance < 15) threat += 0.4;
            else if (this.targetDistance < 30) threat += 0.2;
            else threat += 0.1;
        }
        // Multiple threats
        if (this.threatCount > 1) {
            threat += Math.min(0.3, this.threatCount * 0.15);
        }
        // Recently damaged
        if (this.timeSinceDamage < 3000) threat += 0.2;
        return Math.max(0, Math.min(1, threat));
    }
    _isUnderFire() {
        return this.timeSinceDamage < 2000;
    }
    _calculateCombatPressure() {
        let pressure = 0;
        // Health pressure
        if (this.healthRatio < 0.3) pressure += 0.4;
        else if (this.healthRatio < 0.5) pressure += 0.2;
        // Threat pressure
        pressure += this.threatLevel * 0.3;
        // Ammo pressure
        if (this.ammoRatio < 0.2) pressure += 0.3;
        else if (this.ammoRatio < 0.4) pressure += 0.15;
        return Math.max(0, Math.min(1, pressure));
    }
    _getTimeSinceDamage() {
        const lastDamageTime = this.agent.lastDamageTime || 0;
        return performance.now() / 1000 - lastDamageTime;
    }
    // ============================================================================
    // WEAPON STATE
    // ============================================================================
    _isWeaponReady() {
        const ws = this.agent.weaponSystem;
        if (!ws) return false;
        return ws.canShoot && ws.canShoot();
    }
    _hasUsableAmmo() {
        try {
            if (this.agent.utilities?.hasUsableAmmo) {
                return this.agent.utilities.hasUsableAmmo();
            }
            const ws = this.agent.weaponSystem;
            if (!ws || !ws.weapons) return false;
            return Object.values(ws.weapons).some((w)=>w && w.unlocked && (w.ammo > 0 || w.magazine > 0));
        } catch  {
            return false;
        }
    }
    _calculateAmmoRatio() {
        try {
            const ws = this.agent.weaponSystem;
            if (!ws || !ws.weapons) return 0;
            let totalAmmo = 0;
            let totalMax = 0;
            let weaponCount = 0;
            for (const weapon of Object.values(ws.weapons)){
                if (weapon && weapon.unlocked) {
                    const current = (weapon.ammo || 0) + (weapon.magazine || 0);
                    const max = weapon.maxAmmo || 100;
                    totalAmmo += current;
                    totalMax += max;
                    weaponCount++;
                }
            }
            if (weaponCount === 0 || totalMax === 0) return 0;
            return Math.min(1, totalAmmo / totalMax);
        } catch  {
            return 0;
        }
    }
    // ============================================================================
    // ENVIRONMENTAL
    // ============================================================================
    _findNearbyHealthItems() {
        try {
            const closest = this.agent.utilities?.getClosestHealthItem?.();
            if (!closest) return null;
            return {
                position: closest.position,
                distance: this.agentPosition.distance(closest.position),
                isAvailable: closest.isAvailable
            };
        } catch  {
            return null;
        }
    }
    _findNearbyAmmoItems() {
        try {
            const closest = this.agent.utilities?.findNearestAmmo?.();
            if (!closest) return null;
            const distance = this.agentPosition.distance(closest.getPosition());
            return {
                entity: closest,
                position: closest.getPosition(),
                distance: distance
            };
        } catch  {
            return null;
        }
    }
    _findNearestCover() {
        try {
            const cover = this.agent.utilities?.findValidCoverPosition?.();
            if (!cover) return null;
            return {
                position: cover,
                distance: this.agentPosition.distance(cover)
            };
        } catch  {
            return null;
        }
    }
    // ============================================================================
    // SURVIVAL NEEDS
    // ============================================================================
    /**
     * Calculate combined survival need (health + ammo)
     */ getSurvivalNeed() {
        const healthNeed = 1 - this.healthRatio;
        const ammoNeed = 1 - this.ammoRatio;
        // Health is more critical
        return healthNeed * 0.7 + ammoNeed * 0.3;
    }
    /**
     * Calculate combat opportunity score
     */ getCombatOpportunity() {
        let opportunity = 0;
        if (!this.hasTarget) return 0;
        opportunity += 0.3; // Has target
        if (this.targetVisible) opportunity += 0.3;
        if (this.hasUsableAmmo) opportunity += 0.2;
        if (this.healthRatio > 0.6) opportunity += 0.2;
        return Math.max(0, Math.min(1, opportunity));
    }
    /**
     * Calculate exploration value
     */ getExplorationValue() {
        if (this.hasTarget) return 0.2;
        return this.healthRatio * 0.5 + this.ammoRatio * 0.3 + 0.2;
    }
    // ============================================================================
    // TACTICAL DECISIONS
    // ============================================================================
    /**
     * Should retreat?
     */ shouldRetreat() {
        if (this.personality) {
            return this.personality.shouldRetreat(this.healthRatio, this.threatLevel);
        }
        // Fallback
        return this.healthRatio < 0.3 && this.threatLevel > 0.6;
    }
    /**
     * Should seek cover?
     */ shouldSeekCover() {
        if (this.personality) {
            return this.personality.shouldSeekCover(this.healthRatio, this.underFire);
        }
        // Fallback
        return this.healthRatio < 0.5 && this.underFire;
    }
    /**
     * Should advance toward target?
     */ shouldAdvance() {
        if (this.personality) {
            return this.personality.shouldAdvance(this.targetDistance, this.healthRatio, this.ammoRatio);
        }
        // Fallback
        return this.targetDistance > 25 && this.healthRatio > 0.6 && this.hasUsableAmmo;
    }
    /**
     * Get tactical response recommendation
     */ getTacticalResponse() {
        if (this.shouldRetreat()) return 'retreat';
        if (this.shouldSeekCover()) return 'cover';
        if (this.shouldAdvance()) return 'advance';
        if (this.inCombat) return 'hold';
        return 'patrol';
    }
    // ============================================================================
    // UTILITY
    // ============================================================================
    /**
     * Clone context (for caching)
     */ clone() {
        const cloned = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        cloned.timestamp = this.timestamp;
        return cloned;
    }
    /**
     * Is context still fresh?
     */ isFresh(maxAge = 200) {
        return performance.now() - this.timestamp < maxAge;
    }
    /**
     * Get summary for debugging
     */ getSummary() {
        return {
            health: `${(this.healthRatio * 100).toFixed(0)}%`,
            ammo: `${(this.ammoRatio * 100).toFixed(0)}%`,
            target: this.hasTarget ? `${this.targetDistance?.toFixed(1)}m` : 'none',
            threats: this.threatCount,
            threatLevel: this.threatLevel.toFixed(2),
            pressure: this.combatPressure.toFixed(2),
            stress: this.stress.toFixed(2),
            confidence: this.confidence.toFixed(2),
            tactical: this.getTacticalResponse()
        };
    }
    constructor(agent){
        this.agent = agent;
        this.timestamp = performance.now();
        // Core agent state
        this.health = agent.health || 0;
        this.maxHealth = agent.maxHealth || 100;
        this.healthRatio = this.health / Math.max(1, this.maxHealth);
        this.alertness = agent.alertness || 0;
        this.morale = agent.morale || 1.0;
        // Target information
        this.hasTarget = !!agent.targetSystem?.hasTarget?.();
        this.targetVisible = this.hasTarget && !!agent.targetSystem?.isTargetVisible?.();
        this.targetEntity = this.hasTarget ? agent.targetSystem.getTargetEntity() : null;
        this.targetPosition = this.hasTarget ? agent.targetSystem.getTargetPosition() : null;
        this.targetDistance = null;
        this.targetVelocity = 0;
        if (this.targetPosition) {
            const agentPos = agent.entity.getPosition();
            this.targetDistance = agentPos.distance(this.targetPosition);
            // Get target velocity if available
            if (this.targetEntity?.velocity) {
                this.targetVelocity = this.targetEntity.velocity.length();
            }
        }
        // Threat assessment
        this.threatCount = this._calculateThreatCount();
        this.threatLevel = this._calculateThreatLevel();
        this.underFire = this._isUnderFire();
        this.combatPressure = this._calculateCombatPressure();
        // Weapon state
        this.currentWeapon = agent.weaponSystem?.currentWeapon || 'none';
        this.weaponReady = this._isWeaponReady();
        this.currentMagazine = agent.weaponSystem?.currentMagazine || 0;
        this.hasUsableAmmo = this._hasUsableAmmo();
        this.ammoRatio = this._calculateAmmoRatio();
        // Positional context
        this.agentPosition = agent.entity.getPosition();
        this.isMoving = agent.isMoving || false;
        this.inCover = agent.isInCover || false;
        // Combat state
        this.inCombat = agent.stateMachine?.currentState?.type === 'combat';
        this.combatDuration = agent.combatTimer || 0;
        this.timeSinceDamage = this._getTimeSinceDamage();
        // Emotional state
        this.stress = agent.emotionalState?.stress || 0.5;
        this.confidence = agent.emotionalState?.confidence || 0.7;
        this.fatigue = agent.emotionalState?.fatigue || 0;
        this.panic = agent.emotionalState?.panic || 0;
        // Personality
        this.personality = agent.personalitySystem || null;
        // Environmental
        this.nearbyHealthItems = this._findNearbyHealthItems();
        this.nearbyAmmoItems = this._findNearbyAmmoItems();
        this.nearestCover = this._findNearestCover();
    }
}

export { CombatDecisionContext };
