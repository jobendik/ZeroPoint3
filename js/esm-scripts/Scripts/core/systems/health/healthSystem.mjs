import { Script } from '../../../../../playcanvas-stable.min.mjs';
import { HealthCore } from './HealthCore.mjs';
import { HealthEffects } from './HealthEffects.mjs';
import { HealthEvents } from './HealthEvents.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';
import { Logger } from '../../engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
CONTRACT: FACADE - PlayCanvas Script facade for Health System
DOMAIN: Health System
DEPENDENCIES: ['pc', 'Script', './HealthCore.mjs', './HealthEffects.mjs', './HealthEvents.mjs', 'globalThis.Logger']
EXPORTS: ['HealthSystem']
GPT_CONTEXT: PlayCanvas Script facade that extends pc.ScriptType and delegates to internal health modules (HealthCore, HealthEffects, HealthEvents). Maintains exact PlayCanvas Script compatibility including scriptName, attributes, and lifecycle methods while providing a clean modular architecture. External code should only import this facade, never the internal modules directly.
*/ ///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
function _define_property(obj, key, value) {
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
class HealthSystem extends Script {
    // ============================================================================
    // LIFECYCLE - PlayCanvas Script lifecycle methods
    // ============================================================================
    initialize() {
        // Import Logger - compatible with both ESM and global access
        this.Logger = globalThis.Logger || console;
        const entityGuid = this.entity.getGuid();
        if (this.__healthSystemBooted) {
            this.Logger.debug(`[HealthSystem] Entity ${entityGuid.substring(0, 8)} already initialized, skipping`);
            return;
        }
        console.log(`[HealthSystem] 🔥 Initialize called for ${this.entity.name}`);
        this.Logger.debug(`[HealthSystem] Entity ${entityGuid.substring(0, 8)} initialize() - boot start`);
        // Create configuration object from attributes
        const config = {
            maxHealth: this.maxHealth,
            startingHealth: this.startingHealth,
            invincibilityTime: this.invincibilityTime,
            damageFlashColor: this.damageFlashColor,
            damageFlashDuration: this.damageFlashDuration,
            healthBarEntity: this.healthBarEntity,
            damageNumbers: this.damageNumbers,
            enableHealthRegen: this.enableHealthRegen,
            healthRegenRate: this.healthRegenRate,
            healthRegenDelay: this.healthRegenDelay
        };
        // Initialize internal modules - PASS this.app EXPLICITLY
        this.healthCore = new HealthCore(this.entity, this.app, config);
        this.healthEffects = new HealthEffects(this.entity, this.app, config);
        this.healthEvents = new HealthEvents(this.entity, this.app, config);
        // Wire up callbacks between modules
        this.healthEvents.setCallbacks({
            onDamageRequest: (damage, attacker, hitId, frameId, isShotgunPellet, isHeadshot)=>{
                this.takeDamage(damage, attacker, hitId, frameId, isShotgunPellet, isHeadshot);
            },
            onHealthRequest: (type, amount)=>{
                if (type === 'apply') {
                    this.heal(amount);
                } else if (type === 'reset') {
                    this.resetHealth();
                }
            }
        });
        // Store initial state
        this.initiallyEnabled = this.entity.enabled;
        // Setup event system and registration
        this.healthEvents.registerAsDamageable();
        this.healthEvents.setupEventListeners();
        // Cleanup handler
        this.entity.once && this.entity.once('destroy', this._onEntityDestroy, this);
        // Establish global access for backward compatibility
        this.app.healthSystem = this.app.healthSystem || this;
        this.Logger.debug(`[HealthSystem] Entity ${entityGuid.substring(0, 8)} initialize() complete`);
    }
    postInitialize() {
        const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        const name = this.entity && this.entity.name ? this.entity.name : 'Unknown';
        this.Logger.debug(`[HealthSystem] postInitialize START for ${name}`);
        try {
            // Link to other systems if they exist
            if (this.entity && this.entity.script) {
                const weaponSystem = this.entity.script.weaponSystem || null;
                const aiAgent = this.entity.script.aiAgent || null;
                const playerController = this.entity.script.player || this.entity.script.playerController || this.entity.script.fpsPlayer || null;
                // Link systems to events module for notifications
                this.healthEvents.linkToSystems(weaponSystem, aiAgent, playerController);
                // ✅ FIX: Ensure AI agents have proper collision setup
                if (aiAgent) {
                    this._ensureAICollisionSetup();
                }
            }
            // Mark as ready
            this.__healthSystemBooted = true;
            // Fire ready event
            this.healthEvents.fireReadyEvent();
            const duration = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - startTime;
            this.Logger.debug(`[HealthSystem] postInitialize COMPLETE for ${name} in ${duration.toFixed(1)}ms`);
        } catch (error) {
            this.Logger.error('[HealthSystem] postInitialize ERROR:', error);
            // Still mark as booted even on error to prevent deadlock
            this.__healthSystemBooted = true;
        }
    }
    // ✅ NEW: Ensure AI has proper collision setup for damage detection
    _ensureAICollisionSetup() {
        const name = this.entity.name;
        // Check for collision component
        if (!this.entity.collision) {
            this.Logger.error(`[HealthSystem] ⚠️ ${name} has NO collision component! Cannot receive damage.`);
            return;
        }
        // Ensure collision is enabled
        if (!this.entity.collision.enabled) {
            this.Logger.warn(`[HealthSystem] ${name} collision was disabled - enabling it`);
            this.entity.collision.enabled = true;
        }
        // Check for rigidbody component
        if (!this.entity.rigidbody) {
            this.Logger.warn(`[HealthSystem] ⚠️ ${name} has NO rigidbody component! Adding kinematic rigidbody.`);
        // Note: Can't add components at runtime in PlayCanvas, must be added in editor
        // But we can log the issue for debugging
        } else {
            // Ensure rigidbody is enabled and set to kinematic for AI
            if (!this.entity.rigidbody.enabled) {
                this.Logger.warn(`[HealthSystem] ${name} rigidbody was disabled - enabling it`);
                this.entity.rigidbody.enabled = true;
            }
            // AI should typically use kinematic rigidbodies
            if (this.entity.rigidbody.type !== 'kinematic') {
                this.Logger.info(`[HealthSystem] ${name} rigidbody type: ${this.entity.rigidbody.type}`);
            }
        }
        // Verify entity tags for team identification
        if (!this.entity.tags.has('damageable')) {
            this.Logger.warn(`[HealthSystem] ${name} missing 'damageable' tag - adding it`);
            this.entity.tags.add('damageable');
        }
        if (!this.entity.tags.has('team_ai')) {
            this.Logger.warn(`[HealthSystem] ${name} missing 'team_ai' tag - adding it`);
            this.entity.tags.add('team_ai');
        }
        // Log final collision state
        this.Logger.info(`[HealthSystem] ${name} collision setup verified:`, {
            collision: this.entity.collision ? 'YES' : 'NO',
            collisionEnabled: this.entity.collision?.enabled || false,
            rigidbody: this.entity.rigidbody ? 'YES' : 'NO',
            rigidbodyEnabled: this.entity.rigidbody?.enabled || false,
            rigidbodyType: this.entity.rigidbody?.type || 'none',
            tags: Array.from(this.entity.tags.list())
        });
    }
    update(dt) {
        if (!this.__healthSystemBooted || !this.healthCore || this.healthCore.isBeingDestroyed) {
            return;
        }
        // Update frame counter in core
        this.healthCore.updateFrame();
        // Process accumulated damage
        const frameSummary = this.healthCore.processAccumulatedDamage();
        // ✅ FIX: Only regenerate health if explicitly enabled AND entity is player (never AI!)
        if (this.enableHealthRegen && this.healthCore.isPlayer && // MUST be player
        !this.healthCore.isAI && // MUST NOT be AI (double safety check)
        !this.healthCore.isDead && this.healthCore.currentHealth < this.healthCore.maxHealth) {
            const now = performance.now() / 1000;
            if (now - this.healthCore.lastDamageTimeForRegen > this.healthCore.healthRegenDelay) {
                const regenAmount = this.healthCore.regenerateHealth(dt);
                if (regenAmount > 0) {
                    this.healthEffects.onRegen(regenAmount);
                    this.Logger.debug(`[HealthSystem] Player regenerated ${regenAmount.toFixed(1)} health (${this.healthCore.currentHealth.toFixed(1)}/${this.healthCore.maxHealth})`);
                }
            }
        }
        // Update health bar
        this.healthEffects.updateHealthBar(this.healthCore.currentHealth, this.healthCore.maxHealth);
        // Enhanced logging with capping information
        if (HealthSystem.DEV_MODE && frameSummary && Object.keys(frameSummary.damageBySource).length > 0) {
            const frameId = this.healthCore.currentFrame;
            const applied = Object.entries(frameSummary.damageBySource).map(([src, dmg])=>`${src}:${dmg}`).join(',');
            const cappingInfo = frameSummary.totalDamageRequested !== frameSummary.totalDamageApplied ? ` capped=${frameSummary.totalDamageRequested}->${frameSummary.totalDamageApplied}` : '';
            this.Logger.debug(`[HEALTH-FRAME] frame=${frameId} target=${this.healthCore.entityId.substring(0, 8)} applied=[${applied}] newHP=${this.healthCore.currentHealth}${cappingInfo}`);
        }
    }
    // ============================================================================
    // PUBLIC API - Delegates to internal modules
    // ============================================================================
    takeDamage(damage, attacker, hitId, frameId, isShotgunPellet, isHeadshot) {
        if (!this.healthCore) {
            return;
        }
        const oldHealth = this.healthCore.currentHealth;
        Logger.health(`[HealthSystem] 🎯 takeDamage() START for ${this.entity.name}, damage=${damage}, attacker=${attacker?.name}, healthBEFORE=${oldHealth.toFixed(1)}`);
        // ✅ FIX: Normalize damage to remove floating point artifacts
        const normalizedDamage = Math.round(damage * 10) / 10;
        const damageInfo = this.healthCore.takeDamage(normalizedDamage, attacker, hitId, frameId, isShotgunPellet, isHeadshot);
        if (damageInfo) {
            // ✅ CLARIFIED: damageInfo contains PREDICTED values
            // Actual health subtraction happens in processAccumulatedDamage() during next update()
            // This is by design to batch damage and prevent overkill
            Logger.health(`[HealthSystem] 📊 takeDamage() QUEUED: damage=${damageInfo.actualDamage.toFixed(1)}, healthBEFORE=${damageInfo.oldHealth.toFixed(1)}, healthAFTER(predicted)=${damageInfo.newHealth.toFixed(1)}, willApplyIn=next_update()`);
        } else {
            Logger.health(`[HealthSystem] 📊 takeDamage() REJECTED: reason=duplicate/friendly_fire/invincibility`);
        }
        // 🔥 DAMAGE VIGNETTE FIX: Direct player notification BEFORE health check
        if (damageInfo && this.healthCore.isPlayer && this.entity.script && this.entity.script.player) {
            try {
                this.entity.script.player.takeDamage(damageInfo.actualDamage, damageInfo.attacker);
            } catch (error) {
                Logger.error(`[HealthSystem] ❌ Direct player notification FAILED:`, error);
            }
        }
        Logger.health(`[HealthSystem] 🔍 Checking if should fire events: damageInfo=${!!damageInfo}, isDead=${this.healthCore.isDead}, currentHealth=${this.healthCore.currentHealth}`);
        // ✅ FIX: Fire events if we have damage info and entity is not dead
        if (damageInfo && !this.healthCore.isDead) {
            Logger.health(`[HealthSystem] ✅ Conditions met - firing events (hasDamageInfo=true, isDead=false)`);
            // ✅ NEW: Notify AI's HumanAimSystem (stress spike, warmup flinch)
            if (this.entity.script?.aiAgent?.aimSystem) {
                this.entity.script.aiAgent.aimSystem.onTakeDamage(damageInfo.actualDamage);
            }
            // ✅ NEW: Trigger hit reaction animation for AI
            if (this.entity.script?.aiAgent?.animationController) {
                this.entity.script.aiAgent.animationController.onDamageTaken();
            }
            // Show effects and notify systems for living entities
            this.healthEffects.onDamage(damageInfo);
            this.healthEvents.notifySystemsOfDamage(damageInfo);
            // 🔥 DAMAGE VIGNETTE FIX: Direct player notification as failsafe (duplicate removed - already done above)
            Logger.health(`[HealthSystem] 🚀 About to call fireEntityDamaged...`);
            this.healthEvents.fireEntityDamaged(damageInfo);
            Logger.health(`[HealthSystem] ✅ fireEntityDamaged called successfully`);
            // Fire player health change event
            if (this.healthCore.isPlayer) {
                this.healthEvents.firePlayerHealthChanged(this.healthCore.currentHealth, this.healthCore.maxHealth);
            }
            // Fire debug event
            this.healthEvents.fireDebugDamage(damageInfo);
        } else {
            Logger.health(`[HealthSystem] ❌ Conditions NOT met - NOT firing events. Reasons:`, {
                hasDamageInfo: !!damageInfo,
                currentHealth: this.healthCore.currentHealth,
                isDead: this.healthCore.isDead
            });
        }
    }
    heal(amount) {
        if (!this.healthCore) return 0;
        const actualHealing = this.healthCore.heal(amount);
        if (actualHealing > 0) {
            this.healthEffects.onHeal(actualHealing);
            // Fire player health change event
            if (this.healthCore.isPlayer) {
                this.healthEvents.firePlayerHealthChanged(this.healthCore.currentHealth, this.healthCore.maxHealth);
            }
        }
        return actualHealing;
    }
    resetHealth() {
        if (!this.healthCore) return;
        this.healthCore.resetHealth();
        // Re-enable entity components
        this._enableEntityOnRespawn();
        // Re-register as damageable
        this.healthEvents.registerAsDamageable();
        // Fire player health change event
        if (this.healthCore.isPlayer) {
            this.healthEvents.firePlayerHealthChanged(this.healthCore.currentHealth, this.healthCore.maxHealth);
        }
    }
    onDeath(attacker) {
        console.log(`[HealthSystem] 💀 onDeath() called for ${this.entity.name}, attacker=${attacker?.name}`);
        Logger.health(`[HealthSystem] 💀 onDeath() called for ${this.entity.name}, attacker=${attacker?.name}`);
        if (!this.healthCore) {
            console.log(`[HealthSystem] ❌ No healthCore, returning`);
            Logger.health(`[HealthSystem] ❌ No healthCore, returning`);
            return;
        }
        console.log(`[HealthSystem] ✅ Calling healthCore.onDeath()`);
        Logger.health(`[HealthSystem] ✅ Calling healthCore.onDeath()`);
        const deathInfo = this.healthCore.onDeath(attacker);
        console.log(`[HealthSystem] deathInfo received:`, deathInfo ? 'YES' : 'NO (duplicate death)');
        Logger.health(`[HealthSystem] deathInfo received:`, deathInfo ? 'YES' : 'NO (duplicate death)');
        // ✅ FIX: If deathInfo is null, this is a duplicate death call - don't process further
        if (!deathInfo) {
            console.log(`[HealthSystem] ⚠️ Duplicate death call detected - skipping event firing`);
            Logger.health(`[HealthSystem] ⚠️ Duplicate death call detected - skipping event firing`);
            return;
        }
        // 🎬 TRIGGER DEATH ANIMATION (MUST happen BEFORE entity is disabled!)
        // AnimationController is stored in aiAgent.animationController, not as a separate script
        const animController = this.entity.script?.aiAgent?.animationController;
        // Only log detailed diagnostics for AI agents (player uses DeathCameraController instead)
        const isAI = !!(this.entity.script && this.entity.script.aiAgent);
        if (isAI) {
            console.log(`[HealthSystem] 🔍 Checking AI animationController:`, {
                hasScript: !!this.entity.script,
                hasAiAgent: true,
                hasAnimController: !!animController
            });
        }
        if (animController && animController.animComponent) {
            console.log(`[HealthSystem] 🎬 Triggering death animation for AI: ${this.entity.name}`);
            Logger.health(`[HealthSystem] 🎬 Triggering death animation for AI: ${this.entity.name}`);
            try {
                animController.animComponent.setBoolean('isDead', true);
                console.log(`[HealthSystem] ✅ Death animation parameter 'isDead' set to TRUE`);
                Logger.health(`[HealthSystem] ✅ Death animation parameter 'isDead' set to TRUE`);
            } catch (error) {
                console.warn(`[HealthSystem] ⚠️ Failed to trigger death animation:`, error);
                Logger.warn(`[HealthSystem] ⚠️ Failed to trigger death animation:`, error);
            }
        } else if (isAI) {
            // Only warn for AI entities - player uses different death system (DeathCameraController)
            console.warn(`[HealthSystem] ⚠️ AI entity has no animationController - death animation skipped`);
            Logger.health(`[HealthSystem] ⚠️ AI entity has no animationController - death animation skipped`);
        } else {
            // Player death - uses DeathCameraController, not animation controller
            console.log(`[HealthSystem] ℹ️ Player death (uses DeathCameraController, not AnimationController)`);
        }
        // Disable AI scripts (but keep entity enabled for animation)
        this._disableEntityOnDeath();
        // Show death effects
        this.healthEffects.onDeath(deathInfo);
        // Notify systems
        this.healthEvents.notifySystemsOfDeath(deathInfo);
        Logger.health(`[HealthSystem] 🔥 About to fire entity:died event`);
        // Fire events
        this.healthEvents.fireEntityDied(deathInfo);
        Logger.health(`[HealthSystem] ✅ entity:died event fired`);
    }
    // ============================================================================
    // UTILITY METHODS - Delegates to core
    // ============================================================================
    getHealthPercent() {
        return this.healthCore ? this.healthCore.getHealthPercent() : 0;
    }
    isAlive() {
        return this.healthCore ? this.healthCore.isAlive() : false;
    }
    isReady() {
        return this.__healthSystemBooted === true && !this.healthCore?.isBeingDestroyed;
    }
    isLowHealth(threshold = aiConfig.healthEffects.LOW_HEALTH_THRESHOLD) {
        return this.healthCore ? this.healthCore.isLowHealth(threshold) : false;
    }
    isCriticalHealth(threshold = aiConfig.healthEffects.CRITICAL_HEALTH_THRESHOLD) {
        return this.healthCore ? this.healthCore.isCriticalHealth(threshold) : false;
    }
    canPickupHealth() {
        return this.healthCore ? this.healthCore.canPickupHealth() : false;
    }
    getDamageStats() {
        return this.healthCore ? this.healthCore.getDamageStats() : {};
    }
    // ============================================================================
    // PROPERTY ACCESSORS - Delegates to core for backward compatibility
    // ============================================================================
    get currentHealth() {
        return this.healthCore ? this.healthCore.currentHealth : this.startingHealth;
    }
    get isDead() {
        return this.healthCore ? this.healthCore.isDead : false;
    }
    get lastAttacker() {
        return this.healthCore ? this.healthCore.lastAttacker : null;
    }
    // ============================================================================
    // ENTITY STATE MANAGEMENT
    // ============================================================================
    _disableEntityOnDeath() {
        try {
            // ✅ FIX: DON'T disable aiAgent - it needs to keep running for death animation!
            // Instead, only disable weapon and movement systems
            // The aiAgent will check isDead flag and stop behaving
            // Only disable COMBAT/MOVEMENT scripts (not aiAgent itself!)
            if (this.healthCore.isAI) {
                if (this.entity.script) {
                    // ❌ DON'T disable aiAgent - it runs the AnimationController!
                    const scripts = [
                        'weaponSystem',
                        'movementSystem'
                    ];
                    scripts.forEach((scriptName)=>{
                        if (this.entity.script[scriptName]) {
                            this.entity.script[scriptName].enabled = false;
                        }
                    });
                }
            }
            console.log(`[HealthSystem] 💀 Weapon/movement scripts disabled (aiAgent kept active for death animation)`);
            this.Logger.health?.(`[HealthSystem] ${this.healthCore.entityName}#${this.healthCore.entityId.substring(0, 8)} Combat disabled on death (aiAgent kept active for animation)`) || this.Logger.debug?.(`[HealthSystem] ${this.healthCore.entityName}#${this.healthCore.entityId.substring(0, 8)} Combat disabled on death (aiAgent kept active for animation)`);
        } catch (error) {
            this.Logger.error(`[HealthSystem] Error disabling entity ${this.healthCore.entityName}:`, error);
        }
    }
    _enableEntityOnRespawn() {
        try {
            // Re-enable the entity
            this.entity.enabled = this.initiallyEnabled;
            // ✅ RESET DEATH ANIMATION PARAMETER!
            const animController = this.entity.script?.aiAgent?.animationController;
            if (animController && animController.animComponent) {
                console.log(`[HealthSystem] 🔄 Resetting death animation parameter on respawn`);
                try {
                    animController.animComponent.setBoolean('isDead', false);
                    console.log(`[HealthSystem] ✅ Death animation parameter 'isDead' reset to FALSE`);
                } catch (error) {
                    console.warn(`[HealthSystem] ⚠️ Failed to reset death animation:`, error);
                }
            }
            // Re-enable components
            if (this.entity.collision) {
                this.entity.collision.enabled = true;
            }
            if (this.entity.rigidbody) {
                this.entity.rigidbody.enabled = true;
            }
            // Re-enable AI-specific components
            if (this.healthCore.isAI) {
                if (this.entity.script) {
                    const scripts = [
                        'aiAgent',
                        'weaponSystem',
                        'movementSystem'
                    ];
                    scripts.forEach((scriptName)=>{
                        if (this.entity.script[scriptName]) {
                            this.entity.script[scriptName].enabled = true;
                        }
                    });
                }
            }
            this.Logger.health?.(`[HealthSystem] ${this.healthCore.entityName}#${this.healthCore.entityId.substring(0, 8)} re-enabled on respawn`) || this.Logger.debug?.(`[HealthSystem] ${this.healthCore.entityName}#${this.healthCore.entityId.substring(0, 8)} re-enabled on respawn`);
        } catch (error) {
            this.Logger.error(`[HealthSystem] Error re-enabling entity ${this.healthCore.entityName}:`, error);
        }
    }
    // ============================================================================
    // DEBUG METHODS
    // ============================================================================
    debugTakeDamage(amount) {
        if (!this.healthCore) return;
        this.Logger.warn(`[HealthSystem] DEBUG: ${this.healthCore.entityName}#${this.healthCore.entityId.substring(0, 8)} manually taking ${amount} damage`);
        this.takeDamage(amount || 10, null);
    }
    // ============================================================================
    // CLEANUP AND LIFECYCLE
    // ============================================================================
    _onEntityDestroy() {
        if (this.healthEvents) {
            this.healthEvents.onEntityDestroy();
        }
        this._clearAllTimers();
    }
    onDestroy() {
        // Destroy all internal modules
        if (this.healthCore) {
            this.healthCore.destroy();
        }
        if (this.healthEffects) {
            this.healthEffects.destroy();
        }
        if (this.healthEvents) {
            this.healthEvents.destroy();
        }
        this._clearAllTimers();
    }
    _clearAllTimers() {
        if (this.healthEffects) {
            this.healthEffects.clearAllTimers();
        }
        this.Logger.health?.(`[HealthSystem] ${this.entity.name} timers cleared on destroy`) || this.Logger.debug?.(`[HealthSystem] ${this.entity.name} timers cleared on destroy`);
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES - Preserved exactly from original
        // ============================================================================
        /** @attribute @type {number} @default 100 @title Max Health */ _define_property(this, "maxHealth", aiConfig.healthEffects.MAX_HEALTH_DEFAULT);
        /** @attribute @type {number} @default 100 @title Starting Health */ _define_property(this, "startingHealth", aiConfig.healthEffects.STARTING_HEALTH_DEFAULT);
        /** @attribute @type {rgb} @default [1, 0, 0] @title Damage Flash Color */ _define_property(this, "damageFlashColor", [
            1,
            0,
            0
        ]);
        /** @attribute @type {number} @default 0.2 @title Damage Flash Duration */ _define_property(this, "damageFlashDuration", aiConfig.healthEffects.DAMAGE_FLASH_DURATION);
        /** @attribute @type {pc.Entity} @title Health Bar Entity (optional) */ _define_property(this, "healthBarEntity", null);
        /** @attribute @type {boolean} @default true @title Show Damage Numbers */ _define_property(this, "damageNumbers", true);
        /** @attribute @type {number} @default 0.15 @title Invincibility Time After Damage */ _define_property(this, "invincibilityTime", aiConfig.healthEffects.INVINCIBILITY_TIME);
        /** @attribute @type {boolean} @default false @title Enable Health Regeneration */ _define_property(this, "enableHealthRegen", false);
        /** @attribute @type {number} @default 0 @title Health Regen Rate (HP per second) */ _define_property(this, "healthRegenRate", 0);
        /** @attribute @type {number} @default 5 @title Health Regen Delay (seconds after damage) */ _define_property(this, "healthRegenDelay", 5);
    }
}
_define_property(HealthSystem, "scriptName", 'healthSystem');
// ============================================================================
// STATIC CONSTANTS - Preserved exactly from original
// ============================================================================
_define_property(HealthSystem, "DEV_MODE", true) // Set to false for production
;
_define_property(HealthSystem, "HIT_DEDUPE_WINDOW", 32) // Keep last 32 hits for deduplication
;

export { HealthSystem };
