use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};

/// 文件变化事件类型
#[derive(Debug, Clone, serde::Serialize)]
pub enum FileChangeType {
    Created,
    Modified,
    Deleted,
}

/// 文件变化事件
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileChangeEvent {
    pub path: String,
    pub change_type: FileChangeType,
    pub timestamp: i64,
}

/// 文件系统监控器
pub struct FileSystemWatcher {
    watcher: Option<RecommendedWatcher>,
    event_receiver: Arc<Mutex<Receiver<FileChangeEvent>>>,
    is_watching: Arc<Mutex<bool>>,
}

impl FileSystemWatcher {
    /// 创建新的文件系统监控器
    pub fn new() -> Self {
        let (_tx, rx) = channel();

        Self {
            watcher: None,
            event_receiver: Arc::new(Mutex::new(rx)),
            is_watching: Arc::new(Mutex::new(false)),
        }
    }

    /// 开始监控指定目录
    pub fn start_watching(&mut self, path: PathBuf) -> Result<(), String> {
        // 检查是否已经在监控
        {
            let is_watching = self
                .is_watching
                .lock()
                .map_err(|_| "Watcher state lock poisoned".to_string())?;
            if *is_watching {
                return Err("Already watching".to_string());
            }
        }

        let (tx, rx) = channel();
        let event_tx = tx.clone();

        // 创建 watcher
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    Self::handle_event(event, &event_tx);
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

        // 开始监控
        watcher
            .watch(&path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        self.watcher = Some(watcher);
        self.event_receiver = Arc::new(Mutex::new(rx));

        {
            let mut is_watching = self
                .is_watching
                .lock()
                .map_err(|_| "Watcher state lock poisoned".to_string())?;
            *is_watching = true;
        }

        log::info!("[FileSystemWatcher] Started watching: {:?}", path);
        Ok(())
    }

    /// 停止监控
    pub fn stop_watching(&mut self) -> Result<(), String> {
        {
            let mut is_watching = self
                .is_watching
                .lock()
                .map_err(|_| "Watcher state lock poisoned".to_string())?;
            if !*is_watching {
                return Err("Not watching".to_string());
            }
            *is_watching = false;
        }

        self.watcher = None;
        log::info!("[FileSystemWatcher] Stopped watching");
        Ok(())
    }

    /// 获取文件变化事件
    pub fn get_events(&self) -> Vec<FileChangeEvent> {
        let receiver = match self.event_receiver.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        let mut events = Vec::new();

        // 非阻塞地获取所有可用事件
        while let Ok(event) = receiver.try_recv() {
            events.push(event);
        }

        events
    }

    /// 处理文件系统事件
    fn handle_event(event: Event, tx: &Sender<FileChangeEvent>) {
        use notify::EventKind;

        let change_type = match event.kind {
            EventKind::Create(_) => FileChangeType::Created,
            EventKind::Modify(_) => FileChangeType::Modified,
            EventKind::Remove(_) => FileChangeType::Deleted,
            _ => return, // 忽略其他事件
        };

        let timestamp = chrono::Utc::now().timestamp();

        for path in event.paths {
            // 只关注 sessions-index.json 和 .jsonl 文件
            if let Some(file_name) = path.file_name() {
                let file_name_str = file_name.to_string_lossy();
                if file_name_str == "sessions-index.json" || file_name_str.ends_with(".jsonl") {
                    let change_event = FileChangeEvent {
                        path: path.to_string_lossy().to_string(),
                        change_type: change_type.clone(),
                        timestamp,
                    };

                    if let Err(e) = tx.send(change_event) {
                        log::error!("[FileSystemWatcher] Failed to send event: {}", e);
                    }
                }
            }
        }
    }

    /// 检查是否正在监控
    pub fn is_watching(&self) -> bool {
        match self.is_watching.lock() {
            Ok(guard) => *guard,
            Err(poison) => *poison.into_inner(),
        }
    }
}

impl Default for FileSystemWatcher {
    fn default() -> Self {
        Self::new()
    }
}
