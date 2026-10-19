/**
 * パス構築ヘルパー（純関数・Obsidian非依存）
 * フォルダ名は言語中立・設定で変更可（spec: 決定32・23・9）。
 */

import { formatMonthKey } from "./date";
import { safeFilename } from "./sanitize";
import type { ItemType, TypeFolders } from "./types";

export type SubfolderValidationReason = "parent-directory" | "invalid-name";

export class SubfolderValidationError extends Error {
  constructor(readonly reason: SubfolderValidationReason) {
    super(
      reason === "parent-directory"
        ? "サブフォルダに親ディレクトリは指定できません"
        : "有効なサブフォルダ名を入力してください"
    );
    this.name = "SubfolderValidationError";
  }
}

/** パス区切りを正規化して末尾スラッシュを除去 */
export function normalizeFolder(folder: string): string {
  return folder.replace(/\/+$/, "").replace(/^\/+/, "");
}

/**
 * タイプ別フォルダ配下の文脈を、共通アーカイブ配下へ移すときの保存先。
 * 例: Seiton/classes/2024 → Seiton/archive/classes/2024
 */
export function archiveFolderDestination(
  rootFolder: string,
  typeRoot: string,
  folderPath: string
): string {
  const root = normalizeFolder(rootFolder);
  const normalizedTypeRoot = normalizeFolder(typeRoot);
  const normalizedFolder = normalizeFolder(folderPath);
  if (
    !(root && normalizedTypeRoot) ||
    normalizedFolder === normalizedTypeRoot ||
    !normalizedFolder.startsWith(`${normalizedTypeRoot}/`)
  ) {
    throw new Error("タイプ別フォルダ内のサブフォルダを選択してください");
  }
  const relativeFolder = normalizedFolder.slice(normalizedTypeRoot.length + 1);
  const typeFolder = normalizedTypeRoot.split("/").at(-1);
  if (!(relativeFolder && typeFolder)) {
    throw new Error("アーカイブ先を決定できません");
  }
  return `${root}/archive/${typeFolder}/${relativeFolder}`;
}

/** Individual-note archive path, separate from archived context folders. */
export function archiveNoteDestination(
  rootFolder: string,
  typeRoot: string,
  notePath: string
): string {
  const root = normalizeFolder(rootFolder);
  const normalizedTypeRoot = normalizeFolder(typeRoot);
  const normalizedNote = normalizeFolder(notePath);
  const typeFolder = normalizedTypeRoot.split("/").at(-1);
  if (
    !(root && typeFolder && isVaultPathWithin(normalizedNote, root)) ||
    normalizedNote.endsWith("/")
  ) {
    throw new Error("Seiton内のノートを指定してください");
  }
  const relativePath = isVaultPathWithin(normalizedNote, normalizedTypeRoot)
    ? normalizedNote.slice(normalizedTypeRoot.length + 1)
    : normalizedNote.slice(root.length + 1);
  if (!relativePath) {
    throw new Error("アーカイブ先を決定できません");
  }
  return `${root}/archive/${typeFolder}/notes/${relativePath}`;
}

function isVaultPathWithin(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

/**
 * タイプ別フォルダ内のサブフォルダを正規化する。
 * ルートをまたぐ指定や親ディレクトリ参照は許可しない。
 */
export function normalizeSubfolder(subfolder: string): string {
  const input = subfolder.trim().replace(/\\/g, "/");
  if (!input) {
    return "";
  }
  const parts = input
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new SubfolderValidationError("parent-directory");
  }
  const safeParts = parts.map((part) => safeFilename(part, ""));
  if (safeParts.some((part) => !part)) {
    throw new SubfolderValidationError("invalid-name");
  }
  return safeParts.join("/");
}

/** フォルダ管理UIで使う単一階層の名前を正規化する。 */
export function normalizeFolderName(name: string): string {
  const input = name.trim().replace(/\\/g, "/");
  if (!input || input.includes("/") || input === "." || input === "..") {
    throw new SubfolderValidationError("invalid-name");
  }
  const normalized = safeFilename(input, "");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new SubfolderValidationError("invalid-name");
  }
  return normalized;
}

/** タイプ別フォルダのデフォルト名（英語・言語中立・設定で変更可・決定32） */
export const DEFAULT_TYPE_FOLDERS: TypeFolders = {
  article: "articles",
  class: "classes",
  collection: "collections",
  idea: "ideas",
  profile: "profiles",
  project: "projects",
  reading: "readings",
  task: "tasks",
  webclip: "clips",
};

export interface NoteFolderOptions {
  memosFolder: string;
  rootFolder: string;
  typeFolders?: Partial<TypeFolders>;
}

/** タイプの保存先フォルダ（memo は memosFolder と共通） */
export function folderForType(opts: NoteFolderOptions, type: ItemType): string {
  const root = normalizeFolder(opts.rootFolder);
  if (type === "memo") {
    return `${root}/${normalizeFolder(opts.memosFolder)}`;
  }
  const name = opts.typeFolders?.[type] ?? DEFAULT_TYPE_FOLDERS[type];
  return `${root}/${normalizeFolder(name)}`;
}

/** タイプ別フォルダを親にした、作成先フォルダを返す。 */
export function newNoteFolder(
  opts: NoteFolderOptions,
  type: ItemType,
  subfolder = ""
): string {
  const base = folderForType(opts, type);
  const nested = normalizeSubfolder(subfolder);
  return nested ? `${base}/${nested}` : base;
}

/** 既存パスと衝突しないパスを返す（「タイトル 2.md」の連番・決定22） */
export function uniquePath(
  exists: (path: string) => boolean,
  path: string
): string {
  if (!exists(path)) {
    return path;
  }
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  const ext = dot > slash ? path.slice(dot) : "";
  const base = ext ? path.slice(0, dot) : path;
  let i = 2;
  while (exists(`${base} ${i}${ext}`)) {
    i++;
  }
  return `${base} ${i}${ext}`;
}

/** 新規ノートの保存先を決める純関数（Vaultを必要としない）。 */
export function newNotePath(
  exists: (path: string) => boolean,
  options: NoteFolderOptions & {
    type: ItemType;
    title: string;
    subfolder?: string;
  }
): string {
  const folder = newNoteFolder(options, options.type, options.subfolder);
  return uniquePath(
    exists,
    `${folder}/${safeFilename(options.title, "Untitled")}.md`
  );
}

/** つぶやき月ファイルのパス（例: Seiton/Memos/2026-08.md） */
export function memoFilePath(
  root: string,
  memosFolder: string,
  month: string
): string {
  return `${normalizeFolder(root)}/${normalizeFolder(memosFolder)}/${month}.md`;
}

/** 期間タブで読み込む月ファイルの月キー一覧（現在月 + 前月 + 翌月） */
export function monthsForPeriod(ref: Date): string[] {
  const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return [formatMonthKey(prev), formatMonthKey(ref), formatMonthKey(next)];
}
