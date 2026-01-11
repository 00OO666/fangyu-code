/**
 * 测试 Kiro Token 刷新
 * 运行: node temp/test-token-refresh.cjs
 */

const { SSOOIDCClient, CreateTokenCommand } = require('@aws-sdk/client-sso-oidc');
const fs = require('fs');

const TOKEN_PATH = 'C:\\Users\\666\\.aws\\sso\\cache\\kiro-auth-token.json';

async function testRefresh() {
    console.log('=== Kiro Token 刷新测试 ===\n');

    // 读取 token
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

    console.log('当前 Token 状态:');
    console.log('- accessToken:', tokenData.accessToken?.substring(0, 30) + '...');
    console.log('- refreshToken:', tokenData.refreshToken ? '存在' : '缺失');
    console.log('- clientId:', tokenData.clientId ? '存在' : '缺失');
    console.log('- clientSecret:', tokenData.clientSecret ? '存在' : '缺失');
    console.log('- expiresAt:', tokenData.expiresAt);
    console.log('- region:', tokenData.region);

    const expiresAt = new Date(tokenData.expiresAt);
    const now = new Date();
    const diffMinutes = (expiresAt - now) / 60000;
    console.log('- 状态:', diffMinutes > 0 ? `有效，剩余 ${Math.round(diffMinutes)} 分钟` : `已过期 ${Math.abs(Math.round(diffMinutes))} 分钟`);

    if (!tokenData.refreshToken || !tokenData.clientId) {
        console.log('\n❌ 缺少刷新所需字段，无法刷新');
        return;
    }

    console.log('\n尝试刷新 Token...');

    try {
        const client = new SSOOIDCClient({ region: tokenData.region || 'us-east-1' });

        const command = new CreateTokenCommand({
            clientId: tokenData.clientId,
            clientSecret: tokenData.clientSecret || undefined,
            grantType: 'refresh_token',
            refreshToken: tokenData.refreshToken,
        });

        const response = await client.send(command);

        if (response.accessToken) {
            console.log('\n✅ Token 刷新成功!');
            console.log('- 新 accessToken:', response.accessToken.substring(0, 30) + '...');
            console.log('- expiresIn:', response.expiresIn, '秒');

            // 更新文件
            const newTokenData = {
                ...tokenData,
                accessToken: response.accessToken,
                refreshToken: response.refreshToken || tokenData.refreshToken,
                expiresAt: new Date(Date.now() + response.expiresIn * 1000).toISOString(),
            };

            fs.writeFileSync(TOKEN_PATH, JSON.stringify(newTokenData, null, 2));
            console.log('\n✅ Token 文件已更新:', TOKEN_PATH);
        } else {
            console.log('\n❌ 刷新响应中没有 accessToken');
        }
    } catch (error) {
        console.log('\n❌ 刷新失败:', error.message);
        console.log('\n可能的原因:');
        console.log('1. refreshToken 已过期（通常 30 天有效）');
        console.log('2. clientId/clientSecret 无效');
        console.log('3. 网络问题');
        console.log('\n解决方案: 重新打开 Kiro 并登录');
    }
}

testRefresh();
