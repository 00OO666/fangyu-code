# Implementation Plan: Fangyu Code UI Redesign v3

## Overview

本实现计划将 Fangyu Code 的 UI 升级为现代化的 Glassmorphism 风格，包括设计系统基础、核心组件重构、动效系统等。采用渐进式重构策略，确保每个阶段都可独立验证。

## Tasks

- [x] 1. 设计系统基础 - CSS 变量和工具类
  - [x] 1.1 创建设计 Token CSS 变量文件
    - 定义颜色系统（主色、辅助色、语义色、渐变）
    - 定义间距系统（4px 基准）
    - 定义圆角、阴影、动画变量
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_
  - [x] 1.2 创建主题切换系统
    - 实现 light/dark 主题 CSS 变量
    - 添加主题切换过渡动画
    - _Requirements: 1.3, 9.4, 9.5_
  - [x] 1.3 创建 Glassmorphism 工具类
    - 实现 .glass, .glass-strong, .glass-subtle 类
    - 实现 .glow-border 渐变边框类
    - 添加 backdrop-filter 降级方案
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 1.4 创建动画工具类
    - 实现 fade-in, fade-out, slide-up, slide-down 动画
    - 添加 prefers-reduced-motion 支持
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Checkpoint - 验证设计系统基础
  - 确保所有 CSS 变量正确定义
  - 验证主题切换功能
  - 测试 glassmorphism 效果在不同浏览器的表现

- [x] 3. SmartRecommendationBar 组件重构
  - [x] 3.1 重构组件样式
    - 应用 glassmorphism 背景
    - 添加渐变边框效果
    - 实现紧凑单行布局
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 实现分页和动画
    - 添加水平分页控件
    - 实现 fade + slide 进入/退出动画
    - _Requirements: 3.3, 3.7_
  - [x] 3.3 优化交互反馈
    - 实现类型颜色编码图标
    - 优化按钮样式和悬停效果
    - _Requirements: 3.4, 3.5, 3.6_
  - [x] 3.4 编写组件测试
    - **Property 3: Recommendation Bar Pagination**
    - **Property 4: Type-Color Mapping**
    - **Validates: Requirements 3.3, 3.4**

- [x] 4. 工具调用 UI 组件重构（重点）
  - [x] 4.1 创建紧凑版 ToolCallCard 组件
    - 实现 32px 高度的收起状态
    - 添加工具图标和状态指示器
    - 实现展开/收起功能
    - _Requirements: 4.1_
  - [x] 4.2 实现工具调用状态动画
    - Pending: 脉冲动画
    - Running: 旋转动画
    - Success/Error: 静态图标
    - _Requirements: 4.5_
  - [x] 4.3 优化展开详情视图
    - 紧凑的 JSON 显示
    - 可折叠的输入/输出区域
    - 最大高度 200px + 滚动
    - _Requirements: 4.1_

- [x] 5. 消息气泡组件重构
  - [x] 5.1 重构用户消息气泡
    - 应用渐变背景
    - 优化圆角和内边距
    - _Requirements: 4.2, 4.4_
  - [x] 5.2 重构 AI 消息气泡
    - 应用轻薄 glass 效果
    - 优化文字渲染（行高、段落间距）
    - _Requirements: 4.3, 4.4_
  - [x] 5.3 优化代码块样式
    - 应用 One Dark Pro 配色
    - 添加紧凑的复制按钮
    - 优化内边距和行号显示
    - _Requirements: 4.6_
  - [x] 5.4 优化消息间距
    - 同发送者连续消息 4px
    - 不同发送者 12px
    - 工具调用与消息 8px
    - _Requirements: 4.1_

- [x] 6. Checkpoint - 验证会话界面
  - 确保工具调用 UI 紧凑且可用
  - 验证消息气泡样式正确
  - 测试自动滚动行为

- [x] 7. 侧边栏组件重构
  - [x] 7.1 应用 glassmorphism 背景
    - 实现 glass 效果背景
    - 添加微妙的边框
    - _Requirements: 5.1_
  - [x] 7.2 重构导航项样式
    - 实现悬停和活跃状态
    - 添加渐变活跃指示器
    - _Requirements: 5.2, 5.3_
  - [x] 7.3 实现收起/展开功能
    - 添加平滑的宽度过渡
    - 实现图标模式
    - _Requirements: 5.4, 5.6_
  - [x] 7.4 添加状态指示器
    - 活跃会话指示
    - 最近活动指示
    - _Requirements: 5.5_
  - [x] 7.5 编写侧边栏测试
    - **Property 7: Sidebar Collapse State**
    - **Validates: Requirements 5.4, 5.6, 8.2**

- [x] 8. 输入区域组件重构
  - [x] 8.1 应用 glassmorphism 样式
    - 实现 glass-strong 背景
    - 添加圆角和边框
    - _Requirements: 6.1_
  - [x] 8.2 实现聚焦发光效果
    - 添加渐变边框 glow
    - 平滑的过渡动画
    - _Requirements: 6.2_
  - [x] 8.3 优化自动调整大小
    - 实现平滑的高度变化
    - 设置最大高度限制
    - _Requirements: 6.3_
  - [x] 8.4 重构操作按钮
    - 发送按钮渐变样式
    - 模型选择器 glass 下拉
    - _Requirements: 6.4, 6.5_
  - [x] 8.5 实现加载状态
    - 发送按钮加载动画
    - 禁用状态样式
    - _Requirements: 6.6_
  - [x] 8.6 编写输入区域测试
    - **Property 8: Input Auto-Resize**
    - **Property 9: Loading State Indication**
    - **Validates: Requirements 6.3, 6.6**

- [x] 9. 响应式布局优化
  - [x] 9.1 实现断点系统
    - 定义响应式断点
    - 添加 container queries
    - _Requirements: 8.1, 8.5_
  - [x] 9.2 优化窄屏布局
    - 侧边栏自动收起
    - 调整组件间距
    - _Requirements: 8.2, 8.3_
  - [x] 9.3 性能优化
    - glassmorphism 降级方案
    - 减少不必要的重绘
    - _Requirements: 8.4_

- [x] 10. 全局样式整合
  - [x] 10.1 更新 Tailwind 配置
    - 添加自定义颜色
    - 添加自定义动画
    - _Requirements: 1.1, 1.2, 7.1, 7.2_
  - [x] 10.2 清理旧样式
    - 移除废弃的 CSS
    - 统一组件样式
    - _Requirements: 全部_
  - [x] 10.3 添加渐变覆盖层
    - 背景装饰渐变
    - 视觉层次增强
    - _Requirements: 9.7_

- [x] 11. Checkpoint - 最终验证
  - 确保所有组件样式一致
  - 验证响应式布局
  - 测试主题切换
  - 验证可访问性（对比度）

- [x] 12. 属性测试
  - [x] 12.1 主题切换一致性测试
    - **Property 1: Theme Switching Consistency**
    - **Validates: Requirements 1.3**
  - [x] 12.2 对比度合规性测试
    - **Property 2: Contrast Ratio Compliance**
    - **Validates: Requirements 2.6, 9.6**
  - [x] 12.3 减少动画偏好测试
    - **Property 10: Reduced Motion Preference**
    - **Validates: Requirements 7.5**

## Notes

- 所有任务都必须完成
- 每个 Checkpoint 用于验证阶段性成果
- 优先完成核心组件（SmartRecommendationBar、工具调用 UI、消息气泡）
- 保持向后兼容，渐进式重构
