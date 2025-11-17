///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * AI Configuration
 * AI system settings and behavior parameters
 */ const aiConfig = {
    // AI Agent Settings
    agent: {
        maxAgents: 32,
        updateFrequency: 60,
        decisionDelay: 0.1,
        memoryDuration: 30.0 // seconds
    },
    // Combat AI Settings
    combat: {
        // Accuracy and Aiming
        aimAccuracy: 0.75,
        reactionTime: 0.2,
        aggressionLevel: 0.6,
        tacticalThinking: 0.8,
        // Distance Thresholds
        ASSAULT_DISTANCE: 4,
        ASSAULT_COMPLETION: 6,
        RETREAT_DISTANCE: 12,
        OPTIMAL_ENGAGEMENT_RANGE: 12,
        MAX_ENGAGEMENT_RANGE: 25,
        CLOSE_RANGE_THRESHOLD: 15,
        LONG_RANGE_THRESHOLD: 30,
        // Health Thresholds
        CRITICAL_HEALTH_THRESHOLD: 0.15,
        DANGER_HEALTH_THRESHOLD: 0.3,
        LOW_HEALTH_THRESHOLD: 0.4,
        MODERATE_HEALTH_THRESHOLD: 0.6,
        HIGH_HEALTH_THRESHOLD: 0.8,
        // Ammo Conservation
        AMMO_CRITICAL_THRESHOLD: 0.1,
        AMMO_LOW_THRESHOLD: 0.3,
        AMMO_ADEQUATE_THRESHOLD: 0.5,
        BURST_FIRE_MULTIPLIER: 1.5,
        HEAVY_CONSERVATION_MULTIPLIER: 2.5,
        // Fire Rate Control (AI-specific multipliers)
        AI_FIRE_RATE_MULTIPLIER: {
            pistol: 1.8,
            machinegun: 1.0,
            shotgun: 1.25 // 0.8s → 1.0s
        },
        MIN_SHOOT_INTERVAL: 0.5,
        // Burst Fire Settings
        MAX_BURST_SIZE: 7,
        BURST_COOLDOWN: 0.6,
        // Aim Lock and Transitions
        AIM_LOCK_DURATION: 300,
        AIM_QUICK_ADJUST_DURATION: 500,
        // Per-Target Cooldown (prevents instant player melting)
        MIN_TIME_BETWEEN_HITS_SAME_TARGET: 0.5,
        // Combat Timing
        COMBAT_LOCK_DURATION: 3000,
        COMBAT_REENTRY_COOLDOWN: 2000,
        // Target Preservation
        TARGET_PRESERVATION_TIME: 5000,
        SEARCH_DURATION: 8000,
        LAST_KNOWN_POSITION_APPROACH_DISTANCE: 3,
        // Accuracy Modifiers
        ALERTNESS_ACCURACY_BONUS: 0.15,
        HEALTH_ACCURACY_BONUS: 0.1,
        DISTANCE_ACCURACY_PENALTY_MOVING: 0.15,
        STRESS_ACCURACY_PENALTY: 0.25,
        CONFIDENCE_ACCURACY_BONUS: 0.1,
        // Distance Factor Accuracy
        OPTIMAL_DISTANCE_ACCURACY_BONUS: 0.1,
        MAX_RANGE_ACCURACY_PENALTY: 0.3,
        // Engagement Priority Factors
        HIGH_HEALTH_PRIORITY_BONUS: 0.2,
        LOW_HEALTH_PRIORITY_PENALTY: 0.3,
        ALERTNESS_PRIORITY_MODIFIER: 0.2,
        ADEQUATE_AMMO_PRIORITY_BONUS: 0.2,
        NO_AMMO_PRIORITY_PENALTY: 0.4,
        TARGET_VISIBLE_PRIORITY_BONUS: 0.2,
        CLOSE_RANGE_PRIORITY_BONUS: 0.1,
        LONG_RANGE_PRIORITY_PENALTY: 0.2,
        ENGAGEMENT_MAINTAIN_THRESHOLD: 0.3,
        // Effectiveness Thresholds
        MIN_ENGAGEMENT_EFFECTIVENESS: 0.3,
        THREAT_LEVEL_PRIORITY_MULTIPLIER: 0.2
    },
    // Navigation Settings
    navigation: {
        pathfindingAccuracy: 'high',
        avoidanceRadius: 2.0,
        maxPathLength: 100,
        recalculateDelay: 1.0,
        // Movement Parameters
        moveSpeed: 3,
        stopDistance: 0.5,
        pathRecalcDistance: 0.3,
        heightSnap: 0.35,
        rotationSpeed: 180,
        // YUKA FollowPathBehavior
        nextWaypointDistance: 0.5,
        // Position Validation
        validationRadius: 1,
        validationRadiusMedium: 3,
        validationRadiusLarge: 5,
        validationRadiusExtraLarge: 8,
        regionSearchRadius: 1,
        // Random Position Generation
        randomPositionMinDistance: 5,
        randomPositionMaxDistance: 20,
        randomPositionMaxAttempts: 10,
        randomPositionFallbackMin: 10,
        randomPositionFallbackMax: 25,
        // Cover Position Generation
        coverDistanceStart: 12,
        coverDistanceEnd: 20,
        coverDistanceStep: 4,
        coverValidationRadius: 5,
        // Fallback Distances
        fallbackCoverMin: 15,
        fallbackCoverMax: 30,
        fallbackTacticalMin: 10,
        fallbackTacticalMax: 20,
        fallbackAdvanceMin: 8,
        fallbackAdvanceMax: 15,
        // Tactical Positioning
        tacticalFlankDistance: 12,
        tacticalAdvanceDistance: 8,
        tacticalPositionVariant: 0.7,
        tacticalPositionClose: 0.5,
        tacticalPositionSearchRadius: 3,
        tacticalPositionFallbackRadius: 5,
        // Rotation Thresholds
        rotationMinThreshold: 1,
        rotationVectorMinLength: 0.001,
        // Spatial Partitioning (YUKA)
        spatialWidth: 100,
        spatialHeight: 20,
        spatialDepth: 100,
        spatialCellsX: 10,
        spatialCellsY: 5,
        spatialCellsZ: 10,
        // Pathfinding Timing
        noPathWarningThrottle: 2000,
        pathLogThrottle: 1000,
        // Update Timing
        maxDelta: 0.05,
        // Movement Detection
        arrivedDistanceThreshold: 0.001,
        waypointProximityThreshold: 0.001
    },
    // Exploration System Settings
    exploration: {
        gridSize: 3.0,
        memoryDuration: 90000,
        strategicRevisitMultiplier: 2.5,
        temporalDecayEnabled: true,
        // Strategic position detection thresholds
        strategic: {
            highGroundThreshold: 2.0,
            coverProximityThreshold: 5.0,
            chokePointRadius: 8.0,
            minStrategicValue: 0.3 // Minimum strategic value to prioritize (0.0-1.0)
        }
    },
    // Goal System Settings
    goals: {
        maxActiveGoals: 5,
        goalPriorityRange: [
            0,
            100
        ],
        evaluationFrequency: 2.0,
        goalTimeoutDuration: 30.0,
        // Tactical Retreat Settings
        RETREAT_DISTANCE: 12,
        RETREAT_COMPLETION_THRESHOLD: 3,
        // Tactical Maneuver Settings
        MANEUVER_DURATION: 2,
        MANEUVER_CHOICE_THRESHOLD: 0.5,
        MANEUVER_STRAFE_DISTANCE: 6,
        MANEUVER_CIRCLE_DISTANCE: 12,
        MANEUVER_CIRCLE_ANGLE_VARIANCE: 0.5,
        MANEUVER_POSITION_TOLERANCE: 2,
        // Flank Settings
        FLANK_DISTANCE: 15,
        FLANK_ARRIVAL_THRESHOLD: 3,
        FLANK_MAX_DURATION: 15,
        FLANK_ANGLE_DEFAULT: 90,
        FLANK_ANGLE_AGGRESSIVE_MIN: 120,
        FLANK_ANGLE_AGGRESSIVE_VARIANCE: 30,
        FLANK_ANGLE_TACTICAL_MIN: 75,
        FLANK_ANGLE_TACTICAL_VARIANCE: 30,
        FLANK_AGGRESSION_THRESHOLD: 0.7,
        FLANK_VALIDATION_RADIUS: 5,
        // Seek Cover Settings
        SEEK_COVER_SAFE_DISTANCE: 15,
        SEEK_COVER_TIMEOUT: 10,
        SEEK_COVER_COMPLETION_DISTANCE: 2,
        // Patrol Settings
        PATROL_ARRIVAL_THRESHOLD: 4,
        PATROL_VALIDATION_RADIUS: 8,
        // Hunt Settings
        HUNT_MAX_TIME: 8,
        HUNT_VALIDATION_RADIUS: 5,
        HUNT_ARRIVAL_THRESHOLD: 3,
        // Assault Settings
        ASSAULT_APPROACH_DISTANCE: 4,
        ASSAULT_COMPLETION_DISTANCE: 6,
        // Advance Settings
        ADVANCE_DISTANCE: 10,
        ADVANCE_COMPLETION_DISTANCE: 15,
        // Approach Settings - Evasive
        EVASIVE_PERPENDICULAR_DISTANCE: 8,
        EVASIVE_FINAL_APPROACH_DISTANCE: 3,
        EVASIVE_VALIDATION_RADIUS: 8,
        // Approach Settings - Cautious
        CAUTIOUS_COMPLETION_DISTANCE: 3,
        CAUTIOUS_PAUSE_INTERVAL_MIN: 1.5,
        CAUTIOUS_PAUSE_INTERVAL_MAX: 3.5,
        CAUTIOUS_FIRST_PAUSE_MIN: 2.0,
        CAUTIOUS_FIRST_PAUSE_MAX: 4.0,
        CAUTIOUS_SPEED_MIN: 0.1,
        CAUTIOUS_VALIDATION_RADIUS: 5,
        // Approach Settings - Direct
        DIRECT_COMPLETION_DISTANCE: 4.5,
        DIRECT_STUCK_THRESHOLD: 0.6,
        DIRECT_VALIDATION_RADIUS: 5,
        DIRECT_VALIDATION_RADIUS_LARGE: 8,
        DIRECT_SPEED_EXPECTATION_FACTOR: 0.5,
        DIRECT_MIN_EXPECTED_DISTANCE: 0.01,
        // Base Movement Settings
        BASE_MOVEMENT_DELTA_TIME: 0.016,
        // Goal Priority Levels
        priorities: {
            CRITICAL_SURVIVAL: 100,
            HIGH_SURVIVAL: 80,
            COMBAT_DEFENSIVE: 70,
            COMBAT_OFFENSIVE: 60,
            RESOURCE_CRITICAL: 50,
            RESOURCE_HIGH: 40,
            RESOURCE_NORMAL: 30,
            TACTICAL: 20,
            EXPLORATION: 10
        },
        // Priority Calculation
        MIN_PRIORITY_GAP: 10,
        // Health-based Priority Thresholds
        CRITICAL_HEALTH_PRIORITY_THRESHOLD: 0.15,
        HIGH_SURVIVAL_HEALTH_THRESHOLD: 0.30,
        RESOURCE_HIGH_HEALTH_THRESHOLD: 0.50,
        // Ammo-based Priority Thresholds
        COMBAT_AMMO_CRITICAL_THRESHOLD: 0.20,
        AMMO_CRITICAL_THRESHOLD: 0.30,
        // Combat Goal Thresholds
        COMBAT_DEFENSIVE_HEALTH_THRESHOLD: 0.30,
        // Goal Check Timing
        GOAL_CHECK_INTERVAL: 100,
        // Cover Seeking
        COVER_SEEK_COOLDOWN: 2000,
        UNDER_FIRE_WINDOW: 2000,
        // Cover Evaluation Thresholds
        COVER_CRITICAL_HEALTH: 0.25,
        COVER_WOUNDED_HEALTH: 0.4,
        COVER_MODERATE_HEALTH: 0.6,
        COVER_HIGH_HEALTH: 0.8,
        // Cover Urgency Levels
        COVER_URGENCY_CRITICAL: 1.0,
        COVER_URGENCY_WOUNDED: 0.85,
        COVER_URGENCY_MODERATE: 0.6,
        COVER_URGENCY_LIGHT: 0.3,
        COVER_URGENCY_FULL_UNDER_FIRE: 0.4,
        COVER_URGENCY_UNDER_FIRE_BOOST: 0.95,
        // Cover Personality Defaults
        DEFAULT_COVER_USAGE: 0.7,
        AGGRESSIVE_PERSONALITY_COVER_BOOST: 0.7,
        // Cover Tweaker
        COVER_EVALUATION_TWEAKER: 1.5,
        DEFAULT_COVER_USAGE_FALLBACK: 0.8,
        // No Ammo Cover Penalties
        COVER_NO_AMMO_CRITICAL_HEALTH_PENALTY: 0.9,
        COVER_NO_AMMO_WOUNDED_PENALTY: 0.8,
        COVER_NO_AMMO_DEFAULT_PENALTY: 0.6,
        // Cover Combat Boost
        COVER_IN_COMBAT_BOOST: 1.3,
        // Cover Minimum Desirability
        COVER_MINIMUM_LOG_THRESHOLD: 0.1
    },
    // Emotional System Settings
    emotions: {
        enableEmotions: true,
        emotionDecayRate: 0.1,
        maxEmotionIntensity: 1.0,
        emotionInfluence: 0.3,
        // Initial Emotional State Ranges
        INITIAL_STRESS_MIN: 0.3,
        INITIAL_STRESS_MAX: 0.5,
        INITIAL_CONFIDENCE_MIN: 0.6,
        INITIAL_CONFIDENCE_MAX: 0.8,
        INITIAL_FATIGUE: 0.0,
        INITIAL_PANIC: 0.0,
        INITIAL_COMPOSURE_MIN: 0.7,
        INITIAL_COMPOSURE_MAX: 0.9,
        // Update Settings
        UPDATE_INTERVAL: 200,
        // Performance Tracking
        PERFORMANCE_RESET_INTERVAL: 60000,
        // Default Modifiers
        DEFAULT_ACCURACY_MODIFIER: 1.0,
        DEFAULT_DECISION_SPEED: 1.0
    },
    // State Transition System Settings
    stateTransitions: {
        // Debounce and Timing
        STATE_CHANGE_DEBOUNCE: 100,
        MINIMUM_DWELL_TIME: 1500,
        // Exception Overrides
        CRITICAL_HEALTH_OVERRIDE_THRESHOLD: 0.15,
        LOW_HEALTH_OVERRIDE_THRESHOLD: 0.30,
        LOW_HEALTH_OVERRIDE_DELAY: 800,
        // Quick Transition Threshold
        QUICK_TRANSITION_AGE: 500,
        // Frame Tracking
        FRAMES_TO_KEEP: 10,
        RECENT_FRAMES_CHECK: 3,
        PING_PONG_THRESHOLD: 2,
        // Logging
        STATE_CHANGE_LOG_THROTTLE: 500,
        EVENT_LOG_THROTTLE: 300,
        // History
        MAX_HISTORY_LENGTH: 20,
        // Default State Age (when unknown)
        DEFAULT_STATE_AGE: 999999
    },
    // Vision System Settings
    vision: {
        viewDistance: 50.0,
        fieldOfView: 120,
        updateRate: 30,
        enableLineOfSight: true,
        // Vision Update Frequency
        VISION_UPDATE_HZ: 24,
        // Memory Settings
        TARGET_MEMORY_SPAN: 5,
        LAST_KNOWN_MEMORY_DURATION: 10000,
        MEMORY_CLEANUP_INTERVAL: 2000,
        MAX_TRACKED_ENTITIES: 200,
        // Confidence and Decay
        CONFIDENCE_DECAY_RATE: 0.1,
        MIN_CONFIDENCE: 0.1,
        SOUND_CONFIDENCE_MAX: 0.7,
        SOUND_CONFIDENCE_DEFAULT: 0.5,
        VISUAL_CONFIDENCE: 1.0,
        MEMORY_CONFIDENCE: 0.8,
        // Eye Height Settings
        DEFAULT_EYE_HEIGHT: 2,
        DEFAULT_CROUCH_EYE_HEIGHT: 2.0,
        MIN_EYE_HEIGHT: 0.5,
        MAX_EYE_HEIGHT: 2.5,
        // Line of Sight
        LOS_TOO_CLOSE_THRESHOLD: 0.1,
        LOS_HIT_DISTANCE_FACTOR: 0.95,
        // Entity Wrapping
        DEFAULT_BOUNDING_RADIUS: 0.5,
        // Diagnostic Logging
        DIAGNOSTIC_LOG_INTERVAL: 5000,
        TARGET_LOG_THROTTLE: 1000
    },
    // Sound Propagation Settings
    sound: {
        DISTANCE_FACTOR_BASE: 1.0
    },
    // Event Handler Settings
    events: {
        MAX_DAMAGE_HISTORY: 10,
        MAX_SOUND_HISTORY: 5,
        THREAT_DECAY_RATE: 0.1,
        THREAT_UPDATE_INTERVAL: 1000,
        INITIAL_HEALTH_RATIO: 1.0,
        LOG_THROTTLE_MS: 500,
        FRIENDLY_FIRE_WARNING_THROTTLE: 2000,
        // Alertness Modifiers
        DAMAGE_ALERTNESS_BOOST: 0.4,
        SOUND_ALERTNESS_BOOST: 0.3,
        ALERTNESS_MAX: 1,
        ALERTNESS_MIN: 0.3,
        ALERTNESS_DECAY: 0.2,
        ENEMY_SPOTTED_ALERTNESS_THRESHOLD: 0.7,
        // Morale Modifiers
        MORALE_MIN: 0,
        MORALE_DAMAGE_PENALTY: 0.4,
        MORALE_HEAVY_DAMAGE_PENALTY: 0.3,
        MORALE_DAMAGE_THRESHOLD_MIN: 0.1,
        // Health/Damage Thresholds
        CRITICAL_HEALTH_THRESHOLD: 0.15,
        LOW_HEALTH_THRESHOLD: 0.2,
        MODERATE_DAMAGE_THRESHOLD: 0.2,
        HEAVY_DAMAGE_THRESHOLD: 0.3,
        SEVERE_DAMAGE_THRESHOLD: 0.4,
        // Threat Detection
        HIGH_THREAT_THRESHOLD: 1.2,
        THREAT_BOOST: 0.5,
        THREAT_REDUCTION: 0.5,
        BASE_THREAT_LEVEL: 1.0
    },
    // Weapons System Settings
    weapons: {
        // Starting Ammo (by weapon type)
        PISTOL_STARTING_AMMO: 120,
        MACHINEGUN_STARTING_AMMO: 0,
        SHOTGUN_STARTING_AMMO: 0,
        // Maximum Ammo (by weapon type)
        PISTOL_MAX_AMMO: 120,
        MACHINEGUN_MAX_AMMO: 150,
        SHOTGUN_MAX_AMMO: 30,
        // Magazine Sizes (by weapon type)
        PISTOL_MAGAZINE_SIZE: 12,
        MACHINEGUN_MAGAZINE_SIZE: 30,
        SHOTGUN_MAGAZINE_SIZE: 8,
        // Weapon Damage (by weapon type)
        // 🎯 BALANCED: Pistol accuracy/headshots, Machinegun spray, Shotgun power
        PISTOL_DAMAGE: 22,
        MACHINEGUN_DAMAGE: 13,
        SHOTGUN_DAMAGE: 100,
        // Fire Rates (seconds between shots, by weapon type)
        PISTOL_FIRE_RATE: 0.3,
        MACHINEGUN_FIRE_RATE: 0.1,
        SHOTGUN_FIRE_RATE: 0.8,
        // Weapon Ranges (meters, by weapon type)
        PISTOL_RANGE: 50,
        MACHINEGUN_RANGE: 75,
        SHOTGUN_RANGE: 15,
        // Weapon Spread (radians, by weapon type)
        // 🎯 BALANCED: Pistol tight, Machinegun wild spray, Shotgun close-only
        PISTOL_SPREAD: 0.015,
        MACHINEGUN_SPREAD: 0.055,
        SHOTGUN_SPREAD: 0.15,
        // Reload Times (seconds, by weapon type)
        // 🎯 BALANCED: Shotgun vulnerability window increased
        PISTOL_RELOAD_TIME: 1.5,
        MACHINEGUN_RELOAD_TIME: 2.5,
        SHOTGUN_RELOAD_TIME: 2.5,
        // Shotgun Configuration
        SHOTGUN_PELLETS: 6,
        // Weapon Core Mechanics
        WEAPON_SWITCH_COOLDOWN: 0.5,
        DEFAULT_FIRE_RATE_FALLBACK: 0.5,
        DEFAULT_AMMO_FALLBACK: 50,
        DEFAULT_MAGAZINE_SIZE_FALLBACK: 10,
        DEFAULT_DAMAGE_FALLBACK: 25,
        DEFAULT_RANGE_FALLBACK: 50,
        DEFAULT_SPREAD_FALLBACK: 0.02,
        DEFAULT_RELOAD_TIME_FALLBACK: 2.0,
        // Weapon Socket Position Validation
        EYE_HEIGHT_FALLBACK: 1.6,
        MAX_SOCKET_DISTANCE_FROM_ENTITY: 20,
        MIN_WEAPON_HEIGHT_ABOVE_ENTITY: 1.0,
        POSITION_EQUALITY_THRESHOLD: 0.01,
        NEAR_ORIGIN_THRESHOLD: 5,
        EXPECTED_OFFSET_BELOW_EYE: 0.15,
        EYE_OFFSET_TOLERANCE: 0.10,
        AUTO_CORRECT_HEIGHT_THRESHOLD: 0.3,
        // Weapon Animation Settings
        RECOIL_INTENSITY_DEFAULT: 1.0,
        // Animation Durations (seconds)
        FIRE_ANIMATION_DURATION: 0.15,
        RELOAD_ANIMATION_DURATION: 0.8,
        DRAW_ANIMATION_DURATION: 0.4,
        HOLSTER_ANIMATION_DURATION: 0.3,
        // Machinegun Recoil Vectors
        MACHINEGUN_RECOIL_POS_X: 0.002,
        MACHINEGUN_RECOIL_POS_Y: -0.004,
        MACHINEGUN_RECOIL_POS_Z: 0.025,
        MACHINEGUN_RECOIL_ROT_X: -3,
        MACHINEGUN_RECOIL_ROT_Y: 0,
        MACHINEGUN_RECOIL_ROT_Z: 0,
        // Shotgun Recoil Vectors
        SHOTGUN_RECOIL_POS_X: 0.015,
        SHOTGUN_RECOIL_POS_Y: -0.025,
        SHOTGUN_RECOIL_POS_Z: 0.12,
        SHOTGUN_RECOIL_ROT_X: -15,
        SHOTGUN_RECOIL_ROT_Y: 1,
        SHOTGUN_RECOIL_ROT_Z: 0.5,
        // Rocket Launcher Recoil Vectors
        ROCKETLAUNCHER_RECOIL_POS_X: 0.005,
        ROCKETLAUNCHER_RECOIL_POS_Y: -0.01,
        ROCKETLAUNCHER_RECOIL_POS_Z: 0.08,
        ROCKETLAUNCHER_RECOIL_ROT_X: -8,
        ROCKETLAUNCHER_RECOIL_ROT_Y: 0,
        ROCKETLAUNCHER_RECOIL_ROT_Z: 0,
        // Pistol Recoil Vectors
        PISTOL_RECOIL_POS_X: 0,
        PISTOL_RECOIL_POS_Y: -0.01,
        PISTOL_RECOIL_POS_Z: 0.04,
        PISTOL_RECOIL_ROT_X: -8,
        PISTOL_RECOIL_ROT_Y: 0,
        PISTOL_RECOIL_ROT_Z: 0,
        // Reload Animation Vectors
        RELOAD_DOWN_POS_Y: -0.08,
        RELOAD_DOWN_POS_Z: 0.04,
        RELOAD_DOWN_ROT_X: 10,
        // Draw Animation Vectors
        DRAW_START_POS_Y: -0.6,
        // Animation Timing Fractions
        MACHINEGUN_RECOIL_IN_FRACTION: 0.4,
        MACHINEGUN_RECOIL_OUT_FRACTION: 0.6,
        SHOTGUN_RECOIL_IN_FRACTION: 0.4,
        SHOTGUN_RECOIL_OUT_FRACTION: 0.6,
        ROCKETLAUNCHER_RECOIL_IN_FRACTION: 0.5,
        ROCKETLAUNCHER_RECOIL_OUT_FRACTION: 0.5,
        PISTOL_RECOIL_IN_FRACTION: 0.3,
        PISTOL_RECOIL_OUT_FRACTION: 0.7,
        RELOAD_ANIMATION_FRACTION: 0.3
    },
    // Player System Settings
    player: {
        // Movement & Physics
        LOOK_MAX_ANGLE: 90,
        LOOK_SENSITIVITY: 0.08,
        SPEED_GROUND: 50,
        SPEED_AIR: 5,
        SPRINT_MULTIPLIER: 1.5,
        VELOCITY_DAMPING_GROUND: 0.99,
        VELOCITY_DAMPING_AIR: 0.99925,
        JUMP_FORCE: 600,
        MOVEMENT_THRESHOLD: 0.1,
        // Ground Detection
        COLLIDER_HEIGHT_FALLBACK: 2.0,
        GROUND_CHECK_START_OFFSET: 0.05,
        GROUND_CHECK_CONTACT_MARGIN: 0.10,
        // Step Climbing
        MAX_STEP_HEIGHT: 0.5,
        STEP_CHECK_DISTANCE: 0.6,
        // Input Timing
        JUMP_COOLDOWN_MS: 50,
        WHEEL_SCROLL_COOLDOWN_MS: 120,
        // Mobile Input
        MOBILE_TURN_SPEED: 30,
        MOBILE_DEAD_ZONE: 0.3,
        MOBILE_JOYSTICK_RADIUS: 50,
        MOBILE_DOUBLE_TAP_INTERVAL_MS: 300,
        MOBILE_TRIPLE_TAP_INTERVAL_MS: 500,
        MOBILE_DEAD_ZONE_UPPER: 0,
        // Gamepad Input
        GAMEPAD_TURN_SPEED: 30,
        GAMEPAD_DEAD_ZONE_LOW: 0.1,
        GAMEPAD_DEAD_ZONE_HIGH: 0.1,
        GAMEPAD_DEAD_ZONE_MAX_ATTR: 0.4,
        // Player Core
        YUKA_BOUNDING_RADIUS: 0.5,
        RESPAWN_COOLDOWN_MS: 1000,
        FOOTSTEP_INTERVAL_MS: 500,
        DEPENDENCY_CHECK_DELAY_MS: 150,
        READY_EVENT_FALLBACK_DELAY_MS: 1000,
        DEATH_EVENT_DEBOUNCE_MS: 100,
        // Screen Effects
        SCREEN_SHAKE_INTENSITY_DEATH: 0.5,
        SCREEN_SHAKE_INTENSITY_MAX: 0.3,
        SCREEN_SHAKE_DECAY_MULTIPLIER: 3,
        DAMAGE_TO_SHAKE_FACTOR: 0.02,
        // Damage Vignette
        VIGNETTE_INTENSITY_NORMAL: 0.6,
        VIGNETTE_DURATION_NORMAL: 0.8,
        VIGNETTE_INTENSITY_DEATH: 0.8,
        VIGNETTE_DURATION_DEATH: 2.0,
        // Controller Vibration
        VIBRATION_WEAK_MULTIPLIER: 0.5,
        VIBRATION_DAMAGE_FACTOR: 0.01,
        VIBRATION_INTENSITY_MAX: 0.8,
        VIBRATION_DURATION_FACTOR: 10,
        VIBRATION_DURATION_MAX_MS: 300,
        // Collision & Pickup
        COLLISION_HALF_EXTENTS_X: 0.8,
        COLLISION_HALF_EXTENTS_Y: 1.0,
        COLLISION_HALF_EXTENTS_Z: 0.8,
        // Weapon Targeting
        WEAPON_TARGET_DISTANCE: 50.0,
        FOOTSTEP_VELOCITY_THRESHOLD: 0.5,
        // Physics Constants
        DAMPING_TIME_SCALE_MS: 1e3 // Milliseconds conversion for damping calculation
    },
    // Session Management Settings
    session: {
        // Countdown System
        COUNTDOWN_DURATION: 4,
        // Respawn Timings
        AI_RESPAWN_DELAY_MS: 5000,
        PLAYER_RESPAWN_DELAY_MS: 3000,
        // Death Event Protection
        DEATH_DEBOUNCE_MS: 100,
        // Update Intervals
        UPDATE_INTERVAL: 0.1,
        UPDATE_TIMER_INITIAL: 0,
        // State Timeouts
        STATE_TRANSITION_TIMEOUT_MS: 5000,
        // Time Scale
        PAUSED_TIME_SCALE: 0,
        RUNNING_TIME_SCALE: 1 // Time scale when running
    },
    // Pickup System Settings
    pickup: {
        // Respawn Timings
        RESPAWN_TIME_SECONDS: 30,
        RESPAWN_TIME_MS_MULTIPLIER: 1000,
        // Pickup Range
        DEFAULT_PICKUP_RANGE: 0.5,
        PICKUP_COOLDOWN: 0.5,
        // Visual Effects
        DEFAULT_ROTATION_SPEED: 90,
        DEFAULT_BOB_HEIGHT: 0.2,
        DEFAULT_BOB_SPEED: 2,
        // Item Values
        DEFAULT_HEALTH_VALUE: 60,
        DEFAULT_AMMO_VALUE: 30 // Default ammo pack value
    },
    // Audio System Settings
    audio: {
        // Volume Levels
        MASTER_VOLUME_DEFAULT: 0.7,
        SFX_VOLUME_DEFAULT: 0.8,
        // Audio Limits
        MAX_SIMULTANEOUS_SOUNDS: 32,
        SOUND_FALLOFF_DISTANCE: 50,
        // Weapon Sounds
        WEAPON_DRAW_VOLUME: 0.7,
        WEAPON_HOLSTER_VOLUME: 0.6,
        // Playback Defaults
        DEFAULT_VOLUME: 1.0,
        DEFAULT_PITCH: 1.0,
        FADE_START_VOLUME: 0,
        // Volume Clamping
        VOLUME_MIN: 0,
        VOLUME_MAX: 1 // Maximum volume value
    },
    // UI System Settings
    ui: {
        // Crosshair - General
        CROSSHAIR_DEFAULT_SPREAD: 15,
        CROSSHAIR_RECOVERY_SPEED: 3.0,
        CROSSHAIR_MOVEMENT_MULT: 1.0,
        CROSSHAIR_SHOOTING_MULT: 1.0,
        CROSSHAIR_SHOOTING_DECAY_TIME: 0.3,
        CROSSHAIR_WALK_THRESHOLD: 0.5,
        CROSSHAIR_RUN_THRESHOLD: 2.0,
        // Crosshair - Pistol
        PISTOL_BASE_SPREAD: 12,
        PISTOL_MOVEMENT_MULT: 3.5,
        PISTOL_SHOOTING_MULT: 2.5,
        PISTOL_THICKNESS: 2,
        PISTOL_LINE_LENGTH: 8,
        // Crosshair - Machinegun
        MACHINEGUN_BASE_SPREAD: 15,
        MACHINEGUN_MOVEMENT_MULT: 4.0,
        MACHINEGUN_SHOOTING_MULT: 3.0,
        MACHINEGUN_THICKNESS: 2,
        // Crosshair - Shotgun
        SHOTGUN_BASE_SPREAD: 30,
        SHOTGUN_MOVEMENT_MULT: 3.0,
        SHOTGUN_SHOOTING_MULT: 2.5,
        SHOTGUN_THICKNESS: 2,
        SHOTGUN_DOT_SIZE: 6,
        // Damage Vignette (UI Manager defaults)
        DAMAGE_VIGNETTE_INTENSITY_DEFAULT: 0.6,
        DAMAGE_VIGNETTE_DURATION_DEFAULT: 0.8,
        // Button Animations
        BUTTON_PULSE_SPEED: 2,
        BUTTON_PULSE_AMOUNT: 0.1,
        BUTTON_HOVER_SCALE_BONUS: 0.05,
        BUTTON_HOVER_NORMAL_SCALE: 1.05,
        BUTTON_CLICK_SCALE: 0.95,
        BUTTON_CLICK_ANIMATION_MS: 100,
        BUTTON_HOVER_OPACITY: 0.8,
        BUTTON_DEFAULT_OPACITY: 1.0,
        BUTTON_GLOW_BASE_INTENSITY: 0.7,
        BUTTON_GLOW_INTENSITY_VARIATION: 0.3,
        BUTTON_GLOW_SPEED_MULTIPLIER: 1.5,
        // HUD Updates
        HUD_WEAPON_EVENT_HOLD_MS: 150,
        HUD_DEFAULT_TIMER: 300,
        HUD_DEFAULT_HEALTH_CURRENT: 100,
        HUD_DEFAULT_HEALTH_MAX: 100,
        HUD_DEFAULT_AMMO_CURRENT: 12,
        HUD_DEFAULT_AMMO_TOTAL: 120,
        HUD_COUNTDOWN_GO_HIDE_MS: 1000,
        HUD_COUNTDOWN_START_HIDE_MS: 1500,
        HUD_HEALTH_CRITICAL_THRESHOLD: 0.25,
        HUD_HEALTH_LOW_THRESHOLD: 0.5,
        // Time Scale
        PAUSED_TIME_SCALE: 0,
        RUNNING_TIME_SCALE: 1 // Time scale when running
    },
    // Movement System Settings
    movement: {
        cautiousSpeedMultiplier: 0.7,
        cautiousPauseDuration: 0.5,
        cautiousCompleteDistance: 3,
        directCompleteDistance: 4.5,
        evasiveCompleteDistance: 4.5 // Completion distance for evasive approach in units
    },
    // Rotation System Settings
    rotation: {
        facingThreshold: 5,
        nearFacingThreshold: 10 // Degrees threshold to consider near target rotation
    },
    // Agent Utilities Configuration
    utilities: {
        // Exploration Settings
        EXPLORATION_RADIUS: 35,
        MAX_EXPLORATION_DISTANCE: 25,
        MAX_EXPLORATION_ATTEMPTS: 15,
        MAX_TOTAL_ATTEMPTS: 60,
        ANGULAR_STEPS: 16,
        // Backoff & Retry
        MAX_BACKOFF_MS: 5000,
        // Validation & Caching
        VALIDATION_CACHE_TIMEOUT: 3000,
        MAX_CACHE_SIZE: 200,
        // Random Position Defaults
        RANDOM_POS_MIN_DISTANCE: 5,
        RANDOM_POS_MAX_DISTANCE: 15,
        POSITION_VALIDATION_ATTEMPTS: 10,
        // Strategic Scoring
        STRATEGIC_SCORE_INITIAL: 0.0,
        EFFECTIVENESS_DEFAULT: 0.5,
        // Polling
        MAX_POLL_ATTEMPTS: 30 // Maximum polling attempts for systems
    },
    // Weapon Effects Configuration
    weaponEffects: {
        // Visual Effects
        BREATHING_INTENSITY: 0.002,
        BREATHING_SPEED: 1.5,
        BOBBING_INTENSITY: 0.015,
        BOBBING_SPEED: 8.0,
        SPRINT_INTENSITY_MULTIPLIER: 1.8,
        SPRINT_SPEED_MULTIPLIER: 1.5,
        SPEED_MULTIPLIER_DEFAULT: 1.0,
        // Muzzle Flash
        LIGHT_FLASH_DURATION: 0.05,
        LIGHT_INTENSITY: 3.0,
        SHAKE_AMOUNT: 0.05,
        SHAKE_DURATION: 0.1,
        // Left Hand Following
        FOLLOW_LERP: 12,
        // Decals
        MAX_DECALS: 50 // Maximum number of bullet hole decals
    },
    // Health Effects Configuration
    healthEffects: {
        // Health System Defaults
        HIT_DEDUPE_WINDOW: 32,
        MAX_HEALTH_DEFAULT: 100,
        STARTING_HEALTH_DEFAULT: 100,
        DAMAGE_FLASH_DURATION: 0.2,
        INVINCIBILITY_TIME: 0.15,
        // Damage Vignette
        VIGNETTE_MAX_OPACITY: 0.65,
        VIGNETTE_FADE_IN: 0.08,
        VIGNETTE_HOLD: 0.12,
        VIGNETTE_FADE_OUT: 0.35,
        // Health Effects
        HEALTH_EFFECT_DURATION: 1.5,
        MAX_DAMAGE_SCALING: 50 // Maximum damage value for scaling effects
    },
    // Pickup System Reservation
    pickupReservation: {
        RESERVATION_DURATION_MS: 10000 // Duration to reserve pickup for agent (ms)
    },
    // Goal Evaluator Settings
    evaluators: {
        // Take Cover
        COVER_TWEAKER: 1.5,
        COVER_URGENCY_CRITICAL: 1.0,
        COVER_URGENCY_WOUNDED: 0.85,
        COVER_URGENCY_MODERATE: 0.6,
        COVER_URGENCY_LIGHT: 0.3,
        // Hunt
        HUNT_TWEAKER: 1.0,
        HUNT_DISTANCE_SCORE_DEFAULT: 1.0,
        HUNT_PERSONALITY_MULTIPLIER: 1.0,
        // Get Weapon
        WEAPON_TWEAKER: 1.0,
        WEAPON_SWITCH_COOLDOWN_MS: 400,
        WEAPON_RANGE_CLOSE: 10,
        WEAPON_RANGE_MID: 35,
        WEAPON_RANGE_FAR: 50,
        WEAPON_HYSTERESIS_THRESHOLD: 0.15,
        WEAPON_MIN_SCORE: 0.15,
        WEAPON_BACKOFF_BASE: 2000,
        WEAPON_BACKOFF_MAX: 15000,
        WEAPON_BACKOFF_MULTIPLIER: 1.8,
        WEAPON_EVALUATION_THROTTLE_MS: 1000,
        WEAPON_DESIRABILITY_CACHE_MS: 800,
        WEAPON_GOAL_CREATION_COOLDOWN: 2000,
        // Weapon Range Preferences (per weapon type at different ranges)
        WEAPON_SHOTGUN_CLOSE_PREF: 1.5,
        WEAPON_MACHINEGUN_CLOSE_PREF: 1.3,
        WEAPON_PISTOL_CLOSE_PREF: 0.6,
        WEAPON_MACHINEGUN_MID_PREF: 1.5,
        WEAPON_SHOTGUN_MID_PREF: 0.9,
        WEAPON_PISTOL_MID_PREF: 0.6,
        WEAPON_MACHINEGUN_FAR_PREF: 1.3,
        WEAPON_SHOTGUN_FAR_PREF: 0.7,
        WEAPON_PISTOL_FAR_PREF: 0.5,
        WEAPON_SHOTGUN_DEFAULT_PREF: 1.4,
        WEAPON_MACHINEGUN_DEFAULT_PREF: 1.3,
        WEAPON_PISTOL_DEFAULT_PREF: 0.7,
        WEAPON_RANGE_PREF_DEFAULT: 1.0,
        WEAPON_CONTEXT_MULTIPLIER: 1.0,
        WEAPON_CONTEXT_BOOST: 1.15,
        // Strategic Goals
        ELIMINATE_ENEMY_INTERVAL_MS: 3000 // Re-evaluation interval for eliminate enemy goal
    },
    // Perception System Settings
    perception: {
        // Vision
        BOUNDING_RADIUS_DEFAULT: 0.5,
        // Event Handling
        EVENT_SEARCH_RADIUS: 30 // Search radius for event handling
    },
    // Goal Execution Settings  
    goalExecution: {
        // Direct Approach
        DIRECT_STUCK_THRESHOLD: 0.6,
        // Ammo Refill (AI cheats)
        AI_AMMO_REFILL: 100 // Amount of ammo to refill for AI agents
    },
    // Tween Easing Constants (Mathematical - Generally don't modify)
    tweenEasing: {
        ELASTIC_P: 0.4,
        ELASTIC_A: 0.1,
        BACK_S: 1.70158,
        SPEED_MULTIPLIER_DEFAULT: 1.0 // Default tween speed multiplier
    }
};

export { aiConfig, aiConfig as default };
