/**
 * vite.config.ts - Vite ビルド設定
 *
 * Tauri 開発に特化した設定を含む。
 * - React プラグイン: JSX/TSX のトランスパイル
 * - Tailwind CSS プラグイン: ユーティリティクラスの処理
 * - パスエイリアス: @ → src/ のマッピング
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // React の JSX 変換・HMR サポート
import tailwindcss from '@tailwindcss/vite'; // Tailwind CSS v4 の Vite プラグイン
import path from 'path'; // パスエイリアス解決用

// Tauri がモバイル開発時に設定する環境変数（デスクトップでは未定義）
// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  // ─── プラグイン ───
  plugins: [
    react(), // React サポート（JSX 変換・Fast Refresh）
    tailwindcss(), // Tailwind CSS のビルド時処理
  ],

  // ─── パスエイリアス ───
  // import 時に "@/components/..." のように書ける
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // @ → プロジェクトルートの src/
    },
  },

  // ─── Tauri 開発向けの設定 ───
  // tauri dev / tauri build 時にのみ適用される

  // Rust 側のエラーが Vite の画面クリアで消えないようにする
  clearScreen: false,

  // 開発サーバー設定
  server: {
    port: 1420, // Tauri が期待する固定ポート
    strictPort: true, // ポートが使用中ならエラーにする（別ポートに変えない）
    host: host || false, // モバイル開発時はネットワークホストを使用
    // Hot Module Replacement の設定
    hmr: host
      ? {
          protocol: 'ws', // モバイル開発時は WebSocket プロトコル
          host,
          port: 1421, // HMR 用ポート
        }
      : undefined, // デスクトップ開発時はデフォルト設定
    watch: {
      // src-tauri/ は Rust ファイルなので Vite の監視対象から除外する
      ignored: ['**/src-tauri/**'],
    },
  },
}));
