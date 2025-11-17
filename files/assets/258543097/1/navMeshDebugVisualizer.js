// NavMeshDebugVisualizer.js - Debug visualization for navmesh (PlayCanvas 2.11.2)
/* global pc, YUKA */
var NavMeshDebugVisualizer = pc.createScript('navMeshDebugVisualizer');

NavMeshDebugVisualizer.attributes.add('navMeshAsset', {
    type: 'asset',
    assetType: 'binary',
    title: 'NavMesh GLB / .bin (ArrayBuffer)'
});
NavMeshDebugVisualizer.attributes.add('showRegions', {
    type: 'boolean',
    default: true,
    title: 'Show Regions'
});
NavMeshDebugVisualizer.attributes.add('showEdges', {
    type: 'boolean',
    default: true,
    title: 'Show Edges'
});
NavMeshDebugVisualizer.attributes.add('regionColor', {
    type: 'rgb',
    default: [0, 1, 0],
    title: 'Region Color'
});
NavMeshDebugVisualizer.attributes.add('edgeColor', {
    type: 'rgb',
    default: [1, 1, 0],
    title: 'Edge Color'
});

NavMeshDebugVisualizer.prototype.initialize = function () {
    this.navMesh = null;
    this.debugEntities = [];
    this._waitForYuka();
};

NavMeshDebugVisualizer.prototype._waitForYuka = function () {
    if (typeof YUKA !== 'undefined' && YUKA.NavMeshLoader) {
        this._loadNavMesh();
    } else {
        console.log('[NavMeshDebugVisualizer] Waiting for YUKA...');
        this._yukaWaitTO = setTimeout(this._waitForYuka.bind(this), 100);
    }
};

NavMeshDebugVisualizer.prototype._loadNavMesh = function () {
    if (!this.navMeshAsset || !this.navMeshAsset.resource) {
        console.error('[NavMeshDebugVisualizer] NavMesh asset not ready');
        return;
    }

    try {
        // PlayCanvas 'binary' asset gives an ArrayBuffer as .resource in launch builds
        var arrayBuffer = this.navMeshAsset.resource;

        var loader = new YUKA.NavMeshLoader();
        loader.parse(arrayBuffer).then((navMesh) => {
            this.navMesh = navMesh;
            console.log(`[NavMeshDebugVisualizer] ✅ Loaded navmesh with ${navMesh.regions.length} regions`);
            this._createDebugVisualization();
        }).catch((err) => {
            console.error('[NavMeshDebugVisualizer] Error loading NavMesh:', err);
        });
    } catch (e) {
        console.error('[NavMeshDebugVisualizer] Exception in _loadNavMesh:', e);
    }
};

NavMeshDebugVisualizer.prototype._createDebugVisualization = function () {
    if (!this.navMesh) return;

    this._clearDebug();

    var regions = this.navMesh.regions;
    for (var i = 0; i < regions.length; i++) {
        var region = regions[i];

        if (this.showRegions) {
            this._createRegionEntity(region, i);
        }
        if (this.showEdges) {
            this._createEdgeEntity(region, i);
        }
    }

    console.log(`[NavMeshDebugVisualizer] Built visualization for ${regions.length} regions`);
};

NavMeshDebugVisualizer.prototype._createRegionEntity = function (region, index) {
    // Collect boundary edges
    var edges = [];
    var e = region.edge;
    do {
        edges.push(e);
        e = e.next;
    } while (e !== region.edge);

    if (edges.length < 3) return; // need at least a triangle

    // Build a simple triangle fan around the centroid (slightly lifted to avoid z-fighting)
    var cy = region.centroid.y + 0.01;
    var vertices = [];
    // centroid first
    vertices.push(region.centroid.x, cy, region.centroid.z);
    // perimeter verts
    for (var i = 0; i < edges.length; i++) {
        var v = edges[i].vertex;
        vertices.push(v.x, v.y + 0.01, v.z);
    }

    // Indices for fan: (0, i, i+1)
    var indices = [];
    for (var i2 = 1; i2 <= edges.length; i2++) {
        indices.push(0, i2, (i2 === edges.length) ? 1 : i2 + 1);
    }

    // Flat normals (0,1,0)
    var normals = [];
    for (var nv = 0; nv < vertices.length / 3; nv++) {
        normals.push(0, 1, 0);
    }

    var gd = this.app.graphicsDevice;
    var mesh = new pc.Mesh(gd);
    mesh.setPositions(vertices);
    mesh.setNormals(normals);
    mesh.setIndices(indices);
    mesh.update();

    // Semi-transparent unlit(ish) material
    var mat = new pc.StandardMaterial();
    mat.diffuse.set(this.regionColor[0], this.regionColor[1], this.regionColor[2]);
    mat.opacity = 0.3;
    mat.useLighting = false;
    // IMPORTANT: Use a valid blend type for 2.11.2
    mat.blendType = pc.BLEND_NORMAL;   // NOT pc.BLEND_ALPHA (doesn’t exist)
    mat.depthWrite = false;
    mat.cull = pc.CULLFACE_NONE;
    mat.update();

    var node = new pc.GraphNode();
    var mi = new pc.MeshInstance(mesh, mat, node);

    var ent = new pc.Entity('NavMeshRegion_' + index);
    ent.addComponent('render', { meshInstances: [mi] });

    this.app.root.addChild(ent);
    this.debugEntities.push(ent);
};

NavMeshDebugVisualizer.prototype._createEdgeEntity = function (region, index) {
    // Build line segments along the region perimeter (slightly lifted)
    var positions = [];
    var e = region.edge;
    do {
        var v1 = e.vertex;
        var v2 = e.next.vertex;

        positions.push(v1.x, v1.y + 0.02, v1.z);
        positions.push(v2.x, v2.y + 0.02, v2.z);

        e = e.next;
    } while (e !== region.edge);

    var gd = this.app.graphicsDevice;
    var mesh = new pc.Mesh(gd);
    mesh.setPositions(positions);

    // Provide dummy normals so the shader has vertex_normal (one per vertex).
    // Even though we set useLighting=false, this guarantees compatibility.
    var normals = [];
    var vertCount = positions.length / 3;
    for (var i = 0; i < vertCount; i++) {
        normals.push(0, 1, 0);
    }
    mesh.setNormals(normals);

    // Define as non-indexed line list
    mesh.update(pc.PRIMITIVE_LINES, vertCount);

    var mat = new pc.StandardMaterial();
    mat.useLighting = false;                   // unlit
    mat.emissive = new pc.Color(this.edgeColor[0], this.edgeColor[1], this.edgeColor[2]);
    mat.blendType = pc.BLEND_NONE;             // opaque lines
    mat.depthWrite = true;
    mat.cull = pc.CULLFACE_NONE;
    mat.update();

    var node = new pc.GraphNode();
    var mi = new pc.MeshInstance(mesh, mat, node);

    var ent = new pc.Entity('NavMeshEdges_' + index);
    ent.addComponent('render', { meshInstances: [mi] });

    this.app.root.addChild(ent);
    this.debugEntities.push(ent);
};


NavMeshDebugVisualizer.prototype._clearDebug = function () {
    for (var i = 0; i < this.debugEntities.length; i++) {
        this.debugEntities[i].destroy();
    }
    this.debugEntities.length = 0;
};

NavMeshDebugVisualizer.prototype.destroy = function () {
    clearTimeout(this._yukaWaitTO);
    this._clearDebug();
};
