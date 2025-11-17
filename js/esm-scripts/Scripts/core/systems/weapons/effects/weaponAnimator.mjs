import { Script, Vec3 } from '../../../../../../playcanvas-stable.min.mjs';
import { CubicOut, CubicIn, BounceOut } from './tween.mjs';
import { aiConfig } from '../../../../config/ai.config.mjs';
import { Logger } from '../../../engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
/**
 * Minimal helper: try to find a plausible mesh child if graphicsEntity is not set.
 */ function autoFindGraphicsEntity(root) {
    if (!root) return null;
    // Prefer a child with a render/animation/graphics-ish name
    const preferredNames = [
        'Model',
        'Graphics',
        'Mesh',
        'Pistol',
        'MachineGun',
        'Shotgun',
        'Weapon',
        'ViewModel'
    ];
    for (const name of preferredNames){
        const child = root.findByName?.(name);
        if (child) return child;
    }
    // Fallback: first child with a render component
    const stack = [
        root
    ];
    while(stack.length){
        const e = stack.shift();
        if (e?.render || e?.model) return e;
        const children = e?.children || [];
        for(let i = 0; i < children.length; i++)stack.push(children[i]);
    }
    return root;
}
/**
 * Map app-level weaponType ("pistol","machinegun","shotgun") to entity animator weaponType (same).
 */ function normalizeType(type) {
    return (type || '').toLowerCase();
}
/**
 * WeaponAnimator
 * Listens to app-level weapon events and animates this weapon's graphics if it matches
 */ class WeaponAnimator extends Script {
    initialize() {
        // Initialize graphicsEntity (not an attribute to avoid type validation issues)
        this.graphicsEntity = null;
        // normalize configured type
        this.weaponType = normalizeType(this.weaponType);
        // tween availability check
        if (typeof this.entity.tween !== 'function') {
            Logger.warn('[WeaponAnimator] Tween extension not installed on Entity.prototype. Import tween.mjs early.');
        }
        // graphics entity resolution
        if (!this.graphicsEntity) {
            this.graphicsEntity = autoFindGraphicsEntity(this.entity);
        }
        // store original transform (local)
        this._origPos = this.graphicsEntity.getLocalPosition().clone();
        this._origRot = this.graphicsEntity.getLocalEulerAngles().clone();
        this._activeTweens = new Set();
        this._isReloadAnimating = false;
        // App-level listeners (KEY FIX: listen on app, not only entity)
        this._unbind = [];
        const onFired = (data)=>{
            if (this._matches(data)) this.playFireAnimation(data);
        };
        const onReloadStart = (data)=>{
            if (this._matches(data)) this.playReloadAnimation(data);
        };
        const onReloadComplete = (data)=>{
            if (this._matches(data)) this.onReloadComplete(data);
        };
        const onSwitched = (data)=>{
            // Holster if this weapon was active and is now not; draw if it becomes active
            if (!data?.weaponType) return;
            const t = normalizeType(data.weaponType);
            if (t === this.weaponType) this.playDrawAnimation(data);
            else this.playHolsterAnimation(data);
        };
        this.app.on('weapon:fired', onFired);
        this.app.on('weapon:reload_start', onReloadStart);
        this.app.on('weapon:reload_complete', onReloadComplete);
        this.app.on('weapon:switched', onSwitched);
        this._unbind.push(()=>this.app.off('weapon:fired', onFired));
        this._unbind.push(()=>this.app.off('weapon:reload_start', onReloadStart));
        this._unbind.push(()=>this.app.off('weapon:reload_complete', onReloadComplete));
        this._unbind.push(()=>this.app.off('weapon:switched', onSwitched));
        if (this.debugMode) {
            Logger.debug(`[WeaponAnimator] ready on ${this.entity.name}, type=${this.weaponType}, gfx=${this.graphicsEntity?.name}`);
        }
    }
    /**
     * Decide if this animator should react to the event.
     * ✅ CRITICAL FIX: Must check if event is for THIS entity's weapon, not just any weapon!
     */ _matches(data) {
        // ✅ FIRST: Check if this event is for the correct OWNER entity
        // The weapon:fired event includes shooter/entity - check if it matches our weapon's owner
        const eventEntity = data?.shooter || data?.entity;
        if (eventEntity) {
            // Find the owner of this weapon (usually parent or grandparent of the weapon model)
            let weaponOwner = this.entity;
            // Walk up the hierarchy to find the entity with a weaponSystem
            while(weaponOwner && !weaponOwner.script?.weaponSystem){
                weaponOwner = weaponOwner.parent;
            }
            // If the event is from a different entity, ignore it
            if (weaponOwner && eventEntity !== weaponOwner) {
                return false;
            }
        }
        // ✅ SECOND: Check weapon type matches
        const t = normalizeType(data?.weaponType);
        if (t && this.weaponType && t === this.weaponType) return true;
        // fallback heuristics (if weaponType missing or wrong)
        const name = (this.entity?.name || '').toLowerCase();
        if (t && name.includes(t)) return true;
        // Only allow if entity is enabled AND we confirmed owner above
        if (this.entity?.enabled && eventEntity) return true;
        return false;
    }
    // ---- tween helpers -------------------------------------------------------
    _track(tween) {
        if (!tween) return null;
        this._activeTweens.add(tween);
        tween.onComplete(()=>this._activeTweens.delete(tween));
        return tween;
    }
    _stopAllTweens() {
        for (const t of this._activeTweens){
            try {
                t.stop();
            } catch  {}
        }
        this._activeTweens.clear();
    }
    _setIdle() {
        this.graphicsEntity.setLocalPosition(this._origPos);
        this.graphicsEntity.setLocalEulerAngles(this._origRot);
    }
    // ---- public animations ---------------------------------------------------
    playFireAnimation() {
        const g = this.graphicsEntity;
        const p0 = this._origPos.clone();
        const r0 = this._origRot.clone();
        // choose pattern per weapon
        const type = this.weaponType;
        let recoilPos, recoilRot, t1, t2;
        switch(type){
            case 'machinegun':
                recoilPos = p0.clone().add(new Vec3(aiConfig.weapons.MACHINEGUN_RECOIL_POS_X * this.recoilIntensity, aiConfig.weapons.MACHINEGUN_RECOIL_POS_Y * this.recoilIntensity, aiConfig.weapons.MACHINEGUN_RECOIL_POS_Z * this.recoilIntensity));
                recoilRot = r0.clone().add(new Vec3(aiConfig.weapons.MACHINEGUN_RECOIL_ROT_X * this.recoilIntensity, aiConfig.weapons.MACHINEGUN_RECOIL_ROT_Y * this.recoilIntensity, aiConfig.weapons.MACHINEGUN_RECOIL_ROT_Z * this.recoilIntensity));
                t1 = this.fireAnimationDuration * aiConfig.weapons.MACHINEGUN_RECOIL_IN_FRACTION;
                t2 = this.fireAnimationDuration * aiConfig.weapons.MACHINEGUN_RECOIL_OUT_FRACTION;
                break;
            case 'shotgun':
                recoilPos = p0.clone().add(new Vec3(aiConfig.weapons.SHOTGUN_RECOIL_POS_X * this.recoilIntensity, aiConfig.weapons.SHOTGUN_RECOIL_POS_Y * this.recoilIntensity, aiConfig.weapons.SHOTGUN_RECOIL_POS_Z * this.recoilIntensity));
                recoilRot = r0.clone().add(new Vec3(aiConfig.weapons.SHOTGUN_RECOIL_ROT_X * this.recoilIntensity, aiConfig.weapons.SHOTGUN_RECOIL_ROT_Y * this.recoilIntensity, aiConfig.weapons.SHOTGUN_RECOIL_ROT_Z * this.recoilIntensity));
                t1 = this.fireAnimationDuration * aiConfig.weapons.SHOTGUN_RECOIL_IN_FRACTION;
                t2 = this.fireAnimationDuration * aiConfig.weapons.SHOTGUN_RECOIL_OUT_FRACTION;
                break;
            case 'rocketlauncher':
                recoilPos = p0.clone().add(new Vec3(aiConfig.weapons.ROCKETLAUNCHER_RECOIL_POS_X * this.recoilIntensity, aiConfig.weapons.ROCKETLAUNCHER_RECOIL_POS_Y * this.recoilIntensity, aiConfig.weapons.ROCKETLAUNCHER_RECOIL_POS_Z * this.recoilIntensity));
                recoilRot = r0.clone().add(new Vec3(aiConfig.weapons.ROCKETLAUNCHER_RECOIL_ROT_X * this.recoilIntensity, aiConfig.weapons.ROCKETLAUNCHER_RECOIL_ROT_Y * this.recoilIntensity, aiConfig.weapons.ROCKETLAUNCHER_RECOIL_ROT_Z * this.recoilIntensity));
                t1 = this.fireAnimationDuration * aiConfig.weapons.ROCKETLAUNCHER_RECOIL_IN_FRACTION;
                t2 = this.fireAnimationDuration * aiConfig.weapons.ROCKETLAUNCHER_RECOIL_OUT_FRACTION;
                break;
            default:
                recoilPos = p0.clone().add(new Vec3(aiConfig.weapons.PISTOL_RECOIL_POS_X * this.recoilIntensity, aiConfig.weapons.PISTOL_RECOIL_POS_Y * this.recoilIntensity, aiConfig.weapons.PISTOL_RECOIL_POS_Z * this.recoilIntensity));
                recoilRot = r0.clone().add(new Vec3(aiConfig.weapons.PISTOL_RECOIL_ROT_X * this.recoilIntensity, aiConfig.weapons.PISTOL_RECOIL_ROT_Y * this.recoilIntensity, aiConfig.weapons.PISTOL_RECOIL_ROT_Z * this.recoilIntensity));
                t1 = this.fireAnimationDuration * aiConfig.weapons.PISTOL_RECOIL_IN_FRACTION;
                t2 = this.fireAnimationDuration * aiConfig.weapons.PISTOL_RECOIL_OUT_FRACTION;
        }
        this._stopAllTweens();
        const tw1 = this._track(g.tween(g.getLocalPosition(), {
            apply: 'position'
        }).to(recoilPos, t1, CubicOut));
        const tw2 = this._track(g.tween(g.getLocalEulerAngles(), {
            apply: 'eulerAngles'
        }).to(recoilRot, t1, CubicOut));
        tw2.onComplete(()=>{
            const backPos = type === 'shotgun' ? BounceOut : CubicOut;
            const tw3 = this._track(g.tween(g.getLocalPosition(), {
                apply: 'position'
            }).to(p0, t2, backPos));
            const tw4 = this._track(g.tween(g.getLocalEulerAngles(), {
                apply: 'eulerAngles'
            }).to(r0, t2, backPos));
            tw3.start();
            tw4.start();
        });
        tw1?.start();
        tw2?.start();
    }
    playReloadAnimation() {
        const g = this.graphicsEntity;
        const p0 = this._origPos.clone();
        const r0 = this._origRot.clone();
        const downPos = p0.clone().add(new Vec3(0, aiConfig.weapons.RELOAD_DOWN_POS_Y, aiConfig.weapons.RELOAD_DOWN_POS_Z));
        const downRot = r0.clone().add(new Vec3(aiConfig.weapons.RELOAD_DOWN_ROT_X, 0, 0));
        const t = this.reloadDuration * aiConfig.weapons.RELOAD_ANIMATION_FRACTION;
        this._stopAllTweens();
        this._isReloadAnimating = true;
        const tw1 = this._track(g.tween(g.getLocalPosition(), {
            apply: 'position'
        }).to(downPos, t, CubicOut));
        const tw2 = this._track(g.tween(g.getLocalEulerAngles(), {
            apply: 'eulerAngles'
        }).to(downRot, t, CubicOut));
        tw1?.start();
        tw2?.start();
    }
    onReloadComplete() {
        const g = this.graphicsEntity;
        const p0 = this._origPos.clone();
        const r0 = this._origRot.clone();
        const t = this.reloadDuration * aiConfig.weapons.RELOAD_ANIMATION_FRACTION;
        const tw1 = this._track(g.tween(g.getLocalPosition(), {
            apply: 'position'
        }).to(p0, t, CubicOut));
        const tw2 = this._track(g.tween(g.getLocalEulerAngles(), {
            apply: 'eulerAngles'
        }).to(r0, t, CubicOut));
        tw1?.start();
        tw2?.start();
        this._isReloadAnimating = false;
    }
    playDrawAnimation() {
        const g = this.graphicsEntity;
        const p0 = this._origPos.clone();
        const r0 = this._origRot.clone();
        const startPos = p0.clone().add(new Vec3(0, aiConfig.weapons.DRAW_START_POS_Y, 0));
        this._stopAllTweens();
        g.setLocalPosition(startPos);
        g.setLocalEulerAngles(r0);
        const tw1 = this._track(g.tween(g.getLocalPosition(), {
            apply: 'position'
        }).to(p0, this.drawDuration, CubicOut));
        const tw2 = this._track(g.tween(g.getLocalEulerAngles(), {
            apply: 'eulerAngles'
        }).to(r0, this.drawDuration, CubicOut));
        tw1?.start();
        tw2?.start();
    }
    playHolsterAnimation() {
        const g = this.graphicsEntity;
        const p0 = this._origPos.clone();
        const r0 = this._origRot.clone();
        const endPos = p0.clone().add(new Vec3(0, aiConfig.weapons.DRAW_START_POS_Y, 0));
        this._stopAllTweens();
        const tw1 = this._track(g.tween(g.getLocalPosition(), {
            apply: 'position'
        }).to(endPos, this.holsterDuration, CubicIn));
        const tw2 = this._track(g.tween(g.getLocalEulerAngles(), {
            apply: 'eulerAngles'
        }).to(r0, this.holsterDuration, CubicIn));
        tw2?.onComplete(()=>this._setIdle());
        tw1?.start();
        tw2?.start();
    }
    resetToIdle() {
        this._stopAllTweens();
        this._setIdle();
    }
    destroy() {
        this._stopAllTweens();
        for (const u of this._unbind){
            try {
                u();
            } catch  {}
        }
        this._unbind.length = 0;
    }
    swap(old) {
        if (old) old._stopAllTweens?.();
        // refresh base pose
        this._origPos = this.graphicsEntity.getLocalPosition().clone();
        this._origRot = this.graphicsEntity.getLocalEulerAngles().clone();
        this.resetToIdle();
    }
    constructor(...args){
        super(...args);
        /** @attribute {string} weaponType */ _define_property(this, "weaponType", 'pistol') // pistol | machinegun | shotgun | rocketlauncher
        ;
        /** @attribute {number} recoilIntensity */ _define_property(this, "recoilIntensity", aiConfig.weapons.RECOIL_INTENSITY_DEFAULT);
        /** @attribute {number} fireAnimationDuration */ _define_property(this, "fireAnimationDuration", aiConfig.weapons.FIRE_ANIMATION_DURATION);
        /** @attribute {number} reloadDuration */ _define_property(this, "reloadDuration", aiConfig.weapons.RELOAD_ANIMATION_DURATION);
        /** @attribute {number} drawDuration */ _define_property(this, "drawDuration", aiConfig.weapons.DRAW_ANIMATION_DURATION);
        /** @attribute {number} holsterDuration */ _define_property(this, "holsterDuration", aiConfig.weapons.HOLSTER_ANIMATION_DURATION);
        /** @attribute {boolean} debugMode */ _define_property(this, "debugMode", false);
    }
}
_define_property(WeaponAnimator, "scriptName", 'weaponAnimator');

export { WeaponAnimator };
