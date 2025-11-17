///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
// damage-diagnostics.js
// Development diagnostics for damage system validation
// Add this as a new script or integrate into your debug system

var DamageDiagnostics = pc.createScript('damageDiagnostics');

// 'enabled' is a reserved attribute name in PlayCanvas script attributes.
// Use a different attribute name to avoid engine warnings.
DamageDiagnostics.attributes.add('diagnosticsEnabled', {
    type: 'boolean',
    default: false, // Set to true for development
    title: 'Enable Diagnostics'
});

DamageDiagnostics.attributes.add('validationInterval', {
    type: 'number',
    default: 2000,
    title: 'Validation Interval (ms)'
});

DamageDiagnostics.prototype.initialize = function() {
    if (!this.diagnosticsEnabled) return;
    
    // Track global hit/apply counts
    this.weaponHitsByType = {};
    this.healthAppliesByType = {};
    
    // Track mismatches
    this.mismatches = [];
    this.duplicateHits = [];
    
    // Listen to weapon hits
    this.app.on('weapon:fired', this._onWeaponFired, this);
    
    // Listen to health applications
    this.app.on('entity:damaged', this._onEntityDamaged, this);
    
    // Listen to duplicates
    this.app.on('debug:damage', this._onDebugDamage, this);
    
    // Periodic validation
    this.lastValidation = 0;
    
    console.log('[DamageDiagnostics] Diagnostics enabled - tracking all damage events');
};

DamageDiagnostics.prototype._onWeaponFired = function(data) {
    const weaponType = data.weaponType || 'unknown';
    const hits = data.shotsHit || 0;
    
    if (!this.weaponHitsByType[weaponType]) {
        this.weaponHitsByType[weaponType] = 0;
    }
    this.weaponHitsByType[weaponType] += hits;
};

DamageDiagnostics.prototype._onEntityDamaged = function(data) {
    const weaponType = data.weaponType || 'unknown';
    // Only count actual, positive damage applications. Some systems may fire
    // informational or zero-damage events; count only when damage > 0.
    const appliedDamage = typeof data.damage === 'number' ? data.damage : 0;
    if (appliedDamage > 0) {
        if (!this.healthAppliesByType[weaponType]) {
            this.healthAppliesByType[weaponType] = 0;
        }
        this.healthAppliesByType[weaponType]++;
    }
    
    // Check for hitId
    if (!data.hitId) {
        console.warn('[DamageDiagnostics] Damage applied without hitId!', {
            target: data.targetName,
            attacker: data.attacker ? data.attacker.name : 'unknown',
            damage: data.damage
        });
    }
};

DamageDiagnostics.prototype._onDebugDamage = function(data) {
    // This could be used for additional tracking
};

DamageDiagnostics.prototype.update = function(dt) {
    if (!this.diagnosticsEnabled) return;
    
    const now = performance.now();
    if (now - this.lastValidation < this.validationInterval) return;
    
    this.lastValidation = now;
    this._validateDamageAccounting();
};

DamageDiagnostics.prototype._validateDamageAccounting = function() {
    console.log('=== DAMAGE SYSTEM VALIDATION ===');
    
    // Compare hits vs applies
    let totalMismatch = false;
    
    for (let weaponType in this.weaponHitsByType) {
        const hits = this.weaponHitsByType[weaponType];
        const applies = this.healthAppliesByType[weaponType] || 0;
        
        console.log(`${weaponType}: ${hits} hits → ${applies} applies`);
        
        if (Math.abs(hits - applies) > 1) { // Allow small float tolerance
            console.warn(`⚠️ MISMATCH: ${weaponType} has ${hits} hits but ${applies} applies (diff: ${hits - applies})`);
            totalMismatch = true;
        }
    }
    
    // Check for applies without hits
    for (let weaponType in this.healthAppliesByType) {
        if (!this.weaponHitsByType[weaponType]) {
            console.warn(`⚠️ ORPHAN APPLIES: ${weaponType} has ${this.healthAppliesByType[weaponType]} applies but no recorded hits`);
            totalMismatch = true;
        }
    }
    
    if (!totalMismatch) {
        console.log('✅ All damage accounting matches (1:1 hit-to-apply)');
    }
    
    // Report health system stats
    const damageable = this.app.damageableEntities || [];
    console.log(`\n=== HEALTH SYSTEM STATS ===`);
    
    damageable.forEach(entity => {
        if (!entity.script || !entity.script.healthSystem) return;
        
        const hs = entity.script.healthSystem;
        if (typeof hs.getDamageStats === 'function') {
            const stats = hs.getDamageStats();
            console.log(`${stats.entityName}: ${stats.currentHealth}/${stats.maxHealth} HP, ${stats.damageApplications} applies, ${stats.hitsDeduplicated} deduped`);
        }
    });
    
    console.log('=== END VALIDATION ===\n');
};

DamageDiagnostics.prototype.getReport = function() {
    return {
        weaponHits: { ...this.weaponHitsByType },
        healthApplies: { ...this.healthAppliesByType },
        mismatches: this.mismatches.length,
        duplicates: this.duplicateHits.length
    };
};

DamageDiagnostics.prototype.reset = function() {
    this.weaponHitsByType = {};
    this.healthAppliesByType = {};
    this.mismatches = [];
    this.duplicateHits = [];
    console.log('[DamageDiagnostics] Stats reset');
};

// Global debug commands (call from browser console)
window.debugDamageSystem = function() {
    const diagnostics = pc.Application.getApplication().root.findComponent('script', s => s.damageDiagnostics);
    if (!diagnostics) {
        console.warn('DamageDiagnostics not found - add the script to your scene');
        return;
    }
    
    return diagnostics.damageDiagnostics.getReport();
};

window.resetDamageStats = function() {
    const diagnostics = pc.Application.getApplication().root.findComponent('script', s => s.damageDiagnostics);
    if (!diagnostics) return;
    diagnostics.damageDiagnostics.reset();
};