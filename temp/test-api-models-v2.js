/**
 * 测试代理商支持的所有可能的模型 ID 格式
 */
import https from 'https';
import fs from 'fs';
import path from 'path';

const settingsPath = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const apiKey = settings.env?.ANTHROPIC_API_KEY;
const apiBase = settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

console.log('测试代理商支持的模型格式...\n');
console.log(`API Base: ${apiBase}\n`);

// 测试各种可能的模型 ID 格式
const modelsToTest = [
    // 你配置的格式
    'claude-opus-4-5-20251101',
    // 可能的其他格式
    'claude-4-opus',
    'claude-4.5-opus',
    'claude-opus-4.5',
    'claude-opus',
    // Sonnet 格式
    'claude-sonnet-4-5-20250929',
    'claude-4-sonnet',
    'claude-4.5-sonnet',
    'claude-sonnet-4.5',
    'claude-sonnet',
    // Haiku 格式
    'claude-haiku-4-5-20251001',
    'claude-4-haiku',
    'claude-4.5-haiku',
    'claude-haiku-4.5',
    'claude-haiku',
    // 旧版格式
    'claude-3-5-sonnet-20241022',
    'claude-3.5-sonnet',
    'claude-3-opus-20240229',
    'claude-3-opus',
];

async function testModel(model) {
    return new Promise((resolve) => {
        const requestBody = JSON.stringify({
            model: model,
            max_tokens: 20,
            messages: [{ role: 'user', content: 'hi' }]
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
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                const time = Date.now() - startTime;
                try {
                    const response = JSON.parse(responseData);
                    if (response.content) {
                        const actual = response.model;
                        const match = model === actual ? '✅' : '⚠️';
                        console.log(`${match} ${model.padEnd(30)} → ${actual} (${time}ms)`);
                    } else {
                        console.log(`❌ ${model.padEnd(30)} → ${response.error?.message?.slice(0, 40) || 'Unknown error'}`);
                    }
                } catch (e) {
                    console.log(`❌ ${model.padEnd(30)} → Parse error`);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.log(`❌ ${model.padEnd(30)} → ${e.message}`);
            resolve();
        });

        req.write(requestBody);
        req.end();
    });
}

async function run() {
    for (const model of modelsToTest) {
        await testModel(model);
        await new Promise(r => setTimeout(r, 500));
    }
    console.log('\n测试完成！');
}

run();
