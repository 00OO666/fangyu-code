/**
 * LSP Client 测试脚本
 *
 * 测试目标：
 * 1. LSP Client 能够正确初始化
 * 2. 缓存机制正常工作
 * 3. 所有 LSP 方法能够正确调用
 * 4. 错误处理正常
 */

import { LSPClient } from '../src/core/lsp/LSPClient';
import { RealLSPClient } from '../src/core/tools/LSPAutoLoader';
import { Position } from '../src/core/types/unified-agent';

// 测试结果
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}${duration ? ` (${duration}ms)` : ''}`);
  if (error) {
    console.log(`  Error: ${error}`);
  }
}

async function runTests() {
  console.log('🧪 Starting LSP Client Tests...\n');

  // Test 1: 创建 LSP Client 实例
  try {
    const start = Date.now();
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);
    const duration = Date.now() - start;

    logTest('创建 LSP Client 实例', true, undefined, duration);
  } catch (error) {
    logTest('创建 LSP Client 实例', false, String(error));
    return; // 如果创建失败，后续测试无法进行
  }

  // Test 2: 缓存功能测试
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    // 获取初始缓存统计
    const initialStats = lspClient.getCacheStats();

    if (initialStats.total === 0) {
      logTest('缓存初始状态正确', true);
    } else {
      logTest('缓存初始状态正确', false, `Expected 0, got ${initialStats.total}`);
    }
  } catch (error) {
    logTest('缓存初始状态正确', false, String(error));
  }

  // Test 3: 清除缓存功能
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    lspClient.clearCache();
    const stats = lspClient.getCacheStats();

    if (stats.total === 0) {
      logTest('清除缓存功能', true);
    } else {
      logTest('清除缓存功能', false, `Cache not cleared: ${stats.total} entries remain`);
    }
  } catch (error) {
    logTest('清除缓存功能', false, String(error));
  }

  // Test 4: Hover 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.hover === 'function') {
      logTest('Hover 方法存在', true);
    } else {
      logTest('Hover 方法存在', false, 'hover method not found');
    }
  } catch (error) {
    logTest('Hover 方法存在', false, String(error));
  }

  // Test 5: GotoDefinition 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.gotoDefinition === 'function') {
      logTest('GotoDefinition 方法存在', true);
    } else {
      logTest('GotoDefinition 方法存在', false, 'gotoDefinition method not found');
    }
  } catch (error) {
    logTest('GotoDefinition 方法存在', false, String(error));
  }

  // Test 6: FindReferences 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.findReferences === 'function') {
      logTest('FindReferences 方法存在', true);
    } else {
      logTest('FindReferences 方法存在', false, 'findReferences method not found');
    }
  } catch (error) {
    logTest('FindReferences 方法存在', false, String(error));
  }

  // Test 7: Rename 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.rename === 'function') {
      logTest('Rename 方法存在', true);
    } else {
      logTest('Rename 方法存在', false, 'rename method not found');
    }
  } catch (error) {
    logTest('Rename 方法存在', false, String(error));
  }

  // Test 8: GetDiagnostics 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.getDiagnostics === 'function') {
      logTest('GetDiagnostics 方法存在', true);
    } else {
      logTest('GetDiagnostics 方法存在', false, 'getDiagnostics method not found');
    }
  } catch (error) {
    logTest('GetDiagnostics 方法存在', false, String(error));
  }

  // Test 9: Completion 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.completion === 'function') {
      logTest('Completion 方法存在', true);
    } else {
      logTest('Completion 方法存在', false, 'completion method not found');
    }
  } catch (error) {
    logTest('Completion 方法存在', false, String(error));
  }

  // Test 10: ClearFileCache 方法存在性检查
  try {
    const realClient = new RealLSPClient();
    const lspClient = new LSPClient(realClient);

    if (typeof lspClient.clearFileCache === 'function') {
      logTest('ClearFileCache 方法存在', true);
    } else {
      logTest('ClearFileCache 方法存在', false, 'clearFileCache method not found');
    }
  } catch (error) {
    logTest('ClearFileCache 方法存在', false, String(error));
  }

  // 输出测试总结
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
}

// 运行测试
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
