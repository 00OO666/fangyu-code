/**
 * 测试 Q Developer API - 解析流式响应
 * 成功！使用 Bearer Token 直接调用
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 读取 Kiro token
const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
const accessToken = tokenData.accessToken;

console.log('=== Q Developer API 测试 ===');
console.log('Token 前缀:', accessToken.substring(0, 10) + '...');

const endpoint = 'q.us-east-1.amazonaws.com';
const target = 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse';

const requestBody = JSON.stringify({
    conversationState: {
        currentMessage: {
            userInputMessage: {
                content: '你好，请用中文简短回复：1+1等于几？'
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
        'X-Amz-Target': target,
        'User-Agent': 'KiroIDE/1.0.0',
        'Accept': 'application/vnd.amazon.eventstream',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

console.log('\n请求:', endpoint);
console.log('Target:', target);
console.log('问题: 1+1等于几？\n');

const req = https.request(options, (res) => {
    console.log('状态:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('\n--- 响应流 ---\n');

    let buffer = Buffer.alloc(0);

    res.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // 尝试提取 JSON 内容
        const str = chunk.toString('utf-8');

        // 查找 JSON 对象
        const jsonMatches = str.match(/\{[^{}]*\}/g);
        if (jsonMatches) {
            for (const match of jsonMatches) {
                try {
                    const json = JSON.parse(match);
                    if (json.assistantResponseEvent) {
                        const content = json.assistantResponseEvent.content;
                        if (content) {
                            process.stdout.write(content);
                        }
                    } else if (json.conversationId) {
                        console.log('[会话ID]', json.conversationId);
                    } else {
                        console.log('[事件]', JSON.stringify(json));
                    }
                } catch (e) {
                    // 不是有效 JSON
                }
            }
        }
    });

    res.on('end', () => {
        console.log('\n\n--- 响应结束 ---');
        console.log('总字节数:', buffer.length);

        // 保存原始响应用于分析
        fs.writeFileSync('temp/q-api-response.bin', buffer);
        console.log('原始响应已保存到 temp/q-api-response.bin');
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
});

req.write(requestBody);
req.end();
