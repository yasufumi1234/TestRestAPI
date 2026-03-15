/**
 * RequestTabs.tsx - リクエストタブバーコンポーネント
 *
 * メインエリアの上部に表示されるタブバー。
 * 複数のリクエストを並行して編集できる（Postman のタブ機能に相当）。
 *
 * 主な機能:
 * - タブの追加（+ ボタン）
 * - タブの切替（タブクリック）
 * - タブの削除（× ボタン）
 * - アクティブタブの視覚的な区別
 * - タブラベルの自動更新（URL のパス部分を表示）
 * - HTTP メソッドに応じたタブの色分け
 */

import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { RequestTab } from '@/stores/requestStore';
import type { HttpMethod } from '@/lib/tauri';

/** RequestTabs コンポーネントの Props */
interface RequestTabsProps {
  /** 全タブの配列 */
  tabs: RequestTab[];
  /** 現在アクティブなタブの ID */
  activeTabId: string;
  /** タブがクリックされたときのコールバック */
  onSelect: (id: string) => void;
  /** タブの × ボタンが押されたときのコールバック */
  onClose: (id: string) => void;
  /** + ボタンが押されたときのコールバック */
  onAdd: () => void;
}

/**
 * HTTP メソッドに対応するタブのアクセントカラーを返すヘルパー関数
 * アクティブタブの下部ボーダーに使用する
 */
const METHOD_BORDER_COLORS: Record<HttpMethod, string> = {
  GET: 'border-b-green-500',
  POST: 'border-b-yellow-500',
  PUT: 'border-b-blue-500',
  PATCH: 'border-b-purple-500',
  DELETE: 'border-b-red-500',
};

/**
 * HTTP メソッドに対応するテキストカラーを返すヘルパー関数
 */
const METHOD_TEXT_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600',
  POST: 'text-yellow-600',
  PUT: 'text-blue-600',
  PATCH: 'text-purple-600',
  DELETE: 'text-red-600',
};

export function RequestTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onAdd,
}: RequestTabsProps) {
  return (
    // タブバー全体: 横スクロール可能な行
    <div className="flex items-end border-b bg-muted/30 overflow-x-auto">
      {/* ─── タブ一覧 ─── */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`
              group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer
              border-b-2 transition-colors min-w-0 max-w-[200px] shrink-0
              ${
                isActive
                  ? `bg-background ${METHOD_BORDER_COLORS[tab.method]}`
                  : 'border-b-transparent hover:bg-accent/50 text-muted-foreground'
              }
            `}
            onClick={() => onSelect(tab.id)}
          >
            {/* HTTP メソッドの短縮表示（色分け付き） */}
            <span
              className={`text-[10px] font-bold shrink-0 ${
                METHOD_TEXT_COLORS[tab.method]
              }`}
            >
              {tab.method}
            </span>
            {/* タブラベル（URL パスまたは "New Request"） */}
            <span
              className={`text-xs truncate ${
                isActive ? 'text-foreground' : ''
              }`}
            >
              {tab.label || 'New Request'}
            </span>
            {/* × 閉じるボタン（ホバー時のみ表示、タブが 1 つの場合も表示） */}
            <button
              onClick={(e) => {
                // 親のクリックイベント（タブ選択）が発火しないようにする
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={`
                shrink-0 rounded-sm p-0.5
                opacity-0 group-hover:opacity-100 transition-opacity
                hover:bg-muted-foreground/20
                ${isActive ? 'opacity-60' : ''}
              `}
              title="タブを閉じる"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}

      {/* ─── 新しいタブ追加ボタン ─── */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onAdd}
        className="shrink-0 mx-1 my-1 text-muted-foreground hover:text-foreground"
        title="新しいタブを追加"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
