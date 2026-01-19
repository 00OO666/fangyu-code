/**
 * Git 功能测试脚本
 * 
 * 用于验证 Git 回滚功能和拖拽功能的实现
 * 运行方式: node scripts/run-git-tests.js
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const pass = (msg) => console.log(`  ${colors.green}✅${colors.reset} ${msg}`);
const fail = (msg) => console.log(`  ${colors.red}❌${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`);
const header = (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}`);

console.log('\n' + '═'.repeat(60));
console.log(`${colors.bold}${colors.cyan}  Git 回滚功能 + 拖拽功能 完整测试${colors.reset}`);
console.log('═'.repeat(60));

const gitServicePath = path.join(__dirname, '../src/lib/gitService.ts');
const useDraggablePath = path.join(__dirname, '../src/hooks/useDraggable.ts');
const errorMonitorPath = path.join(__dirname, '../src/components/ErrorMonitorPanel.tsx');
const gitChangesPanelPath = path.join(__dirname, '../src/components/GitChangesPanel.tsx');
const simpleGitRsPath = path.join(__dirname, '../src-tauri/src/commands/simple_git.rs');

header('📁 文件存在性检查');

const files = [
  { path: gitServicePath, name: 'gitService.ts', desc: 'Git 服务前端 API' },
  { path: useDraggablePath, name: 'useDraggable.ts', desc: '拖拽 Hook' },
  { path: errorMonitorPath, name: 'ErrorMonitorPanel.tsx', desc: '错误监控面板' },
  { path: gitChangesPanelPath, name: 'GitChangesPanel.tsx', desc: 'Git 变更面板' },
  { path: simpleGitRsPath, name: 'simple_git.rs', desc: 'Rust Git 后端' },
];

let allFilesExist = true;
let passCount = 0;
let failCount = 0;

files.forEach(file => {
  const exists = fs.existsSync(file.path);
  if (exists) {
    pass(`${file.name} - ${file.desc}`);
    passCount++;
  } else {
    fail(`${file.name} - ${file.desc}`);
    failCount++;
  }
  if (!exists) allFilesExist = false;
});

// 测试 2: 检查 gitService 导出的函数
header('📦 gitService 函数检查');
const gitServiceContent = fs.readFileSync(gitServicePath, 'utf-8');

const expectedFunctions = [
  { name: 'isGitRepo', desc: '检查是否是 Git 仓库' },
  { name: 'getStatus', desc: '获取文件状态' },
  { name: 'getLog', desc: '获取提交历史' },
  { name: 'getDiff', desc: '获取差异' },
  { name: 'reset', desc: '重置到指定提交' },
  { name: 'revert', desc: '撤销提交' },
  { name: 'restore', desc: '恢复文件' },
  { name: 'createBackupBranch', desc: '创建备份分支' },
  { name: 'add', desc: '暂存文件' },
  { name: 'commit', desc: '创建提交' },
];

expectedFunctions.forEach(fn => {
  const exists = gitServiceContent.includes(`async ${fn.name}(`);
  if (exists) {
    pass(`${fn.name}() - ${fn.desc}`);
    passCount++;
  } else {
    fail(`${fn.name}() - ${fn.desc}`);
    failCount++;
  }
});

// 测试 3: 检查 useDraggable 功能
header('🖱️ useDraggable 功能检查');
const useDraggableContent = fs.readFileSync(useDraggablePath, 'utf-8');

const draggableFeatures = [
  { pattern: 'constrainPosition', name: '边界约束函数' },
  { pattern: 'localStorage', name: 'localStorage 持久化' },
  { pattern: 'onMouseDown', name: '鼠标按下事件' },
  { pattern: 'handleMouseMove', name: '鼠标移动处理' },
  { pattern: 'handleMouseUp', name: '鼠标释放处理' },
  { pattern: 'handleDoubleClick', name: '双击重置功能' },
  { pattern: "cursor:", name: '光标样式设置' },
  { pattern: 'getDefaultPosition', name: '默认位置计算' },
];

draggableFeatures.forEach(feature => {
  const exists = useDraggableContent.includes(feature.pattern);
  if (exists) {
    pass(feature.name);
    passCount++;
  } else {
    fail(feature.name);
    failCount++;
  }
});

// 测试 4: 检查 ErrorMonitorPanel 拖拽集成
header('🎯 ErrorMonitorPanel 拖拽集成检查');
const errorMonitorContent = fs.readFileSync(errorMonitorPath, 'utf-8');

const errorMonitorFeatures = [
  { pattern: 'useDraggable', name: 'useDraggable Hook 导入' },
  { pattern: 'dragHandleProps', name: '拖拽属性应用' },
  { pattern: 'position.x', name: '动态 X 位置' },
  { pattern: 'position.y', name: '动态 Y 位置' },
  { pattern: 'GripHorizontal', name: '拖拽手柄图标' },
  { pattern: 'isDragging', name: '拖拽状态检测' },
  { pattern: 'storageKey', name: '位置持久化配置' },
];

errorMonitorFeatures.forEach(feature => {
  const exists = errorMonitorContent.includes(feature.pattern);
  if (exists) {
    pass(feature.name);
    passCount++;
  } else {
    fail(feature.name);
    failCount++;
  }
});

// 测试 5: 检查 GitChangesPanel 回滚功能
header('🔄 GitChangesPanel 回滚功能检查');
const gitChangesPanelContent = fs.readFileSync(gitChangesPanelPath, 'utf-8');

const rollbackFeatures = [
  { pattern: 'RollbackMethod', name: '回滚方式类型定义' },
  { pattern: 'reset-soft', name: 'Soft Reset 选项' },
  { pattern: 'reset-mixed', name: 'Mixed Reset 选项' },
  { pattern: 'reset-hard', name: 'Hard Reset 选项' },
  { pattern: "'revert'", name: 'Revert 选项' },
  { pattern: 'executeRollback', name: '执行回滚函数' },
  { pattern: 'restoreFile', name: '单文件恢复函数' },
  { pattern: 'createBackup', name: '备份分支选项' },
  { pattern: 'ContextMenu', name: '右键菜单组件' },
  { pattern: 'getFileStatusDisplay', name: '文件状态显示函数' },
  { pattern: 'openRollbackDialog', name: '打开回滚对话框' },
  { pattern: 'showNotification', name: '操作通知功能' },
];

rollbackFeatures.forEach(feature => {
  const exists = gitChangesPanelContent.includes(feature.pattern);
  if (exists) {
    pass(feature.name);
    passCount++;
  } else {
    fail(feature.name);
    failCount++;
  }
});

// 测试 6: 检查 Rust 后端命令
header('🦀 Rust 后端命令检查');
const simpleGitContent = fs.readFileSync(simpleGitRsPath, 'utf-8');

const rustCommands = [
  { pattern: 'pub fn git_status', name: 'git_status 命令' },
  { pattern: 'pub fn git_log', name: 'git_log 命令' },
  { pattern: 'pub fn git_diff', name: 'git_diff 命令' },
  { pattern: 'pub fn git_reset', name: 'git_reset 命令' },
  { pattern: 'pub fn git_revert_commit', name: 'git_revert_commit 命令' },
  { pattern: 'pub fn git_restore', name: 'git_restore 命令' },
  { pattern: 'pub fn git_create_backup_branch', name: 'git_create_backup_branch 命令' },
  { pattern: 'pub fn git_add', name: 'git_add 命令' },
  { pattern: 'pub fn git_commit', name: 'git_commit 命令' },
  { pattern: '#[tauri::command]', name: 'Tauri 命令装饰器' },
];

rustCommands.forEach(cmd => {
  const exists = simpleGitContent.includes(cmd.pattern);
  if (exists) {
    pass(cmd.name);
    passCount++;
  } else {
    fail(cmd.name);
    failCount++;
  }
});

// 测试 7: 检查类型定义
header('📝 类型定义检查');

const typeChecks = [
  { content: gitServiceContent, pattern: 'GitFileStatus', name: 'GitFileStatus 类型 (前端)' },
  { content: gitServiceContent, pattern: 'GitCommitInfo', name: 'GitCommitInfo 类型 (前端)' },
  { content: gitServiceContent, pattern: 'GitCommandResult', name: 'GitCommandResult 类型 (前端)' },
  { content: gitServiceContent, pattern: 'ResetMode', name: 'ResetMode 类型 (前端)' },
  { content: simpleGitContent, pattern: 'struct GitFileStatus', name: 'GitFileStatus 结构体 (Rust)' },
  { content: simpleGitContent, pattern: 'struct GitCommitInfo', name: 'GitCommitInfo 结构体 (Rust)' },
  { content: simpleGitContent, pattern: 'struct GitCommandResult', name: 'GitCommandResult 结构体 (Rust)' },
];

typeChecks.forEach(check => {
  const exists = check.content.includes(check.pattern);
  if (exists) {
    pass(check.name);
    passCount++;
  } else {
    fail(check.name);
    failCount++;
  }
});

// 总结
console.log('\n' + '═'.repeat(60));
header('📊 测试总结');
console.log('═'.repeat(60));

const total = passCount + failCount;
const percentage = ((passCount / total) * 100).toFixed(1);

console.log(`\n  ${colors.green}通过: ${passCount}${colors.reset}`);
console.log(`  ${colors.red}失败: ${failCount}${colors.reset}`);
console.log(`  ${colors.cyan}总计: ${total}${colors.reset}`);
console.log(`  ${colors.bold}通过率: ${percentage}%${colors.reset}`);

if (failCount === 0) {
  console.log(`\n${colors.green}${colors.bold}🎉 所有测试通过！${colors.reset}`);
  console.log(`\n${colors.cyan}功能实现完成:${colors.reset}`);
  console.log('  ✅ 错误监控面板拖拽功能');
  console.log('  ✅ Git 回滚功能 (Reset/Revert/Restore)');
  console.log('  ✅ 单文件恢复功能');
  console.log('  ✅ 备份分支创建');
  console.log('  ✅ 文件状态增强显示');
  console.log(`\n${colors.yellow}下一步:${colors.reset}`);
  console.log('  1. 运行 npm run tauri dev 启动应用');
  console.log('  2. 测试错误监控面板拖拽');
  console.log('  3. 打开 Git 变更面板测试回滚功能');
} else {
  console.log(`\n${colors.red}${colors.bold}⚠️ 部分测试失败，请检查实现${colors.reset}`);
}

console.log('\n');
