/** @jsxImportSource react */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import {
  isInArchivedContext,
  isInLibraryFolder,
  isWithinFolder,
  libraryFolderOptions,
  libraryFolderPath,
  libraryItemWithArchiveContext,
  rewriteFolderPath,
} from "../../shared/library";
import {
  archiveFolderDestination,
  archiveNoteDestination,
} from "../../shared/paths";
import type {
  ArchiveFolderMove,
  ArchiveNoteMove,
  LibraryBrowseMode,
  LibrarySort,
  ViewMode as SharedViewMode,
  TagSort,
} from "../../shared/types";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { FolderTreePicker } from "../patterns/FolderTreePicker";
import { OverflowMenuTrigger } from "../patterns/OverflowMenuTrigger";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  IconButton,
  Modal,
  SegmentedControl,
  SeitonIcon,
  Stack,
  Text,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

type ItemType =
  | "task"
  | "reading"
  | "clip"
  | "collection"
  | "idea"
  | "memo"
  | "profile"
  | "lecture"
  | "article"
  | "project";
type ViewMode = SharedViewMode;
type BrowseMode = LibraryBrowseMode;
type SortKey = LibrarySort;
type SearchMode = "free" | "tag";
type FolderAction = "create" | "rename";
type LibraryScope = "active" | "archived";
type ArchiveDialogMode = "archive" | "restore";

type ArchiveChoice =
  | { key: string; kind: "moved"; move: ArchiveFolderMove }
  | { key: string; kind: "legacy"; path: string };

export interface LibrarySettings {
  browseMode: BrowseMode;
  listFoldState: Record<string, boolean>;
  sort: SortKey;
  tagSort: TagSort;
  viewMode: ViewMode;
}

export interface LibraryItem {
  archived?: boolean;
  archiveState?: "context" | "legacy" | "note";
  /** 文脈アーカイブ配下にあるか。ノート自身のstatusとは別概念。 */
  contextArchived?: boolean;
  created: string;
  id: string;
  /** ノート自身のstatus=archiveによる旧アーカイブ状態。 */
  legacyArchived?: boolean;
  list?: string;
  lists?: string[];
  modified: string;
  path: string;
  pinned?: boolean;
  summary?: string;
  tags: string[];
  title: string;
  type: ItemType;
  /** typeごとの保存先ルート。別タイプの保存先へ誤移動しないために使う。 */
  typeRoot?: string;
}

const TYPE_LABEL_KEYS: Record<ItemType, MessageKey> = {
  article: "type.article",
  clip: "type.webclip",
  collection: "type.collection",
  idea: "type.idea",
  lecture: "type.class",
  memo: "type.memo",
  profile: "type.profile",
  project: "type.project",
  reading: "type.reading",
  task: "type.task",
};

function typeLabel(lang: Lang, type: ItemType): string {
  return t(lang, TYPE_LABEL_KEYS[type]);
}

const TYPE_ORDER: ItemType[] = [
  "task",
  "reading",
  "clip",
  "collection",
  "idea",
  "article",
  "project",
  "memo",
  "profile",
  "lecture",
];

const LIBRARY_ITEMS: LibraryItem[] = [
  {
    created: "2026.08.03",
    id: "task-readme",
    list: "お気に入り",
    modified: "2026.08.26",
    path: "Seiton/tasks/開発/READMEにデモGIFを追加.md",
    summary: "READMEへ操作例を追加する。",
    tags: ["#開発", "#ドキュメント"],
    title: "READMEにデモGIFを追加",
    type: "task",
  },
  {
    created: "2026.08.20",
    id: "reading-eye",
    list: "読書メモ",
    modified: "2026.08.25",
    path: "Seiton/readings/生活/情報は眼により章立てメモ.md",
    summary: "章ごとの要点と、あとで読み返したい箇所。",
    tags: ["#生活"],
    title: "情報は眼により章立てメモ",
    type: "reading",
  },
  {
    created: "2026.08.18",
    id: "collection-art",
    list: "お気に入り",
    modified: "2026.09.20",
    path: "Seiton/collections/良かったアート.md",
    summary: "これまでに見て良かった作品と作者を追記していく一覧。",
    tags: ["#アート", "#記録"],
    title: "良かったアート",
    type: "collection",
  },
  {
    created: "2026.08.20",
    id: "clip-deep-learning",
    modified: "2026.08.24",
    path: "Seiton/clips/AI/深層学習の最新動向メモ.md",
    summary: "保存した記事から重要な論点を抜き出したメモ。",
    tags: ["#学び", "#AI"],
    title: "深層学習の最新動向メモ",
    type: "clip",
  },
  {
    created: "2026.08.18",
    id: "clip-obsidian",
    list: "お気に入り",
    modified: "2026.08.23",
    path: "Seiton/clips/開発/Obsidian 1.13 リリースノート翻訳と変更点の確認.md",
    summary: "リリース内容と既存プラグインへの影響を確認する。",
    tags: ["#開発", "#Obsidian"],
    title: "Obsidian 1.13 リリースノート翻訳と変更点の確認",
    type: "clip",
  },
  {
    created: "2026.08.18",
    id: "idea-organize",
    modified: "2026.08.22",
    path: "Seiton/ideas/AI/自動整理エージェント.md",
    summary: "未整理ノートの候補を提示する仕組み。",
    tags: ["#AI"],
    title: "自動整理エージェント",
    type: "idea",
  },
  {
    created: "2026.08.10",
    id: "idea-seiton",
    list: "お気に入り",
    modified: "2026.08.21",
    path: "Seiton/ideas/Seiton/Seitonの今後の設計.md",
    summary: "機能の責務と、画面間の共通パターンを整理する。",
    tags: ["#開発", "#設計"],
    title: "Seitonの今後の設計",
    type: "idea",
  },
  {
    created: "2026.08.19",
    id: "task-search",
    modified: "2026.08.20",
    path: "Seiton/tasks/検索/検索の読み正規化バグ修正.md",
    summary: "日本語入力と記号の扱いを確認する。",
    tags: ["#開発", "#検索"],
    title: "検索の読み正規化バグ修正",
    type: "task",
  },
  {
    created: "2026.08.01",
    id: "memo-august",
    modified: "2026.08.19",
    path: "Seiton/Memos/2026/2026年8月の一言メモ.md",
    summary: "8月に保存した短いメモ。",
    tags: ["#日常"],
    title: "2026年8月の一言メモ",
    type: "memo",
  },
  {
    created: "2026.08.18",
    id: "profile-update",
    modified: "2026.08.18",
    path: "Seiton/profiles/プロフィール更新.md",
    tags: [],
    title: "プロフィール更新",
    type: "profile",
  },
  {
    created: "2026.08.16",
    id: "lecture-ui",
    list: "あとで読む",
    modified: "2026.08.17",
    path: "Seiton/classes/画像生成演習/授業で使える画像生成プロンプト.md",
    summary: "授業準備で使う画像生成の例文。",
    tags: ["#授業", "#学び"],
    title: "授業で使える画像生成プロンプト",
    type: "lecture",
  },
  {
    created: "2026.08.09",
    id: "reading-design",
    list: "読書メモ",
    modified: "2026.08.16",
    path: "Seiton/readings/デザイン/デザインシステム入門の読書記録.md",
    summary: "部品とトークンを一貫させるための記録。",
    tags: ["#デザイン", "#UI"],
    title: "デザインシステム入門の読書記録",
    type: "reading",
  },
  {
    created: "2026.08.12",
    id: "task-migration",
    modified: "2026.08.15",
    path: "Seiton/tasks/移行/Vault移行後のリンク確認.md",
    summary: "既存ノートのリンク切れを確認する。",
    tags: ["#移行"],
    title: "Vault移行後のリンク確認",
    type: "task",
  },
  {
    created: "2026.08.14",
    id: "lecture-social-design",
    modified: "2026.08.14",
    path: "Seiton/classes/学習テーマ/第1回ノート.md",
    summary: "授業で扱った社会課題の観察メモ。",
    tags: ["#学習/講義", "#学習テーマ", "#学び"],
    title: "学習テーマ 第1回",
    type: "lecture",
  },
  {
    created: "2026.08.13",
    id: "clip-social-design",
    modified: "2026.08.13",
    path: "Seiton/clips/学習/学習テーマ/参考資料.md",
    summary: "授業内容を補足する参考記事のクリップ。",
    tags: ["#学習/講義", "#学習テーマ", "#調査"],
    title: "学習テーマの参考資料",
    type: "clip",
  },
];

function formatCount(count: number): string {
  return `${count}件`;
}

function itemLists(item: LibraryItem): string[] {
  return item.lists ?? (item.list ? [item.list] : []);
}

function isLibraryItemArchived(item: LibraryItem): boolean {
  return Boolean(item.archived ?? item.contextArchived);
}

function displayFolder(path: string): string {
  return libraryFolderPath(path) || "ルート";
}

function tagEntries(
  items: LibraryItem[],
  tagSort: TagSort
): [string, LibraryItem[]][] {
  const map = new Map<string, LibraryItem[]>();
  for (const item of items) {
    for (const tag of item.tags) {
      map.set(tag, [...(map.get(tag) ?? []), item]);
    }
  }
  return [...map.entries()].sort(
    ([leftTag, leftItems], [rightTag, rightItems]) =>
      tagSort === "usage"
        ? rightItems.length - leftItems.length ||
          leftTag.localeCompare(rightTag, "ja")
        : leftTag.localeCompare(rightTag, "ja")
  );
}

export function sortLibraryTags(
  items: LibraryItem[],
  tagSort: TagSort
): string[] {
  return tagEntries(items, tagSort).map(([tag]) => tag);
}

function LibraryCard({
  lang,
  item,
  onEditLists,
  onArchiveItem,
  onOpen,
  onMoveItem,
  onRestoreItem,
  onRestoreLegacyItem,
  onTogglePin,
}: {
  lang: Lang;
  item: LibraryItem;
  onEditLists: (item: LibraryItem, trigger: HTMLElement | null) => void;
  onArchiveItem?: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem) => void;
  onMoveItem?: (item: LibraryItem) => void;
  onRestoreItem?: (item: LibraryItem) => void;
  onRestoreLegacyItem?: (item: LibraryItem) => void;
  onTogglePin?: (item: LibraryItem) => void | Promise<void>;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const menuPanelId = useId();

  useEffect(() => {
    const handlePointerDown = (event: Event): void => {
      const menu = menuRef.current;
      const eventPath = event.composedPath();
      if (menu?.open && !eventPath.includes(menu)) {
        menu.open = false;
      }
    };
    const menu = menuRef.current;
    const eventRoot = menu?.getRootNode();
    eventRoot?.addEventListener("pointerdown", handlePointerDown);
    return () =>
      eventRoot?.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <article className="react-library-card-shell">
      <a
        aria-label={t(lang, "home.openItem", { title: item.title })}
        className="react-library-card"
        href={`#${item.id}`}
        onClick={(event) => {
          event.preventDefault();
          onOpen(item);
        }}
      >
        <div className="react-library-card-meta">
          <Badge color="accent" variant="light">
            {typeLabel(lang, item.type)}
          </Badge>
          <span className="react-library-card-folder" title={item.path}>
            {displayFolder(item.path)}
          </span>
          <time dateTime={item.modified.replace(/\./g, "-")}>
            {item.modified}
          </time>
        </div>
        <h3 className="react-library-card-title">{item.title}</h3>
        <p
          className={`react-library-card-summary ${item.summary ? "" : "is-empty"}`}
        >
          {item.summary ?? t(lang, "library.noPreview")}
        </p>
        <section
          aria-label={t(lang, "library.column.tags")}
          className="react-library-card-tags"
        >
          {item.tags.length > 0 ? (
            item.tags.map((tag) => <span key={tag}>{tag}</span>)
          ) : (
            <span className="react-library-no-tags">
              {t(lang, "empty.noTags")}
            </span>
          )}
        </section>
      </a>
      <details
        className="react-library-card-menu"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !event.currentTarget.open) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.open = false;
          menuTriggerRef.current?.focus();
        }}
        ref={menuRef}
      >
        <OverflowMenuTrigger
          as="summary"
          controls={menuPanelId}
          label={t(lang, "library.actionsFor", { title: item.title })}
          ref={menuTriggerRef}
        />
        <div className="react-library-card-menu-popover" id={menuPanelId}>
          <Button
            aria-label={`${item.title}: ${t(lang, "menu.list")}`}
            className="react-library-card-action"
            onClick={() => {
              if (menuRef.current) {
                menuRef.current.open = false;
              }
              onEditLists(item, menuTriggerRef.current);
            }}
            size="compact-sm"
            variant="subtle"
          >
            {t(lang, "menu.list")}
          </Button>
          {item.archiveState !== "context" &&
            !item.contextArchived &&
            ((isLibraryItemArchived(item) &&
              (item.archiveState === "legacy"
                ? Boolean(onRestoreLegacyItem)
                : Boolean(onRestoreItem))) ||
              (!isLibraryItemArchived(item) && Boolean(onArchiveItem))) &&
            (isLibraryItemArchived(item) ? (
              <Button
                aria-label={`${item.title}: ${t(lang, item.archiveState === "legacy" ? "library.reactivateItem" : "library.restoreItem")}`}
                className="react-library-card-action"
                onClick={() =>
                  item.archiveState === "legacy"
                    ? onRestoreLegacyItem?.(item)
                    : onRestoreItem?.(item)
                }
                size="compact-sm"
                variant="subtle"
              >
                {t(
                  lang,
                  item.archiveState === "legacy"
                    ? "library.reactivateItem"
                    : "library.restoreItem"
                )}
              </Button>
            ) : (
              <Button
                aria-label={`${item.title}: ${t(lang, "library.archiveItem")}`}
                className="react-library-card-action"
                onClick={() => onArchiveItem?.(item)}
                size="compact-sm"
                variant="subtle"
              >
                {t(lang, "library.archiveItem")}
              </Button>
            ))}
          <Button
            aria-label={`${item.title}: ${t(lang, "library.moveItem")}`}
            className="react-library-card-action"
            onClick={() => {
              if (menuRef.current) {
                menuRef.current.open = false;
              }
              onMoveItem?.(item);
            }}
            size="compact-sm"
            variant="subtle"
          >
            {t(lang, "library.moveItem")}
          </Button>
          <Button
            aria-label={`${item.title}: ${t(lang, item.pinned ? "menu.unpin" : "menu.pin")}`}
            className="react-library-card-action"
            onClick={() => {
              if (menuRef.current) {
                menuRef.current.open = false;
              }
              void onTogglePin?.(item);
            }}
            size="compact-sm"
            variant="subtle"
          >
            {t(lang, item.pinned ? "menu.unpin" : "menu.pin")}
          </Button>
        </div>
      </details>
    </article>
  );
}

function LibraryList({
  lang,
  items,
  onOpen,
  onEditLists,
  onArchiveItem,
  onMoveItem,
  onRestoreItem,
  onRestoreLegacyItem,
  onTogglePin,
}: {
  lang: Lang;
  items: LibraryItem[];
  onOpen: (item: LibraryItem) => void;
  onEditLists: (item: LibraryItem, trigger: HTMLElement | null) => void;
  onArchiveItem?: (item: LibraryItem) => void;
  onMoveItem?: (item: LibraryItem) => void;
  onRestoreItem?: (item: LibraryItem) => void;
  onRestoreLegacyItem?: (item: LibraryItem) => void;
  onTogglePin?: (item: LibraryItem) => void | Promise<void>;
}) {
  return (
    <div className="react-library-list-shell">
      <div aria-hidden="true" className="react-library-list-header">
        <div className="react-library-list-header-content">
          <span>{t(lang, "library.column.title")}</span>
          <span>{t(lang, "library.column.type")}</span>
          <span>{t(lang, "library.column.folder")}</span>
          <span className="react-library-list-header-tags">
            {t(lang, "library.column.tags")}
          </span>
          <span>{t(lang, "library.column.updated")}</span>
        </div>
        <span className="react-library-list-header-action">
          {t(lang, "library.column.action")}
        </span>
      </div>
      <ul aria-label={t(lang, "library.title")} className="react-library-list">
        {items.map((item) => {
          const tags =
            item.tags.length > 0
              ? item.tags.join(" ")
              : t(lang, "empty.noTags");
          const label = [
            `${t(lang, "library.column.title")}: ${item.title}`,
            `${t(lang, "library.column.type")}: ${typeLabel(lang, item.type)}`,
            `${t(lang, "library.column.folder")}: ${item.path}`,
            `${t(lang, "library.column.tags")}: ${tags}`,
            `${t(lang, "library.column.updated")}: ${item.modified}`,
          ].join(". ");

          return (
            <li key={item.id}>
              <div className="react-library-list-row">
                <button
                  aria-label={label}
                  className="react-library-list-open"
                  onClick={() => onOpen(item)}
                  type="button"
                >
                  <span className="react-library-list-title">{item.title}</span>
                  <span
                    className="react-library-list-type"
                    data-label={t(lang, "library.column.type")}
                  >
                    {typeLabel(lang, item.type)}
                  </span>
                  <span
                    className="react-library-list-folder"
                    data-label={t(lang, "library.column.folder")}
                    title={item.path}
                  >
                    {displayFolder(item.path)}
                  </span>
                  <span className="react-library-list-tags">{tags}</span>
                  <time
                    data-label={t(lang, "library.column.updated")}
                    dateTime={item.modified.replace(/\./g, "-")}
                  >
                    {item.modified}
                  </time>
                </button>
                <div className="react-library-list-actions">
                  <Button
                    aria-label={`${item.title}: ${t(lang, "menu.list")}`}
                    className="react-library-list-action"
                    onClick={(event) => onEditLists(item, event.currentTarget)}
                    size="compact-sm"
                    variant="subtle"
                  >
                    {t(lang, "menu.list")}
                  </Button>
                  {Boolean(onMoveItem) && (
                    <Button
                      aria-label={`${item.title}: ${t(lang, "library.moveItem")}`}
                      className="react-library-list-action"
                      onClick={() => onMoveItem?.(item)}
                      size="compact-sm"
                      variant="subtle"
                    >
                      {t(lang, "library.moveItem")}
                    </Button>
                  )}
                  {item.archiveState !== "context" &&
                    !item.contextArchived &&
                    ((isLibraryItemArchived(item) &&
                      (item.archiveState === "legacy"
                        ? Boolean(onRestoreLegacyItem)
                        : Boolean(onRestoreItem))) ||
                      (!isLibraryItemArchived(item) &&
                        Boolean(onArchiveItem))) &&
                    (isLibraryItemArchived(item) ? (
                      <Button
                        aria-label={`${item.title}: ${t(lang, item.archiveState === "legacy" ? "library.reactivateItem" : "library.restoreItem")}`}
                        className="react-library-list-action"
                        onClick={() =>
                          item.archiveState === "legacy"
                            ? onRestoreLegacyItem?.(item)
                            : onRestoreItem?.(item)
                        }
                        size="compact-sm"
                        variant="subtle"
                      >
                        {t(
                          lang,
                          item.archiveState === "legacy"
                            ? "library.reactivateItem"
                            : "library.restoreItem"
                        )}
                      </Button>
                    ) : (
                      <Button
                        aria-label={`${item.title}: ${t(lang, "library.archiveItem")}`}
                        className="react-library-list-action"
                        onClick={() => onArchiveItem?.(item)}
                        size="compact-sm"
                        variant="subtle"
                      >
                        {t(lang, "library.archiveItem")}
                      </Button>
                    ))}
                  <IconButton
                    className="react-library-list-action"
                    filled={Boolean(item.pinned)}
                    icon="pin"
                    label={`${item.title}: ${t(lang, "menu.pin")}`}
                    onClick={() => void onTogglePin?.(item)}
                    pressed={Boolean(item.pinned)}
                    size="compact-sm"
                    title={t(lang, item.pinned ? "menu.unpin" : "menu.pin")}
                    variant="subtle"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TagBrowse({
  lang,
  items,
  listFoldState,
  onOpen,
  onArchiveItem,
  onMoveItem,
  onRestoreItem,
  onRestoreLegacyItem,
  onTogglePin,
  onToggleListFold,
  tagSort,
}: {
  lang: Lang;
  items: LibraryItem[];
  listFoldState: Record<string, boolean>;
  onOpen: (item: LibraryItem) => void;
  onArchiveItem?: (item: LibraryItem) => void;
  onMoveItem?: (item: LibraryItem) => void;
  onRestoreItem?: (item: LibraryItem) => void;
  onRestoreLegacyItem?: (item: LibraryItem) => void;
  onTogglePin?: (item: LibraryItem) => void | Promise<void>;
  onToggleListFold: (name: string, open: boolean) => void;
  tagSort: TagSort;
}) {
  const groups = useMemo(() => tagEntries(items, tagSort), [items, tagSort]);

  if (groups.length === 0) {
    return (
      <div className="react-library-empty" role="status">
        <strong>{t(lang, "empty.noTags")}</strong>
        <span>{t(lang, "library.noTagsHint")}</span>
      </div>
    );
  }

  return (
    <div className="react-library-tag-groups">
      {groups.map(([tag, tagItems]) => (
        <details
          aria-labelledby={`tag-${tag}`}
          className="react-library-tag-group"
          key={tag}
          open={listFoldState[tag] ?? true}
        >
          <summary
            className="react-library-tag-heading"
            onClick={(event) => {
              const details = event.currentTarget.parentElement;
              if (details instanceof HTMLDetailsElement) {
                onToggleListFold(tag, !details.open);
              }
            }}
          >
            <h3 id={`tag-${tag}`}>{tag}</h3>
            <Badge color="ink" variant="outline">
              {formatCount(tagItems.length)}
            </Badge>
          </summary>
          <div className="react-library-tag-items">
            {tagItems.map((item) => (
              <div className="react-library-tag-item" key={item.id}>
                <button onClick={() => onOpen(item)} type="button">
                  <strong>{item.title}</strong>
                  <span>
                    {typeLabel(lang, item.type)}
                    {" · "}
                    {displayFolder(item.path)}
                    {" · "}
                    {item.modified}
                  </span>
                </button>
                <Button
                  aria-label={`${item.title}: ${t(lang, "library.moveItem")}`}
                  className="react-library-tag-move"
                  onClick={() => onMoveItem?.(item)}
                  size="compact-sm"
                  variant="subtle"
                >
                  {t(lang, "library.moveItem")}
                </Button>
                {item.archiveState !== "context" &&
                  !item.contextArchived &&
                  ((isLibraryItemArchived(item) &&
                    (item.archiveState === "legacy"
                      ? Boolean(onRestoreLegacyItem)
                      : Boolean(onRestoreItem))) ||
                    (!isLibraryItemArchived(item) && Boolean(onArchiveItem))) &&
                  (isLibraryItemArchived(item) ? (
                    <Button
                      aria-label={`${item.title}: ${t(lang, item.archiveState === "legacy" ? "library.reactivateItem" : "library.restoreItem")}`}
                      className="react-library-tag-move"
                      onClick={() =>
                        item.archiveState === "legacy"
                          ? onRestoreLegacyItem?.(item)
                          : onRestoreItem?.(item)
                      }
                      size="compact-sm"
                      variant="subtle"
                    >
                      {t(
                        lang,
                        item.archiveState === "legacy"
                          ? "library.reactivateItem"
                          : "library.restoreItem"
                      )}
                    </Button>
                  ) : (
                    <Button
                      aria-label={`${item.title}: ${t(lang, "library.archiveItem")}`}
                      className="react-library-tag-move"
                      onClick={() => onArchiveItem?.(item)}
                      size="compact-sm"
                      variant="subtle"
                    >
                      {t(lang, "library.archiveItem")}
                    </Button>
                  ))}
                <IconButton
                  className="react-library-tag-pin"
                  filled={Boolean(item.pinned)}
                  icon="pin"
                  label={`${item.title}: ${t(lang, "menu.pin")}`}
                  onClick={() => void onTogglePin?.(item)}
                  pressed={Boolean(item.pinned)}
                  size="compact-sm"
                  title={t(lang, item.pinned ? "menu.unpin" : "menu.pin")}
                  variant="subtle"
                />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function ReactLibrarySurface({
  lang = "ja",
  scheme,
  items = LIBRARY_ITEMS,
  folderPaths = [],
  archivedFolders = [],
  archiveFolderMoves = [],
  rootFolder = "Seiton",
  protectedFolderPaths = [],
  manageableFolderRoots = [],
  availableLists = [],
  initialBrowseMode,
  initialList,
  initialListFoldState,
  initialSort,
  initialTagSort,
  initialViewMode,
  onOpen,
  onSettingsChange,
  onSetLists,
  onTogglePin,
  onCreateFolder,
  onRenameFolder,
  onSetFolderArchived,
  onArchiveFolder,
  onArchiveItem,
  onRestoreFolder,
  onRestoreItem,
  onRestoreLegacyItem,
  onMoveItem,
}: {
  lang?: Lang;
  scheme: ColorScheme;
  items?: LibraryItem[];
  folderPaths?: string[];
  archivedFolders?: string[];
  archiveFolderMoves?: ArchiveFolderMove[];
  rootFolder?: string;
  protectedFolderPaths?: string[];
  manageableFolderRoots?: string[];
  availableLists?: string[];
  initialBrowseMode?: BrowseMode;
  initialList?: string;
  initialListFoldState?: Record<string, boolean>;
  initialSort?: SortKey;
  initialTagSort?: TagSort;
  initialViewMode?: ViewMode;
  onOpen?: (item: LibraryItem) => void | Promise<void>;
  onSettingsChange?: (settings: LibrarySettings) => void | Promise<void>;
  onSetLists?: (item: LibraryItem, lists: string[]) => void | Promise<void>;
  onTogglePin?: (item: LibraryItem) => void | Promise<void>;
  onCreateFolder?: (parentPath: string, name: string) => Promise<string>;
  onRenameFolder?: (path: string, name: string) => Promise<string>;
  onArchiveFolder?: (path: string) => Promise<ArchiveFolderMove>;
  onArchiveItem?: (item: LibraryItem) => Promise<ArchiveNoteMove>;
  onRestoreFolder?: (archivedPath: string) => Promise<string>;
  onRestoreItem?: (archivedPath: string) => Promise<string>;
  onRestoreLegacyItem?: (path: string) => Promise<void>;
  onSetFolderArchived?: (path: string, archived: boolean) => Promise<void>;
  onMoveItem?: (
    item: LibraryItem,
    destinationFolder: string
  ) => Promise<string>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const folderActionsRef = useRef<HTMLDetailsElement>(null);
  const folderActionsTriggerRef = useRef<HTMLElement | null>(null);
  const listEditorTriggerRef = useRef<HTMLElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [libraryItems, setLibraryItems] = useState(items);
  const [availableFolderPaths, setAvailableFolderPaths] = useState(folderPaths);
  const [archivedFolderPaths, setArchivedFolderPaths] =
    useState(archivedFolders);
  const [archiveMoves, setArchiveMoves] = useState(archiveFolderMoves);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("free");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [listFilter, setListFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [libraryScope, setLibraryScope] = useState<LibraryScope>("active");
  const [sortKey, setSortKey] = useState<SortKey>(initialSort ?? "modified");
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? "card");
  const [browseMode, setBrowseMode] = useState<BrowseMode>(
    initialBrowseMode ?? "items"
  );
  const [tagSort, setTagSort] = useState<TagSort>(initialTagSort ?? "alpha");
  const [listFoldState, setListFoldState] = useState<Record<string, boolean>>(
    () => ({ ...initialListFoldState })
  );
  const [feedback, setFeedback] = useState("");
  const [listEditorItem, setListEditorItem] = useState<LibraryItem | null>(
    null
  );
  const [listUpdateError, setListUpdateError] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [savingLists, setSavingLists] = useState(false);
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveDialogMode, setArchiveDialogMode] =
    useState<ArchiveDialogMode>("archive");
  const [selectedArchiveFolder, setSelectedArchiveFolder] = useState("");
  const [selectedArchiveChoice, setSelectedArchiveChoice] = useState("");
  const [archiveDialogError, setArchiveDialogError] = useState("");
  const [savingArchiveAction, setSavingArchiveAction] = useState(false);
  const [pendingNoteArchive, setPendingNoteArchive] =
    useState<LibraryItem | null>(null);
  const [noteArchiveError, setNoteArchiveError] = useState("");
  const [savingNoteArchive, setSavingNoteArchive] = useState(false);
  const [folderAction, setFolderAction] = useState<FolderAction>("create");
  const [managedFolderPath, setManagedFolderPath] = useState("");
  const [parentFolderPath, setParentFolderPath] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderActionError, setFolderActionError] = useState(false);
  const [savingFolderAction, setSavingFolderAction] = useState(false);
  const [movingItem, setMovingItem] = useState<LibraryItem | null>(null);
  const [moveDestination, setMoveDestination] = useState("");
  const [moveError, setMoveError] = useState(false);
  const [savingMove, setSavingMove] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (rootRef.current) {
      setPortalTarget(rootRef.current);
    }
  }, []);

  useEffect(() => {
    const menu = folderActionsRef.current;
    const eventRoot = menu?.getRootNode();
    const handlePointerDown = (event: Event): void => {
      if (menu?.open && !event.composedPath().includes(menu)) {
        menu.open = false;
      }
    };

    eventRoot?.addEventListener("pointerdown", handlePointerDown);
    return () =>
      eventRoot?.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    setLibraryItems(items);
  }, [items]);

  useEffect(() => {
    setAvailableFolderPaths(folderPaths);
  }, [folderPaths]);

  useEffect(() => {
    setArchivedFolderPaths(archivedFolders);
  }, [archivedFolders]);

  useEffect(() => {
    setArchiveMoves(archiveFolderMoves);
  }, [archiveFolderMoves]);

  const tags = useMemo(
    () => sortLibraryTags(libraryItems, tagSort),
    [libraryItems, tagSort]
  );
  const lists = useMemo(
    () =>
      [
        ...new Set([...availableLists, ...libraryItems.flatMap(itemLists)]),
      ].sort((left, right) => left.localeCompare(right, "ja")),
    [availableLists, libraryItems]
  );
  const folders = useMemo(
    () => libraryFolderOptions(libraryItems, availableFolderPaths),
    [availableFolderPaths, libraryItems]
  );
  const manageableFolders = useMemo(
    () =>
      folders.filter((folder) =>
        manageableFolderRoots.some((root) => isWithinFolder(folder.path, root))
      ),
    [folders, manageableFolderRoots]
  );

  const visibleFolders = useMemo(
    () =>
      folders.filter((folder) => {
        const archived = isInArchivedContext(folder.path, archivedFolderPaths);
        return libraryScope === "archived" ? archived : !archived;
      }),
    [archivedFolderPaths, folders, libraryScope]
  );

  const parentFolderOptions = manageableFolders.filter(
    (folder) => !isInArchivedContext(folder.path, archivedFolderPaths)
  );

  const archiveableFolders = manageableFolders.filter(
    (folder) =>
      !(
        protectedFolderPaths.includes(folder.path) ||
        isInArchivedContext(folder.path, archivedFolderPaths) ||
        archivedFolderPaths.some((archivedPath) =>
          isWithinFolder(archivedPath, folder.path)
        )
      )
  );
  const mappedArchivePaths = new Set(
    archiveMoves.map((move) => move.archivedPath)
  );
  const archiveChoices: ArchiveChoice[] = [
    ...archiveMoves.map((move) => ({
      key: `moved:${move.archivedPath}`,
      kind: "moved" as const,
      move,
    })),
    ...archivedFolderPaths
      .filter((path) => !mappedArchivePaths.has(path))
      .map((path) => ({
        key: `legacy:${path}`,
        kind: "legacy" as const,
        path,
      })),
  ];
  const selectedArchiveChoiceItem = archiveChoices.find(
    (choice) => choice.key === selectedArchiveChoice
  );
  const archiveDestinationFor = (path: string): string => {
    const typeRoot = manageableFolderRoots.find((root) =>
      isWithinFolder(path, root)
    );
    if (!typeRoot) {
      return "";
    }
    try {
      return archiveFolderDestination(rootFolder, typeRoot, path);
    } catch {
      return "";
    }
  };

  const noteArchiveDestinationFor = (item: LibraryItem): string => {
    const typeRoot =
      item.typeRoot ??
      manageableFolderRoots.find((root) => isWithinFolder(item.path, root));
    if (!typeRoot) {
      return "";
    }
    try {
      return archiveNoteDestination(rootFolder, typeRoot, item.path);
    } catch {
      return "";
    }
  };

  const managedFolderProtected =
    protectedFolderPaths.includes(managedFolderPath);

  useEffect(() => {
    setListFilter(
      initialList && lists.includes(initialList) ? initialList : "all"
    );
  }, [initialList, lists]);

  useEffect(() => {
    if (
      folderFilter !== "all" &&
      !visibleFolders.some((folder) => folder.path === folderFilter)
    ) {
      setFolderFilter("all");
    }
  }, [folderFilter, visibleFolders]);

  useEffect(() => {
    setBrowseMode(initialBrowseMode ?? "items");
  }, [initialBrowseMode]);

  useEffect(() => {
    setSortKey(initialSort ?? "modified");
  }, [initialSort]);

  useEffect(() => {
    setViewMode(initialViewMode ?? "card");
  }, [initialViewMode]);

  useEffect(() => {
    setTagSort(initialTagSort ?? "alpha");
  }, [initialTagSort]);

  useEffect(() => {
    setListFoldState({ ...initialListFoldState });
  }, [initialListFoldState]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = libraryItems.filter((item) => {
      const matchesScope =
        Boolean(item.archived ?? item.contextArchived) ===
        (libraryScope === "archived");
      const matchesQuery =
        !normalizedQuery ||
        [item.title, item.summary ?? "", ...item.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesTag = tagFilter === "all" || item.tags.includes(tagFilter);
      const matchesList =
        listFilter === "all" || itemLists(item).includes(listFilter);
      const matchesFolder =
        folderFilter === "all" || isInLibraryFolder(item.path, folderFilter);
      return (
        matchesQuery &&
        matchesType &&
        matchesTag &&
        matchesList &&
        matchesFolder &&
        matchesScope
      );
    });

    return filtered.sort((left, right) => {
      if (sortKey === "title") {
        return left.title.localeCompare(right.title, "ja");
      }
      if (sortKey === "type") {
        return (
          typeLabel(lang, left.type).localeCompare(
            typeLabel(lang, right.type),
            lang
          ) || left.title.localeCompare(right.title, "ja")
        );
      }
      const leftDate = sortKey === "created" ? left.created : left.modified;
      const rightDate = sortKey === "created" ? right.created : right.modified;
      return rightDate.localeCompare(leftDate);
    });
  }, [
    folderFilter,
    libraryItems,
    libraryScope,
    listFilter,
    query,
    sortKey,
    tagFilter,
    typeFilter,
    lang,
  ]);

  const hasFilters =
    Boolean(query.trim()) ||
    typeFilter !== "all" ||
    tagFilter !== "all" ||
    listFilter !== "all" ||
    folderFilter !== "all" ||
    sortKey !== "modified";

  const emitSettings = (changes: Partial<LibrarySettings>): void => {
    void onSettingsChange?.({
      browseMode,
      listFoldState,
      sort: sortKey,
      tagSort,
      viewMode,
      ...changes,
    });
  };

  const announce = (message: string): void => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  };

  const togglePin = async (item: LibraryItem): Promise<void> => {
    const nextPinned = !item.pinned;
    try {
      await onTogglePin?.({ ...item, pinned: nextPinned });
      setLibraryItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, pinned: nextPinned }
            : candidate
        )
      );
      announce(
        `${t(lang, nextPinned ? "action.pin" : "action.unpin")}: ${item.title}`
      );
    } catch {
      announce("ピン留めを更新できませんでした");
    }
  };

  const openFolderManager = (): void => {
    const selectedFolder = manageableFolders.some(
      (folder) => folder.path === folderFilter
    )
      ? folderFilter
      : "";
    setManagedFolderPath(selectedFolder);
    const selectedParentIsValid = parentFolderOptions.some(
      (folder) => folder.path === selectedFolder
    );
    setParentFolderPath(selectedParentIsValid ? selectedFolder : "");
    setFolderName("");
    setFolderAction("create");
    setFolderActionError(false);
    setFolderManagerOpen(true);
  };

  const closeFolderActionsMenu = (): void => {
    if (folderActionsRef.current) {
      folderActionsRef.current.open = false;
    }
  };

  const openArchiveDialog = (): void => {
    const mode = libraryScope === "active" ? "archive" : "restore";
    setArchiveDialogMode(mode);
    setArchiveDialogError("");
    if (mode === "archive") {
      const selected = archiveableFolders.some(
        (folder) => folder.path === folderFilter
      )
        ? folderFilter
        : (archiveableFolders[0]?.path ?? "");
      setSelectedArchiveFolder(selected);
    } else {
      setSelectedArchiveChoice(archiveChoices[0]?.key ?? "");
    }
    setArchiveDialogOpen(true);
  };

  const updateMovedFolderState = (
    previousPath: string,
    nextPath: string,
    archived: boolean
  ): void => {
    const rebasedArchivePaths = archivedFolderPaths.map((path) =>
      rewriteFolderPath(path, nextPath, previousPath)
    );
    const nextArchivePaths = archived
      ? [...new Set([...rebasedArchivePaths, nextPath])]
      : rebasedArchivePaths.filter(
          (path) => path !== previousPath && path !== nextPath
        );
    setArchivedFolderPaths(nextArchivePaths);
    setAvailableFolderPaths((current) => [
      ...new Set(
        current.map((path) => rewriteFolderPath(path, nextPath, previousPath))
      ),
    ]);
    setLibraryItems((current) =>
      current.map((item) => {
        const nextItemPath = rewriteFolderPath(
          item.path,
          nextPath,
          previousPath
        );
        return {
          ...libraryItemWithArchiveContext(
            item,
            isInArchivedContext(nextItemPath, nextArchivePaths)
          ),
          id: nextItemPath,
          path: nextItemPath,
        };
      })
    );
    setFolderFilter(nextPath);
  };

  const confirmNoteArchive = async (): Promise<void> => {
    const item = pendingNoteArchive;
    if (!(item && onArchiveItem) || savingNoteArchive) {
      return;
    }
    setSavingNoteArchive(true);
    setNoteArchiveError("");
    try {
      const move = await onArchiveItem(item);
      setLibraryItems((current) =>
        current.map((candidate) =>
          candidate.path === item.path
            ? {
                ...candidate,
                archived: true,
                archiveState: "note",
                contextArchived: false,
                id: move.archivedPath,
                path: move.archivedPath,
              }
            : candidate
        )
      );
      setLibraryScope("archived");
      setPendingNoteArchive(null);
      announce(t(lang, "library.archiveNoteSuccess"));
    } catch (error) {
      setNoteArchiveError(
        error instanceof Error ? error.message : t(lang, "library.folderFailed")
      );
    } finally {
      setSavingNoteArchive(false);
    }
  };

  const restoreNote = async (item: LibraryItem): Promise<void> => {
    if (!onRestoreItem || savingNoteArchive) {
      return;
    }
    setSavingNoteArchive(true);
    try {
      const path = await onRestoreItem(item.path);
      setLibraryItems((current) =>
        current.map((candidate) =>
          candidate.path === item.path
            ? {
                ...candidate,
                archived: false,
                archiveState: undefined,
                contextArchived: false,
                id: path,
                path,
              }
            : candidate
        )
      );
      setLibraryScope("active");
      announce(t(lang, "library.restoreNoteSuccess"));
    } catch (error) {
      announce(
        error instanceof Error ? error.message : t(lang, "library.folderFailed")
      );
    } finally {
      setSavingNoteArchive(false);
    }
  };

  const restoreLegacyNote = async (item: LibraryItem): Promise<void> => {
    if (!onRestoreLegacyItem || savingNoteArchive) {
      return;
    }
    setSavingNoteArchive(true);
    try {
      await onRestoreLegacyItem(item.path);
      setLibraryItems((current) =>
        current.map((candidate) =>
          candidate.path === item.path
            ? {
                ...candidate,
                archived: false,
                archiveState: undefined,
                contextArchived: false,
              }
            : candidate
        )
      );
      setLibraryScope("active");
      announce(t(lang, "library.restoreNoteSuccess"));
    } catch (error) {
      announce(
        error instanceof Error ? error.message : t(lang, "library.folderFailed")
      );
    } finally {
      setSavingNoteArchive(false);
    }
  };

  const submitArchiveAction = async (): Promise<void> => {
    if (savingArchiveAction) {
      return;
    }
    setSavingArchiveAction(true);
    setArchiveDialogError("");
    try {
      if (archiveDialogMode === "archive") {
        if (!(onArchiveFolder && selectedArchiveFolder)) {
          throw new Error(t(lang, "library.archiveSelectFolder"));
        }
        const move = await onArchiveFolder(selectedArchiveFolder);
        updateMovedFolderState(move.originalPath, move.archivedPath, true);
        setArchiveMoves((current) => [
          ...current.filter(
            (candidate) => candidate.archivedPath !== move.archivedPath
          ),
          move,
        ]);
        setLibraryScope("archived");
        setArchiveDialogOpen(false);
        announce(t(lang, "library.archiveSuccess"));
      } else if (selectedArchiveChoiceItem?.kind === "moved") {
        if (!onRestoreFolder) {
          throw new Error(t(lang, "library.folderFailed"));
        }
        const { move } = selectedArchiveChoiceItem;
        const restoredPath = await onRestoreFolder(move.archivedPath);
        updateMovedFolderState(move.archivedPath, restoredPath, false);
        setArchiveMoves((current) =>
          current.filter(
            (candidate) => candidate.archivedPath !== move.archivedPath
          )
        );
        setLibraryScope("active");
        setArchiveDialogOpen(false);
        announce(t(lang, "library.restoreSuccess"));
      } else if (selectedArchiveChoiceItem?.kind === "legacy") {
        if (!onArchiveFolder) {
          throw new Error(t(lang, "library.folderFailed"));
        }
        const move = await onArchiveFolder(selectedArchiveChoiceItem.path);
        updateMovedFolderState(move.originalPath, move.archivedPath, true);
        setArchiveMoves((current) => [...current, move]);
        setLibraryScope("archived");
        setArchiveDialogOpen(false);
        announce(t(lang, "library.archiveSuccess"));
      } else {
        throw new Error(t(lang, "library.archiveEmpty"));
      }
    } catch (error) {
      setArchiveDialogError(
        error instanceof Error ? error.message : t(lang, "library.folderFailed")
      );
    } finally {
      setSavingArchiveAction(false);
    }
  };

  const clearLegacyArchive = async (): Promise<void> => {
    if (
      selectedArchiveChoiceItem?.kind !== "legacy" ||
      !onSetFolderArchived ||
      savingArchiveAction
    ) {
      return;
    }
    const path = selectedArchiveChoiceItem.path;
    setSavingArchiveAction(true);
    setArchiveDialogError("");
    try {
      await onSetFolderArchived(path, false);
      const nextArchivePaths = archivedFolderPaths.filter(
        (candidate) => candidate !== path
      );
      setArchivedFolderPaths(nextArchivePaths);
      setLibraryItems((current) =>
        current.map((item) =>
          libraryItemWithArchiveContext(
            item,
            isInArchivedContext(item.path, nextArchivePaths)
          )
        )
      );
      setLibraryScope("active");
      setFolderFilter(path);
      setArchiveDialogOpen(false);
      announce(t(lang, "library.restoreSuccess"));
    } catch (error) {
      setArchiveDialogError(
        error instanceof Error ? error.message : t(lang, "library.folderFailed")
      );
    } finally {
      setSavingArchiveAction(false);
    }
  };

  const submitFolderAction = async (): Promise<void> => {
    if (savingFolderAction) {
      return;
    }
    setSavingFolderAction(true);
    setFolderActionError(false);
    try {
      if (folderAction === "create") {
        if (!onCreateFolder) {
          throw new Error("フォルダ作成が利用できません");
        }
        const path = await onCreateFolder(parentFolderPath, folderName);
        setAvailableFolderPaths((current) => [...new Set([...current, path])]);
        setManagedFolderPath(path);
        setParentFolderPath(path);
        setFolderFilter(path);
        setLibraryScope("active");
      } else {
        if (!(onRenameFolder && managedFolderPath)) {
          throw new Error("フォルダ名を変更できません");
        }
        const previousPath = managedFolderPath;
        const nextPath = await onRenameFolder(previousPath, folderName);
        setAvailableFolderPaths((current) => [
          ...new Set(
            current.map((path) =>
              rewriteFolderPath(path, nextPath, previousPath)
            )
          ),
        ]);
        setArchivedFolderPaths((current) => [
          ...new Set(
            current.map((path) =>
              rewriteFolderPath(path, nextPath, previousPath)
            )
          ),
        ]);
        setArchiveMoves((current) =>
          current.map((move) => ({
            ...move,
            archivedPath: rewriteFolderPath(
              move.archivedPath,
              nextPath,
              previousPath
            ),
            originalPath: rewriteFolderPath(
              move.originalPath,
              nextPath,
              previousPath
            ),
          }))
        );
        setLibraryItems((current) =>
          current.map((item) => {
            const nextItemPath = rewriteFolderPath(
              item.path,
              nextPath,
              previousPath
            );
            return nextItemPath === item.path
              ? item
              : { ...item, id: nextItemPath, path: nextItemPath };
          })
        );
        setFolderFilter((current) =>
          current === "all"
            ? current
            : rewriteFolderPath(current, nextPath, previousPath)
        );
        setManagedFolderPath(nextPath);
      }
      announce(t(lang, "library.folderSaved"));
      setFolderManagerOpen(false);
    } catch {
      setFolderActionError(true);
    } finally {
      setSavingFolderAction(false);
    }
  };

  const availableMoveFolders = useMemo(() => {
    if (!movingItem?.typeRoot) {
      return [];
    }
    return folders.filter(
      (folder) =>
        isWithinFolder(folder.path, movingItem.typeRoot ?? "") &&
        !isInArchivedContext(folder.path, archivedFolderPaths)
    );
  }, [archivedFolderPaths, folders, movingItem]);

  const openMoveDialog = (item: LibraryItem): void => {
    setMovingItem(item);
    setMoveDestination(libraryFolderPath(item.path) || item.typeRoot || "");
    setMoveError(false);
  };

  const submitMove = async (): Promise<void> => {
    if (!(movingItem && onMoveItem) || savingMove) {
      return;
    }
    setSavingMove(true);
    setMoveError(false);
    try {
      const nextPath = await onMoveItem(movingItem, moveDestination);
      setLibraryItems((current) =>
        current.map((item) =>
          item.id === movingItem.id
            ? { ...item, id: nextPath, path: nextPath }
            : item
        )
      );
      setMovingItem(null);
      announce(t(lang, "library.itemMoved"));
    } catch {
      setMoveError(true);
    } finally {
      setSavingMove(false);
    }
  };

  const clearFilters = (): void => {
    setQuery("");
    setSearchMode("free");
    setTypeFilter("all");
    setTagFilter("all");
    setListFilter("all");
    setFolderFilter("all");
    setSortKey("modified");
    emitSettings({ sort: "modified" });
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLInputElement | HTMLSelectElement>(
          ".react-library-search-field > input, .react-library-search-field > select"
        )
        ?.focus()
    );
  };

  const changeBrowseMode = (next: BrowseMode): void => {
    setBrowseMode(next);
    emitSettings({ browseMode: next });
  };

  const changeSort = (next: SortKey): void => {
    setSortKey(next);
    emitSettings({ sort: next });
  };

  const changeViewMode = (next: ViewMode): void => {
    setViewMode(next);
    emitSettings({ viewMode: next });
  };

  const toggleListFold = (name: string, open: boolean): void => {
    const nextListFoldState = { ...listFoldState, [name]: open };
    setListFoldState(nextListFoldState);
    emitSettings({ listFoldState: nextListFoldState });
  };

  const openListEditor = (
    item: LibraryItem,
    trigger: HTMLElement | null
  ): void => {
    listEditorTriggerRef.current = trigger;
    setListUpdateError(false);
    setListEditorItem(item);
    setSelectedLists(itemLists(item));
  };

  const saveLists = async (): Promise<void> => {
    if (!listEditorItem) {
      return;
    }
    const item = listEditorItem;
    const nextLists = [...selectedLists];
    const previousItems = libraryItems;
    setLibraryItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, list: nextLists[0], lists: nextLists }
          : candidate
      )
    );
    setListUpdateError(false);
    setSavingLists(true);
    try {
      await onSetLists?.(item, nextLists);
      setListEditorItem(null);
      announce(t(lang, "library.listUpdateSuccess"));
    } catch {
      setLibraryItems(previousItems);
      setListUpdateError(true);
    } finally {
      setSavingLists(false);
    }
  };

  return (
    <div
      className="seiton-react-library-prototype"
      data-scheme={scheme}
      ref={rootRef}
    >
      <header className="react-library-header">
        <div>
          <Title className="react-library-heading" order={1}>
            {t(lang, "library.title")}
          </Title>
        </div>
      </header>

      <main>
        <section
          aria-label={t(lang, "library.filters")}
          className="react-library-controls"
        >
          {visibleItems.length === libraryItems.length ? null : (
            <Text className="react-library-control-note" size="sm">
              {t(
                lang,
                libraryItems.length === 1
                  ? "library.totalCountOne"
                  : "library.totalCount",
                {
                  count: `${libraryItems.length}`,
                }
              )}
            </Text>
          )}
          <div className="react-library-filter-grid">
            <div className="react-library-search-field">
              <div className="react-library-search-label">
                <SegmentedControl
                  aria-label={t(lang, "search.title")}
                  data={[
                    { label: t(lang, "search.title"), value: "free" },
                    { label: t(lang, "menu.tags"), value: "tag" },
                  ]}
                  onChange={(value) => {
                    const next = value as SearchMode;
                    setSearchMode(next);
                    if (next === "free") {
                      setTagFilter("all");
                    } else {
                      setQuery("");
                    }
                  }}
                  value={searchMode}
                />
              </div>
              {searchMode === "free" ? (
                <input
                  aria-label={t(lang, "library.searchPlaceholder")}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder={t(lang, "library.searchPlaceholder")}
                  value={query}
                />
              ) : (
                <select
                  aria-label={t(lang, "menu.tags")}
                  onChange={(event) => setTagFilter(event.currentTarget.value)}
                  value={tagFilter}
                >
                  <option value="all">{t(lang, "library.allTags")}</option>
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label>
              <span>{t(lang, "menu.type")}</span>
              <select
                aria-label={t(lang, "menu.type")}
                onChange={(event) =>
                  setTypeFilter(event.currentTarget.value as ItemType | "all")
                }
                value={typeFilter}
              >
                <option value="all">
                  {t(lang, "library.filterAll")} {libraryItems.length}
                </option>
                {TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(lang, type)}{" "}
                    {libraryItems.filter((item) => item.type === type).length}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t(lang, "menu.list")}</span>
              <select
                aria-label={t(lang, "menu.list")}
                onChange={(event) => setListFilter(event.currentTarget.value)}
                value={listFilter}
              >
                <option value="all">{t(lang, "library.filterAll")}</option>
                {lists.map((list) => (
                  <option key={list} value={list}>
                    {list}
                  </option>
                ))}
              </select>
            </label>
            <FolderTreePicker
              emptyOption={{
                label: t(lang, "library.filterAll"),
                value: "all",
              }}
              label={t(lang, "new.folder")}
              lang={lang}
              onChange={setFolderFilter}
              options={visibleFolders.map((folder) => ({
                description: `${folder.count}件`,
                path: folder.path,
              }))}
              placeholder={t(lang, "library.filterAll")}
              value={folderFilter}
            />
            <label>
              <span>{t(lang, "library.sortLabel")}</span>
              <select
                aria-label={t(lang, "library.sortLabel")}
                onChange={(event) =>
                  changeSort(event.currentTarget.value as SortKey)
                }
                value={sortKey}
              >
                <option value="modified">
                  {t(lang, "library.sortNewest")}
                </option>
                <option value="created">
                  {t(lang, "library.sortCreated")}
                </option>
                <option value="title">{t(lang, "library.sortTitle")}</option>
                <option value="type">{t(lang, "library.sortType")}</option>
              </select>
            </label>
          </div>
        </section>

        <section
          aria-labelledby="react-library-results-title"
          className="react-library-results"
        >
          <div className="react-library-section-heading">
            <div>
              <Title id="react-library-results-title" order={2} size="h3">
                {t(
                  lang,
                  visibleItems.length === 1
                    ? "library.countOne"
                    : "library.count",
                  { count: `${visibleItems.length}` }
                )}
              </Title>
            </div>
            <Group className="react-library-result-actions" gap="xs">
              <SegmentedControl
                aria-label={t(lang, "library.scopeLabel")}
                data={[
                  {
                    label: t(lang, "library.activeContexts"),
                    value: "active",
                  },
                  {
                    label: t(lang, "library.archivedContexts"),
                    value: "archived",
                  },
                ]}
                onChange={(value) => {
                  setLibraryScope(value as LibraryScope);
                  setFolderFilter("all");
                }}
                value={libraryScope}
              />
              <SegmentedControl
                aria-label={t(lang, "library.browseMode")}
                data={[
                  { label: t(lang, "library.browseItems"), value: "items" },
                  { label: t(lang, "library.allTags"), value: "tags" },
                ]}
                onChange={(value) => changeBrowseMode(value as BrowseMode)}
                value={browseMode}
              />
              <div className="react-library-view-toggle">
                <IconButton
                  icon="card-view"
                  label={t(lang, "view.card")}
                  onClick={() => changeViewMode("card")}
                  pressed={viewMode === "card"}
                />
                <IconButton
                  icon="list-view"
                  label={t(lang, "view.list")}
                  onClick={() => changeViewMode("list")}
                  pressed={viewMode === "list"}
                />
              </div>
              <details
                className="react-library-folder-actions-menu"
                onKeyDown={(event) => {
                  if (event.key !== "Escape" || !event.currentTarget.open) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.open = false;
                  folderActionsTriggerRef.current?.focus();
                }}
                ref={folderActionsRef}
              >
                <summary
                  aria-label={t(lang, "library.folderManagement")}
                  className="react-library-folder-actions-trigger"
                  ref={folderActionsTriggerRef}
                  title={t(lang, "library.folderManagement")}
                >
                  <SeitonIcon name="folder" />
                  <span>{t(lang, "new.folder")}</span>
                  <SeitonIcon name="chevron-down" />
                </summary>
                <div className="react-library-folder-actions-panel">
                  <Button
                    disabled={!(onCreateFolder && onRenameFolder)}
                    onClick={() => {
                      closeFolderActionsMenu();
                      openFolderManager();
                    }}
                    type="button"
                    variant="subtle"
                  >
                    {t(lang, "library.folderManagement")}
                  </Button>
                  <Button
                    disabled={
                      libraryScope === "active"
                        ? !(onArchiveFolder && archiveableFolders.length > 0)
                        : !(
                            (onRestoreFolder && archiveMoves.length > 0) ||
                            (onArchiveFolder &&
                              archiveChoices.some(
                                (choice) => choice.kind === "legacy"
                              ))
                          )
                    }
                    onClick={() => {
                      closeFolderActionsMenu();
                      openArchiveDialog();
                    }}
                    type="button"
                    variant={libraryScope === "archived" ? "light" : "subtle"}
                  >
                    {t(
                      lang,
                      libraryScope === "active"
                        ? "library.archiveFolderAction"
                        : "library.restoreFolderAction"
                    )}
                  </Button>
                </div>
              </details>
              {hasFilters ? (
                <IconButton
                  icon="filter-clear"
                  label={t(lang, "search.clear")}
                  onClick={clearFilters}
                />
              ) : null}
            </Group>
          </div>

          {visibleItems.length === 0 ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="react-library-empty"
              initial={reduceMotion ? false : { opacity: 0 }}
              key="empty"
              role="status"
            >
              <strong>{t(lang, "search.noResults")}</strong>
              <span>{t(lang, "library.noResultsHint")}</span>
              <Button onClick={clearFilters} variant="default">
                {t(lang, "search.clear")}
              </Button>
            </motion.div>
          ) : browseMode === "tags" ? (
            <motion.div
              animate={{ opacity: 1 }}
              initial={reduceMotion ? false : { opacity: 0 }}
              key="tags"
            >
              <TagBrowse
                items={visibleItems}
                lang={lang}
                listFoldState={listFoldState}
                onArchiveItem={
                  onArchiveItem
                    ? (item) => {
                        setPendingNoteArchive(item);
                        setNoteArchiveError("");
                      }
                    : undefined
                }
                onMoveItem={onMoveItem ? openMoveDialog : undefined}
                onOpen={(item) =>
                  onOpen
                    ? void onOpen(item)
                    : announce(t(lang, "home.openItem", { title: item.title }))
                }
                onRestoreItem={
                  onRestoreItem ? (item) => void restoreNote(item) : undefined
                }
                onRestoreLegacyItem={
                  onRestoreLegacyItem
                    ? (item) => void restoreLegacyNote(item)
                    : undefined
                }
                onToggleListFold={toggleListFold}
                onTogglePin={togglePin}
                tagSort={tagSort}
              />
            </motion.div>
          ) : viewMode === "card" ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="react-library-card-grid"
              initial={reduceMotion ? false : { opacity: 0 }}
              key="cards"
            >
              {visibleItems.map((item) => (
                <LibraryCard
                  item={item}
                  key={item.id}
                  lang={lang}
                  onArchiveItem={
                    onArchiveItem
                      ? (selected) => {
                          setPendingNoteArchive(selected);
                          setNoteArchiveError("");
                        }
                      : undefined
                  }
                  onEditLists={openListEditor}
                  onMoveItem={onMoveItem ? openMoveDialog : undefined}
                  onOpen={(selected) =>
                    onOpen
                      ? void onOpen(selected)
                      : announce(
                          t(lang, "home.openItem", { title: selected.title })
                        )
                  }
                  onRestoreItem={
                    onRestoreItem
                      ? (selected) => void restoreNote(selected)
                      : undefined
                  }
                  onRestoreLegacyItem={
                    onRestoreLegacyItem
                      ? (selected) => void restoreLegacyNote(selected)
                      : undefined
                  }
                  onTogglePin={togglePin}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1 }}
              initial={reduceMotion ? false : { opacity: 0 }}
              key="list"
            >
              <LibraryList
                items={visibleItems}
                lang={lang}
                onArchiveItem={
                  onArchiveItem
                    ? (item) => {
                        setPendingNoteArchive(item);
                        setNoteArchiveError("");
                      }
                    : undefined
                }
                onEditLists={openListEditor}
                onMoveItem={onMoveItem ? openMoveDialog : undefined}
                onOpen={(item) =>
                  onOpen
                    ? void onOpen(item)
                    : announce(t(lang, "home.openItem", { title: item.title }))
                }
                onRestoreItem={
                  onRestoreItem ? (item) => void restoreNote(item) : undefined
                }
                onRestoreLegacyItem={
                  onRestoreLegacyItem
                    ? (item) => void restoreLegacyNote(item)
                    : undefined
                }
                onTogglePin={togglePin}
              />
            </motion.div>
          )}
        </section>
      </main>

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{
            "aria-label": t(lang, "notify.close"),
            disabled: savingArchiveAction,
          }}
          onClose={() => {
            if (savingArchiveAction) {
              return;
            }
            setArchiveDialogOpen(false);
            setArchiveDialogError("");
          }}
          opened={archiveDialogOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={folderActionsTriggerRef}
          title={t(
            lang,
            archiveDialogMode === "archive"
              ? "library.archiveFolderAction"
              : "library.restoreFolderAction"
          )}
        >
          <Stack className="react-library-archive-dialog" gap="md">
            {archiveDialogMode === "archive" && (
              <>
                <FolderTreePicker
                  emptyOption={{
                    label: t(lang, "library.selectParentFolder"),
                    value: "",
                  }}
                  label={t(lang, "library.archiveSelectFolder")}
                  lang={lang}
                  onChange={setSelectedArchiveFolder}
                  options={archiveableFolders.map((folder) => ({
                    path: folder.path,
                  }))}
                  placeholder={t(lang, "library.selectParentFolder")}
                  value={selectedArchiveFolder}
                />
                <div className="react-library-archive-paths">
                  <div>
                    <Text size="sm">{t(lang, "library.archiveSource")}</Text>
                    <Text>{selectedArchiveFolder || "—"}</Text>
                  </div>
                  <div>
                    <Text size="sm">
                      {t(lang, "library.archiveDestination")}
                    </Text>
                    <Text>
                      {archiveDestinationFor(selectedArchiveFolder) || "—"}
                    </Text>
                  </div>
                </div>
                <Text>{t(lang, "library.contextArchiveHint")}</Text>
              </>
            )}
            {archiveDialogMode === "restore" && archiveChoices.length === 0 && (
              <Text role="status">{t(lang, "library.archiveEmpty")}</Text>
            )}
            {archiveDialogMode === "restore" && archiveChoices.length > 0 && (
              <>
                <FolderTreePicker
                  label={t(lang, "library.restoreSelectFolder")}
                  lang={lang}
                  onChange={setSelectedArchiveChoice}
                  options={archiveChoices.map((choice) => ({
                    description:
                      choice.kind === "moved"
                        ? choice.move.originalPath
                        : t(lang, "library.legacyArchive"),
                    path:
                      choice.kind === "moved"
                        ? choice.move.archivedPath
                        : choice.path,
                    value: choice.key,
                  }))}
                  placeholder={t(lang, "library.restoreSelectFolder")}
                  value={selectedArchiveChoice}
                />
                <div className="react-library-archive-paths">
                  <div>
                    <Text size="sm">{t(lang, "library.archiveSource")}</Text>
                    <Text>
                      {selectedArchiveChoiceItem?.kind === "moved"
                        ? selectedArchiveChoiceItem.move.archivedPath
                        : (selectedArchiveChoiceItem?.path ?? "—")}
                    </Text>
                  </div>
                  <div>
                    <Text size="sm">
                      {t(lang, "library.archiveDestination")}
                    </Text>
                    <Text>
                      {selectedArchiveChoiceItem?.kind === "moved"
                        ? selectedArchiveChoiceItem.move.originalPath
                        : selectedArchiveChoiceItem?.kind === "legacy"
                          ? archiveDestinationFor(
                              selectedArchiveChoiceItem.path
                            ) || "—"
                          : "—"}
                    </Text>
                  </div>
                </div>
                <Text>
                  {t(
                    lang,
                    selectedArchiveChoiceItem?.kind === "legacy"
                      ? "library.contextArchiveHint"
                      : "library.contextRestoreHint"
                  )}
                </Text>
              </>
            )}
            {Boolean(archiveDialogError) && (
              <Alert color="red" role="alert">
                {archiveDialogError}
              </Alert>
            )}
            <Group justify="flex-end">
              {selectedArchiveChoiceItem?.kind === "legacy" && (
                <Button
                  disabled={savingArchiveAction || !onSetFolderArchived}
                  onClick={() => void clearLegacyArchive()}
                  variant="default"
                >
                  {t(lang, "library.clearLegacyArchive")}
                </Button>
              )}
              <Button
                disabled={savingArchiveAction}
                onClick={() => setArchiveDialogOpen(false)}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  savingArchiveAction ||
                  (archiveDialogMode === "archive" &&
                    !(onArchiveFolder && selectedArchiveFolder)) ||
                  (archiveDialogMode === "restore" &&
                    (!selectedArchiveChoiceItem ||
                      (selectedArchiveChoiceItem.kind === "moved" &&
                        !onRestoreFolder) ||
                      (selectedArchiveChoiceItem.kind === "legacy" &&
                        !onArchiveFolder)))
                }
                loading={savingArchiveAction}
                onClick={() => void submitArchiveAction()}
              >
                {t(
                  lang,
                  archiveDialogMode === "archive"
                    ? "library.archiveMoveConfirm"
                    : selectedArchiveChoiceItem?.kind === "legacy"
                      ? "library.moveLegacyArchive"
                      : "library.restoreMoveConfirm"
                )}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{
            "aria-label": t(lang, "notify.close"),
            disabled: savingNoteArchive,
          }}
          onClose={() => {
            if (savingNoteArchive) {
              return;
            }
            setPendingNoteArchive(null);
            setNoteArchiveError("");
          }}
          opened={Boolean(pendingNoteArchive)}
          portalProps={{ target: portalTarget }}
          title={t(lang, "library.archiveItem")}
        >
          <Stack className="react-library-archive-dialog" gap="md">
            <div className="react-library-archive-paths">
              <div>
                <Text size="sm">{t(lang, "library.archiveSource")}</Text>
                <Text>{pendingNoteArchive?.path ?? "—"}</Text>
              </div>
              <div>
                <Text size="sm">{t(lang, "library.archiveDestination")}</Text>
                <Text>
                  {pendingNoteArchive
                    ? noteArchiveDestinationFor(pendingNoteArchive)
                    : "—"}
                </Text>
              </div>
            </div>
            <Text>{t(lang, "library.noteArchiveHint")}</Text>
            {Boolean(noteArchiveError) && (
              <Alert color="red" role="alert">
                {noteArchiveError}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                disabled={savingNoteArchive}
                onClick={() => setPendingNoteArchive(null)}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  savingNoteArchive || !pendingNoteArchive || !onArchiveItem
                }
                loading={savingNoteArchive}
                onClick={() => void confirmNoteArchive()}
              >
                {t(lang, "library.archiveMoveConfirm")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{
            "aria-label": t(lang, "notify.close"),
            disabled: savingFolderAction,
          }}
          onClose={() => {
            if (savingFolderAction) {
              return;
            }
            setFolderManagerOpen(false);
            setFolderActionError(false);
          }}
          opened={folderManagerOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={folderActionsTriggerRef}
          title={t(lang, "library.folderManagement")}
        >
          <Stack className="react-library-folder-manager" gap="md">
            <FolderTreePicker
              emptyOption={{
                label: t(lang, "library.filterAll"),
                value: "",
              }}
              label={t(lang, "library.column.folder")}
              lang={lang}
              onChange={setManagedFolderPath}
              options={manageableFolders.map((folder) => ({
                path: folder.path,
              }))}
              placeholder={t(lang, "library.filterAll")}
              value={managedFolderPath}
            />
            <Group className="react-library-folder-actions" gap="xs">
              <Button
                aria-pressed={folderAction === "create"}
                onClick={() => {
                  setFolderAction("create");
                  setFolderName("");
                  setFolderActionError(false);
                  if (
                    parentFolderOptions.some(
                      (folder) => folder.path === managedFolderPath
                    )
                  ) {
                    setParentFolderPath(managedFolderPath);
                  }
                }}
                variant={folderAction === "create" ? "light" : "default"}
              >
                {t(lang, "action.create")}
              </Button>
              <Button
                aria-pressed={folderAction === "rename"}
                disabled={!managedFolderPath || managedFolderProtected}
                onClick={() => {
                  setFolderAction("rename");
                  setFolderName(managedFolderPath.split("/").at(-1) ?? "");
                  setFolderActionError(false);
                }}
                variant={folderAction === "rename" ? "light" : "default"}
              >
                {t(lang, "action.rename")}
              </Button>
            </Group>
            {folderAction === "create" && (
              <FolderTreePicker
                emptyOption={{
                  label: t(lang, "library.selectParentFolder"),
                  value: "",
                }}
                label={t(lang, "library.parentFolder")}
                lang={lang}
                onChange={setParentFolderPath}
                options={parentFolderOptions.map((folder) => ({
                  path: folder.path,
                }))}
                placeholder={t(lang, "library.selectParentFolder")}
                value={parentFolderPath}
              />
            )}
            {(folderAction === "create" || folderAction === "rename") && (
              <TextInput
                autoFocus
                label={t(lang, "library.folderName")}
                onChange={(event) => {
                  setFolderName(event.currentTarget.value);
                  setFolderActionError(false);
                }}
                value={folderName}
              />
            )}
            {Boolean(folderActionError) && (
              <Alert color="red" role="alert">
                {t(lang, "library.folderFailed")}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                disabled={savingFolderAction}
                onClick={() => setFolderManagerOpen(false)}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  savingFolderAction ||
                  (folderAction === "create" &&
                    !(parentFolderPath && folderName.trim())) ||
                  (folderAction === "rename" &&
                    !(managedFolderPath && folderName.trim()))
                }
                loading={savingFolderAction}
                onClick={() => void submitFolderAction()}
              >
                {t(
                  lang,
                  folderAction === "create" ? "action.create" : "action.rename"
                )}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{
            "aria-label": t(lang, "notify.close"),
            disabled: savingMove,
          }}
          onClose={() => {
            if (savingMove) {
              return;
            }
            setMovingItem(null);
            setMoveError(false);
          }}
          opened={Boolean(movingItem)}
          portalProps={{ target: portalTarget }}
          title={t(lang, "library.moveItem")}
        >
          <Stack gap="md">
            <Text>{movingItem?.title}</Text>
            <FolderTreePicker
              label={t(lang, "library.moveItem")}
              lang={lang}
              onChange={setMoveDestination}
              options={availableMoveFolders.map((folder) => ({
                path: folder.path,
              }))}
              placeholder={t(lang, "library.selectParentFolder")}
              value={moveDestination}
            />
            {Boolean(moveError) && (
              <Alert color="red" role="alert">
                {t(lang, "library.folderFailed")}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                disabled={savingMove}
                onClick={() => setMovingItem(null)}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  savingMove ||
                  !moveDestination ||
                  availableMoveFolders.length === 0
                }
                loading={savingMove}
                onClick={() => void submitMove()}
              >
                {t(lang, "library.moveItem")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
          onClose={() => {
            setListEditorItem(null);
            setListUpdateError(false);
          }}
          opened={Boolean(listEditorItem)}
          portalProps={{ target: portalTarget }}
          returnFocusRef={listEditorTriggerRef}
          title={t(lang, "action.addToList")}
        >
          <Stack gap="md">
            <Text>{listEditorItem?.title}</Text>
            {lists.length > 0 ? (
              <div className="react-library-list-picker">
                {lists.map((list) => (
                  <Checkbox
                    checked={selectedLists.includes(list)}
                    key={list}
                    label={list}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setListUpdateError(false);
                      setSelectedLists((current) =>
                        checked
                          ? [...new Set([...current, list])]
                          : current.filter((value) => value !== list)
                      );
                    }}
                  />
                ))}
              </div>
            ) : (
              <Text>{t(lang, "library.noListsHint")}</Text>
            )}
            {Boolean(listUpdateError) && (
              <Alert color="red" role="alert">
                {t(lang, "library.listUpdateFailed")}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                onClick={() => {
                  setListEditorItem(null);
                  setListUpdateError(false);
                }}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={savingLists || lists.length === 0}
                loading={savingLists}
                onClick={() => void saveLists()}
              >
                {t(lang, "action.save")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      <AnimatePresence initial={false}>
        {Boolean(feedback) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-library-feedback"
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            role="status"
          >
            <Alert
              closeButtonLabel={t(lang, "notify.close")}
              color="accent"
              onClose={() => setFeedback("")}
              variant="light"
              withCloseButton
            >
              {feedback}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="react-library-footer">
        <Text className="react-library-muted" size="xs">
          保存先フォルダで場所を絞り込み、タグでフォルダをまたいで再発見できます。
        </Text>
      </footer>
    </div>
  );
}

function PrototypeApp({
  lang = "ja",
  items = LIBRARY_ITEMS,
  folderPaths,
  archivedFolders,
  archiveFolderMoves,
  rootFolder,
  protectedFolderPaths,
  manageableFolderRoots,
  availableLists,
  initialBrowseMode,
  initialList,
  initialListFoldState,
  initialSort,
  initialTagSort,
  initialViewMode,
  onOpen,
  onSettingsChange,
  onSetLists,
  onTogglePin,
  onCreateFolder,
  onRenameFolder,
  onSetFolderArchived,
  onArchiveFolder,
  onArchiveItem,
  onRestoreFolder,
  onRestoreItem,
  onRestoreLegacyItem,
  onMoveItem,
}: {
  lang?: Lang;
  items?: LibraryItem[];
  folderPaths?: string[];
  archivedFolders?: string[];
  archiveFolderMoves?: ArchiveFolderMove[];
  rootFolder?: string;
  protectedFolderPaths?: string[];
  manageableFolderRoots?: string[];
  availableLists?: string[];
  initialBrowseMode?: BrowseMode;
  initialList?: string;
  initialListFoldState?: Record<string, boolean>;
  initialSort?: SortKey;
  initialTagSort?: TagSort;
  initialViewMode?: ViewMode;
  onOpen?: (item: LibraryItem) => void | Promise<void>;
  onSettingsChange?: (settings: LibrarySettings) => void | Promise<void>;
  onSetLists?: (item: LibraryItem, lists: string[]) => void | Promise<void>;
  onTogglePin?: (item: LibraryItem) => void | Promise<void>;
  onCreateFolder?: (parentPath: string, name: string) => Promise<string>;
  onRenameFolder?: (path: string, name: string) => Promise<string>;
  onArchiveFolder?: (path: string) => Promise<ArchiveFolderMove>;
  onArchiveItem?: (item: LibraryItem) => Promise<ArchiveNoteMove>;
  onRestoreFolder?: (archivedPath: string) => Promise<string>;
  onRestoreItem?: (archivedPath: string) => Promise<string>;
  onRestoreLegacyItem?: (path: string) => Promise<void>;
  onSetFolderArchived?: (path: string, archived: boolean) => Promise<void>;
  onMoveItem?: (
    item: LibraryItem,
    destinationFolder: string
  ) => Promise<string>;
}) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactLibrarySurface
        archivedFolders={archivedFolders}
        archiveFolderMoves={archiveFolderMoves}
        availableLists={availableLists}
        folderPaths={folderPaths}
        initialBrowseMode={initialBrowseMode}
        initialList={initialList}
        initialListFoldState={initialListFoldState}
        initialSort={initialSort}
        initialTagSort={initialTagSort}
        initialViewMode={initialViewMode}
        items={items}
        lang={lang}
        manageableFolderRoots={manageableFolderRoots}
        onArchiveFolder={onArchiveFolder}
        onArchiveItem={onArchiveItem}
        onCreateFolder={onCreateFolder}
        onMoveItem={onMoveItem}
        onOpen={onOpen}
        onRenameFolder={onRenameFolder}
        onRestoreFolder={onRestoreFolder}
        onRestoreItem={onRestoreItem}
        onRestoreLegacyItem={onRestoreLegacyItem}
        onSetFolderArchived={onSetFolderArchived}
        onSetLists={onSetLists}
        onSettingsChange={onSettingsChange}
        onTogglePin={onTogglePin}
        protectedFolderPaths={protectedFolderPaths}
        rootFolder={rootFolder}
        scheme={scheme}
      />
    </SeitonUIProvider>
  );
}

export function mountReactLibraryPrototype(
  root: HTMLElement,
  options: {
    lang?: Lang;
    items?: LibraryItem[];
    folderPaths?: string[];
    archivedFolders?: string[];
    archiveFolderMoves?: ArchiveFolderMove[];
    rootFolder?: string;
    protectedFolderPaths?: string[];
    manageableFolderRoots?: string[];
    availableLists?: string[];
    initialBrowseMode?: BrowseMode;
    initialList?: string;
    initialListFoldState?: Record<string, boolean>;
    initialSort?: SortKey;
    initialTagSort?: TagSort;
    initialViewMode?: ViewMode;
    onOpen?: (item: LibraryItem) => void | Promise<void>;
    onSettingsChange?: (settings: LibrarySettings) => void | Promise<void>;
    onSetLists?: (item: LibraryItem, lists: string[]) => void | Promise<void>;
    onTogglePin?: (item: LibraryItem) => void | Promise<void>;
    onCreateFolder?: (parentPath: string, name: string) => Promise<string>;
    onRenameFolder?: (path: string, name: string) => Promise<string>;
    onArchiveFolder?: (path: string) => Promise<ArchiveFolderMove>;
    onArchiveItem?: (item: LibraryItem) => Promise<ArchiveNoteMove>;
    onRestoreFolder?: (archivedPath: string) => Promise<string>;
    onRestoreItem?: (archivedPath: string) => Promise<string>;
    onRestoreLegacyItem?: (path: string) => Promise<void>;
    onSetFolderArchived?: (path: string, archived: boolean) => Promise<void>;
    onMoveItem?: (
      item: LibraryItem,
      destinationFolder: string
    ) => Promise<string>;
  } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      archivedFolders={options.archivedFolders}
      archiveFolderMoves={options.archiveFolderMoves}
      availableLists={options.availableLists}
      folderPaths={options.folderPaths}
      initialBrowseMode={options.initialBrowseMode}
      initialList={options.initialList}
      initialListFoldState={options.initialListFoldState}
      initialSort={options.initialSort}
      initialTagSort={options.initialTagSort}
      initialViewMode={options.initialViewMode}
      items={options.items}
      lang={options.lang}
      manageableFolderRoots={options.manageableFolderRoots}
      onArchiveFolder={options.onArchiveFolder}
      onArchiveItem={options.onArchiveItem}
      onCreateFolder={options.onCreateFolder}
      onMoveItem={options.onMoveItem}
      onOpen={options.onOpen}
      onRenameFolder={options.onRenameFolder}
      onRestoreFolder={options.onRestoreFolder}
      onRestoreItem={options.onRestoreItem}
      onRestoreLegacyItem={options.onRestoreLegacyItem}
      onSetFolderArchived={options.onSetFolderArchived}
      onSetLists={options.onSetLists}
      onSettingsChange={options.onSettingsChange}
      onTogglePin={options.onTogglePin}
      protectedFolderPaths={options.protectedFolderPaths}
      rootFolder={options.rootFolder}
    />
  );
  return () => reactRoot.unmount();
}
