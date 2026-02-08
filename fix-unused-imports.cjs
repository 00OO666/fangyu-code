/**
 * 安全地修复未使用的导入
 * 只删除整行的简单导入，不触碰复杂的解构赋值
 */

const fs = require('fs');
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

// 安全地移除未使用的导入（只处理简单情况）
function safeRemoveUnusedImport(content, varName, lineNumber) {
  const lines = content.split('\n');
  const targetLine = lines[lineNumber - 1];

  if (!targetLine) return content;

  // 只处理 import 语句
  if (!targetLine.trim().startsWith('import')) {
    return content;
  }

  // 情况 1: import { varName } from '...' (单个导入)
  const singleImportMatch = targetLine.match(/^import\s*{\s*(\w+)\s*}\s*from/);
  if (singleImportMatch && singleImportMatch[1] === varName) {
    lines.splice(lineNumber - 1, 1);
    return lines.join('\n');
  }

  // 情况 2: import varName from '...' (默认导入)
  const defaultImportMatch = targetLine.match(/^import\s+(\w+)\s+from/);
  if (defaultImportMatch && defaultImportMatch[1] === varName) {
    lines.splice(lineNumber - 1, 1);
    return lines.join('\n');
  }

  // 情况 3: import { a, varName, b } from '...' (多个导入中的一个)
  if (targetLine.includes('{') && targetLine.includes(varName)) {
    const multiImportMatch = targetLine.match(/import\s*{([^}]+)}\s*from/);
    if (multiImportMatch) {
      const imports = multiImportMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== varName);

      if (imports.length > 0) {
        lines[lineNumber - 1] = targetLine.replace(
          /import\s*{[^}]+}/,
          `import { ${imports.join(', ')} }`
        );
      } else {
        lines.splice(lineNumber - 1, 1);
      }
      return lines.join('\n');
    }
  }

  return content;
}

// 处理单个文件
function fixFile(filePath, errors) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // 按行号倒序排序，从后往前删除
  errors.sort((a, b) => b.line - a.line);

  for (const error of errors) {
    const newContent = safeRemoveUnusedImport(content, error.varName, error.line);
    if (newContent !== content) {
      content = newContent;
      modified = true;
      console.log(`  ✓ Removed unused import '${error.varName}' at line ${error.line}`);
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
  console.log('🔍 Scanning for unused import errors...\n');

  const errors = getUnusedVarErrors();
  console.log(`Found ${errors.length} unused variable errors\n`);

  if (errors.length === 0) {
    console.log('✅ No unused variable errors found!');
    return;
  }

  // 只处理导入错误
  const importErrors = errors.filter(err => {
    try {
      const content = fs.readFileSync(err.file, 'utf-8');
      const lines = content.split('\n');
      const line = lines[err.line - 1];
      return line && line.trim().startsWith('import');
    } catch {
      return false;
    }
  });

  console.log(`Found ${importErrors.length} unused import errors to fix\n`);

  // 按文件分组
  const fileErrors = {};
  for (const error of importErrors) {
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

  console.log(`\n✅ Fixed ${fixedErrors} import errors in ${fixedFiles} files`);
  console.log(`\n📊 Remaining errors: ${errors.length - fixedErrors}`);
}

main();
