/**
 * リッチカードの純関数層（spec §7）
 * 対象URL抽出・メタデータ解析（画像5段階）・キャッシュキー/削除計算。
 */
import { RICH_CARD_CACHE_FOLDER } from "./constants";
import { extractMainDomain } from "./sanitize";
import { extractHttpUrl } from "./webClip";

export interface RichCardMetadata {
  canonicalUrl: string | null;
  description: string | null;
  domain: string;
  iconUrl: string | null;
  imageHeight?: number;
  imageUrl: string | null;
  imageWidth?: number;
  siteName: string | null;
  tint?: string | null;
  title: string;
  url: string;
}

export interface CacheEntryInfo {
  modified: number;
  path: string;
  size: number;
}

function decodeHtml(value: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.innerHTML = value;
    return el.value;
  }
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/>/g, ">");
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while (true) {
    match = re.exec(tag);
    if (!match) {
      break;
    }
    result[match[1].toLowerCase()] = decodeHtml(
      match[2] ?? match[3] ?? match[4] ?? ""
    );
  }
  return result;
}

function metaContent(html: string, key: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    const names = [attrs.property, attrs.name]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    if (names.includes(key.toLowerCase())) {
      return attrs.content?.trim() || null;
    }
  }
  return null;
}

function firstMetaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const value = metaContent(html, key);
    if (value) {
      return value;
    }
  }
  return null;
}

function linkContent(
  html: string,
  predicate: (attrs: Record<string, string>) => boolean
): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    if (predicate(attrs)) {
      return attrs.href?.trim() || null;
    }
  }
  return null;
}

function firstContentImage(html: string): string | null {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = attributes(tag);
    const src =
      attrs.src ??
      attrs["data-src"] ??
      attrs["data-lazy-src"] ??
      firstSrcset(attrs.srcset ?? attrs["data-srcset"]);
    if (src) {
      return src;
    }
  }
  return null;
}

function firstSrcset(value: string | undefined): string | null {
  const first = value?.split(",", 1)[0]?.trim().split(/\s+/)[0];
  return first || null;
}

function resolveUrl(value: string | null, baseUrl: string): string | null {
  if (!value) {
    return null;
  }
  try {
    const resolved = new URL(value, baseUrl);
    return /^(https?:|data:)/i.test(resolved.protocol)
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

function pageTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match?.[1]
    ? decodeHtml(match[1]).replace(/\s+/g, " ").trim() || null
    : null;
}

function domMetadata(html: string, url: string): RichCardMetadata | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = (...selectors: string[]): string | null => {
      for (const selector of selectors) {
        const value = doc
          .querySelector(selector)
          ?.getAttribute("content")
          ?.trim();
        if (value) {
          return value;
        }
      }
      return null;
    };
    const link = (...selectors: string[]): string | null => {
      for (const selector of selectors) {
        const value = doc.querySelector(selector)?.getAttribute("href")?.trim();
        if (value) {
          return value;
        }
      }
      return null;
    };
    const imageCandidates = [
      meta('meta[property="og:image"]', 'meta[property="og:image:url"]'),
      meta('meta[name="twitter:image"]', 'meta[name="twitter:image:src"]'),
      link('link[rel="image_src"]'),
      ...Array.from(doc.querySelectorAll("img"))
        .slice(0, 30)
        .flatMap((image) => [
          image.getAttribute("data-src"),
          image.getAttribute("data-lazy-src"),
          image.getAttribute("data-original"),
          firstSrcset(
            image.getAttribute("data-srcset") ??
              image.getAttribute("srcset") ??
              undefined
          ),
          image.getAttribute("src"),
        ]),
      link('link[rel~="apple-touch-icon"]'),
    ];
    const imageUrl =
      imageCandidates
        .filter((candidate): candidate is string =>
          Boolean(candidate && !candidate.startsWith("data:"))
        )
        .map((candidate) => resolveUrl(candidate, url))
        .find((candidate): candidate is string => candidate !== null) ?? null;
    const iconUrl =
      [link('link[rel~="icon"]'), link('link[rel~="apple-touch-icon"]')]
        .map((candidate) => resolveUrl(candidate, url))
        .find((candidate): candidate is string => candidate !== null) ?? null;
    const domain = extractMainDomain(url) ?? url;
    return {
      canonicalUrl: resolveUrl(link('link[rel="canonical"]'), url),
      description: meta(
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]'
      ),
      domain,
      iconUrl,
      imageUrl,
      siteName: meta('meta[property="og:site_name"]'),
      title:
        meta('meta[property="og:title"]', 'meta[name="twitter:title"]') ??
        doc.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() ??
        domain,
      url,
    };
  } catch {
    return null;
  }
}

/** HTMLのメタデータから仕様順の画像候補を1つ選ぶ（5段階・spec §7）。 */
export function extractRichCardMetadata(
  html: string,
  url: string
): RichCardMetadata {
  const parsed = domMetadata(html, url);
  if (parsed) {
    return parsed;
  }
  const imageUrl =
    [
      firstMetaContent(html, ["og:image", "og:image:url"]),
      firstMetaContent(html, ["twitter:image", "twitter:image:src"]),
      linkContent(html, (attrs) =>
        (attrs.rel ?? "").toLowerCase().split(/\s+/).includes("image_src")
      ),
      firstContentImage(html),
      linkContent(html, (attrs) =>
        (attrs.rel ?? "")
          .toLowerCase()
          .split(/\s+/)
          .includes("apple-touch-icon")
      ),
    ]
      .map((candidate) => resolveUrl(candidate, url))
      .find((candidate): candidate is string => candidate !== null) ?? null;
  const iconUrl =
    [
      linkContent(html, (attrs) =>
        (attrs.rel ?? "").toLowerCase().split(/\s+/).includes("icon")
      ),
      linkContent(html, (attrs) =>
        (attrs.rel ?? "")
          .toLowerCase()
          .split(/\s+/)
          .includes("apple-touch-icon")
      ),
    ]
      .map((candidate) => resolveUrl(candidate, url))
      .find((candidate): candidate is string => candidate !== null) ?? null;
  const canonicalUrl = resolveUrl(
    linkContent(html, (attrs) =>
      (attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical")
    ),
    url
  );
  return {
    canonicalUrl,
    description: firstMetaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]),
    domain: extractMainDomain(url) ?? url,
    iconUrl,
    imageUrl,
    siteName: firstMetaContent(html, ["og:site_name"]) ?? null,
    title:
      firstMetaContent(html, ["og:title", "twitter:title"]) ??
      pageTitle(html) ??
      extractMainDomain(url) ??
      url,
    url,
  };
}

/** 本文中の最初のHTTP(S)リンク。クリップは本文先頭URLを優先して渡せる。 */
export function extractFirstHttpUrl(text: string): string | null {
  return extractHttpUrl(text);
}

/** 追加フォルダ設定に含まれるか（フォルダ名の部分一致を避ける）。 */
export function isRichCardFolderTarget(
  path: string,
  folders: string[]
): boolean {
  return folders.some((folder) => {
    const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
    return normalized.length > 0 && path.startsWith(`${normalized}/`);
  });
}

export function normalizeRichCardDomains(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) =>
          value
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .replace(/^\.+|\.+$/g, "")
        )
        .filter(Boolean)
    ),
  ];
}

/** 完全一致とsubdomainを無効化する。`example.com.evil.test`は一致しない。 */
export function isRichCardDomainDisabled(
  url: string,
  disabledDomains: string[]
): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return true;
  }
  return normalizeRichCardDomains(disabledDomains).some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

export function cacheKey(url: string): string {
  let hash = 2_166_136_261;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function cacheMetadataPath(url: string): string {
  return `${RICH_CARD_CACHE_FOLDER}/${cacheKey(url)}.json`;
}

/** 年齢と総容量の両方を満たすため削除すべきエントリを返す。 */
export function cachePathsToDelete(
  entries: CacheEntryInfo[],
  maxBytes: number,
  maxAgeDays: number,
  now = Date.now()
): string[] {
  const maxAge = Math.max(0, maxAgeDays) * 24 * 60 * 60 * 1000;
  const expired = entries
    .filter((entry) => now - entry.modified > maxAge)
    .map((entry) => entry.path);
  const expiredSet = new Set(expired);
  let total = entries
    .filter((entry) => !expiredSet.has(entry.path))
    .reduce((sum, entry) => sum + entry.size, 0);
  const removals = [...expired];
  if (total <= maxBytes) {
    return removals;
  }
  const newestFirst = entries
    .filter((entry) => !expiredSet.has(entry.path))
    .sort((a, b) => a.modified - b.modified);
  for (const entry of newestFirst) {
    if (total <= maxBytes) {
      break;
    }
    total -= entry.size;
    removals.push(entry.path);
  }
  return removals;
}
