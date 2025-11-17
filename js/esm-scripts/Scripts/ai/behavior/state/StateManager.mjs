import { StateChangeManager } from './StateTransition.mjs';
import { PatrolState, AlertState, CombatState, InvestigateState, FleeState, SeekHealthState, SeekAmmoState, AIStates } from './StateCore.mjs';
import { Logger } from '../../../core/engine/logger.mjs';

/*
CONTRACT: FACADE - AI State Management System (ESM Module)
DOMAIN: AI_BEHAVIOR_STATE
DEPENDENCIES: ['./StateCore.mjs', './StateTransition.mjs', './StateEvents.mjs']
EXPORTS: ['StateManager', 'AIStates', 'StateChangeManager', 'PatrolState', 'AlertState', 'CombatState', 'InvestigateState', 'FleeState', 'SeekHealthState', 'SeekAmmoState'] 
GPT_CONTEXT: ESM module facade for AI state management system that maintains exact same public API as original monolithic StateManager for complete backward compatibility. Coordinates between StateCore (state behaviors), StateTransition (transition logic), and StateEvents (logging/events). Used by AI agents throughout the system via aiAgent.mjs and other AI components. This facade ensures no breaking changes while providing clean modular architecture underneath.
*/ // Import from refactored modules
// Export default object exactly as original for backward compatibility
var StateManager = {
    StateChangeManager,
    PatrolState,
    AlertState,
    CombatState,
    InvestigateState,
    FleeState,
    SeekHealthState,
    SeekAmmoState,
    AIStates
};
Logger.info('✅ StateManager.mjs (FACADE) loaded - Refactored from monolithic file to 4 modular files with full backward compatibility');

export { AIStates, AlertState, CombatState, FleeState, InvestigateState, PatrolState, SeekAmmoState, SeekHealthState, StateChangeManager, StateManager as default };
