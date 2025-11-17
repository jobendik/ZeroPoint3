import { Script, ShaderMaterial, SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_NORMAL, CULLFACE_FRONT, Vec3 } from '../../../playcanvas-stable.min.mjs';
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
class DystopianSky extends Script {
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        if (this.debugMode) {
            Logger.debug('═══════════════════════════════════════════════════════');
            Logger.debug('[DystopianSky] ⚡ FIXED VERSION - Initializing...');
            Logger.debug('═══════════════════════════════════════════════════════');
        }
        // Check if texture is assigned
        if (!this.cloudTexture && this.debugMode) {
            Logger.warn('[DystopianSky] ⚠️ No cloud texture assigned!');
            Logger.warn('[DystopianSky] → Using procedural noise, but texture recommended for better quality');
        }
        // Check if entity has render component
        if (!this.entity.render) {
            Logger.error('[DystopianSky] ❌ No render component found!');
            Logger.error('[DystopianSky] → Attach this script to a sphere or dome entity with render component');
            return;
        }
        if (this.debugMode) {
            Logger.debug('[DystopianSky] 🎨 Sky Configuration:');
            Logger.debug('  - Sky Top Color:', this.skyColorTop.toString());
            Logger.debug('  - Sky Horizon Color:', this.skyColorHorizon.toString());
            Logger.debug('  - Cloud Speed:', this.cloudSpeed);
            Logger.debug('  - Cloud Coverage:', this.cloudCoverage, '(FIXED: 0=no clouds, 1=full clouds)');
            Logger.debug('  - Lightning:', this.enableLightning ? '✅ ENABLED' : '❌ Disabled');
            Logger.debug('  - Lightning Frequency:', this.lightningFrequency);
            Logger.debug('  - Storm Intensity:', this.stormIntensity);
        }
        // Get mesh instances
        const meshInstances = this.entity.render.meshInstances;
        if (!meshInstances || meshInstances.length === 0) {
            Logger.error('[DystopianSky] ❌ No mesh instances found!');
            return;
        }
        if (this.debugMode) {
            Logger.debug('[DystopianSky] ✅ Found', meshInstances.length, 'mesh instance(s)');
        }
        // Apply the sky shader
        this._applySkyMaterial(meshInstances);
        this.currentTime = 0;
        if (this.debugMode) {
            Logger.debug('[DystopianSky] ⚡ Dystopian sky initialized!');
            Logger.debug('');
            Logger.debug('🔧 DYNAMIC APOCALYPTIC FEATURES:');
            Logger.debug('  ✅ Color Cycling: Sky shifts between doom palettes');
            Logger.debug('  ✅ Atmospheric Pulsing: Breathing, ominous effect');
            Logger.debug('  ✅ Intense Lightning: Dramatic storm effects');
            Logger.debug('  ✅ Toxic Horizon: Radioactive wasteland glow');
            Logger.debug('  ✅ Turbulent Clouds: Chaotic movement and depth');
            Logger.debug('  ✅ Dynamic Cloud Colors: Clouds change with atmosphere');
            Logger.debug('  ✅ Color Grading: Apocalyptic desaturation and tint');
            Logger.debug('');
            Logger.debug('🎛️ ADJUST THESE FOR MAXIMUM DOOM:');
            Logger.debug('  - Storm Intensity: Higher = more chaos');
            Logger.debug('  - Lightning Frequency: Higher = constant threat');
            Logger.debug('  - Color Shift Speed: Higher = faster palette changes');
            Logger.debug('  - Atmosphere Pulse: Higher = more "breathing"');
            Logger.debug('═══════════════════════════════════════════════════════\n');
        }
    }
    _applySkyMaterial(meshInstances) {
        if (this.debugMode) {
            Logger.debug('[DystopianSky] 🎨 Creating sky shader material...');
        }
        // Create the shader material
        const material = new ShaderMaterial({
            uniqueName: 'DystopianSkyShader',
            vertexGLSL: DystopianSky.VERTEX_SHADER_GLSL,
            fragmentGLSL: DystopianSky.FRAGMENT_SHADER_GLSL,
            vertexWGSL: DystopianSky.VERTEX_SHADER_WGSL,
            fragmentWGSL: DystopianSky.FRAGMENT_SHADER_WGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_texCoord0: SEMANTIC_TEXCOORD0,
                vertex_normal: SEMANTIC_NORMAL
            }
        });
        if (this.debugMode) {
            Logger.debug('[DystopianSky] ✅ ShaderMaterial created');
            Logger.debug('  - Name:', material.name);
            Logger.debug('  - ID:', material.id);
        }
        // Set texture (or create a default one if not provided)
        if (this.cloudTexture && this.cloudTexture.resource) {
            material.setParameter('uCloudTexture', this.cloudTexture.resource);
            if (this.debugMode) {
                Logger.debug('  ✅ Cloud texture set:', this.cloudTexture.name);
                Logger.debug('    - Size:', this.cloudTexture.resource.width, 'x', this.cloudTexture.resource.height);
                Logger.debug('    - Format:', this.cloudTexture.resource.format);
            }
        } else {
            Logger.error('  ❌ NO TEXTURE! Shader will not work properly!');
            Logger.error('    → Assign a noise texture in the Cloud Noise Texture attribute');
        }
        // Set all parameters
        if (this.debugMode) {
            Logger.debug('[DystopianSky] 🔧 Setting shader parameters...');
        }
        material.setParameter('uTime', 0);
        material.setParameter('uSkyColorTop', [
            this.skyColorTop.x,
            this.skyColorTop.y,
            this.skyColorTop.z
        ]);
        material.setParameter('uSkyColorHorizon', [
            this.skyColorHorizon.x,
            this.skyColorHorizon.y,
            this.skyColorHorizon.z
        ]);
        material.setParameter('uSkyColorTop2', [
            this.skyColorTop2.x,
            this.skyColorTop2.y,
            this.skyColorTop2.z
        ]);
        material.setParameter('uSkyColorHorizon2', [
            this.skyColorHorizon2.x,
            this.skyColorHorizon2.y,
            this.skyColorHorizon2.z
        ]);
        material.setParameter('uCloudColorDark', [
            this.cloudColorDark.x,
            this.cloudColorDark.y,
            this.cloudColorDark.z
        ]);
        material.setParameter('uCloudColorLight', [
            this.cloudColorLight.x,
            this.cloudColorLight.y,
            this.cloudColorLight.z
        ]);
        // Check color contrast only in debug
        if (this.debugMode) {
            const darkBrightness = (this.cloudColorDark.x + this.cloudColorDark.y + this.cloudColorDark.z) / 3;
            const lightBrightness = (this.cloudColorLight.x + this.cloudColorLight.y + this.cloudColorLight.z) / 3;
            const contrast = lightBrightness - darkBrightness;
            Logger.debug('  📊 Cloud color contrast:', contrast.toFixed(3));
            if (contrast < 0.1) {
                Logger.warn('  ⚠️ LOW CONTRAST! Clouds might be hard to see');
                Logger.warn('    → Increase Cloud Color Light values for more visible clouds');
            }
        }
        material.setParameter('uCloudSpeed', this.cloudSpeed);
        material.setParameter('uCloudCoverage', this.cloudCoverage);
        material.setParameter('uLightningFrequency', this.lightningFrequency);
        material.setParameter('uLightningColor', [
            this.lightningColor.x,
            this.lightningColor.y,
            this.lightningColor.z
        ]);
        material.setParameter('uStormIntensity', this.stormIntensity);
        material.setParameter('uEnableLightning', this.enableLightning ? 1.0 : 0.0);
        material.setParameter('uDebugMode', this.debugMode ? 1.0 : 0.0);
        material.setParameter('uColorShiftSpeed', this.colorShiftSpeed);
        material.setParameter('uAtmospherePulse', this.atmospherePulse);
        // Important: Sky should be rendered from inside
        material.cull = CULLFACE_FRONT; // Render inside faces for sky dome
        material.depthWrite = false;
        material.depthTest = true;
        material.update();
        if (this.debugMode) {
            Logger.debug('[DystopianSky] 🎨 Material render settings:');
            Logger.debug('  - Cull mode: CULLFACE_FRONT (inside faces)');
            Logger.debug('  - Depth write: false');
            Logger.debug('  - Depth test: true');
        }
        this.material = material;
        // Apply to all mesh instances
        for(let i = 0; i < meshInstances.length; i++){
            meshInstances[i].material = material;
            if (this.debugMode) {
                Logger.debug('  ✅ Sky material applied to mesh', i);
            }
        }
        // Disable shadows
        this.entity.render.castShadows = false;
        this.entity.render.receiveShadows = false;
        if (this.debugMode) {
            Logger.debug('[DystopianSky] 🚫 Shadows disabled');
            Logger.debug('[DystopianSky] ⚡ Dystopian sky shader applied successfully!');
            Logger.debug('');
            Logger.debug('🔍🔍🔍 DEBUG MODE IS ON 🔍🔍🔍');
            Logger.debug('You should see:');
            Logger.debug('  - RED = Cloud layer 1 (slow)');
            Logger.debug('  - GREEN = Cloud layer 2 (medium)');
            Logger.debug('  - BLUE = Cloud layer 3 (fast/turbulent)');
            Logger.debug('  - YELLOW/CYAN/MAGENTA = Layer combinations');
            Logger.debug('  - WHITE GRID = UV coordinates');
            Logger.debug('  - BOTTOM STRIP = Height gradient');
            Logger.debug('  - TOP STRIP = Combined cloud density');
            Logger.debug('Turn OFF Debug Mode to see normal sky!');
            Logger.debug('🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍');
            Logger.debug('');
        }
    }
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    update(dt) {
        if (!this.material) return;
        // Update time
        this.currentTime += dt;
        this.material.setParameter('uTime', this.currentTime);
        // Update all parameters (allow runtime changes)
        this.material.setParameter('uSkyColorTop', [
            this.skyColorTop.x,
            this.skyColorTop.y,
            this.skyColorTop.z
        ]);
        this.material.setParameter('uSkyColorHorizon', [
            this.skyColorHorizon.x,
            this.skyColorHorizon.y,
            this.skyColorHorizon.z
        ]);
        this.material.setParameter('uSkyColorTop2', [
            this.skyColorTop2.x,
            this.skyColorTop2.y,
            this.skyColorTop2.z
        ]);
        this.material.setParameter('uSkyColorHorizon2', [
            this.skyColorHorizon2.x,
            this.skyColorHorizon2.y,
            this.skyColorHorizon2.z
        ]);
        this.material.setParameter('uCloudColorDark', [
            this.cloudColorDark.x,
            this.cloudColorDark.y,
            this.cloudColorDark.z
        ]);
        this.material.setParameter('uCloudColorLight', [
            this.cloudColorLight.x,
            this.cloudColorLight.y,
            this.cloudColorLight.z
        ]);
        this.material.setParameter('uCloudSpeed', this.cloudSpeed);
        this.material.setParameter('uCloudCoverage', this.cloudCoverage);
        this.material.setParameter('uLightningFrequency', this.lightningFrequency);
        this.material.setParameter('uLightningColor', [
            this.lightningColor.x,
            this.lightningColor.y,
            this.lightningColor.z
        ]);
        this.material.setParameter('uStormIntensity', this.stormIntensity);
        this.material.setParameter('uEnableLightning', this.enableLightning ? 1.0 : 0.0);
        this.material.setParameter('uDebugMode', this.debugMode ? 1.0 : 0.0);
        this.material.setParameter('uColorShiftSpeed', this.colorShiftSpeed);
        this.material.setParameter('uAtmospherePulse', this.atmospherePulse);
        // Diagnostic logging every 5 seconds - ONLY IN DEBUG MODE
        if (this.debugMode) {
            if (!this.frameCount) this.frameCount = 0;
            this.frameCount++;
            if (this.frameCount % 300 === 0) {
                this._logDiagnostics();
            }
        }
    }
    _logDiagnostics() {
        Logger.debug('');
        Logger.debug('═══════════════════════════════════════════════════════');
        Logger.debug('[DystopianSky] 📊 DIAGNOSTIC (', this.currentTime.toFixed(1), 'seconds elapsed)');
        Logger.debug('═══════════════════════════════════════════════════════');
        Logger.debug('🎨 Current Settings:');
        Logger.debug('  - Debug Mode:', this.debugMode ? '🔍 ON' : '❌ OFF');
        Logger.debug('  - Cloud Coverage:', this.cloudCoverage.toFixed(2), '(0=none, 1=full)');
        Logger.debug('  - Cloud Speed:', this.cloudSpeed.toFixed(2));
        Logger.debug('  - Storm Intensity:', this.stormIntensity.toFixed(2));
        Logger.debug('  - Lightning:', this.enableLightning ? '⚡ ON (freq: ' + this.lightningFrequency + ')' : '❌ OFF');
        // Calculate color contrast
        const darkBrightness = (this.cloudColorDark.x + this.cloudColorDark.y + this.cloudColorDark.z) / 3;
        const lightBrightness = (this.cloudColorLight.x + this.cloudColorLight.y + this.cloudColorLight.z) / 3;
        const contrast = lightBrightness - darkBrightness;
        Logger.debug('');
        Logger.debug('☁️ Cloud Visibility Analysis:');
        Logger.debug('  - Dark cloud brightness:', darkBrightness.toFixed(3));
        Logger.debug('  - Light cloud brightness:', lightBrightness.toFixed(3));
        Logger.debug('  - Contrast:', contrast.toFixed(3));
        if (contrast < 0.2) {
            Logger.warn('  ⚠️ LOW CONTRAST - Clouds might be faint');
        } else if (contrast < 0.4) {
            Logger.debug('  ✅ MODERATE CONTRAST - Clouds should be visible');
        } else {
            Logger.debug('  ✅ GOOD CONTRAST - Clouds clearly visible');
        }
        Logger.debug('');
        Logger.debug('💡 Status:');
        if (!this.cloudTexture || !this.cloudTexture.resource) {
            Logger.error('  ❌ NO TEXTURE ASSIGNED!');
            Logger.error('    → Assign a cloud noise texture for proper clouds');
        } else {
            Logger.debug('  ✅ Texture assigned:', this.cloudTexture.name);
        }
        if (this.debugMode) {
            Logger.debug('  🔍 Debug mode is ON - showing raw texture layers');
        }
        if (this.cloudCoverage < 0.2) {
            Logger.debug('  📊 Cloud Coverage is VERY LOW (', this.cloudCoverage.toFixed(2), ')');
            Logger.debug('    → Fewer clouds visible (mostly clear sky)');
        } else if (this.cloudCoverage < 0.5) {
            Logger.debug('  📊 Cloud Coverage is LOW (', this.cloudCoverage.toFixed(2), ')');
            Logger.debug('    → Some clouds visible');
        } else if (this.cloudCoverage < 0.8) {
            Logger.debug('  ✅ Cloud Coverage is MEDIUM (', this.cloudCoverage.toFixed(2), ')');
            Logger.debug('    → Good cloud presence');
        } else {
            Logger.debug('  ✅ Cloud Coverage is HIGH (', this.cloudCoverage.toFixed(2), ')');
            Logger.debug('    → Maximum clouds visible');
        }
        Logger.debug('═══════════════════════════════════════════════════════\n');
    }
    // ============================================================================
    // CLEANUP
    // ============================================================================
    destroy() {
        if (this.material) {
            this.material.destroy();
            this.material = null;
        }
        if (this.debugMode) {
            Logger.debug('[DystopianSky] ⚡ Destroyed');
        }
    }
    constructor(...args){
        super(...args);
        // ============================================================================
        // ATTRIBUTES
        // ============================================================================
        /** @attribute @type {pc.Asset} @assetType {texture} @title Cloud Noise Texture */ _define_property(this, "cloudTexture", null);
        /** @attribute @type {pc.Vec3} @title Sky Color (Top) - Palette 1 */ _define_property(this, "skyColorTop", new Vec3(0.4, 0.2, 0.5)) // BRIGHT purple
        ;
        /** @attribute @type {pc.Vec3} @title Sky Color (Horizon) - Palette 1 */ _define_property(this, "skyColorHorizon", new Vec3(1.0, 0.4, 0.2)) // BRIGHT toxic orange-red
        ;
        /** @attribute @type {pc.Vec3} @title Sky Color (Top) - Palette 2 */ _define_property(this, "skyColorTop2", new Vec3(0.2, 0.45, 0.3)) // BRIGHT toxic green
        ;
        /** @attribute @type {pc.Vec3} @title Sky Color (Horizon) - Palette 2 */ _define_property(this, "skyColorHorizon2", new Vec3(1.2, 0.6, 0.15)) // INTENSE burning orange
        ;
        /** @attribute @type {pc.Vec3} @title Cloud Color Dark */ _define_property(this, "cloudColorDark", new Vec3(0.3, 0.25, 0.35)) // Much brighter dark clouds
        ;
        /** @attribute @type {pc.Vec3} @title Cloud Color Light */ _define_property(this, "cloudColorLight", new Vec3(1.2, 0.95, 0.85)) // Very bright glow (HDR)
        ;
        /** @attribute @type {number} @min 0 @max 1 @title Color Shift Speed */ _define_property(this, "colorShiftSpeed", 0.1) // How fast colors transition
        ;
        /** @attribute @type {number} @min 0 @max 1 @title Atmosphere Pulse Intensity */ _define_property(this, "atmospherePulse", 0.3) // Breathing/pulsing effect
        ;
        /** @attribute @type {number} @min 0 @max 2 @title Cloud Speed */ _define_property(this, "cloudSpeed", 0.5);
        /** @attribute @type {number} @min 0 @max 1 @title Cloud Coverage */ _define_property(this, "cloudCoverage", 0.4) // Reduced so colorful sky shows through more
        ;
        /** @attribute @type {number} @min 0 @max 5 @title Lightning Frequency */ _define_property(this, "lightningFrequency", 1.0);
        /** @attribute @type {pc.Vec3} @title Lightning Color */ _define_property(this, "lightningColor", new Vec3(0.8, 0.9, 1.0)) // Blue-white
        ;
        /** @attribute @type {number} @min 0 @max 1 @title Storm Intensity */ _define_property(this, "stormIntensity", 0.7);
        /** @attribute @type {boolean} @title Enable Lightning */ _define_property(this, "enableLightning", true);
        /** @attribute @type {boolean} @title Debug Mode */ _define_property(this, "debugMode", false);
    }
}
_define_property(DystopianSky, "scriptName", 'dystopianSky');
// ============================================================================
// SHADER CODE (GLSL)
// ============================================================================
_define_property(DystopianSky, "VERTEX_SHADER_GLSL", `
attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;
attribute vec3 vertex_normal;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main(void)
{
    // UV coordinates for texture sampling
    vUv = vertex_texCoord0;
    
    // World position for effects
    vec4 worldPos = matrix_model * vec4(vertex_position, 1.0);
    vWorldPos = worldPos.xyz;
    
    // Pass normal for smooth height calculation
    vNormal = vertex_normal;
    
    // Final position
    gl_Position = matrix_viewProjection * worldPos;
}
`);
_define_property(DystopianSky, "FRAGMENT_SHADER_GLSL", `
precision highp float;

uniform sampler2D uCloudTexture;
uniform float uTime;
uniform vec3 uSkyColorTop;
uniform vec3 uSkyColorHorizon;
uniform vec3 uSkyColorTop2;
uniform vec3 uSkyColorHorizon2;
uniform vec3 uCloudColorDark;
uniform vec3 uCloudColorLight;
uniform float uCloudSpeed;
uniform float uCloudCoverage;
uniform float uLightningFrequency;
uniform vec3 uLightningColor;
uniform float uStormIntensity;
uniform float uEnableLightning;
uniform float uDebugMode;
uniform float uColorShiftSpeed;
uniform float uAtmospherePulse;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

// Simple noise function for variation
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise for atmospheric effects
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Lightning flash function - SMOOTH, NO CLIPPING
float lightning(float time, float frequency) {
    if (uEnableLightning < 0.5) return 0.0;
    
    // Create random lightning strikes
    float t = time * frequency;
    float strike = floor(t);
    float phase = fract(t);
    
    // Random chance for strike
    float random = hash(vec2(strike, 0.0));
    if (random < 0.5) return 0.0;  // 50% chance of lightning
    
    // Lightning flash profile - SMOOTHER, less harsh
    float flash = 0.0;
    if (phase < 0.03) {
        flash = 0.8;  // Reduced from 1.5
    } else if (phase < 0.06) {
        flash = 0.5;  // Reduced from 0.8
    } else if (phase < 0.09) {
        flash = 0.6;  // Reduced from 1.2
    } else if (phase < 0.15) {
        flash = 0.3;  // Reduced from 0.4
    } else if (phase < 0.25) {
        flash = smoothstep(0.25, 0.15, phase) * 0.4;  // Reduced from 0.6
    }
    
    // Random intensity variation - MORE CONTROLLED
    flash *= 0.5 + 0.4 * hash(vec2(strike, 1.0));  // Reduced range
    
    return flash;
}

void main(void)
{
    // Calculate height factor using interpolated vertex normal (NO SEAMS!)
    // Use the normal's Y component which is smoothly interpolated
    float height = vNormal.y * 0.5 + 0.5;
    height = clamp(height, 0.0, 1.0);
    
    // === DYNAMIC COLOR CYCLING ===
    // Slow color shift between two apocalyptic palettes
    float colorCycle = sin(uTime * uColorShiftSpeed * 0.1) * 0.5 + 0.5;
    vec3 currentSkyTop = mix(uSkyColorTop, uSkyColorTop2, colorCycle);
    vec3 currentSkyHorizon = mix(uSkyColorHorizon, uSkyColorHorizon2, colorCycle);
    
    // === ATMOSPHERIC PULSING ===
    // Breathing/ominous pulsing effect - AMPLIFIED
    float pulse = sin(uTime * 0.3) * 0.5 + 0.5;
    float atmosphericIntensity = 1.2 + pulse * uAtmospherePulse;  // Brighter base
    
    // Base sky gradient with dynamic colors
    vec3 skyColor = mix(currentSkyHorizon, currentSkyTop, pow(height, 0.6));
    skyColor *= atmosphericIntensity;
    
    // === TOXIC HORIZON GLOW ===
    // Intense glowing effect at horizon - DOUBLED
    float horizonGlow = pow(1.0 - height, 3.0) * 1.5;  // Was 0.8, now 1.5
    vec3 toxicGlow = vec3(1.0, 0.5, 0.15) * horizonGlow;  // Brighter toxic color
    skyColor += toxicGlow * (0.8 + pulse * 0.5);  // More intense
    
    // === CLOUD LAYER 1 (slow, large) - MORE TURBULENT ===
    vec2 cloudUV1 = vUv * 2.5 + vec2(uTime * uCloudSpeed * 0.025, uTime * uCloudSpeed * 0.015);
    float cloud1 = texture2D(uCloudTexture, cloudUV1).r;
    
    // === CLOUD LAYER 2 (medium speed) - FASTER ===
    vec2 cloudUV2 = vUv * 3.5 + vec2(uTime * uCloudSpeed * -0.04, uTime * uCloudSpeed * 0.05);
    float cloud2 = texture2D(uCloudTexture, cloudUV2).g;
    
    // === CLOUD LAYER 3 (fast, turbulent) - VERY TURBULENT ===
    vec2 cloudUV3 = vUv * 5.0 + vec2(uTime * uCloudSpeed * 0.07, uTime * uCloudSpeed * -0.03);
    vec2 turbulence = vec2(
        texture2D(uCloudTexture, cloudUV3 * 0.5).r,
        texture2D(uCloudTexture, cloudUV3 * 0.5 + 0.5).g
    ) * 0.2 * uStormIntensity;  // DOUBLED turbulence
    vec2 cloudUV3Distorted = cloudUV3 + turbulence;
    float cloud3 = texture2D(uCloudTexture, cloudUV3Distorted).b;
    
    // === DEBUG MODE ===
    if (uDebugMode > 0.5) {
        vec3 debugColor = vec3(0.0);
        debugColor += vec3(cloud1, 0.0, 0.0);
        debugColor += vec3(0.0, cloud2, 0.0);
        debugColor += vec3(0.0, 0.0, cloud3);
        
        float combinedDensity = (cloud1 + cloud2 + cloud3) / 3.0;
        
        float gridX = fract(vUv.x * 10.0);
        float gridY = fract(vUv.y * 10.0);
        float grid = step(0.95, gridX) + step(0.95, gridY);
        debugColor += vec3(grid * 0.3);
        
        if (vUv.y < 0.1) {
            debugColor = vec3(height);
        }
        
        if (vUv.y > 0.9) {
            debugColor = vec3(combinedDensity);
        }
        
        gl_FragColor = vec4(debugColor, 1.0);
        return;
    }
    
    // === NORMAL MODE ===
    
    // Combine cloud layers with MORE variation
    float cloudDensity = (cloud1 * 0.6 + cloud2 * 0.3 + cloud3 * 0.1);
    
    // Apply coverage correctly
    cloudDensity = pow(cloudDensity, 1.0 - uCloudCoverage * 0.8);
    
    // Apply storm intensity - MORE DRAMATIC
    cloudDensity = mix(cloudDensity, cloudDensity * 2.0, uStormIntensity);
    
    // Scale by coverage
    cloudDensity *= (0.3 + uCloudCoverage * 0.7);
    
    // === DYNAMIC CLOUD COLORS ===
    // Clouds change color based on atmospheric conditions
    vec3 dynamicCloudLight = mix(uCloudColorLight, vec3(1.0, 0.6, 0.3), pulse * 0.3);
    vec3 cloudColor = mix(uCloudColorDark, dynamicCloudLight, cloud2 * 0.8 + 0.2);
    
    // Add colored highlights to clouds
    float cloudHighlight = pow(cloud1, 2.0) * 0.3;
    cloudColor += currentSkyHorizon * cloudHighlight;
    
    // Mix sky with clouds - Let sky colors show through MORE
    vec3 finalColor = mix(skyColor, cloudColor, cloudDensity * 0.65);
    
    // === SOFT ATMOSPHERIC LIGHTNING (NO WHITE PIXELS!) ===
    float flash = lightning(uTime, uLightningFrequency);
    if (flash > 0.0) {
        // Lightning is a SOFT atmospheric glow, not bright pixels
        // It subtly brightens the entire sky and clouds
        
        // Soft overall brightening
        vec3 lightningAmbient = uLightningColor * flash * 0.15;  // Very subtle
        finalColor += lightningAmbient;
        
        // Clouds glow from within during lightning
        float cloudGlow = flash * cloudDensity * 0.3;
        finalColor += uLightningColor * cloudGlow * 0.2;
        
        // Subtle horizon flash
        finalColor += lightningAmbient * horizonGlow * 0.1;
        
        // NO INDIVIDUAL BOLT SOURCES - just soft ambient glow!
    }
    
    // === PROCEDURAL ATMOSPHERIC NOISE ===
    // Add subtle animated noise for alive feeling
    float atmoNoise = noise(vUv * 50.0 + uTime * 0.1) * 0.03;
    finalColor += atmoNoise;
    
    // === COLOR GRADING - Apocalyptic look ===
    // Keep colors MORE vivid - less desaturation
    float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(luminance), finalColor, 0.95);  // Minimal desaturation (was 0.85)
    finalColor *= vec3(1.05, 1.0, 0.98);  // Slightly enhance colors
    
    // Contrast boost for drama
    finalColor = pow(finalColor, vec3(1.15));  // More contrast
    
    // Ensure bounds - allow HDR for bloom
    finalColor = clamp(finalColor, vec3(0.0), vec3(2.0));  // Higher HDR ceiling
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`);
// ============================================================================
// SHADER CODE (WGSL)
// ============================================================================
_define_property(DystopianSky, "VERTEX_SHADER_WGSL", `
attribute vertex_position: vec3f;
attribute vertex_texCoord0: vec2f;
attribute vertex_normal: vec3f;

uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;

varying vUv: vec2f;
varying vWorldPos: vec3f;
varying vNormal: vec3f;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // UV coordinates
    output.vUv = vertex_texCoord0;
    
    // World position
    let worldPos: vec4f = uniform.matrix_model * vec4f(vertex_position, 1.0);
    output.vWorldPos = worldPos.xyz;
    
    // Pass normal for smooth height calculation
    output.vNormal = vertex_normal;
    
    // Final position
    output.position = uniform.matrix_viewProjection * worldPos;
    
    return output;
}
`);
_define_property(DystopianSky, "FRAGMENT_SHADER_WGSL", `
var uCloudTexture: texture_2d<f32>;
var uCloudSampler: sampler;
uniform uTime: f32;
uniform uSkyColorTop: vec3f;
uniform uSkyColorHorizon: vec3f;
uniform uSkyColorTop2: vec3f;
uniform uSkyColorHorizon2: vec3f;
uniform uCloudColorDark: vec3f;
uniform uCloudColorLight: vec3f;
uniform uCloudSpeed: f32;
uniform uCloudCoverage: f32;
uniform uLightningFrequency: f32;
uniform uLightningColor: vec3f;
uniform uStormIntensity: f32;
uniform uEnableLightning: f32;
uniform uDebugMode: f32;
uniform uColorShiftSpeed: f32;
uniform uAtmospherePulse: f32;

varying vUv: vec2f;
varying vWorldPos: vec3f;
varying vNormal: vec3f;

fn hash(p: vec2f) -> f32 {
    return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
    let i: vec2f = floor(p);
    let f: vec2f = fract(p);
    let ff: vec2f = f * f * (3.0 - 2.0 * f);
    let a: f32 = hash(i);
    let b: f32 = hash(i + vec2f(1.0, 0.0));
    let c: f32 = hash(i + vec2f(0.0, 1.0));
    let d: f32 = hash(i + vec2f(1.0, 1.0));
    return mix(mix(a, b, ff.x), mix(c, d, ff.x), ff.y);
}

fn lightning(time: f32, frequency: f32) -> f32 {
    if (uniform.uEnableLightning < 0.5) {
        return 0.0;
    }
    
    let t: f32 = time * frequency;
    let strike: f32 = floor(t);
    let phase: f32 = fract(t);
    
    let random: f32 = hash(vec2f(strike, 0.0));
    if (random < 0.5) {
        return 0.0;
    }
    
    var flash: f32 = 0.0;
    if (phase < 0.03) {
        flash = 0.8;
    } else if (phase < 0.06) {
        flash = 0.5;
    } else if (phase < 0.09) {
        flash = 0.6;
    } else if (phase < 0.15) {
        flash = 0.3;
    } else if (phase < 0.25) {
        flash = smoothstep(0.25, 0.15, phase) * 0.4;
    }
    
    flash = flash * (0.5 + 0.4 * hash(vec2f(strike, 1.0)));
    
    return flash;
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    // Height factor using interpolated vertex normal (NO SEAMS!)
    var height: f32 = input.vNormal.y * 0.5 + 0.5;
    height = clamp(height, 0.0, 1.0);
    
    // Dynamic color cycling
    let colorCycle: f32 = sin(uniform.uTime * uniform.uColorShiftSpeed * 0.1) * 0.5 + 0.5;
    let currentSkyTop: vec3f = mix(uniform.uSkyColorTop, uniform.uSkyColorTop2, colorCycle);
    let currentSkyHorizon: vec3f = mix(uniform.uSkyColorHorizon, uniform.uSkyColorHorizon2, colorCycle);
    
    // Atmospheric pulsing - AMPLIFIED
    let pulse: f32 = sin(uniform.uTime * 0.3) * 0.5 + 0.5;
    let atmosphericIntensity: f32 = 1.2 + pulse * uniform.uAtmospherePulse;
    
    // Base sky gradient
    var skyColor: vec3f = mix(currentSkyHorizon, currentSkyTop, pow(height, 0.6));
    skyColor = skyColor * atmosphericIntensity;
    
    // Toxic horizon glow - DOUBLED
    let horizonGlow: f32 = pow(1.0 - height, 3.0) * 1.5;
    let toxicGlow: vec3f = vec3f(1.0, 0.5, 0.15) * horizonGlow;
    skyColor = skyColor + toxicGlow * (0.8 + pulse * 0.5);
    
    // Cloud layers
    let cloudUV1: vec2f = input.vUv * 2.5 + vec2f(uniform.uTime * uniform.uCloudSpeed * 0.025, uniform.uTime * uniform.uCloudSpeed * 0.015);
    let cloud1: f32 = textureSample(uCloudTexture, uCloudSampler, cloudUV1).r;
    
    let cloudUV2: vec2f = input.vUv * 3.5 + vec2f(uniform.uTime * uniform.uCloudSpeed * -0.04, uniform.uTime * uniform.uCloudSpeed * 0.05);
    let cloud2: f32 = textureSample(uCloudTexture, uCloudSampler, cloudUV2).g;
    
    let cloudUV3: vec2f = input.vUv * 5.0 + vec2f(uniform.uTime * uniform.uCloudSpeed * 0.07, uniform.uTime * uniform.uCloudSpeed * -0.03);
    let turbulence: vec2f = vec2f(
        textureSample(uCloudTexture, uCloudSampler, cloudUV3 * 0.5).r,
        textureSample(uCloudTexture, uCloudSampler, cloudUV3 * 0.5 + 0.5).g
    ) * 0.2 * uniform.uStormIntensity;
    let cloudUV3Distorted: vec2f = cloudUV3 + turbulence;
    let cloud3: f32 = textureSample(uCloudTexture, uCloudSampler, cloudUV3Distorted).b;
    
    // Debug mode
    if (uniform.uDebugMode > 0.5) {
        var debugColor: vec3f = vec3f(0.0);
        
        debugColor = debugColor + vec3f(cloud1, 0.0, 0.0);
        debugColor = debugColor + vec3f(0.0, cloud2, 0.0);
        debugColor = debugColor + vec3f(0.0, 0.0, cloud3);
        
        let combinedDensity: f32 = (cloud1 + cloud2 + cloud3) / 3.0;
        
        let gridX: f32 = fract(input.vUv.x * 10.0);
        let gridY: f32 = fract(input.vUv.y * 10.0);
        let grid: f32 = step(0.95, gridX) + step(0.95, gridY);
        debugColor = debugColor + vec3f(grid * 0.3);
        
        if (input.vUv.y < 0.1) {
            debugColor = vec3f(height);
        }
        
        if (input.vUv.y > 0.9) {
            debugColor = vec3f(combinedDensity);
        }
        
        output.color = vec4f(debugColor, 1.0);
        return output;
    }
    
    // Combine clouds
    var cloudDensity: f32 = cloud1 * 0.6 + cloud2 * 0.3 + cloud3 * 0.1;
    
    cloudDensity = pow(cloudDensity, 1.0 - uniform.uCloudCoverage * 0.8);
    
    cloudDensity = mix(cloudDensity, cloudDensity * 2.0, uniform.uStormIntensity);
    
    cloudDensity = cloudDensity * (0.3 + uniform.uCloudCoverage * 0.7);
    
    // Dynamic cloud colors
    let dynamicCloudLight: vec3f = mix(uniform.uCloudColorLight, vec3f(1.0, 0.6, 0.3), pulse * 0.3);
    var cloudColor: vec3f = mix(uniform.uCloudColorDark, dynamicCloudLight, cloud2 * 0.8 + 0.2);
    
    let cloudHighlight: f32 = pow(cloud1, 2.0) * 0.3;
    cloudColor = cloudColor + currentSkyHorizon * cloudHighlight;
    
    // Mix sky and clouds - Let sky show through
    var finalColor: vec3f = mix(skyColor, cloudColor, cloudDensity * 0.65);
    
    // Soft atmospheric lightning (no white pixels)
    let flash: f32 = lightning(uniform.uTime, uniform.uLightningFrequency);
    if (flash > 0.0) {
        // Soft overall brightening
        let lightningAmbient: vec3f = uniform.uLightningColor * flash * 0.15;
        finalColor = finalColor + lightningAmbient;
        
        // Clouds glow from within
        let cloudGlow: f32 = flash * cloudDensity * 0.3;
        finalColor = finalColor + uniform.uLightningColor * cloudGlow * 0.2;
        
        // Subtle horizon flash
        finalColor = finalColor + lightningAmbient * horizonGlow * 0.1;
    }
    
    // Procedural atmospheric noise
    let atmoNoise: f32 = noise(input.vUv * 50.0 + uniform.uTime * 0.1) * 0.03;
    finalColor = finalColor + atmoNoise;
    
    // Color grading - keep vivid
    let luminance: f32 = dot(finalColor, vec3f(0.299, 0.587, 0.114));
    finalColor = mix(vec3f(luminance), finalColor, 0.95);
    finalColor = finalColor * vec3f(1.05, 1.0, 0.98);
    
    // Contrast boost
    finalColor = pow(finalColor, vec3f(1.15));
    
    finalColor = clamp(finalColor, vec3f(0.0), vec3f(2.0));
    
    output.color = vec4f(finalColor, 1.0);
    
    return output;
}
`);

export { DystopianSky };
