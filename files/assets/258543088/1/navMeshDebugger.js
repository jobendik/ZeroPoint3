/* global pc, YUKA */

// NavMeshDebugger — Visualize and validate a YUKA NavMesh in PlayCanvas 2.11.2
var NavMeshDebugger = pc.createScript('navMeshDebugger');

NavMeshDebugger.attributes.add('navmeshAsset', {
    type: 'asset',
    assetType: 'binary',
    title: 'NavMesh (.bin | .gltf | .glb)'
});
NavMeshDebugger.attributes.add('enableVisualDebug', { type: 'boolean', default: true, title: 'Enable Visual Debug' });
NavMeshDebugger.attributes.add('showRegionColors', { type: 'boolean', default: true, title: 'Color Regions' });
NavMeshDebugger.attributes.add('debugInterval', { type: 'number', default: 5, title: 'Debug Interval (s)' });
NavMeshDebugger.attributes.add('testPathfinding', { type: 'boolean', default: true, title: 'Test Random Paths' });
NavMeshDebugger.attributes.add('wireframeOnly', {type: 'boolean', default: true, title: 'Wireframe Only (no fills)'});

/* ---------------------- Lightweight Validator ---------------------- */
if (typeof window.NavMeshValidator === 'undefined') {
    window.NavMeshValidator = class NavMeshValidator {
        constructor(navMesh) {
            this.navMesh = navMesh;
            this.issues = [];
            this.warnings = [];
            this.stats = {};
        }

        getRegionCenter(region) {
            if (!region || !region.edge) return null;
            let sx = 0, sy = 0, sz = 0, c = 0;
            let e = region.edge, start = e;
            do {
                sx += e.vertex.x; sy += e.vertex.y; sz += e.vertex.z;
                c++; e = e.next;
                if (c > 64) break;
            } while (e && e !== start);
            return c ? new YUKA.Vector3(sx / c, sy / c, sz / c) : null;
        }

        calculateRegionArea(region) {
            if (!region || !region.edge) return 0;
            const v = [];
            let e = region.edge, start = e, guard = 0;
            do {
                v.push(e.vertex);
                e = e.next;
                if (++guard > 64) break;
            } while (e && e !== start);
            if (v.length < 3) return 0;
            let area = 0;
            for (let i = 0; i < v.length; i++) {
                const j = (i + 1) % v.length;
                area += v[i].x * v[j].z - v[j].x * v[i].z;
            }
            return Math.abs(area) * 0.5;
        }

        validateComplete() {
            this.issues.length = 0;
            this.warnings.length = 0;

            const nm = this.navMesh;
            if (!nm) { this.issues.push('NavMesh is null/undefined'); return this._report(); }
            if (!Array.isArray(nm.regions) || nm.regions.length === 0) { this.issues.push('NavMesh has no regions'); return this._report(); }

            let isolated = 0;
            for (let i = 0; i < nm.regions.length; i++) {
                const r = nm.regions[i];
                if (!r.edge) { this.issues.push(`Region ${i} missing edge`); continue; }
                let e = r.edge, start = e, vcount = 0, conn = 0, g = 0;
                do {
                    vcount++;
                    if (e.twin && e.twin.polygon && e.twin.polygon !== r) conn++;
                    e = e.next;
                    if (++g > 64) { this.warnings.push(`Region ${i} >64 edges`); break; }
                } while (e && e !== start);
                if (vcount < 3) this.issues.push(`Region ${i} has <3 vertices`);
                if (conn === 0) isolated++;
            }
            if (isolated > nm.regions.length * 0.1) this.warnings.push(`${isolated} isolated regions`);

            const stats = {
                totalRegions: nm.regions.length,
                totalArea: 0, minArea: Infinity, maxArea: 0, averageArea: 0,
                bounds: { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } }
            };
            for (let i = 0; i < nm.regions.length; i++) {
                const r = nm.regions[i];
                const a = this.calculateRegionArea(r);
                stats.totalArea += a;
                stats.minArea = Math.min(stats.minArea, a);
                stats.maxArea = Math.max(stats.maxArea, a);

                if (r.edge) {
                    let e = r.edge, start = e, g = 0;
                    do {
                        const p = e.vertex;
                        stats.bounds.min.x = Math.min(stats.bounds.min.x, p.x);
                        stats.bounds.min.y = Math.min(stats.bounds.min.y, p.y);
                        stats.bounds.min.z = Math.min(stats.bounds.min.z, p.z);
                        stats.bounds.max.x = Math.max(stats.bounds.max.x, p.x);
                        stats.bounds.max.y = Math.max(stats.bounds.max.y, p.y);
                        stats.bounds.max.z = Math.max(stats.bounds.max.z, p.z);
                        e = e.next;
                        if (++g > 64) break;
                    } while (e && e !== start);
                }
            }
            stats.averageArea = stats.totalRegions ? (stats.totalArea / stats.totalRegions) : 0;
            this.stats = stats;
            return this._report();
        }

        _report() {
            return { isValid: this.issues.length === 0, issues: this.issues, warnings: this.warnings, stats: this.stats };
        }
    };
}

/* --------------------------- Script Instance --------------------------- */
NavMeshDebugger.prototype.initialize = function () {
    this.navMesh = null;
    this.validator = null;
    this.visualElements = [];
    this.lastDebugTime = 0;

    this._createDebugMaterials();

    if (this.navmeshAsset && this.navmeshAsset.getFileUrl) {
        this._loadAndDebugNavMesh();
    } else {
        console.warn('[NavMeshDebugger] No navmesh asset assigned.');
    }
};

NavMeshDebugger.prototype._createDebugMaterials = function () {
    // Unlit line material for wireframe (keep visuals identical)
    this.wireframeMaterial = new pc.StandardMaterial();
    this.wireframeMaterial.useLighting = false;        // unlit => normals not required by shader
    this.wireframeMaterial.emissive.set(0, 1, 0);
    this.wireframeMaterial.emissiveIntensity = 1.0;
    this.wireframeMaterial.opacity = 0.9;              // keep transparency as before
    this.wireframeMaterial.blendType = pc.BLEND_NORMAL;
    this.wireframeMaterial.cull = pc.CULLFACE_NONE;
    this.wireframeMaterial.update();

    // Unlit translucent fill materials
    this.regionMaterials = [];
    const palette = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1],
        [1, 0.5, 0], [0.5, 1, 0], [0, 0.5, 1], [1, 0, 0.5], [0.5, 0, 1], [0, 1, 0.5]
    ];
    for (let i = 0; i < palette.length; i++) {
        const m = new pc.StandardMaterial();
        m.useLighting = false;                  // unlit
        m.emissive.set(palette[i][0], palette[i][1], palette[i][2]);
        m.emissiveIntensity = 1.0;
        m.opacity = 0.3;
        m.blendType = pc.BLEND_NORMAL;
        m.cull = pc.CULLFACE_NONE;
        m.update();
        this.regionMaterials.push(m);
    }
};

NavMeshDebugger.prototype._loadAndDebugNavMesh = function () {
    console.log('[NavMeshDebugger] Loading navmesh…');
    const url = this.navmeshAsset.getFileUrl();
    const loader = new YUKA.NavMeshLoader();

    loader.load(url)
        .then((nm) => {
            this.navMesh = nm;
            this.validator = new window.NavMeshValidator(nm);

            const report = this.validator.validateComplete();
            console.log('[NavMeshDebugger] NavMesh loaded. Regions:', nm.regions ? nm.regions.length : 0, report);

            if (this.enableVisualDebug) this._createVisualDebug();
            this.lastReport = report;
        })
        .catch((err) => {
            console.error('[NavMeshDebugger] Failed to load/parse navmesh:', err);
        });
};

NavMeshDebugger.prototype._createVisualDebug = function () {
    if (!this.navMesh || !this.navMesh.regions) return;

    this._clearVisualDebug();

    for (let i = 0; i < this.navMesh.regions.length; i++) {
        const region = this.navMesh.regions[i];
        if (!region || !region.edge) continue;

        if (this.showRegionColors && !this.wireframeOnly) this._createRegionFill(region, i);
        this._createRegionWireframe(region, i);
    }

    console.log(`[NavMeshDebugger] Debug visuals created for ${this.navMesh.regions.length} regions.`);
};

NavMeshDebugger.prototype._createRegionWireframe = function (region, index) {
    // Collect perimeter vertices
    const positions = [];
    const indices = [];
    let e = region.edge, start = e, count = 0;
    do {
        positions.push(e.vertex.x, e.vertex.y + 0.01, e.vertex.z); // lift slightly to avoid z-fighting
        count++;
        e = e.next;
        if (count > 64) break;
    } while (e && e !== start);

    if (count < 2) return;

    for (let i = 0; i < count; i++) indices.push(i, (i + 1) % count);

    // ----- PATCH 1: add dummy normals so any lit path can't complain -----
    const normals = [];
    for (let i = 0; i < count; i++) normals.push(0, 1, 0);

    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setIndices(indices);
    mesh.update();                                 // build buffers and aabb first
    mesh.primitive[0].type = pc.PRIMITIVE_LINES;   // then set primitive type

    const node = new pc.GraphNode();
    const mi = new pc.MeshInstance(mesh, this.wireframeMaterial, node); // Mesh, Material, Node

    const entity = new pc.Entity(`NavMesh_Wireframe_${index}`);
    // ----- PATCH 2: create render component with meshInstances to avoid default "Untitled" material -----
    entity.addComponent('render', {
        meshInstances: [mi],
        castShadows: false,
        receiveShadows: false,
        lightmapped: false
    });

    this.app.root.addChild(entity);
    this.visualElements.push(entity);
};

NavMeshDebugger.prototype._createRegionFill = function (region, index) {
    // Fan triangulation (convex assumption) for visualization
    const positions = [];
    const normals = [];
    const indices = [];

    let e = region.edge, start = e, count = 0;
    do {
        const vx = e.vertex.x, vy = e.vertex.y, vz = e.vertex.z;
        positions.push(vx, vy, vz);
        normals.push(0, 1, 0);
        count++;
        e = e.next;
        if (count > 64) break;
    } while (e && e !== start);

    if (count < 3) return;

    for (let i = 1; i < count - 1; i++) indices.push(0, i, i + 1);

    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setIndices(indices);
    mesh.update();
    mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;

    const mat = this.regionMaterials[index % this.regionMaterials.length];

    const node = new pc.GraphNode();
    const mi = new pc.MeshInstance(mesh, mat, node);

    const entity = new pc.Entity(`NavMesh_Region_${index}`);
    // Create with meshInstances to avoid any default lit material
    entity.addComponent('render', {
        meshInstances: [mi],
        castShadows: false,
        receiveShadows: false,
        lightmapped: false
    });

    this.app.root.addChild(entity);
    this.visualElements.push(entity);
};

NavMeshDebugger.prototype._clearVisualDebug = function () {
    for (const e of this.visualElements) {
        if (e && !e._destroyed) e.destroy();
    }
    this.visualElements.length = 0;
};

NavMeshDebugger.prototype.update = function (dt) {
    if (!this.validator) return;

    const now = performance.now();
    if (now - this.lastDebugTime > (this.debugInterval * 1000)) {
        this.lastDebugTime = now;
        if (this.testPathfinding) this._runQuickPathTest();
    }
};

/* --------------------------- Path helpers --------------------------- */
NavMeshDebugger.prototype._runQuickPathTest = function () {
    const nm = this.navMesh;
    if (!nm || !nm.regions || nm.regions.length < 2) return;

    const a = nm.regions[Math.floor(Math.random() * nm.regions.length)];
    const b = nm.regions[Math.floor(Math.random() * nm.regions.length)];
    if (a === b) return;

    let start = this.validator.getRegionCenter(a);
    let end   = this.validator.getRegionCenter(b);
    if (!start || !end) return;

    // Be tolerant: snap to navmesh if region lookup fails
    start = this.snapPointToNavMesh(start);
    end   = this.snapPointToNavMesh(end);

    try {
        const path = nm.findPath(start, end);
        if (!path || path.length === 0) {
            console.warn('[NavMeshDebugger] Quick path test: no path found');
        } else {
            console.log(`[NavMeshDebugger] Quick path test: ${path.length} waypoints`);
        }
    } catch (err) {
        console.error('[NavMeshDebugger] Quick path test error:', err);
    }
};

/**
 * Snap an arbitrary point to the navmesh by using region lookup with tolerance,
 * and falling back to the closest region’s center if needed.
 */
NavMeshDebugger.prototype.snapPointToNavMesh = function (pt, tolerance = 1.0) {
    if (!this.navMesh) return pt;
    let region = this.navMesh.getRegionForPoint(pt, tolerance);
    if (region) return pt;

    const closest = this.navMesh.getClosestRegion(pt);
    if (closest) {
        const c = this.validator ? this.validator.getRegionCenter(closest) : null;
        if (c) return c;
    }
    return pt;
};

/* --------------------------- Public Helpers --------------------------- */
NavMeshDebugger.prototype.runFullValidation = function () {
    if (!this.validator) {
        console.warn('[NavMeshDebugger] No validator; navmesh not loaded yet.');
        return null;
    }
    return this.validator.validateComplete();
};

NavMeshDebugger.prototype.toggleVisualDebug = function () {
    this.enableVisualDebug = !this.enableVisualDebug;
    if (this.enableVisualDebug) this._createVisualDebug();
    else this._clearVisualDebug();
};

NavMeshDebugger.prototype.testSpecificPath = function (startPos, endPos, tolerance = 1.0) {
    if (!this.navMesh) {
        console.error('[NavMeshDebugger] No navmesh loaded');
        return null;
    }
    let start = new YUKA.Vector3(startPos.x, startPos.y, startPos.z);
    let end   = new YUKA.Vector3(endPos.x,   endPos.y,   endPos.z);

    // Snap to navmesh if needed
    start = this.snapPointToNavMesh(start, tolerance);
    end   = this.snapPointToNavMesh(end, tolerance);

    try {
        const path = this.navMesh.findPath(start, end);
        if (path && path.length) {
            console.log(`[NavMeshDebugger] Path found (${path.length} waypoints).`);
            return path;
        }
        console.log('[NavMeshDebugger] No path found.');
        return null;
    } catch (e) {
        console.error('[NavMeshDebugger] Path error:', e);
        return null;
    }
};

NavMeshDebugger.prototype.getNavMeshInfo = function () {
    if (!this.navMesh) return null;
    return {
        regionCount: this.navMesh.regions ? this.navMesh.regions.length : 0,
        hasGraph: !!this.navMesh.graph,
        nodeCount: (this.navMesh.graph && this.navMesh.graph.nodes) ? this.navMesh.graph.nodes.length : 0,
        hasSpatialIndex: !!this.navMesh.spatialIndex,
        lastReport: this.lastReport || null
    };
};
