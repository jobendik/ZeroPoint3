/**
 * Complete AI Agent Diagnostic - Check all aspects needed for damage detection
 * 
 * This script comprehensively checks:
 * 1. Required tags (damageable, enemy, etc.)
 * 2. Script components (aiAgent, healthSystem, weaponSystem)
 * 3. Physics setup (collision, rigidbody)
 * 4. Script initialization state
 */

var CompleteAIAgentDiagnostic = pc.createScript('completeAIAgentDiagnostic');

CompleteAIAgentDiagnostic.prototype.initialize = function() {
    console.log('🔬 Complete AI Agent Diagnostic loaded - Press F6 to run full diagnosis');
    
    // Add keyboard shortcut
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_F6) {
            this.runFullDiagnosis();
        }
    });
    
    // Auto-run after delay
    setTimeout(() => {
        console.log('🔬 Auto-running complete AI diagnosis...');
        this.runFullDiagnosis();
    }, 5000);
};

CompleteAIAgentDiagnostic.prototype.runFullDiagnosis = function() {
    console.log('\n========== COMPLETE AI AGENT DIAGNOSIS ==========');
    
    // Find all AI agents (multiple methods)
    const allEntities = [];
    this.app.root.find(function(entity) {
        allEntities.push(entity);
        return false; // continue searching
    });
    
    // Method 1: Find by aiAgent script
    const agentsByScript = this.app.root.findComponents('script').filter(script => {
        return script.aiAgent;
    }).map(script => script.entity);
    
    // Method 2: Find by AI tags
    const agentsByTags = allEntities.filter(entity => {
        return entity.tags && (entity.tags.has('ai') || entity.tags.has('ai_agent') || entity.tags.has('team_ai'));
    });
    
    // Method 3: Find by name pattern
    const agentsByName = allEntities.filter(entity => {
        const name = (entity.name || '').toLowerCase();
        return name.includes('ai') || name.includes('agent') || name.includes('enemy');
    });
    
    console.log(`🔍 Search Results:`);
    console.log(`  - By aiAgent script: ${agentsByScript.length} entities`);
    console.log(`  - By AI tags: ${agentsByTags.length} entities`);  
    console.log(`  - By name pattern: ${agentsByName.length} entities`);
    
    // Combine and deduplicate
    const allAgents = new Set([...agentsByScript, ...agentsByTags, ...agentsByName]);
    const agents = Array.from(allAgents);
    
    console.log(`📊 Total unique AI candidates: ${agents.length}`);
    
    if (agents.length === 0) {
        console.error('❌ NO AI AGENTS FOUND! Check spawning system.');
        return;
    }
    
    let fullyConfiguredAgents = 0;
    
    agents.forEach((agent, index) => {
        console.log(`\n--- AI Agent ${index + 1}: "${agent.name}" ---`);
        
        const diagnosis = this.diagnoseAgent(agent);
        
        if (diagnosis.isFullyConfigured) {
            fullyConfiguredAgents++;
            console.log('🎯 ✅ AGENT FULLY CONFIGURED FOR DAMAGE DETECTION');
        } else {
            console.error('🚨 ❌ AGENT NOT PROPERLY CONFIGURED');
            console.log('🔧 Attempting auto-fix...');
            
            if (this.autoFixAgent(agent)) {
                fullyConfiguredAgents++;
                console.log('🎉 ✅ AUTO-FIX SUCCESSFUL!');
            } else {
                console.error('❌ AUTO-FIX FAILED');
            }
        }
    });
    
    console.log(`\n📊 Final Results: ${fullyConfiguredAgents}/${agents.length} agents properly configured`);
    
    if (fullyConfiguredAgents === agents.length) {
        console.log('🎉 SUCCESS! All AI agents should now be damageable!');
    } else {
        console.error('⚠️ Some agents still have issues. Check the diagnostics above.');
    }
    
    console.log('========== DIAGNOSIS COMPLETE ==========\n');
};

CompleteAIAgentDiagnostic.prototype.diagnoseAgent = function(agent) {
    const diagnosis = {
        isFullyConfigured: true,
        issues: []
    };
    
    console.log(`Position: (${agent.getPosition().x.toFixed(2)}, ${agent.getPosition().y.toFixed(2)}, ${agent.getPosition().z.toFixed(2)})`);
    console.log(`Enabled: ${agent.enabled}, Destroyed: ${agent.destroyed || false}`);
    
    // 1. Check basic entity state
    if (!agent.enabled) {
        diagnosis.issues.push('Entity disabled');
        diagnosis.isFullyConfigured = false;
        console.error('  ❌ Entity is disabled');
    } else {
        console.log('  ✅ Entity enabled');
    }
    
    // 2. Check tags
    const requiredTags = ['damageable', 'ai', 'team_ai'];
    const recommendedTags = ['enemy', 'character', 'faction_ai'];
    
    if (!agent.tags) {
        diagnosis.issues.push('No tags component');
        diagnosis.isFullyConfigured = false;
        console.error('  ❌ NO TAGS COMPONENT!');
    } else {
        const currentTags = Array.from(agent.tags.list);
        console.log(`  Tags: [${currentTags.join(', ')}]`);
        
        requiredTags.forEach(tag => {
            if (agent.tags.has(tag)) {
                console.log(`    ✅ ${tag}`);
            } else {
                diagnosis.issues.push(`Missing required tag: ${tag}`);
                diagnosis.isFullyConfigured = false;
                console.error(`    ❌ MISSING REQUIRED: ${tag}`);
            }
        });
        
        recommendedTags.forEach(tag => {
            if (agent.tags.has(tag)) {
                console.log(`    ✅ ${tag} (recommended)`);
            } else {
                console.warn(`    ⚠️ Missing recommended: ${tag}`);
            }
        });
    }
    
    // 3. Check script component exists
    if (!agent.script) {
        diagnosis.issues.push('No script component');
        diagnosis.isFullyConfigured = false;
        console.error('  ❌ NO SCRIPT COMPONENT!');
        return diagnosis;
    } else {
        console.log('  ✅ Script component exists');
    }
    
    // 4. Check required scripts
    const requiredScripts = ['aiAgent', 'healthSystem'];
    const recommendedScripts = ['weaponSystem'];
    
    requiredScripts.forEach(scriptName => {
        if (agent.script[scriptName]) {
            const script = agent.script[scriptName];
            console.log(`    ✅ ${scriptName} script attached`);
            console.log(`      - Enabled: ${script.enabled}`);
            console.log(`      - Initialized: ${script._initialized || false}`);
            
            // Special checks for healthSystem
            if (scriptName === 'healthSystem') {
                console.log(`      - Health: ${script.currentHealth || script.health || '?'}/${script.maxHealth || '?'}`);
                console.log(`      - Dead: ${script.isDead || script.dead || false}`);
                console.log(`      - Booted: ${script.__healthSystemBooted || false}`);
            }
            
            if (!script.enabled) {
                diagnosis.issues.push(`${scriptName} script disabled`);
                diagnosis.isFullyConfigured = false;
                console.error(`      ❌ ${scriptName} script is DISABLED!`);
            }
        } else {
            diagnosis.issues.push(`Missing required script: ${scriptName}`);
            diagnosis.isFullyConfigured = false;
            console.error(`    ❌ MISSING REQUIRED SCRIPT: ${scriptName}`);
        }
    });
    
    recommendedScripts.forEach(scriptName => {
        if (agent.script[scriptName]) {
            console.log(`    ✅ ${scriptName} script attached (recommended)`);
        } else {
            console.warn(`    ⚠️ Missing recommended script: ${scriptName}`);
        }
    });
    
    // 5. Check physics components
    if (!agent.collision) {
        diagnosis.issues.push('No collision component');
        diagnosis.isFullyConfigured = false;
        console.error('  ❌ NO COLLISION COMPONENT!');
    } else {
        console.log(`  ✅ Collision: type=${agent.collision.type}, enabled=${agent.collision.enabled}, trigger=${agent.collision.trigger}`);
        if (agent.collision.trigger) {
            diagnosis.issues.push('Collision is trigger mode');
            diagnosis.isFullyConfigured = false;
            console.error('    ❌ Collision is in TRIGGER mode (should be solid)');
        }
    }
    
    if (!agent.rigidbody) {
        diagnosis.issues.push('No rigidbody component');
        diagnosis.isFullyConfigured = false;
        console.error('  ❌ NO RIGIDBODY COMPONENT!');
    } else {
        console.log(`  ✅ Rigidbody: type=${agent.rigidbody.type}, kinematic=${agent.rigidbody.kinematic}, enabled=${agent.rigidbody.enabled}`);
        if (!agent.rigidbody.kinematic) {
            diagnosis.issues.push('Rigidbody not kinematic');
            diagnosis.isFullyConfigured = false;
            console.error('    ❌ Rigidbody kinematic flag is FALSE (should be true)');
        }
    }
    
    return diagnosis;
};

CompleteAIAgentDiagnostic.prototype.autoFixAgent = function(agent) {
    let fixed = true;
    
    try {
        // Fix tags
        if (agent.tags) {
            const requiredTags = ['damageable', 'ai', 'team_ai'];
            const recommendedTags = ['enemy', 'character', 'faction_ai'];
            
            [...requiredTags, ...recommendedTags].forEach(tag => {
                if (!agent.tags.has(tag)) {
                    agent.tags.add(tag);
                    console.log(`  🔧 Added tag: ${tag}`);
                }
            });
        } else {
            console.error('  ❌ Cannot fix: No tags component');
            fixed = false;
        }
        
        // Fix scripts - enable if they exist but are disabled
        if (agent.script) {
            ['aiAgent', 'healthSystem', 'weaponSystem'].forEach(scriptName => {
                if (agent.script[scriptName] && !agent.script[scriptName].enabled) {
                    agent.script[scriptName].enabled = true;
                    console.log(`  🔧 Enabled script: ${scriptName}`);
                }
            });
        }
        
        // Fix physics
        if (agent.collision && agent.collision.trigger) {
            agent.collision.trigger = false;
            console.log('  🔧 Disabled collision trigger mode');
        }
        
        if (agent.rigidbody && !agent.rigidbody.kinematic) {
            agent.rigidbody.enabled = false;
            agent.rigidbody.type = pc.BODYTYPE_KINEMATIC || 1;
            agent.rigidbody.kinematic = true;
            agent.rigidbody.enabled = true;
            
            // Force physics recreation
            this.app.systems.rigidbody.recreatePhysicalShapes(agent);
            
            // Teleport to sync
            const pos = agent.getPosition();
            const rot = agent.getRotation();
            agent.rigidbody.teleport(pos, rot);
            
            console.log('  🔧 Fixed rigidbody kinematic mode');
        }
        
    } catch (e) {
        console.error('  ❌ Auto-fix error:', e);
        fixed = false;
    }
    
    return fixed;
};