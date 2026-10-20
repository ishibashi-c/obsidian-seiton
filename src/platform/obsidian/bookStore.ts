/**
 * 本棚ノートの作成・検索（spec §6B）
 * frontmatter拡張: bookIsbn / bookAuthor / bookCover / bookFinished / bookRating / bookOwnership
 */
import { type App, TFile } from "obsidian";
import {
  type BookEditInput,
  type BookMetadata,
  type BookOwnershipStatus,
  isValidIsbn,
  normalizeBookOwnership,
  normalizeIsbn,
} from "../../domain/book";
import { DEFAULT_BOOK_CATEGORY } from "../../shared/constants";
import {
  parseFrontmatter,
  parseItem,
  rewriteFrontmatter,
  serializeFrontmatter,
} from "../../shared/frontmatter";
import { folderForType, normalizeFolder, uniquePath } from "../../shared/paths";
import { cacheKey } from "../../shared/richCard";
import type { SeitonSettings } from "../../shared/types";

/** 書籍ノートをISBNで探す（frontmatterのbookIsbn照合・重複チェック用） */
export async function findBookNoteByIsbn(
  app: App,
  isbnRaw: string
): Promise<TFile | null> {
  const isbn = normalizeIsbn(isbnRaw);
  if (!isbn) {
    return null;
  }
  for (const file of app.vault.getMarkdownFiles()) {
    const parsed = parseItem(await app.vault.cachedRead(file), file.path);
    if (!parsed.item) {
      continue;
    }
    const fm = parsed.item as unknown as Record<string, unknown>;
    if (
      (typeof fm.bookIsbn === "string" ||
        (typeof fm.bookIsbn === "number" &&
          Number.isSafeInteger(fm.bookIsbn))) &&
      normalizeIsbn(String(fm.bookIsbn)) === isbn
    ) {
      return file;
    }
  }
  return null;
}

export async function findSimilarBookNotes(
  app: App,
  title: string,
  author: string
): Promise<TFile[]> {
  const normalizedTitle = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
  const normalizedAuthor = author
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
  const matches: TFile[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const parsed = parseItem(await app.vault.cachedRead(file), file.path);
    if (parsed.item?.type !== "reading") {
      continue;
    }
    const fm = parsed.item as Record<string, unknown>;
    const candidateTitle = parsed.title
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "");
    const candidateAuthor = String(fm.bookAuthor ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (
      candidateTitle === normalizedTitle &&
      (!(normalizedAuthor && candidateAuthor) ||
        candidateAuthor === normalizedAuthor)
    ) {
      matches.push(file);
    }
  }
  return matches;
}

/** ファイル名サニタイズ（spec: タイトル主体・日付なし） */
function sanitize(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringArray(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  return [
    ...new Set(
      values
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
}

function bookCategory(value: string | undefined): string {
  return sanitize(value?.trim() ?? "") || DEFAULT_BOOK_CATEGORY;
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current).catch(() => undefined);
    }
  }
}

function categoryFolder(base: string, category: string): string {
  return `${base}/${sanitize(category) || DEFAULT_BOOK_CATEGORY}`;
}

const BOOK_COVER_EMBED_MARKER = "<!-- Seiton: book-cover -->";
const bookCoverFolder = (rootFolder = "Seiton"): string =>
  `${normalizeFolder(rootFolder)}/assets/covers`;
const LEGACY_BOOK_COVER_PREFIX = ".seiton/covers/";

function isManagedBookCoverPath(path: string, rootFolder = "Seiton"): boolean {
  const prefix = path.startsWith(LEGACY_BOOK_COVER_PREFIX)
    ? LEGACY_BOOK_COVER_PREFIX
    : `${bookCoverFolder(rootFolder)}/`;
  if (!path.startsWith(prefix)) {
    return false;
  }
  const filename = path.slice(prefix.length);
  return (
    /^[^/\\]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(filename) &&
    filename !== "." &&
    !filename.includes("\0")
  );
}

/** 旧キャッシュをObsidianのWiki埋め込みが解決できる通常フォルダへ移す。 */
async function migrateLegacyBookCover(
  app: App,
  coverPath: string
): Promise<string> {
  if (!coverPath.startsWith(LEGACY_BOOK_COVER_PREFIX)) {
    return coverPath;
  }
  const filename = coverPath.slice(LEGACY_BOOK_COVER_PREFIX.length);
  if (!filename || filename.includes("/")) {
    return coverPath;
  }
  const folder = bookCoverFolder();
  const migratedPath = `${folder}/${filename}`;
  const existing = app.vault.getAbstractFileByPath(migratedPath);
  if (existing instanceof TFile) {
    return migratedPath;
  }
  try {
    await ensureFolder(app, folder);
    await app.vault.createBinary(
      migratedPath,
      await app.vault.adapter.readBinary(coverPath)
    );
    return migratedPath;
  } catch {
    return coverPath;
  }
}

async function restoreLegacyBookCover(
  app: App,
  isbnValue: unknown
): Promise<string> {
  if (typeof isbnValue !== "string" && typeof isbnValue !== "number") {
    return "";
  }
  const isbn = normalizeIsbn(String(isbnValue));
  if (!isbn) {
    return "";
  }
  for (const extension of ["jpg", "jpeg", "png", "webp"]) {
    const legacyPath = `${LEGACY_BOOK_COVER_PREFIX}${isbn}.${extension}`;
    const migratedPath = await migrateLegacyBookCover(app, legacyPath);
    if (migratedPath !== legacyPath) {
      return migratedPath;
    }
  }
  return "";
}

function syncBookCoverEmbed(content: string, coverPath: string): string | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  const endIdx = lines.findIndex(
    (line, index) => index > 0 && /^---\s*$/.test(line)
  );
  if (endIdx < 0) {
    return null;
  }
  const body = lines.slice(endIdx + 1);
  const markerIdx = body.findIndex(
    (line) => line.trim() === BOOK_COVER_EMBED_MARKER
  );
  const embed = coverPath ? `![[${coverPath}|220]]` : "";
  if (markerIdx >= 0) {
    const managedEmbed = body[markerIdx + 1]?.trim().startsWith("![[");
    if (coverPath) {
      if (managedEmbed && body[markerIdx + 1]?.trim() === embed) {
        return content;
      }
      body.splice(
        markerIdx,
        managedEmbed ? 2 : 1,
        BOOK_COVER_EMBED_MARKER,
        embed
      );
    } else {
      body.splice(markerIdx, managedEmbed ? 2 : 1);
    }
  } else if (coverPath) {
    body.unshift(BOOK_COVER_EMBED_MARKER, embed, "");
  } else {
    return content;
  }
  return lines
    .slice(0, endIdx + 1)
    .concat(body)
    .join("\n");
}

/** bookCoverのfrontmatterと本文の画像埋め込みを同期する。本文の他の内容は保持する。 */
export async function ensureBookCoverEmbed(
  app: App,
  note: TFile
): Promise<boolean> {
  const raw = await app.vault.read(note);
  const frontmatter = parseFrontmatter(raw);
  if (!frontmatter) {
    return false;
  }
  const frontmatterCoverPath =
    typeof frontmatter.data.bookCover === "string"
      ? frontmatter.data.bookCover.trim()
      : "";
  const sourceCoverPath =
    frontmatterCoverPath ||
    (await restoreLegacyBookCover(app, frontmatter.data.bookIsbn));
  const migratedPath = await migrateLegacyBookCover(app, sourceCoverPath);
  const coverFile = migratedPath
    ? app.vault.getAbstractFileByPath(migratedPath)
    : null;
  const coverPath =
    coverFile instanceof TFile || !isManagedBookCoverPath(migratedPath)
      ? migratedPath
      : "";
  const frontmatterContent =
    coverPath === frontmatterCoverPath
      ? raw
      : rewriteFrontmatter(raw, { bookCover: coverPath }) || raw;
  const next = syncBookCoverEmbed(frontmatterContent, coverPath);
  if (next && next !== raw) {
    await app.vault.modify(note, next);
  }
  return Boolean(coverPath && coverFile instanceof TFile);
}

/** 本棚一覧から編集した書誌情報を既存ノートへ反映する。未知キーと本文は保持する。 */
export async function updateBookRecord(
  app: App,
  note: TFile,
  input: BookEditInput,
  settings?: SeitonSettings
): Promise<void> {
  const title = sanitize(input.title);
  if (!title) {
    throw new Error("書名を入力してください");
  }
  const raw = await app.vault.read(note);
  const frontmatter = parseFrontmatter(raw);
  if (!frontmatter) {
    throw new Error("frontmatter missing");
  }
  const previousCategory =
    typeof frontmatter.data.bookCategory === "string"
      ? bookCategory(frontmatter.data.bookCategory)
      : "";
  const category = bookCategory(input.category ?? previousCategory);
  const tags = stringArray(frontmatter.data.tags).filter(
    (tag) => tag !== previousCategory && tag !== category
  );
  tags.push(category);
  const next = rewriteFrontmatter(raw, {
    bookAuthor: input.author.trim(),
    bookCategory: category,
    bookFinished: input.finished.trim(),
    bookOwnership: normalizeBookOwnership(input.ownership),
    bookRating:
      input.rating && input.rating >= 1 && input.rating <= 5
        ? input.rating
        : "",
    bookSeries: input.series?.trim() ?? frontmatter.data.bookSeries ?? "",
    lists: input.lists ?? stringArray(frontmatter.data.lists),
    readingStatus: input.readingStatus,
    tags,
  });
  if (!next) {
    throw new Error("frontmatter invalid");
  }
  if (next !== raw) {
    await app.vault.modify(note, next);
  }
  await ensureBookCoverEmbed(app, note);
  const baseFolder = settings
    ? folderForType(settings, "reading")
    : (note.parent?.path ?? "");
  const folderPath = settings
    ? categoryFolder(baseFolder, category)
    : baseFolder;
  if (settings) {
    await ensureFolder(app, folderPath);
  }
  const folderChanged = settings && note.parent?.path !== folderPath;
  if (note.basename !== title || folderChanged) {
    const target = uniquePath(
      (path) =>
        path !== note.path && app.vault.getAbstractFileByPath(path) !== null,
      `${folderPath}/${title}.md`
    );
    await app.fileManager.renameFile(note, target);
  }
}

/**
 * 表紙画像をvault内キャッシュに保存し、vault相対パスを返す（取得失敗時は空文字）
 * Based on Easy Bookshelf image-cache.ts (MIT © 2026 cocoa):
 * - requestUrlで取得（OO準拠）
 * - 1x1プレースホルダー画像はスキップ
 * - 最小版ではWebP変換せず元形式のまま保存
 */
export async function cacheCover(
  app: App,
  isbn: string,
  coverUrl: string,
  rootFolder = "Seiton"
): Promise<string> {
  if (!coverUrl) {
    return "";
  }
  try {
    const { requestUrl } = await import("obsidian");
    const response = await requestUrl({ url: coverUrl });
    if (response.status !== 200) {
      return "";
    }
    const buf = response.arrayBuffer;
    const folder = bookCoverFolder(rootFolder);
    await ensureFolder(app, folder);
    // 1x1プレースホルダー対策（easy-obookshelfと同じ判定）
    try {
      const bitmap = await createImageBitmap(new Blob([buf]));
      if (bitmap.width <= 1 || bitmap.height <= 1) {
        return "";
      }
    } catch {
      /* 画像判定できなければ保存を試みる */
    }
    const ext =
      coverUrl.includes(".jpg") || coverUrl.includes(".jpeg") ? "jpg" : "png";
    const normalizedIsbn = normalizeIsbn(isbn);
    const hasIsbn = isValidIsbn(isbn);
    const key = hasIsbn ? normalizedIsbn : `manual-${cacheKey(coverUrl)}`;
    const requestedPath = `${folder}/${key}.${ext}`;
    const finalPath = hasIsbn
      ? requestedPath
      : uniquePath(
          (path) => app.vault.getAbstractFileByPath(path) !== null,
          requestedPath
        );
    const existing = hasIsbn
      ? app.vault.getAbstractFileByPath(finalPath)
      : null;
    if (existing instanceof TFile) {
      await app.vault.modifyBinary(existing, buf);
      return finalPath;
    }
    await app.vault.createBinary(finalPath, buf);
    return finalPath;
  } catch {
    return "";
  }
}

/**
 * 書籍ノートを作成する（フォルダ=readings・type: reading）
 * テンプレート見出しは既存DEFAULT_TEMPLATES.readingと同じ構造
 */
export interface BookRecordInput {
  category?: string;
  finished?: string;
  lists?: string[];
  metadata: BookMetadata;
  notes?: string;
  ownership?: BookOwnershipStatus;
  rating?: number;
  series?: string;
}

export async function createBookNote(
  app: App,
  metaOrInput: BookMetadata | BookRecordInput,
  settings?: Pick<
    SeitonSettings,
    "rootFolder" | "memosFolder" | "typeFolders" | "bookCoverCacheEnabled"
  > & { bookCategories?: string[]; templates?: SeitonSettings["templates"] }
): Promise<string> {
  const input: BookRecordInput =
    "metadata" in metaOrInput ? metaOrInput : { metadata: metaOrInput };
  const meta = input.metadata;
  const coverPath =
    settings?.bookCoverCacheEnabled === false
      ? ""
      : await cacheCover(app, meta.isbn, meta.coverUrl, settings?.rootFolder);
  const title = sanitize(meta.title) || meta.isbn;

  // readingsフォルダを保証
  const root = normalizeFolder(settings?.rootFolder ?? "Seiton");
  const baseFolderPath = settings
    ? folderForType(settings, "reading")
    : `${root}/readings`;
  const category = bookCategory(input.category);
  const folderPath = categoryFolder(baseFolderPath, category);
  await ensureFolder(app, folderPath);

  // ファイル名重複回避（「タイトル 2.md」連番・spec命名規則）
  const path = uniquePath(
    (value) => app.vault.getAbstractFileByPath(value) !== null,
    `${folderPath}/${title}.md`
  );

  const now = new Date().toISOString().slice(0, 19);
  const frontmatter: Record<string, unknown> = {
    bookCategory: category,
    created: now,
    lists: input.lists ?? [],
    sourceTags: [],
    status: "active",
    tags: [category],
    type: "reading",
  };
  if (input.series?.trim()) {
    frontmatter.bookSeries = input.series.trim();
  }
  if (meta.isbn) {
    frontmatter.bookIsbn = meta.isbn;
  }
  if (meta.author) {
    frontmatter.bookAuthor = meta.author;
  }
  if (coverPath) {
    frontmatter.bookCover = coverPath;
  }
  if (meta.publisher) {
    frontmatter.bookPublisher = meta.publisher;
  }
  if (meta.publishDate) {
    frontmatter.bookPublished = meta.publishDate;
  }
  if (meta.pages > 0) {
    frontmatter.pages = meta.pages;
  }
  frontmatter.readingStatus = input.finished ? "read" : "tbr";
  frontmatter.bookOwnership = normalizeBookOwnership(input.ownership);
  if (input.finished) {
    frontmatter.bookFinished = input.finished;
  }
  if (input.rating && input.rating >= 1 && input.rating <= 5) {
    frontmatter.bookRating = input.rating;
  }
  const lines = [
    "---",
    serializeFrontmatter(frontmatter, { skipEmptyArrays: false }),
    "---",
  ];
  if (coverPath) {
    lines.push("", BOOK_COVER_EMBED_MARKER, `![[${coverPath}|220]]`);
  }
  lines.push(
    "",
    settings?.templates?.reading ?? "## 出典\n\n## 要約\n\n## ポイント",
    ...(input.notes?.trim() ? ["", input.notes.trim()] : []),
    ""
  );

  const file = await app.vault.create(path, lines.join("\n"));
  return file.path;
}

export async function removeCachedCover(
  app: App,
  note: TFile,
  rootFolder = "Seiton"
): Promise<void> {
  const raw = await app.vault.cachedRead(note);
  const parsed = parseItem(raw, note.path);
  const coverPath =
    parsed.item && typeof parsed.item.bookCover === "string"
      ? parsed.item.bookCover
      : "";
  if (!coverPath) {
    return;
  }
  const cover = app.vault.getAbstractFileByPath(coverPath);
  if (
    isManagedBookCoverPath(coverPath, rootFolder) &&
    cover instanceof TFile &&
    cover.path === coverPath &&
    isManagedBookCoverPath(cover.path, rootFolder)
  ) {
    await app.fileManager.trashFile(cover);
  }
  const next = rewriteFrontmatter(raw, { bookCover: "" });
  if (next) {
    await app.vault.modify(note, syncBookCoverEmbed(next, "") ?? next);
  }
}

/** 外部ツール作成ノートの既存値・本文を上書きせず、不足書誌だけ補完する。 */
export async function completeBookMetadata(
  app: App,
  note: TFile,
  metadata: BookMetadata,
  settings: Pick<SeitonSettings, "bookCoverCacheEnabled" | "rootFolder">
): Promise<void> {
  const raw = await app.vault.read(note);
  const frontmatter = parseFrontmatter(raw);
  if (!frontmatter) {
    return;
  }
  const patch: Record<string, unknown> = {};
  const candidates: Record<string, unknown> = {
    bookAuthor: metadata.author || undefined,
    bookIsbn: metadata.isbn || undefined,
    bookPublished: metadata.publishDate || undefined,
    bookPublisher: metadata.publisher || undefined,
    created: new Date().toISOString(),
    status: "active",
    type: "reading",
  };
  for (const [key, value] of Object.entries(candidates)) {
    if (frontmatter.data[key] === undefined && value !== undefined) {
      patch[key] = value;
    }
  }
  const currentCoverPath =
    typeof frontmatter.data.bookCover === "string"
      ? frontmatter.data.bookCover.trim()
      : "";
  const currentCover = currentCoverPath
    ? app.vault.getAbstractFileByPath(currentCoverPath)
    : null;
  const hasCurrentCover =
    currentCover instanceof TFile && Boolean(currentCoverPath);
  if (!hasCurrentCover && settings.bookCoverCacheEnabled && metadata.coverUrl) {
    const cover = await cacheCover(
      app,
      metadata.isbn,
      metadata.coverUrl,
      settings.rootFolder
    );
    if (cover) {
      patch.bookCover = cover;
    }
  }
  const next = rewriteFrontmatter(raw, patch);
  if (next && next !== raw) {
    await app.vault.modify(note, next);
  }
  await ensureBookCoverEmbed(app, note);
}
