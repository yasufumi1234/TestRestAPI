/**
 * RequestPanel.tsx - リクエストビルダーのタブパネルコンポーネント
 *
 * URL バーの下に表示されるタブ切替パネル。
 * Headers / Body の 2 つのタブを持ち、それぞれのエディタを切り替えて表示する。
 *
 * 構成:
 * - Headers タブ: ヘッダーエディタ（KeyValue テーブル）
 * - Body タブ: ボディエディタ（CodeMirror + 種別切替）
 *
 * Phase 4 で Params（クエリパラメータ）タブを追加予定。
 */

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { HeaderEditor } from './HeaderEditor';
import { BodyEditor } from './BodyEditor';
import type { KeyValue, RequestBody } from '@/lib/tauri';

/** RequestPanel コンポーネントの Props */
interface RequestPanelProps {
  /** 現在のヘッダー一覧（KeyValue 配列） */
  headers: KeyValue[];
  /** ヘッダーが変更されたときのコールバック */
  onHeadersChange: (headers: KeyValue[]) => void;
  /** 現在のリクエストボディ（null = none） */
  body: RequestBody | null;
  /** ボディが変更されたときのコールバック */
  onBodyChange: (body: RequestBody | null) => void;
}

export function RequestPanel({
  headers,
  onHeadersChange,
  body,
  onBodyChange,
}: RequestPanelProps) {
  /**
   * 有効なヘッダーの数を計算する
   * タブのバッジに表示して、設定済みヘッダー数をユーザーに知らせる
   * enabled=true かつ key が空でないヘッダーのみをカウントする
   */
  const activeHeaderCount = headers.filter(
    (h) => h.enabled && h.key.trim() !== ''
  ).length;

  /**
   * ボディが設定されているかどうかを判定する
   * タブのバッジに表示して、ボディの有無をユーザーに知らせる
   */
  const hasBody = body !== null;

  return (
    <Tabs defaultValue="headers" className="w-full">
      {/* ─── タブリスト ─── */}
      {/* Headers / Body の切替タブを横並びで表示する */}
      <TabsList variant="line" className="w-full justify-start">
        {/* Headers タブ（有効なヘッダー数をバッジ表示） */}
        <TabsTrigger value="headers" className="gap-1.5">
          Headers
          {/* 有効なヘッダーがある場合のみバッジを表示する */}
          {activeHeaderCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium leading-none">
              {activeHeaderCount}
            </span>
          )}
        </TabsTrigger>

        {/* Body タブ（ボディが設定されている場合にドットを表示） */}
        <TabsTrigger value="body" className="gap-1.5">
          Body
          {/* ボディが設定されている場合に緑色のドットを表示する */}
          {hasBody && (
            <span className="inline-block size-1.5 rounded-full bg-green-500" />
          )}
        </TabsTrigger>
      </TabsList>

      {/* ─── Headers タブの内容 ─── */}
      {/* ヘッダーエディタ（KeyValue テーブル）を表示する */}
      <TabsContent value="headers" className="mt-3">
        <HeaderEditor headers={headers} onChange={onHeadersChange} />
      </TabsContent>

      {/* ─── Body タブの内容 ─── */}
      {/* ボディエディタ（CodeMirror + 種別切替）を表示する */}
      <TabsContent value="body" className="mt-3">
        <BodyEditor body={body} onChange={onBodyChange} />
      </TabsContent>
    </Tabs>
  );
}
