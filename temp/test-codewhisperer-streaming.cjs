/**
 * 测试 CodeWhisperer Streaming API
 * 端点: amazoncodewhispererstreaming service.us-east-1.amazonaws.com
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

// 正确的端点
const endpoint = 'amazoncodewhispererstreaming' + 'service.us-east-1.amazonaws.com';

// 构造请求体 - 模仿 Kiro 的格式
const requestBody = JSON.stringify({
    conversationState: {
        currentMessage: {
            userInputMessage: {
                content: 'Hello, respond in Chinese please'
            }
        },
        chatTriggerType: 'MANUAL'
    }
});

const options = {
    hostname: endpoint,
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'Authorization': `Bearer ${accessToken}`,
        'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
        'User-Agent': 'KiroIDE 1.0.0 test',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

console.log('\n发送请求到:', `https://${endpoint}`);
console.log('X-Amz-Target:', options.headers['X-Amz-Target']);

const req = https.request(options, (res) => {
    console.log('\n响应状态:', res.statusCode);
    console.log('响应头:', JSON.stringify(res.headers, null, 2));

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
        // 流式输出
        process.stdout.write(chunk.toString());
    });

    res.on('end', () => {
        console.log('\n\n--- 响应结束 ---');
        if (data.length < 500) {
            try {
                const json = JSON.parse(data);
                console.log('解析后:', JSON.stringify(json, null, 2));
            } catch (e) {
                // 可能是流式响应
            }
        }
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
});

req.write(requestBody);
req.end();
