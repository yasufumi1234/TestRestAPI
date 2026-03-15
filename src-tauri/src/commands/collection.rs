//! コレクション管理の Tauri Command
//!
//! コレクションデータは JSON ファイルとしてアプリデータディレクトリに保存する。
//! ファイルパス: $APPDATA/com.y123y.tauri-app/collections.json
//!
//! 提供するコマンド:
//! - get_collections: 全コレクションを取得する
//! - save_collections: コレクション全体を上書き保存する

use std::fs;
use std::path::PathBuf;

use tauri::Manager;
use tracing::{info, warn};

use crate::error::{AppError, AppResult};
use crate::types::collection::{Collection, CollectionStore};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ファイルパス解決
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクション JSON ファイルのパスを取得するヘルパー関数
///
/// 履歴ファイル（history.rs）と同じディレクトリに保存する。
/// - Windows: %APPDATA%/com.y123y.tauri-app/collections.json
fn get_collections_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| {
            AppError::io(
                "アプリデータディレクトリの取得に失敗しました",
                Some(e.to_string()),
            )
        })?;

    // ディレクトリが存在しない場合は作成する
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).map_err(|e| {
            AppError::io(
                "アプリデータディレクトリの作成に失敗しました",
                Some(e.to_string()),
            )
        })?;
    }

    Ok(app_data_dir.join("collections.json"))
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ファイル読み書きヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクションファイルを読み込んで CollectionStore を返すヘルパー関数
///
/// ファイルが存在しない場合は空の CollectionStore を返す。
/// ファイルが壊れている場合もログを出して空にフォールバックする。
fn load_store(path: &PathBuf) -> CollectionStore {
    if !path.exists() {
        info!("Collections file not found, creating new store");
        return CollectionStore::new();
    }

    match fs::read_to_string(path) {
        Ok(content) => {
            match serde_json::from_str::<CollectionStore>(&content) {
                Ok(store) => {
                    info!(count = store.collections.len(), "Collections loaded");
                    store
                }
                Err(e) => {
                    warn!(error = %e, "Failed to parse collections file, resetting");
                    CollectionStore::new()
                }
            }
        }
        Err(e) => {
            warn!(error = %e, "Failed to read collections file, resetting");
            CollectionStore::new()
        }
    }
}

/// CollectionStore を JSON ファイルに書き込むヘルパー関数
fn save_store(path: &PathBuf, store: &CollectionStore) -> AppResult<()> {
    let json = serde_json::to_string_pretty(store).map_err(|e| {
        AppError::io(
            "コレクションデータのシリアライズに失敗しました",
            Some(e.to_string()),
        )
    })?;

    fs::write(path, json).map_err(|e| {
        AppError::io(
            "コレクションファイルの書き込みに失敗しました",
            Some(e.to_string()),
        )
    })?;

    info!(path = %path.display(), "Collections saved");
    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tauri Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// 全コレクションを取得する Tauri Command
///
/// フロントエンドから invoke("get_collections") で呼び出される。
/// サイドバーのコレクションツリー表示に使用する。
#[tauri::command]
#[specta::specta]
pub async fn get_collections(
    app: tauri::AppHandle,
) -> AppResult<Vec<Collection>> {
    info!("Loading collections");

    let path = get_collections_path(&app)?;
    let store = load_store(&path);

    info!(count = store.collections.len(), "Collections loaded");
    Ok(store.collections)
}

/// コレクション全体を上書き保存する Tauri Command
///
/// フロントエンドから invoke("save_collections", { collections }) で呼び出される。
/// コレクションの追加・削除・編集のたびに全体をまとめて保存する。
/// （個別操作の API を作るより、フロントエンドで state を管理して一括保存する方がシンプル）
#[tauri::command]
#[specta::specta]
pub async fn save_collections(
    app: tauri::AppHandle,
    collections: Vec<Collection>,
) -> AppResult<()> {
    info!(count = collections.len(), "Saving collections");

    let path = get_collections_path(&app)?;
    let store = CollectionStore {
        version: 1,
        collections,
    };

    save_store(&path, &store)?;
    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// テスト
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::collection::{CollectionFolder, SavedRequest};
    use crate::types::http::HttpMethod;
    use std::io::Write;
    use tempfile::NamedTempFile;

    /// テスト用のダミー SavedRequest を生成するヘルパー
    fn create_test_request(id: &str, name: &str) -> SavedRequest {
        SavedRequest {
            id: id.to_string(),
            name: name.to_string(),
            method: HttpMethod::GET,
            url: "https://api.example.com/test".to_string(),
            headers: vec![],
            body: None,
        }
    }

    /// テスト用のダミー Collection を生成するヘルパー
    fn create_test_collection(id: &str, name: &str) -> Collection {
        Collection {
            id: id.to_string(),
            name: name.to_string(),
            requests: vec![create_test_request("req-1", "Test Request")],
            folders: vec![CollectionFolder {
                id: "folder-1".to_string(),
                name: "Test Folder".to_string(),
                requests: vec![create_test_request("req-2", "Folder Request")],
                folders: vec![],
            }],
        }
    }

    /// CollectionStore のシリアライズ / デシリアライズテスト
    #[test]
    fn test_collection_store_serialization() {
        let store = CollectionStore::new();
        let json = serde_json::to_string(&store).expect("Failed to serialize");
        let deserialized: CollectionStore =
            serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.version, 1);
        assert_eq!(deserialized.collections.len(), 0);
    }

    /// Collection のシリアライズ / デシリアライズテスト（ネストあり）
    #[test]
    fn test_collection_with_folders() {
        let collection = create_test_collection("col-1", "My API");

        let json = serde_json::to_string_pretty(&collection).expect("Failed to serialize");
        let deserialized: Collection =
            serde_json::from_str(&json).expect("Failed to deserialize");

        assert_eq!(deserialized.id, "col-1");
        assert_eq!(deserialized.name, "My API");
        assert_eq!(deserialized.requests.len(), 1);
        assert_eq!(deserialized.folders.len(), 1);
        assert_eq!(deserialized.folders[0].requests.len(), 1);
    }

    /// load_store がファイル不存在時に空ストアを返すかテスト
    #[test]
    fn test_load_store_file_not_found() {
        let path = PathBuf::from("/tmp/nonexistent_collections_test.json");
        let store = load_store(&path);
        assert_eq!(store.version, 1);
        assert_eq!(store.collections.len(), 0);
    }

    /// load_store が正しい JSON を読み込めるかテスト
    #[test]
    fn test_load_store_valid_file() {
        let mut tmp = NamedTempFile::new().expect("Failed to create temp file");
        let store = CollectionStore {
            version: 1,
            collections: vec![create_test_collection("col-1", "My API")],
        };
        let json = serde_json::to_string(&store).expect("Failed to serialize");
        write!(tmp, "{}", json).expect("Failed to write");

        let loaded = load_store(&tmp.path().to_path_buf());
        assert_eq!(loaded.collections.len(), 1);
        assert_eq!(loaded.collections[0].name, "My API");
    }

    /// save_store → load_store の往復テスト
    #[test]
    fn test_save_and_load() {
        let tmp = NamedTempFile::new().expect("Failed to create temp file");
        let path = tmp.path().to_path_buf();

        let store = CollectionStore {
            version: 1,
            collections: vec![
                create_test_collection("col-1", "API 1"),
                create_test_collection("col-2", "API 2"),
            ],
        };
        save_store(&path, &store).expect("Failed to save");

        let loaded = load_store(&path);
        assert_eq!(loaded.collections.len(), 2);
        assert_eq!(loaded.collections[0].name, "API 1");
        assert_eq!(loaded.collections[1].name, "API 2");
    }
}
