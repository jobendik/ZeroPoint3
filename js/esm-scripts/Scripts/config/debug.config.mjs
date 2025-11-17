///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * Debug Configuration
 * Debug and development settings
 */ const debugConfig = {
    // General Debug Settings
    general: {
        enableDebugMode: false,
        showFPS: false,
        showMemoryUsage: false,
        verboseLogging: false
    },
    // Visual Debug Settings
    visual: {
        showWireframes: false,
        showBoundingBoxes: false,
        showNavMesh: false,
        showAIDebugInfo: false,
        showPhysicsDebug: false
    },
    // AI Debug Settings
    ai: {
        showGoalStacks: false,
        showDecisionTrees: false,
        showPathfinding: false,
        showVisionCones: false,
        showVisionRaycasts: true,
        logAIDecisions: false
    },
    // Performance Debug Settings
    performance: {
        enableProfiler: false,
        trackFrameTimes: false,
        showRenderStats: false,
        logPerformanceWarnings: true
    },
    // System Debug Settings
    systems: {
        logSystemEvents: false,
        validateSystemState: false,
        enableSystemTimers: false,
        showSystemDependencies: false
    },
    // Debug UI Settings
    ui: {
        showDebugPanel: false,
        enableConsole: false,
        showEntityInspector: false,
        enableDevTools: false
    }
};

export { debugConfig, debugConfig as default };
