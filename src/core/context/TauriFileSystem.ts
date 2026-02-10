/**
 * TauriFileSystem - Tauri IPC 文件系统实现
 *
 * 实现 FileSystem 接口，使用 Tauri IPC 调用后端文件操作命令
 */

import { invoke } from "@tauri-apps/api/core";
import { logger } from "@/lib/logger";
import type { FileSystem } from "./ReferenceResolver";

interface FileStats {
  is_directory: boolean;
  is_file: boolean;
  size: number;
}

/**
 * Tauri IPC 文件系统实现
 */
export class TauriFileSystem implements FileSystem {
  /**
   * 读取文件内容
   */
  async readFile(path: string): Promise<string> {
    try {
      const result = await invoke<{ success: boolean; content?: string; error?: string }>(
        "super_agent_read_file",
        { path }
      );

      if (!result.success || !result.content) {
        throw new Error(result.error || "Failed to read file");
      }

      return result.content;
    } catch (error) {
      logger.error("TauriFileSystem", `[TauriFileSystem] readFile failed for ${path}:`, error);
      throw error;
    }
  }

  /**
   * 读取目录内容
   */
  async readDir(path: string): Promise<string[]> {
    try {
      const entries = await invoke<string[]>("super_agent_read_dir", { path });
      return entries;
    } catch (error) {
      logger.error("TauriFileSystem", `[TauriFileSystem] readDir failed for ${path}:`, error);
      throw error;
    }
  }

  /**
   * 获取文件/目录状态
   */
  async stat(path: string): Promise<{ isDirectory: boolean; size: number }> {
    try {
      const stats = await invoke<FileStats>("super_agent_stat", { path });
      return {
        isDirectory: stats.is_directory,
        size: stats.size,
      };
    } catch (error) {
      logger.error("TauriFileSystem", `[TauriFileSystem] stat failed for ${path}:`, error);
      throw error;
    }
  }

  /**
   * 检查文件/目录是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      const exists = await invoke<boolean>("super_agent_exists", { path });
      return exists;
    } catch (error) {
      logger.error("TauriFileSystem", `[TauriFileSystem] exists failed for ${path}:`, error);
      // 如果检查失败，返回 false
      return false;
    }
  }
}

/**
 * 创建 Tauri 文件系统实例
 */
export function createTauriFileSystem(): FileSystem {
  return new TauriFileSystem();
}
