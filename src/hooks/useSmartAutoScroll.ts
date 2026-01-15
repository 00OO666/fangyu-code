/**
 * 智能自动滚动 Hook
 *
 * 从 ClaudeCodeSession 提取（原 166-170 状态，305-435 逻辑）
 * 提供智能滚动管理：用户手动滚动检测、自动滚动到底部、流式输出滚动
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

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
  if (messages.length === 0) return "";
  const lastMsg = messages[messages.length - 1];
  // 简单地使用内容长度和类型作为哈希
  const contentLength = JSON.stringify(lastMsg.message?.content || "").length;
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
  const isAutoScrollingRef = useRef(false); // Track if scroll was initiated by code

  // 🆕 计算最后一条消息的内容哈希，用于检测内容变化
  const lastMessageHash = useMemo(
    () => getLastMessageContentHash(displayableMessages),
    [displayableMessages],
  );

  // Helper to perform auto-scroll safely
  const performAutoScroll = (behavior: ScrollBehavior = "smooth") => {
    if (parentRef.current) {
      const scrollElement = parentRef.current;
      // Check if we actually need to scroll to avoid unnecessary events
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const targetScrollTop = scrollHeight - clientHeight;

      if (Math.abs(scrollTop - targetScrollTop) > 1) {
        // Small tolerance
        isAutoScrollingRef.current = true;
        scrollElement.scrollTo({
          top: targetScrollTop,
          behavior,
        });
      }
    }
  };

  // Smart scroll detection - detect when user manually scrolls
  // 🆕 v3.2: 简化逻辑，直接在用户交互事件中设置状态
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    // 用户主动向上滚动时，立即停止自动滚动
    const handleWheel = (e: WheelEvent) => {
      // deltaY < 0 表示向上滚动
      if (e.deltaY < 0) {
        setUserScrolled(true);
        setShouldAutoScroll(false);
      }
    };

    // 用户拖动滚动条时
    const handlePointerDown = (e: PointerEvent) => {
      const rect = scrollElement.getBoundingClientRect();
      const isOnScrollbar = e.clientX > rect.right - 20;
      if (isOnScrollbar) {
        // 标记用户正在拖动滚动条
        setUserScrolled(true);
        setShouldAutoScroll(false);
      }
    };

    // 触摸滚动
    const handleTouchMove = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom > 100) {
        setUserScrolled(true);
        setShouldAutoScroll(false);
      }
    };

    // 监听滚动位置，用于检测用户是否滚动回底部
    const handleScroll = () => {
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false;
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 50;

      // 用户滚动回底部时恢复自动滚动
      if (isAtBottom && userScrolled) {
        setUserScrolled(false);
        setShouldAutoScroll(true);
      }
    };

    scrollElement.addEventListener("wheel", handleWheel, { passive: true });
    scrollElement.addEventListener("pointerdown", handlePointerDown, { passive: true });
    scrollElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    scrollElement.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener("wheel", handleWheel);
      scrollElement.removeEventListener("pointerdown", handlePointerDown);
      scrollElement.removeEventListener("touchmove", handleTouchMove);
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, [userScrolled]);

  // Smart auto-scroll for new messages (initial load or update)
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        performAutoScroll("auto");
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [lastMessageHash, shouldAutoScroll, userScrolled]);

  // Streaming scroll - only when user hasn't manually scrolled away
  useEffect(() => {
    if (isLoading && shouldAutoScroll && !userScrolled) {
      // 流式输出时每 200ms 滚动一次（降低频率避免干扰）
      const intervalId = setInterval(() => {
        performAutoScroll("auto");
      }, 200);

      return () => clearInterval(intervalId);
    }
  }, [isLoading, shouldAutoScroll, userScrolled]);

  return {
    parentRef,
    userScrolled,
    setUserScrolled,
    setShouldAutoScroll,
  };
}
