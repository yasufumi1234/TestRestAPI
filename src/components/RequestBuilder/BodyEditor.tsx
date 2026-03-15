/**
 * BodyEditor.tsx - リクエストボディ編集コンポーネント
 *
 * HTTP リクエストのボディを編集する。
 * ボディの種別（none / JSON / Text）を切り替えられる。
 *
 * 主な機能:
 * - ボディ種別の選択（none / JSON / Text）
 * - CodeMirror によるボディ内容の編集
 * - JSON モード時はシンタックスハイライト + バリデーション
 * - none 選択時はボディなし（GET / DELETE で使用）
 */

import { CodeEditor } from '@/components/ui/CodeEditor';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RequestBody } from '@/lib/tauri';
import { useMemo, useCallback } from 'react';

/** ボディ種別の選択肢 */
type BodyType = 'none' | 'json' | 'text';

/** BodyEditor コンポーネントの Props */
interface BodyEditorProps {
  /** 現在のリクエストボディ（null = none） */
  body: RequestBody | null;
  /** ボディが変更されたときのコールバック */
  onChange: (body: RequestBody | null) => void;
}

/**
 * RequestBody から現在のボディ種別を判定するヘルパー関数
 * null → "none"、{ Json: ... } → "json"、{ Text: ... } → "text"
 */
function getBodyType(body: RequestBody | null): BodyType {
  if (!body) return 'none';
  if ('Json' in body) return 'json';
  if ('Text' in body) return 'text';
  return 'none';
}

/**
 * RequestBody から現在のボディ内容（テキスト）を取り出すヘルパー関数
 * null の場合は空文字を返す
 */
function getBodyContent(body: RequestBody | null): string {
  if (!body) return '';
  if ('Json' in body) return body.Json.content;
  if ('Text' in body) return body.Text.content;
  return '';
}

export function BodyEditor({ body, onChange }: BodyEditorProps) {
  // 現在のボディ種別（none / json / text）
  const bodyType = useMemo(() => getBodyType(body), [body]);
  // 現在のボディ内容（テキスト）
  const bodyContent = useMemo(() => getBodyContent(body), [body]);

  /**
   * ボディ種別が変更されたときのハンドラー
   * 種別を切り替えると、既存のボディ内容を新しい種別に引き継ぐ
   * none に切り替えた場合はボディを null にする
   */
  const handleTypeChange = useCallback(
    (newType: string) => {
      const type = newType as BodyType;
      if (type === 'none') {
        // none: ボディなし
        onChange(null);
      } else if (type === 'json') {
        // JSON: 既存の内容を引き継ぐ（なければ空文字）
        onChange({ Json: { content: getBodyContent(body) } });
      } else {
        // Text: 既存の内容を引き継ぐ（なければ空文字）
        onChange({ Text: { content: getBodyContent(body) } });
      }
    },
    [body, onChange]
  );

  /**
   * エディタの内容が変更されたときのハンドラー
   * 現在のボディ種別に応じて適切な RequestBody 形式で親に通知する
   */
  const handleContentChange = useCallback(
    (content: string) => {
      if (bodyType === 'json') {
        onChange({ Json: { content } });
      } else if (bodyType === 'text') {
        onChange({ Text: { content } });
      }
    },
    [bodyType, onChange]
  );

  /**
   * JSON の構文が正しいかどうかを検証する
   * エディタの下部にバリデーション結果を表示するために使用する
   */
  const jsonError = useMemo(() => {
    // JSON モードでない場合、または内容が空の場合はバリデーション不要
    if (bodyType !== 'json' || !bodyContent.trim()) return null;
    try {
      JSON.parse(bodyContent);
      return null; // パース成功 → エラーなし
    } catch (e) {
      // パース失敗 → エラーメッセージを返す
      return e instanceof Error ? e.message : 'Invalid JSON';
    }
  }, [bodyType, bodyContent]);

  /** JSON モード時に入力内容を整形して見やすくする */
  const handleFormatJson = useCallback(() => {
    if (bodyType !== 'json' || !bodyContent.trim()) return;
    try {
      const parsed = JSON.parse(bodyContent);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange({ Json: { content: formatted } });
    } catch {
      // 無効な JSON は整形できないため何もしない
    }
  }, [bodyType, bodyContent, onChange]);

  return (
    <div className="space-y-3">
      {/* ─── ボディ種別セレクター ─── */}
      {/* none / JSON / Text を切り替えるドロップダウン */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          Content Type
        </span>
        <Select value={bodyType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* none: ボディなし（GET / DELETE 等で使用） */}
            <SelectItem value="none" className="text-xs">
              none
            </SelectItem>
            {/* JSON: application/json として送信 */}
            <SelectItem value="json" className="text-xs">
              JSON
            </SelectItem>
            {/* Text: text/plain として送信 */}
            <SelectItem value="text" className="text-xs">
              Text
            </SelectItem>
          </SelectContent>
        </Select>

        {/* JSON バリデーション結果の表示 */}
        {/* JSON モードで構文エラーがある場合に赤字で表示する */}
        {bodyType === 'json' && bodyContent.trim() && (
          <span
            className={`text-xs ${
              jsonError ? 'text-destructive' : 'text-green-600'
            }`}
          >
            {jsonError ? `⚠ ${jsonError}` : '✓ Valid JSON'}
          </span>
        )}

        {bodyType === 'json' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleFormatJson}
            disabled={!!jsonError || !bodyContent.trim()}
          >
            JSON整形
          </Button>
        )}
      </div>

      {/* ─── ボディエディタ本体 ─── */}
      {/* none 以外の場合に CodeMirror エディタを表示する */}
      {bodyType !== 'none' ? (
        <CodeEditor
          value={bodyContent}
          onChange={handleContentChange}
          language={bodyType === 'json' ? 'json' : 'text'}
          placeholder={
            bodyType === 'json'
              ? '{\n  "key": "value"\n}'
              : 'Enter request body...'
          }
          minHeight="150px"
          maxHeight="300px"
        />
      ) : (
        /* none の場合はプレースホルダーメッセージを表示する */
        <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm border rounded-md bg-muted/30">
          <p>このリクエストにはボディがありません</p>
        </div>
      )}
    </div>
  );
}
