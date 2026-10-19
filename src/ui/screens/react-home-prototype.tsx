/** @jsxImportSource react */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ITEM_TYPES } from "../../shared/constants";
import {
  type CreateTypeSections,
  type CreateTypeSettings,
  getCreateTypeSections,
} from "../../shared/createTypes";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import type {
  CreatePreset,
  FeatureModules,
  ItemType,
  ShortcutKind,
} from "../../shared/types";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { FolderTreePicker } from "../patterns/FolderTreePicker";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  IconButton,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";
import { CreatePresetManager } from "./react-create-prototype";

export interface HomeEntry {
  description: string;
  id: string;
  title: string;
}

export type HomeSectionId =
  | "capture"
  | "entries"
  | "shortcuts"
  | "inbox"
  | "secondary";
export interface HomeShortcut {
  group?: string;
  id: string;
  initial: string;
  kind?: ShortcutKind;
  meta?: string;
  target?: string;
  title: string;
}

export interface HomeVaultTarget {
  kind: "file" | "folder";
  path: string;
  title: string;
}

export interface HomeInboxItem {
  date: string;
  id: string;
  path?: string;
  tags: string;
  title: string;
  type: string;
}
export interface HomeList {
  count: number;
  name: string;
}

const ITEM_TYPE_MESSAGE_KEYS: Record<ItemType, MessageKey> = {
  article: "type.article",
  class: "type.class",
  collection: "type.collection",
  idea: "type.idea",
  memo: "type.memo",
  profile: "type.profile",
  project: "type.project",
  reading: "type.reading",
  task: "type.task",
  webclip: "type.webclip",
};

const ITEM_TYPE_PURPOSE_KEYS: Record<ItemType, MessageKey> = {
  article: "new.typePurpose.article",
  class: "new.typePurpose.class",
  collection: "new.typePurpose.collection",
  idea: "new.typePurpose.idea",
  memo: "new.typePurpose.memo",
  profile: "new.typePurpose.profile",
  project: "new.typePurpose.project",
  reading: "new.typePurpose.reading",
  task: "new.typePurpose.task",
  webclip: "new.typePurpose.webclip",
};

const SHORTCUT_KIND_MESSAGE_KEYS: Record<ShortcutKind, MessageKey> = {
  command: "shortcut.kind.command",
  folder: "shortcut.kind.folder",
  note: "shortcut.kind.note",
  url: "shortcut.kind.url",
  view: "shortcut.kind.view",
};

type CreateCatalogFilter = "all" | "preset" | "type";
type CreateCatalogSort = "name" | "priority" | "recent";
type CreateCatalogDensity = "grid" | "list";

type CreateCatalogItem =
  | {
      id: string;
      kind: "preset";
      label: string;
      preset: CreatePreset;
      priority: number;
      subtitle: string;
    }
  | {
      id: string;
      kind: "type";
      label: string;
      priority: number;
      subtitle: string;
      type: ItemType;
    };

function itemTypeLabel(lang: Lang, type: ItemType): string {
  return t(lang, ITEM_TYPE_MESSAGE_KEYS[type]);
}

function buildCreateCatalogItems(
  lang: Lang,
  sections: CreateTypeSections,
  presets: readonly CreatePreset[]
): CreateCatalogItem[] {
  const items: CreateCatalogItem[] = presets.map((preset, index) => ({
    id: `preset:${preset.id}`,
    kind: "preset",
    label: preset.label,
    preset,
    priority: index,
    subtitle: [
      preset.subfolder || t(lang, "common.default"),
      preset.tags.length > 0
        ? preset.tags.map((tag) => `#${tag}`).join(" ")
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  const groups: { offset: number; types: ItemType[] }[] = [
    { offset: presets.length, types: sections.pinned },
    {
      offset: presets.length + sections.pinned.length,
      types: sections.recent,
    },
    {
      offset: presets.length + sections.pinned.length + sections.recent.length,
      types: sections.all,
    },
  ];

  for (const group of groups) {
    for (const [index, type] of group.types.entries()) {
      items.push({
        id: `type:${type}`,
        kind: "type",
        label: itemTypeLabel(lang, type),
        priority: group.offset + index,
        subtitle: t(lang, ITEM_TYPE_PURPOSE_KEYS[type]),
        type,
      });
    }
  }

  return items;
}

type HomeEntryDefinition = {
  descriptionKey: MessageKey;
  id: string;
  titleKey: MessageKey;
};

const HOME_ENTRIES: HomeEntryDefinition[] = [
  {
    descriptionKey: "home.entry.searchDescription",
    id: "search",
    titleKey: "search.title",
  },
  {
    descriptionKey: "home.entry.libraryDescription",
    id: "library",
    titleKey: "library.title",
  },
  {
    descriptionKey: "home.entry.organizeDescription",
    id: "organize",
    titleKey: "organize.title",
  },
  {
    descriptionKey: "home.entry.memoDescription",
    id: "memo",
    titleKey: "memoReview.title",
  },
  {
    descriptionKey: "home.entry.bookshelfDescription",
    id: "bookshelf",
    titleKey: "book.rackTitle",
  },
];

const HOME_SECTION_META: Record<
  HomeSectionId,
  { detailKey: MessageKey; labelKey: MessageKey }
> = {
  capture: {
    detailKey: "home.section.captureDetail",
    labelKey: "settings.module.memos",
  },
  entries: {
    detailKey: "home.section.entriesDetail",
    labelKey: "home.primary",
  },
  inbox: {
    detailKey: "home.section.inboxDetail",
    labelKey: "inbox.section",
  },
  secondary: {
    detailKey: "home.section.secondaryDetail",
    labelKey: "home.pinnedAndLists",
  },
  shortcuts: {
    detailKey: "home.section.shortcutsDetail",
    labelKey: "home.shortcuts",
  },
};

const INITIAL_HOME_SECTION_ORDER: HomeSectionId[] = [
  "capture",
  "entries",
  "shortcuts",
  "inbox",
  "secondary",
];

const SHORTCUTS: HomeShortcut[] = [
  {
    group: "",
    id: "design",
    initial: "D",
    kind: "note",
    title: "デザインシステム入門",
  },
  {
    group: "",
    id: "weekly",
    initial: "週",
    kind: "view",
    title: "今週の振り返り",
  },
  {
    group: "",
    id: "github",
    initial: "G",
    kind: "url",
    target: "https://github.com/",
    title: "GitHub",
  },
  {
    group: "",
    id: "tasks",
    initial: "T",
    kind: "note",
    title: "今日のタスク",
  },
];

const INBOX_ITEMS: HomeInboxItem[] = [
  {
    date: "2026.08.26",
    id: "readme",
    tags: "#開発",
    title: "READMEにデモGIFを追加",
    type: "タスク",
  },
  {
    date: "2026.08.25",
    id: "reading",
    tags: "#生活",
    title: "情報は眼により章立てメモ",
    type: "読書",
  },
  {
    date: "2026.08.24",
    id: "learning",
    tags: "#学び",
    title: "深層学習の最新動向メモ",
    type: "クリップ",
  },
];

const PINNED_ITEMS: HomeInboxItem[] = [
  {
    date: "2026.08.26",
    id: "pinned-design",
    tags: "#設計",
    title: "Seitonの今後の設計",
    type: "article",
  },
  {
    date: "2026.08.25",
    id: "pinned-search",
    tags: "#開発",
    title: "検索の読み正規化バグ修正",
    type: "タスク",
  },
  {
    date: "2026.08.24",
    id: "pinned-reading",
    tags: "#読書",
    title: "読書記録の見直し",
    type: "読書",
  },
];

const HOME_LISTS: HomeList[] = [
  { count: 18, name: "お気に入り" },
  { count: 6, name: "今週見る" },
  { count: 12, name: "読書メモ" },
];

function homeItemTypeLabel(lang: Lang, type: string): string {
  const key = ITEM_TYPE_MESSAGE_KEYS[type as ItemType];
  return key ? t(lang, key) : type;
}

function shortcutMetaLabel(lang: Lang, shortcut: HomeShortcut): string {
  const messageKey = shortcut.kind
    ? SHORTCUT_KIND_MESSAGE_KEYS[shortcut.kind]
    : undefined;
  return messageKey ? t(lang, messageKey) : (shortcut.meta ?? "");
}

function homeItemCount(lang: Lang, count: number): string {
  return t(lang, count === 1 ? "home.itemCountOne" : "home.itemCountMany", {
    count: String(count),
  });
}

function HomeEntryButton({
  entry,
  lang,
  onSelect,
}: {
  entry: HomeEntry;
  lang: Lang;
  onSelect: (entry: HomeEntry) => void;
}) {
  return (
    <Card
      className="react-home-entry"
      component="button"
      data-destination={entry.id}
      onClick={() => onSelect(entry)}
      padding="md"
      radius="lg"
      type="button"
      withBorder
    >
      <span className="react-home-entry-title-slot">
        <strong>{entry.title}</strong>
      </span>
      <span className="react-home-entry-description-slot">
        {entry.description}
      </span>
      <span className="react-home-entry-action">
        {t(lang, "action.open")} <span aria-hidden="true">→</span>
      </span>
    </Card>
  );
}

function CreateTypeOption({
  lang = "ja",
  type,
  onSelect,
}: {
  lang?: Lang;
  type: ItemType;
  onSelect: (type: ItemType) => void;
}) {
  return (
    <Card
      className="react-home-create-type-option"
      component="button"
      data-create-catalog-kind="type"
      data-create-type={type}
      onClick={() => onSelect(type)}
      padding="md"
      radius="md"
      type="button"
      withBorder
    >
      <span className="react-home-create-type-option-content">
        <strong>{itemTypeLabel(lang, type)}</strong>
        <span className="react-home-create-type-option-kind">
          {t(lang, "new.catalogTypeBadge")}
        </span>
        <span className="react-home-create-type-option-hint">
          {t(lang, ITEM_TYPE_PURPOSE_KEYS[type])}
        </span>
      </span>
    </Card>
  );
}

function CreatePresetOption({
  focusEdit,
  lang = "ja",
  onEdit,
  onSelect,
  preset,
}: {
  focusEdit?: boolean;
  lang?: Lang;
  onEdit: (preset: CreatePreset) => void;
  onSelect: (preset: CreatePreset) => void;
  preset: CreatePreset;
}) {
  return (
    <Card
      aria-label={`${preset.label}（${itemTypeLabel(lang, preset.type)}）`}
      className="react-home-create-preset-option"
      data-create-catalog-kind="preset"
      padding="sm"
      radius="md"
      withBorder
    >
      <Button
        aria-label={`${preset.label}: ${t(lang, "new.presetUse")}`}
        className="react-home-create-preset-open"
        data-create-preset={preset.id}
        onClick={() => onSelect(preset)}
        type="button"
        variant="subtle"
      >
        <span className="react-home-create-preset-main">
          <strong>{preset.label}</strong>
          <span className="react-home-create-preset-kind">
            {t(lang, "new.catalogPresetBadge")}
          </span>
        </span>
        <span className="react-home-create-preset-location">
          {preset.subfolder || t(lang, "new.presetRootFolder")}
        </span>
        {preset.tags.length > 0 && (
          <span className="react-home-create-preset-tags">
            {preset.tags.map((tag) => `#${tag}`).join(" ")}
          </span>
        )}
      </Button>
      <Button
        aria-label={`${preset.label}: ${t(lang, "new.presetEdit")}`}
        className="react-home-create-preset-edit"
        data-edit-create-preset={preset.id}
        data-seiton-autofocus={focusEdit ? "" : undefined}
        onClick={() => onEdit(preset)}
        size="xs"
        type="button"
        variant="default"
      >
        <span aria-hidden="true">•••</span>
      </Button>
    </Card>
  );
}

function CreatePresetAddOption({
  focusOnReturn,
  lang = "ja",
  onSelect,
}: {
  focusOnReturn?: boolean;
  lang?: Lang;
  onSelect: () => void;
}) {
  return (
    <Card
      aria-label={t(lang, "new.presetAdd")}
      className="react-home-create-preset-add-option"
      component="button"
      data-create-catalog-kind="add"
      data-seiton-autofocus={focusOnReturn ? "" : undefined}
      onClick={onSelect}
      padding="md"
      radius="md"
      type="button"
      withBorder
    >
      <span aria-hidden="true" className="react-home-create-preset-add-icon">
        ＋
      </span>
      <strong>{t(lang, "new.presetAdd")}</strong>
    </Card>
  );
}

function shortcutFaviconUrl(shortcut: HomeShortcut): string | undefined {
  if (shortcut.kind !== "url" || !shortcut.target) {
    return undefined;
  }
  try {
    const url = new URL(shortcut.target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      Boolean(url.hostname) &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}

function ShortcutIcon({ shortcut }: { shortcut: HomeShortcut }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const faviconUrl = shortcutFaviconUrl(shortcut);

  return (
    <span aria-hidden="true" className="react-home-shortcut-icon">
      {faviconUrl && !faviconFailed ? (
        <img
          alt=""
          draggable={false}
          height="44"
          onError={() => setFaviconFailed(true)}
          src={faviconUrl}
          width="44"
        />
      ) : (
        shortcut.initial
      )}
    </span>
  );
}

function reorderIds(
  current: string[],
  draggedId: string,
  targetId: string
): string[] {
  if (draggedId === targetId) {
    return current;
  }
  const from = current.indexOf(draggedId);
  const to = current.indexOf(targetId);
  if (from < 0 || to < 0) {
    return current;
  }
  const next = [...current];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

function shortcutsInOrder(
  items: HomeShortcut[],
  order: string[]
): HomeShortcut[] {
  return order.flatMap((id) => {
    const shortcut = items.find((item) => item.id === id);
    return shortcut ? [shortcut] : [];
  });
}

export function ReactHomeSurface({
  scheme,
  lang = "ja",
  shortcuts = SHORTCUTS,
  inboxItems = INBOX_ITEMS,
  pinnedItems = PINNED_ITEMS,
  lists = HOME_LISTS,
  memoTagOptions = [],
  shortcutGroups = [],
  vaultTargets = [],
  initialSectionOrder = INITIAL_HOME_SECTION_ORDER,
  initialHiddenSections = [],
  createTypes = [...ITEM_TYPES],
  createTypeSettings,
  createTypeFolders = {},
  pinnedCreatePresets = [],
  modules,
  onSaveMemo,
  onSelectCreateType,
  onDeleteCreatePreset,
  onSaveCreatePreset,
  onAddShortcut,
  onAddShortcutFolder,
  onOpenShortcut,
  onOpenEntry,
  onOpenInbox,
  onOpenInboxItem,
  onOpenSecondaryItem,
  onTogglePin,
  onOpenList,
  onCreateList,
  onSaveOrder,
}: {
  scheme: ColorScheme;
  lang?: Lang;
  shortcuts?: HomeShortcut[];
  inboxItems?: HomeInboxItem[];
  pinnedItems?: HomeInboxItem[];
  lists?: HomeList[];
  memoTagOptions?: string[];
  shortcutGroups?: string[];
  vaultTargets?: HomeVaultTarget[];
  initialSectionOrder?: HomeSectionId[];
  initialHiddenSections?: HomeSectionId[];
  createTypes?: ItemType[];
  createTypeSettings?: CreateTypeSettings;
  createTypeFolders?: Partial<Record<ItemType, string>>;
  modules?: Pick<FeatureModules, "bookshelf" | "memos">;
  pinnedCreatePresets?: readonly CreatePreset[];
  onSaveMemo?: (text: string, tags: string[]) => void | Promise<void>;
  onSelectCreateType?: (
    type: ItemType,
    presetId?: string
  ) => void | Promise<void>;
  onDeleteCreatePreset?: (presetId: string) => void | Promise<void>;
  onSaveCreatePreset?: (preset: CreatePreset) => void | Promise<void>;
  onAddShortcut?: (
    title: string,
    target: string,
    group?: string,
    kind?: ShortcutKind
  ) => void | Promise<void>;
  onAddShortcutFolder?: (name: string) => void | Promise<void>;
  onOpenShortcut?: (shortcut: HomeShortcut) => void | Promise<void>;
  onOpenEntry?: (entry: HomeEntry) => void | Promise<void>;
  onOpenInbox?: () => void | Promise<void>;
  onOpenInboxItem?: (item: HomeInboxItem) => void | Promise<void>;
  onOpenSecondaryItem?: (item: HomeInboxItem) => void | Promise<void>;
  onTogglePin?: (item: HomeInboxItem, pinned: boolean) => void | Promise<void>;
  onOpenList?: (list: HomeList) => void | Promise<void>;
  onCreateList?: (name: string) => void | Promise<void>;
  onSaveOrder?: (
    sectionOrder: HomeSectionId[],
    shortcuts: HomeShortcut[],
    hiddenSections: HomeSectionId[]
  ) => void | Promise<void>;
}) {
  const uiLang = lang;
  const rootRef = useRef<HTMLDivElement>(null);
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [memoText, setMemoText] = useState("");
  const [selectedMemoTags, setSelectedMemoTags] = useState<string[]>([]);
  const [memoSaveError, setMemoSaveError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<HomeEntry | null>(null);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemPanel, setNewItemPanel] = useState<"types" | "presets">(
    "types"
  );
  const [createCatalogFilter, setCreateCatalogFilter] =
    useState<CreateCatalogFilter>("all");
  const [createCatalogQuery, setCreateCatalogQuery] = useState("");
  const [createCatalogSort, setCreateCatalogSort] =
    useState<CreateCatalogSort>("priority");
  const [createCatalogDensity, setCreateCatalogDensity] =
    useState<CreateCatalogDensity>("grid");
  const [recentCreateIds, setRecentCreateIds] = useState<string[]>([]);
  const [createPresetEditorId, setCreatePresetEditorId] = useState<
    string | null
  >(null);
  const [createPresetReturnTarget, setCreatePresetReturnTarget] = useState<
    { kind: "add" } | { kind: "edit"; presetId: string } | null
  >(null);
  const [createModalOffset, setCreateModalOffset] = useState(0);
  const [createModalMaxHeight, setCreateModalMaxHeight] = useState<
    number | null
  >(null);
  const createModalAnchorTopRef = useRef<number | null>(null);
  const createModalContentRef = useRef<HTMLDivElement | null>(null);
  const newItemTriggerRef = useRef<HTMLButtonElement | null>(null);
  const listTriggerRef = useRef<HTMLButtonElement | null>(null);
  const listNameInputRef = useRef<HTMLInputElement | null>(null);
  const orderTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shortcutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shortcutEditOpenRef = useRef(false);
  const homeOrderSaveVersionRef = useRef(0);
  const [listEditorOpen, setListEditorOpen] = useState(false);
  const [orderEditorOpen, setOrderEditorOpen] = useState(false);
  const [shortcutAddOpen, setShortcutAddOpen] = useState(false);
  const [shortcutEditOpen, setShortcutEditOpen] = useState(false);
  const [shortcutAddMode, setShortcutAddMode] = useState<
    "link" | "seiton" | "folder"
  >("link");
  const [vaultTargetKind, setVaultTargetKind] = useState<"file" | "folder">(
    "file"
  );
  const [newVaultTarget, setNewVaultTarget] = useState("");
  const [shortcutGroupOpen, setShortcutGroupOpen] = useState<string | null>(
    null
  );
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(
    null
  );
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [shortcutItems, setShortcutItems] = useState<HomeShortcut[]>(shortcuts);
  const [homePinnedItems, setHomePinnedItems] =
    useState<HomeInboxItem[]>(pinnedItems);
  const [newShortcutGroup, setNewShortcutGroup] = useState("");
  const [newShortcutTitle, setNewShortcutTitle] = useState("");
  const [newShortcutUrl, setNewShortcutUrl] = useState("");
  const [shortcutUrlTouched, setShortcutUrlTouched] = useState(false);
  const [homeLists, setHomeLists] = useState<HomeList[]>(lists);
  const [sectionOrder, setSectionOrder] =
    useState<HomeSectionId[]>(initialSectionOrder);
  const [hiddenSections, setHiddenSections] = useState<HomeSectionId[]>(
    initialHiddenSections
  );

  useEffect(() => {
    setHomePinnedItems(pinnedItems);
  }, [pinnedItems]);
  const [shortcutOrder, setShortcutOrder] = useState(
    shortcuts.map((shortcut) => shortcut.id)
  );
  const [orderEditorShortcutItems, setOrderEditorShortcutItems] =
    useState<HomeShortcut[]>(shortcuts);
  const [orderEditorShortcutOrder, setOrderEditorShortcutOrder] = useState(
    shortcuts.map((shortcut) => shortcut.id)
  );
  const [shortcutOrderFocusTarget, setShortcutOrderFocusTarget] = useState<
    string | null
  >(null);
  const [draggedSection, setDraggedSection] = useState<HomeSectionId | null>(
    null
  );
  const [draggedShortcut, setDraggedShortcut] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [listNameError, setListNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [homeCreatePresets, setHomeCreatePresets] = useState<CreatePreset[]>(
    () => [...pinnedCreatePresets]
  );
  const [homeShortcutGroups, setHomeShortcutGroups] =
    useState<string[]>(shortcutGroups);
  const shortcutGroupRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const createTypeSections = getCreateTypeSections(
    createTypeSettings ?? {
      enabledTypes: createTypes,
      modules: { memos: true },
      pinnedTypes: ["idea", "task", "article"],
      recentTypes: [],
      typeOrder: createTypes,
    }
  );
  const createCatalogItems = buildCreateCatalogItems(
    uiLang,
    createTypeSections,
    homeCreatePresets
  );
  const shortcutUrlInvalid =
    shortcutUrlTouched &&
    newShortcutUrl.trim().length > 0 &&
    !isWebUrl(newShortcutUrl);
  const normalizedCreateCatalogQuery = createCatalogQuery
    .trim()
    .toLocaleLowerCase();
  const visibleCreateCatalogItems = createCatalogItems
    .filter(
      (item) =>
        createCatalogFilter === "all" || item.kind === createCatalogFilter
    )
    .filter((item) => {
      if (!normalizedCreateCatalogQuery) {
        return true;
      }
      const kindLabel =
        item.kind === "type"
          ? t(uiLang, "new.catalogTypeBadge")
          : t(uiLang, "new.catalogPresetBadge");
      return `${item.label} ${item.subtitle} ${kindLabel}`
        .toLocaleLowerCase()
        .includes(normalizedCreateCatalogQuery);
    })
    .sort((left, right) => {
      if (createCatalogSort === "name") {
        return left.label.localeCompare(right.label, uiLang);
      }
      if (createCatalogSort === "recent") {
        const leftRecent = recentCreateIds.indexOf(left.id);
        const rightRecent = recentCreateIds.indexOf(right.id);
        const leftRank = leftRecent < 0 ? Number.MAX_SAFE_INTEGER : leftRecent;
        const rightRank =
          rightRecent < 0 ? Number.MAX_SAFE_INTEGER : rightRecent;
        return leftRank - rightRank || left.priority - right.priority;
      }
      return left.priority - right.priority;
    });

  useEffect(() => {
    if (rootRef.current) {
      setPortalTarget(rootRef.current);
    }
  }, []);

  useEffect(() => {
    setShortcutItems(shortcuts);
    setShortcutOrder(shortcuts.map((shortcut) => shortcut.id));
  }, [shortcuts]);

  useEffect(() => {
    setHomeShortcutGroups(shortcutGroups);
  }, [shortcutGroups]);

  useEffect(() => {
    setSectionOrder(initialSectionOrder);
  }, [initialSectionOrder]);

  useEffect(() => {
    setHiddenSections(initialHiddenSections);
  }, [initialHiddenSections]);

  useEffect(() => {
    setHomeLists(lists);
  }, [lists]);

  useEffect(() => {
    setHomeCreatePresets([...pinnedCreatePresets]);
  }, [pinnedCreatePresets]);

  useLayoutEffect(() => {
    if (!newItemOpen) {
      createModalAnchorTopRef.current = null;
      setCreateModalOffset(0);
      setCreateModalMaxHeight(null);
      return;
    }
    const content = createModalContentRef.current;
    if (!content) {
      return;
    }
    if (newItemPanel === "types") {
      createModalAnchorTopRef.current = content.getBoundingClientRect().top;
      setCreateModalOffset(0);
      setCreateModalMaxHeight(null);
      return;
    }
    const anchorTop = createModalAnchorTopRef.current;
    if (anchorTop === null) {
      return;
    }
    setCreateModalMaxHeight(Math.max(0, window.innerHeight - anchorTop - 16));
    setCreateModalOffset(anchorTop - content.getBoundingClientRect().top);
  }, [newItemOpen, newItemPanel]);

  useEffect(() => {
    if (!(newItemOpen && newItemPanel === "presets")) {
      return;
    }
    const content = createModalContentRef.current;
    const anchorTop = createModalAnchorTopRef.current;
    if (
      !(content && anchorTop !== null) ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setCreateModalOffset(
        (current) => current + (anchorTop - content.getBoundingClientRect().top)
      );
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [newItemOpen, newItemPanel]);

  useEffect(() => {
    if (!(newItemOpen && newItemPanel === "presets")) {
      return;
    }
    const updateMaxHeight = (): void => {
      const anchorTop = createModalAnchorTopRef.current;
      if (anchorTop === null) {
        return;
      }
      setCreateModalMaxHeight(Math.max(0, window.innerHeight - anchorTop - 16));
    };
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, [newItemOpen, newItemPanel]);

  useEffect(() => {
    if (!shortcutGroupOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const shortcutGroup = shortcutGroupRef.current;
      if (
        shortcutEditOpenRef.current ||
        (shortcutGroup && event.composedPath().includes(shortcutGroup))
      ) {
        return;
      }
      setShortcutGroupOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [shortcutGroupOpen]);

  const closeShortcutGroup = (): void => {
    shortcutGroupRef.current
      ?.querySelector<HTMLButtonElement>(".react-home-shortcut-open")
      ?.focus();
    setShortcutGroupOpen(null);
  };

  const announce = (message: string): void => {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(""), 3200);
  };

  const resetCreateCatalog = (): void => {
    setCreateCatalogFilter("all");
    setCreateCatalogQuery("");
    setCreateCatalogSort("priority");
    setCreateCatalogDensity("grid");
  };

  const rememberCreateSelection = (id: string): void => {
    setRecentCreateIds((current) =>
      [id, ...current.filter((existingId) => existingId !== id)].slice(0, 20)
    );
  };

  const openNewItemModal = (): void => {
    resetCreateCatalog();
    setNewItemPanel("types");
    setCreatePresetEditorId(null);
    setCreatePresetReturnTarget(null);
    setNewItemOpen(true);
  };

  const saveMemo = async (): Promise<void> => {
    if (!memoText.trim()) {
      return;
    }
    setMemoSaveError("");
    setSaving(true);
    try {
      await onSaveMemo?.(memoText.trim(), selectedMemoTags);
      setMemoText("");
      setSelectedMemoTags([]);
      setMemoSaveError("");
      memoTextareaRef.current?.focus();
      announce(t(uiLang, "memo.saved"));
    } catch {
      setSavedMessage("");
      setMemoSaveError(t(uiLang, "memo.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const selectCreateType = async (type: ItemType): Promise<void> => {
    rememberCreateSelection(`type:${type}`);
    setNewItemOpen(false);
    setNewItemPanel("types");
    setCreatePresetEditorId(null);
    setCreatePresetReturnTarget(null);
    try {
      await onSelectCreateType?.(type);
    } catch {
      announce(t(uiLang, "new.openFailed"));
    }
  };

  const selectCreatePreset = async (preset: CreatePreset): Promise<void> => {
    rememberCreateSelection(`preset:${preset.id}`);
    setNewItemOpen(false);
    setNewItemPanel("types");
    setCreatePresetEditorId(null);
    setCreatePresetReturnTarget(null);
    try {
      await onSelectCreateType?.(preset.type, preset.id);
    } catch {
      announce(t(uiLang, "new.openFailed"));
    }
  };

  const saveCreatePreset = async (preset: CreatePreset): Promise<void> => {
    await onSaveCreatePreset?.(preset);
    setHomeCreatePresets((current) =>
      [
        preset,
        ...current.filter(
          (existing) =>
            existing.id !== preset.id &&
            !(
              existing.type === preset.type &&
              existing.subfolder === preset.subfolder &&
              existing.tags.join("|") === preset.tags.join("|")
            )
        ),
      ].slice(0, 20)
    );
  };

  const deleteCreatePreset = async (presetId: string): Promise<void> => {
    await onDeleteCreatePreset?.(presetId);
    setHomeCreatePresets((current) =>
      current.filter((preset) => preset.id !== presetId)
    );
  };

  const openCreatePresetManager = (presetId?: string): void => {
    setCreatePresetEditorId(presetId ?? null);
    setCreatePresetReturnTarget(
      presetId ? { kind: "edit", presetId } : { kind: "add" }
    );
    setNewItemPanel("presets");
  };

  const moveSection = (sectionId: HomeSectionId, direction: -1 | 1): void => {
    setSectionOrder((current) => {
      const index = current.indexOf(sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const dropSection = (targetId: HomeSectionId): void => {
    if (!draggedSection || draggedSection === targetId) {
      return;
    }
    setSectionOrder((current) => {
      const from = current.indexOf(draggedSection);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedSection);
      return next;
    });
    setDraggedSection(null);
  };

  const orderedShortcuts = shortcutsInOrder(shortcutItems, shortcutOrder);
  const shortcutGroupNames = [
    ...new Set([
      ...homeShortcutGroups.map((group) => group.trim()).filter(Boolean),
      ...orderedShortcuts
        .map((shortcut) => shortcut.group?.trim() ?? "")
        .filter(Boolean),
    ]),
  ];
  const ungroupedShortcuts = orderedShortcuts.filter(
    (shortcut) => !(shortcut.group?.trim() ?? "")
  );

  const persistHomeOrder = async (
    nextShortcuts: HomeShortcut[],
    successMessage: string
  ): Promise<{ saved: boolean; version: number }> => {
    const version = homeOrderSaveVersionRef.current + 1;
    homeOrderSaveVersionRef.current = version;
    setSaving(true);
    try {
      await onSaveOrder?.(sectionOrder, nextShortcuts, hiddenSections);
      announce(successMessage);
      return { saved: true, version };
    } catch {
      return { saved: false, version };
    } finally {
      setSaving(false);
    }
  };

  const dropShortcutFromHome = (targetId: string): void => {
    if (!draggedShortcut || draggedShortcut === targetId) {
      return;
    }
    const previousOrder = shortcutOrder;
    const nextOrder = reorderIds(previousOrder, draggedShortcut, targetId);
    if (nextOrder === previousOrder) {
      return;
    }
    setShortcutOrder(nextOrder);
    setDraggedShortcut(null);
    const nextShortcuts = shortcutsInOrder(shortcutItems, nextOrder);
    void persistHomeOrder(
      nextShortcuts,
      t(uiLang, "home.shortcutOrderSaved")
    ).then(({ saved, version }) => {
      if (!saved && homeOrderSaveVersionRef.current === version) {
        setShortcutOrder(previousOrder);
        announce(t(uiLang, "notify.saveError"));
      }
    });
  };

  const dropShortcutIntoGroup = (group: string): void => {
    if (!draggedShortcut) {
      return;
    }
    const previousItems = shortcutItems;
    const nextItems = shortcutItems.map((shortcut) =>
      shortcut.id === draggedShortcut ? { ...shortcut, group } : shortcut
    );
    setShortcutItems(nextItems);
    setDraggedShortcut(null);
    void persistHomeOrder(
      shortcutsInOrder(nextItems, shortcutOrder),
      t(uiLang, "home.shortcutMovedToGroup")
    ).then(({ saved, version }) => {
      if (!saved && homeOrderSaveVersionRef.current === version) {
        setShortcutItems(previousItems);
        announce(t(uiLang, "notify.saveError"));
      }
    });
  };

  const moveOrderShortcut = (shortcutId: string, direction: -1 | 1): void => {
    const shortcut = orderEditorShortcutItems.find(
      (item) => item.id === shortcutId
    );
    if (!shortcut) {
      return;
    }
    const group = shortcut.group?.trim() ?? "";
    const shortcutsInGroup = shortcutsInOrder(
      orderEditorShortcutItems,
      orderEditorShortcutOrder
    ).filter((item) => (item.group?.trim() ?? "") === group);
    const groupIndex = shortcutsInGroup.findIndex(
      (item) => item.id === shortcutId
    );
    const targetId = shortcutsInGroup[groupIndex + direction]?.id;
    if (!targetId) {
      return;
    }
    setShortcutOrderFocusTarget(
      `${shortcutId}:${direction === 1 ? "up" : "down"}`
    );
    setOrderEditorShortcutOrder((current) => {
      const from = current.indexOf(shortcutId);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const toggleSectionVisibility = (sectionId: HomeSectionId): void => {
    setHiddenSections((current) =>
      current.includes(sectionId)
        ? current.filter((value) => value !== sectionId)
        : [...current, sectionId]
    );
  };

  const renderSection = (sectionId: HomeSectionId) => {
    switch (sectionId) {
      case "capture":
        if (modules?.memos === false) {
          return null;
        }
        return (
          <section
            aria-labelledby="react-home-capture-title"
            className="react-home-capture-section"
            key={sectionId}
          >
            <div className="react-home-section-heading">
              <div>
                <Title id="react-home-capture-title" order={2} size="h3">
                  {t(uiLang, "settings.module.memos")}
                </Title>
              </div>
            </div>
            <Paper
              className="react-home-capture-panel"
              p="lg"
              radius="lg"
              withBorder
            >
              <Textarea
                aria-describedby={
                  memoSaveError ? "react-home-capture-error" : undefined
                }
                aria-invalid={Boolean(memoSaveError)}
                aria-label={t(uiLang, "settings.module.memos")}
                autosize={false}
                maxRows={3}
                minRows={3}
                onChange={(event) => {
                  setMemoText(event.currentTarget.value);
                  setMemoSaveError("");
                }}
                placeholder={t(uiLang, "memo.placeholder")}
                ref={memoTextareaRef}
                value={memoText}
              />
              <div className="react-home-memo-tag-picker">
                <Select
                  data={memoTagOptions
                    .filter((tag) => !selectedMemoTags.includes(tag))
                    .map((tag) => ({ label: `#${tag}`, value: tag }))}
                  description={
                    memoTagOptions.length === 0
                      ? t(uiLang, "memo.tagsNoOptions")
                      : undefined
                  }
                  disabled={memoTagOptions.length === 0}
                  label={t(uiLang, "memo.tags")}
                  onChange={(tag) => {
                    if (tag && !selectedMemoTags.includes(tag)) {
                      setSelectedMemoTags((current) => [...current, tag]);
                    }
                  }}
                  placeholder={t(uiLang, "memo.tagsPlaceholder")}
                  value=""
                />
              </div>
              {selectedMemoTags.length > 0 && (
                <div className="react-home-memo-tags">
                  {selectedMemoTags.map((tag) => (
                    <Badge
                      color="accent"
                      key={tag}
                      rightSection={
                        <button
                          aria-label={`${t(uiLang, "action.delete")}: #${tag}`}
                          className="react-home-memo-tag-remove"
                          onClick={() =>
                            setSelectedMemoTags((current) =>
                              current.filter((value) => value !== tag)
                            )
                          }
                          type="button"
                        >
                          ×
                        </button>
                      }
                      variant="light"
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
              {Boolean(memoSaveError) && (
                <Alert
                  className="react-home-capture-error"
                  id="react-home-capture-error"
                  role="alert"
                  variant="light"
                >
                  {memoSaveError}
                </Alert>
              )}
              <Group
                align="center"
                className="react-home-capture-actions"
                justify="flex-end"
                mt="sm"
              >
                <Button
                  color="ink"
                  disabled={!memoText.trim() || saving}
                  loading={saving}
                  onClick={saveMemo}
                >
                  {t(uiLang, "memo.save")}
                </Button>
              </Group>
            </Paper>
          </section>
        );
      case "entries":
        return (
          <section
            aria-labelledby="react-home-entry-title"
            className="react-home-section"
            key={sectionId}
          >
            <div className="react-home-section-heading">
              <div>
                <Title id="react-home-entry-title" order={2} size="h3">
                  {t(uiLang, "home.primary")}
                </Title>
              </div>
            </div>
            <div className="react-home-entry-grid">
              {HOME_ENTRIES.filter(
                (entry) =>
                  (entry.id !== "memo" || modules?.memos !== false) &&
                  (entry.id !== "bookshelf" || modules?.bookshelf !== false)
              ).map((entry) => {
                const localizedEntry: HomeEntry = {
                  description: t(uiLang, entry.descriptionKey),
                  id: entry.id,
                  title: t(uiLang, entry.titleKey),
                };

                return (
                  <HomeEntryButton
                    entry={localizedEntry}
                    key={entry.id}
                    lang={uiLang}
                    onSelect={(selected) =>
                      onOpenEntry
                        ? void onOpenEntry(selected)
                        : setSelectedEntry(selected)
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      case "shortcuts":
        return (
          <section
            aria-labelledby="react-home-shortcuts-title"
            className="react-home-section"
            key={sectionId}
          >
            <div className="react-home-section-heading">
              <div>
                <Title id="react-home-shortcuts-title" order={2} size="h3">
                  {t(uiLang, "home.shortcuts")}
                </Title>
              </div>
            </div>
            <div className="react-home-shortcut-grid">
              {shortcutGroupNames.map((group) => (
                <div
                  className="react-home-shortcut react-home-shortcut-group"
                  data-drop-target={Boolean(draggedShortcut)}
                  key={`group:${group}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropShortcutIntoGroup(group)}
                  ref={shortcutGroupOpen === group ? shortcutGroupRef : null}
                >
                  <button
                    aria-expanded={shortcutGroupOpen === group}
                    aria-haspopup="dialog"
                    className="react-home-shortcut-open"
                    onClick={() =>
                      setShortcutGroupOpen((current) =>
                        current === group ? null : group
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeShortcutGroup();
                      }
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="react-home-shortcut-folder-icon"
                      viewBox="0 0 88 72"
                    >
                      <path
                        className="react-home-shortcut-folder-back"
                        d="M9 24V19a8 8 0 0 1 8-8h19l8 9h28a8 8 0 0 1 8 8v27a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V24Z"
                      />
                      <path
                        className="react-home-shortcut-folder-front"
                        d="M9 27h71v28a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8V27Z"
                      />
                      <path
                        className="react-home-shortcut-folder-highlight"
                        d="M12 29h65"
                      />
                    </svg>
                    <span className="react-home-shortcut-copy">
                      <strong>{group}</strong>
                      <small className="react-home-shortcut-meta">
                        {homeItemCount(
                          uiLang,
                          orderedShortcuts.filter(
                            (shortcut) => shortcut.group?.trim() === group
                          ).length
                        )}
                      </small>
                    </span>
                  </button>
                  {shortcutGroupOpen === group && (
                    <div
                      aria-label={t(uiLang, "shortcut.groupShortcuts", {
                        group,
                      })}
                      className="react-home-shortcut-popover"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          closeShortcutGroup();
                        }
                      }}
                      role="dialog"
                    >
                      <div className="react-home-shortcut-popover-heading">
                        <strong>{group}</strong>
                        <button
                          aria-label={t(uiLang, "shortcut.closeGroup", {
                            group,
                          })}
                          className="react-home-shortcut-popover-close"
                          onClick={closeShortcutGroup}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <div className="react-home-shortcut-popover-list">
                        {orderedShortcuts
                          .filter(
                            (shortcut) => shortcut.group?.trim() === group
                          )
                          .map((groupShortcut) => (
                            <div
                              className="react-home-shortcut-popover-item-row"
                              key={groupShortcut.id}
                            >
                              <button
                                className="react-home-shortcut-popover-item"
                                onClick={() => {
                                  setShortcutGroupOpen(null);
                                  if (onOpenShortcut) {
                                    void onOpenShortcut(groupShortcut);
                                  } else {
                                    announce(
                                      t(uiLang, "home.openItem", {
                                        title: groupShortcut.title,
                                      })
                                    );
                                  }
                                }}
                                type="button"
                              >
                                <ShortcutIcon shortcut={groupShortcut} />
                                <span className="react-home-shortcut-popover-copy">
                                  <strong>{groupShortcut.title}</strong>
                                  <small>
                                    {shortcutMetaLabel(uiLang, groupShortcut)}
                                  </small>
                                </span>
                              </button>
                              {groupShortcut.kind === "url" &&
                                groupShortcut.target && (
                                  <button
                                    aria-label={t(
                                      uiLang,
                                      "shortcut.editNamed",
                                      {
                                        title: groupShortcut.title,
                                      }
                                    )}
                                    className="react-home-shortcut-popover-edit"
                                    onClick={(event) => {
                                      shortcutTriggerRef.current =
                                        event.currentTarget;
                                      openShortcutEdit(groupShortcut);
                                    }}
                                    onMouseDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    title={t(uiLang, "shortcut.editNameAndUrl")}
                                    type="button"
                                  >
                                    ⋯
                                  </button>
                                )}
                            </div>
                          ))}
                      </div>
                      <small className="react-home-shortcut-popover-hint">
                        {t(uiLang, "shortcut.dropToMove")}
                      </small>
                    </div>
                  )}
                </div>
              ))}
              {ungroupedShortcuts.map((shortcut) => (
                <div
                  className="react-home-shortcut"
                  data-dragging={draggedShortcut === shortcut.id}
                  draggable
                  key={shortcut.id}
                  onDragEnd={() => setDraggedShortcut(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggedShortcut(shortcut.id)}
                  onDrop={() => dropShortcutFromHome(shortcut.id)}
                >
                  <button
                    className="react-home-shortcut-open"
                    onClick={() =>
                      onOpenShortcut
                        ? void onOpenShortcut(shortcut)
                        : announce(
                            t(uiLang, "home.openItem", {
                              title: shortcut.title,
                            })
                          )
                    }
                    type="button"
                  >
                    <ShortcutIcon shortcut={shortcut} />
                    <span className="react-home-shortcut-copy">
                      <strong>{shortcut.title}</strong>
                      <small className="react-home-shortcut-meta">
                        {shortcutMetaLabel(uiLang, shortcut)}
                      </small>
                    </span>
                  </button>
                  {shortcut.kind === "url" && shortcut.target && (
                    <button
                      aria-label={t(uiLang, "shortcut.editNamed", {
                        title: shortcut.title,
                      })}
                      className="react-home-shortcut-edit"
                      onClick={(event) => {
                        event.stopPropagation();
                        shortcutTriggerRef.current = event.currentTarget;
                        openShortcutEdit(shortcut);
                      }}
                      title={t(uiLang, "shortcut.editNameAndUrl")}
                      type="button"
                    >
                      ⋯
                    </button>
                  )}
                </div>
              ))}
              <button
                aria-label={t(uiLang, "home.addShortcut")}
                className="react-home-shortcut react-home-shortcut-add"
                onClick={(event) => {
                  shortcutTriggerRef.current = event.currentTarget;
                  openShortcutAdd();
                }}
                type="button"
              >
                <span aria-hidden="true" className="react-home-shortcut-icon">
                  ＋
                </span>
                <strong>{t(uiLang, "home.addShortcut")}</strong>
              </button>
            </div>
          </section>
        );
      case "inbox":
        return (
          <section
            aria-labelledby="react-home-inbox-title"
            className="react-home-section"
            key={sectionId}
          >
            <Paper
              className="react-home-inbox-panel"
              p="lg"
              radius="lg"
              withBorder
            >
              <div className="react-home-section-heading react-home-inbox-heading">
                <div>
                  <Group align="baseline" gap="sm">
                    <Title id="react-home-inbox-title" order={2} size="h3">
                      {t(uiLang, "inbox.section")}
                    </Title>
                    <Badge color="accent" variant="light">
                      {homeItemCount(uiLang, inboxItems.length)}
                    </Badge>
                  </Group>
                </div>
                <Button
                  color="ink"
                  onClick={() =>
                    onOpenInbox
                      ? void onOpenInbox()
                      : announce(t(uiLang, "organize.open"))
                  }
                >
                  {t(uiLang, "organize.open")}
                </Button>
              </div>
              <details
                className="react-home-inbox-accordion"
                onToggle={(event) => setInboxExpanded(event.currentTarget.open)}
                open={inboxExpanded}
              >
                <summary className="react-home-inbox-toggle">
                  <span>{t(uiLang, "view.list")}</span>
                  <span className="react-home-inbox-toggle-state">
                    {inboxExpanded
                      ? t(uiLang, "notify.close")
                      : t(uiLang, "action.open")}
                  </span>
                </summary>
                <div
                  className="react-home-inbox-list"
                  id="react-home-inbox-list"
                >
                  {inboxItems.map((item) => (
                    <button
                      className="react-home-inbox-item"
                      data-path={item.path}
                      key={item.id}
                      onClick={() =>
                        onOpenInboxItem
                          ? void onOpenInboxItem(item)
                          : announce(
                              t(uiLang, "home.reviewItem", {
                                title: item.title,
                              })
                            )
                      }
                      type="button"
                    >
                      <span className="react-home-inbox-item-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {homeItemTypeLabel(uiLang, item.type)} · {item.tags}
                        </small>
                      </span>
                      <time
                        dateTime={
                          item.date ? item.date.replace(/\./g, "-") : undefined
                        }
                      >
                        {item.date || t(uiLang, "date.none")}
                      </time>
                    </button>
                  ))}
                </div>
              </details>
            </Paper>
          </section>
        );
      case "secondary":
        return (
          <section
            aria-labelledby="react-home-secondary-title"
            className="react-home-section"
            key={sectionId}
          >
            <div className="react-home-section-heading">
              <div>
                <Title id="react-home-secondary-title" order={2} size="h3">
                  {t(uiLang, "home.pinnedAndLists")}
                </Title>
              </div>
            </div>
            <div className="react-home-secondary-grid">
              <Paper
                className="react-home-secondary-panel"
                p="md"
                radius="lg"
                withBorder
              >
                <Group align="baseline" justify="space-between">
                  <Text fw={700}>{t(uiLang, "pin.section")}</Text>
                  <Badge color="ink" variant="outline">
                    {homeItemCount(uiLang, pinnedItems.length)}
                  </Badge>
                </Group>
                <div className="react-home-secondary-lines">
                  {homePinnedItems.map((item) => (
                    <div className="react-home-pinned-line" key={item.id}>
                      <button
                        onClick={() =>
                          onOpenSecondaryItem
                            ? void onOpenSecondaryItem(item)
                            : announce(
                                t(uiLang, "home.openItem", {
                                  title: item.title,
                                })
                              )
                        }
                        type="button"
                      >
                        <strong>{item.title}</strong>
                        <small>
                          {homeItemTypeLabel(uiLang, item.type)} · {item.tags}
                        </small>
                      </button>
                      <IconButton
                        filled
                        icon="pin"
                        label={`${item.title}: ${t(uiLang, "menu.unpin")}`}
                        onClick={() => {
                          void (async () => {
                            try {
                              await onTogglePin?.(item, false);
                              setHomePinnedItems((current) =>
                                current.filter(
                                  (candidate) => candidate.id !== item.id
                                )
                              );
                            } catch {
                              announce("ピン留めを更新できませんでした");
                            }
                          })();
                        }}
                        size="compact-sm"
                        title={t(uiLang, "menu.unpin")}
                        variant="subtle"
                      />
                    </div>
                  ))}
                </div>
              </Paper>
              <Paper
                className="react-home-secondary-panel"
                p="md"
                radius="lg"
                withBorder
              >
                <Group align="baseline" justify="space-between">
                  <Text fw={700}>{t(uiLang, "list.section")}</Text>
                  <Button
                    onClick={() => {
                      setNewListName("");
                      setListNameError("");
                      setListEditorOpen(true);
                    }}
                    ref={listTriggerRef}
                    size="compact-sm"
                    variant="subtle"
                  >
                    ＋ {t(uiLang, "action.create")}
                  </Button>
                </Group>
                <div className="react-home-list-lines">
                  {homeLists.map((list) => (
                    <button
                      key={list.name}
                      onClick={() =>
                        onOpenList
                          ? void onOpenList(list)
                          : announce(
                              t(uiLang, "home.openItem", { title: list.name })
                            )
                      }
                      type="button"
                    >
                      <b aria-hidden="true" />
                      {list.name} <small>{list.count}</small>
                    </button>
                  ))}
                </div>
              </Paper>
            </div>
          </section>
        );
      default:
        throw new Error(`Unsupported home section: ${sectionId}`);
    }
  };

  const saveOrder = async (): Promise<void> => {
    const { saved, version } = await persistHomeOrder(
      shortcutsInOrder(orderEditorShortcutItems, orderEditorShortcutOrder),
      t(uiLang, "home.orderSaved")
    );
    if (homeOrderSaveVersionRef.current !== version) {
      return;
    }
    if (saved) {
      setShortcutItems(orderEditorShortcutItems);
      setShortcutOrder(orderEditorShortcutOrder);
      setOrderEditorOpen(false);
    } else {
      setDialogError(t(uiLang, "notify.saveError"));
    }
  };

  const closeOrderEditor = (): void => {
    setSectionOrder([...initialSectionOrder]);
    setHiddenSections([...initialHiddenSections]);
    setOrderEditorOpen(false);
    setDialogError("");
  };

  const saveList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) {
      return;
    }
    if (homeLists.some((list) => list.name === name)) {
      setListNameError(t(uiLang, "home.listNameDuplicate"));
      listNameInputRef.current?.focus();
      return;
    }
    setListNameError("");
    setSaving(true);
    try {
      await onCreateList?.(name);
      setHomeLists((current) =>
        current.some((list) => list.name === name)
          ? current
          : [...current, { count: 0, name }]
      );
      setListEditorOpen(false);
      setNewListName("");
      setListNameError("");
      announce(t(uiLang, "home.listCreated"));
    } catch {
      setListNameError(t(uiLang, "home.listCreateFailed"));
      listNameInputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const openShortcutAdd = (): void => {
    setDialogError("");
    setShortcutAddMode("link");
    setVaultTargetKind("file");
    setNewVaultTarget("");
    setNewShortcutGroup("");
    setNewShortcutTitle("");
    setNewShortcutUrl("");
    setShortcutUrlTouched(false);
    setEditingShortcutId(null);
    setShortcutEditOpen(false);
    setShortcutAddOpen(true);
  };

  const openShortcutEdit = (shortcut: HomeShortcut): void => {
    if (shortcut.kind !== "url" || !shortcut.target) {
      return;
    }
    setDialogError("");
    shortcutEditOpenRef.current = true;
    setNewShortcutGroup(shortcut.group?.trim() ?? "");
    setShortcutAddMode("link");
    setNewShortcutTitle(shortcut.title);
    setNewShortcutUrl(shortcut.target);
    setShortcutUrlTouched(false);
    setEditingShortcutId(shortcut.id);
    setShortcutAddOpen(false);
    setShortcutEditOpen(true);
  };

  const closeShortcutDialog = (): void => {
    shortcutEditOpenRef.current = false;
    setShortcutAddOpen(false);
    setShortcutEditOpen(false);
    setEditingShortcutId(null);
    setNewShortcutGroup("");
    setNewShortcutTitle("");
    setNewShortcutUrl("");
    setShortcutUrlTouched(false);
    setNewVaultTarget("");
    setDialogError("");
  };

  const saveShortcutAdd = async (): Promise<void> => {
    const title = newShortcutTitle.trim();
    const target =
      shortcutAddMode === "seiton"
        ? newVaultTarget.trim()
        : newShortcutUrl.trim();
    const group = newShortcutGroup.trim();
    if (
      !(title && target) ||
      (shortcutAddMode === "link" && !isWebUrl(target))
    ) {
      return;
    }
    setSaving(true);
    try {
      const kind: ShortcutKind =
        shortcutAddMode === "seiton" && vaultTargetKind === "folder"
          ? "folder"
          : shortcutAddMode === "seiton"
            ? "note"
            : "url";
      await onAddShortcut?.(title, target, group, kind);
      const id = `shortcut-${Date.now()}`;
      setShortcutItems((current) => [
        ...current,
        {
          group,
          id,
          initial: Array.from(title)[0] ?? "・",
          kind,
          target,
          title,
        },
      ]);
      setShortcutOrder((current) => [...current, id]);
      setShortcutAddOpen(false);
      setNewShortcutGroup("");
      setNewShortcutTitle("");
      setNewShortcutUrl("");
      setNewVaultTarget("");
      announce(t(uiLang, "shortcut.add.created"));
    } catch {
      setDialogError(t(uiLang, "shortcut.add.failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveShortcutFolder = async (): Promise<void> => {
    const name = newShortcutGroup.trim();
    if (!name || homeShortcutGroups.includes(name)) {
      return;
    }
    setSaving(true);
    try {
      await onAddShortcutFolder?.(name);
      setHomeShortcutGroups((current) => [...current, name]);
      closeShortcutDialog();
      announce(t(uiLang, "shortcut.add.created"));
    } catch {
      setDialogError(t(uiLang, "shortcut.add.failed"));
    } finally {
      setSaving(false);
    }
  };

  const selectVaultTarget = (value: string | null): void => {
    const target = vaultTargets.find(
      (candidate) => `${candidate.kind}:${candidate.path}` === value
    );
    setNewVaultTarget(target ? target.path : "");
    if (target) {
      setNewShortcutTitle((current) => current.trim() || target.title);
    }
  };

  const saveShortcutEdit = async (): Promise<void> => {
    const title = newShortcutTitle.trim();
    const target = newShortcutUrl.trim();
    const group = newShortcutGroup.trim();
    const shortcutId = editingShortcutId;
    const canSave =
      title.length > 0 &&
      target.length > 0 &&
      shortcutId !== null &&
      isWebUrl(target);
    if (!canSave) {
      return;
    }
    const previousItems = shortcutItems;
    const nextItems = shortcutItems.map((shortcut) =>
      shortcut.id === shortcutId
        ? {
            ...shortcut,
            group,
            initial: Array.from(title)[0] ?? "・",
            target,
            title,
          }
        : shortcut
    );
    setShortcutItems(nextItems);
    const { saved, version } = await persistHomeOrder(
      shortcutsInOrder(nextItems, shortcutOrder),
      t(uiLang, "shortcut.add.updated")
    );
    if (homeOrderSaveVersionRef.current !== version) {
      return;
    }
    if (saved) {
      closeShortcutDialog();
    } else {
      setShortcutItems(previousItems);
      setDialogError(t(uiLang, "notify.saveError"));
    }
  };

  return (
    <div
      className="seiton-react-home-prototype"
      data-scheme={scheme}
      ref={rootRef}
    >
      <header className="react-home-header">
        <div>
          <Title className="react-home-heading" order={1}>
            {t(uiLang, "home.title")}
          </Title>
        </div>
        <Group className="react-home-header-actions" gap="xs">
          <Button
            onClick={() => {
              setDialogError("");
              setOrderEditorShortcutItems([...shortcutItems]);
              setOrderEditorShortcutOrder([...shortcutOrder]);
              setShortcutOrderFocusTarget(null);
              setOrderEditorOpen(true);
            }}
            ref={orderTriggerRef}
            size="sm"
            variant="default"
          >
            {t(uiLang, "home.editOrder")}
          </Button>
        </Group>
      </header>

      <main>
        {sectionOrder
          .filter((sectionId) => !hiddenSections.includes(sectionId))
          .map(renderSection)}
      </main>

      <AnimatePresence initial={false}>
        {Boolean(savedMessage || selectedEntry) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-home-feedback"
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          >
            <Alert
              closeButtonLabel={t(uiLang, "notify.close")}
              color="accent"
              onClose={() => {
                setSavedMessage("");
                setSelectedEntry(null);
              }}
              role="status"
              variant="light"
              withCloseButton
            >
              {savedMessage ||
                t(uiLang, "home.openDestination", {
                  title: selectedEntry?.title ?? "",
                })}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        aria-label={t(uiLang, "home.createItem")}
        className="react-home-fab"
        color="ink"
        hidden={
          newItemOpen ||
          listEditorOpen ||
          orderEditorOpen ||
          shortcutAddOpen ||
          shortcutEditOpen
        }
        onClick={openNewItemModal}
        ref={newItemTriggerRef}
        title={t(uiLang, "home.createItem")}
      >
        ＋
      </Button>

      {Boolean(portalTarget) && (
        <Modal
          centered
          classNames={{
            content: "react-home-modal-content",
            header: "react-home-modal-header",
            root: "react-home-create-modal-root",
          }}
          closeButtonProps={{ "aria-label": t(uiLang, "notify.close") }}
          contentRef={createModalContentRef}
          focusKey={newItemPanel}
          onClose={() => {
            setNewItemOpen(false);
            resetCreateCatalog();
            setNewItemPanel("types");
            setCreatePresetEditorId(null);
            setCreatePresetReturnTarget(null);
          }}
          opened={newItemOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={newItemTriggerRef}
          styles={{
            content: {
              maxHeight:
                newItemPanel === "presets" && createModalMaxHeight !== null
                  ? `${createModalMaxHeight}px`
                  : undefined,
              transform:
                newItemPanel === "presets" && createModalOffset !== 0
                  ? `translateY(${createModalOffset}px)`
                  : undefined,
            },
          }}
          title={
            newItemPanel === "types"
              ? t(uiLang, "new.create")
              : createPresetEditorId
                ? t(uiLang, "new.presetEditTitle")
                : t(uiLang, "new.presetAdd")
          }
          withinPortal
        >
          {newItemPanel === "types" ? (
            <Stack className="react-home-create-catalog" gap="md">
              <Text className="react-home-create-catalog-hint" size="sm">
                {t(uiLang, "new.catalogHint")}
              </Text>
              <div className="react-home-create-catalog-toolbar">
                <div className="react-home-create-catalog-search">
                  <span
                    aria-hidden="true"
                    className="react-home-create-catalog-search-icon"
                  >
                    <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
                      <title>検索</title>
                      <circle
                        cx="10.8"
                        cy="10.8"
                        r="6.8"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="m16 16 4.5 4.5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </span>
                  <TextInput
                    aria-label={t(uiLang, "new.catalogSearch")}
                    onChange={(event) =>
                      setCreateCatalogQuery(event.currentTarget.value)
                    }
                    placeholder=""
                    type="search"
                    value={createCatalogQuery}
                  />
                </div>
                <fieldset
                  aria-label={t(uiLang, "new.catalogFilter")}
                  className="react-home-create-catalog-filters"
                >
                  {(
                    [
                      ["all", "new.catalogAll"],
                      ["type", "new.catalogTypes"],
                      ["preset", "new.catalogPresets"],
                    ] as const
                  ).map(([filter, labelKey]) => (
                    <Button
                      aria-pressed={createCatalogFilter === filter}
                      className="react-home-create-catalog-filter"
                      key={filter}
                      onClick={() => setCreateCatalogFilter(filter)}
                      size="sm"
                      variant="subtle"
                    >
                      {t(uiLang, labelKey)}
                    </Button>
                  ))}
                </fieldset>
                <Select
                  aria-label={t(uiLang, "new.catalogSort")}
                  className="react-home-create-catalog-sort"
                  data={[
                    {
                      label: t(uiLang, "new.catalogSortPriority"),
                      value: "priority",
                    },
                    {
                      label: t(uiLang, "new.catalogSortRecent"),
                      value: "recent",
                    },
                    {
                      label: t(uiLang, "new.catalogSortName"),
                      value: "name",
                    },
                  ]}
                  onChange={(value) => {
                    if (value === "name" || value === "recent") {
                      setCreateCatalogSort(value);
                    } else {
                      setCreateCatalogSort("priority");
                    }
                  }}
                  value={createCatalogSort}
                />
              </div>
              <div className="react-home-create-catalog-meta">
                <Text className="react-home-muted" size="xs">
                  <strong>{visibleCreateCatalogItems.length}</strong>{" "}
                  {t(uiLang, "new.catalogCount")}
                </Text>
              </div>
              <section
                aria-label={t(uiLang, "new.catalogAll")}
                className={`react-home-create-catalog-list react-home-create-catalog-list-${createCatalogDensity}`}
                data-create-catalog-count={visibleCreateCatalogItems.length}
              >
                {visibleCreateCatalogItems.map((item) =>
                  item.kind === "preset" ? (
                    <CreatePresetOption
                      focusEdit={
                        createPresetReturnTarget?.kind === "edit" &&
                        createPresetReturnTarget.presetId === item.preset.id
                      }
                      key={item.id}
                      lang={uiLang}
                      onEdit={(value) => openCreatePresetManager(value.id)}
                      onSelect={(value) => void selectCreatePreset(value)}
                      preset={item.preset}
                    />
                  ) : (
                    <CreateTypeOption
                      key={item.id}
                      lang={uiLang}
                      onSelect={(value) => void selectCreateType(value)}
                      type={item.type}
                    />
                  )
                )}
                {createCatalogFilter !== "type" &&
                  !normalizedCreateCatalogQuery && (
                    <CreatePresetAddOption
                      focusOnReturn={createPresetReturnTarget?.kind === "add"}
                      lang={uiLang}
                      onSelect={() => openCreatePresetManager()}
                    />
                  )}
                {visibleCreateCatalogItems.length === 0 && (
                  <Text className="react-home-create-catalog-empty" size="sm">
                    {t(uiLang, "new.catalogEmpty")}
                  </Text>
                )}
              </section>
              <fieldset
                aria-label={t(uiLang, "new.catalogView")}
                className="react-home-create-catalog-density"
              >
                <Text
                  className="react-home-create-catalog-density-label react-home-muted"
                  component="legend"
                  size="xs"
                >
                  {t(uiLang, "new.catalogView")}
                </Text>
                {(["grid", "list"] as const).map((density) => (
                  <Button
                    aria-pressed={createCatalogDensity === density}
                    className="react-home-create-catalog-density-button"
                    key={density}
                    onClick={() => setCreateCatalogDensity(density)}
                    size="xs"
                    variant="subtle"
                  >
                    {density === "grid"
                      ? t(uiLang, "view.card")
                      : t(uiLang, "view.list")}
                  </Button>
                ))}
              </fieldset>
            </Stack>
          ) : (
            <CreatePresetManager
              availableTypes={[
                ...new Set([
                  ...createTypeSections.pinned,
                  ...createTypeSections.recent,
                  ...createTypeSections.all,
                ]),
              ]}
              baseFolders={createTypeFolders}
              initialPresetId={createPresetEditorId ?? undefined}
              lang={uiLang}
              onBack={() => {
                setCreatePresetEditorId(null);
                setNewItemPanel("types");
              }}
              onDeletePreset={deleteCreatePreset}
              onSavePreset={saveCreatePreset}
              pinnedCreatePresets={homeCreatePresets}
            />
          )}
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          classNames={{
            content: "react-home-modal-content",
            header: "react-home-modal-header",
          }}
          closeButtonProps={{ "aria-label": t(uiLang, "notify.close") }}
          onClose={() => {
            setListEditorOpen(false);
            setListNameError("");
          }}
          opened={listEditorOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={listTriggerRef}
          title={t(uiLang, "home.listCreateTitle")}
          withinPortal
        >
          <Stack gap="md">
            <TextInput
              autoFocus
              error={listNameError || undefined}
              label={t(uiLang, "home.listNameLabel")}
              onChange={(event) => {
                setNewListName(event.currentTarget.value);
                setListNameError("");
              }}
              placeholder={t(uiLang, "home.listNamePlaceholder")}
              ref={listNameInputRef}
              value={newListName}
            />
            <Group justify="flex-end">
              <Button
                onClick={() => {
                  setListEditorOpen(false);
                  setListNameError("");
                }}
                variant="default"
              >
                {t(uiLang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={!newListName.trim() || saving}
                loading={saving}
                onClick={() => void saveList()}
              >
                {t(uiLang, "action.create")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          classNames={{
            body: "react-home-order-modal-body",
            content: "react-home-order-modal-content",
            header: "react-home-modal-header",
          }}
          closeButtonProps={{ "aria-label": t(uiLang, "notify.close") }}
          focusKey={shortcutOrderFocusTarget ?? "shortcut-order"}
          onClose={closeOrderEditor}
          opened={orderEditorOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={orderTriggerRef}
          title={t(uiLang, "home.editOrder")}
          withinPortal
        >
          <Stack gap="lg">
            <Text className="react-home-muted" size="sm">
              {t(uiLang, "home.orderDescription")}
            </Text>
            {Boolean(dialogError) && (
              <Alert
                className="react-home-dialog-error"
                color="red"
                role="alert"
                variant="light"
              >
                {dialogError}
              </Alert>
            )}
            <fieldset className="react-home-order-fieldset">
              <legend>{t(uiLang, "home.orderSection")}</legend>
              <ol className="react-home-order-list">
                {sectionOrder.map((sectionId, index) => {
                  const section = HOME_SECTION_META[sectionId];
                  const sectionLabel = t(uiLang, section.labelKey);
                  return (
                    <li
                      className="react-home-order-row"
                      data-dragging={draggedSection === sectionId}
                      data-hidden={hiddenSections.includes(sectionId)}
                      draggable
                      key={sectionId}
                      onDragEnd={() => setDraggedSection(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDragStart={() => setDraggedSection(sectionId)}
                      onDrop={() => dropSection(sectionId)}
                    >
                      <span
                        aria-hidden="true"
                        className="react-home-order-handle"
                      >
                        ⋮⋮
                      </span>
                      <span className="react-home-order-copy">
                        <strong>{sectionLabel}</strong>
                        <small>{t(uiLang, section.detailKey)}</small>
                      </span>
                      <span className="react-home-order-controls">
                        <Button
                          aria-pressed={!hiddenSections.includes(sectionId)}
                          onClick={() => toggleSectionVisibility(sectionId)}
                          size="compact-sm"
                          variant="default"
                        >
                          {hiddenSections.includes(sectionId)
                            ? t(uiLang, "home.orderHidden")
                            : t(uiLang, "home.orderShowing")}
                        </Button>
                        <Button
                          aria-label={t(uiLang, "home.orderMoveUp", {
                            section: sectionLabel,
                          })}
                          disabled={index === 0}
                          onClick={() => moveSection(sectionId, -1)}
                          size="compact-sm"
                          variant="default"
                        >
                          ↑
                        </Button>
                        <Button
                          aria-label={t(uiLang, "home.orderMoveDown", {
                            section: sectionLabel,
                          })}
                          disabled={index === sectionOrder.length - 1}
                          onClick={() => moveSection(sectionId, 1)}
                          size="compact-sm"
                          variant="default"
                        >
                          ↓
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </fieldset>
            {orderEditorShortcutItems.length > 0 && (
              <fieldset className="react-home-order-fieldset">
                <legend>{t(uiLang, "home.orderShortcuts")}</legend>
                <ol className="react-home-order-list">
                  {shortcutsInOrder(
                    orderEditorShortcutItems,
                    orderEditorShortcutOrder
                  ).map((shortcut, _index, ordered) => {
                    const group = shortcut.group?.trim() ?? "";
                    const shortcutsInGroup = ordered.filter(
                      (item) => (item.group?.trim() ?? "") === group
                    );
                    const groupIndex = shortcutsInGroup.findIndex(
                      (item) => item.id === shortcut.id
                    );
                    return (
                      <li
                        className="react-home-order-row react-home-order-shortcut-row"
                        key={shortcut.id}
                      >
                        <span className="react-home-order-copy">
                          <strong>{shortcut.title}</strong>
                          <small>{shortcutMetaLabel(uiLang, shortcut)}</small>
                        </span>
                        <Select
                          className="react-home-order-shortcut-group"
                          data={[
                            {
                              label: t(uiLang, "shortcut.noGroup"),
                              value: "",
                            },
                            ...shortcutGroupNames.map((name) => ({
                              label: name,
                              value: name,
                            })),
                          ]}
                          label={t(uiLang, "home.orderShortcutGroup")}
                          onChange={(value) => {
                            const nextGroup = value ?? "";
                            setOrderEditorShortcutItems((current) =>
                              current.map((item) =>
                                item.id === shortcut.id
                                  ? {
                                      ...item,
                                      group: nextGroup || undefined,
                                    }
                                  : item
                              )
                            );
                          }}
                          value={group}
                        />
                        <span className="react-home-order-controls">
                          <Button
                            aria-label={t(uiLang, "home.orderMoveUp", {
                              section: shortcut.title,
                            })}
                            data-seiton-autofocus={
                              shortcutOrderFocusTarget === `${shortcut.id}:up`
                                ? ""
                                : undefined
                            }
                            disabled={groupIndex === 0}
                            onClick={() => moveOrderShortcut(shortcut.id, -1)}
                            size="compact-sm"
                            variant="default"
                          >
                            ↑
                          </Button>
                          <Button
                            aria-label={t(uiLang, "home.orderMoveDown", {
                              section: shortcut.title,
                            })}
                            data-seiton-autofocus={
                              shortcutOrderFocusTarget === `${shortcut.id}:down`
                                ? ""
                                : undefined
                            }
                            disabled={
                              groupIndex === shortcutsInGroup.length - 1
                            }
                            onClick={() => moveOrderShortcut(shortcut.id, 1)}
                            size="compact-sm"
                            variant="default"
                          >
                            ↓
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </fieldset>
            )}
            <Group justify="flex-end">
              <Button
                color="ink"
                disabled={saving}
                loading={saving}
                onClick={() => void saveOrder()}
              >
                {t(uiLang, "action.save")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          classNames={{
            content: "react-home-shortcut-add-modal-content",
            header: "react-home-modal-header",
          }}
          closeButtonProps={{ "aria-label": t(uiLang, "notify.close") }}
          onClose={closeShortcutDialog}
          opened={shortcutAddOpen || shortcutEditOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={shortcutTriggerRef}
          size="md"
          title={
            shortcutEditOpen
              ? t(uiLang, "shortcut.editTitle")
              : t(uiLang, "home.addShortcut")
          }
          withinPortal
        >
          <Stack gap="lg">
            {!shortcutEditOpen && (
              <div
                aria-label={t(uiLang, "shortcut.add.typeTabsLabel")}
                className="react-home-shortcut-create-tabs"
                role="tablist"
              >
                {[
                  ["link", t(uiLang, "shortcut.add.linkTab")],
                  ["seiton", t(uiLang, "shortcut.add.seitonTab")],
                  ["folder", t(uiLang, "shortcut.add.folderTab")],
                ].map(([mode, label]) => (
                  <button
                    aria-selected={shortcutAddMode === mode}
                    className="react-home-shortcut-create-tab"
                    key={mode}
                    onClick={() =>
                      setShortcutAddMode(mode as "link" | "seiton" | "folder")
                    }
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {Boolean(dialogError) && (
              <Alert
                className="react-home-dialog-error"
                color="red"
                role="alert"
                variant="light"
              >
                {dialogError}
              </Alert>
            )}

            {shortcutAddMode === "folder" && !shortcutEditOpen ? (
              <TextInput
                autoFocus
                description={t(uiLang, "shortcut.add.folderNameHint")}
                label={t(uiLang, "shortcut.add.folderNameLabel")}
                onChange={(event) =>
                  setNewShortcutGroup(event.currentTarget.value)
                }
                placeholder={t(uiLang, "shortcut.groupPlaceholder")}
                value={newShortcutGroup}
              />
            ) : (
              <>
                <TextInput
                  autoFocus
                  label={t(uiLang, "shortcut.titleLabel")}
                  onChange={(event) =>
                    setNewShortcutTitle(event.currentTarget.value)
                  }
                  value={newShortcutTitle}
                />
                <TextInput
                  label={t(uiLang, "shortcut.groupLabel")}
                  list="seiton-shortcut-groups"
                  onChange={(event) =>
                    setNewShortcutGroup(event.currentTarget.value)
                  }
                  placeholder={t(uiLang, "shortcut.groupPlaceholder")}
                  value={newShortcutGroup}
                />
                <datalist id="seiton-shortcut-groups">
                  {shortcutGroupNames.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
                {shortcutAddMode === "seiton" && !shortcutEditOpen ? (
                  <>
                    <div
                      aria-label={t(uiLang, "shortcut.add.targetKindLabel")}
                      className="react-home-shortcut-target-tabs"
                      role="tablist"
                    >
                      {(["file", "folder"] as const).map((kind) => (
                        <button
                          aria-selected={vaultTargetKind === kind}
                          className="react-home-shortcut-target-tab"
                          key={kind}
                          onClick={() => {
                            setVaultTargetKind(kind);
                            setNewVaultTarget("");
                            setNewShortcutTitle("");
                          }}
                          role="tab"
                          type="button"
                        >
                          {kind === "file"
                            ? t(uiLang, "shortcut.add.file")
                            : t(uiLang, "shortcut.add.folder")}
                        </button>
                      ))}
                    </div>
                    <FolderTreePicker
                      label={t(uiLang, "shortcut.targetLabel")}
                      lang={uiLang}
                      onChange={selectVaultTarget}
                      options={vaultTargets
                        .filter((target) => target.kind === vaultTargetKind)
                        .map((target) => ({
                          label: target.title,
                          path: target.path,
                          value: `${target.kind}:${target.path}`,
                        }))}
                      placeholder={
                        vaultTargets.some(
                          (target) => target.kind === vaultTargetKind
                        )
                          ? t(uiLang, "shortcut.add.selectTarget")
                          : t(uiLang, "shortcut.add.noTargets")
                      }
                      value={
                        newVaultTarget
                          ? `${vaultTargetKind}:${newVaultTarget}`
                          : ""
                      }
                    />
                  </>
                ) : (
                  <TextInput
                    aria-invalid={shortcutUrlInvalid}
                    description={t(uiLang, "shortcut.urlDescription")}
                    error={
                      shortcutUrlInvalid
                        ? t(uiLang, "shortcut.urlInvalid")
                        : undefined
                    }
                    label={t(uiLang, "shortcut.urlLabel")}
                    onBlur={() => setShortcutUrlTouched(true)}
                    onChange={(event) =>
                      setNewShortcutUrl(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setShortcutUrlTouched(true);
                        void (shortcutEditOpen
                          ? saveShortcutEdit()
                          : saveShortcutAdd());
                      }
                    }}
                    placeholder="https://example.com"
                    type="url"
                    value={newShortcutUrl}
                  />
                )}
              </>
            )}
            <Group gap="sm" justify="flex-end">
              <Button onClick={closeShortcutDialog} variant="default">
                {t(uiLang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  saving ||
                  (shortcutAddMode === "folder"
                    ? !newShortcutGroup.trim()
                    : !newShortcutTitle.trim() ||
                      (shortcutAddMode === "seiton"
                        ? !newVaultTarget.trim()
                        : !isWebUrl(newShortcutUrl)))
                }
                loading={saving}
                onClick={() =>
                  void (shortcutEditOpen
                    ? saveShortcutEdit()
                    : shortcutAddMode === "folder"
                      ? saveShortcutFolder()
                      : saveShortcutAdd())
                }
              >
                {shortcutEditOpen
                  ? t(uiLang, "action.update")
                  : shortcutAddMode === "folder"
                    ? t(uiLang, "shortcut.add.createFolder")
                    : t(uiLang, "shortcut.add.done")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      <footer className="react-home-footer">
        <Text className="react-home-muted" size="xs">
          Harness only · ホームのページ構成試作。本番コード、Obsidian
          ItemView、test-vaultは変更していません
        </Text>
      </footer>
    </div>
  );
}

function PrototypeApp({
  lang,
  shortcuts,
  inboxItems,
  pinnedItems,
  lists,
  shortcutGroups,
  vaultTargets,
  initialSectionOrder,
  initialHiddenSections,
  createTypes,
  createTypeSettings,
  createTypeFolders,
  pinnedCreatePresets,
  modules,
  memoTagOptions,
  onSaveMemo,
  onSelectCreateType,
  onDeleteCreatePreset,
  onSaveCreatePreset,
  onAddShortcut,
  onAddShortcutFolder,
  onOpenShortcut,
  onOpenEntry,
  onOpenInbox,
  onOpenInboxItem,
  onOpenSecondaryItem,
  onTogglePin,
  onOpenList,
  onCreateList,
  onSaveOrder,
}: {
  lang?: Lang;
  shortcuts?: HomeShortcut[];
  inboxItems?: HomeInboxItem[];
  pinnedItems?: HomeInboxItem[];
  lists?: HomeList[];
  shortcutGroups?: string[];
  vaultTargets?: HomeVaultTarget[];
  initialSectionOrder?: HomeSectionId[];
  initialHiddenSections?: HomeSectionId[];
  createTypes?: ItemType[];
  createTypeSettings?: CreateTypeSettings;
  createTypeFolders?: Partial<Record<ItemType, string>>;
  modules?: Pick<FeatureModules, "bookshelf" | "memos">;
  pinnedCreatePresets?: readonly CreatePreset[];
  memoTagOptions?: string[];
  onSaveMemo?: (text: string, tags: string[]) => void | Promise<void>;
  onSelectCreateType?: (
    type: ItemType,
    presetId?: string
  ) => void | Promise<void>;
  onDeleteCreatePreset?: (presetId: string) => void | Promise<void>;
  onSaveCreatePreset?: (preset: CreatePreset) => void | Promise<void>;
  onAddShortcut?: (
    title: string,
    target: string,
    group?: string,
    kind?: ShortcutKind
  ) => void | Promise<void>;
  onAddShortcutFolder?: (name: string) => void | Promise<void>;
  onOpenShortcut?: (shortcut: HomeShortcut) => void | Promise<void>;
  onOpenEntry?: (entry: HomeEntry) => void | Promise<void>;
  onOpenInbox?: () => void | Promise<void>;
  onOpenInboxItem?: (item: HomeInboxItem) => void | Promise<void>;
  onOpenSecondaryItem?: (item: HomeInboxItem) => void | Promise<void>;
  onTogglePin?: (item: HomeInboxItem, pinned: boolean) => void | Promise<void>;
  onOpenList?: (list: HomeList) => void | Promise<void>;
  onCreateList?: (name: string) => void | Promise<void>;
  onSaveOrder?: (
    sectionOrder: HomeSectionId[],
    shortcuts: HomeShortcut[],
    hiddenSections: HomeSectionId[]
  ) => void | Promise<void>;
}) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactHomeSurface
        createTypeFolders={createTypeFolders}
        createTypeSettings={createTypeSettings}
        createTypes={createTypes}
        inboxItems={inboxItems}
        initialHiddenSections={initialHiddenSections}
        initialSectionOrder={initialSectionOrder}
        lang={lang}
        lists={lists}
        memoTagOptions={memoTagOptions}
        modules={modules}
        onAddShortcut={onAddShortcut}
        onAddShortcutFolder={onAddShortcutFolder}
        onCreateList={onCreateList}
        onDeleteCreatePreset={onDeleteCreatePreset}
        onOpenEntry={onOpenEntry}
        onOpenInbox={onOpenInbox}
        onOpenInboxItem={onOpenInboxItem}
        onOpenList={onOpenList}
        onOpenSecondaryItem={onOpenSecondaryItem}
        onOpenShortcut={onOpenShortcut}
        onSaveCreatePreset={onSaveCreatePreset}
        onSaveMemo={onSaveMemo}
        onSaveOrder={onSaveOrder}
        onSelectCreateType={onSelectCreateType}
        onTogglePin={onTogglePin}
        pinnedCreatePresets={pinnedCreatePresets}
        pinnedItems={pinnedItems}
        scheme={scheme}
        shortcutGroups={shortcutGroups}
        shortcuts={shortcuts}
        vaultTargets={vaultTargets}
      />
    </SeitonUIProvider>
  );
}

export function mountReactHomePrototype(
  root: HTMLElement,
  options: {
    lang?: Lang;
    shortcuts?: HomeShortcut[];
    inboxItems?: HomeInboxItem[];
    pinnedItems?: HomeInboxItem[];
    lists?: HomeList[];
    shortcutGroups?: string[];
    vaultTargets?: HomeVaultTarget[];
    initialSectionOrder?: HomeSectionId[];
    initialHiddenSections?: HomeSectionId[];
    createTypes?: ItemType[];
    createTypeSettings?: CreateTypeSettings;
    createTypeFolders?: Partial<Record<ItemType, string>>;
    modules?: Pick<FeatureModules, "bookshelf" | "memos">;
    pinnedCreatePresets?: readonly CreatePreset[];
    memoTagOptions?: string[];
    onSaveMemo?: (text: string, tags: string[]) => void | Promise<void>;
    onSelectCreateType?: (
      type: ItemType,
      presetId?: string
    ) => void | Promise<void>;
    onDeleteCreatePreset?: (presetId: string) => void | Promise<void>;
    onSaveCreatePreset?: (preset: CreatePreset) => void | Promise<void>;
    onAddShortcut?: (
      title: string,
      target: string,
      group?: string,
      kind?: ShortcutKind
    ) => void | Promise<void>;
    onAddShortcutFolder?: (name: string) => void | Promise<void>;
    onOpenShortcut?: (shortcut: HomeShortcut) => void | Promise<void>;
    onOpenEntry?: (entry: HomeEntry) => void | Promise<void>;
    onOpenInbox?: () => void | Promise<void>;
    onOpenInboxItem?: (item: HomeInboxItem) => void | Promise<void>;
    onOpenSecondaryItem?: (item: HomeInboxItem) => void | Promise<void>;
    onTogglePin?: (
      item: HomeInboxItem,
      pinned: boolean
    ) => void | Promise<void>;
    onOpenList?: (list: HomeList) => void | Promise<void>;
    onCreateList?: (name: string) => void | Promise<void>;
    onSaveOrder?: (
      sectionOrder: HomeSectionId[],
      shortcuts: HomeShortcut[],
      hiddenSections: HomeSectionId[]
    ) => void | Promise<void>;
  } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      createTypeFolders={options.createTypeFolders}
      createTypeSettings={options.createTypeSettings}
      createTypes={options.createTypes}
      inboxItems={options.inboxItems}
      initialHiddenSections={options.initialHiddenSections}
      initialSectionOrder={options.initialSectionOrder}
      lang={options.lang}
      lists={options.lists}
      memoTagOptions={options.memoTagOptions}
      modules={options.modules}
      onAddShortcut={options.onAddShortcut}
      onAddShortcutFolder={options.onAddShortcutFolder}
      onCreateList={options.onCreateList}
      onDeleteCreatePreset={options.onDeleteCreatePreset}
      onOpenEntry={options.onOpenEntry}
      onOpenInbox={options.onOpenInbox}
      onOpenInboxItem={options.onOpenInboxItem}
      onOpenList={options.onOpenList}
      onOpenSecondaryItem={options.onOpenSecondaryItem}
      onOpenShortcut={options.onOpenShortcut}
      onSaveCreatePreset={options.onSaveCreatePreset}
      onSaveMemo={options.onSaveMemo}
      onSaveOrder={options.onSaveOrder}
      onSelectCreateType={options.onSelectCreateType}
      onTogglePin={options.onTogglePin}
      pinnedCreatePresets={options.pinnedCreatePresets}
      pinnedItems={options.pinnedItems}
      shortcutGroups={options.shortcutGroups}
      shortcuts={options.shortcuts}
      vaultTargets={options.vaultTargets}
    />
  );
  return () => reactRoot.unmount();
}
