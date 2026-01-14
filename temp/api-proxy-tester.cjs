#!/usr/bin/env node
/**
 * API 代理测试脚本 v2.0
 * 
 * 功能：
 * - 自动检测代理商支持的模型
 * - 支持 HTTP 和 HTTPS
 * - 支持 OpenAI 兼容格式（大多数代理商使用）
 * - 支持 Anthropic 原生格式
 * - 从 ~/.claude/settings.json 读取配置
 * 
 * 使用方法：
 *   node api-proxy-tester.cjs                    # 使用 settings.json 配置
 *   node api-proxy-tester.cjs <url> <api-key>   # 手动指定
 * 
 * @author Fangyu
 * @license MIT
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const DEFAULT_TIMEOUT = 60000;  // 60秒，Opus 模型响应较慢
const REQUEST_DELAY = 1000;

// Claude 官方支持的模型（2026-01）
const OFFICIAL_MODELS = [
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-5-20251101',
    'claude-opus-4-1-20250805',
];

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
    const url = `${baseUrl.replace(/\/$/, '')}/v1/models`;

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
 * 测试单个模型（OpenAI 兼容格式）
 */
async function testModelOpenAI(baseUrl, apiKey, model) {
    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
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
            max_tokens: 30,
            messages: [{ role: 'user', content: 'Say "OK" only' }],
        });

        const latency = Date.now() - startTime;

        if (response.status === 200 && response.data?.choices) {
            return {
                success: true,
                model: model,
                actualModel: response.data.model,
                latency,
                response: response.data.choices[0]?.message?.content?.slice(0, 50),
                usage: response.data.usage,
            };
        }

        return {
            success: false,
            model: model,
            latency,
            error: response.data?.error?.message || `HTTP ${response.status}`,
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

/**
 * 测试单个模型（Anthropic 原生格式）
 */
async function testModelAnthropic(baseUrl, apiKey, model) {
    const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
    const startTime = Date.now();

    try {
        const response = await request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
        }, {
            model: model,
            max_tokens: 30,
            messages: [{ role: 'user', content: 'Say "OK" only' }],
        });

        const latency = Date.now() - startTime;

        if (response.status === 200 && response.data?.content) {
            return {
                success: true,
                model: model,
                actualModel: response.data.model,
                latency,
                response: response.data.content[0]?.text?.slice(0, 50),
                usage: response.data.usage,
            };
        }

        return {
            success: false,
            model: model,
            latency,
            error: response.data?.error?.message || `HTTP ${response.status}`,
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
    console.log('  API 代理测试脚本 v2.0');
    console.log('═'.repeat(70));
    console.log(`  时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('');

    // 获取配置
    let apiKey, baseUrl;

    if (process.argv.length >= 4) {
        // 命令行参数
        baseUrl = process.argv[2];
        apiKey = process.argv[3];
        console.log('  配置来源: 命令行参数');
    } else {
        // 从 settings.json 读取
        const settingsPath = path.join(
            process.env.USERPROFILE || process.env.HOME,
            '.claude',
            'settings.json'
        );

        try {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            apiKey = settings.env?.ANTHROPIC_API_KEY;
            baseUrl = settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
            console.log('  配置来源: ~/.claude/settings.json');
        } catch (e) {
            console.error('❌ 无法读取配置文件:', e.message);
            console.log('');
            console.log('用法: node api-proxy-tester.cjs <base-url> <api-key>');
            process.exit(1);
        }
    }

    if (!apiKey || !baseUrl) {
        console.error('❌ 缺少 API Key 或 Base URL');
        process.exit(1);
    }

    console.log(`  API Base: ${baseUrl}`);
    console.log(`  API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);
    console.log('═'.repeat(70));
    console.log('');

    // Step 1: 查询代理商支持的模型
    console.log('📋 Step 1: 查询代理商支持的模型...');
    const modelsResult = await fetchModels(baseUrl, apiKey);

    let providerModels = [];
    if (modelsResult.success) {
        providerModels = modelsResult.models;
        console.log(`✅ 代理商返回 ${providerModels.length} 个模型`);
    } else {
        console.log(`⚠️ 无法获取模型列表: ${modelsResult.error}`);
    }

    // 筛选出代理商支持的官方模型
    let modelsToTest = OFFICIAL_MODELS.filter(m =>
        providerModels.length === 0 || providerModels.includes(m)
    );

    console.log('');
    console.log('📋 官方模型支持情况:');
    OFFICIAL_MODELS.forEach(m => {
        const supported = providerModels.length === 0 || providerModels.includes(m);
        console.log(`   ${supported ? '✅' : '❌'} ${m}`);
    });

    if (modelsToTest.length === 0) {
        console.log('');
        console.log('⚠️ 代理商不支持任何官方模型，将尝试测试所有官方模型...');
        modelsToTest = OFFICIAL_MODELS;
    }

    console.log('');

    // Step 2: 自动检测 API 格式
    console.log('🔍 Step 2: 自动检测 API 格式...');
    console.log('');

    // 用第一个模型测试两种格式
    const testModel = modelsToTest[0];
    const openaiTest = await testModelOpenAI(baseUrl, apiKey, testModel);
    await sleep(500);
    const anthropicTest = await testModelAnthropic(baseUrl, apiKey, testModel);

    let apiFormat = null;
    let testFunc = null;

    if (openaiTest.success && anthropicTest.success) {
        // 两种都支持，选延迟低的
        if (openaiTest.latency <= anthropicTest.latency) {
            apiFormat = 'OpenAI 兼容';
            testFunc = testModelOpenAI;
            console.log(`   ✅ 两种格式都支持，使用 OpenAI 兼容格式（延迟更低）`);
        } else {
            apiFormat = 'Anthropic 原生';
            testFunc = testModelAnthropic;
            console.log(`   ✅ 两种格式都支持，使用 Anthropic 原生格式（延迟更低）`);
        }
    } else if (openaiTest.success) {
        apiFormat = 'OpenAI 兼容';
        testFunc = testModelOpenAI;
        console.log(`   ✅ 检测到 OpenAI 兼容格式 (/v1/chat/completions)`);
    } else if (anthropicTest.success) {
        apiFormat = 'Anthropic 原生';
        testFunc = testModelAnthropic;
        console.log(`   ✅ 检测到 Anthropic 原生格式 (/v1/messages)`);
    } else {
        console.log(`   ❌ 两种格式都失败:`);
        console.log(`      OpenAI: ${openaiTest.error}`);
        console.log(`      Anthropic: ${anthropicTest.error}`);
    }

    console.log('');

    // Step 3: 测试所有模型
    const results = [];

    if (testFunc) {
        console.log(`🔌 Step 3: 测试模型 (${apiFormat})...`);
        console.log('');

        for (const model of modelsToTest) {
            process.stdout.write(`   ⏳ ${model}...`);
            const result = await testFunc(baseUrl, apiKey, model);
            results.push(result);

            // 清除当前行
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);

            if (result.success) {
                console.log(`   ✅ ${model}`);
                console.log(`      延迟: ${formatTime(result.latency)}`);
                console.log(`      实际模型: ${result.actualModel || model}`);
                console.log(`      响应: "${result.response || ''}"`);
                if (result.usage) {
                    console.log(`      Token: 输入 ${result.usage.prompt_tokens || result.usage.input_tokens || 0}, 输出 ${result.usage.completion_tokens || result.usage.output_tokens || 0}`);
                }
            } else {
                console.log(`   ❌ ${model}`);
                console.log(`      延迟: ${formatTime(result.latency)}`);
                console.log(`      错误: ${result.error}`);
            }
            console.log('');

            await sleep(REQUEST_DELAY);
        }
    }

    const successCount = results.filter(r => r.success).length;

    // Step 4: 测试 Token 缓存支持
    console.log('');
    console.log('🔄 Step 4: 测试 Token 缓存 (Prompt Caching)...');
    console.log('');

    let cacheSupported = false;
    const cacheTestModel = results.find(r => r.success)?.model;

    if (cacheTestModel && testFunc) {
        // 发送两次相同请求，检查第二次是否有缓存命中
        const longPrompt = '请记住这段文字用于测试缓存功能。'.repeat(50);

        console.log(`   使用模型: ${cacheTestModel}`);
        console.log(`   发送两次相同请求...`);

        // 第一次请求
        const cacheTest1 = await testFunc(baseUrl, apiKey, cacheTestModel);
        await sleep(1000);

        // 第二次请求（相同内容）
        const cacheTest2 = await testFunc(baseUrl, apiKey, cacheTestModel);

        const usage1 = cacheTest1.usage || {};
        const usage2 = cacheTest2.usage || {};

        // 检查是否有缓存相关字段
        const hasCacheFields =
            usage2.cache_creation_input_tokens !== undefined ||
            usage2.cache_read_input_tokens !== undefined ||
            usage2.prompt_tokens_details?.cached_tokens !== undefined;

        const cacheHit =
            (usage2.cache_read_input_tokens && usage2.cache_read_input_tokens > 0) ||
            (usage2.prompt_tokens_details?.cached_tokens && usage2.prompt_tokens_details.cached_tokens > 0);

        console.log('');
        console.log('   第一次请求:');
        console.log(`      input_tokens: ${usage1.input_tokens || usage1.prompt_tokens || 'N/A'}`);
        console.log(`      cache_creation: ${usage1.cache_creation_input_tokens || 'N/A'}`);
        console.log(`      cache_read: ${usage1.cache_read_input_tokens || 'N/A'}`);

        console.log('   第二次请求:');
        console.log(`      input_tokens: ${usage2.input_tokens || usage2.prompt_tokens || 'N/A'}`);
        console.log(`      cache_creation: ${usage2.cache_creation_input_tokens || 'N/A'}`);
        console.log(`      cache_read: ${usage2.cache_read_input_tokens || 'N/A'}`);

        if (hasCacheFields) {
            cacheSupported = true;
            if (cacheHit) {
                console.log('');
                console.log('   ✅ 支持 Token 缓存，且缓存命中！');
            } else {
                console.log('');
                console.log('   ✅ 支持 Token 缓存（返回了缓存字段）');
            }
        } else {
            console.log('');
            console.log('   ❌ 不支持 Token 缓存（未返回缓存相关字段）');
        }
    } else {
        console.log('   ⚠️ 无可用模型，跳过缓存测试');
    }

    // 总结
    console.log('');
    console.log('═'.repeat(70));
    console.log('  测试结果');
    console.log('═'.repeat(70));

    if (successCount > 0) {
        console.log(`  ✅ 代理商正常工作`);
        console.log(`  ✅ 成功测试 ${successCount}/${modelsToTest.length} 个模型`);
        console.log(`  📝 API 格式: ${apiFormat}`);

        const workingModels = results.filter(r => r.success).map(r => r.model);
        console.log(`  📝 可用模型: ${workingModels.join(', ')}`);
        console.log(`  📝 Token 缓存: ${cacheSupported ? '✅ 支持' : '❌ 不支持'}`);
    } else {
        console.log(`  ❌ 代理商测试失败`);
        console.log(`  📝 可能原因:`);
        console.log(`     - API Key 无效或过期`);
        console.log(`     - 代理商服务暂时不可用`);
        console.log(`     - 模型不在代理商支持列表中`);
    }

    console.log('═'.repeat(70));
}

main().catch(console.error);
