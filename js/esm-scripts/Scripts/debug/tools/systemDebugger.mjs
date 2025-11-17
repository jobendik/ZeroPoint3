import * as playcanvasStable_min from '../../../../playcanvas-stable.min.mjs';
import { createScript, now, app, ScriptComponent, Entity } from '../../../../playcanvas-stable.min.mjs';

/* global pc */ // SystemDebugger: startup-safe, no-throw initialize, expanded diagnostics
var SystemDebugger = createScript('systemDebugger');
// ------------------------------ Config ------------------------------
SystemDebugger.attributes.add('delayedChecksMs', {
    type: 'number',
    default: 1200,
    title: 'Delayed checks (ms)'
});
SystemDebugger.attributes.add('traceScriptLifecycle', {
    type: 'boolean',
    default: true,
    title: 'Trace script lifecycle'
});
SystemDebugger.attributes.add('focusScriptNames', {
    type: 'json',
    title: 'Focus script names (array of strings)',
    schema: [
        {
            name: 'names',
            type: 'string',
            array: true
        }
    ],
    default: {
        names: [
            'gameManager',
            'uiManager',
            'gameSession'
        ]
    }
});
// ------------------------------ Initialize ------------------------------
SystemDebugger.prototype.initialize = function() {
    // Make absolutely sure we never throw from initialize
    try {
        this._bootTime = now ? now() : Date.now();
        this.debugInfo = {
            startedAt: new Date().toISOString(),
            scriptsFound: [],
            scriptsFailed: [],
            entitiesWithScripts: [],
            uiScreenStates: {},
            gameManagerEntity: null,
            gameManagerScripts: [],
            errors: [],
            lifecycleTrace: []
        };
        this._registry = this._safeGetRegistry();
        this._installErrorCatcher();
        this._installConsoleHelpers();
        if (this.traceScriptLifecycle) this._installLifecycleTracing();
        this._logHeader('SYSTEM DEBUGGER STARTING');
        this._findGameManager();
        this._checkUIScreens();
        this._scanScriptedEntities();
        this._checkForParsingErrors();
        // Extra environment checks
        this._checkEntityHierarchy();
        this._checkActivationChains();
        // Delayed second-pass (after most initializations)
        setTimeout(()=>{
            try {
                this._performDelayedChecks();
            } catch (e) {
                this._captureError('delayedChecks', e);
            }
        }, Math.max(200, this.delayedChecksMs || 1200));
        // Make accessible
        window.systemDebugger = this;
        this._logFooter('SYSTEM DEBUGGER READY');
    } catch (e) {
        // Last-resort guard: never let initialize crash
        try {
            this._captureError('initializeTop', e);
        } catch (_) {}
        // Still expose a minimal handle for inspection
        window.systemDebugger = window.systemDebugger || {
            crash: e,
            debugInfo: this && this.debugInfo || {}
        };
        console.error('[SystemDebugger] initialize failed safely:', e);
    }
};
// ------------------------------ Internals ------------------------------
SystemDebugger.prototype._safeGetRegistry = function() {
    // PlayCanvas keeps the ScriptRegistry on app.scripts
    let reg = null;
    try {
        reg = this.app && this.app.scripts || playcanvasStable_min && app && app.scripts || null;
    } catch (_) {}
    return reg;
};
SystemDebugger.prototype._registryHas = function(name) {
    try {
        return !!(this._registry && this._registry.has && this._registry.has(name));
    } catch (_) {
        return false;
    }
};
SystemDebugger.prototype._registryGet = function(name) {
    try {
        return this._registry && this._registry.get && this._registry.get(name) || null;
    } catch (_) {
        return null;
    }
};
SystemDebugger.prototype._registryList = function() {
    // No public list API; fall back to private map when available
    try {
        const map = this._registry && (this._registry._types || this._registry._scripts || this._registry._list);
        if (map) return Object.keys(map);
    } catch (_) {}
    return [];
};
SystemDebugger.prototype._captureError = function(where, e) {
    console.error(`[SystemDebugger] ${where} error:`, e && (e.stack || e.message || e));
    if (!this.debugInfo) this.debugInfo = {
        errors: []
    };
    this.debugInfo.errors.push({
        where,
        message: e && e.message || String(e),
        stack: e && e.stack || null,
        when: new Date().toISOString()
    });
};
SystemDebugger.prototype._logHeader = function(title) {
    console.log('='.repeat(60));
    console.log(title);
    console.log('='.repeat(60));
};
SystemDebugger.prototype._logFooter = function(title) {
    console.log('-'.repeat(60));
    console.log(title);
    console.log('-'.repeat(60));
};
// ------------------------------ Error catching ------------------------------
SystemDebugger.prototype._installErrorCatcher = function() {
    const self = this;
    // Wrap console.error to record errors (do not replace completely)
    const origErr = console.error;
    console.error = function() {
        try {
            if (self && self.debugInfo) {
                self.debugInfo.errors.push({
                    type: 'console.error',
                    args: Array.from(arguments),
                    when: new Date().toISOString()
                });
            }
        } catch (_) {}
        return origErr.apply(console, arguments);
    };
    // window.onerror hook
    window.addEventListener('error', function(e) {
        try {
            self.debugInfo.errors.push({
                type: 'window.error',
                message: e.message,
                file: e.filename,
                line: e.lineno,
                column: e.colno,
                when: new Date().toISOString()
            });
            console.log('[SystemDebugger] SCRIPT ERROR CAUGHT:', e.message, `(${e.filename}:${e.lineno}:${e.colno})`);
        } catch (_) {}
    });
};
// ------------------------------ Lifecycle tracing ------------------------------
SystemDebugger.prototype._installLifecycleTracing = function() {
    // Non-invasive wrapping of ScriptComponent methods to log when scripts init/postInit
    const sys = this.app.systems && this.app.systems.script;
    if (!sys) return;
    const proto = ScriptComponent.prototype;
    if (!proto || proto.__dbgWrapped) return; // prevent double-wrap
    const self = this;
    const wrap = function(targetName) {
        const orig = proto[targetName];
        if (typeof orig !== 'function') return;
        proto[targetName] = function() {
            try {
                const entName = this.entity && this.entity.name || '(no-entity)';
                const before = Date.now();
                const out = orig.apply(this, arguments);
                const after = Date.now();
                // Gather per-script info
                try {
                    const scripts = this.scripts || [];
                    scripts.forEach((s)=>{
                        if (!s || !s.__scriptType) return;
                        const nm = s.__scriptType.__name;
                        if (!nm) return;
                        self.debugInfo.lifecycleTrace.push({
                            event: targetName,
                            entity: entName,
                            script: nm,
                            ms: Math.max(0, after - before),
                            t: new Date().toISOString()
                        });
                        // Focus logging
                        const focus = self.focusScriptNames && self.focusScriptNames.names || [];
                        if (focus.includes(nm)) {
                            console.log(`[Trace] ${targetName} -> ${nm} on "${entName}" (${after - before}ms)`);
                        }
                    });
                } catch (_) {}
                return out;
            } catch (e) {
                self._captureError(`lifecycle:${targetName}`, e);
            // Still let PlayCanvas continue
            }
        };
    };
    wrap('_onInitialize');
    wrap('_onPostInitialize');
    proto.__dbgWrapped = true;
};
// ------------------------------ Entity find helpers ------------------------------
SystemDebugger.prototype._dfs = function(root, predicate, out) {
    out = out || [];
    if (!root) return out;
    try {
        if (predicate(root)) out.push(root);
        const ch = root.children || [];
        for(let i = 0; i < ch.length; i++)this._dfs(ch[i], predicate, out);
    } catch (e) {
        this._captureError('dfs', e);
    }
    return out;
};
SystemDebugger.prototype._findAll = function(predicate) {
    // Prefer app.root.find if project added such a helper; otherwise DFS
    try {
        if (this.app.root.find) return this.app.root.find(predicate) || [];
    } catch (_) {}
    return this._dfs(this.app.root, predicate, []);
};
// ------------------------------ Checks ------------------------------
SystemDebugger.prototype._findGameManager = function() {
    console.log('\n--- SEARCHING FOR GAMEMANAGER ---');
    // Global refs (if your GameManager assigns itself)
    console.log('  window.gameManager:', !!window.gameManager);
    console.log('  app.gameManager   :', !!this.app.gameManager);
    // By script presence
    const gmEntities = this._findAll((node)=>node.script && node.script.gameManager);
    console.log(`  Entities with "gameManager" script: ${gmEntities.length}`);
    gmEntities.forEach((e, idx)=>{
        const gm = e.script.gameManager;
        console.log(`    [${idx}] ${e.name} | entity.enabled=${e.enabled} | scriptComp.enabled=${e.script.enabled} | script.enabled=${gm.enabled} | _initialized=${!!gm._initialized}`);
        this.debugInfo.gameManagerEntity = this.debugInfo.gameManagerEntity || e;
        this.debugInfo.gameManagerScripts.push({
            entity: e.name,
            initialized: !!gm._initialized,
            enabled: !!gm.enabled
        });
    });
    // By script type registration
    const hasType = this._registryHas('gameManager');
    console.log('  ScriptRegistry has("gameManager"):', hasType);
    if (hasType) {
        const type = this._registryGet('gameManager');
        try {
            const attrs = type && type.attributes && type.attributes.index ? Object.keys(type.attributes.index) : [];
            console.log('  GameManager attributes:', attrs.length ? attrs.join(', ') : '(none/unknown)');
        } catch (_) {}
    }
    // By entity name fallback
    const named = this.app.root.findByName && this.app.root.findByName('GameManager');
    if (named) {
        const scripts = [];
        if (named.script && named.script.scripts) {
            named.script.scripts.forEach((s)=>scripts.push(s.__scriptType && s.__scriptType.__name));
        }
        console.log(`  Found entity named "GameManager": enabled=${named.enabled}, scripts=[${scripts.filter(Boolean).join(', ')}]`);
        if (!this.debugInfo.gameManagerEntity) this.debugInfo.gameManagerEntity = named;
    }
};
SystemDebugger.prototype._checkUIScreens = function() {
    console.log('\n--- CHECKING UI SCREENS ---');
    const names = [
        'MainMenu',
        'MainMenuScreen',
        'main-menu',
        'PauseMenu',
        'PauseMenuScreen',
        'pause-menu',
        'GameHUD',
        'HUD',
        'game-hud',
        'RoundSummary',
        'RoundSummaryScreen',
        'round-summary'
    ];
    names.forEach((n)=>{
        const e = this.app.root.findByName && this.app.root.findByName(n);
        if (e) {
            const state = {
                name: e.name,
                enabled: !!e.enabled,
                screen: e.screen ? e.screen.enabled : null,
                element: e.element ? e.element.enabled : null,
                scripts: (e.script && e.script.scripts || []).map((s)=>s.__scriptType && s.__scriptType.__name).filter(Boolean)
            };
            this.debugInfo.uiScreenStates[n] = state;
            console.log(`  UI "${e.name}": enabled=${state.enabled}, screen=${state.screen}, element=${state.element}, scripts=[${state.scripts.join(', ') || 'none'}]`);
        }
    });
    // Wildcard "pause"
    const pauseLike = this._findAll((node)=>node.name && /pause/i.test(node.name));
    if (pauseLike.length) {
        console.log('\n  Entities with "pause" in name:');
        pauseLike.forEach((e)=>{
            console.log(`    "${e.name}" -> enabled=${e.enabled}, visible=${e.element ? e.element.enabled : 'N/A'}`);
        });
    }
};
SystemDebugger.prototype._scanScriptedEntities = function() {
    console.log('\n--- SCANNING SCRIPTED ENTITIES ---');
    const ents = this._findAll((node)=>node.script && node.script.enabled);
    console.log(`  Entities with script components: ${ents.length}`);
    ents.forEach((e)=>{
        const list = e.script && e.script.scripts || [];
        const safe = list.map((s)=>({
                entity: e.name,
                script: s && s.__scriptType && s.__scriptType.__name || '(unknown)',
                enabled: !!(s && s.enabled),
                initialized: !!(s && s._initialized)
            }));
        this.debugInfo.scriptsFound.push.apply(this.debugInfo.scriptsFound, safe);
        // Focus interesting scripts
        const focus = this.focusScriptNames && this.focusScriptNames.names || [];
        safe.forEach((it)=>{
            if (focus.includes(it.script)) {
                console.log(`    [Focus] ${it.script} on "${it.entity}" | enabled=${it.enabled} | initialized=${it.initialized}`);
            }
        });
    });
};
SystemDebugger.prototype._checkForParsingErrors = function() {
    console.log('\n--- CHECKING SCRIPT TYPE REGISTRATION ---');
    if (!this._registry) {
        console.warn('  ScriptRegistry not found on app. (this.app.scripts missing)');
        return;
    }
    const gmRegistered = this._registryHas('gameManager');
    console.log('  gameManager registered:', gmRegistered);
    if (!gmRegistered) {
        console.error('  CRITICAL: "gameManager" script type is NOT registered. Likely parse error or not loaded.');
        const all = this._registryList();
        console.log(`  Registered script types (${all.length}):`, all.join(', ') || '(none)');
    } else {
        // Try safe dry-run creation (not attaching to scene permanently)
        try {
            const probe = new Entity('SystemDebugger_Probe');
            probe.addComponent('script');
            probe.script.create('gameManager'); // creation is cheap; initialize happens when component initializes
            probe.destroy();
            console.log('  Dry-run: create("gameManager") succeeded.');
        } catch (e) {
            this._captureError('createGameManagerDryRun', e);
        }
    }
};
SystemDebugger.prototype._checkEntityHierarchy = function() {
    console.log('\n--- IMPORTANT ENTITIES (PRESENCE & COMPONENTS) ---');
    [
        'GameManager',
        'UIManager',
        'UI',
        'HUD',
        'Canvas',
        'UIRoot'
    ].forEach((n)=>{
        const e = this.app.root.findByName && this.app.root.findByName(n);
        if (!e) return;
        const comps = [];
        if (e.script) comps.push('script');
        if (e.element) comps.push('element');
        if (e.screen) comps.push('screen');
        if (e.camera) comps.push('camera');
        console.log(`  ${n}: enabled=${e.enabled}, parent=${e.parent ? e.parent.name : '(root)'}, components=[${comps.join(', ') || 'none'}]`);
    });
};
SystemDebugger.prototype._checkActivationChains = function() {
    console.log('\n--- ACTIVATION CHAIN CHECK (entity & component enablement) ---');
    const gm = this.debugInfo.gameManagerEntity;
    if (!gm) {
        console.log('  No GameManager entity detected in prior scans.');
        return;
    }
    // Walk up parents to ensure none are disabled
    let cur = gm, disabledAncestor = null, depth = 0;
    while(cur){
        if (!cur.enabled && !disabledAncestor) disabledAncestor = {
            name: cur.name,
            depth
        };
        cur = cur.parent;
        depth++;
    }
    if (disabledAncestor) {
        console.warn(`  GameManager ancestor disabled: "${disabledAncestor.name}" (depth ${disabledAncestor.depth})`);
    }
    // Component enablement
    if (!gm.script || !gm.script.enabled) {
        console.warn('  GameManager entity has no enabled script component.');
    } else if (!gm.script.gameManager || !gm.script.gameManager.enabled) {
        console.warn('  GameManager script is present but disabled.');
    } else {
        console.log('  GameManager script component appears enabled.');
    }
};
SystemDebugger.prototype._performDelayedChecks = function() {
    this._logHeader('DELAYED CHECKS');
    // Final quick look
    console.log('\n--- FINAL GAMEMANAGER STATUS ---');
    console.log('  window.gameManager:', !!window.gameManager);
    console.log('  app.gameManager   :', !!this.app.gameManager);
    const gm = this.debugInfo.gameManagerEntity && this.debugInfo.gameManagerEntity.script && this.debugInfo.gameManagerEntity.script.gameManager;
    if (gm) {
        console.log(`  gm.enabled=${gm.enabled}, gm._initialized=${!!gm._initialized}, currentState=${gm.currentState || '(unknown)'}`);
    } else {
        console.log('  Could not read gm script instance from cached entity.');
    }
    // Visible UI elements (coarse)
    console.log('\n--- CURRENTLY VISIBLE UI ---');
    const visible = this._findAll((n)=>n.enabled && n.element && n.element.enabled && (n.element.width > 0 || n.element.height > 0));
    const interesting = visible.filter((n)=>/menu|screen|hud|summary/i.test(n.name));
    console.log(`  Visible UI elements: total=${visible.length}, interesting=${interesting.length}`);
    interesting.forEach((n)=>console.log(`    "${n.name}" (${n.element.width}x${n.element.height})`));
    // Summary
    console.log('\n--- SUMMARY ---');
    console.log(`  scriptsFound: ${this.debugInfo.scriptsFound.length}`);
    console.log(`  lifecycleTrace events: ${this.debugInfo.lifecycleTrace.length}`);
    console.log(`  errors captured: ${this.debugInfo.errors.length}`);
    if (this.debugInfo.errors.length) {
        console.log('  Error samples:');
        this.debugInfo.errors.slice(-5).forEach((e, i)=>console.log(`    [${i}]`, e));
    }
    this._logFooter('DELAYED CHECKS DONE');
};
// ------------------------------ Console helpers ------------------------------
SystemDebugger.prototype._installConsoleHelpers = function() {
    const self = this;
    // Summary dump
    window.debugGame = function() {
        console.log('[SystemDebugger] debugInfo:', self.debugInfo);
        return self.debugInfo;
    };
    // Find script instances by name
    window.findScript = function(name) {
        const found = (self.debugInfo.scriptsFound || []).filter((s)=>s.script === name);
        try {
            console.table(found);
        } catch (_) {
            console.log(found);
        }
        return found;
    };
    // Quick GameManager handle
    window.gm = function() {
        const e = self.debugInfo.gameManagerEntity;
        const inst = e && e.script && e.script.gameManager;
        console.log('[SystemDebugger] GameManager entity:', e, 'instance:', inst);
        return inst || null;
    };
    // Toggle all UI visibility
    window.toggleUI = function(on) {
        const ui = self._findAll((n)=>n.element || n.screen);
        ui.forEach((n)=>n.enabled = !!on);
        console.log(`[SystemDebugger] UI set to ${!!on} for ${ui.length} entities.`);
    };
    // Trace script lifecycle for a while
    window.traceScripts = function(seconds) {
        const secs = Math.max(1, seconds || 5);
        if (!self.traceScriptLifecycle) {
            console.warn('[SystemDebugger] traceScriptLifecycle is disabled in attributes.');
            return;
        }
        console.log(`[SystemDebugger] Tracing script lifecycle events for ${secs}s...`);
        const start = self.debugInfo.lifecycleTrace.length;
        setTimeout(()=>{
            const end = self.debugInfo.lifecycleTrace.length;
            const slice = self.debugInfo.lifecycleTrace.slice(start, end);
            console.log(`[SystemDebugger] Collected ${slice.length} lifecycle events:`, slice);
        }, secs * 1000);
    };
    console.log('\n>>> Console commands available:');
    console.log('  debugGame()        - Show all debug info');
    console.log('  findScript(name)   - List found script instances');
    console.log('  gm()               - Return GameManager script instance (if any)');
    console.log('  toggleUI(true/false) - Enable/disable all UI entities');
    console.log('  traceScripts([s])  - Collect lifecycle events for s seconds (default 5)');
};
