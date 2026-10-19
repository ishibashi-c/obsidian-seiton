/**
 * 新規ノート作成ストア（spec §5「+新規」フロー）
 * タイプに応じたフォルダ準備+テンプレートfrontmatter付きノート生成。
 */
import { TFile, type Vault } from "obsidian";
import { isInArchivedContext, isWithinFolder } from "../../shared/library";
import { buildNewNote } from "../../shared/noteTemplates";
import {
  folderForType,
  normalizeFolder,
  normalizeSubfolder,
  uniquePath,
} from "../../shared/paths";
import { safeFilename } from "../../shared/sanitize";
import type { ItemType, SeitonSettings } from "../../shared/types";
import { ensureFolder } from "./vaultUtils";

export interface NewNoteOptions {
  destinationFolder?: string;
  now?: Date;
  settings: Pick<
    SeitonSettings,
    | "rootFolder"
    | "memosFolder"
    | "typeFolders"
    | "templates"
    | "archivedFolders"
  >;
  subfolder?: string;
  tags?: readonly string[];
  title: string;
  type: ItemType;
}

/** 新規ノートを保存先フォルダまで準備して作成する。 */
export async function createNewNote(
  vault: Vault,
  options: NewNoteOptions
): Promise<TFile> {
  const typeRoot = normalizeFolder(
    folderForType(options.settings, options.type)
  );
  const rawDestination = normalizeFolder(options.destinationFolder ?? typeRoot);
  if (!isWithinFolder(rawDestination, typeRoot)) {
    throw new Error("保存先は選択したタイプのフォルダ内にしてください");
  }
  const relativeDestination = rawDestination
    .slice(typeRoot.length)
    .replace(/^\/+/, "");
  const normalizedDestination = relativeDestination
    ? `${typeRoot}/${normalizeSubfolder(relativeDestination)}`
    : typeRoot;
  const nestedFolder = normalizeSubfolder(options.subfolder ?? "");
  const folder = nestedFolder
    ? `${normalizedDestination}/${nestedFolder}`
    : normalizedDestination;
  if (isInArchivedContext(folder, options.settings.archivedFolders)) {
    throw new Error("アーカイブ済みフォルダには作成できません");
  }
  const path = uniquePath(
    (value) => vault.getAbstractFileByPath(value) !== null,
    `${folder}/${safeFilename(options.title, "Untitled")}.md`
  );
  await ensureFolder(vault, folder);
  const content = buildNewNote(
    options.type,
    options.title,
    (options.now ?? new Date()).toISOString(),
    options.settings.templates,
    options.tags
  );
  await vault.create(path, content);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new Error(`Created note was not found: ${path}`);
  }
  return file;
}
