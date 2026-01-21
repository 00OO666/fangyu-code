/**
 * 智能会话存储路径功能测试脚本
 *
 * 测试场景：
 * 1. 设置自定义存储路径
 * 2. 验证路径已保存
 * 3. 创建会话并验证文件位置
 * 4. 重置为默认路径
 */

const { invoke } = window.__TAURI__.core;
const fs = window.__TAURI__.fs;
const path = window.__TAURI__.path;

// 测试配置
const TEST_CUSTOM_PATH = "E:\\TestSessionStorage";
const TEST_SESSION_SUMMARY = "This is a test session summary for path verification.";
const TEST_PARENT_SESSION_ID = "test-parent-session-123";

// 测试结果收集
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// 辅助函数：记录测试结果
function recordTest(name, passed, message) {
  results.tests.push({ name, passed, message });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}: ${message}`);
  } else {
    results.failed++;
    console.error(`❌ ${name}: ${message}`);
  }
}

// 测试1: 设置自定义存储路径
async function test1_setCustomPath() {
  try {
    await invoke("set_session_storage_path", { path: TEST_CUSTOM_PATH });
    recordTest("设置自定义路径", true, `路径设置为: ${TEST_CUSTOM_PATH}`);
    return true;
  } catch (error) {
    recordTest("设置自定义路径", false, `错误: ${error}`);
    return false;
  }
}

// 测试2: 验证路径已保存
async function test2_verifyPathSaved() {
  try {
    const savedPath = await invoke("get_session_storage_path_setting");

    if (savedPath === TEST_CUSTOM_PATH) {
      recordTest("验证路径已保存", true, `读取到的路径: ${savedPath}`);
      return true;
    } else {
      recordTest("验证路径已保存", false, `期望: ${TEST_CUSTOM_PATH}, 实际: ${savedPath}`);
      return false;
    }
  } catch (error) {
    recordTest("验证路径已保存", false, `错误: ${error}`);
    return false;
  }
}

// 测试3: 创建会话并验证文件位置
async function test3_createSessionAndVerify() {
  try {
    const metadata = {
      continued_from: TEST_PARENT_SESSION_ID,
      continued_at: Date.now()
    };

    const newSessionId = await invoke("create_continued_session", {
      projectPath: "test-project",
      systemPrompt: TEST_SESSION_SUMMARY,
      parentSessionId: TEST_PARENT_SESSION_ID,
      metadata
    });

    recordTest("创建会话", true, `会话ID: ${newSessionId}`);

    // 验证文件是否在正确位置
    const expectedDir = `${TEST_CUSTOM_PATH}\\sessions\\${newSessionId}`;
    const summaryPath = `${expectedDir}\\summary.md`;
    const metadataPath = `${expectedDir}\\metadata.json`;

    // 检查目录是否存在
    try {
      await fs.readDir(expectedDir);
      recordTest("验证会话目录", true, `目录存在: ${expectedDir}`);
    } catch (error) {
      recordTest("验证会话目录", false, `目录不存在: ${expectedDir}`);
      return false;
    }

    // 检查 summary.md 是否存在
    try {
      const summaryContent = await fs.readTextFile(summaryPath);
      if (summaryContent === TEST_SESSION_SUMMARY) {
        recordTest("验证摘要文件", true, `内容正确`);
      } else {
        recordTest("验证摘要文件", false, `内容不匹配`);
      }
    } catch (error) {
      recordTest("验证摘要文件", false, `文件不存在: ${summaryPath}`);
    }

    // 检查 metadata.json 是否存在且正确
    try {
      const metadataContent = await fs.readTextFile(metadataPath);
      const metadata = JSON.parse(metadataContent);

      if (metadata.session_id === newSessionId &&
          metadata.parent_session_id === TEST_PARENT_SESSION_ID) {
        recordTest("验证元数据文件", true, `元数据正确`);
      } else {
        recordTest("验证元数据文件", false, `元数据不正确`);
      }
    } catch (error) {
      recordTest("验证元数据文件", false, `文件读取失败: ${error}`);
    }

    return true;
  } catch (error) {
    recordTest("创建会话", false, `错误: ${error}`);
    return false;
  }
}

// 测试4: 重置为默认路径
async function test4_resetToDefault() {
  try {
    await invoke("set_session_storage_path", { path: "" });
    const savedPath = await invoke("get_session_storage_path_setting");

    if (savedPath === null || savedPath === "") {
      recordTest("重置为默认路径", true, "路径已清空");
      return true;
    } else {
      recordTest("重置为默认路径", false, `路径未清空: ${savedPath}`);
      return false;
    }
  } catch (error) {
    recordTest("重置为默认路径", false, `错误: ${error}`);
    return false;
  }
}

// 测试5: 使用默认路径创建会话
async function test5_createWithDefaultPath() {
  try {
    const metadata = {
      continued_from: "test-default-parent",
      continued_at: Date.now()
    };

    const newSessionId = await invoke("create_continued_session", {
      projectPath: "test-project",
      systemPrompt: "Default path test",
      parentSessionId: "test-default-parent",
      metadata
    });

    recordTest("使用默认路径创建会话", true, `会话ID: ${newSessionId}`);

    // 验证文件在默认路径下 (AppData)
    // 注意：这里不检查具体路径，因为默认路径是动态的
    return true;
  } catch (error) {
    recordTest("使用默认路径创建会话", false, `错误: ${error}`);
    return false;
  }
}

// 清理测试数据
async function cleanup() {
  try {
    // 删除测试创建的目录
    console.log("\n🧹 清理测试数据...");
    // 注意：在真实环境中需要实现目录删除逻辑
    console.log("⚠️ 请手动删除测试目录: " + TEST_CUSTOM_PATH);
  } catch (error) {
    console.error("清理失败:", error);
  }
}

// 主测试函数
async function runTests() {
  console.log("🚀 开始测试智能会话存储路径功能\n");

  // 按顺序执行测试
  await test1_setCustomPath();
  await test2_verifyPathSaved();
  await test3_createSessionAndVerify();
  await test4_resetToDefault();
  await test5_createWithDefaultPath();

  // 输出测试结果
  console.log("\n" + "=".repeat(50));
  console.log("📊 测试结果汇总");
  console.log("=".repeat(50));
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📝 总计: ${results.tests.length}`);
  console.log("=".repeat(50));

  // 详细结果
  console.log("\n📋 详细结果:");
  results.tests.forEach((test, index) => {
    const icon = test.passed ? "✅" : "❌";
    console.log(`${index + 1}. ${icon} ${test.name}: ${test.message}`);
  });

  // 清理
  await cleanup();

  // 返回测试是否全部通过
  return results.failed === 0;
}

// 导出测试函数（供控制台调用）
window.testSessionStoragePath = runTests;

console.log("📝 测试脚本已加载，在控制台运行: testSessionStoragePath()");
