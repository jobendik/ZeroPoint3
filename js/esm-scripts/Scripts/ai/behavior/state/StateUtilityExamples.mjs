import { Logger } from '../../../core/engine/logger.mjs';
import { StateUtilitySystem } from './StateUtilitySystem.mjs';

// ============================================================================
// EXAMPLE USAGE: Getting State Scores
// ============================================================================
function exampleGetScores(agent) {
    // Get all state scores
    const scores = agent.stateChangeManager.utilitySystem.calculateAllScores();
    Logger.debug('Current State Scores:');
    Logger.debug('--------------------');
    Logger.debug(`Flee:        ${scores.flee.toFixed(2)}`);
    Logger.debug(`Combat:      ${scores.combat.toFixed(2)}`);
    Logger.debug(`Seek Health: ${scores.seekHealth.toFixed(2)}`);
    Logger.debug(`Seek Ammo:   ${scores.seekAmmo.toFixed(2)}`);
    Logger.debug(`Alert:       ${scores.alert.toFixed(2)}`);
    Logger.debug(`Patrol:      ${scores.patrol.toFixed(2)}`);
    Logger.debug(`Investigate: ${scores.investigate.toFixed(2)}`);
// Output might look like:
// Current State Scores:
// --------------------
// Flee:        0.85  ← Highest (agent should flee)
// Combat:      0.32
// Seek Health: 0.70
// Seek Ammo:   0.20
// Alert:       0.15
// Patrol:      0.10
// Investigate: 0.00
}
// ============================================================================
// EXAMPLE USAGE: Manual State Selection
// ============================================================================
function exampleManualSelection(agent) {
    // Get best state recommendation
    const result = agent.stateChangeManager.getBestStateByUtility();
    Logger.debug(`Recommended state: ${result.state}`);
    Logger.debug(`Score: ${result.score.toFixed(2)}`);
    Logger.debug(`Runner-up: ${result.runner_up.state} (${result.runner_up.score.toFixed(2)})`);
    // Apply custom logic before transitioning
    if (result.state === 'flee' && someCustomCondition) {
        // Override utility system decision
        agent.stateChangeManager.changeToState('combat', {
            forced: true
        });
    } else {
        // Use utility system recommendation
        agent.stateChangeManager.changeToState(result.state);
    }
}
// ============================================================================
// EXAMPLE USAGE: Debug Mode
// ============================================================================
function exampleDebugMode(agent) {
    // Enable verbose logging to see all scores
    agent.stateChangeManager.evaluateAndTransition({
        debug: true
    });
// Console output:
// [Agent_abc123] State scores: flee:0.85, seekHealth:0.70, combat:0.32, seekAmmo:0.20, alert:0.15, patrol:0.10, investigate:0.00
// [Agent_abc123] Utility-driven transition: combat → flee (score: 0.85)
// [Agent_abc123] Runner-up: seekHealth (score: 0.70)
}
// ============================================================================
// EXAMPLE: Comparing Before/After Complexity
// ============================================================================
function complexityComparison() {
    Logger.debug('=== COMPLEXITY COMPARISON ===\n');
    Logger.debug('BEFORE (Nested Conditionals):');
    Logger.debug('- 150+ lines of nested if/else');
    Logger.debug('- 8 levels of nesting');
    Logger.debug('- Logic scattered across multiple states');
    Logger.debug('- Hard to add new states');
    Logger.debug('- Hard to debug why state didn\'t change\n');
    Logger.debug('AFTER (Utility-Based):');
    Logger.debug('- 1 line: evaluateAndTransition()');
    Logger.debug('- 0 levels of nesting');
    Logger.debug('- Logic centralized in StateUtilitySystem');
    Logger.debug('- Easy to add new states (just add desirability function)');
    Logger.debug('- Easy to debug (inspect scores object)');
}
// ============================================================================
// EXAMPLE: Real-World Scenario
// ============================================================================
function simulateRealScenario() {
    Logger.debug('=== SIMULATED COMBAT SCENARIO ===\n');
    // Scenario: Agent in combat, taking damage
    const mockAgent = {
        health: 20,
        maxHealth: 100,
        targetSystem: {
            hasTarget: ()=>true,
            isTargetVisible: ()=>true
        },
        utilities: {
            hasUsableAmmo: ()=>true
        }
    };
    const utility = new StateUtilitySystem(mockAgent);
    const scores = utility.calculateAllScores();
    Logger.debug('Agent Status:');
    Logger.debug(`- Health: ${mockAgent.health}/${mockAgent.maxHealth} (${(mockAgent.health / mockAgent.maxHealth * 100).toFixed(0)}%)`);
    Logger.debug(`- Target: Visible`);
    Logger.debug(`- Ammo: Available\n`);
    Logger.debug('State Desirability Scores:');
    Object.entries(scores).sort((a, b)=>b[1] - a[1]).forEach(([state, score])=>{
        const bar = '█'.repeat(Math.floor(score * 20));
        Logger.debug(`${state.padEnd(12)} ${score.toFixed(2)} ${bar}`);
    });
// Expected output:
// State Desirability Scores:
// flee         0.95 ███████████████████
// seekHealth   0.70 ██████████████
// combat       0.32 ██████
// alert        0.20 ████
// patrol       0.15 ███
// seekAmmo     0.10 ██
// investigate  0.00
//
// Decision: FLEE (score 0.95)
}

export { complexityComparison, exampleDebugMode, exampleGetScores, exampleManualSelection, simulateRealScenario };
