/**
 * Target Acquisition Verifier
 * Quick diagnostic to verify AI can detect and target the player
 * 
 * Usage: Press F7 to run verification
 */

var TargetAcquisitionVerifier = pc.createScript('targetAcquisitionVerifier');

TargetAcquisitionVerifier.prototype.initialize = function() {
    console.log('🎯 Target Acquisition Verifier loaded - Press F7 to verify fix');
    
    this.app.keyboard.on(pc.EVENT_KEYDOWN, (event) => {
        if (event.key === pc.KEY_F7) {
            this.verifyTargetAcquisition();
        }
    });
    
    // Auto-run after delay
    setTimeout(() => {
        console.log('🎯 Auto-verifying target acquisition...');
        this.verifyTargetAcquisition();
    }, 6000);
};

TargetAcquisitionVerifier.prototype.verifyTargetAcquisition = function() {
    console.log('\n========== TARGET ACQUISITION VERIFICATION ==========');
    
    // Find player
    const player = this.findPlayer();
    if (!player) {
        console.error('❌ FAILED: Player not found!');
        console.log('========== VERIFICATION FAILED ==========\n');
        return;
    }
    
    console.log('✅ Player found:', player.name);
    
    // Check player team setup
    const playerTeam = player.team || 'NONE';
    const playerTags = player.tags ? Array.from(player.tags.list()).join(', ') : 'NONE';
    
    console.log('\n--- Player Team Setup ---');
    console.log(`Team: ${playerTeam}`);
    console.log(`Tags: ${playerTags}`);
    
    const hasPlayerTag = player.tags && player.tags.has('player');
    const hasTeamPlayerTag = player.tags && player.tags.has('team_player');
    const hasDamageableTag = player.tags && player.tags.has('damageable');
    
    console.table([
        { Check: 'Has "player" tag', Status: hasPlayerTag ? '✅ PASS' : '❌ FAIL' },
        { Check: 'Has "team_player" tag', Status: hasTeamPlayerTag ? '✅ PASS' : '❌ FAIL' },
        { Check: 'Has "damageable" tag', Status: hasDamageableTag ? '✅ PASS' : '❌ FAIL' },
        { Check: 'Team property set', Status: playerTeam !== 'NONE' ? '✅ PASS' : '❌ FAIL' }
    ]);
    
    // Find AI agents
    const aiAgents = this.findAIAgents();
    if (aiAgents.length === 0) {
        console.warn('⚠️ WARNING: No AI agents found (may not be spawned yet)');
        console.log('========== VERIFICATION INCOMPLETE ==========\n');
        return;
    }
    
    console.log(`\n✅ Found ${aiAgents.length} AI agent(s)`);
    
    // Check each AI agent
    let successCount = 0;
    aiAgents.forEach((ai, index) => {
        console.log(`\n--- AI Agent ${index + 1}: "${ai.name}" ---`);
        
        const aiTeam = ai.team || 'NONE';
        const aiTags = ai.tags ? Array.from(ai.tags.list()).join(', ') : 'NONE';
        
        console.log(`Team: ${aiTeam}`);
        console.log(`Tags: ${aiTags}`);
        
        // Check team setup
        const hasAITag = ai.tags && (ai.tags.has('ai') || ai.tags.has('ai_agent'));
        const hasTeamAITag = ai.tags && ai.tags.has('team_ai');
        const teamDifferent = aiTeam !== playerTeam;
        
        const checks = [
            { Check: 'Has AI tag', Status: hasAITag ? '✅ PASS' : '❌ FAIL' },
            { Check: 'Has "team_ai" tag', Status: hasTeamAITag ? '✅ PASS' : '❌ FAIL' },
            { Check: 'Different team from player', Status: teamDifferent ? '✅ PASS' : '❌ FAIL' }
        ];
        
        // Check targeting system
        const aiScript = ai.script && ai.script.aiAgent;
        if (aiScript) {
            const targetSystem = aiScript.targetingSystem || aiScript.targetSystem;
            const visionSystem = aiScript.visionSystem;
            const hasTarget = targetSystem && targetSystem.hasTarget && targetSystem.hasTarget();
            const currentTarget = hasTarget ? targetSystem.getTargetEntity() : null;
            const targetName = currentTarget ? this.getTargetName(currentTarget) : 'None';
            
            checks.push(
                { Check: 'Vision system exists', Status: visionSystem ? '✅ PASS' : '❌ FAIL' },
                { Check: 'Targeting system exists', Status: targetSystem ? '✅ PASS' : '❌ FAIL' },
                { Check: 'Has target', Status: hasTarget ? '✅ PASS' : '⚠️ PENDING' },
                { Check: 'Target is Player', Status: targetName === 'Player' ? '✅ PASS' : '⚠️ PENDING' }
            );
            
            if (hasTarget && targetName === 'Player') {
                successCount++;
            }
        } else {
            checks.push({ Check: 'AI Script exists', Status: '❌ FAIL' });
        }
        
        console.table(checks);
        
        const allPass = checks.every(c => c.Status.includes('✅'));
        const hasPending = checks.some(c => c.Status.includes('⚠️'));
        
        if (allPass) {
            console.log('🎉 AI agent fully operational and targeting player!');
        } else if (hasPending) {
            console.log('⏳ AI agent configured correctly, waiting for target acquisition...');
        } else {
            console.log('❌ AI agent has configuration issues');
        }
    });
    
    // Final result
    console.log('\n========== VERIFICATION RESULT ==========');
    
    const playerConfigured = hasPlayerTag && hasTeamPlayerTag && playerTeam !== 'NONE';
    
    if (playerConfigured && successCount === aiAgents.length) {
        console.log('🎉 SUCCESS! All AI agents can target the player!');
    } else if (playerConfigured && successCount > 0) {
        console.log(`✅ PARTIAL SUCCESS: ${successCount}/${aiAgents.length} AI agents targeting player`);
        console.log('⏳ Others may acquire target once player enters vision range');
    } else if (playerConfigured) {
        console.log('⏳ PENDING: Player configured correctly, waiting for AI to acquire target');
        console.log('   (Player may need to move into AI vision range)');
    } else {
        console.error('❌ FAILED: Player team/tags not configured correctly!');
        console.log('   Fix required in Scripts/player/core/player.mjs');
    }
    
    console.log('========== VERIFICATION COMPLETE ==========\n');
};

TargetAcquisitionVerifier.prototype.findPlayer = function() {
    // Method 1: Check app.gameManager
    if (this.app.gameManager && this.app.gameManager.player) {
        return this.app.gameManager.player.entity;
    }
    
    // Method 2: Find by script
    const playerScripts = this.app.root.findComponents('script');
    for (let script of playerScripts) {
        if (script.player || script.playerController) {
            return script.entity;
        }
    }
    
    // Method 3: Find by tag
    const allEntities = [];
    this.app.root.find(function(entity) {
        allEntities.push(entity);
        return false;
    });
    
    for (let entity of allEntities) {
        if (entity.tags && entity.tags.has('player')) {
            return entity;
        }
    }
    
    return null;
};

TargetAcquisitionVerifier.prototype.findAIAgents = function() {
    const agents = [];
    const allEntities = [];
    
    this.app.root.find(function(entity) {
        allEntities.push(entity);
        return false;
    });
    
    for (let entity of allEntities) {
        if (entity.script && entity.script.aiAgent) {
            agents.push(entity);
        }
    }
    
    return agents;
};

TargetAcquisitionVerifier.prototype.getTargetName = function(record) {
    if (!record) return 'None';
    
    try {
        // Try to extract entity from memory record
        if (record.entity && record.entity.agent && record.entity.agent.entity) {
            return record.entity.agent.entity.name || 'Unknown';
        }
        if (record.entity && record.entity.entity) {
            return record.entity.entity.name || 'Unknown';
        }
        if (record.entity && record.entity.name) {
            return record.entity.name;
        }
    } catch (e) {}
    
    return 'Unknown';
};
