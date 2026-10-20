/** カーリル図書館APIとの通信を担当するObsidian platform adapter。 */
import { requestUrl } from "obsidian";
import { isbn13To10, isValidIsbn, normalizeIsbn } from "../../domain/book";
import type {
  LibraryAvailability,
  LibraryBatchAvailability,
  LibraryBatchItem,
  LibraryHolding,
  LibrarySearchOptions,
} from "../../domain/library";
import { calilBookUrl } from "../../domain/library";
import type { SeitonSettings } from "../../shared/types";
import { searchAddressCandidates } from "./geocodingApi";

interface CalilLibraryRecord {
  category?: string;
  city?: string;
  distance?: number | string;
  formal?: string;
  libid?: string | number;
  libkey?: string;
  pref?: string;
  systemid?: string;
  systemname?: string;
}

interface CalilLibraryEnvelope {
  Libraries?: CalilLibraryRecord[];
}

type CalilLibraryResponse = CalilLibraryRecord[] | CalilLibraryEnvelope;

interface CalilBookSystemResult {
  libkey?: Record<string, string>;
  reserveurl?: string;
}

interface CalilCheckResponse {
  books?: Record<string, Record<string, CalilBookSystemResult>>;
  continue?: number;
  session?: string;
}

const MAX_POLL_COUNT = 12;
const MAX_CONCURRENT_BATCH_SEARCHES = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const availabilityCache = new Map<
  string,
  { expiresAt: number; result: LibraryAvailability }
>();

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("カーリルから空の応答が返りました");
  }
  const json = tryParseJson<T>(trimmed);
  if (json) {
    return json;
  }
  const start = trimmed.indexOf("(");
  const end = trimmed.lastIndexOf(")");
  if (start >= 0 && end > start) {
    const jsonp = tryParseJson<T>(trimmed.slice(start + 1, end));
    if (jsonp) {
      return jsonp;
    }
  }
  throw new Error("カーリルの応答を解釈できませんでした");
}

export function extractLibraryRecords(
  response: CalilLibraryResponse
): CalilLibraryRecord[] {
  return Array.isArray(response) ? response : (response.Libraries ?? []);
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await requestUrl({ method: "GET", url });
  if (response.status < 200 || response.status >= 300) {
    throw new Error("カーリルへの接続に失敗しました");
  }
  return parseJsonResponse<T>(response.text);
}

function apiSettings(settings: SeitonSettings): {
  appkey: string;
  city: string;
  pref: string;
} {
  const appkey = settings.calilAppKey.trim();
  const pref = settings.calilPrefecture.trim();
  const city = settings.calilCity.trim();
  if (!appkey) {
    throw new Error("設定からカーリルのアプリケーションキーを登録してください");
  }
  return { appkey, city, pref };
}

interface ReferencePoint {
  latitude: number;
  longitude: number;
}

async function resolveReferencePoint(
  settings: SeitonSettings,
  options?: LibrarySearchOptions
): Promise<ReferencePoint | undefined> {
  const fallbackAddress = options?.referenceAddress?.trim();
  if (fallbackAddress) {
    const candidate = (await searchAddressCandidates(fallbackAddress))[0];
    if (!candidate) {
      throw new Error("指定地点の座標を取得できませんでした");
    }
    return {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    };
  }
  if (
    settings.calilReferenceLatitude !== null &&
    settings.calilReferenceLongitude !== null
  ) {
    return {
      latitude: settings.calilReferenceLatitude,
      longitude: settings.calilReferenceLongitude,
    };
  }
  const cityAddress = settings.calilCity.trim()
    ? `${settings.calilPrefecture.trim()}${settings.calilCity.trim()}`
    : "";
  if (!cityAddress) {
    return undefined;
  }
  const candidate = (await searchAddressCandidates(cityAddress))[0];
  if (!candidate) {
    throw new Error("指定地点の座標を取得できませんでした");
  }
  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  };
}

async function fetchLibraries(
  settings: SeitonSettings,
  referencePoint?: ReferencePoint
): Promise<CalilLibraryRecord[]> {
  const { appkey, city, pref } = apiSettings(settings);
  const parameters = new URLSearchParams({
    appkey,
    callback: "",
    format: "json",
    limit: "100",
  });
  if (pref) {
    parameters.set("pref", pref);
  }
  if (city) {
    parameters.set("city", city);
  }
  if (referencePoint) {
    // カーリルAPIのgeocodeは経度,緯度の順。
    parameters.set(
      "geocode",
      `${referencePoint.longitude},${referencePoint.latitude}`
    );
  }
  const response = await requestJson<CalilLibraryResponse>(
    `https://api.calil.jp/library?${parameters.toString()}`
  );
  return extractLibraryRecords(response);
}

async function waitTwoSeconds(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));
}

async function fetchBookResults(
  appkey: string,
  isbn: string,
  systemIds: string[]
): Promise<CalilCheckResponse> {
  let response = await requestJson<CalilCheckResponse>(
    `https://api.calil.jp/check?${new URLSearchParams({
      appkey,
      callback: "no",
      format: "json",
      isbn,
      systemid: systemIds.join(","),
    }).toString()}`
  );
  for (
    let count = 0;
    response.continue === 1 && response.session && count < MAX_POLL_COUNT;
    count++
  ) {
    await waitTwoSeconds();
    response = await requestJson<CalilCheckResponse>(
      `https://api.calil.jp/check?${new URLSearchParams({
        appkey,
        callback: "no",
        format: "json",
        session: response.session,
      }).toString()}`
    );
  }
  return response;
}

function matchingBookResult(
  response: CalilCheckResponse,
  isbn: string
): Record<string, CalilBookSystemResult> | undefined {
  const isbn10 = isbn13To10(isbn);
  return (
    response.books?.[isbn] ?? (isbn10 ? response.books?.[isbn10] : undefined)
  );
}

function toHolding(
  library: CalilLibraryRecord,
  libKey: string,
  result: CalilBookSystemResult
): LibraryHolding | null {
  const systemId = library.systemid?.trim() ?? "";
  if (!systemId) {
    return null;
  }
  const formal = library.formal?.trim() || library.systemname?.trim() || libKey;
  const libId = String(library.libid ?? "").trim();
  let reserveUrl: string | undefined;
  try {
    const candidate = new URL(result.reserveurl ?? "");
    if (candidate.protocol === "http:" || candidate.protocol === "https:") {
      reserveUrl = candidate.toString();
    }
  } catch {
    reserveUrl = undefined;
  }
  return {
    calilUrl: libId
      ? `https://calil.jp/library/${encodeURIComponent(libId)}/${encodeURIComponent(formal)}`
      : `https://calil.jp/library/search?s=${encodeURIComponent(systemId)}&k=${encodeURIComponent(libKey)}`,
    category: library.category?.trim() || undefined,
    distance: toDistance(library.distance),
    formal,
    libId,
    libKey,
    reserveUrl,
    status: "蔵書あり",
    systemId,
    systemName: library.systemname?.trim() || systemId,
  };
}

function toDistance(value: number | string | undefined): number | undefined {
  const distance = typeof value === "number" ? value : Number(value);
  return Number.isFinite(distance) && distance >= 0 ? distance : undefined;
}

export function collectLibraryHoldings(
  libraries: CalilLibraryRecord[],
  results: Record<string, CalilBookSystemResult>
): LibraryHolding[] {
  const holdings: LibraryHolding[] = [];
  const seen = new Set<string>();
  for (const library of libraries) {
    const systemId = library.systemid?.trim() ?? "";
    const result = results[systemId];
    const libKey = library.libkey?.trim() ?? "";
    const status = libKey ? result?.libkey?.[libKey] : undefined;
    if (!(status && systemId)) {
      continue;
    }
    const holdingKey = `${systemId}\u0000${libKey}`;
    if (seen.has(holdingKey)) {
      continue;
    }
    const holding = toHolding(library, libKey, {
      reserveurl: result.reserveurl,
    });
    if (holding) {
      holdings.push({ ...holding, status });
      seen.add(holdingKey);
    }
  }
  return holdings;
}

function availabilityCacheKey(
  isbn: string,
  settings: SeitonSettings,
  referencePoint?: ReferencePoint
): string {
  return [
    isbn,
    settings.calilPrefecture.trim(),
    settings.calilCity.trim(),
    referencePoint?.latitude ?? "",
    referencePoint?.longitude ?? "",
  ].join("|");
}

async function searchWithLibraries(
  isbn: string,
  appkey: string,
  libraries: CalilLibraryRecord[],
  settings: SeitonSettings,
  referencePoint: ReferencePoint | undefined,
  forceRefresh = false
): Promise<LibraryAvailability> {
  const cacheKey = availabilityCacheKey(isbn, settings, referencePoint);
  const cached = availabilityCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  const systemIds = [
    ...new Set(
      libraries.map((library) => library.systemid?.trim() ?? "").filter(Boolean)
    ),
  ].slice(0, 100);
  const bookUrl = calilBookUrl(isbn);
  if (systemIds.length === 0) {
    const empty = {
      bookUrl,
      checkedAt: new Date().toISOString(),
      isbn,
      libraries: [],
    } satisfies LibraryAvailability;
    availabilityCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result: empty,
    });
    return empty;
  }
  const response = await fetchBookResults(appkey, isbn, systemIds);
  const results = matchingBookResult(response, isbn);
  const availability = {
    bookUrl,
    checkedAt: new Date().toISOString(),
    isbn,
    libraries: results ? collectLibraryHoldings(libraries, results) : [],
    timedOut: response.continue === 1,
  } satisfies LibraryAvailability;
  if (!availability.timedOut) {
    availabilityCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result: availability,
    });
  }
  return availability;
}

export async function searchCalilLibraries(
  isbnRaw: string,
  settings: SeitonSettings,
  options?: LibrarySearchOptions
): Promise<LibraryAvailability> {
  const isbn = normalizeIsbn(isbnRaw);
  if (!isValidIsbn(isbn)) {
    throw new Error("ISBNの形式が正しくありません");
  }
  const { appkey, pref } = apiSettings(settings);
  const referencePoint = await resolveReferencePoint(settings, options);
  if (!(pref || referencePoint)) {
    throw new Error("設定から検索する都道府県を選択してください");
  }
  const libraries = await fetchLibraries(settings, referencePoint);
  return searchWithLibraries(
    isbn,
    appkey,
    libraries,
    settings,
    referencePoint,
    options?.forceRefresh
  );
}

export async function searchCalilLibrariesBatch(
  books: Array<{ id: string; isbn: string; title: string }>,
  settings: SeitonSettings,
  options?: LibrarySearchOptions
): Promise<LibraryBatchAvailability> {
  const items: LibraryBatchItem[] = books.map((book) => ({
    bookId: book.id,
    isbn: normalizeIsbn(book.isbn),
    status: "queued",
    title: book.title,
  }));
  for (const item of items) {
    options?.onProgress?.(item);
  }
  const { appkey, pref } = apiSettings(settings);
  const referencePoint = await resolveReferencePoint(settings, options);
  if (!(pref || referencePoint)) {
    throw new Error("設定から検索する都道府県を選択してください");
  }
  const libraries = await fetchLibraries(settings, referencePoint);
  let nextIndex = 0;
  const workerCount = Math.min(MAX_CONCURRENT_BATCH_SEARCHES, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        if (!item) {
          return;
        }
        if (!isValidIsbn(item.isbn)) {
          item.status = "error";
          item.error = "ISBNの形式が正しくありません";
          options?.onProgress?.(item);
          continue;
        }
        item.status = "loading";
        options?.onProgress?.(item);
        try {
          const result = await searchWithLibraries(
            item.isbn,
            appkey,
            libraries,
            settings,
            referencePoint,
            options?.forceRefresh
          );
          item.result = result;
          item.status = result.timedOut
            ? "timeout"
            : result.libraries.length > 0
              ? "success"
              : "empty";
        } catch (cause) {
          item.status = "error";
          item.error =
            cause instanceof Error ? cause.message : "検索に失敗しました";
        }
        options?.onProgress?.(item);
      }
    })
  );
  return { items };
}
