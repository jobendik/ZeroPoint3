///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/* global pc */

// WeaponSystemDebugger — surgical diagnostics for weaponSystem.js
// - Finds the weapon system instance (by attribute, by script scan, or by heuristic)
// - Verifies inventory map/entries (e.g., "pistol" → guards the common undefined errors)
// - Checks camera attachment (weapon container under the active camera)
// - Audits input handler bindings and event wiring
// - Adds safe console helpers: ws(), wsDbg(), wsSwitch(), wsPickup(), wsPrint(), wsAttach()

var WeaponSystemDebugger = pc.createScript('weaponSystemDebugger');

// ------------------------------ Attributes ------------------------------
WeaponSystemDebugger.attributes.add('playerEntity', {
    type: 'entity',
    title: 'Player (optional)',
    description: 'If not set, the debugger will search for the player automatically.'
});

WeaponSystemDebugger.attributes.add('weaponSystemScriptName', {
    type: 'string',
    default: 'weaponSystem',
    title: 'Weapon System Script Name',
    description: 'Script name used on the player (e.g., entity.script.weaponSystem).'
});

WeaponSystemDebugger.attributes.add('weaponInputHandlerName', {
    type: 'string',
    default: 'weaponInputHandler',
    title: 'Weapon Input Handler Script Name'
});

WeaponSystemDebugger.attributes.add('expectedWeaponKeys', {
    type: 'string',
    array: true,
    default: ['pistol', 'rifle', 'shotgun'],
    title: 'Expected weapon keys'
});

WeaponSystemDebugger.attributes.add('cameraEntity', {
    type: 'entity',
    title: 'Camera (optional)',
    description: 'If not set, the active camera will be detected at runtime.'
});

WeaponSystemDebugger.attributes.add('weaponContainerName', {
    type: 'string',
    default: 'WeaponContainer',
    title: 'Weapon Container Child Name',
    description: 'Child under the camera that should hold the current weapon model.'
});

WeaponSystemDebugger.attributes.add('delayedChecksMs', {
    type: 'number',
    default: 800,
    title: 'Delayed Checks (ms)'
});

WeaponSystemDebugger.attributes.add('autoAttachIfMissing', {
    type: 'boolean',
    default: false,
    title: 'Auto-Create Missing Weapon Container'
});

// ------------------------------ Initialize ------------------------------
WeaponSystemDebugger.prototype.initialize = function () {
    try {
        this.info = {
            startedAt: new Date().toISOString(),
            errors: [],
            notes: [],
            wsFoundOn: null,
            wsKeys: [],
            inputFoundOn: null,
            camera: null,
            weaponContainer: null
        };

        // expose quickly
        window.wsDbg = this;
        window.ws = () => this._ws() || null;

        this._installErrorTrap();

        this._note('WeaponSystemDebugger starting…');

        // Find player & weapon system
        this._player = this.playerEntity || this._findLikelyPlayer();
        if (!this._player) this._warn('Player not found. Set "playerEntity" attribute for deterministic results.');

        this._wsEntity = this._findWeaponSystemEntity();
        this._inputEntity = this._findInputEntity();

        // Find camera & container
        this._cam = this.cameraEntity || this._detectActiveCamera();
        if (!this._cam) this._warn('Active camera not found.');

        // DON'T audit immediately - scripts might still be initializing
        // Instead, audit in postInitialize() when everything is ready
        
        // Second pass after other scripts likely finish init
        setTimeout(() => {
            try {
                this._note('Running delayed checks…');
                this._auditWeaponInventory();
                this._auditSwitchSafety();
                this._auditEvents();
                this._summary();
            } catch (e) { this._err('delayedChecks', e); }
        }, Math.max(200, this.delayedChecksMs || 800));

        // Console helpers (non-throwing)
        this._installConsoleHelpers();

        this._note('WeaponSystemDebugger ready.');
    } catch (e) {
        this._err('initializeTop', e);
        console.error('[WeaponSystemDebugger] initialize failed safely:', e);
    }
};

// ------------------------------ Post Initialize ------------------------------
WeaponSystemDebugger.prototype.postInitialize = function() {
    try {
        this._note('postInitialize: Auditing after all scripts initialized...');
        
        // Now it's safe to audit - all scripts have initialized
        this._auditWeaponSystemBasics();
        this._auditInputHandlerBasics();
        this._auditCameraAttachment();
    } catch (e) {
        this._err('postInitialize', e);
        console.error('[WeaponSystemDebugger] postInitialize failed safely:', e);
    }
};

// ------------------------------ Error handling ------------------------------
WeaponSystemDebugger.prototype._installErrorTrap = function () {
    const self = this;
    const origErr = console.error;
    console.error = function () {
        try { self.info.errors.push({ type: 'console.error', args: Array.from(arguments), t: Date.now() }); }
        catch (_) {}
        return origErr.apply(console, arguments);
    };
};

WeaponSystemDebugger.prototype._err = function (where, e) {
    this.info.errors.push({ where, msg: e && (e.message || String(e)), stack: e && e.stack || null, t: Date.now() });
};

WeaponSystemDebugger.prototype._note = function (msg) {
    this.info.notes.push({ msg, t: Date.now() });
    console.log('[WeaponSystemDebugger]', msg);
};

WeaponSystemDebugger.prototype._warn = function (msg) {
    this.info.notes.push({ warn: msg, t: Date.now() });
    console.warn('[WeaponSystemDebugger]', msg);
};

// ------------------------------ Finders ------------------------------
WeaponSystemDebugger.prototype._findLikelyPlayer = function () {
    // Heuristics: names commonly used
    const names = ['Player', 'FPSPlayer', 'LocalPlayer', 'PlayerRoot'];
    for (let i = 0; i < names.length; i++) {
        const e = this.app.root.findByName && this.app.root.findByName(names[i]);
        if (e) return e;
    }
    // Fallback: any entity with the weapon system script
    const hit = this._scanForScript(this.weaponSystemScriptName);
    return hit ? hit.entity : null;
};

WeaponSystemDebugger.prototype._findWeaponSystemEntity = function () {
    if (this._player && this._hasScript(this._player, this.weaponSystemScriptName)) {
        this.info.wsFoundOn = this._player.name;
        return this._player;
    }
    const hit = this._scanForScript(this.weaponSystemScriptName);
    if (hit) {
        this.info.wsFoundOn = hit.entity.name;
        return hit.entity;
    }
    this._warn(`No entity with script "${this.weaponSystemScriptName}" found.`);
    return null;
};

WeaponSystemDebugger.prototype._findInputEntity = function () {
    // Typically on the same player/camera hierarchy, but we’ll scan
    if (this._player && this._hasScript(this._player, this.weaponInputHandlerName)) return this._player;
    const cam = this.cameraEntity || this._detectActiveCamera();
    if (cam && this._hasScript(cam, this.weaponInputHandlerName)) return cam;
    const hit = this._scanForScript(this.weaponInputHandlerName);
    if (hit) return hit.entity;
    this._warn(`No entity with script "${this.weaponInputHandlerName}" found (optional but recommended).`);
    return null;
};

WeaponSystemDebugger.prototype._detectActiveCamera = function () {
    const cams = [];
    this.app.root.find(function (e) { if (e.camera) cams.push(e); return false; });
    const act = cams.find(e => e.enabled && e.camera.enabled);
    if (act) return act;
    return cams[0] || null;
};

WeaponSystemDebugger.prototype._scanForScript = function (scriptName) {
    let found = null;
    this.app.root.find(function (e) {
        if (e.script && e.script[scriptName]) { found = { entity: e, instance: e.script[scriptName] }; return true; }
        return false;
    });
    return found;
};

WeaponSystemDebugger.prototype._hasScript = function (e, name) {
    return !!(e && e.script && e.script[name]);
};

// ------------------------------ Core accessors ------------------------------
WeaponSystemDebugger.prototype._ws = function () {
    return (this._wsEntity && this._wsEntity.script && this._wsEntity.script[this.weaponSystemScriptName]) || null;
};

WeaponSystemDebugger.prototype._input = function () {
    return (this._inputEntity && this._inputEntity.script && this._inputEntity.script[this.weaponInputHandlerName]) || null;
};

// ------------------------------ Audits ------------------------------
WeaponSystemDebugger.prototype._auditWeaponSystemBasics = function () {
    const ws = this._ws();
    if (!ws) { this._warn('weaponSystem instance not found.'); return; }

    const keys = this._safeKeys(ws.weapons || ws.inventory || ws._weapons);
    this.info.wsKeys = keys;

    console.log('[WeaponSystemDebugger] weaponSystem found on:', this.info.wsFoundOn || '(unknown)');
    console.table({
        enabled: !!ws.enabled,
        initialized: !!ws._initialized,
        hasWeaponsMap: !!(ws.weapons || ws.inventory || ws._weapons),
        currentWeapon: (ws.currentWeapon && ws.currentWeapon.name) || ws.currentWeapon || null,
        isSwitching: !!ws._isSwitching,
        canFire: typeof ws.canFire === 'function',
        switchWeaponFn: typeof ws.switchWeapon === 'function'
    });

    if (!keys.length) {
        // Check if weaponSystem has finished initializing
        if (ws.__wsBooted) {
            // System is fully booted but no weapons - real problem!
            this._warn('Weapons map is empty after full initialization! This commonly precedes "Cannot read properties of undefined" errors in switchWeapon().');
        } else if (ws._initialized) {
            // System initialized but not booted yet - might be normal
            console.log('[WeaponSystemDebugger] Weapons map empty (postInitialize pending)');
        } else {
            // System not even initialized yet - definitely too early
            console.log('[WeaponSystemDebugger] Weapons map empty (initialization in progress)');
        }
    }
};

WeaponSystemDebugger.prototype._auditInputHandlerBasics = function () {
    const ih = this._input();
    if (!ih) { this._warn('weaponInputHandler not found (the system can still work, but no input hooks to switch/fire).'); return; }

    console.table({
        enabled: !!ih.enabled,
        initialized: !!ih._initialized,
        onWeaponSwitch: typeof ih.onWeaponSwitch === 'function',
        onFirePressed: typeof ih.onFirePressed === 'function',
        listensToApp: !!(ih.app && ih.app.on)
    });
};

WeaponSystemDebugger.prototype._auditCameraAttachment = function () {
    const cam = this._cam;
    if (!cam) { this._warn('No camera to audit.'); return; }

    let container = cam.findByName && cam.findByName(this.weaponContainerName);
    if (!container && this.autoAttachIfMissing) {
        container = new pc.Entity(this.weaponContainerName);
        container.setLocalPosition(0, 0, 0);
        cam.addChild(container);
        this._note(`Created missing weapon container "${this.weaponContainerName}" under camera "${cam.name}".`);
    }

    this.info.camera = cam.name;
    this.info.weaponContainer = container ? container.name : null;

    console.log('[WeaponSystemDebugger] Camera audit:', {
        cameraName: cam.name,
        hasWeaponContainer: !!container,
        containerPath: container ? this._path(container) : '(none)'
    });

    if (!container) {
        this._warn(`Weapon container "${this.weaponContainerName}" is missing under camera "${cam.name}". If models are attached elsewhere, update the "weaponContainerName" attribute.`);
    }
};

WeaponSystemDebugger.prototype._auditWeaponInventory = function () {
    const ws = this._ws();
    if (!ws) return;

    const map = ws.weapons || ws.inventory || ws._weapons || {};
    const keys = this._safeKeys(map);
    const expected = (this.expectedWeapons && this.expectedWeapons.keys) || [];

    console.log('[WeaponSystemDebugger] Inventory keys:', keys);
    if (expected.length) {
        expected.forEach(k => {
            if (!map[k]) this._warn(`Expected weapon key "${k}" is missing in the weapons map.`);
        });
    }

    // Inspect each entry - check both data AND visual models
    keys.forEach(k => {
        const w = map[k];
        const hasModel = !!(ws.weaponModels && ws.weaponModels[k]);
        const modelName = hasModel ? ws.weaponModels[k].name : '(not assigned)';
        
        console.log(`[WeaponSystemDebugger] "${k}" →`, {
            hasData: !!w,
            ammo: w && (w.ammo !== undefined ? w.ammo : '(n/a)'),
            magazine: w && (w.magazine !== undefined ? w.magazine : '(n/a)'),
            unlocked: w && (w.unlocked !== undefined ? !!w.unlocked : '(n/a)'),
            hasModelEntity: hasModel,
            modelName: modelName
        });
        
        if (!hasModel) {
            console.warn(`[WeaponSystemDebugger] ⚠️ "${k}" has data but no visual model entity assigned.`);
        }
    });
};

WeaponSystemDebugger.prototype._auditSwitchSafety = function () {
    // Probes the most common failure: calling switchWeapon('pistol') when the map is undefined or lacks the key
    const ws = this._ws();
    if (!ws || typeof ws.switchWeapon !== 'function') return;

    const map = ws.weapons || ws.inventory || ws._weapons || {};
    const testKey = (this.expectedWeapons && this.expectedWeapons.keys && this.expectedWeapons.keys[0]) || 'pistol';

    if (!map || !map[testKey]) {
        this._warn(
            `Switch safety: weapons map missing "${testKey}". Calling switchWeapon("${testKey}") would throw ` +
            `"Cannot read properties of undefined (reading '${testKey}')".`
        );
    }
};

WeaponSystemDebugger.prototype._auditEvents = function () {
    // Listen to common events if the app emits them (harmless if unused)
    const app = this.app;
    const log = (evt) => (...args) => console.log(`[WS-Event] ${evt}`, ...args);

    const events = [
        'weapon:pickup', 'weapon:equipped', 'weapon:unequipped',
        'weapon:switch', 'weapon:fire', 'weapon:reload',
        'ammo:changed', 'weapon:error'
    ];
    events.forEach(e => app.off(e)); // avoid duplicate listeners if script hot-reloads
    events.forEach(e => app.on(e, log(e), this));
};

// ------------------------------ Helpers ------------------------------
WeaponSystemDebugger.prototype._safeKeys = function (obj) {
    try { return Object.keys(obj || {}); } catch (_) { return []; }
};

WeaponSystemDebugger.prototype._path = function (e) {
    const names = [];
    let cur = e;
    while (cur) { names.unshift(cur.name || '(unnamed)'); cur = cur.parent; }
    return names.join(' / ');
};

// ------------------------------ Console helpers ------------------------------
// All helpers are null-safe; they won’t throw if something is missing.
WeaponSystemDebugger.prototype._installConsoleHelpers = function () {
    const self = this;

    // Show a compact snapshot
    window.wsPrint = function () {
        const ws = self._ws();
        const ih = self._input();
        const map = (ws && (ws.weapons || ws.inventory || ws._weapons)) || {};
        const keys = self._safeKeys(map);
        console.log('[wsPrint] weaponSystem:', {
            on: self.info.wsFoundOn, enabled: !!(ws && ws.enabled), initialized: !!(ws && ws._initialized),
            currentWeapon: ws && (ws.currentWeapon && ws.currentWeapon.name || ws.currentWeapon) || null,
            keys
        });
        if (keys.length) {
            try { console.table(keys.map(k => ({ key: k, hasRef: !!(map[k] && (map[k].entity || map[k].model)), ammo: map[k] && map[k].ammo }))); }
            catch (_) { console.log(map); }
        }
        console.log('[wsPrint] inputHandler:', {
            on: ih && ih.entity && ih.entity.name || '(none)',
            enabled: !!(ih && ih.enabled)
        });
        return { ws, ih, keys };
    };

    // Attempt a safe switch (guards against missing map/keys)
    window.wsSwitch = function (key) {
        const ws = self._ws();
        if (!ws) return console.warn('[wsSwitch] weaponSystem not found.');
        if (typeof ws.switchWeapon !== 'function') return console.warn('[wsSwitch] switchWeapon() not available.');
        const map = ws.weapons || ws.inventory || ws._weapons || {};
        if (!map[key]) return console.warn(`[wsSwitch] Key "${key}" not in weapons map. Available: ${Object.keys(map).join(', ')}`);
        console.log('[wsSwitch] Switching to', key);
        try { ws.switchWeapon(key); } catch (e) { console.error('[wsSwitch] switchWeapon threw:', e); }
    };

    // Simulate a pickup event (if your system listens on app)
    window.wsPickup = function (key) {
        if (!key) return console.warn('[wsPickup] Provide a weapon key, e.g., wsPickup("pistol")');
        console.log('[wsPickup] Emitting weapon:pickup →', key);
        try { self.app.fire('weapon:pickup', { key, source: 'WeaponSystemDebugger' }); }
        catch (e) { console.error('[wsPickup] emit failed:', e); }
    };

    // Ensure camera has the weapon container; optionally create
    window.wsAttach = function () {
        const cam = self._cam || self._detectActiveCamera();
        if (!cam) return console.warn('[wsAttach] No camera found.');
        let c = cam.findByName && cam.findByName(self.weaponContainerName);
        if (!c) {
            c = new pc.Entity(self.weaponContainerName);
            c.setLocalPosition(0, 0, 0);
            cam.addChild(c);
            console.log(`[wsAttach] Created "${self.weaponContainerName}" under camera "${cam.name}".`);
        } else {
            console.log(`[wsAttach] Found weapon container "${c.name}" at`, self._path(c));
        }
        return c;
    };

    console.log('\n>>> WeaponSystemDebugger console helpers:');
    console.log('  ws()         → returns the weaponSystem instance (or null)');
    console.log('  wsDbg        → returns the debugger instance');
    console.log('  wsPrint()    → prints a compact snapshot of system & inventory');
    console.log('  wsSwitch(k)  → safely attempts switchWeapon("k")');
    console.log('  wsPickup(k)  → emits app event "weapon:pickup" for key k');
    console.log('  wsAttach()   → ensures camera has a weapon container child');
};

// ------------------------------ Final summary ------------------------------
WeaponSystemDebugger.prototype._summary = function () {
    const ws = this._ws();
    const ih = this._input();
    const map = (ws && (ws.weapons || ws.inventory || ws._weapons)) || {};
    const keys = this._safeKeys(map);

    console.log('='.repeat(56));
    console.log('WEAPON SYSTEM DEBUG SUMMARY');
    console.log('='.repeat(56));
    console.table({
        player: this._player ? this._player.name : '(none)',
        wsOn: this.info.wsFoundOn || '(none)',
        inputOn: (this._inputEntity && this._inputEntity.name) || '(none)',
        camera: (this._cam && this._cam.name) || '(none)',
        weaponContainer: this.info.weaponContainer || '(missing)',
        wsEnabled: !!(ws && ws.enabled),
        wsInitialized: !!(ws && ws._initialized),
        currentWeapon: ws && (ws.currentWeapon && ws.currentWeapon.name || ws.currentWeapon) || null,
        weaponKeys: keys.join(', ')
    });

    if (!keys.length) {
        this._warn('No weapons registered. Verify preload/creation order and where the map is populated.');
    }
    const expected = (this.expectedWeapons && this.expectedWeapons.keys) || [];
    expected.forEach(k => { if (!map[k]) this._warn(`Expected key "${k}" not present.`); });

    if (ws && typeof ws.switchWeapon !== 'function') {
        this._warn('weaponSystem.switchWeapon() is missing. Did the refactor rename it?');
    }
};
