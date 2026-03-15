//! HTTP リクエスト / レスポンスの DTO（Data Transfer Object）定義
//!
//! フロントエンド（React）とバックエンド（Rust）の間でやり取りするデータ構造。
//! specta::Type を derive することで、TypeScript 型が自動生成される。
//! serde の Serialize / Deserialize で JSON 変換を行う。

use serde::{Deserialize, Serialize};
use specta::Type;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// リクエスト関連の型
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// ヘッダーやクエリパラメータなど、Key-Value ペアを表す汎用構造体
/// enabled フラグで一時的に無効化できる（UI でチェックボックスを OFF にした状態）
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyValue {
    pub key: String,    // ヘッダー名（例: "Content-Type"）
    pub value: String,  // ヘッダー値（例: "application/json"）
    pub enabled: bool,  // true のときのみリクエストに含める
}

/// HTTP メソッドの列挙型
/// フロントエンドのドロップダウンで選択される値と対応する
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum HttpMethod {
    GET,    // リソースの取得
    POST,   // リソースの作成
    PUT,    // リソースの全体更新
    PATCH,  // リソースの部分更新
    DELETE, // リソースの削除
}

/// リクエストボディの種別
/// UI の「Body 種別」切り替え（JSON / Text）に対応する
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum RequestBody {
    /// プレーンテキストとして送信する（Content-Type: text/plain）
    Text { content: String },
    /// JSON として送信する（Content-Type: application/json）
    Json { content: String },
}

/// フロントエンドから Tauri Command に渡すリクエスト情報
/// send_request コマンドの引数として使用する
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HttpRequest {
    pub method: HttpMethod,       // 使用する HTTP メソッド
    pub url: String,              // リクエスト先の URL
    pub headers: Vec<KeyValue>,   // カスタムヘッダー一覧（enabled=false は除外される）
    pub body: Option<RequestBody>,// リクエストボディ（GET/DELETE では None）
    pub timeout_ms: Option<u64>,  // タイムアウト時間（ミリ秒）。None ならデフォルト
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// レスポンス関連の型
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// レスポンスヘッダーの Key-Value ペア
/// リクエスト側の KeyValue と異なり enabled フラグは不要
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ResponseKeyValue {
    pub key: String,   // ヘッダー名（例: "content-type"）
    pub value: String,  // ヘッダー値（例: "application/json; charset=utf-8"）
}

/// Tauri Command からフロントエンドに返すレスポンス情報
/// HTTP ステータスが 4xx/5xx でもエラーにせず、この構造体に格納して返す
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HttpResponse {
    pub status: u16,                    // HTTP ステータスコード（例: 200, 404, 500）
    pub headers: Vec<ResponseKeyValue>, // レスポンスヘッダー一覧
    pub body: String,                   // レスポンスボディ（UTF-8 テキスト）
    pub elapsed_ms: u64,                // リクエスト〜レスポンス完了までの所要時間（ミリ秒）
    pub size_bytes: u64,                // レスポンスボディのサイズ（バイト数）
}
