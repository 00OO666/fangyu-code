/**
 * SiliconFlow 配置
 * 硅基流动 - 国产 AI 模型聚合平台
 * API 兼容 OpenAI 格式
 */

export interface SiliconFlowModel {
  id: string;
  name: string;
  description: string;
  category: 'reasoning' | 'chat' | 'code' | 'multimodal' | 'free';
  contextWindow?: number;
  isFree?: boolean;
}

export interface SiliconFlowConfig {
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * SiliconFlow 支持的模型列表
 * 按类别分组，便于用户选择
 */
export const SILICONFLOW_MODELS: SiliconFlowModel[] = [
  // 推理模型 (Reasoning)
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek-R1',
    description: '深度推理模型，适合复杂问题分析',
    category: 'reasoning',
    contextWindow: 64000,
  },
  {
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
    name: 'DeepSeek-R1-Distill-32B',
    description: '基于 Qwen2.5-32B 的蒸馏推理模型',
    category: 'reasoning',
    contextWindow: 32000,
  },
  {
    id: 'Qwen/QwQ-32B',
    name: 'Qwen QwQ-32B',
    description: 'Qwen 推理模型，深度思考能力',
    category: 'reasoning',
    contextWindow: 32000,
  },

  // 对话模型 (Chat)
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek-V3',
    description: '最新版 DeepSeek，综合能力强',
    category: 'chat',
    contextWindow: 64000,
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen2.5-72B',
    description: '通义千问旗舰版，支持29+语言',
    category: 'chat',
    contextWindow: 128000,
  },
  {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen2.5-32B',
    description: '通义千问大型版，性价比高',
    category: 'chat',
    contextWindow: 128000,
  },
  {
    id: 'Qwen/Qwen3-30B-A3B',
    name: 'Qwen3-30B-A3B',
    description: 'MoE架构，30.5B参数/3.3B激活',
    category: 'chat',
    contextWindow: 32000,
  },
  {
    id: 'meta-llama/Llama-3.3-70B-Instruct',
    name: 'Llama-3.3-70B',
    description: 'Meta 最新 Llama 模型',
    category: 'chat',
    contextWindow: 128000,
  },
  {
    id: 'THUDM/glm-4-9b-chat',
    name: 'GLM-4-9B',
    description: '智谱 GLM-4 对话模型',
    category: 'chat',
    contextWindow: 128000,
  },

  // 代码模型 (Code)
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    name: 'Qwen2.5-Coder-32B',
    description: '专业代码模型，编程能力强',
    category: 'code',
    contextWindow: 128000,
  },
  {
    id: 'deepseek-ai/DeepSeek-Coder-V2-Instruct',
    name: 'DeepSeek-Coder-V2',
    description: 'DeepSeek 代码专家模型',
    category: 'code',
    contextWindow: 64000,
  },

  // 免费模型 (Free - 9B及以下)
  {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    name: 'Qwen2.5-7B (Free)',
    description: '免费模型，适合日常对话',
    category: 'free',
    contextWindow: 32000,
    isFree: true,
  },
  {
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    name: 'Llama-3.1-8B (Free)',
    description: '免费 Llama 模型',
    category: 'free',
    contextWindow: 128000,
    isFree: true,
  },
  {
    id: 'internlm/internlm2_5-7b-chat',
    name: 'InternLM2.5-7B (Free)',
    description: '书生浦语免费模型',
    category: 'free',
    contextWindow: 32000,
    isFree: true,
  },

  // 多模态模型 (Multimodal)
  {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen2.5-VL-72B',
    description: '视觉语言模型，理解图像和视频',
    category: 'multimodal',
    contextWindow: 32000,
  },
  {
    id: 'deepseek-ai/DeepSeek-VL2',
    name: 'DeepSeek-VL2',
    description: 'MoE视觉语言模型，4.5B激活参数',
    category: 'multimodal',
    contextWindow: 32000,
  },
];

/**
 * SiliconFlow API 配置常量
 */
export const SILICONFLOW_API = {
  BASE_URL: 'https://api.siliconflow.cn',
  CHAT_ENDPOINT: '/v1/chat/completions',
  MODELS_ENDPOINT: '/v1/models',
};

/**
 * 默认配置
 */
export const DEFAULT_SILICONFLOW_CONFIG: SiliconFlowConfig = {
  apiKey: 'sk-efqlihqdhvzijxehzlgralkzuxpedhuiqlfllfbacxgbenha',
  baseUrl: SILICONFLOW_API.BASE_URL,
  selectedModel: 'deepseek-ai/DeepSeek-V3',
  temperature: 0.7,
  maxTokens: 4096,
};

/**
 * 按类别分组模型
 */
export function getModelsByCategory(): Record<string, SiliconFlowModel[]> {
  const categories: Record<string, SiliconFlowModel[]> = {
    reasoning: [],
    chat: [],
    code: [],
    free: [],
    multimodal: [],
  };

  SILICONFLOW_MODELS.forEach(model => {
    categories[model.category].push(model);
  });

  return categories;
}

/**
 * 获取模型信息
 */
export function getModelInfo(modelId: string): SiliconFlowModel | undefined {
  return SILICONFLOW_MODELS.find(m => m.id === modelId);
}

/**
 * 本地存储键名
 */
export const SILICONFLOW_STORAGE_KEYS = {
  CONFIG: 'siliconflow_config',
  API_KEY: 'siliconflow_api_key',
  SELECTED_MODEL: 'siliconflow_selected_model',
};

/**
 * 保存配置到本地存储
 */
export function saveSiliconFlowConfig(config: Partial<SiliconFlowConfig>): void {
  const existing = loadSiliconFlowConfig();
  const merged = { ...existing, ...config };
  localStorage.setItem(SILICONFLOW_STORAGE_KEYS.CONFIG, JSON.stringify(merged));
}

/**
 * 从本地存储加载配置
 */
export function loadSiliconFlowConfig(): SiliconFlowConfig {
  try {
    const stored = localStorage.getItem(SILICONFLOW_STORAGE_KEYS.CONFIG);
    if (stored) {
      return { ...DEFAULT_SILICONFLOW_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load SiliconFlow config:', e);
  }
  return { ...DEFAULT_SILICONFLOW_CONFIG };
}
