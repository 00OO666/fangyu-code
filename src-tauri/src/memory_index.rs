use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use anyhow::{anyhow, Result};
use regex::Regex;

/// 记忆元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetadata {
    pub keywords: Vec<String>,
    pub priority: String, // "high", "medium", "low"
    pub category: String,
    pub title: String,
    pub file_path: PathBuf,
}

/// 匹配结果（前端用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMatch {
    pub file: String,
    pub title: String,
    pub matched_keywords: Vec<String>,
    pub priority: String,
    pub category: String,
    pub score: usize,
}

/// Trie 树节点
#[derive(Default)]
struct TrieNode {
    children: HashMap<char, Box<TrieNode>>,
    is_end: bool,
    memory_refs: Vec<usize>, // 指向 MemoryMetadata 的索引
}

impl TrieNode {
    fn insert(&mut self, keyword: &str, memory_idx: usize) {
        let mut node = self;
        for ch in keyword.to_lowercase().chars() {
            node = node.children.entry(ch).or_insert_with(Box::default);
        }
        node.is_end = true;
        if !node.memory_refs.contains(&memory_idx) {
            node.memory_refs.push(memory_idx);
        }
    }

    fn search(&self, text: &str) -> HashSet<usize> {
        let mut results = HashSet::new();
        let text_lower = text.to_lowercase();

        // 遍历所有起始位置
        for start in 0..text_lower.len() {
            let mut node = self;
            for ch in text_lower[start..].chars() {
                match node.children.get(&ch) {
                    Some(next_node) => {
                        node = next_node;
                        if node.is_end {
                            for &idx in &node.memory_refs {
                                results.insert(idx);
                            }
                        }
                    }
                    None => break,
                }
            }
        }

        results
    }
}

/// 记忆索引
pub struct MemoryIndex {
    memories: Vec<MemoryMetadata>,
    trie: TrieNode,
}

impl MemoryIndex {
    fn new() -> Self {
        let mut index = MemoryIndex {
            memories: Vec::new(),
            trie: TrieNode::default(),
        };
        index.build_from_directory();
        index
    }

    fn build_from_directory(&mut self) {
        let memory_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
            .join("memory");

        if !memory_dir.exists() {
            log::warn!("Memory directory not found: {:?}", memory_dir);
            return;
        }

        log::info!("Building memory index from: {:?}", memory_dir);

        let dir_iter = match fs::read_dir(&memory_dir) {
            Ok(iter) => iter,
            Err(e) => {
                log::warn!("Failed to read memory directory: {}", e);
                return;
            }
        };

        for entry in dir_iter {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "md") {
                    match self.parse_memory_file(&path) {
                        Ok(metadata) => {
                            self.add_memory(metadata);
                        }
                        Err(e) => {
                            log::warn!("Failed to parse {:?}: {}", path, e);
                        }
                    }
                }
            }
        }

        log::info!("Memory index built with {} memories", self.memories.len());
    }

    fn parse_memory_file(&self, path: &Path) -> Result<MemoryMetadata> {
        let content = fs::read_to_string(path)?;

        // 提取 YAML frontmatter
        let yaml_regex =
            Regex::new(r"(?s)^---\n(.*?)\n---").map_err(|e| anyhow!("Regex error: {}", e))?;

        if let Some(captures) = yaml_regex.captures(&content) {
            let yaml_str = &captures[1];
            let mut meta: MemoryMetadata = serde_yaml::from_str(yaml_str)
                .map_err(|e| anyhow!("YAML parse error: {}", e))?;
            meta.file_path = path.to_path_buf();
            Ok(meta)
        } else {
            Err(anyhow!("No YAML frontmatter found in {:?}", path))
        }
    }

    fn add_memory(&mut self, metadata: MemoryMetadata) {
        let idx = self.memories.len();
        for keyword in &metadata.keywords {
            self.trie.insert(keyword, idx);
        }
        self.memories.push(metadata);
    }

    fn search(&self, text: &str) -> Vec<MemoryMatch> {
        let matched_indices = self.trie.search(text);

        let mut matches: Vec<MemoryMatch> = matched_indices
            .iter()
            .map(|&idx| {
                let meta = &self.memories[idx];
                let matched_keywords = find_matched_keywords(text, &meta.keywords);
                let score = matched_keywords.len();

                MemoryMatch {
                    file: meta
                        .file_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    title: meta.title.clone(),
                    matched_keywords,
                    priority: meta.priority.clone(),
                    category: meta.category.clone(),
                    score,
                }
            })
            .collect();

        // 按优先级排序
        matches.sort_by(|a, b| {
            let priority_order = |p: &str| match p {
                "high" => 0,
                "medium" => 1,
                _ => 2,
            };

            priority_order(&b.priority)
                .cmp(&priority_order(&a.priority))
                .then(b.score.cmp(&a.score))
        });

        matches
    }
}

fn find_matched_keywords(text: &str, keywords: &[String]) -> Vec<String> {
    let text_lower = text.to_lowercase();
    keywords
        .iter()
        .filter(|kw| text_lower.contains(&kw.to_lowercase()))
        .cloned()
        .collect()
}

/// 全局记忆索引缓存
static MEMORY_INDEX: Lazy<RwLock<MemoryIndex>> = Lazy::new(|| {
    RwLock::new(MemoryIndex::new())
});

/// Tauri 命令：检测记忆关键词
#[tauri::command]
pub fn detect_memory_keywords(text: String) -> Vec<MemoryMatch> {
    if text.len() < 3 {
        return Vec::new();
    }

    // 🔧 修复：安全地处理锁，避免 panic 导致应用崩溃
    let index = match MEMORY_INDEX.read() {
        Ok(guard) => guard,
        Err(e) => {
            log::error!("[detect_memory_keywords] Failed to acquire read lock: {}", e);
            return Vec::new();
        }
    };

    let matches = index.search(&text);

    log::debug!(
        "[detect_memory_keywords] Found {} matches for: {}",
        matches.len(),
        text
    );

    matches
}

/// Tauri 命令：导入记忆到项目 CLAUDE.md
#[tauri::command]
pub async fn import_memories(
    project_path: String,
    memory_files: Vec<String>,
) -> Result<String, String> {
    let memory_dir = dirs::home_dir()
        .ok_or("Failed to get home directory")?
        .join(".claude")
        .join("memory");

    let project_claude_md = PathBuf::from(&project_path).join("CLAUDE.md");

    // 读取现有项目 CLAUDE.md
    let mut existing_content = if project_claude_md.exists() {
        fs::read_to_string(&project_claude_md)
            .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))?
    } else {
        String::new()
    };

    let mut imported_content = String::new();
    imported_content.push_str("\n\n---\n\n");
    imported_content.push_str("# 📚 导入的项目记忆\n\n");

    let mut imported_count = 0;

    for file in memory_files {
        let memory_path = memory_dir.join(&file);

        // 检查是否已导入过（避免重复）
        if existing_content.contains(&format!("<!-- IMPORTED: {} -->", file)) {
            log::info!("[import_memories] Already imported: {}", file);
            continue;
        }

        // 读取记忆文件
        let content = fs::read_to_string(&memory_path)
            .map_err(|e| format!("Failed to read memory file {}: {}", file, e))?;

        // 移除 YAML frontmatter
        let content_without_yaml = remove_yaml_frontmatter(&content);

        imported_content.push_str(&format!("\n<!-- IMPORTED: {} -->\n", file));
        imported_content.push_str(&content_without_yaml);
        imported_content.push_str("\n");
        imported_count += 1;
    }

    if imported_count > 0 {
        // 追加到文件末尾
        existing_content.push_str(&imported_content);

        // 写入文件
        fs::write(&project_claude_md, existing_content)
            .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

        log::info!("[import_memories] Successfully imported {} files", imported_count);
        Ok(format!("Successfully imported {} memory files", imported_count))
    } else {
        log::info!("[import_memories] No new files to import");
        Err("No new memory files to import".to_string())
    }
}

fn remove_yaml_frontmatter(content: &str) -> String {
    // 🔧 修复：安全地处理正则表达式，避免 panic
    match Regex::new(r"(?s)^---\n.*?\n---\n") {
        Ok(yaml_regex) => yaml_regex.replace(content, "").to_string(),
        Err(e) => {
            log::error!("[remove_yaml_frontmatter] Regex error: {}", e);
            content.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trie_insert_search() {
        let mut trie = TrieNode::default();
        trie.insert("fangyu code", 0);
        trie.insert("tauri", 0);
        trie.insert("pbootcms", 1);

        let results = trie.search("fangyu code test");
        assert!(results.contains(&0));

        let results = trie.search("pbootcms website");
        assert!(results.contains(&1));
    }

    #[test]
    fn test_matched_keywords() {
        let keywords = vec!["fangyu code".to_string(), "tauri".to_string()];
        let matched = find_matched_keywords("fangyu code is great", &keywords);
        assert!(matched.contains(&"fangyu code".to_string()));
        assert!(!matched.contains(&"tauri".to_string()));
    }
}
