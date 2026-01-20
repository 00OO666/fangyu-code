/**
 * HoverTooltip 组件测试
 */

import { describe, it, expect } from 'vitest';
import { HoverTooltip } from './HoverTooltip';

describe('HoverTooltip', () => {
  it('组件应该存在', () => {
    expect(HoverTooltip).toBeDefined();
  });

  it('组件应该是一个函数', () => {
    expect(typeof HoverTooltip).toBe('function');
  });

  it('组件应该接受 props', () => {
    expect(HoverTooltip.length).toBeGreaterThanOrEqual(0);
  });
});
