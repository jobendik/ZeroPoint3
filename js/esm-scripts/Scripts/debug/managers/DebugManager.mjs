import { Script } from '../../../../playcanvas-stable.min.mjs';
import { VisionRaycastVisualizer } from '../tools/visionRaycastVisualizer.mjs';
import { WeaponRaycastVisualizer } from '../tools/WeaponRaycastVisualizer.mjs';

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
 * 🔧 Lightweight Debug Manager - Production-Ready Debug Infrastructure
 * 
 * Replaces heavy debug systems (systemDebugger.js, aiAgentDebugger.js) 
 * with lightweight essential debugging capabilities.
 * 
 * Features:
 * - Essential system monitoring
 * - Performance metrics tracking
 * - Error logging and diagnostics
 * - Integration with logger.mjs and eventBus.mjs
 * - Vision raycast visualization (Press V)
 * - Production-ready (minimal overhead)
 */ class DebugManager extends Script {
    initialize() {
        console.log('[DebugManager] Lightweight debug system starting...');
        // Guard against multiple initialization
        if (this.__debugManagerBooted) {
            console.log('[DebugManager] Already initialized, skipping...');
            return;
        }
        // Initialize core references
        this._initializeReferences();
        // Initialize monitoring systems
        this._initializeMonitoring();
        // Setup event listeners
        this._setupEventListeners();
        // Register with app for global access
        this.app.debugManager = this;
        this.__debugManagerBooted = true;
        console.log('[DebugManager] ✅ Lightweight debug system ready');
    }
    _initializeReferences() {
        // Core system references
        this.logger = null;
        this.eventBus = null;
        this.gameManager = null;
        // Performance tracking
        this.metrics = {
            fps: 60,
            frameTime: 16.67,
            memoryUsage: 0,
            entityCount: 0,
            activeAgents: 0,
            systemHealth: 'healthy'
        };
        // System health tracking
        this.systemHealth = {
            navigation: 'unknown',
            audio: 'unknown',
            weapons: 'unknown',
            health: 'unknown',
            pickups: 'unknown',
            ui: 'unknown'
        };
        // Error tracking
        this.errorCount = 0;
        this.warningCount = 0;
        this.lastErrors = [];
        // Timing
        this._lastUpdate = 0;
        this._startTime = performance.now();
        // Vision debug visualizer
        this.visionVisualizer = null;
        // Weapon debug visualizer
        this.weaponVisualizer = null;
    }
    _initializeMonitoring() {
        // Find logger (converted ESM module)
        this._findLogger();
        // Find event bus (converted ESM module)  
        this._findEventBus();
        // Find game manager
        this._findGameManager();
        // Initialize vision raycast visualizer
        if (this.enableVisionDebug) {
            this._initializeVisionVisualizer();
        }
        // Initialize weapon raycast visualizer
        if (this.enableWeaponDebug) {
            this._initializeWeaponVisualizer();
        }
        // Setup performance monitoring
        if (this.enablePerformanceMonitoring) {
            this._setupPerformanceMonitoring();
        }
        // Setup system health monitoring
        if (this.enableSystemHealthChecks) {
            this._setupSystemHealthMonitoring();
        }
    }
    _findLogger() {
        // Logger is a global utility, not a script
        if (typeof Logger !== 'undefined') {
            this.logger = Logger;
            this._log('debug', '✅ Logger found');
        } else {
            console.warn('[DebugManager] Logger not found - debug output will be limited');
        }
    }
    _findEventBus() {
        // Look for eventBus in app
        if (this.app.eventBus) {
            this.eventBus = this.app.eventBus;
            this._log('debug', '✅ EventBus found');
        } else {
            console.warn('[DebugManager] EventBus not found - event monitoring disabled');
        }
    }
    _findGameManager() {
        // Look for gameManager in app
        if (this.app.gameManager) {
            this.gameManager = this.app.gameManager;
            this._log('debug', '✅ GameManager found');
        } else {
            console.warn('[DebugManager] GameManager not found - game state monitoring limited');
        }
    }
    _setupEventListeners() {
        // Listen for system events if eventBus is available
        if (this.eventBus) {
            // Listen for system errors
            this.eventBus.on('system:error', (data)=>{
                this._handleSystemError(data);
            }, this);
            // Listen for system warnings
            this.eventBus.on('system:warning', (data)=>{
                this._handleSystemWarning(data);
            }, this);
            // Listen for performance events
            this.eventBus.on('performance:fps', (fps)=>{
                this.metrics.fps = fps;
            }, this);
        }
        // Global error handling
        this._setupGlobalErrorHandling();
    }
    _setupGlobalErrorHandling() {
        // Capture JavaScript errors
        window.addEventListener('error', (event)=>{
            this._handleGlobalError('JavaScript Error', event.error || event.message);
        });
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event)=>{
            this._handleGlobalError('Unhandled Promise Rejection', event.reason);
        });
    }
    _setupPerformanceMonitoring() {
        // Monitor frame rate
        this._frameCount = 0;
        this._fpsTimer = 0;
        // Monitor memory usage (if available)
        if (window.performance && window.performance.memory) {
            this._memoryMonitoringAvailable = true;
        }
    }
    _setupSystemHealthMonitoring() {
        // Check system health periodically
        this._systemHealthTimer = 0;
    }
    _initializeVisionVisualizer() {
        try {
            this.visionVisualizer = new VisionRaycastVisualizer(this.app);
            this._log('info', '✅ Vision Raycast Visualizer initialized (Press V to toggle)');
        } catch (error) {
            console.error('[DebugManager] Failed to initialize vision visualizer:', error);
        }
    }
    _initializeWeaponVisualizer() {
        try {
            this.weaponVisualizer = new WeaponRaycastVisualizer(this.app);
            this._log('info', '✅ Weapon Raycast Visualizer initialized (Press W to toggle)');
        } catch (error) {
            console.error('[DebugManager] Failed to initialize weapon visualizer:', error);
        }
    }
    update(dt) {
        if (!this.__debugManagerBooted) return;
        // Update vision visualizer
        if (this.visionVisualizer) {
            this.visionVisualizer.update(dt);
        }
        // Update weapon visualizer
        if (this.weaponVisualizer) {
            this.weaponVisualizer.update(dt);
        }
        // Update performance metrics
        if (this.enablePerformanceMonitoring) {
            this._updatePerformanceMetrics(dt);
        }
        // Periodic system health checks
        this._lastUpdate += dt;
        if (this._lastUpdate >= this.updateInterval) {
            this._performPeriodicChecks();
            this._lastUpdate = 0;
        }
    }
    _updatePerformanceMetrics(dt) {
        // Update FPS calculation
        this._frameCount++;
        this._fpsTimer += dt;
        if (this._fpsTimer >= 1.0) {
            this.metrics.fps = this._frameCount;
            this.metrics.frameTime = this._fpsTimer / this._frameCount * 1000; // ms
            this._frameCount = 0;
            this._fpsTimer = 0;
        }
        // Update memory usage if available
        if (this._memoryMonitoringAvailable) {
            const memory = window.performance.memory;
            this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / (1024 * 1024)); // MB
        }
        // Update entity count
        this.metrics.entityCount = this.app.root.children.length;
        // Count active agents
        this._updateActiveAgentCount();
    }
    _updateActiveAgentCount() {
        let activeAgents = 0;
        const entities = this.app.root.findComponents('script');
        entities.forEach((entity)=>{
            if (entity.script && entity.script.aiAgent && entity.enabled) {
                activeAgents++;
            }
        });
        this.metrics.activeAgents = activeAgents;
    }
    _performPeriodicChecks() {
        if (!this.debugMode) return;
        // Check system health
        if (this.enableSystemHealthChecks) {
            this._checkSystemHealth();
        }
        // Log performance metrics
        this._logPerformanceMetrics();
        // Check for performance issues
        this._checkPerformanceIssues();
    }
    _checkSystemHealth() {
        // Check navigation system
        this.systemHealth.navigation = this.app.navigation?.services?.nav?.ready ? 'healthy' : 'unhealthy';
        // Check audio system
        this.systemHealth.audio = this.app.audioManager ? 'healthy' : 'unknown';
        // Check weapon system
        this.systemHealth.weapons = this.app.weaponSystem ? 'healthy' : 'unknown';
        // Check health system
        this.systemHealth.health = this.app.healthSystem ? 'healthy' : 'unknown';
        // Check pickup system
        this.systemHealth.pickups = this.app.pickupSystem ? 'healthy' : 'unknown';
        // Check UI system
        this.systemHealth.ui = this.app.uiManager ? 'healthy' : 'unknown';
    }
    _logPerformanceMetrics() {
        if (this.logger && this.debugMode) {
            this.logger.debug(`[DebugManager] Performance: ${this.metrics.fps}fps, ${this.metrics.frameTime.toFixed(1)}ms, ${this.metrics.memoryUsage}MB, ${this.metrics.entityCount} entities, ${this.metrics.activeAgents} agents`);
        }
    }
    _checkPerformanceIssues() {
        // Check for low FPS
        if (this.metrics.fps < 30) {
            this._log('warn', `Low FPS detected: ${this.metrics.fps}`);
        }
        // Check for high frame time
        if (this.metrics.frameTime > 33) {
            this._log('warn', `High frame time: ${this.metrics.frameTime.toFixed(1)}ms`);
        }
        // Check for high memory usage
        if (this.metrics.memoryUsage > 200) {
            this._log('warn', `High memory usage: ${this.metrics.memoryUsage}MB`);
        }
    }
    _handleSystemError(data) {
        this.errorCount++;
        this.lastErrors.push({
            timestamp: Date.now(),
            type: 'system',
            data: data
        });
        // Keep only last 10 errors
        if (this.lastErrors.length > 10) {
            this.lastErrors.shift();
        }
        this._log('error', `System error: ${JSON.stringify(data)}`);
    }
    _handleSystemWarning(data) {
        this.warningCount++;
        this._log('warn', `System warning: ${JSON.stringify(data)}`);
    }
    _handleGlobalError(type, error) {
        this.errorCount++;
        this.lastErrors.push({
            timestamp: Date.now(),
            type: 'global',
            errorType: type,
            error: error
        });
        // Keep only last 10 errors
        if (this.lastErrors.length > 10) {
            this.lastErrors.shift();
        }
        this._log('error', `${type}: ${error}`);
    }
    _log(level, message) {
        if (this.logger) {
            this.logger[level](`[DebugManager] ${message}`);
        } else {
            console.log(`[DebugManager] ${level.toUpperCase()}: ${message}`);
        }
    }
    // Public API for other systems to use
    logSystemHealth() {
        if (!this.debugMode) return;
        console.log('[DebugManager] === SYSTEM HEALTH REPORT ===');
        Object.entries(this.systemHealth).forEach(([system, status])=>{
            const icon = status === 'healthy' ? '✅' : status === 'unhealthy' ? '❌' : '❓';
            console.log(`  ${icon} ${system}: ${status}`);
        });
        console.log(`[DebugManager] Errors: ${this.errorCount}, Warnings: ${this.warningCount}`);
        console.log(`[DebugManager] Uptime: ${((performance.now() - this._startTime) / 1000).toFixed(1)}s`);
    }
    getMetrics() {
        return {
            ...this.metrics
        };
    }
    getSystemHealth() {
        return {
            ...this.systemHealth
        };
    }
    getErrorSummary() {
        return {
            errorCount: this.errorCount,
            warningCount: this.warningCount,
            lastErrors: [
                ...this.lastErrors
            ]
        };
    }
    destroy() {
        console.log('[DebugManager] Shutting down debug system');
        // Destroy vision visualizer
        if (this.visionVisualizer) {
            this.visionVisualizer.destroy();
            this.visionVisualizer = null;
        }
        // Destroy weapon visualizer
        if (this.weaponVisualizer) {
            this.weaponVisualizer.destroy();
            this.weaponVisualizer = null;
        }
        // Remove event listeners
        if (this.eventBus) {
            this.eventBus.off('system:error', null, this);
            this.eventBus.off('system:warning', null, this);
            this.eventBus.off('performance:fps', null, this);
        }
        // Clear references
        this.logger = null;
        this.eventBus = null;
        this.gameManager = null;
        // Remove from app
        if (this.app.debugManager === this) {
            this.app.debugManager = null;
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Enable Debug Mode */ _define_property(this, "debugMode", false);
        /** @attribute @type {boolean} @title Performance Monitoring */ _define_property(this, "enablePerformanceMonitoring", true);
        /** @attribute @type {number} @range [0.5, 5.0] @title Update Interval (seconds) */ _define_property(this, "updateInterval", 1.0);
        /** @attribute @type {boolean} @title System Health Checks */ _define_property(this, "enableSystemHealthChecks", true);
        /** @attribute @type {boolean} @title Enable Vision Debug (Press V) */ _define_property(this, "enableVisionDebug", true);
        /** @attribute @type {boolean} @title Enable Weapon Debug (Press W) */ _define_property(this, "enableWeaponDebug", true);
    }
}
_define_property(DebugManager, "scriptName", 'debugManager');

export { DebugManager };
