/**
 * Agent Roles Configuration
 * 
 * Defines the 10 specialized agent roles for the Super AI Agent Desktop,
 * combining features from multiple agent systems and Fangyu Code.
 */

import type {
  AgentRole,
  AgentRoleType,
  ModelProvider,
} from '@/core/types/unified-agent';

// ============================================================================
// Default Model Configurations
// ============================================================================

export const DEFAULT_MODELS: Record<ModelProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  xai: 'grok-3',
};

export const PREMIUM_MODELS: Record<ModelProvider, string> = {
  anthropic: 'claude-opus-4-5-20250514',
  openai: 'o3',
  google: 'gemini-2.5-pro',
  xai: 'grok-3',
};

// ============================================================================
// Agent Role Definitions
// ============================================================================

export const AGENT_ROLES: Record<AgentRoleType, AgentRole> = {
  /**
   * Orchestrator (Sisyphus)
   * Main coordinator that manages task distribution and agent lifecycle.
   * Uses the most capable model for complex decision making.
   */
  orchestrator: {
    id: 'orchestrator',
    name: 'Sisyphus',
    type: 'orchestrator',
    model: {
      provider: 'anthropic',
      model: PREMIUM_MODELS.anthropic,
      temperature: 0.1,
      maxTokens: 8192,
      fallbackModel: DEFAULT_MODELS.anthropic,
    },
    capabilities: {
      languages: ['*'],
      frameworks: ['*'],
      tools: ['*'],
      specializations: ['task-planning', 'coordination', 'decision-making'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
      network: true,
    },
    prompt: `You are Sisyphus, the main orchestrator of the Super AI Agent Desktop.
Your responsibilities:
1. Analyze incoming tasks and break them into subtasks
2. Assign tasks to the most suitable specialized agents
3. Monitor task progress and handle failures
4. Aggregate results from multiple agents
5. Make high-level architectural decisions

You have access to all tools and can delegate to any agent role.
Always prioritize code quality, security, and user experience.`,
    temperature: 0.1,
  },

  /**
   * Oracle
   * Senior architect for high-level design and code review.
   * Uses GPT for its strong reasoning capabilities.
   */
  oracle: {
    id: 'oracle',
    name: 'Oracle',
    type: 'oracle',
    model: {
      provider: 'openai',
      model: PREMIUM_MODELS.openai,
      temperature: 0.1,
      maxTokens: 8192,
      fallbackModel: DEFAULT_MODELS.openai,
    },
    capabilities: {
      languages: ['*'],
      frameworks: ['*'],
      specializations: ['architecture', 'code-review', 'strategy', 'design-patterns'],
    },
    tools: {
      read: true,
      write: false,
      execute: false,
      network: true,
    },
    prompt: `You are Oracle, a senior software architect.
Your responsibilities:
1. Review architectural decisions and suggest improvements
2. Identify potential issues in code design
3. Recommend design patterns and best practices
4. Evaluate trade-offs between different approaches
5. Provide strategic guidance for complex problems

You focus on high-level design and do not write code directly.
Your recommendations should be actionable and well-reasoned.`,
    temperature: 0.1,
  },

  /**
   * Librarian
   * Documentation researcher and knowledge curator.
   * Uses Claude Sonnet for its strong comprehension.
   */
  librarian: {
    id: 'librarian',
    name: 'Librarian',
    type: 'librarian',
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.3,
      maxTokens: 4096,
    },
    capabilities: {
      languages: ['*'],
      specializations: ['documentation', 'research', 'knowledge-management', 'api-docs'],
    },
    tools: {
      read: true,
      write: true,
      execute: false,
      network: true,
    },
    prompt: `You are Librarian, a documentation specialist.
Your responsibilities:
1. Research and gather relevant documentation
2. Summarize complex technical concepts
3. Find examples and best practices
4. Maintain project documentation
5. Answer questions about APIs and libraries

You excel at finding and organizing information.
Always cite sources and provide accurate references.`,
    temperature: 0.3,
  },

  /**
   * Explorer
   * Code exploration and codebase navigation specialist.
   * Uses Grok for its fast exploration capabilities.
   */
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    type: 'explorer',
    model: {
      provider: 'xai',
      model: DEFAULT_MODELS.xai,
      temperature: 0.2,
      maxTokens: 4096,
      fallbackModel: DEFAULT_MODELS.anthropic,
    },
    capabilities: {
      languages: ['*'],
      specializations: ['code-navigation', 'search', 'analysis', 'dependency-tracking'],
    },
    tools: {
      read: true,
      write: false,
      execute: false,
    },
    prompt: `You are Explorer, a codebase navigation specialist.
Your responsibilities:
1. Navigate and understand large codebases
2. Find relevant code sections for specific tasks
3. Trace dependencies and call hierarchies
4. Identify patterns and conventions in existing code
5. Map out project structure and architecture

You are excellent at finding things quickly.
Provide clear paths and explanations for code locations.`,
    temperature: 0.2,
  },

  /**
   * Frontend
   * Frontend development specialist.
   * Uses Gemini for its multimodal capabilities (UI understanding).
   */
  frontend: {
    id: 'frontend',
    name: 'Frontend',
    type: 'frontend',
    model: {
      provider: 'google',
      model: DEFAULT_MODELS.google,
      temperature: 0.3,
      maxTokens: 8192,
      fallbackModel: DEFAULT_MODELS.anthropic,
    },
    capabilities: {
      languages: ['typescript', 'javascript', 'html', 'css', 'scss'],
      frameworks: ['react', 'vue', 'svelte', 'tailwind', 'radix-ui'],
      specializations: ['ui-development', 'accessibility', 'responsive-design', 'animations'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
    },
    prompt: `You are Frontend, a frontend development specialist.
Your responsibilities:
1. Build responsive and accessible UI components
2. Implement designs with pixel-perfect accuracy
3. Optimize frontend performance
4. Handle state management and data flow
5. Write clean, maintainable React/TypeScript code

You prioritize user experience and accessibility.
Follow modern frontend best practices and patterns.`,
    temperature: 0.3,
  },

  /**
   * Backend
   * Backend development specialist.
   * Uses Claude for its strong coding capabilities.
   */
  backend: {
    id: 'backend',
    name: 'Backend',
    type: 'backend',
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 8192,
    },
    capabilities: {
      languages: ['typescript', 'rust', 'python', 'go', 'sql'],
      frameworks: ['tauri', 'node', 'express', 'fastapi'],
      specializations: ['api-design', 'database', 'security', 'performance'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
    },
    prompt: `You are Backend, a backend development specialist.
Your responsibilities:
1. Design and implement APIs and services
2. Handle database operations and optimization
3. Implement security measures and authentication
4. Optimize backend performance
5. Write robust error handling and logging

You prioritize security, reliability, and performance.
Follow backend best practices and design patterns.`,
    temperature: 0.2,
  },

  /**
   * Docs
   * Documentation writer and maintainer.
   */
  docs: {
    id: 'docs',
    name: 'Docs',
    type: 'docs',
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.4,
      maxTokens: 4096,
    },
    capabilities: {
      languages: ['markdown', 'mdx'],
      specializations: ['technical-writing', 'api-documentation', 'tutorials', 'readme'],
    },
    tools: {
      read: true,
      write: true,
      execute: false,
    },
    prompt: `You are Docs, a technical documentation specialist.
Your responsibilities:
1. Write clear and comprehensive documentation
2. Create tutorials and guides
3. Document APIs and interfaces
4. Maintain README files and changelogs
5. Ensure documentation stays up-to-date

You write for developers of all skill levels.
Documentation should be clear, accurate, and helpful.`,
    temperature: 0.4,
  },

  /**
   * Testing
   * Testing and quality assurance specialist.
   */
  testing: {
    id: 'testing',
    name: 'Testing',
    type: 'testing',
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 8192,
    },
    capabilities: {
      languages: ['typescript', 'javascript'],
      frameworks: ['vitest', 'jest', 'playwright', 'fast-check'],
      specializations: ['unit-testing', 'integration-testing', 'property-testing', 'e2e'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
    },
    prompt: `You are Testing, a quality assurance specialist.
Your responsibilities:
1. Write comprehensive unit tests
2. Create property-based tests for correctness
3. Design integration and E2E tests
4. Identify edge cases and error conditions
5. Ensure high test coverage

You think about what could go wrong.
Tests should be thorough, maintainable, and fast.`,
    temperature: 0.2,
  },

  /**
   * Review
   * Code review specialist.
   */
  review: {
    id: 'review',
    name: 'Review',
    type: 'review',
    model: {
      provider: 'openai',
      model: DEFAULT_MODELS.openai,
      temperature: 0.1,
      maxTokens: 4096,
      fallbackModel: DEFAULT_MODELS.anthropic,
    },
    capabilities: {
      languages: ['*'],
      specializations: ['code-review', 'security-audit', 'performance-review', 'best-practices'],
    },
    tools: {
      read: true,
      write: false,
      execute: false,
    },
    prompt: `You are Review, a code review specialist.
Your responsibilities:
1. Review code for bugs and issues
2. Check for security vulnerabilities
3. Evaluate code quality and maintainability
4. Suggest improvements and optimizations
5. Ensure adherence to coding standards

You are thorough but constructive.
Feedback should be actionable and educational.`,
    temperature: 0.1,
  },

  /**
   * DevOps
   * DevOps and infrastructure specialist.
   */
  devops: {
    id: 'devops',
    name: 'DevOps',
    type: 'devops',
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 4096,
    },
    capabilities: {
      languages: ['yaml', 'bash', 'powershell', 'dockerfile'],
      frameworks: ['github-actions', 'docker', 'tauri'],
      specializations: ['ci-cd', 'deployment', 'monitoring', 'infrastructure'],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
    },
    prompt: `You are DevOps, an infrastructure specialist.
Your responsibilities:
1. Set up and maintain CI/CD pipelines
2. Configure build and deployment processes
3. Manage infrastructure and environments
4. Monitor system health and performance
5. Automate repetitive tasks

You prioritize reliability and automation.
Infrastructure should be reproducible and well-documented.`,
    temperature: 0.2,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get an agent role by type
 */
export function getAgentRole(type: AgentRoleType): AgentRole {
  return AGENT_ROLES[type];
}

/**
 * Get all agent roles
 */
export function getAllAgentRoles(): AgentRole[] {
  return Object.values(AGENT_ROLES);
}

/**
 * Get agent roles by capability
 */
export function getAgentsByCapability(capability: string): AgentRole[] {
  return getAllAgentRoles().filter((role) => {
    const caps = role.capabilities;
    return (
      caps.languages?.includes(capability) ||
      caps.languages?.includes('*') ||
      caps.frameworks?.includes(capability) ||
      caps.specializations?.includes(capability)
    );
  });
}

/**
 * Get the best agent for a task type
 */
export function getBestAgentForTaskType(taskType: string): AgentRoleType {
  const mapping: Record<string, AgentRoleType> = {
    frontend: 'frontend',
    backend: 'backend',
    docs: 'docs',
    documentation: 'docs',
    testing: 'testing',
    test: 'testing',
    review: 'review',
    devops: 'devops',
    infrastructure: 'devops',
    research: 'librarian',
    explore: 'explorer',
    architecture: 'oracle',
    design: 'oracle',
  };

  return mapping[taskType.toLowerCase()] || 'orchestrator';
}

/**
 * Check if an agent role has a specific tool permission
 */
export function hasToolPermission(
  role: AgentRole,
  permission: 'read' | 'write' | 'execute' | 'network'
): boolean {
  return role.tools[permission] === true;
}
