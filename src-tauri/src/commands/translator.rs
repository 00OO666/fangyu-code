use anyhow::{Context, Result};
use log::{debug, error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use super::url_utils::{normalize_api_url, ApiEndpointType};

/// 翻译配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationConfig {
    /// 是否启用翻译功能
    pub enabled: bool,
    /// API基础URL
    pub api_base_url: String,
    /// API密钥
    pub api_key: String,
    /// 模型名称
    pub model: String,
    /// 请求超时时间（秒）
    pub timeout_seconds: u64,
    /// 缓存有效期（秒）
    pub cache_ttl_seconds: u64,
}

impl Default for TranslationConfig {
    fn default() -> Self {
        Self {
            enabled: false, // 🔧 修复：默认禁用翻译功能，需用户配置API密钥后启用
            api_base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(), // 🔧 修复：要求用户自定义输入API密钥
            model: "gpt-4o-mini".to_string(),
            timeout_seconds: 30,
            cache_ttl_seconds: 3600, // 1小时
        }
    }
}

/// 翻译缓存条目
#[derive(Debug, Clone)]
struct CacheEntry {
    translated_text: String,
    created_at: Instant,
    ttl: Duration,
}

impl CacheEntry {
    fn new(translated_text: String, ttl: Duration) -> Self {
        Self {
            translated_text,
            created_at: Instant::now(),
            ttl,
        }
    }

    fn is_expired(&self) -> bool {
        self.created_at.elapsed() > self.ttl
    }
}

/// 翻译服务
pub struct TranslationService {
    config: TranslationConfig,
    client: Client,
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
}

impl TranslationService {
    /// 创建新的翻译服务实例
    pub fn new(config: TranslationConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 改进的文本语言检测，与前端保持一致
    fn detect_language(&self, text: &str) -> String {
        if text.trim().is_empty() {
            return "en".to_string();
        }

        // 扩展的中文字符检测范围
        let chinese_chars: Vec<char> = text
            .chars()
            .filter(|c| {
                let ch = *c as u32;
                // 更全面的中文字符范围
                (ch >= 0x4E00 && ch <= 0x9FFF) ||  // CJK统一表意文字
                (ch >= 0x3400 && ch <= 0x4DBF) ||  // CJK扩展A
                (ch >= 0xF900 && ch <= 0xFAFF) ||  // CJK兼容表意文字
                (ch >= 0x3000 && ch <= 0x303F) ||  // CJK符号和标点
                (ch >= 0xFF00 && ch <= 0xFFEF) // 全角ASCII、全角中英文标点、半宽片假名、半宽平假名、半宽韩文字母
            })
            .collect();

        if chinese_chars.is_empty() {
            return "en".to_string();
        }

        // 简化预处理，移除明显的非文本内容
        use regex::Regex;

        let processed_text = text
            // 移除明确的URL
            .to_string();

        let processed_text = Regex::new(r"https?://[^\s]+")
            .unwrap()
            .replace_all(&processed_text, " ")
            .to_string();

        let processed_text = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
            .unwrap()
            .replace_all(&processed_text, " ")
            .to_string();

        let processed_chinese_chars = processed_text
            .chars()
            .filter(|c| {
                let ch = *c as u32;
                (ch >= 0x4E00 && ch <= 0x9FFF)
                    || (ch >= 0x3400 && ch <= 0x4DBF)
                    || (ch >= 0xF900 && ch <= 0xFAFF)
            })
            .count();

        let total_processed_chars = processed_text.chars().count();
        let original_chinese_count = chinese_chars.len();

        debug!(
            "Language detection: chinese_chars={}, total_processed={}, original_chinese={}",
            processed_chinese_chars, total_processed_chars, original_chinese_count
        );

        // 🔧 修复：更宽松的中文检测条件，与前端保持一致
        // 1. 短文本（≤20字符）：有1个或以上中文字符就认为是中文
        // 2. 长文本：要求中文字符占比达到一定比例，或数量足够多
        if processed_chinese_chars >= 1 {
            let processed_ratio = if total_processed_chars > 0 {
                processed_chinese_chars as f32 / total_processed_chars as f32
            } else {
                1.0
            };
            let original_ratio = original_chinese_count as f32 / text.chars().count() as f32;

            // 短文本：有中文字符就认为是中文（与前端逻辑一致）
            if text.chars().count() <= 20 && processed_chinese_chars >= 1 {
                debug!("Short text with Chinese chars detected: {}", text);
                return "zh".to_string();
            }

            // 长文本：要求一定比例，或中文字符数量足够多
            if processed_ratio >= 0.1 || original_ratio >= 0.08 || processed_chinese_chars >= 5 {
                debug!("Long text with sufficient Chinese ratio detected: {}", text);
                return "zh".to_string();
            }
        }

        "en".to_string()
    }

    /// 生成缓存键
    fn cache_key(&self, text: &str, from_lang: &str, to_lang: &str) -> String {
        format!("{}:{}:{}", from_lang, to_lang, text)
    }

    /// 从缓存获取翻译结果
    async fn get_cached_translation(&self, cache_key: &str) -> Option<String> {
        let mut cache = self.cache.lock().await;

        if let Some(entry) = cache.get(cache_key) {
            if !entry.is_expired() {
                debug!("Cache hit for key: {}", cache_key);
                return Some(entry.translated_text.clone());
            } else {
                debug!("Cache expired for key: {}", cache_key);
                cache.remove(cache_key);
            }
        }

        None
    }

    /// 缓存翻译结果
    async fn cache_translation(&self, cache_key: String, translated_text: String) {
        let mut cache = self.cache.lock().await;
        let ttl = Duration::from_secs(self.config.cache_ttl_seconds);
        cache.insert(cache_key, CacheEntry::new(translated_text, ttl));
    }

    /// 清理过期缓存
    #[allow(dead_code)]
    pub async fn cleanup_expired_cache(&self) {
        let mut cache = self.cache.lock().await;
        cache.retain(|_, entry| !entry.is_expired());
        debug!("Cleaned up expired cache entries");
    }

    /// 翻译API请求
    async fn call_translation_api(
        &self,
        text: &str,
        from_lang: &str,
        to_lang: &str,
    ) -> Result<String> {
        // 检查API密钥是否已配置
        if self.config.api_key.is_empty() {
            return Err(anyhow::anyhow!(
                "API密钥未配置，请在设置中填写您的翻译服务 API 密钥"
            ));
        }
        let system_prompt = match (from_lang, to_lang) {
            ("zh", "en") => "You are a professional Chinese to English translator. Translate the following Chinese text to natural, fluent English while preserving the original meaning and tone. Only return the translated text, nothing else.",
            ("en", "zh") => "You are a professional English to Chinese translator. Translate the following English text to natural, fluent Chinese while preserving the original meaning and tone. Only return the translated text, nothing else.",
            _ => "You are a professional translator. Translate the text to the target language while preserving the original meaning and tone. Only return the translated text, nothing else.",
        };

        let request_body = serde_json::json!({
            "model": self.config.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            "temperature": 0.1,
            "max_tokens": 4000,
            "stream": false
        });

        // Avoid logging potentially sensitive content (source code, secrets, etc.)
        debug!(
            "Sending translation request: from={} to={}, input_len={}",
            from_lang,
            to_lang,
            text.chars().count()
        );

        // 智能规范化 API URL（支持用户输入简化的基础 URL）
        let api_url = normalize_api_url(&self.config.api_base_url, ApiEndpointType::OpenAI);
        debug!("Using normalized API URL: {}", api_url);

        let response = self
            .client
            .post(&api_url)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .context("Failed to send translation request")?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow::anyhow!(
                "Translation API error: {} - {}",
                status,
                error_text
            ));
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse API response")?;

        // 提取翻译结果
        let translated_text = response_json
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .ok_or_else(|| anyhow::anyhow!("Invalid API response format"))?
            .trim()
            .to_string();

        debug!(
            "Translation successful: from={} to={}, input_len={}, output_len={}",
            from_lang,
            to_lang,
            text.chars().count(),
            translated_text.chars().count()
        );

        Ok(translated_text)
    }

    /// 智能翻译文本
    pub async fn translate(&self, text: &str, target_lang: Option<&str>) -> Result<String> {
        if !self.config.enabled {
            debug!("Translation disabled, returning original text");
            return Ok(text.to_string());
        }

        if text.trim().is_empty() {
            return Ok(text.to_string());
        }

        // 检测源语言
        let from_lang = self.detect_language(text);

        // 确定目标语言
        let to_lang = target_lang.unwrap_or_else(|| {
            match from_lang.as_str() {
                "zh" => "en", // 中文翻译为英文
                _ => "zh",    // 其他语言翻译为中文
            }
        });

        // 如果源语言和目标语言相同，直接返回
        if from_lang == to_lang {
            debug!("Source and target languages are the same, skipping translation");
            return Ok(text.to_string());
        }

        // 生成缓存键
        let cache_key = self.cache_key(text, &from_lang, to_lang);

        // 尝试从缓存获取
        if let Some(cached_result) = self.get_cached_translation(&cache_key).await {
            info!("Using cached translation");
            return Ok(cached_result);
        }

        // 调用翻译API
        match self.call_translation_api(text, &from_lang, to_lang).await {
            Ok(translated_text) => {
                // 缓存结果
                self.cache_translation(cache_key, translated_text.clone())
                    .await;
                info!("Translation completed: {} -> {}", from_lang, to_lang);
                Ok(translated_text)
            }
            Err(e) => {
                error!("Translation failed: {}", e);
                // 降级策略：返回原文
                warn!("Using fallback: returning original text due to translation failure");
                Ok(text.to_string())
            }
        }
    }

    /// 批量翻译
    pub async fn translate_batch(
        &self,
        texts: &[String],
        target_lang: Option<&str>,
    ) -> Result<Vec<String>> {
        let mut results = Vec::new();

        for text in texts {
            match self.translate(text, target_lang).await {
                Ok(translated) => results.push(translated),
                Err(_) => {
                    // 单个翻译失败时使用原文
                    results.push(text.clone());
                }
            }
        }

        Ok(results)
    }

    /// 更新配置
    #[allow(dead_code)]
    pub fn update_config(&mut self, new_config: TranslationConfig) {
        self.config = new_config;
    }

    /// 清空缓存
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.lock().await;
        cache.clear();
        info!("Translation cache cleared");
    }

    /// 获取缓存统计信息
    pub async fn get_cache_stats(&self) -> CacheStats {
        let cache = self.cache.lock().await;
        let total_entries = cache.len();
        let expired_entries = cache.values().filter(|entry| entry.is_expired()).count();

        CacheStats {
            total_entries,
            expired_entries,
            active_entries: total_entries - expired_entries,
        }
    }
}

/// 缓存统计信息
#[derive(Debug, Serialize)]
pub struct CacheStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub active_entries: usize,
}

/// 全局翻译服务实例
static TRANSLATION_SERVICE: once_cell::sync::Lazy<Arc<Mutex<TranslationService>>> =
    once_cell::sync::Lazy::new(|| {
        Arc::new(Mutex::new(TranslationService::new(
            TranslationConfig::default(),
        )))
    });

/// 初始化翻译服务
pub async fn init_translation_service(config: TranslationConfig) {
    let mut service = TRANSLATION_SERVICE.lock().await;
    *service = TranslationService::new(config);
    info!("Translation service initialized");
}

/// 使用保存的配置初始化翻译服务
pub async fn init_translation_service_with_saved_config() {
    match load_translation_config_from_file() {
        Ok(config) => {
            info!("Initializing translation service with saved config");
            init_translation_service(config).await;
        }
        Err(e) => {
            warn!(
                "Failed to load saved translation config: {}, using default",
                e
            );
            init_translation_service(TranslationConfig::default()).await;
        }
    }
}

/// 获取全局翻译服务
fn get_translation_service() -> Arc<Mutex<TranslationService>> {
    TRANSLATION_SERVICE.clone()
}

/// 翻译文本（公共接口）
pub async fn translate_text(text: &str, target_lang: Option<&str>) -> Result<String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    service.translate(text, target_lang).await
}

/// Tauri命令：翻译文本
#[tauri::command]
pub async fn translate(text: String, target_lang: Option<String>) -> Result<String, String> {
    let target = target_lang.as_deref();

    translate_text(&text, target)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri命令：批量翻译
#[tauri::command]
pub async fn translate_batch(
    texts: Vec<String>,
    target_lang: Option<String>,
) -> Result<Vec<String>, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    let target = target_lang.as_deref();

    service
        .translate_batch(&texts, target)
        .await
        .map_err(|e| e.to_string())
}

/// Tauri命令：获取翻译配置
#[tauri::command]
pub async fn get_translation_config() -> Result<TranslationConfig, String> {
    // 优先从文件加载最新配置
    match load_translation_config_from_file() {
        Ok(config) => {
            // 同时更新内存中的配置
            let mut service = TRANSLATION_SERVICE.lock().await;
            *service = TranslationService::new(config.clone());
            Ok(config)
        }
        Err(_) => {
            // 文件加载失败，返回内存中的配置
            let service_arc = get_translation_service();
            let service = service_arc.lock().await;
            Ok(service.config.clone())
        }
    }
}

/// Tauri命令：更新翻译配置
#[tauri::command]
pub async fn update_translation_config(config: TranslationConfig) -> Result<String, String> {
    // 保存配置到文件
    save_translation_config_to_file(&config)
        .map_err(|e| format!("Failed to save translation config: {}", e))?;

    // 重新初始化翻译服务
    init_translation_service(config).await;

    info!("Translation configuration updated and saved successfully");
    Ok("Translation configuration updated successfully".to_string())
}

/// Tauri命令：清空翻译缓存
#[tauri::command]
pub async fn clear_translation_cache() -> Result<String, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    service.clear_cache().await;
    Ok("Translation cache cleared successfully".to_string())
}

/// Tauri命令：获取缓存统计
#[tauri::command]
pub async fn get_translation_cache_stats() -> Result<CacheStats, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    Ok(service.get_cache_stats().await)
}

/// Tauri命令：检测文本语言
#[tauri::command]
pub async fn detect_text_language(text: String) -> Result<String, String> {
    let service_arc = get_translation_service();
    let service = service_arc.lock().await;
    Ok(service.detect_language(&text))
}

/// 获取翻译配置文件路径
fn get_translation_config_path() -> Result<PathBuf, String> {
    let claude_dir = get_claude_dir().map_err(|e| e.to_string())?;
    Ok(claude_dir.join("translation_config.json"))
}

/// 获取Claude目录路径
fn get_claude_dir() -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let claude_dir = home_dir.join(".claude");

    // 确保目录存在
    if !claude_dir.exists() {
        fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    Ok(claude_dir)
}

/// 从文件加载翻译配置
fn load_translation_config_from_file() -> Result<TranslationConfig, String> {
    let config_path = get_translation_config_path()?;
    // 使用通用配置加载工具
    crate::utils::config_utils::load_json_config(&config_path)
}

/// 保存翻译配置到文件
fn save_translation_config_to_file(config: &TranslationConfig) -> Result<(), String> {
    let config_path = get_translation_config_path()?;
    // 使用通用配置保存工具
    crate::utils::config_utils::save_json_config(config, &config_path)?;
    info!("Saved translation config to file: {:?}", config_path);
    Ok(())
}

/// Tauri命令：初始化翻译服务
#[tauri::command]
pub async fn init_translation_service_command(
    config: Option<TranslationConfig>,
) -> Result<String, String> {
    let final_config = if let Some(provided_config) = config {
        provided_config
    } else {
        // 尝试从文件加载配置，失败则使用默认配置
        load_translation_config_from_file().unwrap_or_default()
    };

    init_translation_service(final_config).await;
    Ok("Translation service initialized successfully".to_string())
}
