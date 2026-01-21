#!/usr/bin/env node

/**
 * Token 限制移除验证脚本
 *
 * 验证 Fangyu Code 不再对工具调用设置 token 上限
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Token 限制移除 - 验证测试\n');
console.log('='.repeat(60));

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      results.passed++;
      results.tests.push({ name, passed: true });
    } else {
      console.log(`❌ ${name}`);
      results.failed++;
      results.tests.push({ name, passed: false });
    }
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
  }
}

// 测试1: 检查 Rust 默认配置
test('检查 ClaudeExecutionConfig 默认 max_tokens 为 None', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/permission_config.rs');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 查找 Default 实现
  const defaultImplMatch = content.match(/impl Default for ClaudeExecutionConfig[\s\S]*?\{([\s\S]*?)\n\s*\}/);
  if (!defaultImplMatch) return false;

  const defaultImpl = defaultImplMatch[1];

  // 验证 max_tokens: None
  return defaultImpl.includes('max_tokens: None');
});

// 测试2: 检查命令行参数构建逻辑
test('检查只在显式设置时才添加 --max-tokens 参数', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/permission_config.rs');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 验证使用 if let Some(max_tokens) 的模式
  return content.includes('if let Some(max_tokens) = config.max_tokens') &&
         content.includes('args.push("--max-tokens".to_string())');
});

// 测试3: 验证注释说明已更新
test('检查代码包含 token 限制移除的说明注释', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/permission_config.rs');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 检查是否有说明无限制的注释
  return content.includes('无限制') ||
         content.includes('不设置 max_tokens') ||
         content.includes('让 Claude');
});

// 测试4: 检查 TypeScript 类型定义
test('检查 TypeScript 类型定义 max_tokens 为可选', () => {
  const filePath = path.join(__dirname, '../../src/lib/api/types.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 验证 max_tokens 是 number | null 类型
  return content.includes('max_tokens: number | null') ||
         content.includes('max_tokens?: number');
});

// 测试5: 确保前端没有硬编码 token 限制
test('确保前端代码没有硬编码 max_tokens 数值', () => {
  const filePath = path.join(__dirname, '../../src/lib/api.ts');
  if (!fs.existsSync(filePath)) return true; // 文件不存在也通过

  const content = fs.readFileSync(filePath, 'utf-8');

  // 检查是否有类似 max_tokens: 4096 的硬编码
  const hardcodedPattern = /max_tokens:\s*\d+/g;
  return !hardcodedPattern.test(content);
});

// 测试6: 检查文档已创建
test('检查 TOKEN_LIMIT_REMOVAL.md 文档已创建', () => {
  const docPath = path.join(__dirname, '../../docs/TOKEN_LIMIT_REMOVAL.md');
  return fs.existsSync(docPath);
});

// 测试7: 验证文档内容完整性
test('验证文档包含关键信息', () => {
  const docPath = path.join(__dirname, '../../docs/TOKEN_LIMIT_REMOVAL.md');
  if (!fs.existsSync(docPath)) return false;

  const content = fs.readFileSync(docPath, 'utf-8');

  return content.includes('max_tokens') &&
         content.includes('None') &&
         content.includes('无限制');
});

// 输出测试结果
console.log('\n' + '='.repeat(60));
console.log('📊 测试结果汇总');
console.log('='.repeat(60));
console.log(`✅ 通过: ${results.passed}`);
console.log(`❌ 失败: ${results.failed}`);
console.log(`📝 总计: ${results.tests.length}`);
console.log('='.repeat(60));

if (results.failed === 0) {
  console.log('\n🎉 所有测试通过！Token 限制已成功移除。\n');
  console.log('📋 验证结果:');
  console.log('   ✅ 默认配置为 None (无限制)');
  console.log('   ✅ 只在显式设置时才添加 --max-tokens 参数');
  console.log('   ✅ 代码注释已更新');
  console.log('   ✅ TypeScript 类型定义正确');
  console.log('   ✅ 前端无硬编码限制');
  console.log('   ✅ 文档已创建\n');
  console.log('🚀 现在 Claude Code 可以充分利用 200K 上下文窗口！\n');
  process.exit(0);
} else {
  console.log('\n⚠️ 有测试失败，请检查上述错误信息。\n');
  process.exit(1);
}
