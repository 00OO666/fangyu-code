import { logger } from "@/lib/logger";

/**
 * 代码格式化历史服务
 *
 * 记录 Biome 自动格式化的所有改动，支持查看历史和撤销
 */

export interface FormatChange {
  filePath: string;
  timestamp: number;
  formattedAt: string;
  changes: {
    line?: number;
    type: "indent" | "quote" | "semicolon" | "lineending" | "spacing" | "trailing-comma" | "other";
    description: string;
    before?: string;
    after?: string;
  }[];
  summary: string;
  undoAvailable: boolean;
}

const FORMAT_HISTORY_KEY = "fangyu_code_format_history";
const MAX_HISTORY = 50; // 最多保存 50 条记录

class CodeFormatService {
  private history: FormatChange[] = [];

  constructor() {
    this.loadHistory();
  }

  /**
   * 加载历史记录
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(FORMAT_HISTORY_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      logger.error("codeFormatService", "[CodeFormatService] Failed to load history:", e);
      this.history = [];
    }
  }

  /**
   * 保存历史记录
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(FORMAT_HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {
      logger.error("codeFormatService", "[CodeFormatService] Failed to save history:", e);
    }
  }

  /**
   * 添加格式化记录
   */
  addFormatRecord(record: Omit<FormatChange, "timestamp" | "formattedAt">): void {
    const newRecord: FormatChange = {
      ...record,
      timestamp: Date.now(),
      formattedAt: new Date().toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    this.history.unshift(newRecord);

    // 限制历史记录数量
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.saveHistory();
  }

  /**
   * 获取所有历史记录
   */
  getHistory(): FormatChange[] {
    return [...this.history];
  }

  /**
   * 获取指定文件的历史记录
   */
  getFileHistory(filePath: string): FormatChange[] {
    return this.history.filter((record) => record.filePath === filePath);
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * 删除单条记录
   */
  deleteRecord(timestamp: number): void {
    this.history = this.history.filter((record) => record.timestamp !== timestamp);
    this.saveHistory();
  }

  /**
   * 生成格式化摘要
   */
  generateSummary(changes: FormatChange["changes"], filePath: string): string {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const changeCount = changes.length;

    if (changeCount === 0) {
      return `${fileName} 已格式化`;
    }

    const typeCounts = changes.reduce(
      (acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const summaryParts: string[] = [];

    if (typeCounts.indent) summaryParts.push(`${typeCounts.indent} 处缩进`);
    if (typeCounts.quote) summaryParts.push(`${typeCounts.quote} 处引号`);
    if (typeCounts.semicolon) summaryParts.push(`${typeCounts.semicolon} 处分号`);
    if (typeCounts.lineending) summaryParts.push(`${typeCounts.lineending} 处换行`);
    if (typeCounts.spacing) summaryParts.push(`${typeCounts.spacing} 处空格`);
    if (typeCounts["trailing-comma"]) summaryParts.push(`${typeCounts["trailing-comma"]} 处逗号`);
    if (typeCounts.other) summaryParts.push(`${typeCounts.other} 处其他`);

    return `${fileName} 已格式化 (${summaryParts.join(", ")})`;
  }

  /**
   * 导出为可复制文本（用于发送给 AI 分析）
   */
  exportToText(record: FormatChange): string {
    const lines: string[] = [
      `## Biome 格式化记录`,
      ``,
      `**文件**: ${record.filePath}`,
      `**时间**: ${record.formattedAt}`,
      `**摘要**: ${record.summary}`,
      ``,
      `### 修改详情`,
      ``,
    ];

    if (record.changes.length === 0) {
      lines.push(`无具体改动记录`);
    } else {
      record.changes.forEach((change, index) => {
        lines.push(`${index + 1}. **${change.type}**: ${change.description}`);
        if (change.before) {
          lines.push(`   - 修改前: \`${change.before}\``);
        }
        if (change.after) {
          lines.push(`   - 修改后: \`${change.after}\``);
        }
      });
    }

    lines.push(``, `---`, ``);

    return lines.join("\n");
  }

  /**
   * 导出多条记录
   */
  exportMultipleToText(records: FormatChange[]): string {
    return records.map((record) => this.exportToText(record)).join("\n");
  }
}

// 单例实例
export const codeFormatService = new CodeFormatService();
