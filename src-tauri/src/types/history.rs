//! リクエスト履歴の DTO（Data Transfer Object）定義
//!
//! HTTP リクエストの送信履歴をファイルに保存・復元するためのデータ構造。
//! 各履歴エントリーは UUID で一意に識別され、タイムスタンプ付きで記録される。
//! specta::Type を derive することで、TypeScript 型が自動生成される。

use serde::{Deserialize, Serialize};
use specta::Type;

// 同じモジュール内の HTTP 関連の型をインポート
use super::http::{HttpMethod, KeyValue, RequestBody};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 履歴エントリー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// リクエスト履歴の 1 エントリー
///
/// HTTP リクエストを送信するたびに 1 件ずつ作成される。
/// サイドバーの履歴一覧に表示し、クリックすると過去のリクエスト内容を復元できる。
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HistoryEntry {
    /// 一意な識別子（UUID v4 で生成。例: "550e8400-e29b-41d4-a716-446655440000"）
    pub id: String,
    /// 使用した HTTP メソッド（GET / POST / PUT / PATCH / DELETE）
    pub method: HttpMethod,
    /// リクエスト先の URL（例: "https://api.example.com/users"）
    pub url: String,
    /// 送信したカスタムヘッダー一覧（Key-Value ペア）
    pub headers: Vec<KeyValue>,
    /// 送信したリクエストボディ（None = ボディなし）
    pub body: Option<RequestBody>,
    /// レスポンスの HTTP ステータスコード（例: 200, 404）
    /// リクエスト送信に失敗した場合は None
    pub status: Option<u16>,
    /// リクエスト〜レスポンスの所要時間（ミリ秒）
    /// リクエスト送信に失敗した場合は None
    pub elapsed_ms: Option<u64>,
    /// 履歴を記録した日時（ISO 8601 形式の文字列。例: "2026-03-04T15:30:00+09:00"）
    /// chrono::Local::now() で生成し、to_rfc3339() で文字列化する
    pub timestamp: String,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 履歴ストア（ファイル保存用のルート構造体）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// 履歴データ全体を表すルート構造体
///
/// JSON ファイルにシリアライズ / デシリアライズする単位。
/// ファイルパス: $APPDATA/com.y123y.tauri-app/history.json
///
/// 構造:
/// {
///   "version": 1,
///   "entries": [ { ... }, { ... }, ... ]
/// }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryStore {
    /// データフォーマットのバージョン番号
    /// 将来のマイグレーション時に互換性チェックに使う
    pub version: u32,
    /// 履歴エントリーの配列（新しい順にソートされる）
    pub entries: Vec<HistoryEntry>,
}

impl HistoryStore {
    /// 空の履歴ストアを生成する
    /// 履歴ファイルが存在しない場合の初期値として使用する
    pub fn new() -> Self {
        Self {
            version: 1,       // 初期バージョン
            entries: Vec::new(), // 空の配列
        }
    }
}

impl Default for HistoryStore {
    fn default() -> Self {
        Self::new()
    }
}

/// 履歴の最大保存件数
/// この件数を超えた場合、古い履歴から自動的に削除される
pub const MAX_HISTORY_ENTRIES: usize = 200;
