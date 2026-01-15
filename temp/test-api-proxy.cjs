/**
 * API 代理测试脚本 - 修复版
 * 支持 HTTP 和 HTTPS，使用 CommonJS 语法
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 从 Claude Code 配置读取
const settingsPath = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'settings.json');
let apiKey, apiBase;

try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    apiKey = settings.env?.ANTHROPIC_API_KEY;
    apiBase = settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
} catch (e) {
    console.error('无法读取 Claude Code 配置:', e.message);
    process.exit(1);
}

// 也可以手动指定要测试的代理
const proxiesToTest = [
    { name: 'kkl88', url: 'http://kkl88.xyz', key: 'sk-SsEDwrP6EhjLSlc7HiO9K8L27ZnyfhbY' },
    { name: 'hongmacode', url: 'https://hongmacode.com/api', key: 'sk-e8757xxxxxxxxxx16f1' }, // 需要填完整 key
    { name: 'vvvv.ee', url: 'https://hone.vvvv.ee', key: 'sk-BTyzUxxxxxxxxxa3VM' }, // 需要填完整 key
];

console.log('='.repeat(60));
console.log('API 代理测试脚本');
console.log('='.repeat(60));
console.log(`\n当前配置的 API Base: ${apiBase}`);
console.log(`API Key: ${apiKey?.slice(0, 10)}...${apiKey?.slice(-4)}\n`);

// 测试模型列表
const modelsToTest = [
    'claude-3-5-sonnet-20241022',  // 最常见的格式
    'claude-3.5-sonnet',           // 简化格式
    'claude-sonnet-4-5-20250929',  // 新版格式
    'claude-opus-4-5-20251101',    // Opus 格式
];

async function testEndpoint(baseUrl, key, model) {
    return new Promise((resolve) => {
        const requestBody = JSON.stringify({
            model: model,
            max_tokens: 20,
            messages: [{ role: 'user', content: 'Say "OK" only' }]
        });

        const url = new URL(`${baseUrl}/v1/messages`);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const startTime = Date.now();
        let responseData = '';

        const req = client.request(options, (res) => {
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                const time = Date.now() - startTime;
                try {
                    const response = JSON.parse(responseData);
                    if (response.content) {
                        const text = response.content[0]?.text || '';
                        const actualModel = response.model;
                        resolve({
                            success: true,
                            model: actualModel,
                            text: text.slice(0, 50),
                            time
                        });
                    } else if (response.error) {
                        resolve({
                            success: false,
                            error: response.error.message || response.error.type,
                            time
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}: ${responseData.slice(0, 100)}`,
                            time
                        });
                    }
                } catch (e) {
                    resolve({
                        success: false,
                        error: `Parse error: ${responseData.slice(0, 100)}`,
                        time
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message, time: Date.now() - startTime });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, error: 'Timeout (30s)', time: 30000 });
        });

        req.write(requestBody);
        req.end();
    });
}

async function testProxy(name, baseUrl, key) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`测试代理: ${name}`);
    console.log(`URL: ${baseUrl}`);
    console.log(`${'─'.repeat(50)}`);

    for (const model of modelsToTest) {
        const result = await testEndpoint(baseUrl, key, model);
        if (result.success) {
            console.log(`✅ ${model.padEnd(30)} → ${result.model} (${result.time}ms)`);
            console.log(`   响应: "${result.text}"`);
        } else {
            console.log(`❌ ${model.padEnd(30)} → ${result.error}`);
        }
        // 避免请求过快
        await new Promise(r => setTimeout(r, 1000));
    }
}

async function run() {
    // 测试当前配置的代理
    console.log('\n📡 测试当前配置的代理...');
    await testProxy('当前配置', apiBase, apiKey);

    console.log('\n' + '='.repeat(60));
    console.log('测试完成！');
    console.log('='.repeat(60));
}

run().catch(console.error);
