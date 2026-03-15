//! コレクション関連の DTO（Data Transfer Object）定義
//!
//! リクエストをフォルダ階層で整理・保存するための「コレクション」機能のデータ構造。
//! Postman のコレクション機能と同等の機能を提供する。
//!
//! 構造:
//! - Collection: コレクション全体（名前 + リクエスト + サブフォルダ）
//! - CollectionFolder: コレクション内のフォルダ（再帰的にネスト可能）
//! - SavedRequest: 保存済みリクエスト（メソッド・URL・ヘッダー・ボディ）
//! - CollectionStore: ファイル保存用のルート構造体

use serde::{Deserialize, Serialize};
use specta::Type;

// HTTP 関連の型を再利用する
use super::http::{HttpMethod, KeyValue, RequestBody};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 保存済みリクエスト
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクション内に保存されたリクエスト情報
///
/// 履歴エントリー（HistoryEntry）と異なり、レスポンス情報（status / elapsed_ms）は含まない。
/// ユーザーが「コレクションに保存」操作をしたときに作成される。
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SavedRequest {
    /// 一意な識別子（UUID v4）
    pub id: String,
    /// リクエストの表示名（例: "ユーザー一覧取得"）
    pub name: String,
    /// HTTP メソッド
    pub method: HttpMethod,
    /// リクエスト先の URL
    pub url: String,
    /// カスタムヘッダー一覧
    pub headers: Vec<KeyValue>,
    /// リクエストボディ（None = ボディなし）
    pub body: Option<RequestBody>,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// コレクションフォルダ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクション内のフォルダ（再帰的にネスト可能）
///
/// フォルダ内にリクエストとサブフォルダを含めることができる。
/// ツリー構造でリクエストを整理するために使う。
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CollectionFolder {
    /// 一意な識別子（UUID v4）
    pub id: String,
    /// フォルダの表示名（例: "Users API"）
    pub name: String,
    /// フォルダ内のリクエスト一覧
    pub requests: Vec<SavedRequest>,
    /// サブフォルダの一覧（再帰的にネスト可能）
    pub folders: Vec<CollectionFolder>,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// コレクション
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクション全体を表す構造体
///
/// トップレベルにリクエストとフォルダを含む。
/// 1 つのコレクション = 1 つの JSON ファイルとして保存される。
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Collection {
    /// 一意な識別子（UUID v4）
    pub id: String,
    /// コレクションの表示名（例: "My API"）
    pub name: String,
    /// トップレベルのリクエスト一覧（フォルダに属さないリクエスト）
    pub requests: Vec<SavedRequest>,
    /// トップレベルのフォルダ一覧
    pub folders: Vec<CollectionFolder>,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// コレクションストア（ファイル保存用のルート構造体）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// コレクションデータ全体を表すルート構造体
///
/// JSON ファイルにシリアライズ / デシリアライズする単位。
/// ファイルパス: $APPDATA/com.y123y.tauri-app/collections.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStore {
    /// データフォーマットのバージョン番号
    pub version: u32,
    /// コレクションの配列
    pub collections: Vec<Collection>,
}

impl CollectionStore {
    /// 空のコレクションストアを生成する
    pub fn new() -> Self {
        Self {
            version: 1,
            collections: Vec::new(),
        }
    }
}

impl Default for CollectionStore {
    fn default() -> Self {
        Self::new()
    }
}
