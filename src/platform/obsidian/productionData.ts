import type { App, TFile } from "obsidian";
import {
  type BookReadingStatus,
  bookIsbnValue,
  normalizeBookOwnership,
} from "../../domain/book";
import { DEFAULT_BOOK_CATEGORY, ITEM_TYPES } from "../../shared/constants";
import { parseItem } from "../../shared/frontmatter";
import { isInArchivedContext, isWithinFolder } from "../../shared/library";
import { listMemos, parseMonthFile } from "../../shared/memoFile";
import {
  hasOrganizationProposalMarker,
  isOrganizationProposalPath,
  type OrganizationProposalDocument,
  organizationContentFingerprint,
  organizationProposalValuesMatch,
  parseOrganizationProposal,
} from "../../shared/organizationProposal";
import {
  archiveNoteDestination,
  folderForType,
  newNoteFolder,
  uniquePath,
} from "../../shared/paths";
import { itemToSearchDocument, type SearchDocument } from "../../shared/search";
import { mostFrequentTags } from "../../shared/tags";
import type {
  ArchiveFolderMove,
  ArchiveNoteMove,
  IndexedItem,
  ItemType,
  SeitonSettings,
} from "../../shared/types";
import type { Book } from "../../ui/screens/react-bookshelf-prototype";
import type {
  HomeInboxItem,
  HomeList,
  HomeSectionId,
  HomeShortcut,
  HomeVaultTarget,
} from "../../ui/screens/react-home-prototype";
import type { LibraryItem } from "../../ui/screens/react-library-prototype";
import type { MemoItem } from "../../ui/screens/react-memo-prototype";
import type {
  OrganizeDestination,
  OrganizeItem,
  OrganizeType,
} from "../../ui/screens/react-organize-prototype";
import { readMonthFiles } from "./memoStore";

export interface ReactProductionData {
  archivedFolders: string[];
  archiveFolderMoves: ArchiveFolderMove[];
  archiveNoteMoves: ArchiveNoteMove[];
  books: Book[];
  home: {
    shortcuts: HomeShortcut[];
    shortcutGroups: string[];
    vaultTargets: HomeVaultTarget[];
    inboxItems: HomeInboxItem[];
    pinnedItems: HomeInboxItem[];
    lists: HomeList[];
    hiddenSections: HomeSectionId[];
    sectionOrder: HomeSectionId[];
  };
  indexed: IndexedItem[];
  library: LibraryItem[];
  libraryFolders: string[];
  memos: MemoItem[];
  organize: {
    destinations: OrganizeDestination[];
    proposals: OrganizationProposalDocument[];
    queue: OrganizeItem[];
    lists: string[];
    frequentTags: string[];
  };
  protectedLibraryFolders: string[];
  search: SearchDocument[];
}

function normalizedFolder(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function inConfiguredScope(path: string, settings: SeitonSettings): boolean {
  const root = normalizedFolder(settings.rootFolder);
  return (
    path === root ||
    path.startsWith(`${root}/`) ||
    settings.search.additionalFolders.some((folder) => {
      const normalized = normalizedFolder(folder);
      return (
        Boolean(normalized) &&
        (path === normalized || path.startsWith(`${normalized}/`))
      );
    })
  );
}

async function readIndexedItems(
  app: App,
  settings: SeitonSettings,
  contentCache: Map<string, Promise<string>>
): Promise<IndexedItem[]> {
  const items: IndexedItem[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (!inConfiguredScope(file.path, settings)) {
      continue;
    }
    if (isOrganizationProposalPath(file.path, settings.rootFolder)) {
      continue;
    }
    const raw = await readCachedContent(app, file, contentCache);
    if (hasOrganizationProposalMarker(raw)) {
      continue;
    }
    const parsed = parseItem(raw, file.path);
    if (!parsed.item) {
      continue;
    }
    if (!settings.modules.memos && parsed.item.type === "memo") {
      continue;
    }
    items.push({
      body: parsed.body,
      item: parsed.item,
      modified: file.stat.mtime,
      path: file.path,
      title: parsed.title,
    });
  }
  return items;
}

function dateLabel(value?: string): string {
  return value ? value.slice(0, 10).replace(/-/g, ".") : "";
}

function summaryOf(body: string): string | undefined {
  const summary = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find(
      (line) =>
        Boolean(line) &&
        !/^#{1,6}(?:\s|$)/.test(line) &&
        !/^!\[\[.*\]\]$/.test(line)
    );
  return summary ? summary.slice(0, 160) : undefined;
}

function prototypeType(type: ItemType): LibraryItem["type"] {
  if (type === "webclip") {
    return "clip";
  }
  if (type === "class") {
    return "lecture";
  }
  return type as LibraryItem["type"];
}

function toLibraryItem(
  item: IndexedItem,
  pinnedPaths: Set<string>,
  settings: SeitonSettings
): LibraryItem {
  const lists = item.item.lists ?? [];
  const noteArchived = settings.archiveNoteMoves.some(
    (move) => move.archivedPath === item.path
  );
  const contextArchived = isInArchivedContext(
    item.path,
    settings.archivedFolders
  );
  const legacyArchived = item.item.status === "archive" && !noteArchived;
  const archived = noteArchived || contextArchived || legacyArchived;
  return {
    archived,
    archiveState: noteArchived
      ? "note"
      : contextArchived
        ? "context"
        : legacyArchived
          ? "legacy"
          : undefined,
    contextArchived,
    created: dateLabel(item.item.created),
    id: item.path,
    legacyArchived,
    list: lists[0],
    lists,
    modified: dateLabel(new Date(item.modified ?? Date.now()).toISOString()),
    path: item.path,
    pinned: pinnedPaths.has(item.path),
    summary: summaryOf(item.body),
    tags: (item.item.tags ?? []).map((tag) =>
      tag.startsWith("#") ? tag : `#${tag}`
    ),
    title: item.title,
    type: prototypeType(item.item.type),
    typeRoot: folderForType(settings, item.item.type),
  };
}

function libraryFolderPaths(app: App, settings: SeitonSettings): string[] {
  const roots = ITEM_TYPES.filter((type) => type !== "memo").map((type) =>
    folderForType(settings, type)
  );
  const archivedRoots = [
    ...settings.archiveFolderMoves.map((move) => move.archivedPath),
    ...settings.archiveNoteMoves.map((move) => {
      const separator = move.archivedPath.lastIndexOf("/");
      return separator > 0 ? move.archivedPath.slice(0, separator) : "";
    }),
  ].filter(Boolean);
  const existing = app.vault
    .getAllFolders()
    .map((folder) => folder.path)
    .filter((path) =>
      [...roots, ...archivedRoots].some((root) => isWithinFolder(path, root))
    );
  return [...new Set([...roots, ...archivedRoots, ...existing])];
}

function toOrganizeItem(
  item: IndexedItem,
  pinnedPaths: Set<string>
): OrganizeItem {
  return {
    body: item.body,
    id: item.path,
    lists: item.item.lists ?? [],
    path: item.path,
    pinned: pinnedPaths.has(item.path),
    source: item.item.source,
    tags: item.item.tags ?? [],
    title: item.title,
    type: item.item.type as OrganizeType,
  };
}

function organizeDestinations(settings: SeitonSettings): OrganizeDestination[] {
  return settings.pinnedCreatePresets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    path: newNoteFolder(settings, preset.type, preset.subfolder),
    tags: preset.tags,
    type: preset.type as OrganizeType,
  }));
}

function toHomeInboxItem(item: IndexedItem): HomeInboxItem {
  return {
    date: dateLabel(item.item.created),
    id: item.path,
    path: item.path,
    tags: (item.item.tags ?? [])
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .join(" "),
    title: item.title,
    type: item.item.type,
  };
}

function shortcutInitial(title: string): string {
  return Array.from(title.trim())[0] ?? "・";
}

function vaultTargets(
  app: App,
  settings: SeitonSettings,
  indexed: IndexedItem[],
  proposalPaths: readonly string[] = []
): HomeVaultTarget[] {
  const root = normalizedFolder(settings.rootFolder).toLocaleLowerCase();
  const isConfiguredPath = (path: string): boolean => {
    const normalizedPath = path.toLocaleLowerCase();
    return (
      normalizedPath === root ||
      normalizedPath.startsWith(`${root}/`) ||
      inConfiguredScope(path, settings)
    );
  };
  const scopedFolders = app.vault
    .getAllFolders()
    .filter(
      (folder) =>
        folder.path.toLocaleLowerCase() !== root &&
        isConfiguredPath(folder.path)
    );
  const archivedItemPaths = new Set(
    indexed
      .filter((item) => item.item.status === "archive")
      .map((item) => item.path)
  );
  const excludedProposalPaths = new Set(proposalPaths);
  const scopedFiles = app.vault
    .getMarkdownFiles()
    .filter(
      (file) =>
        isConfiguredPath(file.path) &&
        !archivedItemPaths.has(file.path) &&
        !excludedProposalPaths.has(file.path) &&
        !isOrganizationProposalPath(file.path, settings.rootFolder)
    );
  const indexedFiles = indexed
    .filter((item) => isConfiguredPath(item.path))
    .map((item) => ({
      kind: "file" as const,
      path: item.path,
      title: item.title,
    }));
  const fileTargets: HomeVaultTarget[] =
    scopedFiles.length > 0
      ? scopedFiles.map((file) => ({
          kind: "file",
          path: file.path,
          title: file.name.replace(/\.md$/, ""),
        }))
      : indexedFiles;
  const derivedFolders = new Map<string, HomeVaultTarget>();
  for (const file of fileTargets) {
    const segments = file.path.split("/");
    segments.pop();
    for (let index = 1; index < segments.length; index += 1) {
      const path = segments.slice(0, index + 1).join("/");
      if (path.toLocaleLowerCase() !== root) {
        derivedFolders.set(path, {
          kind: "folder",
          path,
          title: segments[index],
        });
      }
    }
  }
  const folders = scopedFolders.length > 0 ? scopedFolders : [];
  const folderTargets = [
    ...folders.map((folder) => ({
      kind: "folder" as const,
      path: folder.path,
      title: folder.name,
    })),
    ...derivedFolders.values(),
  ];
  return [
    ...new Map(folderTargets.map((target) => [target.path, target])).values(),
    ...fileTargets,
  ].sort((left, right) =>
    `${left.kind}:${left.path}`.localeCompare(
      `${right.kind}:${right.path}`,
      "ja"
    )
  );
}

function homeSectionOrder(settings: SeitonSettings): HomeSectionId[] {
  const mapped: HomeSectionId[] = [];
  for (const key of settings.homeSectionOrder) {
    const section =
      key === "capture"
        ? "capture"
        : key === "today"
          ? "entries"
          : key === "shortcuts"
            ? "shortcuts"
            : key === "inbox"
              ? "inbox"
              : "secondary";
    if (!mapped.includes(section)) {
      mapped.push(section);
    }
  }
  if (!mapped.includes("capture")) {
    mapped.unshift("capture");
  }
  for (const section of [
    "entries",
    "shortcuts",
    "inbox",
    "secondary",
  ] as HomeSectionId[]) {
    if (!mapped.includes(section)) {
      mapped.push(section);
    }
  }
  return mapped;
}

function hiddenHomeSections(settings: SeitonSettings): HomeSectionId[] {
  const mapped: HomeSectionId[] = [];
  for (const key of settings.hiddenHomeSections) {
    const section =
      key === "today"
        ? "capture"
        : key === "shortcuts"
          ? "shortcuts"
          : key === "inbox"
            ? "inbox"
            : "secondary";
    if (!mapped.includes(section)) {
      mapped.push(section);
    }
  }
  if (!(settings.modules.memos || mapped.includes("capture"))) {
    mapped.push("capture");
  }
  return mapped;
}

async function readMemos(
  app: App,
  settings: SeitonSettings
): Promise<MemoItem[]> {
  if (!settings.modules.memos) {
    return [];
  }
  const files = readMonthFiles(app.vault, {
    memosFolder: settings.memosFolder,
    rootFolder: settings.rootFolder,
  });
  const grouped = await Promise.all(
    files.map(async (file) => {
      const parsed = parseMonthFile(await app.vault.cachedRead(file));
      if (!parsed) {
        return [];
      }
      return listMemos(parsed)
        .filter((memo) => memo.day)
        .map((memo) => ({
          content: memo.content,
          date: memo.day as string,
          id: `memo:${file.path}:${memo.lineIndex}`,
          lineIndex: memo.lineIndex,
          month: memo.month,
          path: file.path,
          tags: memo.tags,
          time: memo.time,
        }));
    })
  );
  return grouped
    .flat()
    .sort((left, right) =>
      `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`)
    );
}

/** 正本のノートに加えて、設定済み外部フォルダと月ファイル内の行を検索へ渡す。 */
async function readSearchDocuments(
  app: App,
  settings: SeitonSettings,
  indexed: IndexedItem[]
): Promise<SearchDocument[]> {
  // 月ファイル自体は検索対象にせず、includeMemos のときだけ各行を検索結果にする。
  // これにより「月ファイル」と「その中のつぶやき」の二重表示と、月ファイル全体への誤操作を防ぐ。
  const documents: SearchDocument[] = indexed
    .filter((item) => item.item.type !== "memo")
    .map((item) => ({
      ...itemToSearchDocument(item, item.modified ?? 0),
      pinned: settings.pinned.includes(item.path),
      status: isInArchivedContext(item.path, settings.archivedFolders)
        ? "archive"
        : item.item.status,
    }));
  const indexedPaths = new Set(indexed.map((item) => item.path));
  const memoPrefix = `${normalizedFolder(settings.rootFolder)}/${normalizedFolder(settings.memosFolder)}/`;

  if (settings.modules.memos && settings.search.includeMemos) {
    for (const file of readMonthFiles(app.vault, {
      memosFolder: settings.memosFolder,
      rootFolder: settings.rootFolder,
    })) {
      const parsed = parseMonthFile(await app.vault.cachedRead(file));
      if (!parsed) {
        continue;
      }
      for (const memo of listMemos(parsed)) {
        if (!memo.day) {
          continue;
        }
        documents.push({
          body: memo.content,
          created: `${memo.day}T${memo.time}`,
          id: `memo:${file.path}:${memo.lineIndex}`,
          kind: "memo",
          lists: [],
          modified: file.stat.mtime,
          path: file.path,
          sourceTags: [],
          tags: memo.tags,
          title: `${memo.day} ${memo.time}`,
        });
      }
    }
  }

  for (const file of app.vault.getMarkdownFiles()) {
    const isAdditional = settings.search.additionalFolders.some((folder) => {
      const normalized = normalizedFolder(folder);
      return (
        Boolean(normalized) &&
        (file.path === normalized || file.path.startsWith(`${normalized}/`))
      );
    });
    if (
      !isAdditional ||
      indexedPaths.has(file.path) ||
      file.path.startsWith(memoPrefix) ||
      isOrganizationProposalPath(file.path, settings.rootFolder)
    ) {
      continue;
    }
    const raw = await app.vault.cachedRead(file);
    if (hasOrganizationProposalMarker(raw)) {
      continue;
    }
    if (parseItem(raw, file.path).item) {
      continue;
    }
    documents.push({
      body: raw,
      id: `external:${file.path}`,
      kind: "external",
      lists: [],
      modified: file.stat.mtime,
      path: file.path,
      sourceTags: [],
      status: isInArchivedContext(file.path, settings.archivedFolders)
        ? "archive"
        : undefined,
      tags: [],
      title: file.path.split("/").pop()?.replace(/\.md$/, "") ?? file.path,
    });
  }
  return documents;
}

function readCachedContent(
  app: App,
  file: TFile,
  contentCache: Map<string, Promise<string>>
): Promise<string> {
  const existing = contentCache.get(file.path);
  if (existing) {
    return existing;
  }
  const content = app.vault.cachedRead(file);
  contentCache.set(file.path, content);
  return content;
}

async function readOrganizationProposals(
  app: App,
  settings: SeitonSettings,
  contentCache: Map<string, Promise<string>>
): Promise<OrganizationProposalDocument[]> {
  const root = normalizedFolder(settings.rootFolder);
  const proposals: OrganizationProposalDocument[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(`${root}/`)) {
      continue;
    }
    const raw = await readCachedContent(app, file, contentCache);
    if (
      !(
        isOrganizationProposalPath(file.path, settings.rootFolder) ||
        hasOrganizationProposalMarker(raw)
      )
    ) {
      continue;
    }
    const document = parseOrganizationProposal(
      file.path,
      raw,
      settings.rootFolder
    );
    if (!document) {
      continue;
    }
    if (document.status !== "invalid") {
      const [operations, holds] = await Promise.all([
        Promise.all(
          document.operations.map(async (operation) => {
            const moved = settings.archiveNoteMoves.find(
              (move) => move.originalPath === operation.source
            );
            const operationType =
              operation.changes.type ?? operation.expected.type;
            const activeMoveFolder =
              operation.changes.status === "active" &&
              (operation.changes.destination ||
                operationType !== operation.expected.type)
                ? (operation.changes.destination ??
                  folderForType(settings, operationType))
                : undefined;
            const activeMovePath = activeMoveFolder
              ? `${activeMoveFolder}/${operation.source.split("/").at(-1) ?? ""}`
              : undefined;
            const sourcePath = moved
              ? moved.archivedPath
              : activeMovePath &&
                  app.vault.getAbstractFileByPath(activeMovePath)
                ? activeMovePath
                : operation.source;
            const currentFile = app.vault.getAbstractFileByPath(sourcePath);
            if (!(currentFile && "extension" in currentFile)) {
              return {
                ...operation,
                applied: false,
                current: null,
                matchesExpected: false,
              };
            }
            const currentContent = await readCachedContent(
              app,
              currentFile as TFile,
              contentCache
            );
            const current = parseItem(currentContent, sourcePath);
            if (!current.item) {
              return {
                ...operation,
                applied: false,
                current: null,
                matchesExpected: false,
              };
            }
            const item = current.item;
            const desiredType =
              operation.changes.type ?? operation.expected.type;
            const desiredTags = operation.changes.tags ?? item.tags ?? [];
            const desiredLists = operation.changes.lists ?? item.lists ?? [];
            const expectedAppliedPath =
              operation.changes.status === "archive"
                ? moved?.archivedPath
                : (activeMovePath ?? operation.source);
            const applied = Boolean(
              expectedAppliedPath === sourcePath &&
                item.type === desiredType &&
                item.status === operation.changes.status &&
                organizationProposalValuesMatch(item.tags ?? [], desiredTags) &&
                organizationProposalValuesMatch(item.lists ?? [], desiredLists)
            );
            let archiveDestination: string | undefined;
            if (operation.changes.status === "archive") {
              if (moved) {
                archiveDestination = moved.archivedPath;
              } else {
                const vaultRoot = normalizedFolder(settings.rootFolder);
                const typeRoot = folderForType(settings, operationType);
                const chosenFolder =
                  operation.changes.destination ??
                  (operationType === operation.expected.type
                    ? ((currentFile as TFile).parent?.path ??
                      sourcePath.split("/").slice(0, -1).join("/"))
                    : typeRoot);
                if (chosenFolder) {
                  const intendedOriginalPath = uniquePath(
                    (candidate) =>
                      candidate !== sourcePath &&
                      app.vault.getAbstractFileByPath(candidate) !== null,
                    `${chosenFolder}/${(currentFile as TFile).name}`
                  );
                  archiveDestination = uniquePath(
                    (candidate) =>
                      app.vault.getAbstractFileByPath(candidate) !== null,
                    archiveNoteDestination(
                      vaultRoot,
                      typeRoot,
                      intendedOriginalPath
                    )
                  );
                }
              }
            }
            return {
              ...operation,
              applied,
              current: {
                ...(archiveDestination ? { archiveDestination } : {}),
                body: current.body.slice(0, 420),
                contentFingerprint:
                  organizationContentFingerprint(currentContent),
                lists: item.lists ?? [],
                path: sourcePath,
                status: item.status,
                tags: item.tags ?? [],
                title: current.title,
                type: item.type,
              },
              matchesExpected:
                item.type === operation.expected.type &&
                item.status === operation.expected.status &&
                organizationProposalValuesMatch(
                  item.tags ?? [],
                  operation.expected.tags
                ) &&
                organizationProposalValuesMatch(
                  item.lists ?? [],
                  operation.expected.lists
                ),
            };
          })
        ),
        Promise.all(
          document.holds.map(async (hold) => {
            const holdFile = app.vault.getAbstractFileByPath(hold.source);
            if (!(holdFile && "extension" in holdFile)) {
              return { ...hold, current: null };
            }
            const currentFile = holdFile as TFile;
            const parsed = parseItem(
              await readCachedContent(app, currentFile, contentCache),
              currentFile.path
            );
            return {
              ...hold,
              current: {
                path: currentFile.path,
                title: parsed.title,
              },
            };
          })
        ),
      ]);
      document.operations = operations;
      document.holds = holds;
      document.results = Object.fromEntries(
        Object.entries(document.results).filter(([operationId, result]) => {
          const operation = operations.find(
            (candidate) => candidate.id === operationId
          );
          return !(operation?.applied === false && result.status === "applied");
        })
      );
      const appliedCount = operations.filter(
        (operation) => operation.applied
      ).length;
      const hasResults = operations.some(
        (operation) => document.results[operation.id]
      );
      document.status =
        operations.length > 0 && appliedCount === operations.length
          ? "applied"
          : hasResults
            ? "partial"
            : "pending";
    }
    proposals.push(document);
  }
  return proposals.sort((left, right) =>
    `${right.created}:${right.path}`.localeCompare(
      `${left.created}:${left.path}`
    )
  );
}

function toBook(
  app: App,
  item: IndexedItem,
  pinnedPaths: Set<string>
): Book | null {
  if (item.item.type !== "reading" || item.item.status === "archive") {
    return null;
  }
  const meta = item.item as Record<string, unknown>;
  const coverPath = typeof meta.bookCover === "string" ? meta.bookCover : "";
  const coverFile = coverPath
    ? app.vault.getAbstractFileByPath(coverPath)
    : null;
  const coverUrl =
    coverFile && typeof coverFile === "object" && "path" in coverFile
      ? app.vault.getResourcePath(coverFile as TFile)
      : coverPath
        ? app.vault.adapter.getResourcePath(coverPath)
        : undefined;
  const rawStatus =
    typeof meta.readingStatus === "string"
      ? meta.readingStatus.toLowerCase()
      : "";
  const hasFinishedDate =
    typeof meta.bookFinished === "string" &&
    meta.bookFinished.trim().length > 0;
  const readingStatus: BookReadingStatus = rawStatus
    ? ["tbr", "to-read", "unread", "未読", "積読"].includes(rawStatus)
      ? "tbr"
      : "read"
    : hasFinishedDate
      ? "read"
      : "tbr";
  return {
    author: typeof meta.bookAuthor === "string" ? meta.bookAuthor : "",
    category:
      typeof meta.bookCategory === "string" && meta.bookCategory.trim()
        ? meta.bookCategory.trim()
        : DEFAULT_BOOK_CATEGORY,
    coverUrl,
    finished:
      typeof meta.bookFinished === "string" ? dateLabel(meta.bookFinished) : "",
    id: item.path,
    isbn: bookIsbnValue(meta.bookIsbn),
    lists: item.item.lists ?? [],
    note: summaryOf(item.body) ?? "",
    ownership: normalizeBookOwnership(meta.bookOwnership),
    pinned: pinnedPaths.has(item.path),
    rating: Number(meta.bookRating ?? 0) || undefined,
    readingStatus,
    series: typeof meta.bookSeries === "string" ? meta.bookSeries : "",
    title: item.title,
  };
}

function isEnabledHomeShortcut(
  shortcut: SeitonSettings["shortcuts"][number],
  settings: SeitonSettings
): boolean {
  if (shortcut.kind !== "view") {
    return true;
  }
  const target = shortcut.target.trim();
  if (target === "bookshelf") {
    return settings.modules.bookshelf;
  }
  if (target === "memo" || target === "memoReview") {
    return settings.modules.memos;
  }
  return true;
}

export async function loadReactProductionData(
  app: App,
  settings: SeitonSettings
): Promise<ReactProductionData> {
  const contentCache = new Map<string, Promise<string>>();
  const indexed = await readIndexedItems(app, settings, contentCache);
  const activeIndexed = indexed.filter(
    (item) => !isInArchivedContext(item.path, settings.archivedFolders)
  );
  const pinnedPaths = new Set(settings.pinned);
  const bookshelfItems = activeIndexed.filter(
    (item) => item.item.status !== "inbox" && item.item.type !== "memo"
  );
  const libraryItems = indexed.filter((item) => item.item.type !== "memo");
  const inbox = activeIndexed
    .filter((item) => item.item.status === "inbox")
    .sort((left, right) => left.item.created.localeCompare(right.item.created));
  const search = await readSearchDocuments(app, settings, indexed);
  const memos = await readMemos(app, settings);
  const pinnedItems = activeIndexed
    .filter(
      (item) =>
        item.item.status !== "archive" && settings.pinned.includes(item.path)
    )
    .map(toHomeInboxItem);
  const listCounts = new Map<string, number>();
  for (const item of activeIndexed) {
    if (item.item.status === "archive") {
      continue;
    }
    for (const name of item.item.lists ?? []) {
      listCounts.set(name, (listCounts.get(name) ?? 0) + 1);
    }
  }
  const lists = [...new Set([...settings.listNames, ...listCounts.keys()])]
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((name) => ({ count: listCounts.get(name) ?? 0, name }));
  const shortcuts = settings.shortcuts
    .filter((shortcut) => isEnabledHomeShortcut(shortcut, settings))
    .map((shortcut, index) => ({
      group: shortcut.group,
      id: `${shortcut.kind}:${shortcut.target}:${index}`,
      initial: shortcutInitial(shortcut.title),
      kind: shortcut.kind,
      target: shortcut.target,
      title: shortcut.title,
    }));
  const proposals = await readOrganizationProposals(
    app,
    settings,
    contentCache
  );
  return {
    archivedFolders: settings.archivedFolders,
    archiveFolderMoves: settings.archiveFolderMoves,
    archiveNoteMoves: settings.archiveNoteMoves,
    books: settings.modules.bookshelf
      ? bookshelfItems
          .map((item) => toBook(app, item, pinnedPaths))
          .filter((book): book is Book => Boolean(book))
      : [],
    home: {
      hiddenSections: hiddenHomeSections(settings),
      inboxItems: inbox.map(toHomeInboxItem),
      lists,
      pinnedItems,
      sectionOrder: homeSectionOrder(settings),
      shortcutGroups: settings.shortcutGroups,
      shortcuts,
      vaultTargets: vaultTargets(
        app,
        settings,
        activeIndexed,
        proposals.map((proposal) => proposal.path)
      ),
    },
    indexed,
    library: libraryItems.map((item) =>
      toLibraryItem(item, pinnedPaths, settings)
    ),
    libraryFolders: libraryFolderPaths(app, settings),
    memos,
    organize: {
      destinations: organizeDestinations(settings),
      frequentTags: mostFrequentTags(
        activeIndexed.map((item) => item.item.tags ?? []),
        5
      ),
      lists: settings.listNames,
      proposals,
      queue: inbox.map((item) => toOrganizeItem(item, pinnedPaths)),
    },
    protectedLibraryFolders: ITEM_TYPES.filter((type) => type !== "memo").map(
      (type) => folderForType(settings, type)
    ),
    search,
  };
}
