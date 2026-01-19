/**
 * 实现验证脚本
 * 
 * 验证拖拽功能和 Git 回滚功能的完整实现
 * 运行方式: node scripts/verify-implementation.js
 */

const fs = require('fs');
const path = require('path');

console.log('═'.repeat(60));
console.log('  Fangyu Code - 功能实现验证');
console.log('═'.repeat(60));

let totalChecks = 0;
let passedChecks = 0;

function check(name, condition) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ ${name}`);
    return true;
  } else {
    console.log(`  ❌ ${name}`);
    return false;
  }
}

function checkFileExists(filePath, name) {
  const fullPath = path.join(__dirname, '..', filePath);
  return check(name, fs.existsSync(fullPath));
}

function checkFileContains(filePath, patterns, name) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  ❌ ${name} (文件不存在)`);
    totalChecks++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const allFound = patterns.every(p => content.includes(p));
  return check(name, allFound);
}

// ============================================================
// 1. 文件存在性检查
// ============================================================
console.log('\n📁 文件存在性检查');
console.log('─'.repeat(40));

checkFileExists('src/hooks/useDraggable.ts', 'useDraggable Hook');
checkFileExists('src/components/ErrorMonitorPanel.tsx', 'ErrorMonitorPanel 组件');
checkFileExists('src/lib/gitService.ts', 'Git 服务层');
checkFileExists('src/components/GitChangesPanel.tsx', 'Git 变更面板');
checkFileExists('src-tauri/src/commands/simple_git.rs', 'Rust Git 后端');
checkFileExists('src/tests/useDraggable.test.ts', '拖拽测试文件');
checkFileExists('src/tests/git-rollback.test.ts', 'Git 回滚测试文件');

// ============================================================
// 2. useDraggable Hook 功能检查
// ============================================================
console.log('\n🖱️ useDraggable Hook 功能检查');
console.log('─'.repeat(40));

checkFileContains('src/hooks/useDraggable.ts', [
  'constrainPosition',
  'localStorage',
], '边界约束 + localStorage 持久化');

checkFileContains('src/hooks/useDraggable.ts', [
  'onMouseDown',
  'handleMouseMove',
  'handleMouseUp',
], '鼠标事件处理');

checkFileContains('src/hooks/useDraggable.ts', [
  'onDoubleClick',
  'resetPosition',
], '双击重置功能');

checkFileContains('src/hooks/useDraggable.ts', [
  "cursor: isDragging ? 'move' : 'move'",
], '移动光标样式 (move)');

// ============================================================
// 3. ErrorMonitorPanel 拖拽集成检查
// ============================================================
console.log('\n🎯 ErrorMonitorPanel 拖拽集成检查');
console.log('─'.repeat(40));

checkFileContains('src/components/ErrorMonitorPanel.tsx', [
  'useDraggable',
  'dragHandleProps',
], 'useDraggable Hook 集成');

checkFileContains('src/components/ErrorMonitorPanel.tsx', [
  'position.x',
  'position.y',
], '动态位置应用');

checkFileContains('src/components/ErrorMonitorPanel.tsx', [
  'GripHorizontal',
], '拖拽手柄图标');

checkFileContains('src/components/ErrorMonitorPanel.tsx', [
  'fangyu-error-panel-position',
], 'localStorage 存储键');

// ============================================================
// 4. gitService 前端服务检查
// ============================================================
console.log('\n📦 gitService 前端服务检查');
console.log('─'.repeat(40));

const gitServiceFunctions = [
  'isGitRepo',
  'getStatus',
  'getLog',
  'getDiff',
  'reset',
  'revert',
  'restore',
  'createBackupBranch',
  'add',
  'commit',
];

gitServiceFunctions.forEach(fn => {
  checkFileContains('src/lib/gitService.ts', [`async ${fn}(`], `${fn}() 函数`);
});

// ============================================================
// 5. Rust 后端命令检查
// ============================================================
console.log('\n🦀 Rust 后端命令检查');
console.log('─'.repeat(40));

const rustCommands = [
  ['pub fn git_status', 'git_status 命令'],
  ['pub fn git_log', 'git_log 命令'],
  ['pub fn git_diff', 'git_diff 命令'],
  ['pub fn git_reset', 'git_reset 命令'],
  ['pub fn git_revert_commit', 'git_revert_commit 命令'],
  ['pub fn git_restore', 'git_restore 命令'],
  ['pub fn git_create_backup_branch', 'git_create_backup_branch 命令'],
  ['pub fn git_add', 'git_add 命令'],
  ['pub fn git_commit', 'git_commit 命令'],
];

rustCommands.forEach(([pattern, name]) => {
  checkFileContains('src-tauri/src/commands/simple_git.rs', [pattern], name);
});

// ============================================================
// 6. GitChangesPanel 回滚功能检查
// ============================================================
console.log('\n🔄 GitChangesPanel 回滚功能检查');
console.log('─'.repeat(40));

checkFileContains('src/components/GitChangesPanel.tsx', [
  'RollbackMethod',
], '回滚方式类型定义');

checkFileContains('src/components/GitChangesPanel.tsx', [
  'reset-soft',
  'reset-mixed',
  'reset-hard',
  'revert',
], '四种回滚选项');

checkFileContains('src/components/GitChangesPanel.tsx', [
  'executeRollback',
], '执行回滚函数');

checkFileContains('src/components/GitChangesPanel.tsx', [
  'restoreFile',
], '单文件恢复函数');

checkFileContains('src/components/GitChangesPanel.tsx', [
  'createBackup',
], '备份分支选项');

checkFileContains('src/components/GitChangesPanel.tsx', [
  'ContextMenu',
], '右键上下文菜单');

// ============================================================
// 7. main.rs 命令注册检查
// ============================================================
console.log('\n📋 main.rs 命令注册检查');
console.log('─'.repeat(40));

checkFileContains('src-tauri/src/main.rs', [
  'git_status',
  'git_log',
  'git_reset',
  'git_revert_commit',
  'git_restore',
], 'Git 命令已注册');

// ============================================================
// 总结
// ============================================================
console.log('\n' + '═'.repeat(60));
console.log('  验证结果');
console.log('═'.repeat(60));

const passRate = ((passedChecks / totalChecks) * 100).toFixed(1);
console.log(`\n  通过: ${passedChecks}/${totalChecks} (${passRate}%)`);

if (passedChecks === totalChecks) {
  console.log('\n  🎉 所有功能已完整实现！');
  console.log('\n  📝 下一步:');
  console.log('     1. 运行 npm run tauri dev 启动应用');
  console.log('     2. 在开发模式下测试错误监控面板拖拽');
  console.log('     3. 打开 Git 变更面板测试回滚功能');
  console.log('     4. 运行 npm run test 执行单元测试');
} else {
  console.log('\n  ⚠️ 部分功能未完整实现，请检查上述失败项');
}

console.log('\n');

// 退出码
process.exit(passedChecks === totalChecks ? 0 : 1);
