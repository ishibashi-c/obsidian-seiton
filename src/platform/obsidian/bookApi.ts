/** openBDを優先し、Open Libraryへフォールバックする書誌API adapter。 */
import { requestUrl } from "obsidian";
import type { BookMetadata } from "../../domain/book";
import { isValidIsbn, normalizeIsbn } from "../../domain/book";

interface OpenLibraryDocument {
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  publisher?: string[];
  title?: string;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibraryDocument[];
}

interface OpenBdRecord {
  summary?: {
    author?: string;
    cover?: string;
    isbn?: string;
    pubdate?: string;
    publisher?: string;
    title?: string;
  };
}

let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

/** Open Libraryの未識別client上限（1 req/s）を越えないよう全検索を直列化する。 */
async function requestOpenLibrary(url: string): Promise<string> {
  let text = "";
  const operation = requestQueue.then(async () => {
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
    try {
      const response = await requestUrl({ method: "GET", url });
      if (response.status !== 200) {
        throw new Error("Open Library request failed");
      }
      text = response.text;
    } finally {
      nextRequestAt = Date.now() + 1100;
    }
  });
  requestQueue = operation.catch(() => undefined);
  await operation;
  return text;
}

function toMetadata(
  document: OpenLibraryDocument,
  preferredIsbn = ""
): BookMetadata | null {
  if (!document.title) {
    return null;
  }
  const isbn =
    preferredIsbn || document.isbn?.map(normalizeIsbn).find(isValidIsbn) || "";
  return {
    author: document.author_name?.join(", ") ?? "",
    coverUrl: document.cover_i
      ? `https://covers.openlibrary.org/b/id/${document.cover_i}-L.jpg?default=false`
      : isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
        : "",
    isbn,
    pages: document.number_of_pages_median ?? 0,
    publishDate: document.first_publish_year
      ? String(document.first_publish_year)
      : "",
    publisher: document.publisher?.[0] ?? "",
    title: document.title,
  };
}

async function searchOpenLibrary(
  parameters: URLSearchParams
): Promise<OpenLibraryDocument[]> {
  parameters.set("limit", parameters.get("limit") ?? "10");
  parameters.set(
    "fields",
    "title,author_name,publisher,first_publish_year,isbn,number_of_pages_median,cover_i"
  );
  const text = await requestOpenLibrary(
    `https://openlibrary.org/search.json?${parameters.toString()}`
  );
  return text
    ? ((JSON.parse(text) as OpenLibrarySearchResponse).docs ?? [])
    : [];
}

async function fetchOpenBd(isbn: string): Promise<BookMetadata | null> {
  const response = await requestUrl({
    method: "GET",
    url: `https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`,
  });
  if (response.status !== 200) {
    throw new Error("openBD request failed");
  }
  const record = (JSON.parse(response.text) as Array<OpenBdRecord | null>)[0];
  const summary = record?.summary;
  if (!summary?.title) {
    return null;
  }
  return {
    author: summary.author ?? "",
    coverUrl: summary.cover ?? "",
    isbn: normalizeIsbn(summary.isbn || isbn),
    pages: 0,
    publishDate: summary.pubdate ?? "",
    publisher: summary.publisher ?? "",
    title: summary.title,
  };
}

export async function fetchBookMetadata(
  isbnRaw: string
): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(isbnRaw);
  if (!isValidIsbn(isbn)) {
    return null;
  }
  let openBdMetadata: BookMetadata | null = null;
  let openBdError: unknown;
  try {
    openBdMetadata = await fetchOpenBd(isbn);
  } catch (error) {
    openBdError = error;
  }
  if (openBdMetadata) {
    return openBdMetadata;
  }
  const docs = await searchOpenLibrary(
    new URLSearchParams({ isbn, limit: "1" })
  );
  const metadata = docs[0] ? toMetadata(docs[0], isbn) : null;
  if (metadata) {
    return metadata;
  }
  if (openBdError) {
    throw openBdError;
  }
  return null;
}

export async function searchBookMetadata(
  query: string
): Promise<BookMetadata[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const docs = await searchOpenLibrary(
    new URLSearchParams({ limit: "10", q: trimmed })
  );
  return docs.flatMap((document) => {
    const metadata = toMetadata(document);
    return metadata ? [metadata] : [];
  });
}
