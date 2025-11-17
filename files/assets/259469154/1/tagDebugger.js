/**
 * Tag Debugger - Check if AI agents have required tags for damage detection
 * 
 * This script helps diagnose the tag issue where spawned AI agents
 * may not have the required 'damageable' tag for weapon hits.
 */

var TagDebugger = pc.createScript('tagDebugger');

TagDebugger.prototype.initialize = function() {
    console.log('🏷️ Tag Debugger loaded - Press F7 to check AI agent tags');
    
    // Add keyboard shortcut
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_F7) {
            this.checkAllAgentTags();
        }
    });
    
    // Auto-check tags after a delay
    setTimeout(() => {
        console.log('🏷️ Auto-checking AI agent tags...');
        this.checkAllAgentTags();
    }, 4000);
};

TagDebugger.prototype.checkAllAgentTags = function() {
    console.log('\n========== AI AGENT TAG ANALYSIS ==========');
    
    // Find all AI agents
    const aiAgents = this.app.root.findComponents('script').filter(script => {
        return script.aiAgent && script.aiAgent.enabled;
    }).map(script => script.entity);
    
    console.log(`Found ${aiAgents.length} AI agent(s) to check`);
    
    const requiredTags = ['damageable', 'enemy', 'character', 'ai', 'team_ai', 'faction_ai'];
    let agentsWithAllTags = 0;
    
    aiAgents.forEach((agent, index) => {
        console.log(`\n--- AI Agent ${index + 1}: ${agent.name} ---`);
        console.log(`Position: (${agent.getPosition().x.toFixed(2)}, ${agent.getPosition().y.toFixed(2)}, ${agent.getPosition().z.toFixed(2)})`);
        console.log(`Enabled: ${agent.enabled}`);
        
        if (!agent.tags) {
            console.error('  ❌ NO TAGS COMPONENT!');
            return;
        }
        
        const currentTags = Array.from(agent.tags.list);
        console.log(`Current tags: [${currentTags.join(', ')}]`);
        
        let missingTags = [];
        let hasAllRequired = true;
        
        requiredTags.forEach(tag => {
            if (agent.tags.has(tag)) {
                console.log(`  ✅ ${tag}`);
            } else {
                console.error(`  ❌ MISSING: ${tag}`);
                missingTags.push(tag);
                hasAllRequired = false;
            }
        });
        
        if (hasAllRequired) {
            console.log('  🎯 ✅ ALL REQUIRED TAGS PRESENT');
            agentsWithAllTags++;
        } else {
            console.error(`  🚨 MISSING ${missingTags.length} TAGS: [${missingTags.join(', ')}]`);
            
            // Auto-fix missing tags
            console.log('  🔧 Auto-fixing missing tags...');
            missingTags.forEach(tag => {
                agent.tags.add(tag);
                console.log(`    ✅ Added: ${tag}`);
            });
            
            // Verify fix
            const newMissingTags = requiredTags.filter(tag => !agent.tags.has(tag));
            if (newMissingTags.length === 0) {
                console.log('  🎉 ✅ ALL TAGS NOW PRESENT AFTER FIX!');
                agentsWithAllTags++;
            } else {
                console.error(`  ❌ STILL MISSING: [${newMissingTags.join(', ')}]`);
            }
        }
        
        // Also check health system
        if (agent.script && agent.script.healthSystem) {
            const hs = agent.script.healthSystem;
            console.log(`  💚 Health System: enabled=${hs.enabled}, health=${hs.health}/${hs.maxHealth}, dead=${hs.dead}`);
        } else {
            console.error('  ❌ NO HEALTH SYSTEM SCRIPT!');
        }
    });
    
    console.log(`\n📊 Summary: ${agentsWithAllTags}/${aiAgents.length} agents have all required tags`);
    
    if (agentsWithAllTags === aiAgents.length) {
        console.log('🎉 SUCCESS! All AI agents have proper tags for damage detection!');
    } else {
        console.error('⚠️ Some agents are missing tags and may not be damageable.');
    }
    
    console.log('========== TAG ANALYSIS COMPLETE ==========\n');
};

TagDebugger.prototype.addRequiredTags = function(entity) {
    const requiredTags = ['damageable', 'enemy', 'character', 'ai', 'team_ai', 'faction_ai'];
    
    if (!entity.tags) {
        console.error(`[TagDebugger] Entity ${entity.name} has no tags component!`);
        return false;
    }
    
    let added = [];
    requiredTags.forEach(tag => {
        if (!entity.tags.has(tag)) {
            entity.tags.add(tag);
            added.push(tag);
        }
    });
    
    if (added.length > 0) {
        console.log(`[TagDebugger] Added tags to ${entity.name}: [${added.join(', ')}]`);
    }
    
    return added.length > 0;
};
