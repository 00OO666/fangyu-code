/**
 * Kiro API Electron 测试脚本
 * 在 Electron 环境中运行，TLS 指纹与 Kiro 一致
 * 
 * 使用方法:
 * 1. npm install electron
 * 2. npx electron temp/test-kiro-api-electron.cjs "你的问题"
 * 
 * 或者创建 package.json 后运行:
 * electron . "你的问题"
 */

const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============ 配置 ============
const KIRO_VERSION = '0.8.86';
const SDK_VERSION = '3.682.0';
const MACHINE_ID = '9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64';

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

// ============ 主函数 ============
async function main() {
    const question = process.argv[2] || '你好，请用一句话介绍你自己';

    console.log('=== Kiro API Electron 测试 ===');
    console.log('Electron 版本:', process.versions.electron);
    console.log('Chrome 版本:', process.versions.chrome);
    console.log('Kiro 版本:', KIRO_VERSION);
    console.log('问题:', question);
    console.log('');

    const accessToken = readToken();
    const invocationId = generateUUID();
    const platform = os.platform();
    const release = os.release();
    const nodeVersion = process.versions.node;

    // 完整的 User-Agent
    const userAgent = `aws-sdk-js/${SDK_VERSION} ua/2.1 os/${platform}/${release} lang/js md/nodejs/${nodeVersion} api/codewhispererstreaming/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;
    const xAmzUserAgent = `aws-sdk-js/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;

    // 可选的 modelId 值（从 Anthropic 官方文档 2026-01-11）:
    // Claude 4.5 系列（最新）:
    // - claude-opus-4-5-20251101 (Claude Opus 4.5) - 最强模型
    // - claude-sonnet-4-5-20250929 (Claude Sonnet 4.5) - 平衡模型
    // - claude-haiku-4-5-20251001 (Claude Haiku 4.5) - 最快模型
    // 
    // Claude 4 系列:
    // - claude-sonnet-4-20250514 (Claude Sonnet 4)
    // - claude-opus-4-20250514 (Claude Opus 4)
    //
    // Claude 3.x 系列（旧版）:
    // - claude-3-5-sonnet-20240620 (Claude 3.5 Sonnet)
    // - claude-3-opus-20240229 (Claude 3 Opus)
    // - claude-3-haiku-20240307 (Claude 3 Haiku)
    //
    // AWS Bedrock 格式:
    // - anthropic.claude-opus-4-5-20251101-v1:0
    // - anthropic.claude-sonnet-4-5-20250929-v1:0
    // - anthropic.claude-haiku-4-5-20251001-v1:0
    //
    // Kiro 内部格式（从代码中提取）:
    // - CLAUDE_SONNET_4_20250514_V1_0 (默认模型)
    //
    // 模型别名（自动指向最新版本）:
    // - claude-opus-4-5
    // - claude-sonnet-4-5
    // - claude-haiku-4-5
    const modelId = process.argv[3] || null; // 第三个参数指定模型

    // 根据 Kiro 代码分析，modelId 应该放在 userInputMessage.modelId 中
    // 参考: convertToGenerateAssistantMessages 函数
    const userInputMessage = {
        content: question,
        origin: 'AI_EDITOR',
        userInputMessageContext: {
            editorState: {}
        }
    };

    // 关键！modelId 放在 userInputMessage 中（从 Kiro 代码分析得出）
    if (modelId) {
        userInputMessage.modelId = modelId;
        console.log('使用模型:', modelId);
        console.log('(modelId 放在 userInputMessage.modelId 中)');
    } else {
        console.log('使用模型: 默认 (服务端决定)');
    }
    console.log('');

    // 构建请求体
    const conversationState = {
        currentMessage: {
            userInputMessage: userInputMessage
        },
        chatTriggerType: 'MANUAL'
    };

    const body = JSON.stringify({ conversationState });

    // 使用 Electron 的 net 模块发送请求（TLS 指纹与 Chrome 一致）
    const request = net.request({
        method: 'POST',
        url: 'https://q.us-east-1.amazonaws.com/',
    });

    // 设置请求头
    request.setHeader('Content-Type', 'application/x-amz-json-1.0');
    request.setHeader('X-Amz-Target', 'AmazonCodeWhispererStreamingService.GenerateAssistantResponse');
    request.setHeader('Authorization', `Bearer ${accessToken}`);
    request.setHeader('User-Agent', userAgent);
    request.setHeader('x-amz-user-agent', xAmzUserAgent);
    request.setHeader('amz-sdk-invocation-id', invocationId);
    request.setHeader('amz-sdk-request', 'attempt=1; max=4');
    request.setHeader('x-amzn-codewhisperer-optout', 'true');
    request.setHeader('x-amzn-kiro-agent-mode', 'true');

    console.log('请求头已设置，发送请求...');
    console.log('');

    request.on('response', (response) => {
        console.log('状态码:', response.statusCode);
        console.log('x-amzn-requestid:', response.headers['x-amzn-requestid']);
        console.log('conversation-id:', response.headers['x-amzn-codewhisperer-conversation-id']);
        console.log('');

        if (response.statusCode !== 200) {
            let errorData = '';
            response.on('data', chunk => errorData += chunk.toString());
            response.on('end', () => {
                console.log('错误响应:', errorData);
                app.quit();
            });
            return;
        }

        console.log('--- 响应内容 ---');

        response.on('data', (chunk) => {
            const str = chunk.toString('utf-8');
            const jsonMatches = str.match(/\{[^{}]*\}/g);
            if (jsonMatches) {
                jsonMatches.forEach(json => {
                    try {
                        const obj = JSON.parse(json);
                        if (obj.content) {
                            process.stdout.write(obj.content);
                        }
                    } catch (e) { }
                });
            }
        });

        response.on('end', () => {
            console.log('\n--- 响应结束 ---');
            app.quit();
        });
    });

    request.on('error', (error) => {
        console.error('请求错误:', error.message);
        app.quit();
    });

    request.write(body);
    request.end();
}

// Electron 应用就绪后运行
app.whenReady().then(main);

// 禁用硬件加速（减少资源占用）
app.disableHardwareAcceleration();
