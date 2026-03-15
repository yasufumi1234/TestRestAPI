/**
 * collections.ts
 *
 * コレクション機能で使う「純粋関数」の集まり。
 *
 * ここでは React コンポーネントの見た目は一切扱わず、
 * 「どのコレクションに保存するか」「どのフォルダに追加するか」
 * 「ネストしたフォルダをどうたどるか」だけを担当する。
 *
 * ポイント:
 * - 引数で受け取った配列を直接書き換えず、新しい配列を返す
 * - ネストしたフォルダは再帰関数で探索する
 * - UI 側はこの関数を呼ぶだけで済むようにする
 */
import type {
  Collection,
  CollectionFolder,
  HistoryEntry,
  SavedRequest,
} from '@/lib/tauri';

/**
 * D&D で「どこにドロップされたか」を表す型。
 *
 * - collection: コレクション直下に保存する
 * - folder: 特定のフォルダの中に保存する
 *
 * これを 1 つの型にまとめておくと、保存処理側は
 * 「まず type を見て、保存先を分岐する」だけでよくなる。
 */
export type CollectionDropTarget =
  | { type: 'collection'; collectionId: string }
  | { type: 'folder'; collectionId: string; folderId: string };

/**
 * URL から保存用の名前を作るヘルパー。
 *
 * 例:
 * - https://api.example.com/users -> users
 * - https://api.example.com/      -> api.example.com
 *
 * URL の解析に失敗したときは、入力文字列をそのまま使う。
 * これにより「保存名が空になる」ケースをできるだけ減らしている。
 */
export function buildSavedRequestName(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return 'New Request';
  }

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (lastSegment) {
      return decodeURIComponent(lastSegment);
    }

    return parsed.hostname;
  } catch {
    return trimmed;
  }
}

/**
 * 履歴エントリーを、コレクションに保存できる SavedRequest に変換する。
 *
 * 履歴には status や elapsed_ms など「送信結果」も含まれるが、
 * コレクションに保存したいのは「再利用するためのリクエスト定義」だけなので、
 * その必要な部分だけを抜き出して新しいオブジェクトを作る。
 */
export function historyEntryToSavedRequest(entry: HistoryEntry): SavedRequest {
  return {
    id: crypto.randomUUID(),
    name: buildSavedRequestName(entry.url),
    method: entry.method,
    url: entry.url,
    headers: entry.headers,
    body: entry.body,
  };
}

/**
 * 現在編集中のリクエストを SavedRequest に変換する。
 *
 * App.tsx 側の activeTab は UI 用の状態も多く持っているため、
 * 保存用に必要な情報だけへ整形する役割をここで持たせている。
 */
export function currentRequestToSavedRequest(request: {
  method: SavedRequest['method'];
  url: string;
  headers: SavedRequest['headers'];
  body: SavedRequest['body'];
}): SavedRequest {
  return {
    id: crypto.randomUUID(),
    name: buildSavedRequestName(request.url),
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body,
  };
}

/**
 * 新しい空フォルダを生成する。
 *
 * フォルダは中にさらにフォルダやリクエストを持てるので、
 * 作成時点では requests / folders を空配列で初期化する。
 */
export function createCollectionFolder(name: string): CollectionFolder {
  return {
    id: crypto.randomUUID(),
    name,
    requests: [],
    folders: [],
  };
}

/**
 * 指定した保存先に SavedRequest を追加する。
 *
 * 処理の流れ:
 * 1. まず collectionId が一致するコレクションを探す
 * 2. 保存先 type が collection なら、その直下に追加する
 * 3. 保存先 type が folder なら、再帰関数で対象フォルダを探して追加する
 *
 * 戻り値は「更新後の新しい collections 配列」。
 */
export function addSavedRequestToTarget(
  collections: Collection[],
  target: CollectionDropTarget,
  request: SavedRequest
): Collection[] {
  return collections.map((collection) => {
    if (collection.id !== target.collectionId) {
      return collection;
    }

    if (target.type === 'collection') {
      return {
        ...collection,
        // 既存配列を直接 push せず、新しい配列を作って返す
        requests: [...collection.requests, request],
      };
    }

    const [folders, found] = addSavedRequestToFolders(
      collection.folders,
      target.folderId,
      request
    );

    return found ? { ...collection, folders } : collection;
  });
}

/**
 * 指定した保存先に新しいフォルダを追加する。
 *
 * コレクション直下にも、既存フォルダ配下にも追加できるように
 * addSavedRequestToTarget と同じ考え方で分岐している。
 */
export function addFolderToTarget(
  collections: Collection[],
  target: CollectionDropTarget,
  name: string
): Collection[] {
  const newFolder = createCollectionFolder(name);

  return collections.map((collection) => {
    if (collection.id !== target.collectionId) {
      return collection;
    }

    if (target.type === 'collection') {
      return {
        ...collection,
        folders: [...collection.folders, newFolder],
      };
    }

    const [folders, found] = addFolderToFolders(
      collection.folders,
      target.folderId,
      newFolder
    );

    return found ? { ...collection, folders } : collection;
  });
}

/**
 * 指定したコレクション名を変更する。
 *
 * コレクションは最上位の配列要素なので、
 * collection.id が一致する要素の name を差し替えるだけで更新できる。
 */
export function renameCollection(
  collections: Collection[],
  collectionId: string,
  name: string
): Collection[] {
  return collections.map((collection) =>
    collection.id === collectionId ? { ...collection, name } : collection
  );
}

/**
 * 指定 ID の保存済みリクエストを全コレクションから削除する。
 *
 * リクエストはトップレベルにもフォルダ内にも存在しうるため、
 * コレクション直下を削除したあと、再帰関数で各フォルダの中もたどる。
 */
export function removeSavedRequest(
  collections: Collection[],
  requestId: string
): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    requests: collection.requests.filter((request) => request.id !== requestId),
    folders: removeSavedRequestFromFolders(collection.folders, requestId),
  }));
}

/**
 * 指定したフォルダを削除する。
 *
 * folderId が見つかったフォルダ自身を配列から取り除く。
 * サブフォルダもまとめて消えるので、ツリー構造として自然な削除になる。
 */
export function removeFolder(
  collections: Collection[],
  collectionId: string,
  folderId: string
): Collection[] {
  return collections.map((collection) => {
    if (collection.id !== collectionId) {
      return collection;
    }

    return {
      ...collection,
      folders: removeFolderFromFolders(collection.folders, folderId),
    };
  });
}

/**
 * 指定したフォルダ名を変更する。
 *
 * 対象フォルダが深い階層にあっても、再帰関数でたどって
 * 該当フォルダの name だけを書き換えた新しい配列を返す。
 */
export function renameFolder(
  collections: Collection[],
  collectionId: string,
  folderId: string,
  name: string
): Collection[] {
  return collections.map((collection) => {
    if (collection.id !== collectionId) {
      return collection;
    }

    return {
      ...collection,
      folders: renameFolderInFolders(collection.folders, folderId, name),
    };
  });
}

/**
 * 指定した保存済みリクエスト名を変更する。
 *
 * 保存済みリクエストは
 * - コレクション直下
 * - 任意のフォルダ配下
 * のどちらにも存在しうるため、トップレベルと再帰処理の両方で探索する。
 */
export function renameSavedRequest(
  collections: Collection[],
  requestId: string,
  name: string
): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    requests: collection.requests.map((request) =>
      request.id === requestId ? { ...request, name } : request
    ),
    folders: renameSavedRequestInFolders(collection.folders, requestId, name),
  }));
}

/**
 * フォルダ配列の中から目当ての folderId を探し、
 * 見つかった場所にリクエストを追加する再帰関数。
 *
 * 戻り値:
 * - 更新後の folders 配列
 * - 対象が見つかったかどうかの真偽値
 *
 * 真偽値も返している理由は、
 * 「見つかっていないのに毎回新しい配列を返してしまう」ことを避けるため。
 */
function addSavedRequestToFolders(
  folders: CollectionFolder[],
  folderId: string,
  request: SavedRequest
): [CollectionFolder[], boolean] {
  let found = false;

  const updatedFolders = folders.map((folder) => {
    if (folder.id === folderId) {
      found = true;
      return {
        ...folder,
        requests: [...folder.requests, request],
      };
    }

    const [nestedFolders, nestedFound] = addSavedRequestToFolders(
      folder.folders,
      folderId,
      request
    );

    if (!nestedFound) {
      return folder;
    }

    found = true;
    return {
      ...folder,
      folders: nestedFolders,
    };
  });

  return [found ? updatedFolders : folders, found];
}

/**
 * 指定フォルダ配下に新しいフォルダを追加する再帰関数。
 *
 * 処理の考え方は addSavedRequestToFolders と同じで、
 * 対象フォルダが深い階層にあっても順にたどって更新できる。
 */
function addFolderToFolders(
  folders: CollectionFolder[],
  folderId: string,
  newFolder: CollectionFolder
): [CollectionFolder[], boolean] {
  let found = false;

  const updatedFolders = folders.map((folder) => {
    if (folder.id === folderId) {
      found = true;
      return {
        ...folder,
        folders: [...folder.folders, newFolder],
      };
    }

    const [nestedFolders, nestedFound] = addFolderToFolders(
      folder.folders,
      folderId,
      newFolder
    );

    if (!nestedFound) {
      return folder;
    }

    found = true;
    return {
      ...folder,
      folders: nestedFolders,
    };
  });

  return [found ? updatedFolders : folders, found];
}

/**
 * すべてのフォルダをたどり、指定 requestId を再帰的に削除する。
 *
 * map で各フォルダを作り直しつつ、その中にある requests と folders を
 * それぞれ更新していく。
 */
function removeSavedRequestFromFolders(
  folders: CollectionFolder[],
  requestId: string
): CollectionFolder[] {
  return folders.map((folder) => ({
    ...folder,
    requests: folder.requests.filter((request) => request.id !== requestId),
    folders: removeSavedRequestFromFolders(folder.folders, requestId),
  }));
}

/**
 * すべてのフォルダをたどり、指定 folderId を再帰的に削除する。
 *
 * filter で「消したいフォルダ自身」を落とし、
 * map で残ったフォルダの子階層をさらに再帰処理する。
 */
function removeFolderFromFolders(
  folders: CollectionFolder[],
  folderId: string
): CollectionFolder[] {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      folders: removeFolderFromFolders(folder.folders, folderId),
    }));
}

/**
 * すべてのフォルダをたどり、指定 folderId の name を再帰的に変更する。
 *
 * 「対象フォルダだけ名前を変え、それ以外の構造は保つ」という処理を
 * イミュータブルに行うため、map で新しい配列を作りながら更新している。
 */
function renameFolderInFolders(
  folders: CollectionFolder[],
  folderId: string,
  name: string
): CollectionFolder[] {
  return folders.map((folder) => {
    if (folder.id === folderId) {
      return {
        ...folder,
        name,
      };
    }

    return {
      ...folder,
      folders: renameFolderInFolders(folder.folders, folderId, name),
    };
  });
}

/**
 * すべてのフォルダをたどり、指定 requestId の保存済みリクエスト名を変更する。
 *
 * フォルダの中には request 配列と subfolder 配列の両方があるので、
 * それぞれを更新しながら下の階層へ降りていく。
 */
function renameSavedRequestInFolders(
  folders: CollectionFolder[],
  requestId: string,
  name: string
): CollectionFolder[] {
  return folders.map((folder) => ({
    ...folder,
    requests: folder.requests.map((request) =>
      request.id === requestId ? { ...request, name } : request
    ),
    folders: renameSavedRequestInFolders(folder.folders, requestId, name),
  }));
}
