import { Script, ShaderMaterial, SEMANTIC_POSITION, CULLFACE_NONE, BLEND_NORMAL, Vec3 } from '../../../playcanvas-stable.min.mjs';
import { Logger } from '../core/engine/logger.mjs';

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
class GroundFog extends Script {
    // ============================================================================
    // INTERNAL: DEBUG HELPERS (gate all non-critical console output)
    // ============================================================================
    _dlog(...args) {
        if (this.debugLogs) Logger.debug(...args);
    }
    _dwarn(...args) {
        if (this.debugLogs) Logger.warn(...args);
    }
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        this._dlog('═══════════════════════════════════════════════════════');
        this._dlog('[GroundFog] 🌫️ INITIALIZING for entity:', this.entity.name);
        this._dlog('═══════════════════════════════════════════════════════');
        // Enable depth map on the camera
        this._enableCameraDepthMap();
        // Check if texture is assigned (critical)
        if (!this.cloudsTexture) {
            Logger.error('[GroundFog] ❌ CRITICAL: No clouds texture assigned! → Assign a texture in script attributes.');
            return;
        }
        this._dlog('[GroundFog] 📦 Texture Asset Info:', {
            name: this.cloudsTexture.name,
            id: this.cloudsTexture.id,
            loaded: this.cloudsTexture.loaded,
            hasResource: !!this.cloudsTexture.resource
        });
        if (this.cloudsTexture.resource) {
            this._dlog('  ↳ Texture size:', this.cloudsTexture.resource.width, 'x', this.cloudsTexture.resource.height, 'format:', this.cloudsTexture.resource.format);
        }
        // Check if entity has render component (critical)
        if (!this.entity.render) {
            Logger.error('[GroundFog] ❌ No render component found! → Attach to an entity with a render component.');
            return;
        }
        this._dlog('[GroundFog] 🎨 Render Component Info:', {
            type: this.entity.render.type,
            enabled: this.entity.render.enabled,
            layers: this.entity.render.layers
        });
        // Get the existing mesh instances (critical)
        const meshInstances = this.entity.render.meshInstances;
        if (!meshInstances || meshInstances.length === 0) {
            Logger.error('[GroundFog] ❌ No mesh instances found on render component!');
            return;
        }
        this._dlog('[GroundFog] ✅ Found', meshInstances.length, 'mesh instance(s)');
        for(let i = 0; i < meshInstances.length; i++){
            const mi = meshInstances[i];
            this._dlog(`  - Mesh ${i}:`, mi.mesh.vertexBuffer.numVertices, 'vertices', 'origMaterial:', mi.material ? mi.material.name : 'none');
        }
        this._dlog('[GroundFog] 📍 Entity Transform:', {
            position: this.entity.getPosition().toString(),
            scale: this.entity.getLocalScale().toString(),
            rotation: this.entity.getEulerAngles().toString()
        });
        this._dlog('[GroundFog] ⚙️ Script Settings:', {
            softness: this.softness,
            fogColor: this.fogColor.toString(),
            fogIntensity: this.fogIntensity,
            textureScale: this.textureScale,
            animationSpeed: this.animationSpeed,
            enableAnimation: this.enableAnimation,
            opacity: this.opacity,
            castShadows: this.castShadows,
            receiveShadows: this.receiveShadows,
            debugMode: this.debugMode,
            debugLogs: this.debugLogs
        });
        // Apply the fog shader material
        this._applyFogMaterial(meshInstances);
        this.currentTime = 0;
        this.frameCount = 0;
        this._dlog('[GroundFog] ✅ Initialization complete!');
        this._dlog('[GroundFog] 📦 BOX MESH MODE: Fog will render as a volumetric box');
        this._dlog('═══════════════════════════════════════════════════════\n');
    }
    _enableCameraDepthMap() {
        // Find camera entity - try multiple methods
        let cameraEntity = this.app.root.findByName('Camera');
        if (!cameraEntity) {
            // Try to find any entity with a camera component
            cameraEntity = this.app.root.findComponent('camera');
        }
        if (cameraEntity && cameraEntity.camera) {
            cameraEntity.camera.requestSceneDepthMap(true);
            this._dlog('[GroundFog] ✅ Enabled depth map on camera:', cameraEntity.name);
        } else {
            this._dwarn('[GroundFog] ⚠️ Could not find camera to enable depth map!');
        }
    }
    _applyFogMaterial(meshInstances) {
        this._dlog('[GroundFog] 🎨 Creating shader material...');
        // Create the shader material
        const material = new ShaderMaterial({
            uniqueName: 'GroundFogShader',
            vertexGLSL: GroundFog.VERTEX_SHADER_GLSL,
            fragmentGLSL: GroundFog.FRAGMENT_SHADER_GLSL,
            vertexWGSL: GroundFog.VERTEX_SHADER_WGSL,
            fragmentWGSL: GroundFog.FRAGMENT_SHADER_WGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });
        this._dlog('[GroundFog] ✅ ShaderMaterial created', {
            name: material.name,
            id: material.id
        });
        // Set material parameters
        this._dlog('[GroundFog] 🔧 Setting shader parameters...');
        const textureResource = this.cloudsTexture.resource;
        if (!textureResource) {
            Logger.error('[GroundFog] ❌ CRITICAL: Texture asset exists but resource is not loaded.');
            return;
        }
        material.setParameter('uTexture', textureResource);
        this._dlog('  ✅ uTexture set:', textureResource.name, `(${textureResource.width}x${textureResource.height})`);
        material.setParameter('uFogColor', [
            this.fogColor.x,
            this.fogColor.y,
            this.fogColor.z
        ]);
        this._dlog('  ✅ uFogColor set:', [
            this.fogColor.x,
            this.fogColor.y,
            this.fogColor.z
        ]);
        material.setParameter('uSoftening', this.softness);
        this._dlog('  ✅ uSoftening set:', this.softness);
        material.setParameter('uFogIntensity', this.fogIntensity);
        this._dlog('  ✅ uFogIntensity set:', this.fogIntensity);
        material.setParameter('uTextureScale', this.textureScale);
        this._dlog('  ✅ uTextureScale set:', this.textureScale);
        material.setParameter('uAnimationSpeed', this.enableAnimation ? this.animationSpeed : 0.0);
        this._dlog('  ✅ uAnimationSpeed set:', this.enableAnimation ? this.animationSpeed : 0.0);
        material.setParameter('uOpacity', this.opacity);
        this._dlog('  ✅ uOpacity set:', this.opacity);
        material.setParameter('uTime', 0);
        this._dlog('  ✅ uTime set:', 0);
        material.setParameter('uDebugMode', this.debugMode ? 1.0 : 0.0);
        this._dlog('  ✅ uDebugMode set:', this.debugMode ? 1.0 : 0.0, this.debugMode ? '(DEBUG ON - SOLID FOG)' : '(DEBUG OFF - NORMAL)');
        // Critical rendering settings
        material.cull = CULLFACE_NONE;
        material.depthWrite = false;
        material.blendType = BLEND_NORMAL;
        material.update();
        this._dlog('[GroundFog] 🎨 Material render settings:', {
            cull: 'CULLFACE_NONE',
            depthWrite: false,
            blendType: 'BLEND_NORMAL',
            updated: true
        });
        this.material = material;
        // Replace the material on all mesh instances
        this._dlog('[GroundFog] 🔄 Applying material to mesh instances...');
        for(let i = 0; i < meshInstances.length; i++){
            const oldMaterial = meshInstances[i].material;
            meshInstances[i].material = material;
            this._dlog(`  ✅ Mesh ${i}: Material replaced (old: ${oldMaterial ? oldMaterial.name : 'none'} → new: ${material.name})`);
        }
        // Apply shadow settings from attributes
        this.entity.render.castShadows = this.castShadows;
        this.entity.render.receiveShadows = this.receiveShadows;
        this._dlog('[GroundFog] 🌑 Shadow settings:', {
            castShadows: this.castShadows,
            receiveShadows: this.receiveShadows
        });
        if (this.debugLogs) {
            if (this.debugMode) {
                this._dlog('\n⚠️ DEBUG MODE IS ON — expect a solid semi-transparent box.\n');
            } else {
                this._dlog('\n🌫️ VOLUMETRIC FOG MODE — uses depth buffer & texture animation.\n');
            }
        }
    }
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    update(dt) {
        if (!this.material) return;
        // Update time only if animation is enabled
        if (this.enableAnimation) {
            this.currentTime = (this.currentTime || 0) + dt;
        }
        // Update all uniforms
        this.material.setParameter('uTime', this.currentTime || 0);
        this.material.setParameter('uSoftening', this.softness);
        this.material.setParameter('uFogColor', [
            this.fogColor.x,
            this.fogColor.y,
            this.fogColor.z
        ]);
        this.material.setParameter('uFogIntensity', this.fogIntensity);
        this.material.setParameter('uTextureScale', this.textureScale);
        this.material.setParameter('uAnimationSpeed', this.enableAnimation ? this.animationSpeed : 0.0);
        this.material.setParameter('uOpacity', this.opacity);
        this.material.setParameter('uDebugMode', this.debugMode ? 1.0 : 0.0);
        // Update shadow settings
        if (this.entity.render.castShadows !== this.castShadows) {
            this.entity.render.castShadows = this.castShadows;
        }
        if (this.entity.render.receiveShadows !== this.receiveShadows) {
            this.entity.render.receiveShadows = this.receiveShadows;
        }
        // Debug cadence logs only when enabled
        if (this.debugLogs) {
            this.frameCount = (this.frameCount || 0) + 1;
            if (this.frameCount % 60 === 0) {
                this._dlog(`[GroundFog] 🔄 Frame ${this.frameCount}:`, {
                    time: this.currentTime ? this.currentTime.toFixed(2) : '0.00',
                    softness: this.softness,
                    fogIntensity: this.fogIntensity,
                    textureScale: this.textureScale,
                    animationSpeed: this.animationSpeed,
                    enableAnimation: this.enableAnimation,
                    opacity: this.opacity,
                    debugMode: this.debugMode,
                    fogColor: this.fogColor.toString(),
                    materialValid: !!this.material
                });
            }
            if (this.frameCount === 300) {
                this._diagnoseVisibility();
            }
        }
    }
    _diagnoseVisibility() {
        if (!this.debugLogs) return;
        this._dlog('\n═══════════════════════════════════════════════════════');
        this._dlog('[GroundFog] 🔍 VISIBILITY DIAGNOSTIC (after ~5s)');
        this._dlog('═══════════════════════════════════════════════════════');
        const pos = this.entity.getPosition();
        const scale = this.entity.getLocalScale();
        this._dlog('📦 Fog Box Info:', {
            position: pos.toString(),
            scale: scale.toString(),
            volume: `${scale.x} wide × ${scale.y} tall × ${scale.z} deep`
        });
        // Find camera
        const camera = this.app.root.findComponent('camera');
        if (camera) {
            const camPos = camera.entity.getPosition();
            const distance = camPos.distance(pos);
            this._dlog('📷 Camera Info:', {
                position: camPos.toString(),
                distanceToFog: `${distance.toFixed(2)} units`,
                likelyVisible: distance < scale.x / 2 ? 'YES' : 'MAYBE NOT (far)'
            });
        }
        this._dlog('🎨 Material Status:', {
            materialExists: !!this.material,
            textureLoaded: !!(this.cloudsTexture && this.cloudsTexture.resource),
            debugMode: this.debugMode ? 'ON (solid fog)' : 'OFF (normal fog)',
            softness: this.softness,
            fogIntensity: this.fogIntensity,
            textureScale: this.textureScale,
            animationSpeed: this.animationSpeed,
            enableAnimation: this.enableAnimation,
            opacity: this.opacity
        });
        if (this.opacity < 0.3) {
            this._dlog('💡 Tip: Low opacity makes fog nearly invisible. Try 0.5–1.0.');
        }
        if (!this.debugMode && this.softness > 100) {
            this._dlog('💡 Tip: High Softness can make fog faint. Try 20–50 for more visible fog.');
        }
        if (this.fogIntensity < 0.5) {
            this._dlog('💡 Tip: Low intensity makes fog subtle. Try 1.0–2.0 for denser fog.');
        }
        if (!this.enableAnimation) {
            this._dlog('💡 Info: Animation is disabled. Fog will be static.');
        }
        if (pos.y < 0) {
            this._dlog(`💡 Tip: Fog box Y=${pos.y.toFixed(2)} might be below ground. Position at Y = box height / 2.`);
        }
        this._dlog('═══════════════════════════════════════════════════════\n');
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (this.material) {
            this.material.destroy();
            this.material = null;
        }
        this._dlog('[GroundFog] Destroyed');
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES - All exposed to PlayCanvas Editor Inspector
        // ============================================================================
        /** @attribute @type {pc.Asset} @assetType {texture} @title Clouds Texture */ _define_property(this, "cloudsTexture", null);
        /** @attribute @type {number} @min 0.1 @max 1000 @title Softness @description Controls edge blending with geometry */ _define_property(this, "softness", 50);
        /** @attribute @type {pc.Vec3} @title Fog Color @description RGB color of the fog */ _define_property(this, "fogColor", new Vec3(0.9, 0.9, 0.95));
        /** @attribute @type {number} @min 0.1 @max 5.0 @title Fog Intensity @description Overall fog density/opacity */ _define_property(this, "fogIntensity", 1.0);
        /** @attribute @type {number} @min 0.01 @max 1.0 @title Texture Scale @description Controls texture tiling size */ _define_property(this, "textureScale", 0.1);
        /** @attribute @type {number} @min 0.1 @max 5.0 @title Animation Speed @description Speed multiplier for fog animation */ _define_property(this, "animationSpeed", 1.0);
        /** @attribute @type {boolean} @title Enable Animation @description Toggle fog movement on/off */ _define_property(this, "enableAnimation", true);
        /** @attribute @type {number} @min 0 @max 1 @title Opacity @description Master opacity control (0=invisible, 1=full) */ _define_property(this, "opacity", 1.0);
        /** @attribute @type {boolean} @title Cast Shadows @description Allow fog to cast shadows */ _define_property(this, "castShadows", false);
        /** @attribute @type {boolean} @title Receive Shadows @description Allow fog to receive shadows */ _define_property(this, "receiveShadows", false);
        /** @attribute @type {boolean} @title Debug Mode (Solid Fog) @description Show solid semi-transparent box for testing */ _define_property(this, "debugMode", false);
        /** @attribute @type {boolean} @title Debug Logs @description Enable console logging for diagnostics */ _define_property(this, "debugLogs", false);
    }
}
_define_property(GroundFog, "scriptName", 'groundFog');
// ============================================================================
// SHADER CODE (GLSL)
// ============================================================================
_define_property(GroundFog, "VERTEX_SHADER_GLSL", `
#include "screenDepthPS"

attribute vec4 vertex_position;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform float uTime;
uniform float uTextureScale;
uniform float uAnimationSpeed;

varying vec2 texCoord0;
varying vec2 texCoord1;
varying vec2 texCoord2;
varying vec4 screenPos;
varying float depth;

void main(void)
{
    // Use world position XZ for texture coordinates (works with box)
    vec4 worldPos = matrix_model * vertex_position;
    vec2 baseTexCoord = worldPos.xz * uTextureScale;
    
    float timeScaled = uTime * uAnimationSpeed;
    
    // 3 scrolling texture coordinates with different direction and speed
    texCoord0 = baseTexCoord * 2.0 + vec2(timeScaled * 0.003, timeScaled * 0.01);
    texCoord1 = baseTexCoord * 1.5 + vec2(timeScaled * -0.02, timeScaled * 0.02);
    texCoord2 = baseTexCoord * 1.0 + vec2(timeScaled * 0.01, timeScaled * -0.003);

    // Position in projected (screen) space
    vec4 projPos = matrix_viewProjection * worldPos;
    gl_Position = projPos;

    // The linear depth of the vertex (in camera space)
    depth = getLinearDepth(worldPos.xyz);

    // Screen fragment position, used to sample the depth texture
    screenPos = projPos;
}
`);
_define_property(GroundFog, "FRAGMENT_SHADER_GLSL", `
#include "screenDepthPS"

uniform sampler2D uTexture;
uniform float uSoftening;
uniform vec3 uFogColor;
uniform float uFogIntensity;
uniform float uOpacity;
uniform float uDebugMode;

varying vec2 texCoord0;
varying vec2 texCoord1;
varying vec2 texCoord2;
varying vec4 screenPos;
varying float depth;

void main(void)
{
    // Sample the texture 3 times and compute average intensity of the fog
    vec4 diffusTexture0 = texture2D (uTexture, texCoord0);
    vec4 diffusTexture1 = texture2D (uTexture, texCoord1);
    vec4 diffusTexture2 = texture2D (uTexture, texCoord2);
    float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r) * uFogIntensity * uOpacity;

    // Debug mode - just show solid fog for testing
    if (uDebugMode > 0.5) {
        gl_FragColor = vec4(uFogColor, 0.8 * uOpacity);
        return;
    }

    // Use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    vec2 screenCoord = getGrabScreenPos(screenPos);

    // Read the depth from the depth buffer
    float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;

    // Depth of the current fragment (on the fog volume)
    float fragmentDepth = depth * camera_params.x;

    // Difference between these two depths is used to adjust the alpha, to fade out
    // the fog near the geometry
    float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);
    alpha *= smoothstep(0.0, 1.0, depthDiff);

    // Final color
    gl_FragColor = vec4(uFogColor, alpha);
}
`);
// ============================================================================
// SHADER CODE (WGSL)
// ============================================================================
_define_property(GroundFog, "VERTEX_SHADER_WGSL", `
#include "screenDepthPS"

attribute vertex_position: vec4f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uTime: f32;
uniform uTextureScale: f32;
uniform uAnimationSpeed: f32;

varying texCoord0: vec2f;
varying texCoord1: vec2f;
varying texCoord2: vec2f;
varying screenPos: vec4f;
varying depth: f32;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPos: vec4f = uniform.matrix_model * vertex_position;
    let baseTexCoord: vec2f = worldPos.xz * uniform.uTextureScale;
    
    let timeScaled: f32 = uniform.uTime * uniform.uAnimationSpeed;

    output.texCoord0 = baseTexCoord * 2.0 + vec2f(timeScaled * 0.003, timeScaled * 0.01);
    output.texCoord1 = baseTexCoord * 1.5 + vec2f(timeScaled * -0.02, timeScaled * 0.02);
    output.texCoord2 = baseTexCoord * 1.0 + vec2f(timeScaled * 0.01, timeScaled * -0.003);

    let projPos: vec4f = uniform.matrix_viewProjection * worldPos;
    output.position = projPos;

    output.depth = getLinearDepth(worldPos.xyz);
    output.screenPos = projPos;

    return output;
}
`);
_define_property(GroundFog, "FRAGMENT_SHADER_WGSL", `
#include "screenDepthPS"

var uTexture: texture_2d<f32>;
var uTextureSampler: sampler;
uniform uSoftening: f32;
uniform uFogColor: vec3f;
uniform uFogIntensity: f32;
uniform uOpacity: f32;
uniform uDebugMode: f32;

varying texCoord0: vec2f;
varying texCoord1: vec2f;
varying texCoord2: vec2f;
varying screenPos: vec4f;
varying depth: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let diffusTexture0: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord0);
    let diffusTexture1: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord1);
    let diffusTexture2: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord2);
    var alpha: f32 = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r) * uniform.uFogIntensity * uniform.uOpacity;

    if (uniform.uDebugMode > 0.5) {
        output.color = vec4f(uniform.uFogColor, 0.8 * uniform.uOpacity);
        return output;
    }

    let screenCoord: vec2f = getGrabScreenPos(input.screenPos);
    let sceneDepth: f32 = getLinearScreenDepth(screenCoord) * uniform.camera_params.x;
    let fragmentDepth: f32 = input.depth * uniform.camera_params.x;

    let depthDiff: f32 = clamp(abs(fragmentDepth - sceneDepth) * uniform.uSoftening, 0.0, 1.0);
    alpha = alpha * smoothstep(0.0, 1.0, depthDiff);

    output.color = vec4f(uniform.uFogColor, alpha);
    return output;
}
`);

export { GroundFog };
