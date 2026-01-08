/**
 * Super AI Agent Desktop - Core Module Exports
 * 
 * 统一导出所有核心模块
 */

// =============================================================================
// Agents
// =============================================================================
export {
  AGENT_ROLES,
  DEFAULT_MODELS,
  PREMIUM_MODELS,
  getAgentRole,
  getAllAgentRoles,
  getAgentsByCapability,
  getBestAgentForTaskType,
  hasToolPermission,
} from './agents/AgentRoles';
export { UnifiedAgentOrchestrator } from './agents/UnifiedAgentOrchestrator';
export { BackgroundAgentManager } from './agents/BackgroundAgentManager';
export { TaskQueue } from './agents/TaskQueue';

// =============================================================================
// Hooks
// =============================================================================
export { EnhancedHookEngine } from './hooks/EnhancedHookEngine';
export { SteeringLoader } from './hooks/SteeringLoader';
export { ClaudeCodeCompat } from './hooks/ClaudeCodeCompat';

// =============================================================================
// Context
// =============================================================================
export { SmartContextManager } from './context/SmartContextManager';
export { ReferenceResolver } from './context/ReferenceResolver';

// =============================================================================
// Tools
// =============================================================================
export { IDEToolchain } from './tools/IDEToolchain';
export { PowersManager } from './tools/PowersManager';
export { ASTGrepTools } from './tools/ASTGrepTools';
export { LSPTools } from './tools/LSPTools';

// =============================================================================
// Security
// =============================================================================
export { SecurityGuard } from './security/SecurityGuard';

// =============================================================================
// Process
// =============================================================================
export { ProcessManager } from './process/ProcessManager';

// =============================================================================
// Files
// =============================================================================
export { PreciseFileOps } from './files/PreciseFileOps';

// =============================================================================
// Spec
// =============================================================================
export { SpecExecutor } from './spec/SpecExecutor';

// =============================================================================
// Models
// =============================================================================
export { ModelRouter } from './models/ModelRouter';

// =============================================================================
// Autonomy
// =============================================================================
export { AutonomyController } from './autonomy/AutonomyController';

// =============================================================================
// Tauri Bridge
// =============================================================================
export { SuperAgentBridge } from './tauri/SuperAgentBridge';

// =============================================================================
// Types
// =============================================================================
export * from './types/unified-agent';
