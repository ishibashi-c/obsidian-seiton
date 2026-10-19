import { ITEM_TYPES } from "./constants";
import { formatItemFrontmatter } from "./frontmatter";
import type { ItemType, SeitonItem } from "./types";

/** 内蔵テンプレート。見出しは保存データの言語を揃えるため仕様書どおり固定する。 */
export const DEFAULT_TEMPLATES: Record<ItemType, string> = {
  article: "## 想定読者\n\n## 構成\n\n## 本文メモ",
  class: "## テーマ\n\n## メモ\n\n## 疑問",
  collection: "## 項目",
  idea: "## 一言で\n\n## 背景\n\n## 次の一手",
  memo: "## メモ",
  profile: "## 用途\n\n## 本文",
  project: "## 目的\n\n## 成果物\n\n## 状態\n\n## 次にやること",
  reading: "## 出典\n\n## 要約\n\n## ポイント",
  task: "## 締切\n\n## 内容\n\n## 要件\n\n## 状態",
  webclip: "## メモ",
};

export function templateForType(
  type: ItemType,
  custom?: Partial<Record<ItemType, string>>
): string {
  const value = custom?.[type];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_TEMPLATES[type];
}

export function buildNewNote(
  type: ItemType,
  _title: string,
  created: string,
  custom?: Partial<Record<ItemType, string>>,
  tags: readonly string[] = []
): string {
  const item: SeitonItem = {
    created,
    lists: [],
    sourceTags: [],
    status: "inbox",
    tags: [...tags],
    type,
  };
  return `---\n${formatItemFrontmatter(item)}\n---\n${templateForType(type, custom)}\n`;
}

/** 設定データの壊れたテンプレートを除外し、型ごとの初期値を補完する。 */
export function normalizeTemplates(
  value: Partial<Record<ItemType, string>> | undefined
): Record<ItemType, string> {
  return Object.fromEntries(
    ITEM_TYPES.map((type) => [type, templateForType(type, value)])
  ) as Record<ItemType, string>;
}
