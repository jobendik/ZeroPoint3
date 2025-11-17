///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
///<reference path="c:\Users\joben\.vscode\extensions\playcanvas.playcanvas-0.2.2\node_modules\playcanvas\build\playcanvas.d.ts" />;
/* global pc, YUKA */
/**
═══════════════════════════════════════════════════════════════════════════
AI AGENT COMPREHENSIVE DEBUGGER - ENHANCED EDITION
═══════════════════════════════════════════════════════════════════════════

INSTRUCTIONS:
• Attach this script to your AI Agent entity in the PlayCanvas Editor
• Enable "debugMode" attribute in the editor
• Run game and watch console for detailed diagnostics
• Press 'D' key to toggle detailed frame-by-frame logging
• Press 'V' key to run comprehensive vision test
• Press 'T' to test target acquisition manually
• Press 'C' to check combat readiness
• Press 'S' to show full system status
• Press 'F' to check forward vector sync
• Press 'G' to toggle enhanced visuals (arcs, spheres, etc.)

This script will reveal EVERYTHING about your AI's vision, targeting, and combat systems.
Now with periodic full diagnostics every 10s, colorful/emoji-rich logs, and improved runtime visuals!
*/

var AiAgentDebugger = pc.createScript('aiAgentDebugger');

// Attributes
AiAgentDebugger.attributes.add('debugMode', {
    type: 'boolean',
    default: true,
    title: 'Enable Debug Mode',
    description: 'Enable comprehensive debugging'
});

AiAgentDebugger.attributes.add('verboseLogging', {
    type: 'boolean',
    default: false,
    title: 'Verbose Logging',
    description: 'Log every frame (WARNING: Very spammy)'
});

AiAgentDebugger.attributes.add('visualDebug', {
    type: 'boolean',
    default: true,
    title: 'Visual Debug',
    description: 'Draw debug lines and shapes in runtime'
});

AiAgentDebugger.attributes.add('enhancedVisuals', {
    type: 'boolean',
    default: true,
    title: 'Enhanced Visuals',
    description: 'Show extra visuals like FOV arcs and spheres (toggle with G)'
});

AiAgentDebugger.attributes.add('logInterval', {
    type: 'number',
    default: 10.0,
    title: 'Log Interval (seconds)',
    description: 'How often to run full diagnostics (default 10s)'
});

AiAgentDebugger.attributes.add('periodicComprehensive', {
    type: 'boolean',
    default: true,
    title: 'Periodic Full Diagnostics',
    description: 'Run complete diagnostics every logInterval seconds'
});

AiAgentDebugger.attributes.add('testTargetEntity', {
    type: 'entity',
    title: 'Test Target Entity',
    description: 'Entity to test vision against (usually Player)'
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.initialize = function() {
    this.agent = this.entity.script.aiAgent;
    
    if (!this.agent) {
        this._logError('🔴 CRITICAL: No aiAgent script found on entity! 🚫');
        return;
    }

    // ESM REFACTOR COMPATIBILITY
    this._setupCompatibilityAliases();

    this._logHeader('🔍 AI AGENT COMPREHENSIVE DEBUGGER INITIALIZED 🎉');
    this._log(`Agent: ${this.entity.name} 🦾`);
    this._log('Press D = Toggle detailed logging 📝');
    this._log('Press V = Run comprehensive vision test 👀');
    this._log('Press T = Test target acquisition 🎯');
    this._log('Press C = Check combat readiness ⚔️');
    this._log('Press S = Show full system status 📊');
    this._log('Press F = Check forward vector sync 🔄');
    this._log('Press G = Toggle enhanced visuals 🌟');
    this._logSeparator();

    this.lastLogTime = 0;
    this.frameCount = 0;
    this.detailedLogging = false;
    this.showEnhancedVisuals = this.enhancedVisuals;
    this.isAIReady = false; // NEW: Track if AI is ready

    // Bind keyboard shortcuts
    this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);

    // Wait for AI to fully initialize
    this._waitForAIReady();
};

// ═══════════════════════════════════════════════════════════════════════════
// AI READY CHECK
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._waitForAIReady = function() {
    const checkReady = () => {
        const agent = this.agent;
        const isReady = agent.__aiAgentInitialized === true &&
                          agent.brain !== null &&
                          agent.brain !== undefined;

        if (isReady) {
            this.isAIReady = true; // Mark AI as ready
            this._logSuccess('✅ AI Agent fully initialized - running diagnostic 🟢');
            this.runComprehensiveDiagnostic();
        } else {
            setTimeout(checkReady, 500);
        }
    };
    checkReady();
};

// ═══════════════════════════════════════════════════════════════════════════
// ESM REFACTOR COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._setupCompatibilityAliases = function() {
    const agent = this.agent;

    if (!agent.targetSystem && agent.targetingSystem) {
        Object.defineProperty(agent, 'targetSystem', {
            get: function() { return this.targetingSystem; },
            configurable: true,
            enumerable: false
        });
    }
// Sjekk at state-objektet finnes før vi definerer alias
    if (agent.state && typeof agent.alertness === 'undefined') {
        Object.defineProperty(agent, 'alertness', {
            get: function() {
                // Les fra state-objektet
                return this.state?.alertness !== undefined ? this.state.alertness : 0;
            },
            set: function(value) {
                // Skriv til state-objektet
                if (this.state) {
                    this.state.alertness = value;
                }
            },
            configurable: true, // Viktig: Gjør at den kan redefineres om nødvendig
            enumerable: false // Skjuler den fra vanlige loops som for...in
        });
    }

    // Sjekk at state-objektet finnes før vi definerer alias
    if (agent.state && typeof agent.morale === 'undefined') {
        Object.defineProperty(agent, 'morale', {
            get: function() {
                // Les fra state-objektet
                return this.state?.morale !== undefined ? this.state.morale : 0;
            },
            set: function(value) {
                // Skriv til state-objektet
                if (this.state) {
                    this.state.morale = value;
                }
            },
            configurable: true,
            enumerable: false
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.onKeyDown = function(event) {
    if (!this.debugMode) return;

    switch(event.key) {
        case pc.KEY_D:
            this.detailedLogging = !this.detailedLogging;
            this._log(`🔍 Detailed logging: ${this.detailedLogging ? 'ENABLED ✅' : 'DISABLED ❌'}`, 'color: cyan; font-weight: bold;');
            break;

        case pc.KEY_V:
            if (!this.isAIReady) {
                this._logWarn('⚠️ AI not ready yet! Please wait for initialization... ⏳');
                return;
            }
            this._log('\n🔬 Running comprehensive vision test... 👀\n', 'color: magenta; font-weight: bold;');
            this.testVisionSystem();
            break;

        case pc.KEY_T:
            if (!this.isAIReady) {
                this._logWarn('⚠️ AI not ready yet! Please wait for initialization... ⏳');
                return;
            }
            this._log('\n🎯 Testing target acquisition...\n', 'color: magenta; font-weight: bold;');
            this.testTargetAcquisition();
            break;

        case pc.KEY_C:
            if (!this.isAIReady) {
                this._logWarn('⚠️ AI not ready yet! Please wait for initialization... ⏳');
                return;
            }
            this._log('\n⚔️ Checking combat readiness...\n', 'color: magenta; font-weight: bold;');
            this.testCombatSystem();
            break;

        case pc.KEY_S:
            if (!this.isAIReady) {
                this._logWarn('⚠️ AI not ready yet! Please wait for initialization... ⏳');
                return;
            }
            this._log('\n📊 Full system status...\n', 'color: magenta; font-weight: bold;');
            this.runComprehensiveDiagnostic();
            break;

        case pc.KEY_F:
            if (!this.isAIReady) {
                this._logWarn('⚠️ AI not ready yet! Please wait for initialization... ⏳');
                return;
            }
            this._log('\n🔄 Checking forward vector synchronization...\n', 'color: magenta; font-weight: bold;');
            this.checkForwardVectorSync();
            break;

        case pc.KEY_G:
            this.showEnhancedVisuals = !this.showEnhancedVisuals;
            this._log(`🌟 Enhanced visuals: ${this.showEnhancedVisuals ? 'ENABLED ✅' : 'DISABLED ❌'}`, 'color: magenta; font-weight: bold;');
            break;
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE LOOP
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.update = function(dt) {
    if (!this.debugMode || !this.agent) return;

    this.frameCount++;

    // Only run diagnostics if AI is ready
    if (!this.isAIReady) return;

    // Periodic logging
    const now = performance.now() / 1000;
    if (now - this.lastLogTime >= this.logInterval) {
        this.lastLogTime = now;
        this.periodicDiagnostic();
    }

    // Verbose frame-by-frame logging
    if (this.detailedLogging) {
        this.frameByFrameDiagnostic();
        if (this.frameCount % 300 === 0) {
            this._logWarn('⚠️ Verbose logging active - may impact FPS! Press D to toggle. 📉');
        }
    }

    // Visual debugging
    if (this.visualDebug) {
        this.drawDebugVisuals();
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE DIAGNOSTIC
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.runComprehensiveDiagnostic = function() {
    const timestamp = new Date().toISOString();
    console.group(`%c📊 [${timestamp}] COMPREHENSIVE AI DIAGNOSTIC - FULL REPORT 🚀`, 'color: blue; font-weight: bold; background: #e0f7fa; padding: 5px;');

    this.checkEntityStatus();
    this.checkYukaVehicle();
    this.checkForwardVectorSync();
    this.checkVisionSystem();
    this.checkMemorySystem();
    this.checkTargetSystem();
    this.checkCombatSystem();
    this.checkGoalSystem();
    this.checkStateMachine();
    this.checkNavigation();
    this.summarizeCriticalIssues();

    // Dashboard summary table
    const dashboard = this._getDashboardSummary();
    console.table(dashboard);

    console.groupEnd();
    this._logSeparator();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: ENTITY STATUS
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkEntityStatus = function() {
    console.group('%c▼ 1. ENTITY & INITIALIZATION STATUS 🏗️', 'color: cyan; font-weight: bold;');

    const status = {
        entityName: this.entity.name,
        entityEnabled: this.entity.enabled,
        entityDestroyed: this.entity.destroyed,
        hasAiAgent: !!this.agent,
        aiInitialized: this.agent?.__aiAgentInitialized || false,
        isDead: this.agent?.isDead || false,
        health: this.agent?.health || 0,
        maxHealth: this.agent?.maxHealth || 0
    };

    const statusTable = [
        { Item: 'Entity', Value: status.entityName, Status: '🟢' },
        { Item: 'Enabled', Value: status.entityEnabled ? 'Yes' : 'No', Status: status.entityEnabled ? '✅' : '❌' },
        { Item: 'Destroyed', Value: status.entityDestroyed ? 'Yes' : 'No', Status: !status.entityDestroyed ? '✅' : '❌' },
        { Item: 'AI Script', Value: status.hasAiAgent ? 'Present' : 'Missing', Status: status.hasAiAgent ? '✅' : '❌' },
        { Item: 'AI Initialized', Value: status.aiInitialized ? 'Yes' : 'No', Status: status.aiInitialized ? '✅' : '❌' },
        { Item: 'Is Dead', Value: status.isDead ? 'Yes' : 'No', Status: !status.isDead ? '✅' : '❌' },
        { Item: 'Health', Value: `${status.health}/${status.maxHealth}`, Status: status.health > 0 ? '🟢' : '🔴' }
    ];

    console.table(statusTable);

    if (!status.hasAiAgent) this._logError('🔴 CRITICAL: No AI Agent script found! 🚫');
    if (!status.aiInitialized) this._logError('🔴 CRITICAL: AI Agent not initialized! ⏳');
    if (status.isDead) this._logWarn('⚠️ WARNING: AI is marked as dead! 💀');

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: YUKA VEHICLE
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkYukaVehicle = function() {
    console.group('%c▼ 2. YUKA VEHICLE STATUS 🚗', 'color: cyan; font-weight: bold;');

    if (!this.agent.yukaVehicle) {
        this._logError('🔴 CRITICAL: YUKA Vehicle not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const vehicle = this.agent.yukaVehicle;
    const entityPos = this.entity.getPosition();
    const yukaPos = vehicle.position;

    const posDiff = Math.sqrt(
        Math.pow(entityPos.x - yukaPos.x, 2) +
        Math.pow(entityPos.y - yukaPos.y, 2) +
        Math.pow(entityPos.z - yukaPos.z, 2)
    );

    const forwardMag = this.entity.forward.length();

    const statusTable = [
        { Item: 'YUKA Vehicle', Status: '✅ Present' },
        { Item: 'Entity Position', Value: this._formatVec3(entityPos) },
        { Item: 'YUKA Position', Value: this._formatYukaVec3(yukaPos) },
        { Item: 'Position Sync', Status: posDiff < 1.0 ? '✅' : '⚠️', Note: posDiff.toFixed(2) + 'm apart' },
        { Item: 'PlayCanvas Forward', Value: this._formatVec3(this.entity.forward) },
        { Item: 'YUKA Forward', Value: this._formatYukaVec3(vehicle.forward) },
        { Item: 'Forward Normalized', Status: Math.abs(forwardMag - 1) < 0.1 ? '✅' : '❌', Note: forwardMag.toFixed(3) },
        { Item: 'Entity Rotation', Value: this._formatVec3(this.entity.getEulerAngles()) + '°' }
    ];

    console.table(statusTable);

    if (posDiff > 1.0) this._logWarn('⚠️ WARNING: Positions out of sync! 📏');

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// FORWARD VECTOR SYNCHRONIZATION CHECK
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkForwardVectorSync = function() {
    console.group('%c▼ 2.5. FORWARD VECTOR SYNCHRONIZATION CHECK 🔄', 'color: cyan; font-weight: bold;');

    if (!this.agent.yukaVehicle) {
        this._logError('🔴 CRITICAL: YUKA Vehicle not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const pcForward = this.entity.forward;
    const yukaForward = this.agent.yukaVehicle.forward;

    const expectedYukaX = pcForward.x;
    const expectedYukaY = pcForward.y;
    const expectedYukaZ = -pcForward.z;

    const diffX = Math.abs(yukaForward.x - expectedYukaX);
    const diffY = Math.abs(yukaForward.y - expectedYukaY);
    const diffZ = Math.abs(yukaForward.z - expectedYukaZ);

    // ✅ FIX: More tolerant threshold - account for floating point precision
    // and the fact that vehicle.update() may normalize the vector slightly differently
    const tolerance = 0.05; // Increased from 0.01 to reduce false positives
    const isSynced = (diffX < tolerance && diffY < tolerance && diffZ < tolerance);
    const yukaLength = yukaForward.length();
    
    // Calculate total difference magnitude for better diagnostics
    const totalDiff = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);

    const statusTable = [
        { Item: 'PlayCanvas Forward', Value: this._formatVec3(pcForward) },
        { Item: 'YUKA Forward', Value: this._formatYukaVec3(yukaForward) },
        { Item: 'Expected YUKA Forward', Value: `(${expectedYukaX.toFixed(3)}, ${expectedYukaY.toFixed(3)}, ${expectedYukaZ.toFixed(3)})` },
        { Item: 'Difference', Value: `(${diffX.toFixed(3)}, ${diffY.toFixed(3)}, ${diffZ.toFixed(3)})` },
        { Item: 'Total Difference', Value: totalDiff.toFixed(4), Status: totalDiff < 0.1 ? '✅' : (totalDiff < 0.2 ? '⚠️' : '❌') },
        { Item: 'Synced', Status: isSynced ? '✅ Yes 🟢' : '❌ No 🔴' },
        { Item: 'YUKA Length', Value: yukaLength.toFixed(3), Status: Math.abs(yukaLength - 1) < 0.01 ? '✅' : '❌' },
        { Item: 'Entity Rotation', Value: this._formatVec3(this.entity.getEulerAngles()) + '°' },
        { Item: 'updateOrientation', Value: this.agent.yukaVehicle.updateOrientation ? 'true ⚠️' : 'false ✅' }
    ];

    console.table(statusTable);

    // ✅ FIX: Only show error if difference is actually significant (> 0.1 total magnitude)
    // Small differences are expected due to floating point precision and normalization
    if (!isSynced) {
        if (totalDiff > 0.1) {
            this._logError('🔴 CRITICAL: Forward vectors NOT SYNCHRONIZED! Large discrepancy detected. ⚙️');
            this._log('Possible causes:', 'color: orange; font-weight: bold;');
            this._log('  1. vehicle.updateOrientation is true (should be false)', 'color: orange;');
            this._log('  2. Steering behaviors are modifying the forward vector', 'color: orange;');
            this._log('  3. Script execution order issue (debugger runs before sync)', 'color: orange;');
        } else {
            this._logInfo(`ℹ️ Forward vectors have minor difference (${totalDiff.toFixed(4)}). This is likely due to floating point precision or normalization. 📐`);
        }
    } else {
        this._logSuccess('✅ Forward vectors properly synchronized! 🟢');
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: VISION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkVisionSystem = function() {
    console.group('%c▼ 3. VISION SYSTEM STATUS 👀', 'color: cyan; font-weight: bold;');

    if (!this.agent.vision) {
        this._logError('🔴 CRITICAL: YUKA Vision not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const vision = this.agent.vision;
    const obstacleCount = vision.obstacles ? vision.obstacles.length : 0;
    const fovDeg = (vision.fieldOfView * 180 / Math.PI).toFixed(1);

    const statusTable = [
        { Item: 'YUKA Vision', Status: '✅ Present' },
        { Item: 'Vision Range', Value: vision.range + 'm' },
        { Item: 'Field of View', Value: fovDeg + '° (' + vision.fieldOfView.toFixed(3) + ' rad)' },
        { Item: 'Obstacles', Value: obstacleCount, Status: obstacleCount > 0 ? '🟢' : '🟡', Note: obstacleCount === 0 ? 'NOTE: Using raycast LOS instead 📡' : '' }
    ];

    console.table(statusTable);

    if (obstacleCount === 0) this._logInfo('ℹ️ INFO: No obstacles configured - normal for raycast-based LOS. 📐');

    if (this.agent.visionSystem) {
        const visionSystem = this.agent.visionSystem;
        const status = visionSystem.getVisionStatus ? visionSystem.getVisionStatus() : {};

        const wrapperTable = [
            { Item: 'AIVisionSystem Wrapper', Status: '✅ Present' },
            { Item: 'Obstacles Ready', Status: visionSystem.obstaclesReady ? '✅' : '❌' },
            { Item: 'Eye Height', Value: status.eyeHeight + 'm' },
            { Item: 'Vision Checks', Value: (status.visionCheckCount || 0) + ' (Total: ' + (status.totalVisionChecks || 0) + ')' },
            { Item: 'Vision Errors', Value: status.yukaVisionErrors || 0, Status: (status.yukaVisionErrors || 0) > 0 ? '🔴' : '🟢' }
        ];

        console.table(wrapperTable);

        // ✅ FIX: Check session state before warning about zero vision checks
        const sessionInfo = this.app.gameManager?.gameSession?.getSessionInfo?.() || {};
        const isCountingDown = sessionInfo.isCountingDown || false;
        const isSessionActive = sessionInfo.isActive || false;
        
        if (status.totalVisionChecks === 0) {
            if (isCountingDown) {
                this._logInfo('ℹ️ INFO: Zero vision checks (expected during countdown - player disabled). ⏰');
            } else if (!isSessionActive) {
                this._logInfo('ℹ️ INFO: Zero vision checks (session not active yet). ⏸️');
            } else {
                this._logError('🔴 CRITICAL: ZERO vision checks performed! Vision not running. ⏯️');
            }
        }
        
        if (status.yukaVisionErrors > 0) this._logError('🔴 ERROR: YUKA vision errors detected! ⚠️');
    } else {
        this._logWarn('⚠️ WARNING: AIVisionSystem wrapper not found. ❓');
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkMemorySystem = function() {
    console.group('%c▼ 4. MEMORY SYSTEM STATUS 🧠', 'color: cyan; font-weight: bold;');

    if (!this.agent.memorySystem) {
        this._logError('🔴 CRITICAL: Memory system not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const memorySystem = this.agent.memorySystem;
    const memoryRecords = this.agent.memoryRecords || [];
    const currentTime = this.agent._getGameTime ? this.agent._getGameTime() : 0;

    const statusTable = [
        { Item: 'Memory System', Status: '✅ Present' },
        { Item: 'Memory Span', Value: memorySystem.memorySpan + 's' },
        { Item: 'Memory Records', Value: memoryRecords.length, Status: memoryRecords.length > 0 ? '🟢' : '🟡' }
    ];

    console.table(statusTable);

    if (memoryRecords.length === 0) {
        // ✅ FIX: Check session state before warning about no memory records
        const sessionInfo = this.app.gameManager?.gameSession?.getSessionInfo?.() || {};
        const isCountingDown = sessionInfo.isCountingDown || false;
        const isSessionActive = sessionInfo.isActive || false;
        
        if (isCountingDown) {
            this._logInfo('ℹ️ INFO: No memory records (expected during countdown - player disabled). ⏰');
        } else if (!isSessionActive) {
            this._logInfo('ℹ️ INFO: No memory records (session not active yet). ⏸️');
        } else {
            this._logWarn('⚠️ WARNING: No memory records! AI hasn\'t seen any entities yet. 👻');
        }

        console.group('%c🔍 DIAGNOSTIC: Why no targets visible? ❓', 'color: orange; font-weight: bold;');

        const hasGameManager = !!this.app.gameManager;
        const hasPlayer = hasGameManager && !!this.app.gameManager.player;
        const agentsCount = hasGameManager && this.app.gameManager.getAllAgents ? this.app.gameManager.getAllAgents().length : 0;

        const diagTable = [
            { Item: 'GameManager', Status: hasGameManager ? '✅' : '❌' },
            { Item: 'Player', Status: hasPlayer ? '✅' : '❌' },
            { Item: 'Other Agents', Value: agentsCount },
            { Item: 'Vision System', Status: !!this.agent.visionSystem ? '✅' : '❌' }
        ];

        if (hasPlayer) {
            const playerEntity = this.app.gameManager.player.entity;
            const playerPos = playerEntity.getPosition();
            const aiPos = this.entity.getPosition();
            const distance = aiPos.distance(playerPos);
            diagTable.push({ Item: 'Distance to Player', Value: distance.toFixed(2) + 'm', Status: distance <= (this.agent.visionRange || 25) ? '🟢' : '🟡' });
        }

        console.table(diagTable);
        console.groupEnd();
    } else {
        // ✅ REDUCED LOGGING: Only show 5 most recent memory records to avoid spam
        const maxRecordsToShow = 5;
        const recentRecords = memoryRecords.slice(-maxRecordsToShow);
        
        console.group(`%cMemory Records (${recentRecords.length} of ${memoryRecords.length}) 📋`, 'color: magenta; font-weight: bold;');

        const recordsTable = recentRecords.map((record) => {
            const lastSensed = record.timeLastSensed || 0;
            const timeSinceSeen = (lastSensed > 0 && currentTime > 0) ? (currentTime - lastSensed).toFixed(1) + 's ago' : 'never';
            const actualIndex = memoryRecords.indexOf(record);

            return {
                Index: actualIndex,
                Entity: this._getRecordEntityName(record),
                Visible: record.visible ? '✅ Yes 👀' : '❌ No 🕵️',
                LastSeen: timeSinceSeen,
                Position: this._formatYukaVec3(record.lastSensedPosition)
            };
        });

        console.table(recordsTable);
        
        if (memoryRecords.length > maxRecordsToShow) {
            this._logInfo(`ℹ️ (${memoryRecords.length - maxRecordsToShow} older records hidden for readability)`);
        }
        
        console.groupEnd();
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: TARGET SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkTargetSystem = function() {
    console.group('%c▼ 5. TARGET SYSTEM STATUS 🎯', 'color: cyan; font-weight: bold;');

    const targetSystem = this.agent.targetingSystem || this.agent.targetSystem;

    if (!targetSystem) {
        this._logError('🔴 CRITICAL: Target system not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const hasTarget = targetSystem.hasTarget();
    const currentTarget = targetSystem.getTargetEntity();

    const statusTable = [
        { Item: 'Target System', Status: '✅ Present' },
        { Item: 'Has Target', Status: hasTarget ? '✅ Yes 🟢' : '❌ No 🟡' }
    ];

    console.table(statusTable);

    if (hasTarget && currentTarget) {
        console.group('%cCurrent Target Details 🔎', 'color: magenta; font-weight: bold;');

        const targetPos = targetSystem.getTargetPosition();
        const myPos = this.entity.getPosition();
        const distance = targetPos ? myPos.distance(targetPos) : 'N/A';
        const confidence = targetSystem.getTargetConfidence ? (targetSystem.getTargetConfidence() * 100).toFixed(0) + '%' : '100%';

        const targetTable = [
            { Item: 'Name', Value: this._getRecordEntityName(currentTarget) },
            { Item: 'Visible', Status: targetSystem.isTargetVisible() ? '✅ Yes 👀' : '❌ No 🕵️' },
            { Item: 'Confidence', Value: confidence },
            { Item: 'Position', Value: targetPos ? this._formatVec3(targetPos) : 'N/A' },
            { Item: 'Distance', Value: typeof distance === 'number' ? distance.toFixed(2) + 'm' : distance }
        ];

        console.table(targetTable);

        if (!targetSystem.isTargetVisible()) this._logWarn('⚠️ WARNING: Target NOT visible! 🌫️');

        console.groupEnd();
    } else {
        this._log('Current Target: None 🚫');
        if (this.agent.memoryRecords && this.agent.memoryRecords.length > 0) this._logWarn('⚠️ WARNING: Has memories but no target! ❓ Press T to test acquisition.');
    }

    if (targetSystem.targetPriorities && targetSystem.targetPriorities.size > 0) {
        console.group('%cTarget Priorities 📊', 'color: magenta; font-weight: bold;');

        const prioritiesTable = Array.from(targetSystem.targetPriorities).map(([record, priority], i) => ({
            Index: i,
            Entity: this._getRecordEntityName(record),
            Priority: priority.toFixed(1),
            Visible: record.visible ? '✅' : '❌'
        }));

        console.table(prioritiesTable);
        console.groupEnd();
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: COMBAT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkCombatSystem = function () {
    console.group('%c▼ 6. COMBAT SYSTEM STATUS ⚔️', 'color: cyan; font-weight: bold;');

    // Guard: combat system present?
    if (!this.agent?.combatSystem) {
        this._logWarn('⚠️ WARNING: Combat system not found ❓');
        console.groupEnd();
        return;
    }

    const combatSystem = this.agent.combatSystem;

    // ✅ Readiness-aware diagnostics (backward compatible)
    const isReady = (typeof combatSystem.isReady === 'function')
        ? !!combatSystem.isReady()
        : true; // assume ready if legacy system without isReady()

    // Only compute canEngage when system is ready and method exists
    const canEngage = isReady && (typeof combatSystem.canEngageInCombat === 'function')
        ? !!combatSystem.canEngageInCombat()
        : false;

    const statusTable = [
        { Item: 'Combat System',   Status: '✅ Present' },
        { Item: 'Initialization',  Status: isReady ? '✅ Ready' : '⏳ Initializing...' },
        { Item: 'Can Engage',      Status: isReady ? (canEngage ? '✅ Yes 🟢' : '❌ No 🔴') : '⏳ Pending' }
    ];

    console.table(statusTable);

    // Only warn when READY but cannot engage; otherwise show init info
    if (isReady && !canEngage) {
        this._logWarn('⚠️ WARNING: AI cannot engage in combat! 🚫');

        console.group('%cDetailed Diagnostics 🔍', 'color: orange; font-weight: bold;');

        const hasTarget       = this.agent.targetingSystem?.hasTarget?.() || false;
        const isTargetVisible = hasTarget && (this.agent.targetingSystem?.isTargetVisible?.() || false);
        const hasWeapon       = !!this.agent.weaponSystem?.currentWeapon;
        const hasAmmo         = this.agent.weaponSystem?.hasAmmo?.() || false;
        const hasHealth       = (typeof this.agent.health === 'number' && typeof this.agent.maxHealth === 'number')
            ? this.agent.health > (this.agent.maxHealth * 0.15)
            : true; // if health system absent, don't block engage

        const diagTable = [
            { Item: 'Has Target',       Status: hasTarget ? '✅' : '❌' },
            { Item: 'Target Visible',   Status: isTargetVisible ? '✅' : '❌' },
            { Item: 'Has Weapon',       Status: hasWeapon ? '✅' : '❌' },
            { Item: 'Has Ammo',         Status: hasAmmo ? '✅' : '❌' },
            { Item: 'Has Health',       Status: hasHealth ? '✅' : '❌', Note: (typeof this.agent.health === 'number' ? `${Math.round(this.agent.health)}/${this.agent.maxHealth}` : 'n/a') }
        ];

        console.table(diagTable);
        console.groupEnd();
    } else if (!isReady) {
        console.log('ℹ️ Combat system will be ready once dependencies are initialized');
    }

    // Weapon system snapshot (shown regardless of readiness for visibility)
    if (this.agent.weaponSystem) {
        console.group('%cWeapon System 🔫', 'color: magenta; font-weight: bold;');

        const hasWeapon = !!this.agent.weaponSystem.currentWeapon;
        const weaponKey = hasWeapon ? this.agent.weaponSystem.currentWeapon : 'None';
        const hasAmmo   = this.agent.weaponSystem.hasAmmo ? !!this.agent.weaponSystem.hasAmmo() : false;
        const weaponData = hasWeapon ? this.agent.weaponSystem.weapons?.[weaponKey] : null;

        const weaponTable = [
            { Item: 'Has Weapon',      Status: hasWeapon ? '✅' : '❌' },
            { Item: 'Current Weapon',  Value: weaponKey },
            { Item: 'Has Ammo',        Status: hasAmmo ? '✅' : '❌' }
        ];

        if (hasAmmo && weaponData) {
            weaponTable.push({ Item: 'Magazine', Value: weaponData.magazine ?? 0 });
            weaponTable.push({ Item: 'Reserve',  Value: weaponData.ammo ?? 0 });
        } else if (!hasAmmo && hasWeapon) {
            this._logWarn('⚠️ WARNING: No ammo - seek pickups! 📦');
        }

        console.table(weaponTable);

        if (!hasWeapon) this._logError('🔴 ERROR: No weapon equipped! 🚫');

        console.groupEnd();
    } else {
        this._logWarn('⚠️ WARNING: No weapon system found ❓');
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: GOAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkGoalSystem = function() {
    console.group('%c▼ 7. GOAL SYSTEM STATUS 🏆', 'color: cyan; font-weight: bold;');

    if (!this.agent.brain) {
        this._logError('🔴 CRITICAL: YUKA brain not initialized! 🚫');
        console.groupEnd();
        return;
    }

    const brain = this.agent.brain;
    const currentGoal = brain.currentSubgoal ? brain.currentSubgoal() : null;

    const statusTable = [
        { Item: 'YUKA Brain', Status: '✅ Present' }
    ];

    if (currentGoal) {
        statusTable.push({ Item: 'Current Goal', Value: currentGoal.constructor.name });
        statusTable.push({ Item: 'Goal Status', Value: currentGoal.status || 'unknown' });
    } else {
        this._logWarn('⚠️ WARNING: No active goal! ❓');
    }

    console.table(statusTable);

    if (this.agent.goalEvaluators) {
        console.group('%cGoal Evaluators 📈', 'color: magenta; font-weight: bold;');

        const evaluatorsTable = this.agent.goalEvaluators.map(evaluator => ({
            Name: evaluator.constructor.name,
            Bias: evaluator.characterBias?.toFixed(2) || 0
        }));

        console.table(evaluatorsTable);
        console.groupEnd();
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkStateMachine = function() {
    console.group('%c▼ 8. STATE MACHINE STATUS 🤖', 'color: cyan; font-weight: bold;');

    const stateMachine = this.agent.stateMachine;

    if (!stateMachine) {
        this._logWarn('⚠️ WARNING: State machine not found ❓ Check async init.');
        console.groupEnd();
        return;
    }

    const currentState = stateMachine.currentState;
    const stateName = currentState ? currentState.name || currentState.type || currentState.constructor.name : 'None';

    const statusTable = [
        { Item: 'State Machine', Status: '✅ Present' },
        { Item: 'Current State', Value: stateName, Status: currentState ? '🟢' : '🔴' },
        { Item: 'Alertness', Value: ((this.agent.alertness || 0) * 100).toFixed(0) + '%' },
        { Item: 'Morale', Value: ((this.agent.morale || 0) * 100).toFixed(0) + '%' }
    ];

    console.table(statusTable);

    if (!currentState) this._logWarn('⚠️ WARNING: No current state! State machine may not be initialized. ⏯️');

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.checkNavigation = function() {
    console.group('%c▼ 9. NAVIGATION SYSTEM STATUS 🗺️', 'color: cyan; font-weight: bold;');

    const navReady = this.agent.navigationReady || false;
    const hasAdapter = !!this.agent.navigation;

    const statusTable = [
        { Item: 'Navigation Ready', Status: navReady ? '✅ Yes 🟢' : '❌ No 🔴' },
        { Item: 'Navigation Adapter', Status: hasAdapter ? '✅' : '❌' }
    ];

    if (hasAdapter) {
        statusTable.push({ Item: 'Methods', Value: Object.keys(this.agent.navigation).filter(k => typeof this.agent.navigation[k] === 'function').join(', ') });
        statusTable.push({ Item: 'Is Moving', Status: this.agent.isMoving ? '✅' : '❌' });

        if (this.agent.yukaVehicle) {
            statusTable.push({ Item: 'YUKA Vehicle', Status: '✅' });
            statusTable.push({ Item: 'YUKA Position', Value: this._formatYukaVec3(this.agent.yukaVehicle.position) });
        }
    }

    console.table(statusTable);

    if (!navReady) this._logError('🔴 ERROR: Navigation not ready! AI cannot move. 🚧');
    if (!hasAdapter) this._logError('🔴 ERROR: Navigation adapter missing! ❓');

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: CRITICAL ISSUES SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.summarizeCriticalIssues = function() {
    console.group('%c▼ 10. CRITICAL ISSUES SUMMARY ⚠️', 'color: cyan; font-weight: bold;');

    const issues = [];

    if (!this.agent.__aiAgentInitialized) issues.push('🔴 BLOCKER: AI not initialized ⏳');
    if (this.agent.isDead) issues.push('🔴 BLOCKER: AI is dead 💀');
    if (!this.agent.vision) issues.push('🔴 BLOCKER: YUKA Vision missing 👀');
    if (this.agent.vision && (!this.agent.vision.obstacles || this.agent.vision.obstacles.length === 0)) issues.push('ℹ️ INFO: No vision obstacles (raycast LOS normal) 📡');
    if (this.agent.visionSystem && this.agent.visionSystem.obstaclesReady === false) issues.push('⚠️ WARNING: Vision obstacles loading... ⏳');
    if (!this.agent.memorySystem) issues.push('🔴 BLOCKER: Memory system missing 🧠');
    if (!this.agent.targetingSystem && this.agent.__aiAgentInitialized) issues.push('🔴 BLOCKER: Target system missing 🎯');
    if (!this.agent.brain) issues.push('🔴 BLOCKER: YUKA brain missing 🧠');
    if (!this.agent.navigationReady) issues.push('⚠️ WARNING: Navigation not ready 🗺️');
    if (this.agent.weaponSystem && !this.agent.weaponSystem.currentWeapon) issues.push('⚠️ WARNING: No weapon equipped 🔫');
    if (this.agent.weaponSystem && this.agent.weaponSystem.hasUsableAmmo && !this.agent.weaponSystem.hasUsableAmmo()) issues.push('⚠️ WARNING: No usable ammo 📦');
    if (this.agent.memoryRecords && this.agent.memoryRecords.length === 0) issues.push('⚠️ INFO: No entities in memory 👻');
    if (this.agent.targetSystem && !this.agent.targetSystem.hasTarget()) issues.push('⚠️ INFO: No target acquired 🎯');

    if (issues.length === 0) {
        this._logSuccess('✅ No critical issues detected! Everything looks good 🟢');
        this._log('AI should be fully functional. 🚀');
    } else {
        this._log(`Found ${issues.length} issue(s): 📋`);
        const issuesTable = issues.map((issue, i) => ({ Index: i + 1, Issue: issue }));
        console.table(issuesTable);
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// VISION TESTING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.testVisionSystem = function() {
    const timestamp = new Date().toISOString();
    console.group(`%c[${timestamp}] 🔬 COMPREHENSIVE VISION SYSTEM TEST 👀`, 'color: magenta; font-weight: bold; background: #f3e5f5; padding: 5px;');

    if (!this.agent.vision) {
        this._logError('🔴 Cannot test: YUKA Vision not initialized! 🚫');
        console.groupEnd();
        return;
    }

    let testTarget = this.testTargetEntity || (this.app.gameManager && this.app.gameManager.player ? this.app.gameManager.player.entity : null);

    if (!testTarget) {
        this._logError('🔴 No test target! Set testTargetEntity or ensure player exists. ❓');
        console.groupEnd();
        return;
    }

    this._log(`Testing against: ${testTarget.name} 🎯`);

    const aiPos = this.entity.getPosition();
    const targetPos = testTarget.getPosition();
    const eyeHeight = this.agent.visionSystem?.eyeHeight || 1.6;
    const aiEyePos = new pc.Vec3(aiPos.x, aiPos.y + eyeHeight, aiPos.z);
    const targetEyePos = new pc.Vec3(targetPos.x, targetPos.y + eyeHeight, targetPos.z);
    const distance = aiPos.distance(targetPos);
    const visionRange = this.agent.visionRange || 25;
    const inRange = distance <= visionRange;

    console.group('%c1. POSITION CHECK 📍', 'color: orange; font-weight: bold;');

    const posTable = [
        { Item: 'AI Position', Value: this._formatVec3(aiPos) },
        { Item: 'AI Eye', Value: this._formatVec3(aiEyePos) },
        { Item: 'Target Position', Value: this._formatVec3(targetPos) },
        { Item: 'Target Eye', Value: this._formatVec3(targetEyePos) },
        { Item: 'Distance', Value: distance.toFixed(2) + 'm', Status: inRange ? '✅' : '❌' },
        { Item: 'Vision Range', Value: visionRange + 'm' }
    ];

    console.table(posTable);

    if (!inRange) this._logWarn('⚠️ Target out of range! 📏');

    console.groupEnd();

    console.group('%c2. FORWARD VECTOR CHECK 🔄', 'color: orange; font-weight: bold;');

    const pcForward = this.entity.forward;
    const forwardMag = pcForward.length();
    const yukaForward = new YUKA.Vector3(pcForward.x, pcForward.y, -pcForward.z);

    const fwdTable = [
        { Item: 'PlayCanvas Forward', Value: this._formatVec3(pcForward) },
        { Item: 'Magnitude', Value: forwardMag.toFixed(3), Status: Math.abs(forwardMag - 1) < 0.1 ? '✅' : '❌' },
        { Item: 'YUKA Forward', Value: this._formatYukaVec3(yukaForward) }
    ];

    console.table(fwdTable);

    if (Math.abs(forwardMag - 1) > 0.1) this._logError('🔴 ERROR: Forward not normalized! ⚙️');

    console.groupEnd();

    console.group('%c3. FOV CHECK 📐', 'color: orange; font-weight: bold;');

    const directionToTarget = new pc.Vec3().sub2(targetPos, aiPos).normalize();
    const dotProduct = pcForward.dot(directionToTarget);
    const clampedDot = Math.max(-1, Math.min(1, dotProduct));
    const angleDegrees = Math.acos(clampedDot) * 180 / Math.PI;
    const fov = this.agent.visionAngle || 75;
    const halfFov = fov / 2;
    const withinFov = angleDegrees <= halfFov;

    const fovTable = [
        { Item: 'Direction to Target', Value: this._formatVec3(directionToTarget) },
        { Item: 'Angle to Target', Value: angleDegrees.toFixed(1) + '°' },
        { Item: 'FOV', Value: fov + '° (half: ' + halfFov + '°)' },
        { Item: 'Within FOV', Status: withinFov ? '✅' : '❌' }
    ];

    console.table(fovTable);

    if (!withinFov) this._logWarn('⚠️ Target outside FOV! 🔭');

    console.groupEnd();

    console.group('%c4. LINE OF SIGHT CHECK (YUKA) 📡', 'color: orange; font-weight: bold;');

    const obstacleCount = this.agent.vision.obstacles ? this.agent.vision.obstacles.length : 0;

    const losTable = [
        { Item: 'Obstacles', Value: obstacleCount, Status: obstacleCount > 0 ? '🟢' : '🟡' }
    ];

    console.table(losTable);

    if (obstacleCount === 0) this._logError('🔴 CRITICAL: No obstacles - LOS always TRUE! ⚠️');

    const originalYukaPos = this.agent.yukaVehicle.position.clone();
    const originalYukaForward = this.agent.yukaVehicle.forward.clone();

    const yukaAiEyePos = new YUKA.Vector3(aiEyePos.x, aiEyePos.y, aiEyePos.z);
    const yukaTargetEyePos = new YUKA.Vector3(targetEyePos.x, targetEyePos.y, targetEyePos.z);

    this.agent.yukaVehicle.position.copy(yukaAiEyePos);
    this.agent.yukaVehicle.forward.copy(yukaForward);

    let yukaCanSee = false;
    try {
        yukaCanSee = this.agent.vision.visible(yukaTargetEyePos);
        this._log(`YUKA visible(): ${yukaCanSee ? '✅ Yes' : '❌ No'}`);
    } catch (error) {
        this._logError('🔴 ERROR in YUKA visible(): ' + error.message);
    }

    this.agent.yukaVehicle.position.copy(originalYukaPos);
    this.agent.yukaVehicle.forward.copy(originalYukaForward);

    console.groupEnd();

    console.group('%c5. EXPECTED vs ACTUAL 📊', 'color: orange; font-weight: bold;');

    const shouldSee = inRange && withinFov;

    const summaryTable = [
        { Item: 'Expected (Range + FOV)', Status: shouldSee ? '✅ See' : '❌ Not See' },
        { Item: 'Actual (YUKA)', Status: yukaCanSee ? '✅ See' : '❌ Not See' }
    ];

    console.table(summaryTable);

    if (shouldSee !== yukaCanSee) {
        this._logError('🔴 MISMATCH! Expected vs Actual differ. Possible causes: forward conversion, FOV calc, obstacles. ⚙️');
    } else {
        this._logSuccess('✅ Vision working as expected! 🟢');
    }

    console.groupEnd();

    console.groupEnd();
    this._logSeparator();
};

// ═══════════════════════════════════════════════════════════════════════════
// TARGET ACQUISITION TESTING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.testTargetAcquisition = function() {
    const timestamp = new Date().toISOString();
    console.group(`%c[${timestamp}] 🎯 TARGET ACQUISITION TEST 🔎`, 'color: magenta; font-weight: bold; background: #f3e5f5; padding: 5px;');

    const targetSystem = this.agent.targetSystem;

    if (!targetSystem) {
        this._logError('🔴 Target system not available! 🚫');
        console.groupEnd();
        return;
    }

    const hasTarget = targetSystem.hasTarget();
    this._log(`Current Target State: ${hasTarget ? '✅ HAS TARGET 🟢' : '❌ NO TARGET 🟡'}`);

    const memoryRecords = this.agent.memoryRecords || [];
    this._log(`Memory Records: ${memoryRecords.length}`);

    if (memoryRecords.length === 0) {
        this._logWarn('⚠️ No memory records! Run vision test (V). 👀');
        console.groupEnd();
        return;
    }

    // ✅ REDUCED LOGGING: Only show 5 most recent to avoid console spam
    const maxShow = 5;
    const recentMemory = memoryRecords.slice(-maxShow);

    console.group(`%cMemory Records (${recentMemory.length} of ${memoryRecords.length}) 📋`, 'color: orange; font-weight: bold;');

    const recordsTable = recentMemory.map((record) => {
        const actualIndex = memoryRecords.indexOf(record);
        return {
            Index: actualIndex,
            Entity: this._getRecordEntityName(record),
            Visible: record.visible ? '✅' : '❌',
            TimeSinceSeen: (this.agent._getGameTime() - record.timeLastSensed).toFixed(1) + 's'
        };
    });

    console.table(recordsTable);

    if (memoryRecords.length > maxShow) {
        this._log(`ℹ️ (${memoryRecords.length - maxShow} older records hidden)`);
    }

    console.groupEnd();

    if (targetSystem.targetPriorities) {
        this._log(`Target Priorities: ${targetSystem.targetPriorities.size}`);

        if (targetSystem.targetPriorities.size === 0) {
            this._logWarn('⚠️ Priorities empty! Not evaluating targets. ❓');
        } else {
            console.group('%cPriorities Details 📊', 'color: orange; font-weight: bold;');

            let highestPriority = -Infinity;
            let highestTarget = null;

            const prioritiesTable = Array.from(targetSystem.targetPriorities).map(([record, priority]) => {
                if (priority > highestPriority) {
                    highestPriority = priority;
                    highestTarget = record;
                }
                return {
                    Entity: this._getRecordEntityName(record),
                    Priority: priority.toFixed(1),
                    Visible: record.visible ? '✅' : '❌'
                };
            });

            console.table(prioritiesTable);
            console.groupEnd();

            if (highestTarget) {
                this._log(`Highest Priority: ${this._getRecordEntityName(highestTarget)} (${highestPriority.toFixed(1)}) ${highestTarget.visible ? '👀' : '🕵️'}`);
                if (!hasTarget) this._logError('🔴 ERROR: High-priority target but none acquired! ⚠️');
            }
        }
    }

    console.groupEnd();
    this._logSeparator();
};

// ═══════════════════════════════════════════════════════════════════════════
// COMBAT SYSTEM TESTING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.testCombatSystem = function() {
    const timestamp = new Date().toISOString();
    console.group(`%c[${timestamp}] ⚔️ COMBAT READINESS TEST 🛡️`, 'color: magenta; font-weight: bold; background: #f3e5f5; padding: 5px;');

    const checks = [
        { name: 'Has Target', status: this.agent.targetSystem && this.agent.targetSystem.hasTarget() },
        { name: 'Target Visible', status: this.agent.targetSystem && this.agent.targetSystem.hasTarget() && this.agent.targetSystem.isTargetVisible() },
        { name: 'Has Weapon', status: this.agent.weaponSystem && this.agent.weaponSystem.currentWeapon != null },
        { name: 'Has Ammo', status: this.agent.weaponSystem && this.agent.weaponSystem.hasUsableAmmo && this.agent.weaponSystem.hasUsableAmmo() },
        { name: 'Can Engage', status: this.agent.combatSystem && this.agent.combatSystem.canEngageInCombat && this.agent.combatSystem.canEngageInCombat() },
        { name: 'In Combat State', status: this.agent.stateMachine && this.agent.stateMachine.currentState && this.agent.stateMachine.currentState.type === 'combat' },
        { name: 'Alive', status: !this.agent.isDead }
    ];

    this._log('Combat Readiness Checks: 📋');

    const checksTable = checks.map(check => ({ Name: check.name, Status: check.status ? '✅ Yes 🟢' : '❌ No 🔴' }));

    console.table(checksTable);

    const allPassed = checks.every(check => check.status);

    if (allPassed) {
        this._logSuccess('✅ AI COMBAT READY! Should be shooting. 🔥');
        this._log('If not, check updateCombat(), fire(), attack goal. ⚙️');
    } else {
        this._logError('🔴 AI NOT combat ready! Fix failed checks. 🚧');
    }

    console.groupEnd();
    this._logSeparator();
};

// ═══════════════════════════════════════════════════════════════════════════
// PERIODIC DIAGNOSTIC
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.periodicDiagnostic = function() {
    if (!this.agent) return;

    const timestamp = new Date().toISOString();
    console.group(`%c📅 [${timestamp}] ─── Periodic Diagnostic ─── 🔍`, 'color: cyan; font-style: italic; font-weight: bold; background: #e0f7fa; padding: 5px;');

    if (this.periodicComprehensive) {
        this.runComprehensiveDiagnostic();
    } else {
        const hasTarget = this.agent.targetSystem && this.agent.targetSystem.hasTarget();
        const memoryCount = this.agent.memoryRecords ? this.agent.memoryRecords.length : 0;
        let currentState = 'unknown';

        if (this.agent.stateMachine && this.agent.stateMachine.currentState) {
            const state = this.agent.stateMachine.currentState;
            currentState = state.name || state.type || state.constructor.name;
        }

        const statusTable = [
            { Item: 'State', Value: currentState, Status: '🟢' },
            { Item: 'Target', Value: hasTarget ? 'YES 🎯' : 'NO 🚫', Status: hasTarget ? '🟢' : '🟡' },
            { Item: 'Memory', Value: memoryCount, Status: memoryCount > 0 ? '🟢' : '🟡' }
        ];

        console.table(statusTable);

        if (hasTarget) {
            const target = this.agent.targetSystem.getTargetEntity();
            const targetName = this._getRecordEntityName(target);
            const visible = this.agent.targetSystem.isTargetVisible();
            this._log(` 	Target: ${targetName} (${visible ? 'visible 👀' : 'hidden 🕵️'})`, 'color: white;');
        }
    }

    console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// FRAME-BY-FRAME DIAGNOSTIC
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.frameByFrameDiagnostic = function() {
    // Disabled to prevent console flooding
    return;
    
    // if (this.frameCount % 60 !== 0) return;

    // const timestamp = new Date().toISOString();
    // console.group(`%c[${timestamp}] [Frame ${this.frameCount}] 🖼️`, 'color: gray; font-weight: bold;');

    // const pos = this.entity.getPosition();
    // const forward = this.entity.forward;
    // const rotation = this.entity.getEulerAngles();

    // const frameTable = [
    //     { Item: 'Position', Value: this._formatVec3(pos) },
    //     { Item: 'Forward', Value: this._formatVec3(forward) },
    //     { Item: 'Rotation', Value: rotation.y.toFixed(1) + '°' },
    //     { Item: 'Obstacles', Value: this.agent.vision ? this.agent.vision.obstacles.length : 0 }
    // ];

    // console.table(frameTable);
    // console.groupEnd();
};

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL DEBUG DRAWING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.drawDebugVisuals = function() {
    if (!this.agent) return;

    const app = this.app;
    const pos = this.entity.getPosition().clone();
    const range = this.agent.visionRange || 25;
    const fovDeg = this.agent.visionAngle || 75;

    const isSynced = this._isForwardSynced();
    const forwardColor = isSynced ? pc.Color.CYAN : pc.Color.RED;

    // --- 🔴 START OF CORRECTION ---

    // CORRECTED: The visual forward is now the entity's ACTUAL forward vector.
    const visualForward = this.entity.forward.clone().normalize();

    // The main cyan/red line now correctly represents the direction the MODEL and ENTITY are facing.
    const fwdEnd = pos.clone().add(visualForward.mulScalar(range));
    app.drawLine(pos, fwdEnd, forwardColor);

    const up = this.entity.up.clone().normalize();
    const halfFov = fovDeg * 0.5;

    const qL = new pc.Quat().setFromAxisAngle(up, -halfFov);
    const qR = new pc.Quat().setFromAxisAngle(up, halfFov);

    const leftDir = new pc.Vec3();
    const rightDir = new pc.Vec3();
    
    // CORRECTED: Rotate the ACTUAL forward vector to get the FOV cone edges.
    qL.transformVector(visualForward, leftDir).normalize();
    qR.transformVector(visualForward, rightDir).normalize();

    const leftEnd = pos.clone().add(leftDir.mulScalar(range));
    const rightEnd = pos.clone().add(rightDir.mulScalar(range));

    app.drawLine(pos, leftEnd, pc.Color.YELLOW);
    app.drawLine(pos, rightEnd, pc.Color.YELLOW);

    if (this.showEnhancedVisuals) {
        // FOV arc
        const segments = 20;
        let prevEnd = leftEnd;
        for (let i = 1; i < segments; i++) {
            const fraction = i / segments;
            const angle = -halfFov + fraction * fovDeg;
            const q = new pc.Quat().setFromAxisAngle(up, angle);
            const dir = new pc.Vec3();
            
            // CORRECTED: Transform the ACTUAL forward for the arc segments.
            q.transformVector(visualForward, dir).normalize();
            const end = pos.clone().add(dir.mulScalar(range));
            app.drawLine(prevEnd, end, new pc.Color(1, 1, 0, 0.5));
            prevEnd = end;
        }
        app.drawLine(prevEnd, rightEnd, new pc.Color(1, 1, 0, 0.5));
    }

    // --- 🔴 END OF CORRECTION ---


    const eyeH = this.agent.visionSystem?.eyeHeight || 1.6;
    const eye = pos.clone().add(new pc.Vec3(0, eyeH, 0));
    app.drawLine(pos, eye, pc.Color.GREEN);

    const ts = this.agent.targetingSystem || this.agent.targetSystem;
    if (ts?.getTargetPosition) {
        const tp = ts.getTargetPosition();
        if (tp) {
            const targetPc = new pc.Vec3(tp.x, tp.y, tp.z);
            const visible = ts.isTargetVisible();
            const targetColor = visible ? pc.Color.GREEN : pc.Color.RED;

            app.drawLine(eye, targetPc, targetColor);

            const markerSize = visible ? 0.8 : 0.5;
            app.drawLine(targetPc.clone().add(new pc.Vec3(-markerSize, 0, 0)), targetPc.clone().add(new pc.Vec3(markerSize, 0, 0)), targetColor);
            app.drawLine(targetPc.clone().add(new pc.Vec3(0, -markerSize, 0)), targetPc.clone().add(new pc.Vec3(0, markerSize, 0)), targetColor);
            app.drawLine(targetPc.clone().add(new pc.Vec3(0, 0, -markerSize)), targetPc.clone().add(new pc.Vec3(0, 0, markerSize)), targetColor);
        }
    }

    if (this.agent.memoryRecords) {
        // ✅ FIX: Limit to 3 most recent memory records to prevent visual clutter
        const recentCount = Math.min(3, this.agent.memoryRecords.length);
        const recentRecords = this.agent.memoryRecords.slice(-recentCount);
        
        for (let record of recentRecords) {
            const memPos = record.lastSensedPosition;
            const memPc = new pc.Vec3(memPos.x, memPos.y, memPos.z);
            const color = record.visible ? pc.Color.GREEN : pc.Color.BLUE;
            const size = 0.3;

            app.drawLine(memPc.clone().add(new pc.Vec3(-size, 0, 0)), memPc.clone().add(new pc.Vec3(size, 0, 0)), color);
            app.drawLine(memPc.clone().add(new pc.Vec3(0, -size, 0)), memPc.clone().add(new pc.Vec3(0, size, 0)), color);
            app.drawLine(memPc.clone().add(new pc.Vec3(0, 0, -size)), memPc.clone().add(new pc.Vec3(0, 0, size)), color);
        }
    }

    if (this.showEnhancedVisuals) {
        this._drawDebugSphere(app, pos, 0.5, pc.Color.WHITE);
    }

    // Magenta line: Represents the YUKA vehicle's forward vector (should match PlayCanvas forward).
    const yukaFwd3D = this._getYukaForwardAsPc().normalize();
    app.drawLine(pos, pos.clone().add(yukaFwd3D.mulScalar(3)), pc.Color.MAGENTA);

    // White line: Represents the PlayCanvas entity's actual forward vector (-Z axis).
    // This should be pointing out of the model's back.
    const pcEntityForward = this.entity.forward.clone().normalize();
    app.drawLine(pos, pos.clone().add(pcEntityForward.mulScalar(3)), pc.Color.WHITE);
};

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG SPHERE DRAWING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._drawDebugSphere = function(app, center, radius, color) {
    const segments = 16;

    // XY plane (vertical circle)
    for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        
        const p1 = center.clone().add(new pc.Vec3(Math.cos(theta1) * radius, Math.sin(theta1) * radius, 0));
        const p2 = center.clone().add(new pc.Vec3(Math.cos(theta2) * radius, Math.sin(theta2) * radius, 0));
        
        app.drawLine(p1, p2, color);
    }

    // XZ plane (horizontal circle)
    for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        
        const p1 = center.clone().add(new pc.Vec3(Math.cos(theta1) * radius, 0, Math.sin(theta1) * radius));
        const p2 = center.clone().add(new pc.Vec3(Math.cos(theta2) * radius, 0, Math.sin(theta2) * radius));
        
        app.drawLine(p1, p2, color);
    }

    // YZ plane (vertical circle)
    for (let i = 0; i < segments; i++) {
        const theta1 = (i / segments) * Math.PI * 2;
        const theta2 = ((i + 1) / segments) * Math.PI * 2;
        
        const p1 = center.clone().add(new pc.Vec3(0, Math.cos(theta1) * radius, Math.sin(theta1) * radius));
        const p2 = center.clone().add(new pc.Vec3(0, Math.cos(theta2) * radius, Math.sin(theta2) * radius));
        
        app.drawLine(p1, p2, color);
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// YUKA TO PLAYCANVAS FORWARD CONVERSION
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._getYukaForwardAsPc = function() {
    try {
        const veh = this.agent?.yukaVehicle;
        if (veh?.forward) {
            const vf = veh.forward;
            return new pc.Vec3(vf.x, vf.y, -vf.z);
        }
    } catch (e) {
        // Silent fail
    }
    return this.entity?.forward?.clone() || new pc.Vec3(0, 0, -1);
};

// ═══════════════════════════════════════════════════════════════════════════
// FORWARD SYNC CHECK
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._isForwardSynced = function() {
    if (!this.agent.yukaVehicle) return false;

    const pcForward = this.entity.forward;
    const yukaForward = this.agent.yukaVehicle.forward;

    const expectedYukaX = pcForward.x;
    const expectedYukaY = pcForward.y;
    const expectedYukaZ = -pcForward.z;

    const diffX = Math.abs(yukaForward.x - expectedYukaX);
    const diffY = Math.abs(yukaForward.y - expectedYukaY);
    const diffZ = Math.abs(yukaForward.z - expectedYukaZ);
    
    // ✅ FIX: Calculate total difference magnitude for more accurate checking
    const totalDiff = Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);

    // ✅ FIX: Use more tolerant threshold - account for floating point precision
    // Small differences (< 0.1) are acceptable and don't indicate sync failure
    return totalDiff < 0.1;
};

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._getDashboardSummary = function() {
    return [
        { Category: 'Entity', Status: this.agent.__aiAgentInitialized ? '🟢 Ready' : '🔴 Not Ready' },
        { Category: 'Vision', Status: this.agent.vision ? '🟢 Active' : '🔴 Missing' },
        { Category: 'Memory', Status: this.agent.memorySystem ? '🟢' : '🔴', Value: this.agent.memoryRecords ? this.agent.memoryRecords.length : 0 },
        { Category: 'Target', Status: this.agent.targetingSystem ? '🟢' : '🔴', Value: this.agent.targetingSystem?.hasTarget() ? 'Has Target 🎯' : 'No Target' },
        { Category: 'Combat', Status: this.agent.combatSystem ? '🟢' : '🔴' },
        { Category: 'Brain', Status: this.agent.brain ? '🟢' : '🔴' },
        { Category: 'Navigation', Status: this.agent.navigationReady ? '🟢' : '🔴' }
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER METHODS - LOGGING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._log = function(message, style = '') {
    console.log(style ? `%c${message}` : message, style);
};

AiAgentDebugger.prototype._logHeader = function(message) {
    this._log('═══════════════════════════════════════════════════════════════', 'color: blue; font-weight: bold;');
    this._log(`   ${message}`, 'color: blue; font-weight: bold;');
    this._log('═══════════════════════════════════════════════════════════════\n', 'color: blue; font-weight: bold;');
};

AiAgentDebugger.prototype._logSection = function(message) {
    this._log(`▼ ${message}`, 'color: cyan; font-weight: bold;');
    this._log('───────────────────────────────────────────────────────────────', 'color: cyan;');
};

AiAgentDebugger.prototype._logSubSection = function(message) {
    this._log(`\n${message}`, 'color: magenta; font-weight: bold;');
    this._log('───────────────────────────────────────────────────────────────', 'color: magenta;');
};

AiAgentDebugger.prototype._logSeparator = function() {
    this._log('═══════════════════════════════════════════════════════════════\n', 'color: gray;');
};

AiAgentDebugger.prototype._logError = function(message) {
    console.error(`%c❌ ${message}`, 'color: red; font-weight: bold;');
};

AiAgentDebugger.prototype._logWarn = function(message) {
    console.warn(`%c⚠️ ${message}`, 'color: orange; font-weight: bold;');
};

AiAgentDebugger.prototype._logSuccess = function(message) {
    this._log(`✅ ${message}`, 'color: green; font-weight: bold;');
};

AiAgentDebugger.prototype._logInfo = function(message) {
    this._log(`ℹ️ ${message}`, 'color: blue; font-weight: bold;');
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER METHODS - FORMATTING
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype._formatVec3 = function(vec) {
    return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`;
};

AiAgentDebugger.prototype._formatYukaVec3 = function(vec) {
    return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`;
};

AiAgentDebugger.prototype._getRecordEntityName = function(record) {
    if (!record) return 'Unknown';
    if (record.entity?.name) return record.entity.name;
    if (record.entity?.getName) return record.entity.getName();
    if (record.name) return record.name;
    if (record.entityId) return `Entity_${record.entityId}`;
    return 'Unknown Entity';
};

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════
AiAgentDebugger.prototype.destroy = function() {
    if (this.app?.keyboard) {
        this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    }
};

