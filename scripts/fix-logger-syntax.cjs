#!/usr/bin/env node
/**
 * 修复 logger 调用中的语法错误
 * - 移除 ); 模式（函数调用后多余的分号）
 * - 移除 ;, 模式（参数间多余的分号）
 * - 移除 ; + 模式（字符串拼接前多余的分号）
 */

const fs = require('fs');
const path = require('path');

const stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
};

function fixFile(filePath) {
  stats.filesScanned++;

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // Pattern 1: ); 后面跟 ; 或 ) - 例如: summary.slice(0, 200););
  content = content.replace(/(\w+\([^)]*\));(\))/g, (match, p1, p2) => {
    count++;
    return p1 + p2;
  });

  // Pattern 2: ;, - 例如: t('message');, err
  content = content.replace(/;,/g, () => {
    count++;
    return ',';
  });

  // Pattern 3: ; + - 例如: substring(0, 50); + '...'
  content = content.replace(/;\s*\+/g, () => {
    count++;
    return ' +';
  });

  // Pattern 4: ;. - 例如: (item as any);.type
  content = content.replace(/;\./g, () => {
    count++;
    return '.';
  });

  // Pattern 5: ; - - 例如: performance.now(); - perfStart
  content = content.replace(/;\s*-/g, () => {
    count++;
    return ' -';
  });

  // Pattern 6: ;} inside template literals - 例如: ${duration.toFixed(2);}ms
  // Only match when inside template literal context
  content = content.replace(/\$\{([^}]+);\}/g, (match, p1) => {
    count++;
    return `\${${p1}}`;
  });

  // Pattern 7: ; } in object literals and arrow functions
  // Match semicolon followed by optional whitespace and closing brace
  // But be careful not to break valid arrow functions
  content = content.replace(/([^=>\s]);\s*\}/g, (match, p1) => {
    count++;
    return `${p1} }`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesModified++;
    stats.replacements += count;
    console.log(`✓ ${filePath}: ${count} fixes`);
  }
}

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
        fixFile(fullPath);
      }
    }
  }
}

console.log('🔧 Fixing logger syntax errors...\n');

const srcDir = path.join(__dirname, '..', 'src');
scanDirectory(srcDir);

console.log('\n📊 Summary:');
console.log(`   Files scanned: ${stats.filesScanned}`);
console.log(`   Files modified: ${stats.filesModified}`);
console.log(`   Total fixes: ${stats.replacements}`);
