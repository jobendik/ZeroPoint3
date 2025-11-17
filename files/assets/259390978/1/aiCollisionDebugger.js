/**
 * AI Agent Collision Debugger
 * Diagnoses why AI agents don't take damage from player shots
 */

var AICollisionDebugger = pc.createScript('aiCollisionDebugger');

AICollisionDebugger.prototype.initialize = function() {
    console.log('[AICollisionDebugger] Starting AI collision diagnostics...');
    
    // Wait for game to start
    setTimeout(() => this.runDiagnostics(), 3000);
    
    // Add console helpers
    window.checkAICollision = () => this.runDiagnostics();
    window.fixAICollision = () => this.fixAICollision();
    
    console.log('[AICollisionDebugger] Console helpers available:');
    console.log('  checkAICollision() - Check AI collision setup');
    console.log('  fixAICollision() - Attempt to fix AI collision');
};

AICollisionDebugger.prototype.runDiagnostics = function() {
    console.log('\n========== AI COLLISION DIAGNOSTICS ==========');
    
    // Find all AI agents
    const aiAgents = this.app.root.findByTag('ai') || [];
    
    if (aiAgents.length === 0) {
        // Fallback: search by name
        const root = this.app.root.findByName('GameWorld') || this.app.root;
        const agent = root.findByName('AIAgent');
        if (agent) aiAgents.push(agent);
    }
    
    console.log(`Found ${aiAgents.length} AI agent(s)`);
    
    aiAgents.forEach((agent, index) => {
        console.log(`\n--- AI Agent ${index + 1}: ${agent.name} ---`);
        this.checkAgent(agent);
    });
    
    console.log('\n========== END DIAGNOSTICS ==========\n');
};

AICollisionDebugger.prototype.checkAgent = function(agent) {
    console.log(`Entity: ${agent.name}`);
    console.log(`  Enabled: ${agent.enabled}`);
    console.log(`  Destroyed: ${agent.destroyed || false}`);
    console.log(`  Position: (${agent.getPosition().x.toFixed(2)}, ${agent.getPosition().y.toFixed(2)}, ${agent.getPosition().z.toFixed(2)})`);
    console.log(`  Tags: ${agent.tags.list().join(', ') || 'none'}`);
    
    // Check collision component
    if (agent.collision) {
        console.log(`  ✅ HAS Collision Component:`);
        console.log(`     - Type: ${agent.collision.type}`);
        console.log(`     - Enabled: ${agent.collision.enabled}`);
        console.log(`     - Trigger: ${agent.collision.trigger || false}`);
        
        if (agent.collision.type === pc.BODYTYPE_STATIC) {
            console.warn(`     ⚠️ WARNING: Collision is STATIC (won't be detected by raycasts)`);
        }
        if (agent.collision.trigger) {
            console.warn(`     ⚠️ WARNING: Collision is a TRIGGER (won't stop raycasts)`);
        }
    } else {
        console.error(`  ❌ NO Collision Component!`);
    }
    
    // Check rigidbody component  
    if (agent.rigidbody) {
        console.log(`  ✅ HAS Rigidbody Component:`);
        console.log(`     - Type: ${agent.rigidbody.type === pc.BODYTYPE_STATIC ? 'STATIC' : agent.rigidbody.type === pc.BODYTYPE_DYNAMIC ? 'DYNAMIC' : 'KINEMATIC'}`);
        console.log(`     - Enabled: ${agent.rigidbody.enabled}`);
        console.log(`     - Mass: ${agent.rigidbody.mass}`);
        console.log(`     - Kinematic: ${agent.rigidbody.kinematic || false}`);
        
        if (agent.rigidbody.type === pc.BODYTYPE_STATIC) {
            console.warn(`     ⚠️ WARNING: Rigidbody is STATIC (should be KINEMATIC or DYNAMIC)`);
        }
        if (!agent.rigidbody.enabled) {
            console.error(`     ❌ ERROR: Rigidbody is DISABLED!`);
        }
    } else {
        console.error(`  ❌ NO Rigidbody Component!`);
    }
    
    // Check health system
    if (agent.script && agent.script.healthSystem) {
        const hs = agent.script.healthSystem;
        console.log(`  ✅ HAS Health System:`);
        console.log(`     - Initialized: ${hs.__healthSystemBooted || false}`);
        console.log(`     - Health: ${hs.currentHealth}/${hs.maxHealth}`);
        console.log(`     - Dead: ${hs.isDead}`);
        console.log(`     - Enabled: ${hs.enabled}`);
    } else {
        console.error(`  ❌ NO Health System!`);
    }
    
    // Test raycast
    this.testRaycast(agent);
};

AICollisionDebugger.prototype.testRaycast = function(agent) {
    const agentPos = agent.getPosition();
    const testOrigin = agentPos.clone().add(new pc.Vec3(-5, 0, 0));
    const direction = new pc.Vec3(1, 0, 0);
    const endPoint = testOrigin.clone().add(direction.clone().scale(10));
    
    const result = this.app.systems.rigidbody.raycastFirst(testOrigin, endPoint);
    
    console.log(`  🎯 Raycast Test:`);
    console.log(`     From: (${testOrigin.x.toFixed(2)}, ${testOrigin.y.toFixed(2)}, ${testOrigin.z.toFixed(2)})`);
    console.log(`     To: (${endPoint.x.toFixed(2)}, ${endPoint.y.toFixed(2)}, ${endPoint.z.toFixed(2)})`);
    
    if (result) {
        console.log(`     ✅ HIT: ${result.entity.name}`);
        console.log(`     Point: (${result.point.x.toFixed(2)}, ${result.point.y.toFixed(2)}, ${result.point.z.toFixed(2)})`);
        
        if (result.entity === agent) {
            console.log(`     ✅ Raycast CAN hit this AI agent!`);
        } else {
            console.warn(`     ⚠️ Raycast hit ${result.entity.name} instead of AI agent`);
        }
    } else {
        console.error(`     ❌ MISS: Raycast did NOT hit anything!`);
        console.error(`     ❌ This AI agent CANNOT be hit by raycasts!`);
    }
};

AICollisionDebugger.prototype.fixAICollision = function() {
    console.log('\n========== ATTEMPTING TO FIX AI COLLISION ==========');
    
    // Find all AI agents
    const aiAgents = this.app.root.findByTag('ai') || [];
    
    if (aiAgents.length === 0) {
        const root = this.app.root.findByName('GameWorld') || this.app.root;
        const agent = root.findByName('AIAgent');
        if (agent) aiAgents.push(agent);
    }
    
    aiAgents.forEach((agent, index) => {
        console.log(`\nFixing AI Agent ${index + 1}: ${agent.name}`);
        
        // Ensure agent is enabled
        if (!agent.enabled) {
            agent.enabled = true;
            console.log('  ✅ Enabled agent entity');
        }
        
        // Fix rigidbody if it exists
        if (agent.rigidbody) {
            console.log('  🔧 Fixing rigidbody...');
            
            // Force disable then re-enable to reset physics simulation
            agent.rigidbody.enabled = false;
            
            // ✅ CRITICAL FIX: Ensure it's KINEMATIC type
            if (agent.rigidbody.type !== pc.BODYTYPE_KINEMATIC) {
                agent.rigidbody.type = pc.BODYTYPE_KINEMATIC;
                console.log('  ✅ Changed rigidbody type to KINEMATIC');
            }
            
            // ✅ CRITICAL FIX: Set kinematic FLAG (THIS IS ESSENTIAL!)
            // Without this flag, raycasts cannot detect the entity even if type is KINEMATIC
            if (agent.rigidbody.kinematic !== true) {
                agent.rigidbody.kinematic = true;
                console.log('  ✅✅✅ Set kinematic FLAG to true (CRITICAL FIX)');
            }
            
            // Set mass
            if (agent.rigidbody.mass !== 80) {
                agent.rigidbody.mass = 80;
                console.log('  ✅ Set mass to 80');
            }
            
            // Re-enable to force re-registration with physics system
            // This recreates the physics body with the new kinematic setting
            agent.rigidbody.enabled = true;
            console.log('  ✅ Re-enabled rigidbody (physics body recreated with kinematic flag)');
            
            // Force teleport to current position to sync physics body
            const pos = agent.getPosition();
            const rot = agent.getRotation();
            agent.rigidbody.teleport(pos, rot);
            console.log('  ✅ Teleported rigidbody to sync physics body');
            
        } else {
            console.error('  ❌ Cannot fix: No rigidbody component');
            console.log('  💡 Add a rigidbody component to this entity in the editor');
            console.log('     - Type: KINEMATIC');
            console.log('     - Mass: 80');
            console.log('     - Enable: true');
        }
        
        // Fix collision if it exists
        if (agent.collision) {
            console.log('  🔧 Fixing collision...');
            
            const wasEnabled = agent.collision.enabled;
            
            // Force disable then re-enable
            agent.collision.enabled = false;
            
            if (agent.collision.trigger) {
                agent.collision.trigger = false;
                console.log('  ✅ Disabled collision trigger mode');
            }
            
            // Re-enable
            agent.collision.enabled = true;
            console.log('  ✅ Re-enabled collision');
            
        } else {
            console.error('  ❌ Cannot fix: No collision component');
            console.log('  💡 Add a collision component to this entity in the editor');
            console.log('     - Type: Capsule (recommended)');
            console.log('     - Radius: 0.5');
            console.log('     - Height: 1.8');
            console.log('     - Trigger: false');
        }
        
        // Ensure health system is enabled
        if (agent.script && agent.script.healthSystem) {
            if (!agent.script.healthSystem.enabled) {
                agent.script.healthSystem.enabled = true;
                console.log('  ✅ Enabled health system');
            }
        }
    });
    
    console.log('\n========== FIX ATTEMPT COMPLETE ==========');
    console.log('⚠️ IMPORTANT: You may need to reload the scene for physics changes to take effect');
    console.log('Run checkAICollision() to verify the fixes\n');
};
