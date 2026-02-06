/**
 * Enhanced Agent Roles - 增强的代理角色
 *
 * 扩展现有的代理系统，添加专门的代理：
 * - CodeGenerator: 专门的代码生成代理
 * - TestWriter: 专门的测试编写代理
 * - Deployer: 专门的部署执行代理
 * - Monitor: 专门的监控集成代理
 * - SpecAnalyzer: 规范分析代理
 *
 * 这些代理与现有的 10 个代理协同工作，形成完整的 Agentic 协作系统
 */

import type {
  AgentRole,
  AgentRoleType,
} from '@/core/types/unified-agent';
import { DEFAULT_MODELS, PREMIUM_MODELS } from './AgentRoles';

// 扩展的代理角色类型
export type EnhancedAgentRoleType =
  | AgentRoleType
  | 'code-generator'
  | 'test-writer'
  | 'deployer'
  | 'monitor'
  | 'spec-analyzer';

// 增强的代理角色定义
export const ENHANCED_AGENT_ROLES: Record<string, AgentRole> = {
  /**
   * CodeGenerator
   * 专门的代码生成代理，基于规范生成高质量代码
   */
  'code-generator': {
    id: 'code-generator',
    name: 'CodeGenerator',
    type: 'code-generator' as any,
    model: {
      provider: 'anthropic',
      model: PREMIUM_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 16384,
      fallbackModel: DEFAULT_MODELS.anthropic,
    },
    capabilities: {
      languages: ['typescript', 'javascript', 'rust', 'python', 'go', 'java'],
      frameworks: ['react', 'vue', 'tauri', 'node', 'express', 'fastapi'],
      specializations: [
        'code-generation',
        'pattern-implementation',
        'api-implementation',
        'component-creation',
      ],
    },
    tools: {
      read: true,
      write: true,
      execute: false,
      network: false,
    },
    prompt: `You are CodeGenerator, a specialized code generation agent.
Your responsibilities:
1. Generate high-quality code based on technical specifications
2. Implement design patterns and best practices
3. Create well-structured, maintainable code
4. Follow project conventions and coding standards
5. Add appropriate comments and documentation
6. Ensure type safety and error handling

You receive structured specifications and produce production-ready code.
Focus on code quality, readability, and maintainability.
Always consider edge cases and error scenarios.`,
    temperature: 0.2,
  },

  /**
   * TestWriter
   * 专门的测试编写代理，为代码生成全面的测试
   */
  'test-writer': {
    id: 'test-writer',
    name: 'TestWriter',
    type: 'test-writer' as any,
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 8192,
    },
    capabilities: {
      languages: ['typescript', 'javascript', 'python', 'rust'],
      frameworks: ['vitest', 'jest', 'playwright', 'pytest', 'fast-check'],
      specializations: [
        'test-generation',
        'unit-testing',
        'integration-testing',
        'property-testing',
        'test-coverage',
      ],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
      network: false,
    },
    prompt: `You are TestWriter, a specialized test generation agent.
Your responsibilities:
1. Generate comprehensive test suites for code
2. Write unit tests for individual functions and components
3. Create integration tests for system interactions
4. Design property-based tests for correctness
5. Ensure high test coverage (>80%)
6. Test edge cases and error conditions

You analyze code and specifications to create thorough test suites.
Tests should be fast, reliable, and maintainable.
Always test both happy paths and error scenarios.`,
    temperature: 0.2,
  },

  /**
   * Deployer
   * 专门的部署执行代理，处理构建和部署流程
   */
  deployer: {
    id: 'deployer',
    name: 'Deployer',
    type: 'deployer' as any,
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.1,
      maxTokens: 4096,
    },
    capabilities: {
      languages: ['yaml', 'bash', 'powershell', 'dockerfile'],
      frameworks: ['github-actions', 'docker', 'tauri', 'vercel', 'aws'],
      specializations: [
        'deployment',
        'build-automation',
        'release-management',
        'environment-configuration',
      ],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
      network: true,
    },
    prompt: `You are Deployer, a specialized deployment execution agent.
Your responsibilities:
1. Execute build and deployment processes
2. Configure deployment environments
3. Manage release workflows
4. Handle rollback procedures
5. Verify deployment success
6. Update deployment documentation

You follow deployment specifications precisely.
Always verify each step and handle errors gracefully.
Prioritize zero-downtime deployments and easy rollbacks.`,
    temperature: 0.1,
  },

  /**
   * Monitor
   * 专门的监控集成代理，设置监控和告警
   */
  monitor: {
    id: 'monitor',
    name: 'Monitor',
    type: 'monitor' as any,
    model: {
      provider: 'anthropic',
      model: DEFAULT_MODELS.anthropic,
      temperature: 0.2,
      maxTokens: 4096,
    },
    capabilities: {
      languages: ['typescript', 'python', 'yaml'],
      frameworks: ['prometheus', 'grafana', 'datadog', 'sentry'],
      specializations: [
        'monitoring-setup',
        'alerting',
        'metrics-collection',
        'log-aggregation',
        'performance-tracking',
      ],
    },
    tools: {
      read: true,
      write: true,
      execute: true,
      network: true,
    },
    prompt: `You are Monitor, a specialized monitoring integration agent.
Your responsibilities:
1. Set up monitoring and observability systems
2. Configure metrics collection and dashboards
3. Create alerting rules and notifications
4. Implement log aggregation and analysis
5. Track performance and health metrics
6. Generate monitoring reports

You ensure systems are observable and issues are detected early.
Focus on actionable metrics and meaningful alerts.
Avoid alert fatigue by setting appropriate thresholds.`,
    temperature: 0.2,
  },

  /**
   * SpecAnalyzer
   * 规范分析代理，分析和验证技术规范
   */
  'spec-analyzer': {
    id: 'spec-analyzer',
    name: 'SpecAnalyzer',
    type: 'spec-analyzer' as any,
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
      specializations: [
        'spec-analysis',
        'requirement-validation',
        'feasibility-assessment',
        'risk-identification',
      ],
    },
    tools: {
      read: true,
      write: false,
      execute: false,
      network: true,
    },
    prompt: `You are SpecAnalyzer, a specialized specification analysis agent.
Your responsibilities:
1. Analyze technical specifications for completeness
2. Validate requirements and acceptance criteria
3. Assess implementation feasibility
4. Identify potential risks and challenges
5. Suggest improvements to specifications
6. Ensure specifications are actionable

You review specifications before implementation begins.
Focus on catching issues early in the development process.
Provide constructive feedback to improve spec quality.`,
    temperature: 0.1,
  },
};

/**
 * 获取增强的代理角色
 */
export function getEnhancedAgentRole(type: string): AgentRole | null {
  return ENHANCED_AGENT_ROLES[type] || null;
}

/**
 * 获取所有增强的代理角色
 */
export function getAllEnhancedAgentRoles(): AgentRole[] {
  return Object.values(ENHANCED_AGENT_ROLES);
}

/**
 * 检查是否是增强的代理类型
 */
export function isEnhancedAgentType(type: string): boolean {
  return type in ENHANCED_AGENT_ROLES;
}

export default ENHANCED_AGENT_ROLES;
