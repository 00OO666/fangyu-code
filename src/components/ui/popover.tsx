import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PopoverProps {
  /**
   * The trigger element
   */
  trigger: React.ReactNode;
  /**
   * The content to display in the popover
   */
  content: React.ReactNode;
  /**
   * Whether the popover is open
   */
  open?: boolean;
  /**
   * Callback when the open state changes
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional className for the content
   */
  className?: string;
  /**
   * Alignment of the popover relative to the trigger
   */
  align?: "start" | "center" | "end";
  /**
   * Side of the trigger to display the popover
   */
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Whether to use portal for rendering (renders in document.body)
   * Helps with overflow and z-index issues
   */
  usePortal?: boolean;
  /**
   * Padding from viewport edges (in pixels)
   */
  viewportPadding?: number;
}

// 计算最佳位置的工具函数
interface Position {
  top: number;
  left: number;
  actualSide: "top" | "bottom" | "left" | "right";
  actualAlign: "start" | "center" | "end";
  maxWidth?: number;
  maxHeight?: number;
}

const calculateOptimalPosition = (
  triggerRect: DOMRect,
  contentRect: DOMRect,
  preferredSide: "top" | "bottom" | "left" | "right",
  preferredAlign: "start" | "center" | "end",
  viewportPadding: number
): Position => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  const gap = 8; // 触发器和内容之间的间距
  let actualSide = preferredSide;
  let actualAlign = preferredAlign;

  // 检查每个方向的可用空间
  const space = {
    top: triggerRect.top - viewportPadding,
    bottom: viewport.height - triggerRect.bottom - viewportPadding,
    left: triggerRect.left - viewportPadding,
    right: viewport.width - triggerRect.right - viewportPadding,
  };

  // 智能选择最佳侧边
  const isVertical = preferredSide === "top" || preferredSide === "bottom";

  if (isVertical) {
    // 首选垂直方向，检查是否有足够空间
    if (preferredSide === "top" && space.top < contentRect.height + gap) {
      actualSide = space.bottom > space.top ? "bottom" : "top";
    } else if (preferredSide === "bottom" && space.bottom < contentRect.height + gap) {
      actualSide = space.top > space.bottom ? "top" : "bottom";
    }
  } else {
    // 首选水平方向
    if (preferredSide === "left" && space.left < contentRect.width + gap) {
      actualSide = space.right > space.left ? "right" : "left";
    } else if (preferredSide === "right" && space.right < contentRect.width + gap) {
      actualSide = space.left > space.right ? "left" : "right";
    }
  }

  // 计算基础位置
  let top = 0;
  let left = 0;

  switch (actualSide) {
    case "top":
      top = triggerRect.top - contentRect.height - gap;
      break;
    case "bottom":
      top = triggerRect.bottom + gap;
      break;
    case "left":
      left = triggerRect.left - contentRect.width - gap;
      break;
    case "right":
      left = triggerRect.right + gap;
      break;
  }

  // 计算对齐位置
  const isHorizontalSide = actualSide === "left" || actualSide === "right";

  if (isHorizontalSide) {
    // 水平侧边：垂直对齐
    switch (preferredAlign) {
      case "start":
        top = triggerRect.top;
        break;
      case "center":
        top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
        break;
      case "end":
        top = triggerRect.bottom - contentRect.height;
        break;
    }
  } else {
    // 垂直侧边：水平对齐
    switch (preferredAlign) {
      case "start":
        left = triggerRect.left;
        break;
      case "center":
        left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
        break;
      case "end":
        left = triggerRect.right - contentRect.width;
        break;
    }
  }

  // 边界约束 - 确保不超出视口
  let maxWidth = viewport.width - viewportPadding * 2;
  let maxHeight = viewport.height - viewportPadding * 2;

  // 调整水平位置
  if (left < viewportPadding) {
    left = viewportPadding;
    if (!isHorizontalSide) actualAlign = "start";
  } else if (left + contentRect.width > viewport.width - viewportPadding) {
    left = viewport.width - contentRect.width - viewportPadding;
    if (!isHorizontalSide) actualAlign = "end";
  }

  // 调整垂直位置
  if (top < viewportPadding) {
    top = viewportPadding;
    if (isHorizontalSide) actualAlign = "start";
  } else if (top + contentRect.height > viewport.height - viewportPadding) {
    top = viewport.height - contentRect.height - viewportPadding;
    if (isHorizontalSide) actualAlign = "end";
  }

  // 计算可用的最大尺寸
  if (actualSide === "top") {
    maxHeight = Math.min(maxHeight, triggerRect.top - viewportPadding - gap);
  } else if (actualSide === "bottom") {
    maxHeight = Math.min(maxHeight, viewport.height - triggerRect.bottom - viewportPadding - gap);
  }

  return {
    top: Math.max(viewportPadding, top),
    left: Math.max(viewportPadding, left),
    actualSide,
    actualAlign,
    maxWidth,
    maxHeight,
  };
};

/**
 * Popover component for displaying floating content with smart positioning
 *
 * Features:
 * - Automatic boundary detection and repositioning
 * - Responsive to window resize
 * - Portal rendering option for complex layouts
 * - Maximum size constraints based on available space
 *
 * @example
 * <Popover
 *   trigger={<Button>Click me</Button>}
 *   content={<div>Popover content</div>}
 *   side="top"
 *   usePortal={true}
 * />
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  open: controlledOpen,
  onOpenChange,
  className,
  align = "center",
  side = "bottom",
  usePortal = true,
  viewportPadding = 16,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<Position | null>(null);

  // 计算并更新位置
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current || !contentRef.current || !open) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    const newPosition = calculateOptimalPosition(
      triggerRect,
      contentRect,
      side,
      align,
      viewportPadding
    );

    setPosition(newPosition);
  }, [open, side, align, viewportPadding]);

  // 打开时计算位置
  React.useEffect(() => {
    if (open) {
      // 延迟一帧确保内容已渲染
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [open, updatePosition]);

  // 监听窗口大小变化
  React.useEffect(() => {
    if (!open) return;

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open, updatePosition]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is inside trigger or content
      if (triggerRef.current?.contains(target) || contentRef.current?.contains(target)) {
        return;
      }

      // Check if click is inside a Radix Portal (e.g., Select dropdown)
      const radixPortal = target.closest('[data-radix-popper-content-wrapper], [data-radix-select-viewport], [role="listbox"], [data-radix-portal]');
      if (radixPortal) {
        return;
      }

      // Check for radix-related attributes in parent chain
      let element: HTMLElement | null = target;
      while (element && element !== document.body) {
        if (element.hasAttribute('data-radix-collection-item') || element.getAttribute('role') === 'option') {
          return;
        }
        element = element.parentElement;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);

  // Close on escape
  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, setOpen]);

  const getAnimation = () => {
    const actualSide = position?.actualSide || side;
    switch (actualSide) {
      case "top":
        return { initial: { y: 10 }, exit: { y: 10 } };
      case "bottom":
        return { initial: { y: -10 }, exit: { y: -10 } };
      case "left":
        return { initial: { x: 10 }, exit: { x: 10 } };
      case "right":
        return { initial: { x: -10 }, exit: { x: -10 } };
    }
  };
  const animation = getAnimation();

  // 渲染内容
  const renderContent = () => (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, scale: 0.95, ...animation?.initial }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, ...animation?.exit }}
          transition={{ duration: 0.15 }}
          className={cn(
            "z-50 min-w-[200px] rounded-xl medium-glass p-4 text-white shadow-md overflow-auto",
            className
          )}
          style={
            usePortal && position
              ? {
                  position: "fixed",
                  top: position.top,
                  left: position.left,
                  maxWidth: position.maxWidth,
                  maxHeight: position.maxHeight,
                }
              : undefined
          }
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <div className={usePortal ? "inline-block" : "relative inline-block"}>
        <div
          ref={triggerRef}
          onClick={() => setOpen(!open)}
        >
          {trigger}
        </div>

        {!usePortal && (
          <div className="relative">
            {renderContent()}
          </div>
        )}
      </div>

      {/* Portal rendering for better positioning */}
      {usePortal &&
        typeof document !== "undefined" &&
        createPortal(renderContent(), document.body)}
    </>
  );
}; 