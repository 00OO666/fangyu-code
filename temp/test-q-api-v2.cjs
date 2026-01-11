/**
 * 测试 Q Developer API - 使用 AWS JSON-RPC 格式
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 读取 Kiro token
const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
const accessToken = tokenData.accessToken;

console.log('Token 前缀:', accessToken.substring(0, 10) + '...');

// 尝试不同的端点
const endpoints = [
    'q.us-east-1.amazonaws.com',
    'codewhisperer.us-east-1.amazonaws.com',
];

// 尝试不同的 Target
const targets = [
    'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
    'AmazonCodeWhispererService.GenerateAssistantResponse',
    'AmazonQ.GenerateAssistantResponse',
    'AmazonQDeveloper.GenerateAssistantResponse',
];

const requestBody = JSON.stringify({
    conversationState: {
        currentMessage: {
            userInputMessage: {
                content: 'Hello'
            }
        },
        chatTriggerType: 'MANUAL'
    }
});

async function testEndpoint(endpoint, target) {
    return new Promise((resolve) => {
        const options = {
            hostname: endpoint,
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-amz-json-1.0',
                'Authorization': `Bearer ${accessToken}`,
                'X-Amz-Target': target,
                'User-Agent': 'KiroIDE/1.0.0',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`\n[${endpoint}] + [${target}]`);
                console.log(`  状态: ${res.statusCode}`);
                if (data.length < 300) {
                    console.log(`  响应: ${data}`);
                } else {
                    console.log(`  响应: ${data.substring(0, 200)}...`);
                }
                resolve({ endpoint, target, status: res.statusCode, data });
            });
        });

        req.on('error', (e) => {
            console.log(`\n[${endpoint}] + [${target}]`);
            console.log(`  错误: ${e.message}`);
            resolve({ endpoint, target, error: e.message });
        });

        req.write(requestBody);
        req.end();
    });
}

async function main() {
    console.log('测试多个端点和 Target 组合...\n');

    for (const endpoint of endpoints) {
        for (const target of targets) {
            await testEndpoint(endpoint, target);
        }
    }
}

main();
