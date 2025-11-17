import { Vec3 } from '../../../../playcanvas-stable.min.mjs';
import { Logger } from '../../core/engine/logger.mjs';

///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
class CombatTacticsSystem {
    // ============================================================================
    // UPDATE LOOP
    // ============================================================================
    /**
     * Update tactical movement
     */ update(dt, context) {
        if (!this.tacticalMovementEnabled) return;
        if (!context.hasTarget) return;
        const now = performance.now() / 1000;
        // ✅ NEW: Update active micro-movement sequences
        this._updateMicroMovements(dt, now, context);
        // ✅ NEW: Check for cover rotation if in cover
        if (this.agent.isInCover && context.inCombat) {
            this._checkCoverRotation(now, context);
        }
        // Check cooldown
        const timeSinceLastMovement = now - this.lastMovementTime;
        if (timeSinceLastMovement < this.movementCooldown) {
            return;
        }
        // ✅ FIX: Allow movement while shooting (humans strafe while firing!)
        // Only block movement in the brief moment RIGHT after shooting (recoil control)
        const timeSinceLastShot = now - (this.agent.combatSystem?.lastShootTime || 0);
        if (timeSinceLastShot < 0.15) {
            return;
        }
        // Assess situation and execute movement
        const situation = this._assessCombatSituation(context);
        const movementExecuted = this._executeTacticalMovement(situation, context);
        if (movementExecuted) {
            this.lastMovementTime = now;
            this._updateStrafeTimings();
        }
    }
    // ============================================================================
    // SITUATION ASSESSMENT
    // ============================================================================
    /**
     * ✅ NEW: Update all active micro-movement sequences
     */ _updateMicroMovements(dt, now, context) {
        // Update jiggle pattern
        if (this.jiggleActive) {
            this._updateJigglePattern(now, context);
        } else if (now > this.nextJiggleTriggerTime) {
            // ✅ FIX: Only jiggle when target is VISIBLE (prevents spam when target is hidden)
            if (Math.random() < 0.40 && context.inCombat && context.targetVisible) {
                this._startJigglePattern(now);
            }
        }
        // Update peek behavior (when in cover)
        if (this.agent.isInCover) {
            this._updatePeekBehavior(now, context);
        }
        // Update crouch spam
        if (this.crouchSpamActive) {
            this._updateCrouchSpam(now, context);
        } else if (now > this.nextCrouchSpamTime && context.underFire) {
            // ✅ ADVANCED AI: Increased probability from 20% → 50% when taking damage
            if (Math.random() < 0.50) {
                this._startCrouchSpam(now);
            }
        }
        // Update circle strafe
        if (this.circleStrafing) {
            this._updateCircleStrafe(dt, now, context);
        } else if (now - this.lastCircleTime > this.circleIntervalMin) {
            // ✅ FIX: Only circle strafe when target is VISIBLE
            const distance = context.targetDistance || 999;
            if (distance > 8 && distance < 15 && Math.random() < 0.35 && context.targetVisible) {
                this._startCircleStrafe(now);
            }
        }
        // Update stutter step
        if (this.stutterActive) {
            this._updateStutterStep(now, context);
        }
        // Check for panic dodge (sudden large health loss)
        this._checkPanicDodge(now, context);
    }
    _assessCombatSituation(context) {
        return {
            healthRatio: context.healthRatio,
            distance: context.targetDistance || 999,
            needsCover: context.healthRatio < 0.4 && this.coverSeekingEnabled,
            shouldRetreat: context.shouldRetreat(),
            shouldAdvance: context.shouldAdvance(),
            shouldFlank: this._shouldFlankNow(context),
            shouldStrafe: this._shouldStrafeNow(),
            underFire: context.underFire
        };
    }
    _shouldFlankNow(context) {
        if (!this.flankingEnabled) return false;
        if (!context.hasTarget) return false;
        const distance = context.targetDistance || 0;
        const healthRatio = context.healthRatio;
        if (distance < this.combatRanges.minimum || distance > this.combatRanges.maximum) {
            return false;
        }
        if (healthRatio < 0.5) return false;
        // Use personality if available
        if (context.personality) {
            return context.personality.shouldFlank(distance, healthRatio);
        }
        return Math.random() < 0.3;
    }
    _shouldStrafeNow() {
        // ✅ FIX: Check if reactive strafe is queued (from taking damage)
        if (this.reactiveStrafeQueued) {
            return true;
        }
        // ✅ ENHANCED: More frequent strafing when under fire or in active combat
        const context = this.agent.combatDecisionContext;
        if (context) {
            // If under fire, strafe much more frequently (every 250-400ms)
            if (context.underFire) {
                const timeSinceLastStrafe = performance.now() / 1000 - this.lastStrafeTime;
                if (timeSinceLastStrafe > 0.25) {
                    return true;
                }
            }
            // If in combat with visible target, strafe more often (every 400-600ms)
            if (context.inCombat && context.targetVisible) {
                const timeSinceLastStrafe = performance.now() / 1000 - this.lastStrafeTime;
                if (timeSinceLastStrafe > 0.4) {
                    return true;
                }
            }
        }
        // Normal timer-based strafing (fallback)
        const combatTimer = this.agent.combatTimer || 0;
        return combatTimer - this.lastStrafeTime > this.nextStrafeTime;
    }
    // ============================================================================
    // TACTICAL MOVEMENT EXECUTION
    // ============================================================================
    _executeTacticalMovement(situation, context) {
        let movementExecuted = false;
        // ✅ FIX: New priority order - strafe is MORE important for human-like combat
        // Priority: 
        // 1. Reactive strafe (immediate dodge when shot) - HIGHEST
        // 2. Retreat (survival)
        // 3. Regular strafe (constant micro-movement in combat) - RAISED PRIORITY
        // 4. Cover seeking
        // 5. Flanking
        // 6. Advance
        // Humans constantly micro-strafe during combat, it's the #1 tell!
        // Priority 1: REACTIVE STRAFE (shot at = instant dodge)
        if (this.reactiveStrafeQueued && !movementExecuted) {
            movementExecuted = this._executeStrafe(context);
        }
        // Priority 2: RETREAT (survival override)
        if (situation.shouldRetreat && !movementExecuted) {
            movementExecuted = this._executeRetreat(context);
        }
        // Priority 3: REGULAR STRAFE (constant micro-movement)
        // ✅ This is now 3rd priority instead of last!
        if (situation.shouldStrafe && !movementExecuted) {
            movementExecuted = this._executeStrafe(context);
        }
        // Priority 4: COVER
        if (situation.needsCover && !movementExecuted) {
            movementExecuted = this._executeCover(context);
        }
        // Priority 5: FLANK
        if (situation.shouldFlank && !movementExecuted) {
            movementExecuted = this._executeFlank(context);
        }
        // Priority 6: ADVANCE
        if (situation.shouldAdvance && !movementExecuted) {
            movementExecuted = this._executeAdvance(context);
        }
        return movementExecuted;
    }
    // ============================================================================
    // MOVEMENT TYPES
    // ============================================================================
    /**
     * Execute retreat movement
     */ _executeRetreat(context) {
        if (!context.targetPosition) return false;
        const retreatPos = this._generateRetreatPosition(context);
        if (retreatPos) {
            this.agent.moveTo(retreatPos);
            Logger.aiDetail(`[${this.agent.entity.name}] Retreating (HP: ${(context.healthRatio * 100).toFixed(0)}%)`);
            return true;
        }
        return false;
    }
    /**
     * Execute cover seeking
     */ _executeCover(context) {
        const coverPos = this._generateCoverPosition(context);
        if (coverPos) {
            this.agent.moveTo(coverPos);
            this.agent.isInCover = true;
            Logger.aiDetail(`[${this.agent.entity.name}] Moving to cover`);
            return true;
        }
        return false;
    }
    /**
     * Execute flanking movement
     */ _executeFlank(context) {
        if (!context.targetPosition) return false;
        const flankPos = this._generateFlankPosition(context);
        if (flankPos) {
            this.agent.moveTo(flankPos);
            Logger.aiDetail(`[${this.agent.entity.name}] Flanking`);
            return true;
        }
        return false;
    }
    /**
     * Execute advance movement
     */ _executeAdvance(context) {
        if (!context.targetPosition) return false;
        const advancePos = this._generateAdvancePosition(context);
        if (advancePos) {
            this.agent.moveTo(advancePos);
            Logger.aiDetail(`[${this.agent.entity.name}] Advancing`);
            return true;
        }
        return false;
    }
    /**
     * Execute strafe movement
     */ _executeStrafe(context) {
        const strafePos = this._generateStrafePosition(context);
        if (strafePos) {
            this.agent.moveTo(strafePos);
            // ✅ NEW: Clear reactive strafe flag after execution
            if (this.reactiveStrafeQueued) {
                this.reactiveStrafeQueued = false;
                this.lastReactiveStrafeTime = performance.now() / 1000;
                Logger.aiState(`[${this.agent.entity.name}] ⚡ REACTIVE DODGE STRAFE (shot at!)`);
            } else {
                // Regular tactical strafe
                Logger.aiDetail(`[${this.agent.entity.name}] ↔️ Tactical strafe ${this.strafeDirection > 0 ? 'right' : 'left'}`);
            }
            return true;
        }
        // If strafe failed, clear the queue anyway
        this.reactiveStrafeQueued = false;
        return false;
    }
    // ============================================================================
    // PUBLIC API - REACTIVE STRAFING
    // ============================================================================
    /**
     * ✅ NEW: Trigger immediate defensive strafe when shot at
     * Called by EventHandler.onDamage()
     */ triggerReactiveStrafe() {
        const now = performance.now() / 1000;
        // Check cooldown to prevent spam
        if (now - this.lastReactiveStrafeTime < this.reactiveStrafeCooldown) {
            return false;
        }
        // Queue reactive strafe for next update
        this.reactiveStrafeQueued = true;
        Logger.aiState(`[${this.agent.entity.name}] ⚡ REACTIVE STRAFE QUEUED (shot at!)`);
        return true;
    }
    // ============================================================================
    // MICRO-MOVEMENT IMPLEMENTATIONS
    // ============================================================================
    /**
     * ✅ NEW: Jiggle pattern - rapid left-right-left movements
     */ _startJigglePattern(now) {
        this.jiggleActive = true;
        this.jiggleStep = 0;
        this.lastJiggleStepTime = now;
        this.nextJiggleTriggerTime = now + this.jiggleIntervalMin + Math.random() * (this.jiggleIntervalMax - this.jiggleIntervalMin);
        // ✅ DIAGNOSTIC: Log why jiggle pattern is starting
        const hasTarget = this.agent.targetSystem?.hasTarget();
        const targetVisible = this.agent.targetSystem?.isTargetVisible();
        const stateMachineName = this.agent.agentBehavior?.getStateMachine?.()?.currentState?.constructor?.name || 'Unknown';
        Logger.combat(`[${this.agent.entity.name}] 🔀 Starting jiggle pattern (ADVANCED AI micro-movement)`);
        Logger.combat(`[${this.agent.entity.name}]   State: ${stateMachineName}, HasTarget: ${hasTarget}, Visible: ${targetVisible}`);
    }
    _updateJigglePattern(now, context) {
        if (now - this.lastJiggleStepTime < this.jiggleStepDuration) {
            return;
        }
        // Execute quick strafe
        const myPos = this.agent.entity.getPosition();
        const targetPos = context.targetPosition;
        if (!targetPos) {
            this.jiggleActive = false;
            return;
        }
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        const direction = this.jiggleStep % 2 === 0 ? 1 : -1;
        const perpendicular = new Vec3(-toTarget.z * direction, 0, toTarget.x * direction);
        const jigglePos = this._findValidTacticalPosition(myPos, perpendicular, 1.0, "jiggle");
        if (jigglePos) {
            this.agent.moveTo(jigglePos);
            // ✅ NEW: Set animation parameter for strafe direction
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('strafeDirection', direction);
                this.agent.animationController._setParameter('isAiming', true);
            }
        }
        this.jiggleStep++;
        this.lastJiggleStepTime = now;
        if (this.jiggleStep >= this.jiggleMaxSteps) {
            this.jiggleActive = false;
            // Reset strafe direction when done
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('strafeDirection', 0);
            }
            Logger.aiDetail(`[${this.agent.entity.name}] ✓ Jiggle pattern complete`);
        }
    }
    /**
     * ✅ NEW: Peek behavior - quick looks from cover
     */ _updatePeekBehavior(now, context) {
        if (this.isPeeking) {
            // Check if peek duration expired
            if (now - this.peekStartTime > this.peekDuration) {
                this._endPeek();
            }
        } else {
            // ✅ ADVANCED AI: Increased probability from 30% → 60% for more active peeking
            if (now - this.lastPeekTime > this.peekCooldown && Math.random() < 0.60) {
                this._startPeek(now, context);
            }
        }
    }
    _startPeek(now, context) {
        this.isPeeking = true;
        this.peekStartTime = now;
        // Quick small movement out from cover
        const myPos = this.agent.entity.getPosition();
        const targetPos = context.targetPosition;
        if (!targetPos) return;
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        const peekPos = this._findValidTacticalPosition(myPos, toTarget, 1.5, "peek");
        if (peekPos) {
            this.agent.moveTo(peekPos);
            // ✅ NEW: Set animation parameter for peeking
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('isPeeking', true);
                // Random peek direction for variety
                const peekDir = Math.random() < 0.5 ? -1 : 1;
                this.agent.animationController._setParameter('peekDirection', peekDir);
            }
            Logger.combat(`[${this.agent.entity.name}] 👀 Peeking from cover (ADVANCED AI)`);
        }
    }
    _endPeek() {
        this.isPeeking = false;
        this.lastPeekTime = performance.now() / 1000;
        // ✅ NEW: Reset animation parameters
        if (this.agent.animationController) {
            this.agent.animationController._setParameter('isPeeking', false);
            this.agent.animationController._setParameter('peekDirection', 0);
        }
    // Agent will naturally return to cover through normal tactical movement
    }
    /**
     * ✅ NEW: Crouch spam - rapid crouch cycles (evasion)
     */ _startCrouchSpam(now) {
        this.crouchSpamActive = true;
        this.crouchSpamCycles = 0;
        this.lastCrouchCycleTime = now;
        this.nextCrouchSpamTime = now + this.crouchSpamIntervalMin + Math.random() * (this.crouchSpamIntervalMax - this.crouchSpamIntervalMin);
        Logger.combat(`[${this.agent.entity.name}] ⬇️ Crouch spam initiated (ADVANCED AI evasion)`);
    }
    _updateCrouchSpam(now, context) {
        if (now - this.lastCrouchCycleTime < this.crouchCycleDuration) {
            return;
        }
        // Toggle crouch state
        const shouldCrouch = this.crouchSpamCycles % 2 === 0;
        // ✅ NEW: Set animation parameter for crouching
        if (this.agent.animationController) {
            this.agent.animationController._setParameter('isCrouching', shouldCrouch);
        }
        // Legacy: Also check for crouchController script (if it exists)
        if (this.agent.entity.script?.crouchController) {
            if (shouldCrouch) {
                this.agent.entity.script.crouchController.crouch();
            } else {
                this.agent.entity.script.crouchController.stand();
            }
        }
        this.crouchSpamCycles++;
        this.lastCrouchCycleTime = now;
        if (this.crouchSpamCycles >= this.maxCrouchCycles) {
            this.crouchSpamActive = false;
            // Ensure we end in standing position
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('isCrouching', false);
            }
            Logger.aiDetail(`[${this.agent.entity.name}] ✓ Crouch spam complete`);
        }
    }
    /**
     * ✅ NEW: Circle strafe - continuous circular movement around target
     */ _startCircleStrafe(now) {
        this.circleStrafing = true;
        this.circleAngle = 0;
        this.circleStartTime = now;
        this.lastCircleTime = now;
        Logger.combat(`[${this.agent.entity.name}] 🔄 Circle strafe started (ADVANCED AI)`);
    }
    _updateCircleStrafe(dt, now, context) {
        if (now - this.circleStartTime > this.circleDuration) {
            this.circleStrafing = false;
            // Reset strafe direction when done
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('strafeDirection', 0);
            }
            Logger.aiDetail(`[${this.agent.entity.name}] ✓ Circle strafe complete`);
            return;
        }
        const myPos = this.agent.entity.getPosition();
        const targetPos = context.targetPosition;
        if (!targetPos) {
            this.circleStrafing = false;
            return;
        }
        // Calculate circular movement
        this.circleAngle += this.circleSpeed * dt;
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        context.targetDistance || 10;
        // Rotate perpendicular vector by current angle
        const cos = Math.cos(this.circleAngle);
        const sin = Math.sin(this.circleAngle);
        const circleDir = new Vec3(-toTarget.z * cos - toTarget.x * sin, 0, toTarget.x * cos - toTarget.z * sin);
        const circlePos = this._findValidTacticalPosition(myPos, circleDir, 2.5, "circle");
        if (circlePos) {
            this.agent.moveTo(circlePos);
            // ✅ NEW: Set strafe direction based on circular movement direction
            // Determine if we're moving left or right relative to target
            const strafeDir = sin > 0 ? 1 : -1; // Positive angle = right, negative = left
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('strafeDirection', strafeDir);
                this.agent.animationController._setParameter('isAiming', true);
            }
        }
    }
    /**
     * ✅ NEW: Backstep when reloading
     */ executeBackstepForReload(context) {
        if (!this.backstepOnReload || this.isBackstepping) return false;
        const myPos = this.agent.entity.getPosition();
        const targetPos = context.targetPosition;
        if (!targetPos) return false;
        // Move backwards away from target
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        const backstepDir = toTarget.clone().scale(-1);
        const backstepPos = this._findValidTacticalPosition(myPos, backstepDir, this.backstepDistance, "backstep");
        if (backstepPos) {
            this.agent.moveTo(backstepPos);
            this.isBackstepping = true;
            // ✅ NEW: Set animation parameter for backpedaling
            if (this.agent.animationController) {
                this.agent.animationController._setParameter('isBackpedaling', true);
                this.agent.animationController._setParameter('isAiming', true);
            }
            Logger.combat(`[${this.agent.entity.name}] ⬅️ Backstepping for reload (ADVANCED AI)`);
            // Reset after backstep duration
            setTimeout(()=>{
                this.isBackstepping = false;
                // Reset animation parameter
                if (this.agent.animationController) {
                    this.agent.animationController._setParameter('isBackpedaling', false);
                }
            }, 1000);
            return true;
        }
        return false;
    }
    /**
     * ✅ NEW: Stutter step - uncertain movement when searching
     */ startStutterStep(now) {
        this.stutterActive = true;
        this.stutterSteps = 0;
        this.lastStutterStepTime = now;
        Logger.aiDetail(`[${this.agent.entity.name}] 🚶 Stutter stepping (uncertainty)`);
    }
    _updateStutterStep(now, context) {
        if (now - this.lastStutterStepTime < this.stutterStepDuration) {
            return;
        }
        const myPos = this.agent.entity.getPosition();
        // Random small movements (no clear direction)
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDir = new Vec3(Math.cos(randomAngle), 0, Math.sin(randomAngle));
        const stutterPos = this._findValidTacticalPosition(myPos, randomDir, 1.2, "stutter");
        if (stutterPos) {
            this.agent.moveTo(stutterPos);
        }
        this.stutterSteps++;
        this.lastStutterStepTime = now;
        if (this.stutterSteps >= this.maxStutterSteps) {
            this.stutterActive = false;
        }
    }
    /**
     * ✅ NEW: Panic dodge - immediate evasive action on heavy damage
     */ _checkPanicDodge(now, context) {
        if (this.panicDodgeTriggered) return;
        if (now - this.lastPanicDodgeTime < this.panicDodgeCooldown) return;
        // ✅ ADVANCED AI: Lowered threshold from 60%→40% to 70%→50% for more frequent panic dodges
        const healthRatio = context.healthRatio;
        const wasHealthy = this._lastHealthRatio > 0.70; // Was 0.6
        const nowDamaged = healthRatio < 0.50; // Was 0.4
        if (wasHealthy && nowDamaged && context.underFire) {
            this._executePanicDodge(context);
            this.panicDodgeTriggered = true;
            this.lastPanicDodgeTime = now;
            setTimeout(()=>{
                this.panicDodgeTriggered = false;
            }, 500);
        }
        this._lastHealthRatio = healthRatio;
    }
    _executePanicDodge(context) {
        const myPos = this.agent.entity.getPosition();
        // Quick perpendicular dodge (random direction)
        const targetPos = context.targetPosition;
        if (!targetPos) return;
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        const dodgeDir = Math.random() < 0.5 ? new Vec3(-toTarget.z, 0, toTarget.x) : new Vec3(toTarget.z, 0, -toTarget.x);
        const dodgePos = this._findValidTacticalPosition(myPos, dodgeDir, 4.0, "panic_dodge");
        if (dodgePos) {
            this.agent.moveTo(dodgePos);
            // ✅ NEW: Trigger dodge animation
            if (this.agent.animationController && this.agent.animationController.animComponent) {
                this.agent.animationController.animComponent.setTrigger('dodgeTrigger');
            }
            Logger.combat(`[${this.agent.entity.name}] ‼️ PANIC DODGE! (ADVANCED AI emergency evasion)`);
        }
    }
    // ============================================================================
    // POSITION GENERATION
    // ============================================================================
    _generateRetreatPosition(context) {
        const myPos = context.agentPosition;
        const targetPos = context.targetPosition;
        // Move away from target
        const retreatDirection = new Vec3().sub2(myPos, targetPos).normalize();
        return this._findValidTacticalPosition(myPos, retreatDirection, 12, "retreat");
    }
    _generateCoverPosition(context) {
        // Check if we already know about nearby cover
        if (context.nearestCover && context.nearestCover.distance < 15) {
            return context.nearestCover.position;
        }
        // Use navigation system to find cover
        if (this.agent.navigation && this.agent.navigation.findTacticalPosition) {
            return this.agent.navigation.findTacticalPosition('cover', context.targetPosition);
        }
        // Fallback: move perpendicular to threat
        if (context.targetPosition) {
            const myPos = context.agentPosition;
            const toTarget = new Vec3().sub2(context.targetPosition, myPos).normalize();
            const perpendicular = new Vec3(-toTarget.z, 0, toTarget.x);
            return this._findValidTacticalPosition(myPos, perpendicular, 8, "cover");
        }
        return null;
    }
    _generateFlankPosition(context) {
        const myPos = context.agentPosition;
        const targetPos = context.targetPosition;
        const distance = context.targetDistance || 20;
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        // Left or right flank
        const leftFlank = new Vec3(-toTarget.z, 0, toTarget.x);
        const rightFlank = new Vec3(toTarget.z, 0, -toTarget.x);
        const flankDistance = Math.min(distance * 0.8, 12);
        // Try both flanks
        for (const flankDir of [
            leftFlank,
            rightFlank
        ]){
            const flankPos = this._findValidTacticalPosition(myPos, flankDir, flankDistance, "flank");
            if (flankPos) return flankPos;
        }
        return null;
    }
    _generateAdvancePosition(context) {
        const myPos = context.agentPosition;
        const targetPos = context.targetPosition;
        const distance = context.targetDistance || 20;
        const toTarget = new Vec3().sub2(targetPos, myPos).normalize();
        // Move closer but stay at optimal range
        const advanceDistance = Math.max(3, distance - this.combatRanges.optimal);
        return this._findValidTacticalPosition(myPos, toTarget, advanceDistance, "advance");
    }
    _generateStrafePosition(context) {
        if (!context.targetPosition) return null;
        const myPos = context.agentPosition;
        const toTarget = new Vec3().sub2(context.targetPosition, myPos).normalize();
        // Perpendicular strafe (small micro-movements)
        const strafeDirection = new Vec3(-toTarget.z * this.strafeDirection, 0, toTarget.x * this.strafeDirection);
        // ✅ FIX: Add variation to strafe distance for more human-like movement
        // Humans don't move exactly the same distance each time
        const distanceVariation = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x base distance
        const actualDistance = this.strafeDistance * distanceVariation;
        return this._findValidTacticalPosition(myPos, strafeDirection, actualDistance, "strafe");
    }
    // ============================================================================
    // POSITION VALIDATION
    // ============================================================================
    _findValidTacticalPosition(basePos, direction, distance, context) {
        if (!this.agent.navigationReady) {
            return null;
        }
        const dir = direction.clone().normalize();
        const candidatePos = basePos.clone().add(dir.scale(distance));
        // Find valid navmesh position using navigation system
        let validPos = null;
        if (this.agent.navigation && this.agent.navigation.findValidNavMeshPosition) {
            validPos = this.agent.navigation.findValidNavMeshPosition(candidatePos, 8);
        }
        return validPos;
    }
    // ============================================================================
    // FUZZY LOGIC INTEGRATION
    // ============================================================================
    /**
     * Use fuzzy logic for tactical response
     */ evaluateTacticalResponse(context) {
        if (!this.fuzzySystem || !this.fuzzySystem.initialized) {
            return this._fallbackTacticalResponse(context);
        }
        try {
            const coverDistance = context.nearestCover?.distance || 100;
            const threatDirection = this._calculateThreatDirection(context);
            const fuzzyResponse = this.fuzzySystem.evaluateTacticalResponse(coverDistance, threatDirection);
            // Map fuzzy output to action
            if (fuzzyResponse > 0.7) return 'retreat';
            if (fuzzyResponse > 0.4) return 'hold';
            return 'advance';
        } catch (error) {
            Logger.warn('[CombatTacticsSystem] Fuzzy evaluation failed:', error);
            return this._fallbackTacticalResponse(context);
        }
    }
    _fallbackTacticalResponse(context) {
        if (context.healthRatio < 0.3) return 'retreat';
        if (context.targetDistance > this.combatRanges.maximum) return 'advance';
        return 'hold';
    }
    _calculateThreatDirection(context) {
        // 0 = directional (front), 1 = surrounded
        const threatCount = context.threatCount;
        if (threatCount > 2) return 0.8;
        if (threatCount > 1) return 0.5;
        return 0.2;
    }
    // ============================================================================
    // STRAFE TIMING
    // ============================================================================
    _updateStrafeTimings() {
        // ✅ FIX: Use actual time instead of combat timer for more consistent strafing
        this.lastStrafeTime = performance.now() / 1000;
        this.nextStrafeTime = this.strafeIntervalMin + Math.random() * (this.strafeIntervalMax - this.strafeIntervalMin);
        this.strafeDirection *= -1;
    }
    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    setCombatRanges(ranges) {
        Object.assign(this.combatRanges, ranges);
    }
    setMovementCooldown(seconds) {
        this.movementCooldown = seconds;
    }
    setStrafeInterval(min, max) {
        this.strafeIntervalMin = min;
        this.strafeIntervalMax = max;
    }
    enableTacticalMovement(enabled) {
        this.tacticalMovementEnabled = enabled;
    }
    enableCoverSeeking(enabled) {
        this.coverSeekingEnabled = enabled;
    }
    enableFlanking(enabled) {
        this.flankingEnabled = enabled;
    }
    // ============================================================================
    // COVER ROTATION (NEW)
    // ============================================================================
    /**
     * ✅ NEW: Check if agent should rotate to new cover position
     */ _checkCoverRotation(now, context) {
        // Track when we entered current cover
        if (!this.currentCoverPosition || !this.coverEntryTime) {
            this.currentCoverPosition = this.agent.entity.getPosition().clone();
            this.coverEntryTime = now;
            this.nextCoverRotationTime = now + this._calculateCoverRotationDelay();
            return;
        }
        // Check if it's time to rotate
        if (now < this.nextCoverRotationTime) {
            return;
        }
        // Don't rotate if recently moved
        if (now - this.lastCoverRotationTime < 5.0) {
            return;
        }
        this._rotateCoverPosition(context);
    }
    /**
     * ✅ NEW: Execute cover rotation
     */ _rotateCoverPosition(context) {
        const myPos = this.agent.entity.getPosition();
        // Find new cover position 5-15m away
        const newCover = this._findNewCoverPosition(myPos, context);
        if (newCover) {
            this.agent.moveTo(newCover);
            this.agent.isInCover = false; // Will be set true when reaching new cover
            const now = performance.now() / 1000;
            this.lastCoverRotationTime = now;
            this.coverEntryTime = 0;
            this.currentCoverPosition = null;
            this.nextCoverRotationTime = now + this._calculateCoverRotationDelay();
            Logger.combat(`[${this.agent.entity.name}] 🔄 Rotating to new cover position (ADVANCED AI)`);
        }
    }
    /**
     * ✅ NEW: Find a new valid cover position
     */ _findNewCoverPosition(currentPos, context) {
        const searchRadius = 15;
        const minDistance = 5;
        // Generate candidate positions in a circle
        const candidates = [];
        const numCandidates = 8;
        for(let i = 0; i < numCandidates; i++){
            const angle = i / numCandidates * Math.PI * 2;
            const distance = minDistance + Math.random() * (searchRadius - minDistance);
            const candidate = currentPos.clone().add(new Vec3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
            candidates.push(candidate);
        }
        // Use navigation to validate
        if (this.agent.navigation && this.agent.navigation.findValidNavMeshPosition) {
            for (const candidate of candidates){
                const validPos = this.agent.navigation.findValidNavMeshPosition(candidate, 5);
                if (validPos) {
                    return validPos;
                }
            }
        }
        return null;
    }
    /**
     * ✅ NEW: Calculate next cover rotation delay based on personality
     */ _calculateCoverRotationDelay() {
        const personality = this.agent.personalitySystem;
        if (!personality) {
            return this.coverRotationIntervalMin;
        }
        // Adaptable agents rotate more frequently, cautious agents stay longer
        const baseDelay = this.coverRotationIntervalMin + Math.random() * (this.coverRotationIntervalMax - this.coverRotationIntervalMin);
        const personalityModifier = 1.0 + personality.traits.caution * 0.5 - personality.traits.adaptability * 0.3;
        return baseDelay * personalityModifier;
    }
    // ============================================================================
    // DEBUG
    // ============================================================================
    getDebugInfo() {
        return {
            tacticalMovementEnabled: this.tacticalMovementEnabled,
            coverSeekingEnabled: this.coverSeekingEnabled,
            flankingEnabled: this.flankingEnabled,
            lastMovementTime: this.lastMovementTime,
            strafeDirection: this.strafeDirection,
            nextStrafeTime: this.nextStrafeTime,
            combatRanges: this.combatRanges
        };
    }
    /**
     * Destroy and clean up
     */ destroy() {
        // Clean up references
        this.agent = null;
        this.fuzzySystem = null;
    }
    constructor(agent, fuzzySystem){
        this.agent = agent;
        this.fuzzySystem = fuzzySystem;
        // Movement timing - ✅ FIX: Much faster for human-like micro-movements
        this.lastMovementTime = 0;
        this.movementCooldown = 0.3; // Reduced from 0.8s → 0.3s (human-like)
        // Strafe parameters - ✅ FIX: Faster, more frequent strafing
        this.lastStrafeTime = 0;
        this.strafeDirection = 1;
        this.nextStrafeTime = 0.4; // Start sooner
        this.strafeIntervalMin = 0.25; // Humans strafe every 250-600ms
        this.strafeIntervalMax = 0.6; // Not 600-1200ms!
        this.strafeDistance = 2.0; // Small micro-movements (2m, not 6m)
        // ✅ NEW: Reactive strafing (triggers immediately when shot)
        this.reactiveStrafeCooldown = 0.5; // Can reactive-strafe every 500ms
        this.lastReactiveStrafeTime = 0;
        this.reactiveStrafeQueued = false;
        // ✅ NEW: Jiggle pattern (rapid left-right-left)
        this.jiggleActive = false;
        this.jiggleStep = 0;
        this.jiggleMaxSteps = 3;
        this.jiggleStepDuration = 0.15; // 150ms per direction change
        this.lastJiggleStepTime = 0;
        this.nextJiggleTriggerTime = 0;
        this.jiggleIntervalMin = 1.5; // ✅ ADVANCED AI: Reduced from 3.0s → 1.5s
        this.jiggleIntervalMax = 3.0; // ✅ ADVANCED AI: Reduced from 6.0s → 3.0s
        // ✅ NEW: Peek behavior
        this.isPeeking = false;
        this.peekStartTime = 0;
        this.peekDuration = 0.8; // 800ms peek out
        this.peekCooldown = 1.5; // ✅ ADVANCED AI: Reduced from 2.5s → 1.5s
        this.lastPeekTime = 0;
        // ✅ NEW: Crouch spam
        this.crouchSpamActive = false;
        this.crouchSpamCycles = 0;
        this.maxCrouchCycles = 3;
        this.crouchCycleDuration = 0.4; // 400ms per crouch cycle
        this.lastCrouchCycleTime = 0;
        this.nextCrouchSpamTime = 0;
        this.crouchSpamIntervalMin = 2.0; // ✅ ADVANCED AI: Reduced from 4.0s → 2.0s
        this.crouchSpamIntervalMax = 4.0; // ✅ ADVANCED AI: Reduced from 8.0s → 4.0s
        // ✅ NEW: Circle strafe
        this.circleStrafing = false;
        this.circleAngle = 0;
        this.circleSpeed = 0.8; // radians per second
        this.circleDuration = 2.0;
        this.circleStartTime = 0;
        this.lastCircleTime = 0;
        this.circleIntervalMin = 3.0; // ✅ ADVANCED AI: Reduced from 6.0s → 3.0s
        this.circleIntervalMax = 6.0; // ✅ ADVANCED AI: Reduced from 12.0s → 6.0s
        // ✅ NEW: Backstep when reloading
        this.backstepOnReload = true;
        this.backstepDistance = 3.0;
        this.isBackstepping = false;
        // ✅ NEW: Stutter step (uncertainty)
        this.stutterActive = false;
        this.stutterSteps = 0;
        this.maxStutterSteps = 2;
        this.stutterStepDuration = 0.2;
        this.lastStutterStepTime = 0;
        // ✅ NEW: Context-aware micros
        this.panicDodgeTriggered = false;
        this.lastPanicDodgeTime = 0;
        this.panicDodgeCooldown = 3.0; // ✅ ADVANCED AI: Reduced from 5.0s → 3.0s
        // ✅ NEW: Health tracking for panic dodge
        this._lastHealthRatio = 1.0;
        // Combat ranges
        this.combatRanges = {
            optimal: 12,
            minimum: 4,
            maximum: 25
        };
        // Tactical flags
        this.tacticalMovementEnabled = true;
        this.coverSeekingEnabled = true;
        this.flankingEnabled = true;
        this.retreatThreshold = 0.25;
        // ✅ NEW: Cover rotation tracking
        this.currentCoverPosition = null;
        this.coverEntryTime = 0;
        this.nextCoverRotationTime = 0;
        this.lastCoverRotationTime = 0;
        this.coverRotationIntervalMin = 5.0; // ✅ ADVANCED AI: Reduced from 8.0s → 5.0s
        this.coverRotationIntervalMax = 10.0; // ✅ ADVANCED AI: Reduced from 15.0s → 10.0s
        Logger.debug(`[${this.agent.entity.name}] CombatTacticsSystem initialized`);
    }
}

export { CombatTacticsSystem };
