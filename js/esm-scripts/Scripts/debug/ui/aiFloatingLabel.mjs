import { Script, Entity, Vec2, SCALEMODE_BLEND, ELEMENTTYPE_IMAGE, Vec4, Color, ELEMENTTYPE_TEXT, Vec3 } from '../../../../playcanvas-stable.min.mjs';

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
/**
 * 🏷️ AI Floating Label - 3D UI above AI agents
 * 
 * Displays critical AI information as a floating UI element above each agent.
 * Shows: Health bar, State, Current Goal, and Combat status.
 * 
 * Usage: Attach to AI agent entity in the editor
 */ class AIFloatingLabel extends Script {
    initialize() {
        console.log('[AIFloatingLabel] Initializing for', this.entity.name);
        // Don't create label in initialize - wait for postInitialize or enable
        this._initialized = true;
        this._labelCreated = false;
        // Cache previous values to prevent flickering
        this._cachedState = null;
        this._cachedGoal = null;
        this._cachedHealth = null;
        this._cachedAmmo = null;
        // Cache color states to prevent unnecessary Color object creation
        this._cachedHealthColor = null;
        this._cachedAmmoColor = null;
        this._cachedStateColor = null;
        // Listen for entity destruction
        this.entity.once('destroy', this._onAgentDestroyed, this);
    }
    _onAgentDestroyed() {
        console.log('[AIFloatingLabel] Agent destroyed, cleaning up label for', this.entity.name);
        if (this.labelContainer && this.labelContainer.element) {
            this.labelContainer.destroy();
            this.labelContainer = null;
        }
        this._labelCreated = false;
    }
    postInitialize() {
        console.log('[AIFloatingLabel] postInitialize for', this.entity.name);
        // Entity is fully initialized and enabled
        this._ensureLabelExists();
    }
    onEnable() {
        console.log('[AIFloatingLabel] onEnable for', this.entity.name);
        // Entity was just enabled - create label if needed
        if (this._initialized && !this._labelCreated) {
            this._ensureLabelExists();
        }
    }
    _ensureLabelExists() {
        if (this._labelCreated) return;
        console.log('[AIFloatingLabel] Creating label for', this.entity.name);
        this.waitForScreen();
    }
    waitForScreen() {
        // Try to find or create screen
        let screen = this.app.root.findByName('DebugScreen');
        if (!screen) {
            // Create screen if it doesn't exist
            screen = new Entity('DebugScreen');
            screen.addComponent('screen', {
                referenceResolution: new Vec2(1920, 1080),
                screenSpace: true,
                scaleMode: SCALEMODE_BLEND
            });
            this.app.root.addChild(screen);
            console.log('[AIFloatingLabel] Created debug screen');
        }
        this.screen = screen;
        this._createLabel();
        this._labelCreated = true;
    }
    _createLabel() {
        // Create container - clean, readable design
        this.labelContainer = new Entity('AILabel_' + this.entity.name);
        this.labelContainer.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0, 0, 0, 0),
            pivot: new Vec2(0.5, 0),
            width: this.labelWidth,
            height: this.labelHeight,
            opacity: 0.92,
            color: new Color(0.08, 0.08, 0.08),
            rect: new Vec4(0, 0, 1, 1),
            mask: false
        });
        this.screen.addChild(this.labelContainer);
        console.log('[AIFloatingLabel] Container created:', {
            width: this.labelWidth,
            height: this.labelHeight,
            parent: this.screen.name
        });
        // Agent name header
        const nameHeader = new Entity('NameHeader');
        nameHeader.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0, 0.80, 1, 1),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.13, 0.13, 0.13),
            opacity: 1
        });
        this.labelContainer.addChild(nameHeader);
        // Name text - larger, more readable
        this.nameText = new Entity('NameText');
        this.nameText.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 13,
            color: new Color(1, 1, 1),
            text: this.entity.name.substring(0, 15).toUpperCase(),
            alignment: new Vec2(0.5, 0.5),
            fontAsset: this.fontAsset
        });
        nameHeader.addChild(this.nameText);
        // Health bar section
        const healthSection = new Entity('HealthSection');
        healthSection.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.05, 0.58, 0.95, 0.78),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.05, 0.05, 0.05),
            opacity: 1
        });
        this.labelContainer.addChild(healthSection);
        // Health label
        const healthLabel = new Entity('HealthLabel');
        healthLabel.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.05, 0.5, 0.30, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 10,
            color: new Color(0.6, 0.6, 0.6),
            text: 'HP:',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        healthSection.addChild(healthLabel);
        // Health bar background
        const healthBarBg = new Entity('HealthBarBg');
        healthBarBg.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.30, 0.20, 0.95, 0.80),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.15, 0.15, 0.15),
            opacity: 1
        });
        healthSection.addChild(healthBarBg);
        // Health bar fill
        this.healthBar = new Entity('HealthBar');
        this.healthBar.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.3, 0.8, 0.3),
            opacity: 1
        });
        healthBarBg.addChild(this.healthBar);
        // Health percentage text
        this.healthText = new Entity('HealthText');
        this.healthText.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 10,
            color: new Color(1, 1, 1),
            text: '100%',
            alignment: new Vec2(0.5, 0.5),
            fontAsset: this.fontAsset
        });
        healthBarBg.addChild(this.healthText);
        // State section
        const stateSection = new Entity('StateSection');
        stateSection.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.05, 0.38, 0.95, 0.56),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.05, 0.05, 0.05),
            opacity: 1
        });
        this.labelContainer.addChild(stateSection);
        // State label
        const stateLabel = new Entity('StateLabel');
        stateLabel.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.05, 0, 0.35, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 10,
            color: new Color(0.6, 0.6, 0.6),
            text: 'STATE:',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        stateSection.addChild(stateLabel);
        // State value
        this.stateText = new Entity('StateText');
        this.stateText.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.35, 0, 0.95, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 11,
            color: new Color(0.3, 0.8, 0.3),
            text: 'PATROL',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        stateSection.addChild(this.stateText);
        // Goal section
        const goalSection = new Entity('GoalSection');
        goalSection.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.05, 0.18, 0.95, 0.36),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.05, 0.05, 0.05),
            opacity: 1
        });
        this.labelContainer.addChild(goalSection);
        // Goal label
        const goalLabel = new Entity('GoalLabel');
        goalLabel.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.05, 0, 0.35, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 10,
            color: new Color(0.6, 0.6, 0.6),
            text: 'GOAL:',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        goalSection.addChild(goalLabel);
        // Goal value
        this.goalText = new Entity('GoalText');
        this.goalText.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.35, 0, 0.95, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 11,
            color: new Color(0.13, 0.59, 0.95),
            text: 'None',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        goalSection.addChild(this.goalText);
        // Weapon ammo section with bar
        const weaponSection = new Entity('WeaponSection');
        weaponSection.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.05, 0.04, 0.95, 0.16),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.05, 0.05, 0.05),
            opacity: 1
        });
        this.labelContainer.addChild(weaponSection);
        // Weapon label
        const weaponLabel = new Entity('WeaponLabel');
        weaponLabel.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0.05, 0.5, 0.30, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 10,
            color: new Color(0.6, 0.6, 0.6),
            text: 'AMMO:',
            alignment: new Vec2(0, 0.5),
            fontAsset: this.fontAsset
        });
        weaponSection.addChild(weaponLabel);
        // Ammo bar background
        const ammoBarBg = new Entity('AmmoBarBg');
        ammoBarBg.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0.30, 0.20, 0.95, 0.80),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.15, 0.15, 0.15),
            opacity: 1
        });
        weaponSection.addChild(ammoBarBg);
        // Ammo bar fill
        this.ammoBar = new Entity('AmmoBar');
        this.ammoBar.addComponent('element', {
            type: ELEMENTTYPE_IMAGE,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            color: new Color(0.3, 0.8, 0.3),
            opacity: 1
        });
        ammoBarBg.addChild(this.ammoBar);
        // Ammo text (magazine/total)
        this.ammoText = new Entity('AmmoText');
        this.ammoText.addComponent('element', {
            type: ELEMENTTYPE_TEXT,
            anchor: new Vec4(0, 0, 1, 1),
            pivot: new Vec2(0.5, 0.5),
            margin: new Vec4(0, 0, 0, 0),
            fontSize: 9,
            color: new Color(1, 1, 1),
            text: '30/90',
            alignment: new Vec2(0.5, 0.5),
            fontAsset: this.fontAsset
        });
        ammoBarBg.addChild(this.ammoText);
        console.log('[AIFloatingLabel] Label created for', this.entity.name);
    }
    update(dt) {
        // Recreate label if it was destroyed (e.g., entity was respawned)
        if (this.enabled && (!this.labelContainer || !this.labelContainer.element)) {
            console.log('[AIFloatingLabel] Label missing, recreating for', this.entity.name);
            this._labelCreated = false;
            this._ensureLabelExists();
            return;
        }
        if (!this.enabled || !this.labelContainer || !this.screen) {
            if (!this._debugLogged) {
                console.warn('[AIFloatingLabel] Missing:', {
                    enabled: this.enabled,
                    hasContainer: !!this.labelContainer,
                    hasScreen: !!this.screen
                });
                this._debugLogged = true;
            }
            return;
        }
        // Find camera - cache it for performance
        if (!this._camera || !this._camera.camera) {
            // Method 1: Try tagged camera
            const taggedCameras = this.app.root.findByTag('camera');
            if (taggedCameras && taggedCameras.length > 0) {
                this._camera = taggedCameras[0];
            }
            // Method 2: Find by name
            if (!this._camera) {
                this._camera = this.app.root.findByName('Camera');
            }
            // Method 3: Search for any entity with camera component
            if (!this._camera) {
                const allEntities = this.app.root.find((node)=>node.camera);
                if (allEntities && allEntities.length > 0) {
                    this._camera = allEntities[0];
                }
            }
            if (this._camera && this._camera.camera) {
                console.log('[AIFloatingLabel] Found camera:', this._camera.name);
            }
        }
        if (!this._camera || !this._camera.camera) {
            // Only warn once per second to avoid spam
            const now = Date.now();
            if (!this._lastCameraWarn || now - this._lastCameraWarn > 1000) {
                console.warn('[AIFloatingLabel] No camera found!');
                this._lastCameraWarn = now;
            }
            return;
        }
        const camera = this._camera;
        // Get AI agent script
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent) return;
        // Calculate world position above entity
        const worldPos = this.entity.getPosition().clone();
        worldPos.y += this.heightOffset;
        // Convert to screen space
        const screenPos = this._worldToScreenSpace(worldPos, camera.camera, this.screen.screen);
        // Debug disabled to prevent console flooding
        // if (!this._frameCount) this._frameCount = 0;
        // this._frameCount++;
        // if (this._frameCount % 60 === 1) {
        //     console.log('[AIFloatingLabel]', this.entity.name, 'Screen:', 
        //         `(${screenPos.x.toFixed(0)}, ${screenPos.y.toFixed(0)}, ${screenPos.z.toFixed(1)})`,
        //         'Visible:', screenPos.z > 0);
        // }
        if (screenPos.z > 0) {
            // In front of camera - show label
            this.labelContainer.enabled = true;
            // Position label ABOVE the agent (add labelHeight to Y since pivot is at bottom)
            this.labelContainer.setLocalPosition(screenPos.x, screenPos.y + this.labelHeight, 0);
            // Update all sections
            this._updateHealth(aiAgent);
            this._updateState(aiAgent);
            this._updateGoal(aiAgent);
            this._updateWeapon(aiAgent);
        } else {
            // Behind camera - hide label
            this.labelContainer.enabled = false;
        }
    }
    _updateHealth(aiAgent) {
        const entity = aiAgent.entity;
        const healthSystem = entity.script?.healthSystem || entity.script?.health || entity.findScript?.('healthSystem');
        if (healthSystem) {
            const currentHealth = healthSystem.currentHealth ?? healthSystem.health ?? 0;
            const maxHealth = healthSystem.maxHealth ?? healthSystem.max ?? 100;
            const healthPct = maxHealth > 0 ? currentHealth / maxHealth : 0;
            // Determine color state
            let colorState;
            if (healthPct > 0.6) {
                colorState = 'green';
            } else if (healthPct > 0.25) {
                colorState = 'orange';
            } else {
                colorState = 'red';
            }
            // Only update if health percentage or color changed
            const healthKey = `${Math.round(healthPct * 100)}-${colorState}`;
            if (this._cachedHealth === healthKey) return;
            this._cachedHealth = healthKey;
            // Update health bar width
            if (this.healthBar && this.healthBar.element) {
                this.healthBar.element.anchor = new Vec4(0, 0, healthPct, 1);
                // Color based on health percentage - only set if changed
                if (this._cachedHealthColor !== colorState) {
                    this._cachedHealthColor = colorState;
                    if (colorState === 'green') {
                        this.healthBar.element.color = new Color(0.3, 0.8, 0.3);
                    } else if (colorState === 'orange') {
                        this.healthBar.element.color = new Color(1, 0.6, 0);
                    } else {
                        this.healthBar.element.color = new Color(0.96, 0.26, 0.21);
                    }
                }
            }
            // Update health percentage text
            if (this.healthText && this.healthText.element) {
                this.healthText.element.text = Math.round(healthPct * 100) + '%';
            }
        }
    }
    _updateState(aiAgent) {
        const stateMachine = aiAgent.agentBehavior?._stateMachine;
        const currentState = stateMachine?.currentState;
        const stateName = currentState?.constructor?.name?.replace('State', '') || 'Unknown';
        // Only update if state changed
        if (this._cachedState === stateName) return;
        this._cachedState = stateName;
        if (this.stateText && this.stateText.element) {
            this.stateText.element.text = stateName.toUpperCase();
            // Color based on state - only update if different
            const stateUpper = stateName.toUpperCase();
            if (this._cachedStateColor !== stateUpper) {
                this._cachedStateColor = stateUpper;
                const colors = {
                    'PATROL': new Color(0.3, 0.8, 0.3),
                    'ALERT': new Color(1, 0.6, 0),
                    'COMBAT': new Color(0.96, 0.26, 0.21),
                    'INVESTIGATE': new Color(0.13, 0.59, 0.95),
                    'FLEE': new Color(0.61, 0.15, 0.69),
                    'COVER': new Color(1, 0.6, 0) // Orange
                };
                this.stateText.element.color = colors[stateUpper] || new Color(0.7, 0.7, 0.7);
            }
        }
    }
    _updateGoal(aiAgent) {
        const brain = aiAgent.agentBehavior?.brain || aiAgent.brain;
        let currentGoal = 'None';
        // 🔧 FIX: YUKA's Think stores goals in subgoals array, not currentSubgoal property
        if (brain?.subgoals && brain.subgoals.length > 0) {
            const goal = brain.subgoals[0]; // First goal in array is the active goal
            // Try to get the goal name properly
            if (typeof goal === 'object' && goal.constructor?.name) {
                currentGoal = goal.constructor.name.replace('Goal', '').replace('Enhanced', '').replace('Atomic', '').replace('Composite', '').trim();
            } else if (typeof goal === 'string') {
                currentGoal = goal;
            }
            // Truncate if too long
            if (currentGoal.length > 15) {
                currentGoal = currentGoal.substring(0, 15);
            }
        } else if (brain?.currentGoal) {
            // Fallback to currentGoal if subgoals doesn't exist
            if (typeof brain.currentGoal === 'object' && brain.currentGoal.constructor?.name) {
                currentGoal = brain.currentGoal.constructor.name.replace('Goal', '').replace('Enhanced', '').replace('Atomic', '').replace('Composite', '').trim();
            } else if (typeof brain.currentGoal === 'string') {
                currentGoal = brain.currentGoal;
            }
            if (currentGoal.length > 15) {
                currentGoal = currentGoal.substring(0, 15);
            }
        }
        // Only update if goal changed
        if (this._cachedGoal === currentGoal) return;
        this._cachedGoal = currentGoal;
        if (this.goalText && this.goalText.element) {
            this.goalText.element.text = currentGoal.toUpperCase();
        }
    }
    _updateWeapon(aiAgent) {
        const weaponSystem = aiAgent.entity.script?.weaponSystem || aiAgent.entity.script?.weapon;
        const weaponInfo = weaponSystem?.getWeaponInfo ? weaponSystem.getWeaponInfo() : null;
        if (weaponInfo) {
            const magazineAmmo = weaponInfo.currentMagazine ?? 0;
            const totalAmmo = weaponInfo.totalAmmo ?? 0;
            const magazineCapacity = weaponInfo.magazineCapacity ?? 30;
            const isReloading = weaponSystem?.isReloading || false;
            const ammoPct = magazineCapacity > 0 ? magazineAmmo / magazineCapacity : 0;
            // Determine color state
            let colorState;
            if (isReloading) {
                colorState = 'reloading';
            } else if (ammoPct > 0.3) {
                colorState = 'green';
            } else if (ammoPct > 0) {
                colorState = 'red';
            } else {
                colorState = 'gray';
            }
            // Only update if ammo or color state changed
            const ammoKey = `${magazineAmmo}/${totalAmmo}/${colorState}`;
            if (this._cachedAmmo === ammoKey) return;
            this._cachedAmmo = ammoKey;
            // Update ammo bar
            if (this.ammoBar && this.ammoBar.element) {
                this.ammoBar.element.anchor = new Vec4(0, 0, ammoPct, 1);
                // Color based on ammo level - only update if changed
                if (this._cachedAmmoColor !== colorState) {
                    this._cachedAmmoColor = colorState;
                    if (colorState === 'reloading') {
                        this.ammoBar.element.color = new Color(1, 0.6, 0); // Orange
                    } else if (colorState === 'green') {
                        this.ammoBar.element.color = new Color(0.3, 0.8, 0.3); // Green
                    } else if (colorState === 'red') {
                        this.ammoBar.element.color = new Color(0.96, 0.26, 0.21); // Red
                    } else {
                        this.ammoBar.element.color = new Color(0.5, 0.5, 0.5); // Gray
                    }
                }
            }
            // Update ammo text
            if (this.ammoText && this.ammoText.element) {
                if (isReloading) {
                    this.ammoText.element.text = 'RELOADING';
                    this.ammoText.element.fontSize = 8;
                } else {
                    this.ammoText.element.text = `${magazineAmmo}/${totalAmmo}`;
                    this.ammoText.element.fontSize = 9;
                }
            }
        }
    }
    /**
     * Convert world position to screen space
     * Based on PlayCanvas official example
     */ _worldToScreenSpace(worldPosition, camera, screen) {
        const screenPos = camera.worldToScreen(worldPosition);
        // Take pixel ratio into account
        const pixelRatio = this.app.graphicsDevice.maxPixelRatio;
        screenPos.x *= pixelRatio;
        screenPos.y *= pixelRatio;
        // Account for screen scaling
        const scale = screen.scale;
        // Invert the y position
        screenPos.y = screen.resolution.y - screenPos.y;
        // Return as Vec3
        return new Vec3(screenPos.x / scale, screenPos.y / scale, screenPos.z);
    }
    destroy() {
        // Clean up label
        if (this.labelContainer) {
            this.labelContainer.destroy();
            this.labelContainer = null;
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Enable Label */ _define_property(this, "enabled", true);
        /** @attribute @type {number} @range [0.5, 5] @title Height Offset */ _define_property(this, "heightOffset", 2.5);
        /** @attribute @type {number} @range [50, 400] @title Label Width */ _define_property(this, "labelWidth", 200);
        /** @attribute @type {number} @range [30, 200] @title Label Height */ _define_property(this, "labelHeight", 90);
        /** @attribute @type {pc.Asset} @title Font Asset */ _define_property(this, "fontAsset", null);
    }
}
_define_property(AIFloatingLabel, "scriptName", 'aiFloatingLabel');

export { AIFloatingLabel };
