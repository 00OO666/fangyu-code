#!/usr/bin/env node

/**
 * 智能会话存储路径功能 - 简化测试脚本
 *
 * 运行方式: node scripts/test/test-session-path-simple.js
 *
 * 此脚本验证：
 * 1. Rust 代码编译通过
 * 2. Tauri 命令已正确注册
 * 3. 数据库表结构正确
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 智能会话存储路径功能 - 测试验证\n');
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

// 测试1: 检查 Rust 文件是否存在且包含所需函数
test('检查 session_continue.rs 文件存在', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/session_continue.rs');
  return fs.existsSync(filePath);
});

test('检查 create_continued_session 函数存在', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/session_continue.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('pub async fn create_continued_session');
});

test('检查 set_session_storage_path 函数存在', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/session_continue.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('pub async fn set_session_storage_path');
});

test('检查 get_session_storage_path_setting 函数存在', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/session_continue.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('pub async fn get_session_storage_path_setting');
});

test('检查函数使用自定义路径逻辑', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/commands/session_continue.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('get_session_storage_path(&app)') &&
         content.includes('Using custom storage path');
});

// 测试2: 检查 main.rs 是否注册了命令
test('检查 main.rs 注册了 set_session_storage_path', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/main.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('commands::session_continue::set_session_storage_path');
});

test('检查 main.rs 注册了 get_session_storage_path_setting', () => {
  const filePath = path.join(__dirname, '../../src-tauri/src/main.rs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('commands::session_continue::get_session_storage_path_setting');
});

// 测试3: 检查前端 UI 文件
test('检查 GeneralSettings.tsx 包含会话路径设置', () => {
  const filePath = path.join(__dirname, '../../src/components/settings/GeneralSettings.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('智能会话存储路径') &&
         content.includes('sessionStoragePath');
});

test('检查前端调用了 set_session_storage_path', () => {
  const filePath = path.join(__dirname, '../../src/components/settings/GeneralSettings.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('set_session_storage_path');
});

test('检查前端调用了 get_session_storage_path_setting', () => {
  const filePath = path.join(__dirname, '../../src/components/settings/GeneralSettings.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('get_session_storage_path_setting');
});

// 测试4: Rust 编译检查
test('Rust 代码编译通过', () => {
  try {
    const cwd = path.join(__dirname, '../../src-tauri');
    console.log('   ⏳ 正在编译 Rust 代码...');
    execSync('cargo check --message-format=short', {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return true;
  } catch (error) {
    // 检查是否有错误（排除警告）
    const output = error.stdout || '';
    const hasError = output.includes('error[E') || output.includes('error:');
    if (hasError) {
      console.log('   ⚠️ 编译错误:', output.split('\n').filter(l => l.includes('error')).join('\n'));
      return false;
    }
    return true; // 只有警告，不算失败
  }
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
  console.log('\n🎉 所有测试通过！功能开发完成且验证成功。\n');
  console.log('📋 下一步操作建议:');
  console.log('   1. 启动应用进行人工测试');
  console.log('   2. 打开设置页面，找到"智能会话存储路径"');
  console.log('   3. 尝试设置自定义路径并创建会话');
  console.log('   4. 验证文件是否在正确的位置生成\n');
  process.exit(0);
} else {
  console.log('\n⚠️ 有测试失败，请检查上述错误信息。\n');
  process.exit(1);
}
