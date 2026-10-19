import { TFile, type Vault } from "obsidian";
import { formatDayKey, formatMonthKey, formatTime } from "../../shared/date";
import {
  appendMemo,
  buildMonthFrontmatter,
  type MemoEntry,
  parseMonthFile,
  removeMemo,
  updateMemo,
} from "../../shared/memoFile";
import { memoFilePath, normalizeFolder, uniquePath } from "../../shared/paths";
import type { MonthBodyLine, MonthFile } from "../../shared/types";

export interface MemoStoreOptions {
  memosFolder: string;
  rootFolder: string;
}

/** つぶやきフォルダ内の月ファイル一覧 */
export function readMonthFiles(
  vault: Vault,
  options: MemoStoreOptions
): TFile[] {
  const prefix = `${normalizeFolder(options.rootFolder)}/${normalizeFolder(options.memosFolder)}/`;
  return vault
    .getMarkdownFiles()
    .filter((file) => file.path.startsWith(prefix));
}

/** 月ファイルを読み込んでパースする（壊れたファイルは除外） */
export async function loadMonthFiles(
  vault: Vault,
  options: MemoStoreOptions
): Promise<MonthFile[]> {
  const files = readMonthFiles(vault, options);
  const parsed = await Promise.all(
    files.map(async (file) => parseMonthFile(await vault.read(file)))
  );
  return parsed.filter((file): file is MonthFile => file !== null);
}

/** つぶやきを当月ファイルに追記する（ファイルがなければ作成） */
export async function saveMemo(
  vault: Vault,
  options: MemoStoreOptions,
  text: string,
  now = new Date(),
  tags: string[] = []
): Promise<void> {
  const month = formatMonthKey(now);
  const path = memoFilePath(options.rootFolder, options.memosFolder, month);
  const existing = vault.getAbstractFileByPath(path);
  const current =
    existing instanceof TFile
      ? await vault.read(existing)
      : buildMonthFrontmatter(month);
  const next = appendMemo(
    current,
    formatDayKey(now),
    formatTime(now),
    text,
    tags
  );
  if (existing instanceof TFile) {
    await vault.modify(existing, next);
  } else {
    const root = normalizeFolder(options.rootFolder);
    const folder = `${root}/${normalizeFolder(options.memosFolder)}`;
    if (!vault.getAbstractFileByPath(root)) {
      await vault.createFolder(root);
    }
    if (!vault.getAbstractFileByPath(folder)) {
      await vault.createFolder(folder);
    }
    await vault.create(path, next);
  }
}

/** つぶやきの編集（内容+日時+タグ・決定79） */
export async function editMemo(
  vault: Vault,
  file: TFile,
  entry: MemoEntry,
  next: { day: string; time: string; text: string; tags: string[] }
): Promise<void> {
  await vault.modify(
    file,
    updateMemo(await vault.read(file), entry.lineIndex, next)
  );
}

/** つぶやきの削除 */
export async function deleteMemo(
  vault: Vault,
  file: TFile,
  entry: MemoEntry,
  options: MemoStoreOptions,
  trashFile: (file: TFile) => Promise<void>
): Promise<void> {
  const original = await vault.read(file);
  const source = resolveMemoEntry(original, entry);
  const root = normalizeFolder(options.rootFolder);
  const name = `.seiton-deleted-memo-${source.file.month}-${source.line.day ?? "undated"}-${source.line.time.replace(":", "")}.md`;
  const recoveryPath = uniquePath(
    (path) => vault.getAbstractFileByPath(path) !== null,
    root ? `${root}/${name}` : name
  );
  const recoveryContent = [
    buildMonthFrontmatter(source.file.month).trimEnd(),
    ...(source.line.day ? [`## ${source.line.day}`] : []),
    source.line.raw,
    "",
  ].join("\n");
  const recoveryFile = await vault.create(recoveryPath, recoveryContent);

  try {
    await trashFile(recoveryFile);
  } catch (error) {
    // The original month file is still untouched; remove only the temporary
    // recovery copy when Obsidian could not move it to the configured trash.
    try {
      await vault.delete(recoveryFile);
    } catch {
      // Keep the original error. A leftover recovery copy is safer than loss.
    }
    throw error;
  }

  const current = await vault.read(file);
  const currentEntry = resolveMemoEntry(current, entry);
  const next = removeMemo(current, currentEntry.index);
  if (next === current) {
    throw new Error("一言メモを削除できませんでした");
  }
  await vault.modify(file, next);
}

function resolveMemoEntry(
  content: string,
  entry: MemoEntry
): {
  file: NonNullable<ReturnType<typeof parseMonthFile>>;
  index: number;
  line: Extract<MonthBodyLine, { kind: "memo" }>;
} {
  const file = parseMonthFile(content);
  if (!file || file.month !== entry.month) {
    throw new Error("一言メモが更新されています。画面を読み込み直してください");
  }
  const matches = file.lines.flatMap((line, index) =>
    line.kind === "memo" &&
    line.content === entry.content &&
    line.day === entry.day &&
    line.time === entry.time &&
    line.tags.length === entry.tags.length &&
    line.tags.every((tag, tagIndex) => tag === entry.tags[tagIndex])
      ? [{ index, line }]
      : []
  );
  const currentAtIndex = matches.find(({ index }) => index === entry.lineIndex);
  const match = currentAtIndex ?? (matches.length === 1 ? matches[0] : null);
  if (!match) {
    throw new Error("一言メモが更新されています。画面を読み込み直してください");
  }
  return { file, index: match.index, line: match.line };
}

export { extractMemosAcross } from "../../shared/memoFile";
