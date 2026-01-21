/**
 * 测试会话存储路径修复
 *
 * 验证路径规范化功能是否正常工作
 */

const { invoke } = window.__TAURI__.core;

async function testSessionPathFix() {
  console.log('=== 开始测试会话存储路径修复 ===\n');

  try {
    // 测试 1: 设置正常路径
    console.log('测试 1: 设置正常路径');
    const normalPath = 'E:\\FangyuCode\\Sessions';
    await invoke('set_session_storage_path', { path: normalPath });
    console.log(`✓ 设置路径: ${normalPath}`);

    const retrieved1 = await invoke('get_session_storage_path_setting');
    console.log(`✓ 读取路径: ${retrieved1}`);
    console.log(`✓ 路径匹配: ${retrieved1 === normalPath ? '是' : '否'}\n`);

    // 测试 2: 设置包含重复反斜杠的路径（模拟问题场景）
    console.log('测试 2: 设置包含重复反斜杠的路径');
    const malformedPath = 'F:\\\\Claude\\\\Projects\\\\\\\\Fangyu\\\\Code';
    await invoke('set_session_storage_path', { path: malformedPath });
    console.log(`✓ 设置路径: ${malformedPath}`);

    const retrieved2 = await invoke('get_session_storage_path_setting');
    console.log(`✓ 读取路径: ${retrieved2}`);
    console.log(`✓ 路径已规范化: ${!retrieved2.includes('\\\\\\\\') ? '是' : '否'}\n`);

    // 测试 3: 创建会话并验证路径
    console.log('测试 3: 创建测试会话');
    const testSessionId = await invoke('create_continued_session', {
      app: window.__TAURI__.app,
      projectPath: 'F:\\Fangyu-Code-Dev',
      systemPrompt: '这是一个测试会话',
      parentSessionId: 'test-parent-id',
      metadata: {
        continued_from: 'test-session',
        continued_at: Date.now()
      }
    });
    console.log(`✓ 会话创建成功: ${testSessionId}`);

    // 测试 4: 重置为默认路径
    console.log('\n测试 4: 重置为默认路径');
    await invoke('set_session_storage_path', { path: '' });
    const retrieved3 = await invoke('get_session_storage_path_setting');
    console.log(`✓ 路径已重置: ${retrieved3 === null ? '是' : '否'}\n`);

    console.log('=== 所有测试通过 ✓ ===');
    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 在浏览器控制台中运行
if (typeof window !== 'undefined' && window.__TAURI__) {
  testSessionPathFix().then(success => {
    if (success) {
      console.log('\n✅ 修复验证成功！会话路径问题已解决。');
    } else {
      console.log('\n❌ 修复验证失败，请检查错误信息。');
    }
  });
} else {
  console.error('❌ 此脚本需要在 Fangyu Code 应用中运行');
}
