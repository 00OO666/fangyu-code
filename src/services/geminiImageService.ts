/**
 * Gemini Image Generation Service (Nano Banana)
 * 
 * 使用 Google Gemini API 生成和编辑图片
 * 支持 gemini-2.5-flash-image (快速) 和 gemini-3-pro-image-preview (高质量)
 */

import { logger } from '@/lib/logger';
import { GoogleGenAI } from '@google/genai';
import { getAPIKey } from '@/lib/secureStorage';

// =============================================================================
// 类型定义
// =============================================================================

export type GeminiImageModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

export interface ImageGenerationOptions {
  model?: GeminiImageModel;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3';
  numberOfImages?: number;
}

export interface ImageEditOptions extends ImageGenerationOptions {
  referenceImages?: Array<{
    data: string; // Base64 encoded
    mimeType: string;
  }>;
}

export interface GeneratedImage {
  data: string; // Base64 encoded image data
  mimeType: string;
  prompt: string;
  model: GeminiImageModel;
}

export interface ImageGenerationResult {
  success: boolean;
  images?: GeneratedImage[];
  text?: string; // AI 可能返回的文字说明
  error?: string;
}

// =============================================================================
// Gemini Image Service
// =============================================================================

class GeminiImageService {
  private client: GoogleGenAI | null = null;
  private apiKey: string | null = null;

  /**
   * 初始化服务，加载 API Key
   */
  async initialize(): Promise<boolean> {
    try {
      this.apiKey = await getAPIKey('gemini');
      if (this.apiKey) {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('geminiImageService', '[GeminiImageService] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * 设置 API Key（用于临时覆盖或手动配置）
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return !!this.client && !!this.apiKey;
  }

  /**
   * 获取当前 API Key（遮罩显示）
   */
  getMaskedApiKey(): string {
    if (!this.apiKey) return '';
    if (this.apiKey.length <= 8) return '****';
    return `${this.apiKey.slice(0, 4)}...${this.apiKey.slice(-4)}`;
  }


  /**
   * 文生图 - 根据文字描述生成图片
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!this.client) {
      return { success: false, error: '未配置 Gemini API Key，请在设置中配置' };
    }

    const model = options.model || 'gemini-2.5-flash-image';

    try {
      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      return this.parseResponse(response, prompt, model);
    } catch (error) {
      logger.error('geminiImageService', '[GeminiImageService] generateImage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片生成失败',
      };
    }
  }

  /**
   * 图生图 - 根据参考图片和文字描述编辑/生成图片
   */
  async editImage(
    prompt: string,
    options: ImageEditOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!this.client) {
      return { success: false, error: '未配置 Gemini API Key，请在设置中配置' };
    }

    const model = options.model || 'gemini-2.5-flash-image';
    const referenceImages = options.referenceImages || [];

    if (referenceImages.length === 0) {
      return { success: false, error: '请提供至少一张参考图片' };
    }

    try {
      // 构建多模态内容
      const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
      ];

      // 添加参考图片
      for (const img of referenceImages) {
        contents.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }

      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      return this.parseResponse(response, prompt, model);
    } catch (error) {
      logger.error('geminiImageService', '[GeminiImageService] editImage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片编辑失败',
      };
    }
  }

  /**
   * 多轮对话式图像编辑
   */
  async chatEditImage(
    messages: Array<{
      role: 'user' | 'model';
      content: string;
      images?: Array<{ data: string; mimeType: string }>;
    }>,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!this.client) {
      return { success: false, error: '未配置 Gemini API Key，请在设置中配置' };
    }

    const model = options.model || 'gemini-3-pro-image-preview';

    try {
      // 构建对话历史
      const contents = messages.map((msg) => {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.images) {
          for (const img of msg.images) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: img.data,
              },
            });
          }
        }

        return {
          role: msg.role,
          parts,
        };
      });

      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      return this.parseResponse(response, lastUserMessage?.content || '', model);
    } catch (error) {
      logger.error('geminiImageService', '[GeminiImageService] chatEditImage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '对话式图像编辑失败',
      };
    }
  }


  /**
   * 解析 API 响应
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResponse(response: any, prompt: string, model: GeminiImageModel): ImageGenerationResult {
    try {
      const images: GeneratedImage[] = [];
      let text: string | undefined;

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) {
        return { success: false, error: '无效的 API 响应' };
      }

      for (const part of candidate.content.parts) {
        if (part.text) {
          text = part.text;
        } else if (part.inlineData) {
          images.push({
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            prompt,
            model,
          });
        }
      }

      if (images.length === 0 && !text) {
        return { success: false, error: 'API 未返回图片或文字' };
      }

      return {
        success: true,
        images: images.length > 0 ? images : undefined,
        text,
      };
    } catch (error) {
      logger.error('geminiImageService', '[GeminiImageService] parseResponse error:', error);
      return {
        success: false,
        error: '解析响应失败',
      };
    }
  }

  /**
   * 验证 API Key 是否有效
   */
  async validateApiKey(apiKey?: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    const keyToTest = apiKey || this.apiKey;
    if (!keyToTest) {
      return { valid: false, error: '未提供 API Key' };
    }

    try {
      const testClient = new GoogleGenAI({ apiKey: keyToTest });
      // 使用简单的文本生成来验证 key
      await testClient.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: 'test',
        config: {
          maxOutputTokens: 1,
        },
      });
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '验证失败';
      // 检查是否是认证错误
      if (message.includes('API key') || message.includes('401') || message.includes('403')) {
        return { valid: false, error: 'API Key 无效或已过期' };
      }
      // 其他错误可能是请求限制等，但 key 本身可能是有效的
      return { valid: true };
    }
  }
}

// =============================================================================
// 单例导出
// =============================================================================

export const geminiImageService = new GeminiImageService();/**
 * 将 File 对象转换为 Base64
 */
export async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve({
        data: base64,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 将 Base64 图片保存为文件
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * 下载生成的图片
 */
export function downloadImage(image: GeneratedImage, filename?: string): void {
  const blob = base64ToBlob(image.data, image.mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `generated-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 获取支持的图像模型列表
 */
export function getImageModels(): Array<{ id: GeminiImageModel; name: string; description: string }> {
  return [
    {
      id: 'gemini-2.5-flash-image',
      name: 'Nano Banana (快速)',
      description: '速度快，适合日常使用，约 3 秒生成',
    },
    {
      id: 'gemini-3-pro-image-preview',
      name: 'Nano Banana Pro (高质量)',
      description: '质量高，支持 4K，文字渲染精准',
    },
  ];
}

export default geminiImageService;
