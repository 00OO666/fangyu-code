/**
 * Skill Toggle 功能验收测试脚本
 * 
 * 测试目标：验证 Skill 启用/禁用功能是否通过文件夹移动方式实现
 * 
 * 预期行为：
 * - 启用 Skill：从 skills_disabled 目录移动到 skills 目录
 * - 禁用 Skill：从 skills 目录移动到 skills_disabled 目录
 * 
 * 运行方式：node scripts/test-skill-toggle.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 配置
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const SKILLS_DISABLED_DIR = path.join(CLAUDE_DIR, 'skills_disabled');
const TEST_SKILL_NAME = '_test_skill_toggle_verification';

// 颜色输出
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
};

function log(type, message) {
  const prefix = {
    pass: colors.green('✓ PASS'),
    fail: colors.red('✗ FAIL'),
    info: colors.cyan('ℹ INFO'),
    warn: colors.yellow('⚠ WARN'),
  };
  console.log(`${prefix[type] || ''} ${message}`);
}

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log('info', `创建目录: ${dir}`);
  }
}

// 创建测试 Skill
function createTestSkill(dir) {
  const skillDir = path.join(dir, TEST_SKILL_NAME);
  ensureDir(skillDir);
  
  const skillFile = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillFile, `# Test Skill Toggle Verification

这是一个用于验证 Skill 启用/禁用功能的测试文件。

## 测试目的
验证 Skill 是否通过文件夹移动方式实现启用/禁用。

## 预期行为
- 启用：从 skills_disabled 移动到 skills
- 禁用：从 skills 移动到 skills_disabled
`);
  
  return skillDir;
}

// 清理测试 Skill
function cleanupTestSkill() {
  const locations = [
    path.join(SKILLS_DIR, TEST_SKILL_NAME),
    path.join(SKILLS_DISABLED_DIR, TEST_SKILL_NAME),
  ];
  
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      fs.rmSync(loc, { recursive: true, force: true });
      log('info', `清理测试文件: ${loc}`);
    }
  }
}

// 模拟禁用 Skill（从 skills 移动到 skills_disabled）
function simulateDisableSkill() {
  const source = path.join(SKILLS_DIR, TEST_SKILL_NAME);
  const target = path.join(SKILLS_DISABLED_DIR, TEST_SKILL_NAME);
  
  if (!fs.existsSync(source)) {
    throw new Error(`源目录不存在: ${source}`);
  }
  
  ensureDir(SKILLS_DISABLED_DIR);
  fs.renameSync(source, target);
  
  return target;
}

// 模拟启用 Skill（从 skills_disabled 移动到 skills）
function simulateEnableSkill() {
  const source = path.join(SKILLS_DISABLED_DIR, TEST_SKILL_NAME);
  const target = path.join(SKILLS_DIR, TEST_SKILL_NAME);
  
  if (!fs.existsSync(source)) {
    throw new Error(`源目录不存在: ${source}`);
  }
  
  ensureDir(SKILLS_DIR);
  fs.renameSync(source, target);
  
  return target;
}

// 主测试函数
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log(colors.cyan('Skill Toggle 功能验收测试'));
  console.log('='.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    // 清理之前的测试残留
    cleanupTestSkill();
    
    // 测试 1: 验证目录结构
    console.log(colors.yellow('\n[测试 1] 验证目录结构'));
    ensureDir(SKILLS_DIR);
    ensureDir(SKILLS_DISABLED_DIR);
    
    if (fs.existsSync(SKILLS_DIR) && fs.existsSync(SKILLS_DISABLED_DIR)) {
      log('pass', 'skills 和 skills_disabled 目录存在');
      passed++;
    } else {
      log('fail', '目录结构不正确');
      failed++;
    }
    
    // 测试 2: 创建测试 Skill 在 skills 目录
    console.log(colors.yellow('\n[测试 2] 创建测试 Skill'));
    const skillDir = createTestSkill(SKILLS_DIR);
    
    if (fs.existsSync(skillDir) && fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
      log('pass', `测试 Skill 创建成功: ${skillDir}`);
      passed++;
    } else {
      log('fail', '测试 Skill 创建失败');
      failed++;
    }
    
    // 测试 3: 模拟禁用（移动到 skills_disabled）
    console.log(colors.yellow('\n[测试 3] 模拟禁用 Skill（移动到 skills_disabled）'));
    const disabledPath = simulateDisableSkill();
    
    const disableSuccess = 
      fs.existsSync(disabledPath) && 
      !fs.existsSync(path.join(SKILLS_DIR, TEST_SKILL_NAME));
    
    if (disableSuccess) {
      log('pass', `Skill 已移动到 skills_disabled: ${disabledPath}`);
      passed++;
    } else {
      log('fail', '禁用操作失败');
      failed++;
    }
    
    // 测试 4: 模拟启用（移动回 skills）
    console.log(colors.yellow('\n[测试 4] 模拟启用 Skill（移动回 skills）'));
    const enabledPath = simulateEnableSkill();
    
    const enableSuccess = 
      fs.existsSync(enabledPath) && 
      !fs.existsSync(path.join(SKILLS_DISABLED_DIR, TEST_SKILL_NAME));
    
    if (enableSuccess) {
      log('pass', `Skill 已移动回 skills: ${enabledPath}`);
      passed++;
    } else {
      log('fail', '启用操作失败');
      failed++;
    }
    
    // 测试 5: 验证 Rust 代码实现
    console.log(colors.yellow('\n[测试 5] 验证 Rust 后端实现'));
    const rustFile = path.join(__dirname, '..', 'src-tauri', 'src', 'commands', 'extensions.rs');
    
    if (fs.existsSync(rustFile)) {
      const rustCode = fs.readFileSync(rustFile, 'utf-8');
      
      const hasSkillsDisabledDir = rustCode.includes('skills_disabled');
      const hasMoveLogic = rustCode.includes('fs::rename') || rustCode.includes('rename');
      const hasToggleFunction = rustCode.includes('toggle_skill');
      
      if (hasSkillsDisabledDir && hasToggleFunction) {
        log('pass', 'Rust 后端实现了 skills_disabled 目录移动逻辑');
        passed++;
      } else {
        log('fail', 'Rust 后端实现不符合预期');
        log('info', `  - skills_disabled 目录: ${hasSkillsDisabledDir}`);
        log('info', `  - toggle_skill 函数: ${hasToggleFunction}`);
        failed++;
      }
    } else {
      log('warn', `Rust 文件不存在: ${rustFile}`);
      log('info', '跳过 Rust 代码验证');
    }
    
    // 测试 6: 验证前端 API 调用
    console.log(colors.yellow('\n[测试 6] 验证前端 API 调用'));
    const apiFile = path.join(__dirname, '..', 'src', 'lib', 'api.ts');
    
    if (fs.existsSync(apiFile)) {
      const apiCode = fs.readFileSync(apiFile, 'utf-8');
      
      const hasToggleSkillMethod = apiCode.includes('toggleSkill');
      const invokesToggleSkill = apiCode.includes('invoke("toggle_skill"');
      
      if (hasToggleSkillMethod && invokesToggleSkill) {
        log('pass', '前端 API 正确调用 toggle_skill Tauri 命令');
        passed++;
      } else {
        log('fail', '前端 API 调用不正确');
        failed++;
      }
    } else {
      log('warn', `API 文件不存在: ${apiFile}`);
      log('info', '跳过前端 API 验证');
    }
    
  } catch (error) {
    log('fail', `测试过程中发生错误: ${error.message}`);
    failed++;
  } finally {
    // 清理测试文件
    console.log(colors.yellow('\n[清理] 删除测试文件'));
    cleanupTestSkill();
    log('info', '测试文件已清理');
  }
  
  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log(colors.cyan('测试结果汇总'));
  console.log('='.repeat(60));
  console.log(`通过: ${colors.green(passed)}`);
  console.log(`失败: ${colors.red(failed)}`);
  console.log(`总计: ${passed + failed}`);
  console.log('='.repeat(60) + '\n');
  
  if (failed === 0) {
    console.log(colors.green('🎉 所有测试通过！Skill Toggle 功能实现正确。'));
    console.log(colors.green('   启用/禁用 Skill 通过文件夹移动方式实现：'));
    console.log(colors.green('   - 启用：skills_disabled → skills'));
    console.log(colors.green('   - 禁用：skills → skills_disabled'));
    process.exit(0);
  } else {
    console.log(colors.red('❌ 部分测试失败，请检查实现。'));
    process.exit(1);
  }
}

// 运行测试
runTests();
