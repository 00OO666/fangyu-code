/**
 * AccessibleDialog - 可访问性增强的对话框组件
 *
 * 解决 Radix UI DialogContent 缺少 DialogDescription 的警告
 * 提供两种模式：
 * 1. 显式描述 - 传入 description prop
 * 2. 隐藏描述 - 使用 VisuallyHidden 仅供屏幕阅读器
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DialogContent, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AccessibleDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** 对话框描述文本（可选，用于屏幕阅读器） */
  srDescription?: string;
  /** 是否隐藏描述（仅供屏幕阅读器），默认 true */
  hideDescription?: boolean;
}

/**
 * 可访问性增强的 DialogContent
 * 自动添加隐藏的 DialogDescription 以满足 ARIA 要求
 */
export const AccessibleDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AccessibleDialogContentProps
>(({ children, srDescription, hideDescription = true, className, ...props }, ref) => {
  return (
    <DialogContent ref={ref} className={cn(className)} {...props}>
      {hideDescription && srDescription && (
        <VisuallyHidden.Root>
          <DialogDescription>{srDescription}</DialogDescription>
        </VisuallyHidden.Root>
      )}
      {children}
    </DialogContent>
  );
});

AccessibleDialogContent.displayName = "AccessibleDialogContent";

export { VisuallyHidden };
