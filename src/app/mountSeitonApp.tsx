/** React screen composition. Platform-specific I/O lives under platform/obsidian. */
import { createElement } from "react";
import { calilBookUrl } from "../domain/library";
import type { ObsidianProductionAdapter } from "../platform/obsidian/productionAdapter";
import type { ReactProductionData } from "../platform/obsidian/productionData";
import { ITEM_TYPES } from "../shared/constants";
import { getCreateTypeSections } from "../shared/createTypes";
import { type Lang, t } from "../shared/i18n";
import { isInArchivedContext } from "../shared/library";
import type { SeitonNavigationOptions } from "../shared/navigation";
import { organizationProposalFolder } from "../shared/organizationProposal";
import {
  archiveNoteDestination,
  folderForType,
  normalizeFolder,
  normalizeSubfolder,
} from "../shared/paths";
import type { RankedSearchResult } from "../shared/search";
import { canonicalizeTags } from "../shared/tags";
import type { ItemType, SeitonSettings } from "../shared/types";
import { stopEscapeFromReachingObsidian } from "../ui/escapeBoundary";
import { ReactAddBookForm } from "../ui/patterns/AddBookModal";
import { ReactCoverForm } from "../ui/patterns/CoverModal";
import {
  type BookshelfBulkEditResult,
  type BookshelfBulkUpdate,
  mountReactBookshelfPrototype,
} from "../ui/screens/react-bookshelf-prototype";
import { mountReactCreatePrototype } from "../ui/screens/react-create-prototype";
import {
  type HomeInboxItem,
  mountReactHomePrototype,
} from "../ui/screens/react-home-prototype";
import {
  type LibraryItem,
  mountReactLibraryPrototype,
} from "../ui/screens/react-library-prototype";
import { mountReactMemoPrototype } from "../ui/screens/react-memo-prototype";
import { mountReactOnboardingPrototype } from "../ui/screens/react-onboarding-prototype";
import { mountReactOrganizePrototype } from "../ui/screens/react-organize-prototype";
import { mountReactSearchPrototype } from "../ui/screens/react-search-prototype";
import type { ReactDestination } from "./destination";

export type SeitonAppDestination = ReactDestination | "onboarding";

export interface SeitonAppContext {
  initialCreatePresetId?: string;
  initialCreateType?: ItemType;
  initialLibraryList?: string;
  lang: Lang;
  navigator: {
    open: (
      destination: Exclude<SeitonAppDestination, "onboarding">,
      options?: SeitonNavigationOptions
    ) => Promise<void>;
  };
  platform: ObsidianProductionAdapter;
  saveSettings: () => Promise<void>;
  settings: SeitonSettings;
}

function createTypeFoldersFor(
  settings: SeitonSettings
): Partial<Record<ItemType, string>> {
  return Object.fromEntries(
    ITEM_TYPES.map((type) => [type, folderForType(settings, type)])
  ) as Partial<Record<ItemType, string>>;
}

async function saveCreatePreset(
  context: SeitonAppContext,
  preset: SeitonSettings["pinnedCreatePresets"][number]
): Promise<void> {
  const normalized = {
    ...preset,
    label: preset.label.trim(),
    subfolder: normalizeSubfolder(preset.subfolder),
    tags: canonicalizeTags(preset.tags, context.settings.tagAliases),
  };
  context.settings.pinnedCreatePresets = [
    normalized,
    ...context.settings.pinnedCreatePresets.filter(
      (existing) =>
        existing.id !== normalized.id &&
        !(
          existing.type === normalized.type &&
          existing.subfolder === normalized.subfolder &&
          existing.tags.join("|") === normalized.tags.join("|")
        )
    ),
  ].slice(0, 20);
  await context.saveSettings();
}

async function deleteCreatePreset(
  context: SeitonAppContext,
  presetId: string
): Promise<void> {
  context.settings.pinnedCreatePresets =
    context.settings.pinnedCreatePresets.filter(
      (preset) => preset.id !== presetId
    );
  await context.saveSettings();
}

async function mountWithData(
  root: HTMLElement,
  destination: SeitonAppDestination,
  data: ReactProductionData | undefined,
  context: SeitonAppContext | undefined
): Promise<() => void> {
  const calilUiEnabled = context?.lang === "ja";
  switch (destination) {
    case "home": {
      const createTypeSettings = context
        ? {
            enabledTypes: context.settings.enabledTypes,
            modules: { memos: context.settings.modules.memos },
            pinnedTypes: context.settings.pinnedTypes,
            recentTypes: context.settings.recentTypes,
            typeOrder: context.settings.typeOrder,
          }
        : undefined;
      return mountReactHomePrototype(root, {
        createTypeFolders: context
          ? createTypeFoldersFor(context.settings)
          : undefined,
        createTypeSettings,
        createTypes: context
          ? context.settings.typeOrder.filter((type) =>
              context.settings.enabledTypes.includes(type)
            )
          : undefined,
        inboxItems: data?.home.inboxItems,
        initialHiddenSections: data?.home.hiddenSections,
        initialSectionOrder: data?.home.sectionOrder,
        lang: context?.lang,
        lists: data?.home.lists,
        memoTagOptions: context?.settings.memoTagOptions,
        modules: context
          ? {
              bookshelf: context.settings.modules.bookshelf,
              memos: context.settings.modules.memos,
            }
          : undefined,
        onAddShortcut: context
          ? (title, target, group, kind) =>
              context.platform.addHomeShortcut(
                context.settings,
                title,
                target,
                group,
                kind,
                context.saveSettings
              )
          : undefined,
        onAddShortcutFolder: context
          ? (name) =>
              context.platform.addHomeShortcutFolder(
                context.settings,
                name,
                context.saveSettings
              )
          : undefined,
        onCreateList: context
          ? (name) =>
              context.platform.createHomeList(
                context.settings,
                name,
                context.saveSettings
              )
          : undefined,
        onDeleteCreatePreset: context
          ? (presetId) => deleteCreatePreset(context, presetId)
          : undefined,
        onOpenEntry: context
          ? (entry) =>
              context.platform.openHomeEntry(entry, (targetDestination) =>
                context.navigator.open(targetDestination)
              )
          : undefined,
        onOpenInbox: context
          ? () => context.navigator.open("organize")
          : undefined,
        onOpenInboxItem: context
          ? (item: HomeInboxItem) => {
              if (item.path) {
                context.platform.openPath(item.path);
              }
            }
          : undefined,
        onOpenList: context
          ? (list) =>
              context.navigator.open("library", { libraryList: list.name })
          : undefined,
        onOpenSecondaryItem: context
          ? (item: HomeInboxItem) => {
              if (item.path) {
                context.platform.openPath(item.path);
              }
            }
          : undefined,
        onOpenShortcut: context
          ? (shortcut) =>
              context.platform.openHomeShortcut(shortcut, (targetDestination) =>
                context.navigator.open(targetDestination)
              )
          : undefined,
        onSaveCreatePreset: context
          ? (preset) => saveCreatePreset(context, preset)
          : undefined,
        onSaveMemo: context
          ? (text, tags) =>
              context.platform.saveMemo(context.settings, text, tags)
          : undefined,
        onSaveOrder: context
          ? (sectionOrder, shortcuts, hiddenSections) =>
              context.platform.saveHomeOrder(
                context.settings,
                sectionOrder,
                shortcuts,
                hiddenSections,
                context.saveSettings
              )
          : undefined,
        onSelectCreateType: context
          ? async (type, presetId) => {
              context.settings.recentTypes = [
                type,
                ...context.settings.recentTypes.filter(
                  (value) => value !== type
                ),
              ].slice(0, 5);
              await context.saveSettings();
              const preset = presetId
                ? context.settings.pinnedCreatePresets.find(
                    (value) => value.id === presetId && value.type === type
                  )
                : undefined;
              if (type === "memo") {
                await context.navigator.open("create", {
                  createPresetId: preset?.id,
                  createType: type,
                });
                return;
              }
              await context.platform.createFromHome(
                {
                  subfolder: preset?.subfolder ?? "",
                  tags: preset?.tags ?? [],
                  title: t(context.lang, "new.untitled"),
                  type,
                },
                context.settings
              );
            }
          : undefined,
        onTogglePin: context
          ? (item, pinned) =>
              item.path
                ? context.platform.setItemPinned(
                    context.settings,
                    item.path,
                    pinned,
                    context.saveSettings
                  )
                : Promise.resolve()
          : undefined,
        pinnedCreatePresets: context?.settings.pinnedCreatePresets,
        pinnedItems: data?.home.pinnedItems,
        shortcutGroups: data?.home.shortcutGroups,
        shortcuts: data?.home.shortcuts,
        vaultTargets: data?.home.vaultTargets,
      });
    }
    case "create": {
      const configuredType = context?.initialCreateType;
      const availableTypes = context
        ? (() => {
            const settings = {
              enabledTypes: context.settings.enabledTypes,
              modules: { memos: context.settings.modules.memos },
              pinnedTypes: context.settings.pinnedTypes,
              recentTypes: context.settings.recentTypes,
              typeOrder: context.settings.typeOrder,
            };
            const sections = getCreateTypeSections(settings);
            return [...sections.pinned, ...sections.recent, ...sections.all];
          })()
        : ITEM_TYPES;
      const type =
        configuredType && availableTypes.includes(configuredType)
          ? configuredType
          : (availableTypes[0] ?? "memo");
      const initialPreset = context?.settings.pinnedCreatePresets.find(
        (preset) =>
          preset.id === context.initialCreatePresetId && preset.type === type
      );
      return mountReactCreatePrototype(root, {
        baseFolder: context ? folderForType(context.settings, type) : undefined,
        folderOptions: context
          ? (data?.libraryFolders ?? []).filter(
              (path) =>
                !isInArchivedContext(path, context.settings.archivedFolders)
            )
          : undefined,
        initialPreset,
        lang: context?.lang,
        onBack: context ? () => context.navigator.open("home") : undefined,
        onCreate: context
          ? (input) => context.platform.createFromHome(input, context.settings)
          : undefined,
        onDeletePreset: context
          ? (presetId) => deleteCreatePreset(context, presetId)
          : undefined,
        onSavePreset: context
          ? (preset) => saveCreatePreset(context, preset)
          : undefined,
        pinnedCreatePresets: context?.settings.pinnedCreatePresets,
        type,
      });
    }
    case "library":
      return mountReactLibraryPrototype(root, {
        archivedFolders: data?.archivedFolders,
        archiveFolderMoves: data?.archiveFolderMoves,
        availableLists: context?.settings.listNames,
        folderPaths: data?.libraryFolders,
        initialBrowseMode: context?.settings.libraryBrowseMode,
        initialList: context?.initialLibraryList,
        initialListFoldState: context?.settings.listFoldState,
        initialSort: context?.settings.librarySort,
        initialTagSort: context?.settings.tagSort,
        initialViewMode: context?.settings.libraryViewMode,
        items: data?.library,
        lang: context?.lang,
        manageableFolderRoots: data?.protectedLibraryFolders,
        onArchiveFolder: context
          ? (path: string) =>
              context.platform.archiveLibraryFolder(
                context.settings,
                path,
                context.saveSettings
              )
          : undefined,
        onArchiveItem: context
          ? (item: LibraryItem) =>
              context.platform.archiveLibraryItem(
                context.settings,
                item.path,
                context.saveSettings
              )
          : undefined,
        onCreateFolder: context
          ? (parentPath: string, name: string) =>
              context.platform.createLibraryFolder(
                context.settings,
                parentPath,
                name
              )
          : undefined,
        onMoveItem: context
          ? (item: LibraryItem, destinationFolder: string) =>
              context.platform.moveLibraryItem(
                context.settings,
                item.path,
                destinationFolder,
                context.saveSettings
              )
          : undefined,
        onOpen: context
          ? (item: LibraryItem) => {
              context.platform.openPath(item.id);
            }
          : undefined,
        onRenameFolder: context
          ? (path: string, name: string) =>
              context.platform.renameLibraryFolder(
                context.settings,
                path,
                name,
                context.saveSettings
              )
          : undefined,
        onRestoreFolder: context
          ? (path: string) =>
              context.platform.restoreLibraryFolder(
                context.settings,
                path,
                context.saveSettings
              )
          : undefined,
        onRestoreItem: context
          ? (path: string) =>
              context.platform.restoreLibraryItem(
                context.settings,
                path,
                context.saveSettings
              )
          : undefined,
        onRestoreLegacyItem: context
          ? (path: string) => context.platform.restoreLegacyArchivedItem(path)
          : undefined,
        onSetFolderArchived: context
          ? (path: string, archived: boolean) =>
              context.platform.setLibraryFolderArchived(
                context.settings,
                path,
                archived,
                context.saveSettings
              )
          : undefined,
        onSetLists: context
          ? (item: LibraryItem, lists: string[]) =>
              context.platform.setLibraryLists(item.id, lists)
          : undefined,
        onSettingsChange: context
          ? async (next) => {
              context.settings.libraryBrowseMode = next.browseMode;
              context.settings.librarySort = next.sort;
              context.settings.libraryViewMode = next.viewMode;
              context.settings.listFoldState = next.listFoldState;
              await context.saveSettings();
            }
          : undefined,
        onTogglePin: context
          ? (item: LibraryItem) =>
              context.platform.setItemPinned(
                context.settings,
                item.path,
                Boolean(item.pinned),
                context.saveSettings
              )
          : undefined,
        protectedFolderPaths: context
          ? [
              context.settings.rootFolder.replace(/^\/+|\/+$/g, ""),
              ...(data?.protectedLibraryFolders ?? []),
            ]
          : undefined,
        rootFolder: context
          ? normalizeFolder(context.settings.rootFolder)
          : undefined,
      });
    case "search":
      return mountReactSearchPrototype(root, {
        archiveDestination: context
          ? (result) => {
              const { document } = result;
              if (document.kind !== "note" || !document.type) {
                return "";
              }
              try {
                return archiveNoteDestination(
                  context.settings.rootFolder,
                  folderForType(context.settings, document.type),
                  document.path
                );
              } catch {
                return "";
              }
            }
          : undefined,
        documents: data?.search,
        excludeArchived: context?.settings.excludeArchivedFromSearch,
        history: context?.settings.search.historyEnabled
          ? context.settings.searchHistory
          : [],
        historyEnabled: context?.settings.search.historyEnabled,
        lang: context?.lang,
        listNames: context?.settings.listNames,
        maxHistory: context?.settings.search.maxHistory,
        onArchive: context
          ? async (result) => {
              const move = await context.platform.archiveSearchResult(
                context.settings,
                result,
                context.saveSettings
              );
              return move.archivedPath;
            }
          : undefined,
        onChangeType: context
          ? (result, type) =>
              context.platform.changeSearchType(context.settings, result, type)
          : undefined,
        onOpen: context
          ? (result: RankedSearchResult) => {
              context.platform.openSearchResult(result);
            }
          : undefined,
        onSaveHistory: context?.settings.search.historyEnabled
          ? async (history) => {
              context.settings.searchHistory = history.slice(
                0,
                context.settings.search.maxHistory
              );
              await context.saveSettings();
            }
          : undefined,
        onSetLists: context
          ? (result, lists) => context.platform.setSearchLists(result, lists)
          : undefined,
        onSetTags: context
          ? (result, tags) =>
              context.platform.setSearchTags(context.settings, result, tags)
          : undefined,
        onTogglePin: context
          ? (result) =>
              context.platform.setItemPinned(
                context.settings,
                result.document.path,
                Boolean(result.document.pinned),
                context.saveSettings
              )
          : undefined,
        tagAliases: context?.settings.tagAliases,
        typeOptions: context?.settings.typeOrder,
      });
    case "organize":
      return mountReactOrganizePrototype(root, {
        destinations: data?.organize.destinations,
        frequentTags: data?.organize.frequentTags,
        initialProposals: data?.organize.proposals,
        initialQueue: data?.organize.queue,
        lang: context?.lang,
        lists: data?.organize.lists,
        onApplyProposal: context
          ? (operation) =>
              context.platform.applyProposalOperation(
                context.settings,
                operation.proposalPath,
                operation.operationId,
                operation.fingerprint,
                operation.sourceFingerprint ?? "",
                context.lang,
                context.saveSettings
              )
          : undefined,
        onOpen: context
          ? (item) => {
              context.platform.openPath(item.path);
            }
          : undefined,
        onOpenProposal: context
          ? (path) => context.platform.openPath(path)
          : undefined,
        onOrganize: context
          ? (item, patch) =>
              context.platform.organizeItem(
                item,
                patch,
                context.settings,
                context.saveSettings
              )
          : undefined,
        onReload: context
          ? async () =>
              (await context.platform.loadData(context.settings)).organize.queue
          : undefined,
        onReloadProposals: context
          ? async () =>
              (await context.platform.loadData(context.settings)).organize
                .proposals
          : undefined,
        onTogglePin: context
          ? (item) =>
              context.platform.setItemPinned(
                context.settings,
                item.path,
                Boolean(item.pinned),
                context.saveSettings
              )
          : undefined,
        proposalFolder: context?.lang
          ? organizationProposalFolder(
              context.settings.rootFolder,
              context.lang
            )
          : undefined,
        typeFolderPaths: context
          ? createTypeFoldersFor(context.settings)
          : undefined,
      });
    case "memoReview":
      return mountReactMemoPrototype(root, {
        initialReference: new Date(),
        lang: context?.lang,
        memos: data?.memos,
        onDelete: context
          ? (item) => context.platform.deleteMemo(item, context.settings)
          : undefined,
        onEdit: context
          ? (item, next) =>
              context.platform.editMemo(item, next, context.settings)
          : undefined,
        onKeepAsNote: context
          ? (item) => context.platform.keepMemoAsNote(item, context.settings)
          : undefined,
      });
    case "bookshelf":
      return mountReactBookshelfPrototype(root, {
        addBookContent: context
          ? (close, onRequestResultFocus) =>
              createElement(ReactAddBookForm, {
                gateway: context.platform.bookGateway,
                lang: context.lang,
                notify: context.platform.notify,
                onClose: close,
                onCreated: () => {
                  close();
                  void context.navigator.open("bookshelf");
                },
                onRequestResultFocus,
                settings: context.settings,
              })
          : undefined,
        bookCategories: context?.settings.bookCategories,
        books: data?.books,
        calilCityConfigured:
          calilUiEnabled && context
            ? Boolean(context.settings.calilCity.trim())
            : false,
        calilSearchHistory: calilUiEnabled
          ? context?.settings.calilSearchHistory
          : undefined,
        lang: context?.lang,
        libraryApiConfigured:
          calilUiEnabled && context
            ? Boolean(context.settings.calilAppKey.trim())
            : false,
        listNames: context?.settings.listNames,
        onBulkEditBooks: context
          ? async (
              updates: BookshelfBulkUpdate[]
            ): Promise<BookshelfBulkEditResult> => {
              const results = await Promise.allSettled(
                updates.map((update) =>
                  context.platform.bookGateway.update(
                    update.book.id,
                    update.input,
                    context.settings
                  )
                )
              );
              return {
                failedIds: updates.flatMap((update, index) =>
                  results[index]?.status === "rejected" ? [update.book.id] : []
                ),
                updatedIds: updates.flatMap((update, index) =>
                  results[index]?.status === "fulfilled" ? [update.book.id] : []
                ),
              };
            }
          : undefined,
        onEditBook: context
          ? (book, input) =>
              context.platform.bookGateway
                .update(book.id, input, context.settings)
                .then(() => context.navigator.open("bookshelf"))
          : undefined,
        onLibrarySearchCompleted:
          calilUiEnabled && context
            ? (entry) => {
                context.settings.calilSearchHistory = [
                  entry,
                  ...context.settings.calilSearchHistory.filter(
                    (current) => current.bookId !== entry.bookId
                  ),
                ].slice(0, 20);
                void context.saveSettings();
              }
            : undefined,
        onOpen: context
          ? (book) => {
              void context.platform
                .openBook(book, context.settings)
                .catch(() => {
                  context.platform.notify(t(context.lang, "book.openFailed"));
                });
            }
          : undefined,
        onOpenCalilWeb:
          calilUiEnabled && context
            ? (book) =>
                context.platform.openExternal(calilBookUrl(book.isbn ?? ""))
            : undefined,
        onRemoveCover: context
          ? (book) => {
              void context.platform
                .removeBookCover(book)
                .then(() => context.navigator.open("bookshelf"))
                .catch(() =>
                  context.platform.notify(
                    t(context.lang, "book.coverRemoveFailed")
                  )
                );
            }
          : undefined,
        onSearchLibraries:
          calilUiEnabled && context
            ? (book, options) =>
                context.platform.calilGateway.search(
                  book.isbn ?? "",
                  context.settings,
                  options
                )
            : undefined,
        onSearchLibrariesBatch:
          calilUiEnabled && context
            ? (books, options) =>
                context.platform.calilGateway.searchBatch(
                  books,
                  context.settings,
                  options
                )
            : undefined,
        onSupplement: context
          ? (book) => {
              void context.platform
                .supplementBook(book, context.settings)
                .then(() => context.navigator.open("bookshelf"))
                .catch(() =>
                  context.platform.notify(
                    t(context.lang, "book.supplementFailed")
                  )
                );
            }
          : undefined,
        onTogglePin: context
          ? (book) =>
              context.platform.setItemPinned(
                context.settings,
                book.id,
                Boolean(book.pinned),
                context.saveSettings
              )
          : undefined,
        replaceContent: context
          ? (book, close) => {
              const file = context.platform.fileForBook(book);
              if (!file) {
                return null;
              }
              return createElement(ReactCoverForm, {
                gateway: context.platform.coverGateway,
                lang: context.lang,
                notePath: file.path,
                notify: context.platform.notify,
                onClose: close,
                onSaved: () => void context.navigator.open("bookshelf"),
              });
            }
          : undefined,
      });
    case "onboarding":
      return mountReactOnboardingPrototype(root, { lang: context?.lang });
    default:
      throw new Error(`Unsupported Seiton destination: ${destination}`);
  }
}

export async function mountSeitonApp(
  root: HTMLElement,
  destination: SeitonAppDestination,
  context?: SeitonAppContext
): Promise<() => void> {
  root.replaceChildren();
  root.classList.add("seiton-react-production-host");
  const data = context
    ? await context.platform.loadData(context.settings)
    : undefined;
  const disposeMount = await mountWithData(root, destination, data, context);
  const previousTabIndex = root.getAttribute("tabindex");
  root.setAttribute("tabindex", "-1");
  root.addEventListener("keydown", stopEscapeFromReachingObsidian);
  root.focus({ preventScroll: true });
  return () => {
    root.removeEventListener("keydown", stopEscapeFromReachingObsidian);
    if (previousTabIndex === null) {
      root.removeAttribute("tabindex");
    } else {
      root.setAttribute("tabindex", previousTabIndex);
    }
    disposeMount?.();
    root.classList.remove("seiton-react-production-host");
    root.replaceChildren();
  };
}
