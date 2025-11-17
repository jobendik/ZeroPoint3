import { Script } from '../../../../playcanvas-stable.min.mjs';

/**
 * AnimationDiagnostic.mjs
 * 
 * Comprehensive diagnostic tool to identify why AI animations aren't playing.
 * Attach this script to your AI agent entity to run diagnostics.
 * 
 * USAGE:
 * 1. In PlayCanvas Editor, add this script to your AI agent entity
 * 2. Launch the game
 * 3. Check browser console (F12) for detailed diagnostic report
 * 4. Follow the recommendations in the report
 */ function _define_property(obj, key, value) {
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
class AnimationDiagnostic extends Script {
    initialize() {
        console.log('%c========================================', 'color: #00ff00; font-weight: bold');
        console.log('%c🔍 ANIMATION DIAGNOSTIC TOOL STARTED', 'color: #00ff00; font-weight: bold');
        console.log('%c========================================', 'color: #00ff00; font-weight: bold');
        this._lastMonitorTime = 0;
        this._frameCount = 0;
        this._lastPosition = null;
        this._movementSamples = [];
        // Run initial diagnostic
        setTimeout(()=>{
            this._runFullDiagnostic();
        }, 1000);
    }
    update(dt) {
        this._frameCount++;
        // Continuous monitoring
        if (this.enableContinuousMonitoring) {
            this._lastMonitorTime += dt;
            if (this._lastMonitorTime >= this.monitorInterval) {
                this._runQuickCheck();
                this._lastMonitorTime = 0;
            }
        }
        // Track movement
        this._trackMovement(dt);
    }
    /**
     * Run comprehensive diagnostic check
     */ _runFullDiagnostic() {
        const name = this.entity.name;
        console.log('%c========================================', 'color: #ffff00; font-weight: bold');
        console.log(`%c🔍 FULL DIAGNOSTIC REPORT: ${name}`, 'color: #ffff00; font-weight: bold');
        console.log('%c========================================', 'color: #ffff00; font-weight: bold');
        // 1. Check AI Agent Script
        console.log('\n%c1️⃣ AI AGENT SCRIPT CHECK:', 'color: #00ffff; font-weight: bold');
        this._checkAIAgentScript();
        // 2. Check Animation Component
        console.log('\n%c2️⃣ ANIMATION COMPONENT CHECK:', 'color: #00ffff; font-weight: bold');
        this._checkAnimationComponent();
        // 3. Check Animation Controller
        console.log('\n%c3️⃣ ANIMATION CONTROLLER CHECK:', 'color: #00ffff; font-weight: bold');
        this._checkAnimationController();
        // 4. Check Animation Graph
        console.log('\n%c4️⃣ ANIMATION GRAPH CHECK:', 'color: #00ffff; font-weight: bold');
        this._checkAnimationGraph();
        // 5. Check Movement System
        console.log('\n%c5️⃣ MOVEMENT SYSTEM CHECK:', 'color: #00ffff; font-weight: bold');
        this._checkMovementSystem();
        // 6. Generate Recommendations
        console.log('\n%c6️⃣ RECOMMENDATIONS:', 'color: #ff00ff; font-weight: bold');
        this._generateRecommendations();
        console.log('\n%c========================================', 'color: #ffff00; font-weight: bold');
        console.log('%c✅ DIAGNOSTIC COMPLETE', 'color: #ffff00; font-weight: bold');
        console.log('%c========================================', 'color: #ffff00; font-weight: bold');
    }
    /**
     * Check if AI agent script exists and is initialized
     */ _checkAIAgentScript() {
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent) {
            console.log('%c❌ CRITICAL: No aiAgent script found on entity!', 'color: #ff0000');
            console.log('   → Add the aiAgent.mjs script to this entity');
            return;
        }
        console.log('%c✅ aiAgent script exists', 'color: #00ff00');
        console.log(`   - Initialized: ${aiAgent.__aiAgentInitialized ? '✅' : '❌'}`);
        console.log(`   - Has animationController: ${!!aiAgent.animationController ? '✅' : '❌'}`);
        console.log(`   - Has yukaVehicle: ${!!aiAgent.yukaVehicle ? '✅' : '❌'}`);
        console.log(`   - Navigation ready: ${aiAgent.navigationReady ? '✅' : '❌'}`);
    }
    /**
     * Check animation component configuration
     */ _checkAnimationComponent() {
        // Find animation component
        const animComp = this._findAnimationComponent();
        if (!animComp) {
            console.log('%c❌ CRITICAL: No Animation Component found!', 'color: #ff0000');
            console.log('   → Add an Animation Component to this entity or a child entity');
            console.log('   → In PlayCanvas Editor: Add Component > Animation');
            return;
        }
        console.log('%c✅ Animation Component found', 'color: #00ff00');
        console.log(`   - Entity: ${animComp.entity.name}`);
        console.log(`   - Enabled: ${animComp.enabled ? '✅' : '❌ FIX REQUIRED'}`);
        console.log(`   - Playing: ${animComp.playing ? '✅' : '❌ FIX REQUIRED'}`);
        console.log(`   - Activate: ${animComp.activate ? '✅' : '⚠️'}`);
        // Check State Graph
        if (!animComp.stateGraph && !animComp._stateGraphAsset) {
            console.log('%c❌ CRITICAL: No State Graph assigned!', 'color: #ff0000');
            console.log('   → In Animation Component, assign an Animation State Graph asset');
            return;
        }
        console.log('%c✅ State Graph assigned', 'color: #00ff00');
        // Check Base Layer
        if (!animComp.baseLayer) {
            console.log('%c❌ CRITICAL: No Base Layer found!', 'color: #ff0000');
            console.log('   → State Graph may not be loaded correctly');
            return;
        }
        console.log('%c✅ Base Layer exists', 'color: #00ff00');
        console.log(`   - Active State: ${animComp.baseLayer.activeStateName || 'NONE'}`);
        console.log(`   - Playing: ${animComp.baseLayer.playing ? '✅' : '❌'}`);
        // Check Animation Assets
        const animations = animComp.animations;
        if (animations && Object.keys(animations).length > 0) {
            console.log(`%c✅ Animations loaded: ${Object.keys(animations).length}`, 'color: #00ff00');
            console.log(`   - Names: ${Object.keys(animations).join(', ')}`);
        } else {
            console.log('%c⚠️ WARNING: No animations found!', 'color: #ffaa00');
            console.log('   → Assign animation assets to the Animation Component');
        }
    }
    /**
     * Check animation controller status
     */ _checkAnimationController() {
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent) return;
        const animController = aiAgent.animationController;
        if (!animController) {
            console.log('%c❌ CRITICAL: No AnimationController found!', 'color: #ff0000');
            console.log('   → Check aiAgent.mjs initialization');
            return;
        }
        console.log('%c✅ AnimationController exists', 'color: #00ff00');
        console.log(`   - Initialized: ${animController._initialized ? '✅' : '❌ FIX REQUIRED'}`);
        console.log(`   - Has animComponent: ${!!animController.animComponent ? '✅' : '❌ FIX REQUIRED'}`);
        console.log(`   - Current state: ${animController.currentAnimState || 'none'}`);
        console.log(`   - Movement speed: ${animController.movementSpeed?.toFixed(3) || '0.000'} m/s`);
        console.log(`   - Is aiming: ${animController.isAiming ? '✅' : '❌'}`);
        console.log(`   - Last update: ${animController.lastUpdateTime > 0 ? '✅' : '⚠️ Never updated'}`);
    }
    /**
     * Check animation graph parameters and states
     */ _checkAnimationGraph() {
        const animComp = this._findAnimationComponent();
        if (!animComp) return;
        // Check parameters
        const requiredParams = [
            {
                name: 'speed',
                type: 'float'
            },
            {
                name: 'isMoving',
                type: 'boolean'
            },
            {
                name: 'isAiming',
                type: 'boolean'
            },
            {
                name: 'isGrounded',
                type: 'boolean'
            },
            {
                name: 'speedMultiplier',
                type: 'float'
            },
            {
                name: 'fireTrigger',
                type: 'trigger'
            }
        ];
        console.log('📋 Parameter Check:');
        if (!animComp.findParameter) {
            console.log('%c⚠️ WARNING: findParameter method not available', 'color: #ffaa00');
            console.log('   → Using old PlayCanvas version or animation system not initialized');
        }
        let missingParams = 0;
        let foundParams = 0;
        for (const param of requiredParams){
            const found = animComp.findParameter?.(param.name);
            if (found) {
                foundParams++;
                const currentValue = this._getParameterValue(animComp, param.name);
                console.log(`   ✅ ${param.name} (${param.type}): ${currentValue}`);
            } else {
                missingParams++;
                console.log(`   ❌ ${param.name} (${param.type}): NOT FOUND`);
            }
        }
        if (missingParams > 0) {
            console.log(`%c⚠️ WARNING: ${missingParams} parameters missing from Animation Graph!`, 'color: #ffaa00');
            console.log('   → Open Animation Graph Editor in PlayCanvas');
            console.log('   → Add missing parameters with correct names and types');
        } else {
            console.log(`%c✅ All ${foundParams} parameters found!`, 'color: #00ff00');
        }
        // Check states
        if (animComp.baseLayer) {
            console.log('\n📋 State Check:');
            const activeState = animComp.baseLayer.activeStateName;
            console.log(`   - Active State: ${activeState || 'NONE'}`);
            if (!activeState) {
                console.log('%c❌ CRITICAL: No active state!', 'color: #ff0000');
                console.log('   → Check Animation Graph has a default state (Entry → Idle)');
            }
        }
    }
    /**
     * Check movement system
     */ _checkMovementSystem() {
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent) return;
        // Check YUKA vehicle
        const vehicle = aiAgent.yukaVehicle;
        if (!vehicle) {
            console.log('%c❌ CRITICAL: No YUKA vehicle found!', 'color: #ff0000');
            console.log('   → YUKA integration broken');
            return;
        }
        console.log('%c✅ YUKA vehicle exists', 'color: #00ff00');
        console.log(`   - Position: (${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)})`);
        console.log(`   - Velocity magnitude: ${vehicle.velocity.length().toFixed(3)} m/s`);
        // Check navigation
        if (!aiAgent.navigationReady) {
            console.log('%c⚠️ WARNING: Navigation not ready', 'color: #ffaa00');
            console.log('   → AI may not be able to move yet');
        } else {
            console.log('%c✅ Navigation ready', 'color: #00ff00');
        }
        // Check movement samples
        if (this._movementSamples.length > 0) {
            const avgSpeed = this._movementSamples.reduce((a, b)=>a + b, 0) / this._movementSamples.length;
            const maxSpeed = Math.max(...this._movementSamples);
            console.log('\n📊 Movement Statistics:');
            console.log(`   - Average speed: ${avgSpeed.toFixed(3)} m/s`);
            console.log(`   - Max speed: ${maxSpeed.toFixed(3)} m/s`);
            console.log(`   - Samples: ${this._movementSamples.length}`);
            if (maxSpeed < 0.01) {
                console.log('%c⚠️ WARNING: AI is not moving!', 'color: #ffaa00');
                console.log('   → Check if AI has goals/targets');
                console.log('   → Check navigation system');
            }
        }
    }
    /**
     * Generate recommendations based on findings
     */ _generateRecommendations() {
        const issues = [];
        const animComp = this._findAnimationComponent();
        const aiAgent = this.entity.script?.aiAgent;
        // Check for critical issues
        if (!aiAgent) {
            issues.push({
                severity: 'CRITICAL',
                message: 'No aiAgent script found',
                fix: 'Add aiAgent.mjs script to this entity in PlayCanvas Editor'
            });
        }
        if (!animComp) {
            issues.push({
                severity: 'CRITICAL',
                message: 'No Animation Component found',
                fix: 'Add Animation Component to entity or child entity'
            });
        } else {
            if (!animComp.enabled) {
                issues.push({
                    severity: 'CRITICAL',
                    message: 'Animation Component is disabled',
                    fix: 'Enable the Animation Component in the Inspector'
                });
            }
            if (!animComp.playing) {
                issues.push({
                    severity: 'CRITICAL',
                    message: 'Animation Component is not playing',
                    fix: 'Check "Playing" checkbox in Animation Component or enable in code'
                });
            }
            if (!animComp.stateGraph && !animComp._stateGraphAsset) {
                issues.push({
                    severity: 'CRITICAL',
                    message: 'No State Graph assigned',
                    fix: 'Assign an Animation State Graph asset in Animation Component'
                });
            }
            if (!animComp.baseLayer?.activeStateName) {
                issues.push({
                    severity: 'CRITICAL',
                    message: 'No active animation state',
                    fix: 'Check Animation Graph has states and transitions configured'
                });
            }
        }
        if (aiAgent && !aiAgent.animationController) {
            issues.push({
                severity: 'HIGH',
                message: 'AnimationController not created',
                fix: 'Check aiAgent.mjs initialization code'
            });
        }
        if (aiAgent?.animationController && !aiAgent.animationController._initialized) {
            issues.push({
                severity: 'HIGH',
                message: 'AnimationController not initialized',
                fix: 'AnimationController.initialize() may have failed - check console for errors'
            });
        }
        // Display issues
        if (issues.length === 0) {
            console.log('%c✅ No critical issues found!', 'color: #00ff00; font-weight: bold');
            console.log('\nIf animations still don\'t play, check:');
            console.log('1. Animation Graph transitions are configured correctly');
            console.log('2. Transition conditions match parameter values');
            console.log('3. Animation clips are assigned to states');
            console.log('4. AI is actually moving (check movement statistics above)');
        } else {
            console.log(`%c⚠️ Found ${issues.length} issue(s):`, 'color: #ff0000; font-weight: bold');
            console.log('');
            issues.forEach((issue, i)=>{
                const color = issue.severity === 'CRITICAL' ? '#ff0000' : '#ffaa00';
                console.log(`%c${i + 1}. [${issue.severity}] ${issue.message}`, `color: ${color}; font-weight: bold`);
                console.log(`   FIX: ${issue.fix}`);
                console.log('');
            });
        }
    }
    /**
     * Quick monitoring check
     */ _runQuickCheck() {
        const aiAgent = this.entity.script?.aiAgent;
        if (!aiAgent || !aiAgent.animationController) return;
        const animController = aiAgent.animationController;
        const animComp = animController.animComponent;
        if (!animComp) return;
        const speed = animController.movementSpeed || 0;
        const isMoving = speed >= 0.1;
        const currentState = animComp.baseLayer?.activeStateName || 'NONE';
        const playing = animComp.playing;
        console.log(`%c[${this.entity.name}] 🎬 Animation Status:`, 'color: #00aaff');
        console.log(`   Speed: ${speed.toFixed(3)} m/s | Moving: ${isMoving ? 'YES' : 'NO'} | State: ${currentState} | Playing: ${playing ? 'YES' : 'NO'}`);
        if (isMoving && currentState === 'Idle') {
            console.log('%c   ⚠️ WARNING: Moving but stuck in Idle state!', 'color: #ffaa00');
            console.log('   → Check Animation Graph transitions');
        }
        if (!playing) {
            console.log('%c   ❌ ERROR: Animation not playing!', 'color: #ff0000');
        }
    }
    /**
     * Track entity movement
     */ _trackMovement(dt) {
        const currentPos = this.entity.getPosition();
        if (this._lastPosition) {
            const distance = currentPos.distance(this._lastPosition);
            const speed = distance / dt;
            this._movementSamples.push(speed);
            // Keep only last 60 samples (about 1 second at 60fps)
            if (this._movementSamples.length > 60) {
                this._movementSamples.shift();
            }
        }
        this._lastPosition = currentPos.clone();
    }
    /**
     * Find animation component (same logic as AnimationController)
     */ _findAnimationComponent() {
        // Check entity itself
        if (this.entity.anim) {
            return this.entity.anim;
        }
        // Check aiAgent's characterModel reference
        const aiAgent = this.entity.script?.aiAgent;
        if (aiAgent?.characterModel && aiAgent.characterModel.anim) {
            return aiAgent.characterModel.anim;
        }
        // Search children
        const findAnim = (entity)=>{
            if (entity.anim) return entity.anim;
            for(let i = 0; i < entity.children.length; i++){
                const found = findAnim(entity.children[i]);
                if (found) return found;
            }
            return null;
        };
        return findAnim(this.entity);
    }
    /**
     * Get parameter value from animation component
     */ _getParameterValue(animComp, paramName) {
        if (!animComp.findParameter) return 'N/A';
        const param = animComp.findParameter(paramName);
        if (!param) return 'N/A';
        return param.value !== undefined ? param.value : 'undefined';
    }
    constructor(...args){
        super(...args);
        /** @attribute @type {boolean} @title Enable Continuous Monitoring */ _define_property(this, "enableContinuousMonitoring", true);
        /** @attribute @type {number} @title Monitor Interval (seconds) */ _define_property(this, "monitorInterval", 2.0);
    }
}
_define_property(AnimationDiagnostic, "scriptName", 'animationDiagnostic');
console.log('✅ AnimationDiagnostic.mjs loaded');

export { AnimationDiagnostic };
