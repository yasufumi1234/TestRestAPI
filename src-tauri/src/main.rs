// リリースビルド時に Windows のコンソールウィンドウを非表示にする（削除禁止）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// デスクトップアプリのエントリーポイント
/// lib.rs の run() を呼び出してアプリを起動する
fn main() {
    tauri_app_lib::run()
}
