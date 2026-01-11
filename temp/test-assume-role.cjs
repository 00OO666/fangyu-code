/**
 * 测试：使用 AssumeRoleWithWebIdentity 将 SSO Token 转换为 AWS 凭证
 */

const { STSClient, AssumeRoleWithWebIdentityCommand } = require('@aws-sdk/client-sts');
const fs = require('fs');
const path = require('path');

// Token 文件路径
const TOKEN_PATH = path.join(process.env.USERPROFILE, '.aws', 'sso', 'cache', 'kiro-auth-token.json');

// 读取 Token
function getToken() {
    const content = fs.readFileSync(TOKEN_PATH, 'utf8');
    return JSON.parse(content);
}

async function testAssumeRole() {
    const token = getToken();
    console.log('Token loaded:', {
        accessToken: token.accessToken.substring(0, 30) + '...',
        region: token.region,
        expiresAt: token.expiresAt,
    });

    const region = token.region || 'us-east-1';

    // 创建 STS 客户端（不需要凭证，因为我们要用 WebIdentity）
    const stsClient = new STSClient({
        region,
    });

    // 尝试 AssumeRoleWithWebIdentity
    // 注意：这需要一个 Role ARN，但 Kiro 可能使用的是 AWS 内部的角色
    // 我们先尝试看看错误信息

    console.log('\n--- Testing AssumeRoleWithWebIdentity ---');

    try {
        const command = new AssumeRoleWithWebIdentityCommand({
            RoleArn: 'arn:aws:iam::123456789012:role/KiroRole', // 占位符
            RoleSessionName: 'kiro-proxy-test',
            WebIdentityToken: token.accessToken,
            DurationSeconds: 3600,
        });

        const response = await stsClient.send(command);
        console.log('SUCCESS! Credentials:', {
            accessKeyId: response.Credentials?.AccessKeyId,
            expiration: response.Credentials?.Expiration,
        });
    } catch (error) {
        console.log('Error:', error.name, '-', error.message);

        // 分析错误
        if (error.name === 'InvalidIdentityToken') {
            console.log('\n分析: Token 格式不被 STS 接受');
            console.log('Kiro 可能使用了不同的认证机制');
        } else if (error.name === 'AccessDenied') {
            console.log('\n分析: 角色 ARN 不正确或没有权限');
        }
    }
}

testAssumeRole().catch(console.error);
