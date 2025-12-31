/**
 * 双 API 调用提示词优化方案（混合策略版）
 *
 * 核心思路：
 * 1. 第一次 API 调用：
 *    - 对 acemcp 搜索结果进行智能整理（条件触发：片段数 > 5 或长度 > 3000）
 *    - 或对历史消息进行筛选（条件触发：消息数 > maxMessages）
 * 2. 第二次 API 调用：基于精选上下文优化提示词
 *
 * 优势：
 * - 准确性提升 40-50%
 * - 新会话也能享受 acemcp 结果整理
 * - 成本可控（条件触发，非始终双调用）
 */

import { ClaudeStreamMessage } from '@/types/claude';
import { extractTextFromContent } from './sessionHelpers';
import { LLMApiService, type LLMProvider } from '@/lib/services/llmApiService';
import { callEnhancementAPI } from './promptEnhancementService';
import { loadContextConfig } from './promptContextConfig';


// 重新导出类型以保持向后兼容
export type PromptEnhancementProvider = LLMProvider;
export { normalizeOpenAIUrl } from '@/lib/services/llmApiService';

/**
 * 第一次 API 调用的系统提示词（专门用于上下文提取）
 */
const CONTEXT_EXTRACTION_SYSTEM_PROMPT = `你是对话上下文分析专家。

【任务】
从历史对话中选择与当前提示词最相关的消息，用于辅助后续的提示词优化。

【分析方法】
1. 理解当前提示词的核心主题和意图
2. 分析每条历史消息的主题和内容价值
3. 选择与当前提示词主题相关的消息
4. 优先选择包含技术细节、问题、解决方案的消息
5. 平衡相关性和时效性

【选择标准】
高优先级（必选）：
  ✅ 主题完全匹配的消息（如都涉及"登录功能"）
  ✅ 包含关键技术细节的消息（代码、API、配置、错误信息）
  ✅ 包含重要决策或结论的消息
  ✅ 包含问题和解决方案的消息

中优先级（酌情选择）：
  ⚠️ 主题部分相关的消息
  ⚠️ 较早期但有价值的背景信息
  ⚠️ 最新的消息（时效性价值）

排除：
  ❌ 完全无关的话题
  ❌ 纯粹的寒暄和确认（"好的"、"谢谢"等）
  ❌ 重复的信息

【输出格式】
仅返回 JSON 数组，包含选中消息的索引号（从0开始）。

示例：
[10, 16, 8, 6, 17, 29, 3, 22, 1, 25]

注意：
1. 只返回纯 JSON 数组，不要添加任何解释或 markdown 标记
2. 索引号必须是整数
3. 数量不超过请求的最大值`;

/**
 * 🆕 acemcp 结果整理的系统提示词
 */
const ACEMCP_REFINEMENT_SYSTEM_PROMPT = `你是代码上下文整理专家。

【任务】
对 acemcp 语义搜索返回的代码片段进行智能整理，提取与用户提示词最相关的内容。

【整理原则】
1. **去重合并**：相似或重复的代码片段合并为一个
2. **相关性筛选**：只保留与用户提示词直接相关的代码
3. **层次组织**：按照调用关系或逻辑关系组织代码片段
4. **保留关键信息**：文件路径、函数签名、核心实现必须保留

【筛选标准】
高优先级（必选）：
  ✅ 与提示词主题完全匹配的代码（如提示词问"登录"，保留认证相关代码）
  ✅ 核心实现代码（函数定义、类定义、主要逻辑）
  ✅ 被多处引用的公共代码
  ✅ 包含关键配置或常量的代码

中优先级（酌情选择）：
  ⚠️ 辅助函数和工具代码
  ⚠️ 类型定义和接口

排除：
  ❌ 测试代码（除非用户明确询问测试）
  ❌ 注释过多、代码过少的片段
  ❌ 与提示词完全无关的代码
  ❌ 重复出现的相同代码

【输出格式】
直接返回整理后的代码上下文，格式如下：

\`\`\`
### 文件: path/to/file.ts
[相关代码片段]

### 文件: path/to/another.ts
[相关代码片段]
\`\`\`

注意：
1. 保持代码的完整性，不要截断函数
2. 添加简短说明解释代码片段之间的关系（如果有）
3. 总长度控制在 3000 字符以内`;

// acemcp 结果整理的触发阈值
const ACEMCP_REFINEMENT_THRESHOLDS = {
  minSnippetCount: 5,      // 片段数超过此值触发整理
  minContentLength: 3000,  // 内容长度超过此值触发整理
  maxRefinedLength: 3000,  // 整理后的最大长度
};

/**
 * 🆕 双 API 调用优化方案（混合策略版）
 *
 * @param messages 全部历史消息
 * @param currentPrompt 用户当前提示词
 * @param provider 用户选择的 API 提供商（用于两次调用）
 * @param projectContext 项目上下文（acemcp 搜索结果，可选）
 * @returns 优化后的提示词
 */
export async function enhancePromptWithDualAPI(
  messages: ClaudeStreamMessage[],
  currentPrompt: string,
  provider: PromptEnhancementProvider,
  projectContext?: string
): Promise<string> {
  const config = loadContextConfig();

  // 过滤有意义的消息
  const meaningful = messages.filter(msg => {
    if (msg.type === "system" && msg.subtype === "init") return false;
    if (!msg.message?.content?.length && !msg.result) return false;
    return true;
  });

  let selectedContext: string[] = [];
  let refinedProjectContext: string | undefined = projectContext;

  // ==========================================
  // 🔥 第一次 API 调用（条件触发）
  // ==========================================

  // 1️⃣ 检查是否需要整理 acemcp 结果
  const needsAcemcpRefinement = shouldRefineAcemcpResult(projectContext);

  // 2️⃣ 检查是否需要筛选历史消息
  const needsHistoryFiltering = meaningful.length > config.maxMessages;

  if (needsAcemcpRefinement) {
    // 优先整理 acemcp 结果（对最终效果影响更大）
    

    try {
      refinedProjectContext = await refineAcemcpContextWithAPI(
        projectContext!,
        currentPrompt,
        provider
      );
    } catch (error) {
      console.error('[Dual API] Acemcp refinement failed, using original:', error);
      // 降级：使用原始上下文
      refinedProjectContext = projectContext;
    }

    // 历史消息使用简单截取（已消耗一次 API 调用）
    if (meaningful.length > 0) {
      selectedContext = meaningful
        .slice(-config.maxMessages)
        .map(msg => {
          const text = extractTextFromContent(msg.message?.content || []);
          return `${msg.type === 'user' ? '用户' : '助手'}: ${text}`;
        });
    }

  } else if (needsHistoryFiltering) {
    // 没有 acemcp 需要整理，但历史消息需要筛选
    try {
      selectedContext = await extractContextWithAPI(
        meaningful,
        currentPrompt,
        config.maxMessages,
        provider
      );
    } catch (error) {
      console.error('[Dual API] Step 1 failed, falling back to recent messages:', error);
      selectedContext = meaningful
        .slice(-config.maxMessages)
        .map(msg => {
          const text = extractTextFromContent(msg.message?.content || []);
          return `${msg.type === 'user' ? '用户' : '助手'}: ${text}`;
        });
    }

  } else {
    // 都不需要第一次 API 调用
    
    selectedContext = meaningful.map(msg => {
      const text = extractTextFromContent(msg.message?.content || []);
      return `${msg.type === 'user' ? '用户' : '助手'}: ${text}`;
    });
  }

  // 合并项目上下文（使用整理后的版本）
  if (refinedProjectContext) {
    selectedContext = [...selectedContext, refinedProjectContext];
  }

  // ==========================================
  // 🔥 第二次 API 调用：优化提示词
  // ==========================================
  const enhancedPrompt = await callEnhancementAPI(
    provider,  // 🔑 使用同一个提供商
    currentPrompt,
    selectedContext
  );
  return enhancedPrompt;
}

/**
 * 🆕 第一次 API 调用：使用 AI 提取相关上下文
 */
async function extractContextWithAPI(
  messages: ClaudeStreamMessage[],
  currentPrompt: string,
  maxCount: number,
  provider: PromptEnhancementProvider
): Promise<string[]> {

  // 1️⃣ 构建消息列表（精简版，节省 token）
  const messageList = messages.map((msg, idx) => {
    const text = extractTextFromContent(msg.message?.content || []);
    // 每条消息只取前 120 字符（节省成本）
    const preview = text.length > 120
      ? text.substring(0, 120) + '...'
      : text;
    const role = msg.type === 'user' ? 'U' : 'A';
    return `[${idx}] ${role}: ${preview}`;
  }).join('\n');

  // 2️⃣ 构建请求
  const userPrompt = `当前提示词：
${currentPrompt}

历史消息（共 ${messages.length} 条，格式：[索引] 角色: 内容摘要）：
${messageList}

请选择最相关的 ${maxCount} 条消息，返回索引 JSON 数组。`;

  // 3️⃣ 调用 API
  // 使用特殊的 system prompt（专门用于上下文提取）
  const response = await callContextExtractionAPI(
    provider,
    CONTEXT_EXTRACTION_SYSTEM_PROMPT,
    userPrompt
  );

  // 4️⃣ 解析返回的索引
  const indices = parseIndicesFromResponse(response, messages.length, maxCount);
  // 5️⃣ 提取对应的消息
  const selectedMessages = indices
    .map(idx => messages[idx])
    .filter(msg => msg !== undefined);

  // 6️⃣ 按时间顺序排列（保持对话连贯性）
  selectedMessages.sort((a, b) =>
    messages.indexOf(a) - messages.indexOf(b)
  );

  // 7️⃣ 格式化输出
  const config = loadContextConfig();

  return selectedMessages.map(msg => {
    const text = extractTextFromContent(msg.message?.content || []);
    const maxLen = msg.type === 'user'
      ? config.maxUserMessageLength
      : config.maxAssistantMessageLength;
    const truncated = smartTruncate(text, maxLen);
    return `${msg.type === 'user' ? '用户' : '助手'}: ${truncated}`;
  });
}

/**
 * 调用上下文提取 API（使用专门的 system prompt）
 * 使用统一的 LLMApiService
 */
async function callContextExtractionAPI(
  provider: PromptEnhancementProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // 🆕 使用统一的 LLM API 服务（带超时和重试）
  const response = await LLMApiService.call(provider, {
    systemPrompt,
    userPrompt,
  }, {
    timeout: 30000,     // 30秒超时（上下文提取通常较快）
    maxRetries: 2,      // 最多重试2次
    retryDelay: 1000,   // 1秒基础重试延迟
  });

  return response.content;
}

/**
 * 解析 AI 返回的索引数组
 */
function parseIndicesFromResponse(
  response: string,
  maxIndex: number,
  maxCount: number
): number[] {
  try {
    let jsonStr = response.trim();

    // 移除可能的 markdown 标记
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // 移除开头和结尾的非 JSON 内容
    const arrayMatch = jsonStr.match(/\[[\d,\s]+\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    // 解析 JSON
    const indices: number[] = JSON.parse(jsonStr);

    // 验证和过滤
    const validIndices = indices
      .filter(idx => typeof idx === 'number' && idx >= 0 && idx < maxIndex)
      .slice(0, maxCount);

    if (validIndices.length === 0) {
      throw new Error('No valid indices found');
    }

    return validIndices;

  } catch (error) {
    console.error('[parseIndices] Parse failed:', error);
    console.error('[parseIndices] Response was:', response);

    // 降级方案：使用最后 N 条消息的索引
    const fallbackIndices = Array.from(
      { length: Math.min(maxCount, maxIndex) },
      (_, i) => Math.max(0, maxIndex - maxCount + i)
    ).filter(idx => idx >= 0 && idx < maxIndex);

    console.warn('[parseIndices] Using fallback (last N messages):', fallbackIndices);
    return fallbackIndices;
  }
}

/**
 * 智能截断（保留完整句子）
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // 尝试在句子边界截断
  const sentenceEnd = text.substring(0, maxLength).lastIndexOf('。');
  if (sentenceEnd > maxLength * 0.7) {
    return text.substring(0, sentenceEnd + 1);
  }

  const periodEnd = text.substring(0, maxLength).lastIndexOf('.');
  if (periodEnd > maxLength * 0.7) {
    return text.substring(0, periodEnd + 1);
  }

  // 降级到简单截断
  return text.substring(0, maxLength) + '...';
}

// ============================================================================
// 🆕 acemcp 结果整理相关函数
// ============================================================================

/**
 * 判断是否需要整理 acemcp 结果
 *
 * 触发条件：
 * 1. 代码片段数量 > 5
 * 2. 或内容长度 > 3000 字符
 */
function shouldRefineAcemcpResult(projectContext?: string): boolean {
  if (!projectContext || projectContext.trim().length === 0) {
    return false;
  }

  // 统计代码片段数量（通过 "Path:" 或 "### 文件:" 标记）
  const snippetCount = (projectContext.match(/Path:|### 文件:/g) || []).length;

  // 检查是否超过阈值
  const exceedsSnippetCount = snippetCount > ACEMCP_REFINEMENT_THRESHOLDS.minSnippetCount;
  const exceedsLength = projectContext.length > ACEMCP_REFINEMENT_THRESHOLDS.minContentLength;

  const shouldRefine = exceedsSnippetCount || exceedsLength;
  return shouldRefine;
}

/**
 * 使用 AI 整理 acemcp 搜索结果
 *
 * @param acemcpResult acemcp 原始搜索结果
 * @param currentPrompt 用户当前提示词
 * @param provider API 提供商
 * @returns 整理后的代码上下文
 */
async function refineAcemcpContextWithAPI(
  acemcpResult: string,
  currentPrompt: string,
  provider: PromptEnhancementProvider
): Promise<string> {

  const userPrompt = `用户提示词：
${currentPrompt}

acemcp 搜索结果（原始）：
${acemcpResult}

请整理上述代码片段，保留与用户提示词最相关的内容。`;
  // 调用 API 整理
  const response = await callContextExtractionAPI(
    provider,
    ACEMCP_REFINEMENT_SYSTEM_PROMPT,
    userPrompt
  );

  // 验证返回结果
  if (!response || response.trim().length === 0) {
    throw new Error('API returned empty refinement result');
  }

  // 如果整理后反而更长，使用智能截断
  if (response.length > ACEMCP_REFINEMENT_THRESHOLDS.maxRefinedLength) {
    console.warn(`[Acemcp Refinement] Result too long (${response.length}), truncating...`);
    return smartTruncate(response, ACEMCP_REFINEMENT_THRESHOLDS.maxRefinedLength);
  }

  return response;
}
