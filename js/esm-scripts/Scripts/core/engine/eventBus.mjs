import { Script } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from './logger.mjs';

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
class EventBus extends Script {
    // ============================================================================
    // SIMPLE EVENT SYSTEM - GAMEMANAGER COORDINATION
    // ============================================================================
    initialize() {
        // Import Logger if available, otherwise fallback to console
        if (typeof Logger !== 'undefined') {
            Logger.debug('[EventBus] Initializing minimal event system...');
        } else {
            Logger.debug('[EventBus] Initializing minimal event system...');
        }
        // Make globally accessible for GameManager system only
        this.app.eventBus = this;
        if (typeof window !== 'undefined') {
            window.eventBus = this;
        }
        // Simple event tracking for debugging
        this.eventCount = 0;
        this.debugMode = false; // Set to true for debugging
        if (typeof Logger !== 'undefined') {
            Logger.debug('[EventBus] Ready - Use app.fire() for most events');
        } else {
            Logger.debug('[EventBus] Ready - Use app.fire() for most events');
        }
    }
    // ============================================================================
    // CONVENIENCE METHODS FOR GAMEMANAGER SYSTEM
    // ============================================================================
    emit(eventName, data) {
        this.eventCount++;
        // Use Logger if available, otherwise fallback
        if (typeof Logger !== 'undefined') {
            Logger.debug(`[EventBus] ${eventName}`, data);
        } else if (this.debugMode) {
            Logger.debug(`[EventBus] ${eventName}`, data);
        }
        // Just delegate to PlayCanvas event system
        this.app.fire(eventName, data);
        return this;
    }
    on(eventName, callback, scope) {
        this.app.on(eventName, callback, scope);
        return this;
    }
    off(eventName, callback, scope) {
        this.app.off(eventName, callback, scope);
        return this;
    }
    once(eventName, callback, scope) {
        this.app.once(eventName, callback, scope);
        return this;
    }
    // ============================================================================
    // GAMEMANAGER-SPECIFIC CONVENIENCE METHODS
    // ============================================================================
    requestStateChange(newState, reason) {
        return this.emit('game:stateChangeRequest', {
            newState: newState,
            reason: reason
        });
    }
    notifySessionEnded(stats) {
        return this.emit('game:sessionEnded', {
            stats: stats
        });
    }
    notifyPlayerRegistered(player) {
        return this.emit('game:playerRegistered', player);
    }
    // ============================================================================
    // DEBUG UTILITIES
    // ============================================================================
    enableDebug() {
        this.debugMode = true;
        if (typeof Logger !== 'undefined') {
            Logger.debug('[EventBus] Debug mode enabled');
        } else {
            Logger.debug('[EventBus] Debug mode enabled');
        }
    }
    disableDebug() {
        this.debugMode = false;
        if (typeof Logger !== 'undefined') {
            Logger.debug('[EventBus] Debug mode disabled');
        } else {
            Logger.debug('[EventBus] Debug mode disabled');
        }
    }
    getStats() {
        return {
            eventCount: this.eventCount,
            debugMode: this.debugMode
        };
    }
    // ============================================================================
    // DEBUG SYSTEM INTEGRATION
    // ============================================================================
    // Debug event emissions for DebugManager and VisualDebugger
    emitDebugEvent(type, message, level = 'info', data = null) {
        return this.emit('debug:event', {
            type: type,
            message: message,
            level: level,
            data: data,
            timestamp: Date.now()
        });
    }
    emitSystemError(system, error, context = null) {
        return this.emit('system:error', {
            system: system,
            error: error,
            context: context,
            timestamp: Date.now()
        });
    }
    emitSystemWarning(system, warning, context = null) {
        return this.emit('system:warning', {
            system: system,
            warning: warning,
            context: context,
            timestamp: Date.now()
        });
    }
    emitPerformanceMetric(metric, value, unit = '') {
        return this.emit('performance:metric', {
            metric: metric,
            value: value,
            unit: unit,
            timestamp: Date.now()
        });
    }
    emitSystemHealthUpdate(system, status, details = null) {
        return this.emit('system:health', {
            system: system,
            status: status,
            details: details,
            timestamp: Date.now()
        });
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (typeof Logger !== 'undefined') {
            Logger.debug('[EventBus] Shutting down...');
        } else {
            Logger.debug('[EventBus] Shutting down...');
        }
        // Clear references
        if (this.app.eventBus === this) {
            this.app.eventBus = null;
        }
        if (typeof window !== 'undefined' && window.eventBus === this) {
            window.eventBus = null;
        }
    }
}
_define_property(EventBus, "scriptName", 'eventBus');

export { EventBus };
