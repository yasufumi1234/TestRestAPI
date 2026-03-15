use serde::{Deserialize, Serialize};
use specta::Type;

/// アプリ全体で使用する Result 型エイリアス
/// 成功時は T、失敗時は AppError を返す
pub type AppResult<T> = Result<T, AppError>;

/// フロントエンドに返す統一エラー型
/// Tauri Command の戻り値 Err として使用し、specta で TypeScript 型を自動生成する
/// thiserror::Error を derive して Display トレイトを自動実装（{message} を表示）
#[derive(Debug, Clone, Serialize, Deserialize, Type, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    /// エラーの種別コード（フロントエンドでエラー種別を判別するために使用）
    pub code: AppErrorCode,
    /// UI に表示するユーザー向けエラーメッセージ（機密情報を含めない）
    pub message: String,
    /// 開発中のデバッグ用詳細情報（ユーザーには表示しない前提）
    pub detail: Option<String>,
}

/// エラーの種別を表す列挙型
/// フロントエンド側で switch/case で分岐するために使う
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum AppErrorCode {
    InvalidRequest, // URL 不正、ヘッダー不正などリクエスト内容の問題
    Network,        // DNS 失敗、接続拒否などネットワーク系の問題
    Timeout,        // リクエストのタイムアウト
    Io,             // ファイル I/O 関連の問題（Phase 3 の履歴保存で使用予定）
    Serialize,      // JSON シリアライズ / デシリアライズの失敗
    Unexpected,     // 上記に分類できない予期しないエラー
}

/// AppError のファクトリメソッド群
/// エラー種別ごとに簡潔にインスタンスを生成するためのヘルパー
impl AppError {
    /// リクエスト内容に問題がある場合のエラーを生成する（URL 不正、ヘッダー不正等）
    pub fn invalid_request(message: impl Into<String>, detail: Option<String>) -> Self {
        Self {
            code: AppErrorCode::InvalidRequest,
            message: message.into(),
            detail,
        }
    }

    /// ネットワーク関連のエラーを生成する（DNS 失敗、接続拒否等）
    pub fn network(message: impl Into<String>, detail: Option<String>) -> Self {
        Self {
            code: AppErrorCode::Network,
            message: message.into(),
            detail,
        }
    }

    /// タイムアウトエラーを生成する
    pub fn timeout(message: impl Into<String>, detail: Option<String>) -> Self {
        Self {
            code: AppErrorCode::Timeout,
            message: message.into(),
            detail,
        }
    }

    /// ファイル I/O エラーを生成する（Phase 3 以降で使用予定）
    pub fn io(message: impl Into<String>, detail: Option<String>) -> Self {
        Self {
            code: AppErrorCode::Io,
            message: message.into(),
            detail,
        }
    }

    /// 予期しないエラーを生成する（分類不能なケース用）
    pub fn unexpected(message: impl Into<String>, detail: Option<String>) -> Self {
        Self {
            code: AppErrorCode::Unexpected,
            message: message.into(),
            detail,
        }
    }
}
