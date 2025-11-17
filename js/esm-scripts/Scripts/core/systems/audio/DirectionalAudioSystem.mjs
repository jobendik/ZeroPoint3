import { Script, Vec3 } from '../../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../engine/logger.mjs';

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
 * 🎵 DIRECTIONAL AUDIO SYSTEM
 * 
 * Provides immersive 3D spatial audio feedback:
 * - Directional damage indicators (play hit sound from attacker's direction)
 * - Weapon-specific enemy audio (identify threats by sound)
 * - Environmental cues (footsteps, reloads, weapon switches)
 * - Audio-based threat detection (locate enemies you can't see)
 * 
 * This creates tactical depth where sound is as important as sight.
 */ class DirectionalAudioSystem extends Script {
    initialize() {
        if (this.__dasBooted) {
            Logger.debug('[DirectionalAudioSystem] Already initialized');
            return;
        }
        this.player = null;
        this.audioManager = null;
        // Track recent damage sources for UI indicators
        this.recentDamageSources = [];
        this.maxTrackedSources = 5;
        this.damageSourceLifetime = 2000; // ms
        // Bind event handlers to preserve 'this' context
        this._boundOnEntityDamage = this._onEntityDamage.bind(this);
        this._boundOnWeaponFired = this._onWeaponFired.bind(this);
        this._boundOnFootstep = this._onFootstep.bind(this);
        this._boundOnReloadStart = this._onReloadStart.bind(this);
        this._setupEventListeners();
        this._waitForDependencies();
        this.on('destroy', this._cleanup, this);
        this.__dasBooted = true;
        Logger.info('[DirectionalAudioSystem] Initialized');
    }
    _waitForDependencies() {
        const check = ()=>{
            if (!this.app.audioManager) {
                setTimeout(check, 100);
                return;
            }
            this.audioManager = this.app.audioManager;
            // Wait for player
            const playerCheck = ()=>{
                const player = this.app.root.findByTag('player')[0];
                if (!player || !player.script || !player.script.player) {
                    setTimeout(playerCheck, 100);
                    return;
                }
                this.player = player;
                Logger.debug('[DirectionalAudioSystem] Dependencies ready');
            };
            playerCheck();
        };
        check();
    }
    _setupEventListeners() {
        if (this._eventsBound) {
            Logger.debug('[DirectionalAudioSystem] Event listeners already bound');
            return;
        }
        Logger.debug('[DirectionalAudioSystem] Binding event listeners...');
        console.log('[DirectionalAudioSystem] About to bind listeners, bound functions:', {
            damage: this._boundOnEntityDamage,
            weaponFired: this._boundOnWeaponFired,
            footstep: this._boundOnFootstep,
            reloadStart: this._boundOnReloadStart
        });
        // Listen for damage events to play directional hit sounds
        // IMPORTANT: Using bound functions directly without third parameter
        this.app.on('entity:damaged', this._boundOnEntityDamage);
        console.log('[DirectionalAudioSystem] Registered entity:damaged with bound function');
        // Listen for weapon fire from AI to play enemy weapon sounds
        this.app.on('weapon:fired', this._boundOnWeaponFired);
        Logger.debug('[DirectionalAudioSystem] Bound: weapon:fired');
        // Listen for footsteps from AI
        this.app.on('footstep', this._boundOnFootstep);
        Logger.debug('[DirectionalAudioSystem] Bound: footstep');
        // Listen for reload sounds from AI
        this.app.on('weapon:reload_start', this._boundOnReloadStart);
        Logger.debug('[DirectionalAudioSystem] Bound: weapon:reload_start');
        this._eventsBound = true;
        Logger.info('[DirectionalAudioSystem] ✅ All event listeners bound');
    }
    /**
     * Play directional damage indicator when player takes damage
     */ _onEntityDamage(data) {
        console.log('[DirectionalAudioSystem] 🎯 _onEntityDamage CALLED!', data);
        Logger.debug('[DirectionalAudioSystem] _onEntityDamage called with:', data);
        if (!data || !data.entity || !this.player) {
            console.log('[DirectionalAudioSystem] Early exit:', {
                hasData: !!data,
                hasEntity: !!data?.entity,
                hasPlayer: !!this.player
            });
            Logger.debug('[DirectionalAudioSystem] Early exit:', {
                hasData: !!data,
                hasEntity: !!data?.entity,
                hasPlayer: !!this.player
            });
            return;
        }
        // Only process if player is the damaged entity
        const damagedEntity = data.entity;
        const isPlayer = damagedEntity.tags && damagedEntity.tags.has('player');
        Logger.debug('[DirectionalAudioSystem] Entity check:', {
            entityName: damagedEntity.name,
            isPlayer: isPlayer,
            hasTags: !!damagedEntity.tags
        });
        if (!isPlayer) return;
        const attacker = data.attacker;
        if (!attacker) {
            Logger.debug('[DirectionalAudioSystem] No attacker in damage data');
            return;
        }
        // Get attacker position
        const attackerPos = attacker.getPosition ? attacker.getPosition() : attacker;
        const playerPos = this.player.getPosition();
        // Calculate direction from player to attacker
        const direction = new Vec3().sub2(attackerPos, playerPos);
        direction.normalize();
        Logger.debug(`[DirectionalAudioSystem] Playing damage indicator from direction: ${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}`);
        // Play directional hit sound at attacker's position
        // This creates a spatial audio cue showing where the damage came from
        if (this.audioManager) {
            // Use player_hurt sound with spatial positioning
            this.audioManager.playSound({
                sound: 'player_hurt',
                position: attackerPos,
                volume: 0.8,
                pitch: 1 + (Math.random() - 0.5) * 0.2 // Slight variation
            });
        }
        // Track damage source for UI indicator
        this._trackDamageSource(attackerPos);
        // Fire event for UI to show directional damage indicator
        this.app.fire('audio:directional_damage', {
            direction: direction,
            distance: attackerPos.distance(playerPos),
            position: attackerPos
        });
    }
    /**
     * Play weapon-specific audio when enemies fire
     * This allows player to identify weapon types by sound
     */ _onWeaponFired(data) {
        if (!data || !data.shooter || !this.player) return;
        const shooter = data.shooter;
        // Only process if an AI agent fired (not the player)
        if (shooter === this.player) return;
        if (shooter.tags && shooter.tags.has('player')) return;
        const weaponType = data.weaponType;
        const position = shooter.getPosition ? shooter.getPosition() : data.position;
        if (!weaponType || !position) return;
        // Check if shooter is AI
        if (!shooter.tags || !shooter.tags.has('ai_agent')) return;
        // Calculate distance to player
        const playerPos = this.player.getPosition();
        const distance = position.distance(playerPos);
        Logger.debug(`[DirectionalAudioSystem] Playing weapon sound: ${weaponType} from distance ${distance.toFixed(1)}m`);
        // Only play if within audible range (50 units)
        if (distance > 50) return;
        // Play weapon-specific sound with distance-based volume
        const volumeFalloff = Math.max(0.2, 1 - distance / 50);
        if (this.audioManager) {
            this.audioManager.playSound({
                sound: `${weaponType}_fire`,
                position: position,
                volume: volumeFalloff * 0.6,
                pitch: 1 + (Math.random() - 0.5) * 0.15
            });
        }
        // Fire event for UI threat indicator
        this.app.fire('audio:enemy_weapon_fire', {
            position: position,
            weaponType: weaponType,
            distance: distance
        });
    }
    /**
     * Play AI footstep sounds for environmental awareness
     */ _onFootstep(data) {
        if (!data || !data.entity || !this.player) return;
        const entity = data.entity;
        // Only process AI footsteps (not player's own)
        if (entity === this.player) return;
        if (entity.tags && entity.tags.has('player')) return;
        const position = entity.getPosition ? entity.getPosition() : data.position;
        if (!position) return;
        // Check if entity is AI
        if (!entity.tags || !entity.tags.has('ai_agent')) return;
        // Calculate distance to player
        const playerPos = this.player.getPosition();
        const distance = position.distance(playerPos);
        Logger.debug(`[DirectionalAudioSystem] Playing footstep from distance: ${distance.toFixed(1)}m`);
        // Only play if within audible range (15 units for footsteps)
        if (distance > 15) return;
        // Play footstep sound with distance-based volume
        const volumeFalloff = Math.max(0.1, 1 - distance / 15);
        if (this.audioManager) {
            this.audioManager.playSound({
                sound: 'footstep',
                position: position,
                volume: volumeFalloff * 0.4,
                pitch: 1 + (Math.random() - 0.5) * 0.1
            });
        }
    }
    /**
     * Play AI reload sounds - signals vulnerability window
     */ _onReloadStart(data) {
        if (!data || !data.entity || !this.player) return;
        const reloader = data.entity;
        // Only process if an AI agent is reloading (not the player)
        if (reloader === this.player) return;
        if (reloader.tags && reloader.tags.has('player')) return;
        const position = reloader.getPosition ? reloader.getPosition() : data.position;
        if (!position) return;
        // Check if reloader is AI
        if (!reloader.tags || !reloader.tags.has('ai_agent')) return;
        // Calculate distance to player
        const playerPos = this.player.getPosition();
        const distance = position.distance(playerPos);
        const weaponType = data.weaponType || 'unknown';
        Logger.debug(`[DirectionalAudioSystem] Playing reload sound for: ${weaponType} at ${distance.toFixed(1)}m`);
        // Only play if within audible range (30 units)
        if (distance > 30) return;
        // Play reload sound with distance-based volume
        const volumeFalloff = Math.max(0.2, 1 - distance / 30);
        if (this.audioManager) {
            this.audioManager.playSound({
                sound: 'reload',
                position: position,
                volume: volumeFalloff * 0.5,
                pitch: 1 + (Math.random() - 0.5) * 0.1
            });
        }
        // Fire event for UI to show "enemy reloading" indicator
        this.app.fire('audio:enemy_reloading', {
            position: position,
            distance: distance,
            entity: reloader
        });
    }
    /**
     * Track damage sources for UI visualization
     */ _trackDamageSource(position) {
        const now = performance.now();
        this.recentDamageSources.push({
            position: position.clone(),
            timestamp: now
        });
        // Keep only recent sources
        if (this.recentDamageSources.length > this.maxTrackedSources) {
            this.recentDamageSources.shift();
        }
    }
    update(dt) {
        if (!this.player || !this.audioManager) return;
        // Clean up old damage sources
        const now = performance.now();
        this.recentDamageSources = this.recentDamageSources.filter((source)=>now - source.timestamp < this.damageSourceLifetime);
    }
    /**
     * Get recent damage sources for UI rendering
     */ getRecentDamageSources() {
        return this.recentDamageSources;
    }
    _cleanup() {
        if (this._eventsBound) {
            this.app.off('entity:damaged', this._boundOnEntityDamage);
            this.app.off('weapon:fired', this._boundOnWeaponFired);
            this.app.off('footstep', this._boundOnFootstep);
            this.app.off('weapon:reload_start', this._boundOnReloadStart);
        }
        this._eventsBound = false;
        this.__dasBooted = false;
        Logger.debug('[DirectionalAudioSystem] Cleanup complete');
    }
}
_define_property(DirectionalAudioSystem, "scriptName", 'directionalAudioSystem');

export { DirectionalAudioSystem };
