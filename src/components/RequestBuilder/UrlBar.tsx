/**
 * UrlBar.tsx - リクエストビルダーの URL バーコンポーネント
 *
 * Postman のアドレスバー風 UI を提供する。
 * 構成: [メソッド選択] [URL 入力] [Send ボタン]
 */

import { Button } from '@/components/ui/button'; // shadcn/ui ボタン
import { Input } from '@/components/ui/input'; // shadcn/ui テキスト入力
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // shadcn/ui セレクトボックス
import type { HttpMethod } from '@/lib/tauri'; // HTTP メソッドの型

// 選択可能な HTTP メソッド一覧
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// メソッドごとの表示色（Postman 風の色分け）
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600', // GET: 緑
  POST: 'text-yellow-600', // POST: 黄
  PUT: 'text-blue-600', // PUT: 青
  PATCH: 'text-purple-600', // PATCH: 紫
  DELETE: 'text-red-600', // DELETE: 赤
};

/** UrlBar コンポーネントの Props */
interface UrlBarProps {
  method: HttpMethod; // 現在選択中のメソッド
  url: string; // 入力中の URL
  loading: boolean; // リクエスト送信中フラグ
  onMethodChange: (method: HttpMethod) => void; // メソッド変更時のコールバック
  onUrlChange: (url: string) => void; // URL 変更時のコールバック
  onSend: () => void; // Send ボタン押下時のコールバック
}

export function UrlBar({
  method,
  url,
  loading,
  onMethodChange,
  onUrlChange,
  onSend,
}: UrlBarProps) {
  return (
    // 横並びレイアウト: [メソッド選択] [URL入力] [Sendボタン]
    <div className="flex items-center gap-2">
      {/* メソッド選択ドロップダウン（shadcn/ui の Select コンポーネント） */}
      <Select
        value={method}
        onValueChange={(v) => onMethodChange(v as HttpMethod)} // 選択変更時に親に通知
      >
        {/* トリガー（現在選択中のメソッドを表示） */}
        <SelectTrigger
          className={`w-[120px] font-semibold ${METHOD_COLORS[method]}`}
        >
          <SelectValue />
        </SelectTrigger>
        {/* ドロップダウンの中身（全メソッドを一覧表示） */}
        <SelectContent>
          {HTTP_METHODS.map((m) => (
            <SelectItem
              key={m}
              value={m}
              className={`font-semibold ${METHOD_COLORS[m]}`} // メソッドごとに色を変える
            >
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* URL 入力欄（Enter キーで送信可能） */}
      <Input
        className="flex-1 font-mono text-sm"
        placeholder="https://api.example.com/endpoint"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)} // 入力変更時に親に通知
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSend(); // Enter キーで送信
        }}
      />

      {/* 送信ボタン（送信中はスピナーを表示し、URL が空なら無効化） */}
      <Button
        onClick={onSend}
        disabled={loading || !url.trim()} // ローディング中 or URL が空なら無効
        className="min-w-[80px]"
      >
        {loading ? (
          // 送信中: アニメーション付きスピナー + 「送信中」テキスト
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            送信中
          </span>
        ) : (
          // 通常時: 「Send」テキスト
          'Send'
        )}
      </Button>
    </div>
  );
}
