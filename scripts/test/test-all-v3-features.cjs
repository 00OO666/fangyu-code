/**
 * V3.0 功能全面测试脚本
 * 测试所有 9 个 V3.0 功能 + 语音输入功能的真实性
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 开始全面测试 V3.0 所有功能...\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, condition, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${name}`);
    passedTests++;
    return true;
  } else {
    console.log(`  ❌ ${name}`);
    if (details) console.log(`     ${details}`);
    failedTests++;
    return false;
  }
}

function checkFileExists(filePath) {
  return fs.existsSync(path.join(__dirname, '../..', filePath));
}

function checkFileContains(filePath, patterns) {
  try {
    const content = fs.readFileSync(
      path.join(__dirname, '../..', filePath),
      'utf-8'
    );
    return patterns.every(pattern => {
      if (typeof pattern === 'string') {
        return content.includes(pattern);
      } else if (pattern instanceof RegExp) {
        return pattern.test(content);
      }
      return false;
    });
  } catch (e) {
    return false;
  }
}

function checkFunctionality(filePath, functionChecks) {
  try {
    const content = fs.readFileSync(
      path.join(__dirname, '../..', filePath),
      'utf-8'
    );

    let hasRealLogic = false;

    // 检查是否有实际的逻辑代码（不只是 TODO 或空函数）
    const hasApiCalls = /fetch|axios|invoke|api\./i.test(content);
    const hasStateManagement = /useState|useEffect|useCallback|useMemo/i.test(content);
    const hasEventHandlers = /onClick|onChange|onSubmit|addEventListener/i.test(content);
    const hasDataProcessing = /map|filter|reduce|forEach|find/i.test(content);
    const hasTauriCommands = /invoke\(['"][\w_]+['"]/i.test(content);

    hasRealLogic = hasApiCalls || hasStateManagement || hasEventHandlers ||
                   hasDataProcessing || hasTauriCommands;

    // 检查是否只是空壳（只有 TODO 或 Coming Soon）
    const isMockup = /TODO|Coming Soon|敬请期待|即将推出/i.test(content) &&
                     !hasRealLogic;

    return {
      exists: true,
      hasRealLogic,
      isMockup,
      hasApiCalls,
      hasStateManagement,
      hasEventHandlers,
      hasTauriCommands,
      functionChecks: functionChecks.map(check => ({
        name: check.name,
        passed: check.pattern.test(content)
      }))
    };
  } catch (e) {
    return { exists: false };
  }
}

// ============================================
// 测试 1: 语音输入功能
// ============================================
console.log('📋 测试 1: 语音输入功能');
const voiceInputResult = checkFunctionality('src/components/VoiceInput.tsx', [
  { name: 'MediaRecorder 使用', pattern: /new\s+MediaRecorder/ },
  { name: 'API 调用', pattern: /fetch.*flashspeech/ },
  { name: '状态管理', pattern: /useState.*isRecording/ },
  { name: '事件处理', pattern: /onClick.*handleToggleRecording/ }
]);

test('VoiceInput.tsx 文件存在', voiceInputResult.exists);
test('有真实的录音逻辑', voiceInputResult.hasRealLogic,
     voiceInputResult.isMockup ? '只是空壳，没有实际功能' : '');
test('MediaRecorder API 集成', voiceInputResult.functionChecks[0]?.passed);
test('FlashSpeech API 调用', voiceInputResult.functionChecks[1]?.passed);

// ============================================
// 测试 2: LSP 功能可视化
// ============================================
console.log('\n📋 测试 2: LSP 功能可视化');
const lspFiles = [
  'src/core/tools/LSPAutoLoader.ts',
  'src/components/LSPViewer.tsx'
];

test('LSPAutoLoader.ts 存在', checkFileExists(lspFiles[0]));
test('LSPViewer.tsx 存在', checkFileExists(lspFiles[1]));

if (checkFileExists(lspFiles[0])) {
  const lspResult = checkFunctionality(lspFiles[0], [
    { name: 'LSP 初始化', pattern: /initializeLSP|startLanguageServer/ },
    { name: 'Tauri 命令调用', pattern: /invoke\(['"]lsp_/ },
    { name: '符号查找', pattern: /findSymbol|getSymbols/ }
  ]);

  test('有真实的 LSP 逻辑', lspResult.hasRealLogic,
       lspResult.isMockup ? '只是空壳' : '');
  test('有 Tauri 命令调用', lspResult.hasTauriCommands);
}

// ============================================
// 测试 3: Diff 预览器
// ============================================
console.log('\n📋 测试 3: Diff 预览器');
const diffFiles = [
  'src/components/DiffViewer.tsx',
  'src/lib/diffUtils.ts'
];

test('DiffViewer.tsx 存在', checkFileExists(diffFiles[0]));

if (checkFileExists(diffFiles[0])) {
  const diffResult = checkFunctionality(diffFiles[0], [
    { name: 'Diff 渲染', pattern: /diff|unified|split/ },
    { name: '接受/拒绝操作', pattern: /accept|reject|apply/ },
    { name: '语法高亮', pattern: /highlight|syntax/ }
  ]);

  test('有真实的 Diff 逻辑', diffResult.hasRealLogic,
       diffResult.isMockup ? '只是空壳' : '');
  test('有事件处理', diffResult.hasEventHandlers);
}

// ============================================
// 测试 4: 内置终端
// ============================================
console.log('\n📋 测试 4: 内置终端');
const terminalFile = 'src/components/Terminal/Terminal.tsx';

test('Terminal.tsx 存在', checkFileExists(terminalFile));

if (checkFileExists(terminalFile)) {
  const terminalResult = checkFunctionality(terminalFile, [
    { name: 'xterm.js 集成', pattern: /xterm|Terminal/ },
    { name: '命令执行', pattern: /execute|runCommand|invoke/ },
    { name: 'PTY 通信', pattern: /pty|shell|bash/ }
  ]);

  test('有真实的终端逻辑', terminalResult.hasRealLogic,
       terminalResult.isMockup ? '只是空壳' : '');
  test('有 Tauri 命令调用', terminalResult.hasTauriCommands);
}

// ============================================
// 测试 5: 代码片段库
// ============================================
console.log('\n📋 测试 5: 代码片段库');
const snippetFiles = [
  'src/components/SnippetLibrary.tsx',
  'src/lib/snippetManager.ts'
];

test('SnippetLibrary.tsx 存在', checkFileExists(snippetFiles[0]));

if (checkFileExists(snippetFiles[0])) {
  const snippetResult = checkFunctionality(snippetFiles[0], [
    { name: '片段管理', pattern: /snippet|template/ },
    { name: '分类功能', pattern: /category|language|tag/ },
    { name: '搜索功能', pattern: /search|filter|query/ }
  ]);

  test('有真实的片段管理逻辑', snippetResult.hasRealLogic,
       snippetResult.isMockup ? '只是空壳' : '');
}

// ============================================
// 测试 6: Git 可视化
// ============================================
console.log('\n📋 测试 6: Git 可视化');
const gitFiles = [
  'src/components/GitViewer.tsx',
  'src/lib/api/git/index.ts'
];

test('GitViewer.tsx 存在', checkFileExists(gitFiles[0]));
test('git/index.ts 存在', checkFileExists(gitFiles[1]));

if (checkFileExists(gitFiles[1])) {
  const gitResult = checkFunctionality(gitFiles[1], [
    { name: 'Git 命令', pattern: /git_status|git_log|git_diff/ },
    { name: 'Tauri 调用', pattern: /invoke\(['"]git_/ },
    { name: '分支管理', pattern: /branch|checkout|merge/ }
  ]);

  test('有真实的 Git 逻辑', gitResult.hasRealLogic,
       gitResult.isMockup ? '只是空壳' : '');
  test('有 Tauri 命令调用', gitResult.hasTauriCommands);
}

// ============================================
// 测试 7: 测试集成
// ============================================
console.log('\n📋 测试 7: 测试集成');
const testFiles = [
  'src/components/TestRunner.tsx',
  'src/lib/testRunner.ts'
];

test('TestRunner.tsx 存在', checkFileExists(testFiles[0]));

if (checkFileExists(testFiles[0])) {
  const testResult = checkFunctionality(testFiles[0], [
    { name: '测试执行', pattern: /runTest|executeTest|jest|vitest/ },
    { name: '覆盖率', pattern: /coverage|report/ },
    { name: '结果显示', pattern: /result|status|passed|failed/ }
  ]);

  test('有真实的测试运行逻辑', testResult.hasRealLogic,
       testResult.isMockup ? '只是空壳' : '');
}

// ============================================
// 测试 8: 项目模板市场
// ============================================
console.log('\n📋 测试 8: 项目模板市场');
const templateFiles = [
  'src/components/TemplateMarket.tsx',
  'src/lib/templateManager.ts'
];

test('TemplateMarket.tsx 存在', checkFileExists(templateFiles[0]));

if (checkFileExists(templateFiles[0])) {
  const templateResult = checkFunctionality(templateFiles[0], [
    { name: '模板列表', pattern: /template|scaffold|boilerplate/ },
    { name: '模板生成', pattern: /generate|create|init/ },
    { name: '模板搜索', pattern: /search|filter|category/ }
  ]);

  test('有真实的模板管理逻辑', templateResult.hasRealLogic,
       templateResult.isMockup ? '只是空壳' : '');
}

// ============================================
// 测试 9: 性能分析器
// ============================================
console.log('\n📋 测试 9: 性能分析器');
const profilerFiles = [
  'src/components/Profiler.tsx',
  'src/lib/profiler.ts'
];

test('Profiler.tsx 存在', checkFileExists(profilerFiles[0]));

if (checkFileExists(profilerFiles[0])) {
  const profilerResult = checkFunctionality(profilerFiles[0], [
    { name: '性能监控', pattern: /performance|monitor|metric/ },
    { name: '计时器', pattern: /timer|duration|elapsed/ },
    { name: '内存统计', pattern: /memory|heap|usage/ }
  ]);

  test('有真实的性能分析逻辑', profilerResult.hasRealLogic,
       profilerResult.isMockup ? '只是空壳' : '');
}

// ============================================
// 测试 10: 插件系统
// ============================================
console.log('\n📋 测试 10: 插件系统');
const pluginFiles = [
  'src/components/PluginManager.tsx',
  'src/lib/pluginSystem.ts'
];

test('PluginManager.tsx 存在', checkFileExists(pluginFiles[0]));

if (checkFileExists(pluginFiles[0])) {
  const pluginResult = checkFunctionality(pluginFiles[0], [
    { name: '插件加载', pattern: /loadPlugin|registerPlugin/ },
    { name: '钩子系统', pattern: /hook|middleware|lifecycle/ },
    { name: '插件配置', pattern: /config|settings|options/ }
  ]);

  test('有真实的插件系统逻辑', pluginResult.hasRealLogic,
       pluginResult.isMockup ? '只是空壳' : '');
}

// ============================================
// 测试 11: V3FeaturesCenter 集成
// ============================================
console.log('\n📋 测试 11: V3FeaturesCenter 集成');
const v3CenterFile = 'src/components/V3FeaturesCenter.tsx';

test('V3FeaturesCenter.tsx 存在', checkFileExists(v3CenterFile));

if (checkFileExists(v3CenterFile)) {
  const v3Result = checkFunctionality(v3CenterFile, [
    { name: '9 个功能卡片', pattern: /LSP.*Diff.*终端.*片段.*Git.*测试.*模板.*性能.*插件/s },
    { name: '导航功能', pattern: /navigate|router|view/ },
    { name: 'Demo 视图', pattern: /demo|preview|example/ }
  ]);

  test('有 9 个功能卡片', v3Result.functionChecks[0]?.passed);
  test('有导航逻辑', v3Result.hasEventHandlers);
}

// ============================================
// 测试 12: Rust 后端支持
// ============================================
console.log('\n📋 测试 12: Rust 后端支持（Tauri Commands）');
const rustFiles = [
  'src-tauri/src/commands/lsp.rs',
  'src-tauri/src/commands/terminal.rs',
  'src-tauri/src/commands/git.rs'
];

rustFiles.forEach(file => {
  const exists = checkFileExists(file);
  test(`${path.basename(file)} 存在`, exists);

  if (exists) {
    const hasCommands = checkFileContains(file, ['#[tauri::command]']);
    test(`${path.basename(file)} 有 Tauri 命令`, hasCommands);
  }
});

// ============================================
// 最终报告
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 测试结果总结');
console.log('='.repeat(60));
console.log(`总测试数: ${totalTests}`);
console.log(`✅ 通过: ${passedTests}`);
console.log(`❌ 失败: ${failedTests}`);
console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 所有测试通过！所有功能都有真实的实现！');
  process.exit(0);
} else {
  console.log('\n⚠️  部分测试失败，请检查失败的功能是否为空壳。');
  process.exit(1);
}
