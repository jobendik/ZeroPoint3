import { Script } from '../../../../../../playcanvas-stable.min.mjs';

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
class WeaponVisualManager extends Script {
    initialize() {
        this._unbind = [];
        this._pendingPickupTimer = null;
        const forward = (evt, data)=>{
            // ✅ CRITICAL FIX: Only forward events meant for THIS entity
            const eventEntity = data?.shooter || data?.entity;
            if (eventEntity && eventEntity !== this.entity) {
                // This event is for a different entity (e.g., AI firing, not player)
                return;
            }
            if (data?.weaponType) {
                this.currentWeaponType = String(data.weaponType).toLowerCase();
            }
            this._selectActiveWeaponEntity(this.currentWeaponType);
            this.activeWeaponEntity?.fire?.(evt, data);
        };
        // Standard weapon flow
        const onFired = (d)=>forward('weapon:fire', d);
        const onReloadStart = (d)=>forward('weapon:reload', d);
        const onReloadComplete = (d)=>forward('weapon:reload_complete', d);
        // Switch → holster old, draw new
        const onSwitched = (d)=>{
            forward('weapon:holster', {
                weaponType: 'previous'
            });
            forward('weapon:draw', d);
        };
        // === NEW: handle pickups ===
        // Your pickup system fires these on success:
        //   - item:picked_up
        //   - pickup:completed:picked_up
        // For weapon pickups we schedule a short delayed draw to occur
        // after weaponSystem has enabled the new model via switchWeapon().
        const schedulePickupDraw = (type)=>{
            if (!type) return;
            const t = String(type).toLowerCase();
            if (![
                'pistol',
                'machinegun',
                'shotgun',
                'rocketlauncher'
            ].includes(t)) return;
            this.currentWeaponType = t;
            // Cancel any previous scheduled draw (multiple overlapping pickups)
            if (this._pendingPickupTimer) {
                clearTimeout(this._pendingPickupTimer);
                this._pendingPickupTimer = null;
            }
            // Wait a tick longer than the switch (pickup uses ~100ms)
            this._pendingPickupTimer = setTimeout(()=>{
                this._pendingPickupTimer = null;
                this._selectActiveWeaponEntity(this.currentWeaponType);
                // Only draw if we have an entity; switch should have enabled it
                if (this.activeWeaponEntity) {
                    this.activeWeaponEntity.fire('weapon:draw', {
                        weaponType: this.currentWeaponType
                    });
                }
            }, 140);
        };
        const onItemPickedUp = (d)=>schedulePickupDraw(d?.itemType);
        const onPickupCompletedPicked = (d)=>schedulePickupDraw(d?.itemType);
        // App-level wiring
        this.app.on('weapon:fired', onFired);
        this.app.on('weapon:reload_start', onReloadStart);
        this.app.on('weapon:reload_complete', onReloadComplete);
        this.app.on('weapon:switched', onSwitched);
        // NEW: listen to your pickup events
        this.app.on('item:picked_up', onItemPickedUp);
        this.app.on('pickup:completed:picked_up', onPickupCompletedPicked);
        // (Optional) other names some projects use — harmless if never fired
        const onEquipped = (d)=>forward('weapon:draw', d);
        this.app.on('weapon:equipped', onEquipped);
        // Unbinders
        this._unbind.push(()=>this.app.off('weapon:fired', onFired));
        this._unbind.push(()=>this.app.off('weapon:reload_start', onReloadStart));
        this._unbind.push(()=>this.app.off('weapon:reload_complete', onReloadComplete));
        this._unbind.push(()=>this.app.off('weapon:switched', onSwitched));
        this._unbind.push(()=>this.app.off('item:picked_up', onItemPickedUp));
        this._unbind.push(()=>this.app.off('pickup:completed:picked_up', onPickupCompletedPicked));
        this._unbind.push(()=>this.app.off('weapon:equipped', onEquipped));
    }
    _selectActiveWeaponEntity(type) {
        // If you’ve already set it in the Editor and it’s enabled, keep it
        if (this.activeWeaponEntity && this.activeWeaponEntity.enabled) return;
        const parent = this.entity || this.app.root;
        const proper = type ? type.charAt(0).toUpperCase() + type.slice(1) : null;
        // Prefer a direct child named "Pistol" / "MachineGun" / "Shotgun" / "RocketLauncher"
        let candidate = proper ? parent.findByName?.(proper) : null;
        // Fallback: any child whose name contains the type
        if (!candidate && type) {
            const lower = (s)=>(s || '').toLowerCase();
            candidate = (parent.children || []).find((c)=>lower(c?.name).includes(type));
        }
        if (candidate) this.activeWeaponEntity = candidate;
    }
    destroy() {
        if (this._pendingPickupTimer) {
            clearTimeout(this._pendingPickupTimer);
            this._pendingPickupTimer = null;
        }
        for (const u of this._unbind){
            try {
                u();
            } catch  {}
        }
        this._unbind.length = 0;
    }
    constructor(...args){
        super(...args);
        /** @attribute {pc.Entity} activeWeaponEntity */ _define_property(this, "activeWeaponEntity", null) // the visible weapon model (has weaponAnimator)
        ;
        /** @attribute {string} currentWeaponType */ _define_property(this, "currentWeaponType", 'pistol');
    }
}
_define_property(WeaponVisualManager, "scriptName", 'weaponVisualManager');

export { WeaponVisualManager };
