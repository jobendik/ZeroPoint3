/**
 * Spawn Point Debugger
 * 
 * Diagnostics tool to verify spawn point configuration and behavior
 */ class SpawnPointDebugger {
    /**
     * Check spawn point configuration
     */ checkSpawnPoints() {
        console.log('=== SPAWN POINT DIAGNOSTIC ===');
        // Check GameManager's spawn points array
        const spawnPoints = this.gameManager.spawnPoints || [];
        console.log(`📍 GameManager.spawnPoints array size: ${spawnPoints.length}`);
        if (spawnPoints.length === 0) {
            console.error('❌ NO SPAWN POINTS IN GAMEMANAGER ARRAY!');
            console.log('💡 FIX: In PlayCanvas Editor:');
            console.log('   1. Select GameManager entity');
            console.log('   2. Find "Spawn Points" array in Inspector');
            console.log('   3. Set Array Size to number of spawn points (e.g., 10)');
            console.log('   4. Drag SpawnPoint entities into array slots');
            return;
        }
        // Check each spawn point
        spawnPoints.forEach((sp, index)=>{
            console.log(`\n--- Spawn Point [${index}] ---`);
            if (!sp) {
                console.error(`❌ Spawn point [${index}] is NULL/UNDEFINED!`);
                return;
            }
            console.log(`  Name: ${sp.name || 'unnamed'}`);
            console.log(`  Type: ${typeof sp}`);
            console.log(`  Has getPosition: ${typeof sp.getPosition === 'function'}`);
            console.log(`  Has getEulerAngles: ${typeof sp.getEulerAngles === 'function'}`);
            if (typeof sp.getPosition === 'function') {
                const pos = sp.getPosition();
                console.log(`  Position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
                if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
                    console.error(`  ❌ INVALID POSITION (NaN detected)!`);
                }
            } else {
                console.error(`  ❌ NOT A VALID ENTITY (missing getPosition method)!`);
            }
            if (typeof sp.getEulerAngles === 'function') {
                const rot = sp.getEulerAngles();
                console.log(`  Rotation: (${rot.x.toFixed(2)}, ${rot.y.toFixed(2)}, ${rot.z.toFixed(2)})`);
            }
            console.log(`  Enabled: ${sp.enabled}`);
            console.log(`  GUID: ${sp.getGuid ? sp.getGuid() : 'N/A'}`);
        });
        console.log('\n=== END DIAGNOSTIC ===\n');
    }
    /**
     * Find all spawn point entities in the scene
     */ findAllSpawnPointsInScene() {
        console.log('=== FINDING ALL SPAWN POINTS IN SCENE ===');
        // Look for entities with "SpawnPoint" in their name
        const allEntities = this.app.root.children;
        const foundSpawnPoints = [];
        const searchRecursive = (entity)=>{
            if (entity.name && entity.name.toLowerCase().includes('spawnpoint')) {
                foundSpawnPoints.push(entity);
                console.log(`✅ Found: ${entity.name} at (${entity.getPosition().x.toFixed(2)}, ${entity.getPosition().y.toFixed(2)}, ${entity.getPosition().z.toFixed(2)})`);
            }
            entity.children.forEach((child)=>searchRecursive(child));
        };
        allEntities.forEach((entity)=>searchRecursive(entity));
        console.log(`\n📊 Total spawn points found in scene: ${foundSpawnPoints.length}`);
        console.log('=== END SCENE SEARCH ===\n');
        return foundSpawnPoints;
    }
    /**
     * Compare GameManager array vs scene entities
     */ compareConfiguration() {
        console.log('=== CONFIGURATION COMPARISON ===');
        const gmSpawnPoints = this.gameManager.spawnPoints || [];
        const sceneSpawnPoints = this.findAllSpawnPointsInScene();
        console.log(`\n📋 GameManager Array: ${gmSpawnPoints.length} spawn points`);
        console.log(`🌍 Scene Hierarchy: ${sceneSpawnPoints.length} spawn point entities`);
        if (gmSpawnPoints.length < sceneSpawnPoints.length) {
            console.warn(`\n⚠️ MISMATCH: You have ${sceneSpawnPoints.length} spawn points in the scene, but only ${gmSpawnPoints.length} in GameManager!`);
            console.log('💡 FIX: Increase GameManager "Spawn Points" array size and add the missing spawn points');
        } else if (gmSpawnPoints.length === 0) {
            console.error('\n❌ GameManager has NO spawn points configured!');
        } else if (gmSpawnPoints.length === sceneSpawnPoints.length) {
            console.log('\n✅ Array size matches number of spawn points in scene');
        }
        console.log('\n=== END COMPARISON ===\n');
    }
    /**
     * Full diagnostic report
     */ runFullDiagnostic() {
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║   SPAWN POINT FULL DIAGNOSTIC REPORT  ║');
        console.log('╚════════════════════════════════════════╝\n');
        this.findAllSpawnPointsInScene();
        this.checkSpawnPoints();
        this.compareConfiguration();
        console.log('✅ Diagnostic complete. Check console output above.\n');
    }
    constructor(app, gameManager){
        this.app = app;
        this.gameManager = gameManager;
    }
}
// Make it available globally for console testing
if (typeof window !== 'undefined') {
    window.SpawnPointDebugger = SpawnPointDebugger;
}

export { SpawnPointDebugger };
