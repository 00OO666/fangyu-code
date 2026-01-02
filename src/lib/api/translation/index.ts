/**
 * Translation 模块 - 翻译服务 API
 *
 * 提供文本翻译、语言检测和翻译缓存管理功能。
 */
import { invoke } from "@tauri-apps/api/core";
import type { TranslationCacheStats, TranslationConfig } from "../types";

/**
 * Translates text using the translation service
 * @param text - The text to translate
 * @param targetLang - Optional target language (defaults to auto-detection)
 * @returns Promise resolving to translated text
 */
export async function translateText(text: string, targetLang?: string): Promise<string> {
  try {
    return await invoke<string>("translate", { text, targetLang });
  } catch (error) {
    console.error("Failed to translate text:", error);
    throw error;
  }
}

/**
 * Translates multiple texts in batch
 * @param texts - Array of texts to translate
 * @param targetLang - Optional target language
 * @returns Promise resolving to array of translated texts
 */
export async function translateBatch(texts: string[], targetLang?: string): Promise<string[]> {
  try {
    return await invoke<string[]>("translate_batch", { texts, targetLang });
  } catch (error) {
    console.error("Failed to batch translate texts:", error);
    throw error;
  }
}

/**
 * Gets the current translation configuration
 * @returns Promise resolving to translation configuration
 */
export async function getTranslationConfig(): Promise<TranslationConfig> {
  try {
    return await invoke<TranslationConfig>("get_translation_config");
  } catch (error) {
    console.error("Failed to get translation config:", error);
    throw error;
  }
}

/**
 * Updates the translation configuration
 * @param config - New translation configuration
 * @returns Promise resolving to success message
 */
export async function updateTranslationConfig(config: TranslationConfig): Promise<string> {
  try {
    return await invoke<string>("update_translation_config", { config });
  } catch (error) {
    console.error("Failed to update translation config:", error);
    throw error;
  }
}

/**
 * Clears the translation cache
 * @returns Promise resolving to success message
 */
export async function clearTranslationCache(): Promise<string> {
  try {
    return await invoke<string>("clear_translation_cache");
  } catch (error) {
    console.error("Failed to clear translation cache:", error);
    throw error;
  }
}

/**
 * Gets translation cache statistics
 * @returns Promise resolving to cache statistics
 */
export async function getTranslationCacheStats(): Promise<TranslationCacheStats> {
  try {
    return await invoke<TranslationCacheStats>("get_translation_cache_stats");
  } catch (error) {
    console.error("Failed to get translation cache stats:", error);
    throw error;
  }
}

/**
 * Detects the language of the given text
 * @param text - The text to analyze
 * @returns Promise resolving to detected language code
 */
export async function detectTextLanguage(text: string): Promise<string> {
  try {
    return await invoke<string>("detect_text_language", { text });
  } catch (error) {
    console.error("Failed to detect text language:", error);
    throw error;
  }
}

/**
 * Initializes the translation service
 * @param config - Optional translation configuration
 * @returns Promise resolving to success message
 */
export async function initTranslationService(config?: TranslationConfig): Promise<string> {
  try {
    return await invoke<string>("init_translation_service_command", { config });
  } catch (error) {
    console.error("Failed to initialize translation service:", error);
    throw error;
  }
}
