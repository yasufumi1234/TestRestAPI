/**
 * CollectionTree.tsx - コレクションツリーコンポーネント
 *
 * サイドバーのコレクションセクションに表示するツリー UI。
 * コレクション > フォルダ > リクエストの階層構造を表示する。
 *
 * 主な機能:
 * - コレクションの追加・削除
 * - フォルダの追加・削除
 * - フォルダの展開/折りたたみ
 * - リクエストのクリックで内容を復元
 * - 現在のリクエストをコレクションに保存
 * - 履歴エントリーのドロップ保存先として機能する（Phase 5）
 */

import { useCallback, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  addFolderToTarget,
  removeFolder,
  removeSavedRequest,
  renameCollection,
  renameFolder,
  renameSavedRequest,
  type CollectionDropTarget,
} from '@/lib/collections';
import type {
  Collection,
  CollectionFolder,
  HttpMethod,
  SavedRequest,
} from '@/lib/tauri';

/** CollectionTree コンポーネントの Props */
interface CollectionTreeProps {
  /** コレクションの配列 */
  collections: Collection[];
  /** コレクションが変更されたときのコールバック（変更後の全体を渡す） */
  onChange: (collections: Collection[]) => void;
  /** リクエストがクリックされたときのコールバック（内容を復元する） */
  onRequestSelect: (request: SavedRequest) => void;
  /** 「現在のリクエストを保存」ボタン押下時のコールバック */
  onSaveCurrentRequest: (collectionId: string) => void;
}

/** HTTP メソッドに対応する表示色を返すヘルパー関数 */
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-600',
  POST: 'text-yellow-600',
  PUT: 'text-blue-600',
  PATCH: 'text-purple-600',
  DELETE: 'text-red-600',
};

interface FolderDraftState {
  /**
   * 今どの場所に新規フォルダを追加しようとしているか。
   * null のときは「フォルダ入力フォームを表示していない」状態。
   */
  parent: CollectionDropTarget | null;
  /** 入力中のフォルダ名 */
  name: string;
}

interface FolderEditState {
  /**
   * 今どのフォルダ名を編集中か。
   * null のときは「フォルダ名変更フォームを表示していない」状態。
   */
  target: CollectionDropTarget | null;
  /** 編集中のフォルダ名 */
  name: string;
}

interface RequestEditState {
  /**
   * 今どの保存済みリクエスト名を編集中か。
   * null のときは「リクエスト名変更フォームを表示していない」状態。
   */
  requestId: string | null;
  /** 編集中のリクエスト名 */
  name: string;
}

interface CollectionEditState {
  /**
   * 今どのコレクション名を編集中か。
   * null のときは「コレクション名変更フォームを表示していない」状態。
   */
  collectionId: string | null;
  /** 編集中のコレクション名 */
  name: string;
}

interface FolderDraftFormProps {
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
}

interface CollectionNodeProps {
  collection: Collection;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  onRequestSelect: (request: SavedRequest) => void;
  onSaveCurrentRequest: (collectionId: string) => void;
  onDeleteCollection: (id: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onDeleteFolder: (target: CollectionDropTarget) => void;
  onStartAddFolder: (target: CollectionDropTarget) => void;
  onStartRenameCollection: (collectionId: string, currentName: string) => void;
  onStartRenameFolder: (target: CollectionDropTarget, currentName: string) => void;
  onStartRenameRequest: (requestId: string, currentName: string) => void;
  collectionEdit: CollectionEditState;
  onCollectionEditNameChange: (name: string) => void;
  onCollectionEditSubmit: () => void;
  onCollectionEditCancel: () => void;
  folderDraft: FolderDraftState;
  onFolderDraftNameChange: (name: string) => void;
  onFolderDraftSubmit: () => void;
  onFolderDraftCancel: () => void;
  folderEdit: FolderEditState;
  onFolderEditNameChange: (name: string) => void;
  onFolderEditSubmit: () => void;
  onFolderEditCancel: () => void;
  requestEdit: RequestEditState;
  onRequestEditNameChange: (name: string) => void;
  onRequestEditSubmit: () => void;
  onRequestEditCancel: () => void;
}

interface FolderNodeProps {
  collectionId: string;
  folder: CollectionFolder;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  onRequestSelect: (request: SavedRequest) => void;
  onDeleteRequest: (requestId: string) => void;
  onDeleteFolder: (target: CollectionDropTarget) => void;
  onStartAddFolder: (target: CollectionDropTarget) => void;
  onStartRenameFolder: (target: CollectionDropTarget, currentName: string) => void;
  onStartRenameRequest: (requestId: string, currentName: string) => void;
  folderDraft: FolderDraftState;
  onFolderDraftNameChange: (name: string) => void;
  onFolderDraftSubmit: () => void;
  onFolderDraftCancel: () => void;
  folderEdit: FolderEditState;
  onFolderEditNameChange: (name: string) => void;
  onFolderEditSubmit: () => void;
  onFolderEditCancel: () => void;
  requestEdit: RequestEditState;
  onRequestEditNameChange: (name: string) => void;
  onRequestEditSubmit: () => void;
  onRequestEditCancel: () => void;
}

/**
 * フォルダの展開状態を管理するカスタムフック風のヘルパー
 * 各フォルダの ID をキーとして展開/折りたたみ状態を管理する
 */
function useExpandedState() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /**
   * 指定 ID の展開状態を反転する。
   * 同じ関数をコレクションにもフォルダにも使えるように、
   * どちらも string ID で扱っている。
   */
  const toggle = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * 指定 ID を必ず展開状態にする。
   *
   * ドラッグ中にフォルダへ hover したとき、
   * 自動で中身を開いてさらに深い階層へ落とせるようにするために使う。
   */
  const expand = useCallback((id: string) => {
    setExpanded((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const isExpanded = useCallback(
    (id: string) => expanded[id] ?? false,
    [expanded]
  );

  return { toggle, expand, isExpanded };
}

/**
 * CollectionDropTarget を比較しやすい 1 本の文字列へ変換する。
 *
 * 例:
 * - { type: 'collection', collectionId: 'a' } -> "collection:a"
 * - { type: 'folder', folderId: 'b' }         -> "folder:b"
 *
 * こうしておくと、
 * 「今表示すべき入力フォームはどこか」を簡単に判定できる。
 */
function getTargetKey(target: CollectionDropTarget | null): string | null {
  if (!target) {
    return null;
  }

  if (target.type === 'collection') {
    return `collection:${target.collectionId}`;
  }

  return `folder:${target.folderId}`;
}

export function CollectionTree({
  collections,
  onChange,
  onRequestSelect,
  onSaveCurrentRequest,
}: CollectionTreeProps) {
  // コレクション / フォルダの開閉状態を管理する
  const { toggle, expand, isExpanded } = useExpandedState();
  // 新規コレクション追加フォーム用の入力値
  const [newCollectionName, setNewCollectionName] = useState('');
  // 新規コレクション追加フォームの表示状態
  const [showAddForm, setShowAddForm] = useState(false);
  /**
   * フォルダ追加フォームの状態。
   *
   * CollectionTree 全体で 1 つだけ持つことで、
   * 「いま開いているフォルダ追加フォームは 1 箇所だけ」
   * というシンプルな UX にしている。
   */
  const [folderDraft, setFolderDraft] = useState<FolderDraftState>({
    parent: null,
    name: '',
  });
  /**
   * フォルダ名変更フォームの状態。
   *
   * こちらも追加フォームと同様に 1 箇所だけ開く前提にして、
   * target と入力文字列をまとめて持つ。
   */
  const [folderEdit, setFolderEdit] = useState<FolderEditState>({
    target: null,
    name: '',
  });
  /**
   * 保存済みリクエスト名変更フォームの状態。
   *
   * requestId だけを持てば対象を一意に特定できるので、
   * どの階層にあるリクエストかは helper 関数側で探索する。
   */
  const [requestEdit, setRequestEdit] = useState<RequestEditState>({
    requestId: null,
    name: '',
  });
  /**
   * コレクション名変更フォームの状態。
   *
   * 最上位ノードも他の編集と同じく 1 箇所だけ開くようにして、
   * 操作を分かりやすくしている。
   */
  const [collectionEdit, setCollectionEdit] = useState<CollectionEditState>({
    collectionId: null,
    name: '',
  });

  /** 新しいコレクションを配列の末尾に追加する */
  const handleAddCollection = useCallback(() => {
    const name = newCollectionName.trim();
    if (!name) {
      return;
    }

    const newCollection: Collection = {
      id: crypto.randomUUID(),
      name,
      requests: [],
      folders: [],
    };

    onChange([...collections, newCollection]);
    setNewCollectionName('');
    setShowAddForm(false);
  }, [newCollectionName, collections, onChange]);

  /** 指定したコレクションを削除する */
  const handleDeleteCollection = useCallback(
    (id: string) => {
      onChange(collections.filter((collection) => collection.id !== id));
      setCollectionEdit((prev) =>
        prev.collectionId === id ? { collectionId: null, name: '' } : prev
      );
    },
    [collections, onChange]
  );

  /**
   * 保存済みリクエストを削除する。
   *
   * removeSavedRequest() 側で
   * - コレクション直下
   * - すべてのフォルダ配下
   * の両方を再帰的に見てくれる。
   */
  const handleDeleteRequest = useCallback(
    (requestId: string) => {
      onChange(removeSavedRequest(collections, requestId));
      setRequestEdit((prev) =>
        prev.requestId === requestId ? { requestId: null, name: '' } : prev
      );
    },
    [collections, onChange]
  );

  /**
   * フォルダ削除ボタンが押されたときの処理。
   *
   * target は CollectionDropTarget 型だが、
   * 実際に削除できるのは folder タイプだけなので最初に絞り込む。
   */
  const handleDeleteFolder = useCallback(
    (target: CollectionDropTarget) => {
      if (target.type !== 'folder') {
        return;
      }

      onChange(removeFolder(collections, target.collectionId, target.folderId));
      setFolderDraft((prev) =>
        getTargetKey(prev.parent) === getTargetKey(target)
          ? { parent: null, name: '' }
          : prev
      );
      setFolderEdit((prev) =>
        getTargetKey(prev.target) === getTargetKey(target)
          ? { target: null, name: '' }
          : prev
      );
      setCollectionEdit({ collectionId: null, name: '' });
      setRequestEdit({ requestId: null, name: '' });
    },
    [collections, onChange]
  );

  /**
   * 「この場所にフォルダを追加したい」という状態へ切り替える。
   *
   * たとえばフォルダ配下にさらにサブフォルダを追加する場合、
   * まず親フォルダが閉じていると入力フォームが見えないため、
   * expand() で先に開いてから下書き state をセットしている。
   */
  const handleStartAddFolder = useCallback(
    (target: CollectionDropTarget) => {
      expand(target.type === 'collection' ? target.collectionId : target.folderId);
      setFolderDraft({ parent: target, name: '' });
      setCollectionEdit({ collectionId: null, name: '' });
      setFolderEdit({ target: null, name: '' });
      setRequestEdit({ requestId: null, name: '' });
    },
    [expand]
  );

  /**
   * 指定したコレクションを「名前変更中」に切り替える。
   *
   * 他の入力フォームと重ならないように、ここで他の編集中 state は閉じる。
   */
  const handleStartRenameCollection = useCallback(
    (collectionId: string, currentName: string) => {
      expand(collectionId);
      setCollectionEdit({ collectionId, name: currentName });
      setFolderDraft({ parent: null, name: '' });
      setFolderEdit({ target: null, name: '' });
      setRequestEdit({ requestId: null, name: '' });
    },
    [expand]
  );

  /**
   * 指定フォルダを「名前変更中」に切り替える。
   *
   * フォルダ名変更は既存フォルダに対してのみ行うので、
   * target.type は folder 前提で呼ばれる。
   */
  const handleStartRenameFolder = useCallback(
    (target: CollectionDropTarget, currentName: string) => {
      if (target.type !== 'folder') {
        return;
      }

      expand(target.folderId);
      setCollectionEdit({ collectionId: null, name: '' });
      setFolderEdit({ target, name: currentName });
      setFolderDraft({ parent: null, name: '' });
      setRequestEdit({ requestId: null, name: '' });
    },
    [expand]
  );

  /**
   * 指定した保存済みリクエストを「名前変更中」に切り替える。
   *
   * フォルダ編集フォームや追加フォームと重ならないように、
   * 他の編集 state はここで閉じている。
   */
  const handleStartRenameRequest = useCallback(
    (requestId: string, currentName: string) => {
      setRequestEdit({ requestId, name: currentName });
      setCollectionEdit({ collectionId: null, name: '' });
      setFolderDraft({ parent: null, name: '' });
      setFolderEdit({ target: null, name: '' });
    },
    []
  );

  /**
   * 入力中のフォルダ名を確定して実際に追加する。
   *
   * addFolderToTarget() は保存先が
   * - コレクション直下なのか
   * - 既存フォルダ配下なのか
   * を見て正しい位置へ挿入してくれる。
   */
  const handleFolderDraftSubmit = useCallback(() => {
    const name = folderDraft.name.trim();
    if (!folderDraft.parent || !name) {
      return;
    }

    onChange(addFolderToTarget(collections, folderDraft.parent, name));
    setFolderDraft({ parent: null, name: '' });
  }, [collections, folderDraft, onChange]);

  /**
   * 編集中のフォルダ名を確定する。
   *
   * renameFolder() 側で階層をたどって対象フォルダを見つけ、
   * name だけを書き換えた新しい collections 配列を返す。
   */
  const handleFolderEditSubmit = useCallback(() => {
    const name = folderEdit.name.trim();
    if (!folderEdit.target || folderEdit.target.type !== 'folder' || !name) {
      return;
    }

    onChange(
      renameFolder(
        collections,
        folderEdit.target.collectionId,
        folderEdit.target.folderId,
        name
      )
    );
    setFolderEdit({ target: null, name: '' });
  }, [collections, folderEdit, onChange]);

  /**
   * 編集中のコレクション名を確定する。
   */
  const handleCollectionEditSubmit = useCallback(() => {
    const name = collectionEdit.name.trim();
    if (!collectionEdit.collectionId || !name) {
      return;
    }

    onChange(renameCollection(collections, collectionEdit.collectionId, name));
    setCollectionEdit({ collectionId: null, name: '' });
  }, [collectionEdit, collections, onChange]);

  /**
   * 編集中の保存済みリクエスト名を確定する。
   *
   * renameSavedRequest() はトップレベル / フォルダ内の両方を見て
   * 該当 requestId の name だけを書き換える。
   */
  const handleRequestEditSubmit = useCallback(() => {
    const name = requestEdit.name.trim();
    if (!requestEdit.requestId || !name) {
      return;
    }

    onChange(renameSavedRequest(collections, requestEdit.requestId, name));
    setRequestEdit({ requestId: null, name: '' });
  }, [collections, onChange, requestEdit]);

  const folderDraftKey = getTargetKey(folderDraft.parent);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          コレクション
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground"
          title="コレクションを追加"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {showAddForm && (
        <div className="flex gap-1 mb-2">
          <Input
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="コレクション名"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddCollection();
              }
              if (e.key === 'Escape') {
                setShowAddForm(false);
              }
            }}
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleAddCollection}
            className="shrink-0"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}

      {collections.length === 0 && !showAddForm ? (
        <p className="text-xs text-muted-foreground">
          コレクションがありません
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1">
          {collections.map((collection) => (
            <CollectionNode
              key={collection.id}
              collection={collection}
              isExpanded={isExpanded}
              toggle={toggle}
              expand={expand}
              onRequestSelect={onRequestSelect}
              onSaveCurrentRequest={onSaveCurrentRequest}
              onDeleteCollection={handleDeleteCollection}
              onDeleteRequest={handleDeleteRequest}
              onDeleteFolder={handleDeleteFolder}
              onStartAddFolder={handleStartAddFolder}
              onStartRenameCollection={handleStartRenameCollection}
              onStartRenameFolder={handleStartRenameFolder}
              onStartRenameRequest={handleStartRenameRequest}
              collectionEdit={collectionEdit}
              onCollectionEditNameChange={(name) =>
                setCollectionEdit((prev) => ({ ...prev, name }))
              }
              onCollectionEditSubmit={handleCollectionEditSubmit}
              onCollectionEditCancel={() =>
                setCollectionEdit({ collectionId: null, name: '' })
              }
              folderDraft={folderDraft}
              onFolderDraftNameChange={(name) =>
                setFolderDraft((prev) => ({ ...prev, name }))
              }
              onFolderDraftSubmit={handleFolderDraftSubmit}
              onFolderDraftCancel={() =>
                setFolderDraft({ parent: null, name: '' })
              }
              folderEdit={folderEdit}
              onFolderEditNameChange={(name) =>
                setFolderEdit((prev) => ({ ...prev, name }))
              }
              onFolderEditSubmit={handleFolderEditSubmit}
              onFolderEditCancel={() =>
                setFolderEdit({ target: null, name: '' })
              }
              requestEdit={requestEdit}
              onRequestEditNameChange={(name) =>
                setRequestEdit((prev) => ({ ...prev, name }))
              }
              onRequestEditSubmit={handleRequestEditSubmit}
              onRequestEditCancel={() =>
                setRequestEdit({ requestId: null, name: '' })
              }
            />
          ))}
          {folderDraft.parent && !folderDraftKey ? (
            <p className="text-[10px] text-destructive px-2 py-1">
              フォルダ追加先が見つかりません
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CollectionNode({
  collection,
  isExpanded,
  toggle,
  expand,
  onRequestSelect,
  onSaveCurrentRequest,
  onDeleteCollection,
  onDeleteRequest,
  onDeleteFolder,
  onStartAddFolder,
  onStartRenameCollection,
  onStartRenameFolder,
  onStartRenameRequest,
  collectionEdit,
  onCollectionEditNameChange,
  onCollectionEditSubmit,
  onCollectionEditCancel,
  folderDraft,
  onFolderDraftNameChange,
  onFolderDraftSubmit,
  onFolderDraftCancel,
  folderEdit,
  onFolderEditNameChange,
  onFolderEditSubmit,
  onFolderEditCancel,
  requestEdit,
  onRequestEditNameChange,
  onRequestEditSubmit,
  onRequestEditCancel,
}: CollectionNodeProps) {
  /**
   * このコレクション行自身を「ドロップ先」として扱うための情報。
   *
   * HistoryList から履歴エントリーがここへ落とされると、
   * collection 直下へ SavedRequest を追加する。
   */
  const target: CollectionDropTarget = {
    type: 'collection',
    collectionId: collection.id,
  };

  /**
   * useDroppable() で「この DOM はドロップ先です」と dnd-kit に登録する。
   *
   * data に target を入れておくことで、
   * drop 完了時に Sidebar.tsx 側が
   * 「どこへドロップされたか」を取り出せる。
   */
  const { isOver, setNodeRef } = useDroppable({
    id: `collection-drop-${collection.id}`,
    data: {
      type: 'collection-drop-target',
      target,
    },
  });
  const expanded = isExpanded(collection.id);
  const showFolderDraft = getTargetKey(folderDraft.parent) === getTargetKey(target);
  const showCollectionEdit = collectionEdit.collectionId === collection.id;

  /**
   * ドラッグ中にこのコレクションへ乗ったら自動展開する。
   *
   * これにより、ユーザーは
   * 「いったん開いてから中のフォルダへ移動する」
   * という余計な操作をしなくて済む。
   */
  useEffect(() => {
    if (isOver) {
      expand(collection.id);
    }
  }, [collection.id, expand, isOver]);

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1 px-1 py-1 rounded-md cursor-pointer transition-colors ${
          isOver ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent/50'
        }`}
        onClick={() => {
          if (showCollectionEdit) {
            return;
          }
          toggle(collection.id);
        }}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        {expanded ? (
          <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        {showCollectionEdit ? (
          <div
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <FolderDraftForm
              name={collectionEdit.name}
              onNameChange={onCollectionEditNameChange}
              onSubmit={onCollectionEditSubmit}
              onCancel={onCollectionEditCancel}
              placeholder="コレクション名を変更"
            />
          </div>
        ) : (
          <span className="text-xs font-medium truncate flex-1">
            {collection.name}
          </span>
        )}
        <div className="flex shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onStartAddFolder(target);
            }}
            className="text-muted-foreground hover:text-foreground"
            title="フォルダを追加"
          >
            <FolderPlus className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onStartRenameCollection(collection.id, collection.name);
            }}
            className="text-muted-foreground hover:text-foreground"
            title="コレクション名を変更"
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onSaveCurrentRequest(collection.id);
            }}
            className="text-muted-foreground hover:text-foreground"
            title="現在のリクエストをこのコレクションに保存"
          >
            <FileDown className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCollection(collection.id);
            }}
            className="text-muted-foreground hover:text-destructive"
            title="コレクションを削除"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="ml-4">
          {showFolderDraft && !showCollectionEdit && (
            <FolderDraftForm
              name={folderDraft.name}
              onNameChange={onFolderDraftNameChange}
              onSubmit={onFolderDraftSubmit}
              onCancel={onFolderDraftCancel}
              placeholder="フォルダ名"
            />
          )}
          {collection.folders.map((folder) => (
            <FolderNode
              key={folder.id}
              collectionId={collection.id}
              folder={folder}
              isExpanded={isExpanded}
              toggle={toggle}
              expand={expand}
              onRequestSelect={onRequestSelect}
              onDeleteRequest={onDeleteRequest}
              onDeleteFolder={onDeleteFolder}
              onStartAddFolder={onStartAddFolder}
              onStartRenameFolder={onStartRenameFolder}
              onStartRenameRequest={onStartRenameRequest}
              folderDraft={folderDraft}
              onFolderDraftNameChange={onFolderDraftNameChange}
              onFolderDraftSubmit={onFolderDraftSubmit}
              onFolderDraftCancel={onFolderDraftCancel}
              folderEdit={folderEdit}
              onFolderEditNameChange={onFolderEditNameChange}
              onFolderEditSubmit={onFolderEditSubmit}
              onFolderEditCancel={onFolderEditCancel}
              requestEdit={requestEdit}
              onRequestEditNameChange={onRequestEditNameChange}
              onRequestEditSubmit={onRequestEditSubmit}
              onRequestEditCancel={onRequestEditCancel}
            />
          ))}
          {collection.requests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              onSelect={() => onRequestSelect(request)}
              onStartRename={() => onStartRenameRequest(request.id, request.name)}
              onDelete={() => onDeleteRequest(request.id)}
              isEditing={requestEdit.requestId === request.id}
              editName={requestEdit.name}
              onEditNameChange={onRequestEditNameChange}
              onEditSubmit={onRequestEditSubmit}
              onEditCancel={onRequestEditCancel}
            />
          ))}
          {collection.requests.length === 0 &&
            collection.folders.length === 0 &&
            !showFolderDraft && (
              <p className="text-[10px] text-muted-foreground px-2 py-1">
                リクエストがありません
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function FolderNode({
  collectionId,
  folder,
  isExpanded,
  toggle,
  expand,
  onRequestSelect,
  onDeleteRequest,
  onDeleteFolder,
  onStartAddFolder,
  onStartRenameFolder,
  onStartRenameRequest,
  folderDraft,
  onFolderDraftNameChange,
  onFolderDraftSubmit,
  onFolderDraftCancel,
  folderEdit,
  onFolderEditNameChange,
  onFolderEditSubmit,
  onFolderEditCancel,
  requestEdit,
  onRequestEditNameChange,
  onRequestEditSubmit,
  onRequestEditCancel,
}: FolderNodeProps) {
  /**
   * このフォルダ行をドロップ先として登録するための target 情報。
   *
   * folderId だけでなく collectionId も持っているのは、
   * 実際に collections 配列を更新するときに
   * 「どのコレクションの中のどのフォルダか」を判断する必要があるため。
   */
  const target: CollectionDropTarget = {
    type: 'folder',
    collectionId,
    folderId: folder.id,
  };
  const { isOver, setNodeRef } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: {
      type: 'collection-drop-target',
      target,
    },
  });
  const expanded = isExpanded(folder.id);
  const showFolderDraft = getTargetKey(folderDraft.parent) === getTargetKey(target);
  const showFolderEdit = getTargetKey(folderEdit.target) === getTargetKey(target);

  // フォルダへ hover した瞬間に自動展開し、さらに深い階層へドロップしやすくする
  useEffect(() => {
    if (isOver) {
      expand(folder.id);
    }
  }, [expand, folder.id, isOver]);

  return (
    <div>
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-1 px-1 py-0.5 rounded-md cursor-pointer transition-colors ${
          isOver ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-accent/50'
        }`}
        onClick={() => {
          if (showFolderEdit) {
            return;
          }
          toggle(folder.id);
        }}
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        {expanded ? (
          <FolderOpen className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="size-3 shrink-0 text-muted-foreground" />
        )}
        {showFolderEdit ? (
          <div
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <FolderDraftForm
              name={folderEdit.name}
              onNameChange={onFolderEditNameChange}
              onSubmit={onFolderEditSubmit}
              onCancel={onFolderEditCancel}
              placeholder="フォルダ名を変更"
            />
          </div>
        ) : (
          <span className="text-[11px] truncate flex-1">{folder.name}</span>
        )}
        <div className="flex shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onStartAddFolder(target);
            }}
            className="text-muted-foreground hover:text-foreground"
            title="サブフォルダを追加"
          >
            <FolderPlus className="size-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onStartRenameFolder(target, folder.name);
            }}
            className="text-muted-foreground hover:text-foreground"
            title="フォルダ名を変更"
          >
            <Pencil className="size-2.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(target);
            }}
            className="text-muted-foreground hover:text-destructive"
            title="フォルダを削除"
          >
            <Trash2 className="size-2.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="ml-4">
          {showFolderDraft && !showFolderEdit && (
            <FolderDraftForm
              name={folderDraft.name}
              onNameChange={onFolderDraftNameChange}
              onSubmit={onFolderDraftSubmit}
              onCancel={onFolderDraftCancel}
              placeholder="フォルダ名"
            />
          )}
          {folder.folders.map((subFolder) => (
            <FolderNode
              key={subFolder.id}
              collectionId={collectionId}
              folder={subFolder}
              isExpanded={isExpanded}
              toggle={toggle}
              expand={expand}
              onRequestSelect={onRequestSelect}
              onDeleteRequest={onDeleteRequest}
              onDeleteFolder={onDeleteFolder}
              onStartAddFolder={onStartAddFolder}
              onStartRenameFolder={onStartRenameFolder}
              onStartRenameRequest={onStartRenameRequest}
              folderDraft={folderDraft}
              onFolderDraftNameChange={onFolderDraftNameChange}
              onFolderDraftSubmit={onFolderDraftSubmit}
              onFolderDraftCancel={onFolderDraftCancel}
              folderEdit={folderEdit}
              onFolderEditNameChange={onFolderEditNameChange}
              onFolderEditSubmit={onFolderEditSubmit}
              onFolderEditCancel={onFolderEditCancel}
              requestEdit={requestEdit}
              onRequestEditNameChange={onRequestEditNameChange}
              onRequestEditSubmit={onRequestEditSubmit}
              onRequestEditCancel={onRequestEditCancel}
            />
          ))}
          {folder.requests.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              onSelect={() => onRequestSelect(request)}
              onStartRename={() => onStartRenameRequest(request.id, request.name)}
              onDelete={() => onDeleteRequest(request.id)}
              isEditing={requestEdit.requestId === request.id}
              editName={requestEdit.name}
              onEditNameChange={onRequestEditNameChange}
              onEditSubmit={onRequestEditSubmit}
              onEditCancel={onRequestEditCancel}
            />
          ))}
          {folder.requests.length === 0 &&
            folder.folders.length === 0 &&
            !showFolderDraft && (
              <p className="text-[10px] text-muted-foreground px-2 py-1">
                フォルダは空です
              </p>
            )}
        </div>
      )}
    </div>
  );
}

function FolderDraftForm({
  name,
  onNameChange,
  onSubmit,
  onCancel,
  placeholder,
}: FolderDraftFormProps) {
  return (
    <div className="flex gap-1 px-1 py-1">
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
        onKeyDown={(e) => {
          // Enter で確定、Escape でキャンセルできるようにしている
          if (e.key === 'Enter') {
            onSubmit();
          }
          if (e.key === 'Escape') {
            onCancel();
          }
        }}
        autoFocus
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onSubmit}
        className="shrink-0"
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}

/** リクエスト行コンポーネント */
function RequestItem({
  request,
  onSelect,
  onStartRename,
  onDelete,
  isEditing,
  editName,
  onEditNameChange,
  onEditSubmit,
  onEditCancel,
}: {
  request: SavedRequest;
  onSelect: () => void;
  onStartRename: () => void;
  onDelete?: () => void;
  isEditing: boolean;
  editName: string;
  onEditNameChange: (name: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => {
        if (isEditing) {
          return;
        }
        onSelect();
      }}
      title={`${request.method} ${request.url}`}
    >
      {/* 一覧の中でもメソッドが目に入りやすいよう、短い色付きラベルで表示する */}
      <span
        className={`text-[9px] font-bold shrink-0 ${
          METHOD_COLORS[request.method] || 'text-foreground'
        }`}
      >
        {request.method}
      </span>
      {isEditing ? (
        <div
          className="flex-1"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <FolderDraftForm
            name={editName}
            onNameChange={onEditNameChange}
            onSubmit={onEditSubmit}
            onCancel={onEditCancel}
            placeholder="リクエスト名を変更"
          />
        </div>
      ) : (
        <span className="text-[11px] truncate flex-1">{request.name}</span>
      )}
      <div className="flex shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
          className="text-muted-foreground hover:text-foreground"
          title="リクエスト名を変更"
        >
          <Pencil className="size-2.5" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted-foreground hover:text-destructive"
            title="保存済みリクエストを削除"
          >
            <Trash2 className="size-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
