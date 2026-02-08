const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const files = [
  'src/components/cli-monitor/SessionDetailPanel.tsx',
  'src/components/cli-monitor/SessionGridView.tsx',
  'src/components/cli-monitor/SessionThumbnail.tsx',
  'src/components/cli-monitor/WindowDropdown.tsx',
];

// 修复单个文件
function fixFile(filePath) {
  const fullPath = path.join('F:/Fangyu-Code-Dev', filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // 匹配 logger.info/error/warn/debug 调用
  // 格式：logger.method("[ModuleName] message", args...)
  // 转换为：logger.method("ModuleName", "message: " + args)

  // 匹配模式：logger.info("[ModuleName] message", arg)
  const pattern1 = /logger\.(info|error|warn|debug)\(\s*\[([^\]]+)\]\s+([^"]+)"\s*,\s*([^)]+)\)/g;
  content = content.replace(pattern1, (match, method, module, message, args) => {
    modified = true;
    // 移除 message 前的引号
    message = message.replace(/^["']/, '');
    return `logger.${method}("${module}", "${message}: " + ${args})`;
  });

  // 匹配模式：logger.info("[ModuleName] message")
  const pattern2 = /logger\.(info|error|warn|debug)\(\s*"?\[([^\]]+)\]\s+([^"]+)"\s*\)/g;
  content = content.replace(pattern2, (match, method, module, message) => {
    modified = true;
    return `logger.${method}("${module}", "${message}")`;
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// 主函数
function main() {
  let fixedCount = 0;

  for (const file of files) {
    try {
      if (fixFile(file)) {
        fixedCount++;
      }
    } catch (error) {
      console.error(`✗ Error fixing ${file}:`, error.message);
    }
  }

  console.log(`\n✓ Fixed ${fixedCount} files`);
}

main();
