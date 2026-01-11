# Requirements Document

## Introduction

本规范定义了 Fangyu Code v2.6.0 控制台错误和警告的系统性修复需求。这些问题影响应用的稳定性、性能和用户体验，需要按优先级逐步解决。

## Glossary

- **Message_Deduplication_System**: 消息去重系统，负责检测和过滤重复消息
- **Console_Monitor**: 控制台监控系统，捕获和显示运行时错误
- **Session_Stream**: 会话流处理系统，处理 Claude API 的流式响应
- **Dialog_Component**: 对话框组件，用于显示模态窗口
- **Threshold_Monitor**: 阈值监控系统，监控 token 使用量
- **Pricing_System**: 定价系统，计算 API 调用成本

## Requirements

### Requirement 1: 消息重复问题修复

**User Story:** As a developer, I want messages to be processed only once, so that the application performs efficiently and displays accurate message counts.

#### Acceptance Criteria

1. WHEN a message is received from the stream, THE Message_Deduplication_System SHALL process it exactly once
2. WHEN the session history is loaded, THE Session_Stream SHALL not duplicate existing messages
3. WHILE processing messages, THE Message_Deduplication_System SHALL maintain a deduplication rate below 5%
4. IF a duplicate message is detected, THEN THE Message_Deduplication_System SHALL log the source of duplication for debugging
5. WHEN multiple event listeners exist, THE Session_Stream SHALL ensure only one listener processes each message

### Requirement 2: 渲染期间状态更新修复

**User Story:** As a developer, I want state updates to occur outside of render cycles, so that React warnings are eliminated and the application behaves predictably.

#### Acceptance Criteria

1. WHEN the Console_Monitor detects an error, THE Console_Monitor SHALL defer state updates using queueMicrotask
2. WHEN a component renders, THE Console_Monitor SHALL NOT synchronously update state in another component
3. IF an error needs to be recorded during render, THEN THE Console_Monitor SHALL queue the update for the next microtask
4. THE Console_Monitor SHALL maintain error capture functionality while avoiding render-time state updates

### Requirement 3: flushSync 警告修复

**User Story:** As a developer, I want flushSync calls to occur outside lifecycle methods, so that React warnings are eliminated.

#### Acceptance Criteria

1. WHEN scrolling is needed after message updates, THE Session_Messages_Component SHALL NOT call flushSync inside lifecycle methods
2. IF immediate DOM updates are required, THEN THE Session_Messages_Component SHALL use useEffect or queueMicrotask to defer flushSync
3. THE Session_Messages_Component SHALL maintain smooth scrolling behavior after the fix

### Requirement 4: DialogContent 可访问性修复

**User Story:** As a user with accessibility needs, I want dialogs to have proper ARIA descriptions, so that screen readers can announce dialog purposes.

#### Acceptance Criteria

1. WHEN a dialog opens, THE Dialog_Component SHALL include either a DialogDescription or aria-describedby attribute
2. FOR ALL dialog components in the application, THE Dialog_Component SHALL provide meaningful descriptions
3. IF a dialog has no visible description, THEN THE Dialog_Component SHALL use VisuallyHidden to provide screen reader text
4. THE Dialog_Component SHALL pass Radix UI accessibility validation

### Requirement 5: Tooltip ref 警告修复

**User Story:** As a developer, I want Tooltip components to properly forward refs, so that React warnings are eliminated.

#### Acceptance Criteria

1. WHEN a Tooltip wraps a functional component, THE Tooltip_Component SHALL use React.forwardRef
2. IF a component receives a ref prop, THEN THE Tooltip_Component SHALL forward it to the appropriate DOM element
3. THE Tooltip_Component SHALL maintain existing tooltip functionality after the fix

### Requirement 6: Unknown model 定价修复

**User Story:** As a developer, I want the pricing system to handle synthetic models gracefully, so that unnecessary warnings are eliminated.

#### Acceptance Criteria

1. WHEN a synthetic model identifier is encountered, THE Pricing_System SHALL skip pricing calculation without warning
2. IF an unknown model is encountered, THEN THE Pricing_System SHALL log at debug level only once per session
3. THE Pricing_System SHALL maintain accurate pricing for known models

### Requirement 7: Token 超限警告优化

**User Story:** As a developer, I want token threshold warnings to be rate-limited, so that the console is not flooded with repetitive messages.

#### Acceptance Criteria

1. WHEN token usage exceeds threshold, THE Threshold_Monitor SHALL log a warning at most once per minute
2. IF the threshold state changes, THEN THE Threshold_Monitor SHALL log the new state immediately
3. THE Threshold_Monitor SHALL maintain accurate threshold detection while reducing log volume

### Requirement 8: 更新检查失败处理

**User Story:** As a user, I want update check failures to be handled gracefully, so that I understand when updates cannot be checked.

#### Acceptance Criteria

1. WHEN update check fails, THE Updater SHALL retry up to 3 times with exponential backoff
2. IF all retries fail, THEN THE Updater SHALL display a user-friendly error message
3. THE Updater SHALL log detailed error information for debugging
4. WHEN network is unavailable, THE Updater SHALL skip update check silently

### Requirement 9: 异常增量警告优化

**User Story:** As a developer, I want abnormal token deltas to be investigated and handled, so that usage tracking is accurate.

#### Acceptance Criteria

1. WHEN an abnormal delta is detected, THE Usage_Tracker SHALL log the source of the anomaly
2. IF the delta exceeds reasonable bounds, THEN THE Usage_Tracker SHALL cap the value and log a warning
3. THE Usage_Tracker SHALL maintain accurate cumulative statistics despite anomalies

### Requirement 10: 摘要生成失败处理

**User Story:** As a user, I want summary generation failures to provide useful error information, so that I can understand what went wrong.

#### Acceptance Criteria

1. WHEN summary generation fails, THE Summary_Generator SHALL log the complete error object with stack trace
2. IF the error object is empty, THEN THE Summary_Generator SHALL log the context and input that caused the failure
3. THE Summary_Generator SHALL provide a user-friendly fallback message when generation fails
