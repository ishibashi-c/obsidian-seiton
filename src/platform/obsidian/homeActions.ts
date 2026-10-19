/**
 * ホームのカード操作（spec: 6章・決定40・45・26）
 * frontmatterの論理的な変更と保存先フォルダへの移動・Obsidian依存。
 */

import { type App, TFile, TFolder, type WorkspaceLeaf } from "obsidian";
import { ITEM_TYPES } from "../../shared/constants";
import { parseFrontmatter, rewriteFrontmatter } from "../../shared/frontmatter";
import {
  isInArchivedContext,
  isWithinFolder,
  rewriteFolderPath,
} from "../../shared/library";
import {
  isOrganizationProposalPath,
  organizationContentFingerprint,
} from "../../shared/organizationProposal";
import {
  archiveFolderDestination,
  archiveNoteDestination,
  folderForType,
  newNoteFolder,
  normalizeFolder,
  normalizeFolderName,
  uniquePath,
} from "../../shared/paths";
import {
  canonicalTag,
  normalizeTagInput,
  toggleInList,
} from "../../shared/tags";
import type {
  ArchiveFolderMove,
  ArchiveNoteMove,
  ItemStatus,
  ItemType,
  SeitonSettings,
} from "../../shared/types";
import { ensureFolder } from "./vaultUtils";

function assertNoteIsRestoredBeforeEditing(
  settings: SeitonSettings,
  path: string
): void {
  if (
    settings.archiveNoteMoves.some(
      (move) => normalizeFolder(move.archivedPath) === normalizeFolder(path)
    )
  ) {
    throw new Error("アーカイブしたノートは復元してから変更してください");
  }
}

/** 現在のfrontmatterを更新（戻り値: 変更したか） */
async function updateFrontmatter(
  file: TFile,
  patch: Record<string, unknown>,
  vault?: App["vault"],
  content?: string
): Promise<boolean> {
  const fileVault = vault ?? (file as TFile & { vault: App["vault"] }).vault;
  const current = content ?? (await fileVault.read(file));
  const next = rewriteFrontmatter(current, patch);
  if (next === null || next === current) {
    return false;
  }
  await fileVault.modify(file, next);
  return true;
}

/** タグをtoggle（エイリアスは正規タグに変換） */
export async function toggleItemTag(
  file: TFile,
  raw: string,
  aliases: Record<string, string[]>,
  vault?: App["vault"]
): Promise<void> {
  const tag = canonicalTag(normalizeTagInput(raw), aliases);
  if (tag.length === 0) {
    return;
  }
  const fileVault = vault ?? file.vault;
  const content = await fileVault.read(file);
  const fm = parseFrontmatter(content);
  if (!fm) {
    return;
  }
  const current = Array.isArray(fm.data.tags) ? fm.data.tags.map(String) : [];
  await updateFrontmatter(
    file,
    { tags: toggleInList(current, tag) },
    fileVault,
    content
  );
}

/** タグを直接設定（タグ編集UI・保存時に正規化） */
export async function setItemTags(
  file: TFile,
  tags: string[],
  aliases: Record<string, string[]>,
  vault?: App["vault"]
): Promise<void> {
  const fileVault = vault ?? file.vault;
  const current = await fileVault.read(file);
  const fm = parseFrontmatter(current);
  if (!fm) {
    return;
  }
  const normalized = [
    ...new Set(
      tags
        .map((t) => canonicalTag(normalizeTagInput(t), aliases))
        .filter(Boolean)
    ),
  ];
  await updateFrontmatter(file, { tags: normalized }, fileVault, current);
}

/** リストをtoggle */
export async function toggleItemList(
  file: TFile,
  name: string,
  vault?: App["vault"]
): Promise<void> {
  const fileVault = vault ?? file.vault;
  const content = await fileVault.read(file);
  const fm = parseFrontmatter(content);
  if (!fm) {
    return;
  }
  const current = Array.isArray(fm.data.lists) ? fm.data.lists.map(String) : [];
  await updateFrontmatter(
    file,
    { lists: toggleInList(current, name.trim()) },
    fileVault,
    content
  );
}

/** リストを直接設定（検索・整理の保存時に使用） */
export async function setItemLists(
  file: TFile,
  lists: string[],
  vault?: App["vault"]
): Promise<void> {
  const fileVault = vault ?? file.vault;
  const current = await fileVault.read(file);
  const fm = parseFrontmatter(current);
  if (!fm) {
    return;
  }
  const normalized = [
    ...new Set(lists.map((value) => value.trim()).filter(Boolean)),
  ];
  await updateFrontmatter(file, { lists: normalized }, fileVault, current);
}

/** 項目をホームのピン留めへ追加・解除する（frontmatterは変更しない）。 */
export async function setItemPinned(
  settings: SeitonSettings,
  path: string,
  pinned: boolean,
  saveSettings: () => Promise<void>
): Promise<void> {
  const normalized = path.trim();
  if (!normalized) {
    return;
  }
  const current = new Set(settings.pinned);
  if (pinned) {
    current.add(normalized);
  } else {
    current.delete(normalized);
  }
  settings.pinned = [...current];
  await saveSettings();
}

function libraryTypeRoots(settings: SeitonSettings): string[] {
  return ITEM_TYPES.filter((type) => type !== "memo").map((type) =>
    normalizeFolder(folderForType(settings, type))
  );
}

function isSafeStoredVaultPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return Boolean(
    normalized &&
      !normalized.startsWith("/") &&
      !normalized.split("/").some((part) => part === "." || part === "..") &&
      normalizeFolder(normalized)
  );
}

function managedTypeRoot(
  path: string,
  settings: SeitonSettings
): string | null {
  const normalizedPath = normalizeFolder(path);
  return (
    libraryTypeRoots(settings).find((root) =>
      isWithinFolder(normalizedPath, root)
    ) ?? null
  );
}

function assertManageableFolder(
  path: string,
  settings: SeitonSettings
): string {
  const root = managedTypeRoot(path, settings);
  if (!root || normalizeFolder(path) === root) {
    throw new Error("タイプの保存先フォルダ自体は変更できません");
  }
  return root;
}

/** 設定内に保存しているVaultパスを、Obsidianのフォルダ名変更に追従させる。 */
export function rewriteSettingsPaths(
  settings: SeitonSettings,
  previousFolder: string,
  nextFolder: string,
  updateCreatePresets = true
): boolean {
  const referencesSnapshot = (): string =>
    JSON.stringify([
      settings.archivedFolders,
      settings.archiveFolderMoves,
      settings.archiveNoteMoves,
      settings.pinned,
      settings.search.additionalFolders,
      settings.richCardFolders,
      settings.shortcuts,
      ...(updateCreatePresets ? [settings.pinnedCreatePresets] : []),
    ]);
  const previousReferences = referencesSnapshot();
  settings.archivedFolders = settings.archivedFolders.map((path) =>
    rewriteFolderPath(path, nextFolder, previousFolder)
  );
  settings.archiveFolderMoves = settings.archiveFolderMoves.map((move) => ({
    ...move,
    archivedPath: rewriteFolderPath(
      move.archivedPath,
      nextFolder,
      previousFolder
    ),
    originalPath: rewriteFolderPath(
      move.originalPath,
      nextFolder,
      previousFolder
    ),
  }));
  settings.archiveNoteMoves = settings.archiveNoteMoves.map((move) => ({
    ...move,
    archivedPath: rewriteFolderPath(
      move.archivedPath,
      nextFolder,
      previousFolder
    ),
    originalPath: rewriteFolderPath(
      move.originalPath,
      nextFolder,
      previousFolder
    ),
  }));
  settings.pinned = settings.pinned.map((path) =>
    rewriteFolderPath(path, nextFolder, previousFolder)
  );
  settings.search.additionalFolders = settings.search.additionalFolders.map(
    (path) => rewriteFolderPath(path, nextFolder, previousFolder)
  );
  settings.richCardFolders = settings.richCardFolders.map((path) =>
    rewriteFolderPath(path, nextFolder, previousFolder)
  );
  settings.shortcuts = settings.shortcuts.map((shortcut) =>
    shortcut.kind === "folder" || shortcut.kind === "note"
      ? {
          ...shortcut,
          target: rewriteFolderPath(
            shortcut.target,
            nextFolder,
            previousFolder
          ),
        }
      : shortcut
  );

  if (!updateCreatePresets) {
    return previousReferences !== referencesSnapshot();
  }
  settings.pinnedCreatePresets = settings.pinnedCreatePresets.map((preset) => {
    const typeRoot = normalizeFolder(folderForType(settings, preset.type));
    if (!isWithinFolder(previousFolder, typeRoot)) {
      return preset;
    }
    const previousSubfolder = previousFolder
      .slice(typeRoot.length)
      .replace(/^\/+/, "");
    const nextSubfolder = rewriteFolderPath(
      preset.subfolder,
      nextFolder.slice(typeRoot.length).replace(/^\/+/, ""),
      previousSubfolder
    );
    return { ...preset, subfolder: nextSubfolder };
  });
  return previousReferences !== referencesSnapshot();
}

/** タイプフォルダ配下に分類用フォルダを作る。 */
export async function createLibraryFolder(
  app: App,
  settings: SeitonSettings,
  parentPath: string,
  rawName: string
): Promise<string> {
  const parent = normalizeFolder(parentPath);
  if (!managedTypeRoot(parent, settings)) {
    throw new Error("タイプの保存先フォルダ内でフォルダを作成してください");
  }
  if (isInArchivedContext(parent, settings.archivedFolders)) {
    throw new Error("アーカイブ済みフォルダには作成できません");
  }
  const name = normalizeFolderName(rawName);
  const path = `${parent}/${name}`;
  if (app.vault.getAbstractFileByPath(path)) {
    throw new Error("同じ名前のフォルダが既にあります");
  }
  await ensureFolder(app.vault, parent);
  await app.vault.createFolder(path);
  return path;
}

/** 空でないフォルダも含めて安全に名前を変更し、関連する設定パスも更新する。 */
export async function renameLibraryFolder(
  app: App,
  settings: SeitonSettings,
  path: string,
  rawName: string,
  saveSettings: () => Promise<void>
): Promise<string> {
  const previousFolder = normalizeFolder(path);
  const typeRoot = assertManageableFolder(previousFolder, settings);
  if (!isWithinFolder(previousFolder, typeRoot)) {
    throw new Error("管理対象外のフォルダです");
  }
  const folder = app.vault.getAbstractFileByPath(previousFolder);
  if (!(folder instanceof TFolder)) {
    throw new Error("フォルダが見つかりません");
  }
  const name = normalizeFolderName(rawName);
  const parent = folder.parent?.path ?? "";
  const nextFolder = `${parent ? `${parent}/` : ""}${name}`;
  if (nextFolder === previousFolder) {
    return previousFolder;
  }
  if (app.vault.getAbstractFileByPath(nextFolder)) {
    throw new Error("同じ名前のファイルまたはフォルダが既にあります");
  }
  const previousSettings = {
    archivedFolders: settings.archivedFolders,
    archiveFolderMoves: settings.archiveFolderMoves,
    archiveNoteMoves: settings.archiveNoteMoves,
    pinned: settings.pinned,
    pinnedCreatePresets: settings.pinnedCreatePresets,
    richCardFolders: settings.richCardFolders,
    searchAdditionalFolders: settings.search.additionalFolders,
    shortcuts: settings.shortcuts,
  };
  await app.fileManager.renameFile(folder, nextFolder);
  try {
    rewriteSettingsPaths(settings, previousFolder, nextFolder);
    await saveSettings();
    return nextFolder;
  } catch (error) {
    if (folder.path === nextFolder) {
      await app.fileManager
        .renameFile(folder, previousFolder)
        .catch(() => undefined);
    }
    settings.archiveFolderMoves = previousSettings.archiveFolderMoves;
    settings.archiveNoteMoves = previousSettings.archiveNoteMoves;
    settings.archivedFolders = previousSettings.archivedFolders;
    settings.pinned = previousSettings.pinned;
    settings.pinnedCreatePresets = previousSettings.pinnedCreatePresets;
    settings.richCardFolders = previousSettings.richCardFolders;
    settings.search.additionalFolders =
      previousSettings.searchAdditionalFolders;
    settings.shortcuts = previousSettings.shortcuts;
    throw error;
  }
}

/** 文脈フォルダをタイプ別領域から専用アーカイブへ移し、復元先を記録する。 */
export async function archiveLibraryFolder(
  app: App,
  settings: SeitonSettings,
  path: string,
  saveSettings: () => Promise<void>
): Promise<ArchiveFolderMove> {
  const target = normalizeFolder(path);
  const typeRoot = assertManageableFolder(target, settings);
  const type = ITEM_TYPES.find(
    (candidate) =>
      candidate !== "memo" &&
      normalizeFolder(folderForType(settings, candidate)) === typeRoot
  );
  if (!type || type === "memo") {
    throw new Error("タイプを特定できません");
  }
  const folder = app.vault.getAbstractFileByPath(target);
  if (!(folder instanceof TFolder)) {
    throw new Error("アーカイブするフォルダが見つかりません");
  }
  const hasMove = settings.archiveFolderMoves.some(
    (archiveMove) => normalizeFolder(archiveMove.archivedPath) === target
  );
  const isLegacyMarker = settings.archivedFolders.some(
    (candidatePath) => normalizeFolder(candidatePath) === target
  );
  const overlappingMarker = settings.archivedFolders.some((candidatePath) => {
    const normalized = normalizeFolder(candidatePath);
    return (
      normalized !== target &&
      (isWithinFolder(normalized, target) || isWithinFolder(target, normalized))
    );
  });
  if (
    hasMove ||
    overlappingMarker ||
    (isInArchivedContext(target, settings.archivedFolders) && !isLegacyMarker)
  ) {
    throw new Error(
      "既にアーカイブ済み、または別のアーカイブを含むフォルダです"
    );
  }

  const archivedPath = archiveFolderDestination(
    settings.rootFolder,
    typeRoot,
    target
  );
  if (app.vault.getAbstractFileByPath(archivedPath)) {
    throw new Error("アーカイブ先に同じフォルダが既にあります");
  }

  const move: ArchiveFolderMove = {
    archivedPath,
    originalPath: target,
    type,
  };
  const previousArchivedFolders = [...settings.archivedFolders];
  const previousMoves = [...settings.archiveFolderMoves];
  await ensureFolder(
    app.vault,
    archivedPath.slice(0, archivedPath.lastIndexOf("/"))
  );
  try {
    await app.fileManager.renameFile(folder, archivedPath);
    rewriteSettingsPaths(settings, target, archivedPath, false);
    settings.archivedFolders = [
      ...new Set([...settings.archivedFolders, archivedPath]),
    ];
    settings.archiveFolderMoves = [...settings.archiveFolderMoves, move];
    await saveSettings();
    return move;
  } catch (error) {
    if (folder.path === archivedPath) {
      await app.fileManager.renameFile(folder, target).catch(() => undefined);
      rewriteSettingsPaths(settings, archivedPath, target, false);
    }
    settings.archivedFolders = previousArchivedFolders;
    settings.archiveFolderMoves = previousMoves;
    throw error;
  }
}

/** 専用アーカイブから記録済みの元フォルダへ戻す。 */
export async function restoreLibraryFolder(
  app: App,
  settings: SeitonSettings,
  archivedPath: string,
  saveSettings: () => Promise<void>
): Promise<string> {
  const normalizedArchivePath = normalizeFolder(archivedPath);
  const move = settings.archiveFolderMoves.find(
    (candidate) =>
      normalizeFolder(candidate.archivedPath) === normalizedArchivePath
  );
  if (!move) {
    throw new Error("復元するアーカイブの記録が見つかりません");
  }
  const originalPath = normalizeFolder(move.originalPath);
  if (
    !(ITEM_TYPES.includes(move.type) && originalPath) ||
    originalPath === normalizedArchivePath ||
    originalPath.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("アーカイブの移動元と移動先の記録が一致しません");
  }
  const folder = app.vault.getAbstractFileByPath(normalizedArchivePath);
  if (!(folder instanceof TFolder)) {
    throw new Error("アーカイブフォルダが見つかりません");
  }
  if (app.vault.getAbstractFileByPath(originalPath)) {
    throw new Error("元の場所に同じ名前のファイルまたはフォルダがあります");
  }

  const previousArchivedFolders = [...settings.archivedFolders];
  const previousMoves = [...settings.archiveFolderMoves];
  try {
    await ensureFolder(
      app.vault,
      originalPath.slice(0, originalPath.lastIndexOf("/"))
    );
    await app.fileManager.renameFile(folder, originalPath);
    settings.archiveFolderMoves = settings.archiveFolderMoves.filter(
      (candidate) =>
        normalizeFolder(candidate.archivedPath) !== normalizedArchivePath
    );
    rewriteSettingsPaths(settings, normalizedArchivePath, originalPath, false);
    settings.archivedFolders = settings.archivedFolders.filter(
      (path) => normalizeFolder(path) !== originalPath
    );
    await saveSettings();
    return originalPath;
  } catch (error) {
    if (folder.path === originalPath) {
      await app.fileManager
        .renameFile(folder, normalizedArchivePath)
        .catch(() => undefined);
      rewriteSettingsPaths(
        settings,
        originalPath,
        normalizedArchivePath,
        false
      );
    }
    settings.archivedFolders = previousArchivedFolders;
    settings.archiveFolderMoves = previousMoves;
    throw error;
  }
}

/** @deprecated 既存の印だけ付いたアーカイブを整理する互換操作。新規アーカイブには使わない。 */
export async function setLibraryFolderArchived(
  settings: SeitonSettings,
  path: string,
  archived: boolean,
  saveSettings: () => Promise<void>
): Promise<void> {
  const target = normalizeFolder(path);
  assertManageableFolder(target, settings);
  const current = new Set(settings.archivedFolders.map(normalizeFolder));
  if (archived) {
    if (isInArchivedContext(target, [...current])) {
      return;
    }
    current.add(target);
  } else {
    current.delete(target);
  }
  settings.archivedFolders = [...current];
  await saveSettings();
}

/** ノートを同じtypeの保存先内で移動し、Vaultリンクとピン留めを保つ。 */
export async function moveLibraryItem(
  app: App,
  settings: SeitonSettings,
  path: string,
  destinationFolder: string,
  saveSettings: () => Promise<void>
): Promise<string> {
  const file = app.vault.getAbstractFileByPath(path);
  if (
    !file ||
    typeof file !== "object" ||
    !("path" in file) ||
    !("name" in file) ||
    !("extension" in file)
  ) {
    throw new Error("移動するノートが見つかりません");
  }
  assertNoteIsRestoredBeforeEditing(settings, file.path as string);
  const content = await app.vault.read(file as TFile);
  const fm = parseFrontmatter(content);
  if (!fm || typeof fm.data.type !== "string") {
    throw new Error("ノートのタイプを確認できません");
  }
  const type = fm.data.type as ItemType;
  if (!ITEM_TYPES.includes(type) || type === "memo") {
    throw new Error("このタイプのノートは移動できません");
  }
  const typeRoot = normalizeFolder(folderForType(settings, type));
  const destination = normalizeFolder(destinationFolder);
  if (
    !isWithinFolder(destination, typeRoot) ||
    isInArchivedContext(destination, settings.archivedFolders)
  ) {
    throw new Error("移動先は現在のタイプの未アーカイブフォルダにしてください");
  }
  const targetPath = uniquePath(
    (candidate) =>
      candidate !== file.path &&
      app.vault.getAbstractFileByPath(candidate) !== null,
    `${destination}/${file.name}`
  );
  if (targetPath === file.path) {
    return file.path;
  }
  await ensureFolder(app.vault, destination);
  const previousPinned = [...settings.pinned];
  const previousShortcuts = settings.shortcuts;
  await app.fileManager.renameFile(file as TFile, targetPath);
  const wasPinned = settings.pinned.includes(path);
  let settingsChanged = false;
  if (wasPinned) {
    settings.pinned = settings.pinned.map((pinnedPath) =>
      pinnedPath === path ? targetPath : pinnedPath
    );
    settingsChanged = true;
  }
  const nextShortcuts = settings.shortcuts.map((shortcut) =>
    shortcut.kind === "note" && shortcut.target === path
      ? { ...shortcut, target: targetPath }
      : shortcut
  );
  if (
    nextShortcuts.some(
      (shortcut, index) => shortcut !== settings.shortcuts[index]
    )
  ) {
    settings.shortcuts = nextShortcuts;
    settingsChanged = true;
  }
  try {
    if (settingsChanged) {
      await saveSettings();
    }
  } catch (error) {
    if (file.path === targetPath) {
      await app.fileManager
        .renameFile(file as TFile, path)
        .catch(() => undefined);
    }
    settings.pinned = previousPinned;
    settings.shortcuts = previousShortcuts;
    throw error;
  }
  return targetPath;
}

/** status 変更（アーカイブ/解除・物理移動しない） */
export async function setItemStatus(
  file: TFile,
  status: ItemStatus,
  vault?: App["vault"]
): Promise<void> {
  await updateFrontmatter(file, { status }, vault);
}

export interface OrganizationPatch {
  /** 整理画面で選んだ保存先プリセット。選択時は既定タグも追加する。 */
  destination?: {
    subfolder: string;
    tags: string[];
    type: ItemType;
  };
  /** Existing same-type folder selected by an external-agent proposal. */
  destinationPath?: string;
  lists: string[];
  status: "active" | "archive";
  tags: string[];
  type: ItemType;
  /** タグ中心の整理ではfalse。trueのときだけタイプ別フォルダへ移動する。 */
  typeChanged: boolean;
}

async function writeOrganizationContent(
  app: App,
  file: TFile,
  nextContent: string,
  expectedFingerprint?: string
): Promise<void> {
  if (!expectedFingerprint) {
    await app.vault.modify(file, nextContent);
    return;
  }
  await app.vault.process(file, (current) => {
    if (organizationContentFingerprint(current) !== expectedFingerprint) {
      throw new Error("整理対象のノートが確認後に変更されています");
    }
    return nextContent;
  });
}

/** 整理画面の入力を一度に反映し、未知frontmatterキーと本文を保持する。 */
export async function applyOrganization(
  app: App,
  file: TFile,
  patch: OrganizationPatch,
  settings: SeitonSettings,
  saveSettings: () => Promise<void>,
  expectedContentFingerprint?: string
): Promise<void> {
  assertNoteIsRestoredBeforeEditing(settings, file.path);
  const content = await app.vault.read(file);
  const fm = parseFrontmatter(content);
  if (!fm) {
    return;
  }
  if (patch.destination && patch.destination.type !== patch.type) {
    throw new Error("保存先プリセットとタイプが一致しません");
  }
  const tags = [
    ...new Set(
      [...(patch.destination?.tags ?? []), ...patch.tags]
        .map((tag) => canonicalTag(normalizeTagInput(tag), settings.tagAliases))
        .filter(Boolean)
    ),
  ];
  const frontmatterPatch: Record<string, unknown> = {
    lists: [...new Set(patch.lists)],
    status: patch.status,
    tags,
  };
  if (patch.typeChanged) {
    frontmatterPatch.type = patch.type;
  }
  const targetType = patch.destination?.type ?? patch.type;
  const destinationPath = patch.destinationPath
    ? normalizeFolder(patch.destinationPath)
    : undefined;
  let destinationFolder: string | undefined;
  if (destinationPath) {
    destinationFolder = destinationPath;
  } else if (patch.destination) {
    destinationFolder = newNoteFolder(
      settings,
      patch.destination.type,
      patch.destination.subfolder
    );
  } else if (patch.typeChanged) {
    destinationFolder = folderForType(settings, patch.type);
  }

  if (destinationFolder) {
    const typeRoot = normalizeFolder(folderForType(settings, targetType));
    if (
      !isWithinFolder(normalizeFolder(destinationFolder), typeRoot) ||
      isInArchivedContext(destinationFolder, settings.archivedFolders)
    ) {
      throw new Error(
        "保存先は現在のタイプの未アーカイブフォルダにしてください"
      );
    }
    if (
      destinationPath &&
      !(app.vault.getAbstractFileByPath(destinationPath) instanceof TFolder)
    ) {
      throw new Error("整理案の保存先フォルダが見つかりません");
    }
  }

  if (patch.status === "archive") {
    await archiveLibraryItem(app, settings, file.path, saveSettings, {
      destinationFolder,
      expectedContentFingerprint,
      lists: patch.lists,
      tags,
      type: patch.typeChanged ? patch.type : undefined,
    });
    return;
  }

  const nextContent = rewriteFrontmatter(content, frontmatterPatch);
  if (nextContent === null) {
    throw new Error("frontmatter invalid");
  }
  // タグだけの整理では、未整理フォルダから物理移動しない。
  // 保存先プリセットを選んだ場合だけ、同じタイプでも指定先へ移動する。
  // アーカイブも保存先を変えず、statusだけで検索・表示から制御する。
  if (!(patch.typeChanged || patch.destination || destinationPath)) {
    await writeOrganizationContent(
      app,
      file,
      nextContent,
      expectedContentFingerprint
    );
    return;
  }
  const currentType = fm.data.type;
  const folder = destinationFolder ?? folderForType(settings, targetType);
  const currentParent = file.parent?.path ?? "";
  // タイプが同じでも、未整理フォルダや選択した分類先から移動する必要がある。
  if (currentType === targetType && currentParent === folder) {
    await writeOrganizationContent(
      app,
      file,
      nextContent,
      expectedContentFingerprint
    );
    return;
  }
  await ensureFolder(app.vault, folder);
  const destination = uniquePath(
    (path) =>
      path !== file.path && app.vault.getAbstractFileByPath(path) !== null,
    `${folder}/${file.name}`
  );
  if (destination === file.path) {
    await writeOrganizationContent(
      app,
      file,
      nextContent,
      expectedContentFingerprint
    );
  } else {
    const previousPath = file.path;
    const previousPinned = [...settings.pinned];
    const previousShortcuts = settings.shortcuts;
    await app.fileManager.renameFile(file, destination);
    try {
      await writeOrganizationContent(
        app,
        file,
        nextContent,
        expectedContentFingerprint
      );
    } catch (error) {
      if (file.path === destination) {
        await app.fileManager
          .renameFile(file, previousPath)
          .catch(() => undefined);
      }
      throw error;
    }
    const nextPinned = settings.pinned.map((path) =>
      path === previousPath ? destination : path
    );
    const nextShortcuts = settings.shortcuts.map((shortcut) =>
      shortcut.kind === "note" && shortcut.target === previousPath
        ? { ...shortcut, target: destination }
        : shortcut
    );
    const settingsChanged =
      nextPinned.some((path, index) => path !== settings.pinned[index]) ||
      nextShortcuts.some(
        (shortcut, index) => shortcut !== settings.shortcuts[index]
      );
    settings.pinned = nextPinned;
    settings.shortcuts = nextShortcuts;
    try {
      if (settingsChanged) {
        await saveSettings();
      }
    } catch (error) {
      if (file.path === destination) {
        await app.fileManager
          .renameFile(file, previousPath)
          .catch(() => undefined);
      }
      if ((await app.vault.read(file).catch(() => "")) === nextContent) {
        await app.vault.modify(file, content).catch(() => undefined);
      }
      settings.pinned = previousPinned;
      settings.shortcuts = previousShortcuts;
      throw error;
    }
  }
}

interface ArchiveNoteOptions {
  destinationFolder?: string;
  expectedContentFingerprint?: string;
  lists?: string[];
  tags?: string[];
  type?: ItemType;
}

/** Move one note into the dedicated archive and retain enough state to restore it. */
export async function archiveLibraryItem(
  app: App,
  settings: SeitonSettings,
  path: string,
  saveSettings: () => Promise<void>,
  options: ArchiveNoteOptions = {}
): Promise<ArchiveNoteMove> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new Error("アーカイブするノートが見つかりません");
  }
  const content = await app.vault.read(file);
  const fm = parseFrontmatter(content);
  if (!fm || typeof fm.data.type !== "string") {
    throw new Error("ノートのタイプを確認できません");
  }
  const type = options.type ?? (fm.data.type as ItemType);
  if (!ITEM_TYPES.includes(type) || type === "memo") {
    throw new Error("このタイプのノートはアーカイブできません");
  }
  const previousStatus = fm.data.status;
  if (previousStatus !== "active" && previousStatus !== "inbox") {
    throw new Error("既にアーカイブ済みか、状態を確認できません");
  }
  if (
    settings.archiveNoteMoves.some(
      (archiveMove) => archiveMove.originalPath === file.path
    )
  ) {
    throw new Error("このノートは既にアーカイブ済みです");
  }

  const root = normalizeFolder(settings.rootFolder);
  const archiveRoot = `${root}/archive`;
  if (
    file.path === archiveRoot ||
    isWithinFolder(file.path, archiveRoot) ||
    isOrganizationProposalPath(file.path, root)
  ) {
    throw new Error("整理案またはアーカイブ内のノートは移動できません");
  }

  const typeRoot = normalizeFolder(folderForType(settings, type));
  const chosenFolder = options.destinationFolder
    ? normalizeFolder(options.destinationFolder)
    : options.type
      ? typeRoot
      : (file.parent?.path ?? "");
  if (
    !(chosenFolder && isWithinFolder(chosenFolder, root)) ||
    (options.destinationFolder &&
      (!(
        isWithinFolder(chosenFolder, typeRoot) &&
        app.vault.getAbstractFileByPath(chosenFolder) instanceof TFolder
      ) ||
        isInArchivedContext(chosenFolder, settings.archivedFolders)))
  ) {
    throw new Error(
      "アーカイブ先はSeiton内の未アーカイブフォルダにしてください"
    );
  }

  const intendedOriginalPath = uniquePath(
    (candidate) =>
      candidate !== file.path &&
      app.vault.getAbstractFileByPath(candidate) !== null,
    `${chosenFolder}/${file.name}`
  );
  const archivedPath = uniquePath(
    (candidate) => app.vault.getAbstractFileByPath(candidate) !== null,
    archiveNoteDestination(root, typeRoot, intendedOriginalPath)
  );
  const nextContent = rewriteFrontmatter(content, {
    ...(options.lists ? { lists: [...new Set(options.lists)] } : {}),
    ...(options.tags ? { tags: [...new Set(options.tags)] } : {}),
    status: "archive",
    ...(options.type ? { type: options.type } : {}),
  });
  if (nextContent === null) {
    throw new Error("frontmatter invalid");
  }

  const move: ArchiveNoteMove = {
    archivedPath,
    originalPath: intendedOriginalPath,
    previousStatus,
    type,
  };
  const previousMoves = [...settings.archiveNoteMoves];
  const previousPinned = [...settings.pinned];
  const previousShortcuts = settings.shortcuts;
  await ensureFolder(
    app.vault,
    archivedPath.slice(0, archivedPath.lastIndexOf("/"))
  );
  try {
    await app.fileManager.renameFile(file, archivedPath);
    await writeOrganizationContent(
      app,
      file,
      nextContent,
      options.expectedContentFingerprint
    );
    settings.archiveNoteMoves = [...settings.archiveNoteMoves, move];
    settings.pinned = settings.pinned.map((pinnedPath) =>
      pinnedPath === path ? archivedPath : pinnedPath
    );
    settings.shortcuts = settings.shortcuts.map((shortcut) =>
      shortcut.kind === "note" && shortcut.target === path
        ? { ...shortcut, target: archivedPath }
        : shortcut
    );
    await saveSettings();
    return move;
  } catch (error) {
    if (file.path === archivedPath) {
      await app.fileManager.renameFile(file, path).catch(() => undefined);
      if ((await app.vault.read(file).catch(() => "")) === nextContent) {
        await app.vault.modify(file, content).catch(() => undefined);
      }
    }
    settings.archiveNoteMoves = previousMoves;
    settings.pinned = previousPinned;
    settings.shortcuts = previousShortcuts;
    throw error;
  }
}

/** Restore an archived note to its recorded location without overwriting an existing file. */
export async function restoreLibraryItem(
  app: App,
  settings: SeitonSettings,
  archivedPath: string,
  saveSettings: () => Promise<void>
): Promise<string> {
  const move = settings.archiveNoteMoves.find(
    (candidate) =>
      normalizeFolder(candidate.archivedPath) === normalizeFolder(archivedPath)
  );
  if (!move) {
    throw new Error("復元するアーカイブの記録が見つかりません");
  }
  if (
    !(
      isSafeStoredVaultPath(move.archivedPath) &&
      isSafeStoredVaultPath(move.originalPath)
    ) ||
    move.archivedPath === move.originalPath
  ) {
    throw new Error("アーカイブの移動先と復元先の記録が一致しません");
  }
  const file = app.vault.getAbstractFileByPath(move.archivedPath);
  if (!(file instanceof TFile)) {
    throw new Error("アーカイブされたノートが見つかりません");
  }
  if (app.vault.getAbstractFileByPath(move.originalPath)) {
    throw new Error("元の場所に同じ名前のファイルまたはフォルダがあります");
  }
  const content = await app.vault.read(file);
  const fm = parseFrontmatter(content);
  if (fm?.data.status !== "archive") {
    throw new Error("アーカイブ状態を確認できません");
  }
  const nextContent = rewriteFrontmatter(content, {
    status: move.previousStatus,
  });
  if (nextContent === null) {
    throw new Error("frontmatter invalid");
  }
  const previousMoves = [...settings.archiveNoteMoves];
  const previousPinned = [...settings.pinned];
  const previousShortcuts = settings.shortcuts;
  await ensureFolder(
    app.vault,
    move.originalPath.slice(0, move.originalPath.lastIndexOf("/"))
  );
  try {
    await app.fileManager.renameFile(file, move.originalPath);
    await app.vault.modify(file, nextContent);
  } catch (error) {
    if (file.path === move.originalPath) {
      await app.fileManager
        .renameFile(file, move.archivedPath)
        .catch(() => undefined);
      await app.vault.modify(file, content).catch(() => undefined);
    }
    settings.archiveNoteMoves = previousMoves;
    settings.pinned = previousPinned;
    settings.shortcuts = previousShortcuts;
    throw error;
  }

  settings.archiveNoteMoves = settings.archiveNoteMoves.filter(
    (candidate) => candidate.archivedPath !== move.archivedPath
  );
  settings.pinned = settings.pinned.map((pinnedPath) =>
    pinnedPath === move.archivedPath ? move.originalPath : pinnedPath
  );
  settings.shortcuts = settings.shortcuts.map((shortcut) =>
    shortcut.kind === "note" && shortcut.target === move.archivedPath
      ? { ...shortcut, target: move.originalPath }
      : shortcut
  );
  try {
    await saveSettings();
  } catch {
    try {
      await saveSettings();
    } catch (retryError) {
      const restoreError = new Error(
        "復元済みですが、設定の保存に失敗しました"
      );
      Object.defineProperty(restoreError, "cause", { value: retryError });
      throw restoreError;
    }
  }
  return move.originalPath;
}

/**
 * type変更（全9type間で自由に変更可・保存先フォルダも移動・決定45）
 * frontmatter更新後にファイルを移動（リンクは fileManager が更新）。
 */
export async function changeItemType(
  app: App,
  file: TFile,
  type: ItemType,
  settings: SeitonSettings
): Promise<string> {
  assertNoteIsRestoredBeforeEditing(settings, file.path);
  const content = await app.vault.read(file);
  const fm = parseFrontmatter(content);
  if (!fm) {
    return file.path;
  }
  const folder = folderForType(settings, type);
  const currentParent = file.parent?.path ?? "";
  if (fm.data.type === type && currentParent === folder) {
    return file.path;
  }
  if (currentParent === folder) {
    await updateFrontmatter(file, { type }, app.vault);
    return file.path;
  }
  await ensureFolder(app.vault, folder);
  const dest = uniquePath(
    (p) => app.vault.getAbstractFileByPath(p) !== null,
    `${folder}/${file.name}`
  );
  await updateFrontmatter(file, { type }, app.vault);
  if (dest !== file.path) {
    await app.fileManager.renameFile(file, dest);
    return dest;
  }
  return file.path;
}

/** ノートをObsidianのleafで開く */
export async function openItem(
  app: App,
  path: string,
  targetLeaf?: WorkspaceLeaf
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    const leaf = targetLeaf ?? app.workspace.getLeaf(false);
    await leaf.openFile(file);
    if (targetLeaf) {
      await app.workspace.revealLeaf(targetLeaf);
    }
    return;
  }
  // Harnessや互換VaultではTFileのconstructor identityが異なることがある。
  // ファイル形状を確認したうえで同じObsidian APIへ渡し、UIとVaultの境界を切らない。
  if (
    file &&
    typeof file === "object" &&
    "path" in file &&
    "name" in file &&
    "extension" in file
  ) {
    const leaf = targetLeaf ?? app.workspace.getLeaf(false);
    await leaf.openFile(file as TFile);
    if (targetLeaf) {
      await app.workspace.revealLeaf(targetLeaf);
    }
  }
}

/** フォルダをObsidianのファイルエクスプローラで表示する。 */
export function openFolder(app: App, path: string): void {
  const folder = app.vault.getAbstractFileByPath(path);
  if (!(folder instanceof TFolder)) {
    return;
  }
  const leaf = app.workspace.getLeavesOfType("file-explorer")[0];
  if (!leaf) {
    return;
  }
  void app.workspace.revealLeaf(leaf);
  const view = leaf.view as typeof leaf.view & {
    revealInFolder?: (target: TFolder) => void;
    setFolder?: (target: string) => void;
  };
  view.revealInFolder?.(folder);
  view.setFolder?.(folder.path);
}
