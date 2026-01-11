/**
 * Kiro API 安全测试脚本
 * 完全模拟官方 Kiro 客户端的请求头
 * 
 * 使用前请确保账号已恢复！
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============ 配置 ============
const KIRO_VERSION = '0.8.86';
const SDK_VERSION = '3.682.0';
const MACHINE_ID = '9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64'; // 你的 machineId

// ============ 工具函数 ============
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function readToken() {
    const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    return tokenData.accessToken;
}

// ============ 构建完整请求头 ============
function buildHeaders(accessToken) {
    const invocationId = generateUUID();
    const platform = os.platform();
    const release = os.release();
    const nodeVersion = process.versions.node;

    // 完整的 User-Agent（模拟 AWS SDK）
    const userAgent = `aws-sdk-js/${SDK_VERSION} ua/2.1 os/${platform}/${release} lang/js md/nodejs/${nodeVersion} api/codewhispererstreaming/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;

    // x-amz-user-agent（AWS 专用）
    const xAmzUserAgent = `aws-sdk-js/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;

    return {
        // 基础头
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse',
        'Authorization': `Bearer ${accessToken}`,

        // AWS SDK 标准头
        'User-Agent': userAgent,
        'x-amz-user-agent': xAmzUserAgent,
        'amz-sdk-invocation-id': invocationId,
        'amz-sdk-request': 'attempt=1; max=4',

        // Kiro 特有头
        'x-amzn-codewhisperer-optout': 'true',
        'x-amzn-kiro-agent-mode': 'true',
    };
}

// ============ 构建请求体 ============
function buildBody(question, conversationId = null, history = []) {
    const body = {
        conversationState: {
            currentMessage: {
                userInputMessage: {
                    content: question
                }
            },
            chatTriggerType: 'MANUAL'
        }
    };

    // 多轮对话支持
    if (conversationId) {
        body.conversationState.conversationId = conversationId;
    }
    if (history.length > 0) {
        body.conversationState.history = history;
    }

    return JSON.stringify(body);
}

// ============ 发送请求 ============
async function sendRequest(question) {
    return new Promise((resolve, reject) => {
        const accessToken = readToken();
        const headers = buildHeaders(accessToken);
        const body = buildBody(question);

        console.log('=== Kiro API 安全测试 ===');
        console.log('Kiro 版本:', KIRO_VERSION);
        console.log('SDK 版本:', SDK_VERSION);
        console.log('Machine ID:', MACHINE_ID.substring(0, 16) + '...');
        console.log('问题:', question);
        console.log('');
        console.log('请求头:');
        Object.entries(headers).forEach(([key, value]) => {
            if (key === 'Authorization') {
                console.log(`  ${key}: Bearer ${value.substring(7, 20)}...`);
            } else if (key === 'User-Agent') {
                console.log(`  ${key}: ${value.substring(0, 60)}...`);
            } else {
                console.log(`  ${key}: ${value}`);
            }
        });
        console.log('');

        const options = {
            hostname: 'q.us-east-1.amazonaws.com',
            port: 443,
            path: '/',
            method: 'POST',
            headers: headers
        };

        const req = https.request(options, (res) => {
            console.log('状态码:', res.statusCode);
            console.log('x-amzn-requestid:', res.headers['x-amzn-requestid']);
            console.log('conversation-id:', res.headers['x-amzn-codewhisperer-conversation-id']);
            console.log('');

            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', chunk => errorData += chunk);
                res.on('end', () => {
                    console.log('错误响应:', errorData);
                    reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                });
                return;
            }

            console.log('--- 响应内容 ---');
            let fullResponse = '';

            res.on('data', (chunk) => {
                const str = chunk.toString('utf-8');
                // 解析 AWS Event Stream 格式
                const jsonMatches = str.match(/\{[^{}]*\}/g);
                if (jsonMatches) {
                    jsonMatches.forEach(json => {
                        try {
                            const obj = JSON.parse(json);
                            if (obj.content) {
                                process.stdout.write(obj.content);
                                fullResponse += obj.content;
                            }
                            if (obj.conversationId) {
                                console.log('[会话ID]', obj.conversationId);
                            }
                        } catch (e) { }
                    });
                }
            });

            res.on('end', () => {
                console.log('\n--- 响应结束 ---');
                resolve(fullResponse);
            });
        });

        req.on('error', (e) => {
            console.error('请求错误:', e.message);
            reject(e);
        });

        req.write(body);
        req.end();
    });
}

// ============ 主函数 ============
async function main() {
    const question = process.argv[2] || '你好，请用一句话介绍你自己';

    try {
        await sendRequest(question);
    } catch (error) {
        console.error('测试失败:', error.message);
        process.exit(1);
    }
}

main();
