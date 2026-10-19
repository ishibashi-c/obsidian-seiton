/** 書誌データとISBN処理。実行環境に依存しないドメイン層。 */

export interface BookMetadata {
  author: string;
  coverUrl: string;
  isbn: string;
  pages: number;
  publishDate: string;
  publisher: string;
  title: string;
}

export type BookReadingStatus = "tbr" | "read";

/** 本棚に登録した本を実際に所持しているか。値はfrontmatterで言語中立に保存する。 */
export type BookOwnershipStatus = "owned" | "unowned";

export const DEFAULT_BOOK_OWNERSHIP: BookOwnershipStatus = "unowned";

export function normalizeBookOwnership(raw: unknown): BookOwnershipStatus {
  if (raw === true) {
    return "owned";
  }
  if (raw === false) {
    return "unowned";
  }
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (["owned", "own", "true", "所持", "持っている"].includes(value)) {
    return "owned";
  }
  return DEFAULT_BOOK_OWNERSHIP;
}

export interface BookEditInput {
  author: string;
  category?: string;
  finished: string;
  lists?: string[];
  ownership?: BookOwnershipStatus;
  rating?: number;
  readingStatus: BookReadingStatus;
  series?: string;
  title: string;
}

export function normalizeIsbn(raw: string): string {
  const compact = raw.replace(/[\s-]/g, "").trim().toUpperCase();
  return /^\d{9}[\dX]$/.test(compact) ? isbn10To13(compact) : compact;
}

/** YAMLのクォート有無に左右されず、frontmatterのISBNをUIで扱える形にする。 */
export function bookIsbnValue(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) ? normalizeIsbn(String(raw)) : undefined;
  }
  return typeof raw === "string" ? normalizeIsbn(raw) || undefined : undefined;
}

export function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0
  );
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** カーリルの本ページ（ISBN10）へリンクするための変換。979系は13桁のまま扱う。 */
export function isbn13To10(raw: string): string | null {
  const isbn = normalizeIsbn(raw);
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

export function splitIsbnInput(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\n,;]+/)
        .map(normalizeIsbn)
        .filter(Boolean)
    ),
  ];
}

export function isValidIsbn(raw: string): boolean {
  const compact = raw.replace(/[\s-]/g, "").trim().toUpperCase();
  if (/^\d{9}[\dX]$/.test(compact)) {
    const sum = [...compact].reduce(
      (total, digit, index) =>
        total + (digit === "X" ? 10 : Number(digit)) * (10 - index),
      0
    );
    return sum % 11 === 0;
  }

  const isbn = normalizeIsbn(compact);
  if (!/^97[89]\d{10}$/.test(isbn)) {
    return false;
  }
  const sum = [...isbn].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0
  );
  return sum % 10 === 0;
}
