/**
 * SceneLightingControl
 * Ensures full control of lighting by disabling ambient/skybox/lightmaps and
 * forcing imported materials to respond to lights. Includes a nuclear fallback
 * to override materials if sanitizing isn't enough.
 * Attach to the root entity.
 */
var SceneLightingControl = pc.createScript('sceneLightingControl');

// ===== Attributes you can tweak in the Editor =====
SceneLightingControl.attributes.add('disableExistingLights', { type: 'boolean', default: true, title: 'Disable Existing Lights' });
SceneLightingControl.attributes.add('killAmbientAndSkybox',  { type: 'boolean', default: true, title: 'Kill Ambient & Skybox' });
SceneLightingControl.attributes.add('disableLightmaps',      { type: 'boolean', default: true, title: 'Disable Lightmaps' });
SceneLightingControl.attributes.add('clearEmissive',         { type: 'boolean', default: true, title: 'Clear Emissive' });
SceneLightingControl.attributes.add('ignoreVertexColors',    { type: 'boolean', default: true, title: 'Ignore Vertex Colors' });

// Enforce every frame (helps against late spawns / state changes)
SceneLightingControl.attributes.add('enforceEveryFrame',     { type: 'boolean', default: true, title: 'Enforce Every Frame' });

// Optional nuclear fallback: replace materials entirely
SceneLightingControl.attributes.add('forceOverrideMaterial', { type: 'boolean', default: false, title: 'Force Override Materials' });
SceneLightingControl.attributes.add('overrideOnlyUnderName', { type: 'string',  default: '',    title: 'Only Override Under Entity Name Contains (optional)' });
SceneLightingControl.attributes.add('overrideColor',         { type: 'rgba',    default: [1,1,1,1], title: 'Override Diffuse Color' });
SceneLightingControl.attributes.add('overrideMetalness',     { type: 'number',  default: 0.0, min: 0, max: 1, title: 'Override Metalness' });
SceneLightingControl.attributes.add('overrideShininess',     { type: 'number',  default: 80, min: 1, max: 128, title: 'Override Shininess (Gloss)' });

SceneLightingControl.prototype.initialize = function () {
    var app = this.app;

    this._processed = new WeakSet();
    this._overrideMat = null;

    if (this.killAmbientAndSkybox) {
        app.scene.ambientLight.set(0, 0, 0);
        app.scene.skybox = null;
        app.scene.skyboxIntensity = 0;
        app.scene.envAtlas = null;
        app.scene.prefilteredCubeMap128 = null;
    }

    if (this.disableLightmaps) {
        app.scene.lightmapEnabled = false;
    }

    if (this.disableExistingLights) {
        app.root.findComponents("light").forEach(function (l) { l.enabled = false; });
    }

    // First pass right away
    this._sanitizeHierarchy(app.root);
    app.scene.updateShaders = true;

    // React to late content
    app.root.on('childinsert', this._onChildInserted, this);
    app.assets.on('load', this._onAssetLoad, this);
    this.on('destroy', this._teardown, this);
};

SceneLightingControl.prototype.update = function (dt) {
    if (!this.enforceEveryFrame) return;

    // Keep global darkness enforced every frame
    var scene = this.app.scene;
    scene.ambientLight.set(0, 0, 0);
    scene.skybox = null;
    scene.skyboxIntensity = 0;
    scene.envAtlas = null;
    scene.prefilteredCubeMap128 = null;
    scene.lightmapEnabled = false;

    if (this.disableExistingLights) {
        var lights = this.app.root.findComponents('light');
        for (var i = 0; i < lights.length; i++) lights[i].enabled = false;
    }

    // Continuous sanitation (cheap thanks to WeakSet)
    this._sanitizeHierarchy(this.app.root);
};

// ---------- Events ----------
SceneLightingControl.prototype._onChildInserted = function (node) {
    if (node && node instanceof pc.Entity) {
        this._sanitizeHierarchy(node);
        this.app.scene.updateShaders = true;
    }
};

SceneLightingControl.prototype._onAssetLoad = function (asset) {
    // Materials / containers / models re-appear late
    if (!asset) return;
    if (asset.type === 'material' || asset.type === 'container' || asset.type === 'model' || asset.type === 'texture') {
        this._sanitizeHierarchy(this.app.root);
        this.app.scene.updateShaders = true;
    }
};

SceneLightingControl.prototype._teardown = function () {
    var app = this.app;
    app.root.off('childinsert', this._onChildInserted, this);
    app.assets.off('load', this._onAssetLoad, this);
};

// ---------- Core ----------
SceneLightingControl.prototype._sanitizeHierarchy = function (rootEntity) {
    if (!rootEntity || !(rootEntity instanceof pc.Entity)) return;

    // Disable baked lighting flags
    var renders = rootEntity.findComponents('render');
    for (var i = 0; i < renders.length; i++) renders[i].lightmapped = false;

    var models = rootEntity.findComponents('model');
    for (var j = 0; j < models.length; j++) models[j].lightmapped = false;

    // Either sanitize materials in place OR nuke them with an override material
    if (this.forceOverrideMaterial) {
        var targetRoot = this._findTargetRoot(this.overrideOnlyUnderName);
        this._applyOverrideMaterials(targetRoot || rootEntity);
    } else {
        this._scrubMaterialsRecursive(rootEntity);
    }
};

SceneLightingControl.prototype._findTargetRoot = function (nameSubstr) {
    if (!nameSubstr) return null;
    var low = nameSubstr.toLowerCase();
    // breadth-first search for a node whose name contains the substring
    var q = [ this.app.root ];
    while (q.length) {
        var e = q.shift();
        if (e.name && e.name.toLowerCase().indexOf(low) !== -1) return e;
        var kids = e.getChildren();
        for (var i = 0; i < kids.length; i++) q.push(kids[i]);
    }
    return null;
};

SceneLightingControl.prototype._getOverrideMaterial = function () {
    if (this._overrideMat) return this._overrideMat;

    var m = new pc.StandardMaterial();
    // Color (diffuse)
    m.diffuse.set(this.overrideColor.r, this.overrideColor.g, this.overrideColor.b);
    // Ensure lighting path
    if ('unlit' in m) m.unlit = false;
    if ('useLighting' in m) m.useLighting = true;
    if ('useVertexColors' in m) m.useVertexColors = false;

    // PBR-ish controls on StandardMaterial:
    // Metalness workaround via specular/gloss model
    m.metalness = this.overrideMetalness; // engine will ignore if not in metalness workflow; still fine.
    m.shininess = this.overrideShininess;

    // Absolutely no self-illumination
    m.emissive.set(0,0,0);
    m.emissiveMap = null;

    // Kill env/cubemap contribution just in case
    m.cubeMap = null;

    m.update();
    this._overrideMat = m;
    return m;
};

SceneLightingControl.prototype._applyOverrideMaterials = function (root) {
    var overrideMat = this._getOverrideMaterial();

    var renders = root.findComponents('render');
    for (var i = 0; i < renders.length; i++) {
        var rc = renders[i];
        if (!rc.meshInstances) continue;
        for (var k = 0; k < rc.meshInstances.length; k++) {
            var mi = rc.meshInstances[k];
            if (mi.material !== overrideMat) {
                mi.material = overrideMat;
            }
        }
    }

    var models = root.findComponents('model');
    for (var j = 0; j < models.length; j++) {
        var mc = models[j];
        if (mc.model && mc.model.meshInstances) {
            for (var t = 0; t < mc.model.meshInstances.length; t++) {
                var mi2 = mc.model.meshInstances[t];
                if (mi2.material !== overrideMat) {
                    mi2.material = overrideMat;
                }
            }
        }
    }
};

SceneLightingControl.prototype._scrubMaterialsRecursive = function (entity) {
    // Current entity
    this._scrubMaterialsOnEntity(entity);

    // Children
    var children = entity.getChildren();
    for (var i = 0; i < children.length; i++) this._scrubMaterialsRecursive(children[i]);
};

SceneLightingControl.prototype._scrubMaterialsOnEntity = function (entity) {
    var rc = entity.render;
    if (rc && rc.meshInstances) {
        for (var i = 0; i < rc.meshInstances.length; i++) {
            var mi = rc.meshInstances[i];
            var mat = mi.material;
            if (!mat || this._processed.has(mat)) continue;

            var touched = false;

            if (mat instanceof pc.StandardMaterial) {
                // Force lighting path
                if ('unlit' in mat && mat.unlit) { mat.unlit = false; touched = true; }
                if ('useLighting' in mat && !mat.useLighting) { mat.useLighting = true; touched = true; }
                if (this.ignoreVertexColors && 'useVertexColors' in mat && mat.useVertexColors) { mat.useVertexColors = false; touched = true; }

                if (this.clearEmissive) {
                    if (mat.emissive && (mat.emissive.r !== 0 || mat.emissive.g !== 0 || mat.emissive.b !== 0)) { mat.emissive.set(0,0,0); touched = true; }
                    if (mat.emissiveMap) { mat.emissiveMap = null; touched = true; }
                    if ('emissiveIntensity' in mat && mat.emissiveIntensity !== 0) { mat.emissiveIntensity = 0; touched = true; }
                }

                // Kill any env/cubemap influence
                if (mat.cubeMap) { mat.cubeMap = null; touched = true; }

                if (touched) mat.update();
            }

            this._processed.add(mat);
        }
    }
};
