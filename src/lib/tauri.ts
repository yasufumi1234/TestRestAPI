/**
 * tauri.ts - Tauri Command 呼び出しラッパー
 *
 * specta が自動生成した bindings.ts の上に、アプリ固有のユーティリティを追加する。
 * UI コンポーネントはこのファイルを経由して Tauri Command を呼び出す。
 *
 * 注意: bindings.ts は `npm run tauri dev` 実行時に specta が自動更新する。
 * 新しいコマンドや型を追加した後は `tauri dev` を再起動して bindings.ts を更新すること。
 * bindings.ts にまだ反映されていない型はこのファイルに暫定定義している。
 * bindings.ts が更新された後は暫定定義を削除して re-export に切り替えること。
 */

import { invoke } from '@tauri-apps/api/core';

// specta が自動生成した bindings からコマンドと型をインポート
// bindings.ts に存在する型のみ re-export する
import { commands } from './bindings';
export { commands } from './bindings';
export type {
  HttpRequest,
  HttpResponse,
  HttpMethod,
  KeyValue,
  RequestBody,
  ResponseKeyValue,
  AppError,
  AppErrorCode,
  Result,
} from './bindings';

// bindings.ts からインポートする型（内部利用）
import type { AppError, Result, HttpMethod, KeyValue, RequestBody } from './bindings';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 暫定型定義（bindings.ts に specta が反映するまでの間）
// `npm run tauri dev` を実行すると bindings.ts が更新され、
// その後はこのセクションを削除して re-export に切り替えられる
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Phase 3: 履歴エントリー型 */
export interface HistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: RequestBody | null;
  status: number | null;
  elapsed_ms: number | null;
  timestamp: string;
}

/** Phase 4: コレクション内の保存済みリクエスト */
export interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: RequestBody | null;
}

/** Phase 4: コレクション内のフォルダ（再帰的にネスト可能） */
export interface CollectionFolder {
  id: string;
  name: string;
  requests: SavedRequest[];
  folders: CollectionFolder[];
}

/** Phase 4: コレクション */
export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
  folders: CollectionFolder[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 基盤ユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * AppError かどうかを判定する型ガード
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * specta の Result 型から成功値を取り出すヘルパー
 */
export function unwrapResult<T>(result: Result<T, AppError>): T {
  if (result.status === 'ok') {
    return result.data;
  }
  throw result.error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTP リクエストコマンド
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * HTTP リクエストを送信し、成功値を返す便利関数
 */
export async function sendRequest(
  req: Parameters<typeof commands.sendRequest>[0]
) {
  const result = await commands.sendRequest(req);
  return unwrapResult(result);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 3: 履歴コマンドのラッパー
// invoke() を直接呼び出す（bindings.ts にコマンドが反映されるまでの暫定対応）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 履歴エントリーを保存する
 */
export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  await invoke('save_history_entry', { entry });
}

/**
 * 全履歴エントリーを取得する（新しい順）
 */
export async function getHistory(): Promise<HistoryEntry[]> {
  return await invoke<HistoryEntry[]>('get_history');
}

/**
 * 指定した ID の履歴エントリーを削除する
 */
export async function deleteHistoryEntry(id: string): Promise<void> {
  await invoke('delete_history_entry', { id });
}

/**
 * 全履歴を削除する
 */
export async function clearHistory(): Promise<void> {
  await invoke('clear_history');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 4: コレクションコマンドのラッパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 全コレクションを取得する
 */
export async function getCollections(): Promise<Collection[]> {
  return await invoke<Collection[]>('get_collections');
}

/**
 * コレクション全体を上書き保存する
 */
export async function saveCollections(collections: Collection[]): Promise<void> {
  await invoke('save_collections', { collections });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// エラーユーティリティ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * あらゆるエラーを AppError 形式に正規化する
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: 'Unexpected',
      message: error.message,
      detail: error.stack ?? null,
    };
  }

  return {
    code: 'Unexpected',
    message: String(error),
    detail: null,
  };
}
