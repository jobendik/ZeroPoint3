
/**
 * ALTERNATIVE SOLUTION: Slope Ramp Generator
 * 
 * This script automatically generates invisible collision ramps over stairs
 * to make them act like smooth slopes. Attach to your level.glb entity.
 * 
 * HOW TO USE:
 * 1. Attach this script to your level entity (the one with stairs)
 * 2. Set stairDetectionTag to match entities that are stairs (or leave blank to auto-detect)
 * 3. Configure ramp settings in the inspector
 * 
 * The script will:
 * - Detect stair geometry automatically
 * - Generate invisible collision boxes that form smooth ramps
 * - Allow the player to walk up stairs smoothly without jumping
 */

const SlopeRampGenerator = pc.createScript('slopeRampGenerator');

// Script attributes
SlopeRampGenerator.attributes.add('enabled', {
    type: 'boolean',
    default: true,
    title: 'Generate Ramps',
    description: 'Enable automatic ramp generation over stairs'
});

SlopeRampGenerator.attributes.add('stairDetectionTag', {
    type: 'string',
    default: '',
    title: 'Stair Tag',
    description: 'Tag to identify stair entities (leave empty for auto-detection)'
});

SlopeRampGenerator.attributes.add('rampAngle', {
    type: 'number',
    default: 35,
    min: 15,
    max: 60,
    title: 'Ramp Angle',
    description: 'Angle of generated ramps (degrees)'
});

SlopeRampGenerator.attributes.add('rampWidth', {
    type: 'number',
    default: 3,
    min: 0.5,
    max: 10,
    title: 'Ramp Width',
    description: 'Width of generated ramps (meters)'
});

SlopeRampGenerator.attributes.add('debugVisualization', {
    type: 'boolean',
    default: false,
    title: 'Show Debug Ramps',
    description: 'Visualize generated ramps (for testing)'
});

SlopeRampGenerator.prototype.initialize = function() {
    if (!this.enabled) return;
    
    // Wait for scene to fully load
    this.app.once('start', () => {
        this.generateRamps();
    });
};

/**
 * Detect stairs and generate collision ramps
 */
SlopeRampGenerator.prototype.generateRamps = function() {
    console.log('[SlopeRampGenerator] Scanning for stairs...');
    
    const stairs = this.detectStairs();
    
    if (stairs.length === 0) {
        console.warn('[SlopeRampGenerator] No stairs detected. Check your stairDetectionTag or geometry.');
        return;
    }
    
    console.log(`[SlopeRampGenerator] Found ${stairs.length} stair sections. Generating ramps...`);
    
    stairs.forEach((stairData, index) => {
        this.createRampForStair(stairData, index);
    });
    
    console.log('[SlopeRampGenerator] Ramp generation complete!');
};

/**
 * Detect stair geometry in the scene
 * @returns {Array} Array of stair data objects
 */
SlopeRampGenerator.prototype.detectStairs = function() {
    const stairs = [];
    
    // If tag specified, use tagged entities
    if (this.stairDetectionTag) {
        const taggedEntities = this.app.root.findByTag(this.stairDetectionTag);
        taggedEntities.forEach(entity => {
            stairs.push(this.analyzeStairEntity(entity));
        });
    } else {
        // Auto-detect from render components (look for step-like geometry)
        const renderEntities = this.entity.findComponents('render');
        renderEntities.forEach(render => {
            const stairData = this.analyzeGeometry(render.entity);
            if (stairData) {
                stairs.push(stairData);
            }
        });
    }
    
    return stairs;
};

/**
 * Analyze entity to extract stair dimensions
 */
SlopeRampGenerator.prototype.analyzeStairEntity = function(entity) {
    const aabb = entity.aabb || entity.model?.meshInstances[0]?.aabb;
    
    if (!aabb) {
        return {
            position: entity.getPosition().clone(),
            rotation: entity.getEulerAngles().clone(),
            width: this.rampWidth,
            height: 1,
            depth: 2
        };
    }
    
    return {
        position: aabb.center.clone(),
        rotation: entity.getEulerAngles().clone(),
        width: this.rampWidth,
        height: aabb.halfExtents.y * 2,
        depth: aabb.halfExtents.z * 2
    };
};

/**
 * Analyze geometry to detect stairs automatically
 */
SlopeRampGenerator.prototype.analyzeGeometry = function(entity) {
    // This is a simplified version - you may need to customize based on your geometry
    const name = entity.name.toLowerCase();
    
    if (name.includes('stair') || name.includes('step')) {
        return this.analyzeStairEntity(entity);
    }
    
    return null;
};

/**
 * Create an invisible collision ramp over stairs
 */
SlopeRampGenerator.prototype.createRampForStair = function(stairData, index) {
    const rampEntity = new pc.Entity(`StairRamp_${index}`);
    
    // Position ramp
    rampEntity.setPosition(stairData.position);
    rampEntity.setEulerAngles(
        this.rampAngle,
        stairData.rotation.y,
        stairData.rotation.z
    );
    
    // Add collision (invisible ramp)
    rampEntity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(
            stairData.width / 2,
            0.1, // Thin ramp
            stairData.depth / 2
        )
    });
    
    rampEntity.addComponent('rigidbody', {
        type: 'static',
        friction: 0.5
    });
    
    // Debug visualization (optional)
    if (this.debugVisualization) {
        rampEntity.addComponent('render', {
            type: 'box',
            material: this.createDebugMaterial()
        });
    }
    
    this.entity.addChild(rampEntity);
};

/**
 * Create semi-transparent material for debug visualization
 */
SlopeRampGenerator.prototype.createDebugMaterial = function() {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(0, 1, 0);
    material.opacity = 0.3;
    material.blendType = pc.BLEND_NORMAL;
    material.update();
    return material;
};
