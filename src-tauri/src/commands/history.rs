//! リクエスト履歴の永続化を行う Tauri Command
//!
//! 履歴データは JSON ファイルとしてアプリデータディレクトリに保存する。
//! ファイルパス: $APPDATA/com.y123y.tauri-app/history.json
//!
//! 提供するコマンド:
//! - save_history_entry: 新しい履歴エントリーを追加する
//! - get_history: 全履歴エントリーを取得する
//! - delete_history_entry: 指定した ID の履歴エントリーを削除する
//! - clear_history: 全履歴を削除する

use std::fs; // ファイルシステム操作
use std::path::PathBuf; // パス操作

use tauri::Manager; // Tauri のアプリハンドル操作（path() 取得用）
use tracing::{info, warn}; // ログ出力マクロ

use crate::error::{AppError, AppResult};
use crate::types::history::{HistoryEntry, HistoryStore, MAX_HISTORY_ENTRIES};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ファイルパス解決
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// 履歴 JSON ファイルのパスを取得するヘルパー関数
///
/// Tauri の app_data_dir() を利用して OS ごとに適切な場所に保存する。
/// - Windows: %APPDATA%/com.y123y.tauri-app/history.json
/// - macOS:   ~/Library/Application Support/com.y123y.tauri-app/history.json
/// - Linux:   ~/.local/share/com.y123y.tauri-app/history.json
fn get_history_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    // Tauri のアプリデータディレクトリを取得する
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| {
            AppError::io(
                "アプリデータディレクトリの取得に失敗しました",
                Some(e.to_string()),
            )
        })?;

    // ディレクトリが存在しない場合は再帰的に作成する
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| {
            AppError::io(
                "アプリデータディレクトリの作成に失敗しました",
                Some(e.to_string()),
            )
        })?;
    }

    // ディレクトリパスに "history.json" を結合して返す
    Ok(app_data_dir.join("history.json"))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ファイル読み書きヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// 履歴ファイルを読み込んで HistoryStore を返すヘルパー関数
///
/// ファイルが存在しない場合は空の HistoryStore を返す（初回起動時）。
/// ファイルが壊れている場合もログを出して空の HistoryStore にフォールバックする。
fn load_store(path: &PathBuf) -> HistoryStore {
    // ファイルが存在しない場合は空のストアを返す
    if !path.exists() {
        info!("History file not found, creating new store");
        return HistoryStore::new();
    }

    // ファイルを読み込む
    match fs::read_to_string(path) {
        Ok(content) => {
            // JSON をパースして HistoryStore に変換する
            match serde_json::from_str::<HistoryStore>(&content) {
                Ok(store) => {
                    info!(count = store.entries.len(), "History loaded");
                    store
                }
                Err(e) => {
                    // JSON のパースに失敗した場合（ファイル破損等）
                    // データを失うよりも空のストアで続行する方が安全
                    warn!(error = %e, "Failed to parse history file, resetting");
                    HistoryStore::new()
                }
            }
        }
        Err(e) => {
            // ファイルの読み込みに失敗した場合
            warn!(error = %e, "Failed to read history file, resetting");
            HistoryStore::new()
        }
    }
}

/// HistoryStore を JSON ファイルに書き込むヘルパー関数
///
/// JSON は整形（pretty print）して保存する。
/// 人間がファイルを直接確認・編集できるようにするため。
fn save_store(path: &PathBuf, store: &HistoryStore) -> AppResult<()> {
    // HistoryStore → JSON 文字列に変換（整形付き）
    let json = serde_json::to_string_pretty(store).map_err(|e| {
        AppError::io(
            "履歴データのシリアライズに失敗しました",
            Some(e.to_string()),
        )
    })?;

    // JSON 文字列をファイルに書き込む
    fs::write(path, json).map_err(|e| {
        AppError::io("履歴ファイルの書き込みに失敗しました", Some(e.to_string()))
    })?;

    info!(path = %path.display(), "History saved");
    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tauri Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// 新しい履歴エントリーを保存する Tauri Command
///
/// フロントエンドから invoke("save_history_entry", { entry }) で呼び出される。
/// - 新しいエントリーを配列の先頭に追加する（新しい順）
/// - MAX_HISTORY_ENTRIES を超えた場合は古いエントリーから削除する
#[tauri::command]
#[specta::specta]
pub async fn save_history_entry(
    app: tauri::AppHandle, // Tauri のアプリハンドル（ファイルパス取得に使用）
    entry: HistoryEntry,   // 保存する履歴エントリー
) -> AppResult<()> {
    info!(id = %entry.id, method = ?entry.method, url = %entry.url, "Saving history entry");

    // 履歴ファイルのパスを取得する
    let path = get_history_path(&app)?;
    // 既存の履歴データを読み込む
    let mut store = load_store(&path);

    // 新しいエントリーを配列の先頭に追加する（最新が先頭に来る）
    store.entries.insert(0, entry);

    // 最大件数を超えた場合は末尾（＝最も古い）から削除する
    if store.entries.len() > MAX_HISTORY_ENTRIES {
        store.entries.truncate(MAX_HISTORY_ENTRIES);
        info!("History truncated to {} entries", MAX_HISTORY_ENTRIES);
    }

    // 更新した履歴データをファイルに書き戻す
    save_store(&path, &store)?;

    Ok(())
}

/// 全履歴エントリーを取得する Tauri Command
///
/// フロントエンドから invoke("get_history") で呼び出される。
/// サイドバーの履歴一覧表示に使用する。
/// 新しい順（タイムスタンプ降順）で返す。
#[tauri::command]
#[specta::specta]
pub async fn get_history(
    app: tauri::AppHandle, // Tauri のアプリハンドル（ファイルパス取得に使用）
) -> AppResult<Vec<HistoryEntry>> {
    info!("Loading history");

    // 履歴ファイルのパスを取得する
    let path = get_history_path(&app)?;
    // 既存の履歴データを読み込む
    let store = load_store(&path);

    info!(count = store.entries.len(), "History entries loaded");

    // エントリー配列を返す（既に新しい順にソート済み）
    Ok(store.entries)
}

/// 指定した ID の履歴エントリーを削除する Tauri Command
///
/// フロントエンドから invoke("delete_history_entry", { id }) で呼び出される。
/// サイドバーの履歴一覧で個別削除ボタンを押したときに使用する。
#[tauri::command]
#[specta::specta]
pub async fn delete_history_entry(
    app: tauri::AppHandle, // Tauri のアプリハンドル（ファイルパス取得に使用）
    id: String,            // 削除対象の履歴エントリー ID（UUID）
) -> AppResult<()> {
    info!(id = %id, "Deleting history entry");

    // 履歴ファイルのパスを取得する
    let path = get_history_path(&app)?;
    // 既存の履歴データを読み込む
    let mut store = load_store(&path);

    // 削除前の件数を記録（ログ用）
    let before_count = store.entries.len();

    // 指定した ID のエントリーを除外する
    store.entries.retain(|e| e.id != id);

    // 削除後の件数を記録（ログ用）
    let deleted_count = before_count - store.entries.len();
    info!(deleted = deleted_count, remaining = store.entries.len(), "History entry deleted");

    // 更新した履歴データをファイルに書き戻す
    save_store(&path, &store)?;

    Ok(())
}

/// 全履歴を削除する Tauri Command
///
/// フロントエンドから invoke("clear_history") で呼び出される。
/// サイドバーの「全履歴削除」ボタンを押したときに使用する。
#[tauri::command]
#[specta::specta]
pub async fn clear_history(
    app: tauri::AppHandle, // Tauri のアプリハンドル（ファイルパス取得に使用）
) -> AppResult<()> {
    info!("Clearing all history");

    // 履歴ファイルのパスを取得する
    let path = get_history_path(&app)?;

    // 空の HistoryStore を作成してファイルに書き込む
    let store = HistoryStore::new();
    save_store(&path, &store)?;

    info!("History cleared");
    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// テスト
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::http::HttpMethod;
    use std::io::Write;
    use tempfile::NamedTempFile;

    /// テスト用のダミー HistoryEntry を生成するヘルパー
    fn create_test_entry(id: &str, url: &str) -> HistoryEntry {
        HistoryEntry {
            id: id.to_string(),
            method: HttpMethod::GET,
            url: url.to_string(),
            headers: vec![],
            body: None,
            status: Some(200),
            elapsed_ms: Some(123),
            timestamp: "2026-03-04T12:00:00+09:00".to_string(),
        }
    }

    /// HistoryStore のシリアライズ / デシリアライズが正しく動作するかテスト
    #[test]
    fn test_history_store_serialization() {
        // 空のストアを作成してシリアライズ
        let store = HistoryStore::new();
        let json = serde_json::to_string(&store).expect("Failed to serialize");

        // デシリアライズして内容を検証
        let deserialized: HistoryStore =
            serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.version, 1);
        assert_eq!(deserialized.entries.len(), 0);
    }

    /// HistoryEntry のシリアライズ / デシリアライズが正しく動作するかテスト
    #[test]
    fn test_history_entry_serialization() {
        let entry = create_test_entry("test-id-1", "https://api.example.com/users");

        // シリアライズ → デシリアライズの往復が正しいか確認
        let json = serde_json::to_string(&entry).expect("Failed to serialize");
        let deserialized: HistoryEntry =
            serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(deserialized.id, "test-id-1");
        assert_eq!(deserialized.url, "https://api.example.com/users");
        assert_eq!(deserialized.status, Some(200));
    }

    /// エントリー付き HistoryStore のシリアライズ / デシリアライズテスト
    #[test]
    fn test_history_store_with_entries() {
        let mut store = HistoryStore::new();

        // 3 件のエントリーを追加
        store
            .entries
            .push(create_test_entry("id-1", "https://example.com/1"));
        store
            .entries
            .push(create_test_entry("id-2", "https://example.com/2"));
        store
            .entries
            .push(create_test_entry("id-3", "https://example.com/3"));

        // シリアライズ → デシリアライズ
        let json = serde_json::to_string_pretty(&store).expect("Failed to serialize");
        let deserialized: HistoryStore =
            serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(deserialized.entries.len(), 3);
        assert_eq!(deserialized.entries[0].id, "id-1");
        assert_eq!(deserialized.entries[2].id, "id-3");
    }

    /// load_store がファイル不存在時に空のストアを返すかテスト
    #[test]
    fn test_load_store_file_not_found() {
        let path = PathBuf::from("/tmp/nonexistent_history_test.json");
        let store = load_store(&path);

        assert_eq!(store.version, 1);
        assert_eq!(store.entries.len(), 0);
    }

    /// load_store が正しい JSON ファイルを読み込めるかテスト
    #[test]
    fn test_load_store_valid_file() {
        // テスト用の一時ファイルに有効な JSON を書き込む
        let mut tmp = NamedTempFile::new().expect("Failed to create temp file");
        let store = HistoryStore {
            version: 1,
            entries: vec![create_test_entry("id-1", "https://example.com")],
        };
        let json = serde_json::to_string(&store).expect("Failed to serialize");
        write!(tmp, "{}", json).expect("Failed to write");

        // load_store で読み込む
        let loaded = load_store(&tmp.path().to_path_buf());
        assert_eq!(loaded.entries.len(), 1);
        assert_eq!(loaded.entries[0].id, "id-1");
    }

    /// load_store が壊れた JSON ファイルでも空ストアにフォールバックするかテスト
    #[test]
    fn test_load_store_corrupted_file() {
        // テスト用の一時ファイルに壊れた JSON を書き込む
        let mut tmp = NamedTempFile::new().expect("Failed to create temp file");
        write!(tmp, "{{invalid json}}").expect("Failed to write");

        // load_store が空のストアにフォールバックすることを確認
        let loaded = load_store(&tmp.path().to_path_buf());
        assert_eq!(loaded.version, 1);
        assert_eq!(loaded.entries.len(), 0);
    }

    /// save_store がファイルに正しく書き込めるかテスト
    #[test]
    fn test_save_store() {
        let tmp = NamedTempFile::new().expect("Failed to create temp file");
        let path = tmp.path().to_path_buf();

        // エントリー付きのストアを保存
        let store = HistoryStore {
            version: 1,
            entries: vec![
                create_test_entry("id-1", "https://example.com/1"),
                create_test_entry("id-2", "https://example.com/2"),
            ],
        };
        save_store(&path, &store).expect("Failed to save");

        // ファイルを読み直して内容を検証
        let loaded = load_store(&path);
        assert_eq!(loaded.entries.len(), 2);
        assert_eq!(loaded.entries[0].id, "id-1");
        assert_eq!(loaded.entries[1].id, "id-2");
    }

    /// MAX_HISTORY_ENTRIES の上限が正しく定義されているかテスト
    #[test]
    fn test_max_history_entries() {
        assert_eq!(MAX_HISTORY_ENTRIES, 200);
    }

    /// HistoryStore::default() が空のストアを返すかテスト
    #[test]
    fn test_history_store_default() {
        let store = HistoryStore::default();
        assert_eq!(store.version, 1);
        assert!(store.entries.is_empty());
    }
}
