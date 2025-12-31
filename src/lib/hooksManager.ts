/**
 * Hooks configuration manager for Claude Code hooks
 */

import {
  HooksConfiguration,
  HookMatcher,
  HookValidationResult,
  HookValidationError,
  HookValidationWarning,
} from '@/types/hooks';

export class HooksManager {
  /**
   * Merge hooks configurations with proper priority
   * Priority: local > project > user
   */
  static mergeConfigs(
    user: HooksConfiguration,
    project: HooksConfiguration,
    local: HooksConfiguration
  ): HooksConfiguration {
    const merged: HooksConfiguration = {};
    
    // All events now use matcher format (but matcher field is optional for some)
    // According to Claude Code docs: https://docs.claude.com/en/docs/claude-code/hooks
    const allEvents: (keyof HooksConfiguration)[] = [
      'PreToolUse', 
      'PostToolUse',
      'Notification',
      'UserPromptSubmit',
      'Stop',
      'SubagentStop',
      'PreCompact',
      'SessionStart',
      'SessionEnd'
    ];

    // Merge all events using matcher format
    // All events now support matcher format according to official docs
    for (const event of allEvents) {
      // Start with user hooks
      let matchers = [...((user[event] as HookMatcher[] | undefined) || [])];
      
      // Add project hooks (may override by matcher pattern)
      if (project[event]) {
        matchers = this.mergeMatchers(matchers, project[event] as HookMatcher[]);
      }
      
      // Add local hooks (highest priority)
      if (local[event]) {
        matchers = this.mergeMatchers(matchers, local[event] as HookMatcher[]);
      }
      
      if (matchers.length > 0) {
        (merged as any)[event] = matchers;
      }
    }
    
    return merged;
  }

  /**
   * Merge matcher arrays, with later items taking precedence
   */
  private static mergeMatchers(
    base: HookMatcher[],
    override: HookMatcher[]
  ): HookMatcher[] {
    const result = [...base];
    
    for (const overrideMatcher of override) {
      const existingIndex = result.findIndex(
        m => m.matcher === overrideMatcher.matcher
      );
      
      if (existingIndex >= 0) {
        // Replace existing matcher
        result[existingIndex] = overrideMatcher;
      } else {
        // Add new matcher
        result.push(overrideMatcher);
      }
    }
    
    return result;
  }

  /**
   * Validate hooks configuration
   */
  static async validateConfig(hooks: HooksConfiguration): Promise<HookValidationResult> {
    const errors: HookValidationError[] = [];
    const warnings: HookValidationWarning[] = [];

    // Guard against undefined or null hooks
    if (!hooks) {
      return { valid: true, errors, warnings };
    }

    // All events now use matcher format according to official docs
    const allEvents = [
      'PreToolUse',
      'PostToolUse',
      'Notification',
      'UserPromptSubmit',
      'Stop',
      'SubagentStop',
      'PreCompact',
      'SessionStart',
      'SessionEnd'
    ] as const;

    // Validate all events using matcher format
    for (const event of allEvents) {
      const matchers = hooks[event];
      if (!matchers || !Array.isArray(matchers)) continue;

      for (const matcher of matchers) {
        // Validate regex pattern if provided (optional for some events)
        // Special cases: "*" and empty string are valid (match all tools)
        if (matcher.matcher && matcher.matcher !== '*' && matcher.matcher.trim() !== '') {
          try {
            new RegExp(matcher.matcher);
          } catch (e) {
            errors.push({
              event,
              matcher: matcher.matcher,
              message: `Invalid regex pattern: ${e instanceof Error ? e.message : 'Unknown error'}`
            });
          }
        }

        // Validate commands
        if (matcher.hooks && Array.isArray(matcher.hooks)) {
          for (const hook of matcher.hooks) {
            if (!hook.command || !hook.command.trim()) {
              errors.push({
                event,
                matcher: matcher.matcher,
                message: 'Empty command'
              });
            }

            // Check for dangerous patterns
            const dangers = this.checkDangerousPatterns(hook.command || '');
            warnings.push(...dangers.map(d => ({
              event,
              matcher: matcher.matcher,
              command: hook.command || '',
              message: d
            })));
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check for potentially dangerous command patterns
   */
  public static checkDangerousPatterns(command: string): string[] {
    const warnings: string[] = [];
    
    // Guard against undefined or null commands
    if (!command || typeof command !== 'string') {
      return warnings;
    }
    
    const patterns = [
      { pattern: /rm\s+-rf\s+\/(?:\s|$)/, message: 'Destructive command on root directory' },
      { pattern: /rm\s+-rf\s+~/, message: 'Destructive command on home directory' },
      { pattern: /:\s*\(\s*\)\s*\{.*\}\s*;/, message: 'Fork bomb pattern detected' },
      { pattern: /curl.*\|\s*(?:bash|sh)/, message: 'Downloading and executing remote code' },
      { pattern: /wget.*\|\s*(?:bash|sh)/, message: 'Downloading and executing remote code' },
      { pattern: />\/dev\/sda/, message: 'Direct disk write operation' },
      { pattern: /sudo\s+/, message: 'Elevated privileges required' },
      { pattern: /dd\s+.*of=\/dev\//, message: 'Dangerous disk operation' },
      { pattern: /mkfs\./, message: 'Filesystem formatting command' },
      { pattern: /:(){ :|:& };:/, message: 'Fork bomb detected' },
    ];

    for (const { pattern, message } of patterns) {
      if (pattern.test(command)) {
        warnings.push(message);
      }
    }

    // Check for unescaped variables that could lead to code injection
    if (command.includes('$') && !command.includes('"$')) {
      warnings.push('Unquoted shell variable detected - potential code injection risk');
    }

    return warnings;
  }

  /**
   * Escape a command for safe shell execution
   */
  static escapeCommand(command: string): string {
    // Basic shell escaping - in production, use a proper shell escaping library
    return command
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
  }

  /**
   * Generate a unique ID for hooks/matchers/commands
   */
  static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
} 
