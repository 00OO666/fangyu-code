/**
 * API 延迟测试脚本
 * 测试你的 Claude API 代理服务器响应时间
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

if (!apiKey) {
    console.error('未找到 ANTHROPIC_API_KEY');
    process.exit(1);
}

console.log('='.repeat(60));
console.log('API 延迟测试');
console.log('='.repeat(60));
console.log(`API Base: ${apiBase}`);
console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
console.log('');

// 测试请求
const testPrompt = '你好';
const requestBody = JSON.stringify({
    model: 'claude-opus-4-5-20251101',  // 改用 Opus 4.5 模型
    max_tokens: 100,
    messages: [{ role: 'user', content: testPrompt }]
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

console.log(`请求 URL: ${url.href}`);
console.log(`请求体大小: ${Buffer.byteLength(requestBody)} bytes`);
console.log('');

const startTime = Date.now();
let ttfb = 0; // Time to First Byte
let responseData = '';

const req = https.request(options, (res) => {
    ttfb = Date.now() - startTime;
    console.log(`[${ttfb}ms] 收到响应头 - 状态码: ${res.statusCode}`);

    res.on('data', (chunk) => {
        if (responseData.length === 0) {
            const firstChunkTime = Date.now() - startTime;
            console.log(`[${firstChunkTime}ms] 收到第一个数据块 (${chunk.length} bytes)`);
        }
        responseData += chunk;
    });

    res.on('end', () => {
        const totalTime = Date.now() - startTime;
        console.log('');
        console.log('='.repeat(60));
        console.log('测试结果');
        console.log('='.repeat(60));
        console.log(`TTFB (首字节时间): ${ttfb}ms`);
        console.log(`总响应时间: ${totalTime}ms`);
        console.log(`响应大小: ${responseData.length} bytes`);
        console.log('');

        try {
            const response = JSON.parse(responseData);
            if (response.error) {
                console.log('❌ API 错误:', response.error.message);
            } else if (response.content) {
                console.log('✅ API 响应成功');
                console.log(`模型: ${response.model}`);
                console.log(`回复: ${response.content[0]?.text || '(无内容)'}`);
                console.log(`输入 tokens: ${response.usage?.input_tokens}`);
                console.log(`输出 tokens: ${response.usage?.output_tokens}`);
            }
        } catch (e) {
            console.log('响应内容:', responseData.slice(0, 500));
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('延迟分析');
        console.log('='.repeat(60));
        if (ttfb < 1000) {
            console.log('✅ TTFB 正常 (<1s)');
        } else if (ttfb < 3000) {
            console.log('⚠️ TTFB 较慢 (1-3s) - 可能是网络延迟');
        } else {
            console.log('❌ TTFB 很慢 (>3s) - 检查代理服务器或网络');
        }

        if (totalTime < 3000) {
            console.log('✅ 总响应时间正常 (<3s)');
        } else if (totalTime < 8000) {
            console.log('⚠️ 总响应时间较慢 (3-8s)');
        } else {
            console.log('❌ 总响应时间很慢 (>8s) - 需要排查');
        }
    });
});

req.on('error', (e) => {
    const errorTime = Date.now() - startTime;
    console.log(`[${errorTime}ms] ❌ 请求错误: ${e.message}`);
});

req.write(requestBody);
req.end();

console.log(`[0ms] 请求已发送，等待响应...`);
