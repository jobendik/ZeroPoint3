import { math } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

function createAgentCore(scriptInstance) {
    const entity = scriptInstance.entity;
    const app = scriptInstance.app;
    // Create YUKA vehicle
    const vehicle = new YUKA.Vehicle();
    vehicle.maxSpeed = scriptInstance.moveSpeed || 3;
    vehicle.boundingRadius = 1;
    // ✅ CRITICAL: Create SteeringManager for YUKA steering behaviors
    vehicle.steering = new YUKA.SteeringManager(vehicle);
    // ✅ CRITICAL: Add vehicle to YUKA EntityManager so it gets updated!
    const manager = app.navigation?.entityManager;
    if (manager) {
        manager.add(vehicle);
        Logger.debug(`[${entity.name}] Vehicle added to YUKA EntityManager`);
    } else {
        Logger.error(`[${entity.name}] CRITICAL: EntityManager not available! Vehicle will not be updated!!`);
    }
    // ✅ COORDINATE SYSTEM FIX: Disable YUKA's automatic orientation updates
    // We handle orientation manually in PlayCanvas coordinate system
    vehicle.updateOrientation = false;
    vehicle.smoother = new YUKA.Smoother(10);
    // ✅ CRITICAL: Initialize vehicle position from entity position IN NAV SPACE
    // Vehicle must live in NAV coordinates, not world coordinates
    const entityPos = entity.getPosition();
    // Note: toNav will be available after navigation ready, so we'll update position in AgentNavigationAdapter
    vehicle.position.set(entityPos.x, entityPos.y, entityPos.z); // Temporary world pos
    // 🔥 CRITICAL FIX: Initialize YUKA vehicle rotation to match PlayCanvas entity rotation!
    // The entity has a 180° model correction applied in aiAgent.mjs initialization.
    // We need to remove that offset for YUKA since it uses a different coordinate system.
    // PlayCanvas: Model faces +Z (forward), 180° correction applied
    // YUKA: Vehicle faces +Z (forward), no correction needed
    const entityEuler = entity.getEulerAngles();
    const yukaYaw = (entityEuler.y - 180) * math.DEG_TO_RAD; // Remove 180° model offset
    vehicle.rotation.fromEuler(0, yukaYaw, 0);
    Logger.debug(`[${entity.name}] 🔄 Initialized YUKA rotation: PC=${entityEuler.y.toFixed(1)}°, YUKA=${(yukaYaw * math.RAD_TO_DEG).toFixed(1)}°`);
    // ✅ CRITICAL: Link vehicle to script instance for evaluators
    // Evaluators expect owner.agent or owner to have entity, weaponSystem, etc.
    vehicle.agent = scriptInstance;
    vehicle.owner = scriptInstance;
    vehicle.name = entity.name || 'AIAgent';
    vehicle.entityType = 'ai_agent'; // âœ… CRITICAL for AI vision system
    vehicle.playcanvasEntity = entity; // âœ… CRITICAL for reverse lookup
    // âœ… CRITICAL: Create YUKA Vision system
    const vision = new YUKA.Vision(vehicle);
    vision.range = scriptInstance.visionRange || 25;
    vision.fieldOfView = (scriptInstance.visionAngle || 75) * (Math.PI / 180); // Convert degrees to radians
    // âœ… CRITICAL: Create YUKA MemorySystem
    const memorySystem = new YUKA.MemorySystem(vehicle);
    memorySystem.memorySpan = scriptInstance.memorySpan || 8;
    // NOTE: We don't set yukaVehicle, vision, memorySystem as direct properties
    // because they're defined as getters in aiAgent.mjs that read from agentCore.core
    // The getters will access them via: this.agentCore?.core?.vision, etc.
    // Create regulators for different update frequencies
    const regulators = {
        vision: new YUKA.Regulator(200),
        goals: new YUKA.Regulator(250),
        target: new YUKA.Regulator(150),
        state: new YUKA.Regulator(300),
        morale: new YUKA.Regulator(500) // 2 Hz
    };
    // Entity identification
    if (!entity.name || entity.name === 'Untitled') {
        entity.name = `AIAgent_${Math.floor(Math.random() * 10000)}`;
    }
    // Add tags
    if (!entity.tags.has('ai_agent')) entity.tags.add('ai_agent');
    if (!entity.tags.has('character')) entity.tags.add('character');
    if (!entity.tags.has('enemy')) entity.tags.add('enemy');
    // Team assignment
    entity.team = 'ai';
    if (!entity.tags.has('team_ai')) entity.tags.add('team_ai');
    // Core state
    const core = {
        app,
        entity,
        vehicle,
        vision,
        memorySystem,
        regulators,
        // Timing
        getTime () {
            return performance.now() / 1000;
        },
        // Sync PlayCanvas entity from YUKA vehicle (one-way sync)
        syncToPlayCanvas () {
            const pos = vehicle.position;
            // Sync position only - DO NOT sync rotation to avoid coordinate system conflicts
            entity.setPosition(pos.x, pos.y, pos.z);
            // âœ… COORDINATE SYSTEM FIX: Don't sync rotation from YUKA to PlayCanvas
            // YUKA uses +Z forward, PlayCanvas uses -Z forward
            // Let PlayCanvas navigation system handle rotation to avoid backwards movement
            // Teleport rigidbody if it exists (kinematic mode recommended)
            if (entity.rigidbody) {
                entity.rigidbody.teleport(entity.getPosition(), entity.getRotation());
            }
        },
        // Cleanup
        destroy () {
            // Remove from YUKA EntityManager
            const manager = app.navigation?.entityManager;
            if (manager && vehicle) {
                manager.remove(vehicle);
                Logger.debug(`[${entity.name}] Vehicle removed from YUKA EntityManager`);
            }
        }
    };
    return core;
}

export { createAgentCore };
