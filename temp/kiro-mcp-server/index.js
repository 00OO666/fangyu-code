#!/usr/bin/env node
/**
 * Kiro MCP Server
 * 
 * 将 Kiro CLI 封装为 MCP Server，供 Claude Code 调用
 * 
 * 功能：
 * - kiro_chat: 使用 Kiro CLI 进行 AI 对话
 * - kiro_models: 列出可用模型
 * 
 * 使用方法：
 * 1. 先在 WSL 中安装 Kiro CLI
 * 2. npm install
 * 3. 在 Claude Code 中配置此 MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import { platform } from 'os';

// 可用模型列表
const KIRO_MODELS = [
    { id: 'auto', name: 'Auto', description: '自动选择最优模型', multiplier: '1x' },
    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: '最强模型，复杂推理', multiplier: '2.2x' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: '平衡模型，日常编程', multiplier: '1.3x' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', description: '混合推理', multiplier: '1.3x' },
    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', description: '最快最便宜', multiplier: '0.4x' },
];

/**
 * 执行 Kiro CLI 命令
 */
function executeKiroCli(args, timeout = 120000) {
    return new Promise((resolve, reject) => {
        let cmd, cmdArgs;

        // Windows 需要通过 WSL 调用
        if (platform() === 'win32') {
            cmd = 'wsl';
            cmdArgs = ['-e', 'kiro-cli', ...args];
        } else {
            cmd = 'kiro-cli';
            cmdArgs = args;
        }

        const proc = spawn(cmd, cmdArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error(`Kiro CLI 执行超时 (${timeout}ms)`));
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `Kiro CLI 退出码: ${code}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`无法启动 Kiro CLI: ${err.message}`));
        });
    });
}

/**
 * 检查 Kiro CLI 是否可用
 */
async function checkKiroCliAvailable() {
    try {
        await executeKiroCli(['--version'], 10000);
        return true;
    } catch {
        return false;
    }
}

// 创建 MCP Server
const server = new Server(
    {
        name: 'kiro-mcp-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// 列出可用工具
server.setRequestHandler('tools/list', async () => {
    return {
        tools: [
            {
                name: 'kiro_chat',
                description: '使用 Kiro CLI 进行 AI 对话。支持 Claude Opus 4.5、Sonnet 4.5、Haiku 4.5 等模型。免费额度，零封号风险。',
                inputSchema: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: '要发送给 Kiro 的消息',
                        },
                        model: {
                            type: 'string',
                            description: '模型选择: auto(默认), claude-opus-4.5(最强), claude-sonnet-4.5, claude-sonnet-4, claude-haiku-4.5(最快)',
                            enum: KIRO_MODELS.map(m => m.id),
                            default: 'auto',
                        },
                        workdir: {
                            type: 'string',
                            description: '工作目录（可选，用于代码相关任务）',
                        },
                    },
                    required: ['message'],
                },
            },
            {
                name: 'kiro_models',
                description: '列出 Kiro 支持的所有模型及其特点',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'kiro_status',
                description: '检查 Kiro CLI 的状态和登录情况',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ],
    };
});

// 处理工具调用
server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case 'kiro_chat': {
                const { message, model = 'auto', workdir } = args;

                // 检查 Kiro CLI 是否可用
                const available = await checkKiroCliAvailable();
                if (!available) {
                    return {
                        content: [{
                            type: 'text',
                            text: '❌ Kiro CLI 未安装或不可用。\n\n请先在 WSL 中安装 Kiro CLI:\n```bash\ncurl -fsSL https://cli.kiro.dev/install | bash\nkiro-cli login\n```',
                        }],
                        isError: true,
                    };
                }

                // 构建命令参数
                // 注意：kiro-cli chat 是交互式的，我们需要用非交互方式
                // 使用 --message 或 -m 参数（如果支持）
                const cliArgs = ['chat'];

                if (model && model !== 'auto') {
                    cliArgs.push('--model', model);
                }

                // Kiro CLI 可能需要通过 stdin 传递消息
                // 或者使用 --prompt 参数
                cliArgs.push('--prompt', message);

                if (workdir) {
                    cliArgs.push('--cwd', workdir);
                }

                // 执行 Kiro CLI
                const output = await executeKiroCli(cliArgs, 180000); // 3分钟超时

                return {
                    content: [{
                        type: 'text',
                        text: `🤖 Kiro (${model}) 回复:\n\n${output}`,
                    }],
                };
            }

            case 'kiro_models': {
                const modelList = KIRO_MODELS.map(m =>
                    `- **${m.id}** (${m.name}): ${m.description} [${m.multiplier}]`
                ).join('\n');

                return {
                    content: [{
                        type: 'text',
                        text: `📋 Kiro 可用模型:\n\n${modelList}\n\n💡 提示: 倍率表示相对于基础模型的积分消耗`,
                    }],
                };
            }

            case 'kiro_status': {
                try {
                    const version = await executeKiroCli(['--version'], 10000);
                    const doctor = await executeKiroCli(['doctor'], 30000);

                    return {
                        content: [{
                            type: 'text',
                            text: `✅ Kiro CLI 状态:\n\n版本: ${version.trim()}\n\n诊断结果:\n${doctor}`,
                        }],
                    };
                } catch (err) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Kiro CLI 状态检查失败:\n\n${err.message}\n\n请确保已安装并登录 Kiro CLI。`,
                        }],
                        isError: true,
                    };
                }
            }

            default:
                return {
                    content: [{
                        type: 'text',
                        text: `未知工具: ${name}`,
                    }],
                    isError: true,
                };
        }
    } catch (err) {
        return {
            content: [{
                type: 'text',
                text: `❌ 执行失败: ${err.message}`,
            }],
            isError: true,
        };
    }
});

// 启动服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Kiro MCP Server 已启动');
}

main().catch(console.error);
