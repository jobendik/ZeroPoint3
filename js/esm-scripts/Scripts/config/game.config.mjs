/**
 * Game Configuration
 * Core game settings and parameters
 */ const gameConfig = {
    // Game Engine Settings
    engine: {
        targetFPS: 60,
        enableVSync: true,
        antiAliasing: true
    },
    // Game World Settings
    world: {
        gravity: -9.81,
        worldScale: 1.0,
        maxEntities: 1000
    },
    // Audio Settings
    audio: {
        masterVolume: 1.0,
        sfxVolume: 0.8,
        musicVolume: 0.6,
        enableSpatialAudio: true
    },
    // Graphics Settings
    graphics: {
        shadowQuality: 'high',
        textureQuality: 'high',
        particleQuality: 'medium',
        postProcessing: true
    },
    // Session Settings
    session: {
        maxRounds: 10,
        roundTimeLimit: 300,
        respawnTime: 3.0
    }
};

export { gameConfig as default, gameConfig };
