/**
 * HeaderEditor.tsx - リクエストヘッダー編集コンポーネント
 *
 * HTTP リクエストに付与するカスタムヘッダーを Key-Value 形式で編集する。
 * Postman のヘッダーエディタに似た UI を提供する。
 *
 * 主な機能:
 * - ヘッダー行の追加・削除
 * - 各行の有効/無効切替（チェックボックス）
 * - Key / Value のインライン編集
 * - 空行の自動追加（最後の行に入力すると新しい行が追加される）
 */

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import type { KeyValue } from '@/lib/tauri';

/** HeaderEditor コンポーネントの Props */
interface HeaderEditorProps {
  /** 現在のヘッダー一覧（KeyValue 配列） */
  headers: KeyValue[];
  /** ヘッダーが変更されたときのコールバック（新しい配列全体を渡す） */
  onChange: (headers: KeyValue[]) => void;
}

/**
 * 新しい空のヘッダー行を生成するヘルパー関数
 * 初期状態: key と value は空文字、enabled は true
 */
function createEmptyHeader(): KeyValue {
  return { key: '', value: '', enabled: true };
}

export function HeaderEditor({ headers, onChange }: HeaderEditorProps) {
  /**
   * 特定の行のフィールドを更新するハンドラー
   * index: 更新対象の行番号
   * field: 更新するフィールド名（"key" | "value" | "enabled"）
   * value: 新しい値
   *
   * 不変性を保つために配列をコピーしてから更新する
   */
  const updateHeader = useCallback(
    (index: number, field: keyof KeyValue, fieldValue: string | boolean) => {
      const updated = headers.map((header, i) =>
        i === index ? { ...header, [field]: fieldValue } : header
      );
      onChange(updated);
    },
    [headers, onChange]
  );

  /**
   * 新しい空のヘッダー行を末尾に追加するハンドラー
   * 「+ Add Header」ボタン押下時に呼ばれる
   */
  const addHeader = useCallback(() => {
    onChange([...headers, createEmptyHeader()]);
  }, [headers, onChange]);

  /**
   * 指定した行を削除するハンドラー
   * ゴミ箱アイコン押下時に呼ばれる
   * ヘッダーが 1 行しかない場合は削除せず、空行にリセットする
   */
  const removeHeader = useCallback(
    (index: number) => {
      if (headers.length <= 1) {
        // 最後の 1 行は削除せず、空の状態にリセットする
        onChange([createEmptyHeader()]);
        return;
      }
      onChange(headers.filter((_, i) => i !== index));
    },
    [headers, onChange]
  );

  return (
    <div className="space-y-2">
      {/* ─── テーブルヘッダー ─── */}
      {/* 各列のラベルを表示する（チェック / Key / Value / 削除） */}
      <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 px-1">
        {/* チェックボックス列のヘッダー（空白） */}
        <div />
        <span className="text-xs font-medium text-muted-foreground">Key</span>
        <span className="text-xs font-medium text-muted-foreground">Value</span>
        {/* 削除ボタン列のヘッダー（空白） */}
        <div />
      </div>

      {/* ─── ヘッダー行の一覧 ─── */}
      {/* 各ヘッダーを 1 行ずつ表示する（チェック + Key入力 + Value入力 + 削除ボタン） */}
      {headers.map((header, index) => (
        <div
          key={index}
          className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 items-center group"
        >
          {/* 有効/無効チェックボックス */}
          {/* チェックを外すとこのヘッダーはリクエストに含まれなくなる */}
          <div className="flex items-center justify-center">
            <Checkbox
              checked={header.enabled}
              onCheckedChange={(checked) =>
                updateHeader(index, 'enabled', checked === true)
              }
              aria-label={`ヘッダー ${index + 1} の有効/無効`}
            />
          </div>

          {/* Key 入力欄（ヘッダー名。例: "Content-Type", "Authorization"） */}
          <Input
            value={header.key}
            onChange={(e) => updateHeader(index, 'key', e.target.value)}
            placeholder="Header name"
            className={`font-mono text-xs h-8 ${
              !header.enabled ? 'opacity-50' : '' /* 無効時は半透明にする */
            }`}
          />

          {/* Value 入力欄（ヘッダー値。例: "application/json", "Bearer xxx"） */}
          <Input
            value={header.value}
            onChange={(e) => updateHeader(index, 'value', e.target.value)}
            placeholder="Header value"
            className={`font-mono text-xs h-8 ${
              !header.enabled ? 'opacity-50' : '' /* 無効時は半透明にする */
            }`}
          />

          {/* 削除ボタン（ホバー時のみ表示される） */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => removeHeader(index)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            aria-label={`ヘッダー ${index + 1} を削除`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}

      {/* ─── ヘッダー追加ボタン ─── */}
      {/* クリックすると新しい空行が末尾に追加される */}
      <Button
        variant="ghost"
        size="sm"
        onClick={addHeader}
        className="text-muted-foreground hover:text-foreground gap-1"
      >
        <Plus className="size-3.5" />
        Add Header
      </Button>
    </div>
  );
}
