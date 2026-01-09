// HiAPI 连接测试脚本
const API_KEY = 'sk-ljX4qbaBf84c9tOytKzYDFHdc7hlkUEJ1ix2ZoionqiGA9xp';
const BASE_URL = 'https://hiapi.online/v1';  // 正确的地址

async function testAPI() {
  console.log('🔍 测试 HiAPI 连接...\n');

  // 1. 测试获取模型列表
  console.log('1️⃣ 获取模型列表...');
  try {
    const modelsRes = await fetch(`${BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    
    if (modelsRes.ok) {
      const data = await modelsRes.json();
      console.log('✅ 模型列表获取成功');
      console.log(`   可用模型数量: ${data.data?.length || 0}`);
      if (data.data?.slice(0, 5)) {
        console.log('   前5个模型:', data.data.slice(0, 5).map(m => m.id).join(', '));
      }
    } else {
      console.log('❌ 获取模型列表失败:', modelsRes.status, modelsRes.statusText);
    }
  } catch (e) {
    console.log('❌ 网络错误:', e.message);
  }

  // 2. 测试 Chat Completion
  console.log('\n2️⃣ 测试 Chat Completion (gpt-4o-mini)...');
  try {
    const chatRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: '你好，请用一句话介绍自己' }],
        max_tokens: 100
      })
    });

    if (chatRes.ok) {
      const data = await chatRes.json();
      console.log('✅ Chat Completion 成功');
      console.log('   模型:', data.model);
      console.log('   回复:', data.choices?.[0]?.message?.content);
      console.log('   Token 使用:', JSON.stringify(data.usage));
    } else {
      const err = await chatRes.json().catch(() => ({}));
      console.log('❌ Chat 失败:', chatRes.status, err.error?.message || chatRes.statusText);
    }
  } catch (e) {
    console.log('❌ 网络错误:', e.message);
  }

  console.log('\n✨ 测试完成');
}

testAPI();
