/// 通用配置管理工具模块
///
/// 提供统一的JSON配置文件加载和保存功能，消除重复代码
///
/// # 使用示例
///
/// ```rust
/// use crate::utils::config_utils::{load_json_config, save_json_config};
///
/// #[derive(Serialize, Deserialize, Default)]
/// struct MyConfig {
///     name: String,
/// }
///
/// // 加载配置（如不存在则返回默认值）
/// let config: MyConfig = load_json_config(&path)?;
///
/// // 保存配置（自动创建父目录）
/// save_json_config(&config, &path)?;
/// ```

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

/// 通用配置加载函数
///
/// 从JSON文件加载配置，如果文件不存在则返回默认值
///
/// # 泛型参数
/// - `T`: 配置类型，必须实现 `Deserialize + Default`
///
/// # 参数
/// - `config_path`: 配置文件路径
///
/// # 返回值
/// - `Ok(T)`: 成功加载的配置对象
/// - `Err(String)`: 错误信息（包含文件路径和具体错误）
///
/// # 特性
/// - ✅ 文件不存在时返回 `T::default()`
/// - ✅ 自动反序列化JSON
/// - ✅ 详细的错误信息
/// - ✅ 支持任意实现 Deserialize + Default 的类型
pub fn load_json_config<T>(config_path: impl AsRef<Path>) -> Result<T, String>
where
    T: for<'de> Deserialize<'de> + Default,
{
    let path = config_path.as_ref();

    // 文件不存在时返回默认值
    if !path.exists() {
        log::debug!("Config file not found at {:?}, using default", path);
        return Ok(T::default());
    }

    // 读取文件内容
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read config from {:?}: {}", path, e))?;

    // 反序列化JSON
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config from {:?}: {}", path, e))
}

/// 通用配置保存函数
///
/// 将配置对象序列化为JSON并保存到文件
///
/// # 泛型参数
/// - `T`: 配置类型，必须实现 `Serialize`
///
/// # 参数
/// - `config`: 要保存的配置对象引用
/// - `config_path`: 配置文件路径
///
/// # 返回值
/// - `Ok(())`: 保存成功
/// - `Err(String)`: 错误信息（包含文件路径和具体错误）
///
/// # 特性
/// - ✅ 自动创建父目录（如果不存在）
/// - ✅ 使用美化格式（pretty print）
/// - ✅ 详细的错误信息
/// - ✅ 支持任意实现 Serialize 的类型
pub fn save_json_config<T>(config: &T, config_path: impl AsRef<Path>) -> Result<(), String>
where
    T: Serialize,
{
    let path = config_path.as_ref();

    // 确保父目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory {:?}: {}", parent, e))?;
    }

    // 序列化配置对象为JSON（美化格式）
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // 写入文件
    fs::write(path, content)
        .map_err(|e| format!("Failed to write config to {:?}: {}", path, e))?;

    log::debug!("Config saved successfully to {:?}", path);
    Ok(())
}

/// 配置路径构建助手
///
/// 用于构建标准配置文件路径，支持链式调用
///
/// # 使用示例
///
/// ```rust
/// // 从HOME/.claude目录构建
/// let builder = ConfigPathBuilder::from_home_subdir(".claude")?;
/// let config_path = builder.build("settings.json");
///
/// // 自定义基础目录
/// let builder = ConfigPathBuilder::new(my_dir);
/// let config_path = builder.build("config.json");
/// ```
pub struct ConfigPathBuilder {
    base_dir: PathBuf,
}

impl ConfigPathBuilder {
    /// 创建新的路径构建器
    ///
    /// # 参数
    /// - `base_dir`: 基础目录路径
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    /// 构建配置文件路径
    ///
    /// # 参数
    /// - `filename`: 配置文件名
    ///
    /// # 返回值
    /// 完整的配置文件路径
    pub fn build(&self, filename: &str) -> PathBuf {
        self.base_dir.join(filename)
    }

    /// 从用户主目录的子目录构建
    ///
    /// # 参数
    /// - `subdir`: 主目录下的子目录名（如 ".claude", ".codex"）
    ///
    /// # 返回值
    /// - `Ok(ConfigPathBuilder)`: 成功创建的构建器
    /// - `Err(String)`: 如果无法获取主目录
    ///
    /// # 示例
    /// ```rust
    /// let builder = ConfigPathBuilder::from_home_subdir(".claude")?;
    /// let path = builder.build("settings.json");
    /// // 结果: ~/.claude/settings.json
    /// ```
    pub fn from_home_subdir(subdir: &str) -> Result<Self, String> {
        let home = dirs::home_dir()
            .ok_or_else(|| "Failed to get home directory".to_string())?;
        Ok(Self::new(home.join(subdir)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use std::fs;
    use std::path::PathBuf;

    #[derive(Debug, Serialize, Deserialize, Default, PartialEq)]
    struct TestConfig {
        name: String,
        value: i32,
    }

    #[test]
    fn test_load_nonexistent_returns_default() {
        let path = PathBuf::from("/tmp/nonexistent_config.json");
        let config: TestConfig = load_json_config(&path).unwrap();
        assert_eq!(config, TestConfig::default());
    }

    #[test]
    fn test_save_and_load_config() {
        let temp_dir = std::env::temp_dir();
        let config_path = temp_dir.join("test_config.json");

        let test_config = TestConfig {
            name: "test".to_string(),
            value: 42,
        };

        // 保存配置
        save_json_config(&test_config, &config_path).unwrap();
        assert!(config_path.exists());

        // 加载配置
        let loaded_config: TestConfig = load_json_config(&config_path).unwrap();
        assert_eq!(loaded_config, test_config);

        // 清理
        fs::remove_file(config_path).ok();
    }

    #[test]
    fn test_config_path_builder() {
        let builder = ConfigPathBuilder::new(PathBuf::from("/test/dir"));
        let path = builder.build("config.json");

        #[cfg(windows)]
        assert_eq!(path, PathBuf::from("\\test\\dir\\config.json"));

        #[cfg(not(windows))]
        assert_eq!(path, PathBuf::from("/test/dir/config.json"));
    }
}
