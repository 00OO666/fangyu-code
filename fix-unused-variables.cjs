const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 获取所有 TS6133 错误
function getUnusedVariableErrors() {
  try {
    execSync('npm run build:check', {
      cwd: 'F:/Fangyu-Code-Dev',
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const lines = output.split('\n');
    const errors = [];

    for (const line of lines) {
      const match = line.match(/^([^(]+)\((\d+),(\d+)\): error TS6133: '([^']+)' is declared but its value is never read\.$/);
      if (match) {
        const [, filePath, lineNum, colNum, varName] = match;
        errors.push({
          file: filePath.trim(),
          line: parseInt(lineNum),
          col: parseInt(colNum),
          varName: varName.trim()
        });
      }
    }

    return errors;
  }
  return [];
}

// 修复单个文件中的未使用变量
function fixUnusedVariables(filePath, unusedVars) {
  const fullPath = path.join('F:/Fangyu-Code-Dev', filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  let modified = false;

  // 按行号倒序处理（避免行号变化）
  unusedVars.sort((a, b) => b.line - a.line);

  for (const { line, varName } of unusedVars) {
    const lineIndex = line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const lineContent = lines[lineIndex];

    // 处理导入语句
    if (lineContent.includes('import')) {
      // 移除单个导入
      const singleImportPattern = new RegExp(`import\\s+${varName}\\s+from`);
      if (singleImportPattern.test(lineContent)) {
        lines[lineIndex] = '';
        modified = true;
        continue;
      }

      // 从解构导入中移除
      const destructurePattern = new RegExp(`\\{([^}]*)\\b${varName}\\b([^}]*)\\}`);
      if (destructurePattern.test(lineContent)) {
        lines[lineIndex] = lineContent.replace(
          new RegExp(`\\b${varName}\\b\\s*,?\\s*|,\\s*\\b${varName}\\b`),
          ''
        ).replace(/\{\s*,/, '{').replace(/,\s*\}/, '}').replace(/\{\s*\}/, '');

        // 如果导入为空，删除整行
        if (lines[lineIndex].match(/import\s*\{\s*\}\s*from/)) {
          lines[lineIndex] = '';
        }
        modified = true;
        continue;
      }
    }

    // 处理变量声明（添加下划线前缀）
    if (lineContent.includes('const') || lineContent.includes('let') || lineContent.includes('var')) {
      lines[lineIndex] = lineContent.replace(
        new RegExp(`\\b${varName}\\b`),
        `_${varName}`
      );
      modified = true;
    }
  }

  if (modified) {
    // 移除连续的空行
    const newContent = lines.join('\n').replace(/\n\n\n+/g, '\n\n');
    fs.writeFileSync(fullPath, newContent, 'utf8');
    return true;
  }

  return false;
}

// 主函数
function main() {
  console.log('Scanning for unused variables...');
  const errors = getUnusedVariableErrors();
  console.log(`Found ${errors.length} unused variables`);

  // 按文件分组
  const fileGroups = {};
  for (const error of errors) {
    if (!fileGroups[error.file]) {
      fileGroups[error.file] = [];
    }
    fileGroups[error.file].push(error);
  }

  let fixedCount = 0;
  for (const [file, vars] of Object.entries(fileGroups)) {
    try {
      if (fixUnusedVariables(file, vars)) {
        console.log(`✓ Fixed ${vars.length} unused variables in ${file}`);
        fixedCount++;
      }
    } catch (error) {
      console.error(`✗ Error fixing ${file}:`, error.message);
    }
  }

  console.log(`\n✓ Fixed ${fixedCount} files`);
}

main();
