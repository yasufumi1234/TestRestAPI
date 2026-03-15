/**
 * CodeEditor.tsx - CodeMirror ラッパーコンポーネント
 *
 * CodeMirror 6 を React コンポーネントとしてラップする。
 * リクエストボディの編集（JSON / Text）やレスポンスボディの表示に使用する。
 *
 * 主な機能:
 * - JSON シンタックスハイライト（lang-json 拡張）
 * - ダークテーマ対応（One Dark テーマ）
 * - 読み取り専用モード（レスポンス表示用）
 * - 外部からの値変更に追従（controlled component 的な動作）
 * - プレースホルダー表示
 */

import { useRef, useEffect, useCallback } from 'react';
import { EditorView, placeholder as cmPlaceholder, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';

/** CodeEditor コンポーネントの Props */
interface CodeEditorProps {
  /** エディタに表示する値（外部から制御） */
  value: string;
  /** 値が変更されたときのコールバック（読み取り専用時は不要） */
  onChange?: (value: string) => void;
  /** 使用する言語モード（現在は "json" のみ対応。将来 XML 等を追加可能） */
  language?: 'json' | 'text';
  /** true にするとエディタを読み取り専用にする（レスポンス表示用） */
  readOnly?: boolean;
  /** エディタが空のときに表示するプレースホルダーテキスト */
  placeholder?: string;
  /** エディタの最小高さ（CSS の値。例: "200px"） */
  minHeight?: string;
  /** エディタの最大高さ（CSS の値。例: "400px"） */
  maxHeight?: string;
  /** 追加の CSS クラス名 */
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = 'text',
  readOnly = false,
  placeholder = '',
  minHeight = '200px',
  maxHeight,
  className = '',
}: CodeEditorProps) {
  /**
   * CodeMirror のエディタビューを保持する ref
   * コンポーネントの再レンダリング間でインスタンスを維持する
   */
  const viewRef = useRef<EditorView | null>(null);

  /**
   * エディタをマウントする DOM 要素への ref
   * useEffect 内で EditorView の parent として使用する
   */
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * onChange コールバックの最新版を保持する ref
   * EditorView の dispatch 内で最新の onChange を参照するために使用する
   * （useEffect の依存配列に onChange を含めずに済むようにする）
   */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /**
   * CodeMirror の拡張機能（Extensions）を組み立てるヘルパー
   * language / readOnly / placeholder の変更時に再構築される
   */
  const buildExtensions = useCallback(() => {
    const extensions = [
      // 基本的なキーバインド（Ctrl+Z で Undo、Ctrl+Shift+Z で Redo 等）
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
      ]),
      // 編集履歴（Undo / Redo）のサポート
      history(),
      // 対応する括弧のハイライト表示
      bracketMatching(),
      // コード折りたたみ用のガター（行番号の横に ▶ が表示される）
      foldGutter(),
      // デフォルトのシンタックスハイライト配色
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      // ダークテーマ（One Dark）を適用
      oneDark,
      // エディタの行折り返しを有効にする（横スクロールを防ぐ）
      EditorView.lineWrapping,
      // エディタのテーマ（高さ・ボーダー等のスタイル）をカスタマイズ
      EditorView.theme({
        // エディタ全体のスタイル
        '&': {
          minHeight,
          ...(maxHeight ? { maxHeight } : {}),
          border: '1px solid hsl(var(--border))',
          borderRadius: 'calc(var(--radius) - 2px)',
          fontSize: '13px',
        },
        // スクロール可能な領域のスタイル
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        },
        // フォーカス時のアウトラインを非表示にする（ボーダーで代替）
        '&.cm-focused': {
          outline: 'none',
        },
      }),
    ];

    // JSON モードの場合は JSON 言語拡張を追加する
    if (language === 'json') {
      extensions.push(json());
    }

    // 読み取り専用モードの場合は編集を禁止する
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
      extensions.push(EditorView.editable.of(false));
    }

    // プレースホルダーが指定されている場合は表示する
    if (placeholder) {
      extensions.push(cmPlaceholder(placeholder));
    }

    return extensions;
  }, [language, readOnly, placeholder, minHeight, maxHeight]);

  /**
   * EditorView の初期化と破棄を管理する Effect
   * コンポーネントのマウント時に EditorView を作成し、アンマウント時に破棄する
   */
  useEffect(() => {
    // マウント先の DOM 要素が存在しない場合は何もしない
    if (!containerRef.current) return;

    // EditorView のインスタンスを作成する
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: buildExtensions(),
      }),
      parent: containerRef.current,
      /**
       * dispatch をオーバーライドして、テキスト変更時に onChange コールバックを呼ぶ
       * CodeMirror はデフォルトでは React の state と連動しないため、
       * ここで変更を検知して外部に通知する
       *
       * 注意: カスタム dispatch の中で view.dispatch() を呼ぶと、
       * view.dispatch 自体がこのカスタム関数に置き換わっているため
       * 無限再帰になる。view.update([tr]) を使うことで
       * カスタム dispatch を経由せずに直接内部状態を更新できる。
       */
      dispatch: (transaction) => {
        // view.update() でトランザクションを適用する（再帰を避けるため dispatch は使わない）
        view.update([transaction]);
        // ドキュメントに変更があった場合のみ onChange を呼ぶ
        if (transaction.docChanged && onChangeRef.current) {
          onChangeRef.current(view.state.doc.toString());
        }
      },
    });

    // ref にインスタンスを保存する（外部からの値変更に使用）
    viewRef.current = view;

    // クリーンアップ: コンポーネントのアンマウント時にエディタを破棄する
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly, placeholder, minHeight, maxHeight]);

  /**
   * 外部から value が変更されたときにエディタの内容を同期する Effect
   * ユーザーの入力による変更ではなく、React の state 変更に追従するために使用する
   */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // 現在のエディタの内容と外部の value が異なる場合のみ更新する
    // （ユーザーの入力で onChange → setState → value 変更 → ここに来るが、
    //   内容が同じなら何もしないことで無限ループを防ぐ）
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`code-editor-wrapper overflow-hidden rounded-md ${className}`}
    />
  );
}
