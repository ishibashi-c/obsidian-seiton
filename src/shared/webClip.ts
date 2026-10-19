import { extractMainDomain, safeFilename } from "./sanitize";
import type { SharedTextDefault } from "./types";

export type SharedTextKind = "url" | "idea" | "memo";

/** http(s) URL だけをクリップ対象として扱う。共有テキスト中のURLも先頭から拾う。 */
export function extractHttpUrl(value: string): string | null {
  const markdownDestination = /\]\(\s*<?(https?:\/\/[^\s)>]+)>?\s*\)/i.exec(
    value
  )?.[1];
  const plainUrl = /https?:\/\/[^\s<>\])]+/i.exec(value)?.[0];
  const candidate = (markdownDestination ?? plainUrl)?.replace(
    /[),.;!?]+$/,
    ""
  );
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? candidate
      : null;
  } catch {
    return null;
  }
}

/** obsidian://seiton-clip?url=... のURLを検証して取り出す。 */
export function parseClipUri(uri: string): string | null {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "obsidian:" || parsed.hostname !== "seiton-clip") {
      return null;
    }
    return extractHttpUrl(parsed.searchParams.get("url") ?? "");
  } catch {
    return null;
  }
}

/** URIハンドラーへ渡されたデコード済みパラメータを検証する。 */
export function parseClipParams(
  params: Record<string, string | undefined>
): string | null {
  return extractHttpUrl(params.url ?? "");
}

export function classifySharedText(
  text: string,
  defaultKind: SharedTextDefault = "memo"
): SharedTextKind {
  if (extractHttpUrl(text)) {
    return "url";
  }
  return defaultKind;
}

/** og:title取得前に使う、URLから読めるファイル名。 */
export function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments.at(-1) ?? "";
    const decoded = decodeURIComponent(last).replace(/\.[a-zA-Z0-9]+$/, "");
    return safeFilename(decoded || extractMainDomain(url) || parsed.hostname);
  } catch {
    return "Untitled";
  }
}

/** クリップノートの本文（spec §5: URL裸リンク+空の##メモ） */
export function buildWebClipBody(url: string): string {
  return `${url}\n\n## メモ\n`;
}

/** 共有テキストをアイデアノートへ保存するときの本文を作る */
export function buildIdeaBody(text: string): string {
  return `## 一言で\n\n${text.trim()}\n\n## 背景\n\n## 次の一手\n`;
}

/** 設定画面で表示する1クリック保存用ブックマークレット */
export function buildBookmarklet(): string {
  return "javascript:(()=>{location.href='obsidian://seiton-clip?url='+encodeURIComponent(location.href)})()";
}

/** URLのメインドメインからsourceTags用のタグを作る（例: news.yahoo.co.jp → yahoo） */
export function mainDomainForUrl(url: string): string | null {
  const domain = extractMainDomain(url);
  return domain?.split(".")[0] ?? null;
}
