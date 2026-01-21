/**
 * V3.0 功能深度测试 - 检查组件接口和实际可用性
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始深度测试 V3.0 功能的真实可用性...\n');

let issues = [];

function readFile(filePath) {
  try {
    return fs.readFileSync(path.join(__dirname, '../..', filePath), 'utf-8');
  } catch (e) {
    return null;
  }
}

// ============================================
// 测试 1: 检查 V3FeaturesCenter 中的组件引用
// ============================================
console.log('📋 测试 1: V3FeaturesCenter 组件引用检查');

const v3Center = readFile('src/components/V3FeaturesCenter.tsx');
if (!v3Center) {
  console.log('  ❌ V3FeaturesCenter.tsx 不存在');
  process.exit(1);
}

// 检查导入的组件
const imports = {
  CodeEditor: /import.*CodeEditor.*from.*editor\/CodeEditor/,
  Terminal: /import.*Terminal.*from.*Terminal\/Terminal/,
  DiffPreview: /import.*DiffPreview.*from.*Diff\/DiffPreview/
};

console.log('\n  组件导入检查:');
Object.entries(imports).forEach(([name, pattern]) => {
  const imported = pattern.test(v3Center);
  console.log(`    ${imported ? '✅' : '❌'} ${name}`);
  if (!imported) {
    issues.push(`V3FeaturesCenter 未导入 ${name} 组件`);
  }
});

// 检查实际使用的组件
console.log('\n  组件使用检查:');
const usages = {
  CodeEditor: /<CodeEditor/,
  Terminal: /<Terminal/,
  DiffPreview: /<DiffPreview/
};

Object.entries(usages).forEach(([name, pattern]) => {
  const used = pattern.test(v3Center);
  console.log(`    ${used ? '✅' : '❌'} ${name} 被使用`);
});

// 检查未实现的功能
console.log('\n  功能实现检查:');
const features = ['snippets', 'git', 'test', 'template', 'profiler', 'plugin'];
features.forEach(feature => {
  const hasCase = new RegExp(`case '${feature}':`).test(v3Center);
  const hasImplementation = hasCase && !new RegExp(`case '${feature}':[\\s\\S]{0,100}return[\\s\\S]{0,100}default`).test(v3Center);

  console.log(`    ${hasImplementation ? '✅' : '❌'} ${feature} 功能`);
  if (!hasImplementation) {
    issues.push(`${feature} 功能未实现，只有卡片展示`);
  }
});

// ============================================
// 测试 2: DiffPreview 接口匹配检查
// ============================================
console.log('\n📋 测试 2: DiffPreview 接口匹配检查');

const diffPreview = readFile('src/components/Diff/DiffPreview.tsx');
if (diffPreview) {
  // 检查 DiffPreview 的接口定义
  const interfaceMatch = diffPreview.match(/interface DiffPreviewProps\s*{([^}]+)}/s);
  if (interfaceMatch) {
    const propsDefinition = interfaceMatch[1];
    console.log('  DiffPreview 期望的 props:');

    const expectedProps = {
      changes: /changes:\s*DiffChange\[\]/.test(propsDefinition),
      onAccept: /onAccept:\s*\(changeId:\s*string\)/.test(propsDefinition),
      onReject: /onReject:\s*\(changeId:\s*string\)/.test(propsDefinition),
      onApply: /onApply:\s*\(\)/.test(propsDefinition)
    };

    Object.entries(expectedProps).forEach(([prop, exists]) => {
      console.log(`    ${exists ? '✅' : '❌'} ${prop}`);
    });

    // 检查 V3FeaturesCenter 中的使用
    const v3DiffUsage = v3Center.match(/<DiffPreview([^>]+)>/s);
    if (v3DiffUsage) {
      const usageProps = v3DiffUsage[1];
      console.log('\n  V3FeaturesCenter 中传递的 props:');

      const actualProps = {
        diff: /diff=/.test(usageProps),
        changes: /changes=/.test(usageProps),
        onAccept: /onAccept=/.test(usageProps),
        onReject: /onReject=/.test(usageProps),
        onApply: /onApply=/.test(usageProps)
      };

      Object.entries(actualProps).forEach(([prop, exists]) => {
        console.log(`    ${exists ? '✅' : '❌'} ${prop}`);
      });

      // 检查接口不匹配
      if (actualProps.diff && !actualProps.changes) {
        issues.push('DiffPreview 接口不匹配：传递了 diff 字符串，但期望 changes 数组');
      }
      if (!actualProps.onApply) {
        issues.push('DiffPreview 缺少必需的 onApply prop');
      }
    }
  }
} else {
  console.log('  ❌ DiffPreview.tsx 不存在');
  issues.push('DiffPreview 组件不存在');
}

// ============================================
// 测试 3: 语音输入功能检查
// ============================================
console.log('\n📋 测试 3: 语音输入功能深度检查');

const voiceInput = readFile('src/components/VoiceInput.tsx');
const flashService = readFile('src/services/flashSpeechService.ts');

if (voiceInput && flashService) {
  console.log('  文件存在检查:');
  console.log('    ✅ VoiceInput.tsx');
  console.log('    ✅ flashSpeechService.ts');

  console.log('\n  关键功能检查:');

  // 检查 MediaRecorder
  const hasMediaRecorder = /MediaRecorder/.test(flashService);
  console.log(`    ${hasMediaRecorder ? '✅' : '❌'} MediaRecorder API`);
  if (!hasMediaRecorder) {
    issues.push('flashSpeechService 未使用 MediaRecorder API');
  }

  // 检查 API 调用
  const hasApiCall = /fetch.*flashspeech|axios.*flashspeech/.test(flashService);
  console.log(`    ${hasApiCall ? '✅' : '❌'} FlashSpeech API 调用`);
  if (!hasApiCall) {
    issues.push('flashSpeechService 未调用 FlashSpeech API');
  }

  // 检查集成
  const controlBar = readFile('src/components/FloatingPromptInput/ControlBar.tsx');
  if (controlBar) {
    const hasVoiceIntegration = /<VoiceInput/.test(controlBar);
    console.log(`    ${hasVoiceIntegration ? '✅' : '❌'} ControlBar 集成`);
    if (!hasVoiceIntegration) {
      issues.push('VoiceInput 未集成到 ControlBar');
    }
  }
} else {
  console.log('  ❌ 语音输入相关文件缺失');
  if (!voiceInput) issues.push('VoiceInput.tsx 不存在');
  if (!flashService) issues.push('flashSpeechService.ts 不存在');
}

// ============================================
// 测试 4: Terminal 功能检查
// ============================================
console.log('\n📋 测试 4: Terminal 功能深度检查');

const terminal = readFile('src/components/Terminal/Terminal.tsx');
const terminalRs = readFile('src-tauri/src/commands/terminal.rs');

if (terminal) {
  console.log('  ✅ Terminal.tsx 存在');

  // 检查 xterm.js 集成
  const hasXterm = /xterm|Terminal/.test(terminal);
  console.log(`    ${hasXterm ? '✅' : '❌'} xterm.js 集成`);

  // 检查 Tauri 命令调用
  const hasTauriInvoke = /invoke\(['"]terminal_/.test(terminal);
  console.log(`    ${hasTauriInvoke ? '✅' : '❌'} Tauri 命令调用`);

  if (terminalRs) {
    console.log('    ✅ terminal.rs 后端支持');
    const hasCommands = /#\[tauri::command\]/.test(terminalRs);
    console.log(`    ${hasCommands ? '✅' : '❌'} Rust 命令定义`);
  } else {
    console.log('    ❌ terminal.rs 不存在');
    issues.push('Terminal 缺少 Rust 后端支持');
  }
} else {
  console.log('  ❌ Terminal.tsx 不存在');
  issues.push('Terminal 组件不存在');
}

// ============================================
// 测试 5: LSP 功能检查
// ============================================
console.log('\n📋 测试 5: LSP 功能深度检查');

const lspLoader = readFile('src/core/tools/LSPAutoLoader.ts');
const lspRs = readFile('src-tauri/src/commands/lsp.rs');

if (lspLoader) {
  console.log('  ✅ LSPAutoLoader.ts 存在');

  const hasTauriInvoke = /invoke\(['"]lsp_/.test(lspLoader);
  console.log(`    ${hasTauriInvoke ? '✅' : '❌'} Tauri 命令调用`);

  if (lspRs) {
    console.log('    ✅ lsp.rs 后端支持');
    const hasCommands = /#\[tauri::command\]/.test(lspRs);
    console.log(`    ${hasCommands ? '✅' : '❌'} Rust 命令定义`);
  } else {
    console.log('    ❌ lsp.rs 不存在');
    issues.push('LSP 缺少 Rust 后端支持');
  }
} else {
  console.log('  ❌ LSPAutoLoader.ts 不存在');
  issues.push('LSP 加载器不存在');
}

// ============================================
// 最终报告
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 深度测试结果');
console.log('='.repeat(60));

if (issues.length === 0) {
  console.log('✅ 所有功能都已正确实现且接口匹配！');
  process.exit(0);
} else {
  console.log(`❌ 发现 ${issues.length} 个问题:\n`);
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue}`);
  });

  console.log('\n⚠️  结论：');
  console.log('- 部分功能只有卡片展示，没有实际实现');
  console.log('- 部分组件接口不匹配，无法正常工作');
  console.log('- 需要完善这些功能才能真正可用');

  process.exit(1);
}
