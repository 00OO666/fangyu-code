/**
 * 会话摘要生成器
 *
 * 从旧会话中提取关键信息，生成详细摘要用于新会话续接
 *
 * @author Claude Opus 4.5
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import type {
  FileSummary,
  MessageSummary,
  SessionSummary,
  TaskSummary,
} from "@/types/session-continue";

/**
 * 摘要生成配置
 */
interface SummarizerConfig {
  /** 保留最近消息数 */
  recentMessagesCount: number;
  /** 摘要详细程度 */
  verbosity: "concise" | "detailed";
  /** 项目路径 */
  projectPath: string;
  /** 会话 ID */
  sessionId: string;
}

/**
 * 会话历史消息类型
 */
interface HistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: string;
  }>;
}

/**
 * 从消息历史中提取 TodoList 状态
 */
export function extractTodoList(messages: HistoryMessage[]): SessionSummary["todoList"] {
  const completed: TaskSummary[] = [];
  const inProgress: TaskSummary[] = [];
  const pending: TaskSummary[] = [];

  // 从最新的消息开始搜索 TodoList
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    // 查找 TodoList 相关的工具调用
    if (msg.toolCalls) {
      const todoCall = msg.toolCalls.find((tc) => tc.name === "TodoWrite");
      if (
        todoCall &&
        todoCall.input &&
        Array.isArray((todoCall.input as { todos?: unknown[] }).todos)
      ) {
        const todos = (
          todoCall.input as {
            todos: Array<{ content: string; status: string; activeForm?: string }>;
          }
        ).todos;
        todos.forEach((todo, index) => {
          const task: TaskSummary = {
            id: `task-${index}`,
            content: todo.content,
            status: todo.status as TaskSummary["status"],
          };

          switch (todo.status) {
            case "completed":
              completed.push(task);
              break;
            case "in_progress":
              inProgress.push(task);
              break;
            case "pending":
              pending.push(task);
              break;
          }
        });
        // 找到最新的 TodoList 后退出
        break;
      }
    }

    // 也可以从消息内容中提取（如果有特定格式）
    const todoPattern = /\[?(completed|in_progress|pending)\]?\s*(.+)/gi;
    const matches = msg.content.matchAll(todoPattern);
    for (const match of matches) {
      const status = match[1].toLowerCase() as TaskSummary["status"];
      const content = match[2].trim();
      const task: TaskSummary = {
        id: `content-task-${Math.random().toString(36).slice(2, 8)}`,
        content,
        status,
      };

      switch (status) {
        case "completed":
          if (!completed.some((t) => t.content === content)) {
            completed.push(task);
          }
          break;
        case "in_progress":
          if (!inProgress.some((t) => t.content === content)) {
            inProgress.push(task);
          }
          break;
        case "pending":
          if (!pending.some((t) => t.content === content)) {
            pending.push(task);
          }
          break;
      }
    }
  }

  return { completed, inProgress, pending };
}

/**
 * 从消息历史中提取修改文件列表
 */
export function extractModifiedFiles(messages: HistoryMessage[]): FileSummary[] {
  const files = new Map<string, FileSummary>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.toolCalls) continue;

    for (const tc of msg.toolCalls) {
      const input = tc.input as Record<string, string>;

      if (tc.name === "Write" && input.file_path) {
        files.set(input.file_path, {
          path: input.file_path,
          operation: "created",
          description: `创建文件`,
        });
      }

      if (tc.name === "Edit" && input.file_path) {
        const existing = files.get(input.file_path);
        if (!existing || existing.operation !== "created") {
          files.set(input.file_path, {
            path: input.file_path,
            operation: "modified",
            description: `修改文件`,
          });
        }
      }

      if (tc.name === "Bash" && input.command) {
        // 检测删除命令
        const deleteMatch = input.command.match(/rm\s+(-rf?\s+)?['""]?([^'""\s]+)['""]?/);
        if (deleteMatch) {
          const deletedPath = deleteMatch[2];
          files.set(deletedPath, {
            path: deletedPath,
            operation: "deleted",
            description: `删除文件`,
          });
        }
      }
    }
  }

  return Array.from(files.values());
}

/**
 * 从消息历史中提取关键决策
 */
export function extractKeyDecisions(messages: HistoryMessage[]): string[] {
  const decisions: string[] = [];
  const decisionKeywords = [
    "决定使用",
    "选择",
    "采用",
    "决定",
    "方案是",
    "将使用",
    "decided to",
    "will use",
    "choosing",
    "going with",
    "因为",
    "所以",
    "建议",
    "推荐",
    "最佳选择",
  ];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;

    // 检查是否包含决策关键词
    for (const keyword of decisionKeywords) {
      if (msg.content.toLowerCase().includes(keyword.toLowerCase())) {
        // 提取包含关键词的句子
        const sentences = msg.content.split(/[。！？\n]/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
            const trimmed = sentence.trim();
            if (trimmed.length > 10 && trimmed.length < 200) {
              if (!decisions.includes(trimmed)) {
                decisions.push(trimmed);
              }
            }
          }
        }
      }
    }
  }

  // 限制决策数量
  return decisions.slice(-10);
}

/**
 * 提取最近重要消息
 */
export function extractRecentMessages(messages: HistoryMessage[], count: number): MessageSummary[] {
  const result: MessageSummary[] = [];

  // 从最新消息开始，过滤并提取
  for (let i = messages.length - 1; i >= 0 && result.length < count; i--) {
    const msg = messages[i];
    if (msg.role === "system") continue;

    // 判断消息重要性
    const isImportant =
      msg.content.length > 50 ||
      !!(msg.toolCalls && msg.toolCalls.length > 0) ||
      msg.content.includes("完成") ||
      msg.content.includes("创建") ||
      msg.content.includes("修改") ||
      msg.content.includes("错误") ||
      msg.content.includes("成功");

    // 压缩消息内容（如果太长）
    let content = msg.content;
    if (content.length > 200) {
      content = content.slice(0, 197) + "...";
    }

    result.unshift({
      role: msg.role as "user" | "assistant",
      content,
      timestamp: msg.timestamp,
      important: isImportant,
    });
  }

  return result;
}

/**
 * 生成 Markdown 格式的摘要文本
 */
export function generateSummaryText(summary: Omit<SessionSummary, "summaryText">): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# 会话继承自 Session #${summary.sessionId.slice(0, 8)}`);
  lines.push("");

  // 项目信息
  lines.push("## 项目信息");
  lines.push(`- **路径**: ${summary.project.path}`);
  lines.push(`- **名称**: ${summary.project.name}`);
  if (summary.project.techStack?.length) {
    lines.push(`- **技术栈**: ${summary.project.techStack.join(", ")}`);
  }
  lines.push("");

  // TodoList 状态
  if (summary.todoList) {
    const { completed, inProgress, pending } = summary.todoList;
    const total = completed.length + inProgress.length + pending.length;

    if (total > 0) {
      lines.push("## 任务进度");
      lines.push(`进度: ${completed.length}/${total} 已完成`);
      lines.push("");

      for (const task of completed) {
        lines.push(`- [x] ~~${task.content}~~`);
      }
      for (const task of inProgress) {
        lines.push(`- [ ] **${task.content}** *(进行中)*`);
      }
      for (const task of pending) {
        lines.push(`- [ ] ${task.content}`);
      }
      lines.push("");
    }
  }

  // 修改文件
  if (summary.modifiedFiles.length > 0) {
    lines.push("## 最近修改的文件");
    for (const file of summary.modifiedFiles) {
      const icon = file.operation === "created" ? "+" : file.operation === "deleted" ? "-" : "~";
      lines.push(`- \`${icon}\` ${file.path}`);
    }
    lines.push("");
  }

  // 关键决策
  if (summary.keyDecisions.length > 0) {
    lines.push("## 关键决策");
    for (const decision of summary.keyDecisions) {
      lines.push(`- ${decision}`);
    }
    lines.push("");
  }

  // 最近对话摘要
  if (summary.recentMessages.length > 0) {
    lines.push("## 最近对话");
    for (const msg of summary.recentMessages) {
      const role = msg.role === "user" ? "👤 User" : "🤖 Assistant";
      const content = msg.content.replace(/\n/g, " ").slice(0, 100);
      lines.push(`- **${role}**: ${content}${msg.content.length > 100 ? "..." : ""}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*摘要生成于 ${new Date(summary.generatedAt).toLocaleString()}*`);

  return lines.join("\n");
}

/**
 * 生成失败时的回退摘要
 */
function createFallbackSummary(config: SummarizerConfig, errorMessage: string): SessionSummary {
  const projectName = config.projectPath.split(/[/\\]/).pop() || "Unknown";
  const fallbackText = [
    `# 会话继承自 Session #${config.sessionId.slice(0, 8)}`,
    "",
    "## ⚠️ 摘要生成失败",
    "",
    `由于技术原因，无法生成完整摘要。错误信息：${errorMessage}`,
    "",
    "请手动查看上一个会话的内容，或重新开始新会话。",
    "",
    "## 项目信息",
    `- **路径**: ${config.projectPath}`,
    `- **名称**: ${projectName}`,
    "",
    "---",
    `*回退摘要生成于 ${new Date().toLocaleString()}*`,
  ].join("\n");

  return {
    sessionId: config.sessionId,
    project: {
      path: config.projectPath,
      name: projectName,
      techStack: [],
    },
    todoList: { completed: [], inProgress: [], pending: [] },
    modifiedFiles: [],
    keyDecisions: [],
    recentMessages: [],
    generatedAt: Date.now(),
    summaryText: fallbackText,
  };
}

/**
 * 主函数：生成完整会话摘要
 */
export async function generateSessionSummary(
  messages: HistoryMessage[],
  config: SummarizerConfig
): Promise<SessionSummary> {
  logger.debug(
    "sessionSummarizer",
    "[SessionSummarizer] Generating summary for session:",
    config.sessionId
  );
  logger.debug("sessionSummarizer", "[SessionSummarizer] Total messages:", messages.length);

  try {
    // 1. 提取 TodoList 状态
    const todoList = extractTodoList(messages);
    logger.debug("sessionSummarizer", "[SessionSummarizer] TodoList extracted:", {
      completed: todoList?.completed?.length ?? 0,
      inProgress: todoList?.inProgress?.length ?? 0,
      pending: todoList?.pending?.length ?? 0,
    });

    // 2. 提取修改文件
    const modifiedFiles = extractModifiedFiles(messages);
    logger.debug("sessionSummarizer", "[SessionSummarizer] Modified files:", modifiedFiles.length);

    // 3. 提取关键决策
    const keyDecisions = extractKeyDecisions(messages);
    logger.debug("sessionSummarizer", "[SessionSummarizer] Key decisions:", keyDecisions.length);

    // 4. 提取最近消息
    const recentMessages = extractRecentMessages(messages, config.recentMessagesCount);
    logger.debug(
      "sessionSummarizer",
      "[SessionSummarizer] Recent messages:",
      recentMessages.length
    );

    // 5. 构建项目信息
    const projectName = config.projectPath.split(/[/\\]/).pop() || "Unknown";

    // 6. 构建摘要对象
    const summaryBase: Omit<SessionSummary, "summaryText"> = {
      sessionId: config.sessionId,
      project: {
        path: config.projectPath,
        name: projectName,
        techStack: [], // TODO: 从项目配置中读取
      },
      todoList,
      modifiedFiles,
      keyDecisions,
      recentMessages,
      generatedAt: Date.now(),
    };

    // 7. 生成摘要文本
    const summaryText = generateSummaryText(summaryBase);

    const summary: SessionSummary = {
      ...summaryBase,
      summaryText,
    };

    logger.debug("sessionSummarizer", "[SessionSummarizer] Summary generated successfully");
    logger.debug(
      "sessionSummarizer",
      "[SessionSummarizer] Summary text length:",
      summaryText.length,
      "chars"
    );

    return summary;
  } catch (error) {
    // 详细错误日志
    const errorInfo = {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      context: {
        sessionId: config.sessionId,
        projectPath: config.projectPath,
        messagesCount: messages.length,
        verbosity: config.verbosity,
      },
    };

    logger.error(
      "sessionSummarizer",
      "[SessionSummarizer] ❌ Failed to generate summary:",
      errorInfo
    );

    // 返回用户友好的回退摘要
    return createFallbackSummary(config, errorInfo.errorMessage);
  }
}

export default generateSessionSummary;
