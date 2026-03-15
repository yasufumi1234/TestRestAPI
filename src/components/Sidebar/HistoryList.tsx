/**
 * HistoryList.tsx - リクエスト履歴一覧コンポーネント
 *
 * サイドバー内に表示される履歴一覧。
 * 過去に送信した HTTP リクエストをタイムスタンプ付きでリスト表示する。
 *
 * 主な機能:
 * - 履歴エントリーのクリックでリクエスト内容を復元する
 * - 個別エントリーの削除（ホバー時にゴミ箱アイコン表示）
 * - 全履歴の一括削除
 * - HTTP メソッドに応じた色分け表示（Postman 風）
 * - 相対時間表示（例: "3 分前"、"1 時間前"）
 * - dnd-kit によるドラッグ開始（Phase 5）
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { GripVertical, Trash2 } from 'lucide-react';
import type { HistoryEntry, HttpMethod } from '@/lib/tauri';

/** HistoryList コンポーネントの Props */
interface HistoryListProps {
  /** 履歴エントリーの配列（新しい順にソート済み） */
  entries: HistoryEntry[];
  /** 履歴エントリーがクリックされたときのコールバック（リクエスト内容を復元する） */
  onSelect: (entry: HistoryEntry) => void;
  /** 個別エントリーの削除ボタンが押されたときのコールバック */
  onDelete: (id: string) => void;
  /** 全履歴削除ボタンが押されたときのコールバック */
  onClear: () => void;
  /** 現在ドラッグ中の履歴エントリー ID */
  draggingEntryId?: string | null;
}

/**
 * HTTP メソッドに対応する表示色を返すヘルパー関数
 * UrlBar.tsx と統一した色分けにする（Postman 風）
 */
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600',    // GET: 緑
  POST: 'text-yellow-600',  // POST: 黄
  PUT: 'text-blue-600',     // PUT: 青
  PATCH: 'text-purple-600', // PATCH: 紫
  DELETE: 'text-red-600',   // DELETE: 赤
};

/**
 * ISO 8601 タイムスタンプを「○分前」「○時間前」などの相対時間に変換するヘルパー関数
 * ユーザーにとって直感的に「いつのリクエストか」を把握しやすくする
 */
function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    // 経過秒数を計算する
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    // 経過時間に応じて適切な単位で表示する
    if (diffSec < 60) return 'たった今';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 時間前`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} 日前`;

    // 1 週間以上前の場合は日付を表示する
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    // タイムスタンプのパースに失敗した場合はそのまま返す
    return timestamp;
  }
}

/**
 * URL からホスト名とパスを短縮表示するヘルパー関数
 * 長い URL をサイドバーの幅に収まるように短くする
 * 例: "https://api.example.com/v1/users?page=1" → "/v1/users"
 */
function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // パスが長い場合は省略する（最大 30 文字）
    const path = parsed.pathname + parsed.search;
    if (path.length > 30) {
      return path.substring(0, 27) + '...';
    }
    return path || '/';
  } catch {
    // URL のパースに失敗した場合は元の URL を短縮する
    if (url.length > 30) return url.substring(0, 27) + '...';
    return url;
  }
}

export function HistoryList({
  entries,
  onSelect,
  onDelete,
  onClear,
  draggingEntryId,
}: HistoryListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* ─── ヘッダー: タイトル + 全削除ボタン ─── */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          履歴
        </h2>
        {/* 履歴が 1 件以上ある場合のみ全削除ボタンを表示する */}
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
            title="全履歴を削除"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>

      {/* ─── 履歴エントリー一覧 ─── */}
      {entries.length === 0 ? (
        /* 履歴が空の場合のプレースホルダーメッセージ */
        <p className="text-xs text-muted-foreground">
          まだリクエスト履歴がありません
        </p>
      ) : (
        /* スクロール可能なリスト */
        <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1">
          {entries.map((entry) => (
            <HistoryEntryItem
              key={entry.id}
              entry={entry}
              onSelect={onSelect}
              onDelete={onDelete}
              isDragging={draggingEntryId === entry.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface HistoryEntryItemProps {
  entry: HistoryEntry;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  isDragging: boolean;
}

function HistoryEntryItem({
  entry,
  onSelect,
  onDelete,
  isDragging,
}: HistoryEntryItemProps) {
  /**
   * useDraggable() を呼ぶと、
   * この履歴行を「ドラッグできる要素」として dnd-kit に登録できる。
   *
   * 返ってくる値の役割:
   * - setNodeRef: どの DOM をドラッグ対象にするかを登録する
   * - attributes: a11y 用属性などをまとめて付与する
   * - listeners: マウス / ポインタイベントの開始処理
   * - transform: ドラッグ中の移動量
   *
   * data に入れた値は、Sidebar.tsx の onDragStart / onDragEnd で
   * event.active.data.current として取り出せる。
   */
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `history-${entry.id}`,
    data: {
      type: 'history-entry',
      entry,
    },
  });

  /**
   * transform は「今どれだけ移動しているか」という座標情報。
   * CSS.Translate.toString() で CSS の transform 文字列へ変換し、
   * 見た目上、要素が一緒に動いているように見せる。
   */
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors ${
        isDragging ? 'opacity-40' : ''
      }`}
      onClick={() => onSelect(entry)}
      title={`${entry.method} ${entry.url}`}
    >
      {/* このボタンだけを「ドラッグの取っ手」として使う */}
      <Button
        variant="ghost"
        size="icon-xs"
        className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        title="ドラッグしてコレクションへ保存"
        // クリックで履歴復元が走らないよう、親への伝播を止める
        onClick={(e) => e.stopPropagation()}
        // dnd-kit が返す属性とイベントをこの要素へ接続する
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </Button>

      {/* 左側: メソッド名 + URL + ステータス + 時間 */}
      <div className="flex-1 min-w-0">
        {/* 1 行目: メソッド + 短縮 URL */}
        <div className="flex items-center gap-1.5">
          {/* HTTP メソッドバッジ（色分け付き） */}
          <span
            className={`text-[10px] font-bold shrink-0 ${
              METHOD_COLORS[entry.method] || 'text-foreground'
            }`}
          >
            {entry.method}
          </span>
          {/* 短縮 URL（幅が足りない場合は省略記号で切り詰め） */}
          <span className="text-xs truncate text-foreground/80">
            {shortenUrl(entry.url)}
          </span>
        </div>
        {/* 2 行目: ステータスコード + 経過時間 + タイムスタンプ */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* ステータスコード（色分け付き） */}
          {entry.status && (
            <span
              className={`text-[10px] font-medium ${
                entry.status < 300
                  ? 'text-green-600'
                  : entry.status < 400
                  ? 'text-blue-600'
                  : entry.status < 500
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {entry.status}
            </span>
          )}
          {/* 経過時間（ミリ秒） */}
          {entry.elapsed_ms != null && (
            <span className="text-[10px] text-muted-foreground">
              {entry.elapsed_ms}ms
            </span>
          )}
          {/* 相対時間（「○分前」等） */}
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
      </div>

      {/* 右側: 個別削除ボタン（ホバー時のみ表示） */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
        title="この履歴を削除"
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}
