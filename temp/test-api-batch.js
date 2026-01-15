/**
 * API 批量延迟测试脚本
 * 测试多个模型的响应时间
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// 读取配置
const settingsPath = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'settings.json');
let apiKey, apiBase;

try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    apiKey = settings.env?.ANTHROPIC_API_KEY;
    apiBase = settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
} catch (e) {
    console.error('无法读取 settings.json:', e.message);
    process.exit(1);
}

console.log('═'.repeat(70));
console.log('  API 代理服务器完整测试报告');
console.log('═'.repeat(70));
console.log(`测试时间: ${new Date().toLocaleString('zh-CN')}`);
console.log(`API Base: ${apiBase}`);
console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
console.log('═'.repeat(70));
console.log('');

// 要测试的模型列表
const modelsToTest = [
    { id: 'claude-3-5-haiku-20241022', name: 'Haiku 3.5' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Sonnet 3.5' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Opus 4' },
    { id: 'claude-opus-4-5-20251101', name: 'Opus 4.5' },
];

const results = [];

async function testModel(model) {
    return new Promise((resolve) => {
        const requestBody = JSON.stringify({
            model: model.id,
            max_tokens: 50,
            messages: [{ role: 'user', content: '你好' }]
        });

        const url = new URL(`${apiBase}/v1/messages`);
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const startTime = Date.now();
        let responseData = '';

        const req = https.request(options, (res) => {
            const ttfb = Date.now() - startTime;

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const totalTime = Date.now() - startTime;
                let result = {
                    requestedModel: model.id,
                    requestedName: model.name,
                    statusCode: res.statusCode,
                    ttfb,
                    totalTime,
                    success: false,
                    actualModel: null,
                    error: null,
                    response: null
                };

                try {
                    const response = JSON.parse(responseData);
                    if (response.error) {
                        result.error = response.error.message;
                    } else if (response.content) {
                        result.success = true;
                        result.actualModel = response.model;
                        result.response = response.content[0]?.text?.slice(0, 50);
                        result.inputTokens = response.usage?.input_tokens;
                        result.outputTokens = response.usage?.output_tokens;
                    }
                } catch (e) {
                    result.error = responseData.slice(0, 200);
                }

                results.push(result);
                resolve(result);
            });
        });

        req.on('error', (e) => {
            results.push({
                requestedModel: model.id,
                requestedName: model.name,
                error: e.message,
                totalTime: Date.now() - startTime
            });
            resolve();
        });

        req.write(requestBody);
        req.end();
    });
}

async function runTests() {
    for (const model of modelsToTest) {
        console.log(`测试 ${model.name} (${model.id})...`);
        await testModel(model);
        // 间隔 1 秒避免限流
        await new Promise(r => setTimeout(r, 1000));
    }

    // 打印结果
    console.log('');
    console.log('═'.repeat(70));
    console.log('  测试结果汇总');
    console.log('═'.repeat(70));
    console.log('');

    console.log('┌' + '─'.repeat(68) + '┐');
    console.log('│ ' + '请求模型'.padEnd(25) + '│ ' + '状态'.padEnd(8) + '│ ' + 'TTFB'.padEnd(8) + '│ ' + '实际返回模型'.padEnd(20) + '│');
    console.log('├' + '─'.repeat(68) + '┤');

    for (const r of results) {
        const status = r.success ? '✅ 成功' : '❌ 失败';
        const ttfb = r.ttfb ? `${r.ttfb}ms` : 'N/A';
        const actual = r.actualModel || r.error?.slice(0, 18) || 'N/A';
        console.log('│ ' + r.requestedName.padEnd(25) + '│ ' + status.padEnd(8) + '│ ' + ttfb.padEnd(8) + '│ ' + actual.slice(0, 20).padEnd(20) + '│');
    }
    console.log('└' + '─'.repeat(68) + '┘');

    // 详细分析
    console.log('');
    console.log('═'.repeat(70));
    console.log('  详细分析');
    console.log('═'.repeat(70));

    for (const r of results) {
        console.log('');
        console.log(`【${r.requestedName}】`);
        console.log(`  请求模型: ${r.requestedModel}`);
        console.log(`  HTTP 状态: ${r.statusCode || 'N/A'}`);
        console.log(`  TTFB: ${r.ttfb || 'N/A'}ms`);
        console.log(`  总耗时: ${r.totalTime || 'N/A'}ms`);

        if (r.success) {
            console.log(`  ✅ 成功`);
            console.log(`  实际模型: ${r.actualModel}`);
            if (r.requestedModel !== r.actualModel) {
                console.log(`  ⚠️ 模型被替换！请求 ${r.requestedModel} 但返回 ${r.actualModel}`);
            }
            console.log(`  Tokens: 输入 ${r.inputTokens}, 输出 ${r.outputTokens}`);
        } else {
            console.log(`  ❌ 失败`);
            console.log(`  错误: ${r.error}`);
        }
    }

    // 结论
    console.log('');
    console.log('═'.repeat(70));
    console.log('  结论');
    console.log('═'.repeat(70));

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const modelMismatch = results.filter(r => r.success && r.requestedModel !== r.actualModel);
    const slowResponses = results.filter(r => r.ttfb > 5000);

    console.log(`  成功: ${successCount}/${results.length}`);
    console.log(`  失败: ${failCount}/${results.length}`);

    if (modelMismatch.length > 0) {
        console.log(`  ⚠️ 模型替换: ${modelMismatch.length} 次`);
        for (const m of modelMismatch) {
            console.log(`     - ${m.requestedName}: 请求 ${m.requestedModel} → 返回 ${m.actualModel}`);
        }
    }

    if (slowResponses.length > 0) {
        console.log(`  ⚠️ 慢响应 (>5s): ${slowResponses.length} 次`);
        for (const s of slowResponses) {
            console.log(`     - ${s.requestedName}: ${s.ttfb}ms`);
        }
    }

    if (failCount > 0) {
        console.log(`  ❌ 不可用模型:`);
        for (const f of results.filter(r => !r.success)) {
            console.log(`     - ${f.requestedName}: ${f.error?.slice(0, 50)}`);
        }
    }

    console.log('');
    console.log('═'.repeat(70));
}

runTests();
