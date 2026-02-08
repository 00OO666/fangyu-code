const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// 修复单个文件
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 模式 1: logger.method("[Module] message")
  content = content.replace(
    /logger\.(info|error|warn|debug)\(\s*"\[([^\]]+)\]\s+([^"]+)"\s*\)/g,
    (match, method, module, message) => {
      modified = true;
      return `logger.${method}("${module}", "${message}")`;
    }
  );

  // 模式 2: logger.method("[Module] message:", arg)
  content = content.replace(
    /logger\.(info|error|warn|debug)\(\s*"\[([^\]]+)\]\s+([^"]+)"\s*,\s*([^)]+)\)/g,
    (match, method, module, message, arg) => {
      modified = true;
      // 移除 message 末尾的冒号
      message = message.replace(/:$/, '');
      return `logger.${method}("${module}", \`${message}: \${${arg}}\`)`;
    }
  );

  // 模式 3: logger.method(`[Module] message: ${var}`)
  content = content.replace(
    /logger\.(info|error|warn|debug)\(\s*`\[([^\]]+)\]\s+([^`]+)`\s*\)/g,
    (match, method, module, message) => {
      modified = true;
      return `logger.${method}("${module}", \`${message}\`)`;
    }
  );

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${path.relative('F:/Fangyu-Code-Dev', filePath)}`);
    return true;
  }

  return false;
}

// 主函数
async function main() {
  const files = await glob('src/**/*.{ts,tsx}', {
    cwd: 'F:/Fangyu-Code-Dev',
    absolute: true,
    ignore: ['**/node_modules/**']
  });

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

main().catch(console.error);
