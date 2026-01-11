/**
 * /v1/messages 端点
 * Anthropic Messages API 兼容端点
 *
 * 认证方式（按优先级）：
 * 1. Kiro Token（从 ~/.aws/sso/cache/kiro-auth-token.json）
 * 2. AWS_BEARER_TOKEN_BEDROCK 环境变量（备选）
 */

import { Router, Request, Response } from 'express';
import {
    BedrockRuntimeClient,
    ConverseCommand,
    ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

import { transformRequest, validateRequest, AnthropicRequest } from '../transform/request';
import { transformResponse, BedrockResponse } from '../transform/response';
import { transformStream, formatSSE, BedrockStreamChunk } from '../transform/streaming';
import { logger } from '../utils/logger';
import { config } from '../config';
import { createAnthropicError, AnthropicErrorType } from '../utils/errors';
import { requestQueue } from '../utils/queue';
import { withRetry } from '../utils/retry';
import { statsTracker } from '../utils/stats';
import { getValidToken, KiroToken } from '../token/extractor';

export const messagesRouter = Router();

// Bedrock 客户端缓存
let cachedClient: BedrockRuntimeClient | null = null;
let cachedTokenHash: string | null = null;

// 环境变量名
const ENV_BEDROCK_API_KEY = 'AWS_BEARER_TOKEN_BEDROCK';

/**
 * 获取认证方式
 */
function getAuthMethod(): 'kiro-token' | 'api-key' | 'none' {
    // 优先使用 Kiro Token
    return 'kiro-token';
}

/**
 * 创建或复用 Bedrock 客户端
 */
async function getBedrockClient(): Promise<BedrockRuntimeClient> {
    // 优先尝试 Kiro Token
    try {
        const token = await getValidToken();
        const tokenHash = token.accessToken.substring(0, 20);
        const region = token.region || config.awsRegion || 'us-east-1';

        // 如果 token 没变，复用客户端
        if (cachedClient && cachedTokenHash === tokenHash) {
            return cachedClient;
        }

        logger.info('Creating Bedrock client with Kiro token', { region });

        cachedClient = new BedrockRuntimeClient({
            region,
            token: {
                token: token.accessToken,
            },
            requestHandler: {
                connectionTimeout: 10000,
                socketTimeout: 120000,
            } as any,
        });

        cachedTokenHash = tokenHash;
        logger.debug('Created new Bedrock client with Kiro token');

        return cachedClient;
    } catch (kiroError) {
        logger.warn('Kiro token not available, trying fallback', {
            error: kiroError instanceof Error ? kiroError.message : String(kiroError),
        });

        // 备选：使用环境变量
        const apiKey = process.env[ENV_BEDROCK_API_KEY];
        if (apiKey) {
            const region = process.env['AWS_REGION'] || config.awsRegion || 'us-east-1';

            logger.info('Using fallback API key', { region });

            cachedClient = new BedrockRuntimeClient({
                region,
                token: {
                    token: apiKey,
                },
                requestHandler: {
                    connectionTimeout: 10000,
                    socketTimeout: 120000,
                } as any,
            });

            cachedTokenHash = apiKey.substring(0, 20);
            return cachedClient;
        }

        throw new Error(
            'No authentication available. Please ensure Kiro is logged in, or set AWS_BEARER_TOKEN_BEDROCK environment variable.'
        );
    }
}

/**
 * 处理非流式请求（带重试）
 */
async function handleNonStreamingRequest(
    req: Request,
    res: Response,
    anthropicRequest: AnthropicRequest
): Promise<void> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
        const result = await requestQueue.add(async () => {
            return await withRetry(async () => {
                const client = await getBedrockClient();
                const bedrockRequest = transformRequest(anthropicRequest);

                logger.debug('Sending non-streaming request to Bedrock', {
                    modelId: bedrockRequest.modelId,
                    queuePending: requestQueue.pending,
                    queueRunning: requestQueue.running,
                });

                const command = new ConverseCommand({
                    modelId: bedrockRequest.modelId,
                    messages: bedrockRequest.messages as any,
                    system: bedrockRequest.system as any,
                    inferenceConfig: bedrockRequest.inferenceConfig,
                    toolConfig: bedrockRequest.toolConfig as any,
                });

                return await client.send(command);
            });
        });

        // 转换响应
        const bedrockResponse: BedrockResponse = {
            output: {
                message: {
                    role: 'assistant',
                    content: result.output?.message?.content?.map(c => ({
                        text: c.text,
                        toolUse: c.toolUse ? {
                            toolUseId: c.toolUse.toolUseId || '',
                            name: c.toolUse.name || '',
                            input: c.toolUse.input as Record<string, unknown> || {},
                        } : undefined,
                    })) || [],
                },
            },
            stopReason: (result.stopReason as any) || 'end_turn',
            usage: {
                inputTokens: result.usage?.inputTokens || 0,
                outputTokens: result.usage?.outputTokens || 0,
                totalTokens: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0),
            },
        };

        inputTokens = bedrockResponse.usage.inputTokens;
        outputTokens = bedrockResponse.usage.outputTokens;

        const anthropicResponse = transformResponse(bedrockResponse, anthropicRequest.model);

        // 记录统计
        statsTracker.recordRequest(true, inputTokens, outputTokens);

        logger.info('Request completed', {
            model: anthropicRequest.model,
            inputTokens,
            outputTokens,
            duration: `${Date.now() - startTime}ms`,
        });

        res.json(anthropicResponse);
    } catch (error) {
        statsTracker.recordRequest(false);
        throw error;
    }
}

/**
 * 处理流式请求（带重试）
 */
async function handleStreamingRequest(
    req: Request,
    res: Response,
    anthropicRequest: AnthropicRequest
): Promise<void> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
        await requestQueue.add(async () => {
            const client = await getBedrockClient();
            const bedrockRequest = transformRequest(anthropicRequest);

            logger.debug('Sending streaming request to Bedrock', {
                modelId: bedrockRequest.modelId,
                queuePending: requestQueue.pending,
                queueRunning: requestQueue.running,
            });

            const command = new ConverseStreamCommand({
                modelId: bedrockRequest.modelId,
                messages: bedrockRequest.messages as any,
                system: bedrockRequest.system as any,
                inferenceConfig: bedrockRequest.inferenceConfig,
                toolConfig: bedrockRequest.toolConfig as any,
            });

            const response = await client.send(command);

            // 设置 SSE 响应头
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            // 转换 Bedrock 流
            async function* bedrockStreamToChunks(): AsyncGenerator<BedrockStreamChunk> {
                if (!response.stream) return;

                for await (const event of response.stream) {
                    const chunk: BedrockStreamChunk = {};

                    if (event.messageStart) {
                        chunk.messageStart = { role: 'assistant' };
                    }

                    if (event.contentBlockStart) {
                        const start = event.contentBlockStart.start as any;
                        chunk.contentBlockStart = {
                            contentBlockIndex: event.contentBlockStart.contentBlockIndex || 0,
                            start: {
                                text: start?.text,
                                toolUse: start?.toolUse ? {
                                    toolUseId: start.toolUse.toolUseId || '',
                                    name: start.toolUse.name || '',
                                } : undefined,
                            },
                        };
                    }

                    if (event.contentBlockDelta) {
                        const delta = event.contentBlockDelta.delta as any;
                        chunk.contentBlockDelta = {
                            contentBlockIndex: event.contentBlockDelta.contentBlockIndex || 0,
                            delta: {
                                text: delta?.text,
                                toolUse: delta?.toolUse ? {
                                    input: delta.toolUse.input || '',
                                } : undefined,
                            },
                        };
                    }

                    if (event.contentBlockStop) {
                        chunk.contentBlockStop = {
                            contentBlockIndex: event.contentBlockStop.contentBlockIndex || 0,
                        };
                    }

                    if (event.messageStop) {
                        chunk.messageStop = {
                            stopReason: (event.messageStop.stopReason as any) || 'end_turn',
                        };
                    }

                    if (event.metadata) {
                        inputTokens = event.metadata.usage?.inputTokens || 0;
                        outputTokens = event.metadata.usage?.outputTokens || 0;
                        chunk.metadata = {
                            usage: {
                                inputTokens,
                                outputTokens,
                                totalTokens: inputTokens + outputTokens,
                            },
                        };
                    }

                    yield chunk;
                }
            }

            // 转换并发送 SSE 事件
            for await (const event of transformStream(
                bedrockStreamToChunks(),
                anthropicRequest.model,
                0
            )) {
                res.write(formatSSE(event));
            }

            res.end();

            // 记录统计
            statsTracker.recordRequest(true, inputTokens, outputTokens);

            logger.info('Streaming request completed', {
                model: anthropicRequest.model,
                inputTokens,
                outputTokens,
                duration: `${Date.now() - startTime}ms`,
            });
        });
    } catch (error) {
        statsTracker.recordRequest(false);
        throw error;
    }
}

/**
 * POST /v1/messages
 */
messagesRouter.post('/', async (req: Request, res: Response) => {
    try {
        const anthropicRequest = req.body as AnthropicRequest;

        // 验证请求
        const errors = validateRequest(anthropicRequest);
        if (errors.length > 0) {
            res.status(400).json(createAnthropicError('invalid_request_error', errors.join('; ')));
            return;
        }

        logger.info('Received messages request', {
            model: anthropicRequest.model,
            stream: anthropicRequest.stream,
            messageCount: anthropicRequest.messages.length,
            authMethod: getAuthMethod(),
            queueStatus: `${requestQueue.running}/${requestQueue.pending + requestQueue.running}`,
        });

        if (anthropicRequest.stream) {
            await handleStreamingRequest(req, res, anthropicRequest);
        } else {
            await handleNonStreamingRequest(req, res, anthropicRequest);
        }
    } catch (error) {
        logger.error('Messages request failed', {
            error: error instanceof Error ? error.message : String(error),
        });

        const errorName = (error as any)?.name || '';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let statusCode = 500;
        let errorType: AnthropicErrorType = 'api_error';

        if (errorName.includes('AccessDenied') || errorName.includes('Unauthorized') ||
            errorMessage.includes('Invalid API Key')) {
            statusCode = 401;
            errorType = 'authentication_error';
        } else if (errorName.includes('Throttling') || errorName.includes('TooManyRequests')) {
            statusCode = 429;
            errorType = 'rate_limit_error';
        } else if (errorName.includes('Validation')) {
            statusCode = 400;
            errorType = 'invalid_request_error';
        } else if (errorName.includes('ModelNotReady') || errorName.includes('ServiceUnavailable')) {
            statusCode = 503;
            errorType = 'overloaded_error';
        }

        res.status(statusCode).json(
            createAnthropicError(errorType, errorMessage)
        );
    }
});
