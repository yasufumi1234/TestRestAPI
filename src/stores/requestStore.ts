/**
 * requestStore.ts - リクエスト状態管理ストア（Zustand）
 *
 * Phase 4 でアプリ全体の状態管理を App.tsx の useState から Zustand に移行した。
 * 複数タブ（複数リクエストの並行編集）をサポートするため、
 * 各タブが独立した RequestTab 状態を持つ構造になっている。
 *
 * 構成:
 * - tabs: 全タブの配列
 * - activeTabId: 現在アクティブなタブの ID
 * - historyEntries: リクエスト履歴の配列
 * - environments: 環境変数の配列
 * - activeEnvironmentId: 選択中の環境の ID
 *
 * アクション:
 * - タブの追加・削除・切替・更新
 * - 履歴の読み込み・保存・削除
 * - 環境変数の管理
 * - リクエスト送信
 */

import { create } from 'zustand';
import type {
  HttpMethod,
  HttpResponse,
  AppError,
  KeyValue,
  RequestBody,
  HistoryEntry,
} from '@/lib/tauri';
import {
  sendRequest as tauriSendRequest,
  normalizeError,
  saveHistoryEntry,
  getHistory,
  deleteHistoryEntry,
  clearHistory,
} from '@/lib/tauri';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 型定義
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 環境変数セットを表す型
 * 複数の環境（開発・本番等）を定義し、URL やヘッダー値を切り替えられる
 */
export interface Environment {
  /** 環境の一意な識別子（UUID v4） */
  id: string;
  /** 環境名（例: "Development", "Production"） */
  name: string;
  /** 環境変数の Key-Value ペア */
  variables: KeyValue[];
}

/**
 * リクエストタブの状態を表す型
 * 各タブが独立した URL・メソッド・ヘッダー・ボディ・レスポンスを持つ
 * Postman の「タブ」と同等の機能
 */
export interface RequestTab {
  /** タブの一意な識別子（UUID v4） */
  id: string;
  /** タブのラベル（URL が入力されると URL に更新される） */
  label: string;
  /** 選択中の HTTP メソッド */
  method: HttpMethod;
  /** 入力中の URL 文字列 */
  url: string;
  /** カスタムヘッダーの一覧 */
  headers: KeyValue[];
  /** リクエストボディ（null = ボディなし） */
  body: RequestBody | null;
  /** リクエスト送信中フラグ */
  loading: boolean;
  /** 受信したレスポンスデータ */
  response: HttpResponse | null;
  /** 発生したエラー情報 */
  error: AppError | null;
}

/**
 * Zustand ストアの型定義
 * ストアが持つ全ての state と action を定義する
 */
interface RequestStoreState {
  // ─── タブ管理 ───
  /** 全タブの配列 */
  tabs: RequestTab[];
  /** 現在アクティブなタブの ID */
  activeTabId: string;

  // ─── 履歴 ───
  /** リクエスト履歴の配列（新しい順） */
  historyEntries: HistoryEntry[];

  // ─── 環境変数 ───
  /** 定義済み環境の配列 */
  environments: Environment[];
  /** 現在選択中の環境の ID（null = 環境なし） */
  activeEnvironmentId: string | null;

  // ─── タブ操作アクション ───
  /** 新しいタブを追加する */
  addTab: () => void;
  /** 指定した ID のタブを削除する */
  removeTab: (id: string) => void;
  /** アクティブなタブを切り替える */
  setActiveTab: (id: string) => void;
  /** アクティブなタブの状態を部分更新する */
  updateActiveTab: (updates: Partial<RequestTab>) => void;

  // ─── リクエスト送信 ───
  /** アクティブなタブのリクエストを送信する */
  sendRequest: () => Promise<void>;

  // ─── 履歴操作アクション ───
  /** 保存済み履歴を読み込む（起動時に 1 回呼ぶ） */
  loadHistory: () => Promise<void>;
  /** 履歴エントリーからリクエスト内容を復元する */
  restoreFromHistory: (entry: HistoryEntry) => void;
  /** 個別の履歴エントリーを削除する */
  removeHistoryEntry: (id: string) => Promise<void>;
  /** 全履歴を削除する */
  clearAllHistory: () => Promise<void>;

  // ─── 環境変数操作アクション ───
  /** 新しい環境を追加する */
  addEnvironment: (name: string) => void;
  /** 環境を削除する */
  removeEnvironment: (id: string) => void;
  /** 環境の変数を更新する */
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  /** アクティブな環境を切り替える */
  setActiveEnvironment: (id: string | null) => void;
  /** アクティブな環境の変数で文字列中の {{key}} を置換する */
  resolveVariables: (text: string) => string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** UUID v4 を生成する */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 新しい空のヘッダー行を生成する
 * タブの初期状態やリセット時に使用する
 */
function createEmptyHeader(): KeyValue {
  return { key: '', value: '', enabled: true };
}

/**
 * デフォルトのリクエストタブを生成する
 * 初期状態: GET メソッド・空 URL・空ヘッダー 1 行・ボディなし
 */
function createDefaultTab(): RequestTab {
  return {
    id: generateId(),
    label: 'New Request',
    method: 'GET',
    url: '',
    headers: [createEmptyHeader()],
    body: null,
    loading: false,
    response: null,
    error: null,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ストア本体
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 初期タブ（アプリ起動時に 1 つのタブが開いた状態にする） */
const initialTab = createDefaultTab();

export const useRequestStore = create<RequestStoreState>((set, get) => ({
  // ─── 初期 state ───
  tabs: [initialTab],
  activeTabId: initialTab.id,
  historyEntries: [],
  environments: [],
  activeEnvironmentId: null,

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // タブ操作アクション
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * 新しいタブを追加し、そのタブをアクティブにする
   * ユーザーが「+」ボタンを押したときに呼ばれる
   */
  addTab: () => {
    const newTab = createDefaultTab();
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    }));
  },

  /**
   * 指定した ID のタブを削除する
   * 最後の 1 タブは削除できない（新しい空タブに置き換える）
   * 削除したタブがアクティブだった場合は隣のタブをアクティブにする
   */
  removeTab: (id) => {
    const { tabs, activeTabId } = get();

    // 最後の 1 タブの場合は削除せず、空タブにリセットする
    if (tabs.length <= 1) {
      const newTab = createDefaultTab();
      set({ tabs: [newTab], activeTabId: newTab.id });
      return;
    }

    // タブを削除する
    const newTabs = tabs.filter((t) => t.id !== id);

    // 削除したタブがアクティブだった場合、隣のタブをアクティブにする
    let newActiveTabId = activeTabId;
    if (activeTabId === id) {
      // 削除するタブのインデックスを探す
      const removedIndex = tabs.findIndex((t) => t.id === id);
      // 右隣のタブがあればそちら、なければ左隣のタブをアクティブにする
      const newIndex = Math.min(removedIndex, newTabs.length - 1);
      newActiveTabId = newTabs[newIndex].id;
    }

    set({ tabs: newTabs, activeTabId: newActiveTabId });
  },

  /**
   * アクティブなタブを切り替える
   * タブバーでタブをクリックしたときに呼ばれる
   */
  setActiveTab: (id) => set({ activeTabId: id }),

  /**
   * アクティブなタブの状態を部分更新する
   * URL 入力、メソッド変更、ヘッダー編集などで呼ばれる
   * Partial<RequestTab> を受け取るので、変更したいフィールドだけ渡せば良い
   */
  updateActiveTab: (updates) => {
    const { activeTabId } = get();
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== activeTabId) return tab;

        const updated = { ...tab, ...updates };

        // URL が変更された場合、タブのラベルを URL のパス部分に自動更新する
        if (updates.url !== undefined) {
          try {
            const parsed = new URL(updates.url);
            updated.label = parsed.pathname || updates.url;
          } catch {
            // URL がまだ不完全な場合はラベルをそのまま維持する
            updated.label = updates.url || 'New Request';
          }
        }

        return updated;
      }),
    }));
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // リクエスト送信
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * アクティブなタブのリクエストを送信する
   * Send ボタン押下時に呼ばれる
   */
  sendRequest: async () => {
    const { activeTabId, tabs, resolveVariables } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.url.trim()) return;

    // ローディング開始
    get().updateActiveTab({ loading: true, error: null, response: null });

    const entryId = generateId();
    const timestamp = new Date().toISOString();

    // 環境変数を適用した URL を使用する
    const resolvedUrl = resolveVariables(tab.url.trim());

    try {
      const res = await tauriSendRequest({
        method: tab.method,
        url: resolvedUrl,
        headers: tab.headers,
        body: tab.body,
        timeout_ms: 30000,
      });

      // 成功: レスポンスをタブに設定する
      get().updateActiveTab({ response: res, loading: false });

      // 履歴に保存する
      const entry: HistoryEntry = {
        id: entryId,
        method: tab.method,
        url: tab.url.trim(),
        headers: tab.headers,
        body: tab.body,
        status: res.status,
        elapsed_ms: res.elapsed_ms,
        timestamp,
      };
      saveHistoryEntry(entry).catch((e) =>
        console.warn('Failed to save history:', e)
      );
      set((state) => ({
        historyEntries: [entry, ...state.historyEntries],
      }));
    } catch (e) {
      const appError = normalizeError(e);
      get().updateActiveTab({ error: appError, loading: false });

      // 失敗時も履歴に記録する
      const entry: HistoryEntry = {
        id: entryId,
        method: tab.method,
        url: tab.url.trim(),
        headers: tab.headers,
        body: tab.body,
        status: null,
        elapsed_ms: null,
        timestamp,
      };
      saveHistoryEntry(entry).catch((e2) =>
        console.warn('Failed to save history:', e2)
      );
      set((state) => ({
        historyEntries: [entry, ...state.historyEntries],
      }));
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 履歴操作アクション
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** 保存済み履歴を読み込む（アプリ起動時に 1 回呼ぶ） */
  loadHistory: async () => {
    try {
      const entries = await getHistory();
      set({ historyEntries: entries });
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  },

  /** 履歴エントリーからリクエスト内容をアクティブタブに復元する */
  restoreFromHistory: (entry) => {
    get().updateActiveTab({
      method: entry.method,
      url: entry.url,
      headers: entry.headers.length > 0 ? entry.headers : [createEmptyHeader()],
      body: entry.body,
      response: null,
      error: null,
    });
  },

  /** 個別の履歴エントリーを削除する */
  removeHistoryEntry: async (id) => {
    try {
      await deleteHistoryEntry(id);
      set((state) => ({
        historyEntries: state.historyEntries.filter((e) => e.id !== id),
      }));
    } catch (e) {
      console.warn('Failed to delete history entry:', e);
    }
  },

  /** 全履歴を削除する */
  clearAllHistory: async () => {
    try {
      await clearHistory();
      set({ historyEntries: [] });
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 環境変数操作アクション
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** 新しい環境を追加する */
  addEnvironment: (name) => {
    const newEnv: Environment = {
      id: generateId(),
      name,
      variables: [createEmptyHeader()], // 初期値として空行 1 つ
    };
    set((state) => ({
      environments: [...state.environments, newEnv],
    }));
  },

  /** 環境を削除する */
  removeEnvironment: (id) => {
    set((state) => ({
      environments: state.environments.filter((e) => e.id !== id),
      // 削除した環境がアクティブだった場合は null にリセットする
      activeEnvironmentId:
        state.activeEnvironmentId === id ? null : state.activeEnvironmentId,
    }));
  },

  /** 環境の情報を更新する（名前や変数の変更） */
  updateEnvironment: (id, updates) => {
    set((state) => ({
      environments: state.environments.map((env) =>
        env.id === id ? { ...env, ...updates } : env
      ),
    }));
  },

  /** アクティブな環境を切り替える */
  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  /**
   * アクティブな環境の変数で文字列中の {{key}} プレースホルダーを置換する
   *
   * 例: 環境変数に { key: "baseUrl", value: "https://api.example.com" } がある場合
   *     "{{baseUrl}}/users" → "https://api.example.com/users"
   *
   * 環境が選択されていない場合や、マッチする変数がない場合は元の文字列をそのまま返す
   */
  resolveVariables: (text) => {
    const { environments, activeEnvironmentId } = get();

    // 環境が選択されていない場合はそのまま返す
    if (!activeEnvironmentId) return text;

    // アクティブな環境を探す
    const env = environments.find((e) => e.id === activeEnvironmentId);
    if (!env) return text;

    // {{key}} パターンを正規表現で検索し、変数値で置換する
    let resolved = text;
    for (const variable of env.variables) {
      // enabled=true かつ key が空でない変数のみを対象にする
      if (variable.enabled && variable.key.trim()) {
        // {{key}} を value に置換する（全てのマッチを置換）
        const pattern = new RegExp(`\\{\\{${escapeRegExp(variable.key)}\\}\\}`, 'g');
        resolved = resolved.replace(pattern, variable.value);
      }
    }

    return resolved;
  },
}));

/**
 * 正規表現の特殊文字をエスケープするヘルパー関数
 * 環境変数の key に特殊文字（. や * 等）が含まれている場合にも正しくマッチさせるため
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
