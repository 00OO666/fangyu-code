//! Content search module using ripgrep
//!
//! Provides high-performance file content searching with regex support,
//! case sensitivity options, and concurrent search capabilities.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

/// Search options for content search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    /// Enable regex pattern matching
    pub regex: bool,
    /// Case-sensitive search
    pub case_sensitive: bool,
    /// Match whole words only
    pub whole_word: bool,
    /// Maximum number of results to return
    pub max_results: Option<usize>,
    /// Follow symbolic links
    pub follow_symlinks: bool,
    /// File type filter (e.g., "rs", "ts", "json")
    pub file_type: Option<String>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            regex: false,
            case_sensitive: false,
            whole_word: false,
            max_results: Some(100),
            follow_symlinks: false,
            file_type: None,
        }
    }
}

/// Represents a single search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// File path where the match was found
    pub file_path: String,
    /// Line number (1-indexed)
    pub line_number: usize,
    /// Column number (1-indexed)
    pub column: usize,
    /// The matched line content
    pub line_content: String,
    /// The matched text
    pub matched_text: String,
}

/// Search for content in files using ripgrep
///
/// Performs a high-performance search for a pattern in files within a directory.
/// Supports regex patterns, case sensitivity, and various search options.
///
/// # Arguments
/// * `path` - The directory path to search in
/// * `pattern` - The search pattern (can be regex if options.regex is true)
/// * `options` - Search options (regex, case sensitivity, etc.)
///
/// # Returns
/// * `Ok(Vec<SearchResult>)` - List of search results
/// * `Err(String)` - Error description if the operation fails
#[tauri::command]
pub async fn search_content(
    path: String,
    pattern: String,
    options: SearchOptions,
) -> Result<Vec<SearchResult>, String> {
    log::info!(
        "Searching content in '{}' for pattern: '{}' with options: {:?}",
        path,
        pattern,
        options
    );

    // Validate inputs
    if path.trim().is_empty() {
        log::error!("Search path is empty");
        return Err("Search path cannot be empty".to_string());
    }

    if pattern.trim().is_empty() {
        log::warn!("Search pattern is empty");
        return Ok(Vec::new());
    }

    let search_path = PathBuf::from(&path);

    if !search_path.exists() {
        log::error!("Search path does not exist: {:?}", search_path);
        return Err(format!("Path does not exist: {}", path));
    }

    if !search_path.is_dir() {
        log::error!("Search path is not a directory: {:?}", search_path);
        return Err(format!("Path is not a directory: {}", path));
    }

    // Check if ripgrep is available
    if !is_ripgrep_available() {
        log::error!("ripgrep (rg) is not installed or not in PATH");
        return Err(
            "ripgrep is not installed. Please install ripgrep: https://github.com/BurntSushi/ripgrep#installation".to_string()
        );
    }

    // Build ripgrep command
    let mut cmd = Command::new("rg");

    // Add pattern
    cmd.arg(&pattern);

    // Add path
    cmd.arg(&path);

    // Configure search options
    if options.regex {
        // Regex is enabled by default in ripgrep
        cmd.arg("--regexp");
    } else {
        // Use fixed string matching (no regex)
        cmd.arg("--fixed-strings");
    }

    if !options.case_sensitive {
        cmd.arg("--ignore-case");
    }

    if options.whole_word {
        cmd.arg("--word-regexp");
    }

    if options.follow_symlinks {
        cmd.arg("--follow");
    }

    // Add file type filter if specified
    if let Some(ref file_type) = options.file_type {
        cmd.arg("--type");
        cmd.arg(file_type);
    }

    // Output format: JSON for easier parsing
    cmd.arg("--json");

    // Set max results
    if let Some(max) = options.max_results {
        cmd.arg("--max-count");
        cmd.arg(max.to_string());
    }

    // Exclude common directories
    cmd.arg("--glob");
    cmd.arg("!node_modules");
    cmd.arg("--glob");
    cmd.arg("!.git");
    cmd.arg("--glob");
    cmd.arg("!target");
    cmd.arg("--glob");
    cmd.arg("!dist");
    cmd.arg("--glob");
    cmd.arg("!build");
    cmd.arg("--glob");
    cmd.arg("!.next");
    cmd.arg("--glob");
    cmd.arg("!__pycache__");

    // Execute command
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute ripgrep: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // ripgrep returns exit code 1 when no matches found, which is not an error
        if output.status.code() == Some(1) {
            log::debug!("No matches found for pattern: {}", pattern);
            return Ok(Vec::new());
        }
        log::error!("ripgrep error: {}", stderr);
        return Err(format!("Search failed: {}", stderr));
    }

    // Parse JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.is_empty() {
            continue;
        }

        match parse_ripgrep_json_line(line) {
            Ok(Some(result)) => results.push(result),
            Ok(None) => {
                // Skip non-match lines (like summary)
            }
            Err(e) => {
                log::warn!("Failed to parse ripgrep output line: {}", e);
            }
        }
    }

    log::info!("Found {} search results", results.len());
    Ok(results)
}

/// Check if ripgrep is available on the system
fn is_ripgrep_available() -> bool {
    Command::new("rg")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Parse a single line of ripgrep JSON output
fn parse_ripgrep_json_line(line: &str) -> Result<Option<SearchResult>, String> {
    let json: serde_json::Value =
        serde_json::from_str(line).map_err(|e| format!("JSON parse error: {}", e))?;

    // Check if this is a match line
    if json.get("type").and_then(|v| v.as_str()) != Some("match") {
        return Ok(None);
    }

    let file_path = json
        .get("data")
        .and_then(|d| d.get("path"))
        .and_then(|p| p.as_str())
        .ok_or("Missing file path in JSON")?
        .to_string();

    let line_number = json
        .get("data")
        .and_then(|d| d.get("line_number"))
        .and_then(|n| n.as_u64())
        .ok_or("Missing line number in JSON")? as usize;

    let column = json
        .get("data")
        .and_then(|d| d.get("column"))
        .and_then(|c| c.as_u64())
        .ok_or("Missing column in JSON")? as usize;

    let line_content = json
        .get("data")
        .and_then(|d| d.get("lines"))
        .and_then(|l| l.as_str())
        .ok_or("Missing line content in JSON")?
        .to_string();

    let matched_text = json
        .get("data")
        .and_then(|d| d.get("submatches"))
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("match"))
        .and_then(|t| t.as_str())
        .ok_or("Missing matched text in JSON")?
        .to_string();

    Ok(Some(SearchResult {
        file_path,
        line_number,
        column,
        line_content,
        matched_text,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_content_empty_path() {
        let result = search_content(
            "".to_string(),
            "test".to_string(),
            SearchOptions::default(),
        )
        .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_search_content_empty_pattern() {
        let result = search_content(
            "/tmp".to_string(),
            "".to_string(),
            SearchOptions::default(),
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_search_content_nonexistent_path() {
        let result = search_content(
            "/nonexistent/path/12345".to_string(),
            "test".to_string(),
            SearchOptions::default(),
        )
        .await;
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_ripgrep_json_line() {
        let json_line = r#"{"type":"match","data":{"path":"test.rs","line_number":1,"column":1,"lines":"fn main() {}","submatches":[{"match":"fn","start":0,"end":2}]}}"#;
        let result = parse_ripgrep_json_line(json_line);
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.is_some());
        let search_result = result.unwrap();
        assert_eq!(search_result.file_path, "test.rs");
        assert_eq!(search_result.line_number, 1);
        assert_eq!(search_result.matched_text, "fn");
    }
}
