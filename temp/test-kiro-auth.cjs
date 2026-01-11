/**
 * 测试：调用 Kiro 认证服务获取 AWS 凭证
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Token 文件路径
const TOKEN_PATH = path.join(process.env.USERPROFILE, '.aws', 'sso', 'cache', 'kiro-auth-token.json');

// 读取 Token
function getToken() {
    const content = fs.readFileSync(TOKEN_PATH, 'utf8');
    return JSON.parse(content);
}

// 测试 Kiro 认证服务
async function testKiroAuth() {
    const token = getToken();
    console.log('Token loaded:', {
        accessToken: token.accessToken.substring(0, 30) + '...',
        region: token.region,
        expiresAt: token.expiresAt,
    });

    // 尝试调用 Kiro 认证服务
    const authHost = 'prod.us-east-1.auth.desktop.kiro.dev';

    console.log('\n--- Testing Kiro Auth Service ---');
    console.log('Host:', authHost);

    // 尝试几个可能的端点
    const endpoints = [
        '/credentials',
        '/api/credentials',
        '/v1/credentials',
        '/federation/credentials',
        '/token',
        '/api/token',
    ];

    for (const endpoint of endpoints) {
        console.log(`\nTrying: ${endpoint}`);

        try {
            const result = await makeRequest(authHost, endpoint, token.accessToken);
            console.log('Status:', result.statusCode);
            if (result.statusCode === 200) {
                console.log('SUCCESS! Response:', result.data.substring(0, 200));
                return;
            } else {
                console.log('Response:', result.data.substring(0, 100));
            }
        } catch (error) {
            console.log('Error:', error.message);
        }
    }
}

function makeRequest(hostname, path, accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname,
            port: 443,
            path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data });
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

testKiroAuth().catch(console.error);
