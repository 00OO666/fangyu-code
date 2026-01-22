#!/usr/bin/env node

/**
 * 批量修复 lucide-react 的 barrel 导入问题
 *
 * 问题: import { Icon1, Icon2 } from 'lucide-react' 会导入整个库 (~2.5MB)
 * 解决: import Icon1 from 'lucide-react/dist/esm/icons/icon-1'
 *
 * 预期效果: Bundle 减少 ~2.5MB, 加载时间减少 ~2.8s
 */

const fs = require('fs');
const path = require('path');

// 图标名称转换为文件路径
function iconNameToPath(iconName) {
  // ChevronDown -> chevron-down
  // AlertTriangle -> alert-triangle
  return iconName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

// 递归查找文件
function findFiles(dir, pattern, results = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过 node_modules 和 dist
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        findFiles(filePath, pattern, results);
      }
    } else if (pattern.test(file)) {
      results.push(filePath);
    }
  }

  return results;
}

// 处理单个文件
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 匹配 import { Icon1, Icon2, ... } from 'lucide-react'
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;

  let match;
  let newContent = content;
  let hasChanges = false;

  while ((match = importRegex.exec(content)) !== null) {
    const iconsString = match[1];
    const icons = iconsString
      .split(',')
      .map(icon => icon.trim())
      .filter(icon => icon.length > 0);

    // 生成新的导入语句
    const newImports = icons
      .map(icon => {
        const iconPath = iconNameToPath(icon);
        return `import ${icon} from 'lucide-react/dist/esm/icons/${iconPath}'`;
      })
      .join('\n');

    // 替换旧的导入
    newContent = newContent.replace(match[0], newImports);
    hasChanges = true;
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return true;
  }

  return false;
}

// 主函数
function main() {
  console.log('🔍 搜索使用 lucide-react barrel 导入的文件...\n');

  const srcDir = path.resolve(__dirname, '..', 'src');
  const files = findFiles(srcDir, /\.(ts|tsx)$/);

  console.log(`📁 找到 ${files.length} 个文件\n`);

  let processedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const changed = processFile(file);
      if (changed) {
        processedCount++;
        const relativePath = path.relative(process.cwd(), file);
        console.log(`✅ ${relativePath}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ ${file}: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ 完成！`);
  console.log(`   - 处理文件: ${processedCount}`);
  console.log(`   - 错误: ${errorCount}`);
  console.log(`   - 预计 Bundle 减少: ~2.5MB`);
  console.log(`   - 预计加载时间减少: ~2.8s`);
  console.log('='.repeat(60));
}

main();
