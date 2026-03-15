/**
 * EnvironmentSelector.tsx - 環境変数セレクターコンポーネント
 *
 * URL バーの横に表示する環境切替ドロップダウン。
 * 定義済みの環境（開発・本番等）を選択し、URL やヘッダー値の {{変数}} を自動置換する。
 *
 * 主な機能:
 * - 環境の選択/切替
 * - 「環境なし」の選択（プレースホルダー未置換で送信）
 * - 環境の新規追加
 * - 環境の削除
 * - 環境変数（Key-Value）の編集
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Settings, X } from 'lucide-react';
import type { Environment } from '@/stores/requestStore';
import type { KeyValue } from '@/lib/tauri';
import { Checkbox } from '@/components/ui/checkbox';

/** EnvironmentSelector コンポーネントの Props */
interface EnvironmentSelectorProps {
  /** 定義済み環境の配列 */
  environments: Environment[];
  /** 現在選択中の環境 ID（null = 環境なし） */
  activeEnvironmentId: string | null;
  /** 環境が選択されたときのコールバック */
  onSelect: (id: string | null) => void;
  /** 新しい環境を追加するときのコールバック */
  onAdd: (name: string) => void;
  /** 環境を削除するときのコールバック */
  onRemove: (id: string) => void;
  /** 環境の変数を更新するときのコールバック */
  onUpdate: (id: string, updates: Partial<Environment>) => void;
}

export function EnvironmentSelector({
  environments,
  activeEnvironmentId,
  onSelect,
  onAdd,
  onRemove,
  onUpdate,
}: EnvironmentSelectorProps) {
  // 設定パネルの表示/非表示
  const [showSettings, setShowSettings] = useState(false);
  // 新規環境名の入力状態
  const [newEnvName, setNewEnvName] = useState('');

  /**
   * 新しい環境を追加するハンドラー
   */
  const handleAdd = useCallback(() => {
    const name = newEnvName.trim();
    if (!name) return;
    onAdd(name);
    setNewEnvName('');
  }, [newEnvName, onAdd]);

  /**
   * 環境変数の行を更新するハンドラー
   */
  const handleUpdateVariable = useCallback(
    (envId: string, index: number, field: keyof KeyValue, value: string | boolean) => {
      const env = environments.find((e) => e.id === envId);
      if (!env) return;

      const updatedVars = env.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      );
      onUpdate(envId, { variables: updatedVars });
    },
    [environments, onUpdate]
  );

  /**
   * 環境変数に新しい行を追加するハンドラー
   */
  const handleAddVariable = useCallback(
    (envId: string) => {
      const env = environments.find((e) => e.id === envId);
      if (!env) return;

      onUpdate(envId, {
        variables: [...env.variables, { key: '', value: '', enabled: true }],
      });
    },
    [environments, onUpdate]
  );

  /**
   * 環境変数の行を削除するハンドラー
   */
  const handleRemoveVariable = useCallback(
    (envId: string, index: number) => {
      const env = environments.find((e) => e.id === envId);
      if (!env) return;

      const filtered = env.variables.filter((_, i) => i !== index);
      onUpdate(envId, {
        variables: filtered.length > 0 ? filtered : [{ key: '', value: '', enabled: true }],
      });
    },
    [environments, onUpdate]
  );

  return (
    <div className="flex items-center gap-1">
      {/* ─── 環境選択ドロップダウン ─── */}
      <Select
        value={activeEnvironmentId ?? '__none__'}
        onValueChange={(v) => onSelect(v === '__none__' ? null : v)}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="環境なし" />
        </SelectTrigger>
        <SelectContent>
          {/* 環境なし（プレースホルダー未置換） */}
          <SelectItem value="__none__" className="text-xs">
            環境なし
          </SelectItem>
          {/* 定義済み環境の一覧 */}
          {environments.map((env) => (
            <SelectItem key={env.id} value={env.id} className="text-xs">
              {env.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ─── 設定ボタン ─── */}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setShowSettings(!showSettings)}
        className="text-muted-foreground hover:text-foreground"
        title="環境変数を管理"
      >
        <Settings className="size-3.5" />
      </Button>

      {/* ─── 設定パネル（オーバーレイ） ─── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg w-[600px] max-h-[80vh] flex flex-col">
            {/* パネルヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-semibold">環境変数の管理</h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowSettings(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* パネル本体 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 新規環境追加フォーム */}
              <div className="flex gap-2">
                <Input
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="新しい環境名（例: Development）"
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAdd}
                  className="shrink-0 gap-1"
                >
                  <Plus className="size-3.5" />
                  追加
                </Button>
              </div>

              {/* 環境一覧 */}
              {environments.map((env) => (
                <div key={env.id} className="border rounded-md p-3 space-y-2">
                  {/* 環境名と削除ボタン */}
                  <div className="flex items-center justify-between">
                    <Input
                      value={env.name}
                      onChange={(e) =>
                        onUpdate(env.id, { name: e.target.value })
                      }
                      className="h-7 text-xs font-medium w-48"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onRemove(env.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>

                  {/* 変数一覧のヘッダー */}
                  <div className="grid grid-cols-[24px_1fr_1fr_24px] gap-1.5 text-[10px] text-muted-foreground font-medium px-0.5">
                    <div />
                    <span>変数名</span>
                    <span>値</span>
                    <div />
                  </div>

                  {/* 変数一覧 */}
                  {env.variables.map((variable, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[24px_1fr_1fr_24px] gap-1.5 items-center"
                    >
                      {/* 有効/無効チェックボックス */}
                      <Checkbox
                        checked={variable.enabled}
                        onCheckedChange={(checked) =>
                          handleUpdateVariable(env.id, index, 'enabled', checked === true)
                        }
                      />
                      {/* 変数名 */}
                      <Input
                        value={variable.key}
                        onChange={(e) =>
                          handleUpdateVariable(env.id, index, 'key', e.target.value)
                        }
                        placeholder="baseUrl"
                        className="h-7 text-xs font-mono"
                      />
                      {/* 値 */}
                      <Input
                        value={variable.value}
                        onChange={(e) =>
                          handleUpdateVariable(env.id, index, 'value', e.target.value)
                        }
                        placeholder="https://api.example.com"
                        className="h-7 text-xs font-mono"
                      />
                      {/* 削除ボタン */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveVariable(env.id, index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {/* 変数追加ボタン */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddVariable(env.id)}
                    className="text-xs text-muted-foreground gap-1"
                  >
                    <Plus className="size-3" />
                    変数を追加
                  </Button>
                </div>
              ))}

              {/* 環境が空の場合のメッセージ */}
              {environments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  環境がまだ定義されていません。上のフォームから追加してください。
                  <br />
                  <span className="text-[10px]">
                    URL やヘッダー値に {'{{変数名}}'} と書くと自動置換されます。
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
