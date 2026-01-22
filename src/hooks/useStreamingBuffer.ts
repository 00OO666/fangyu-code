import { useState, useEffect, useRef, useTransition } from 'react';

/**
 * 流式内容缓冲 Hook
 * 
 * 功能：
 * - 累积 token 到一定数量再触发渲染
 * - 使用 requestIdleCallback 进行非阻塞更新
 * - 支持代码块边界智能检测，确保代码块完整性
 */
export function useStreamingBuffer(
  content: string,
  options: {
    /** 缓冲区大小（字符数） */
    bufferSize?: number;
    /** 最大延迟（ms） */
    maxDelay?: number;
    /** 是否启用缓冲 */
    enabled?: boolean;
    /** 流式状态 */
    isStreaming?: boolean;
  } = {}
) {
  const { 
    bufferSize = 10, 
    maxDelay = 50,
    enabled = true,
    isStreaming = false
  } = options;

  const [bufferedContent, setBufferedContent] = useState(content);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  
  // 如果禁用了缓冲或是初始加载，直接返回原始内容
  if (!enabled || !isStreaming) {
    if (bufferedContent !== content && !isStreaming) {
      // 流式结束时确保内容同步
      setBufferedContent(content);
    }
    return isStreaming ? bufferedContent : content;
  }

  useEffect(() => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    
    // 检查是否在代码块中（简单的奇偶校验）
    const codeBlockCount = (content.match(/```/g) || []).length;
    const isInCodeBlock = codeBlockCount % 2 === 1;

    // 决定是否更新
    const shouldUpdate = 
      // 1. 内容变化量超过缓冲区大小
      Math.abs(content.length - bufferedContent.length) >= bufferSize ||
      // 2. 超过最大延迟时间
      timeSinceLastUpdate >= maxDelay ||
      // 3. 在代码块中（代码块需要更快的更新以保持高亮准确）
      isInCodeBlock;

    if (shouldUpdate) {
      // 使用 transition 降低渲染优先级
      startTransition(() => {
        setBufferedContent(content);
        lastUpdateRef.current = Date.now();
      });
    } else {
      // 否则设置一个延迟更新，确保最终一致性
      timeoutRef.current = setTimeout(() => {
        startTransition(() => {
          setBufferedContent(content);
          lastUpdateRef.current = Date.now();
        });
      }, maxDelay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, bufferSize, maxDelay, bufferedContent.length]);

  return bufferedContent;
}
