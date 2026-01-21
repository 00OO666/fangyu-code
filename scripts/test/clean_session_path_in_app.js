/**
 * 在 Fangyu Code 应用内清空会话存储路径配置
 *
 * 使用方法：
 * 1. 打开 Fangyu Code 开发者工具（F12）
 * 2. 在控制台粘贴此脚本并回车
 */

(async function cleanSessionStoragePath() {
  console.log('=== 开始清理会话存储路径配置 ===\n');

  try {
    const { invoke } = window.__TAURI__.core;

    // 1. 查看当前配置
    console.log('1. 查看当前配置...');
    const currentPath = await invoke('get_session_storage_path_setting');
    console.log(`   当前路径: ${currentPath || '(未设置)'}`);

    if (currentPath && currentPath.includes('\\\\\\\\')) {
      console.log('   ⚠️ 检测到异常路径（包含重复反斜杠）');
    }

    // 2. 清空配置（恢复默认）
    console.log('\n2. 清空配置...');
    await invoke('set_session_storage_path', { path: '' });
    console.log('   ✅ 配置已清空');

    // 3. 验证清空结果
    console.log('\n3. 验证清空结果...');
    const newPath = await invoke('get_session_storage_path_setting');
    console.log(`   新路径: ${newPath || '(未设置，将使用默认路径)'}`);

    console.log('\n=== 清理完成 ✓ ===');
    console.log('\n💡 提示：');
    console.log('   - 会话存储路径已恢复为默认值');
    console.log('   - 新创建的会话将使用正确的路径');
    console.log('   - 历史会话记录中的错误路径不影响功能');

    return true;
  } catch (error) {
    console.error('❌ 清理失败:', error);
    return false;
  }
})();
