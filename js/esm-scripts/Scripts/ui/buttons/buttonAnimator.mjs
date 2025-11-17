import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';
import { aiConfig } from '../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * ButtonAnimator - ESM Module Version  
 * Provides visual animation effects for buttons
 * Simplified and modernized animation system
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
 * ButtonAnimator Class - ESM-based Button Animation System
 * Internal helper class, not exported
 */ class ButtonAnimator {
    /**
     * Initialize button animator
     */ initialize(config = {}) {
        if (this._isInitialized) return;
        Logger.debug('[ButtonAnimator] Initializing ESM version...');
        // Apply configuration
        Object.assign(this, config);
        // Store original scale
        this.originalScale = this.entity.getLocalScale().clone();
        // Add hover effects if button component exists
        this._setupHoverEffects();
        this._isInitialized = true;
        Logger.debug('[ButtonAnimator] ESM version ready');
    }
    /**
     * Setup hover effect event listeners
     */ _setupHoverEffects() {
        if (!this.entity.button) {
            Logger.warn('[ButtonAnimator] No button component found');
            return;
        }
        this.entity.button.on('mouseenter', this.onHover.bind(this));
        this.entity.button.on('mouseleave', this.onLeave.bind(this));
        this.entity.button.on('click', this.onClick.bind(this));
    }
    /**
     * Update animation loop
     */ update(dt) {
        if (!this._isInitialized || !this.originalScale) return;
        this.buttonTime += dt;
        // Calculate pulse effect
        const pulseValue = Math.sin(this.buttonTime * this.pulseSpeed) * this.pulseAmount;
        let scaleMultiplier = 1 + pulseValue;
        // Add extra scale when hovered
        if (this.isHovered) {
            scaleMultiplier += aiConfig.ui.BUTTON_HOVER_SCALE_BONUS; // Bigger when hovered
        }
        // Apply the pulsing scale
        this.entity.setLocalScale(this.originalScale.x * scaleMultiplier, this.originalScale.y * scaleMultiplier, this.originalScale.z * scaleMultiplier);
        // Optional: Glow effect by changing opacity
        if (this.enableGlow && this.entity.element) {
            const glowIntensity = aiConfig.ui.BUTTON_GLOW_BASE_INTENSITY + Math.sin(this.buttonTime * this.pulseSpeed * aiConfig.ui.BUTTON_GLOW_SPEED_MULTIPLIER) * aiConfig.ui.BUTTON_GLOW_INTENSITY_VARIATION;
            this.entity.element.opacity = glowIntensity;
        }
    }
    /**
     * Handle mouse hover start
     */ onHover() {
        this.isHovered = true;
        Logger.debug(`[ButtonAnimator] Button hovered: ${this.entity.name}`);
        // Optional: Play hover sound
        this.app.fire('ui:buttonHover', {
            button: this.entity
        });
    }
    /**
     * Handle mouse hover end
     */ onLeave() {
        this.isHovered = false;
        Logger.debug(`[ButtonAnimator] Button hover end: ${this.entity.name}`);
    }
    /**
     * Handle button click
     */ onClick() {
        Logger.debug(`[ButtonAnimator] Button clicked: ${this.entity.name}`);
        // Create click animation effect
        this._performClickAnimation();
        // Fire click sound event
        this.app.fire('ui:buttonClick', {
            button: this.entity
        });
    }
    /**
     * Perform click animation
     */ _performClickAnimation() {
        if (!this.originalScale) return;
        // Quick scale down then back to normal
        const clickScale = this.originalScale.clone().scale(aiConfig.ui.BUTTON_CLICK_SCALE);
        this.entity.setLocalScale(clickScale.x, clickScale.y, clickScale.z);
        // Return to normal after short delay
        setTimeout(()=>{
            if (this.originalScale && this.entity) {
                const normalScale = this.isHovered ? aiConfig.ui.BUTTON_HOVER_NORMAL_SCALE : 1.0;
                this.entity.setLocalScale(this.originalScale.x * normalScale, this.originalScale.y * normalScale, this.originalScale.z * normalScale);
            }
        }, aiConfig.ui.BUTTON_CLICK_ANIMATION_MS);
    }
    /**
     * Enable/disable animation
     */ setEnabled(enabled) {
        this._isInitialized = enabled;
        if (!enabled && this.originalScale) {
            // Reset to original scale when disabled
            this.entity.setLocalScale(this.originalScale.x, this.originalScale.y, this.originalScale.z);
            if (this.entity.element) {
                this.entity.element.opacity = aiConfig.ui.BUTTON_DEFAULT_OPACITY;
            }
        }
    }
    /**
     * Update animation settings
     */ updateSettings(settings) {
        Object.assign(this, settings);
        Logger.debug('[ButtonAnimator] Settings updated:', settings);
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup event listeners
     */ _cleanup() {
        if (this.entity.button) {
            this.entity.button.off('mouseenter', this.onHover.bind(this));
            this.entity.button.off('mouseleave', this.onLeave.bind(this));
            this.entity.button.off('click', this.onClick.bind(this));
        }
    }
    /**
     * Destroy button animator
     */ destroy() {
        if (!this._isInitialized) return;
        this._cleanup();
        // Reset to original state
        if (this.originalScale && this.entity) {
            this.entity.setLocalScale(this.originalScale.x, this.originalScale.y, this.originalScale.z);
            if (this.entity.element) {
                this.entity.element.opacity = aiConfig.ui.BUTTON_DEFAULT_OPACITY;
            }
        }
        this._isInitialized = false;
        Logger.debug('[ButtonAnimator] Cleaned up');
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Animation settings
        this.pulseSpeed = aiConfig.ui.BUTTON_PULSE_SPEED;
        this.pulseAmount = aiConfig.ui.BUTTON_PULSE_AMOUNT;
        this.enableGlow = true;
        // Animation state
        this.buttonTime = 0;
        this.originalScale = null;
        this.isHovered = false;
        this._isInitialized = false;
        Logger.debug('[ButtonAnimator] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for ButtonAnimator (Modern ESM Version)
 */ class ButtonAnimatorScript extends Script {
    initialize() {
        // Create ESM instance
        this.buttonAnimator = new ButtonAnimator(this.app, this.entity);
        // Initialize with attribute configuration
        this.buttonAnimator.initialize({
            pulseSpeed: this.pulseSpeed,
            pulseAmount: this.pulseAmount,
            enableGlow: this.enableGlow
        });
        // Make available on entity
        this.entity.buttonAnimator = this.buttonAnimator;
    }
    update(dt) {
        if (this.buttonAnimator) {
            this.buttonAnimator.update(dt);
        }
    }
    destroy() {
        if (this.buttonAnimator) {
            this.buttonAnimator.destroy();
            this.buttonAnimator = null;
            this.entity.buttonAnimator = null;
        }
    }
    constructor(...args){
        super(...args);
        /**
     * @attribute
     * @type {number}
     * @title Pulse Speed
     */ _define_property(this, "pulseSpeed", aiConfig.ui.BUTTON_PULSE_SPEED);
        /**
     * @attribute
     * @type {number}
     * @title Pulse Amount
     * @description 0.1 = 10% scale change
     */ _define_property(this, "pulseAmount", aiConfig.ui.BUTTON_PULSE_AMOUNT);
        /**
     * @attribute
     * @type {boolean}
     * @title Enable Glow Effect
     */ _define_property(this, "enableGlow", true);
    }
}
_define_property(ButtonAnimatorScript, "scriptName", 'buttonAnimator');

export { ButtonAnimatorScript };
