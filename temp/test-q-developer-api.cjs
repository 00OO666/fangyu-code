/**
 * 测试直接调用 Amazon Q Developer API
 * 使用 Kiro 的 SSO Token 作为 Bearer Token
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
console.log('Token 过期时间:', tokenData.expiresAt);

// 构造请求
const endpoint = 'q.us-east-1.amazonaws.com';
const requestBody = JSON.stringify({
    conversationState: {
        currentMessage: {
            userInputMessage: {
                content: '你好，请用中文回复'
            }
        },
        chatTriggerType: 'MANUAL'
    }
});

const options = {
    hostname: endpoint,
    port: 443,
    path: '/GenerateAssistantResponse',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'KiroIDE 1.0.0',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

console.log('\n发送请求到:', `https://${endpoint}${options.path}`);
console.log('请求体:', requestBody.substring(0, 200) + '...');

const req = https.request(options, (res) => {
    console.log('\n响应状态:', res.statusCode);
    console.log('响应头:', JSON.stringify(res.headers, null, 2));

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n响应体:');
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log(data.substring(0, 1000));
        }
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
});

req.write(requestBody);
req.end();
