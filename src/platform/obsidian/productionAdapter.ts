import { type App, Notice, TFile, TFolder, type WorkspaceLeaf } from "obsidian";
import {
  destinationFromUiId,
  type ReactDestination,
} from "../../app/destination";
import type { CreateNoteInput } from "../../shared/createTypes";
import {
  parseFrontmatter,
  parseItem,
  rewriteFrontmatter,
} from "../../shared/frontmatter";
import { type Lang, t } from "../../shared/i18n";
import type { MemoEntry } from "../../shared/memoFile";
import {
  type OrganizationProposalResult,
  organizationContentFingerprint,
  organizationProposalOperationFingerprint,
  organizationProposalResultLine,
  organizationProposalValuesMatch,
  parseOrganizationProposal,
} from "../../shared/organizationProposal";
import {
  folderForType,
  memoFilePath,
  normalizeFolder,
} from "../../shared/paths";
import type { RankedSearchResult } from "../../shared/search";
import { canonicalizeTags } from "../../shared/tags";
import type {
  ArchiveFolderMove,
  ArchiveNoteMove,
  HomeSectionKey,
  ItemType,
  SeitonSettings,
  ShortcutKind,
  ShortcutLink,
} from "../../shared/types";
import type { Book } from "../../ui/screens/react-bookshelf-prototype";
import type {
  HomeEntry,
  HomeSectionId,
  HomeShortcut,
} from "../../ui/screens/react-home-prototype";
import type { MemoItem } from "../../ui/screens/react-memo-prototype";
import type {
  OrganizeItem,
  OrganizePatch,
} from "../../ui/screens/react-organize-prototype";
import type { BookGateway, CalilGateway, CoverGateway } from "../ports";
import { fetchBookMetadata, searchBookMetadata } from "./bookApi";
import {
  completeBookMetadata,
  createBookNote,
  ensureBookCoverEmbed,
  findBookNoteByIsbn,
  findSimilarBookNotes,
  removeCachedCover,
  updateBookRecord,
} from "./bookStore";
import { searchCalilLibraries, searchCalilLibrariesBatch } from "./calilApi";
import {
  applyOrganization,
  archiveLibraryFolder,
  archiveLibraryItem,
  changeItemType,
  createLibraryFolder,
  moveLibraryItem,
  openFolder,
  openItem,
  renameLibraryFolder,
  restoreLibraryFolder,
  restoreLibraryItem,
  setItemLists,
  setItemPinned,
  setItemStatus,
  setItemTags,
  setLibraryFolderArchived,
} from "./homeActions";
import { deleteMemo, editMemo, saveMemo } from "./memoStore";
import { createNewNote } from "./noteStore";
import type { ReactProductionData } from "./productionData";

const reusableBookDetailLeaves = new WeakMap<App, WorkspaceLeaf>();

export interface ObsidianProductionAdapter {
  addHomeShortcut: (
    settings: SeitonSettings,
    title: string,
    target: string,
    group: string | undefined,
    kind: ShortcutKind | undefined,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  addHomeShortcutFolder: (
    settings: SeitonSettings,
    name: string,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  applyProposalOperation: (
    settings: SeitonSettings,
    proposalPath: string,
    operationId: string,
    expectedFingerprint: string,
    expectedSourceFingerprint: string,
    lang: Lang,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  archiveLibraryFolder: (
    settings: SeitonSettings,
    path: string,
    saveSettings: () => Promise<void>
  ) => Promise<ArchiveFolderMove>;
  archiveLibraryItem: (
    settings: SeitonSettings,
    path: string,
    saveSettings: () => Promise<void>
  ) => Promise<ArchiveNoteMove>;
  archiveSearchResult: (
    settings: SeitonSettings,
    result: RankedSearchResult,
    saveSettings: () => Promise<void>
  ) => Promise<ArchiveNoteMove>;
  readonly bookGateway: BookGateway;
  readonly calilGateway: CalilGateway;
  changeSearchType: (
    settings: SeitonSettings,
    result: RankedSearchResult,
    type: ItemType
  ) => Promise<string>;
  readonly coverGateway: CoverGateway;
  createFromHome: (
    input: CreateNoteInput,
    settings: SeitonSettings
  ) => Promise<void>;
  createHomeList: (
    settings: SeitonSettings,
    name: string,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  createLibraryFolder: (
    settings: SeitonSettings,
    parentPath: string,
    name: string
  ) => Promise<string>;
  deleteMemo: (item: MemoItem, settings: SeitonSettings) => Promise<void>;
  editMemo: (
    item: MemoItem,
    next: { day: string; time: string; text: string; tags: string[] },
    settings: SeitonSettings
  ) => Promise<string>;
  executeCommand: (id: string) => void;
  fileForBook: (book: Book) => TFile | null;
  keepMemoAsNote: (item: MemoItem, settings: SeitonSettings) => Promise<void>;
  loadData: (settings: SeitonSettings) => Promise<ReactProductionData>;
  moveLibraryItem: (
    settings: SeitonSettings,
    path: string,
    destinationFolder: string,
    saveSettings: () => Promise<void>
  ) => Promise<string>;
  notify: (message: string) => void;
  openBook: (book: Book, settings: SeitonSettings) => Promise<void>;
  openExternal: (url: string) => void;
  openHomeEntry: (
    entry: HomeEntry,
    open: (
      destination: Exclude<ReactDestination, "onboarding">
    ) => Promise<void>
  ) => Promise<void>;
  openHomeShortcut: (
    shortcut: HomeShortcut,
    open: (
      destination: Exclude<ReactDestination, "onboarding">
    ) => Promise<void>
  ) => Promise<void>;
  openPath: (path: string) => void;
  openSearchResult: (result: RankedSearchResult) => void;
  organizeItem: (
    item: OrganizeItem,
    patch: OrganizePatch,
    settings: SeitonSettings,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  removeBookCover: (book: Book, settings: SeitonSettings) => Promise<void>;
  renameLibraryFolder: (
    settings: SeitonSettings,
    path: string,
    name: string,
    saveSettings: () => Promise<void>
  ) => Promise<string>;
  resolveFile: (path: string) => TFile | null;
  restoreLegacyArchivedItem: (path: string) => Promise<void>;
  restoreLibraryFolder: (
    settings: SeitonSettings,
    archivedPath: string,
    saveSettings: () => Promise<void>
  ) => Promise<string>;
  restoreLibraryItem: (
    settings: SeitonSettings,
    archivedPath: string,
    saveSettings: () => Promise<void>
  ) => Promise<string>;
  saveHomeOrder: (
    settings: SeitonSettings,
    sectionOrder: HomeSectionId[],
    shortcuts: HomeShortcut[],
    hiddenSections: HomeSectionId[],
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  saveMemo: (
    settings: SeitonSettings,
    text: string,
    tags: string[]
  ) => Promise<void>;
  setItemPinned: (
    settings: SeitonSettings,
    path: string,
    pinned: boolean,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  setLibraryFolderArchived: (
    settings: SeitonSettings,
    path: string,
    archived: boolean,
    saveSettings: () => Promise<void>
  ) => Promise<void>;
  setLibraryLists: (path: string, lists: string[]) => Promise<void>;
  setSearchLists: (
    result: RankedSearchResult,
    lists: string[]
  ) => Promise<void>;
  setSearchTags: (
    settings: SeitonSettings,
    result: RankedSearchResult,
    tags: string[]
  ) => Promise<void>;
  supplementBook: (book: Book, settings: SeitonSettings) => Promise<void>;
}

function vaultFile(value: unknown): TFile | null {
  if (value instanceof TFile) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as {
    path?: unknown;
    name?: unknown;
    extension?: unknown;
  };
  return typeof candidate.path === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.extension === "string"
    ? (value as TFile)
    : null;
}

export function normalizeShortcut(shortcut: HomeShortcut): ShortcutLink | null {
  const title = shortcut.title.trim();
  const rawTarget = shortcut.target?.trim() ?? "";
  const target =
    shortcut.kind === "url" &&
    rawTarget &&
    !/^[a-z][a-z\d+.-]*:/i.test(rawTarget)
      ? `https://${rawTarget}`
      : rawTarget;
  if (!(title && target)) {
    return null;
  }
  const kind =
    shortcut.kind === "note" ||
    shortcut.kind === "folder" ||
    shortcut.kind === "command" ||
    shortcut.kind === "view"
      ? shortcut.kind
      : "url";
  if (kind === "url") {
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
    } catch {
      return null;
    }
  }
  return { group: shortcut.group?.trim() ?? "", kind, target, title };
}

function destinationForShortcut(
  target: string
): Exclude<ReactDestination, "onboarding"> | null {
  return destinationFromUiId(target);
}

function memoEntryFor(item: MemoItem): MemoEntry {
  return {
    content: item.content,
    day: item.date,
    lineIndex: item.lineIndex ?? -1,
    month: item.month,
    tags: [...item.tags],
    time: item.time,
  };
}

function memoFile(
  adapter: ObsidianProductionAdapter,
  item: MemoItem,
  settings: SeitonSettings
): TFile | null {
  const path =
    item.path ??
    memoFilePath(settings.rootFolder, settings.memosFolder, item.month);
  return adapter.resolveFile(path);
}

function searchResultFile(
  adapter: Pick<ObsidianProductionAdapter, "resolveFile">,
  result: RankedSearchResult,
  lang: Lang
): TFile {
  if (result.document.kind !== "note") {
    throw new Error(t(lang, "adapter.noteNotFound"));
  }
  const file = adapter.resolveFile(result.document.path);
  if (!file) {
    throw new Error(t(lang, "adapter.noteNotFound"));
  }
  return file;
}

function snapshotMatches(
  item: NonNullable<ReturnType<typeof parseItem>["item"]>,
  operation: NonNullable<
    ReturnType<typeof parseOrganizationProposal>
  >["operations"][number],
  expected: boolean
): boolean {
  const snapshot = expected ? operation.expected : operation.changes;
  const tags = snapshot.tags ?? operation.expected.tags;
  const lists = snapshot.lists ?? operation.expected.lists;
  return (
    item.type === (snapshot.type ?? operation.expected.type) &&
    item.status === snapshot.status &&
    organizationProposalValuesMatch(item.tags ?? [], tags) &&
    organizationProposalValuesMatch(item.lists ?? [], lists)
  );
}

export function createObsidianProductionAdapter(
  app: App,
  loadData: (
    app: App,
    settings: SeitonSettings
  ) => Promise<ReactProductionData>,
  getLang: () => Lang = () => "en"
): ObsidianProductionAdapter {
  const openBookPath = async (
    path: string,
    settings: SeitonSettings
  ): Promise<void> => {
    if (!settings.bookDetailTabReuseEnabled) {
      reusableBookDetailLeaves.delete(app);
      await openItem(app, path);
      return;
    }
    let reusableBookDetailLeaf = reusableBookDetailLeaves.get(app);
    const markdownLeaves = app.workspace.getLeavesOfType("markdown");
    if (
      !(
        reusableBookDetailLeaf &&
        markdownLeaves.includes(reusableBookDetailLeaf)
      )
    ) {
      reusableBookDetailLeaf = app.workspace.getLeaf(false);
      reusableBookDetailLeaves.set(app, reusableBookDetailLeaf);
    }
    await openItem(app, path, reusableBookDetailLeaf);
  };

  const appendProposalResult = async (
    proposalFile: TFile,
    result: OrganizationProposalResult
  ): Promise<void> => {
    const content = await app.vault.read(proposalFile);
    const line = organizationProposalResultLine(result);
    await app.vault.append(
      proposalFile,
      `${content.endsWith("\n") ? "" : "\n"}${line}\n`
    );
  };

  const applyProposalOperation = async (
    settings: SeitonSettings,
    proposalPath: string,
    operationId: string,
    expectedFingerprint: string,
    expectedSourceFingerprint: string,
    lang: Lang,
    saveSettings: () => Promise<void>
  ): Promise<void> => {
    const proposalFile = vaultFile(
      app.vault.getAbstractFileByPath(proposalPath)
    );
    if (!proposalFile) {
      throw new Error(t(lang, "organize.proposalInvalid"));
    }
    const proposalRaw = await app.vault.read(proposalFile);
    const proposal = parseOrganizationProposal(
      proposalFile.path,
      proposalRaw,
      settings.rootFolder
    );
    const operation = proposal?.operations.find(
      (entry) => entry.id === operationId
    );
    if (!proposal || proposal.status === "invalid" || !operation) {
      throw new Error(t(lang, "organize.proposalInvalid"));
    }
    const fingerprint = organizationProposalOperationFingerprint(operation);
    if (fingerprint !== expectedFingerprint) {
      throw new Error(t(lang, "adapter.proposalChanged"));
    }
    const priorResult = proposal.results[operationId];
    if (
      priorResult?.fingerprint === fingerprint &&
      priorResult.status === "applied"
    ) {
      throw new Error(t(lang, "organize.proposalAlreadyApplied"));
    }
    const record = async (
      status: OrganizationProposalResult["status"],
      message: string
    ): Promise<void> => {
      await appendProposalResult(proposalFile, {
        at: new Date().toISOString(),
        fingerprint,
        message,
        operationId,
        status,
      });
    };
    const block = async (message: string): Promise<never> => {
      await record("blocked", message);
      throw new Error(message);
    };
    const archivedMove = settings.archiveNoteMoves.find(
      (move) => move.originalPath === operation.source
    );
    const sourcePaths = [archivedMove?.archivedPath, operation.source].filter(
      (path): path is string => Boolean(path)
    );
    const file = sourcePaths
      .map((path) => vaultFile(app.vault.getAbstractFileByPath(path)))
      .find((candidate): candidate is TFile => Boolean(candidate));
    if (!file) {
      return block(t(lang, "organize.proposalMissingSource"));
    }
    const sourceContent = await app.vault.read(file);
    const parsed = parseItem(sourceContent, file.path);
    if (!parsed.item) {
      return block(t(lang, "organize.proposalStale"));
    }
    if (
      !expectedSourceFingerprint ||
      organizationContentFingerprint(sourceContent) !==
        expectedSourceFingerprint
    ) {
      return block(t(lang, "organize.proposalStale"));
    }
    const current = parsed.item;
    const desiredType = operation.changes.type ?? operation.expected.type;
    const desiredTags = canonicalizeTags(
      operation.changes.tags ?? current.tags ?? [],
      settings.tagAliases
    );
    const desiredLists = [
      ...new Set(
        (operation.changes.lists ?? current.lists ?? [])
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];
    const desiredMatches =
      current.type === desiredType &&
      current.status === operation.changes.status &&
      organizationProposalValuesMatch(current.tags ?? [], desiredTags) &&
      organizationProposalValuesMatch(current.lists ?? [], desiredLists) &&
      (operation.changes.status === "archive"
        ? Boolean(archivedMove && file.path === archivedMove.archivedPath)
        : true);
    if (desiredMatches) {
      try {
        await record("applied", t(lang, "organize.proposalAlreadyApplied"));
      } catch {
        // Live source data remains authoritative if the optional result marker cannot be saved.
      }
      return;
    }
    if (!snapshotMatches(current, operation, true)) {
      return block(t(lang, "organize.proposalStale"));
    }
    if (operation.changes.status === "archive" && desiredType === "memo") {
      return block(t(lang, "organize.proposalInvalid"));
    }
    if (operation.changes.destination) {
      const destination = app.vault.getAbstractFileByPath(
        operation.changes.destination
      );
      if (!(destination instanceof TFolder)) {
        return block(t(lang, "organize.proposalStale"));
      }
    }
    const targetType = desiredType;
    const typeChanged = targetType !== current.type;
    const destinationFolder = operation.changes.destination;
    if (
      operation.changes.status === "active" &&
      (typeChanged || destinationFolder)
    ) {
      const targetFolder =
        destinationFolder ?? folderForType(settings, targetType);
      const targetPath = `${normalizeFolder(targetFolder)}/${file.name}`;
      const collision = app.vault.getAbstractFileByPath(targetPath);
      if (targetPath !== file.path && collision) {
        return block(t(lang, "organize.proposalStale"));
      }
    }
    try {
      await applyOrganization(
        app,
        file,
        {
          destinationPath: destinationFolder,
          lists: desiredLists,
          status: operation.changes.status,
          tags: desiredTags,
          type: targetType,
          typeChanged,
        },
        settings,
        saveSettings,
        expectedSourceFingerprint
      );
    } catch {
      return block(t(lang, "organize.proposalApplyFailed"));
    }
    try {
      await record("applied", t(lang, "organize.proposalAppliedResult"));
    } catch {
      // The source is already updated. The next load derives completion from live data.
    }
  };

  const bookGateway: BookGateway = {
    create: (input, settings) => createBookNote(app, input, settings),
    fetch: (isbn) => fetchBookMetadata(isbn),
    findByIsbn: async (isbn) =>
      (await findBookNoteByIsbn(app, isbn))?.path ?? null,
    findSimilar: (title, author) => findSimilarBookNotes(app, title, author),
    search: (query) => searchBookMetadata(query),
    update: (bookPath, input, settings) => {
      const file = vaultFile(app.vault.getAbstractFileByPath(bookPath));
      if (!file) {
        throw new Error(t(getLang(), "adapter.bookNotFound"));
      }
      return updateBookRecord(app, file, input, settings);
    },
  };
  const coverGateway: CoverGateway = {
    save: async (notePath, coverPath) => {
      const file = vaultFile(app.vault.getAbstractFileByPath(notePath));
      if (!file) {
        throw new Error(t(getLang(), "adapter.coverNoteNotFound"));
      }
      const raw = await app.vault.read(file);
      const frontmatter = parseFrontmatter(raw);
      if (!frontmatter) {
        throw new Error(t(getLang(), "adapter.frontmatterMissing"));
      }
      const next = rewriteFrontmatter(raw, { bookCover: coverPath });
      if (!next) {
        throw new Error(t(getLang(), "adapter.frontmatterInvalid"));
      }
      await app.vault.modify(file, next);
      await ensureBookCoverEmbed(app, file);
    },
  };
  const adapter: ObsidianProductionAdapter = {
    async addHomeShortcut(settings, title, target, group, kind, saveSettings) {
      const shortcut = normalizeShortcut({
        group: group ?? "",
        id: `shortcut-${Date.now()}`,
        initial: Array.from(title.trim())[0] ?? "・",
        kind: kind ?? "url",
        meta: "URL",
        target,
        title,
      });
      if (!shortcut) {
        throw new Error(t(getLang(), "adapter.shortcutInvalid"));
      }
      settings.shortcuts = [...settings.shortcuts, shortcut];
      if (shortcut.group) {
        settings.shortcutGroups = [
          ...new Set([...settings.shortcutGroups, shortcut.group]),
        ];
      }
      await saveSettings();
    },
    async addHomeShortcutFolder(settings, rawName, saveSettings) {
      const name = rawName.trim();
      if (!name) {
        throw new Error(t(getLang(), "adapter.shortcutGroupEmpty"));
      }
      if (settings.shortcutGroups.includes(name)) {
        throw new Error(t(getLang(), "adapter.shortcutGroupExists"));
      }
      settings.shortcutGroups = [...settings.shortcutGroups, name];
      await saveSettings();
    },
    applyProposalOperation,
    archiveLibraryFolder: (settings, path, saveSettings) =>
      archiveLibraryFolder(app, settings, path, saveSettings),
    archiveLibraryItem: (settings, path, saveSettings) =>
      archiveLibraryItem(app, settings, path, saveSettings),
    async archiveSearchResult(settings, result, saveSettings) {
      const file = searchResultFile(adapter, result, getLang());
      return archiveLibraryItem(app, settings, file.path, saveSettings);
    },
    bookGateway,
    calilGateway: {
      search: (isbn, settings, options) =>
        searchCalilLibraries(isbn, settings, options),
      searchBatch: (books, settings, options) =>
        searchCalilLibrariesBatch(books, settings, options),
    },
    async changeSearchType(settings, result, type) {
      const file = searchResultFile(adapter, result, getLang());
      return changeItemType(app, file, type, settings);
    },
    coverGateway,
    async createFromHome(input, settings) {
      const tags = canonicalizeTags(input.tags, settings.tagAliases);
      if (input.type === "memo") {
        await saveMemo(
          app.vault,
          {
            memosFolder: settings.memosFolder,
            rootFolder: settings.rootFolder,
          },
          input.title,
          new Date(),
          tags
        );
        return;
      }
      const file = await createNewNote(app.vault, {
        destinationFolder: input.destinationFolder,
        settings,
        subfolder: input.subfolder,
        tags,
        title: input.title,
        type: input.type,
      });
      adapter.openPath(file.path);
    },
    async createHomeList(settings, rawName, saveSettings) {
      const name = rawName.trim();
      if (!name) {
        throw new Error(t(getLang(), "adapter.listNameEmpty"));
      }
      if (settings.listNames.includes(name)) {
        throw new Error(t(getLang(), "adapter.listNameExists"));
      }
      settings.listNames = [...settings.listNames, name];
      await saveSettings();
    },
    createLibraryFolder: (settings, parentPath, name) =>
      createLibraryFolder(app, settings, parentPath, name),
    async deleteMemo(item, settings) {
      const file = memoFile(adapter, item, settings);
      if (!file || item.lineIndex === undefined || item.lineIndex < 0) {
        throw new Error(t(getLang(), "adapter.memoMissing"));
      }
      await deleteMemo(
        app.vault,
        file,
        memoEntryFor(item),
        settings,
        (recoveryFile) => app.fileManager.trashFile(recoveryFile)
      );
    },
    async editMemo(item, next, settings) {
      const file = memoFile(adapter, item, settings);
      if (!file || item.lineIndex === undefined || item.lineIndex < 0) {
        throw new Error(t(getLang(), "adapter.memoMissing"));
      }
      return await editMemo(app.vault, file, memoEntryFor(item), next, {
        memosFolder: settings.memosFolder,
        rootFolder: settings.rootFolder,
      });
    },
    executeCommand: (id) => {
      const commands = (
        app as App & {
          commands?: { executeCommandById: (id: string) => boolean };
        }
      ).commands;
      commands?.executeCommandById(id);
    },
    fileForBook: (book) => adapter.resolveFile(book.id),
    async keepMemoAsNote(item, settings) {
      const file = await createNewNote(app.vault, {
        settings,
        title: item.content.slice(0, 60),
        type: "idea",
      });
      const tags =
        item.tags.length > 0
          ? `\n\n${item.tags.map((tag) => `#${tag}`).join(" ")}`
          : "";
      await app.vault.append(file, `\n${item.content}${tags}\n`);
      adapter.openPath(file.path);
    },
    loadData: (settings) => loadData(app, settings),
    moveLibraryItem: (settings, path, destinationFolder, saveSettings) =>
      moveLibraryItem(app, settings, path, destinationFolder, saveSettings),
    notify: (message) => {
      // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
      new Notice(message);
    },
    openBook: async (book, settings) => {
      const file = adapter.fileForBook(book);
      if (file) {
        const coverReady = await ensureBookCoverEmbed(app, file);
        if (!coverReady && book.isbn && settings.bookCoverCacheEnabled) {
          const metadata = await fetchBookMetadata(book.isbn);
          if (metadata) {
            await completeBookMetadata(app, file, metadata, settings);
          }
        }
        await ensureBookCoverEmbed(app, file);
        await openBookPath(file.path, settings);
        return;
      }
      await openBookPath(book.id, settings);
    },
    openExternal: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    openHomeEntry: (entry, open) => {
      const destination = destinationFromUiId(entry.id);
      return destination ? open(destination) : Promise.resolve();
    },
    openHomeShortcut: (shortcut, open) => {
      const normalized = normalizeShortcut(shortcut);
      if (!normalized) {
        return Promise.resolve();
      }
      if (normalized.kind === "view") {
        const destination = destinationForShortcut(normalized.target);
        return destination ? open(destination) : Promise.resolve();
      }
      if (normalized.kind === "url") {
        window.open(normalized.target, "_blank", "noopener,noreferrer");
        return Promise.resolve();
      }
      if (normalized.kind === "command") {
        adapter.executeCommand(normalized.target);
        return Promise.resolve();
      }
      if (normalized.kind === "folder") {
        openFolder(app, normalized.target);
        return Promise.resolve();
      }
      adapter.openPath(normalized.target);
      return Promise.resolve();
    },
    openPath: (path) => {
      void openItem(app, path);
    },
    openSearchResult: (result) => adapter.openPath(result.document.path),
    async organizeItem(item, patch, settings, saveSettings) {
      const file = adapter.resolveFile(item.path);
      if (!file) {
        throw new Error(
          t(getLang(), "adapter.organizationItemMissing", { path: item.path })
        );
      }
      const destinationPreset = patch.destinationId
        ? settings.pinnedCreatePresets.find(
            (preset) => preset.id === patch.destinationId
          )
        : undefined;
      if (patch.destinationId && !destinationPreset) {
        throw new Error(t(getLang(), "adapter.presetMissing"));
      }
      if (destinationPreset && destinationPreset.type !== patch.type) {
        throw new Error(t(getLang(), "adapter.presetTypeMismatch"));
      }
      await applyOrganization(
        app,
        file,
        {
          destination: destinationPreset,
          lists: patch.lists,
          status: patch.status,
          tags: patch.tags,
          type: patch.type as ItemType,
          typeChanged: patch.typeChanged,
        },
        settings,
        saveSettings
      );
    },
    async removeBookCover(book, settings) {
      const file = adapter.fileForBook(book);
      if (file) {
        await removeCachedCover(app, file, settings.rootFolder);
      }
    },
    renameLibraryFolder: (settings, path, name, saveSettings) =>
      renameLibraryFolder(app, settings, path, name, saveSettings),
    resolveFile: (path) => vaultFile(app.vault.getAbstractFileByPath(path)),
    async restoreLegacyArchivedItem(path) {
      const file = vaultFile(app.vault.getAbstractFileByPath(path));
      if (!file) {
        throw new Error(t(getLang(), "adapter.archiveNoteMissing"));
      }
      const parsed = parseItem(await app.vault.read(file), file.path);
      if (parsed.item?.status !== "archive") {
        throw new Error(t(getLang(), "adapter.archiveStatusInvalid"));
      }
      await setItemStatus(file, "active", app.vault);
    },
    restoreLibraryFolder: (settings, archivedPath, saveSettings) =>
      restoreLibraryFolder(app, settings, archivedPath, saveSettings),
    restoreLibraryItem: (settings, archivedPath, saveSettings) =>
      restoreLibraryItem(app, settings, archivedPath, saveSettings),
    async saveHomeOrder(
      settings,
      sectionOrder,
      shortcuts,
      hiddenSections,
      saveSettings
    ) {
      const sectionKeys: Record<HomeSectionId, HomeSectionKey[]> = {
        capture: ["capture"],
        entries: ["today"],
        inbox: ["inbox"],
        secondary: ["pinned", "lists", "tags"],
        shortcuts: ["shortcuts"],
      };
      settings.homeSectionOrder = sectionOrder.flatMap(
        (section) => sectionKeys[section]
      );
      settings.hiddenHomeSections = [
        ...new Set(
          hiddenSections.flatMap((section) => sectionKeys[section] ?? [])
        ),
      ];
      settings.shortcuts = shortcuts
        .map(normalizeShortcut)
        .filter((shortcut): shortcut is ShortcutLink => Boolean(shortcut));
      settings.shortcutGroups = [
        ...new Set([
          ...settings.shortcutGroups,
          ...settings.shortcuts
            .map((shortcut) => shortcut.group)
            .filter(Boolean),
        ]),
      ];
      await saveSettings();
    },
    saveMemo: (settings, text, tags) =>
      saveMemo(
        app.vault,
        { memosFolder: settings.memosFolder, rootFolder: settings.rootFolder },
        text,
        new Date(),
        canonicalizeTags(tags, settings.tagAliases)
      ),
    setItemPinned: (settings, path, pinned, saveSettings) =>
      setItemPinned(settings, path, pinned, saveSettings),
    setLibraryFolderArchived: (settings, path, archived, saveSettings) =>
      setLibraryFolderArchived(settings, path, archived, saveSettings),
    async setLibraryLists(path, lists) {
      const file = adapter.resolveFile(path);
      if (!file) {
        throw new Error(t(getLang(), "adapter.noteNotFound"));
      }
      await setItemLists(file, lists, app.vault);
    },
    async setSearchLists(result, lists) {
      const file = searchResultFile(adapter, result, getLang());
      await setItemLists(file, lists, app.vault);
    },
    async setSearchTags(settings, result, tags) {
      const file = searchResultFile(adapter, result, getLang());
      await setItemTags(file, tags, settings.tagAliases, app.vault);
    },
    async supplementBook(book, settings) {
      const file = adapter.fileForBook(book);
      if (!(file && book.isbn)) {
        return;
      }
      const metadata = await fetchBookMetadata(book.isbn);
      if (!metadata) {
        throw new Error(t(getLang(), "adapter.metadataMissing"));
      }
      await completeBookMetadata(app, file, metadata, settings);
    },
  };
  return adapter;
}

export { ITEM_TYPES } from "../../shared/constants";
