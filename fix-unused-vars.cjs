/**
 * 自动修复 TypeScript 未使用变量错误 (TS6133)
 *
 * 功能：
 * 1. 运行 tsc 获取所有 TS6133 错误
 * 2. 解析错误信息
 * 3. 自动移除未使用的导入和变量声明
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 运行 tsc 并获取错误
function getUnusedVarErrors() {
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
    return [];
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');
    const errors = [];

    for (const line of lines) {
      // 匹配格式: src/file.tsx(123,45): error TS6133: 'varName' is declared but its value is never read.
      const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS6133: '(.+?)' is declared but its value is never read\./);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          varName: match[4]
        });
      }
    }

    return errors;
  }
}

// 移除未使用的导入
function removeUnusedImport(content, varName, lineNumber) {
  const lines = content.split('\n');
  const targetLine = lines[lineNumber - 1];

  if (!targetLine) return content;

  // 情况 1: import { varName } from '...'
  if (targetLine.includes(`import`) && targetLine.includes(varName)) {
    // 检查是否是单独导入
    const singleImportMatch = targetLine.match(/^import\s+{\s*(\w+)\s*}\s+from/);
    if (singleImportMatch && singleImportMatch[1] === varName) {
      // 移除整行
      lines.splice(lineNumber - 1, 1);
      return lines.join('\n');
    }

    // 多个导入，只移除这一个
    const multiImportMatch = targetLine.match(/import\s+{([^}]+)}\s+from/);
    if (multiImportMatch) {
      const imports = multiImportMatch[1].split(',').map(s => s.trim()).filter(s => s !== varName);
      if (imports.length > 0) {
        lines[lineNumber - 1] = targetLine.replace(/import\s+{[^}]+}/, `import { ${imports.join(', ')} }`);
      } else {
        lines.splice(lineNumber - 1, 1);
      }
      return lines.join('\n');
    }

    // 情况 2: import varName from '...'
    const defaultImportMatch = targetLine.match(/^import\s+(\w+)\s+from/);
    if (defaultImportMatch && defaultImportMatch[1] === varName) {
      lines.splice(lineNumber - 1, 1);
      return lines.join('\n');
    }
  }

  // 情况 3: const/let/var 声明
  if (targetLine.includes('const') || targetLine.includes('let') || targetLine.includes('var')) {
    // 检查是否是解构赋值中的一个变量
    const destructMatch = targetLine.match(/const\s+{([^}]+)}\s*=/);
    if (destructMatch) {
      const vars = destructMatch[1].split(',').map(s => s.trim()).filter(s => !s.includes(varName));
      if (vars.length > 0) {
        lines[lineNumber - 1] = targetLine.replace(/const\s+{[^}]+}/, `const { ${vars.join(', ')} }`);
      } else {
        lines.splice(lineNumber - 1, 1);
      }
      return lines.join('\n');
    }

    // 单独的变量声明
    if (targetLine.includes(varName)) {
      lines.splice(lineNumber - 1, 1);
      return lines.join('\n');
    }
  }

  return content;
}

// 处理单个文件
function fixFile(filePath, errors) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // 按行号倒序排序，从后往前删除，避免行号变化
  errors.sort((a, b) => b.line - a.line);

  for (const error of errors) {
    const newContent = removeUnusedImport(content, error.varName, error.line);
    if (newContent !== content) {
      content = newContent;
      modified = true;
      console.log(`  ✓ Removed unused '${error.varName}' at line ${error.line}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

// 主函数
function main() {
  console.log('🔍 Scanning for unused variable errors...\n');

  const errors = getUnusedVarErrors();
  console.log(`Found ${errors.length} unused variable errors\n`);

  if (errors.length === 0) {
    console.log('✅ No unused variable errors found!');
    return;
  }

  // 按文件分组
  const fileErrors = {};
  for (const error of errors) {
    if (!fileErrors[error.file]) {
      fileErrors[error.file] = [];
    }
    fileErrors[error.file].push(error);
  }

  // 处理每个文件
  let fixedFiles = 0;
  let fixedErrors = 0;

  for (const [filePath, fileErrorList] of Object.entries(fileErrors)) {
    console.log(`\n📝 Processing ${filePath}...`);
    if (fixFile(filePath, fileErrorList)) {
      fixedFiles++;
      fixedErrors += fileErrorList.length;
    }
  }

  console.log(`\n✅ Fixed ${fixedErrors} errors in ${fixedFiles} files`);
  console.log('\n🔄 Running tsc again to verify...\n');

  // 再次运行检查
  const remainingErrors = getUnusedVarErrors();
  console.log(`\n📊 Remaining unused variable errors: ${remainingErrors.length}`);
}

main();
