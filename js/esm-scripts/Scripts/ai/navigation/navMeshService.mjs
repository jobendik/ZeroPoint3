import { Script, Vec3 } from '../../../../playcanvas-stable.min.mjs';
import * as YUKA from 'yuka';
import { aiConfig } from '../../config/ai.config.mjs';
import { Logger } from '../../core/engine/logger.mjs';

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
class NavMeshService extends Script {
    async initialize() {
        const app = this.app;
        app.navigation = app.navigation || {};
        app.navigation.services = app.navigation.services || {};
        // Build transform functions
        const yawRad = (this.navYawDeg || 0) * Math.PI / 180;
        const cos = Math.cos(yawRad), sin = Math.sin(yawRad);
        const off = new Vec3(this.navOffset.x, this.navOffset.y, this.navOffset.z);
        const scale = this.navScale || 1;
        const worldToNav = (w)=>new YUKA.Vector3(((w.x - off.x) * cos + (w.z - off.z) * sin) / scale, (w.y - off.y) / scale, (-(w.x - off.x) * sin + (w.z - off.z) * cos) / scale);
        // ✅ CRITICAL FIX: Return pc.Vec3 to prevent type mismatch in NavigationBootstrap
        // NavigationBootstrap needs pc.Vec3 for entity.setPosition()
        const navToWorld = (n)=>new Vec3(n.x * scale * cos - n.z * scale * sin + off.x, n.y * scale + off.y, n.x * scale * sin + n.z * scale * cos + off.z);
        // Setup service
        app.navigation.services.nav = {
            ready: false,
            nav: null,
            worldToNav,
            navToWorld,
            scale,
            off,
            yawRad
        };
        // Load NavMesh
        try {
            const url = this.navMeshJson?.getFileUrl?.();
            if (!url) {
                Logger.warn('[NavMeshService] No navMesh asset assigned');
                return;
            }
            const nav = await new YUKA.NavMeshLoader().load(url);
            // ✅ YUKA PATTERN: Verify NavMesh loaded with regions
            Logger.nav(`[NavMeshService] NavMesh loaded with ${nav.regions.length} regions`);
            if (nav.regions.length === 0) {
                Logger.error('[NavMeshService] NavMesh has no regions! Cannot create spatial index.');
                return;
            }
            // ✅ FIX: Create spatial index for NavMesh (YUKA official pattern)
            // NOTE: Some YUKA versions may auto-create spatial index - check first
            if (!nav.spatialIndex) {
                Logger.nav('[NavMeshService] No spatial index found, creating one...');
                nav.spatialIndex = new YUKA.CellSpacePartitioning(aiConfig.navigation.spatialWidth, aiConfig.navigation.spatialHeight, aiConfig.navigation.spatialDepth, aiConfig.navigation.spatialCellsX, aiConfig.navigation.spatialCellsY, aiConfig.navigation.spatialCellsZ);
                Logger.nav(`[NavMeshService] Spatial index created`);
                // ✅ CRITICAL: Must call updateSpatialIndex() to populate the index with regions
                nav.updateSpatialIndex();
                Logger.nav(`[NavMeshService] updateSpatialIndex() called`);
            } else {
                Logger.nav('[NavMeshService] NavMesh already has spatial index');
            }
            Logger.nav(`[NavMeshService] Final spatialIndex check: ${!!nav.spatialIndex}`);
            if (nav.spatialIndex) {
                Logger.nav(`[NavMeshService] spatialIndex type: ${nav.spatialIndex.constructor.name}`);
            }
            const svc = app.navigation.services.nav;
            svc.nav = nav;
            svc.ready = true;
            Logger.nav(`[NavMeshService] Final check - nav.spatialIndex: ${!!nav.spatialIndex}`);
            Logger.nav(`[NavMeshService] NavMesh loaded successfully with ${nav.regions.length} regions`);
            app.fire('navigation:ready', nav);
            Logger.nav('[NavMeshService] navigation:ready event fired');
        } catch (e) {
            Logger.error('[NavMeshService] Failed to load NavMesh:', e);
        }
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {Asset} @assetType {json} @title NavMesh JSON */ _define_property(this, "navMeshJson", null);
        /** @attribute @type {number} @title Nav Scale */ _define_property(this, "navScale", 1);
        /** @attribute @type {Vec3} @title Nav Offset */ _define_property(this, "navOffset", new Vec3(0, 0, 0));
        /** @attribute @type {number} @title Nav Yaw (deg) */ _define_property(this, "navYawDeg", 0);
    }
}
_define_property(NavMeshService, "scriptName", 'navMeshService');

export { NavMeshService };
