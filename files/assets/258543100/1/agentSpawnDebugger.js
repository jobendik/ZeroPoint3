var AgentSpawnDebugger = pc.createScript('agentSpawnDebugger');

AgentSpawnDebugger.prototype.initialize = function() {
    console.log('===== AGENT SPAWN DEBUGGER ACTIVE =====');
    this._monitorEntityAdditions();
};

AgentSpawnDebugger.prototype.postInitialize = function() {
    console.log('===== POST-INITIALIZE - SETTING UP INTERCEPTION =====');
    
    // Find GameManager using multiple methods
    const gameManager = this._findGameManager();
    
    if (gameManager) {
        console.log('✓ GameManager found:', gameManager.entity.name);
        this._checkTemplateStructure(gameManager);
        this._interceptSpawn(gameManager);
    } else {
        console.error('❌ GameManager not found - will retry');
        this._retryGameManagerSetup();
    }
};

AgentSpawnDebugger.prototype._findGameManager = function() {
    // Try multiple methods to find GameManager
    const tagged = this.app.root.findByTag('gameManager');
    if (tagged && tagged[0] && tagged[0].script && tagged[0].script.gameManager) {
        return tagged[0].script.gameManager;
    }
    
    // Try finding by name
    const byName = this.app.root.findByName('GameManager');
    if (byName && byName.script && byName.script.gameManager) {
        return byName.script.gameManager;
    }
    
    // Search entire hierarchy
    const allEntities = this.app.root.find(entity => {
        return entity.script && entity.script.gameManager;
    });
    
    if (allEntities.length > 0) {
        return allEntities[0].script.gameManager;
    }
    
    return null;
};

AgentSpawnDebugger.prototype._retryGameManagerSetup = function() {
    const self = this;
    let attempts = 0;
    
    const retry = () => {
        attempts++;
        const gm = self._findGameManager();
        
        if (gm && gm.__gmBooted) {
            console.log('✓ GameManager found on retry', attempts);
            self._checkTemplateStructure(gm);
            self._interceptSpawn(gm);
        } else if (attempts < 20) {
            setTimeout(retry, 200);
        } else {
            console.error('❌ Failed to find GameManager after', attempts, 'attempts');
        }
    };
    
    setTimeout(retry, 200);
};

AgentSpawnDebugger.prototype._checkTemplateStructure = function(gameManager) {
    console.log('\n===== CHECKING TEMPLATE STRUCTURE =====');
    
    const template = gameManager.aiAgentTemplate;
    if (!template || !template.resource) {
        console.error('❌ No template assigned');
        return;
    }
    
    console.log('Template:', template.name);
    
    const testEntity = template.resource.instantiate();
    console.log('\n--- TEST INSTANTIATION ---');
    console.log('Name:', testEntity.name);
    console.log('Enabled:', testEntity.enabled);
    console.log('Has script component:', !!testEntity.script);
    
    if (testEntity.script) {
        // Check multiple ways to detect scripts
        console.log('script.__scripts:', testEntity.script.__scripts);
        console.log('script._scripts:', testEntity.script._scripts);
        
        // Try to list all properties on the script component
        const scriptProps = Object.keys(testEntity.script);
        console.log('All script properties:', scriptProps);
        
        // Check for specific scripts
        ['healthSystem', 'weaponSystem', 'aiAgent'].forEach(name => {
            const exists = !!testEntity.script[name];
            console.log(`  ${name}: ${exists ? '✓ EXISTS' : '✗ MISSING'}`);
        });
    }
    
    testEntity.destroy();
    console.log('✓ Template check complete\n');
};

AgentSpawnDebugger.prototype._interceptSpawn = function(gameManager) {
    console.log('===== SETTING UP SPAWN INTERCEPTION =====');
    
    if (!gameManager.gameSession) {
        console.error('❌ GameSession not found on GameManager');
        return;
    }
    
    const gameSession = gameManager.gameSession;
    const originalSpawn = gameSession._spawnAgent;
    
    if (typeof originalSpawn !== 'function') {
        console.error('❌ _spawnAgent is not a function:', typeof originalSpawn);
        return;
    }
    
    const self = this;
    console.log('✓ Found _spawnAgent, intercepting...');
    
    gameSession._spawnAgent = function() {
        console.log('\n🔥🔥🔥 SPAWN CALLED 🔥🔥🔥');
        
        const entity = originalSpawn.call(this);
        
        if (!entity) {
            console.error('❌ Spawn returned null');
            return entity;
        }
        
        console.log('✓ Entity spawned:', entity.name, entity.getGuid());
        self._inspectSpawnedEntity(entity);
        
        // Schedule follow-up checks
        self._scheduleFollowupChecks(entity);
        
        return entity;
    };
    
    console.log('✓ Spawn interception active');
};

AgentSpawnDebugger.prototype._inspectSpawnedEntity = function(entity) {
    console.log('\n--- IMMEDIATE SPAWN STATE ---');
    console.log('Name:', entity.name);
    console.log('GUID:', entity.getGuid());
    console.log('Enabled:', entity.enabled);
    console.log('Has script component:', !!entity.script);
    
    if (!entity.script) {
        console.error('❌ NO SCRIPT COMPONENT');
        return;
    }
    
    // Check all ways to access scripts
    console.log('script.__scripts:', entity.script.__scripts);
    console.log('script._scripts:', entity.script._scripts);
    
    // Try to access scripts directly
    const scriptNames = ['aiAgent', 'healthSystem', 'weaponSystem'];
    scriptNames.forEach(name => {
        const script = entity.script[name];
        console.log(`  ${name}:`, script ? 'EXISTS' : 'NULL');
    });
    
    // List all properties
    if (entity.script) {
        const props = Object.keys(entity.script).filter(k => !k.startsWith('_'));
        console.log('  Public script properties:', props);
    }
};

AgentSpawnDebugger.prototype._scheduleFollowupChecks = function(entity) {
    const self = this;
    const guid = entity.getGuid();
    
    [0, 50, 200, 500, 1000].forEach(delay => {
        setTimeout(() => {
            if (entity.destroyed) {
                console.log(`[${delay}ms] Entity ${guid} destroyed`);
                return;
            }
            
            console.log(`\n===== STATE @ ${delay}ms =====`);
            self._detailedInspection(entity);
        }, delay);
    });
};

AgentSpawnDebugger.prototype._detailedInspection = function(entity) {
    console.log('Entity:', entity.name, '(', entity.getGuid(), ')');
    console.log('Enabled:', entity.enabled);
    
    if (!entity.script) {
        console.error('❌ NO SCRIPT COMPONENT');
        return;
    }
    
    const aiAgent = entity.script.aiAgent;
    const healthSystem = entity.script.healthSystem;
    const weaponSystem = entity.script.weaponSystem;
    
    console.log('\n--- SCRIPT STATUS ---');
    console.log('aiAgent:', aiAgent ? 'EXISTS' : 'NULL');
    console.log('healthSystem:', healthSystem ? 'EXISTS' : 'NULL');
    console.log('weaponSystem:', weaponSystem ? 'EXISTS' : 'NULL');
    
    if (aiAgent) {
        console.log('\naiAgent state:');
        console.log('  enabled:', aiAgent.enabled);
        console.log('  _initialized:', aiAgent._initialized);
        console.log('  __aiAgentInitialized:', aiAgent.__aiAgentInitialized);
        console.log('  ready:', aiAgent.ready);
    }
    
    if (healthSystem) {
        console.log('\nhealthSystem state:');
        console.log('  enabled:', healthSystem.enabled);
        console.log('  _initialized:', healthSystem._initialized);
        console.log('  __healthSystemBooted:', healthSystem.__healthSystemBooted);
    }
    
    if (weaponSystem) {
        console.log('\nweaponSystem state:');
        console.log('  enabled:', weaponSystem.enabled);
        console.log('  _initialized:', weaponSystem._initialized);
        console.log('  __wsBooted:', weaponSystem.__wsBooted);
    }
    
    // Check GameManager registration
    const gm = this._findGameManager();
    if (gm) {
        console.log('\n--- GAMEMANAGER ---');
        console.log('Registered agents:', gm.agents ? gm.agents.length : 0);
        const registered = gm.agents && gm.agents.includes(entity);
        console.log('This agent registered:', registered);
    }
};

AgentSpawnDebugger.prototype._monitorEntityAdditions = function() {
    const self = this;
    const originalAddChild = pc.Entity.prototype.addChild;
    
    pc.Entity.prototype.addChild = function(entity) {
        const result = originalAddChild.call(this, entity);
        
        if (entity.name && entity.name.toLowerCase().includes('aiagent')) {
            console.log('\n➕ ENTITY ADDED:', entity.name);
            console.log('   Parent:', this.name);
            console.log('   Has script:', !!entity.script);
            
            if (entity.script) {
                // Immediate check
                setTimeout(() => {
                    const scriptNames = Object.keys(entity.script).filter(k => !k.startsWith('_') && typeof entity.script[k] === 'object');
                    console.log('   Scripts (immediate):', scriptNames);
                }, 0);
                
                // Delayed check
                setTimeout(() => {
                    const scriptNames = Object.keys(entity.script).filter(k => !k.startsWith('_') && typeof entity.script[k] === 'object');
                    console.log('   Scripts (100ms later):', scriptNames);
                }, 100);
            }
        }
        
        return result;
    };
};