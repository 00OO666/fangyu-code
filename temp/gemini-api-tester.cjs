#!/usr/bin/env node
/**
 * Gemini API 代理测试脚本 v1.0
 * 
 * 功能：
 * - 测试 hiapi.online 等 Gemini 代理商
 * - 支持 OpenAI 兼容格式
 * - 自动查询支持的模型
 * - 详细输出测试结果
 * 
 * 使用方法：
 *   node gemini-api-tester.cjs                           # 使用默认配置
 *   node gemini-api-tester.cjs <base-url> <api-key>     # 手动指定
 * 
 * @author Fangyu
 * @license MIT
 */

const http = require('http');
const https = require('https');

// ==================== 配置 ====================

const DEFAULT_TIMEOUT = 60000;  // 60秒
const REQUEST_DELAY = 1500;     // 请求间隔

// 默认配置（hiapi.online）
const DEFAULT_CONFIG = {
    baseUrl: 'https://hiapi.online/v1',
    apiKey: 'sk-ljX4qbaBf84c9tOytKzYDFHdc7hlkUEJ1ix2ZoionqiGA9xp',
};

// Gemini 官方模型列表（2026-01）
const GEMINI_MODELS = {
    // 主力模型
    'gemini-2.5-pro': 'Gemini 2.5 Pro - 100w上下文，带思维链和搜索',
    'gemini-2.5-flash': 'Gemini 2.5 Flash - 快速模型',
    'gemini-3-pro-preview': 'Gemini 3 Pro - 最新Pro模型',
    'gemini-3-flash-preview': 'Gemini 3 Flash - 性价比最高',
    // 搜索模型
    'gemini-2.5-pro-search': 'Gemini 2.5 Pro + 搜索',
    'gemini-3-pro-search': 'Gemini 3 Pro + 搜索',
    // 无思维链版本
    'gemini-2.5-pro-no': 'Gemini 2.5 Pro - 无思维链',
    'gemini-3-pro-no': 'Gemini 3 Pro - 无思维链',
};

// ==================== 工具函数 ====================

function getClient(url) {
    return url.startsWith('https') ? https : http;
}

function request(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = getClient(url);

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || DEFAULT_TIMEOUT,
        };

        const req = client.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data ? JSON.parse(data) : null,
                        raw: data,
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: null,
                        raw: data,
                        parseError: e.message,
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

// ==================== 核心功能 ====================

/**
 * 查询代理商支持的模型列表
 */
async function fetchModels(baseUrl, apiKey) {
    const url = `${baseUrl.replace(/\/$/, '')}/models`;

    try {
        const response = await request(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (response.status === 200 && response.data?.data) {
            return {
                success: true,
                models: response.data.data.map(m => m.id),
            };
        }

        return {
            success: false,
            error: response.data?.error?.message || `HTTP ${response.status}`,
        };
    } catch (e) {
        return {
            success: false,
            error: e.message,
        };
    }
}

/**
 * 测试单个模型
 */
async function testModel(baseUrl, apiKey, model) {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const startTime = Date.now();

    try {
        const response = await request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
        }, {
            model: model,
            max_tokens: 100,
            messages: [{ role: 'user', content: '用一句话介绍你自己' }],
        });

        const latency = Date.now() - startTime;

        if (response.status === 200 && response.data?.choices) {
            const content = response.data.choices[0]?.message?.content || '';
            return {
                success: true,
                model: model,
                actualModel: response.data.model,
                latency,
                response: content.slice(0, 80).replace(/\n/g, ' '),
                hasThinking: content.includes('<think>') || content.includes('thinking'),
            };
        }

        return {
            success: false,
            model: model,
            latency,
            error: response.data?.error?.message || `HTTP ${response.status}`,
            raw: response.raw?.slice(0, 200),
        };
    } catch (e) {
        return {
            success: false,
            model: model,
            latency: Date.now() - startTime,
            error: e.message,
        };
    }
}

// ==================== 主程序 ====================

async function main() {
    console.log('═'.repeat(70));
    console.log('  Gemini API 代理测试脚本 v1.0');
    console.log('═'.repeat(70));
    console.log(`  时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('');

    // 获取配置
    let apiKey, baseUrl;

    if (process.argv.length >= 4) {
        baseUrl = process.argv[2];
        apiKey = process.argv[3];
        console.log('  配置来源: 命令行参数');
    } else {
        baseUrl = DEFAULT_CONFIG.baseUrl;
        apiKey = DEFAULT_CONFIG.apiKey;
        console.log('  配置来源: 默认配置 (hiapi.online)');
    }

    console.log(`  API Base: ${baseUrl}`);
    console.log(`  API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);
    console.log('═'.repeat(70));
    console.log('');

    // Step 1: 查询支持的模型
    console.log('📋 Step 1: 查询代理商支持的模型...');
    const modelsResult = await fetchModels(baseUrl, apiKey);

    let providerModels = [];
    if (modelsResult.success) {
        providerModels = modelsResult.models;
        console.log(`✅ 代理商返回 ${providerModels.length} 个模型`);

        // 显示 Gemini 相关模型
        const geminiModels = providerModels.filter(m => m.toLowerCase().includes('gemini'));
        if (geminiModels.length > 0) {
            console.log('');
            console.log('   Gemini 模型:');
            geminiModels.forEach(m => console.log(`   - ${m}`));
        }
    } else {
        console.log(`⚠️ 无法获取模型列表: ${modelsResult.error}`);
    }

    console.log('');

    // Step 2: 确定要测试的模型
    const officialModels = Object.keys(GEMINI_MODELS);
    let modelsToTest = officialModels.filter(m =>
        providerModels.length === 0 || providerModels.includes(m)
    );

    console.log('📋 官方模型支持情况:');
    officialModels.forEach(m => {
        const supported = providerModels.length === 0 || providerModels.includes(m);
        const desc = GEMINI_MODELS[m];
        console.log(`   ${supported ? '✅' : '❌'} ${m}`);
        if (supported) {
            console.log(`      ${desc}`);
        }
    });

    if (modelsToTest.length === 0) {
        console.log('');
        console.log('⚠️ 代理商不支持任何官方模型，将测试前4个模型...');
        modelsToTest = officialModels.slice(0, 4);
    }

    console.log('');

    // Step 3: 测试模型
    console.log('🔌 Step 3: 测试模型...');
    console.log('');

    const results = [];
    for (const model of modelsToTest) {
        process.stdout.write(`   ⏳ ${model}...`);
        const result = await testModel(baseUrl, apiKey, model);
        results.push(result);

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        if (result.success) {
            console.log(`   ✅ ${model}`);
            console.log(`      延迟: ${formatTime(result.latency)}`);
            console.log(`      响应: "${result.response}..."`);
            if (result.hasThinking) {
                console.log(`      📝 包含思维链`);
            }
        } else {
            console.log(`   ❌ ${model}`);
            console.log(`      延迟: ${formatTime(result.latency)}`);
            console.log(`      错误: ${result.error}`);
        }
        console.log('');

        await sleep(REQUEST_DELAY);
    }

    // 总结
    const successCount = results.filter(r => r.success).length;

    console.log('═'.repeat(70));
    console.log('  测试结果');
    console.log('═'.repeat(70));

    if (successCount > 0) {
        console.log(`  ✅ 代理商正常工作`);
        console.log(`  ✅ 成功测试 ${successCount}/${modelsToTest.length} 个模型`);

        const workingModels = results.filter(r => r.success).map(r => r.model);
        console.log(`  📝 可用模型: ${workingModels.join(', ')}`);
    } else {
        console.log(`  ❌ 代理商测试失败`);
        console.log(`  📝 可能原因:`);
        console.log(`     - API Key 无效或过期`);
        console.log(`     - 代理商服务暂时不可用`);
        console.log(`     - 网络问题`);
    }

    console.log('═'.repeat(70));
}

main().catch(console.error);
