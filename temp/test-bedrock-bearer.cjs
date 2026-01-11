/**
 * 测试：直接用 Bearer Token 调用 Bedrock API
 * 绕过 AWS SDK 的凭证验证
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Token 文件路径
const TOKEN_PATH = path.join(process.env.USERPROFILE, '.aws', 'sso', 'cache', 'kiro-auth-token.json');

// 读取 Token
function getToken() {
    const content = fs.readFileSync(TOKEN_PATH, 'utf8');
    return JSON.parse(content);
}

// 发送 Bedrock Converse 请求
async function testBedrockConverse() {
    const token = getToken();
    console.log('Token loaded:', {
        accessToken: token.accessToken.substring(0, 20) + '...',
        region: token.region,
        expiresAt: token.expiresAt,
    });

    const region = token.region || 'us-east-1';
    const modelId = 'anthropic.claude-3-haiku-20240307-v1:0';

    // Bedrock Converse API 端点
    const hostname = `bedrock-runtime.${region}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(modelId)}/converse`;

    const requestBody = JSON.stringify({
        messages: [
            {
                role: 'user',
                content: [{ text: 'Hello! Just say "Hi" back.' }]
            }
        ],
        inferenceConfig: {
            maxTokens: 100,
            temperature: 0.7,
        }
    });

    console.log('\n--- Request ---');
    console.log('URL:', `https://${hostname}${path}`);
    console.log('Method: POST');
    console.log('Authorization: Bearer', token.accessToken.substring(0, 20) + '...');

    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            port: 443,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.accessToken}`,
                'Content-Length': Buffer.byteLength(requestBody),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';

            console.log('\n--- Response ---');
            console.log('Status:', res.statusCode, res.statusMessage);
            console.log('Headers:', JSON.stringify(res.headers, null, 2));

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log('\nBody:', data);

                if (res.statusCode === 200) {
                    console.log('\n✅ SUCCESS! Bearer Token 认证有效！');
                    try {
                        const parsed = JSON.parse(data);
                        console.log('Response content:', JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        // 可能不是 JSON
                    }
                } else {
                    console.log('\n❌ FAILED! Status:', res.statusCode);
                }

                resolve({ statusCode: res.statusCode, data });
            });
        });

        req.on('error', (error) => {
            console.error('\n❌ Request Error:', error.message);
            reject(error);
        });

        req.write(requestBody);
        req.end();
    });
}

// 运行测试
testBedrockConverse()
    .then(result => {
        console.log('\n--- Test Complete ---');
        process.exit(result.statusCode === 200 ? 0 : 1);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
