/**
 * 🔧 FIX: 用户消息显示丢失问题修复补丁
 *
 * 问题：useDisplayableMessages 的复杂过滤逻辑可能误删用户消息
 * 解决：简化用户消息的过滤逻辑，确保所有有内容的用户消息都能显示
 *
 * 应用方法：
 * 1. 在 useDisplayableMessages.ts 的 filter 函数开头添加此逻辑
 * 2. 将用户消息的处理提前，避免被后续复杂逻辑误删
 */

// 在 return messages.filter((message, index) => { 之后立即添加：

// 🔧 FIX: 优先处理用户消息，确保不被误删
if (message.type === "user" && message.message) {
  // 1. 检查是否是 Warmup 消息
  if (hideWarmupMessages && warmupIndices.has(index)) {
    return false;
  }

  // 2. 检查是否是自动继续消息
  if (hideAutoContinueMessages && autoContinueIndices.has(index)) {
    return false;
  }

  // 3. 检查是否是元消息
  if (message.isMeta) {
    return false;
  }

  // 4. 检查是否有内容
  const msg = message.message;
  if (!msg.content || (Array.isArray(msg.content) && msg.content.length === 0)) {
    return false;
  }

  // 5. 检查内容是否只有文本（最常见的情况）
  if (Array.isArray(msg.content)) {
    const hasText = msg.content.some((c: any) => c.type === "text" && c.text?.trim());
    if (hasText) {
      // ✅ 有文本内容，直接显示
      return true;
    }
  }

  // 6. 如果没有文本但有其他内容，也显示（避免误删）
  // 🔧 FIX: 这是关键修复 - 之前的逻辑会过滤掉只有工具结果的消息
  return true;
}

// 然后继续原有的其他消息类型处理逻辑...
