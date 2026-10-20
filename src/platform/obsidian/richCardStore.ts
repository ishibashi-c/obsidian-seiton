/**
 * リッチカードキャッシュストア（spec §7）
 * vault内 `.seiton/cache/` にJSON+画像を保存。ネットワーク通信は明示的に呼んだ時だけ。
 */
import type { requestUrl, Vault } from "obsidian";
import { RICH_CARD_CACHE_FOLDER } from "../../shared/constants";
import { normalizeFolder } from "../../shared/paths";
import {
  type CacheEntryInfo,
  cacheKey,
  cacheMetadataPath,
  cachePathsToDelete,
  extractRichCardMetadata,
  isRichCardDomainDisabled,
  type RichCardMetadata,
} from "../../shared/richCard";
import { extractMainDomain } from "../../shared/sanitize";
import { requestRichCardUrl } from "./richCardRequest";

export interface RichCardStoreOptions {
  disabledDomains?: string[];
  maxAgeDays?: number;
  maxBytes?: number;
}

interface CachedMetadata extends RichCardMetadata {
  cacheVersion: number;
  fetchedAt: number;
  imagePath?: string;
}

const PREVIEW_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
];
const MAX_IMAGE_BYTES = 300 * 1024;
const DOWNSCALE_WIDTH = 640;
const FAILED_METADATA_TTL = 15 * 60 * 1000;
const CACHE_VERSION = 3;

function extensionForImage(url: string, contentType?: string): string {
  const mime = contentType?.split(";", 1)[0].toLowerCase();
  const mimeExt: Record<string, string> = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  };
  if (mime && mimeExt[mime]) {
    return mimeExt[mime];
  }
  try {
    const ext = new URL(url).pathname.match(
      /\.(png|jpe?g|gif|webp|svg|avif)$/i
    )?.[1];
    return ext ? `.${ext.toLowerCase().replace("jpeg", "jpg")}` : ".img";
  } catch {
    return ".img";
  }
}

async function ensureFolder(vault: Vault, path: string): Promise<void> {
  const parts = normalizeFolder(path).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await vault.adapter.exists(current))) {
      try {
        await vault.adapter.mkdir(current);
      } catch (error) {
        // 同時取得で別カードが先に作成しても、存在を再確認して続行する。
        if (!(await vault.adapter.exists(current))) {
          throw error;
        }
      }
    }
  }
}

function asResource(vault: Vault, metadata: CachedMetadata): RichCardMetadata {
  return {
    ...metadata,
    imageSourceUrl: metadata.imageUrl ?? undefined,
    imageUrl: metadata.imagePath
      ? vault.adapter.getResourcePath(metadata.imagePath)
      : metadata.imageUrl,
  };
}

function header(
  response: Awaited<ReturnType<typeof requestUrl>>,
  name: string
): string | null {
  const key = Object.keys(response.headers ?? {}).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  );
  return key ? response.headers[key] : null;
}

function decodeResponseText(
  response: Awaited<ReturnType<typeof requestUrl>>
): string {
  if (!response.arrayBuffer || typeof TextDecoder === "undefined") {
    return response.text ?? "";
  }
  const contentType = header(response, "content-type")?.toLowerCase() ?? "";
  const charsetMatch = /charset\s*=\s*([^;\s]+)/i.exec(contentType);
  let charset = charsetMatch?.[1]?.replace(/^['"]|['"]$/g, "") ?? "";
  if (!charset) {
    const head = new TextDecoder("utf-8").decode(
      response.arrayBuffer.slice(0, 2048)
    );
    charset =
      /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
  }
  const aliases: Record<string, string> = {
    big5: "big5",
    "big5-hkscs": "big5",
    "euc-jp": "euc-jp",
    gb2312: "gbk",
    "shift-jis": "shift_jis",
    sjis: "shift_jis",
  };
  try {
    return new TextDecoder(aliases[charset.toLowerCase()] ?? charset).decode(
      response.arrayBuffer
    );
  } catch {
    return (
      response.text ?? new TextDecoder("utf-8").decode(response.arrayBuffer)
    );
  }
}

function hasUsefulMetadata(
  metadata: RichCardMetadata,
  originalUrl: string
): boolean {
  const domain = extractMainDomain(originalUrl) ?? originalUrl;
  return Boolean(
    metadata.imageUrl || metadata.description || metadata.title !== domain
  );
}

function fallbackMetadata(url: string): RichCardMetadata {
  const domain = extractMainDomain(url) ?? url;
  return {
    canonicalUrl: null,
    description: null,
    domain,
    iconUrl: null,
    imageUrl: null,
    siteName: null,
    title: domain,
    url,
  };
}

async function fetchPreviewMetadata(
  url: string,
  request: (
    url: string,
    userAgent: string
  ) => Promise<Awaited<ReturnType<typeof requestUrl>>>
): Promise<RichCardMetadata> {
  let best: RichCardMetadata | null = null;
  for (const userAgent of PREVIEW_USER_AGENTS) {
    // requestUrlだけでなく、レスポンスの文字コード解析やDOMParserも
    // サイトごとの異常値でthrowし得る。1回の失敗で全UA再試行を止めない。
    try {
      const response = await request(url, userAgent);
      if (response.status >= 400) {
        continue;
      }
      const html = decodeResponseText(response);
      if (!html.trim()) {
        continue;
      }
      const candidate = extractRichCardMetadata(html, url);
      if (best) {
        best = {
          canonicalUrl: best.canonicalUrl ?? candidate.canonicalUrl,
          description: best.description ?? candidate.description,
          domain: best.domain,
          iconUrl: best.iconUrl ?? candidate.iconUrl,
          imageHeight: best.imageHeight ?? candidate.imageHeight,
          imageUrl: best.imageUrl ?? candidate.imageUrl,
          imageWidth: best.imageWidth ?? candidate.imageWidth,
          siteName: best.siteName ?? candidate.siteName,
          tint: best.tint ?? candidate.tint,
          title: best.title === best.domain ? candidate.title : best.title,
          url: best.url,
        };
      } else {
        best = candidate;
      }
      if (hasUsefulMetadata(candidate, url)) {
        break;
      }
    } catch {}
  }
  // 上流は取得できないサイトでもhostnameカードを返し、次回取得できるよう短期TTLで保持する。
  return best ?? fallbackMetadata(url);
}

/** vault内のJSON/画像を使うリッチカードキャッシュ。同じURLの同時取得は1つにまとめる。 */
export class RichCardStore {
  private readonly inFlight = new Map<string, Promise<RichCardMetadata>>();
  private revision = 0;
  private readonly listeners = new Set<() => void>();
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly getSnapshot = (): number => this.revision;

  constructor(
    private readonly vault: Vault,
    private options: RichCardStoreOptions = {}
  ) {
    this.options = {
      ...options,
      disabledDomains: [...(options.disabledDomains ?? [])],
    };
  }

  updateOptions(options: RichCardStoreOptions): void {
    const changed =
      JSON.stringify(this.options.disabledDomains ?? []) !==
        JSON.stringify(options.disabledDomains ?? []) ||
      this.options.maxBytes !== options.maxBytes ||
      this.options.maxAgeDays !== options.maxAgeDays;
    this.options = {
      ...options,
      disabledDomains: [...(options.disabledDomains ?? [])],
    };
    if (changed) {
      this.revision += 1;
      for (const listener of this.listeners) {
        listener();
      }
      void this.cleanup();
    }
  }

  async get(url: string): Promise<RichCardMetadata | null> {
    if (!this.allows(url)) {
      return null;
    }
    const path = cacheMetadataPath(url);
    try {
      if (!(await this.vault.adapter.exists(path))) {
        return null;
      }
      const metadata = JSON.parse(
        await this.vault.adapter.read(path)
      ) as CachedMetadata;
      if (metadata.url !== url) {
        return null;
      }
      if (metadata.cacheVersion !== CACHE_VERSION) {
        return null;
      }
      const maxAgeDays = this.options.maxAgeDays ?? 30;
      const poor =
        !(metadata.imageUrl || metadata.description) &&
        metadata.title === metadata.domain;
      const ttl = poor
        ? FAILED_METADATA_TTL
        : Math.max(0, maxAgeDays) * 24 * 60 * 60 * 1000;
      if (
        Number.isFinite(metadata.fetchedAt) &&
        Date.now() - metadata.fetchedAt > ttl
      ) {
        return null;
      }
      return this.sanitize(asResource(this.vault, metadata));
    } catch {
      return null;
    }
  }

  async fetch(url: string): Promise<RichCardMetadata> {
    if (!this.allows(url)) {
      throw new Error("Rich card domain is disabled");
    }
    const running = this.inFlight.get(url);
    if (running) {
      return this.sanitize(await running);
    }
    const operation = this.fetchUncached(url);
    this.inFlight.set(url, operation);
    try {
      return this.sanitize(await operation);
    } finally {
      this.inFlight.delete(url);
    }
  }

  private async fetchUncached(url: string): Promise<RichCardMetadata> {
    await this.cleanup();
    const cached = await this.get(url);
    if (cached) {
      return cached;
    }
    // 期限切れの古いエントリがあれば削除してから取り直す
    const metadataPath = cacheMetadataPath(url);
    if (await this.vault.adapter.exists(metadataPath)) {
      try {
        const stale = JSON.parse(
          await this.vault.adapter.read(metadataPath)
        ) as CachedMetadata;
        if (
          stale.imagePath &&
          (await this.vault.adapter.exists(stale.imagePath))
        ) {
          await this.vault.adapter.trashLocal(stale.imagePath);
        }
      } catch {
        /* 壊れたメタデータも下の取得結果で置き換える */
      }
      await this.vault.adapter.trashLocal(metadataPath);
    }
    // 404ページにもtitle/og:imageがあるため、本文が返るHTTPエラー以外は捨てず解析する。
    // 通常UAで情報が足りないサイトだけ、リンク展開用UAへ段階的に再試行する。
    // ネットワーク障害はカード全体を壊さず、短期キャッシュ可能な
    // hostnameカードへ落とす。次回表示時には再取得できる。
    let metadata: RichCardMetadata;
    try {
      metadata = await fetchPreviewMetadata(url, (target, userAgent) =>
        requestRichCardUrl(target, () => this.options.disabledDomains ?? [], {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en;q=0.8",
          "User-Agent": userAgent,
        })
      );
    } catch {
      metadata = fallbackMetadata(url);
    }
    const key = cacheKey(url);
    const cachedMetadata: CachedMetadata = {
      ...metadata,
      cacheVersion: CACHE_VERSION,
      fetchedAt: Date.now(),
    };
    await ensureFolder(this.vault, RICH_CARD_CACHE_FOLDER);
    if (
      this.allows(url) &&
      metadata.imageUrl &&
      /^https?:/i.test(metadata.imageUrl) &&
      this.allows(metadata.imageUrl)
    ) {
      try {
        const imageResponse = await requestRichCardUrl(
          metadata.imageUrl,
          () => this.options.disabledDomains ?? [],
          { Referer: url, "User-Agent": PREVIEW_USER_AGENTS[0] }
        );
        if (imageResponse.status !== 200) {
          throw new Error(
            `Rich card image request failed (${imageResponse.status})`
          );
        }
        const contentType =
          header(imageResponse, "content-type")?.split(";", 1)[0] ??
          "image/jpeg";
        if (!contentType.startsWith("image/")) {
          throw new Error("Rich card image response is not an image");
        }
        const image = await normalizeImage(
          imageResponse.arrayBuffer,
          contentType
        );
        const imagePath = `${RICH_CARD_CACHE_FOLDER}/${key}${extensionForImage(metadata.imageUrl, image.contentType)}`;
        await this.vault.adapter.writeBinary(imagePath, image.arrayBuffer);
        cachedMetadata.imagePath = imagePath;
        cachedMetadata.imageWidth = image.width;
        cachedMetadata.imageHeight = image.height;
      } catch {
        /* メタデータだけでもカード表示を継続する */
      }
    }
    await this.vault.adapter.write(
      cacheMetadataPath(url),
      JSON.stringify(cachedMetadata, null, 2)
    );
    await this.cleanup();
    return this.sanitize(asResource(this.vault, cachedMetadata));
  }

  /** Re-evaluate cached and mounted metadata whenever the policy changes. */
  readonly sanitize = (metadata: RichCardMetadata): RichCardMetadata => {
    if (!this.allows(metadata.url)) {
      return fallbackMetadata(metadata.url);
    }
    const strict = (this.options.disabledDomains ?? []).some((domain) =>
      domain.trim()
    );
    const safeAsset = (asset: string | null): boolean =>
      Boolean(
        asset &&
          (strict
            ? /^(?:app:|capacitor:|file:|data:image\/(?:png|jpeg|gif|webp|avif);)/i.test(
                asset
              )
            : this.allows(asset))
      );
    return {
      ...metadata,
      iconUrl: safeAsset(metadata.iconUrl) ? metadata.iconUrl : null,
      imageUrl:
        safeAsset(metadata.imageUrl) &&
        (!metadata.imageSourceUrl || this.allows(metadata.imageSourceUrl))
          ? metadata.imageUrl
          : null,
    };
  };

  allowsRemoteAssets(): boolean {
    return !(this.options.disabledDomains ?? []).some((domain) =>
      domain.trim()
    );
  }

  async fetchHtml(url: string): Promise<string> {
    const response = await requestRichCardUrl(
      url,
      () => this.options.disabledDomains ?? []
    );
    if (!this.allows(url)) {
      throw new Error("Rich card domain is disabled");
    }
    return decodeResponseText(response);
  }

  allows(url: string): boolean {
    return !isRichCardDomainDisabled(url, this.options.disabledDomains ?? []);
  }

  /** サイズ上限・古いもの自動削除（両方実装・spec §7） */
  async cleanup(now = Date.now()): Promise<void> {
    let listingPaths: string[] = [];
    try {
      listingPaths = (await this.vault.adapter.list(RICH_CARD_CACHE_FOLDER))
        .files;
    } catch {
      return;
    }
    const entries: CacheEntryInfo[] = (
      await Promise.all(
        listingPaths.map(async (path) => {
          const stat = await this.vault.adapter.stat(path);
          return stat ? { modified: stat.mtime, path, size: stat.size } : null;
        })
      )
    ).filter((entry): entry is CacheEntryInfo => entry !== null);
    const paths = cachePathsToDelete(
      entries,
      this.options.maxBytes ?? 50 * 1024 * 1024,
      this.options.maxAgeDays ?? 30,
      now
    );
    for (const path of paths) {
      await this.vault.adapter.trashLocal(path);
    }
  }

  /** 派生cacheだけをObsidianのローカルゴミ箱へ移す。ユーザーノートは対象外。 */
  async clear(): Promise<number> {
    let files: string[] = [];
    try {
      files = (await this.vault.adapter.list(RICH_CARD_CACHE_FOLDER)).files;
    } catch {
      return 0;
    }
    for (const path of files) {
      await this.vault.adapter.trashLocal(path);
    }
    return files.length;
  }
}

interface NormalizedImage {
  arrayBuffer: ArrayBuffer;
  contentType: string;
  height?: number;
  width?: number;
}

/** 上流Link Card Previewと同じ300KB上限。大きな画像だけカード用JPEGへ縮小する。 */
async function normalizeImage(
  arrayBuffer: ArrayBuffer,
  contentType: string
): Promise<NormalizedImage> {
  if (
    typeof Image === "undefined" ||
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return { arrayBuffer, contentType };
  }
  const objectUrl = URL.createObjectURL(
    new Blob([arrayBuffer], { type: contentType })
  );
  try {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = objectUrl;
    });
    if (!image) {
      return { arrayBuffer, contentType };
    }
    if (
      arrayBuffer.byteLength <= MAX_IMAGE_BYTES ||
      image.naturalWidth <= DOWNSCALE_WIDTH
    ) {
      return {
        arrayBuffer,
        contentType,
        height: image.naturalHeight,
        width: image.naturalWidth,
      };
    }
    const scale = DOWNSCALE_WIDTH / image.naturalWidth;
    const canvas = document.createElement("canvas");
    canvas.width = DOWNSCALE_WIDTH;
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        arrayBuffer,
        contentType,
        height: image.naturalHeight,
        width: image.naturalWidth,
      };
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (!blob) {
      return {
        arrayBuffer,
        contentType,
        height: image.naturalHeight,
        width: image.naturalWidth,
      };
    }
    return {
      arrayBuffer: await blob.arrayBuffer(),
      contentType: "image/jpeg",
      height: canvas.height,
      width: canvas.width,
    };
  } catch {
    return { arrayBuffer, contentType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const stores = new WeakMap<object, RichCardStore>();

/** ホーム・プレビュー・保存処理が同じURLを同時取得しないためのvault単位共有ストア。 */
export function getRichCardStore(
  vault: Vault,
  options: RichCardStoreOptions
): RichCardStore {
  const existing = stores.get(vault);
  if (existing) {
    existing.updateOptions(options);
    return existing;
  }
  const store = new RichCardStore(vault, options);
  stores.set(vault, store);
  return store;
}
