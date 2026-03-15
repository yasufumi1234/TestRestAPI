//! HTTP リクエスト送信の Tauri Command
//!
//! フロントエンド（React）から invoke("send_request") で呼ばれる。
//! Rust の reqwest を使って HTTP リクエストを実行し、CORS を回避する。

use std::time::Instant; // 経過時間の計測に使用

use reqwest::header::{HeaderMap, HeaderName, HeaderValue}; // HTTP ヘッダー操作
use tracing::{info, warn}; // ログ出力マクロ

// 自作モジュールから必要な型をインポート
use crate::error::{AppError, AppResult};
use crate::types::http::{
    HttpMethod, HttpRequest, HttpResponse, KeyValue, RequestBody, ResponseKeyValue,
};

/// HTTP リクエストを実行する Tauri Command
///
/// フロントエンドから invoke("send_request", { req }) で呼び出される。
/// - HTTP の非 2xx ステータス（401, 404, 500 等）はエラー扱いにしない（Ok で返す）
/// - URL 不正、タイムアウト、ネットワーク断など「送信自体ができない」場合のみ Err
#[tauri::command]  // Tauri Command として登録するためのマクロ
#[specta::specta]  // specta で TypeScript 型を自動生成するためのマクロ
pub async fn send_request(req: HttpRequest) -> AppResult<HttpResponse> {
    // リクエスト情報をログに記録（メソッドと URL）
    info!(method = ?req.method, url = %req.url, "Sending HTTP request");

    // ─── 1. URL バリデーション ───
    // 文字列を URL として解析し、不正な形式ならエラーを返す
    let url = reqwest::Url::parse(&req.url).map_err(|e| {
        warn!(error = %e, url = %req.url, "Invalid URL");
        AppError::invalid_request(
            "URLの形式が正しくありません",
            Some(e.to_string()),
        )
    })?;

    // ─── 2. reqwest HTTP クライアントの構築 ───
    let mut client_builder = reqwest::Client::builder();
    // タイムアウトが指定されていれば設定する（ミリ秒 → Duration に変換）
    if let Some(timeout_ms) = req.timeout_ms {
        client_builder = client_builder.timeout(std::time::Duration::from_millis(timeout_ms));
    }
    // クライアントをビルド（TLS 設定等でまれに失敗する可能性がある）
    let client = client_builder.build().map_err(|e| {
        AppError::unexpected("HTTPクライアントの構築に失敗しました", Some(e.to_string()))
    })?;

    // ─── 3. HTTP メソッドの変換 ───
    // 自作の HttpMethod 列挙型 → reqwest::Method に変換する
    let method = match req.method {
        HttpMethod::GET => reqwest::Method::GET,
        HttpMethod::POST => reqwest::Method::POST,
        HttpMethod::PUT => reqwest::Method::PUT,
        HttpMethod::PATCH => reqwest::Method::PATCH,
        HttpMethod::DELETE => reqwest::Method::DELETE,
    };

    // ─── 4. リクエストの組み立て ───
    // メソッドと URL をセットしたリクエストビルダーを作成
    let mut request_builder = client.request(method, url);

    // カスタムヘッダーを設定（enabled=true かつ key が空でないもののみ）
    let headers = build_headers(&req.headers)?;
    request_builder = request_builder.headers(headers);

    // ─── 5. リクエストボディの設定 ───
    // body が Some の場合のみ Content-Type ヘッダーとボディを設定する
    if let Some(body) = &req.body {
        match body {
            // JSON として送信する場合
            RequestBody::Json { content } => {
                request_builder = request_builder
                    .header("Content-Type", "application/json")
                    .body(content.clone());
            }
            // プレーンテキストとして送信する場合
            RequestBody::Text { content } => {
                request_builder = request_builder
                    .header("Content-Type", "text/plain")
                    .body(content.clone());
            }
        }
    }

    // ─── 6. リクエスト送信と経過時間の計測 ───
    let start = Instant::now(); // 計測開始
    let response = request_builder.send().await.map_err(|e| {
        // エラーの種類に応じて適切な AppError を生成する
        if e.is_timeout() {
            warn!(error = %e, "Request timed out");
            AppError::timeout("リクエストがタイムアウトしました", Some(e.to_string()))
        } else if e.is_connect() {
            warn!(error = %e, "Connection failed");
            AppError::network("接続に失敗しました", Some(e.to_string()))
        } else {
            warn!(error = %e, "Request failed");
            AppError::network("リクエストの送信に失敗しました", Some(e.to_string()))
        }
    })?;
    let elapsed_ms = start.elapsed().as_millis() as u64; // 経過時間（ミリ秒）

    // ─── 7. レスポンスの解析 ───
    // ステータスコードを取得（例: 200, 404, 500）
    let status = response.status().as_u16();

    // レスポンスヘッダーを Key-Value のリストに変換する
    let response_headers: Vec<ResponseKeyValue> = response
        .headers()
        .iter()
        .map(|(k, v)| ResponseKeyValue {
            key: k.to_string(),
            // バイナリ値の場合は "<binary>" と表示する
            value: v.to_str().unwrap_or("<binary>").to_string(),
        })
        .collect();

    // レスポンスボディをバイト列として読み取る
    let body_bytes = response.bytes().await.map_err(|e| {
        AppError::network("レスポンスボディの読み取りに失敗しました", Some(e.to_string()))
    })?;
    let size_bytes = body_bytes.len() as u64; // ボディのサイズ（バイト数）
    // バイト列を UTF-8 文字列に変換（不正な文字は置換文字 U+FFFD に変換）
    let body = String::from_utf8_lossy(&body_bytes).to_string();

    // レスポンス情報をログに記録
    info!(status, elapsed_ms, size_bytes, "Response received");

    // ─── 8. フロントエンドに返すレスポンス構造体を組み立てる ───
    Ok(HttpResponse {
        status,
        headers: response_headers,
        body,
        elapsed_ms,
        size_bytes,
    })
}

/// KeyValue 配列から reqwest 用の HeaderMap を構築するヘルパー関数
///
/// - enabled=true かつ key が空でない行のみを対象にする
/// - ヘッダー名やヘッダー値が不正な場合は AppError を返す
fn build_headers(headers: &[KeyValue]) -> AppResult<HeaderMap> {
    // 空の HeaderMap を用意
    let mut header_map = HeaderMap::new();

    // enabled=true かつ key が空でないヘッダーのみを処理する
    for kv in headers.iter().filter(|h| h.enabled && !h.key.is_empty()) {
        // 文字列 → HeaderName に変換（不正な文字が含まれていればエラー）
        let name = HeaderName::from_bytes(kv.key.as_bytes()).map_err(|e| {
            AppError::invalid_request(
                format!("ヘッダー名 '{}' が不正です", kv.key),
                Some(e.to_string()),
            )
        })?;
        // 文字列 → HeaderValue に変換（不正な文字が含まれていればエラー）
        let value = HeaderValue::from_str(&kv.value).map_err(|e| {
            AppError::invalid_request(
                format!("ヘッダー値 '{}' が不正です", kv.value),
                Some(e.to_string()),
            )
        })?;
        // ヘッダーを追加（同名のヘッダーがあれば上書き）
        header_map.insert(name, value);
    }

    Ok(header_map)
}
