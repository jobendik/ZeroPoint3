/**
 * AnimationTest.js
 * 
 * Minimal animation controller for testing Mixamo animations in PlayCanvas Editor.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create entity with Model component (your Mixamo character)
 * 2. Add Animation component to same entity
 * 3. Attach this script to the entity
 * 4. Import all your Mixamo animations as GLB assets
 * 5. Press number keys 0-9 to test animations:
 *    - 0 = Idle (default)
 *    - 1 = Walk
 *    - 2 = Run
 *    - 3 = Aim
 *    - 4 = Fire
 *    - 5 = Jump
 *    - 6 = Reload
 *    - 7 = Strafe Left
 *    - 8 = Strafe Right
 *    - 9 = Death
 * 
 * This script will:
 * - Auto-find all animations by name from asset registry
 * - Create animation state graph programmatically
 * - Apply Mixamo Hips Y-rotation fix every frame
 * - Show diagnostic info in console
 */

var AnimationTest = pc.createScript('animationTest');

// Configuration attributes
AnimationTest.attributes.add('fixHipsTwist', { type: 'boolean', default: true, title: 'Fix Mixamo Hips Twist' });
AnimationTest.attributes.add('hipsBoneName', { type: 'string', default: 'mixamorig:Hips', title: 'Hips Bone Name' });

// Initialize
AnimationTest.prototype.initialize = function() {
    console.log('========================================');
    console.log('🎬 AnimationTest.initialize()');
    console.log('========================================');
    
    this.animComponent = this.entity.anim;
    
    if (!this.animComponent) {
        console.error('❌ No Animation component found! Add an Animation component to this entity.');
        return;
    }
    
    // Find all animation clips
    this.clips = this._findAnimationClips();
    
    if (Object.keys(this.clips).length === 0) {
        console.error('❌ No animations found! Import Mixamo GLB files as assets.');
        return;
    }
    
    console.log('📊 Found animations:', Object.keys(this.clips));
    
    // Create animation state graph
    this._createAnimationGraph();
    
    // Initialize Hips bone fix
    this._hipsBone = undefined; // Use undefined to trigger search on first update
    this._lastHipsDebugTime = 0;
    
    // Current state tracking
    this.currentState = 'Idle';
    
    // Keyboard controls
    this.app.keyboard.on(pc.EVENT_KEYDOWN, this._onKeyDown, this);
    
    console.log('✅ AnimationTest ready!');
    console.log('Press 0-9 to test animations:');
    console.log('  0 = Idle, 1 = Walk, 2 = Run, 3 = Aim, 4 = Fire');
    console.log('  5 = Jump, 6 = Reload, 7 = Strafe Left, 8 = Strafe Right, 9 = Death');
    console.log('========================================');
};

// Find animation clips from asset registry by name
AnimationTest.prototype._findAnimationClips = function() {
    var clips = {};
    
    console.log('🔍 Searching asset registry for animations...');
    
    var allAssets = this.app.assets.list({ type: 'animation' });
    console.log('Total animation assets:', allAssets.length);
    
    var self = this;
    allAssets.forEach(function(asset) {
        if (!asset.loaded || !asset.resource) return;
        
        var name = asset.name.toLowerCase();
        
        // Skip GLB container resources - we want the extracted AnimTrack assets
        if (asset.resource.constructor && asset.resource.constructor.name === 'GlbContainerResource') {
            return;
        }
        
        // Only use assets where resource is an AnimTrack (pc.AnimTrack)
        if (asset.resource.constructor && asset.resource.constructor.name !== 'AnimTrack') {
            return;
        }
        
        // Mixamo exports all have "mixamo.com" as the take name
        // Extract parent folder name from file URL
        // URL format: 'assets/files/idle.fbx/mixamo.com.glb'
        
        var animName = '';
        if (asset.file && asset.file.url) {
            var url = asset.file.url;
            // Extract animation name from URL
            // Supports both: 'assets/files/idle.fbx/mixamo.com.glb' AND 'assets/files/idle.glb'
            
            // Try pattern 1: idle.fbx/mixamo.com.glb (FBX export)
            var matches = url.match(/\/([^\/]+)\.fbx\//);
            if (matches && matches[1]) {
                animName = matches[1].toLowerCase();
                console.log('  🎯 AnimTrack (FBX):', asset.name, '→ Animation:', animName);
            } else {
                // Try pattern 2: idle.glb (direct GLB)
                matches = url.match(/\/([^\/]+)\.glb/);
                if (matches && matches[1]) {
                    animName = matches[1].toLowerCase();
                    console.log('  🎯 AnimTrack (GLB):', asset.name, '→ Animation:', animName);
                } else {
                    console.log('  ⚠️ Could not parse URL:', url);
                    return;
                }
            }
        } else {
            console.log('  ⚠️ No file.url found');
            return;
        }
        
        // Match by animation name from URL
        if (animName.includes('idle') && !animName.includes('crouch') && !clips.idle) {
            clips.idle = asset;
            console.log('    ✅ Assigned to: Idle');
        } else if (animName.includes('walk') && !animName.includes('crouch') && !clips.walk) {
            clips.walk = asset;
            console.log('    ✅ Assigned to: Walk');
        } else if (animName.includes('run') && !clips.run) {
            clips.run = asset;
            console.log('    ✅ Assigned to: Run');
        } else if (animName.includes('aim') && !clips.aim) {
            clips.aim = asset;
            console.log('    ✅ Assigned to: Aim');
        } else if ((animName.includes('fire') || animName.includes('shoot')) && !clips.fire) {
            clips.fire = asset;
            console.log('    ✅ Assigned to: Fire');
        } else if (animName.includes('jump') && !animName.includes('down') && !clips.jump) {
            clips.jump = asset;
            console.log('    ✅ Assigned to: Jump');
        } else if (animName.includes('reload') && !clips.reload) {
            clips.reload = asset;
            console.log('    ✅ Assigned to: Reload');
        } else if (animName.includes('strafe') && animName.includes('left') && !clips.strafeLeft) {
            clips.strafeLeft = asset;
            console.log('    ✅ Assigned to: Strafe Left');
        } else if (animName.includes('strafe') && animName.includes('right') && !clips.strafeRight) {
            clips.strafeRight = asset;
            console.log('    ✅ Assigned to: Strafe Right');
        } else if (animName.includes('death') && !clips.death) {
            clips.death = asset;
            console.log('    ✅ Assigned to: Death');
        }
    });
    
    return clips;
};

// Create animation state graph programmatically
AnimationTest.prototype._createAnimationGraph = function() {
    console.log('🚀 Creating animation state graph...');
    
    // Create state graph data structure
    var stateGraphData = {
        layers: [{
            name: 'Base Layer',
            states: [
                { name: 'START' },
                { name: 'Idle', speed: 1, loop: true },
                { name: 'Walk', speed: 1, loop: true },
                { name: 'Run', speed: 1, loop: true },
                { name: 'Aim', speed: 1, loop: true },
                { name: 'Fire', speed: 1, loop: false },
                { name: 'Jump', speed: 1, loop: false },
                { name: 'Reload', speed: 1, loop: false },
                { name: 'StrafeLeft', speed: 1, loop: true },
                { name: 'StrafeRight', speed: 1, loop: true },
                { name: 'Death', speed: 1, loop: false }
            ],
            transitions: [
                // ✅ CRITICAL: Auto-transition from START to Idle on load
                {
                    from: 'START',
                    to: 'Idle',
                    time: 0,
                    priority: 0
                }
            ]
        }],
        parameters: {}
    };
    
    // Load the state graph
    this.animComponent.loadStateGraph(stateGraphData);
    
    var baseLayer = this.animComponent.baseLayer;
    
    // Assign animation clips to states (resource is AnimTrack directly)
    if (this.clips.idle) baseLayer.assignAnimation('Idle', this.clips.idle.resource);
    if (this.clips.walk) baseLayer.assignAnimation('Walk', this.clips.walk.resource);
    if (this.clips.run) baseLayer.assignAnimation('Run', this.clips.run.resource);
    if (this.clips.aim) baseLayer.assignAnimation('Aim', this.clips.aim.resource);
    if (this.clips.fire) baseLayer.assignAnimation('Fire', this.clips.fire.resource);
    if (this.clips.jump) baseLayer.assignAnimation('Jump', this.clips.jump.resource);
    if (this.clips.reload) baseLayer.assignAnimation('Reload', this.clips.reload.resource);
    if (this.clips.strafeLeft) baseLayer.assignAnimation('StrafeLeft', this.clips.strafeLeft.resource);
    if (this.clips.strafeRight) baseLayer.assignAnimation('StrafeRight', this.clips.strafeRight.resource);
    if (this.clips.death) baseLayer.assignAnimation('Death', this.clips.death.resource);
    
    console.log('✅ Animation state graph created');
    console.log('Base Layer states:', baseLayer.states);
    console.log('Active state:', baseLayer.activeState);
    
    // Start playing
    this.animComponent.playing = true;
    
    // Transition to Idle
    if (this.clips.idle) {
        this._transitionToState('Idle');
    }
};

// Transition to animation state
AnimationTest.prototype._transitionToState = function(stateName) {
    console.log('🎬 Transitioning to:', stateName);
    
    var baseLayer = this.animComponent.baseLayer;
    
    // Check if state exists
    if (baseLayer.states.indexOf(stateName) === -1) {
        console.warn('⚠️ State not found:', stateName);
        return;
    }
    
    // Transition with 0.2s blend
    baseLayer.transition(stateName, 0.2);
    
    this.currentState = stateName;
    
    console.log('✅ Transitioned to:', stateName);
    console.log('Active state:', baseLayer.activeState);
    console.log('Active state name:', baseLayer.activeStateName);
    console.log('Playing:', this.animComponent.playing);
};

// Keyboard input handler
AnimationTest.prototype._onKeyDown = function(event) {
    switch(event.key) {
        case pc.KEY_0:
            if (this.clips.idle) this._transitionToState('Idle');
            break;
        case pc.KEY_1:
            if (this.clips.walk) this._transitionToState('Walk');
            break;
        case pc.KEY_2:
            if (this.clips.run) this._transitionToState('Run');
            break;
        case pc.KEY_3:
            if (this.clips.aim) this._transitionToState('Aim');
            break;
        case pc.KEY_4:
            if (this.clips.fire) this._transitionToState('Fire');
            break;
        case pc.KEY_5:
            if (this.clips.jump) this._transitionToState('Jump');
            break;
        case pc.KEY_6:
            if (this.clips.reload) this._transitionToState('Reload');
            break;
        case pc.KEY_7:
            if (this.clips.strafeLeft) this._transitionToState('StrafeLeft');
            break;
        case pc.KEY_8:
            if (this.clips.strafeRight) this._transitionToState('StrafeRight');
            break;
        case pc.KEY_9:
            if (this.clips.death) this._transitionToState('Death');
            break;
    }
};

// Fix Mixamo Hips Y-rotation twist every frame
AnimationTest.prototype._fixHipsTwist = function() {
    if (!this.fixHipsTwist) return;
    
    // Search for Hips bone only once
    if (this._hipsBone === undefined) {
        this._hipsBone = this.entity.findByName(this.hipsBoneName);
        
        if (this._hipsBone) {
            console.log('✅ Found Hips bone:', this._hipsBone.name);
            console.log('   Path:', this._hipsBone.path);
        } else {
            console.warn('⚠️ Hips bone "' + this.hipsBoneName + '" not found!');
            console.warn('   Entity hierarchy:');
            this._logEntityHierarchy(this.entity, 0);
            this._hipsBone = null; // Set to null to prevent further searches
        }
    }
    
    // Apply fix if bone was found
    if (this._hipsBone) {
        var currentRot = this._hipsBone.getLocalEulerAngles();
        
        // Debug log every 2 seconds
        var now = Date.now();
        if (!this._lastHipsDebugTime || (now - this._lastHipsDebugTime) > 2000) {
            console.log('🦴 Hips rotation (state: ' + this.currentState + '):');
            console.log('   BEFORE fix: X=' + currentRot.x.toFixed(1) + '° Y=' + currentRot.y.toFixed(1) + '° Z=' + currentRot.z.toFixed(1) + '°');
            this._lastHipsDebugTime = now;
        }
        
        // Reset Y-rotation to 0, keep X and Z for animation effects
        this._hipsBone.setLocalEulerAngles(currentRot.x, 0, currentRot.z);
    }
};

// Helper: Log entity hierarchy for debugging
AnimationTest.prototype._logEntityHierarchy = function(entity, depth) {
    var indent = '';
    for (var i = 0; i < depth; i++) indent += '  ';
    
    console.log(indent + '- ' + entity.name);
    
    if (depth < 5) { // Limit depth to avoid spam
        for (var j = 0; j < entity.children.length; j++) {
            this._logEntityHierarchy(entity.children[j], depth + 1);
        }
    }
};

// Update loop
AnimationTest.prototype.update = function(dt) {
    if (!this.animComponent) return;
    
    // Apply Hips rotation fix every frame
    this._fixHipsTwist();
};

// Cleanup
AnimationTest.prototype.destroy = function() {
    if (this.app.keyboard) {
        this.app.keyboard.off(pc.EVENT_KEYDOWN, this._onKeyDown, this);
    }
};
