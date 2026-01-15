# 流式输出性能优化与错误修复

## 概述
优化 Fangyu Code 的流式输出性能，修复已知错误，提升用户体验。

## 问题分析

### 🔴 严重错误 (3个)
1. **Tooltip ref 错误** - `Function components cannot be given refs`
2. **useSessionThresholdMonitor 崩溃** - `msg.message?.content?.map is not a function`
3. **flushSync 警告** - 在渲染期间调用 flushSync

### 🟡 警告 (15个)
1. **Dialog 控制状态切换** - uncontrolled to controlled
2. **消息重复率过高** - 20%-37% 重复率
3. **Token 超限警告** - 多次触发

## 目标

### 性能目标
- 流式输出帧率 ≥ 60fps
- 首屏渲染时间 < 500ms
- 消息重复率 < 5%

### 质量目标
- 消除所有 React 警告
- 消除所有运行时错误
- 提升代码可维护性

## Glossary

- **Streaming_Renderer**: 流式消息渲染系统
- **Message_Deduplication**: 消息去重系统
- **Threshold_Monitor**: Token 阈值监控系统
- **Virtual_List**: 虚拟列表渲染系统

---

## Requirements

### Requirement 1: 修复 Tooltip ref 错误
**Priority**: P0 - Critical

#### User Story
作为开发者，我希望 Tooltip 组件不再产生 ref 警告，以保持控制台清洁。

#### Acceptance Criteria
1. WHEN Tooltip wraps a functional component, THE system SHALL use forwardRef
2. THE system SHALL NOT produce "Function components cannot be given refs" warnings

### Requirement 2: 修复 useSessionThresholdMonitor 崩溃
**Priority**: P0 - Critical

#### User Story
作为用户，我希望 Token 监控不会因为消息格式问题而崩溃。

#### Acceptance Criteria
1. WHEN message.content is not an array, THE system SHALL handle gracefully
2. THE generateSummary function SHALL validate input before processing
3. THE system SHALL NOT throw "map is not a function" errors

### Requirement 3: 修复 flushSync 警告
**Priority**: P0 - Critical

#### User Story
作为开发者，我希望虚拟列表不在渲染期间调用 flushSync。

#### Acceptance Criteria
1. WHEN virtualizer needs to update, THE system SHALL defer updates to next frame
2. THE system SHALL NOT call flushSync during React render phase

### Requirement 4: 修复 Dialog 控制状态
**Priority**: P1 - High

#### User Story
作为开发者，我希望 Dialog 组件保持一致的控制状态。

#### Acceptance Criteria
1. Dialog components SHALL maintain consistent controlled/uncontrolled state
2. THE open prop SHALL have a defined initial value (not undefined)

### Requirement 5: 降低消息重复率
**Priority**: P1 - High

#### User Story
作为用户，我希望消息不会重复显示，且系统性能良好。

#### Acceptance Criteria
1. THE Message_Deduplication system SHALL reduce duplicate rate to < 5%
2. WHEN a message is received, THE system SHALL check for duplicates before adding
3. THE system SHALL prevent duplicate event listeners

### Requirement 6: 优化流式渲染性能
**Priority**: P1 - High

#### User Story
作为用户，我希望流式输出流畅无卡顿。

#### Acceptance Criteria
1. THE Streaming_Renderer SHALL maintain 60fps during streaming
2. THE system SHALL use CSS animations instead of JS for cursor effects
3. THE system SHALL lazy-load syntax highlighting
4. Long code blocks SHALL be collapsible

### Requirement 7: 应用 OptimizedMarkdown 组件
**Priority**: P2 - Medium

#### User Story
作为用户，我希望 Markdown 渲染更
快更美观。

#### Acceptance Criteria
1. THE MessageContent component SHALL use OptimizedMarkdown
2. Code blocks SHALL have macOS-style header
3. Long code blocks SHALL show expand/collapse button。
