#!/usr/bin/env node
/**
 * 通用 API 代理测试脚本 v3.0
 * 
 * 功能：
 * - 自动检测 API 类型（Claude / Gemini / OpenAI / 其他）
 * - 自动检测 API 格式（OpenAI 兼容 / Anthropic 原生）
 * - 支持 HTTP 和 HTTPS
 * - 自动查询代理商支持的模型
 * - 详细输出测试结果
 * 
 * 使用方法：
 *   node universal-api-tester.cjs                           # 使用 ~/.claude/settings.json
 *   node universal-api-tester.cjs <base-url> <api-key>     # 手动指定
 *   node universal-api-tester.cjs --type=gemini <url> <key> # 强制指定类型
 * 
 * @author Fangyu
 * @license MIT
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const DEFAULT_TIMEOUT = 60000;  // 60秒
const REQUEST_DELAY = 1500;     // 请求间隔

// Claude 官方模型（2026-01）
const CLAUDE_MODELS = {
    'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 - 日常编程首选',
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 - 快速响应',
    'claude-opus-4-5-20251101': 'Claude Opus 4.5 - 复杂推理',
    'claude-opus-4-1-20250805': 'Claude Opus 4.1 - 混合推理',
};

// Gemini 官方模型（2026-01）
const GEMINI_MODELS = {
    'gemini-2.5-pro': 'Gemini 2.5 Pro - 100w上下文，带思维链',
    'gemini-2.5-flash': 'Gemini 2.5 Flash - 快速模型',
    'gemini-3-pro-preview': 'Gemini 3 Pro - 最新Pro模型',
    'gemini-3-flash-preview': 'Gemini 3 Flash - 性价比最高',
    'gemini-2.5-pro-search': 'Gemini 2.5 Pro + 搜索',
    'gemini-3-pro-search': 'Gemini 3 Pro + 搜索',
    'gemini-2.5-pro-no': 'Gemini 2.5 Pro - 无思维链',
    'gemini-3-pro-no': 'Gemini 3 Pro - 无思维链',
};

// OpenAI 官方模型（2026-01）
const OPENAI_MODELS = {
    'gpt-4o': 'GPT-4o - 多模态旗舰',
    'gpt-4o-mini': 'GPT-4o Mini - 快速便宜',
    'gpt-4-turbo': 'GPT-4 Turbo - 128k上下文',
    'o1': 'o1 - 推理模型',
    'o1-mini': 'o1 Mini - 轻量推理',
    'o3-mini': 'o3 Mini - 最新推理',
};

// 默认配置
const DEFAULT_CONFIGS = {
    hiapi: {
        baseUrl: 'https://hiapi.online/v1',
        apiKey: 'sk-ljX4qbaBf84c9tOytKzYDFHdc7hlkUEJ1ix2ZoionqiGA9xp',
    },
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


// ==================== API 类型检测 ====================

/**
 * 根据模型列表自动检测 API 类型
 */
function detectApiType(models) {
    const modelStr = models.join(' ').toLowerCase();

    const claudeCount = models.filter(m =>
        m.toLowerCase().includes('claude') ||
        m.toLowerCase().includes('anthropic')
    ).length;

    const geminiCount = models.filter(m =>
        m.toLowerCase().includes('gemini')
    ).length;

    const openaiCount = models.filter(m =>
        m.toLowerCase().includes('gpt') ||
        m.toLowerCase().includes('o1') ||
        m.toLowerCase().includes('o3')
    ).length;

    // 返回占比最高的类型
    if (claudeCount >= geminiCount && claudeCount >= openaiCount && claudeCount > 0) {
        return 'claude';
    }
    if (geminiCount >= claudeCount && geminiCount >= openaiCount && geminiCount > 0) {
        return 'gemini';
    }
    if (openaiCount > 0) {
        return 'openai';
    }

    // 默认尝试 Claude
    return 'claude';
}

/**
 * 根据 URL 猜测 API 类型
 */
function guessApiTypeFromUrl(url) {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('anthropic')) return 'claude';
    if (urlLower.includes('claude')) return 'claude';
    if (urlLower.includes('gemini')) return 'gemini';
    if (urlLower.includes('google')) return 'gemini';
    if (urlLower.includes('openai')) return 'openai';
    if (urlLower.includes('gpt')) return 'openai';

    return null;
}

// ==================== 核心功能 ====================

/**
 * 查询代理商支持的模型列表
 */
async function fetchModels(baseUrl, apiKey) {
    // 确保 URL 格式正确
    let url = baseUrl.replace(/\/$/, '');
    if (!url.endsWith('/v1')) {
        url = url.replace(/\/v1$/, '');
    }
    url = `${url}/models`;

    // 如果 baseUrl 已经包含 /v1，直接用
    if (baseUrl.includes('/v1')) {
        url = `${baseUrl.replace(/\/$/, '')}/models`;
    }

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
    let url = baseUrl.replace(/\/$/, '');
    if (!url.endsWith('/v1')) {
        url = `${url}/v1`;
    }
    url = `${url}/chat/completions`;

    // 如果 baseUrl 已经包含 /v1
    if (baseUrl.includes('/v1')) {
        url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    }

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
                usage: response.data.usage,
                hasThinking: content.includes('<think>') || content.includes('thinking'),
            };
        }

        return {
            success: false,
            model: model,
            latency,
            error: response.data?.error?.message || `HTTP ${response.status}`,
            raw: response.raw?.slice(0, 300),
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
    let url = baseUrl.replace(/\/$/, '');
    if (!url.endsWith('/v1')) {
        url = `${url}/v1`;
    }
    url = `${url}/messages`;

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
            max_tokens: 100,
            messages: [{ role: 'user', content: '用一句话介绍你自己' }],
        });

        const latency = Date.now() - startTime;

        if (response.status === 200 && response.data?.content) {
            const content = response.data.content[0]?.text || '';
            return {
                success: true,
                model: model,
                actualModel: response.data.model,
                latency,
                response: content.slice(0, 80).replace(/\n/g, ' '),
                usage: response.data.usage,
            };
        }

        return {
            success: false,
            model: model,
            latency,
            error: response.data?.error?.message || `HTTP ${response.status}`,
            raw: response.raw?.slice(0, 300),
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
    console.log('  通用 API 代理测试脚本 v3.0');
    console.log('═'.repeat(70));
    console.log(`  时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('');

    // 解析命令行参数
    let apiKey, baseUrl, forceType = null;
    const args = process.argv.slice(2);

    // 检查 --type 参数
    const typeArg = args.find(a => a.startsWith('--type='));
    if (typeArg) {
        forceType = typeArg.split('=')[1].toLowerCase();
        args.splice(args.indexOf(typeArg), 1);
    }

    if (args.length >= 2) {
        baseUrl = args[0];
        apiKey = args[1];
        console.log('  配置来源: 命令行参数');
    } else if (args.length === 1 && args[0] === '--hiapi') {
        // 快捷方式：使用 hiapi 默认配置
        baseUrl = DEFAULT_CONFIGS.hiapi.baseUrl;
        apiKey = DEFAULT_CONFIGS.hiapi.apiKey;
        console.log('  配置来源: 内置 hiapi.online 配置');
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
            console.log('用法:');
            console.log('  node universal-api-tester.cjs <base-url> <api-key>');
            console.log('  node universal-api-tester.cjs --hiapi                    # 使用 hiapi.online');
            console.log('  node universal-api-tester.cjs --type=gemini <url> <key>  # 强制指定类型');
            console.log('');
            console.log('支持的类型: claude, gemini, openai');
            process.exit(1);
        }
    }

    if (!apiKey || !baseUrl) {
        console.error('❌ 缺少 API Key 或 Base URL');
        process.exit(1);
    }

    console.log(`  API Base: ${baseUrl}`);
    console.log(`  API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);
    if (forceType) {
        console.log(`  强制类型: ${forceType}`);
    }
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

    console.log('');

    // Step 2: 自动检测 API 类型
    console.log('🔍 Step 2: 检测 API 类型...');

    let apiType = forceType;
    if (!apiType) {
        if (providerModels.length > 0) {
            apiType = detectApiType(providerModels);
            console.log(`   根据模型列表检测: ${apiType.toUpperCase()}`);
        } else {
            apiType = guessApiTypeFromUrl(baseUrl);
            if (apiType) {
                console.log(`   根据 URL 猜测: ${apiType.toUpperCase()}`);
            } else {
                apiType = 'claude';
                console.log(`   无法检测，默认使用: CLAUDE`);
            }
        }
    } else {
        console.log(`   使用强制指定类型: ${apiType.toUpperCase()}`);
    }

    // 选择对应的模型列表
    let officialModels;
    switch (apiType) {
        case 'gemini':
            officialModels = GEMINI_MODELS;
            break;
        case 'openai':
            officialModels = OPENAI_MODELS;
            break;
        case 'claude':
        default:
            officialModels = CLAUDE_MODELS;
            break;
    }

    // 显示代理商支持的相关模型
    const relevantModels = providerModels.filter(m => {
        const ml = m.toLowerCase();
        switch (apiType) {
            case 'gemini': return ml.includes('gemini');
            case 'openai': return ml.includes('gpt') || ml.includes('o1') || ml.includes('o3');
            case 'claude': return ml.includes('claude');
            default: return true;
        }
    });

    if (relevantModels.length > 0) {
        console.log('');
        console.log(`   代理商的 ${apiType.toUpperCase()} 模型:`);
        relevantModels.slice(0, 15).forEach(m => console.log(`   - ${m}`));
        if (relevantModels.length > 15) {
            console.log(`   ... 还有 ${relevantModels.length - 15} 个`);
        }
    }

    console.log('');

    // Step 3: 确定要测试的模型
    const officialModelIds = Object.keys(officialModels);
    let modelsToTest = officialModelIds.filter(m =>
        providerModels.length === 0 || providerModels.includes(m)
    );

    console.log('📋 官方模型支持情况:');
    officialModelIds.forEach(m => {
        const supported = providerModels.length === 0 || providerModels.includes(m);
        const desc = officialModels[m];
        console.log(`   ${supported ? '✅' : '❌'} ${m}`);
        if (supported) {
            console.log(`      ${desc}`);
        }
    });

    if (modelsToTest.length === 0) {
        console.log('');
        console.log('⚠️ 代理商不支持任何官方模型，将测试前4个...');
        modelsToTest = officialModelIds.slice(0, 4);
    }

    console.log('');

    // Step 4: 检测 API 格式（OpenAI 兼容 vs Anthropic 原生）
    console.log('🔌 Step 4: 检测 API 格式...');

    let testFunc = testModelOpenAI;
    let apiFormat = 'OpenAI 兼容';

    // 只有 Claude 类型才需要检测两种格式
    if (apiType === 'claude') {
        const testModel = modelsToTest[0];
        const openaiTest = await testModelOpenAI(baseUrl, apiKey, testModel);
        await sleep(500);
        const anthropicTest = await testModelAnthropic(baseUrl, apiKey, testModel);

        if (openaiTest.success && anthropicTest.success) {
            if (openaiTest.latency <= anthropicTest.latency) {
                testFunc = testModelOpenAI;
                apiFormat = 'OpenAI 兼容';
                console.log(`   ✅ 两种格式都支持，使用 OpenAI 兼容（延迟更低）`);
            } else {
                testFunc = testModelAnthropic;
                apiFormat = 'Anthropic 原生';
                console.log(`   ✅ 两种格式都支持，使用 Anthropic 原生（延迟更低）`);
            }
        } else if (openaiTest.success) {
            testFunc = testModelOpenAI;
            apiFormat = 'OpenAI 兼容';
            console.log(`   ✅ 使用 OpenAI 兼容格式`);
        } else if (anthropicTest.success) {
            testFunc = testModelAnthropic;
            apiFormat = 'Anthropic 原生';
            console.log(`   ✅ 使用 Anthropic 原生格式`);
        } else {
            console.log(`   ⚠️ 两种格式都失败，将尝试 OpenAI 兼容`);
            console.log(`      OpenAI 错误: ${openaiTest.error}`);
            console.log(`      Anthropic 错误: ${anthropicTest.error}`);
        }
    } else {
        // Gemini 和 OpenAI 只用 OpenAI 兼容格式
        console.log(`   使用 OpenAI 兼容格式（${apiType} 标准）`);
    }

    console.log('');

    // Step 5: 测试所有模型
    console.log(`🧪 Step 5: 测试模型...`);
    console.log('');

    const results = [];
    for (const model of modelsToTest) {
        process.stdout.write(`   ⏳ ${model}...`);
        const result = await testFunc(baseUrl, apiKey, model);
        results.push(result);

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        if (result.success) {
            console.log(`   ✅ ${model}`);
            console.log(`      延迟: ${formatTime(result.latency)}`);
            if (result.actualModel && result.actualModel !== model) {
                console.log(`      实际模型: ${result.actualModel}`);
            }
            console.log(`      响应: "${result.response}..."`);
            if (result.hasThinking) {
                console.log(`      📝 包含思维链`);
            }
            if (result.usage) {
                const input = result.usage.prompt_tokens || result.usage.input_tokens || 0;
                const output = result.usage.completion_tokens || result.usage.output_tokens || 0;
                console.log(`      Token: 输入 ${input}, 输出 ${output}`);
            }
        } else {
            console.log(`   ❌ ${model}`);
            console.log(`      延迟: ${formatTime(result.latency)}`);
            console.log(`      错误: ${result.error}`);
            if (result.raw) {
                console.log(`      原始响应: ${result.raw.slice(0, 100)}...`);
            }
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
        console.log(`  📝 API 类型: ${apiType.toUpperCase()}`);
        console.log(`  📝 API 格式: ${apiFormat}`);

        const workingModels = results.filter(r => r.success).map(r => r.model);
        console.log(`  📝 可用模型: ${workingModels.join(', ')}`);

        // 计算平均延迟
        const avgLatency = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.latency, 0) / successCount;
        console.log(`  📝 平均延迟: ${formatTime(avgLatency)}`);
    } else {
        console.log(`  ❌ 代理商测试失败`);
        console.log(`  📝 可能原因:`);
        console.log(`     - API Key 无效或过期`);
        console.log(`     - 代理商服务暂时不可用`);
        console.log(`     - 模型不在代理商支持列表中`);
        console.log(`     - 网络问题`);
    }

    console.log('═'.repeat(70));
}

main().catch(console.error);
