/**
 * Lucideアイコンの集中管理（Obsidian内蔵 setIcon を使用）
 * getIconIds() で実行時に存在チェックし、なければフォールバックテキストを表示。
 */
import { getIconIds, setIcon } from "obsidian";

/** 検証済みLucideアイコン名（lucide-static 1.32 で存在確認済み） */
export const ICONS = {
  alignCenter: "text-align-center",
  alignLeft: "text-align-start",
  alignRight: "text-align-end",
  archive: "archive",
  archiveRestore: "archive-restore",
  arrowLeft: "arrow-left",
  article: "file-text",
  bold: "bold",
  calendar: "calendar",
  chevronRight: "chevron-right",
  // type別（10種）
  class: "graduation-cap",
  collection: "library",
  external: "external-link",
  globe: "globe",
  heading: "heading",
  idea: "lightbulb",
  // セクション見出し
  inbox: "inbox",
  layoutGrid: "layout-grid",
  // 書庫
  library: "library-big",
  list: "list-plus",
  // サイドバー
  listTree: "list-tree",
  memo: "message-circle",
  message: "message-circle",
  // カードメニュー・操作
  more: "ellipsis",
  // ツールバー
  palette: "palette",
  pencil: "pencil",
  pin: "pin",
  plus: "plus",
  profile: "user-round",
  project: "folder-kanban",
  reading: "book-open",
  repeat: "repeat",
  rows: "rows-3",
  // 検索・表示
  search: "search",
  send: "send",
  sparkles: "sparkles",
  tag: "tags",
  task: "circle-check",
  toggle: "chevrons-down-up",
  toggleHeading: "chevrons-up-down",
  trash: "trash-2",
  webclip: "link",
  x: "x",
} as const;

export type IconKey = keyof typeof ICONS;

/** 利用可能なアイコン名のキャッシュ（null=未初期化） */
let available: Set<string> | null = null;

function availableIcons(): Set<string> {
  if (available === null) {
    try {
      available = new Set(getIconIds());
    } catch {
      available = new Set();
    }
  }
  return available;
}

/** アイコンが内蔵ライブラリに存在するか */
export function hasIcon(iconId: string): boolean {
  return availableIcons().has(iconId);
}

/** アイコンを要素に設定（存在しない場合はフォールバックテキスト） */
export function applyIcon(
  el: HTMLElement | null,
  key: IconKey,
  fallback?: string
): void {
  if (!el) {
    return;
  }
  const iconId = ICONS[key];
  if (hasIcon(iconId)) {
    setIcon(el, iconId);
  } else if (fallback) {
    el.textContent = fallback;
  }
}

/** type → IconKey */
export const TYPE_ICON: Record<string, IconKey> = {
  article: "article",
  class: "class",
  collection: "collection",
  idea: "idea",
  memo: "memo",
  profile: "profile",
  project: "project",
  reading: "reading",
  task: "task",
  webclip: "webclip",
};
