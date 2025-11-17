import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * ButtonFactory - ESM Module Version
 * MAJOR CONSOLIDATION: Replaces 5 individual button files with single factory
 * Reduces 45+ lines of duplicate code to a single, configurable system
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
 * Button Event Mapping Configuration
 * Maps button types to their corresponding events
 */ const BUTTON_EVENT_MAP = {
    play: 'ui:playClicked',
    pause: 'ui:pauseClicked',
    resume: 'ui:resumeClicked',
    quit: 'ui:quitClicked',
    rematch: 'ui:rematchClicked',
    restart: 'ui:rematchClicked',
    // Extended button types for future expansion
    settings: 'ui:settingsClicked',
    back: 'ui:backClicked',
    confirm: 'ui:confirmClicked',
    cancel: 'ui:cancelClicked'
};
/**
 * ButtonFactory Class - ESM-based Universal Button System
 * Internal helper class, not exported
 */ class ButtonFactory {
    /**
     * Initialize button with configuration
     */ initialize(config = {}) {
        if (this._isInitialized) return;
        Logger.debug(`[ButtonFactory] Initializing button: ${this.entity.name}`);
        // Apply configuration
        Object.assign(this, config);
        // Auto-detect button type from entity name if not specified
        if (!config.buttonType) {
            this._autoDetectButtonType();
        }
        // Setup click handler
        this._setupClickHandler();
        // Integrate with animation system if enabled
        if (this.enableAnimation) {
            this._integrateAnimationSystem();
        }
        this._isInitialized = true;
        Logger.debug(`[ButtonFactory] Button ready: ${this.buttonType} -> ${this._getEventName()}`);
    }
    /**
     * Auto-detect button type from entity name
     */ _autoDetectButtonType() {
        const name = this.entity.name.toLowerCase();
        // Check for common button name patterns
        for (const [type, _] of Object.entries(BUTTON_EVENT_MAP)){
            if (name.includes(type)) {
                this.buttonType = type;
                Logger.debug(`[ButtonFactory] Auto-detected button type: ${type}`);
                return;
            }
        }
        // Special case handling
        if (name.includes('menu')) this.buttonType = 'quit';
        if (name.includes('restart')) this.buttonType = 'rematch';
        Logger.debug(`[ButtonFactory] Using default button type: ${this.buttonType}`);
    }
    /**
     * Get the event name for this button
     */ _getEventName() {
        // Custom event name takes priority
        if (this.eventName) return this.eventName;
        // Use mapped event name
        return BUTTON_EVENT_MAP[this.buttonType] || 'ui:buttonClicked';
    }
    /**
     * Setup click event handler
     */ _setupClickHandler() {
        if (!this.entity.button) {
            Logger.warn(`[ButtonFactory] No button component found on: ${this.entity.name}`);
            return;
        }
        // Remove existing handlers
        this.entity.button.off('click');
        // Create click handler
        this._clickHandler = ()=>{
            this._handleButtonClick();
        };
        // Add click handler
        this.entity.button.on('click', this._clickHandler);
        // Enable input if needed
        if (this.entity.element) {
            this.entity.element.useInput = true;
        }
    }
    /**
     * Handle button click event
     */ _handleButtonClick() {
        const eventName = this._getEventName();
        Logger.debug(`[ButtonFactory] Button clicked: ${this.entity.name} -> ${eventName}`);
        // Fire the mapped event
        this.app.fire(eventName, {
            buttonType: this.buttonType,
            entity: this.entity,
            timestamp: Date.now()
        });
        // Fire generic button click event for global handling
        this.app.fire('ui:buttonClicked', {
            buttonType: this.buttonType,
            eventName: eventName,
            entity: this.entity
        });
        // Play sound if enabled
        if (this.enableSounds) {
            this._playButtonSound();
        }
    }
    /**
     * Play button click sound
     */ _playButtonSound() {
        // Fire sound event - audio system will handle the actual sound playing
        this.app.fire('audio:playSound', {
            soundType: 'buttonClick',
            buttonType: this.buttonType
        });
    }
    /**
     * Integrate with animation system
     */ _integrateAnimationSystem() {
        // Check if ButtonAnimator is available
        if (this.entity.buttonAnimator || this.entity.script?.buttonAnimator) {
            Logger.debug(`[ButtonFactory] Animation system integrated for: ${this.entity.name}`);
            return;
        }
        // Create basic hover effects if no animator present
        this._createBasicHoverEffects();
    }
    /**
     * Create basic hover effects without full animator
     */ _createBasicHoverEffects() {
        if (!this.entity.button) return;
        let originalOpacity = 1.0;
        this.entity.button.on('mouseenter', ()=>{
            if (this.entity.element) {
                originalOpacity = this.entity.element.opacity;
                this.entity.element.opacity = 0.8;
            }
        });
        this.entity.button.on('mouseleave', ()=>{
            if (this.entity.element) {
                this.entity.element.opacity = originalOpacity;
            }
        });
    }
    /**
     * Update button configuration
     */ updateConfig(config) {
        Object.assign(this, config);
        // Re-setup if type changed
        if (config.buttonType || config.eventName) {
            this._setupClickHandler();
        }
        Logger.debug(`[ButtonFactory] Configuration updated: ${this.entity.name}`);
    }
    /**
     * Enable/disable button
     */ setEnabled(enabled) {
        if (this.entity.button) {
            this.entity.button.enabled = enabled;
        }
        if (this.entity.element) {
            this.entity.element.opacity = enabled ? 1.0 : 0.5;
        }
        Logger.debug(`[ButtonFactory] Button ${enabled ? 'enabled' : 'disabled'}: ${this.entity.name}`);
    }
    /**
     * Check if button is enabled
     */ isEnabled() {
        return this.entity.button ? this.entity.button.enabled : false;
    }
    /**
     * Get button information
     */ getButtonInfo() {
        return {
            name: this.entity.name,
            type: this.buttonType,
            eventName: this._getEventName(),
            enabled: this.isEnabled(),
            hasAnimation: !!this.entity.buttonAnimator,
            hasButton: !!this.entity.button
        };
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    /**
     * Cleanup event handlers
     */ _cleanup() {
        if (this.entity.button && this._clickHandler) {
            this.entity.button.off('click', this._clickHandler);
            this._clickHandler = null;
        }
    }
    /**
     * Destroy button factory
     */ destroy() {
        if (!this._isInitialized) return;
        this._cleanup();
        this._isInitialized = false;
        Logger.debug(`[ButtonFactory] Cleaned up: ${this.entity.name}`);
    }
    constructor(app, entity){
        this.app = app;
        this.entity = entity;
        // Button configuration
        this.buttonType = 'play'; // Default type
        this.eventName = null; // Custom event override
        this.enableAnimation = true; // Animation integration
        this.enableSounds = true; // Sound effects
        // State
        this._isInitialized = false;
        this._clickHandler = null;
        Logger.debug('[ButtonFactory] ESM instance created');
    }
}
/**
 * PlayCanvas Script Adapter for ButtonFactory (Modern ESM Version)
 * REPLACES: playButton.js, pauseButton.js, quitButton.js, resumeButton.js, rematchButton.js
 */ class ButtonFactoryScript extends Script {
    initialize() {
        // Create ESM instance
        this.buttonFactory = new ButtonFactory(this.app, this.entity);
        // Initialize with attribute configuration
        this.buttonFactory.initialize({
            buttonType: this.buttonType || undefined,
            eventName: this.eventName || undefined,
            enableAnimation: this.enableAnimation,
            enableSounds: this.enableSounds
        });
        // Make available on entity
        this.entity.buttonFactory = this.buttonFactory;
        Logger.debug(`[ButtonFactory] Script initialized: ${this.entity.name}`);
    }
    setEnabled(enabled) {
        if (this.buttonFactory) {
            this.buttonFactory.setEnabled(enabled);
        }
    }
    updateConfig(config) {
        if (this.buttonFactory) {
            this.buttonFactory.updateConfig(config);
        }
    }
    destroy() {
        if (this.buttonFactory) {
            this.buttonFactory.destroy();
            this.buttonFactory = null;
            this.entity.buttonFactory = null;
        }
    }
    constructor(...args){
        super(...args);
        /**
     * @attribute
     * @type {string}
     * @title Button Type
     * @description Type of button (play, pause, resume, quit, rematch, etc.)
     */ _define_property(this, "buttonType", 'play');
        /**
     * @attribute
     * @type {string}
     * @title Custom Event Name
     * @description Override default event name (optional)
     */ _define_property(this, "eventName", '');
        /**
     * @attribute
     * @type {boolean}
     * @title Enable Animation
     */ _define_property(this, "enableAnimation", true);
        /**
     * @attribute
     * @type {boolean}
     * @title Enable Sounds
     */ _define_property(this, "enableSounds", true);
    }
}
_define_property(ButtonFactoryScript, "scriptName", 'buttonFactory');
// ============================================================================
// LEGACY COMPATIBILITY SCRIPTS (Modern ESM Version)
// Provides backward compatibility with existing button scripts
// ============================================================================
/**
 * Legacy PlayButton Script (for backward compatibility)
 */ class PlayButtonScript extends Script {
    initialize() {
        const factory = new ButtonFactory(this.app, this.entity);
        factory.initialize({
            buttonType: 'play'
        });
        this.entity.buttonFactory = factory;
    }
}
_define_property(PlayButtonScript, "scriptName", 'playButton');
_define_property(PlayButtonScript, "attributes", {});
/**
 * Legacy PauseButton Script (for backward compatibility)
 */ class PauseButtonScript extends Script {
    initialize() {
        const factory = new ButtonFactory(this.app, this.entity);
        factory.initialize({
            buttonType: 'pause'
        });
        this.entity.buttonFactory = factory;
    }
}
_define_property(PauseButtonScript, "scriptName", 'pauseButton');
_define_property(PauseButtonScript, "attributes", {});
/**
 * Legacy QuitButton Script (for backward compatibility)
 */ class QuitButtonScript extends Script {
    initialize() {
        const factory = new ButtonFactory(this.app, this.entity);
        factory.initialize({
            buttonType: 'quit'
        });
        this.entity.buttonFactory = factory;
    }
}
_define_property(QuitButtonScript, "scriptName", 'quitButton');
_define_property(QuitButtonScript, "attributes", {});
/**
 * Legacy ResumeButton Script (for backward compatibility)
 */ class ResumeButtonScript extends Script {
    initialize() {
        const factory = new ButtonFactory(this.app, this.entity);
        factory.initialize({
            buttonType: 'resume'
        });
        this.entity.buttonFactory = factory;
    }
}
_define_property(ResumeButtonScript, "scriptName", 'resumeButton');
_define_property(ResumeButtonScript, "attributes", {});
/**
 * Legacy RematchButton Script (for backward compatibility)
 */ class RematchButtonScript extends Script {
    initialize() {
        const factory = new ButtonFactory(this.app, this.entity);
        factory.initialize({
            buttonType: 'rematch'
        });
        this.entity.buttonFactory = factory;
    }
}
_define_property(RematchButtonScript, "scriptName", 'rematchButton');
_define_property(RematchButtonScript, "attributes", {});

export { BUTTON_EVENT_MAP, ButtonFactoryScript, PauseButtonScript, PlayButtonScript, QuitButtonScript, RematchButtonScript, ResumeButtonScript };
