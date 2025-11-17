/**
 * Fix AI Collision - Comprehensive fix for AI agent raycast detection issues
 * 
 * This script fixes the critical issue where AI agents cannot be hit by raycasts
 * due to improper rigidbody configuration.
 * 
 * ROOT CAUSE:
 * - PlayCanvas kinematic rigidbodies require BOTH:
 *   1. rigidbody.type = pc.BODYTYPE_KINEMATIC (value: 1)
 *   2. rigidbody.kinematic = true  <-- THIS WAS MISSING!
 * 
 * - Without the kinematic flag, the physics body is not properly registered
 *   in the physics world, causing raycasts to pass through the entity.
 * 
 * USAGE: Press U to run the fix on all AI agents
 */

var FixAiCollision = pc.createScript('fixAiCollision');

FixAiCollision.prototype.initialize = function() {
    console.log('✅ AI Collision Fix script loaded - Press the key U to fix all AI agents');
    
    // Add keyboard shortcut
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_U) {
            this.fixAllAIAgents();
        }
    });
    
    // Auto-fix on initialization (after a delay to ensure all agents are spawned)
    setTimeout(() => {
        console.log('🔧 Auto-fixing AI collision on startup...');
        this.fixAllAIAgents();
    }, 3000);
};

FixAiCollision.prototype.fixAllAIAgents = function() {
    console.log('\n========== AI COLLISION FIX ==========');
    
    // Find all AI agents
    const aiAgents = this.app.root.findComponents('script').filter(script => {
        return script.aiAgent && script.aiAgent.enabled;
    }).map(script => script.entity);
    
    console.log(`Found ${aiAgents.length} AI agent(s) to fix`);
    
    let fixedCount = 0;
    
    aiAgents.forEach((agent, index) => {
        console.log(`\n--- Fixing AI Agent ${index + 1}: ${agent.name} ---`);
        
        if (this.fixAgentCollision(agent)) {
            fixedCount++;
        }
    });
    
    console.log(`\n✅ Fixed ${fixedCount}/${aiAgents.length} AI agents`);
    console.log('========== FIX COMPLETE ==========\n');
    
    // Run test after fix
    setTimeout(() => {
        console.log('\n🧪 Running post-fix raycast tests...');
        this.testAllAgents();
    }, 500);
};

FixAiCollision.prototype.fixAgentCollision = function(agent) {
    console.log(`Entity: ${agent.name} at (${agent.getPosition().x.toFixed(2)}, ${agent.getPosition().y.toFixed(2)}, ${agent.getPosition().z.toFixed(2)})`);
    
    // Ensure prerequisites (auto-add if missing)
    if (!agent.collision) {
        console.warn('  ❌ NO COLLISION - Creating capsule collision component...');
        agent.addComponent('collision', {
            type: 'capsule',
            radius: 0.5,
            height: 1.8,
            axis: 1, // Y-axis
            enabled: true
        });
        console.log('  ✅ Added capsule collision component');
    } else if (agent.collision.trigger) {
        console.warn('  ⚠️ Collision was trigger - disabling trigger');
        agent.collision.trigger = false;
    }

    if (!agent.rigidbody) {
        console.warn('  ❌ NO RIGIDBODY - Creating kinematic rigidbody component...');
        agent.addComponent('rigidbody', {
            type: pc.BODYTYPE_KINEMATIC || 1,
            mass: 80,
            friction: 0.5,
            restitution: 0,
            enabled: true
        });
        console.log('  ✅ Added kinematic rigidbody component');
    }
    
    // Store original state
    const originalType = agent.rigidbody.type;
    const originalKinematic = agent.rigidbody.kinematic;
    const originalEnabled = agent.rigidbody.enabled;
    
    console.log(`  Original state: type=${originalType}, kinematic=${originalKinematic}, enabled=${originalEnabled}`);
    
    try {
        // ✅ CRITICAL FIX #1: Disable rigidbody to prepare for changes
        agent.rigidbody.enabled = false;
        
    // ✅ CRITICAL FIX #2: Set rigidbody type to KINEMATIC
        const KINEMATIC_TYPE = pc.BODYTYPE_KINEMATIC || 1;
        agent.rigidbody.type = KINEMATIC_TYPE;
        
        // ✅ CRITICAL FIX #3: Set kinematic flag to true (THIS IS THE KEY!)
        agent.rigidbody.kinematic = true;
        
    // Ensure broadphase filters are permissive
    agent.rigidbody.group = pc.BODYGROUP_DYNAMIC || 2;
    agent.rigidbody.mask = pc.BODYMASK_ALL || 0xFFFF;
        
        // ✅ CRITICAL FIX #4: Ensure collision is NOT a trigger
        if (agent.collision.trigger) {
            console.warn('  ⚠️ Collision was set to trigger mode - disabling trigger');
            agent.collision.trigger = false;
        }
        
        // ✅ CRITICAL FIX #5: Re-enable rigidbody to recreate physics body
        // This is ESSENTIAL - disabling/enabling forces PlayCanvas to recreate
        // the Ammo.js physics body with the new kinematic flag!
        agent.rigidbody.enabled = true;
        console.log('  🔄 Recreated physics body (via disable/enable cycle)');
        
        // ✅ CRITICAL FIX #6: Teleport to sync physics body with entity position
        const pos = agent.getPosition();
        const rot = agent.getRotation();
        agent.rigidbody.teleport(pos, rot);
        console.log('  📍 Teleported rigidbody to sync position');
        
        // Verify the fix
        const newType = agent.rigidbody.type;
        const newKinematic = agent.rigidbody.kinematic;
        const hasBody = agent.rigidbody.body !== null;
        
        console.log(`  New state: type=${newType}, kinematic=${newKinematic}, hasBody=${hasBody}`);
        
        if (newKinematic === true && hasBody) {
            console.log('  ✅ FIXED - Agent should now be detectable by raycasts!');
            return true;
        } else {
            console.error('  ❌ FIX FAILED - Agent may still not be detectable');
            return false;
        }
        
    } catch (e) {
        console.error('  ❌ ERROR during fix:', e);
        return false;
    }
};

FixAiCollision.prototype.testAllAgents = function() {
    // Find all AI agents
    const aiAgents = this.app.root.findComponents('script').filter(script => {
        return script.aiAgent && script.aiAgent.enabled;
    }).map(script => script.entity);
    
    console.log(`\n🎯 Testing raycast detection for ${aiAgents.length} agents...`);
    
    let passedCount = 0;
    
    aiAgents.forEach((agent, index) => {
        const pos = agent.getPosition();
        const testOrigin = new pc.Vec3(pos.x - 3, pos.y, pos.z);
        const testEnd = new pc.Vec3(pos.x + 3, pos.y, pos.z);
        
        const result = this.app.systems.rigidbody.raycastFirst(testOrigin, testEnd);
        
        if (result && result.entity === agent) {
            console.log(`  [${index}] ${agent.name}: ✅ PASS - Can be hit by raycast`);
            passedCount++;
        } else if (result) {
            console.warn(`  [${index}] ${agent.name}: ⚠️ PARTIAL - Hit ${result.entity.name} instead`);
        } else {
            console.error(`  [${index}] ${agent.name}: ❌ FAIL - Not detectable by raycast`);
        }
    });
    
    console.log(`\n📊 Test Results: ${passedCount}/${aiAgents.length} agents are raycast-detectable`);
    
    if (passedCount === aiAgents.length) {
        console.log('🎉 SUCCESS! All AI agents can now be hit by raycasts!');
    } else {
        console.error('⚠️ Some agents still cannot be hit. Check editor rigidbody/collision setup.');
    }
};

FixAiCollision.prototype.update = function(dt) {
    // Optionally, continuously monitor and auto-fix agents
    // Disabled by default to avoid performance impact
};
