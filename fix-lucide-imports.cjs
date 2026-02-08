const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// 将 kebab-case 转换为 PascalCase
function kebabToPascal(str) {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

// 处理单个文件
function fixFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const imports = [];
    const newLines = [];
    let inImportBlock = false;
    let importBlockStart = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检测是否是错误的 lucide-react 导入
        const match = line.match(/import\s+(\w+)\s+from\s+['"]lucide-react\/dist\/esm\/icons\/([^'"]+)['"]/);

        if (match) {
            const [, importName, iconPath] = match;
            imports.push(importName);

            if (!inImportBlock) {
                inImportBlock = true;
                importBlockStart = newLines.length;
            }
            // 跳过这一行，稍后会添加合并的导入
            continue;
        } else {
            // 如果之前在导入块中，现在遇到非导入行，插入合并的导入
            if (inImportBlock && imports.length > 0) {
                const mergedImport = `import { ${imports.join(', ')} } from 'lucide-react';`;
                newLines.splice(importBlockStart, 0, mergedImport);
                imports.length = 0;
                inImportBlock = false;
            }
            newLines.push(line);
        }
    }

    // 处理文件末尾的导入
    if (imports.length > 0) {
        const mergedImport = `import { ${imports.join(', ')} } from 'lucide-react';`;
        newLines.splice(importBlockStart, 0, mergedImport);
    }

    const newContent = newLines.join('\n');

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✓ Fixed: ${filePath}`);
        return true;
    }

    return false;
}

// 主函数
async function main() {
    const files = await glob('src/**/*.{ts,tsx}', {
        cwd: 'F:/Fangyu-Code-Dev',
        absolute: true
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
