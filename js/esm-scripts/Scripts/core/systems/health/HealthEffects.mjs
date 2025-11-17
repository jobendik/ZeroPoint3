import { Entity, ELEMENTTYPE_TEXT, Color, Vec3 } from '../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';

class HealthEffects {
    // ============================================================================
    // DAMAGE VISUAL EFFECTS
    // ============================================================================
    setupDamageFlash() {
        // Store original materials for damage flash effect
        const renders = this.entity.findComponents('render');
        renders.forEach((render, index)=>{
            if (render.material) {
                this.originalMaterials.set(index, render.material);
            }
        });
        // Also check child entities
        const childRenders = this.entity.find(function(node) {
            return node.render && node.render.material;
        });
        childRenders.forEach((child, index)=>{
            if (child.render && child.render.material) {
                this.originalMaterials.set(`child_${index}`, child.render.material);
            }
        });
    }
    showDamageFlash() {
        if (this.damageFlashDuration <= 0 || this.isBeingDestroyed) return;
        // Apply flash effect to all render components
        const renders = this.entity.findComponents('render');
        renders.forEach((render)=>{
            if (render.material) {
                const flashMaterial = render.material.clone();
                flashMaterial.emissive.set(this.damageFlashColor[0], this.damageFlashColor[1], this.damageFlashColor[2]);
                flashMaterial.update();
                render.material = flashMaterial;
            }
        });
        // Apply to child entities
        const childRenders = this.entity.find(function(node) {
            return node.render && node.render.material;
        });
        childRenders.forEach((child)=>{
            if (child.render && child.render.material) {
                const flashMaterial = child.render.material.clone();
                flashMaterial.emissive.set(this.damageFlashColor[0], this.damageFlashColor[1], this.damageFlashColor[2]);
                flashMaterial.update();
                child.render.material = flashMaterial;
            }
        });
        // Guard flash timer to prevent multiple timers
        if (this._flashTimer) {
            clearTimeout(this._flashTimer);
        }
        this._flashTimer = setTimeout(()=>{
            if (this.isBeingDestroyed) return;
            this.resetDamageFlash();
            this._flashTimer = null;
        }, this.damageFlashDuration * 1000);
    }
    resetDamageFlash() {
        if (this.isBeingDestroyed) return;
        // Restore original materials
        const renders = this.entity.findComponents('render');
        renders.forEach((render, index)=>{
            const originalMaterial = this.originalMaterials.get(index);
            if (originalMaterial) {
                render.material = originalMaterial;
            }
        });
        // Restore child entity materials
        const childRenders = this.entity.find(function(node) {
            return node.render && node.render.material;
        });
        childRenders.forEach((child, index)=>{
            const originalMaterial = this.originalMaterials.get(`child_${index}`);
            if (originalMaterial) {
                child.render.material = originalMaterial;
            }
        });
    }
    showDamageNumber(damage) {
        if (!this.damageNumbers || this.isBeingDestroyed) return;
        try {
            // Create damage text entity
            const damageText = new Entity('DamageNumber');
            damageText.addComponent('element', {
                type: ELEMENTTYPE_TEXT,
                text: '-' + Math.round(damage),
                fontSize: 24,
                color: new Color(1, 0, 0),
                anchor: [
                    0.5,
                    0.5,
                    0.5,
                    0.5
                ],
                pivot: [
                    0.5,
                    0.5
                ]
            });
            // Position in world space
            const worldPos = this.entity.getPosition();
            const screenPos = new Vec3();
            // Find camera for world-to-screen conversion
            const camera = this.app.root.findByName('Camera');
            if (camera && camera.camera) {
                const adjustedWorldPos = worldPos.clone().add(Vec3.UP.clone().scale(2));
                camera.camera.worldToScreen(adjustedWorldPos, screenPos);
                // Find screen entity
                const screen = this.app.root.findByName('Screen');
                if (screen) {
                    screen.addChild(damageText);
                    damageText.setLocalPosition(screenPos.x, screenPos.y, 0);
                    this.animateDamageNumber(damageText);
                }
            }
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error creating damage number: ${error}`);
        }
    }
    animateDamageNumber(textEntity) {
        if (this.isBeingDestroyed) return;
        const startPos = textEntity.getLocalPosition();
        const endPos = startPos.clone().add(new Vec3(0, 50, 0));
        const duration = aiConfig.healthEffects.DAMAGE_NUMBER_DURATION;
        let elapsed = 0;
        const animate = (dt)=>{
            elapsed += dt;
            const progress = elapsed / duration;
            if (progress >= 1 || this.isBeingDestroyed) {
                if (textEntity && textEntity.destroy) {
                    textEntity.destroy();
                }
                return;
            }
            try {
                const currentPos = new Vec3().lerp(startPos, endPos, progress);
                textEntity.setLocalPosition(currentPos);
                const alpha = 1 - progress;
                if (textEntity.element) {
                    textEntity.element.color.a = alpha;
                }
                requestAnimationFrame(()=>animate(this.app.dt));
            } catch (error) {
                // Animation failed, clean up
                if (textEntity && textEntity.destroy) {
                    textEntity.destroy();
                }
            }
        };
        animate(this.app.dt);
    }
    // ============================================================================
    // HEALING VISUAL EFFECTS
    // ============================================================================
    showHealEffect() {
        if (this.isBeingDestroyed) return;
        try {
            // Apply green healing flash
            const renders = this.entity.findComponents('render');
            renders.forEach((render)=>{
                if (render.material) {
                    const healMaterial = render.material.clone();
                    healMaterial.emissive.set(0, 1, 0);
                    healMaterial.update();
                    render.material = healMaterial;
                }
            });
            // Guard heal timer to prevent multiple timers
            if (this._healTimer) {
                clearTimeout(this._healTimer);
            }
            this._healTimer = setTimeout(()=>{
                if (this.isBeingDestroyed) return;
                this.resetDamageFlash(); // Reset to original materials
                this._healTimer = null;
            }, 200);
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error showing heal effect: ${error}`);
        }
    }
    showRegenEffect() {
        // Subtle regeneration effect - could be enhanced with particles
        if (this.isBeingDestroyed) return;
    // Placeholder for future regeneration visual effects
    }
    // ============================================================================
    // DEATH VISUAL EFFECTS
    // ============================================================================
    showDeathEffect() {
        if (this.isBeingDestroyed) return;
        try {
            // Play death sound
            this.playDeathSound();
            // Could add more visual death effects here:
            // - Fade out animation
            // - Particle effects
            // - Screen shake for player death
            this.Logger.health?.(`[HealthEffects] ${this.entityName}#${this.entityId.substring(0, 8)} death effect shown`) || this.Logger.debug?.(`[HealthEffects] ${this.entityName}#${this.entityId.substring(0, 8)} death effect shown`);
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error showing death effect: ${error}`);
        }
    }
    // ============================================================================
    // HEALTH BAR UPDATES
    // ============================================================================
    updateHealthBar(currentHealth, maxHealth) {
        if (!this.healthBarEntity || this.isBeingDestroyed) return;
        try {
            const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));
            if (this.healthBarEntity.element) {
                // UI element health bar
                this.healthBarEntity.element.width = healthPercent * 100;
            } else if (this.healthBarEntity.render) {
                // 3D rendered health bar
                this.healthBarEntity.setLocalScale(healthPercent, 1, 1);
            }
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error updating health bar: ${error}`);
        }
    }
    // ============================================================================
    // AUDIO EFFECTS
    // ============================================================================
    playDamageSound() {
        if (this.isBeingDestroyed) return;
        try {
            const soundType = this.isPlayer ? 'player_hurt' : 'ai_hurt';
            this.app.fire('audio:play', {
                sound: soundType,
                position: this.entity.getPosition()
            });
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error playing damage sound: ${error}`);
        }
    }
    playHealSound() {
        if (this.isBeingDestroyed) return;
        try {
            this.app.fire('audio:play', {
                sound: 'heal',
                position: this.entity.getPosition()
            });
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error playing heal sound: ${error}`);
        }
    }
    playDeathSound() {
        if (this.isBeingDestroyed) return;
        try {
            const soundType = this.isPlayer ? 'player_death' : 'ai_death';
            this.app.fire('audio:play', {
                sound: soundType,
                position: this.entity.getPosition()
            });
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error playing death sound: ${error}`);
        }
    }
    // ============================================================================
    // EFFECT ORCHESTRATION METHODS
    // ============================================================================
    onDamage(damageInfo) {
        if (this.isBeingDestroyed || !damageInfo) return;
        // Show all damage-related effects
        this.showDamageFlash();
        this.showDamageNumber(damageInfo.actualDamage);
        this.playDamageSound();
        // Show damage vignette for player
        if (this.isPlayer) {
            this.showPlayerDamageVignette(damageInfo.actualDamage);
        }
    }
    onHeal(healAmount) {
        if (this.isBeingDestroyed || healAmount <= 0) return;
        // Show healing effects
        this.showHealEffect();
        this.playHealSound();
    }
    onRegen(regenAmount) {
        if (this.isBeingDestroyed || regenAmount <= 0) return;
        // Show subtle regeneration effects
        this.showRegenEffect();
    }
    onDeath(deathInfo) {
        if (this.isBeingDestroyed) return;
        // Show death effects
        this.showDeathEffect();
    }
    onHealthUpdate(currentHealth, maxHealth) {
        if (this.isBeingDestroyed) return;
        // Update health bar
        this.updateHealthBar(currentHealth, maxHealth);
    }
    // ============================================================================
    // PLAYER DAMAGE VIGNETTE
    // ============================================================================
    showPlayerDamageVignette(damage) {
        if (!this.isPlayer || this.isBeingDestroyed) return;
        try {
            // Get UI Manager for vignette display
            const uiManager = this.app.uiManager;
            if (!uiManager || typeof uiManager.showDamageVignette !== 'function') {
                this.Logger.warn('[HealthEffects] UI Manager not available for damage vignette');
                return;
            }
            // Calculate intensity based on damage amount (scale from 0.3 to 0.8)
            const maxDamage = aiConfig.healthEffects.VIGNETTE_MAX_DAMAGE_SCALING; // Assume max single damage for scaling
            const intensity = Math.min(0.8, Math.max(0.3, damage / maxDamage * 0.8));
            // Duration based on damage severity (0.5s to 1.2s)
            const duration = Math.min(1.2, Math.max(0.5, damage / maxDamage * 1.2));
            // Show the vignette
            uiManager.showDamageVignette(intensity, duration);
            this.Logger.debug(`[HealthEffects] Player damage vignette shown - damage: ${damage}, intensity: ${intensity.toFixed(2)}, duration: ${duration.toFixed(2)}s`);
        } catch (error) {
            this.Logger.error(`[HealthEffects] Error showing player damage vignette: ${error}`);
        }
    }
    // ============================================================================
    // CONFIGURATION UPDATES
    // ============================================================================
    updateConfig(config) {
        if (config.damageFlashColor !== undefined) {
            this.damageFlashColor = config.damageFlashColor;
        }
        if (config.damageFlashDuration !== undefined) {
            this.damageFlashDuration = config.damageFlashDuration;
        }
        if (config.healthBarEntity !== undefined) {
            this.healthBarEntity = config.healthBarEntity;
        }
        if (config.damageNumbers !== undefined) {
            this.damageNumbers = config.damageNumbers;
        }
    }
    // ============================================================================
    // CLEANUP AND UTILITIES
    // ============================================================================
    clearAllTimers() {
        if (this._flashTimer) {
            clearTimeout(this._flashTimer);
            this._flashTimer = null;
        }
        if (this._healTimer) {
            clearTimeout(this._healTimer);
            this._healTimer = null;
        }
        this.Logger.health?.(`[HealthEffects] ${this.entityName} effect timers cleared`) || this.Logger.debug?.(`[HealthEffects] ${this.entityName} effect timers cleared`);
    }
    destroy() {
        this.isBeingDestroyed = true;
        this.clearAllTimers();
        this.resetDamageFlash();
        this.originalMaterials.clear();
        this.Logger.health?.(`[HealthEffects] ${this.entityName} effects destroyed`) || this.Logger.debug?.(`[HealthEffects] ${this.entityName} effects destroyed`);
    }
    constructor(entity, app, config = {}){
        this.entity = entity;
        this.app = app; // Explicitly passed app reference
        this.Logger = globalThis.Logger || console;
        // Entity identification
        this.entityId = entity.getGuid();
        this.entityName = entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        // Configuration from original attributes
        this.damageFlashColor = config.damageFlashColor || [
            1,
            0,
            0
        ];
        this.damageFlashDuration = config.damageFlashDuration || 0.2;
        this.healthBarEntity = config.healthBarEntity || null;
        this.damageNumbers = config.damageNumbers !== undefined ? config.damageNumbers : true;
        // Visual state
        this.originalMaterials = new Map();
        this.isBeingDestroyed = false;
        // Effect timers for cleanup
        this._flashTimer = null;
        this._healTimer = null;
        // Entity type detection for sound selection
        this.isAI = !!(entity.script && entity.script.aiAgent);
        this.isPlayer = !!(entity.script && (entity.script.player || entity.script.playerController || entity.script.fpsPlayer));
        // Setup initial visual effects
        this.setupDamageFlash();
    }
}

export { HealthEffects };
