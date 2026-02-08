/**
 * search.worker.ts - 搜索 Web Worker
 *
 * 功能:
 * - 后台搜索，不阻塞主线程
 * - 处理大量搜索结果
 * - 支持搜索进度报告
 * - 支持取消搜索
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// 类型定义
// ============================================================================

interface SearchOptions {
  regex: boolean;
  case_sensitive: boolean;
  whole_word: boolean;
  max_results?: number;
  follow_symlinks: boolean;
  file_type?: string;
}

interface SearchResult {
  file_path: string;
  line_number: number;
  column: number;
  line_content: string;
  matched_text: string;
}

interface SearchRequest {
  type: 'search';
  id: string;
  path: string;
  pattern: string;
  options: SearchOptions;
}

interface CancelRequest {
  type: 'cancel';
  id: string;
}

interface ProgressMessage {
  type: 'progress';
  id: string;
  current: number;
  total?: number;
}

interface ResultMessage {
  type: 'result';
  id: string;
  results: SearchResult[];
}

interface ErrorMessage {
  type: 'error';
  id: string;
  error: string;
}

interface CompleteMessage {
  type: 'complete';
  id: string;
}

type WorkerMessage = SearchRequest | CancelRequest;
type WorkerResponse = ProgressMessage | ResultMessage | ErrorMessage | CompleteMessage;

// ============================================================================
// Worker 状态
// ============================================================================

const activeSearches = new Map<string, boolean>();

// ============================================================================
// 搜索逻辑
// ============================================================================

async function performSearch(
  id: string,
  path: string,
  pattern: string,
  options: SearchOptions
): Promise<void> {
  try {
    activeSearches.set(id, true);

    // 发送开始消息
    self.postMessage({
      type: 'progress',
      id,
      current: 0,
    } as ProgressMessage);

    // 调用后端搜索
    const results = await invoke<SearchResult[]>('search_content', {
      path,
      pattern,
      options,
    });

    // 检查是否被取消
    if (!activeSearches.get(id)) {
      return;
    }

    // 分批发送结果（每批 100 个）
    const batchSize = 100;
    for (let i = 0; i < results.length; i += batchSize) {
      // 再次检查是否被取消
      if (!activeSearches.get(id)) {
        return;
      }

      const batch = results.slice(i, i + batchSize);

      // 发送进度
      self.postMessage({
        type: 'progress',
        id,
        current: i + batch.length,
        total: results.length,
      } as ProgressMessage);

      // 发送结果
      self.postMessage({
        type: 'result',
        id,
        results: batch,
      } as ResultMessage);
    }

    // 发送完成消息
    self.postMessage({
      type: 'complete',
      id,
    } as CompleteMessage);
  } catch (error) {
    // 发送错误消息
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : '搜索失败',
    } as ErrorMessage);
  } finally {
    activeSearches.delete(id);
  }
}

// ============================================================================
// Worker 消息处理
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'search': {
      const { id, path, pattern, options } = message;
      performSearch(id, path, pattern, options);
      break;
    }

    case 'cancel': {
      const { id } = message;
      activeSearches.delete(id);
      break;
    }

    default:
      console.warn('[search.worker] Unknown message type:', message);
  }
};

// 导出类型供主线程使用
export type {
  SearchRequest,
  CancelRequest,
  ProgressMessage,
  ResultMessage,
  ErrorMessage,
  CompleteMessage,
  WorkerMessage,
  WorkerResponse,
};
