/**
 * Webクリップの保存ストア（spec §5 入力フロー3系統）
 * - 一撃保存: og:title取得を待たず未整理ノートを作る
 * - 後追い更新: 取得成功後にだけファイル名をog:titleへ置き換える
 */
import { requestUrl, TFile, type Vault } from "obsidian";
import {
  formatItemFrontmatter,
  parseFrontmatter,
} from "../../shared/frontmatter";
import { folderForType, normalizeFolder, uniquePath } from "../../shared/paths";
import { safeFilename } from "../../shared/sanitize";
import type { SeitonSettings } from "../../shared/types";
import {
  buildIdeaBody,
  buildWebClipBody,
  classifySharedText,
  extractHttpUrl,
  filenameFromUrl,
  mainDomainForUrl,
  type SharedTextKind,
} from "../../shared/webClip";
import { saveMemo } from "./memoStore";
import { ensureFolder } from "./vaultUtils";

type ClipSettings = Pick<
  SeitonSettings,
  | "rootFolder"
  | "inboxFolder"
  | "typeFolders"
  | "memosFolder"
  | "sharedTextDefault"
>;
type HtmlFetcher = (url: string) => Promise<string>;

function clipFolder(settings: ClipSettings): string {
  return `${normalizeFolder(settings.rootFolder)}/${normalizeFolder(settings.inboxFolder)}`;
}

function notePath(vault: Vault, folder: string, title: string): string {
  return uniquePath(
    (path) => vault.getAbstractFileByPath(path) !== null,
    `${folder}/${safeFilename(title, "Web clip")}.md`
  );
}

async function createNote(
  vault: Vault,
  path: string,
  type: "webclip" | "idea",
  body: string,
  source?: string,
  now = new Date()
): Promise<TFile> {
  const domainTag = source ? mainDomainForUrl(source) : null;
  const item = {
    created: now.toISOString(),
    lists: [],
    sourceTags: domainTag ? [domainTag] : [],
    status: "inbox" as const,
    tags: [],
    type,
    ...(source ? { source } : {}),
  };
  await ensureFolder(vault, path.slice(0, path.lastIndexOf("/")));
  await vault.create(path, `---\n${formatItemFrontmatter(item)}\n---\n${body}`);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new Error(`Created note was not found: ${path}`);
  }
  return file;
}

/** 一撃保存。タイトル取得を待たず、未整理ノートを先に作成する。 */
export async function saveWebClip(
  vault: Vault,
  settings: ClipSettings,
  url: string,
  now = new Date()
): Promise<TFile> {
  const normalized = extractHttpUrl(url);
  if (!normalized) {
    throw new Error("Invalid web clip URL");
  }
  const title = filenameFromUrl(normalized);
  return createNote(
    vault,
    notePath(vault, clipFolder(settings), title),
    "webclip",
    buildWebClipBody(normalized),
    normalized,
    now
  );
}

/** og:title取得成功後にだけファイル名を更新する。失敗時は保存直後の名前を維持する。 */
export async function updateWebClipTitle(
  vault: Vault,
  file: TFile,
  fetchHtmlFn: HtmlFetcher
): Promise<TFile> {
  const raw = await vault.read(file);
  const parsed = parseFrontmatter(raw);
  const source =
    typeof parsed?.data.source === "string" ? parsed.data.source : null;
  if (!source) {
    return file;
  }
  let html: string;
  try {
    html = await fetchHtmlFn(source);
  } catch {
    return file;
  }
  const titleMatch =
    /<meta\b[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(
      html
    ) ??
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["'][^>]*>/i.exec(
      html
    ) ??
    /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim();
  if (!title) {
    return file;
  }
  return renameWebClipTitle(vault, file, title);
}

/** カード取得済みのタイトルを使って保存直後のファイル名を更新する。 */
export async function renameWebClipTitle(
  vault: Vault,
  file: TFile,
  title: string
): Promise<TFile> {
  const raw = await vault.read(file);
  const parsed = parseFrontmatter(raw);
  const source =
    typeof parsed?.data.source === "string" ? parsed.data.source : null;
  if (
    !(source && title) ||
    title === file.basename ||
    title === source ||
    title === filenameFromUrl(source)
  ) {
    return file;
  }
  const folder = file.path.slice(0, file.path.lastIndexOf("/"));
  const nextPath = uniquePath(
    (path) => path !== file.path && vault.getAbstractFileByPath(path) !== null,
    `${folder}/${safeFilename(title, "Web clip")}.md`
  );
  if (nextPath === file.path) {
    return file;
  }
  await vault.rename(file, nextPath);
  const renamed = vault.getAbstractFileByPath(nextPath);
  return renamed instanceof TFile ? renamed : file;
}

export async function fetchHtml(url: string): Promise<string> {
  return (await requestUrl({ method: "GET", url })).text;
}

async function saveIdea(
  vault: Vault,
  settings: ClipSettings,
  text: string,
  now: Date
): Promise<TFile> {
  const firstLine = text.trim().split(/\r?\n/, 1)[0].slice(0, 80);
  const title = safeFilename(firstLine || "Idea", "Idea");
  return createNote(
    vault,
    notePath(vault, folderForType(settings, "idea"), title),
    "idea",
    buildIdeaBody(text),
    undefined,
    now
  );
}

export interface SharedCaptureResult {
  file?: TFile;
  kind: SharedTextKind;
}

/** URL共有とテキスト共有を、明示設定された既定先へ振り分ける。 */
export async function saveSharedText(
  vault: Vault,
  settings: ClipSettings,
  text: string,
  now = new Date()
): Promise<SharedCaptureResult> {
  const kind = classifySharedText(text, settings.sharedTextDefault);
  if (kind === "url") {
    const url = extractHttpUrl(text);
    if (!url) {
      throw new Error(
        "Shared text was classified as a URL but no URL was found"
      );
    }
    return {
      file: await saveWebClip(vault, settings, url, now),
      kind,
    };
  }
  if (kind === "idea") {
    return { file: await saveIdea(vault, settings, text, now), kind };
  }
  await saveMemo(vault, settings, text.trim(), now);
  return { kind };
}
