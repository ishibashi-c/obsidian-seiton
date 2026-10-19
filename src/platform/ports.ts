import type {
  BookEditInput,
  BookMetadata,
  BookOwnershipStatus,
} from "../domain/book";
import type {
  LibraryAvailability,
  LibraryBatchAvailability,
  LibrarySearchOptions,
} from "../domain/library";
import type { RichCardMetadata } from "../shared/richCard";
import type { SeitonSettings } from "../shared/types";

/** UIが必要とするリッチカード操作だけを定義する。 */
export interface RichCardGateway {
  allows: (url: string) => boolean;
  fetch: (url: string) => Promise<RichCardMetadata>;
}

/** UIが必要とする書誌操作だけを定義する。実装はplatform/obsidianが提供する。 */
export interface BookGateway {
  create: (
    input: {
      metadata: BookMetadata;
      finished?: string;
      category?: string;
      lists?: string[];
      ownership?: BookOwnershipStatus;
      rating?: number;
      series?: string;
      notes?: string;
    },
    settings: SeitonSettings
  ) => Promise<string>;
  fetch: (isbn: string) => Promise<BookMetadata | null>;
  findByIsbn: (isbn: string) => Promise<string | null>;
  findSimilar: (
    title: string,
    author: string
  ) => Promise<Array<{ path: string }>>;
  search: (query: string) => Promise<BookMetadata[]>;
  update: (
    bookPath: string,
    input: BookEditInput,
    settings?: SeitonSettings
  ) => Promise<void>;
}

/** UIが必要とする表紙保存操作だけを定義する。 */
export interface CoverGateway {
  save: (notePath: string, coverPath: string) => Promise<void>;
}

/** UIが必要とするカーリル蔵書検索だけを定義する。 */
export interface CalilGateway {
  search: (
    isbn: string,
    settings: SeitonSettings,
    options?: LibrarySearchOptions
  ) => Promise<LibraryAvailability>;
  searchBatch: (
    books: Array<{ id: string; isbn: string; title: string }>,
    settings: SeitonSettings,
    options?: LibrarySearchOptions
  ) => Promise<LibraryBatchAvailability>;
}
