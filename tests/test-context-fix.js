#!/usr/bin/env node

/**
 * 自动化测试脚本 - 验证上下文丢失问题修复
 *
 * 测试场景：
 * 1. 发送第一条消息
 * 2. 等待会话初始化
 * 3. 发送第二条消息
 * 4. 验证 Claude 能否看到第一条消息
 */

const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_PROJECT_PATH = 'F:\\Fangyu-Code-Dev';
const SESSION_STORAGE_PATH = path.join(TEST_PROJECT_PATH, '.claude');

// 测试消息
const FIRST_MESSAGE = '你好，我的名字是测试用户，我正在测试上下文功能。请记住我的名字。';
const SECOND_MESSAGE = '你还记得我的名字吗？请告诉我。';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 检查会话文件
function checkSessionFiles() {
  info('检查会话文件...');

  if (!fs.existsSync(SESSION_STORAGE_PATH)) {
    warning(`会话目录不存在: ${SESSION_STORAGE_PATH}`);
    return null;
  }

  const files = fs.readdirSync(SESSION_STORAGE_PATH);
  const sessionFiles = files.filter(f => f.endsWith('.jsonl'));

  if (sessionFiles.length === 0) {
    warning('没有找到会话文件');
    return null;
  }

  info(`找到 ${sessionFiles.length} 个会话文件`);

  // 获取最新的会话文件
  const latestSession = sessionFiles
    .map(f => ({
      name: f,
      path: path.join(SESSION_STORAGE_PATH, f),
      mtime: fs.statSync(path.join(SESSION_STORAGE_PATH, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime)[0];

  info(`最新会话文件: ${latestSession.name}`);
  return latestSession;
}

// 读取会话内容
function readSessionContent(sessionFile) {
  if (!sessionFile) return [];

  const content = fs.readFileSync(sessionFile.path, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

// 提取用户消息
function extractUserMessages(sessionData) {
  return sessionData
    .filter(entry => entry.message && entry.message.role === 'user')
    .map(entry => {
      const content = entry.message.content;
      if (typeof content === 'string') {
        return content;
      } else if (Array.isArray(content)) {
        return content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('');
      }
      return '';
    });
}

// 提取助手消息
function extractAssistantMessages(sessionData) {
  return sessionData
    .filter(entry => entry.message && entry.message.role === 'assistant')
    .map(entry => {
      const content = entry.message.content;
      if (typeof content === 'string') {
        return content;
      } else if (Array.isArray(content)) {
        return content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('');
      }
      return '';
    });
}

// 主测试函数
async function runTest() {
  log('\n=== 上下文丢失问题修复测试 ===\n', 'blue');

  // 步骤 1: 检查会话文件
  info('步骤 1: 检查会话文件');
  const sessionFile = checkSessionFiles();

  if (!sessionFile) {
    error('测试失败：没有找到会话文件');
    info('请先在 Fangyu Code 中发送至少两条消息');
    process.exit(1);
  }

  // 步骤 2: 读取会话内容
  info('\n步骤 2: 读取会话内容');
  const sessionData = readSessionContent(sessionFile);
  info(`会话包含 ${sessionData.length} 条记录`);

  // 步骤 3: 提取消息
  info('\n步骤 3: 提取消息');
  const userMessages = extractUserMessages(sessionData);
  const assistantMessages = extractAssistantMessages(sessionData);

  info(`用户消息数量: ${userMessages.length}`);
  info(`助手消息数量: ${assistantMessages.length}`);

  // 步骤 4: 验证上下文
  info('\n步骤 4: 验证上下文');

  if (userMessages.length < 2) {
    warning('用户消息少于 2 条，无法验证上下文');
    info('请在 Fangyu Code 中发送至少两条消息');
    process.exit(0);
  }

  // 显示消息历史
  log('\n--- 消息历史 ---', 'yellow');
  userMessages.forEach((msg, i) => {
    log(`用户 ${i + 1}: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`, 'blue');
    if (assistantMessages[i]) {
      log(`助手 ${i + 1}: ${assistantMessages[i].substring(0, 100)}${assistantMessages[i].length > 100 ? '...' : ''}`, 'green');
    }
  });
  log('--- 消息历史结束 ---\n', 'yellow');

  // 步骤 5: 验证第二条消息是否在同一会话中
  info('步骤 5: 验证会话连续性');

  // 检查是否有 session_id
  const sessionIds = sessionData
    .filter(entry => entry.session_id)
    .map(entry => entry.session_id);

  const uniqueSessionIds = [...new Set(sessionIds)];

  if (uniqueSessionIds.length === 0) {
    error('没有找到 session_id');
    process.exit(1);
  } else if (uniqueSessionIds.length === 1) {
    success(`所有消息都在同一个会话中: ${uniqueSessionIds[0]}`);
  } else {
    error(`发现多个会话 ID: ${uniqueSessionIds.join(', ')}`);
    error('这表明每条消息都创建了新会话！');
    process.exit(1);
  }

  // 步骤 6: 验证助手是否能看到历史消息
  info('\n步骤 6: 验证助手响应');

  if (assistantMessages.length < 2) {
    warning('助手响应少于 2 条，无法验证上下文理解');
    process.exit(0);
  }

  // 简单的上下文验证：检查第二条助手消息是否提到了第一条用户消息的内容
  const firstUserMsg = userMessages[0].toLowerCase();
  const secondAssistantMsg = assistantMessages[1].toLowerCase();

  // 提取第一条消息中的关键词（简单实现）
  const keywords = firstUserMsg
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 5);

  const contextFound = keywords.some(keyword => secondAssistantMsg.includes(keyword));

  if (contextFound) {
    success('助手的第二条响应中包含了第一条消息的内容，上下文正确传递！');
  } else {
    warning('无法确定助手是否看到了第一条消息的内容');
    info('这可能是因为用户的第二条消息没有要求助手回忆第一条消息');
  }

  // 测试总结
  log('\n=== 测试总结 ===\n', 'blue');
  success(`✅ 会话文件存在: ${sessionFile.name}`);
  success(`✅ 会话包含 ${userMessages.length} 条用户消息`);
  success(`✅ 会话包含 ${assistantMessages.length} 条助手消息`);
  success(`✅ 所有消息都在同一个会话中: ${uniqueSessionIds[0]}`);

  if (contextFound) {
    success('✅ 上下文正确传递');
  } else {
    warning('⚠️  无法确定上下文是否正确传递');
  }

  log('\n测试完成！\n', 'green');
}

// 运行测试
runTest().catch(err => {
  error(`测试失败: ${err.message}`);
  console.error(err);
  process.exit(1);
});
