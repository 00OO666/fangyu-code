/**
 * 智能自动滚动 Hook
 *
 * 从 ClaudeCodeSession 提取（原 166-170 状态，305-435 逻辑）
 * 提供智能滚动管理：用户手动滚动检测、自动滚动到底部、流式输出滚动
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface SmartAutoScrollConfig {
  /** 可显示的消息列表（用于触发滚动） */
  displayableMessages: ClaudeStreamMessage[];
  /** 是否正在加载（流式输出时） */
  isLoading: boolean;
}

/**
 * 计算消息的内容哈希，用于检测内容变化
 */
function getLastMessageContentHash(messages: ClaudeStreamMessage[]): string {
  if (messages.length === 0) return '';
  const lastMsg = messages[messages.length - 1];
  // 简单地使用内容长度和类型作为哈希
  const contentLength = JSON.stringify(lastMsg.message?.content || '').length;
  return `${messages.length}-${lastMsg.type}-${contentLength}`;
}

interface SmartAutoScrollReturn {
  /** 滚动容器 ref */
  parentRef: React.RefObject<HTMLDivElement>;
  /** 用户是否手动滚动离开底部 */
  userScrolled: boolean;
  /** 设置用户滚动状态 */
  setUserScrolled: (scrolled: boolean) => void;
  /** 设置自动滚动状态 */
  setShouldAutoScroll: (should: boolean) => void;
}

/**
 * 智能自动滚动 Hook
 *
 * @param config - 配置对象
 * @returns 滚动管理对象
 *
 * @example
 * const { parentRef, userScrolled, setUserScrolled, shouldAutoScroll, setShouldAutoScroll } =
 *   useSmartAutoScroll({
 *     displayableMessages,
 *     isLoading
 *   });
 */
export function useSmartAutoScroll(config: SmartAutoScrollConfig): SmartAutoScrollReturn {
  const { displayableMessages, isLoading } = config;

  // Scroll state
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const lastScrollPositionRef = useRef(0);
  const isAutoScrollingRef = useRef(false); // 🆕 Track if scroll was initiated by code

  // 🆕 计算最后一条消息的内容哈希，用于检测内容变化
  const lastMessageHash = useMemo(
    () => getLastMessageContentHash(displayableMessages),
    [displayableMessages]
  );

  // Helper to perform auto-scroll safely
  const performAutoScroll = (behavior: ScrollBehavior = 'smooth') => {
    if (parentRef.current) {
      const scrollElement = parentRef.current;
      // Check if we actually need to scroll to avoid unnecessary events
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const targetScrollTop = scrollHeight - clientHeight;
      
      if (Math.abs(scrollTop - targetScrollTop) > 1) { // Small tolerance
        isAutoScrollingRef.current = true;
        scrollElement.scrollTo({
          top: targetScrollTop,
          behavior
        });
      }
    }
  };

  // Smart scroll detection - detect when user manually scrolls
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      // 1. Check if this scroll event was triggered by our auto-scroll
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false;
        // Update last position to current to prevent diff calculation errors next time
        lastScrollPositionRef.current = scrollElement.scrollTop;
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      
      // 2. Calculate distance from bottom
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 50; // 50px threshold

      // 3. Determine user intent
      // If user is not at bottom, they are viewing history -> Stop auto scroll
      if (!isAtBottom) {
        setUserScrolled(true);
        setShouldAutoScroll(false);
      } else {
        // User is at bottom (or scrolled back to bottom) -> Resume auto scroll
        setUserScrolled(false);
        setShouldAutoScroll(true);
      }

      lastScrollPositionRef.current = scrollTop;
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, []); // Empty deps - event listener only needs to be registered once

  // Smart auto-scroll for new messages (initial load or update)
  // 🆕 使用 lastMessageHash 替代 displayableMessages.length，确保内容变化时也能触发滚动
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        performAutoScroll();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [lastMessageHash, shouldAutoScroll, userScrolled]);

  // Enhanced streaming scroll - only when user hasn't manually scrolled away
  // 🆕 流式输出时持续滚动，不再依赖消息长度
  useEffect(() => {
    if (isLoading && shouldAutoScroll && !userScrolled) {
      // Immediate scroll on update
      performAutoScroll();

      // Frequent updates during streaming (every 150ms for smoother experience)
      const intervalId = setInterval(performAutoScroll, 150);

      return () => clearInterval(intervalId);
    }
  }, [isLoading, shouldAutoScroll, userScrolled]);

  // 🆕 当消息内容变化时触发额外滚动（确保流式输出时跟踪最新内容）
  // 进入历史会话/初次渲染时，虚拟列表的测量会在短时间内不断修正高度，导致首次滚动不到真正的底部。
  // 在非流式状态下提供一个短暂的“粘底”窗口，确保最终停在最新消息处。
  useEffect(() => {
    if (isLoading) return;
    if (!shouldAutoScroll || userScrolled || displayableMessages.length === 0) return;

    let ticks = 0;
    const intervalId = setInterval(() => {
      ticks += 1;
      performAutoScroll('auto');
      if (ticks >= 8) {
        clearInterval(intervalId);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [lastMessageHash, isLoading, shouldAutoScroll, userScrolled, displayableMessages.length]);

  useEffect(() => {
    if (shouldAutoScroll && !userScrolled && displayableMessages.length > 0) {
      // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
      const frameId = requestAnimationFrame(() => {
        performAutoScroll();
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [lastMessageHash]);

  return {
    parentRef,
    userScrolled,
    setUserScrolled,
    setShouldAutoScroll
  };
}
