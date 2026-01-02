/**
 * useGitAutoCommit - Git 自动提交 Hook
 *
 * 功能:
 * - 监听文件修改，自动创建提交
 * - 智能生成提交消息
 * - 支持提交前钩子
 * - 配置自动推送
 * - 提交历史管理
 *
 * 来源: Cursor Auto-Commit + Aider Git Integration
 */

import { useCallback, useEffect, useRef, useState } from "react";

// Git 命令执行辅助函数（简化实现）
async function executeGitCommand(
  _projectPath: string,
  _args: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  // TODO: 实现 Git 命令执行
  // 需要添加对应的 Tauri 命令
  return { success: false, error: "Git command not implemented" };
}

// ============================================================
// 类型定义
// ============================================================

export interface AutoCommitConfig {
  /** 是否启用自动提交 */
  enabled: boolean;
  /** 延迟时间（毫秒），修改后多久自动提交 */
  delay: number;
  /** 是否自动推送到远程 */
  autoPush: boolean;
  /** 提交消息前缀 */
  messagePrefix: string;
  /** 最小文件数（少于此数不提交） */
  minFiles: number;
  /** 忽略的文件模式 */
  ignorePatterns: string[];
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
}

export interface PendingCommit {
  files: string[];
  suggestedMessage: string;
  timestamp: number;
}

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_CONFIG: AutoCommitConfig = {
  enabled: false,
  delay: 30000, // 30秒
  autoPush: false,
  messagePrefix: "[Auto]",
  minFiles: 1,
  ignorePatterns: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "*.log",
    ".DS_Store",
    "Thumbs.db",
  ],
};

// ============================================================
// Hook
// ============================================================

interface UseGitAutoCommitOptions {
  /** 项目路径 */
  projectPath: string;
  /** 初始配置 */
  initialConfig?: Partial<AutoCommitConfig>;
  /** 提交前回调（返回 false 取消提交） */
  onBeforeCommit?: (files: string[], message: string) => Promise<boolean>;
  /** 提交后回调 */
  onAfterCommit?: (commit: CommitInfo) => void;
}

export function useGitAutoCommit(options: UseGitAutoCommitOptions) {
  const { projectPath, initialConfig, onBeforeCommit, onAfterCommit } = options;

  // 配置状态
  const [config, setConfig] = useState<AutoCommitConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  // 运行时状态
  const [pendingCommit, setPendingCommit] = useState<PendingCommit | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitHistory, setCommitHistory] = useState<CommitInfo[]>([]);
  const [lastCommitTime, setLastCommitTime] = useState<number | null>(null);

  const commitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<AutoCommitConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * 检查文件是否应该被忽略
   */
  const shouldIgnore = useCallback(
    (filePath: string): boolean => {
      return config.ignorePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
        return regex.test(filePath);
      });
    },
    [config.ignorePatterns],
  );

  /**
   * 获取修改的文件列表
   */
  const getChangedFiles = useCallback(async (): Promise<string[]> => {
    try {
      // 通过 git status 获取修改的文件
      const result = await executeGitCommand(projectPath, "status --porcelain");

      if (!result.success || !result.output) {
        return [];
      }

      // 解析 git status 输出
      const files = result.output
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          // Git status 格式: " M file.txt" 或 "?? file.txt"
          const match = line.match(/^\s*[MADRCU?]{1,2}\s+(.+)$/);
          return match ? match[1].trim() : null;
        })
        .filter((file): file is string => file !== null && !shouldIgnore(file));

      return files;
    } catch (error) {
      console.error("获取修改文件失败:", error);
      return [];
    }
  }, [projectPath, shouldIgnore]);

  /**
   * 生成智能提交消息
   */
  const generateCommitMessage = useCallback(
    async (files: string[]): Promise<string> => {
      if (files.length === 0) {
        return `${config.messagePrefix} 空提交`;
      }

      try {
        // 获取 diff 内容
        const diffResult = await executeGitCommand(projectPath, "diff --cached --stat");

        if (!diffResult.success || !diffResult.output) {
          // 回退到简单消息
          if (files.length === 1) {
            return `${config.messagePrefix} 更新 ${files[0]}`;
          }
          return `${config.messagePrefix} 更新 ${files.length} 个文件`;
        }

        // 分析修改类型
        const hasNewFiles = files.some((f) => diffResult.output!.includes(`${f} | 0`));
        const hasModifications = files.some(
          (f) => diffResult.output!.includes(f) && !diffResult.output!.includes(`${f} | 0`),
        );

        let action = "更新";
        if (hasNewFiles && !hasModifications) {
          action = "添加";
        } else if (hasNewFiles && hasModifications) {
          action = "添加和更新";
        }

        // 提取主要修改的文件类型
        const extensions = files
          .map((f) => f.split(".").pop())
          .filter((ext): ext is string => Boolean(ext));
        const uniqueExts = [...new Set(extensions)];

        let fileTypeDesc = "";
        if (uniqueExts.length === 1) {
          const extMap: Record<string, string> = {
            ts: "TypeScript",
            tsx: "React",
            js: "JavaScript",
            jsx: "React",
            css: "样式",
            md: "文档",
            json: "配置",
            html: "HTML",
          };
          fileTypeDesc = extMap[uniqueExts[0]] || uniqueExts[0];
        }

        if (files.length === 1) {
          return `${config.messagePrefix} ${action} ${files[0]}`;
        }

        if (fileTypeDesc) {
          return `${config.messagePrefix} ${action} ${fileTypeDesc} 文件 (${files.length} 个)`;
        }

        return `${config.messagePrefix} ${action} ${files.length} 个文件`;
      } catch (error) {
        console.error("生成提交消息失败:", error);
        return `${config.messagePrefix} 更新 ${files.length} 个文件`;
      }
    },
    [config.messagePrefix, projectPath],
  );

  /**
   * 执行提交
   */
  const executeCommit = useCallback(
    async (files: string[], message: string): Promise<CommitInfo | null> => {
      setIsCommitting(true);

      try {
        // 执行提交前钩子
        if (onBeforeCommit) {
          const shouldProceed = await onBeforeCommit(files, message);
          if (!shouldProceed) {
            console.log("提交被前置钩子取消");
            return null;
          }
        }

        // 添加文件到暂存区
        for (const file of files) {
          await executeGitCommand(projectPath, `add "${file}"`);
        }

        // 创建提交
        const commitResult = await executeGitCommand(projectPath, `commit -m "${message}"`);

        if (!commitResult.success) {
          throw new Error(commitResult.error || "提交失败");
        }

        // 获取提交信息
        const logResult = await executeGitCommand(
          projectPath,
          'log -1 --format="%H|%an|%ad" --date=iso',
        );

        const [hash, author, timestamp] = logResult.output?.split("|") || [
          "unknown",
          "unknown",
          new Date().toISOString(),
        ];

        // 获取统计信息
        const statsResult = await executeGitCommand(projectPath, "diff --stat HEAD~1 HEAD");

        let linesAdded = 0;
        let linesRemoved = 0;

        if (statsResult.success && statsResult.output) {
          const match = statsResult.output.match(/(\d+) insertion.*?(\d+) deletion/);
          if (match) {
            linesAdded = parseInt(match[1], 10);
            linesRemoved = parseInt(match[2], 10);
          }
        }

        const commit: CommitInfo = {
          hash,
          message,
          author,
          timestamp,
          filesChanged: files,
          linesAdded,
          linesRemoved,
        };

        setCommitHistory((prev) => [commit, ...prev.slice(0, 99)]);
        setLastCommitTime(Date.now());

        // 自动推送
        if (config.autoPush) {
          await executeGitCommand(projectPath, "push");
        }

        // 执行提交后回调
        onAfterCommit?.(commit);

        return commit;
      } catch (error) {
        console.error("执行提交失败:", error);
        return null;
      } finally {
        setIsCommitting(false);
        setPendingCommit(null);
      }
    },
    [projectPath, config.autoPush, onBeforeCommit, onAfterCommit],
  );

  /**
   * 手动触发提交
   */
  const triggerCommit = useCallback(async (): Promise<CommitInfo | null> => {
    const files = await getChangedFiles();

    if (files.length < config.minFiles) {
      console.log(`修改文件数 (${files.length}) 少于最小值 (${config.minFiles})`);
      return null;
    }

    const message = await generateCommitMessage(files);
    return executeCommit(files, message);
  }, [getChangedFiles, config.minFiles, generateCommitMessage, executeCommit]);

  /**
   * 检查并准备自动提交
   */
  const checkAndPrepareCommit = useCallback(async () => {
    if (!config.enabled || isCommitting) return;

    const files = await getChangedFiles();

    if (files.length < config.minFiles) {
      setPendingCommit(null);
      return;
    }

    const message = await generateCommitMessage(files);

    setPendingCommit({
      files,
      suggestedMessage: message,
      timestamp: Date.now(),
    });

    // 清除旧的定时器
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    // 设置新的定时器
    commitTimerRef.current = setTimeout(async () => {
      await executeCommit(files, message);
    }, config.delay);
  }, [
    config.enabled,
    config.minFiles,
    config.delay,
    isCommitting,
    getChangedFiles,
    generateCommitMessage,
    executeCommit,
  ]);

  /**
   * 取消待处理的提交
   */
  const cancelPendingCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    setPendingCommit(null);
  }, []);

  /**
   * 立即执行待处理的提交
   */
  const executePendingCommit = useCallback(async (): Promise<CommitInfo | null> => {
    if (!pendingCommit) return null;

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    return executeCommit(pendingCommit.files, pendingCommit.suggestedMessage);
  }, [pendingCommit, executeCommit]);

  /**
   * 获取最近的 N 个提交
   */
  const getRecentCommits = useCallback(
    async (count: number = 10): Promise<CommitInfo[]> => {
      try {
        const logResult = await executeGitCommand(
          projectPath,
          `log -${count} --format="%H|%s|%an|%ad" --date=iso --stat`,
        );

        if (!logResult.success || !logResult.output) {
          return [];
        }

        const commits: CommitInfo[] = [];
        const lines = logResult.output.split("\n");
        let currentCommit: Partial<CommitInfo> | null = null;

        for (const line of lines) {
          if (line.includes("|")) {
            if (currentCommit) {
              commits.push(currentCommit as CommitInfo);
            }

            const [hash, message, author, timestamp] = line.split("|");
            currentCommit = {
              hash,
              message,
              author,
              timestamp,
              filesChanged: [],
              linesAdded: 0,
              linesRemoved: 0,
            };
          } else if (currentCommit && line.trim()) {
            // 解析文件和统计信息
            const match = line.match(/(.+?)\s+\|\s+(\d+)/);
            if (match) {
              currentCommit.filesChanged?.push(match[1].trim());
            }
          }
        }

        if (currentCommit) {
          commits.push(currentCommit as CommitInfo);
        }

        return commits;
      } catch (error) {
        console.error("获取提交历史失败:", error);
        return [];
      }
    },
    [projectPath],
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  return {
    // 状态
    config,
    pendingCommit,
    isCommitting,
    commitHistory,
    lastCommitTime,

    // 配置方法
    updateConfig,

    // 提交操作
    triggerCommit,
    checkAndPrepareCommit,
    cancelPendingCommit,
    executePendingCommit,

    // 工具方法
    getChangedFiles,
    generateCommitMessage,
    getRecentCommits,
  };
}

export default useGitAutoCommit;
