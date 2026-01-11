/**
 * 获取 Kiro 可用模型列表
 * 调用 ListAvailableModels API
 */

const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const KIRO_VERSION = '0.8.86';
const SDK_VERSION = '3.682.0';
const MACHINE_ID = '9d5916fe11ee3d18f6c028e79bf634b790989aab16879e638d35690fcfb0bc64';

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

async function main() {
    console.log('=== 获取 Kiro 可用模型列表 ===\n');

    const accessToken = readToken();
    const invocationId = generateUUID();
    const platform = os.platform();
    const release = os.release();
    const nodeVersion = process.versions.node;

    const userAgent = `aws-sdk-js/${SDK_VERSION} ua/2.1 os/${platform}/${release} lang/js md/nodejs/${nodeVersion} api/codewhispererruntime/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;
    const xAmzUserAgent = `aws-sdk-js/${SDK_VERSION} KiroIDE ${KIRO_VERSION} ${MACHINE_ID}`;

    // ListAvailableModels 请求体
    const body = JSON.stringify({
        origin: 'AI_EDITOR'
    });

    // 使用正确的端点 q.us-east-1.amazonaws.com
    const request = net.request({
        method: 'POST',
        url: 'https://q.us-east-1.amazonaws.com/',
    });

    // 使用 X-Amz-Target 格式（与 GenerateAssistantResponse 一致）
    request.setHeader('Content-Type', 'application/x-amz-json-1.0');
    request.setHeader('X-Amz-Target', 'AmazonCodeWhispererService.ListAvailableModels');
    request.setHeader('Authorization', `Bearer ${accessToken}`);
    request.setHeader('User-Agent', userAgent);
    request.setHeader('x-amz-user-agent', xAmzUserAgent);
    request.setHeader('amz-sdk-invocation-id', invocationId);
    request.setHeader('amz-sdk-request', 'attempt=1; max=4');
    request.setHeader('x-amzn-codewhisperer-optout', 'true');

    console.log('发送请求到 ListAvailableModels API...\n');

    request.on('response', (response) => {
        console.log('状态码:', response.statusCode);
        console.log('');

        let data = '';
        response.on('data', chunk => data += chunk.toString());
        response.on('end', () => {
            try {
                const result = JSON.parse(data);
                console.log('=== 可用模型列表 ===\n');

                if (result.models) {
                    result.models.forEach((model, i) => {
                        console.log(`${i + 1}. ${model.modelName || model.modelId}`);
                        console.log(`   ID: ${model.modelId}`);
                        console.log(`   描述: ${model.description || '无'}`);
                        console.log(`   倍率: ${model.rateMultiplier || 1}x`);
                        console.log('');
                    });
                }

                if (result.defaultModel) {
                    console.log('=== 默认模型 ===');
                    console.log(`名称: ${result.defaultModel.modelName || result.defaultModel.modelId}`);
                    console.log(`ID: ${result.defaultModel.modelId}`);
                }

                // 保存完整响应
                fs.writeFileSync('temp/kiro-models-response.json', JSON.stringify(result, null, 2));
                console.log('\n完整响应已保存到 temp/kiro-models-response.json');
            } catch (e) {
                console.log('响应:', data);
            }
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

app.whenReady().then(main);
app.disableHardwareAcceleration();
