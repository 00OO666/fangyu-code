/**
 * 费用差异调试脚本
 *
 * 在 Fangyu Code 的浏览器控制台（F12）中运行此脚本
 * 用于诊断提示词导航和会话统计之间的费用差异
 */

// 1. 获取当前会话的所有消息
function getAllMessages() {
  // 尝试从 React DevTools 或全局状态获取
  // 注意：这需要根据实际的状态管理方式调整
  console.log('请在控制台手动获取 messages 数组');
  console.log('例如：const messages = [...]; // 从 React DevTools 复制');
  return null;
}

// 2. 模拟提示词导航的费用计算
function calculatePromptNavigatorCost(messages) {
  let totalCost = 0;
  let promptCount = 0;
  const promptDetails = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageType = message.type || message.message?.role;

    if (messageType === 'user') {
      let promptCost = 0;
      let messageCount = 0;
      const messagesInPrompt = [];

      // 向后查找所有 assistant/system 消息
      for (let j = i + 1; j < messages.length; j++) {
        const nextMessage = messages[j];
        const nextType = nextMessage.type || nextMessage.message?.role;

        // 遇到下一个 user 消息，停止
        if (nextType === 'user') break;

        if (nextType === 'assistant' || nextType === 'system') {
          messageCount++;
          messagesInPrompt.push({
            index: j,
            type: nextType,
            cost: nextMessage.costUSD || nextMessage.cost_usd || 0,
            tokens: nextMessage.message?.usage
          });

          // 累加费用
          const cost = nextMessage.costUSD || nextMessage.totalCostUSD ||
                      nextMessage.cost_usd || nextMessage.total_cost_usd || 0;
          promptCost += cost;
        }
      }

      if (messageCount > 0) {
        promptCount++;
        totalCost += promptCost;
        promptDetails.push({
          promptIndex: promptCount,
          userMessageIndex: i,
          cost: promptCost,
          messageCount,
          messages: messagesInPrompt
        });
      }
    }
  }

  return {
    totalCost,
    promptCount,
    details: promptDetails
  };
}

// 3. 模拟会话统计的费用计算
function calculateSessionCost(messages) {
  let totalCost = 0;
  let messageCount = 0;
  const messageDetails = [];
  const processedKeys = new Set();

  messages.forEach((message, index) => {
    const messageType = message.type || message.message?.role;
    const engine = message.engine || 'claude';

    // 判断是否可计费
    const isClaudeBillable = engine === 'claude' && messageType === 'assistant';
    const isCodexBillable = engine === 'codex' && messageType === 'system' && message.usage;
    const isGeminiBillable = engine === 'gemini' && messageType === 'result' && message.usage;

    if (!isClaudeBillable && !isCodexBillable && !isGeminiBillable) {
      return;
    }

    // 生成去重 key
    const messageId = message.message?.id || message.id || message.uuid;
    const key = messageId || `index:${index}`;

    // 跳过重复消息
    if (processedKeys.has(key)) {
      return;
    }
    processedKeys.add(key);

    // 提取费用
    const cost = message.costUSD || message.totalCostUSD ||
                message.cost_usd || message.total_cost_usd || 0;

    if (cost > 0) {
      messageCount++;
      totalCost += cost;
      messageDetails.push({
        index,
        type: messageType,
        engine,
        cost,
        key,
        tokens: message.message?.usage
      });
    }
  });

  return {
    totalCost,
    messageCount,
    details: messageDetails
  };
}

// 4. 对比分析
function analyzeCostDifference(messages) {
  console.log('=== 费用差异分析 ===\n');

  const promptNav = calculatePromptNavigatorCost(messages);
  const sessionCost = calculateSessionCost(messages);

  console.log('📊 提示词导航统计:');
  console.log(`  - 提示词数量: ${promptNav.promptCount}`);
  console.log(`  - 总费用: $${promptNav.totalCost.toFixed(4)}`);
  console.log('');

  console.log('📊 会话统计:');
  console.log(`  - 消息数量: ${sessionCost.messageCount}`);
  console.log(`  - 总费用: $${sessionCost.totalCost.toFixed(4)}`);
  console.log('');

  const difference = sessionCost.totalCost - promptNav.totalCost;
  const percentDiff = (difference / sessionCost.totalCost * 100).toFixed(2);

  console.log('💰 差异分析:');
  console.log(`  - 差异金额: $${difference.toFixed(4)}`);
  console.log(`  - 差异百分比: ${percentDiff}%`);
  console.log('');

  // 找出未被提示词导航计入的消息
  const promptNavMessageIndices = new Set();
  promptNav.details.forEach(prompt => {
    prompt.messages.forEach(msg => {
      promptNavMessageIndices.add(msg.index);
    });
  });

  const missingMessages = sessionCost.details.filter(msg =>
    !promptNavMessageIndices.has(msg.index)
  );

  if (missingMessages.length > 0) {
    console.log('⚠️ 未被提示词导航计入的消息:');
    missingMessages.forEach(msg => {
      console.log(`  - 索引 ${msg.index}: ${msg.type} (${msg.engine}), 费用: $${msg.cost.toFixed(4)}`);
    });
    console.log('');

    const missingCost = missingMessages.reduce((sum, msg) => sum + msg.cost, 0);
    console.log(`  未计入消息总费用: $${missingCost.toFixed(4)}`);
    console.log('');
  }

  // 详细的提示词费用分解
  console.log('📋 提示词费用详情:');
  promptNav.details.forEach(prompt => {
    console.log(`  Prompt #${prompt.promptIndex} (消息索引 ${prompt.userMessageIndex}):`);
    console.log(`    - 费用: $${prompt.cost.toFixed(4)}`);
    console.log(`    - 包含消息: ${prompt.messageCount} 条`);
  });

  return {
    promptNav,
    sessionCost,
    difference,
    percentDiff,
    missingMessages
  };
}

// 5. 使用说明
console.log('=== 费用差异调试工具 ===');
console.log('');
console.log('使用方法:');
console.log('1. 在 React DevTools 中找到包含 messages 的组件');
console.log('2. 复制 messages 数组到控制台');
console.log('3. 运行: const result = analyzeCostDifference(messages);');
console.log('');
console.log('示例:');
console.log('  const messages = [...]; // 从 React DevTools 复制');
console.log('  const result = analyzeCostDifference(messages);');
console.log('');

// 导出函数供使用
window.__debugCostDifference = analyzeCostDifference;
window.__calculatePromptNavigatorCost = calculatePromptNavigatorCost;
window.__calculateSessionCost = calculateSessionCost;

console.log('✅ 调试工具已加载！');
console.log('可用函数:');
console.log('  - window.__debugCostDifference(messages)');
console.log('  - window.__calculatePromptNavigatorCost(messages)');
console.log('  - window.__calculateSessionCost(messages)');
