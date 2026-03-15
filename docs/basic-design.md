# REST API クライアント - 基本設計書

## 1. プロジェクト概要

### 1.1 目的

Postman の代替となるデスクトップ REST API クライアントを自作する。
学習を主目的とし、React と Rust の実践的なスキル習得を目指す。

### 1.2 アプリケーション種別

- デスクトップアプリケーション（Windows / macOS / Linux）
- Tauri フレームワークによるクロスプラットフォーム対応

---

## 2. 技術スタック

### 2.1 コア技術

| 役割                       | 技術       | バージョン方針 |
| -------------------------- | ---------- | -------------- |
| デスクトップフレームワーク | Tauri 2    | 最新安定版     |
| フロントエンド             | React      | 最新安定版     |
| バックエンド               | Rust       | 最新安定版     |
| 型システム                 | TypeScript | 最新安定版     |

### 2.2 フロントエンド

| 技術            | 用途                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| TypeScript      | 型安全な開発                                                                               |
| Tailwind CSS    | ユーティリティファーストのスタイリング                                                     |
| shadcn/ui       | UI コンポーネントライブラリ（タブ、ドロップダウン、モーダル等）                            |
| CodeMirror 6    | JSON/XML/HTML のシンタックスハイライト付きエディタ（リクエストボディ入力・レスポンス表示） |
| Zustand         | 軽量な状態管理（現在のリクエスト、レスポンス、タブ一覧等）                                 |
| TanStack Router | 画面ルーティング（コレクション画面、設定画面等）                                           |

### 2.3 バックエンド（Rust）

| 技術               | 用途                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| reqwest            | HTTP クライアント（CORS 回避のため Rust 側で HTTP リクエストを実行） |
| serde / serde_json | JSON シリアライズ / デシリアライズ                                   |

### 2.4 データ保存

段階的にアプローチする。

| フェーズ   | 保存方式      | 理由                                                         |
| ---------- | ------------- | ------------------------------------------------------------ |
| Phase 1〜3 | JSON ファイル | serde_json で構造体をそのまま保存。シンプルに素早く形にする  |
| Phase 4〜  | SQLite        | 履歴の検索・絞り込み、コレクション管理の必要性が出てから移行 |

#### JSON → SQLite 移行の判断基準

- 履歴件数が増えて検索が遅くなったとき
- コレクション → フォルダ → リクエストの親子関係管理が必要になったとき
- データの整合性（クラッシュ時の安全性）が気になったとき

### 2.5 学習強化のための追加技術（推奨）

「React も Rust も充実して学ぶ」前提で、実装コストに対して学びが大きいものを優先して採用する。

#### フロントエンド（React / TypeScript）

| 技術                     | 用途                                                        | 導入タイミング |
| ------------------------ | ----------------------------------------------------------- | -------------- |
| Zod                      | フォーム入力のスキーマバリデーション（URL/ヘッダー/ボディ） | Phase 2        |
| Vitest + Testing Library | UI と状態管理のテスト                                       | Phase 2〜3     |

#### Rust（Tauri / コマンド / 永続化）

| 技術                         | 用途                                             | 導入タイミング |
| ---------------------------- | ------------------------------------------------ | -------------- |
| thiserror                    | ドメインエラー定義（HTTP/永続化/バリデーション） | Phase 1        |
| anyhow                       | アプリ境界でのエラー集約（ログ/表示）            | Phase 1        |
| tracing / tracing-subscriber | ログ・計測（elapsed/リクエストID等）             | Phase 1        |
| wiremock（または類似）       | reqwest まわりのテストで HTTP をモック           | Phase 3〜      |

#### TypeScript ⇄ Rust の型共有（ズレ防止）

Tauri Command の入出力（DTO）が増えるほど、型ズレがバグ源になりやすい。
学習価値が高いため、早期に型共有を導入する。

本プロジェクトでは **specta + tauri-specta を採用**する（決定）。

| 技術                  | 用途                                              | 導入タイミング |
| --------------------- | ------------------------------------------------- | -------------- |
| specta + tauri-specta | Rust 側の型から TS 型を生成し、Command の型を同期 | Phase 1〜2     |

##### 型生成の運用（specta）

- Rust 側で Command の引数/戻り値に使う DTO を定義し、`serde::{Serialize, Deserialize}` と `specta::Type` を付与する。
- `tauri-specta` を使って Command 群の型情報をエクスポートし、フロントエンド用の TS 型定義ファイルを生成する。
- 生成物はフロントエンドから参照しやすい場所に固定し、生成の実行を開発フローに組み込む。

**生成物の配置（例）**

- `src/lib/bindings.ts`（自動生成・フロントから import する）

**生成方法（例）**

- `src-tauri/src/bin/gen_types.rs` を用意し、`src/lib/bindings.ts` を出力する。
- 生成コマンドを `package.json` の script（例: `gen:types`）として呼べるようにする。

**生成物を Git 管理するか**

- 学習目的・環境差の切り分け容易性を優先し、当面は「生成物もコミット」でもよい。
- 生成の安定運用ができたら「生成物はコミットしない（CI で生成・差分チェック）」に切り替える。

### 2.6 導入を後回しにしてよい要素（判断基準）

| 要素            | 後回しにできる条件                                     | コメント                               |
| --------------- | ------------------------------------------------------ | -------------------------------------- |
| TanStack Router | MVP が単一画面（サイドバー + メイン）で完結する        | 画面が増えた段階で導入すると学びが出る |
| Zustand         | タブ管理/コレクション/環境変数が未実装で、状態が局所的 | Phase 4 で本格導入が自然               |
| SQLite          | JSON 保存で十分に回っている                            | Phase 4〜 の移行で設計力が鍛えられる   |

---

## 3. アーキテクチャ

### 3.1 全体構成

```
React (TypeScript)          Tauri Command            Rust (reqwest)
┌──────────────┐     invoke()      ┌──────────────┐     HTTP      ┌──────────────┐
│ フロントエンド │ ──────────────→ │  Tauri 通信層  │ ──────────→ │  対象サーバー  │
│              │ ←────────────── │              │ ←────────── │              │
└──────────────┘     JSON 応答     └──────────────┘   Response   └──────────────┘
```

### 3.2 CORS 回避の設計方針

ブラウザの `fetch()` を使うと CORS 制限に引っかかるため、
HTTP リクエストは必ず Rust 側の `reqwest` で実行する。
これが Tauri でこのアプリを作る最大の利点である。

```
NG: React → fetch() → CORS エラー
OK: React → Tauri Command → Rust (reqwest) → 対象サーバー
```

### 3.3 ディレクトリ構成

Tauri のデフォルト構成に従う。
`src-tauri/` は Tauri CLI が決め打ちで参照するため名前変更不可。

```
TestRestAPI/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── index.html
│
├── docs/                        ← 設計ドキュメント
│   └── basic-design.md
│
├── src/                         ← フロントエンド（React + TypeScript）
│   ├── main.tsx                     エントリーポイント
│   ├── App.tsx                      ルートコンポーネント
│   ├── components/
│   │   ├── RequestBuilder/          URL・メソッド・ヘッダー・ボディ入力
│   │   │   ├── MethodSelector.tsx
│   │   │   ├── UrlBar.tsx
│   │   │   ├── HeaderEditor.tsx
│   │   │   └── BodyEditor.tsx
│   │   ├── ResponseViewer/          レスポンス表示（CodeMirror）
│   │   │   ├── ResponseBody.tsx
│   │   │   ├── ResponseHeaders.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── Sidebar/                 コレクション・履歴一覧
│   │   │   ├── CollectionTree.tsx
│   │   │   └── HistoryList.tsx
│   │   └── TabBar/                  複数リクエストのタブ管理
│   │       └── TabBar.tsx
│   ├── stores/                      Zustand ストア
│   │   ├── requestStore.ts
│   │   └── tabStore.ts
│   └── lib/
│       ├── bindings.ts              specta により生成される型定義（自動生成）
│       └── tauri.ts                 Tauri Command 呼び出しラッパー（bindings を利用）
│
└── src-tauri/                   ← バックエンド（Rust）※名前変更不可
    ├── tauri.conf.json              Tauri 設定ファイル
    ├── Cargo.toml                   Rust 依存管理
    ├── build.rs
    ├── capabilities/
    │   └── default.json
    ├── icons/
    └── src/
        ├── main.rs                  デスクトップエントリーポイント
        ├── lib.rs                   メインロジック
        ├── commands/                Tauri Commands（React から呼ぶ API）
        │   ├── http.rs                  reqwest で HTTP リクエスト実行
        │   ├── collection.rs            コレクション CRUD
        │   └── history.rs               履歴管理
        └── storage/                 データ保存（初期は JSON ファイル）
            └── json_store.rs
```

### 3.4 Tauri Command の契約（AppResult / AppError）

フロントエンド（React）とバックエンド（Rust）の境界を安定させるため、Tauri Command の戻り値とエラー形式を統一する。

#### 基本方針

- Command は原則 `AppResult<T>` を返す（成功は `T`、失敗は `AppError`）。
- API クライアントとして「HTTP の非 2xx ステータス」は **エラー扱いにしない**。
  - 例: 400/401/500 でもレスポンス本文・ヘッダー・elapsed を UI に表示したい。
  - そのため `send_request` の戻り値は `HttpResponse`（ステータス等を含む）として成功で返す。
  - `Err(AppError)` にするのは「送信自体ができない」ケース（URL 不正、タイムアウト、ネットワーク断、TLS、プロキシ不備等）。

#### Rust 側の型（概念）

```rust
// 例: src-tauri/src/types.rs（命名・配置は実装時に調整）
use serde::{Deserialize, Serialize};
use specta::Type;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppError {
  pub code: AppErrorCode,
  pub message: String,
  // 開発中のデバッグ用（ユーザー表示しない前提）。必要なら後で削る。
  pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum AppErrorCode {
  InvalidRequest,
  Network,
  Timeout,
  Io,
  Serialize,
  Unexpected,
}
```

#### フロントエンド側の扱い（invoke ラッパー）

- Tauri の `invoke()` は `Err` を Promise の reject として返す前提で扱う。
- `src/lib/tauri.ts` に「AppError へ正規化して投げ直す」共通ラッパーを用意し、UI は `try/catch` で一貫して扱う。
  - これにより、UI 側は「HTTP エラー（例: 401）」と「通信失敗（タイムアウト等）」を明確に分けて表示できる。

#### セキュリティ/ログ方針

- `AppError.message` は UI 表示用の短い文言に限定し、機密（トークン等）を含めない。
- `AppError.detail` は開発中の調査用。ログ（`tracing`）には詳細を残し、UI 表示は必要最低限にする。

#### Command 例: HTTP リクエスト送信

最初に通す Command は HTTP 送信の 1 本とし、DTO を specta 対応の型で定義する。

```rust
// 例: src-tauri/src/commands/http.rs
// #[tauri::command]
// pub async fn send_request(req: HttpRequest) -> AppResult<HttpResponse> { ... }
```

---

## 4. 主要機能

### 4.1 MVP（最小限の実用機能）

| 機能                | 説明                                                                |
| ------------------- | ------------------------------------------------------------------- |
| HTTP リクエスト送信 | GET / POST / PUT / PATCH / DELETE                                   |
| URL 入力            | アドレスバー形式の URL 入力                                         |
| メソッド選択        | ドロップダウンでメソッド選択                                        |
| ヘッダー編集        | Key-Value 形式でヘッダーを追加・編集・削除                          |
| ボディ編集          | CodeMirror によるシンタックスハイライト付き JSON エディタ           |
| レスポンス表示      | ステータスコード、ヘッダー、ボディ（整形済み JSON）、レスポンス時間 |
| リクエスト履歴      | 過去のリクエストを一覧表示・再実行                                  |

#### 4.1.1 RequestBuilder の UI 振る舞い（Postman 風）

- メソッドはコンボボックスで選択できる（GET / POST / PUT / PATCH / DELETE）
- `RequestBody` の入力欄（テキストボックス / CodeMirror）は、メソッドが **POST / PUT / PATCH** の場合のみ表示する
  - GET / DELETE を選択した場合は BodyEditor を非表示とし、送信時もボディは送らない
  - 送信データとしては `HttpRequest.body = None`（未設定）扱いに統一する
- BodyEditor には「Body 種別」の切り替え（JSON / Text）を用意する
  - 既定は **JSON**（Postman 風の使い勝手を優先）
  - 必要に応じて Text に切り替え可能
- HeaderEditor は Postman 風に「行を追加」して編集できる
  - 列は `enabled`（チェック） / `key` / `value` を基本とし、行の追加・削除ができる
  - ユーザ操作を減らすため、**常に末尾に空行を 1 行表示**する
    - 末尾の空行に入力が入ったら、自動で次の空行を追加する（常に空行が 1 行ある状態を維持）
    - 送信時は `key` が空の行（空行を含む）を除外する

### 4.2 拡張機能（将来）

| 機能                    | 説明                                                   |
| ----------------------- | ------------------------------------------------------ |
| コレクション管理        | リクエストをフォルダで整理                             |
| 環境変数                | `{{base_url}}` のような変数で URL やヘッダーを切り替え |
| タブ管理                | 複数リクエストを同時に開く                             |
| 認証ヘルパー            | Bearer Token / Basic Auth / OAuth 2.0                  |
| インポート/エクスポート | Postman コレクション形式の読み書き                     |
| WebSocket 対応          | WebSocket 接続のテスト                                 |

---

## 5. データ構造

### 5.1 リクエスト履歴（JSON ファイル保存）

```json
{
  "id": "uuid-v4",
  "timestamp": "2026-02-23T10:00:00Z",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/users",
    "headers": [
      { "key": "Content-Type", "value": "application/json", "enabled": true },
      { "key": "Authorization", "value": "Bearer xxx", "enabled": true }
    ],
    "body": {
      "type": "json",
      "content": "{ \"name\": \"田中\" }"
    }
  },
  "response": {
    "status": 200,
    "statusText": "OK",
    "headers": [{ "key": "Content-Type", "value": "application/json" }],
    "body": "{ \"id\": 1, \"name\": \"田中\" }",
    "elapsed_ms": 245,
    "size_bytes": 32
  }
}
```

### 5.2 コレクション（将来）

```json
{
  "id": "uuid-v4",
  "name": "ユーザー管理 API",
  "folders": [
    {
      "id": "uuid-v4",
      "name": "ユーザー CRUD",
      "requests": [
        {
          "id": "uuid-v4",
          "name": "ユーザー一覧取得",
          "request": { "..." }
        }
      ]
    }
  ]
}
```

### 5.3 環境変数（将来）

```json
{
  "id": "uuid-v4",
  "name": "本番環境",
  "variables": [
    { "key": "base_url", "value": "https://api.example.com", "enabled": true },
    { "key": "api_key", "value": "sk-xxx", "enabled": true }
  ]
}
```

### 5.4 Tauri Command DTO（Phase 1〜）

`send_request` Command で使用する入出力 DTO を定義する。
フロントエンドは DTO をそのまま Zustand 等で保持し、実行時に Tauri Command へ渡す。

#### HttpRequest

- `headers` は UI の Key-Value 編集を前提に「配列」で持つ（順序保持・enabled フラグを持てる）
  - UI は末尾に空行を 1 行持つが、送信時は `key` が空の行を除外して `headers` を組み立てる
- `body` は最初は Text/Json を中心に扱い、バイナリは必要になってから拡張する
- UI 仕様として、`body` は **POST / PUT / PATCH** のときにのみ入力させ、GET / DELETE は `None` を基本とする
- UI の既定は `RequestBody::Json` とし、必要に応じて `Text` に切り替え可能とする

```rust
// 例: src-tauri/src/types/http.rs
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyValue {
  pub key: String,
  pub value: String,
  pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HttpRequest {
  pub method: HttpMethod,
  pub url: String,
  pub headers: Vec<KeyValue>,
  pub body: Option<RequestBody>,
  pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum HttpMethod {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum RequestBody {
  Text { content: String },
  Json { content: String },
}
```

#### HttpResponse

- `status` は数値（例: 200）を必須で持つ
- `body` は最初は UTF-8 テキストとして返す（JSON はフロント側で整形表示）
- `elapsed_ms` / `size_bytes` は UI のステータスバー表示用

```rust
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ResponseKeyValue {
  pub key: String,
  pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct HttpResponse {
  pub status: u16,
  pub headers: Vec<ResponseKeyValue>,
  pub body: String,
  pub elapsed_ms: u64,
  pub size_bytes: u64,
}
```

#### `send_request` のエラーにする/しない

- 例: 401/404/500 は **成功（Ok）で返す**（API クライアントとして表示する）
- 例: URL 不正、DNS 失敗、接続不可、タイムアウト、TLS エラー等は **`Err(AppError)`**

---

## 6. 開発フェーズ

### Phase 1: プロジェクト構築 & 最初の一歩

- Tauri + React + TypeScript プロジェクトの作成
- Tailwind CSS / shadcn/ui のセットアップ
- 基本レイアウト（サイドバー + メインエリア）の作成
- GET リクエストを 1 本通す（React → Tauri Command → Rust reqwest）
- Rust 側のエラー設計とログ基盤を先に敷く（thiserror / anyhow / tracing）
- `AppResult<T>` / `AppError` / DTO を定義し、specta でフロント用型生成まで通す

**学べること:** Tauri の基本、React ↔ Rust の通信パターン

### Phase 2: リクエストビルダー

- メソッド選択（GET / POST / PUT / PATCH / DELETE）
- ヘッダーエディタ（Key-Value の動的追加・削除）
- ボディエディタ（CodeMirror 6 によるシンタックスハイライト）
- レスポンスビューア（ステータス、ヘッダー、ボディ、時間）
- 入力バリデーション（Zod）
- UI/ストアのテスト（Vitest + Testing Library）

**学べること:** React のフォーム設計、CodeMirror 統合

### Phase 3: データ永続化

- JSON ファイルでリクエスト履歴を保存
- 履歴一覧表示と再実行
- Rust 側のファイル I/O
- Rust 側のユニットテスト（永続化・HTTP を wiremock でモック）

**学べること:** Rust のファイル操作、serde によるシリアライズ

### Phase 4: コレクション & 状態管理

- コレクション（フォルダ管理）の実装
- タブによる複数リクエストの同時管理
- 環境変数の実装
- Zustand によるグローバル状態管理

**学べること:** Zustand での状態管理、ツリー構造の UI

### Phase 5: 応用機能

- 認証ヘルパー（Bearer / Basic / OAuth）
- Postman コレクションのインポート/エクスポート
- WebSocket 対応
- SQLite への移行（必要に応じて）

**学べること:** 認証プロトコル、データフォーマットの相互運用

---

## 7. 非機能要件

| 項目           | 方針                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| パフォーマンス | レスポンス表示は 10MB 以下の JSON を遅延なく整形表示できること                        |
| セキュリティ   | API キーやトークンはローカルファイルに保存。クラウド同期なし                          |
| 対応 OS        | 開発は Windows。Tauri のクロスプラットフォーム対応により macOS / Linux も将来対応可能 |
| データ保存場所 | Tauri の App Data ディレクトリ（OS 標準のアプリデータフォルダ）                       |
