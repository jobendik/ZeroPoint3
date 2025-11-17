import { Script } from '../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { aiConfig } from '../../config/ai.config.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
/**
 * NavigationBootstrap - Fixed Version
 * 
 * KEY FIX: EntityManager is the SINGLE source of truth for all YUKA vehicle updates
 * This matches the working small project pattern
 */ class NavigationBootstrap extends Script {
    initialize() {
        const app = this.app;
        // Create navigation namespace
        app.navigation = app.navigation || {};
        // ✅ FIX: Create EntityManager if it doesn't exist (may be created by EntityManagerService)
        if (!app.navigation.entityManager) {
            app.navigation.entityManager = new YUKA.EntityManager();
            // ✅ YUKA PATTERN: EntityManager also needs spatial index for neighbor queries
            // Using same dimensions as NavMesh spatial index (100x20x100 world, 20x10x20 cells)
            Logger.nav('[NavigationBootstrap] Setting up EntityManager spatial index...');
            app.navigation.entityManager.spatialIndex = new YUKA.CellSpacePartitioning(100, 20, 100, 20, 10, 20 // cellsX, cellsY, cellsZ (match NavMesh)
            );
            Logger.nav('[NavigationBootstrap] EntityManager spatial index created');
            Logger.nav('[NavigationBootstrap] Created EntityManager with spatial index');
        }
        app.navigation.services = app.navigation.services || {};
        // ✅ CRITICAL: Drive YUKA update loop - this is the ONLY place vehicles should be updated
        // This matches the working small project pattern exactly
        // ✅ FIX: Store handler reference for proper cleanup
        const updateHandler = (dt)=>{
            const clampedDt = Math.min(dt, this.maxDelta);
            // Update EntityManager - this updates ALL vehicles automatically
            if (app.navigation.entityManager) {
                app.navigation.entityManager.update(clampedDt);
            }
            // ✅ FIX: After EntityManager updates vehicles, sync PlayCanvas entities FROM vehicles
            // This is a ONE-WAY sync: YUKA → PlayCanvas (not bidirectional)
            this._syncEntitiesToPlayCanvas();
        };
        app.on('update', updateHandler);
        // ✅ CRITICAL FIX: Deregister handler to prevent multiple listeners
        this.on('destroy', ()=>{
            app.off('update', updateHandler);
            Logger.nav('[NavigationBootstrap] Update handler cleaned up');
        });
        Logger.nav('[NavigationBootstrap] Navigation system initialized - EntityManager update loop active');
    }
    /**
     * ✅ FIX: Sync PlayCanvas entities from YUKA vehicles (ONE-WAY sync)
     * This replaces the complex bidirectional sync in AgentNavigationAdapter
     */ _syncEntitiesToPlayCanvas() {
        const entityManager = this.app.navigation?.entityManager;
        if (!entityManager) return;
        // Iterate all YUKA vehicles and sync their PlayCanvas entities
        for (const vehicle of entityManager.entities){
            // Skip non-vehicles
            if (!vehicle.position || !vehicle.velocity) continue;
            // Get the linked PlayCanvas entity
            const pcEntity = vehicle.playcanvasEntity;
            if (!pcEntity || pcEntity.destroyed || !pcEntity.enabled) continue;
            // ✅ CRITICAL: Don't sync position if agent is dead
            const healthSystem = pcEntity.script?.healthSystem;
            if (healthSystem && healthSystem.healthCore && healthSystem.healthCore.isDead) {
                continue; // Skip position sync for dead agents
            }
            // ✅ ONE-WAY SYNC: YUKA vehicle position → PlayCanvas entity
            // Use navigation service to convert from NAV space to world space
            const nav = this.app.navigation?.services?.nav;
            if (nav && nav.ready && nav.navToWorld) {
                // Convert NAV position (YUKA.Vector3) to world position (pc.Vec3)
                // navToWorld now returns pc.Vec3 directly
                const worldPos = nav.navToWorld(vehicle.position);
                pcEntity.setPosition(worldPos);
            // ✅ CRITICAL FIX: Don't teleport rigidbody here at all!
            // NavigationAdapter handles BOTH position and rotation sync to rigidbody
            // Calling teleport here creates a double-sync causing flickering
            } else {
                // Fallback: direct position copy (no coordinate conversion)
                // This is used before navigation service is ready
                pcEntity.setPosition(vehicle.position.x, vehicle.position.y, vehicle.position.z);
            }
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {number} @title Max Delta Time */ _define_property(this, "maxDelta", aiConfig.navigation.maxDelta || 0.05);
    }
}
_define_property(NavigationBootstrap, "scriptName", 'navigationBootstrap');

export { NavigationBootstrap };
