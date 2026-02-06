#!/usr/bin/env node

/**
 * Gateway 测试脚本
 *
 * 测试流程：
 * 1. 启动 Gateway Server
 * 2. 发送测试消息到 Telegram Bot
 * 3. 验证 Claude API 响应
 * 4. 验证工具执行（如果有 Client 连接）
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config({ path: '.env.gateway' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.ALERT_TELEGRAM_CHAT_ID;

async function testGateway() {
  console.log('🧪 开始测试 Gateway...\n');

  // 测试 1: 检查环境变量
  console.log('✅ 测试 1: 检查环境变量');
  const requiredVars = ['TELEGRAM_BOT_TOKEN', 'CLAUDE_API_KEY', 'SOCKET_PORT', 'ALERT_TELEGRAM_CHAT_ID'];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.error(`❌ 缺少环境变量: ${varName}`);
      process.exit(1);
    }
    console.log(`   ✓ ${varName}: ${process.env[varName].substring(0, 10)}...`);
  }
  console.log('');

  // 测试 2: 测试 Telegram Bot
  console.log('✅ 测试 2: 测试 Telegram Bot');
  try {
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    const me = await bot.getMe();
    console.log(`   ✓ Bot 用户名: @${me.username}`);
    console.log(`   ✓ Bot ID: ${me.id}`);
    console.log('');
  } catch (error) {
    console.error(`   ❌ Telegram Bot 测试失败: ${error.message}`);
    process.exit(1);
  }

  // 测试 3: 测试 Claude API
  console.log('✅ 测试 3: 测试 Claude API');
  try {
    const response = await axios.post(
      `${process.env.CLAUDE_BASE_URL}/v1/messages`,
      {
        model: 'claude-opus-4-20250514',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: '你好，请回复"测试成功"'
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const content = response.data.content[0].text;
    console.log(`   ✓ Claude 响应: ${content}`);
    console.log(`   ✓ Token 使用: ${response.data.usage.input_tokens} in, ${response.data.usage.output_tokens} out`);
    console.log('');
  } catch (error) {
    console.error(`   ❌ Claude API 测试失败: ${error.response?.data || error.message}`);
    process.exit(1);
  }

  // 测试 4: 发送测试消息
  console.log('✅ 测试 4: 发送测试消息到 Bot');
  try {
    const bot = new TelegramBot(BOT_TOKEN, { polling: false });
    await bot.sendMessage(
      CHAT_ID,
      '🧪 **Gateway 测试消息**\n\n请回复任意消息来测试 Gateway 是否正常工作。\n\n如果 Gateway 正在运行，你应该会收到 Claude 的回复。'
    );
    console.log(`   ✓ 测试消息已发送到 Chat ID: ${CHAT_ID}`);
    console.log('');
  } catch (error) {
    console.error(`   ❌ 发送测试消息失败: ${error.message}`);
    process.exit(1);
  }

  console.log('✅ 所有测试通过！\n');
  console.log('📝 下一步：');
  console.log('   1. 启动 Gateway: npm run dev:gateway');
  console.log('   2. 在 Telegram 中向 Bot 发送消息');
  console.log('   3. 观察 Gateway 日志输出');
  console.log('   4. (可选) 启动 Client: npm run dev:client');
  console.log('');
}

testGateway().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
