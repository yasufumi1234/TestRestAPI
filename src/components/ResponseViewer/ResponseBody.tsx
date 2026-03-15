/**
 * ResponseBody.tsx - レスポンスボディ表示コンポーネント
 *
 * レスポンスのボディ（テキスト）を CodeMirror で表示する。
 * JSON の場合はインデント付きで整形表示し、シンタックスハイライトを適用する。
 *
 * Phase 2 で変更した点:
 * - <pre> タグによる表示から CodeMirror（読み取り専用）に置き換え
 * - JSON のシンタックスハイライト対応
 * - コード折りたたみ対応
 */

import { useMemo } from 'react';
import { CodeEditor } from '@/components/ui/CodeEditor';

/** ResponseBody コンポーネントの Props */
interface ResponseBodyProps {
  /** レスポンスボディのテキスト */
  body: string;
}

export function ResponseBody({ body }: ResponseBodyProps) {
  /**
   * レスポンスボディが JSON かどうかを判定し、整形する
   * useMemo で body が変わるまでは再計算しない（パフォーマンス対策）
   *
   * 戻り値:
   * - content: 表示するテキスト（JSON なら整形済み、それ以外はそのまま）
   * - isJson: JSON として正常にパースできたかどうか
   */
  const { content, isJson } = useMemo(() => {
    try {
      const parsed = JSON.parse(body);
      return {
        content: JSON.stringify(parsed, null, 2), // 2 スペースインデントで整形
        isJson: true,
      };
    } catch {
      return {
        content: body, // パース失敗 → JSON ではないのでそのまま返す
        isJson: false,
      };
    }
  }, [body]);

  // ボディが空の場合はメッセージを表示する
  if (!body) {
    return (
      <p className="text-muted-foreground text-sm">レスポンスボディが空です</p>
    );
  }

  // CodeMirror を読み取り専用モードで表示する
  // JSON の場合はシンタックスハイライト付き、それ以外はプレーンテキスト
  return (
    <CodeEditor
      value={content}
      language={isJson ? 'json' : 'text'}
      readOnly={true}
      minHeight="100px"
      maxHeight="100%"
    />
  );
}
