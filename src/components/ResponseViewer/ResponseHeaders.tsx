/**
 * ResponseHeaders.tsx - レスポンスヘッダーテーブルコンポーネント
 *
 * レスポンスのヘッダーを Key-Value のテーブル形式で表示する。
 */

import type { ResponseKeyValue } from '@/lib/tauri';

/** ResponseHeaders コンポーネントの Props */
interface ResponseHeadersProps {
  headers: ResponseKeyValue[]; // レスポンスヘッダーの配列
}

export function ResponseHeaders({ headers }: ResponseHeadersProps) {
  // ヘッダーが空の場合はメッセージを表示
  if (headers.length === 0) {
    return <p className="text-muted-foreground text-sm">ヘッダーなし</p>;
  }

  // ヘッダーを Key-Value テーブルとして描画
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        {/* テーブルヘッダー */}
        <thead>
          <tr className="bg-muted">
            <th className="text-left px-3 py-2 font-medium w-1/3">Key</th>
            <th className="text-left px-3 py-2 font-medium">Value</th>
          </tr>
        </thead>
        {/* テーブルボディ: 各ヘッダーを 1 行ずつ表示 */}
        <tbody>
          {headers.map((header, index) => (
            <tr key={index} className="border-t">
              {/* ヘッダー名（等幅フォント・グレー表示） */}
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {header.key}
              </td>
              {/* ヘッダー値（長い値は折り返し） */}
              <td className="px-3 py-2 font-mono text-xs break-all">
                {header.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
