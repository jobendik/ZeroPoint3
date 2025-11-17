import { aiConfig } from '../../../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/*
================================================================================
CONTRACT: WeaponEffects.mjs
================================================================================
PURPOSE:
    Visual and audio effects system for weapons including model management,
    muzzle flashes, impact effects, decals, and sound playback. Handles all
    presentational aspects of weapon firing.

RESPONSIBILITIES:
    - Weapon model visibility and state management
    - Muzzle flash visual effects
    - Impact effects (bullet holes, sparks, blood)
    - Mesh-based decal rendering system
    - Audio effect playback
    - State verification with PlayCanvas frame timing

CRITICAL FIX - Issue #8: Weapon Models State Inconsistency
    Problem: Weapon models report as disabled immediately after being enabled
    Root Cause: PlayCanvas doesn't apply enabled state changes synchronously
    
    Solution: State Verification System
    - Set entity.enabled = true
    - Schedule verification on NEXT frame using app.once('postrender')
    - Log actual state after PlayCanvas applies changes
    - Detect and warn about state conflicts

DEPENDENCIES:
    - PlayCanvas (pc.Vec3, pc.Entity, app events)
    - Global Logger instance
    - Weapon model entities in scene hierarchy
    - Muzzle flash entities (optional)

USAGE:
    const effects = new WeaponEffects(config, logger);
    effects.initialize(app, entity);
    
    // Update visible weapon model
    effects.updateWeaponModel('pistol');
    
    // Create impact effect
    effects.createImpactEffect(position, normal, targetEntity);
    
    // Play muzzle flash
    effects.playMuzzleFlash('pistol');

CONFIGURATION:
    config = {
        weaponModels: {           // Entity references
            pistol: Entity,
            machinegun: Entity,
            shotgun: Entity
        },
        muzzleFlashEntities: {    // Optional muzzle flash entities
            pistol: Entity,
            machinegun: Entity,
            shotgun: Entity
        },
        debugMode: boolean        // Enable detailed logging
    }

WEAPON MODEL DISCOVERY:
    Automatic Model Discovery (when not explicitly configured):
    1. Search entity hierarchy for containers named: "PistolTemplate", "MachinegunTemplate", "ShotgunTemplate"
    2. Find child entities within each container
    3. Auto-configure weaponModels mapping
    
    Manual Configuration (editor attributes):
    - Directly assign weapon model entities via config.weaponModels

DECAL SYSTEM:
    - Mesh-based bullet hole rendering
    - Pooled decal management for performance
    - Automatic cleanup of old decals
    - Surface-aware positioning and orientation

STATE SYNCHRONIZATION:
    - Uses PlayCanvas frame events for timing
    - Verifies state changes on next render frame
    - Detects conflicts with other systems
    - Maintains defensive initialization order

EVENTS:
    None fired - pure visual/audio effects

NOTES:
    - All weapon models should be disabled by default in editor
    - Only current weapon should be visible
    - State verification happens on postrender to ensure accuracy
    - Defensive checks handle missing entities gracefully
================================================================================
*/ const pc = globalThis.pc;
const WEAPON_TYPES = [
    'pistol',
    'machinegun',
    'shotgun'
];
// Weapon model container naming conventions for auto-discovery
const MODEL_CONTAINER_NAMES = {
    pistol: [
        'PistolTemplate',
        'Pistol Container',
        'Pistol'
    ],
    machinegun: [
        'MachinegunTemplate',
        'MachineGun Container',
        'MachineGun',
        'Machinegun'
    ],
    shotgun: [
        'ShotgunTemplate',
        'Shotgun Container',
        'Shotgun'
    ]
};
class WeaponEffects {
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    initialize(app, entity) {
        this.app = app;
        this.entity = entity;
        this.entityId = entity.getGuid();
        this.entityName = entity.name || `Entity_${this.entityId.substring(0, 8)}`;
        // Check if this is an AI agent
        this.isAI = !!entity.script?.aiAgent;
        // Initialize weapon models
        this._discoverWeaponModels();
        // ✅ CRITICAL: Disable ALL weapon models initially
        // They will be enabled programmatically when needed
        this._initializeWeaponVisibility();
        // Initialize muzzle flash entities
        this._initializeMuzzleFlashes();
        // Initialize decal system
        this._initializeDecalSystem();
        this.Logger.info(`[WeaponEffects] ✅ Effects system initialized for ${this.entityName}`);
    }
    _discoverWeaponModels() {
        // Start with explicitly configured models
        const configured = this.config.weaponModels || {};
        WEAPON_TYPES.forEach((weaponType)=>{
            // Use explicitly configured model if available
            if (configured[weaponType]) {
                this.weaponModels[weaponType] = configured[weaponType];
                this.Logger.info(`[WeaponEffects] ✅ Using configured model for ${weaponType}: ${configured[weaponType].name}`);
                return;
            }
            // Auto-discover model in entity hierarchy
            const discovered = this._findWeaponModelInHierarchy(weaponType);
            if (discovered) {
                this.weaponModels[weaponType] = discovered;
                this.Logger.info(`[WeaponEffects] ✅ Auto-discovered model for ${weaponType}: ${discovered.name}`);
            } else {
                this.Logger.warn(`[WeaponEffects] ⚠️ No model found for ${weaponType}`);
            }
        });
    }
    /**
     * ✅ EDITOR-DRIVEN WORKFLOW: Verify weapons are children of hand bone
     * 
     * DESIGN PHILOSOPHY:
     * - User positions weapons visually in editor as children of mixamorig:RightHand
     * - Code does NOTHING - just verifies the setup
     * - What you see in editor is exactly what you get in game
     * 
     * NO TRANSFORM MANIPULATION - editor is source of truth!
     */ _reparentWeaponsToHand() {
        this.Logger.info(`[WeaponEffects] 🔄 Verifying weapon parent hierarchy for ${this.entityName}`);
        // Get weapon socket (should be RightHand bone for AI)
        const weaponSocket = this.entity.script?.weaponSystem?.weaponSocket;
        if (!weaponSocket) {
            this.Logger.warn(`[WeaponEffects] No weapon socket found - weapons will use current parent`);
            return;
        }
        const socketName = weaponSocket.name || 'unknown';
        this.Logger.info(`[WeaponEffects] Expected weapon parent: ${socketName}`);
        // Just verify and report - don't change anything
        WEAPON_TYPES.forEach((weaponType)=>{
            const container = this.weaponModels[weaponType];
            if (!container) return;
            const currentParent = container.parent?.name || 'root';
            const grandParent = container.parent?.parent;
            const pos = container.getLocalPosition();
            const rot = container.getLocalEulerAngles();
            const scale = container.getLocalScale();
            // Check if weapon is child OR grandchild of weapon socket
            // (Supports structure: WeaponContainer -> TemplateEntity -> WeaponModel)
            const isCorrectlyParented = container.parent === weaponSocket || grandParent === weaponSocket;
            if (isCorrectlyParented) {
                this.Logger.info(`[WeaponEffects] ✅ ${weaponType} correctly parented under ${socketName}`);
                this.Logger.info(`   Hierarchy: ${currentParent} → ${container.name}`);
                this.Logger.info(`   Position: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
                this.Logger.info(`   Rotation: (${rot.x.toFixed(1)}°, ${rot.y.toFixed(1)}°, ${rot.z.toFixed(1)}°)`);
                this.Logger.info(`   Scale: (${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)})`);
            } else {
                this.Logger.warn(`[WeaponEffects] ⚠️ ${weaponType} not under ${socketName}`);
                this.Logger.warn(`   Current: ${currentParent} → ${container.name}`);
                this.Logger.warn(`   Please ensure ${container.name} or its parent is under ${socketName} in the editor`);
                this.Logger.warn(`   Then position it visually until it looks correct`);
            }
        });
        this.Logger.info(`[WeaponEffects] ✅ Weapon hierarchy verification complete`);
        this.Logger.info(`[WeaponEffects] 📝 To fix weapons: In editor, drag weapon entities to ${socketName} and position visually`);
    }
    _findWeaponModelInHierarchy(weaponType) {
        const names = (MODEL_CONTAINER_NAMES[weaponType] || []).map((s)=>s.toLowerCase());
        // exact match
        const exact = this._searchHierarchy(this.entity, (e)=>{
            const n = (e.name || '').toLowerCase();
            return names.includes(n);
        });
        if (exact) return exact;
        // startsWith
        const starts = this._searchHierarchy(this.entity, (e)=>{
            const n = (e.name || '').toLowerCase();
            return names.some((base)=>n.startsWith(base));
        });
        if (starts) return starts;
        // includes
        return this._searchHierarchy(this.entity, (e)=>{
            const n = (e.name || '').toLowerCase();
            return names.some((base)=>n.includes(base));
        });
    }
    _searchHierarchy(entity, predicate) {
        if (predicate(entity)) return entity;
        for(let i = 0; i < entity.children.length; i++){
            const result = this._searchHierarchy(entity.children[i], predicate);
            if (result) return result;
        }
        return null;
    }
    /**
     * ✅ NEW: Initialize weapon visibility - disable all weapons on startup
     * Ensures clean state regardless of editor settings
     */ _initializeWeaponVisibility() {
        WEAPON_TYPES.forEach((weaponType)=>{
            const container = this.weaponModels[weaponType];
            if (!container) return;
            // Disable the container and ALL descendants recursively
            container.enabled = false;
            this._setDescendantsEnabled(container, false);
        });
        this.Logger.info(`[WeaponEffects] ✅ All weapons disabled initially (will be enabled programmatically)`);
    }
    _initializeMuzzleFlashes() {
        const configured = this.config.muzzleFlashEntities || {};
        WEAPON_TYPES.forEach((weaponType)=>{
            // If assigned in editor/config, use it
            if (configured[weaponType]) {
                this.muzzleFlashEntities[weaponType] = configured[weaponType];
            } else {
                // Otherwise, discover it INSIDE the weapon's own container
                const container = this.weaponModels[weaponType];
                if (container) {
                    this.muzzleFlashEntities[weaponType] = this._findMuzzleFlashIn(container);
                }
            }
            // CRITICAL FIX: Keep flash entity ENABLED so the MuzzleFlash script can work
            // The MuzzleFlash script's flash() method needs the entity to be enabled
            const flash = this.muzzleFlashEntities[weaponType];
            if (flash) {
                flash.enabled = true; // Keep enabled for script to function
                if (this.debugMode) {
                    this.Logger.info(`[WeaponEffects] ✅ MuzzleFlash enabled for ${weaponType}: ${flash.name}`);
                }
            } else if (this.debugMode) {
                this.Logger.warn(`[WeaponEffects] No MuzzleFlash found for ${weaponType} (scoped search)`);
            }
        });
    }
    _initializeDecalSystem() {
        this.Logger.info('[WeaponEffects] ✅ Decal system initialized with mesh-based rendering');
    }
    // ========================================================================
    // WEAPON MODEL MANAGEMENT - CRITICAL FIX FOR ISSUE #8
    // ========================================================================
    /**
     * Update weapon model visibility for current weapon
     * CRITICAL: Uses PlayCanvas frame timing to verify state changes
     * 
     * @param {string} currentWeaponType - The weapon to make visible
     */ updateWeaponModel(currentWeaponType) {
        if (this.debugMode) {
            this.Logger.info(`[${this.entityName}] 🔍 updateWeaponModel() START - currentWeapon: ${currentWeaponType}`);
        }
        // DEFENSIVE: Validate weapon type
        if (!WEAPON_TYPES.includes(currentWeaponType)) {
            this.Logger.warn(`[${this.entityName}] Invalid weapon type: ${currentWeaponType}`);
            return;
        }
        // ✅ NEW: Get left hand bone for two-handed weapons
        const leftHandBone = this.entity.script?.weaponSystem?.leftHandBone;
        const isTwoHanded = currentWeaponType === 'machinegun' || currentWeaponType === 'shotgun';
        // Update all weapon models
        WEAPON_TYPES.forEach((weaponType)=>{
            const container = this.weaponModels[weaponType];
            if (!container) return;
            const isCurrent = weaponType === currentWeaponType;
            // CRITICAL FIX: Aggressively enable/disable container and ALL descendants
            // This single call will:
            // 1. Enable the template container (e.g., PistolTemplateBOT)
            // 2. Enable the weapon model (e.g., Pistol)
            // 3. Enable ALL mesh parts (e.g., Object_7, Object_8, Stock_0, etc.)
            // 4. Enable all render/model components
            // 5. Enable muzzle flash and any other children
            this._setDescendantsEnabled(container, isCurrent);
            if (this.debugMode) {
                if (isCurrent) {
                    this.Logger.info(`  ✅ Enabled ${weaponType}: ${container.name} and all descendants`);
                } else {
                    this.Logger.info(`  ❌ Disabled ${weaponType}: ${container.name}`);
                }
            }
            // ✅ NEW: Handle left hand attachment for two-handed weapons
            if (isCurrent && isTwoHanded && leftHandBone) {
                this._setupLeftHandAttachment(container, leftHandBone, weaponType);
            }
        });
        if (this.debugMode) {
            this.Logger.info(`[${this.entityName}] 🔍 updateWeaponModel() END`);
        }
        // CRITICAL FIX FOR ISSUE #8: Verify state on next frame
        // PlayCanvas applies enabled changes during frame update, not synchronously
        this._scheduleStateVerification(currentWeaponType);
    }
    /**
     * ✅ NEW: Set up left hand IK attachment for two-handed weapons
     * Finds LeftHandAttach point on weapon and stores reference
     */ _setupLeftHandAttachment(weaponContainer, leftHandBone, weaponType) {
        // Look for LeftHandAttach point in weapon hierarchy
        const leftHandAttach = weaponContainer.findByName('LeftHandAttach') || weaponContainer.findByName('LeftHand') || weaponContainer.findByName('L_Hand');
        if (leftHandAttach && leftHandBone) {
            // Store reference for potential IK system
            // For now, we just log it - you can add IK logic later
            if (this.debugMode) {
                this.Logger.info(`  ✅ Two-handed weapon: ${weaponType} has LeftHandAttach point`);
            }
        // TODO: Implement IK system to make left hand follow LeftHandAttach
        // For basic setup, the left hand will use animation - IK is optional enhancement
        } else if (this.debugMode) {
            this.Logger.warn(`  ⚠️ Two-handed weapon ${weaponType} missing LeftHandAttach point`);
        }
    }
    /**
     * CRITICAL FIX: Schedule state verification for next render frame
     * This ensures we read state AFTER PlayCanvas has applied changes
     * 
     * @param {string} currentWeaponType - The weapon that should be visible
     */ _scheduleStateVerification(currentWeaponType) {
        // Cancel any pending verification for this entity
        const existingHandler = this._verificationHandlers.get(this.entityId);
        if (existingHandler) {
            this.app.off('postrender', existingHandler);
        }
        // Create new verification handler
        const verifyHandler = ()=>{
            this._verifyWeaponModelState(currentWeaponType);
            this._verificationHandlers.delete(this.entityId);
        };
        // Store handler reference so we can cancel it if needed
        this._verificationHandlers.set(this.entityId, verifyHandler);
        // Schedule verification for NEXT frame (after PlayCanvas applies changes)
        this.app.once('postrender', verifyHandler);
    }
    /**
     * Verify weapon model state after PlayCanvas has applied changes
     * Logs warnings if state doesn't match expectations
     * 
     * @param {string} currentWeaponType - The weapon that should be visible
     */ _verifyWeaponModelState(currentWeaponType) {
        if (!this.debugMode) return;
        WEAPON_TYPES.forEach((weaponType)=>{
            const container = this.weaponModels[weaponType];
            if (!container) return;
            const childModel = this._findChildWeaponModel(container);
            // Log AFTER state
            if (weaponType === currentWeaponType) {
                this.Logger.info(`  AFTER ${weaponType}: ${container.name} enabled=${container.enabled}`);
                if (childModel) {
                    this.Logger.info(`    child ${childModel.name}: enabled=${childModel.enabled}`);
                }
                // DIAGNOSTIC: Check if state matches expectations
                if (!container.enabled) {
                    this.Logger.warn(`  ⚠️ STATE MISMATCH: ${weaponType} container should be enabled but is disabled`);
                }
                if (childModel && !childModel.enabled) {
                    this.Logger.warn(`  ⚠️ STATE MISMATCH: ${weaponType} child should be enabled but is disabled`);
                }
            }
        });
    }
    /**
     * Find the actual weapon model child entity within a container
     * Handles various naming conventions and hierarchy structures
     * 
     * @param {pc.Entity} container - The weapon container entity
     * @returns {pc.Entity|null} The weapon model entity or null
     */ /**
     * ✅ AGGRESSIVE FIX: Recursively enable/disable ALL descendants of an entity
     * This handles weapons with deeply nested hierarchies (template → model → mesh parts)
     * 
     * Enables:
     * - The entity itself
     * - All child entities
     * - All render/model components
     * - ALL descendants recursively (no matter how deep)
     * 
     * NOTE: This is INTENTIONALLY aggressive to ensure everything is visible
     */ _setDescendantsEnabled(entity, enabled) {
        if (!entity) return;
        console.log(`[WeaponEffects] _setDescendantsEnabled(${entity.name}, ${enabled})`);
        // Enable the entity itself
        entity.enabled = enabled;
        // Enable render/model components if they exist
        if (entity.render) {
            entity.render.enabled = enabled;
            console.log(`  → Render component enabled: ${enabled}`);
        }
        if (entity.model) {
            entity.model.enabled = enabled;
            console.log(`  → Model component enabled: ${enabled}`);
        }
        // Recursively enable ALL children (no conditions)
        if (entity.children.length > 0) {
            console.log(`  → Recursing into ${entity.children.length} children`);
        }
        entity.children.forEach((child)=>{
            this._setDescendantsEnabled(child, enabled);
        });
    }
    _findChildWeaponModel(container) {
        if (!container || container.children.length === 0) return null;
        // Strategy 1: Find first child with mesh/render component
        for(let i = 0; i < container.children.length; i++){
            const child = container.children[i];
            if (child.render || child.model) {
                return child;
            }
        }
        // Strategy 2: Return first child
        return container.children[0];
    }
    _findMuzzleFlashIn(container) {
        // Prefer exact match
        let found = container.findByName?.('MuzzleFlash') || null;
        if (found) return found;
        // Then startsWith
        const stack = [
            container
        ];
        while(stack.length){
            const node = stack.pop();
            for(let i = 0; i < node.children.length; i++){
                const c = node.children[i];
                if (!c || !c.name) continue;
                const n = c.name.toLowerCase();
                if (n.startsWith('muzzle')) return c;
                stack.push(c);
            }
        }
        // Finally includes
        const stack2 = [
            container
        ];
        while(stack2.length){
            const node = stack2.pop();
            for(let i = 0; i < node.children.length; i++){
                const c = node.children[i];
                if (c?.name?.toLowerCase().includes('muzzle')) return c;
                stack2.push(c);
            }
        }
        return null;
    }
    // ========================================================================
    // MUZZLE FLASH EFFECTS
    // ========================================================================
    playMuzzleFlash(weaponType) {
        const flash = this.muzzleFlashEntities[weaponType];
        if (!flash) {
            if (this.debugMode) {
                this.Logger.warn(`[WeaponEffects] No muzzle flash entity found for ${weaponType}`);
            }
            return;
        }
        // ✅ CRITICAL: Ensure parent hierarchy is enabled
        // Muzzle flash entities are often children of weapon containers
        let parent = flash.parent;
        while(parent && parent !== this.entity.root){
            if (!parent.enabled) {
                parent.enabled = true;
                if (this.debugMode) {
                    this.Logger.info(`[WeaponEffects] Enabled parent ${parent.name} for muzzle flash`);
                }
            }
            parent = parent.parent;
        }
        // CRITICAL FIX: Enable the entity first, then trigger the flash() method
        // The entity needs to be enabled for the MuzzleFlash script to work
        flash.enabled = true;
        // Trigger the flash() method on the MuzzleFlash script component
        // The MuzzleFlash script handles particles, light, and camera shake
        if (flash.script && flash.script.muzzleFlash) {
            flash.script.muzzleFlash.flash();
            if (this.debugMode) {
                this.Logger.info(`[WeaponEffects] ✅ Triggered muzzle flash for ${weaponType}`);
            }
        } else {
            // Fallback: Auto-disable after brief duration (old behavior)
            setTimeout(()=>{
                if (flash) flash.enabled = false;
            }, 50); // 50ms flash
            if (this.debugMode) {
                this.Logger.warn(`[WeaponEffects] No MuzzleFlash script found on ${flash.name}, using fallback`);
            }
        }
    }
    // ========================================================================
    // IMPACT EFFECTS
    // ========================================================================
    /**
     * Create impact effect at hit location
     * Handles bullet holes, blood, and organic vs inorganic surfaces
     * 
     * @param {pc.Vec3} position - World position of impact
     * @param {pc.Vec3} normal - Surface normal at impact point
     * @param {pc.Entity} targetEntity - Entity that was hit
     */ createImpactEffect(position, normal, targetEntity) {
        if (this.debugMode) {
            this.Logger.info(`[WeaponEffects] 🎨 createImpactEffect called - position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        }
        if (!position) {
            this.Logger.warn('[WeaponEffects] createImpactEffect called without position');
            return;
        }
        // Determine if target is organic (living entity)
        const isOrganic = this._isOrganicTarget(targetEntity);
        if (this.debugMode) {
            this.Logger.info(`[WeaponEffects] Target: ${targetEntity?.name || 'unknown'}, isOrganic: ${isOrganic}`);
        }
        if (isOrganic) {
            this._createBloodEffect(position, targetEntity);
        } else {
            this._createBulletHole(position, normal, targetEntity);
        }
    }
    _isOrganicTarget(entity) {
        if (!entity) return false;
        // Check for living entity indicators
        const hasHealthSystem = !!(entity.script?.healthSystem || entity.script?.health);
        const hasCharacterTag = entity.tags?.has('character') || entity.tags?.has('organic');
        const isPlayer = entity.tags?.has('player');
        const isAI = entity.tags?.has('ai') || !!entity.script?.aiAgent;
        return hasHealthSystem && (hasCharacterTag || isPlayer || isAI);
    }
    _createBloodEffect(position, targetEntity) {
        if (this.debugMode) {
            this.Logger.info(`[WeaponEffects] 💉 Creating blood effect on ${targetEntity?.name || 'unknown'}`);
        }
        // Create multiple blood splatter marks with improved realism
        const numSplatters = 3 + Math.floor(Math.random() * 3); // 3-5 splatters
        for(let i = 0; i < numSplatters; i++){
            const bloodDecal = new pc.Entity('BloodDecal');
            // Use flattened sphere (ellipsoid) for more realistic splatter shape
            bloodDecal.addComponent('render', {
                type: 'sphere',
                castShadows: false,
                receiveShadows: true // Receive shadows for better integration
            });
            // Create more realistic blood material with variation
            const material = new pc.StandardMaterial();
            // Vary the blood color slightly for each splatter (more realistic)
            const colorVariation = 0.1 + Math.random() * 0.15;
            material.diffuse = new pc.Color(0.3 + colorVariation, 0.02 + colorVariation * 0.2, 0.02 + colorVariation * 0.1 // Blue channel (very slight)
            );
            // Subtle emissive for wet look
            material.emissive = new pc.Color(0.08, 0, 0);
            // Higher opacity, more solid
            material.opacity = 0.9 + Math.random() * 0.1;
            material.blendType = pc.BLEND_NORMAL;
            // Add slight metalness for wet/glossy appearance
            material.metalness = 0.2;
            material.glossiness = 0.4;
            material.update();
            bloodDecal.render.meshInstances[0].material = material;
            // Varied sizes - some small, some larger
            const baseSize = 0.04 + Math.random() * 0.06;
            // Flatten on one axis for splatter effect (not perfect spheres)
            bloodDecal.setLocalScale(baseSize * (1.2 + Math.random() * 0.5), baseSize * (0.3 + Math.random() * 0.3), baseSize * (1.2 + Math.random() * 0.5 // Depth
            ));
            // Random position near impact with more spread
            const spreadRadius = 0.2;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * spreadRadius;
            const offset = new pc.Vec3(Math.cos(angle) * distance, (Math.random() - 0.5) * 0.1, Math.sin(angle) * distance);
            const bloodPos = position.clone().add(offset);
            // Convert world position to local position relative to target entity
            const invWorldTransform = targetEntity.getWorldTransform().clone().invert();
            const localPos = new pc.Vec3();
            invWorldTransform.transformPoint(bloodPos, localPos);
            bloodDecal.setLocalPosition(localPos);
            // Random rotation for more organic look
            bloodDecal.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
            // Add as child to target entity so it moves with the agent
            targetEntity.addChild(bloodDecal);
            // Improved fade with different timings for each splatter
            const startTime = Date.now();
            const fadeDelay = Math.random() * 1000; // Random delay 0-1s
            const fadeOutAfter = 4000 + Math.random() * 2000; // 4-6 seconds
            const destroyAfter = fadeOutAfter + 3000; // +3 seconds to fade
            const fadeBlood = ()=>{
                if (!bloodDecal.parent) return;
                const elapsed = Date.now() - startTime - fadeDelay;
                if (elapsed < 0) {
                    requestAnimationFrame(fadeBlood);
                    return;
                }
                if (elapsed > destroyAfter) {
                    bloodDecal.destroy();
                    return;
                }
                // Gradual fade out
                if (elapsed > fadeOutAfter) {
                    const fadeProgress = (elapsed - fadeOutAfter) / (destroyAfter - fadeOutAfter);
                    material.opacity = (0.9 + Math.random() * 0.1) * (1 - fadeProgress);
                    material.update();
                }
                requestAnimationFrame(fadeBlood);
            };
            requestAnimationFrame(fadeBlood);
        }
    }
    _createBulletHole(position, normal, targetEntity) {
        if (!targetEntity) return;
        // DEFENSIVE: Ensure target has render component
        if (!targetEntity.render && !targetEntity.model) {
            return;
        }
        if (this.debugMode) {
            this.Logger.info(`[WeaponEffects] 🎯 Creating bullet hole on ${targetEntity.name}`);
        }
        // Create bullet hole as a small dark sphere
        const bulletHole = new pc.Entity('BulletHole');
        bulletHole.addComponent('render', {
            type: 'sphere',
            castShadows: false,
            receiveShadows: true
        });
        // Create dark material
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(0.05, 0.05, 0.05); // Very dark gray
        material.metalness = 0.1;
        material.opacity = 0.95;
        material.update();
        bulletHole.render.meshInstances[0].material = material;
        // Small size for bullet hole
        bulletHole.setLocalScale(0.08, 0.08, 0.08);
        // Position slightly offset from surface to avoid z-fighting
        const offset = normal ? normal.clone().mulScalar(0.02) : new pc.Vec3(0, 0.02, 0);
        bulletHole.setPosition(position.clone().add(offset));
        // Add to scene
        this.app.root.addChild(bulletHole);
        // Store in decal pool for cleanup
        this._addDecalToMesh(position, normal, targetEntity, bulletHole);
    }
    _addDecalToMesh(position, normal, targetEntity, bulletHoleEntity = null) {
        // Add to pool (simplified for now)
        this.decalPool.push({
            position: position.clone(),
            normal: normal ? normal.clone() : new pc.Vec3(0, 1, 0),
            target: targetEntity,
            entity: bulletHoleEntity,
            timestamp: Date.now()
        });
        if (this.debugMode) {
            const poolIndex = this.decalPool.length;
            this.Logger.info(`[WeaponEffects] ✅ Bullet hole decal added at index ${poolIndex}`);
        }
        // Limit pool size and cleanup old decals
        if (this.decalPool.length > this.maxDecals) {
            const oldDecal = this.decalPool.shift();
            if (oldDecal.entity && oldDecal.entity.parent) {
                oldDecal.entity.destroy();
            }
        }
    }
    // ========================================================================
    // SOUND EFFECTS
    // ========================================================================
    playFireSound(weaponType) {
    // TODO: Implement audio playback
    // this.app.fire('audio:play', { sound: `weapon_fire_${weaponType}` });
    }
    playReloadSound(weaponType) {
    // TODO: Implement audio playback
    // this.app.fire('audio:play', { sound: `weapon_reload_${weaponType}` });
    }
    // ========================================================================
    // CLEANUP
    // ========================================================================
    cleanup() {
        // Cancel any pending verifications
        for (const [entityId, handler] of this._verificationHandlers.entries()){
            this.app.off('postrender', handler);
        }
        this._verificationHandlers.clear();
        this._pendingVerifications.clear();
        // Cleanup all decal entities
        for (const decal of this.decalPool){
            if (decal.entity && decal.entity.parent) {
                decal.entity.destroy();
            }
        }
        this.decalPool = [];
        this.Logger.info(`[WeaponEffects] Cleaned up for ${this.entityName}`);
    }
    constructor(config, logger){
        this.config = config || {};
        this.Logger = logger || console;
        // PlayCanvas references (set in initialize)
        this.app = null;
        this.entity = null;
        this.entityId = null;
        this.entityName = null;
        // Weapon models (container entities)
        this.weaponModels = {};
        // Muzzle flash entities
        this.muzzleFlashEntities = {};
        // Decal system
        this.decalPool = [];
        this.maxDecals = aiConfig.weaponEffects.MAX_DECALS;
        this.decalMaterial = null;
        // State verification tracking
        this._pendingVerifications = new Map();
        this._verificationHandlers = new Map();
        // Debug mode
        this.debugMode = config.debugMode || false;
    }
}

export { WeaponEffects };
