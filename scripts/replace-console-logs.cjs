#!/usr/bin/env node
/**
 * 自动替换 console.log 为 logger 调用
 *
 * 用法：node scripts/replace-console-logs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// 统计信息
const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
};

/**
 * 从文件路径提取模块名
 */
function getModuleName(filePath) {
  const basename = path.basename(filePath, path.extname(filePath));
  return basename;
}

/**
 * 检查文件是否已经导入 logger
 */
function hasLoggerImport(content) {
  return /import\s+.*\{\s*logger\s*\}.*from\s+['"]@\/lib\/logger['"]/.test(content);
}

/**
 * 添加 logger import
 */
function addLoggerImport(content) {
  // 找到第一个 import 语句的位置
  const importMatch = content.match(/^import\s+/m);
  if (importMatch) {
    const insertPos = importMatch.index;
    return content.slice(0, insertPos) +
           `import { logger } from '@/lib/logger';\n` +
           content.slice(insertPos);
  }
  // 如果没有 import，添加到文件开头
  return `import { logger } from '@/lib/logger';\n\n` + content;
}

/**
 * 替换 console 调用为 logger 调用
 */
function replaceConsoleCalls(content, moduleName) {
  let modified = content;
  let count = 0;

  // 替换 console.log
  modified = modified.replace(
    /console\.log\((.*?)\);?/g,
    (match, args) => {
      count++;
      return `logger.debug('${moduleName}', ${args});`;
    }
  );

  // 替换 console.warn
  modified = modified.replace(
    /console\.warn\((.*?)\);?/g,
    (match, args) => {
      count++;
      return `logger.warn('${moduleName}', ${args});`;
    }
  );

  // 替换 console.error
  modified = modified.replace(
    /console\.error\((.*?)\);?/g,
    (match, args) => {
      count++;
      return `logger.error('${moduleName}', ${args});`;
    }
  );

  // 替换 console.debug
  modified = modified.replace(
    /console\.debug\((.*?)\);?/g,
    (match, args) => {
      count++;
      return `logger.debug('${moduleName}', ${args});`;
    }
  );

  return { modified, count };
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  stats.filesScanned++;

  const content = fs.readFileSync(filePath, 'utf8');
  const moduleName = getModuleName(filePath);

  // 检查是否有 console 调用
  if (!/console\.(log|warn|error|debug)\(/.test(content)) {
    return;
  }

  // 替换 console 调用
  const { modified, count } = replaceConsoleCalls(content, moduleName);

  if (count === 0) {
    return;
  }

  // 添加 logger import（如果需要）
  let final = modified;
  if (!hasLoggerImport(modified)) {
    final = addLoggerImport(modified);
  }

  stats.replacements += count;
  stats.filesModified++;

  console.log(`✓ ${filePath}: ${count} replacements`);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, final, 'utf8');
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir, excludeDirs = ['node_modules', 'dist', '.git', 'build']) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        scanDirectory(fullPath, excludeDirs);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx'].includes(ext)) {
        processFile(fullPath);
      }
    }
  }
}

// 主程序
console.log('🔍 Scanning for console.log statements...\n');

if (DRY_RUN) {
  console.log('⚠️  DRY RUN MODE - No files will be modified\n');
}

const srcDir = path.join(__dirname, '..', 'src');
scanDirectory(srcDir);

console.log('\n📊 Summary:');
console.log(`   Files scanned: ${stats.filesScanned}`);
console.log(`   Files modified: ${stats.filesModified}`);
console.log(`   Total replacements: ${stats.replacements}`);

if (DRY_RUN) {
  console.log('\n💡 Run without --dry-run to apply changes');
}
