import {
  DEFAULT_BOOK_CATEGORIES,
  DEFAULT_BOOK_CATEGORY,
  DEFAULT_INBOX_FOLDER,
  DEFAULT_MEMOS_FOLDER,
  DEFAULT_RICH_CARD_CACHE_MAX_AGE_DAYS,
  DEFAULT_RICH_CARD_CACHE_MAX_BYTES,
  DEFAULT_ROOT_FOLDER,
  ITEM_TYPES,
} from "./constants";
import { DEFAULT_TEMPLATES, normalizeTemplates } from "./noteTemplates";
import { normalizeFolder, normalizeSubfolder } from "./paths";
import { normalizeRichCardDomains } from "./richCard";
import { normalizeTagInput } from "./tags";
import type {
  ArchiveFolderMove,
  ArchiveNoteMove,
  CreatePreset,
  FeatureModules,
  HomeSectionKey,
  ItemStatus,
  ItemType,
  SearchSettings,
  SeitonSettings,
  ShortcutLink,
} from "./types";

export const CURRENT_SETTINGS_SCHEMA_VERSION = 16;

export const DEFAULT_FEATURE_MODULES: FeatureModules = {
  agentGuide: false,
  bookshelf: true,
  editorToolbar: true,
  memos: true,
  richCards: true,
};

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  additionalFolders: [],
  historyEnabled: true,
  includeMemos: true,
  maxHistory: 10,
};

export const DEFAULT_SETTINGS: SeitonSettings = {
  archivedFolders: [],
  archiveFolderMoves: [],
  archiveNoteMoves: [],
  bookCategories: [...DEFAULT_BOOK_CATEGORIES],
  bookCoverCacheEnabled: true,
  bookDetailTabReuseEnabled: true,
  calilAppKey: "",
  calilCity: "",
  calilPrefecture: "",
  calilReferenceLatitude: null,
  calilReferenceLongitude: null,
  calilSearchHistory: [],
  editorColorOrder: "default",
  editorPinnedColors: [],
  editorRecentColors: [],
  enabledTypes: [...ITEM_TYPES],
  excludeArchivedFromSearch: false,
  hiddenHomeSections: [],
  homeSectionOrder: [
    "capture",
    "today",
    "shortcuts",
    "inbox",
    "pinned",
    "lists",
  ],
  inboxFolder: DEFAULT_INBOX_FOLDER,
  libraryBrowseMode: "items",
  librarySort: "modified",
  libraryViewMode: "card",
  listFoldState: {},
  listNames: [],
  memosFolder: DEFAULT_MEMOS_FOLDER,
  memoTagOptions: [],
  modules: { ...DEFAULT_FEATURE_MODULES },
  onboardingCompleted: false,
  pinned: [],
  pinnedCreatePresets: [],
  pinnedTypes: ["idea", "task", "article"],
  recentTypes: [],
  richCardCacheMaxAgeDays: DEFAULT_RICH_CARD_CACHE_MAX_AGE_DAYS,
  richCardCacheMaxBytes: DEFAULT_RICH_CARD_CACHE_MAX_BYTES,
  richCardDisabledDomains: [],
  richCardFolders: [],
  rootFolder: DEFAULT_ROOT_FOLDER,
  schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  search: { ...DEFAULT_SEARCH_SETTINGS },
  searchHistory: [],
  sharedTextDefault: "memo",
  shortcutGroups: [],
  shortcuts: [],
  tagAliases: {},
  tagSort: "usage",
  templates: { ...DEFAULT_TEMPLATES },
  typeFolders: {},
  typeOrder: [...ITEM_TYPES],
  uiLanguage: "auto",
  viewState: { period: "today", scrollTop: 0, viewMode: "card" },
};

export interface SettingsMigrationResult {
  changed: boolean;
  fromVersion: number;
  settings: SeitonSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function memoTagOptions(value: unknown): string[] {
  const seen = new Set<string>();
  return strings(value).flatMap((raw) => {
    const tag = normalizeTagInput(raw);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [tag];
  });
}

function safeVaultPath(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "." || part === "..")
  ) {
    return "";
  }
  return normalizeFolder(normalized);
}

export function normalizeBookCategories(value: unknown): string[] {
  const categories = [
    ...new Set(
      strings(value)
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
  if (categories.length === 0) {
    return [...DEFAULT_SETTINGS.bookCategories];
  }
  if (categories.includes(DEFAULT_BOOK_CATEGORY)) {
    const limited = categories.slice(0, 20);
    return limited.includes(DEFAULT_BOOK_CATEGORY)
      ? limited
      : [...categories.slice(0, 19), DEFAULT_BOOK_CATEGORY];
  }
  return [...categories.slice(0, 19), DEFAULT_BOOK_CATEGORY];
}

function calilSearchHistory(
  value: unknown
): SeitonSettings["calilSearchHistory"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }
      const availableCount = Number(entry.availableCount);
      if (
        typeof entry.bookId !== "string" ||
        typeof entry.bookUrl !== "string" ||
        typeof entry.checkedAt !== "string" ||
        typeof entry.isbn !== "string" ||
        typeof entry.title !== "string" ||
        !Number.isFinite(availableCount) ||
        availableCount < 0
      ) {
        return [];
      }
      return [
        {
          availableCount: Math.floor(availableCount),
          bookId: entry.bookId.trim(),
          bookUrl: entry.bookUrl.trim(),
          checkedAt: entry.checkedAt,
          isbn: entry.isbn.trim(),
          title: entry.title.trim(),
        },
      ];
    })
    .filter((entry) => entry.bookId && entry.isbn && entry.title)
    .slice(0, 20);
}

function coordinate(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function types(
  value: unknown,
  fallback: ItemType[],
  appendMissing: boolean
): ItemType[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const valid = value.filter(
    (entry): entry is ItemType =>
      typeof entry === "string" && ITEM_TYPES.includes(entry as ItemType)
  );
  const unique = [...new Set(valid)];
  if (!appendMissing) {
    return unique;
  }
  return [...unique, ...ITEM_TYPES.filter((type) => !unique.includes(type))];
}

function modules(raw: Record<string, unknown>): FeatureModules {
  const value = isRecord(raw.modules) ? raw.modules : {};
  const legacyToolbar =
    typeof raw.editorToolbarEnabled === "boolean"
      ? raw.editorToolbarEnabled
      : DEFAULT_FEATURE_MODULES.editorToolbar;
  return {
    agentGuide:
      typeof value.agentGuide === "boolean"
        ? value.agentGuide
        : DEFAULT_FEATURE_MODULES.agentGuide,
    bookshelf:
      typeof value.bookshelf === "boolean"
        ? value.bookshelf
        : DEFAULT_FEATURE_MODULES.bookshelf,
    editorToolbar:
      typeof value.editorToolbar === "boolean"
        ? value.editorToolbar
        : legacyToolbar,
    memos:
      typeof value.memos === "boolean"
        ? value.memos
        : DEFAULT_FEATURE_MODULES.memos,
    richCards:
      typeof value.richCards === "boolean"
        ? value.richCards
        : DEFAULT_FEATURE_MODULES.richCards,
  };
}

function searchSettings(raw: Record<string, unknown>): SearchSettings {
  const value = isRecord(raw.search) ? raw.search : {};
  const maxHistory = Number(value.maxHistory);
  return {
    additionalFolders: [
      ...new Set(
        strings(value.additionalFolders)
          .map((folder) => folder.trim())
          .filter(Boolean)
      ),
    ],
    historyEnabled:
      typeof value.historyEnabled === "boolean"
        ? value.historyEnabled
        : DEFAULT_SEARCH_SETTINGS.historyEnabled,
    includeMemos:
      typeof value.includeMemos === "boolean"
        ? value.includeMemos
        : DEFAULT_SEARCH_SETTINGS.includeMemos,
    maxHistory:
      Number.isFinite(maxHistory) && maxHistory >= 0
        ? Math.floor(maxHistory)
        : DEFAULT_SEARCH_SETTINGS.maxHistory,
  };
}

function shortcuts(value: unknown): ShortcutLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.title !== "string") {
      return [];
    }
    const legacyUrl = typeof entry.url === "string" ? entry.url : null;
    const target = typeof entry.target === "string" ? entry.target : legacyUrl;
    if (!target) {
      return [];
    }
    const kind =
      entry.kind === "note" ||
      entry.kind === "folder" ||
      entry.kind === "command" ||
      entry.kind === "view"
        ? entry.kind
        : "url";
    return [
      {
        group: typeof entry.group === "string" ? entry.group : "",
        kind,
        target,
        title: entry.title,
      },
    ];
  });
}

function archiveFolderMoves(value: unknown): ArchiveFolderMove[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const validTypes = ITEM_TYPES.filter(
    (type): type is Exclude<ItemType, "memo"> => type !== "memo"
  );
  const moves = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const archivedPath =
      typeof entry.archivedPath === "string"
        ? normalizeFolder(entry.archivedPath.trim())
        : "";
    const originalPath =
      typeof entry.originalPath === "string"
        ? normalizeFolder(entry.originalPath.trim())
        : "";
    if (
      !(archivedPath && originalPath) ||
      typeof entry.type !== "string" ||
      !validTypes.includes(entry.type as Exclude<ItemType, "memo">)
    ) {
      return [];
    }
    return [
      {
        archivedPath,
        originalPath,
        type: entry.type as Exclude<ItemType, "memo">,
      },
    ];
  });
  return [...new Map(moves.map((move) => [move.archivedPath, move])).values()];
}

function archiveNoteMoves(value: unknown): ArchiveNoteMove[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const validTypes = ITEM_TYPES.filter(
    (type): type is Exclude<ItemType, "memo"> => type !== "memo"
  );
  const moves = value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const archivedPath = safeVaultPath(entry.archivedPath);
    const originalPath = safeVaultPath(entry.originalPath);
    const previousStatus = entry.previousStatus;
    if (
      !(archivedPath && originalPath) ||
      (previousStatus !== "active" && previousStatus !== "inbox") ||
      typeof entry.type !== "string" ||
      !validTypes.includes(entry.type as Exclude<ItemType, "memo">)
    ) {
      return [];
    }
    return [
      {
        archivedPath,
        originalPath,
        previousStatus: previousStatus as Exclude<ItemStatus, "archive">,
        type: entry.type as Exclude<ItemType, "memo">,
      },
    ];
  });
  return [...new Map(moves.map((move) => [move.archivedPath, move])).values()];
}

function shortcutGroups(value: unknown, items: ShortcutLink[]): string[] {
  const configured = strings(value)
    .map((group) => group.trim())
    .filter(Boolean);
  const assigned = items
    .map((shortcut) => shortcut.group.trim())
    .filter(Boolean);
  return [...new Set([...configured, ...assigned])];
}

function pinnedCreatePresets(value: unknown): CreatePreset[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  return value
    .flatMap((entry) => {
      if (
        !isRecord(entry) ||
        typeof entry.type !== "string" ||
        !ITEM_TYPES.includes(entry.type as ItemType) ||
        typeof entry.label !== "string"
      ) {
        return [];
      }
      const label = entry.label.trim();
      if (!label) {
        return [];
      }
      let subfolder = "";
      try {
        subfolder =
          typeof entry.subfolder === "string"
            ? normalizeSubfolder(entry.subfolder)
            : "";
      } catch {
        return [];
      }
      const tags = [
        ...new Set(strings(entry.tags).map(normalizeTagInput).filter(Boolean)),
      ];
      const id =
        typeof entry.id === "string" && entry.id.trim()
          ? entry.id.trim()
          : `create-preset:${entry.type}:${subfolder}:${tags.join("|")}`;
      if (seen.has(id)) {
        return [];
      }
      seen.add(id);
      return [
        {
          id,
          label,
          subfolder,
          tags,
          type: entry.type as ItemType,
        },
      ];
    })
    .slice(0, 20);
}

/**
 * 旧data.jsonを現在の一貫した設定へ変換するdeep module。
 * 呼び出し側はversionごとの分岐や旧キーを知る必要がない。
 */
export function migrateSettings(input: unknown): SettingsMigrationResult {
  const raw = isRecord(input) ? input : {};
  const fromVersion =
    typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
  const hasLegacyPrivateReference =
    typeof raw.calilReferenceAddress === "string" &&
    raw.calilReferenceAddress.trim().length > 0;
  const canKeepReferencePoint = fromVersion >= 9 && !hasLegacyPrivateReference;
  const rawViewState = isRecord(raw.viewState) ? raw.viewState : {};
  const rawTagAliases = isRecord(raw.tagAliases) ? raw.tagAliases : {};
  const tagAliases = Object.fromEntries(
    Object.entries(rawTagAliases).map(([key, value]) => [key, strings(value)])
  );
  const rawFoldState = isRecord(raw.listFoldState) ? raw.listFoldState : {};
  const listFoldState = Object.fromEntries(
    Object.entries(rawFoldState).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
    )
  );
  const homeKeys: HomeSectionKey[] = [
    "capture",
    "today",
    "pinned",
    "inbox",
    "lists",
    "tags",
    "shortcuts",
  ];
  const requestedHomeOrder = strings(raw.homeSectionOrder).filter(
    (key): key is HomeSectionKey => homeKeys.includes(key as HomeSectionKey)
  );
  const hiddenHomeSections = [
    ...new Set(
      strings(raw.hiddenHomeSections).filter((key): key is HomeSectionKey =>
        homeKeys.includes(key as HomeSectionKey)
      )
    ),
  ];

  const normalizedShortcuts = shortcuts(raw.shortcuts);
  const normalizedSearch = searchSettings(raw);
  const settings: SeitonSettings = {
    ...DEFAULT_SETTINGS,
    archivedFolders: [
      ...new Set(
        strings(raw.archivedFolders)
          .map((path) => normalizeFolder(path.trim()))
          .filter(Boolean)
      ),
    ],
    archiveFolderMoves: archiveFolderMoves(raw.archiveFolderMoves),
    archiveNoteMoves: archiveNoteMoves(raw.archiveNoteMoves),
    bookCategories: normalizeBookCategories(raw.bookCategories),
    bookCoverCacheEnabled:
      typeof raw.bookCoverCacheEnabled === "boolean"
        ? raw.bookCoverCacheEnabled
        : true,
    bookDetailTabReuseEnabled:
      typeof raw.bookDetailTabReuseEnabled === "boolean"
        ? raw.bookDetailTabReuseEnabled
        : DEFAULT_SETTINGS.bookDetailTabReuseEnabled,
    calilAppKey:
      typeof raw.calilAppKey === "string" ? raw.calilAppKey.trim() : "",
    calilCity: typeof raw.calilCity === "string" ? raw.calilCity.trim() : "",
    calilPrefecture:
      typeof raw.calilPrefecture === "string" ? raw.calilPrefecture.trim() : "",
    // v9: 個人住所を基準点として保存しない。市区町村を再選択する。
    calilReferenceLatitude: canKeepReferencePoint
      ? coordinate(raw.calilReferenceLatitude, -90, 90)
      : null,
    calilReferenceLongitude: canKeepReferencePoint
      ? coordinate(raw.calilReferenceLongitude, -180, 180)
      : null,
    calilSearchHistory: calilSearchHistory(raw.calilSearchHistory),
    editorColorOrder:
      raw.editorColorOrder === "warm" || raw.editorColorOrder === "cool"
        ? raw.editorColorOrder
        : "default",
    editorPinnedColors: strings(raw.editorPinnedColors),
    editorRecentColors: strings(raw.editorRecentColors),
    enabledTypes: types(raw.enabledTypes, [...ITEM_TYPES], false),
    excludeArchivedFromSearch:
      typeof raw.excludeArchivedFromSearch === "boolean"
        ? raw.excludeArchivedFromSearch
        : false,
    hiddenHomeSections,
    homeSectionOrder: [
      ...new Set(
        requestedHomeOrder.length > 0
          ? requestedHomeOrder
          : DEFAULT_SETTINGS.homeSectionOrder
      ),
    ],
    inboxFolder:
      typeof raw.inboxFolder === "string" && raw.inboxFolder.trim()
        ? raw.inboxFolder.trim()
        : DEFAULT_SETTINGS.inboxFolder,
    libraryBrowseMode: raw.libraryBrowseMode === "tags" ? "tags" : "items",
    librarySort:
      raw.librarySort === "created" ||
      raw.librarySort === "title" ||
      raw.librarySort === "type"
        ? raw.librarySort
        : "modified",
    libraryViewMode: raw.libraryViewMode === "list" ? "list" : "card",
    listFoldState,
    listNames: strings(raw.listNames),
    memosFolder:
      typeof raw.memosFolder === "string" && raw.memosFolder.trim()
        ? raw.memosFolder.trim()
        : DEFAULT_SETTINGS.memosFolder,
    memoTagOptions: memoTagOptions(raw.memoTagOptions),
    modules: modules(raw),
    onboardingCompleted: raw.onboardingCompleted === true,
    pinned: strings(raw.pinned),
    pinnedCreatePresets: pinnedCreatePresets(raw.pinnedCreatePresets),
    pinnedTypes: types(raw.pinnedTypes, DEFAULT_SETTINGS.pinnedTypes, false),
    recentTypes: types(raw.recentTypes, [], false).slice(0, 5),
    richCardDisabledDomains: normalizeRichCardDomains(
      strings(raw.richCardDisabledDomains)
    ),
    richCardFolders: strings(raw.richCardFolders),
    rootFolder:
      typeof raw.rootFolder === "string" && raw.rootFolder.trim()
        ? raw.rootFolder.trim()
        : DEFAULT_SETTINGS.rootFolder,
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    search: normalizedSearch,
    searchHistory: strings(raw.searchHistory)
      .map((query) => query.trim())
      .filter(Boolean)
      .slice(0, normalizedSearch.maxHistory),
    sharedTextDefault: raw.sharedTextDefault === "idea" ? "idea" : "memo",
    shortcutGroups: shortcutGroups(raw.shortcutGroups, normalizedShortcuts),
    shortcuts: normalizedShortcuts,
    tagAliases,
    tagSort: raw.tagSort === "alpha" ? "alpha" : "usage",
    templates: normalizeTemplates(
      isRecord(raw.templates) ? raw.templates : undefined
    ),
    typeFolders: isRecord(raw.typeFolders) ? raw.typeFolders : {},
    typeOrder: types(raw.typeOrder, [...ITEM_TYPES], true),
    uiLanguage:
      raw.uiLanguage === "ja" ||
      raw.uiLanguage === "en" ||
      raw.uiLanguage === "zh-CN" ||
      raw.uiLanguage === "ko" ||
      raw.uiLanguage === "es" ||
      raw.uiLanguage === "pt-BR" ||
      raw.uiLanguage === "fr" ||
      raw.uiLanguage === "de"
        ? raw.uiLanguage
        : "auto",
    viewState: {
      period:
        rawViewState.period === "week" || rawViewState.period === "month"
          ? rawViewState.period
          : "today",
      scrollTop:
        typeof rawViewState.scrollTop === "number" &&
        rawViewState.scrollTop >= 0
          ? rawViewState.scrollTop
          : 0,
      viewMode: rawViewState.viewMode === "list" ? "list" : "card",
    },
    // v6の値は1互換期間だけ保持する。Seitonは同期製品のignore fileを今後変更しない。
    ...(typeof raw.richCardCacheExcludeFromSync === "boolean"
      ? { richCardCacheExcludeFromSync: raw.richCardCacheExcludeFromSync }
      : {}),
    richCardCacheMaxAgeDays:
      typeof raw.richCardCacheMaxAgeDays === "number" &&
      raw.richCardCacheMaxAgeDays > 0
        ? Math.floor(raw.richCardCacheMaxAgeDays)
        : DEFAULT_SETTINGS.richCardCacheMaxAgeDays,
    richCardCacheMaxBytes:
      typeof raw.richCardCacheMaxBytes === "number" &&
      raw.richCardCacheMaxBytes > 0
        ? Math.floor(raw.richCardCacheMaxBytes)
        : DEFAULT_SETTINGS.richCardCacheMaxBytes,
  };

  return {
    changed: JSON.stringify(raw) !== JSON.stringify(settings),
    fromVersion,
    settings,
  };
}
