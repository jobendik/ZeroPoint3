/**
 * Emergency AI Fix - Immediate fix for AI agents not being hittable
 * 
 * This script addresses the core issue where AI agents lose their
 * damageable status due to missing healthSystem scripts or improper
 * physics configuration after the enable/disable cycle during countdown.
 */

var EmergencyAIFix = pc.createScript('emergencyAIFix');

EmergencyAIFix.prototype.initialize = function() {
    console.log('🚨 Emergency AI Fix loaded - Press F5 for immediate fix');
    
    // Add keyboard shortcut for immediate fix
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_F5) {
            this.fixAllAIAgents();
        }
    });
    
    // Auto-fix after short delay
    setTimeout(() => {
        console.log('🚨 Auto-running emergency AI fix...');
        this.fixAllAIAgents();
    }, 2000);
    
    // Also fix periodically during gameplay
    setInterval(() => {
        this.fixAllAIAgents(true); // silent mode
    }, 10000);
};

EmergencyAIFix.prototype.fixAllAIAgents = function(silent = false) {
    if (!silent) console.log('\n========== EMERGENCY AI FIX ==========');
    
    // Find all potential AI agents using multiple methods
    const allEntities = [];
    this.app.root.find(function(entity) {
        allEntities.push(entity);
        return false;
    });
    
    // Look for entities that might be AI agents
    const potentialAgents = allEntities.filter(entity => {
        if (!entity || entity.destroyed) return false;
        
        // Method 1: Has aiAgent script
        if (entity.script && entity.script.aiAgent) return true;
        
        // Method 2: Has AI-related tags
        if (entity.tags && (entity.tags.has('ai') || entity.tags.has('team_ai') || entity.tags.has('ai_agent'))) return true;
        
        // Method 3: Name suggests it's an AI
        const name = (entity.name || '').toLowerCase();
        if (name.includes('ai') || name.includes('agent') || name.includes('enemy')) return true;
        
        return false;
    });
    
    if (!silent) console.log(`Found ${potentialAgents.length} potential AI agent(s)`);
    
    let fixedCount = 0;
    
    potentialAgents.forEach((agent, index) => {
        if (this.fixSingleAgent(agent, silent)) {
            fixedCount++;
        }
    });
    
    if (!silent) {
        console.log(`\n✅ Fixed ${fixedCount}/${potentialAgents.length} AI agents`);
        console.log('========== EMERGENCY FIX COMPLETE ==========\n');
    }
    
    return fixedCount;
};

EmergencyAIFix.prototype.fixSingleAgent = function(agent, silent = false) {
    if (!agent || agent.destroyed) return false;
    
    const name = agent.name || 'Unknown';
    if (!silent) console.log(`\n🔧 Fixing agent: ${name}`);
    
    let fixed = false;
    
    try {
        // 1. Ensure entity is enabled
        if (!agent.enabled) {
            agent.enabled = true;
            if (!silent) console.log('  ✅ Enabled entity');
            fixed = true;
        }
        
        // 2. Ensure critical tags
        if (agent.tags) {
            const requiredTags = ['damageable', 'ai', 'team_ai', 'enemy', 'character', 'faction_ai'];
            requiredTags.forEach(tag => {
                if (!agent.tags.has(tag)) {
                    agent.tags.add(tag);
                    if (!silent) console.log(`  ✅ Added tag: ${tag}`);
                    fixed = true;
                }
            });
        }
        
        // 3. Ensure script component exists
        if (!agent.script) {
            if (!silent) console.error(`  ❌ No script component on ${name} - cannot add healthSystem`);
            return fixed;
        }
        
        // 4. Critical fix: Ensure healthSystem script exists and is enabled
        if (!agent.script.healthSystem) {
            // Try to add healthSystem script
            try {
                agent.script.create('healthSystem', {
                    enabled: true,
                    maxHealth: 100,
                    currentHealth: 100,
                    invulnerable: false
                });
                if (!silent) console.log('  ✅ Added healthSystem script');
                fixed = true;
            } catch (e) {
                if (!silent) console.error(`  ❌ Failed to add healthSystem script to ${name}:`, e);
            }
        } else {
            // Ensure existing healthSystem is enabled and configured
            const hs = agent.script.healthSystem;
            if (!hs.enabled) {
                hs.enabled = true;
                if (!silent) console.log('  ✅ Enabled healthSystem script');
                fixed = true;
            }
            
            // Ensure health values are set
            if (!hs.maxHealth || hs.maxHealth <= 0) {
                hs.maxHealth = 100;
                if (!silent) console.log('  ✅ Set maxHealth to 100');
                fixed = true;
            }
            
            if (!hs.currentHealth || hs.currentHealth <= 0) {
                hs.currentHealth = hs.maxHealth || 100;
                if (!silent) console.log('  ✅ Set currentHealth');
                fixed = true;
            }
            
            // Mark as initialized if it wasn't
            if (!hs.__healthSystemBooted) {
                hs.__healthSystemBooted = true;
                if (!silent) console.log('  ✅ Marked healthSystem as booted');
                fixed = true;
            }
        }
        
        // 5. Ensure aiAgent script exists and is enabled
        if (!agent.script.aiAgent) {
            if (!silent) console.warn(`  ⚠️ No aiAgent script on ${name} - this might not be an AI agent`);
        } else {
            if (!agent.script.aiAgent.enabled) {
                agent.script.aiAgent.enabled = true;
                if (!silent) console.log('  ✅ Enabled aiAgent script');
                fixed = true;
            }
        }
        
        // 6. Fix physics configuration
        if (agent.collision) {
            if (agent.collision.trigger) {
                agent.collision.trigger = false;
                if (!silent) console.log('  ✅ Disabled collision trigger mode');
                fixed = true;
            }
            if (!agent.collision.enabled) {
                agent.collision.enabled = true;
                if (!silent) console.log('  ✅ Enabled collision');
                fixed = true;
            }
        }
        
        if (agent.rigidbody) {
            let needsPhysicsRecreation = false;
            
            if (agent.rigidbody.type !== (pc.BODYTYPE_KINEMATIC || 1)) {
                agent.rigidbody.type = pc.BODYTYPE_KINEMATIC || 1;
                needsPhysicsRecreation = true;
                fixed = true;
            }
            
            if (!agent.rigidbody.kinematic) {
                agent.rigidbody.kinematic = true;
                needsPhysicsRecreation = true;
                fixed = true;
            }
            
            if (!agent.rigidbody.enabled) {
                agent.rigidbody.enabled = true;
                needsPhysicsRecreation = true;
                fixed = true;
            }
            
            if (needsPhysicsRecreation) {
                // Recreate physics body
                agent.rigidbody.enabled = false;
                agent.rigidbody.enabled = true;
                
                // Force recreation
                try {
                    this.app.systems.rigidbody.recreatePhysicalShapes(agent);
                } catch (e) {
                    // Fallback method
                    if (!silent) console.warn('  ⚠️ recreatePhysicalShapes failed, using teleport');
                }
                
                // Teleport to sync position
                const pos = agent.getPosition();
                const rot = agent.getRotation();
                agent.rigidbody.teleport(pos, rot);
                
                if (!silent) console.log('  ✅ Fixed rigidbody physics');
            }
        }
        
        // 7. Ensure team assignment
        if (!agent.team || agent.team !== 'ai') {
            agent.team = 'ai';
            if (!silent) console.log('  ✅ Set team to ai');
            fixed = true;
        }
        
    } catch (e) {
        if (!silent) console.error(`  ❌ Error fixing ${name}:`, e);
        return false;
    }
    
    if (fixed && !silent) {
        console.log(`  🎯 ${name} should now be damageable!`);
    }
    
    return fixed;
};