/**
 * Spec Generation Engine - 规范生成引擎
 *
 * 功能：
 * 1. 将自然语言需求转换为结构化技术规范
 * 2. 生成包含架构、API、测试、部署的完整规范
 * 3. 支持多种输出格式（JSON、YAML、Markdown）
 *
 * 灵感来源：Spec-Driven 架构实践
 */

import { logger } from '@/lib/logger';
import type { RealAPIClient } from '../api/RealAPIClient';

// 规范类型
export type SpecType = 'feature' | 'bugfix' | 'refactor' | 'architecture' | 'deployment';

// 技术规范结构
export interface TechnicalSpec {
  // 元数据
  metadata: {
    id: string;
    title: string;
    type: SpecType;
    createdAt: string;
    version: string;
    author?: string;
  };

  // 需求描述
  requirements: {
    summary: string;
    description: string;
    userStories?: string[];
    acceptanceCriteria: string[];
    constraints?: string[];
  };

  // 架构设计
  architecture: {
    overview: string;
    components: ComponentSpec[];
    dataFlow: DataFlowSpec[];
    dependencies: DependencySpec[];
    securityConsiderations?: string[];
  };

  // API 设计
  api?: {
    endpoints: APIEndpointSpec[];
    models: DataModelSpec[];
    authentication?: AuthSpec;
  };

  // 实现计划
  implementation: {
    phases: ImplementationPhase[];
    estimatedEffort?: string;
    risks?: RiskSpec[];
  };

  // 测试策略
  testing: {
    strategy: string;
    unitTests: TestSpec[];
    integrationTests: TestSpec[];
    e2eTests?: TestSpec[];
    performanceTests?: TestSpec[];
  };

  // 部署计划
  deployment?: {
    strategy: string;
    environments: EnvironmentSpec[];
    rollbackPlan?: string;
    monitoring?: MonitoringSpec[];
  };
}

// 组件规范
export interface ComponentSpec {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'service' | 'library';
  description: string;
  responsibilities: string[];
  interfaces?: InterfaceSpec[];
  dependencies?: string[];
}

// 数据流规范
export interface DataFlowSpec {
  from: string;
  to: string;
  data: string;
  protocol?: string;
}

// 依赖规范
export interface DependencySpec {
  name: string;
  version?: string;
  purpose: string;
  type: 'runtime' | 'dev' | 'peer';
}

// API 端点规范
export interface APIEndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: ParameterSpec[];
  requestBody?: DataModelSpec;
  responses: ResponseSpec[];
  authentication?: boolean;
}

// 参数规范
export interface ParameterSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
}

// 数据模型规范
export interface DataModelSpec {
  name: string;
  description: string;
  fields: FieldSpec[];
}

// 字段规范
export interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string[];
}

// 响应规范
export interface ResponseSpec {
  status: number;
  description: string;
  schema?: DataModelSpec;
}

// 认证规范
export interface AuthSpec {
  type: 'jwt' | 'oauth' | 'api-key' | 'session';
  description: string;
}

// 接口规范
export interface InterfaceSpec {
  name: string;
  methods: MethodSpec[];
}

// 方法规范
export interface MethodSpec {
  name: string;
  parameters: ParameterSpec[];
  returnType: string;
  description: string;
}

// 实现阶段
export interface ImplementationPhase {
  phase: number;
  name: string;
  description: string;
  tasks: TaskSpec[];
  dependencies?: number[];
}

// 任务规范
export interface TaskSpec {
  id: string;
  title: string;
  description: string;
  assignedTo?: 'frontend' | 'backend' | 'testing' | 'devops' | 'docs';
  estimatedHours?: number;
  dependencies?: string[];
}

// 风险规范
export interface RiskSpec {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
}

// 测试规范
export interface TestSpec {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  target: string;
  assertions: string[];
}

// 环境规范
export interface EnvironmentSpec {
  name: string;
  type: 'development' | 'staging' | 'production';
  configuration: Record<string, unknown>;
}

// 监控规范
export interface MonitoringSpec {
  metric: string;
  threshold: string;
  alert: string;
}

// 规范生成选项
export interface SpecGenerationOptions {
  includeArchitecture?: boolean;
  includeAPI?: boolean;
  includeTesting?: boolean;
  includeDeployment?: boolean;
  detailLevel?: 'brief' | 'standard' | 'detailed';
  outputFormat?: 'json' | 'yaml' | 'markdown';
}

/**
 * 规范生成引擎
 */
export class SpecGenerationEngine {
  private apiClient: RealAPIClient;
  private model: string;

  constructor(apiClient: RealAPIClient, model: string = 'claude-opus-4-5-20250514') {
    this.apiClient = apiClient;
    this.model = model;
  }

  /**
   * 从自然语言需求生成技术规范
   */
  async generateSpec(
    requirements: string,
    type: SpecType,
    options: SpecGenerationOptions = {}
  ): Promise<TechnicalSpec> {
    const {
      includeArchitecture = true,
      includeAPI = true,
      includeTesting = true,
      includeDeployment = true,
      detailLevel = 'standard',
    } = options;

    // 构建提示词
    const prompt = this.buildSpecGenerationPrompt(
      requirements,
      type,
      includeArchitecture,
      includeAPI,
      includeTesting,
      includeDeployment,
      detailLevel
    );

    // 调用 AI 生成规范
    const response = await this.apiClient.chat({
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 8192,
    });

    // 解析 AI 响应
    const specText = response.content;
    const spec = this.parseSpecFromText(specText, type);

    return spec;
  }

  /**
   * 构建规范生成提示词
   */
  private buildSpecGenerationPrompt(
    requirements: string,
    type: SpecType,
    includeArchitecture: boolean,
    includeAPI: boolean,
    includeTesting: boolean,
    includeDeployment: boolean,
    detailLevel: string
  ): string {
    let prompt = `Generate a ${detailLevel} technical specification for the following ${type}:\n\n`;
    prompt += `Requirements:\n${requirements}\n\n`;
    prompt += `Please provide a structured specification that includes:\n\n`;

    prompt += `1. **Metadata**: ID, title, type, version\n`;
    prompt += `2. **Requirements**: Summary, description, user stories, acceptance criteria\n`;

    if (includeArchitecture) {
      prompt += `3. **Architecture**: Overview, components, data flow, dependencies, security considerations\n`;
    }

    if (includeAPI) {
      prompt += `4. **API Design**: Endpoints, data models, authentication\n`;
    }

    prompt += `5. **Implementation Plan**: Phases, tasks, estimated effort, risks\n`;

    if (includeTesting) {
      prompt += `6. **Testing Strategy**: Unit tests, integration tests, E2E tests\n`;
    }

    if (includeDeployment) {
      prompt += `7. **Deployment Plan**: Strategy, environments, rollback plan, monitoring\n`;
    }

    prompt += `\nFormat the response as a valid JSON object matching the TechnicalSpec interface.`;

    return prompt;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `You are a senior software architect and technical specification expert.
Your role is to analyze requirements and generate comprehensive, actionable technical specifications.

Guidelines:
1. Be specific and detailed in your specifications
2. Consider security, performance, and scalability
3. Identify potential risks and provide mitigation strategies
4. Break down complex tasks into manageable phases
5. Ensure all specifications are implementable and testable
6. Use industry best practices and design patterns
7. Consider the full software development lifecycle

Output Format:
- Provide specifications in valid JSON format
- Use clear, professional language
- Include concrete examples where helpful
- Ensure all required fields are populated`;
  }

  /**
   * 从 AI 响应文本解析规范
   */
  private parseSpecFromText(text: string, type: SpecType): TechnicalSpec {
    try {
      // 尝试提取 JSON
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonText);

        // 确保有必需的字段
        return this.validateAndNormalizeSpec(parsed, type);
      }

      // 如果没有找到 JSON，返回基本规范
      return this.createFallbackSpec(text, type);
    } catch (error) {
      logger.error('SpecGenerationEngine', 'Failed to parse spec:', error);
      return this.createFallbackSpec(text, type);
    }
  }

  /**
   * 验证并规范化规范
   */
  private validateAndNormalizeSpec(parsed: any, type: SpecType): TechnicalSpec {
    const now = new Date().toISOString();

    return {
      metadata: {
        id: parsed.metadata?.id || `spec-${Date.now()}`,
        title: parsed.metadata?.title || 'Untitled Specification',
        type: parsed.metadata?.type || type,
        createdAt: parsed.metadata?.createdAt || now,
        version: parsed.metadata?.version || '1.0.0',
        author: parsed.metadata?.author,
      },
      requirements: {
        summary: parsed.requirements?.summary || '',
        description: parsed.requirements?.description || '',
        userStories: parsed.requirements?.userStories || [],
        acceptanceCriteria: parsed.requirements?.acceptanceCriteria || [],
        constraints: parsed.requirements?.constraints,
      },
      architecture: {
        overview: parsed.architecture?.overview || '',
        components: parsed.architecture?.components || [],
        dataFlow: parsed.architecture?.dataFlow || [],
        dependencies: parsed.architecture?.dependencies || [],
        securityConsiderations: parsed.architecture?.securityConsiderations,
      },
      api: parsed.api,
      implementation: {
        phases: parsed.implementation?.phases || [],
        estimatedEffort: parsed.implementation?.estimatedEffort,
        risks: parsed.implementation?.risks,
      },
      testing: {
        strategy: parsed.testing?.strategy || '',
        unitTests: parsed.testing?.unitTests || [],
        integrationTests: parsed.testing?.integrationTests || [],
        e2eTests: parsed.testing?.e2eTests,
        performanceTests: parsed.testing?.performanceTests,
      },
      deployment: parsed.deployment,
    };
  }

  /**
   * 创建后备规范（当解析失败时）
   */
  private createFallbackSpec(text: string, type: SpecType): TechnicalSpec {
    const now = new Date().toISOString();

    return {
      metadata: {
        id: `spec-${Date.now()}`,
        title: 'Generated Specification',
        type,
        createdAt: now,
        version: '1.0.0',
      },
      requirements: {
        summary: text.substring(0, 200),
        description: text,
        acceptanceCriteria: [],
      },
      architecture: {
        overview: 'Architecture details to be defined',
        components: [],
        dataFlow: [],
        dependencies: [],
      },
      implementation: {
        phases: [],
      },
      testing: {
        strategy: 'Testing strategy to be defined',
        unitTests: [],
        integrationTests: [],
      },
    };
  }

  /**
   * 将规范导出为不同格式
   */
  async exportSpec(spec: TechnicalSpec, format: 'json' | 'yaml' | 'markdown'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(spec, null, 2);

      case 'yaml':
        return this.convertToYAML(spec);

      case 'markdown':
        return this.convertToMarkdown(spec);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * 转换为 YAML 格式
   */
  private convertToYAML(spec: TechnicalSpec): string {
    // 简单的 YAML 转换（生产环境应使用 yaml 库）
    return JSON.stringify(spec, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/\{/g, '')
      .replace(/\}/g, '');
  }

  /**
   * 转换为 Markdown 格式
   */
  private convertToMarkdown(spec: TechnicalSpec): string {
    let md = `# ${spec.metadata.title}\n\n`;
    md += `**Type**: ${spec.metadata.type}  \n`;
    md += `**Version**: ${spec.metadata.version}  \n`;
    md += `**Created**: ${spec.metadata.createdAt}  \n\n`;

    md += `## Requirements\n\n`;
    md += `### Summary\n${spec.requirements.summary}\n\n`;
    md += `### Description\n${spec.requirements.description}\n\n`;

    if (spec.requirements.acceptanceCriteria.length > 0) {
      md += `### Acceptance Criteria\n`;
      spec.requirements.acceptanceCriteria.forEach(criteria => {
        md += `- ${criteria}\n`;
      });
      md += `\n`;
    }

    md += `## Architecture\n\n`;
    md += `${spec.architecture.overview}\n\n`;

    if (spec.architecture.components.length > 0) {
      md += `### Components\n`;
      spec.architecture.components.forEach(comp => {
        md += `#### ${comp.name} (${comp.type})\n`;
        md += `${comp.description}\n\n`;
      });
    }

    if (spec.implementation.phases.length > 0) {
      md += `## Implementation Plan\n\n`;
      spec.implementation.phases.forEach(phase => {
        md += `### Phase ${phase.phase}: ${phase.name}\n`;
        md += `${phase.description}\n\n`;
        if (phase.tasks.length > 0) {
          md += `**Tasks:**\n`;
          phase.tasks.forEach(task => {
            md += `- ${task.title}: ${task.description}\n`;
          });
          md += `\n`;
        }
      });
    }

    md += `## Testing Strategy\n\n`;
    md += `${spec.testing.strategy}\n\n`;

    return md;
  }

  /**
   * 更新现有规范
   */
  async updateSpec(
    existingSpec: TechnicalSpec,
    updates: string
  ): Promise<TechnicalSpec> {
    let prompt = `Update the following technical specification based on these changes:\n\n`;
    prompt += `Current Spec:\n${JSON.stringify(existingSpec, null, 2)}\n\n`;
    prompt += `Requested Updates:\n${updates}\n\n`;
    prompt += `Provide the updated specification as a complete JSON object.`;

    const response = await this.apiClient.chat({
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 8192,
    });

    const specText = response.content;
    return this.parseSpecFromText(specText, existingSpec.metadata.type);
  }
}

export default SpecGenerationEngine;
