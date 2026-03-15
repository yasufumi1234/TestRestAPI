# REST Client

Postman の代替デスクトップ REST API クライアント。  
Tauri 2 + React + TypeScript + Rust (reqwest) で構築。

## 推奨 IDE

- [VS Code](https://code.visualstudio.com/)
  - 拡張機能: [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - 拡張機能: [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---

## 前提条件

| ツール                     | インストール方法                          |
| -------------------------- | ----------------------------------------- |
| Node.js (LTS)              | https://nodejs.org/                       |
| Rust (stable)              | https://rustup.rs/                        |
| Tauri の依存 (WebView2 等) | https://v2.tauri.app/start/prerequisites/ |

---

## セットアップ

```bash
npm install
```

---

## 開発・実行

### デバッグ起動（開発モード）

ホットリロードが有効な状態でアプリを起動します。  
起動時に `src/lib/bindings.ts`（specta 生成の TypeScript 型定義）が自動更新されます。

```bash
npm run tauri dev
```

- フロントエンド (Vite): `http://localhost:1420` で起動
- Rust 側の変更も自動で再コンパイルされます
- ログレベルは `RUST_LOG` 環境変数で制御できます

```bash
# ログを詳細表示する場合（PowerShell）
$env:RUST_LOG="debug"; npm run tauri dev

# ログを詳細表示する場合（bash / zsh）
RUST_LOG=debug npm run tauri dev
```

### フロントエンドのみ起動（Vite dev server）

Rust を含まないフロントエンド単体の確認に使います。

```bash
npm run dev
```

---

## ビルド

### リリースビルド（インストーラー生成）

最適化されたバイナリと Windows インストーラー（MSI / NSIS）を生成します。

```bash
npm run tauri build
```

生成物:

```
src-tauri/target/release/bundle/
  msi/    ← .msi インストーラー
  nsis/   ← .exe インストーラー
```

### デバッグビルド（インストーラー生成、未最適化）

ビルド時間を短縮したい場合や、動作確認用インストーラーを作る場合。

```bash
npm run tauri build -- --debug
```

生成物:

```
src-tauri/target/debug/bundle/
  msi/    ← .msi インストーラー
  nsis/   ← .exe インストーラー
```

### TypeScript ビルド（型チェックのみ）

```bash
npx tsc --noEmit
```

---

## TypeScript 型定義の自動生成（specta）

`npm run tauri dev` または `npm run tauri build -- --debug` の実行時に、  
Rust 側の Command DTO から TypeScript 型が自動生成されます。

```
src/lib/bindings.ts  ← 自動生成（編集不要）
```

Rust 側の型定義 (`src-tauri/src/types/`) を変更したら、  
`npm run tauri dev` を再起動することで型定義が更新されます。

---

## プロジェクト構成

```
TestRestAPI/
├── src/                              フロントエンド（React + TypeScript）
│   ├── stores/
│   │   └── requestStore.ts           Zustand 状態管理ストア（Phase 4）
│   ├── components/
│   │   ├── RequestBuilder/           リクエストビルダー
│   │   │   ├── UrlBar.tsx            URL・メソッド入力（Phase 1）
│   │   │   ├── RequestPanel.tsx      タブパネル: Headers / Body（Phase 2）
│   │   │   ├── HeaderEditor.tsx      ヘッダー Key-Value エディタ（Phase 2）
│   │   │   ├── BodyEditor.tsx        ボディエディタ + 種別切替（Phase 2）
│   │   │   ├── RequestTabs.tsx       リクエストタブバー（Phase 4）
│   │   │   └── EnvironmentSelector.tsx 環境変数セレクター（Phase 4）
│   │   ├── ResponseViewer/           レスポンス表示
│   │   │   ├── ResponseViewer.tsx    メイン表示（Phase 1）
│   │   │   ├── ResponseBody.tsx      ボディ表示 + CodeMirror（Phase 2）
│   │   │   ├── ResponseHeaders.tsx   ヘッダーテーブル（Phase 1）
│   │   │   └── StatusBar.tsx         ステータスバー（Phase 1）
│   │   ├── Sidebar/                  サイドバー
│   │   │   ├── Sidebar.tsx           サイドバー本体（Phase 1〜）
│   │   │   ├── HistoryList.tsx       履歴一覧（Phase 3）
│   │   │   └── CollectionTree.tsx    コレクションツリー（Phase 4）
│   │   └── ui/                       shadcn/ui コンポーネント
│   │       ├── CodeEditor.tsx        CodeMirror ラッパー（Phase 2）
│   │       ├── tabs.tsx / checkbox.tsx / button.tsx / input.tsx / select.tsx
│   │       └── ...
│   └── lib/
│       ├── bindings.ts               specta 自動生成の型定義
│       ├── tauri.ts                  Tauri Command 呼び出しラッパー
│       └── utils.ts                  ユーティリティ（cn 関数等）
│
└── src-tauri/                        バックエンド（Rust）
    └── src/
        ├── commands/
        │   ├── http.rs               send_request コマンド（reqwest）
        │   ├── history.rs            履歴の永続化コマンド（Phase 3）
        │   └── collection.rs         コレクション管理コマンド（Phase 4）
        ├── types/
        │   ├── http.rs               HTTP DTO（HttpRequest / HttpResponse 等）
        │   ├── history.rs            履歴 DTO（HistoryEntry / HistoryStore）（Phase 3）
        │   └── collection.rs         コレクション DTO（Collection / SavedRequest）（Phase 4）
        └── error.rs                  AppResult / AppError
```

---

## コレクション仕様

### 現状（Phase 5）

- コレクションは JSON ファイルとして永続化される（`$APPDATA/com.y123y.tauri-app/collections.json`）
- コレクションの追加・削除ができる
- コレクション配下にフォルダ / サブフォルダを追加・削除できる
- 現在編集中のリクエストをコレクションに保存できる
- 保存済みリクエストをクリックして、メソッド/URL/ヘッダー/ボディを復元できる
- 履歴 API をドラッグ&ドロップ（D&D）でコレクション直下 / 任意フォルダへ保存できる
- D&D 実装には React 向けライブラリ `dnd-kit` を採用している
- ドロップ先はコレクション直下 / 任意フォルダ（ネスト含む）をサポートする
- 保存時は `SavedRequest` としてコレクションデータへ反映し、即時永続化する

#### 操作フロー

1. ユーザーが履歴一覧の API エントリーをドラッグ開始する
2. コレクションツリー上でドロップ可能なコレクション / フォルダをハイライト表示する
3. ユーザーが保存先のコレクション直下、または任意フォルダへドロップする
4. ドロップ時に履歴エントリーから `SavedRequest` を生成し、対象ノード配下へ追加する
5. 保存後はツリー表示を更新し、コレクション JSON を即時保存する

#### UI 要件

- ドラッグ中は対象履歴エントリーを視覚的に強調表示する
- ドロップ不可領域では拒否カーソルまたは非活性表示を行う
- ドロップ可能ノードでは hover / active 状態を明確に表示する
- ネストされたフォルダにもドロップできるようにする
- 将来的な並び替えやフォルダ間移動に拡張しやすいイベント設計にする

#### 実装方針（`dnd-kit` 採用案）

- `HistoryList` 側の履歴エントリーを draggable source として扱う
- `CollectionTree` 側のコレクション / フォルダを droppable target として扱う
- ドラッグ中のメタデータには履歴エントリー ID、および保存に必要な request 情報を持たせる
- ドロップ時に target ノード種別（コレクション直下 / フォルダ）を判定し、対応する階層へ `SavedRequest` を追加する
- 状態更新はフロントエンドで完結させ、更新後のコレクション全体を Rust 側へ保存する
- 将来的にフォルダ間移動や並び替えへ拡張できるよう、source / target / operation を分離した設計にする

#### `dnd-kit` を採用する理由

- React の state 管理と相性が良く、コンポーネント分割しやすい
- ネストされたツリー構造でも、drop target の責務を整理しやすい
- hover / active / dragging の視覚状態を制御しやすい
- 将来的な並び替え、フォルダ間移動、キーボード操作対応へ拡張しやすい
- HTML5 ネイティブ D&D API を全面的に自前制御するより、複雑化しやすい UI ロジックを抑えやすい

---

## 開発フェーズ

| フェーズ | 内容                                                                      | 状態    |
| -------- | ------------------------------------------------------------------------- | ------- |
| Phase 1  | プロジェクト構築・GET リクエスト疎通・Rust エラー/ログ基盤・specta 型生成 | ✅ 完了 |
| Phase 2  | リクエストビルダー（ヘッダー・ボディ・バリデーション）・CodeMirror        | ✅ 完了 |
| Phase 3  | リクエスト履歴の保存（JSON ファイル）・Rust テスト                        | ✅ 完了 |
| Phase 4  | コレクション管理・タブ・環境変数・Zustand                                 | ✅ 完了 |
| Phase 5  | 履歴 API の任意フォルダ保存（D&D）                                        | ✅ 完了 |
