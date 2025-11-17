import { Logger } from './logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/**
 * 🔔 SessionEvents - Session Event Handling and Notifications
 * 
 * Comprehensive event management system that handles all session-related
 * events and coordinates responses between core session logic and metrics
 * tracking systems.
 * 
 * Features:
 * - Centralized event listener management
 * - Entity lifecycle event handling (death, damage)
 * - Weapon and combat event processing
 * - Item pickup and interaction events
 * - Session-specific event validation and filtering
 * - Event cleanup and memory management
 */ class SessionEvents {
    initialize() {
        if (this.__sessionEventsReady) {
            this._log('debug', '[SessionEvents] Already initialized, skipping...');
            return;
        }
        this._log('gameState', '[SessionEvents] Initializing...');
        this.__sessionEventsReady = true;
        this._log('gameState', '[SessionEvents] Initialized successfully');
    }
    isReady() {
        return this.__sessionEventsReady === true;
    }
    // ============================================================================
    // EVENT LISTENER MANAGEMENT
    // ============================================================================
    setupEvents() {
        Logger.debug('[SessionEvents] 🎯 setupEvents() CALLED - Binding event listeners...');
        if (this._eventsBound) {
            Logger.debug('[SessionEvents] ⚠️ Events already bound, skipping');
            this._log('debug', '[SessionEvents] Events already setup, skipping duplicate setup');
            return;
        }
        this._eventsBound = true;
        // Bind all session-related events
        this.app.on('entity:died', this._onEntityDied, this);
        this.app.on('entity:damaged', this._onEntityDamaged, this);
        this.app.on('weapon:fired', this._onWeaponFired, this);
        this.app.on('item:picked_up', this._onItemPickedUp, this);
        this.app.on('footstep', this._onFootstep, this);
        this.app.on('weapon:switched', this._onWeaponSwitched, this);
        Logger.debug('[SessionEvents] ✅ Event listeners BOUND:', {
            'entity:died': '✓',
            'entity:damaged': '✓',
            'weapon:fired': '✓',
            'item:picked_up': '✓',
            'footstep': '✓',
            'weapon:switched': '✓'
        });
        this._log('debug', '[SessionEvents] Event listeners setup complete');
    }
    cleanupEvents() {
        if (!this._eventsBound) {
            return;
        }
        // Unbind all session-related events
        this.app.off('entity:died', this._onEntityDied, this);
        this.app.off('entity:damaged', this._onEntityDamaged, this);
        this.app.off('weapon:fired', this._onWeaponFired, this);
        this.app.off('item:picked_up', this._onItemPickedUp, this);
        this.app.off('footstep', this._onFootstep, this);
        this.app.off('weapon:switched', this._onWeaponSwitched, this);
        this._eventsBound = false;
        this._log('debug', '[SessionEvents] Event listeners cleaned up');
    }
    // ============================================================================
    // SESSION STATE VALIDATION
    // ============================================================================
    _isSessionActive() {
        const sessionInfo = this.sessionCore.getSessionInfo();
        return sessionInfo.isActive && !sessionInfo.isEnding && !sessionInfo.hasEnded;
    }
    _shouldProcessEvent(eventName) {
        if (!this._isSessionActive()) {
            this._log('debug', `[SessionEvents] Ignoring ${eventName} - session not active`);
            return false;
        }
        return true;
    }
    // ============================================================================
    // ENTITY LIFECYCLE EVENT HANDLERS
    // ============================================================================
    _onEntityDied(data) {
        Logger.debug('[SessionEvents] ✅ entity:died EVENT RECEIVED!', {
            entity: data?.entity?.name,
            attacker: data?.attacker?.name,
            isHeadshot: data?.isHeadshot,
            isSessionActive: this._isSessionActive()
        });
        if (!this._shouldProcessEvent('entity:died')) {
            Logger.debug('[SessionEvents] ❌ entity:died REJECTED - session not active');
            return;
        }
        const entity = data.entity;
        let entityId = null;
        try {
            entityId = entity ? entity.getGuid() : null;
        } catch (e) {
            this._log('debug', '[SessionEvents] Cannot get entity ID - entity destroyed');
            return;
        }
        // Delegate to SessionCore for entity death processing
        const deathProcessed = this.sessionCore.handleEntityDeath(entityId, entity);
        if (!deathProcessed) {
            Logger.debug('[SessionEvents] ❌ entity:died REJECTED - already processed');
            return; // Death was already processed or invalid
        }
        // Update metrics
        this.sessionMetrics.recordEntityDeath(data);
        Logger.debug('[SessionEvents] ✅ entity:died RECORDED IN METRICS');
        // 💀 HEADSHOT SYSTEM: Fire headshot:confirmed event if this was a headshot kill
        if (data.isHeadshot && data.attacker) {
            const headshotData = {
                victim: entity,
                victimId: entityId,
                attacker: data.attacker,
                attackerId: data.attacker.getGuid(),
                timestamp: Date.now()
            };
            this.app.fire('headshot:confirmed', headshotData);
            Logger.debug('[SessionEvents] 💀 headshot:confirmed EVENT FIRED!', headshotData);
        }
        this._log('debug', `[SessionEvents] Entity death processed: ${entity.name || 'Unknown'}${data.isHeadshot ? ' (HEADSHOT)' : ''}`);
    }
    _onEntityDamaged(data) {
        Logger.debug('[SessionEvents] ✅ entity:damaged EVENT RECEIVED!', {
            entity: data?.entity?.name,
            damage: data?.damage,
            attacker: data?.attacker?.name,
            isSessionActive: this._isSessionActive()
        });
        if (!this._shouldProcessEvent('entity:damaged')) {
            Logger.debug('[SessionEvents] ❌ entity:damaged REJECTED - session not active');
            return;
        }
        if (!data || !data.entity) {
            this._log('debug', '[SessionEvents] Invalid damage event data, ignoring');
            return;
        }
        // Validate entity can take damage through SessionCore
        if (!this.sessionCore.canEntityTakeDamage(data.entity)) {
            const entityName = data.entity && data.entity.name ? data.entity.name : 'Unknown';
            this._log('debug', `Entity ${entityName} cannot take damage in current state, ignoring damage event`);
            return;
        }
        // Update metrics
        this.sessionMetrics.recordEntityDamage(data);
        Logger.debug('[SessionEvents] ✅ entity:damaged RECORDED IN METRICS');
        this._log('debug', `[SessionEvents] Entity damage processed: ${data.damage} to ${data.entity.name || 'Unknown'}`);
    }
    // ============================================================================
    // WEAPON AND COMBAT EVENT HANDLERS
    // ============================================================================
    _onWeaponFired(data) {
        Logger.debug('[SessionEvents] ✅ weapon:fired EVENT RECEIVED!', {
            shooter: data?.shooter?.name || data?.entity?.name,
            weapon: data?.weapon,
            isSessionActive: this._isSessionActive()
        });
        if (!this._shouldProcessEvent('weapon:fired')) {
            Logger.debug('[SessionEvents] ❌ weapon:fired REJECTED - session not active');
            return;
        }
        // ✅ FIXED: Accept both 'shooter' and 'entity' for backward compatibility
        const shooter = data?.shooter || data?.entity;
        if (!data || !shooter) {
            this._log('debug', `🔍 [SessionEvents] Invalid weapon fired event data, ignoring ${shooter ? 'valid' : 'null'}`, data);
            return;
        }
        // Update metrics
        this.sessionMetrics.recordWeaponFired(data);
        Logger.debug('[SessionEvents] ✅ weapon:fired RECORDED IN METRICS');
        this._log('debug', `[SessionEvents] Weapon fired event processed from ${shooter.name || 'Unknown'}`);
    }
    _onWeaponSwitched(data) {
        if (!this._shouldProcessEvent('weapon:switched')) {
            return;
        }
        // Update metrics
        this.sessionMetrics.recordWeaponSwitch(data);
        this._log('debug', `[SessionEvents] Weapon switch event processed`);
    }
    // ============================================================================
    // ITEM AND INTERACTION EVENT HANDLERS
    // ============================================================================
    _onItemPickedUp(data) {
        if (!this._shouldProcessEvent('item:picked_up')) {
            return;
        }
        if (!data || !data.picker) {
            this._log('debug', '[SessionEvents] Invalid item pickup event data, ignoring');
            return;
        }
        // Update metrics
        this.sessionMetrics.recordItemPickup(data);
        this._log('debug', `[SessionEvents] Item pickup event processed`);
    }
    // ============================================================================
    // MOVEMENT AND ACTIVITY EVENT HANDLERS
    // ============================================================================
    _onFootstep(data) {
        if (!this._shouldProcessEvent('footstep')) {
            return;
        }
        // Update metrics (footsteps are frequent, so we don't log each one)
        this.sessionMetrics.recordFootstep(data);
    }
    // ============================================================================
    // SESSION EVENT NOTIFICATIONS
    // ============================================================================
    fireSessionStarted() {
        this.app.fire('game:sessionStarted', {
            timestamp: performance.now()
        });
        this._log('gameState', '[SessionEvents] Session started event fired');
    }
    fireSessionEnded(stats, reason) {
        this.app.fire('game:sessionEnded', {
            stats: stats,
            reason: reason,
            timestamp: performance.now()
        });
        this._log('gameState', `[SessionEvents] Session ended event fired (reason: ${reason})`);
    }
    fireCountdownStarted(count) {
        this.app.fire('game:countdownStarted', {
            count: count,
            timestamp: performance.now()
        });
        this._log('debug', `[SessionEvents] Countdown started event fired (${count})`);
    }
    fireCountdownFinished() {
        this.app.fire('game:countdownFinished', {
            timestamp: performance.now()
        });
        this._log('debug', '[SessionEvents] Countdown finished event fired');
    }
    firePlayerKill(killData) {
        this.app.fire('game:playerKill', {
            ...killData,
            timestamp: performance.now()
        });
        this._log('debug', '[SessionEvents] Player kill event fired');
    }
    firePlayerDeath(deathData) {
        this.app.fire('game:playerDeath', {
            ...deathData,
            timestamp: performance.now()
        });
        this._log('debug', '[SessionEvents] Player death event fired');
    }
    fireAchievement(achievementData) {
        this.app.fire('game:achievement', {
            ...achievementData,
            timestamp: performance.now()
        });
        this._log('debug', `[SessionEvents] Achievement event fired: ${achievementData.type}`);
    }
    // ============================================================================
    // EVENT STATISTICS AND MONITORING
    // ============================================================================
    getEventStatistics() {
        return {
            eventsActive: this._eventsBound,
            sessionActive: this._isSessionActive(),
            lastProcessed: performance.now()
        };
    }
    // ============================================================================
    // ADVANCED EVENT HANDLING
    // ============================================================================
    processCustomEvent(eventName, eventData) {
        if (!this._shouldProcessEvent(eventName)) {
            return false;
        }
        this._log('debug', `[SessionEvents] Processing custom event: ${eventName}`);
        // Allow for extensible event processing
        switch(eventName){
            case 'session:pause':
                this._handleSessionPause(eventData);
                break;
            case 'session:resume':
                this._handleSessionResume(eventData);
                break;
            case 'session:milestone':
                this._handleSessionMilestone(eventData);
                break;
            default:
                this._log('debug', `[SessionEvents] Unknown custom event: ${eventName}`);
                return false;
        }
        return true;
    }
    _handleSessionPause(data) {
        this._log('debug', '[SessionEvents] Session pause event processed');
        this.app.fire('game:sessionPaused', {
            ...data,
            timestamp: performance.now()
        });
    }
    _handleSessionResume(data) {
        this._log('debug', '[SessionEvents] Session resume event processed');
        this.app.fire('game:sessionResumed', {
            ...data,
            timestamp: performance.now()
        });
    }
    _handleSessionMilestone(data) {
        this._log('debug', `[SessionEvents] Session milestone reached: ${data.milestone}`);
        this.app.fire('game:sessionMilestone', {
            ...data,
            timestamp: performance.now()
        });
        // Check for achievement conditions
        if (data.milestone === 'first_kill') {
            this.fireAchievement({
                type: 'first_kill',
                description: 'First Kill of the Session'
            });
        } else if (data.milestone === 'kill_streak_5') {
            this.fireAchievement({
                type: 'kill_streak',
                value: 5,
                description: '5 Kill Streak'
            });
        }
    }
    // ============================================================================
    // EVENT DEBUGGING AND DIAGNOSTICS
    // ============================================================================
    getEventBindings() {
        return {
            'entity:died': !!this._eventsBound,
            'entity:damaged': !!this._eventsBound,
            'weapon:fired': !!this._eventsBound,
            'item:picked_up': !!this._eventsBound,
            'footstep': !!this._eventsBound,
            'weapon:switched': !!this._eventsBound
        };
    }
    validateEventIntegrity() {
        const issues = [];
        if (!this.sessionCore) {
            issues.push('SessionCore reference missing');
        }
        if (!this.sessionMetrics) {
            issues.push('SessionMetrics reference missing');
        }
        if (!this.app) {
            issues.push('App reference missing');
        }
        if (this._eventsBound && !this._isSessionActive()) {
            issues.push('Events bound but session not active');
        }
        return issues;
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    cleanup() {
        this._log('debug', '[SessionEvents] Cleaning up...');
        this.cleanupEvents();
        this.__sessionEventsReady = false;
        this._log('debug', '[SessionEvents] Cleanup completed');
    }
    // Helper method
    _log(level, message, data = null) {
        if (typeof Logger !== 'undefined') {
            Logger[level](`[SessionEvents] ${message}`, data);
        } else {
            Logger.debug(`[SessionEvents] ${level.toUpperCase()}: ${message}`, data || '');
        }
    }
    constructor(app, sessionCore, sessionMetrics){
        this.app = app;
        this.sessionCore = sessionCore;
        this.sessionMetrics = sessionMetrics;
        // Event binding state
        this._eventsBound = false;
        // Initialization flag
        this.__sessionEventsReady = false;
    }
}

export { SessionEvents };
