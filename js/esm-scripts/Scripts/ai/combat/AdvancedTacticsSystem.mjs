import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class AdvancedTacticsSystem {
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    /**
     * Update advanced tactics based on combat context
     */ update(dt, context) {
        if (!context.hasTarget) {
            this._resetTacticalStates();
            return;
        }
        const now = performance.now() / 1000;
        const personality = this.agent.personalitySystem;
        // Update active tactical states
        if (this.isPeeking) {
            this._updatePeek(dt, now, context);
        } else if (this.isBaiting) {
            this._updateBait(dt, now, context);
        } else if (this.isSuppressing) {
            this._updateSuppression(dt, now, context);
        }
        // Check for cover rotation
        if (this.agent.isInCover && context.inCombat) {
            this._checkCoverRotation(now, context);
        }
        // Evaluate new tactical opportunities
        if (!this._isInTacticalMode()) {
            this._evaluateTacticalOpportunities(now, context, personality);
        }
    }
    // ============================================================================
    // CORNER PEEKING & PRE-FIRE
    // ============================================================================
    _evaluatePeekOpportunity(now, context, personality) {
        // Check cooldown
        if (now - this.lastPeekTime < this.peekCooldown) {
            return false;
        }
        // Must be in/near cover
        if (!this.agent.isInCover && !this._isNearCover(context)) {
            return false;
        }
        // Must have target but not perfect line of sight (partial cover scenario)
        if (!context.hasTarget || context.targetDistance > 25) {
            return false;
        }
        // Personality affects peek frequency
        // Aggressive agents peek more, cautious agents peek less
        const peekChance = 0.3 + personality.traits.aggression * 0.4 - personality.traits.caution * 0.2;
        if (Math.random() > peekChance) {
            return false;
        }
        return true;
    }
    _startPeek(context, personality) {
        this.isPeeking = true;
        this.originalPosition = this.entity.getPosition().clone();
        this.peekDirection = this._calculatePeekDirection(context);
        this.lastPeekTime = performance.now() / 1000;
        // Peek duration varies by personality (0.5-2.0 seconds)
        this.peekDuration = 0.5 + personality.traits.aggression * 1.5;
        // Cooldown varies by personality (3-10 seconds)
        this.peekCooldown = this.peekIntervalMin + Math.random() * (this.peekIntervalMax - this.peekIntervalMin) + personality.traits.caution * 3.0;
        // Move slightly in peek direction
        const peekDistance = 1.0 + personality.traits.aggression * 0.5;
        const peekPosition = this.originalPosition.clone().add(this.peekDirection.clone().scale(peekDistance));
        // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
        this.agent.moveTo(peekPosition);
        Logger.aiState(`[${this.entity.name}] 👁️ Peeking for ${this.peekDuration.toFixed(1)}s`);
    }
    _updatePeek(dt, now, context) {
        const peekElapsed = now - this.lastPeekTime;
        // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
        // End peek after duration
        if (peekElapsed >= this.peekDuration) {
            this._endPeek();
        }
    }
    _endPeek() {
        if (this.originalPosition) {
            this.agent.moveTo(this.originalPosition);
        }
        this.isPeeking = false;
        this.peekDirection = null;
        this.originalPosition = null;
        Logger.aiDetail(`[${this.entity.name}] Returning to cover`);
    }
    _calculatePeekDirection(context) {
        if (!context.targetPosition) {
            // Peek forward
            return this.entity.forward.clone();
        }
        const myPos = this.entity.getPosition();
        const toTarget = new Vec3().sub2(context.targetPosition, myPos);
        toTarget.y = 0; // Keep horizontal
        toTarget.normalize();
        // Add slight randomness for more natural peeking
        const randomAngle = (Math.random() - 0.5) * 0.3;
        const cos = Math.cos(randomAngle);
        const sin = Math.sin(randomAngle);
        return new Vec3(toTarget.x * cos - toTarget.z * sin, 0, toTarget.x * sin + toTarget.z * cos).normalize();
    }
    // ============================================================================
    // FAKE RETREAT BAITING
    // ============================================================================
    _evaluateBaitOpportunity(now, context, personality) {
        // Check cooldown
        if (now - this.lastBaitTime < this.baitCooldown) {
            return false;
        }
        // Must be in combat with visible target
        if (!context.hasTarget || !context.targetVisible) {
            return false;
        }
        // Need decent health to execute bait (not desperation retreat)
        if (context.healthRatio < 0.4) {
            return false;
        }
        // Target should be at medium range
        if (context.targetDistance < 8 || context.targetDistance > 20) {
            return false;
        }
        // Personality affects bait frequency
        // Aggressive + adaptable agents bait more
        const baitChance = 0.15 + personality.traits.aggression * 0.25 + personality.traits.adaptability * 0.2 - personality.traits.caution * 0.3;
        if (Math.random() > baitChance) {
            return false;
        }
        return true;
    }
    _startBait(context, personality) {
        this.isBaiting = true;
        this.baitStartTime = performance.now() / 1000;
        this.lastBaitTime = this.baitStartTime;
        // Calculate fake retreat position (5-10m backwards)
        const myPos = this.entity.getPosition();
        const toTarget = new Vec3().sub2(context.targetPosition, myPos).normalize();
        const retreatDirection = toTarget.clone().scale(-1);
        const retreatDistance = 5 + Math.random() * 5;
        this.baitPosition = myPos.clone().add(retreatDirection.scale(retreatDistance));
        // Move to bait position
        this.agent.moveTo(this.baitPosition);
        // Stop shooting during fake retreat (makes it convincing)
        if (this.agent.combatSystem) {
            this.agent.combatSystem.pauseShooting(2.0);
        }
        Logger.aiState(`[${this.entity.name}] 🎣 Baiting enemy (fake retreat)`);
    }
    _updateBait(dt, now, context) {
        const baitElapsed = now - this.baitStartTime;
        // Check if we've reached bait position or enough time passed
        const myPos = this.entity.getPosition();
        const distanceToBait = this.baitPosition ? myPos.distance(this.baitPosition) : 999;
        if (baitElapsed > 1.5 || distanceToBait < 2.0) {
            this._executeBaitAmbush(context);
        }
    }
    _executeBaitAmbush(context) {
        this.isBaiting = false;
        this.baitPosition = null;
        // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
        // Force combat system to resume shooting
        if (this.agent.combatSystem) {
            this.agent.combatSystem.resumeShooting();
            this.agent.combatSystem.requestShot();
        }
        Logger.aiState(`[${this.entity.name}] 💥 Ambush! Turning to attack`);
    }
    // ============================================================================
    // SUPPRESSION FIRE
    // ============================================================================
    _evaluateSuppressionOpportunity(now, context, personality) {
        // Check cooldown
        if (now - this.lastSuppressionTime < this.suppressionCooldown) {
            return false;
        }
        // Must have target but NOT direct line of sight (they're in cover)
        if (!context.hasTarget || context.targetVisible) {
            return false;
        }
        // Must have adequate ammo (suppression wastes bullets)
        if (!this.agent.utilities || !this.agent.utilities.hasAdequateAmmo()) {
            return false;
        }
        // Must know approximate target position
        if (!context.targetPosition && !context.lastKnownTargetPosition) {
            return false;
        }
        // Personality affects suppression use
        // Aggressive agents suppress more, cautious agents conserve ammo
        const suppressChance = 0.25 + personality.traits.aggression * 0.35 + personality.traits.teamwork * 0.2 - personality.traits.caution * 0.4;
        if (Math.random() > suppressChance) {
            return false;
        }
        return true;
    }
    _startSuppression(context, personality) {
        this.isSuppressing = true;
        this.suppressionStartTime = performance.now() / 1000;
        this.lastSuppressionTime = this.suppressionStartTime;
        // Use last known position if target not visible
        this.suppressionTarget = context.targetPosition || context.lastKnownTargetPosition;
        // Suppression duration varies by personality (2-5 seconds)
        this.suppressionDuration = 2.0 + personality.traits.aggression * 3.0;
        Logger.aiState(`[${this.entity.name}] 🔫 Suppressing target area for ${this.suppressionDuration.toFixed(1)}s`);
    }
    _updateSuppression(dt, now, context) {
        const suppressionElapsed = now - this.suppressionStartTime;
        // Fire periodically at target area with spread
        if (this.suppressionTarget && this.agent.combatSystem) {
            const spread = new Vec3((Math.random() - 0.5) * 4.0, (Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 4.0);
            this.suppressionTarget.clone().add(spread);
            // ✅ REMOVED: Rotation now handled by NavigationAdapter (prevents flickering)
            // Request shot with lower accuracy (suppression, not precision)
            this.agent.combatSystem.requestShot(0.3);
        }
        // End suppression after duration
        if (suppressionElapsed >= this.suppressionDuration) {
            this._endSuppression();
        }
    }
    _endSuppression() {
        this.isSuppressing = false;
        this.suppressionTarget = null;
        Logger.aiDetail(`[${this.entity.name}] Suppression complete`);
    }
    // ============================================================================
    // COVER POSITION ROTATION
    // ============================================================================
    _checkCoverRotation(now, context) {
        // Track when we entered current cover
        if (!this.currentCoverPosition || !this.coverEntryTime) {
            this.currentCoverPosition = this.entity.getPosition().clone();
            this.coverEntryTime = now;
            this.nextCoverRotationTime = now + this._calculateNextCoverRotationDelay();
            return;
        }
        // Check if it's time to rotate
        if (now < this.nextCoverRotationTime) {
            return;
        }
        // Don't rotate if recently moved
        if (now - this.lastCoverRotationTime < 5.0) {
            return;
        }
        this._rotateCoverPosition(context);
    }
    _rotateCoverPosition(context) {
        const myPos = this.entity.getPosition();
        // Find new cover position 5-15m away
        const newCover = this._findNewCoverPosition(myPos, context);
        if (newCover) {
            this.agent.moveTo(newCover);
            this.agent.isInCover = false; // Will be set true when reaching new cover
            this.lastCoverRotationTime = performance.now() / 1000;
            this.coverEntryTime = 0;
            this.currentCoverPosition = null;
            this.nextCoverRotationTime = this.lastCoverRotationTime + this._calculateNextCoverRotationDelay();
            Logger.aiState(`[${this.entity.name}] 🔄 Rotating to new cover position`);
        }
    }
    _findNewCoverPosition(currentPos, context) {
        // Try to find cover that's not current position
        const searchRadius = 15;
        const minDistance = 5;
        // Generate candidate positions in a circle around current position
        const candidates = [];
        const numCandidates = 8;
        for(let i = 0; i < numCandidates; i++){
            const angle = i / numCandidates * Math.PI * 2;
            const distance = minDistance + Math.random() * (searchRadius - minDistance);
            const candidate = currentPos.clone().add(new Vec3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
            candidates.push(candidate);
        }
        // Use navigation system to validate positions
        if (this.agent.utilities && this.agent.utilities.findValidNavMeshPosition) {
            for (const candidate of candidates){
                const validPos = this.agent.utilities.findValidNavMeshPosition(candidate, 5);
                if (validPos) {
                    return validPos;
                }
            }
        }
        return null;
    }
    _calculateNextCoverRotationDelay() {
        const personality = this.agent.personalitySystem;
        if (!personality) {
            return this.coverRotationIntervalMin;
        }
        // Adaptable agents rotate more frequently
        const baseDelay = this.coverRotationIntervalMin + Math.random() * (this.coverRotationIntervalMax - this.coverRotationIntervalMin);
        const personalityModifier = 1.0 + personality.traits.caution * 0.5 - personality.traits.adaptability * 0.3;
        return baseDelay * personalityModifier;
    }
    // ============================================================================
    // TACTICAL OPPORTUNITY EVALUATION
    // ============================================================================
    _evaluateTacticalOpportunities(now, context, personality) {
        if (!personality) return;
        // Priority order (only one tactic at a time)
        // 1. Suppression (keeping enemy pinned)
        if (this._evaluateSuppressionOpportunity(now, context, personality)) {
            this._startSuppression(context, personality);
            return;
        }
        // 2. Baiting (lure enemy into ambush)
        if (this._evaluateBaitOpportunity(now, context, personality)) {
            this._startBait(context, personality);
            return;
        }
        // 3. Peeking (quick exposure for shot)
        if (this._evaluatePeekOpportunity(now, context, personality)) {
            this._startPeek(context, personality);
            return;
        }
    }
    // ============================================================================
    // UTILITIES
    // ============================================================================
    _isInTacticalMode() {
        return this.isPeeking || this.isBaiting || this.isSuppressing;
    }
    _isNearCover(context) {
        return context.nearestCover && context.nearestCover.distance < 3.0;
    }
    _resetTacticalStates() {
        if (this.isPeeking) {
            this._endPeek();
        }
        if (this.isBaiting) {
            this.isBaiting = false;
            this.baitPosition = null;
        }
        if (this.isSuppressing) {
            this._endSuppression();
        }
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    getDebugInfo() {
        return {
            isPeeking: this.isPeeking,
            isBaiting: this.isBaiting,
            isSuppressing: this.isSuppressing,
            inTacticalMode: this._isInTacticalMode(),
            lastPeekTime: this.lastPeekTime,
            lastBaitTime: this.lastBaitTime,
            lastSuppressionTime: this.lastSuppressionTime,
            nextCoverRotationTime: this.nextCoverRotationTime
        };
    }
    /**
     * Clean up
     */ destroy() {
        this._resetTacticalStates();
        this.agent = null;
        this.entity = null;
    }
    constructor(agent){
        this.agent = agent;
        this.entity = agent.entity;
        // Peeking state
        this.isPeeking = false;
        this.peekDirection = null;
        this.lastPeekTime = 0;
        this.peekDuration = 0;
        this.peekCooldown = 0;
        this.originalPosition = null;
        // Baiting state
        this.isBaiting = false;
        this.baitStartTime = 0;
        this.baitPosition = null;
        this.lastBaitTime = 0;
        // Suppression state
        this.isSuppressing = false;
        this.suppressionStartTime = 0;
        this.suppressionTarget = null;
        this.lastSuppressionTime = 0;
        // Cover rotation state
        this.currentCoverPosition = null;
        this.coverEntryTime = 0;
        this.nextCoverRotationTime = 0;
        this.lastCoverRotationTime = 0;
        // Timing parameters (will be modified by personality)
        this.peekIntervalMin = 3.0;
        this.peekIntervalMax = 8.0;
        this.baitCooldown = 20.0; // seconds
        this.suppressionCooldown = 15.0;
        this.coverRotationIntervalMin = 8.0;
        this.coverRotationIntervalMax = 15.0;
        Logger.debug(`[${this.entity.name}] AdvancedTacticsSystem initialized`);
    }
}

export { AdvancedTacticsSystem };
