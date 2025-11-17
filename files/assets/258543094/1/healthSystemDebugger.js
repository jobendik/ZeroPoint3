/* global pc */

// HealthSystemDebugger — focused diagnostics for healthSystem.js
// Audits:
//  - Instance discovery & readiness (initialize flags, isReady(), guards)
//  - Attributes & live state (current/max health, dead/invincible/respawning)
//  - Event wiring (health:request:*, damage:request:*, entity:*)
//  - Timers & frame damage queue (pendingDamage, frame counters)
//  - Player/AI integration hooks (playerController/aiAgent calls)
//  - UI binding (healthBar)
// Console helpers:
//  hs()         → HealthSystem instance (or null)
//  hsDbg        → Debugger instance
//  hsPrint()    → Snapshot of key state
//  hsDamage(n[, attackerEnt]) → Safely apply damage
//  hsHeal(n)    → Safely heal
//  hsReset()    → Reset health (respawn-safe)
//  hsFire(evt, payload) → Fire any health-related app event with targeting
//  hsListen()   → Attach verbose listeners for emitted events
//  hsUnlisten() → Remove verbose listeners

var HealthSystemDebugger = pc.createScript('healthSystemDebugger');

// ------------------------------ Attributes ------------------------------
HealthSystemDebugger.attributes.add('targetEntity', {
    type: 'entity',
    title: 'Target entity (optional)',
    description: 'If not set, the debugger tries to locate an entity with healthSystem.'
});

HealthSystemDebugger.attributes.add('healthScriptName', {
    type: 'string',
    default: 'healthSystem',
    title: 'Health script name on the entity'
});

HealthSystemDebugger.attributes.add('delayedChecksMs', {
    type: 'number',
    default: 800,
    title: 'Delayed checks (ms)'
});

HealthSystemDebugger.attributes.add('autoAttachListeners', {
    type: 'boolean',
    default: true,
    title: 'Auto-attach verbose listeners for emitted events'
});

// ------------------------------ Initialize ------------------------------
HealthSystemDebugger.prototype.initialize = function () {
    try {
        this.info = {
            startedAt: new Date().toISOString(),
            errors: [],
            notes: [],
            hsOn: null,
            timers: {},
            listenersAttached: false
        };

        // Quick global handles
        window.hsDbg = this;
        window.hs = () => this._hs() || null;

        this._installErrorTrap();
        this._note('HealthSystemDebugger starting…');

        // Locate entity & system
        this._entity = this.targetEntity || this._findEntityWithHealth();
        if (!this._entity) this._warn('No entity with healthSystem found. Set "targetEntity" for deterministic results.');
        this._hsEntityName = this._entity ? this._entity.name : '(none)';

        // Immediate audits (non-throwing)
        this._auditBasics();
        this._auditGuards();
        this._auditIntegrations();
        this._auditUIBinding();

        // Optional verbose listeners (entity:damaged, entity:died, player:healthChanged, debug:damage)
        if (this.autoAttachListeners) this._attachVerboseListeners();

        // Delayed second pass after most scripts finish init
        const delay = Math.max(200, this.delayedChecksMs || 800);
        setTimeout(() => {
            try {
                this._note('Running delayed checks…');
                this._auditInventoryAndQueue();
                this._auditEventWiring();
                this._summary();
            } catch (e) { this._err('delayedChecks', e); }
        }, delay);

        // Console helpers
        this._installConsoleHelpers();

        this._note('HealthSystemDebugger ready.');
    } catch (e) {
        this._err('initializeTop', e);
        console.error('[HealthSystemDebugger] initialize failed safely:', e);
    }
};

// ------------------------------ Error handling ------------------------------
HealthSystemDebugger.prototype._installErrorTrap = function () {
    const self = this;
    const origErr = console.error;
    console.error = function () {
        try { self.info.errors.push({ type: 'console.error', args: Array.from(arguments), t: Date.now() }); }
        catch (_) {}
        return origErr.apply(console, arguments);
    };
};

HealthSystemDebugger.prototype._err = function (where, e) {
    this.info.errors.push({ where, msg: e && (e.message || String(e)), stack: e && e.stack || null, t: Date.now() });
};

HealthSystemDebugger.prototype._note = function (msg) {
    this.info.notes.push({ msg, t: Date.now() });
    console.log('[HealthSystemDebugger]', msg);
};

HealthSystemDebugger.prototype._warn = function (msg) {
    this.info.notes.push({ warn: msg, t: Date.now() });
    console.warn('[HealthSystemDebugger]', msg);
};

// ------------------------------ Finders & accessors ------------------------------
HealthSystemDebugger.prototype._findEntityWithHealth = function () {
    let hit = null;
    const nameHints = ['Player', 'FPSPlayer', 'LocalPlayer', 'Enemy', 'Bot', 'AI'];
    // Try hinted names first
    for (let i = 0; i < nameHints.length; i++) {
        const e = this.app.root.findByName && this.app.root.findByName(nameHints[i]);
        if (e && e.script && e.script[this.healthScriptName]) return e;
    }
    // Fallback: generic scan
    this.app.root.find((e) => {
        if (e.script && e.script[this.healthScriptName]) { hit = e; return true; }
        return false;
    });
    return hit;
};

HealthSystemDebugger.prototype._hs = function () {
    const e = this._entity;
    return (e && e.script && e.script[this.healthScriptName]) || null;
};

// ------------------------------ Audits ------------------------------
HealthSystemDebugger.prototype._auditBasics = function () {
    const hs = this._hs();
    if (!hs) { this._warn('healthSystem instance not found on the selected entity.'); return; }

    this.info.hsOn = this._entity.name;

    // Attributes & core state
    const snapshot = {
        onEntity: this._entity.name,
        enabled: !!hs.enabled,
        initialized: !!hs._initialized,
        isReadyFn: typeof hs.isReady === 'function' ? hs.isReady() : '(no isReady())',
        currentHealth: hs.currentHealth,
        maxHealth: hs.maxHealth,
        isDead: !!hs.isDead,
        isInvincible: !!hs.isInvincible,
        isRespawning: !!hs.isRespawning,
        lastDamageTime: hs.lastDamageTime || 0,
        pendingDamageSize: hs.pendingDamage && hs.pendingDamage.size || 0,
        hasProcessAccum: typeof hs.processAccumulatedDamage === 'function',
        hasTakeDamage: typeof hs.takeDamage === 'function',
        hasHeal: typeof hs.heal === 'function',
        hasReset: typeof hs.resetHealth === 'function'
    };
    try { console.table(snapshot); } catch (_) { console.log(snapshot); }

    if (hs.maxHealth <= 0) this._warn('maxHealth <= 0 — all damage becomes lethal.');
    if (hs.currentHealth == null) this._warn('currentHealth is null/undefined — check initialize path and startingHealth attribute.');
};

HealthSystemDebugger.prototype._auditGuards = function () {
    const hs = this._hs();
    if (!hs) return;

    // Common reasons damage gets ignored
    const guards = {
        entityEnabled: !!(this._entity && this._entity.enabled),
        scriptEnabled: !!hs.enabled,
        isBeingDestroyed: !!hs.isBeingDestroyed,
        isRespawning: !!hs.isRespawning,
        isDead: !!hs.isDead,
        invincibilityTime: hs.invincibilityTime,
        nowMinusLastDamage: (performance.now() / 1000) - (hs.lastDamageTime || 0)
    };
    console.log('[HealthSystemDebugger] Guard snapshot:', guards);

    if (!guards.entityEnabled) this._warn('Entity is disabled — damage/heal requests will be ignored.');
    if (guards.isBeingDestroyed) this._warn('Entity is being destroyed — all requests ignored by design.');
    if (guards.isRespawning) this._note('Entity is in respawn guard window — damage will be ignored.');
    if (guards.isDead) this._note('Entity is dead — damage ignored, reset required.');
};

HealthSystemDebugger.prototype._auditIntegrations = function () {
    const hs = this._hs();
    if (!hs) return;

    const integrations = {
        isAI: !!hs.isAI,
        isPlayer: !!hs.isPlayer,
        hasAiAgent: !!hs.aiAgent,
        hasPlayerController: !!hs.playerController
    };
    console.log('[HealthSystemDebugger] Integrations:', integrations);
};

HealthSystemDebugger.prototype._auditUIBinding = function () {
    const hs = this._hs();
    if (!hs) return;

    const ui = {
        hasHealthBarEntity: !!hs.healthBarEntity,
        elementWidthBacked: !!(hs.healthBarEntity && hs.healthBarEntity.element),
        renderScaleBacked: !!(hs.healthBarEntity && hs.healthBarEntity.render)
    };
    console.log('[HealthSystemDebugger] UI binding:', ui);

    if (hs.healthBarEntity && !ui.elementWidthBacked && !ui.renderScaleBacked) {
        this._warn('healthBarEntity is set but has neither element nor render; updateHealthBar will be a no-op.');
    }
};

HealthSystemDebugger.prototype._auditInventoryAndQueue = function () {
    const hs = this._hs();
    if (!hs) return;

    const frameData = {
        currentFrame: hs.currentFrame,
        lastProcessedFrame: hs.lastProcessedFrame,
        pendingDamageSize: hs.pendingDamage && hs.pendingDamage.size || 0,
        lastAttacker: hs.lastAttacker ? (hs.lastAttacker.name || hs.lastAttacker.getGuid && hs.lastAttacker.getGuid().slice(0, 8)) : null
    };
    console.log('[HealthSystemDebugger] Frame/queue:', frameData);

    if (frameData.pendingDamageSize > 0 && hs.lastProcessedFrame === hs.currentFrame) {
        this._note('Pending damage exists but this frame already processed — will roll to next frame.');
    }
};

HealthSystemDebugger.prototype._auditEventWiring = function () {
    // Can’t introspect app listeners directly; instead we probe by firing NOOP-targeted requests and watching for errors.
    const hs = this._hs();
    if (!hs) return;

    // Probes (should not change target’s health because target mismatches)
    const safeTarget = { targetId: 'DOES_NOT_MATCH' };
    try {
        this.app.fire('health:request:apply', Object.assign({ amount: 1 }, safeTarget));
        this.app.fire('health:request:reset', Object.assign({}, safeTarget));
        this.app.fire('damage:request:apply', Object.assign({ damage: 1 }, safeTarget));
        this._note('Event wiring probes emitted (no target match). If errors appear, handlers may be misbound.');
    } catch (e) {
        this._err('eventProbe', e);
        this._warn('Error during event probe — check _setupEventListeners() in healthSystem.');
    }
};

// ------------------------------ Listeners for emitted events ------------------------------
HealthSystemDebugger.prototype._attachVerboseListeners = function () {
    if (this.info.listenersAttached) return;
    const log = (evt) => (...args) => console.log(`[HS-EMIT] ${evt}`, ...args);

    this.app.on('entity:damaged', log('entity:damaged'), this);
    this.app.on('entity:died', log('entity:died'), this);
    this.app.on('player:healthChanged', log('player:healthChanged'), this);
    this.app.on('debug:damage', log('debug:damage'), this);

    this.info.listenersAttached = true;
    this._note('Verbose listeners attached for emitted events.');
};

HealthSystemDebugger.prototype._detachVerboseListeners = function () {
    if (!this.info.listenersAttached) return;

    this.app.off('entity:damaged', null, this);
    this.app.off('entity:died', null, this);
    this.app.off('player:healthChanged', null, this);
    this.app.off('debug:damage', null, this);

    this.info.listenersAttached = false;
    this._note('Verbose listeners detached.');
};

// ------------------------------ Console helpers ------------------------------
HealthSystemDebugger.prototype._installConsoleHelpers = function () {
    const self = this;

    // Compact snapshot
    window.hsPrint = function () {
        const hs = self._hs();
        if (!hs) { console.warn('[hsPrint] No healthSystem found.'); return null; }
        const snap = {
            onEntity: self._entity && self._entity.name,
            enabled: !!hs.enabled,
            initialized: !!hs._initialized,
            ready: typeof hs.isReady === 'function' ? hs.isReady() : '(no isReady())',
            currentHealth: hs.currentHealth,
            maxHealth: hs.maxHealth,
            isDead: !!hs.isDead,
            isInvincible: !!hs.isInvincible,
            isRespawning: !!hs.isRespawning,
            pendingDamageSize: hs.pendingDamage && hs.pendingDamage.size || 0
        };
        console.table(snap);
        return hs;
    };

    // Safely apply damage (bypasses request guards for direct testing)
    window.hsDamage = function (amount, attackerEntity) {
        const hs = self._hs();
        if (!hs) return console.warn('[hsDamage] No healthSystem found.');
        const n = Number(amount) || 1;
        try {
            if (typeof hs.takeDamage === 'function') {
                console.log(`[hsDamage] takeDamage(${n})`);
                hs.takeDamage(n, attackerEntity || null);
            } else {
                console.warn('[hsDamage] healthSystem.takeDamage() not found.');
            }
        } catch (e) {
            console.error('[hsDamage] takeDamage threw:', e);
        }
    };

    // Safely heal
    window.hsHeal = function (amount) {
        const hs = self._hs();
        if (!hs) return console.warn('[hsHeal] No healthSystem found.');
        const n = Number(amount) || 1;
        try {
            if (typeof hs.heal === 'function') {
                console.log(`[hsHeal] heal(${n})`);
                hs.heal(n);
            } else {
                console.warn('[hsHeal] healthSystem.heal() not found.');
            }
        } catch (e) {
            console.error('[hsHeal] heal threw:', e);
        }
    };

    // Reset (respawn-safe)
    window.hsReset = function () {
        const hs = self._hs();
        if (!hs) return console.warn('[hsReset] No healthSystem found.');
        try {
            if (typeof hs.resetHealth === 'function') {
                console.log('[hsReset] resetHealth()');
                hs.resetHealth();
            } else {
                console.warn('[hsReset] healthSystem.resetHealth() not found.');
            }
        } catch (e) {
            console.error('[hsReset] resetHealth threw:', e);
        }
    };

    // Fire health-related app events with automatic targeting to this entity
    window.hsFire = function (eventName, payload) {
        const hs = self._hs();
        if (!hs) return console.warn('[hsFire] No healthSystem found.');
        const target = {
            target: self._entity,                // direct match
            entity: self._entity,
            entityId: hs.entityId,              // id match
            entityName: hs.entityName           // name match
        };
        const data = Object.assign({}, payload || {}, target);
        console.log('[hsFire] app.fire("%s", data)', eventName, data);
        try { self.app.fire(eventName, data); } catch (e) { console.error('[hsFire] app.fire threw:', e); }
    };

    // Toggle verbose listeners
    window.hsListen = () => self._attachVerboseListeners();
    window.hsUnlisten = () => self._detachVerboseListeners();

    console.log('\n>>> HealthSystemDebugger console helpers:');
    console.log('  hs()             → returns the healthSystem instance');
    console.log('  hsDbg            → returns the debugger instance');
    console.log('  hsPrint()        → snapshot of core state');
    console.log('  hsDamage(n[,att])→ direct takeDamage test');
    console.log('  hsHeal(n)        → direct heal test');
    console.log('  hsReset()        → reset health/respawn');
    console.log('  hsFire(evt,pay)  → fire app event with proper target fields');
    console.log('  hsListen()/hsUnlisten() → attach/detach verbose emit logs');
};

// ------------------------------ Summary ------------------------------
HealthSystemDebugger.prototype._summary = function () {
    const hs = this._hs();
    const summary = {
        onEntity: this._entity ? this._entity.name : '(none)',
        found: !!hs,
        enabled: !!(hs && hs.enabled),
        initialized: !!(hs && hs._initialized),
        ready: hs && typeof hs.isReady === 'function' ? hs.isReady() : '(no isReady())',
        health: hs ? `${hs.currentHealth}/${hs.maxHealth}` : '(n/a)',
        dead: !!(hs && hs.isDead),
        invincible: !!(hs && hs.isInvincible),
        respawning: !!(hs && hs.isRespawning),
        pendingDamageSize: hs && hs.pendingDamage ? hs.pendingDamage.size : 0,
        hasHealthBarEntity: !!(hs && hs.healthBarEntity)
    };

    console.log('='.repeat(54));
    console.log('HEALTH SYSTEM DEBUG SUMMARY');
    console.log('='.repeat(54));
    try { console.table(summary); } catch (_) { console.log(summary); }

    if (hs && hs.pendingDamage && hs.pendingDamage.size === 0 && !hs.isDead && hs.currentHealth <= 0) {
        this._warn('Health is 0 but no death processed — check _applyDamageInternal / onDeath flow.');
    }
};
