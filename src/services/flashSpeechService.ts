/**
 * 闪电说语音识别服务
 * 文档：https://www.flashspeech.com/docs
 */

export interface FlashSpeechConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface RecognitionResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export class FlashSpeechService {
  private config: FlashSpeechConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;

  constructor(config: FlashSpeechConfig) {
    this.config = {
      baseUrl: "https://api.flashspeech.com/v1",
      ...config,
    };
  }

  /**
   * 开始录音
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error("Already recording");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
    } catch (error) {
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  /**
   * 停止录音并识别
   */
  async stopRecording(): Promise<string> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error("Not recording");
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("MediaRecorder not initialized"));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
          const text = await this.recognizeAudio(audioBlob);
          this.isRecording = false;

          // 停止所有音频轨道
          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          }

          resolve(text);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 识别音频
   */
  private async recognizeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("language", "zh-CN"); // 支持中英文混合

    try {
      const response = await fetch(`${this.config.baseUrl}/recognize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.text || "";
    } catch (error) {
      throw new Error(`Recognition failed: ${error}`);
    }
  }

  /**
   * 取消录音
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      this.isRecording = false;
      this.audioChunks = [];
    }
  }

  /**
   * 检查是否正在录音
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}

/**
 * 获取闪电说服务实例
 */
export function getFlashSpeechService(): FlashSpeechService {
  const apiKey = localStorage.getItem("flashspeech_api_key") || "";

  if (!apiKey) {
    throw new Error("闪电说 API Key 未配置，请在设置中配置");
  }

  return new FlashSpeechService({ apiKey });
}
