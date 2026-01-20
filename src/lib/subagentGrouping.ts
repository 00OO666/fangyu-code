/**
 * 子代理消息分组逻辑
 *
 * 核心思路：
 * 1. 识别 Task 工具调用（子代理启动边界）
 * 2. 收集该 Task 对应的所有子代理消息（有 parent_tool_use_id）
 * 3. 将 Task 调用和相关子代理消息打包成一个消息组
 */

import { logger } from '@/lib/logger';
import type { ClaudeStreamMessage } from "@/types/claude";

/**
 * 子代理消息组
 */
export interface SubagentGroup {
  /** 组 ID（使用 Task 的 tool_use_id） */
  id: string;
  /** Task 工具调用的消息 */
  taskMessage: ClaudeStreamMessage;
  /** Task 工具的 ID */
  taskToolUseId: string;
  /** 子代理的所有消息（按顺序） */
  subagentMessages: ClaudeStreamMessage[];
  /** 组在原始消息列表中的起始索引 */
  startIndex: number;
  /** 组在原始消息列表中的结束索引 */
  endIndex: number;
  /** 子代理类型 */
  subagentType?: string;
}

/**
 * 消息组类型（用于渲染）
 */
export type MessageGroup =
  | { type: "normal"; id: string; message: ClaudeStreamMessage; index: number }
  | { type: "subagent"; id: string; group: SubagentGroup }
  | { type: "aggregated"; id: string; messages: ClaudeStreamMessage[]; index: number }; // 新增：聚合消息组

/**
 * 生成消息的稳定 ID
 */
function getMessageId(message: ClaudeStreamMessage, index: number): string {
  return message.uuid || `msg-${index}`;
}

/**
 * 生成聚合消息组的稳定 ID
 */
function getAggregatedGroupId(messages: ClaudeStreamMessage[], startIndex: number): string {
  if (messages.length === 0) return `agg-${startIndex}`;
  const firstId = messages[0].uuid || startIndex;
  const lastId = messages[messages.length - 1].uuid || (startIndex + messages.length - 1);
  return `agg-${firstId}-${lastId}`;
}

/**
 * 检查消息是否包含 Task 工具调用
 */
export function hasTaskToolCall(message: ClaudeStreamMessage): boolean {
  if (message.type !== "assistant") return false;

  const content = message.message?.content;
  if (!Array.isArray(content)) return false;

  return content.some(
    (item: any) => item.type === "tool_use" && item.name?.toLowerCase() === "task",
  );
}

/**
 * 从消息中提取 Task 工具的 ID
 */
export function extractTaskToolUseIds(message: ClaudeStreamMessage): string[] {
  if (!hasTaskToolCall(message)) return [];

  const content = message.message?.content as any[];
  return content
    .filter((item: any) => item.type === "tool_use" && item.name?.toLowerCase() === "task")
    .map((item: any) => item.id)
    .filter(Boolean);
}

/**
 * 从消息中提取 Task 工具的详细信息（包括 subagent_type）
 */
export function extractTaskToolDetails(
  message: ClaudeStreamMessage,
): Map<string, { subagentType?: string }> {
  const details = new Map<string, { subagentType?: string }>();

  if (!hasTaskToolCall(message)) return details;

  const content = message.message?.content as any[];
  content
    .filter((item: any) => item.type === "tool_use" && item.name?.toLowerCase() === "task")
    .forEach((item: any) => {
      if (item.id) {
        details.set(item.id, {
          subagentType: item.input?.subagent_type,
        });
      }
    });

  return details;
}

/**
 * 检查消息是否是子代理消息
 */
export function isSubagentMessage(message: ClaudeStreamMessage): boolean {
  // 检查是否有 parent_tool_use_id
  const hasParent = !!(message as any).parent_tool_use_id;

  // 检查是否标记为侧链
  const isSidechain = !!(message as any).isSidechain;

  return hasParent || isSidechain;
}

/**
 * 获取消息的 parent_tool_use_id
 */
export function getParentToolUseId(message: ClaudeStreamMessage): string | null {
  return (message as any).parent_tool_use_id || null;
}

/**
 * 获取技术性消息的具体聚合类型
 *
 * 返回值：
 * - 'tool': 仅包含工具调用或结果
 * - 'thinking': 仅包含思考内容
 * - null: 包含文本或其他不可聚合内容
 *
 * 🔧 FIX v2.7.8: 改进文本检测逻辑，防止 Claude 说的话被错误聚合
 */
function getTechnicalMessageType(message: ClaudeStreamMessage): "tool" | "thinking" | null {
  // Thinking 类型的消息
  if (message.type === "thinking") return "thinking";

  // 必须是 assistant 类型
  if (message.type !== "assistant") return null;

  const content = message.message?.content;
  if (!Array.isArray(content)) {
    return null;
  }

  let hasThinking = false;
  let hasTool = false;
  let hasText = false;

  content.forEach((item: any) => {
    if (item.type === "thinking") {
      hasThinking = true;
    } else if (item.type === "tool_use" || item.type === "tool_result") {
      hasTool = true;
    } else if (item.type === "text") {
      // 🔧 FIX v2.7.8: 更严格的文本检测，防止 Claude 说的话被错误聚合
      const text = item.text || '';
      const trimmedText = text.trim();

      // 判断是否为"空"或"无意义"的文本：
      // 1. 完全空白
      // 2. 仅包含单个 XML 标签（如 <thinking> 或 </thinking>）
      // 3. 仅包含换行符
      // 4. 仅包含成对的空标签（如 <thinking></thinking>）
      const isEmptyOrTag =
        trimmedText.length === 0 ||
        /^<\/?[a-z_]+>$/i.test(trimmedText) ||
        /^[\s\n\r]*$/.test(trimmedText) ||
        /^<([a-z_]+)>\s*<\/\1>$/i.test(trimmedText);

      // 只要不是空/标签，就认为有真实文本内容
      if (!isEmptyOrTag) {
        hasText = true;
        // 🔍 DEBUG: 记录包含文本的消息（开发环境）
        if (import.meta.env.DEV) {
          console.log('[subagentGrouping] ✅ Message has real text, NOT aggregating:', {
            uuid: message.uuid,
            textPreview: trimmedText.substring(0, 100),
            textLength: trimmedText.length
          });
        }
      }
    }
  });

  // 🔧 FIX: 如果包含可见文本，绝对不可聚合（这是最重要的规则）
  if (hasText) {
    if (import.meta.env.DEV) {
      logger.debug('subagentGrouping', '[subagentGrouping] ❌ NOT aggregating (has text);:', message.uuid);
    }
    return null;
  }

  // 如果既有 Thinking 又有 Tool，作为混合类型（通常优先视为 Tool 组或独立处理，根据需求这里可以返回 tool 以允许合并，或者 null 以打断）
  // 用户希望 Thinking 和 Tool 分离。
  // 场景 A: 纯 Thinking -> 'thinking'
  // 场景 B: 纯 Tool -> 'tool'
  // 场景 C: Thinking + Tool 在同一条消息 -> 这是一个天然的组合，我们应该返回什么？
  // 如果返回 'tool'，它会和前后的 tool 合并。
  // 如果返回 'thinking'，它会和前后的 thinking 合并。
  // 如果返回 null，它不参与合并。

  if (hasThinking && hasTool) {
    // 这是一个复杂的混合消息，为了安全起见，我们暂不将其与其他消息合并，
    // 以免混淆。它自身内部已经包含了 Thinking 和 Tool。
    // 但是，如果后续还有 Tool，用户可能希望合并后续的 Tool。
    // 让我们保守一点，将其视为 'mixed'，不参与外部聚合。
    // logger.debug('subagentGrouping', '[subagentGrouping] Message NOT aggregatable (mixed thinking+tool);:', message.uuid);
    return null;
  }

  if (hasThinking) {
    // logger.debug('subagentGrouping', '[subagentGrouping] Message aggregatable as thinking:', message.uuid);
    return "thinking";
  }
  if (hasTool) {
    // logger.debug('subagentGrouping', '[subagentGrouping] Message aggregatable as tool:', message.uuid);
    return "tool";
  }

  return null;
}

/**
 * 对消息列表进行分组
 *
 * @param messages 原始消息列表
 * @returns 分组后的消息列表
 *
 * ✅ FIX: 支持并行 Task 调用
 * 当 Claude 在一条消息中并行调用多个子代理时，每个 Task 都应该被正确分组
 *
 * 🔧 FIX v2.3: 优化算法复杂度从 O(n²) 到 O(n)
 * - 使用 Map 预处理 parent_tool_use_id 索引
 * - 避免对每个 Task 都遍历所有后续消息
 */
export function groupMessages(messages: ClaudeStreamMessage[]): MessageGroup[] {
  // logger.debug('subagentGrouping', '[subagentGrouping] 🔍 Starting groupMessages with', messages.length, 'messages');

  const processedIndices = new Set<number>();

  // 🔧 优化：第一遍预处理，构建 parent_tool_use_id -> 消息索引列表 的映射
  // 这样后续查找子代理消息只需要 O(1) 而不是 O(n)
  const parentIdToMessagesMap = new Map<string, { message: ClaudeStreamMessage; index: number }[]>();

  messages.forEach((message, index) => {
    const parentId = getParentToolUseId(message);
    if (parentId) {
      if (!parentIdToMessagesMap.has(parentId)) {
        parentIdToMessagesMap.set(parentId, []);
      }
      parentIdToMessagesMap.get(parentId)!.push({ message, index });
    }
  });

  // 第一遍：识别所有 Task 工具调用
  // 记录每个 Task ID 对应的消息和索引
  const taskToolUseMap = new Map<string, { message: ClaudeStreamMessage; index: number }>();
  // 记录每个消息索引对应的所有 Task ID（支持并行 Task）
  const indexToTaskIds = new Map<number, string[]>();
  // 记录每个 Task ID 对应的子代理类型
  const taskSubagentTypes = new Map<string, string | undefined>();

  messages.forEach((message, index) => {
    const taskIds = extractTaskToolUseIds(message);
    if (taskIds.length > 0) {
      indexToTaskIds.set(index, taskIds);
      // 提取详细信息（包括 subagent_type）
      const details = extractTaskToolDetails(message);
      taskIds.forEach((taskId) => {
        taskToolUseMap.set(taskId, { message, index });
        const detail = details.get(taskId);
        if (detail?.subagentType) {
          taskSubagentTypes.set(taskId, detail.subagentType);
        }
      });
    }
  });

  // 🔧 优化：第二遍使用预处理的 Map 直接获取子代理消息，O(1) 查找
  const subagentGroups = new Map<string, SubagentGroup>();

  taskToolUseMap.forEach((taskInfo, taskId) => {
    // 🔧 优化：直接从 Map 获取，不需要遍历所有消息
    const childMessages = parentIdToMessagesMap.get(taskId) || [];

    if (childMessages.length > 0) {
      // 按索引排序，确保消息顺序正确
      childMessages.sort((a, b) => a.index - b.index);

      const subagentMessages = childMessages.map(item => item.message);
      const maxIndex = childMessages[childMessages.length - 1].index;

      subagentGroups.set(taskId, {
        id: taskId,
        taskMessage: taskInfo.message,
        taskToolUseId: taskId,
        subagentMessages,
        startIndex: taskInfo.index,
        endIndex: maxIndex,
        subagentType: taskSubagentTypes.get(taskId),
      });
    }
  });

  // 标记所有子代理消息的索引（避免重复渲染）
  // 🔧 优化：直接使用预处理的 Map
  for (const [parentId, childMessages] of parentIdToMessagesMap) {
    if (subagentGroups.has(parentId)) {
      childMessages.forEach(item => processedIndices.add(item.index));
    }
  }

  // 记录已添加的 Task 组（避免重复）
  const addedTaskGroups = new Set<string>();

  // 临时存储初步分组结果
  const intermediateGroups: MessageGroup[] = [];

  // 第三遍：构建初步的分组列表
  messages.forEach((message, index) => {
    // 跳过已被归入子代理组的消息
    if (processedIndices.has(index)) {
      return;
    }

    // 检查是否是包含 Task 调用的消息
    const taskIds = indexToTaskIds.get(index);

    if (taskIds && taskIds.length > 0) {
      // ✅ FIX: 遍历所有 Task ID，为每个有子代理消息的 Task 创建分组
      taskIds.forEach((taskId) => {
        if (subagentGroups.has(taskId) && !addedTaskGroups.has(taskId)) {
          const group = subagentGroups.get(taskId)!;
          intermediateGroups.push({
            type: "subagent",
            id: `subagent-${group.id}`,
            group,
          });
          addedTaskGroups.add(taskId);
        }
      });

      // 如果该消息的所有 Task 都没有子代理消息（可能是正在执行中），
      // 仍然作为普通消息显示
      const hasAnySubagentGroup = taskIds.some((id) => subagentGroups.has(id));
      if (!hasAnySubagentGroup) {
        intermediateGroups.push({
          type: "normal",
          id: getMessageId(message, index),
          message,
          index,
        });
      }
    } else {
      // 普通消息
      intermediateGroups.push({
        type: "normal",
        id: getMessageId(message, index),
        message,
        index,
      });
    }
  });

  // 第四遍：合并连续的技术性消息（Tools & Thinking）
  // ✅ FIX: 仅允许同类型的技术性消息合并（Thinking 与 Tool 分离）
  const finalGroups: MessageGroup[] = [];
  let currentAggregation: {
    messages: ClaudeStreamMessage[];
    startIndex: number;
    aggType: "tool" | "thinking"; // 记录当前聚合组的类型
  } | null = null;

  for (const group of intermediateGroups) {
    // 如果是子代理组，打断聚合
    if (group.type === "subagent") {
      if (currentAggregation) {
        finalGroups.push({
          type: "aggregated",
          id: getAggregatedGroupId(currentAggregation.messages, currentAggregation.startIndex),
          messages: currentAggregation.messages,
          index: currentAggregation.startIndex,
        });
        currentAggregation = null;
      }
      finalGroups.push(group);
      continue;
    }

    // 处理普通消息
    if (group.type === "normal") {
      const msg = group.message;
      const msgType = getTechnicalMessageType(msg);

      if (msgType) {
        // 如果有正在进行的聚合
        if (currentAggregation) {
          // 检查类型是否一致
          if (currentAggregation.aggType === msgType) {
            // 类型一致，合并
            currentAggregation.messages.push(msg);
          } else {
            // 类型不一致（例如 Thinking -> Tool），结算上一个聚合，开始新的聚合
            finalGroups.push({
              type: "aggregated",
              id: getAggregatedGroupId(currentAggregation.messages, currentAggregation.startIndex),
              messages: currentAggregation.messages,
              index: currentAggregation.startIndex,
            });
            currentAggregation = {
              messages: [msg],
              startIndex: group.index,
              aggType: msgType,
            };
          }
        } else {
          // 开始新的聚合
          currentAggregation = {
            messages: [msg],
            startIndex: group.index,
            aggType: msgType,
          };
        }
      } else {
        // 不可聚合的消息（文本等），结算之前的聚合
        // logger.debug('subagentGrouping', '[subagentGrouping] Non-aggregatable message (has text);, adding as normal group:', {
        //   uuid: msg.uuid,
        //   type: msg.type,
        //   hasContent: !!msg.message?.content,
        //   contentPreview: msg.message?.content ? JSON.stringify(msg.message.content).substring(0, 200) : 'no content'
        // });
        if (currentAggregation) {
          finalGroups.push({
            type: "aggregated",
            id: getAggregatedGroupId(currentAggregation.messages, currentAggregation.startIndex),
            messages: currentAggregation.messages,
            index: currentAggregation.startIndex,
          });
          currentAggregation = null;
        }
        finalGroups.push(group);
      }
    } else {
      // 理论上不会执行到这里，但为了类型安全直接推入
      finalGroups.push(group);
    }
  }

  // 结算最后的聚合
  if (currentAggregation) {
    finalGroups.push({
      type: "aggregated",
      id: getAggregatedGroupId(currentAggregation.messages, currentAggregation.startIndex),
      messages: currentAggregation.messages,
      index: currentAggregation.startIndex,
    });
  }

  return finalGroups;
}

/**
 * 检查消息是否应该被隐藏（已被分组的子代理消息）
 */
export function shouldHideMessage(message: ClaudeStreamMessage, groups: MessageGroup[]): boolean {
  // 如果消息是子代理消息，检查是否已被分组
  if (isSubagentMessage(message)) {
    const parentId = getParentToolUseId(message);
    if (parentId) {
      // 检查是否有对应的子代理组
      return groups.some((g) => g.type === "subagent" && g.group.taskToolUseId === parentId);
    }
  }
  return false;
}

/**
 * 获取子代理消息的类型标识
 */
export function getSubagentMessageRole(
  message: ClaudeStreamMessage,
): "user" | "assistant" | "system" | "other" {
  // 子代理发送给主代理的提示词被标记为 user 类型，但应该显示为子代理的输出
  if (message.type === "user" && isSubagentMessage(message)) {
    // 检查是否有文本内容（子代理的提示词）
    const content = message.message?.content;
    if (Array.isArray(content)) {
      const hasText = content.some((item: any) => item.type === "text");
      if (hasText) {
        return "assistant"; // 子代理的输出
      }
    }
  }

  return message.type as any;
}
