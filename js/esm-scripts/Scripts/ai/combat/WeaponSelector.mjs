import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class WeaponSelector {
    // ============================================================================
    // WEAPON EVALUATION
    // ============================================================================
    /**
     * Select best weapon for current situation
     * @returns {Object} { weapon: string, score: number, reason: string }
     */ selectBestWeapon(context) {
        const now = performance.now();
        // Update cache if needed
        if (now - this.lastCacheUpdate > this.cacheUpdateInterval) {
            this._updateWeaponScores(context);
            this.lastCacheUpdate = now;
        }
        // Find highest scoring weapon
        let bestWeapon = null;
        let bestScore = -1;
        let reason = 'default';
        for (const [weaponKey, score] of this.cachedScores){
            if (this._isWeaponAvailable(weaponKey) && score > bestScore) {
                bestScore = score;
                bestWeapon = weaponKey;
            }
        }
        // Determine reason
        if (bestWeapon) {
            const distance = context.targetDistance || 20;
            const ranges = this.weaponRanges[bestWeapon];
            if (distance <= ranges.optimal) {
                reason = 'optimal_range';
            } else if (distance > ranges.max) {
                reason = 'max_range_fallback';
            } else {
                reason = 'fuzzy_selected';
            }
        }
        return {
            weapon: bestWeapon || 'machinegun',
            score: bestScore,
            reason: reason
        };
    }
    /**
     * Should switch from current weapon?
     */ shouldSwitchWeapon(currentWeapon, context) {
        const now = performance.now();
        // ✅ AMMO CONSERVATION: Check current weapon ammo and force switch if critical
        const currentAmmoRatio = this._getAmmoRatio(currentWeapon);
        if (currentAmmoRatio < 0.05 && currentAmmoRatio > 0) {
            // Current weapon has < 5% ammo, try to switch to weapon with more ammo
            const available = this._getAvailableWeapons();
            // ✅ EDGE CASE: Check if ALL weapons are out of ammo
            const anyHasAmmo = available.some((w)=>this._getAmmoRatio(w) > 0);
            if (!anyHasAmmo) {
                // All weapons depleted - trigger flee or melee fallback
                Logger.warn(`[${this.agent.entity.name}] All weapons out of ammo - triggering flee behavior`);
                if (this.agent.stateChangeManager) {
                    this.agent.stateChangeManager.changeToState('flee', {
                        outOfAmmo: true
                    });
                }
                return {
                    shouldSwitch: false,
                    reason: 'all_weapons_depleted'
                };
            }
            for (const weaponKey of available){
                if (weaponKey !== currentWeapon) {
                    const otherAmmoRatio = this._getAmmoRatio(weaponKey);
                    if (otherAmmoRatio > currentAmmoRatio * 2) {
                        // Found weapon with significantly more ammo
                        return {
                            shouldSwitch: true,
                            newWeapon: weaponKey,
                            reason: 'current_weapon_critical_ammo',
                            bypassCooldown: true
                        };
                    }
                }
            }
        }
        // Check cooldown
        if (now - this.lastSwitchTime < this.switchCooldown) {
            return {
                shouldSwitch: false,
                reason: `cooldown_${Math.floor((now - this.lastSwitchTime) / 1000)}s`
            };
        }
        // Check if current weapon is unusable
        if (!this._isWeaponUsable(currentWeapon)) {
            const available = this._getAvailableWeapons();
            if (available.length > 0) {
                return {
                    shouldSwitch: true,
                    newWeapon: available[0],
                    reason: 'current_unusable',
                    bypassCooldown: true
                };
            }
        }
        // Use fuzzy logic for recommendation
        const recommendation = this.selectBestWeapon(context);
        if (!recommendation.weapon || recommendation.weapon === currentWeapon) {
            return {
                shouldSwitch: false,
                reason: 'same_weapon'
            };
        }
        // Calculate improvement score
        const currentScore = this._calculateWeaponScore(currentWeapon, context);
        const newScore = recommendation.score;
        // ✅ OPTIMIZED: Pistol upgrades are always good (human behavior)
        if (currentWeapon && currentWeapon.toLowerCase().includes('pistol')) {
            const newWeapon = recommendation.weapon;
            if (newWeapon && (newWeapon.toLowerCase().includes('machine') || newWeapon.toLowerCase().includes('shotgun'))) {
                return {
                    shouldSwitch: true,
                    newWeapon: newWeapon,
                    reason: 'pistol_upgrade',
                    scoreImprovement: 'significant'
                };
            }
        }
        // ✅ OPTIMIZED: Lower threshold - humans switch readily for marginal improvements
        const personalityThreshold = context.personality?.getCautionModifier() || 0;
        const threshold = 1.06 + personalityThreshold * 0.06; // Only 6% improvement needed
        if (newScore > currentScore * threshold) {
            return {
                shouldSwitch: true,
                newWeapon: recommendation.weapon,
                reason: `better_by_${Math.floor((newScore / currentScore - 1) * 100)}%`,
                scoreImprovement: ((newScore / currentScore - 1) * 100).toFixed(0) + '%'
            };
        }
        return {
            shouldSwitch: false,
            reason: 'insufficient_improvement'
        };
    }
    /**
     * Perform weapon switch
     */ performSwitch(newWeapon, reason = 'manual') {
        const ws = this.agent.weaponSystem;
        if (!ws || typeof ws.switchWeapon !== 'function') {
            Logger.warn('[WeaponSelector] Cannot switch weapon - no switchWeapon method');
            return false;
        }
        const success = ws.switchWeapon(newWeapon);
        if (success) {
            this.lastSwitchTime = performance.now();
            this._recordSwitch(newWeapon, reason);
            Logger.aiDetail(`[${this.agent.entity.name}] Switched to ${newWeapon} (${reason})`);
            return true;
        }
        return false;
    }
    // ============================================================================
    // WEAPON SCORING
    // ============================================================================
    /**
     * Calculate weapon score using multiple factors
     */ _calculateWeaponScore(weaponKey, context) {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons || !ws.weapons[weaponKey]) {
            return 0;
        }
        const weapon = ws.weapons[weaponKey];
        let score = 0;
        // Base damage
        score += weapon.damage || 20;
        // Range appropriateness (critical for FPS weapon selection)
        const distance = context.targetDistance || 20;
        const ranges = this.weaponRanges[weaponKey];
        if (distance <= ranges.optimal) {
            score *= 1.5; // Optimal range bonus
        } else if (distance > ranges.max) {
            score *= 0.2; // Too far penalty
        } else {
            // Linear falloff beyond optimal
            const falloff = 1 - (distance - ranges.optimal) / (ranges.max - ranges.optimal) * 0.5;
            score *= falloff;
        }
        // Fire rate bonus
        const fireRate = weapon.fireRate || 1;
        score *= 1 + Math.min(fireRate * 0.15, 0.5);
        // ✅ AMMO CONSERVATION: Enhanced ammo factor with steeper penalty for low ammo
        const ammoRatio = this._getAmmoRatio(weaponKey);
        if (ammoRatio < 0.1) {
            // Critical ammo (< 10%): heavy penalty
            score *= 0.1;
        } else if (ammoRatio < 0.3) {
            // Low ammo (< 30%): moderate penalty
            score *= 0.3 + ammoRatio * 0.7;
        } else {
            // Normal ammo: standard scaling
            score *= 0.3 + ammoRatio * 0.7;
        }
        // Accuracy factor
        const accuracy = weapon.accuracy || 0.7;
        score *= 0.8 + accuracy * 0.2;
        // Performance history
        const performance1 = this.weaponPerformance.get(weaponKey);
        if (performance1) {
            const hitRatio = performance1.hits / Math.max(1, performance1.shots);
            score *= 0.9 + hitRatio * 0.2;
        }
        return score;
    }
    /**
     * Update weapon scores using fuzzy logic
     */ _updateWeaponScores(context) {
        // If no fuzzy system, use simple scoring
        if (!this.fuzzySystem) {
            this._updateSimpleScores(context);
            return;
        }
        // Prepare fuzzy inputs
        const distance = context.targetDistance || 20;
        const accuracyNeed = this._calculateAccuracyNeed(context);
        // Get desirability scores for each weapon
        for (const weaponKey of [
            'pistol',
            'machinegun',
            'shotgun'
        ]){
            if (!this._hasWeapon(weaponKey)) continue;
            const ammoRatio = this._getAmmoRatio(weaponKey);
            // Get fuzzy preference value (0-1 output from fuzzy system)
            const fuzzyOutput = this.fuzzySystem.evaluateWeaponPreference(distance, ammoRatio, accuracyNeed);
            // Map fuzzy output to weapon desirability
            // Fuzzy output: 0-0.35=shotgun, 0.3-0.7=machinegun, 0.65-1.0=pistol
            const weaponDesirability = this._getFuzzyWeaponDesirability(weaponKey, fuzzyOutput);
            // Combine fuzzy desirability with calculated score
            const calculatedScore = this._calculateWeaponScore(weaponKey, context);
            // Weight fuzzy logic heavily (70%) since it's context-aware
            const finalScore = weaponDesirability * 0.7 + calculatedScore / 100 * 0.3;
            this.cachedScores.set(weaponKey, finalScore);
        }
    }
    /**
     * Map fuzzy system output (0-1) to weapon desirability
     * Fuzzy output ranges:
     * - 0.0-0.35: Shotgun preference (close range)
     * - 0.3-0.7: Machinegun preference (medium range)
     * - 0.65-1.0: Pistol preference (far range)
     */ _getFuzzyWeaponDesirability(weaponKey, fuzzyOutput) {
        // Calculate how well this weapon matches the fuzzy preference
        switch(weaponKey){
            case 'shotgun':
                // Most desirable when fuzzy output is low (0-0.35)
                if (fuzzyOutput <= 0.15) return 1.0;
                if (fuzzyOutput >= 0.35) return 0.2;
                return 1.0 - (fuzzyOutput - 0.15) / 0.2 * 0.8;
            case 'machinegun':
                // Most desirable when fuzzy output is medium (0.3-0.7)
                if (fuzzyOutput >= 0.3 && fuzzyOutput <= 0.7) {
                    // Peak at 0.5
                    const distFromPeak = Math.abs(fuzzyOutput - 0.5);
                    return 1.0 - distFromPeak / 0.2 * 0.3;
                }
                if (fuzzyOutput < 0.3) {
                    return 0.5 + fuzzyOutput / 0.3 * 0.2;
                }
                // fuzzyOutput > 0.7
                return 0.5 + (1.0 - fuzzyOutput) / 0.3 * 0.2;
            case 'pistol':
                // Most desirable when fuzzy output is high (0.65-1.0)
                if (fuzzyOutput >= 0.85) return 1.0;
                if (fuzzyOutput <= 0.65) return 0.2;
                return 0.2 + (fuzzyOutput - 0.65) / 0.2 * 0.8;
            default:
                return 0.5;
        }
    }
    /**
     * Simple scoring fallback without fuzzy logic
     */ _updateSimpleScores(context) {
        for (const weaponKey of [
            'pistol',
            'machinegun',
            'shotgun'
        ]){
            if (!this._hasWeapon(weaponKey)) continue;
            const score = this._calculateWeaponScore(weaponKey, context);
            this.cachedScores.set(weaponKey, score / 100);
        }
    }
    /**
     * Calculate accuracy need based on situation
     */ _calculateAccuracyNeed(context) {
        let need = 0.5; // Base
        // Target velocity
        const targetVelocity = context.targetVelocity || 0;
        if (targetVelocity > 5) need += 0.3;
        else if (targetVelocity > 2) need += 0.15;
        // Distance
        const distance = context.targetDistance || 20;
        if (distance > 40) need += 0.2;
        // Personality
        if (context.personality) {
            need = need * 0.7 + context.personality.traits.accuracy * 0.3;
        }
        return Math.max(0, Math.min(1, need));
    }
    // ============================================================================
    // WEAPON AVAILABILITY
    // ============================================================================
    _isWeaponAvailable(weaponKey) {
        return this._hasWeapon(weaponKey) && this._hasAmmo(weaponKey) && this._isWeaponUnlocked(weaponKey);
    }
    _isWeaponUsable(weaponKey) {
        return this._hasWeapon(weaponKey) && this._hasAmmo(weaponKey);
    }
    _hasWeapon(weaponKey) {
        const ws = this.agent.weaponSystem;
        return ws && ws.weapons && ws.weapons[weaponKey];
    }
    _isWeaponUnlocked(weaponKey) {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons) return false;
        const weapon = ws.weapons[weaponKey];
        return weapon && weapon.unlocked === true;
    }
    _hasAmmo(weaponKey) {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons) return false;
        const weapon = ws.weapons[weaponKey];
        if (!weapon) return false;
        return weapon.ammo > 0 || weapon.magazine > 0 || ws.currentMagazine > 0;
    }
    _getAvailableWeapons() {
        const available = [];
        for (const weaponKey of [
            'pistol',
            'machinegun',
            'shotgun'
        ]){
            if (this._isWeaponAvailable(weaponKey)) {
                available.push(weaponKey);
            }
        }
        return available;
    }
    // ============================================================================
    // AMMO MANAGEMENT
    // ============================================================================
    _getAmmoRatio(weaponKey) {
        const ws = this.agent.weaponSystem;
        if (!ws || !ws.weapons || !ws.weapons[weaponKey]) return 0;
        const weapon = ws.weapons[weaponKey];
        if (typeof weapon.currentAmmo === 'number' && typeof weapon.maxAmmo === 'number') {
            return weapon.maxAmmo > 0 ? weapon.currentAmmo / weapon.maxAmmo : 0;
        }
        const totalAmmo = (weapon.ammo || 0) + (weapon.magazine || 0);
        const maxPossible = weapon.maxAmmo || 100;
        if (maxPossible > 0) {
            return Math.min(1, totalAmmo / maxPossible);
        }
        return weapon.ammo > 0 || weapon.magazine > 0 ? 0.7 : 0;
    }
    // ============================================================================
    // PERFORMANCE TRACKING
    // ============================================================================
    /**
     * Record weapon shot with temporal decay
     */ recordShot(weaponKey, hit) {
        const now = performance.now();
        if (!this.weaponPerformance.has(weaponKey)) {
            this.weaponPerformance.set(weaponKey, {
                shots: 0,
                hits: 0,
                kills: 0,
                lastUpdate: now
            });
        }
        const perf = this.weaponPerformance.get(weaponKey);
        // Decay old stats (10% every 60 seconds)
        const timeSinceUpdate = (now - perf.lastUpdate) / 1000;
        if (timeSinceUpdate > 60) {
            const decayFactor = Math.pow(0.9, Math.floor(timeSinceUpdate / 60));
            perf.shots *= decayFactor;
            perf.hits *= decayFactor;
            perf.kills *= decayFactor;
        }
        perf.shots++;
        if (hit) perf.hits++;
        perf.lastUpdate = now;
    }
    /**
     * Record weapon kill with temporal decay
     */ recordKill(weaponKey) {
        const now = performance.now();
        if (!this.weaponPerformance.has(weaponKey)) {
            this.weaponPerformance.set(weaponKey, {
                shots: 0,
                hits: 0,
                kills: 0,
                lastUpdate: now
            });
        }
        const perf = this.weaponPerformance.get(weaponKey);
        // Decay old stats (10% every 60 seconds)
        const timeSinceUpdate = (now - perf.lastUpdate) / 1000;
        if (timeSinceUpdate > 60) {
            const decayFactor = Math.pow(0.9, Math.floor(timeSinceUpdate / 60));
            perf.shots *= decayFactor;
            perf.hits *= decayFactor;
            perf.kills *= decayFactor;
        }
        perf.kills++;
        perf.lastUpdate = now;
    }
    /**
     * Get weapon statistics
     */ getWeaponStats(weaponKey) {
        const perf = this.weaponPerformance.get(weaponKey);
        if (!perf) return null;
        return {
            shots: perf.shots,
            hits: perf.hits,
            kills: perf.kills,
            accuracy: perf.shots > 0 ? perf.hits / perf.shots : 0,
            killsPerShot: perf.shots > 0 ? perf.kills / perf.shots : 0
        };
    }
    // ============================================================================
    // SWITCH HISTORY
    // ============================================================================
    _recordSwitch(weaponKey, reason) {
        this.switchHistory.push({
            timestamp: performance.now(),
            weapon: weaponKey,
            reason: reason
        });
        if (this.switchHistory.length > this.maxSwitchHistory) {
            this.switchHistory.shift();
        }
    }
    /**
     * Get recent switches
     */ getRecentSwitches(count = 5) {
        return this.switchHistory.slice(-count);
    }
    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    /**
     * Set switch cooldown (can be modulated by personality)
     */ setSwitchCooldown(milliseconds) {
        this.switchCooldown = milliseconds;
    }
    /**
     * Update weapon range metadata
     */ setWeaponRange(weaponKey, ranges) {
        this.weaponRanges[weaponKey] = {
            ...ranges
        };
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    getDebugInfo() {
        return {
            cachedScores: Object.fromEntries(this.cachedScores),
            lastCacheUpdate: this.lastCacheUpdate,
            lastSwitchTime: this.lastSwitchTime,
            switchCooldown: this.switchCooldown,
            availableWeapons: this._getAvailableWeapons(),
            weaponPerformance: Object.fromEntries(this.weaponPerformance),
            recentSwitches: this.switchHistory.slice(-3)
        };
    }
    constructor(agent, fuzzySystem){
        this.agent = agent;
        this.fuzzySystem = fuzzySystem;
        // Weapon metadata - based on realistic FPS weapon ranges
        this.weaponRanges = {
            shotgun: {
                optimal: 8,
                min: 2,
                max: 15
            },
            machinegun: {
                optimal: 25,
                min: 10,
                max: 75
            },
            pistol: {
                optimal: 30,
                min: 15,
                max: 50
            }
        };
        // ✅ OPTIMIZED FOR REALISTIC FPS AI (Oct 23, 2025)
        // Human players switch weapons quickly and decisively
        this.lastSwitchTime = 0;
        this.switchCooldown = 600; // ✅ 600ms - fast like human players
        this.switchHistory = [];
        this.maxSwitchHistory = 10;
        // Performance tracking
        this.weaponPerformance = new Map();
        // Cache
        this.cachedScores = new Map();
        this.cacheUpdateInterval = 200;
        this.lastCacheUpdate = 0;
        Logger.debug('[WeaponSelector] Initialized');
    }
}

export { WeaponSelector };
