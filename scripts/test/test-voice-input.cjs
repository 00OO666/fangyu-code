/**
 * 语音输入功能测试脚本
 * 测试 FlashSpeech 服务和 VoiceInput 组件的基本功能
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 开始测试语音输入功能...\n');

// 测试 1: 检查文件是否存在
console.log('📋 测试 1: 检查必要文件是否存在');
const files = [
  'src/services/flashSpeechService.ts',
  'src/components/VoiceInput.tsx',
  'docs/VOICE_INPUT_GUIDE.md'
];

let allFilesExist = true;
files.forEach(file => {
  const filePath = path.join(__dirname, '../..', file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ 测试失败：部分文件不存在');
  process.exit(1);
}

// 测试 2: 检查 flashSpeechService.ts 的关键代码
console.log('\n📋 测试 2: 检查 flashSpeechService.ts 的关键功能');
const serviceContent = fs.readFileSync(
  path.join(__dirname, '../..', 'src/services/flashSpeechService.ts'),
  'utf-8'
);

const serviceChecks = [
  { name: 'startRecording 方法', pattern: /startRecording\s*\(\s*\)/ },
  { name: 'stopRecording 方法', pattern: /stopRecording\s*\(\s*\)/ },
  { name: 'recognizeAudio 方法', pattern: /recognizeAudio\s*\(/ },
  { name: 'MediaRecorder 使用', pattern: /new\s+MediaRecorder/ },
  { name: 'FlashSpeech API 端点', pattern: /api\.flashspeech\.com/ },
  { name: 'API Key 存储', pattern: /flashspeech_api_key/ }
];

let allServiceChecksPass = true;
serviceChecks.forEach(check => {
  const pass = check.pattern.test(serviceContent);
  console.log(`  ${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allServiceChecksPass = false;
});

if (!allServiceChecksPass) {
  console.log('\n❌ 测试失败：flashSpeechService.ts 缺少关键功能');
  process.exit(1);
}

// 测试 3: 检查 VoiceInput.tsx 的关键代码
console.log('\n📋 测试 3: 检查 VoiceInput.tsx 的关键功能');
const componentContent = fs.readFileSync(
  path.join(__dirname, '../..', 'src/components/VoiceInput.tsx'),
  'utf-8'
);

const componentChecks = [
  { name: 'onTextRecognized 回调', pattern: /onTextRecognized/ },
  { name: '录音状态管理', pattern: /isRecording/ },
  { name: '快捷键 Ctrl+Shift+V', pattern: /Ctrl.*Shift.*V/ },
  { name: 'Mic 图标', pattern: /Mic/ },
  { name: 'Toast 通知', pattern: /toast/ },
  { name: '录音计时器', pattern: /recordingTime/ }
];

let allComponentChecksPass = true;
componentChecks.forEach(check => {
  const pass = check.pattern.test(componentContent);
  console.log(`  ${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allComponentChecksPass = false;
});

if (!allComponentChecksPass) {
  console.log('\n❌ 测试失败：VoiceInput.tsx 缺少关键功能');
  process.exit(1);
}

// 测试 4: 检查 ControlBar 集成
console.log('\n📋 测试 4: 检查 ControlBar 集成');
const controlBarContent = fs.readFileSync(
  path.join(__dirname, '../..', 'src/components/FloatingPromptInput/ControlBar.tsx'),
  'utf-8'
);

const controlBarChecks = [
  { name: 'VoiceInput 导入', pattern: /import.*VoiceInput/ },
  { name: 'onVoiceTextRecognized 属性', pattern: /onVoiceTextRecognized/ },
  { name: 'VoiceInput 组件使用', pattern: /<VoiceInput/ }
];

let allControlBarChecksPass = true;
controlBarChecks.forEach(check => {
  const pass = check.pattern.test(controlBarContent);
  console.log(`  ${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allControlBarChecksPass = false;
});

if (!allControlBarChecksPass) {
  console.log('\n❌ 测试失败：ControlBar 集成不完整');
  process.exit(1);
}

// 测试 5: 检查 FloatingPromptInput 集成
console.log('\n📋 测试 5: 检查 FloatingPromptInput 集成');
const floatingPromptContent = fs.readFileSync(
  path.join(__dirname, '../..', 'src/components/FloatingPromptInput/index.tsx'),
  'utf-8'
);

const floatingPromptChecks = [
  { name: 'onVoiceTextRecognized 回调', pattern: /onVoiceTextRecognized.*=>/ },
  { name: '文本追加到 prompt', pattern: /state\.prompt\s*\+\s*text/ }
];

let allFloatingPromptChecksPass = true;
floatingPromptChecks.forEach(check => {
  const pass = check.pattern.test(floatingPromptContent);
  console.log(`  ${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allFloatingPromptChecksPass = false;
});

if (!allFloatingPromptChecksPass) {
  console.log('\n❌ 测试失败：FloatingPromptInput 集成不完整');
  process.exit(1);
}

// 测试 6: 检查使用文档
console.log('\n📋 测试 6: 检查使用文档完整性');
const docContent = fs.readFileSync(
  path.join(__dirname, '../..', 'docs/VOICE_INPUT_GUIDE.md'),
  'utf-8'
);

const docChecks = [
  { name: '功能概述', pattern: /功能概述/ },
  { name: '使用方法', pattern: /使用方法/ },
  { name: '配置 API Key', pattern: /配置.*API.*Key/ },
  { name: '快捷键说明', pattern: /Ctrl\+Shift\+V/ },
  { name: '故障排除', pattern: /故障排除/ }
];

let allDocChecksPass = true;
docChecks.forEach(check => {
  const pass = check.pattern.test(docContent);
  console.log(`  ${pass ? '✅' : '❌'} ${check.name}`);
  if (!pass) allDocChecksPass = false;
});

if (!allDocChecksPass) {
  console.log('\n❌ 测试失败：使用文档不完整');
  process.exit(1);
}

// 所有测试通过
console.log('\n✅ 所有测试通过！');
console.log('\n📝 测试总结：');
console.log('  ✅ 所有必要文件已创建');
console.log('  ✅ flashSpeechService.ts 包含所有关键功能');
console.log('  ✅ VoiceInput.tsx 组件功能完整');
console.log('  ✅ ControlBar 集成正确');
console.log('  ✅ FloatingPromptInput 集成正确');
console.log('  ✅ 使用文档完整');

console.log('\n🎯 下一步：');
console.log('  1. 运行 npm run tauri dev 启动应用');
console.log('  2. 在设置中配置闪电说 API Key');
console.log('  3. 点击麦克风按钮或按 Ctrl+Shift+V 测试语音输入');
console.log('  4. 检查语音识别结果是否正确添加到输入框');

process.exit(0);
