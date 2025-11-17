/**
 * Player Configuration
 * Player system settings and controls
 */ const playerConfig = {
    // Movement Settings
    movement: {
        walkSpeed: 4.0,
        runSpeed: 8.0,
        jumpHeight: 2.0,
        acceleration: 10.0,
        deceleration: 15.0
    },
    // Health Settings
    health: {
        maxHealth: 100,
        healthRegenRate: 2.0,
        healthRegenDelay: 5.0,
        damageFlashDuration: 0.3
    },
    // Input Settings
    input: {
        mouseSensitivity: 1.0,
        invertYAxis: false,
        deadzone: 0.1,
        smoothing: 0.1
    },
    // Camera Settings
    camera: {
        fieldOfView: 75,
        nearClipPlane: 0.1,
        farClipPlane: 1000.0,
        smoothFollowSpeed: 5.0
    },
    // Character Controller Settings
    controller: {
        characterRadius: 0.5,
        characterHeight: 1.8,
        stepOffset: 0.3,
        slopeLimit: 45 // degrees
    },
    // Interaction Settings
    interaction: {
        pickupRange: 3.0,
        interactionRange: 2.0,
        autoPickup: true
    }
};

export { playerConfig as default, playerConfig };
