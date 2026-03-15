/**
 * Sidebar.tsx - サイドバーコンポーネント
 *
 * 画面左側に固定幅で表示される。
 * Phase 3 で履歴一覧を実装。Phase 4 でコレクションツリーを実装。
 * Phase 5 で dnd-kit による履歴 → コレクション保存を追加した。
 *
 * 構成:
 * - アプリヘッダー（ロゴ・タイトル）
 * - 履歴一覧（Phase 3: HistoryList コンポーネント）
 * - コレクションツリー（Phase 4: CollectionTree コンポーネント）
 * - D&D コンテキスト（Phase 5）
 */

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CollectionTree } from './CollectionTree';
import { HistoryList } from './HistoryList';
import type { CollectionDropTarget } from '@/lib/collections';
import type { HistoryEntry, Collection, SavedRequest } from '@/lib/tauri';

/** Sidebar コンポーネントの Props */
interface SidebarProps {
  /** 履歴エントリーの配列（新しい順にソート済み） */
  historyEntries: HistoryEntry[];
  /** 履歴エントリーがクリックされたときのコールバック（リクエスト内容を復元する） */
  onHistorySelect: (entry: HistoryEntry) => void;
  /** 個別エントリーの削除ボタンが押されたときのコールバック */
  onHistoryDelete: (id: string) => void;
  /** 全履歴削除ボタンが押されたときのコールバック */
  onHistoryClear: () => void;

  /** コレクションの配列（Phase 4） */
  collections: Collection[];
  /** コレクションが変更されたときのコールバック */
  onCollectionsChange: (collections: Collection[]) => void;
  /** コレクション内のリクエストがクリックされたときのコールバック */
  onCollectionRequestSelect: (request: SavedRequest) => void;
  /** 「現在のリクエストを保存」ボタン押下時のコールバック */
  onSaveCurrentRequest: (collectionId: string) => void;
  /** 履歴エントリーをコレクション直下またはフォルダへ保存する */
  onHistorySaveToCollectionTarget: (
    entry: HistoryEntry,
    target: CollectionDropTarget
  ) => void;
}

export function Sidebar({
  historyEntries,
  onHistorySelect,
  onHistoryDelete,
  onHistoryClear,
  collections,
  onCollectionsChange,
  onCollectionRequestSelect,
  onSaveCurrentRequest,
  onHistorySaveToCollectionTarget,
}: SidebarProps) {
  /**
   * 今まさにドラッグ中の履歴エントリーを保持する state。
   *
   * この値は 2 つの用途で使う:
   * 1. 履歴一覧の元アイテムを薄く表示する
   * 2. DragOverlay に表示するラベル文字列を作る
   */
  const [activeHistoryEntry, setActiveHistoryEntry] = useState<HistoryEntry | null>(
    null
  );

  /**
   * dnd-kit の「ドラッグを開始してよい条件」を決める。
   *
   * distance: 6 にしているので、
   * クリックしただけではドラッグ扱いにならず、
   * 少しマウスを動かしたときだけドラッグ開始になる。
   *
   * これにより、履歴項目のクリック操作とドラッグ操作が
   * ぶつかりにくくなる。
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  // HistoryList に渡して、ドラッグ中の行を半透明表示するための ID
  const draggingEntryId = activeHistoryEntry?.id ?? null;

  /**
   * ドラッグ中にマウスカーソル付近へ表示するラベル。
   *
   * 例: "GET https://api.example.com/users"
   *
   * useMemo を使うのは、activeHistoryEntry が変わったときだけ
   * 再計算したいから。
   */
  const dragOverlayLabel = useMemo(() => {
    if (!activeHistoryEntry) {
      return null;
    }

    return `${activeHistoryEntry.method} ${activeHistoryEntry.url}`;
  }, [activeHistoryEntry]);

  /**
   * ドラッグ開始時に呼ばれるハンドラー。
   *
   * event.active.data.current には、ドラッグ元のコンポーネントが
   * useDraggable() に渡した data が入っている。
   *
   * 今回は HistoryList 側で
   *   { type: 'history-entry', entry }
   * を入れているので、それを取り出して state に保持する。
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeData = event.active.data.current;

    if (activeData?.type !== 'history-entry') {
      return;
    }

    setActiveHistoryEntry(activeData.entry as HistoryEntry);
  }, []);

  /**
   * ドラッグ終了時に呼ばれるハンドラー。
   *
   * ここでは:
   * 1. ドラッグ元が履歴エントリーか確認する
   * 2. ドロップ先がコレクション / フォルダか確認する
   * 3. 条件を満たした場合だけ親へ保存処理を依頼する
   * 4. 最後にドラッグ中 state を必ずクリアする
   *
   * 保存そのものは App.tsx 側で行い、このコンポーネントは
   * 「どこからどこへドロップされたか」を仲介する役割に留めている。
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeData = event.active.data.current;
      const overData = event.over?.data.current;

      if (
        activeData?.type === 'history-entry' &&
        overData?.type === 'collection-drop-target'
      ) {
        onHistorySaveToCollectionTarget(
          activeData.entry as HistoryEntry,
          overData.target as CollectionDropTarget
        );
      }

      setActiveHistoryEntry(null);
    },
    [onHistorySaveToCollectionTarget]
  );

  /**
   * ドラッグがキャンセルされた場合にも state を元に戻す。
   *
   * たとえば ESC キーや、ドロップ失敗時にもここが呼ばれるので、
   * UI がドラッグ中のまま残らないようにしている。
   */
  const handleDragCancel = useCallback(() => {
    setActiveHistoryEntry(null);
  }, []);

  return (
    /*
     * DndContext は、配下の draggable / droppable をひとまとめに管理する親。
     *
     * HistoryList は「ドラッグ元」
     * CollectionTree は「ドロップ先」
     * という別コンポーネントだが、
     * 同じ DndContext の中に入れることで相互にやり取りできる。
     */
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* 幅 256px 固定のサイドバー（右ボーダーで区切り） */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        {/* アプリケーションヘッダー */}
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold tracking-tight">REST Client</h1>
          <p className="text-xs text-muted-foreground mt-1">API Testing Tool</p>
        </div>

        {/* 履歴セクション（Phase 3 で実装） */}
        <div className="flex-1 p-4 overflow-hidden">
          <HistoryList
            entries={historyEntries}
            onSelect={onHistorySelect}
            onDelete={onHistoryDelete}
            onClear={onHistoryClear}
            draggingEntryId={draggingEntryId}
          />
        </div>

        {/* コレクションセクション（Phase 4 で実装） */}
        <div className="p-4 border-t max-h-[45%] overflow-hidden">
          <CollectionTree
            collections={collections}
            onChange={onCollectionsChange}
            onRequestSelect={onCollectionRequestSelect}
            onSaveCurrentRequest={onSaveCurrentRequest}
          />
        </div>
      </aside>

      {/* ドラッグ中だけ、マウスに追従する小さなプレビューを表示する */}
      <DragOverlay>
        {dragOverlayLabel ? (
          <div className="max-w-56 rounded-md border bg-background px-2 py-1 shadow-lg">
            <span className="text-[11px] font-medium text-foreground">
              {dragOverlayLabel}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
