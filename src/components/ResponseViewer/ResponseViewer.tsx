/**
 * ResponseViewer.tsx - レスポンス表示コンポーネント
 *
 * HTTP レスポンスの内容を表示する。
 * 表示状態は 4 パターン: ローディング中 / エラー / 未送信 / レスポンス表示
 * レスポンス表示時は Body / Headers タブを切り替えられる。
 */

import type { HttpResponse, AppError } from '@/lib/tauri';
import { StatusBar } from './StatusBar'; // ステータスコード・時間・サイズ表示
import { ResponseBody } from './ResponseBody'; // レスポンスボディ表示
import { ResponseHeaders } from './ResponseHeaders'; // レスポンスヘッダーテーブル
import { useState } from 'react';

/** ResponseViewer コンポーネントの Props */
interface ResponseViewerProps {
  response: HttpResponse | null; // レスポンスデータ（未受信なら null）
  error: AppError | null; // エラー情報（エラーなしなら null）
  loading: boolean; // リクエスト送信中フラグ
}

/** タブの種類（Body または Headers） */
type Tab = 'body' | 'headers';

export function ResponseViewer({
  response,
  error,
  loading,
}: ResponseViewerProps) {
  // 現在アクティブなタブ（初期値は Body タブ）
  const [activeTab, setActiveTab] = useState<Tab>('body');

  // ─── パターン 1: ローディング中 ───
  // リクエスト送信中はスピナーを中央表示する
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          {/* 回転するスピナー SVG */}
          <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
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
          <span>リクエスト送信中...</span>
        </div>
      </div>
    );
  }

  // ─── パターン 2: エラー表示 ───
  // URL 不正・タイムアウト・ネットワーク断などの送信エラー時
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <h3 className="font-semibold text-destructive mb-1">エラー</h3>
        {/* ユーザー向けエラーメッセージ */}
        <p className="text-sm text-destructive">{error.message}</p>
        {/* デバッグ用詳細情報（存在する場合のみ表示） */}
        {error.detail && (
          <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
            {error.detail}
          </pre>
        )}
      </div>
    );
  }

  // ─── パターン 3: 未送信（初期状態） ───
  // まだリクエストを送信していない場合のプレースホルダー
  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">レスポンスなし</p>
          <p className="text-sm mt-1">
            URLを入力して Send をクリックしてください
          </p>
        </div>
      </div>
    );
  }

  // ─── パターン 4: レスポンス表示 ───
  // HTTP レスポンスを受信した場合（2xx / 4xx / 5xx すべて含む）
  return (
    <div className="flex flex-col h-full gap-3">
      {/* ステータスバー（ステータスコード・時間・サイズ） */}
      <StatusBar
        status={response.status}
        elapsedMs={response.elapsed_ms}
        sizeBytes={response.size_bytes}
      />

      {/* Body / Headers タブの切り替えボタン */}
      <div className="flex border-b">
        {/* Body タブ */}
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'body'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('body')}
        >
          Body
        </button>
        {/* Headers タブ（ヘッダー数をバッジ表示） */}
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'headers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('headers')}
        >
          Headers ({response.headers.length})
        </button>
      </div>

      {/* アクティブなタブの内容を表示 */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'body' ? (
          <ResponseBody body={response.body} /> /* ボディ表示 */
        ) : (
          <ResponseHeaders headers={response.headers} /> /* ヘッダーテーブル */
        )}
      </div>
    </div>
  );
}
