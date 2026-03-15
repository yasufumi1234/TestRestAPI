/**
 * App.tsx - ルートコンポーネント
 *
 * アプリ全体のレイアウトを構成する。
 * Phase 4 で useState から Zustand ストアに状態管理を移行した。
 *
 * 構成: サイドバー（左） + メインエリア（右: タブバー + URL バー + リクエストビルダー + レスポンス表示）
 *
 * Phase 4 で追加した機能:
 * - Zustand による集中的な状態管理
 * - 複数リクエストタブの並行編集
 * - コレクション管理（CRUD + ツリー表示）
 * - 環境変数（{{変数}} の自動置換）
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
import { UrlBar } from '@/components/RequestBuilder/UrlBar';
import { RequestPanel } from '@/components/RequestBuilder/RequestPanel';
import { RequestTabs } from '@/components/RequestBuilder/RequestTabs';
import { EnvironmentSelector } from '@/components/RequestBuilder/EnvironmentSelector';
import { ResponseViewer } from '@/components/ResponseViewer/ResponseViewer';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { useRequestStore } from '@/stores/requestStore';
import type { SavedRequest, Collection, HistoryEntry } from '@/lib/tauri';
import { saveCollections, getCollections } from '@/lib/tauri';
import {
  addSavedRequestToTarget,
  currentRequestToSavedRequest,
  historyEntryToSavedRequest,
  type CollectionDropTarget,
} from '@/lib/collections';

/**
 * URL の形式が正しいかどうかを簡易バリデーションする
 */
function validateUrl(url: string): string | null {
  if (!url.trim()) return null;
  try {
    new URL(url.trim());
    return null;
  } catch {
    return 'URL の形式が正しくありません（例: https://api.example.com）';
  }
}

function App() {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Zustand ストアから state と action を取得
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const tabs = useRequestStore((s) => s.tabs);
  const activeTabId = useRequestStore((s) => s.activeTabId);
  const historyEntries = useRequestStore((s) => s.historyEntries);
  const environments = useRequestStore((s) => s.environments);
  const activeEnvironmentId = useRequestStore((s) => s.activeEnvironmentId);

  const addTab = useRequestStore((s) => s.addTab);
  const removeTab = useRequestStore((s) => s.removeTab);
  const setActiveTab = useRequestStore((s) => s.setActiveTab);
  const updateActiveTab = useRequestStore((s) => s.updateActiveTab);
  const storeSendRequest = useRequestStore((s) => s.sendRequest);
  const loadHistory = useRequestStore((s) => s.loadHistory);
  const restoreFromHistory = useRequestStore((s) => s.restoreFromHistory);
  const removeHistoryEntry = useRequestStore((s) => s.removeHistoryEntry);
  const clearAllHistory = useRequestStore((s) => s.clearAllHistory);
  const addEnvironment = useRequestStore((s) => s.addEnvironment);
  const removeEnvironment = useRequestStore((s) => s.removeEnvironment);
  const updateEnvironment = useRequestStore((s) => s.updateEnvironment);
  const setActiveEnvironment = useRequestStore((s) => s.setActiveEnvironment);

  /** 現在アクティブなタブの状態を取得する */
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  /** URL のバリデーション結果 */
  const urlError = useMemo(
    () => validateUrl(activeTab?.url ?? ''),
    [activeTab?.url]
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // コレクション状態管理
  // Zustand ストアとは別にローカル state で管理する。
  // 変更のたびに Rust 側にファイル保存する必要があるため。
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * コレクション一覧そのもの。
   *
   * 履歴やタブ状態は Zustand ストアで管理しているが、
   * コレクションは「変更のたびにファイル保存する」という役割が強いため、
   * App.tsx でローカル state として持ち、
   * 変更時に saveCollections() を一緒に呼ぶ構成にしている。
   */
  const [collections, setCollections] = useState<Collection[]>([]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 初期化: 履歴とコレクションの読み込み（アプリ起動時に 1 回だけ）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  useEffect(() => {
    // アプリ起動時に、まず永続化済みデータを読み込んで画面へ反映する
    loadHistory();
    getCollections()
      .then((c) => setCollections(c))
      .catch((e) => console.warn('Failed to load collections:', e));
  }, [loadHistory]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // コレクション操作ハンドラー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * コレクションが変更されたときのハンドラー
   * フロントエンドの state を更新し、Rust 側にファイル保存する
   */
  const handleCollectionsChange = useCallback(
    (newCollections: Collection[]) => {
      // 1. React 画面を更新
      setCollections(newCollections);
      // 2. Rust 側へ依頼して JSON ファイルへ保存
      saveCollections(newCollections).catch((e) =>
        console.warn('Failed to save collections:', e)
      );
    },
    []
  );

  /**
   * コレクション内のリクエストがクリックされたときのハンドラー
   * SavedRequest の内容をアクティブタブに復元する
   */
  const handleCollectionRequestSelect = useCallback(
    (request: SavedRequest) => {
      /**
       * 保存済みリクエストを「現在の編集タブ」に流し込む。
       *
       * ここでは response / error を null に戻している。
       * 理由は、過去のレスポンス表示を残したままにすると
       * 「今のリクエストに対する結果」と誤解しやすいから。
       */
      updateActiveTab({
        method: request.method,
        url: request.url,
        headers:
          request.headers.length > 0
            ? request.headers
            : [{ key: '', value: '', enabled: true }],
        body: request.body,
        response: null,
        error: null,
      });
    },
    [updateActiveTab]
  );

  /**
   * 「現在のリクエストをコレクションに保存」ハンドラー
   * アクティブタブの内容を指定されたコレクションに SavedRequest として追加する
   */
  const handleSaveCurrentRequest = useCallback(
    (collectionId: string) => {
      if (!activeTab) return;

      /**
       * activeTab は UI 用の情報も含んでいるため、
       * まず保存用の SavedRequest に変換する。
       */
      const newRequest = currentRequestToSavedRequest({
        method: activeTab.method,
        url: activeTab.url,
        headers: activeTab.headers,
        body: activeTab.body,
      });

      /**
       * 保存先は「コレクション直下」。
       * そのため target.type は collection を指定する。
       */
      const updated = addSavedRequestToTarget(
        collections,
        { type: 'collection', collectionId },
        newRequest
      );

      handleCollectionsChange(updated);
    },
    [activeTab, collections, handleCollectionsChange]
  );

  /**
   * 履歴一覧のエントリーがコレクションツリーへドロップされたときのハンドラー
   * 指定したコレクション直下、またはフォルダへ SavedRequest として保存する
   */
  const handleSaveHistoryToCollectionTarget = useCallback(
    (entry: HistoryEntry, target: CollectionDropTarget) => {
      /**
       * 履歴は「送信済みの記録」だが、
       * コレクション保存時には「再利用できるリクエスト定義」へ変換する。
       */
      const newRequest = historyEntryToSavedRequest(entry);

      /**
       * target は D&D の結果として Sidebar.tsx から渡される。
       *
       * 例:
       * - { type: 'collection', collectionId: '...' }
       * - { type: 'folder', collectionId: '...', folderId: '...' }
       *
       * これにより、ここでは「保存先の種類を自分で考える」必要がない。
       */
      const updated = addSavedRequestToTarget(collections, target, newRequest);
      handleCollectionsChange(updated);
    },
    [collections, handleCollectionsChange]
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // レンダリング
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!activeTab) return null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* サイドバー（左側: 履歴 + コレクション） */}
      <Sidebar
        historyEntries={historyEntries}
        onHistorySelect={restoreFromHistory}
        onHistoryDelete={removeHistoryEntry}
        onHistoryClear={clearAllHistory}
        collections={collections}
        onCollectionsChange={handleCollectionsChange}
        onCollectionRequestSelect={handleCollectionRequestSelect}
        onSaveCurrentRequest={handleSaveCurrentRequest}
        onHistorySaveToCollectionTarget={handleSaveHistoryToCollectionTarget}
      />

      {/* メインエリア（右側） */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ─── タブバー（Phase 4: 複数リクエストの並行編集） ─── */}
        <RequestTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTab}
          onClose={removeTab}
          onAdd={addTab}
        />

        {/* ─── URL バー + 環境変数セレクター + リクエストビルダー ─── */}
        <div className="border-b p-4 space-y-3">
          <div className="flex items-center gap-2">
            {/* URL バー（メソッド選択 + URL 入力 + Send ボタン） */}
            <div className="flex-1">
              <UrlBar
                method={activeTab.method}
                url={activeTab.url}
                loading={activeTab.loading}
                onMethodChange={(method) => updateActiveTab({ method })}
                onUrlChange={(url) => updateActiveTab({ url })}
                onSend={storeSendRequest}
              />
            </div>
            {/* 環境変数セレクター（Phase 4） */}
            <EnvironmentSelector
              environments={environments}
              activeEnvironmentId={activeEnvironmentId}
              onSelect={setActiveEnvironment}
              onAdd={addEnvironment}
              onRemove={removeEnvironment}
              onUpdate={updateEnvironment}
            />
          </div>

          {/* URL バリデーションエラーの表示 */}
          {urlError && (
            <p className="text-xs text-destructive px-1">{urlError}</p>
          )}

          {/* リクエストビルダー（Headers / Body タブ） */}
          <RequestPanel
            headers={activeTab.headers}
            onHeadersChange={(headers) => updateActiveTab({ headers })}
            body={activeTab.body}
            onBodyChange={(body) => updateActiveTab({ body })}
          />
        </div>

        {/* ─── レスポンス表示エリア ─── */}
        <div className="flex-1 overflow-auto p-4">
          <ResponseViewer
            response={activeTab.response}
            error={activeTab.error}
            loading={activeTab.loading}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
