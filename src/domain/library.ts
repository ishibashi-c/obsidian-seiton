/** 図書館蔵書検索の表示モデル。外部APIのJSON形式をUIへ漏らさない。 */

export interface LibraryHolding {
  calilUrl: string;
  category?: string;
  distance?: number;
  formal: string;
  libId: string;
  libKey: string;
  reserveUrl?: string;
  status: string;
  systemId: string;
  systemName: string;
}

export interface LibrarySearchOptions {
  /** キャッシュを使わず、カーリルへ再問い合わせする。 */
  forceRefresh?: boolean;
  /** 一括検索の進捗。外部APIの生レスポンスは渡さない。 */
  onProgress?: (item: LibraryBatchItem) => void;
  /** 検索時だけ使う住所。設定やVaultには保存しない。 */
  referenceAddress?: string;
}

export interface LibraryAvailability {
  bookUrl: string;
  checkedAt: string;
  isbn: string;
  libraries: LibraryHolding[];
  timedOut?: boolean;
}

export type LibraryBatchItemStatus =
  | "queued"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "timeout";

export interface LibraryBatchItem {
  bookId: string;
  error?: string;
  isbn: string;
  result?: LibraryAvailability;
  status: LibraryBatchItemStatus;
  title: string;
}

export interface LibraryBatchAvailability {
  items: LibraryBatchItem[];
}

export interface LibrarySearchHistoryEntry {
  availableCount: number;
  bookId: string;
  bookUrl: string;
  checkedAt: string;
  isbn: string;
  title: string;
}

export function calilBookUrl(rawIsbn: string): string {
  const normalized = normalizeIsbnForUrl(rawIsbn);
  return `https://calil.jp/book/${isbn13To10ForUrl(normalized) ?? normalized}`;
}

function normalizeIsbnForUrl(raw: string): string {
  return raw.replace(/[\s-]/g, "").trim().toUpperCase();
}

function isbn13To10ForUrl(isbn: string): string | null {
  if (!/^978\d{10}$/.test(isbn)) {
    return null;
  }
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce(
    (total, digit, index) => total + Number(digit) * (10 - index),
    0
  );
  const check = 11 - (sum % 11);
  return `${core}${check === 10 ? "X" : check === 11 ? "0" : check}`;
}
