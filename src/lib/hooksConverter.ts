/**
 * 类型转换工具 - 在现有HooksConfiguration和新的EnhancedHooksConfiguration之间转换
 * Type conversion utilities between existing HooksConfiguration and new EnhancedHooksConfiguration
 */

import type { HooksConfiguration } from '@/types/hooks';
import type { EnhancedHooksConfiguration } from '@/types/enhanced-hooks';

/**
 * 将现有的HooksConfiguration转换为EnhancedHooksConfiguration
 */
export function convertToEnhanced(config: HooksConfiguration): EnhancedHooksConfiguration {
  const enhanced: EnhancedHooksConfiguration = {};

  // 处理有matcher的事件(PreToolUse, PostToolUse)
  if (config.PreToolUse) {
    enhanced.PreToolUse = config.PreToolUse.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.PostToolUse) {
    enhanced.PostToolUse = config.PostToolUse.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  // 处理简单命令事件 - 现在也是 HookMatcher[] 格式
  if (config.Notification) {
    enhanced.Notification = config.Notification.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.Stop) {
    enhanced.Stop = config.Stop.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.SubagentStop) {
    enhanced.SubagentStop = config.SubagentStop.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  // 处理新增的事件
  if (config.UserPromptSubmit) {
    enhanced.OnSessionStart = config.UserPromptSubmit.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  if (config.SessionStart) {
    enhanced.OnSessionStart = config.SessionStart.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  if (config.SessionEnd) {
    enhanced.OnSessionEnd = config.SessionEnd.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  return enhanced;
}

/**
 * 将EnhancedHooksConfiguration转换为现有的HooksConfiguration
 */
export function convertFromEnhanced(enhanced: EnhancedHooksConfiguration): HooksConfiguration {
  const config: HooksConfiguration = {};

  // 处理有matcher的事件 - 转换为默认matcher
  if (enhanced.PreToolUse && enhanced.PreToolUse.length > 0) {
    config.PreToolUse = [{
      hooks: enhanced.PreToolUse.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.PostToolUse && enhanced.PostToolUse.length > 0) {
    config.PostToolUse = [{
      hooks: enhanced.PostToolUse.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  // 处理简单命令事件 - 转换为 HookMatcher[] 格式
  if (enhanced.Notification && enhanced.Notification.length > 0) {
    config.Notification = [{
      hooks: enhanced.Notification.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.Stop && enhanced.Stop.length > 0) {
    config.Stop = [{
      hooks: enhanced.Stop.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.SubagentStop && enhanced.SubagentStop.length > 0) {
    config.SubagentStop = [{
      hooks: enhanced.SubagentStop.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  return config;
}

/**
 * 合并两种配置格式，优先使用Enhanced格式的新特性
 */
export function mergeConfigurations(
  existing: HooksConfiguration,
  enhanced: EnhancedHooksConfiguration
): EnhancedHooksConfiguration {
  const converted = convertToEnhanced(existing);

  return {
    ...converted,
    ...enhanced,
    // 如果两者都有相同事件，合并它们
    PreToolUse: [
      ...(converted.PreToolUse || []),
      ...(enhanced.PreToolUse || [])
    ],
    PostToolUse: [
      ...(converted.PostToolUse || []),
      ...(enhanced.PostToolUse || [])
    ],
    Notification: [
      ...(converted.Notification || []),
      ...(enhanced.Notification || [])
    ],
    Stop: [
      ...(converted.Stop || []),
      ...(enhanced.Stop || [])
    ],
    SubagentStop: [
      ...(converted.SubagentStop || []),
      ...(enhanced.SubagentStop || [])
    ],
  };
}