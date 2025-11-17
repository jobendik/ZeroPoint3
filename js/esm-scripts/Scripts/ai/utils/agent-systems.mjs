import { aiConfig } from '../../config/ai.config.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
function initializeSystems(scriptInstance) {
    const entity = scriptInstance.entity;
    scriptInstance.app;
    const name = entity.name || 'AIAgent';
    const systems = {
        weapon: null,
        health: null,
        ready: false
    };
    // Try to get systems from entity.script
    if (entity.script) {
        systems.weapon = entity.script.weaponSystem || null;
        systems.health = entity.script.healthSystem || null;
    }
    // ✅ CRITICAL FIX: Ensure weapon system is FULLY initialized and booted
    if (systems.weapon) {
        const ws = systems.weapon;
        const isInitialized = ws._initialized === true;
        const isBooted = ws.__wsBooted === true;
        Logger.debug(`[${name}] Weapon system status: initialized=${isInitialized}, booted=${isBooted}`);
        if (!isInitialized) {
            // Need to initialize from scratch
            Logger.warn(`[${name}] Weapon system NOT initialized - forcing manual initialization...`);
            try {
                ws.initialize();
                Logger.info(`[${name}] ✅ Weapon system initialize() completed`);
            } catch (error) {
                Logger.error(`[${name}] ❌ Failed to initialize weapon system:`, error);
                systems.weapon = null;
                systems.ready = true; // Ready even without weapon
                return systems;
            }
        }
        if (!isBooted) {
            // Need to complete boot sequence
            Logger.warn(`[${name}] Weapon system initialized but NOT booted - forcing postInitialize...`);
            try {
                // Call postInitialize (it's async but we don't need to await)
                ws.postInitialize().then(()=>{
                    Logger.info(`[${name}] ✅ Weapon system postInitialize() completed`);
                    systems.ready = true;
                }).catch((error)=>{
                    Logger.error(`[${name}] ❌ postInitialize failed:`, error);
                    systems.ready = true; // Continue anyway
                });
                // Don't wait for postInitialize - we'll use event system
                Logger.debug(`[${name}] Waiting for weaponSystem:ready event...`);
            } catch (error) {
                Logger.error(`[${name}] ❌ Failed to call postInitialize:`, error);
                systems.weapon = null;
                systems.ready = true;
                return systems;
            }
        } else {
            // Already fully initialized and booted
            Logger.info(`[${name}] ✅ Weapon system already fully initialized and booted`);
            systems.ready = true;
        }
    } else {
        Logger.warn(`[${name}] ⚠️ No weapon system attached to entity`);
        systems.ready = true; // Ready even without weapon
    }
    // Verify weapon configuration
    if (systems.weapon && systems.weapon.__wsBooted) {
        _verifyWeaponConfiguration(systems.weapon, name);
    }
    return systems;
}
/**
 * Verify weapon system has proper configuration
 */ function _verifyWeaponConfiguration(weaponSystem, agentName) {
    const ws = weaponSystem;
    // Check if weapons object exists
    if (!ws.weapons || typeof ws.weapons !== 'object') {
        Logger.error(`[${agentName}] ❌ CRITICAL: Weapon system has no weapons object!`);
        return false;
    }
    // Check for unlocked weapons
    const weaponKeys = Object.keys(ws.weapons);
    if (weaponKeys.length === 0) {
        Logger.error(`[${agentName}] ❌ CRITICAL: Weapon system weapons object is empty!`);
        return false;
    }
    const unlockedWeapons = weaponKeys.filter((key)=>ws.weapons[key] && ws.weapons[key].unlocked === true);
    if (unlockedWeapons.length === 0) {
        Logger.error(`[${agentName}] ❌ CRITICAL: No unlocked weapons!`);
        Logger.error(`[${agentName}] Available weapons: ${weaponKeys.join(', ')}`);
        weaponKeys.forEach((key)=>{
            const weapon = ws.weapons[key];
            Logger.error(`[${agentName}]   - ${key}: unlocked=${weapon?.unlocked}, ammo=${weapon?.ammo}`);
        });
        // Auto-unlock first weapon as fallback
        Logger.warn(`[${agentName}] 🔧 Auto-unlocking first weapon: ${weaponKeys[0]}`);
        ws.weapons[weaponKeys[0]].unlocked = true;
        ws.currentWeapon = weaponKeys[0];
        return true; // Fixed, so return true
    }
    // Check current weapon
    if (!ws.currentWeapon) {
        Logger.warn(`[${agentName}] ⚠️ No current weapon set, using first unlocked: ${unlockedWeapons[0]}`);
        ws.currentWeapon = unlockedWeapons[0];
    }
    // Check ammo
    const currentWeapon = ws.weapons[ws.currentWeapon];
    if (currentWeapon) {
        const totalAmmo = (currentWeapon.ammo || 0) + (ws.currentMagazine || 0);
        if (totalAmmo === 0) {
            Logger.error(`[${agentName}] ❌ CRITICAL: Current weapon has NO ammo!`);
            Logger.warn(`[${agentName}] 🔧 Auto-giving ${aiConfig.goalExecution.AI_AMMO_REFILL} ammo to ${ws.currentWeapon}`);
            currentWeapon.ammo = aiConfig.goalExecution.AI_AMMO_REFILL;
            ws.currentMagazine = currentWeapon.magazine || 30;
        } else {
            Logger.info(`[${agentName}] ✅ Current weapon (${ws.currentWeapon}) has ${totalAmmo} total ammo`);
        }
    }
    return true;
}
function isSystemReady(system, systemName) {
    if (!system) return false;
    // For weapon system, must check BOTH flags
    if (systemName === 'weaponSystem') {
        return system._initialized === true && system.__wsBooted === true;
    }
    // For health system
    if (systemName === 'healthSystem') {
        return system._initialized === true || system.__hsBooted === true;
    }
    // Check for initialized state
    if (system._initialized === true) return true;
    // Check for isReady method
    if (typeof system.isReady === 'function') {
        return system.isReady();
    }
    return false;
}
function waitForSystems(scriptInstance, systems, callback) {
    const name = scriptInstance.entity.name || 'AIAgent';
    const entity = scriptInstance.entity;
    const waitingFor = [];
    if (systems.health && !isSystemReady(systems.health, 'healthSystem')) {
        waitingFor.push('healthSystem');
    }
    if (systems.weapon && !isSystemReady(systems.weapon, 'weaponSystem')) {
        waitingFor.push('weaponSystem');
    }
    if (waitingFor.length === 0) {
        Logger.info(`[${name}] ✅ All systems ready immediately - completing initialization`);
        callback();
        return;
    }
    Logger.debug(`[${name}] ⏳ Waiting for: ${waitingFor.join(', ')}`);
    // Track which systems we're still waiting for
    let healthReady = !waitingFor.includes('healthSystem');
    let weaponReady = !waitingFor.includes('weaponSystem');
    let timeoutId = null;
    let pollIntervalId = null;
    function checkAllReady() {
        if (healthReady && weaponReady) {
            // Clean up timeout and polling
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (pollIntervalId) {
                clearInterval(pollIntervalId);
                pollIntervalId = null;
            }
            Logger.info(`[${name}] ✅ All systems ready!`);
            callback();
        }
    }
    // ✅ ISSUE #2 FIX: Event-driven initialization with minimal polling fallback
    // Set up event listeners (primary method)
    if (waitingFor.includes('healthSystem')) {
        entity.once('healthSystem:ready', ()=>{
            Logger.debug(`[${name}] Received healthSystem:ready event`);
            healthReady = true;
            checkAllReady();
        });
    }
    if (waitingFor.includes('weaponSystem')) {
        // Listen for both entity and app level events (weapon system fires both)
        const weaponReadyHandler = ()=>{
            Logger.debug(`[${name}] Received weaponSystem:ready event`);
            weaponReady = true;
            checkAllReady();
        };
        entity.once('weaponSystem:ready', weaponReadyHandler);
        // Also listen on app level as fallback
        scriptInstance.app.once('weaponSystem:ready', (readyEntity)=>{
            if (readyEntity === entity) {
                Logger.debug(`[${name}] Received app-level weaponSystem:ready event`);
                weaponReady = true;
                checkAllReady();
            }
        });
    }
    // ✅ NEW: Lightweight polling ONLY as final fallback (check every 500ms for 5 seconds max)
    // This is much less aggressive than the old 100ms polling
    let pollAttempts = 0;
    const maxPollAttempts = 10; // 5 seconds max (500ms * 10)
    pollIntervalId = setInterval(()=>{
        pollAttempts++;
        // Check weapon system if still waiting
        if (waitingFor.includes('weaponSystem') && !weaponReady) {
            if (isSystemReady(systems.weapon, 'weaponSystem')) {
                Logger.info(`[${name}] ✅ Weapon system ready detected via fallback polling (${pollAttempts * 500}ms)`);
                weaponReady = true;
                checkAllReady();
                return;
            }
        }
        // Check health system if still waiting
        if (waitingFor.includes('healthSystem') && !healthReady) {
            if (isSystemReady(systems.health, 'healthSystem')) {
                Logger.info(`[${name}] ✅ Health system ready detected via fallback polling (${pollAttempts * 500}ms)`);
                healthReady = true;
                checkAllReady();
                return;
            }
        }
        // Timeout after max attempts
        if (pollAttempts >= maxPollAttempts) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
            Logger.warn(`[${name}] ⚠️ System initialization timeout after ${pollAttempts * 500}ms`);
            // Final check before giving up
            if (waitingFor.includes('weaponSystem') && !weaponReady) {
                if (isSystemReady(systems.weapon, 'weaponSystem')) {
                    Logger.info(`[${name}] Weapon system ready on final check!`);
                    weaponReady = true;
                } else {
                    Logger.error(`[${name}] ❌ Weapon system failed to initialize - proceeding without it`);
                    systems.weapon = null;
                    weaponReady = true;
                }
            }
            if (waitingFor.includes('healthSystem') && !healthReady) {
                if (isSystemReady(systems.health, 'healthSystem')) {
                    Logger.info(`[${name}] Health system ready on final check!`);
                    healthReady = true;
                } else {
                    Logger.warn(`[${name}] ⚠️ Health system failed to initialize - using fallback`);
                    systems.health = null;
                    healthReady = true;
                }
            }
            checkAllReady();
        }
    }, 500); // Poll every 500ms instead of 100ms
    // ✅ NEW: Absolute timeout as safety net (10 seconds max)
    timeoutId = setTimeout(()=>{
        if (!healthReady || !weaponReady) {
            Logger.error(`[${name}] ❌ CRITICAL: System initialization FAILED after 10 second timeout`);
            Logger.error(`[${name}]   Health Ready: ${healthReady}`);
            Logger.error(`[${name}]   Weapon Ready: ${weaponReady}`);
            // Force completion to prevent agent from being stuck forever
            if (!weaponReady) {
                systems.weapon = null;
                weaponReady = true;
            }
            if (!healthReady) {
                systems.health = null;
                healthReady = true;
            }
            checkAllReady();
        }
    }, 10000); // 10 second absolute timeout
}

export { initializeSystems, isSystemReady, waitForSystems };
