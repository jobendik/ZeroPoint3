///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: INTERNAL MODULE - Core health logic and calculations
DOMAIN: Health System
DEPENDENCIES: ['pc', 'globalThis.Logger']
EXPORTS: ['HealthCore']
GPT_CONTEXT: Contains core health management logic including damage processing, health calculations, hit deduplication, friendly fire detection, and invincibility systems. This module handles the essential mathematical and logical operations for health management while being completely independent of visual effects and events.
*/ class HealthCore {
    // ============================================================================
    // DAMAGE PROCESSING
    // ============================================================================
    takeDamage(damage, attacker, hitId, frameId, isShotgunPellet = false, isHeadshot = false) {
        let attackerId = attacker ? attacker.getGuid() : 'unknown';
        let attackerName = attacker ? attacker.name || `Entity_${attackerId.substring(0, 8)}` : 'unknown';
        // 🎯 Debug log for shotgun pellets
        if (isShotgunPellet) {
            console.log(`🎯 [HealthCore] ${this.entityName} received shotgun pellet flag: isShotgunPellet=${isShotgunPellet}, damage=${damage}`);
        }
        // 💀 HEADSHOT SYSTEM: Log and store headshot flag for this attacker
        if (isHeadshot) {
            console.log(`💀 [HealthCore] ${this.entityName} received HEADSHOT from ${attackerName}, damage=${damage}`);
            this.headshotByAttacker.set(attackerId, true);
        }
        // Try to recover attacker from hitId
        if (!attacker && hitId) {
            const parts = String(hitId).split('_');
            if (parts.length >= 1) {
                const maybeGuid = parts[0];
                const maybeAttacker = this.app.root.findByGuid && this.app.root.findByGuid(maybeGuid);
                if (maybeAttacker) {
                    attacker = maybeAttacker;
                    attackerId = maybeGuid;
                    attackerName = attacker.name || `Entity_${attackerId.substring(0, 8)}`;
                    this.Logger.health?.(`[HealthCore] Recovered attacker from hitId: ${attackerName}#${attackerId.substring(0, 8)}`) || this.Logger.debug?.(`[HealthCore] Recovered attacker from hitId: ${attackerName}#${attackerId.substring(0, 8)}`);
                }
            }
        }
        // Check friendly fire
        if (attacker && this._isFriendlyFire(attacker, this.entity)) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} blocked friendly fire from ${attackerName}#${attackerId.substring(0, 8)}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} blocked friendly fire from ${attackerName}#${attackerId.substring(0, 8)}`);
            return;
        }
        // Reject duplicates by hitId
        if (hitId && this.processedHitIds.has(hitId)) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} BLOCKED duplicate hit ${hitId}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} BLOCKED duplicate hit ${hitId}`);
            return;
        }
        this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} takeDamage ${damage} from ${attackerName}#${attackerId.substring(0, 8)} hitId=${hitId || 'NONE'}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} takeDamage ${damage} from ${attackerName}#${attackerId.substring(0, 8)} hitId=${hitId || 'NONE'}`);
        // Ignore invalid/blocked cases
        if (this._shouldIgnoreDamage(attacker)) return;
        // Record hitId into sliding de-dupe window
        if (hitId) {
            this._recordHitId(hitId);
        }
        const now = performance.now() / 1000;
        // ✅ CRITICAL FIX: GLOBAL invincibility check for players (prevents multiple AI melting player)
        // Player gets 1.5s invincibility after ANY damage from ANY source
        if (this.isPlayer && this.globalInvincibilityTime > 0) {
            const timeSinceLastDamage = now - this.lastGlobalDamageTime;
            if (this.lastGlobalDamageTime > 0 && timeSinceLastDamage < this.globalInvincibilityTime) {
                console.log(`[HealthCore] 🛡️ PLAYER GLOBAL INVINCIBILITY: ${this.entityName} is invincible for ${(this.globalInvincibilityTime - timeSinceLastDamage).toFixed(2)}s more (any attacker)`);
                this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} GLOBAL invincibility active (${timeSinceLastDamage.toFixed(3)}s < ${this.globalInvincibilityTime}s) - blocking ${attackerName}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} GLOBAL invincibility active (${timeSinceLastDamage.toFixed(3)}s < ${this.globalInvincibilityTime}s) - blocking ${attackerName}`);
                return;
            }
        }
        // ✅ Per-attacker invincibility check (prevents duplicate hits from same attacker)
        // This is used by both AI (40ms) and Player (1.5s per-attacker as additional safety)
        // 🎯 BYPASS for shotgun pellets - they fire multiple in one shot and should all count
        if (!isShotgunPellet) {
            const last = this.invincibilityByAttacker.get(attackerId);
            if (last && now - last < this.invincibilityTime) {
                this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} per-attacker invincible vs ${attackerName}#${attackerId.substring(0, 8)} (${(now - last).toFixed(3)}s < ${this.invincibilityTime}s)`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} per-attacker invincible vs ${attackerName}#${attackerId.substring(0, 8)} (${(now - last).toFixed(3)}s < ${this.invincibilityTime}s)`);
                return;
            }
        } else {
            // Debug log for shotgun pellets bypassing invincibility
            console.log(`🎯 [HealthCore] ${this.entityName} allowing shotgun pellet (${damage.toFixed(1)} damage) from ${attackerName}`);
        }
        // Update both global and per-attacker invincibility timers
        // 🎯 Don't update per-attacker timer for shotgun pellets (allows all pellets to hit)
        if (this.isPlayer) {
            this.lastGlobalDamageTime = now;
        }
        if (!isShotgunPellet) {
            this.invincibilityByAttacker.set(attackerId, now);
        }
        // Accumulate damage for this frame
        const key = attackerId;
        const prev = this.pendingDamage.get(key) || 0;
        const uncappedNext = prev + (damage || 0);
        const next = Math.min(uncappedNext, this.maxHealth || 999999);
        this.pendingDamage.set(key, next);
        this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} accumulated ${damage} from ${attackerName}#${attackerId.substring(0, 8)} (frame total: ${next})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} accumulated ${damage} from ${attackerName}#${attackerId.substring(0, 8)} (frame total: ${next})`);
        // Return damage info object for immediate event firing
        // Note: Actual health reduction happens in processAccumulatedDamage()
        return {
            actualDamage: damage,
            attacker: attacker,
            attackerId: attackerId,
            attackerName: attackerName,
            hitId: hitId,
            frameId: frameId,
            oldHealth: this.currentHealth,
            newHealth: Math.max(0, this.currentHealth - damage),
            entity: this.entity,
            isDead: this.currentHealth - damage <= 0
        };
    }
    processAccumulatedDamage() {
        if (this.pendingDamage.size === 0 || this.lastProcessedFrame === this.currentFrame) {
            return null;
        }
        this.lastProcessedFrame = this.currentFrame;
        const frameSummary = {
            frame: this.currentFrame,
            targetId: this.entityId,
            targetName: this.entityName,
            damageBySource: {},
            hitsProcessed: 0,
            hitsFromRegistry: 0,
            totalDamageRequested: 0,
            totalDamageApplied: 0,
            remainingHPAtStart: this.currentHealth
        };
        // Calculate total requested damage and cap to remaining HP
        let totalRequestedDamage = 0;
        this.pendingDamage.forEach((damage)=>{
            totalRequestedDamage += damage;
        });
        frameSummary.totalDamageRequested = totalRequestedDamage;
        // Cap total damage to remaining health to prevent overkill
        const maxApplicableDamage = Math.max(0, this.currentHealth);
        const cappedTotalDamage = Math.min(totalRequestedDamage, maxApplicableDamage);
        if (cappedTotalDamage <= 0) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING damage flush - already dead or no damage (requested: ${totalRequestedDamage}, HP: ${this.currentHealth})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING damage flush - already dead or no damage (requested: ${totalRequestedDamage}, HP: ${this.currentHealth})`);
            this.pendingDamage.clear();
            return null;
        }
        // Proportionally distribute capped damage among attackers
        const damageMultiplier = cappedTotalDamage / totalRequestedDamage;
        let totalAppliedDamage = 0;
        this.pendingDamage.forEach((totalDamage, attackerKey)=>{
            if (totalDamage > 0 && this.currentHealth > 0) {
                const cappedDamage = Math.floor(totalDamage * damageMultiplier);
                if (cappedDamage <= 0) return;
                let attacker = null;
                let attackerName = 'unknown';
                if (attackerKey !== 'unknown') {
                    attacker = this.app.root.findByGuid(attackerKey);
                    // Try hit registry as secondary source
                    if (!attacker && this.app.hitRegistry) {
                        for (const [hitId, hitData] of this.app.hitRegistry.hits.entries()){
                            if (hitData.attacker === attackerKey && hitData.target === this.entityId && !hitData.applied) {
                                attacker = this.app.root.findByGuid(hitData.attacker);
                                if (attacker) {
                                    this.Logger.health?.(`[HealthCore] Recovered attacker from hit registry: ${hitId}`) || this.Logger.debug?.(`[HealthCore] Recovered attacker from hit registry: ${hitId}`);
                                    frameSummary.hitsFromRegistry++;
                                    break;
                                }
                            }
                        }
                    }
                    attackerName = attacker ? attacker.name || `Entity_${attackerKey.substring(0, 8)}` : `Unknown_${attackerKey.substring(0, 8)}`;
                }
                // Skip truly unknown sources
                if (attackerKey === 'unknown' && !attacker) {
                    this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING accumulated damage from unknown source (${cappedDamage})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING accumulated damage from unknown source (${cappedDamage})`);
                    return;
                }
                // Record in frame summary
                frameSummary.damageBySource[attackerName] = cappedDamage;
                frameSummary.hitsProcessed++;
                totalAppliedDamage += cappedDamage;
                // Apply the damage
                const hitId = `accumulated_${this.entityId}_${this.currentFrame}_${attackerKey}`;
                this._applyDamageInternal(cappedDamage, attacker, hitId);
            }
        });
        frameSummary.totalDamageApplied = totalAppliedDamage;
        if (Object.keys(frameSummary.damageBySource).length > 0) {
            const damageEntries = Object.entries(frameSummary.damageBySource).map(([source, damage])=>`${source}: ${damage}`).join(', ');
            const cappingInfo = totalRequestedDamage !== totalAppliedDamage ? ` (CAPPED from ${totalRequestedDamage} to ${totalAppliedDamage})` : '';
            this.Logger.health?.(`[HealthCore] Frame ${this.currentFrame} summary for ${this.entityName}#${this.entityId.substring(0, 8)} - ${frameSummary.hitsProcessed} hits (${frameSummary.hitsFromRegistry} from registry) - {${damageEntries}}${cappingInfo}`) || this.Logger.debug?.(`[HealthCore] Frame ${this.currentFrame} summary for ${this.entityName}#${this.entityId.substring(0, 8)} - ${frameSummary.hitsProcessed} hits (${frameSummary.hitsFromRegistry} from registry) - {${damageEntries}}${cappingInfo}`);
        }
        this.pendingDamage.clear();
        return Object.keys(frameSummary.damageBySource).length > 0 ? frameSummary : null;
    }
    _applyDamageInternal(totalDamage, attacker, hitId) {
        // Early exit if already dead
        if (this.isDead || this.currentHealth <= 0) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} BLOCKED damage - already dead (HP: ${this.currentHealth})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} BLOCKED damage - already dead (HP: ${this.currentHealth})`);
            return;
        }
        // Double-check we should still apply damage
        if (this._shouldIgnoreDamage(attacker)) {
            return;
        }
        // Clamp damage to remaining health
        const remainingHealth = Math.max(0, this.currentHealth);
        const actualDamage = Math.min(Math.max(0, totalDamage), remainingHealth);
        // Don't count zero-damage applies
        if (actualDamage <= 0) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING zero damage (requested: ${totalDamage}, remaining HP: ${remainingHealth})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} SKIPPING zero damage (requested: ${totalDamage}, remaining HP: ${remainingHealth})`);
            return;
        }
        const oldHealth = this.currentHealth;
        this.currentHealth = Math.max(0, this.currentHealth - actualDamage);
        this.lastDamageTime = performance.now() / 1000;
        this.lastDamageTimeForRegen = this.lastDamageTime;
        // ✅ EXPLICIT LOGGING: Show when health is ACTUALLY subtracted
        console.log(`[HealthCore] 💥 HEALTH ACTUALLY SUBTRACTED for ${this.entityName}: damage=${actualDamage.toFixed(1)}, healthBEFORE=${oldHealth.toFixed(1)}, healthAFTER=${this.currentHealth.toFixed(1)} (REAL VALUES, not predicted)`);
        this.lastAttacker = attacker;
        const attackerId = attacker ? attacker.getGuid() : 'unknown';
        const attackerName = attacker ? attacker.name || `Entity_${attackerId.substring(0, 8)}` : 'unknown';
        // Update per-attacker invincibility
        this.invincibilityByAttacker.set(attackerId, this.lastDamageTime);
        // Update hit registry if it exists
        if (this.app.hitRegistry && hitId && !hitId.startsWith('accumulated_')) {
            const hitRecord = this.app.hitRegistry.hits.get(hitId);
            if (hitRecord) {
                hitRecord.applied = true;
            }
        }
        // Increment damage counter
        this.damageApplicationCount++;
        this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} health: ${oldHealth} -> ${this.currentHealth} (took ${actualDamage} capped damage from ${attackerName}#${attackerId.substring(0, 8)})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} health: ${oldHealth} -> ${this.currentHealth} (took ${actualDamage} capped damage from ${attackerName}#${attackerId.substring(0, 8)})`);
        // Check for death
        if (this.currentHealth <= 0) {
            // ✅ IDEMPOTENT CHECK: Don't process death if already dead
            if (this.isDead) {
                console.log(`[HealthCore] ⚠️ Death condition met but entity already marked dead - skipping duplicate death processing for ${this.entityName}`);
                return;
            }
            console.log(`[HealthCore] 💀 DEATH DETECTED! ${this.entityName} health=${this.currentHealth}, killer=${attackerName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} died from damage by ${attackerName}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} died from damage by ${attackerName}`);
            // ✅ FIX: Call parent HealthSystem.onDeath to trigger events, not internal onDeath
            if (this.entity.script && this.entity.script.healthSystem && typeof this.entity.script.healthSystem.onDeath === 'function') {
                console.log(`[HealthCore] ✅ Found parent HealthSystem, calling onDeath to fire entity:died event`);
                this.Logger.health?.(`[HealthCore] Calling parent HealthSystem.onDeath to trigger entity:died events`) || this.Logger.debug?.(`[HealthCore] Calling parent HealthSystem.onDeath to trigger entity:died events`);
                this.entity.script.healthSystem.onDeath(attacker);
            } else {
                console.log(`[HealthCore] ❌ NO parent HealthSystem found! entity.script=${!!this.entity.script}, healthSystem=${!!this.entity.script?.healthSystem}`);
                // Fallback to internal death handling if parent not available
                this.Logger.error?.(`[HealthCore] ⚠️ No parent HealthSystem found - calling internal onDeath (events may not fire!)`) || this.Logger.warn?.(`[HealthCore] ⚠️ No parent HealthSystem found - calling internal onDeath (events may not fire!)`);
                this.onDeath(attacker);
            }
            return;
        }
        // Return damage info for effects/events
        return {
            actualDamage,
            oldHealth,
            newHealth: this.currentHealth,
            attacker,
            attackerId,
            attackerName,
            hitId
        };
    }
    // ============================================================================
    // HEALING AND HEALTH MANAGEMENT
    // ============================================================================
    heal(amount) {
        if (this.isDead || this.isBeingDestroyed) return 0;
        const oldHealth = this.currentHealth;
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
        const actualHealing = this.currentHealth - oldHealth;
        if (actualHealing > 0) {
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} healed ${actualHealing} (${this.currentHealth}/${this.maxHealth})`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} healed ${actualHealing} (${this.currentHealth}/${this.maxHealth})`);
        }
        return actualHealing;
    }
    regenerateHealth(dt) {
        // ✅ FIX: Only regenerate if explicitly enabled
        if (!this.enableHealthRegen) return 0;
        // 🔥 CRITICAL FIX: BLOCK AI HEALTH REGENERATION COMPLETELY
        if (this.isAI) {
            console.error(`❌ CRITICAL BUG DETECTED: AI agent "${this.entityName}" attempting health regeneration!`);
            console.error(`   This should NEVER happen - AI must use medkits only!`);
            console.error(`   Health Regen Rate: ${this.healthRegenRate}, Enabled: ${this.enableHealthRegen}`);
            console.trace('AI Health Regen Stack Trace:');
            return 0; // Block AI regeneration completely
        }
        if (this.isDead || this.isBeingDestroyed) return 0;
        const regenAmount = this.healthRegenRate * dt;
        const oldHealth = this.currentHealth;
        this.currentHealth = Math.min(this.currentHealth + regenAmount, this.maxHealth);
        const actualRegen = this.currentHealth - oldHealth;
        // Log player regeneration for debugging
        if (actualRegen > 0) {
            this.Logger.debug?.(`[HealthRegen] ${this.entityName} regenerated ${actualRegen.toFixed(1)} HP (${this.currentHealth.toFixed(1)}/${this.maxHealth})`) || console.log(`💚 [HealthRegen] ${this.entityName} +${actualRegen.toFixed(1)} HP (${this.currentHealth.toFixed(1)}/${this.maxHealth})`);
        }
        return actualRegen;
    }
    resetHealth() {
        // Mark as respawning to prevent damage during reset
        this.isRespawning = true;
        this.currentHealth = this.maxHealth;
        this.isDead = false;
        this.isInvincible = false;
        this.lastDamageTime = 0;
        this.lastDamageTimeForRegen = 0;
        this.lastAttacker = null;
        // Clear hit deduplication on respawn
        this.processedHitIds.clear();
        this.hitIdHistory = [];
        // Clear per-attacker invincibility
        this.invincibilityByAttacker.clear();
        // ✅ Clear global invincibility timer
        this.lastGlobalDamageTime = 0;
        // Clear any pending damage
        this.clearAllPendingDamage();
        this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} health reset to ${this.maxHealth} (hit history and invincibility cleared)`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} health reset to ${this.maxHealth} (hit history and invincibility cleared)`);
        // Set respawning flag with timeout
        setTimeout(()=>{
            if (this.isBeingDestroyed) return;
            this.isRespawning = false;
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} respawn completed, can take damage again`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} respawn completed, can take damage again`);
        }, 100);
    }
    // ============================================================================
    // DEATH HANDLING
    // ============================================================================
    onDeath(attacker) {
        // ✅ IDEMPOTENT CHECK: Prevent multiple death processing
        if (this.isDead) {
            console.log(`[HealthCore] ⚠️ onDeath() called but entity already dead - ignoring duplicate for ${this.entityName}`);
            return null; // Return null to signal this is a duplicate
        }
        this.isDead = true;
        this.currentHealth = 0;
        const attackerName = attacker ? attacker.name || `Entity_${attacker.getGuid().substring(0, 8)}` : 'unknown';
        const attackerId = attacker ? attacker.getGuid() : 'unknown';
        // 💀 HEADSHOT SYSTEM: Check if this death was from a headshot
        const wasHeadshot = attackerId !== 'unknown' ? this.headshotByAttacker.get(attackerId) || false : false;
        if (wasHeadshot) {
            console.log(`💀 [HealthCore] ${this.entityName} died from HEADSHOT by ${attackerName}`);
        }
        this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} died from damage by ${attackerName}${wasHeadshot ? ' (HEADSHOT)' : ''}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} died from damage by ${attackerName}${wasHeadshot ? ' (HEADSHOT)' : ''}`);
        // 🎬 TRIGGER DEATH ANIMATION (for AI agents with AnimationController)
        if (this.entity.script && this.entity.script.animationController) {
            console.log(`[HealthCore] 🎬 Triggering death animation for ${this.entityName}`);
            try {
                this.entity.script.animationController.animComponent.setBoolean('isDead', true);
                console.log(`[HealthCore] ✅ Death animation parameter set for ${this.entityName}`);
            } catch (error) {
                console.warn(`[HealthCore] ⚠️ Failed to trigger death animation for ${this.entityName}:`, error);
            }
        }
        // Stop all further damage processing immediately
        this.clearAllPendingDamage();
        this.invincibilityByAttacker.clear();
        this.headshotByAttacker.clear(); // Clear headshot tracking
        this.lastGlobalDamageTime = 0; // Reset global invincibility on death
        return {
            entity: this.entity,
            attacker,
            attackerName,
            position: this.entity.getPosition(),
            targetId: this.entityId,
            targetName: this.entityName,
            isHeadshot: wasHeadshot // 💀 HEADSHOT SYSTEM: Include in death info
        };
    }
    // ============================================================================
    // VALIDATION AND UTILITY METHODS
    // ============================================================================
    _shouldIgnoreDamage(attacker) {
        console.log(`[HealthCore] 🔍 _shouldIgnoreDamage() called for ${this.entityName}, attacker=${attacker?.name}`);
        console.log(`[HealthCore] Damage checks: isDead=${this.isDead}, isBeingDestroyed=${this.isBeingDestroyed}, entity.enabled=${this.entity?.enabled}, isRespawning=${this.isRespawning}`);
        if (this.isDead) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - isDead=true for ${this.entityName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is already dead, ignoring damage`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is already dead, ignoring damage`);
            return true;
        }
        if (this.isBeingDestroyed) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - isBeingDestroyed=true for ${this.entityName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is being destroyed, ignoring damage`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is being destroyed, ignoring damage`);
            return true;
        }
        if (!this.entity.enabled) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - entity.enabled=false for ${this.entityName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is disabled, ignoring damage`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is disabled, ignoring damage`);
            return true;
        }
        if (this.isRespawning) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - isRespawning=true for ${this.entityName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is respawning, ignoring damage`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} is respawning, ignoring damage`);
            return true;
        }
        try {
            this.entity.getPosition();
        } catch (e) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - invalid position for ${this.entityName}, error=${e.message}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} has invalid position, ignoring damage`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} has invalid position, ignoring damage`);
            return true;
        }
        if (attacker && this._isFriendlyFire(attacker, this.entity)) {
            console.log(`[HealthCore] ❌ IGNORING DAMAGE - friendly fire from ${attacker.name} to ${this.entityName}`);
            this.Logger.health?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} ignoring friendly fire from ${attacker.name}`) || this.Logger.debug?.(`[HealthCore] ${this.entityName}#${this.entityId.substring(0, 8)} ignoring friendly fire from ${attacker.name}`);
            return true;
        }
        console.log(`[HealthCore] ✅ DAMAGE ALLOWED for ${this.entityName}`);
        return false;
    }
    _isFriendlyFire(attackerEntity, targetEntity) {
        if (!attackerEntity || !targetEntity) return false;
        // Self-damage check
        try {
            if (attackerEntity.getGuid() === targetEntity.getGuid()) {
                return true;
            }
        } catch (e) {
            if (attackerEntity === targetEntity) return true;
        }
        // Team-based checks
        if (attackerEntity.team && targetEntity.team) {
            if (attackerEntity.team === targetEntity.team) {
                return true;
            }
            if (attackerEntity.team === 'ai' && targetEntity.team === 'ai') {
                return true;
            }
        }
        // Tag-based team identification
        if (attackerEntity.tags && targetEntity.tags) {
            const attackerIsAI = attackerEntity.tags.has('team_ai') || attackerEntity.tags.has('faction_ai');
            const targetIsAI = targetEntity.tags.has('team_ai') || targetEntity.tags.has('faction_ai');
            if (attackerIsAI && targetIsAI) {
                return true;
            }
            const attackerIsPlayer = attackerEntity.tags.has('team_player') || attackerEntity.tags.has('player');
            const targetIsPlayer = targetEntity.tags.has('team_player') || targetEntity.tags.has('player');
            if (attackerIsPlayer && targetIsPlayer) {
                return true;
            }
        }
        // Script-based identification (fallback)
        const attackerIsAI = !!(attackerEntity.script && attackerEntity.script.aiAgent);
        const targetIsAI = !!(targetEntity.script && targetEntity.script.aiAgent);
        const attackerIsPlayer = !!(attackerEntity.script && (attackerEntity.script.player || attackerEntity.script.playerController));
        const targetIsPlayer = !!(targetEntity.script && (targetEntity.script.player || targetEntity.script.playerController));
        if (attackerIsAI && targetIsAI) {
            return true;
        }
        if (attackerIsPlayer && targetIsPlayer) {
            return true;
        }
        return false;
    }
    _recordHitId(hitId) {
        this.processedHitIds.add(hitId);
        this.hitIdHistory.push(hitId);
        // Maintain sliding window size
        if (this.hitIdHistory.length > 32) {
            const oldestHitId = this.hitIdHistory.shift();
            this.processedHitIds.delete(oldestHitId);
        }
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    getHealthPercent() {
        return this.currentHealth / this.maxHealth;
    }
    isAlive() {
        return !this.isDead && !this.isBeingDestroyed;
    }
    isLowHealth(threshold = 0.3) {
        return this.getHealthPercent() < threshold;
    }
    isCriticalHealth(threshold = 0.15) {
        return this.getHealthPercent() < threshold;
    }
    canPickupHealth() {
        const healthRatio = this.currentHealth / this.maxHealth;
        const canPickup = !this.isDead && !this.isBeingDestroyed && healthRatio < 0.95;
        this.Logger.aiDetail?.(`[${this.entityName}] Can pickup health: ${canPickup} (${this.currentHealth}/${this.maxHealth} = ${(healthRatio * 100).toFixed(0)}%)`) || this.Logger.debug?.(`[${this.entityName}] Can pickup health: ${canPickup} (${this.currentHealth}/${this.maxHealth} = ${(healthRatio * 100).toFixed(0)}%)`);
        return canPickup;
    }
    // Update frame counter
    updateFrame() {
        this.currentFrame++;
        // Clean up old per-attacker invincibility entries
        if (this.invincibilityByAttacker.size > 0) {
            const now = performance.now() / 1000;
            const cutoff = now - this.invincibilityTime * 2;
            for (const [attackerId, lastHitTime] of this.invincibilityByAttacker.entries()){
                if (lastHitTime < cutoff) {
                    this.invincibilityByAttacker.delete(attackerId);
                }
            }
        }
    }
    clearAllPendingDamage() {
        if (this.pendingDamage.size > 0) {
            this.Logger.health?.(`[HealthCore] Cleared ${this.pendingDamage.size} pending damage entries for ${this.entityName}#${this.entityId.substring(0, 8)}`) || this.Logger.debug?.(`[HealthCore] Cleared ${this.pendingDamage.size} pending damage entries for ${this.entityName}#${this.entityId.substring(0, 8)}`);
            this.pendingDamage.clear();
        }
    }
    getDamageStats() {
        return {
            entityName: this.entityName,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
            damageApplications: this.damageApplicationCount,
            hitsDeduplicated: this.hitIdHistory.length,
            pendingDamage: this.pendingDamage.size,
            invincibilityTracking: this.invincibilityByAttacker.size
        };
    }
    // Cleanup method
    destroy() {
        this.clearAllPendingDamage();
        this.invincibilityByAttacker.clear();
        this.processedHitIds.clear();
        this.hitIdHistory = [];
        this.isBeingDestroyed = true;
    }
    constructor(entity, app, config = {}){
        this.entity = entity;
        this.app = app; // Explicitly passed app reference
        this.Logger = globalThis.Logger || console;
        // Apply configuration
        this.maxHealth = config.maxHealth || 100;
        this.startingHealth = config.startingHealth || config.maxHealth || 100;
        // ✅ FIX: Separate invincibility times for AI vs Player
        // AI gets short invincibility (40ms) to prevent duplicate damage from single shots
        // Player gets longer invincibility (1.5s) to prevent instant melting from rapid AI attacks
        if (entity.script && (entity.script.player || entity.script.playerController || entity.script.fpsPlayer)) {
            this.invincibilityTime = config.invincibilityTime || 1.5; // 1.5 seconds for player
        } else {
            this.invincibilityTime = config.invincibilityTime || 0.04; // 40ms for AI
        }
        // Entity identification
        this.entityId = entity.getGuid();
        this.entityName = entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        // Core state
        this.currentHealth = this.startingHealth;
        this.isDead = false;
        this.isInvincible = false;
        this.lastDamageTime = 0;
        this.isBeingDestroyed = false;
        this.isRespawning = false;
        this.lastAttacker = null;
        this.damageApplicationCount = 0;
        // Damage accumulation and processing
        this.pendingDamage = new Map();
        this.currentFrame = 0;
        this.lastProcessedFrame = -1;
        // Hit deduplication tracking
        this.processedHitIds = new Set();
        this.hitIdHistory = [];
        // Per-attacker invincibility tracking (prevents duplicate hits from same attacker)
        this.invincibilityByAttacker = new Map();
        // 💀 HEADSHOT SYSTEM: Track headshot flag per attacker for death event
        this.headshotByAttacker = new Map();
        // ✅ FIX: Global invincibility for players (prevents multiple AI melting player)
        // AI uses per-attacker only, Player uses BOTH per-attacker AND global
        this.lastGlobalDamageTime = 0;
        this.globalInvincibilityTime = this.isPlayer ? 1.5 : 0; // 1.5s global invincibility for player, none for AI
        // Health regeneration
        this.enableHealthRegen = config.enableHealthRegen || false;
        this.healthRegenRate = config.healthRegenRate || 0;
        this.healthRegenDelay = config.healthRegenDelay || 5;
        this.lastDamageTimeForRegen = 0;
        // Entity type detection
        this.isAI = !!(entity.script && entity.script.aiAgent);
        this.isPlayer = !!(entity.script && (entity.script.player || entity.script.playerController || entity.script.fpsPlayer));
        // Set consistent team assignment for friendly fire checks
        if (this.isPlayer) {
            this.entity.team = 'player';
            if (this.entity.tags && !this.entity.tags.has('team_player')) {
                this.entity.tags.add('team_player');
            }
        } else if (this.isAI) {
            this.entity.team = 'ai';
            if (this.entity.tags && !this.entity.tags.has('team_ai')) {
                this.entity.tags.add('team_ai');
            }
        }
    }
}

export { HealthCore };
