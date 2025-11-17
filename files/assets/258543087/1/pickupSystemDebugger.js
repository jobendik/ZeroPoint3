///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/* global pc, Logger */

// Debug helper for testing pickup system functionality
var PickupSystemDebugger = pc.createScript('pickupSystemDebugger');

PickupSystemDebugger.attributes.add('testMode', { type: 'boolean', default: true, title: 'Enable Test Mode' });
PickupSystemDebugger.attributes.add('autoTestInterval', { type: 'number', default: 10, title: 'Auto Test Interval (seconds)' });

PickupSystemDebugger.prototype.initialize = function() {
    if (!this.testMode) return;
    
    console.log('[PickupSystemDebugger] Starting pickup system diagnostics...');
    
    // Setup test controls
    this._setupTestControls();
    
    // 🔥 FIX: Wait for systems to be ready before running diagnostics
    // Run after game is fully initialized and entities are spawned
    this._waitForSystemsReady();
    
    // Setup auto testing if enabled
    if (this.autoTestInterval > 0) {
        setInterval(() => this.runAutoTest(), this.autoTestInterval * 1000);
    }
};

/**
 * 🔥 IMPROVED: Wait for all systems to be ready before diagnostics
 */
PickupSystemDebugger.prototype._waitForSystemsReady = function() {
    const checkReady = () => {
        const gm = this.app.gameManager;
        
        // Check if GameManager is ready
        if (!gm || !gm.__gmBooted) {
            console.log('[PickupSystemDebugger] Waiting for GameManager to boot...');
            setTimeout(checkReady, 500);
            return;
        }
        
        // Check if player is registered
        if (!gm.player) {
            console.log('[PickupSystemDebugger] Waiting for player registration...');
            setTimeout(checkReady, 500);
            return;
        }
        
        // 🔥 FIX: Wait for item scan event instead of checking length
        // This ensures we wait for the deferred scan to complete
        console.log('[PickupSystemDebugger] Waiting for item scan to complete...');
        
        // Listen for scan completion event
        this.app.once('game:items:scanned', (data) => {
            console.log(`[PickupSystemDebugger] ✅ Items scanned: ${data.count} items found`);
            
            if (data.count === 0) {
                console.warn('[PickupSystemDebugger] ⚠️ No items found - this may indicate a problem');
            }
            
            // Run diagnostic after scan completes
            setTimeout(() => this.runFullDiagnostic(), 100);
        });
        
        // Fallback timeout in case event is missed
        setTimeout(() => {
            if (gm.items && gm.items.length > 0) {
                console.log('[PickupSystemDebugger] ✅ Items found via fallback check');
                this.runFullDiagnostic();
            } else {
                console.warn('[PickupSystemDebugger] ⚠️ Timeout waiting for items - running diagnostic anyway');
                this.runFullDiagnostic();
            }
        }, 3000);
    };
    
    // Start checking after a delay
    setTimeout(checkReady, 2000);
};

PickupSystemDebugger.prototype._setupTestControls = function() {
    // Add global debug functions for manual testing
    if (typeof window !== 'undefined') {
        window.testPickupSystem = () => this.runFullDiagnostic();
        window.testPlayerPickup = () => this.testPlayerCanPickup();
        window.testAIPickup = () => this.testAICanPickup();
        window.debugPickupSystems = () => this.debugAllPickupSystems();
        window.forcePickupTest = (itemType) => this.forcePickupTest(itemType);
    }
    
    console.log('[PickupSystemDebugger] Test controls available:');
    console.log('  window.testPickupSystem() - Full system test');
    console.log('  window.testPlayerPickup() - Test player pickup capability');
    console.log('  window.testAIPickup() - Test AI pickup capability');
    console.log('  window.debugPickupSystems() - Debug all pickup systems');
    console.log('  window.forcePickupTest(itemType) - Force test specific item type');
};

PickupSystemDebugger.prototype.runFullDiagnostic = function() {
    console.log('\n=== PICKUP SYSTEM FULL DIAGNOSTIC ===');
    
    // Check GameManager state
    this.checkGameManagerState();
    
    // Check Player state
    this.checkPlayerState();
    
    // Check AI Agents state
    this.checkAIAgentsState();
    
    // Check Pickup Systems
    this.checkPickupSystemsState();
    
    // Test collision detection
    this.testCollisionDetection();
    
    console.log('=== END DIAGNOSTIC ===\n');
};

PickupSystemDebugger.prototype.checkGameManagerState = function() {
    console.log('\n--- GAMEMANAGER STATE ---');
    
    if (!this.app.gameManager) {
        console.error('❌ GameManager not found in app.gameManager');
        return;
    }
    
    const gm = this.app.gameManager;
    console.log(`✅ GameManager found: ${gm.constructor.name}`);
    console.log(`   State: ${gm.currentState}`);
    console.log(`   Player: ${gm.player ? gm.player.entity.name : 'None'}`);
    console.log(`   Agents: ${gm.agents ? gm.agents.length : 0}`);
    console.log(`   Items: ${gm.items ? gm.items.length : 0}`);
    
    // Check if game is playing (needed for pickups)
    if (gm.isPlaying && gm.isPlaying()) {
        console.log('✅ Game is in playing state');
    } else {
        console.warn('⚠️ Game is not in playing state - pickups may not work');
    }
};

PickupSystemDebugger.prototype.checkPlayerState = function() {
    console.log('\n--- PLAYER STATE ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.player) {
        console.error('❌ No player found in GameManager');
        return;
    }
    
    const player = gm.player;
    console.log(`✅ Player found: ${player.entity.name}`);
    console.log(`   Position: ${this._formatVector(player.entity.getPosition())}`);
    console.log(`   Alive: ${player.isAlive}`);
    console.log(`   Can Control: ${player._canControl ? player._canControl() : 'Unknown'}`);
    
    // Check collision component
    if (player.entity.collision) {
        console.log(`✅ Player has collision component (trigger: ${player.entity.collision.trigger})`);
    } else {
        console.error('❌ Player missing collision component');
    }
    
    // Check health system
    if (player.healthSystem) {
        console.log(`✅ Player has health system (${player.healthSystem.currentHealth}/${player.healthSystem.maxHealth})`);
    } else {
        console.error('❌ Player missing health system');
    }
    
    // Check weapon system
    if (player.weaponSystem) {
        console.log(`✅ Player has weapon system`);
        if (player.weaponSystem.weapons) {
            const weaponCount = Object.keys(player.weaponSystem.weapons).length;
            console.log(`   Weapons: ${weaponCount} total`);
        }
    } else {
        console.error('❌ Player missing weapon system');
    }
    
    // Check tags
    if (player.entity.tags) {
        const tags = Array.from(player.entity.tags.list);
        console.log(`   Tags: ${tags.join(', ')}`);
    }
};

PickupSystemDebugger.prototype.checkAIAgentsState = function() {
    console.log('\n--- AI AGENTS STATE ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.agents || gm.agents.length === 0) {
        console.warn('⚠️ No AI agents found (may spawn later during gameplay)');
        console.log('   Note: Agents typically spawn when session starts, not during initialization');
        return;
    }
    
    console.log(`✅ Found ${gm.agents.length} AI agents`);
    
    gm.agents.slice(0, 3).forEach((agent, index) => {
        if (!agent.entity) return;
        
        console.log(`   Agent ${index + 1}: ${agent.entity.name}`);
        console.log(`     Position: ${this._formatVector(agent.entity.getPosition())}`);
        console.log(`     Dead: ${agent.isDead}`);
        
        // Check collision
        if (agent.entity.collision) {
            console.log(`     ✅ Has collision (trigger: ${agent.entity.collision.trigger})`);
        } else {
            console.log(`     ❌ Missing collision`);
        }
        
        // Check health system
        if (agent.healthSystem) {
            console.log(`     ✅ Has health system`);
        } else {
            console.log(`     ❌ Missing health system`);
        }
        
        // Check weapon system
        if (agent.weaponSystem) {
            console.log(`     ✅ Has weapon system`);
        } else {
            console.log(`     ❌ Missing weapon system`);
        }
        
        // Check tags
        if (agent.entity.tags) {
            const tags = Array.from(agent.entity.tags.list);
            console.log(`     Tags: ${tags.join(', ')}`);
        }
    });
};

PickupSystemDebugger.prototype.checkPickupSystemsState = function() {
    console.log('\n--- PICKUP SYSTEMS STATE ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.items || gm.items.length === 0) {
        console.error('❌ No pickup systems found in GameManager');
        return;
    }
    
    console.log(`✅ Found ${gm.items.length} pickup systems`);
    
    const itemCounts = {};
    const availableCounts = {};
    
    gm.items.forEach(item => {
        if (!item || !item.itemType) return;
        
        itemCounts[item.itemType] = (itemCounts[item.itemType] || 0) + 1;
        
        if (item.isAvailable) {
            availableCounts[item.itemType] = (availableCounts[item.itemType] || 0) + 1;
        }
        
        // Detailed check for first few items
        if (Object.keys(itemCounts).length <= 3) {
            console.log(`   ${item.entity.name} (${item.itemType}):`);
            console.log(`     Available: ${item.isAvailable}`);
            console.log(`     Position: ${this._formatVector(item.entity.getPosition())}`);
            console.log(`     Reserved: ${item.isReserved ? item.isReserved() : false}`);
            
            if (item.entity.collision) {
                console.log(`     ✅ Has collision (trigger: ${item.entity.collision.trigger})`);
            } else {
                console.log(`     ❌ Missing collision`);
            }
        }
    });
    
    console.log('\n   Item Summary:');
    Object.keys(itemCounts).forEach(itemType => {
        const total = itemCounts[itemType];
        const available = availableCounts[itemType] || 0;
        console.log(`     ${itemType}: ${available}/${total} available`);
    });
};

PickupSystemDebugger.prototype.testCollisionDetection = function() {
    console.log('\n--- COLLISION DETECTION TEST ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.player || !gm.items || gm.items.length === 0) {
        console.error('❌ Missing required components for collision test');
        return;
    }
    
    const player = gm.player;
    const playerPos = player.entity.getPosition();
    
    let nearbyItems = 0;
    let pickupableItems = 0;
    
    gm.items.forEach(item => {
        if (!item.isAvailable) return;
        
        const distance = playerPos.distance(item.entity.getPosition());
        if (distance < 10) { // Within 10 units
            nearbyItems++;
            
            // Test if player can pick this up
            if (item.canBePickedUpBy && item.canBePickedUpBy(player.entity)) {
                pickupableItems++;
                console.log(`   ✅ ${item.entity.name} (${item.itemType}) - distance: ${distance.toFixed(2)}m - can pickup`);
            } else {
                console.log(`   ⚠️ ${item.entity.name} (${item.itemType}) - distance: ${distance.toFixed(2)}m - cannot pickup`);
            }
        }
    });
    
    console.log(`   Found ${nearbyItems} nearby items, ${pickupableItems} can be picked up`);
};

PickupSystemDebugger.prototype.testPlayerCanPickup = function() {
    console.log('\n--- PLAYER PICKUP CAPABILITY TEST ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.player) {
        console.error('❌ No player available for testing');
        return;
    }
    
    const player = gm.player;
    
    // Test different item types
    const testItemTypes = ['health', 'pistol', 'machinegun', 'shotgun', 'pistol_ammo'];
    
    testItemTypes.forEach(itemType => {
        const item = gm.items.find(i => i.itemType === itemType && i.isAvailable);
        if (item) {
            const canPickup = item.canBePickedUpBy(player.entity);
            console.log(`   ${itemType}: ${canPickup ? '✅ Can pickup' : '❌ Cannot pickup'}`);
            
            if (!canPickup) {
                // Debug why
                const systems = item._getEntitySystems(player.entity);
                console.log(`     Health system found: ${!!systems.healthSystem}`);
                console.log(`     Weapon system found: ${!!systems.weaponSystem}`);
            }
        } else {
            console.log(`   ${itemType}: ⚠️ No available items of this type`);
        }
    });
};

PickupSystemDebugger.prototype.testAICanPickup = function() {
    console.log('\n--- AI PICKUP CAPABILITY TEST ---');
    
    const gm = this.app.gameManager;
    if (!gm || !gm.agents || gm.agents.length === 0) {
        console.error('❌ No AI agents available for testing');
        return;
    }
    
    const agent = gm.agents.find(a => !a.isDead && a.entity);
    if (!agent) {
        console.error('❌ No alive AI agents found');
        return;
    }
    
    console.log(`Testing with agent: ${agent.entity.name}`);
    
    // Test different item types
    const testItemTypes = ['health', 'pistol', 'pistol_ammo'];
    
    testItemTypes.forEach(itemType => {
        const item = gm.items.find(i => i.itemType === itemType && i.isAvailable);
        if (item) {
            const canPickup = item.canBePickedUpBy(agent.entity);
            console.log(`   ${itemType}: ${canPickup ? '✅ Can pickup' : '❌ Cannot pickup'}`);
            
            if (!canPickup) {
                // Debug why
                const systems = item._getEntitySystems(agent.entity);
                console.log(`     Health system found: ${!!systems.healthSystem}`);
                console.log(`     Weapon system found: ${!!systems.weaponSystem}`);
            }
        } else {
            console.log(`   ${itemType}: ⚠️ No available items of this type`);
        }
    });
};

PickupSystemDebugger.prototype.forcePickupTest = function(itemType) {
    console.log(`\n--- FORCE PICKUP TEST: ${itemType} ---`);
    
    const gm = this.app.gameManager;
    if (!gm || !gm.player) {
        console.error('❌ No player available');
        return;
    }
    
    const item = gm.items.find(i => i.itemType === itemType && i.isAvailable);
    if (!item) {
        console.error(`❌ No available ${itemType} items found`);
        return;
    }
    
    console.log(`Found item: ${item.entity.name}`);
    console.log(`Player position: ${this._formatVector(gm.player.entity.getPosition())}`);
    console.log(`Item position: ${this._formatVector(item.entity.getPosition())}`);
    
    // Try manual pickup
    try {
        const result = item.onTriggerEnter(gm.player.entity);
        console.log(`Pickup result: ${result ? 'SUCCESS' : 'FAILED'}`);
    } catch (e) {
        console.error(`Pickup failed with error:`, e);
    }
};

PickupSystemDebugger.prototype.runAutoTest = function() {
    // Simplified auto test - just check system health
    const gm = this.app.gameManager;
    if (!gm) return;
    
    const itemCount = gm.items ? gm.items.length : 0;
    const playerExists = !!(gm.player);
    const agentCount = gm.agents ? gm.agents.length : 0;
    
    console.log(`[PickupSystemDebugger] Auto-test: ${itemCount} items, player: ${playerExists}, ${agentCount} agents`);
    
    if (itemCount === 0 || !playerExists) {
        console.warn('[PickupSystemDebugger] Pickup system may have issues - running full diagnostic...');
        this.runFullDiagnostic();
    }
};

PickupSystemDebugger.prototype.debugAllPickupSystems = function() {
    console.log('\n--- DEBUG ALL PICKUP SYSTEMS ---');
    
    // Find all pickup system entities
    const allEntities = this.app.root.find((entity) => {
        return entity.script && entity.script.pickupSystem;
    });
    
    console.log(`Found ${allEntities.length} entities with pickupSystem script`);
    
    allEntities.forEach((entity, index) => {
        const pickup = entity.script.pickupSystem;
        console.log(`${index + 1}. ${entity.name}:`);
        console.log(`   Type: ${pickup.itemType}`);
        console.log(`   Available: ${pickup.isAvailable}`);
        console.log(`   Initialized: ${pickup._initialized}`);
        console.log(`   Events bound: ${pickup._eventsBound}`);
        console.log(`   Has collision: ${!!entity.collision}`);
        
        if (entity.collision) {
            console.log(`   Collision trigger: ${entity.collision.trigger}`);
            console.log(`   Collision enabled: ${entity.collision.enabled}`);
        }
    });
};

PickupSystemDebugger.prototype._formatVector = function(vec) {
    if (!vec) return 'undefined';
    return `(${vec.x.toFixed(1)}, ${vec.y.toFixed(1)}, ${vec.z.toFixed(1)})`;
};

PickupSystemDebugger.prototype.update = function(dt) {
    // Key binding for manual testing (press 'P' to run diagnostic)
    if (this.app.keyboard && this.app.keyboard.wasPressed(pc.KEY_P)) {
        this.runFullDiagnostic();
    }
    
    // Key binding for force pickup test (press 'O' to try pickup nearest health item)
    if (this.app.keyboard && this.app.keyboard.wasPressed(pc.KEY_O)) {
        this.forcePickupTest('health');
    }
};
                                                                                                                                                                                                        