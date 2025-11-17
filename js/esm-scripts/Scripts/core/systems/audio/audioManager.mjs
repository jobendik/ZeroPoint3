import * as playcanvasStable_min from '../../../../../playcanvas-stable.min.mjs';
import { Script, Asset, Entity, DISTANCE_EXPONENTIAL, math } from '../../../../../playcanvas-stable.min.mjs';
import { aiConfig } from '../../../config/ai.config.mjs';
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
class AudioManager extends Script {
    initialize() {
        if (this.__audioManagerBooted) {
            Logger.debug('[AudioManager] initialize() called twice; ignoring');
            return;
        }
        this._initialized = true;
        this._setupDefaultCooldowns();
        this.app.audioManager = this;
        // cleanup hook
        this.on('destroy', this._cleanup, this);
        Logger.debug('[AudioManager] initialize() complete');
    }
    postInitialize() {
        try {
            // Collect Inspector fields into a name→asset map
            this._collectSoundEffects();
            // Ensure core structures exist
            this.soundPools || (this.soundPools = new Map());
            this.activeSounds || (this.activeSounds = []);
            this.lastPlayTimes || (this.lastPlayTimes = new Map());
            this.soundCooldowns || (this.soundCooldowns = new Map());
            this._pendingPlays || (this._pendingPlays = []);
            // Build pools and wire events
            this._initializeSoundPools();
            this._setupEventListeners();
            this.__amBooted = true;
            this.__audioManagerBooted = true;
            this.app.fire?.('audioManager:ready', this);
            // Flush any queued plays
            if (this._pendingPlays.length) {
                const q = this._pendingPlays.slice();
                this._pendingPlays.length = 0;
                for (const req of q)this.playSound(req);
            }
            Logger.debug('[AudioManager] postInitialize complete');
        } catch (e) {
            Logger.error('[AudioManager] postInitialize ERROR:', e);
            // Avoid deadlocks on systems waiting for "ready"
            this.__amBooted = true;
            this.__audioManagerBooted = true;
        }
    }
    // Gather per-field @attribute assets into a simple dictionary
    _collectSoundEffects() {
        const names = [
            'pistol_fire',
            'machinegun_fire',
            'shotgun_fire',
            'reload',
            'empty_click',
            'weapon_draw',
            'weapon_holster',
            'pickup',
            'hit',
            'impact',
            'heal',
            'footstep',
            'player_hurt',
            'ai_hurt',
            'player_death',
            'ai_death',
            'death',
            'item_respawn',
            'whiff'
        ];
        const map = {};
        for (const n of names){
            const asset = this[n];
            if (asset) map[n] = asset;
        }
        this.soundEffects = map;
    }
    _setupEventListeners() {
        if (this._eventsBound) return;
        // Core audio api
        this._handlers.audioPlay = this.playSound.bind(this);
        this._handlers.audioStop = this.stopSound.bind(this);
        this._handlers.audioSetVolume = this.setVolume.bind(this);
        this.app.on('audio:play', this._handlers.audioPlay);
        this.app.on('audio:request:play', this._handlers.audioPlay);
        this.app.on('audio:stop', this._handlers.audioStop);
        this.app.on('audio:request:stop', this._handlers.audioStop);
        this.app.on('audio:set_volume', this._handlers.audioSetVolume);
        // Weapon events
        this._handlers.weaponFired = (data)=>{
            const soundName = data?.weaponType ? `${data.weaponType}_fire` : null;
            if (soundName) {
                this.playSound({
                    sound: soundName,
                    position: data.position,
                    pitch: 1 + (Math.random() - 0.5) * 0.1
                });
            }
        };
        this._handlers.weaponReloadStart = (data)=>{
            const soundName = data?.weaponType ? `${data.weaponType}_reload` : 'reload';
            this.playSound({
                sound: soundName,
                position: data?.position
            });
        };
        this._handlers.weaponEmptyClick = (data)=>{
            this.playSound({
                sound: 'empty_click',
                position: data?.position
            });
        };
        this._handlers.weaponSwitched = (data)=>{
            let pos = null;
            if (typeof data === 'string') {
                const cam = this.app.root.findByName('Camera');
                pos = cam ? cam.getPosition() : null;
            } else {
                pos = data?.position ?? null;
            }
            this.playSound({
                sound: 'weapon_draw',
                position: pos,
                volume: aiConfig.audio.WEAPON_DRAW_VOLUME
            });
        };
        this._handlers.weaponHolster = (data)=>{
            let pos = null;
            if (typeof data === 'string') {
                const cam = this.app.root.findByName('Camera');
                pos = cam ? cam.getPosition() : null;
            } else {
                pos = data?.position ?? null;
            }
            this.playSound({
                sound: 'weapon_holster',
                position: pos,
                volume: aiConfig.audio.WEAPON_HOLSTER_VOLUME
            });
        };
        this.app.on('weapon:fired', this._handlers.weaponFired);
        this.app.on('weapon:reload_start', this._handlers.weaponReloadStart);
        this.app.on('weapon:empty_click', this._handlers.weaponEmptyClick);
        this.app.on('weapon:switched', this._handlers.weaponSwitched);
        this.app.on('weapon:holster', this._handlers.weaponHolster);
        this._eventsBound = true;
        Logger.debug('[AudioManager] Event listeners bound');
    }
    _cleanup() {
        // Unwire events with the original function refs
        if (this._eventsBound) {
            this.app.off('audio:play', this._handlers.audioPlay);
            this.app.off('audio:request:play', this._handlers.audioPlay);
            this.app.off('audio:stop', this._handlers.audioStop);
            this.app.off('audio:request:stop', this._handlers.audioStop);
            this.app.off('audio:set_volume', this._handlers.audioSetVolume);
            this.app.off('weapon:fired', this._handlers.weaponFired);
            this.app.off('weapon:reload_start', this._handlers.weaponReloadStart);
            this.app.off('weapon:empty_click', this._handlers.weaponEmptyClick);
            this.app.off('weapon:switched', this._handlers.weaponSwitched);
            this.app.off('weapon:holster', this._handlers.weaponHolster);
        }
        this._eventsBound = false;
        this.__amBooted = false;
        this.__audioManagerBooted = false;
        // Stop and clear active sounds
        this.stopAllSounds();
        // Clear queues/state
        this._pendingPlays.length = 0;
        this._handlers = {};
        // Detach singleton pointer if set
        if (this.app.audioManager === this) this.app.audioManager = null;
        Logger.debug('[AudioManager] Cleanup complete');
    }
    _setupDefaultCooldowns() {
        this.soundCooldowns.set('footstep', 100);
        this.soundCooldowns.set('pistol_fire', 50);
        this.soundCooldowns.set('machinegun_fire', 30);
        this.soundCooldowns.set('shotgun_fire', 200);
        this.soundCooldowns.set('impact', 50);
        this.soundCooldowns.set('hit', 100);
        this.soundCooldowns.set('pickup', 200);
        this.soundCooldowns.set('reload', 500);
        this.soundCooldowns.set('empty_click', 200);
        this.soundCooldowns.set('weapon_draw', 300);
        this.soundCooldowns.set('weapon_holster', 300);
    }
    reset() {
        this.stopAllSounds();
        this.lastPlayTimes.clear();
        this.masterVolume = aiConfig.audio.MASTER_VOLUME_DEFAULT;
        this.sfxVolume = aiConfig.audio.SFX_VOLUME_DEFAULT;
        Logger.debug('[AudioManager] Reset complete');
    }
    _initializeSoundPools() {
        for(const name in this.soundEffects){
            if (this.soundEffects[name]) {
                this.soundPools.set(name, []);
                this._createSoundPool(name, 4);
            }
        }
    }
    // Resolve various asset forms to a usable pc.Asset (or null)
    _resolveAudioAsset(assetLike) {
        if (!assetLike) return null;
        // Already an Asset?
        if (assetLike instanceof Asset) return assetLike;
        // ESM Inspector usually gives a pc.Asset; but be defensive:
        const assets = this.app?.assets;
        if (!assets) return null;
        // Numeric/string ID → resolve
        if (typeof assetLike === 'number') return assets.get(assetLike) || null;
        if (typeof assetLike === 'string') {
            // Try by ID first, then by name
            const byId = assets.get(assetLike);
            if (byId) return byId;
            const list = assets.find(assetLike, 'audio');
            return list?.[0] || null;
        }
        return null;
    }
    _createSoundPool(soundName, poolSize) {
        const raw = this.soundEffects[soundName];
        const soundAsset = this._resolveAudioAsset(raw);
        if (!soundAsset) {
            Logger.warn(`[AudioManager] No asset mapped/resolved for '${soundName}'`);
            return;
        }
        const pool = this.soundPools.get(soundName);
        for(let i = 0; i < poolSize; i++){
            const soundEntity = new Entity(`Sound_${soundName}_${i}`);
            soundEntity.addComponent('sound');
            try {
                soundEntity.sound.addSlot(soundName, {
                    asset: soundAsset,
                    volume: this.sfxVolume,
                    loop: false,
                    autoPlay: false,
                    overlap: true,
                    pitch: 1.0
                });
            } catch (e) {
                Logger.warn(`[AudioManager] Failed to add slot '${soundName}'`, e);
                continue;
            }
            if (this.enableSpatialAudio) {
                soundEntity.sound.positional = true;
                soundEntity.sound.refDistance = 5;
                soundEntity.sound.maxDistance = this.soundFalloffDistance;
                soundEntity.sound.rollOffFactor = 1;
                soundEntity.sound.distanceModel = DISTANCE_EXPONENTIAL;
            }
            this.app.root.addChild(soundEntity);
            pool.push({
                entity: soundEntity,
                inUse: false,
                slot: soundName,
                timeoutId: null
            });
        }
    }
    // --- Public API: play a sound by name or options
    playSound(options) {
        if (typeof options === 'string') options = {
            sound: options
        };
        let { sound: soundName, position, volume = 1.0, pitch = 1.0, loop = false } = options ?? {};
        if (!soundName) return null;
        if (!this._initialized || !this.__amBooted || !this._eventsBound) {
            this._pendingPlays.push(options);
            return null;
        }
        if (this._isOnCooldown(soundName)) return null;
        // Fallback for per-weapon reload sounds
        if (soundName.endsWith('_reload') && !this.soundEffects[soundName]) {
            soundName = 'reload';
        }
        let soundObj = this._getAvailableSound(soundName);
        if (!soundObj) {
            // Try to create pool on-demand if mapping exists
            if (this.soundEffects?.[soundName]) {
                this.soundPools.set(soundName, []);
                this._createSoundPool(soundName, 4);
                soundObj = this._getAvailableSound(soundName);
            } else {
                Logger.warn(`[AudioManager] No mapping for '${soundName}'`);
                return null;
            }
        }
        const soundEntity = soundObj.entity;
        const soundComponent = soundEntity.sound;
        if (position && this.enableSpatialAudio) soundEntity.setPosition(position);
        const slot = soundComponent.slot(soundName);
        if (slot) {
            slot.volume = volume * this.sfxVolume * this.masterVolume;
            slot.pitch = pitch;
            slot.loop = loop;
        } else {
            Logger.warn(`[AudioManager] Slot '${soundName}' not found`);
        }
        try {
            soundComponent.play(soundName);
        } catch (e) {
            Logger.error(`[AudioManager] Play failed '${soundName}'`, e);
            return null;
        }
        soundObj.inUse = true;
        this.activeSounds.push(soundObj);
        this._setPlayCooldown(soundName);
        if (!loop) {
            const duration = this._getSoundDuration(soundName, slot);
            soundObj.timeoutId = setTimeout(()=>{
                if (!this._eventsBound) return;
                this._returnSoundToPool(soundObj);
            }, duration * 1000 * (1 / (pitch || 1)));
        }
        return soundObj;
    }
    // Convenience: play with random pitch jitter (kept from classic)
    playSoundVaried(soundName, position, pitchRange = 0.1) {
        const pitchVariation = 1 + (Math.random() - 0.5) * pitchRange * 2;
        return this.playSound({
            sound: soundName,
            position,
            pitch: pitchVariation
        });
    }
    _getAvailableSound(soundName) {
        const pool = this.soundPools.get(soundName);
        if (!pool) return null;
        for (const s of pool)if (!s.inUse) return s;
        // Fallback policy: reuse the first
        if (pool.length > 0) {
            const s = pool[0];
            this._returnSoundToPool(s);
            return s;
        }
        return null;
    }
    _returnSoundToPool(soundObj) {
        if (!soundObj?.inUse) return;
        if (soundObj.timeoutId) {
            clearTimeout(soundObj.timeoutId);
            soundObj.timeoutId = null;
        }
        soundObj.inUse = false;
        if (soundObj.entity?.sound) {
            try {
                soundObj.entity.sound.stop();
            } catch (_) {}
        }
        const i = this.activeSounds.indexOf(soundObj);
        if (i > -1) this.activeSounds.splice(i, 1);
    }
    _isOnCooldown(soundName) {
        const cd = this.soundCooldowns.get(soundName);
        if (!cd) return false;
        const last = this.lastPlayTimes.get(soundName);
        if (!last) return false;
        return performance.now() - last < cd;
    }
    _setPlayCooldown(soundName) {
        this.lastPlayTimes.set(soundName, performance.now());
    }
    _getSoundDuration(soundName, slot) {
        // Prefer engine clip duration if available
        try {
            const asset = this._resolveAudioAsset(this.soundEffects[soundName]);
            const clip = asset?.resource; // pc.Sound
            if (clip?.duration) return clip.duration;
        } catch (_) {}
        // Fallback heuristics table
        const d = {
            pistol_fire: 0.3,
            machinegun_fire: 0.1,
            shotgun_fire: 0.5,
            reload: 2.0,
            empty_click: 0.2,
            weapon_draw: 0.4,
            weapon_holster: 0.3,
            pickup: 0.4,
            hit: 0.2,
            impact: 0.3,
            heal: 0.5,
            footstep: 0.2,
            player_hurt: 0.4,
            ai_hurt: 0.4,
            player_death: 1.0,
            ai_death: 1.0,
            death: 1.0,
            item_respawn: 0.6,
            whiff: 0.2
        };
        return d[soundName] ?? 1.0;
    }
    stopSound(options) {
        if (typeof options === 'string') options = {
            sound: options
        };
        const soundName = options?.sound;
        if (!soundName) return;
        // Stop all active instances of a named sound
        for (const s of this.activeSounds.slice()){
            if (s.slot === soundName) this._returnSoundToPool(s);
        }
    }
    stopAllSounds() {
        for (const s of this.activeSounds.slice())this._returnSoundToPool(s);
        for (const [, pool] of this.soundPools){
            for (const s of pool){
                if (s.entity?.sound) {
                    try {
                        s.entity.sound.stop();
                    } catch (_) {}
                    s.inUse = false;
                }
            }
        }
        this.activeSounds.length = 0;
    }
    setVolume(options) {
        if (!options) return;
        if (options.master !== undefined) this.masterVolume = Math.max(0, Math.min(1, options.master));
        if (options.sfx !== undefined) this.sfxVolume = Math.max(0, Math.min(1, options.sfx));
        // Update currently playing slots
        for (const s of this.activeSounds){
            const slot = s.entity?.sound?.slot(s.slot);
            if (slot) slot.volume = this.sfxVolume * this.masterVolume;
        }
    }
    update(dt) {
        if (!this._initialized || !this.activeSounds) return;
        this._cleanupFinishedSounds();
        this._limitSimultaneousSounds();
    }
    _cleanupFinishedSounds() {
        for(let i = this.activeSounds.length - 1; i >= 0; i--){
            const s = this.activeSounds[i];
            const slot = s.entity?.sound?.slot(s.slot);
            if (!slot || !slot.isPlaying) this._returnSoundToPool(s);
        }
    }
    _limitSimultaneousSounds() {
        if (this.activeSounds.length <= this.maxSimultaneousSounds) return;
        const camera = this.app.root.findByName('Camera');
        if (!camera) return;
        const camPos = camera.getPosition();
        const withDist = this.activeSounds.map((s)=>({
                s,
                d: s.entity.getPosition().distance(camPos)
            }));
        withDist.sort((a, b)=>b.d - a.d); // farthest first
        const toStop = withDist.length - this.maxSimultaneousSounds;
        for(let i = 0; i < toStop; i++)this._returnSoundToPool(withDist[i].s);
    }
    // Convenience API
    playWeaponSound(weaponType, soundType, position, options = {}) {
        const soundName = soundType.includes('_') ? soundType : `${weaponType}_${soundType}`;
        return this.playSound({
            sound: soundName,
            position,
            volume: options.volume ?? 1.0,
            pitch: options.pitch ?? 1 + (Math.random() - 0.5) * 0.1
        });
    }
    playWeaponFireSound(weaponType, position) {
        return this.playWeaponSound(weaponType, 'fire', position);
    }
    playReloadSound(position) {
        return this.playSound({
            sound: 'reload',
            position
        });
    }
    playEmptyClick(position) {
        return this.playSound({
            sound: 'empty_click',
            position
        });
    }
    // === Fading utilities (parity with classic) ===
    fadeIn(soundName, duration, position, finalVolume = 1.0) {
        const soundObj = this.playSound({
            sound: soundName,
            position,
            volume: 0
        });
        if (soundObj) this.fadeSoundTo(soundObj, finalVolume, duration);
        return soundObj;
    }
    fadeOut(soundObj, duration) {
        this.fadeSoundTo(soundObj, 0, duration, ()=>this._returnSoundToPool(soundObj));
    }
    fadeSoundTo(soundObj, targetVolume, duration, onDone) {
        if (!soundObj?.entity?.sound) return;
        const comp = soundObj.entity.sound;
        const slot = comp.slot(soundObj.slot);
        if (!slot) return;
        const clamp = (v, a, b)=>typeof playcanvasStable_min !== 'undefined' && math?.clamp ? math.clamp(v, a, b) : Math.min(Math.max(v, a), b);
        const lerp = (a, b, t)=>typeof playcanvasStable_min !== 'undefined' && math?.lerp ? math.lerp(a, b, t) : a + (b - a) * t;
        const startVolume = clamp(slot.volume ?? 0, 0, 1);
        const startTime = performance.now();
        const total = Math.max(duration || 0.0001, 0.0001);
        const step = ()=>{
            // guards
            if (!this._eventsBound || !soundObj?.entity?.sound) return;
            const s = soundObj.entity.sound.slot(soundObj.slot);
            if (!s) return;
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed / total, 1);
            s.volume = clamp(lerp(startVolume, targetVolume, t), 0, 1);
            if (t < 1) requestAnimationFrame(step);
            else if (onDone) onDone();
        };
        requestAnimationFrame(step);
    }
    // Status for debugging/telemetry
    getStatus() {
        return {
            initialized: this._initialized,
            booted: this.__amBooted,
            activeSounds: this.activeSounds.length,
            totalPools: this.soundPools.size,
            masterVolume: this.masterVolume,
            sfxVolume: this.sfxVolume
        };
    }
    destroy() {
        this._cleanup();
    }
    constructor(...args){
        super(...args);
        // ====== AUDIO ASSET ATTRIBUTES (Inspector pickers) ======
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Pistol Fire */ _define_property(this, "pistol_fire", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Machinegun Fire */ _define_property(this, "machinegun_fire", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Shotgun Fire */ _define_property(this, "shotgun_fire", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Reload */ _define_property(this, "reload", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Empty Click */ _define_property(this, "empty_click", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Weapon Draw */ _define_property(this, "weapon_draw", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Weapon Holster */ _define_property(this, "weapon_holster", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Pickup */ _define_property(this, "pickup", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Hit */ _define_property(this, "hit", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Impact */ _define_property(this, "impact", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Heal */ _define_property(this, "heal", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Footstep */ _define_property(this, "footstep", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Player Hurt */ _define_property(this, "player_hurt", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title AI Hurt */ _define_property(this, "ai_hurt", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Player Death */ _define_property(this, "player_death", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title AI Death */ _define_property(this, "ai_death", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Generic Death */ _define_property(this, "death", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Item Respawn */ _define_property(this, "item_respawn", null);
        /** @attribute @type {pc.Asset} @assetType 'audio' @title Whiff */ _define_property(this, "whiff", null);
        // ====== OTHER TUNABLES ======
        /** @attribute @type {number} @range [0, 1] @title Master Volume */ _define_property(this, "masterVolume", aiConfig.audio.MASTER_VOLUME_DEFAULT);
        /** @attribute @type {number} @range [0, 1] @title SFX Volume */ _define_property(this, "sfxVolume", aiConfig.audio.SFX_VOLUME_DEFAULT);
        /** @attribute @type {number} @title Max Simultaneous Sounds */ _define_property(this, "maxSimultaneousSounds", aiConfig.audio.MAX_SIMULTANEOUS_SOUNDS);
        /** @attribute @type {number} @title Sound Falloff Distance */ _define_property(this, "soundFalloffDistance", aiConfig.audio.SOUND_FALLOFF_DISTANCE);
        /** @attribute @type {boolean} @title Enable Spatial Audio */ _define_property(this, "enableSpatialAudio", true);
        // ====== INTERNALS ======
        _define_property(this, "soundEffects", {}) // name → pc.Asset
        ;
        _define_property(this, "soundPools", new Map()) // name → [{ entity, inUse, slot, timeoutId }]
        ;
        _define_property(this, "activeSounds", []) // currently in-use sound objects from pools
        ;
        _define_property(this, "lastPlayTimes", new Map()) // name → ms timestamp
        ;
        _define_property(this, "soundCooldowns", new Map()) // name → ms cooldown
        ;
        _define_property(this, "_pendingPlays", []) // queued plays until boot is done
        ;
        _define_property(this, "_eventsBound", false);
        _define_property(this, "_initialized", false);
        _define_property(this, "__amBooted", false);
        _define_property(this, "__audioManagerBooted", false);
        _define_property(this, "_handlers", {}) // bound event handlers for proper .off()
        ;
    }
}
_define_property(AudioManager, "scriptName", 'audioManager');

export { AudioManager as default };
