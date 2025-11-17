import { Script, Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DEATH CAMERA CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE:
 * Creates a cinematic death experience with:
 * - Detached camera that orbits around dead player
 * - Smooth camera animations (backward drift + rotation)
 * - Post-processing effects (desaturation, chromatic aberration, DoF)
 * - Time manipulation (slow-motion death)
 * - Dramatic transitions
 * 
 * INSPIRED BY:
 * - Call of Duty: Slow-motion killcam
 * - Apex Legends: Orbital death camera
 * - Fortnite: Dramatic death presentation
 * 
 * TIMELINE:
 * 0.0s - 0.2s: IMPACT (slow-mo, screen shake, effects)
 * 0.2s - 2.7s: DEATH CAM (orbital camera, stats display)
 * 2.7s - 4.0s: DRAMATIC RUSH (camera swoops toward respawn)
 * 4.0s - 4.2s: RESURRECTION (white flash, instant respawn)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */ ///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
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
class DeathCameraController extends Script {
    initialize() {
        Logger.debug('[DeathCameraController] Initializing cinematic death camera system...');
        // Camera state
        this.isActive = false;
        this.originalParent = null;
        this.originalPosition = null;
        this.originalRotation = null;
        // Animation state
        this.deathStartTime = 0;
        this.deathBodyPosition = null;
        this.deathBodyRotation = null;
        // Camera animation parameters
        this.orbitRadius = 1.5; // Starting distance from body (close-up)
        this.orbitHeight = 2; // Height above body
        this.orbitSpeed = 0.3; // Rotation speed (radians/second)
        this.driftBackSpeed = 1.5; // Backward drift speed (1.5m/s)
        this.currentOrbitAngle = 0; // Current angle around body
        // Indoor FPS adjustments
        this.maxOrbitRadius = 3; // Max distance (prevent clipping through walls)
        this.minCameraHeight = 0.5; // Min height above body (stay low for indoor)
        this.maxCameraHeight = 1.5; // Max height (prevent clipping through ceiling)
        // Dramatic movement phases
        this.respawnPoint = null; // Where player will respawn
        this.currentPhase = 'none'; // Track animation phase
        this.rushStartPosition = null; // Camera position when rush phase starts
        this.rushStartRotation = null; // Camera rotation when rush phase starts
        // Find camera entity
        this.camera = this.entity.camera ? this.entity : this.entity.findByName('Camera');
        if (!this.camera) {
            Logger.error('[DeathCameraController] No camera found!');
            return;
        }
        // Get references to systems
        this.uiManager = this.app.gameManager?.uiManager;
        // ✅ Create self-contained visual overlays
        this._createVisualOverlays();
        Logger.info('[DeathCameraController] ✅ Initialized with visual overlays');
    }
    /**
     * ✅ NEW: Create self-contained visual overlays for death sequence
     */ _createVisualOverlays() {
        // Countdown overlay
        this.countdownOverlay = document.createElement('div');
        this.countdownOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: 'Orbitron', 'Rajdhani', 'Arial Black', sans-serif;
            font-size: 120px;
            font-weight: bold;
            color: #00ffff;
            text-shadow: 
                0 0 20px rgba(0,255,255,1),
                0 0 40px rgba(0,255,255,0.8),
                0 0 60px rgba(0,255,255,0.6),
                0 0 80px rgba(0,255,255,0.4);
            z-index: 99999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease-out, transform 0.1s ease-out;
        `;
        document.body.appendChild(this.countdownOverlay);
        // Respawn flash overlay
        this.respawnFlashOverlay = document.createElement('div');
        this.respawnFlashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 99998;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease-out;
        `;
        document.body.appendChild(this.respawnFlashOverlay);
        Logger.debug('[DeathCameraController] Visual overlays created');
    }
    /**
     * Activate cinematic death camera
     * @param {Vec3} bodyPosition - Position of dead player body
     * @param {Quat} bodyRotation - Rotation of dead player body
     * @param {Object} deathInfo - Death information (killer, weapon, stats)
     */ activateDeathCamera(bodyPosition, bodyRotation, deathInfo) {
        Logger.info('[DeathCameraController] 🎬 Activating cinematic death camera');
        this.isActive = true;
        this.deathStartTime = performance.now() / 1000;
        this.deathBodyPosition = bodyPosition.clone();
        this.deathBodyRotation = bodyRotation.clone();
        this.deathInfo = deathInfo || {};
        this.currentPhase = 'impact';
        // ✅ Calculate respawn point (where camera will rush toward at end)
        // For now, use death position + slight offset (in real game, this would be actual spawn point)
        this.respawnPoint = new Vec3(bodyPosition.x, bodyPosition.y + 1.6, bodyPosition.z);
        // ✅ FIX: Hide weapon models during death cam (they shouldn't follow camera)
        this._hideWeaponModels();
        // ✅ NEW APPROACH: Enable the PlayerModel Template entity and play death animation on it
        this._enablePlayerModelForDeath(bodyPosition, bodyRotation);
        // Store original camera state
        this.originalParent = this.camera.parent;
        this.originalPosition = this.camera.getLocalPosition().clone();
        this.originalRotation = this.camera.getLocalRotation().clone();
        // Detach camera from player
        const worldPos = this.camera.getPosition();
        const worldRot = this.camera.getRotation();
        this.camera.reparent(this.app.root);
        this.camera.setPosition(worldPos);
        this.camera.setRotation(worldRot);
        // Calculate initial orbit angle (behind player)
        const forward = new Vec3();
        bodyRotation.transformVector(Vec3.FORWARD, forward);
        this.currentOrbitAngle = Math.atan2(forward.x, forward.z) + Math.PI; // Start behind
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: IMPACT (0.2s)
        // ═══════════════════════════════════════════════════════════════════
        this._applyImpactEffects();
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: DEATH CAM (2.5s) - starts after impact
        // ═══════════════════════════════════════════════════════════════════
        setTimeout(()=>{
            this.currentPhase = 'deathcam';
            this._showDeathStats();
            this._applyDeathCameraEffects();
        }, 200);
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 3: DRAMATIC RUSH (1.3s) - starts at 2.7s
        // Camera accelerates and rushes toward respawn point!
        // NO countdown - just pure cinematic camera movement!
        // ═══════════════════════════════════════════════════════════════════
        setTimeout(()=>{
            this.currentPhase = 'rush';
            // ✅ Capture camera position at start of rush phase
            this.rushStartPosition = this.camera.getPosition().clone();
            this.rushStartRotation = this.camera.getRotation().clone();
        // No countdown - just let the camera do the talking!
        }, 2700);
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 4: RESURRECTION (white flash + respawn) - starts at 4.0s
        // ═══════════════════════════════════════════════════════════════════
        setTimeout(()=>{
            this.currentPhase = 'resurrection';
            this._applyRespawnEffects();
        }, 4000);
        // ═══════════════════════════════════════════════════════════════════
        // COMPLETE: Deactivate - starts at 4.2s (faster respawn!)
        // ═══════════════════════════════════════════════════════════════════
        setTimeout(()=>{
            this.currentPhase = 'none';
            this.deactivateDeathCamera();
        }, 4200);
    }
    /**
     * Phase 1: Impact Effects (0.2s)
     */ _applyImpactEffects() {
        Logger.debug('[DeathCameraController] 💥 Phase 1: IMPACT');
        // Slow-motion effect (dramatic!)
        this.app.timeScale = 0.2;
        // Massive screen shake
        this.app.fire('camera:shake', 0.8, 0.2);
        // Chromatic aberration + vignette (handled by UI)
        if (this.uiManager && this.uiManager.showDeathImpact) {
            this.uiManager.showDeathImpact();
        }
        // Restore normal time after impact
        setTimeout(()=>{
            this.app.timeScale = 1.0;
        }, 200);
    }
    /**
     * Phase 2: Death Camera Effects
     */ _applyDeathCameraEffects() {
        Logger.debug('[DeathCameraController] 🎥 Phase 2: DEATH CAM');
        // Apply post-processing effects
        if (this.uiManager && this.uiManager.showDeathCamera) {
            this.uiManager.showDeathCamera();
        }
    }
    /**
     * Show death statistics overlay
     */ _showDeathStats() {
        Logger.debug('[DeathCameraController] 📊 Showing death stats');
        if (this.uiManager && this.uiManager.showDeathStats) {
            this.uiManager.showDeathStats(this.deathInfo);
        } else {
            // Fallback: Fire event for UI to handle
            this.app.fire('death:showStats', this.deathInfo);
        }
    }
    /**
     * Phase 3: Respawn Countdown
     */ _startRespawnCountdown() {
        Logger.info('[DeathCameraController] 🔢 Phase 3: RESPAWN COUNTDOWN');
        console.log('[DeathCameraController] 🔢 Starting animated countdown: 3... 2... 1... GO!');
        // ✅ Self-contained countdown animation
        this._showCountdownAnimation();
    }
    /**
     * ✅ NEW: Show animated countdown (3... 2... 1... GO!) - MORE DRAMATIC
     */ _showCountdownAnimation() {
        let count = 3;
        const showCount = ()=>{
            if (count > 0) {
                // ✅ DRAMATIC: Larger scale, stronger glow
                this.countdownOverlay.textContent = count.toString();
                this.countdownOverlay.style.opacity = '1';
                this.countdownOverlay.style.transform = 'translate(-50%, -50%) scale(2.0)';
                this.countdownOverlay.style.textShadow = `
                    0 0 30px rgba(0,255,255,1),
                    0 0 60px rgba(0,255,255,1),
                    0 0 90px rgba(0,255,255,0.8),
                    0 0 120px rgba(0,255,255,0.6)
                `;
                console.log(`[DeathCameraController] 💥 Countdown: ${count}`);
                // Pulse animation (bigger!)
                setTimeout(()=>{
                    this.countdownOverlay.style.transform = 'translate(-50%, -50%) scale(1.5)';
                }, 120);
                // Fade out
                setTimeout(()=>{
                    this.countdownOverlay.style.opacity = '0';
                }, 280);
                count--;
                setTimeout(showCount, 333); // Next number after 333ms (3 numbers in 1 second)
            } else {
                // ✅ DRAMATIC: "GO!" is HUGE and GREEN
                this.countdownOverlay.textContent = 'GO!';
                this.countdownOverlay.style.opacity = '1';
                this.countdownOverlay.style.transform = 'translate(-50%, -50%) scale(2.5)';
                this.countdownOverlay.style.color = '#00ff00';
                this.countdownOverlay.style.textShadow = `
                    0 0 40px rgba(0,255,0,1),
                    0 0 80px rgba(0,255,0,1),
                    0 0 120px rgba(0,255,0,0.8),
                    0 0 160px rgba(0,255,0,0.6)
                `;
                console.log('[DeathCameraController] 💥 Countdown: GO!!!');
                // Explode outward!
                setTimeout(()=>{
                    this.countdownOverlay.style.transform = 'translate(-50%, -50%) scale(3.0)';
                    this.countdownOverlay.style.opacity = '0';
                }, 100);
                // Reset color after animation
                setTimeout(()=>{
                    this.countdownOverlay.style.color = '#00ffff';
                }, 400);
            }
        };
        showCount();
    }
    /**
     * Phase 4: Respawn Effects
     */ _applyRespawnEffects() {
        Logger.info('[DeathCameraController] ✨ Phase 4: RESURRECTION');
        console.log('[DeathCameraController] ✨ Phase 4: RESURRECTION - White flash burst!');
        // ✅ Self-contained white flash
        this._showRespawnFlash();
        // Clear death effects from UIManager if available
        if (this.uiManager && this.uiManager.hideDeathEffects) {
            this.uiManager.hideDeathEffects();
        }
    }
    /**
     * ✅ NEW: Show white flash for respawn (DRAMATIC!)
     */ _showRespawnFlash() {
        console.log('[DeathCameraController] 💥 WHITE FLASH BURST!');
        // ✅ DRAMATIC: Full white screen with immediate flash
        this.respawnFlashOverlay.style.transition = 'opacity 0.05s ease-out';
        this.respawnFlashOverlay.style.opacity = '1';
        // Hold white for 200ms (more dramatic)
        setTimeout(()=>{
            // Then fade out slowly over 800ms
            this.respawnFlashOverlay.style.transition = 'opacity 0.8s ease-out';
            this.respawnFlashOverlay.style.opacity = '0';
        }, 200);
    }
    /**
     * Update camera position (DRAMATIC MULTI-PHASE MOVEMENT)
     */ update(dt) {
        if (!this.isActive || !this.deathBodyPosition) return;
        const elapsed = performance.now() / 1000 - this.deathStartTime;
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: IMPACT (0.0s - 0.2s) - Camera is STATIC
        // ═══════════════════════════════════════════════════════════════════
        if (elapsed < 0.2) {
            return; // No movement during impact
        } else if (elapsed >= 0.2 && elapsed < 2.7) {
            const phaseTime = elapsed - 0.2; // 0.0 to 2.5
            // Slow rotation
            this.currentOrbitAngle += this.orbitSpeed * dt;
            // Gradual zoom out
            const radiusDrift = this.driftBackSpeed * phaseTime;
            const currentRadius = Math.min(this.orbitRadius + radiusDrift, this.maxOrbitRadius);
            // Gradual height rise
            const heightProgress = phaseTime / 2.5; // 0.0 to 1.0
            const currentHeight = this.minCameraHeight + heightProgress * (this.maxCameraHeight - this.minCameraHeight);
            // Calculate orbital position
            const targetPos = new Vec3(this.deathBodyPosition.x + Math.sin(this.currentOrbitAngle) * currentRadius, this.deathBodyPosition.y + currentHeight, this.deathBodyPosition.z + Math.cos(this.currentOrbitAngle) * currentRadius);
            // Smooth movement
            const currentPos = this.camera.getPosition();
            const smoothPos = new Vec3();
            smoothPos.lerp(currentPos, targetPos, dt * 2);
            this.camera.setPosition(smoothPos);
            // Look at dead body
            this.camera.lookAt(this.deathBodyPosition);
        } else if (elapsed >= 2.7 && elapsed < 4.0) {
            // ✅ SAFETY: Capture position on first frame of phase 3 if not set
            if (!this.rushStartPosition) {
                this.rushStartPosition = this.camera.getPosition().clone();
                console.log('[DeathCameraController] Rush start position captured in update()');
            }
            const phaseTime = elapsed - 2.7; // 0.0 to 1.3
            const progress = phaseTime / 1.3; // 0.0 to 1.0 over 1.3 seconds
            // ✅ SMOOTH: Continuous rush from start position to respawn point
            // Uses ease-in-out for smooth acceleration and deceleration
            const rushSpeed = this._easeInOutCubic(progress);
            // Lerp from where we were at 2.7s to respawn point
            const targetPos = new Vec3();
            targetPos.lerp(this.rushStartPosition, this.respawnPoint, rushSpeed);
            // ✅ DRAMATIC: Add slight arc/swoosh for visual interest
            // Camera rises slightly during rush, then drops to respawn height
            const arcHeight = Math.sin(progress * Math.PI) * 0.3; // 0 -> 0.3 -> 0
            targetPos.y += arcHeight;
            // Apply position with fast lerp for responsiveness
            const currentPos = this.camera.getPosition();
            const rushPos = new Vec3();
            rushPos.lerp(currentPos, targetPos, dt * 6); // Smooth movement
            this.camera.setPosition(rushPos);
            // ✅ DRAMATIC: Gentle spin during rush (not too fast)
            const spinSpeed = progress * 0.5; // Gentle rotation
            this.currentOrbitAngle += spinSpeed * dt;
            // Look toward respawn point with smooth transition
            const lookTarget = new Vec3();
            lookTarget.lerp(this.deathBodyPosition, this.respawnPoint, progress);
            this.camera.lookAt(lookTarget);
        } else if (elapsed >= 4.0) {
            // Camera movement done - white flash and respawn happens immediately
            return;
        }
    }
    /**
     * Easing function for dramatic acceleration
     */ _easeInCubic(t) {
        return t * t * t; // Cubic ease-in (slow start, fast finish)
    }
    /**
     * Easing function for smooth continuous movement
     */ _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    /**
     * ✅ FIX: Raycast to detect walls/ceiling and pull camera back if needed
     */ _avoidCollisions(targetPos, bodyPos) {
        // Simple raycast from body to target camera position
        const start = bodyPos;
        const end = targetPos;
        const result = this.app.systems.rigidbody.raycastFirst(start, end);
        if (result) {
            // Hit something - move camera closer to avoid clipping
            const hitPoint = result.point;
            const direction = new Vec3().sub2(targetPos, bodyPos).normalize();
            const pullback = 0.3; // 30cm pullback from hit point
            return new Vec3(hitPoint.x - direction.x * pullback, hitPoint.y - direction.y * pullback, hitPoint.z - direction.z * pullback);
        }
        return targetPos; // No collision, use target
    }
    /**
     * ✅ FIX: Hide weapon models during death cam (they follow camera otherwise)
     */ _hideWeaponModels() {
        // Find all weapon model entities (Pistol, MachineGun, Shotgun, etc.)
        const weaponParent = this.entity.findByName('WeaponModels') || this.entity;
        if (weaponParent) {
            const weaponNames = [
                'Pistol',
                'MachineGun',
                'Shotgun',
                'RocketLauncher',
                'Rifle'
            ];
            this.hiddenWeapons = [];
            weaponNames.forEach((name)=>{
                const weapon = weaponParent.findByName(name);
                if (weapon && weapon.enabled) {
                    weapon.enabled = false;
                    this.hiddenWeapons.push(weapon);
                    Logger.debug(`[DeathCameraController] Hidden weapon: ${name}`);
                }
            });
        }
    }
    /**
     * ✅ NEW APPROACH: Enable PlayerModel Template entity for death animation
     * Much cleaner than cloning - just enable/disable the existing child entity
     */ _enablePlayerModelForDeath(position, rotation) {
        const playerModel = this.entity.findByName('PlayerModel');
        if (!playerModel) {
            Logger.warn('[DeathCameraController] No PlayerModel child entity found!');
            return;
        }
        // Position the PlayerModel at death location
        playerModel.setPosition(position);
        playerModel.setRotation(rotation);
        // Enable it (it's disabled during normal FPS gameplay)
        playerModel.enabled = true;
        this.playerModelWasEnabled = true;
        Logger.info('[DeathCameraController] PlayerModel enabled for death camera');
        // Play death animation on it
        if (playerModel.anim) {
            this._playDeathAnimationOnPlayerModel(playerModel);
        } else {
            Logger.warn('[DeathCameraController] PlayerModel has no animation component');
        }
    }
    /**
     * Play death animation on the PlayerModel Template entity
     */ _playDeathAnimationOnPlayerModel(playerModel) {
        try {
            const animComponent = playerModel.anim;
            // Enable animation component
            if (!animComponent.enabled) {
                animComponent.enabled = true;
            }
            // Find the death animation asset
            const deathAnimAsset = this.app.assets.find('player_death.glb', 'animation') || this.app.assets.find('player_death', 'animation');
            if (!deathAnimAsset) {
                Logger.warn('[DeathCameraController] player_death.glb animation asset not found');
                return;
            }
            Logger.info('[DeathCameraController] Found death animation asset:', deathAnimAsset.name);
            // Load and play
            if (!deathAnimAsset.loaded) {
                deathAnimAsset.ready(()=>{
                    this._assignDeathAnimation(playerModel, deathAnimAsset);
                });
                this.app.assets.load(deathAnimAsset);
            } else {
                this._assignDeathAnimation(playerModel, deathAnimAsset);
            }
        } catch (e) {
            Logger.warn('[DeathCameraController] Failed to play death animation:', e.message);
        }
    }
    /**
     * Assign and play the death animation
     */ _assignDeathAnimation(playerModel, deathAnimAsset) {
        try {
            const animResource = deathAnimAsset.resource;
            const animComponent = playerModel.anim;
            if (!animResource) {
                Logger.warn('[DeathCameraController] Animation asset has no resource');
                return;
            }
            Logger.info('[DeathCameraController] Creating programmatic death animation graph...');
            // Create simple animation graph
            const deathGraphData = {
                layers: [
                    {
                        name: 'Base Layer',
                        states: [
                            {
                                name: 'START'
                            },
                            {
                                name: 'Death',
                                speed: 1.0,
                                loop: false
                            },
                            {
                                name: 'END'
                            }
                        ],
                        transitions: [
                            {
                                from: 'START',
                                to: 'Death',
                                time: 0,
                                priority: 0,
                                conditions: []
                            }
                        ]
                    }
                ],
                parameters: {}
            };
            // Load graph
            animComponent.loadStateGraph(deathGraphData);
            Logger.debug('[DeathCameraController] State graph loaded');
            // Assign animation
            const baseLayer = animComponent.baseLayer;
            if (baseLayer) {
                baseLayer.assignAnimation('Death', animResource);
                Logger.info('[DeathCameraController] Death animation assigned');
                // Start playing
                animComponent.enabled = true;
                animComponent.playing = true;
                Logger.info('[DeathCameraController] ✅ Death animation playing on PlayerModel');
            } else {
                Logger.warn('[DeathCameraController] No base layer found');
            }
        } catch (e) {
            Logger.warn('[DeathCameraController] Failed to assign animation:', e.message);
        }
    }
    /**
     * ✅ Disable PlayerModel after death camera (return to FPS mode)
     */ _disablePlayerModel() {
        if (this.playerModelWasEnabled) {
            const playerModel = this.entity.findByName('PlayerModel');
            if (playerModel && !playerModel.destroyed) {
                playerModel.enabled = false;
                Logger.info('[DeathCameraController] PlayerModel disabled (back to FPS mode)');
            }
            this.playerModelWasEnabled = false;
        }
    }
    /**
     * ✅ FIX: Restore weapon models after death cam
     */ _showWeaponModels() {
        if (this.hiddenWeapons && this.hiddenWeapons.length > 0) {
            this.hiddenWeapons.forEach((weapon)=>{
                if (weapon && !weapon.destroyed) {
                    weapon.enabled = true;
                }
            });
            Logger.debug(`[DeathCameraController] Restored ${this.hiddenWeapons.length} weapon models`);
            this.hiddenWeapons = [];
        }
    }
    /**
     * Deactivate death camera and restore normal state
     */ deactivateDeathCamera() {
        Logger.debug('[DeathCameraController] 🔄 Deactivating death camera');
        // ✅ CRITICAL: Stop all camera movement immediately
        this.isActive = false;
        this.currentPhase = 'none';
        this.deathBodyPosition = null; // This will stop update() from running
        this.rushStartPosition = null;
        // ✅ FIX: Restore weapon models
        this._showWeaponModels();
        // ✅ NEW: Disable PlayerModel (return to FPS mode - invisible player)
        this._disablePlayerModel();
        // Restore camera to original parent (player)
        if (this.originalParent && !this.originalParent.destroyed) {
            this.camera.reparent(this.originalParent);
            this.camera.setLocalPosition(this.originalPosition);
            this.camera.setLocalRotation(this.originalRotation);
            Logger.debug('[DeathCameraController] Camera restored to original parent');
        } else {
            Logger.warn('[DeathCameraController] Original camera parent destroyed, cannot restore!');
        }
        // Ensure time scale is normal
        this.app.timeScale = 1.0;
        // Clear death UI
        if (this.uiManager && this.uiManager.hideDeathEffects) {
            this.uiManager.hideDeathEffects();
        }
        Logger.info('[DeathCameraController] ✅ Camera restored');
    }
    /**
     * Cleanup overlays on destroy
     */ destroy() {
        if (this.countdownOverlay) {
            this.countdownOverlay.remove();
            this.countdownOverlay = null;
        }
        if (this.respawnFlashOverlay) {
            this.respawnFlashOverlay.remove();
            this.respawnFlashOverlay = null;
        }
        Logger.debug('[DeathCameraController] Overlays cleaned up');
    }
}
_define_property(DeathCameraController, "scriptName", 'deathCameraController');
// Log that this module has loaded
Logger.info('✅ DeathCameraController.mjs loaded - Cinematic death camera ready');

export { DeathCameraController };
