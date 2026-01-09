/**
 * Secure Storage Commands
 * 
 * 使用系统密钥环安全存储敏感数据
 * 
 * Requirements: 7.1
 */

use keyring::Entry;
use tauri::command;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;

/// 应用服务名称（用于密钥环）
const SERVICE_NAME: &str = "fangyu-code";

/// 内存缓存（用于快速访问）
static KEY_CACHE: Lazy<Mutex<HashMap<String, String>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// 存储值到安全存储
#[command]
pub async fn secure_store_set(key: String, value: String) -> Result<(), String> {
    // 创建密钥环条目
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    // 存储密码
    entry.set_password(&value)
        .map_err(|e| format!("Failed to store value: {}", e))?;
    
    // 更新缓存
    if let Ok(mut cache) = KEY_CACHE.lock() {
        cache.insert(key, value);
    }
    
    Ok(())
}

/// 从安全存储获取值
#[command]
pub async fn secure_store_get(key: String) -> Result<Option<String>, String> {
    // 先检查缓存
    if let Ok(cache) = KEY_CACHE.lock() {
        if let Some(value) = cache.get(&key) {
            return Ok(Some(value.clone()));
        }
    }
    
    // 从密钥环获取
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(value) => {
            // 更新缓存
            if let Ok(mut cache) = KEY_CACHE.lock() {
                cache.insert(key, value.clone());
            }
            Ok(Some(value))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get value: {}", e)),
    }
}

/// 从安全存储删除值
#[command]
pub async fn secure_store_remove(key: String) -> Result<(), String> {
    // 从密钥环删除
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    // 尝试删除，忽略不存在的情况
    match entry.delete_credential() {
        Ok(_) => {}
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(format!("Failed to remove value: {}", e)),
    }
    
    // 从缓存删除
    if let Ok(mut cache) = KEY_CACHE.lock() {
        cache.remove(&key);
    }
    
    Ok(())
}

/// 清除所有安全存储的值
#[command]
pub async fn secure_store_clear() -> Result<(), String> {
    // 获取所有缓存的键
    let keys: Vec<String> = if let Ok(cache) = KEY_CACHE.lock() {
        cache.keys().cloned().collect()
    } else {
        vec![]
    };
    
    // 删除所有键
    for key in keys {
        let entry = Entry::new(SERVICE_NAME, &key)
            .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
        
        match entry.delete_credential() {
            Ok(_) => {}
            Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("Failed to remove value for key {}: {}", key, e)),
        }
    }
    
    // 清空缓存
    if let Ok(mut cache) = KEY_CACHE.lock() {
        cache.clear();
    }
    
    Ok(())
}

/// 列出所有存储的键
#[command]
pub async fn secure_store_list_keys() -> Result<Vec<String>, String> {
    // 返回缓存中的所有键
    if let Ok(cache) = KEY_CACHE.lock() {
        Ok(cache.keys().cloned().collect())
    } else {
        Ok(vec![])
    }
}

/// 检查键是否存在
#[command]
pub async fn secure_store_has(key: String) -> Result<bool, String> {
    // 先检查缓存
    if let Ok(cache) = KEY_CACHE.lock() {
        if cache.contains_key(&key) {
            return Ok(true);
        }
    }
    
    // 检查密钥环
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Failed to check key: {}", e)),
    }
}
