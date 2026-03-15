/**
 * StatusBar.tsx - レスポンスステータスバーコンポーネント
 *
 * ステータスコード・レスポンス時間・ボディサイズを横並びで表示する。
 * ステータスコードは range に応じて色分けする（Postman 風）。
 */

/** StatusBar コンポーネントの Props */
interface StatusBarProps {
  status: number; // HTTP ステータスコード（例: 200）
  elapsedMs: number; // レスポンス時間（ミリ秒）
  sizeBytes: number; // レスポンスボディサイズ（バイト）
}

/**
 * ステータスコードの range に応じた Tailwind CSS クラスを返す
 * 2xx: 緑、3xx: 青、4xx: 黄、5xx: 赤
 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50'; // 成功
  if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-50'; // リダイレクト
  if (status >= 400 && status < 500) return 'text-yellow-600 bg-yellow-50'; // クライアントエラー
  return 'text-red-600 bg-red-50'; // サーバーエラー
}

/**
 * バイト数を人間が読みやすい単位に変換する
 * 例: 1024 → "1.0 KB"、1048576 → "1.0 MB"
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`; // バイト
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; // キロバイト
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; // メガバイト
}

/**
 * ミリ秒を人間が読みやすい形式に変換する
 * 例: 245 → "245 ms"、1500 → "1.50 s"
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`; // ミリ秒表示
  return `${(ms / 1000).toFixed(2)} s`; // 秒表示
}

/** ステータスバーコンポーネント本体 */
export function StatusBar({ status, elapsedMs, sizeBytes }: StatusBarProps) {
  return (
    // 横並びでステータスコード・時間・サイズを表示
    <div className="flex items-center gap-4 text-sm">
      {/* ステータスコードバッジ（色はステータス range に応じて変化） */}
      <span
        className={`px-2 py-1 rounded font-semibold ${getStatusColor(status)}`}
      >
        {status}
      </span>
      {/* レスポンス所要時間 */}
      <span className="text-muted-foreground">
        Time:{' '}
        <span className="text-foreground font-medium">
          {formatTime(elapsedMs)}
        </span>
      </span>
      {/* レスポンスボディサイズ */}
      <span className="text-muted-foreground">
        Size:{' '}
        <span className="text-foreground font-medium">
          {formatSize(sizeBytes)}
        </span>
      </span>
    </div>
  );
}
