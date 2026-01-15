/**
 * Claude API 代理测试工具
 * 
 * 功能：
 * - 测试代理商支持的模型
 * - 检测模型替换行为
 * - 测量响应延迟
 * 
 * 使用方式：
 * 1. 自动读取 ~/.claude/settings.json 配置
 * 2. 命令行参数: node test.js --api-key "sk-xxx" --base-url "https://proxy.com"
 * 3. 环境变量: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--api-key' && args[i + 1]) {
            result.apiKey = args[++i];
        } else if (args[i] === '--base-url' && args[i + 1]) {
            result.baseUrl = args[++i];
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Claude API 代理测试工具

用法:
  node test.js [选项]

选项:
  --api-key <key>     API 密钥
  --base-url <url>    API 基础 URL
  --help, -h          显示帮助

配置优先级:
  1. 命令行参数
  2. 环境变量 (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL)
  3. ~/.claude/settings.json
`);
            process.exit(0);
        }
    }
    return result;
}

// 获取配置
function getConfig() {
    const args = parseArgs();

    // 优先使用命令行参数
    let apiKey = args.apiKey;
    let apiBase = args.baseUrl;

    // 其次使用环境变量
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiBase) apiBase = process.env.ANTHROPIC_BASE_URL;

    // 最后尝试读取配置文件
    if (!apiKey || !apiBase) {
        const settingsPath = path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.claude',
            'settings.json'
        );

        try {
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (!apiKey) apiKey = settings.env?.ANTHROPIC_API_KEY;
                if (!apiBase) apiBase = settings.env?.ANTHROPIC_BASE_URL;
            }
        } catch (e) {
            // 忽略读取错误
        }
    }

    // 默认使用官方 API
    if (!apiBase) apiBase = 'https://api.anthropic.com';

    if (!apiKey) {
        console.error('❌ 错误: 未找到 API 密钥');
        console.error('请通过以下方式之一提供:');
        console.error('  1. 命令行: node test.js --api-key "sk-xxx"');
        console.error('  2. 环境变量: export ANTHROPIC_API_KEY="sk-xxx"');
        console.error('  3. 配置文件: ~/.claude/settings.json');
        process.exit(1);
    }

    return { apiKey, apiBase };
}

const { apiKey, apiBase } = getConfig();

console.log('测试代理商支持的模型格式...\n');
console.log(`API Base: ${apiBase}\n`);

// 测试各种可能的模型 ID 格式
const modelsToTest = [
    // Claude 4.5 完整格式
    'claude-opus-4-5-20251101',
    // 简写格式
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
