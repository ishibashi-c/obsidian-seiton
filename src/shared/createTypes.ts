import type { FeatureModules, ItemType } from "./types";

export interface CreateTypeSettings {
  enabledTypes: readonly ItemType[];
  modules: Pick<FeatureModules, "memos">;
  pinnedTypes: readonly ItemType[];
  recentTypes: readonly ItemType[];
  typeOrder: readonly ItemType[];
}

export interface CreateTypeSections {
  all: ItemType[];
  pinned: ItemType[];
  recent: ItemType[];
}

/** 新規作成画面から保存処理へ渡す入力。サブフォルダはタイプフォルダ内に限定する。 */
export interface CreateNoteInput {
  /** 選択したタイプ別保存領域内の既存フォルダ。 */
  destinationFolder?: string;
  subfolder: string;
  tags: string[];
  title: string;
  type: ItemType;
}

function uniqueTypes(types: readonly ItemType[]): ItemType[] {
  return [...new Set(types)];
}

/** 設定に従う新規作成候補を、固定・最近・残りの順に分ける純粋関数。 */
export function getCreateTypeSections(
  settings: CreateTypeSettings
): CreateTypeSections {
  const enabledTypes = new Set(settings.enabledTypes);
  const availableTypes = uniqueTypes(settings.typeOrder).filter(
    (type) =>
      enabledTypes.has(type) && (type !== "memo" || settings.modules.memos)
  );
  const availableTypesSet = new Set(availableTypes);
  const pinned = uniqueTypes(settings.pinnedTypes).filter((type) =>
    availableTypesSet.has(type)
  );
  const pinnedSet = new Set(pinned);
  const recent = uniqueTypes(settings.recentTypes).filter(
    (type) => availableTypesSet.has(type) && !pinnedSet.has(type)
  );
  const prioritized = new Set([...pinned, ...recent]);

  return {
    all: availableTypes.filter((type) => !prioritized.has(type)),
    pinned,
    recent,
  };
}
