/**
 * ホーム用インデックス構築（純関数・テスト可能）
 * タグビュー（内容タグ・使用頻度順/アルファベット順）・リスト・ピン留め・未整理。
 */

import type {
  IndexedItem,
  ListSection,
  SeitonItem,
  TagSection,
  TagSort,
} from "./types";

export interface HomeIndex {
  inbox: IndexedItem[];
  items: IndexedItem[];
  lists: ListSection[];
  pinned: IndexedItem[];
  tags: TagSection[];
}

/** 内容タグを収集（タグビュー用） */
function collectTags(items: IndexedItem[]): Map<string, IndexedItem[]> {
  const map = new Map<string, IndexedItem[]>();
  for (const item of items) {
    for (const tag of item.item.tags ?? []) {
      if (tag.length === 0) {
        continue;
      }
      let arr = map.get(tag);
      if (!arr) {
        arr = [];
        map.set(tag, arr);
      }
      arr.push(item);
    }
  }
  return map;
}

function sortTagSections(sections: TagSection[], sort: TagSort): TagSection[] {
  if (sort === "alpha") {
    return sections.slice().sort((a, b) => a.tag.localeCompare(b.tag, "ja"));
  }
  return sections
    .slice()
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"));
}

/** リストを収集（手動キュレーション） */
function collectLists(items: IndexedItem[]): Map<string, IndexedItem[]> {
  const map = new Map<string, IndexedItem[]>();
  for (const item of items) {
    for (const name of item.item.lists ?? []) {
      if (name.length === 0) {
        continue;
      }
      let arr = map.get(name);
      if (!arr) {
        arr = [];
        map.set(name, arr);
      }
      arr.push(item);
    }
  }
  return map;
}

/**
 * インデックスを構築
 * @param items 収集物一覧
 * @param opts.pinned ピン留めされたパス一覧（data.json）
 * @param opts.excludeArchived デフォルト表示からアーカイブを除外（決定26）
 * @param opts.tagSort タグビュー並び順（決定27）
 */
export function buildHomeIndex(
  items: IndexedItem[],
  opts: {
    pinned: string[];
    listNames?: string[];
    excludeArchived?: boolean;
    tagSort?: TagSort;
  } = { pinned: [] }
): HomeIndex {
  const excludeArchived = opts.excludeArchived ?? true;
  const visible = excludeArchived
    ? items.filter((i) => i.item.status !== "archive")
    : items;

  const tags = sortTagSections(
    [...collectTags(items).entries()].map(([tag, tagItems]) => ({
      count: tagItems.length,
      items: tagItems.filter((item) =>
        visible.some((current) => current.path === item.path)
      ),
      tag,
    })),
    opts.tagSort ?? "usage"
  );

  const listMap = collectLists(visible);
  const lists = [...new Set([...(opts.listNames ?? []), ...listMap.keys()])]
    .map((name) => ({
      count: listMap.get(name)?.length ?? 0,
      items: listMap.get(name) ?? [],
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const inbox = visible.filter((i) => i.item.status === "inbox");
  const pinnedSet = new Set(opts.pinned);
  const pinned = visible.filter((i) => pinnedSet.has(i.path));

  return { inbox, items: visible, lists, pinned, tags };
}

/** 収集物のfrontmatterを更新する（status/lists/tags の変更を文字列に反映） */
export function applyItemPatch(
  item: SeitonItem,
  patch: Partial<SeitonItem>
): SeitonItem {
  return { ...item, ...patch };
}
