/**
 * API 重试包装器
 * 为 Tauri invoke 调用提供自动重试功能
 *
 * _Requirements: 2.2_
 */

import { invoke } from "@tauri-apps/api/core";
import {
  withRetry,
  withAPIRetry,
  type RetryConfig,
  type RetryResult,
} from "../services/retryService";

/**
 * 可重试的 Tauri 错误模式
 */
const RETRYABLE_TAURI_ERRORS = [
  "network",
  "timeout",
  "connection",
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
];

/**
 * 带重试的 Tauri invoke 调用
 *
 * @param cmd Tauri 命令名
 * @param args 命令参数
 * @param config 重试配置（可选）
 * @returns 重试结果
 */
export async function invokeWithRetry<T>(
  cmd: string,
  args?: Record<string, unknown>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  return withRetry<T>(() => invoke<T>(cmd, args), {
    ...config,
    retryableErrors: RETRYABLE_TAURI_ERRORS,
    onRetry: (attempt, error, delay) => {
      console.warn(
        `[RetryWrapper] Retrying ${cmd} (attempt ${attempt}), error: ${error.message}, delay: ${delay}ms`
      );
    },
  });
}

/**
 * 带重试的 Tauri invoke 调用（简化版，直接返回数据或抛出错误）
 *
 * @param cmd Tauri 命令名
 * @param args 命令参数
 * @param config 重试配置（可选）
 * @returns 命令结果
 * @throws 如果所有重试都失败
 */
export async function invokeWithRetryOrThrow<T>(
  cmd: string,
  args?: Record<string, unknown>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const result = await invokeWithRetry<T>(cmd, args, config);

  if (result.success) {
    return result.data as T;
  }

  throw result.error;
}

/**
 * 带重试的 fetch 调用
 *
 * @param url 请求 URL
 * @param options fetch 选项
 * @param config 重试配置（可选）
 * @returns 重试结果
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config?: Partial<RetryConfig>
): Promise<RetryResult<Response>> {
  return withAPIRetry(async () => {
    const response = await fetch(url, options);

    // 对于 5xx 错误，抛出可重试的错误
    if (response.status >= 500) {
      throw new Error(`${response.status} Server Error`);
    }

    // 对于 429 错误，抛出可重试的错误
    if (response.status === 429) {
      throw new Error("429 Rate Limited");
    }

    return response;
  }, config);
}

/**
 * 带重试的 fetch 调用（简化版，直接返回响应或抛出错误）
 *
 * @param url 请求 URL
 * @param options fetch 选项
 * @param config 重试配置（可选）
 * @returns fetch 响应
 * @throws 如果所有重试都失败
 */
export async function fetchWithRetryOrThrow(
  url: string,
  options?: RequestInit,
  config?: Partial<RetryConfig>
): Promise<Response> {
  const result = await fetchWithRetry(url, options, config);

  if (result.success) {
    return result.data as Response;
  }

  throw result.error;
}

/**
 * 创建带重试的 API 客户端
 *
 * @param baseUrl API 基础 URL
 * @param defaultHeaders 默认请求头
 * @param defaultConfig 默认重试配置
 */
export function createRetryableAPIClient(
  baseUrl: string,
  defaultHeaders?: Record<string, string>,
  defaultConfig?: Partial<RetryConfig>
) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    /**
     * GET 请求
     */
    async get<T>(path: string, config?: Partial<RetryConfig>): Promise<T> {
      const response = await fetchWithRetryOrThrow(
        `${normalizedBaseUrl}${path}`,
        {
          method: "GET",
          headers: defaultHeaders,
        },
        { ...defaultConfig, ...config }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },

    /**
     * POST 请求
     */
    async post<T>(path: string, body?: unknown, config?: Partial<RetryConfig>): Promise<T> {
      const response = await fetchWithRetryOrThrow(
        `${normalizedBaseUrl}${path}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...defaultHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        { ...defaultConfig, ...config }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },

    /**
     * PUT 请求
     */
    async put<T>(path: string, body?: unknown, config?: Partial<RetryConfig>): Promise<T> {
      const response = await fetchWithRetryOrThrow(
        `${normalizedBaseUrl}${path}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...defaultHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        { ...defaultConfig, ...config }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },

    /**
     * DELETE 请求
     */
    async delete<T>(path: string, config?: Partial<RetryConfig>): Promise<T> {
      const response = await fetchWithRetryOrThrow(
        `${normalizedBaseUrl}${path}`,
        {
          method: "DELETE",
          headers: defaultHeaders,
        },
        { ...defaultConfig, ...config }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
  };
}
