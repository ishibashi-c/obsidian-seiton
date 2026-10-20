/** @jsxImportSource react */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  BookEditInput,
  BookOwnershipStatus,
  BookReadingStatus,
} from "../../domain/book";
import type {
  LibraryAvailability,
  LibraryBatchAvailability,
  LibraryBatchItem,
  LibrarySearchHistoryEntry,
  LibrarySearchOptions,
} from "../../domain/library";
import { calilBookUrl } from "../../domain/library";
import { type Lang, t } from "../../shared/i18n";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { BookDataNotice } from "../patterns/BookDataNotice";
import { OverflowMenuTrigger } from "../patterns/OverflowMenuTrigger";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

export interface Book {
  author: string;
  category?: string;
  cover?:
    | "accent"
    | "ink"
    | "violet"
    | "navy"
    | "ochre"
    | "green"
    | "rose"
    | "slate";
  coverUrl?: string;
  finished: string;
  id: string;
  isbn?: string;
  lists?: string[];
  note: string;
  ownership: BookOwnershipStatus;
  pinned?: boolean;
  rating?: number;
  readingStatus: BookReadingStatus;
  series?: string;
  title: string;
}

const BOOKS: Book[] = [
  {
    author: "岸見 一郎, 古賀 史健",
    category: "ノンフィクション",
    cover: "violet",
    finished: "2026.08.28",
    id: "kirawareru-yuki",
    isbn: "9784478025819",
    note: "嫌われる勇気の読書記録。",
    ownership: "owned",
    readingStatus: "read",
    title: "嫌われる勇気",
  },
  {
    author: "村田 沙耶香",
    category: "フィクション",
    cover: "navy",
    finished: "2026.08.26",
    id: "konbini-ningen",
    isbn: "9784163906188",
    note: "コンビニ人間の読書記録。",
    ownership: "owned",
    rating: 4,
    readingStatus: "read",
    title: "コンビニ人間",
  },
  {
    author: "森見 登美彦",
    category: "フィクション",
    cover: "green",
    finished: "2026.08.24",
    id: "yoru-wa-mijikashi",
    isbn: "9784043878024",
    note: "夜は短し歩けよ乙女の読書記録。",
    ownership: "owned",
    rating: 5,
    readingStatus: "read",
    title: "夜は短し歩けよ乙女",
  },
  {
    author: "James Clear",
    category: "実用・ビジネス",
    cover: "ochre",
    finished: "",
    id: "atomic-habits",
    isbn: "9780735211292",
    note: "Atomic Habitsの読書記録。",
    ownership: "unowned",
    rating: 3,
    readingStatus: "tbr",
    title: "Atomic Habits",
  },
  {
    author: "Donald A. Norman",
    category: "学術・専門",
    cover: "rose",
    finished: "",
    id: "design-of-everyday-things",
    isbn: "9780465050659",
    note: "The Design of Everyday Thingsの読書記録。",
    ownership: "unowned",
    rating: 4,
    readingStatus: "tbr",
    title: "The Design of Everyday Things",
  },
  {
    author: "Robert C. Martin",
    category: "未分類",
    cover: "slate",
    finished: "",
    id: "clean-code",
    isbn: "9780132350884",
    note: "Clean Codeの読書記録。",
    ownership: "unowned",
    rating: 5,
    readingStatus: "tbr",
    title: "Clean Code",
  },
  {
    author: "伊賀 泰代",
    category: "実用・ビジネス",
    cover: "ink",
    finished: "2026.08.20",
    id: "productive-reading",
    isbn: "9784478101575",
    note: "日本語の書誌情報とISBNの表示確認用。",
    ownership: "owned",
    rating: 4,
    readingStatus: "read",
    title: "生産性――マッキンゼーが組織と人材に求め続けるもの",
  },
  {
    author: "確認中",
    category: "未分類",
    finished: "",
    id: "manual-book",
    note: "ISBNなしの手入力本も同じ本棚で扱えることを確認する記録。",
    ownership: "unowned",
    readingStatus: "tbr",
    title: "ISBNを後で確認する本",
  },
];

const EMPTY_CALIL_SEARCH_HISTORY: LibrarySearchHistoryEntry[] = [];

const libraryCategoryLabels: Record<string, string> = {
  BM: "移動図書館",
  LARGE: "広域図書館",
  MEDIUM: "地域図書館",
  SMALL: "図書室・公民館",
  SPECIAL: "専門図書館",
  UNIV: "大学図書館",
};

type LibraryResultSort = "category" | "distance" | "name";

type FloatingMenuPosition = {
  left: number;
  top: number;
};

function toPortalPosition(
  left: number,
  top: number,
  positioningRoot: HTMLElement | null
): FloatingMenuPosition {
  const targetRect = positioningRoot?.getBoundingClientRect();
  return {
    left: Math.round(left - (targetRect?.left ?? 0)),
    top: Math.round(top - (targetRect?.top ?? 0)),
  };
}

type BookshelfView = "cards" | "list";

type BulkBookChange = {
  category: string;
  listName: string;
  ownership: "unchanged" | BookOwnershipStatus;
  readingStatus: "unchanged" | BookReadingStatus;
};

export interface BookshelfBulkUpdate {
  book: Book;
  input: BookEditInput;
}

export interface BookshelfBulkEditResult {
  failedIds: string[];
  updatedIds: string[];
}

function localDateInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function historyDateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "確認日時不明"
    : date.toLocaleDateString("ja-JP", { day: "numeric", month: "numeric" });
}

function bulkEditInputForBook(
  book: Book,
  change: BulkBookChange
): BookEditInput {
  const readingStatus =
    change.readingStatus === "unchanged"
      ? book.readingStatus
      : change.readingStatus;
  const ownership =
    change.ownership === "unchanged" ? book.ownership : change.ownership;
  let finished = book.finished.replace(/\./g, "-");
  if (change.readingStatus === "read" && !finished) {
    finished = localDateInput();
  }
  if (change.readingStatus === "tbr") {
    finished = "";
  }
  const lists = [...(book.lists ?? [])];
  if (change.listName !== "unchanged" && !lists.includes(change.listName)) {
    lists.push(change.listName);
  }
  return {
    author: book.author,
    category:
      change.category === "unchanged"
        ? (book.category ?? "未分類")
        : change.category,
    finished,
    lists,
    ownership,
    rating: book.rating,
    readingStatus,
    series: book.series,
    title: book.title,
  };
}

function readingStatusLabel(lang: Lang, status: BookReadingStatus): string {
  return t(lang, status === "read" ? "book.rackCompleted" : "book.rackToRead");
}

function ownershipLabel(lang: Lang, ownership: BookOwnershipStatus): string {
  return t(
    lang,
    ownership === "owned" ? "book.ownershipOwned" : "book.ownershipUnowned"
  );
}

function Cover({
  lang,
  variant,
  url,
  title,
}: {
  lang: Lang;
  variant?: Book["cover"];
  url?: string;
  title: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = Boolean(url && failedUrl === url);

  if (url && !failed) {
    return (
      <img
        alt={t(lang, "book.coverFor", { title })}
        className="react-bookshelf-cover-image"
        height={320}
        onError={() => setFailedUrl(url ?? null)}
        src={url}
        width={220}
      />
    );
  }
  if (!variant) {
    return (
      <span aria-hidden="true" className="react-bookshelf-cover-placeholder">
        {t(lang, "book.noCover")}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`react-bookshelf-cover-art is-${variant}`}
    >
      <span>{variant === "accent" ? "読" : "記"}</span>
    </span>
  );
}

function BookCard({
  book,
  index,
  lang,
  onOpen,
  onToggleMenu,
  menuOpen,
  onToggleSelect,
  selected,
}: {
  book: Book;
  index: number;
  lang: Lang;
  onOpen: (book: Book) => void;
  onToggleMenu: (book: Book, anchor: HTMLButtonElement) => void;
  menuOpen: boolean;
  onToggleSelect?: (book: Book, selected: boolean) => void;
  selected?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="react-bookshelf-card-motion"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
    >
      <Card
        className="react-bookshelf-card"
        padding="md"
        radius="lg"
        withBorder
      >
        <div className="react-bookshelf-card-layout">
          <button
            aria-label={t(lang, "book.openTitle", { title: book.title })}
            className="react-bookshelf-cover-button"
            onClick={() => onOpen(book)}
            type="button"
          >
            <span className="react-bookshelf-cover-slot">
              <Cover
                lang={lang}
                title={book.title}
                url={book.coverUrl}
                variant={book.cover}
              />
            </span>
          </button>
          <div className="react-bookshelf-card-body">
            <div className="react-bookshelf-card-topline">
              <div className="react-bookshelf-card-badges">
                {onToggleSelect ? (
                  <label className="react-bookshelf-select">
                    <input
                      aria-label={t(lang, "book.selectTitle", {
                        title: book.title,
                      })}
                      checked={selected}
                      onChange={(event) =>
                        onToggleSelect(book, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span>{t(lang, "action.select")}</span>
                  </label>
                ) : null}
              </div>
              <OverflowMenuTrigger
                anchorId={book.id}
                className="react-bookshelf-more react-bookshelf-card-more"
                controls={menuOpen ? "react-bookshelf-actions-menu" : undefined}
                expanded={menuOpen}
                label={t(lang, "book.moreActionsFor", {
                  title: book.title,
                })}
                onClick={(event) => onToggleMenu(book, event.currentTarget)}
              />
            </div>
            <button
              aria-label={t(lang, "book.openTitle", { title: book.title })}
              className="react-bookshelf-main"
              onClick={() => onOpen(book)}
              type="button"
            >
              <span className="react-bookshelf-title-slot">
                <strong>{book.title}</strong>
              </span>
              <span className="react-bookshelf-author">
                {book.author || t(lang, "book.authorMissing")}
              </span>
              <span className="react-bookshelf-book-tags">
                <span className="react-bookshelf-book-category-row">
                  <span className="react-bookshelf-category-label">
                    {book.category ?? t(lang, "book.categoryUnassigned")}
                  </span>
                </span>
                <span className="react-bookshelf-book-status-row">
                  <span
                    className={`react-bookshelf-reading-status is-${book.readingStatus}`}
                  >
                    <span
                      aria-hidden="true"
                      className="react-bookshelf-reading-status-mark"
                    />
                    {readingStatusLabel(lang, book.readingStatus)}
                  </span>
                  <span
                    className={`react-bookshelf-ownership is-${book.ownership}`}
                  >
                    <span
                      aria-hidden="true"
                      className="react-bookshelf-ownership-mark"
                    />
                    {ownershipLabel(lang, book.ownership)}
                  </span>
                  {book.series ? (
                    <span className="react-bookshelf-series">
                      {book.series}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="react-bookshelf-finished">
                {book.finished || t(lang, "book.completionDateMissing")}
                {book.rating ? ` · ★${book.rating}` : ""}
              </span>
            </button>
          </div>
        </div>
      </Card>
    </motion.article>
  );
}

function BookListRow({
  book,
  lang,
  onOpen,
  onToggleMenu,
  menuOpen,
  onToggleSelect,
  selected,
}: {
  book: Book;
  lang: Lang;
  onOpen: (book: Book) => void;
  onToggleMenu: (book: Book, anchor: HTMLButtonElement) => void;
  menuOpen: boolean;
  onToggleSelect?: (book: Book, selected: boolean) => void;
  selected?: boolean;
}) {
  return (
    <div className="react-bookshelf-list-row">
      {onToggleSelect ? (
        <label className="react-bookshelf-list-check">
          <input
            aria-label={t(lang, "book.selectTitle", { title: book.title })}
            checked={selected}
            onChange={(event) =>
              onToggleSelect(book, event.currentTarget.checked)
            }
            type="checkbox"
          />
        </label>
      ) : (
        <span aria-hidden="true" className="react-bookshelf-list-check" />
      )}
      <button
        aria-label={t(lang, "book.openTitle", { title: book.title })}
        className="react-bookshelf-list-cover-button"
        onClick={() => onOpen(book)}
        type="button"
      >
        <span className="react-bookshelf-list-cover-slot">
          <Cover
            lang={lang}
            title={book.title}
            url={book.coverUrl}
            variant={book.cover}
          />
        </span>
      </button>
      <button
        aria-label={t(lang, "book.openTitle", { title: book.title })}
        className="react-bookshelf-list-main"
        onClick={() => onOpen(book)}
        type="button"
      >
        <strong>{book.title}</strong>
        <span>{book.author || t(lang, "book.authorMissing")}</span>
      </button>
      <span className="react-bookshelf-list-category react-bookshelf-category-label">
        {book.category ?? t(lang, "book.categoryUnassigned")}
      </span>
      <span className={`react-bookshelf-list-status is-${book.readingStatus}`}>
        <span
          aria-hidden="true"
          className="react-bookshelf-reading-status-mark"
        />
        {readingStatusLabel(lang, book.readingStatus)}
      </span>
      <span className={`react-bookshelf-list-ownership is-${book.ownership}`}>
        <span aria-hidden="true" className="react-bookshelf-ownership-mark" />
        {ownershipLabel(lang, book.ownership)}
      </span>
      <span className="react-bookshelf-list-rating">
        {book.rating ? `★${book.rating}` : "—"}
      </span>
      <OverflowMenuTrigger
        anchorId={book.id}
        className="react-bookshelf-more react-bookshelf-list-more"
        controls={menuOpen ? "react-bookshelf-actions-menu" : undefined}
        expanded={menuOpen}
        label={t(lang, "book.moreActionsFor", { title: book.title })}
        onClick={(event) => onToggleMenu(book, event.currentTarget)}
      />
    </div>
  );
}

function LibrarySearchPanel({
  error,
  lang,
  loading,
  onClose,
  onRetry,
  onSearch,
  requiresAddress,
  result,
}: {
  error: string;
  lang: Lang;
  loading: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onSearch?: (referenceAddress: string) => void;
  requiresAddress?: boolean;
  result: LibraryAvailability | null;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [resultSort, setResultSort] = useState<LibraryResultSort>("name");
  const [referenceAddress, setReferenceAddress] = useState("");

  useEffect(() => {
    if (error) {
      retryButtonRef.current?.focus();
    }
  }, [error]);

  if (loading) {
    return (
      <Stack className="react-bookshelf-library-state-panel" gap="md">
        <Text>地域の図書館へ蔵書状況を問い合わせています。</Text>
        <Alert color="accent" variant="light">
          図書館システムによっては結果の取得に時間がかかります。
        </Alert>
      </Stack>
    );
  }
  if (requiresAddress && (!result || error)) {
    return (
      <Stack className="react-bookshelf-library-state-panel" gap="md">
        {error ? (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        ) : null}
        {error ? null : (
          <div>
            <Title order={3} size="h4">
              {t(lang, "library.referenceAddressHeading")}
            </Title>
            <Text size="sm">{t(lang, "library.referenceAddressNotice")}</Text>
          </div>
        )}
        <TextInput
          label="検索時の住所"
          onChange={(event) => setReferenceAddress(event.currentTarget.value)}
          placeholder={t(lang, "library.referenceAddressPlaceholder")}
          value={referenceAddress}
        />
        <Group justify="flex-end">
          <Button onClick={onClose} variant="default">
            {t(lang, "notify.close")}
          </Button>
          <Button
            color="ink"
            disabled={!(referenceAddress.trim() && onSearch)}
            onClick={() => onSearch?.(referenceAddress.trim())}
            ref={retryButtonRef}
          >
            {t(lang, error ? "notify.retry" : "library.referenceAddressSearch")}
          </Button>
        </Group>
      </Stack>
    );
  }
  if (error) {
    return (
      <Stack className="react-bookshelf-library-state-panel" gap="md">
        <Alert color="red" role="alert">
          {error}
        </Alert>
        <Group justify="flex-end">
          <Button onClick={onClose} variant="default">
            {t(lang, "notify.close")}
          </Button>
          <Button
            color="ink"
            disabled={!onRetry}
            onClick={onRetry}
            ref={retryButtonRef}
          >
            {t(lang, "notify.retry")}
          </Button>
        </Group>
      </Stack>
    );
  }
  if (!result) {
    return null;
  }

  const statusOrder = ["貸出可", "貸出中", "予約中", "蔵書あり"];
  const statusCounts = result.libraries.reduce<Record<string, number>>(
    (counts, library) => {
      counts[library.status] = (counts[library.status] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const visibleStatuses = [
    ...statusOrder.filter((status) => statusCounts[status]),
    ...Object.keys(statusCounts).filter(
      (status) => !statusOrder.includes(status)
    ),
  ];
  const categories = [
    ...new Set(
      result.libraries.map((library) => library.category).filter(Boolean)
    ),
  ] as string[];
  const visibleLibraries = result.libraries
    .filter(
      (library) =>
        categoryFilter === "all" || library.category === categoryFilter
    )
    .sort((left, right) => {
      if (resultSort === "distance") {
        const leftDistance = left.distance ?? Number.POSITIVE_INFINITY;
        const rightDistance = right.distance ?? Number.POSITIVE_INFINITY;
        return (
          leftDistance - rightDistance ||
          left.formal.localeCompare(right.formal, "ja")
        );
      }
      if (resultSort === "category") {
        return (
          (
            libraryCategoryLabels[left.category ?? ""] ?? "未分類"
          ).localeCompare(
            libraryCategoryLabels[right.category ?? ""] ?? "未分類",
            "ja"
          ) || left.formal.localeCompare(right.formal, "ja")
        );
      }
      return left.formal.localeCompare(right.formal, "ja");
    });

  return (
    <div className="react-bookshelf-library-panel">
      <section
        aria-label="検索結果の概要"
        className="react-bookshelf-library-summary"
      >
        <div>
          <Title order={3} size="h3">
            {result.libraries.length > 0
              ? `${result.libraries.length}館で見つかりました`
              : "蔵書が見つかりません"}
          </Title>
          <Text className="react-bookshelf-library-isbn" size="sm">
            ISBN {result.isbn}
          </Text>
        </div>
        <a
          className="react-bookshelf-library-book-link"
          href={result.bookUrl}
          rel="noreferrer"
          target="_blank"
        >
          カーリルで本の詳細
          <span aria-hidden="true">↗</span>
        </a>
      </section>
      {visibleStatuses.length > 0 ? (
        <section
          aria-label="貸出状況の集計"
          className="react-bookshelf-library-status-summary"
        >
          {visibleStatuses.map((status) => (
            <div
              className={`react-bookshelf-library-status-count is-${libraryStatusTone(status)}`}
              key={status}
            >
              <span
                aria-hidden="true"
                className={`react-bookshelf-library-status-dot is-${libraryStatusTone(status)}`}
              />
              <span>{status}</span>
              <strong>{statusCounts[status]}</strong>
            </div>
          ))}
        </section>
      ) : null}
      {result.libraries.length === 0 ? (
        <div className="react-bookshelf-library-empty">
          <Alert color="accent" variant="light">
            指定地域で蔵書情報が見つかりませんでした。
          </Alert>
        </div>
      ) : (
        <section
          aria-labelledby="react-bookshelf-library-results-title"
          className="react-bookshelf-library-results-section"
        >
          <div className="react-bookshelf-library-results-heading">
            <Title id="react-bookshelf-library-results-title" order={4}>
              図書館
            </Title>
            <Group
              className="react-bookshelf-library-results-controls"
              gap="xs"
            >
              <Select
                aria-label="図書館カテゴリで絞り込む"
                data={[
                  { label: "すべてのカテゴリ", value: "all" },
                  ...categories.map((category) => ({
                    label: libraryCategoryLabels[category] ?? category,
                    value: category,
                  })),
                ]}
                onChange={(value) => setCategoryFilter(value ?? "all")}
                value={categoryFilter}
              />
              <Select
                aria-label="図書館の並び順"
                data={[
                  { label: "50音順", value: "name" },
                  { label: "近い順", value: "distance" },
                  { label: "カテゴリ順", value: "category" },
                ]}
                onChange={(value) =>
                  setResultSort((value as LibraryResultSort) || "name")
                }
                value={resultSort}
              />
            </Group>
          </div>
          <ul className="react-bookshelf-library-results">
            {visibleLibraries.map((library) => (
              <li
                className="react-bookshelf-library-result-row"
                key={`${library.systemId}:${library.libKey}`}
              >
                <div className="react-bookshelf-library-result-identity">
                  <a href={library.calilUrl} rel="noreferrer" target="_blank">
                    {library.formal}
                  </a>
                  <Text className="react-bookshelf-library-system" size="xs">
                    {library.systemName}
                    {library.category
                      ? ` · ${libraryCategoryLabels[library.category] ?? library.category}`
                      : ""}
                  </Text>
                </div>
                <div className="react-bookshelf-library-result-actions">
                  <span
                    className={`react-bookshelf-library-status is-${libraryStatusTone(library.status)}`}
                  >
                    <span
                      aria-hidden="true"
                      className="react-bookshelf-library-status-dot"
                    />
                    {library.status}
                  </span>
                  {library.distance === undefined ? null : (
                    <Text
                      className="react-bookshelf-library-distance"
                      size="xs"
                    >
                      {library.distance < 1
                        ? `${Math.round(library.distance * 1000)}m`
                        : `${library.distance.toFixed(1)}km`}
                    </Text>
                  )}
                  {library.reserveUrl ? (
                    <a
                      aria-label={`予約ページ（${library.formal}）`}
                      className="react-bookshelf-library-reserve"
                      href={library.reserveUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      予約
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.timedOut ? (
        <div className="react-bookshelf-library-timeout">
          <Alert color="accent" variant="light">
            一部の図書館システムからの応答が時間内に完了しませんでした。
          </Alert>
        </div>
      ) : null}
      <div className="react-bookshelf-library-footer">
        <Text className="react-bookshelf-library-footer-note" size="xs">
          蔵書状況は確認時点の情報です。
        </Text>
        <Button onClick={onClose} variant="default">
          閉じる
        </Button>
      </div>
    </div>
  );
}

function libraryStatusTone(status: string): string {
  if (status === "貸出可") {
    return "available";
  }
  if (status === "貸出中") {
    return "loaned";
  }
  if (status === "予約中") {
    return "reserved";
  }
  return "neutral";
}

function LibraryBatchPanel({
  error,
  items,
  loading,
  onClose,
}: {
  error: string;
  items: LibraryBatchItem[];
  loading: boolean;
  onClose: () => void;
}) {
  const statusLabel: Record<LibraryBatchItem["status"], string> = {
    empty: "蔵書なし",
    error: "エラー",
    loading: "検索中…",
    queued: "待機中",
    success: "見つかりました",
    timeout: "一部未取得",
  };
  return (
    <div className="react-bookshelf-batch-panel">
      {error ? <Alert color="red">{error}</Alert> : null}
      {error ? null : (
        <Text className="react-bookshelf-modal-muted" size="sm">
          {loading
            ? "選択した本を順番に検索しています。"
            : "検索結果をまとめて確認できます。"}
        </Text>
      )}
      <ul className="react-bookshelf-batch-list">
        {items.map((item) => (
          <li className="react-bookshelf-batch-row" key={item.bookId}>
            <div className="react-bookshelf-batch-identity">
              <strong>{item.title}</strong>
              <Text size="xs">ISBN {item.isbn}</Text>
            </div>
            <Badge
              color={item.status === "error" ? "red" : "accent"}
              variant="light"
            >
              {statusLabel[item.status]}
              {item.result ? ` · ${item.result.libraries.length}館` : ""}
            </Badge>
            <div className="react-bookshelf-batch-actions">
              <a
                href={item.result?.bookUrl ?? calilBookUrl(item.isbn)}
                rel="noreferrer"
                target="_blank"
              >
                カーリルで開く ↗
              </a>
              {item.result?.libraries.slice(0, 3).map((library) => (
                <a
                  href={library.calilUrl}
                  key={`${item.bookId}:${library.systemId}:${library.libKey}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {library.formal}（{library.status}）
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          閉じる
        </Button>
      </Group>
    </div>
  );
}

function BulkEditPanel({
  categories,
  lang,
  listNames,
  onClose,
  onSave,
  saving,
  selectedBooks,
  selectedCount,
  selectedBooksLabel,
}: {
  categories: string[];
  lang: Lang;
  listNames: string[];
  onClose: () => void;
  onSave: (change: BulkBookChange) => void | Promise<void>;
  saving: boolean;
  selectedBooks: readonly Book[];
  selectedCount: number;
  selectedBooksLabel: string;
}) {
  const [readingStatus, setReadingStatus] =
    useState<BulkBookChange["readingStatus"]>("unchanged");
  const [ownership, setOwnership] =
    useState<BulkBookChange["ownership"]>("unchanged");
  const [category, setCategory] = useState("unchanged");
  const [listName, setListName] = useState("unchanged");
  const hasChange =
    readingStatus !== "unchanged" ||
    ownership !== "unchanged" ||
    category !== "unchanged" ||
    listName !== "unchanged";

  return (
    <Stack className="react-bookshelf-bulk-edit-panel" gap="md">
      <div>
        <Title order={2} size="h3">
          {t(lang, "book.bulkEditTitle")}
        </Title>
        <Text className="react-bookshelf-modal-muted" size="sm">
          {t(lang, "book.bulkEditSummary", { count: `${selectedCount}` })}
        </Text>
      </div>
      <SelectedBooksDisclosure
        books={selectedBooks}
        label={selectedBooksLabel}
        open
      />
      <div className="react-bookshelf-bulk-edit-grid">
        <Select
          data={[
            { label: t(lang, "book.noChange"), value: "unchanged" },
            { label: t(lang, "book.markRead"), value: "read" },
            { label: t(lang, "book.returnToTbr"), value: "tbr" },
          ]}
          label={t(lang, "book.readingStatus")}
          onChange={(value) =>
            setReadingStatus(
              (value as BulkBookChange["readingStatus"]) || "unchanged"
            )
          }
          value={readingStatus}
        />
        <Select
          data={[
            { label: t(lang, "book.noChange"), value: "unchanged" },
            { label: t(lang, "book.ownershipOwned"), value: "owned" },
            { label: t(lang, "book.ownershipUnowned"), value: "unowned" },
          ]}
          label={t(lang, "book.ownership")}
          onChange={(value) =>
            setOwnership((value as BulkBookChange["ownership"]) || "unchanged")
          }
          value={ownership}
        />
        <Select
          data={[
            { label: t(lang, "book.noChange"), value: "unchanged" },
            ...categories.map((value) => ({ label: value, value })),
          ]}
          label={t(lang, "book.category")}
          onChange={(value) => setCategory(value ?? "unchanged")}
          value={category}
        />
      </div>
      {listNames.length > 0 ? (
        <Select
          data={[
            { label: t(lang, "book.noChange"), value: "unchanged" },
            ...listNames.map((value) => ({
              label: t(lang, "book.addToListOption", { list: value }),
              value,
            })),
          ]}
          label={t(lang, "book.list")}
          onChange={(value) => setListName(value ?? "unchanged")}
          value={listName}
        />
      ) : null}
      <Alert color="accent" variant="light">
        {t(lang, "book.bulkEditReadDateHint")}
      </Alert>
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          {t(lang, "action.cancel")}
        </Button>
        <Button
          color="ink"
          disabled={saving || !hasChange}
          loading={saving}
          onClick={() =>
            void onSave({ category, listName, ownership, readingStatus })
          }
        >
          {t(lang, "action.applyChanges")}
        </Button>
      </Group>
    </Stack>
  );
}

function SelectedBooksDisclosure({
  books,
  label,
  open = false,
}: {
  books: readonly Book[];
  label: string;
  open?: boolean;
}) {
  if (books.length === 0) {
    return null;
  }
  return (
    <details className="react-bookshelf-selected-books" open={open}>
      <summary>{label}</summary>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <span>{book.title}</span>
            <span className="react-bookshelf-selected-book-author">
              {book.author}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AddBookPanel({
  lang,
  onClose,
  onSaved,
}: {
  lang: Lang;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState("isbn");
  const [input, setInput] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [title, setTitle] = useState("デザインシステム入門");
  const [author, setAuthor] = useState("山田 太郎");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [finished, setFinished] = useState("2026-08-27");
  const [notes, setNotes] = useState("");

  const prepare = (): void => {
    if (mode === "manual") {
      setTitle(manualTitle.trim());
      setAuthor(manualAuthor.trim());
      setInput(manualIsbn.trim());
    }
    setPrepared(true);
  };
  const save = (): void => {
    onClose();
    onSaved();
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2} size="h3">
          {t(lang, "book.add")}
        </Title>
        <Text className="react-bookshelf-modal-muted" size="sm">
          {t(lang, "book.addMethodsSummary")}
        </Text>
      </div>
      <BookDataNotice lang={lang} />
      <SegmentedControl
        aria-label={t(lang, "book.addMethod")}
        data={[
          { label: t(lang, "book.mode.isbn"), value: "isbn" },
          { label: t(lang, "book.mode.batch"), value: "batch" },
          { label: t(lang, "book.mode.search"), value: "search" },
          { label: t(lang, "book.mode.manual"), value: "manual" },
        ]}
        onChange={(value) => {
          setMode(value);
          setPrepared(false);
        }}
        value={mode}
      />
      {mode === "batch" ? (
        <Textarea
          label={t(lang, "book.mode.batch")}
          minRows={3}
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder={t(lang, "book.batchPlaceholder")}
          value={input}
        />
      ) : mode === "manual" ? (
        <Stack gap="sm">
          <TextInput
            label={t(lang, "book.title")}
            onChange={(event) => setManualTitle(event.currentTarget.value)}
            placeholder={t(lang, "book.manualTitleRequired")}
            required
            value={manualTitle}
          />
          <TextInput
            label={t(lang, "book.authorOptional")}
            onChange={(event) => setManualAuthor(event.currentTarget.value)}
            placeholder={t(lang, "book.author")}
            value={manualAuthor}
          />
          <TextInput
            label={t(lang, "book.isbnOptional")}
            onChange={(event) => setManualIsbn(event.currentTarget.value)}
            placeholder={t(lang, "book.isbnPlaceholder")}
            value={manualIsbn}
          />
        </Stack>
      ) : (
        <TextInput
          label={
            mode === "search"
              ? t(lang, "book.searchPlaceholder")
              : t(lang, "book.mode.isbn")
          }
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder={
            mode === "search"
              ? t(lang, "book.searchPlaceholder")
              : t(lang, "book.isbnPlaceholder")
          }
          value={input}
        />
      )}
      <Button
        disabled={mode === "manual" ? !manualTitle.trim() : !input.trim()}
        onClick={prepare}
        variant="default"
      >
        {prepared
          ? t(lang, "book.candidatesReviewed")
          : t(lang, "book.preview")}
      </Button>
      {Boolean(prepared) && (
        <div className="react-bookshelf-candidate">
          <Badge color="accent" variant="light">
            {t(lang, "book.candidateCount", { count: "1" })}
          </Badge>
          <TextInput
            label={t(lang, "book.title")}
            onChange={(event) => setTitle(event.currentTarget.value)}
            value={title}
          />
          <TextInput
            label={t(lang, "book.author")}
            onChange={(event) => setAuthor(event.currentTarget.value)}
            value={author}
          />
          <TextInput
            label={t(lang, "book.isbnOptional")}
            onChange={(event) => setInput(event.currentTarget.value)}
            value={input.replace(/[ -]/g, "")}
          />
          <TextInput
            label={t(lang, "book.finished")}
            onChange={(event) => setFinished(event.currentTarget.value)}
            type="date"
            value={finished}
          />
          <Textarea
            label={t(lang, "book.notes")}
            minRows={2}
            onChange={(event) => setNotes(event.currentTarget.value)}
            value={notes}
          />
        </div>
      )}
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          {t(lang, "action.cancel")}
        </Button>
        <Button color="ink" disabled={!prepared} onClick={save}>
          {t(lang, "action.save")}
        </Button>
      </Group>
    </Stack>
  );
}

export function EditBookPanel({
  book,
  categories,
  lang,
  listNames,
  onClose,
  onSave,
}: {
  book: Book;
  categories: string[];
  lang: Lang;
  listNames: string[];
  onClose: () => void;
  onSave: (input: BookEditInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [category, setCategory] = useState(book.category ?? "未分類");
  const [finished, setFinished] = useState(book.finished.replace(/\./g, "-"));
  const [rating, setRating] = useState(book.rating ? String(book.rating) : "");
  const [ownership, setOwnership] = useState<BookOwnershipStatus>(
    book.ownership
  );
  const [readingStatus, setReadingStatus] = useState<BookReadingStatus>(
    book.readingStatus
  );
  const [series, setSeries] = useState(book.series ?? "");
  const [lists, setLists] = useState<string[]>(book.lists ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      await onSave({
        author: author.trim(),
        category,
        finished: finished.trim(),
        lists,
        ownership,
        rating: rating ? Number(rating) : undefined,
        readingStatus,
        series: series.trim(),
        title: title.trim(),
      });
      onClose();
    } catch {
      setError(t(lang, "book.saveFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack gap="md">
      <TextInput
        label={t(lang, "book.title")}
        onChange={(event) => setTitle(event.currentTarget.value)}
        required
        value={title}
      />
      <TextInput
        label={t(lang, "book.author")}
        onChange={(event) => setAuthor(event.currentTarget.value)}
        value={author}
      />
      <div className="react-bookshelf-edit-grid">
        <Select
          data={categories.map((value) => ({ label: value, value }))}
          label={t(lang, "book.category")}
          onChange={(value) => setCategory(value ?? "未分類")}
          value={category}
        />
        <TextInput
          label={t(lang, "book.seriesOptional")}
          onChange={(event) => setSeries(event.currentTarget.value)}
          placeholder={t(lang, "book.seriesPlaceholder")}
          value={series}
        />
      </div>
      {listNames.length > 0 ? (
        <fieldset className="react-bookshelf-list-picker">
          <legend>{t(lang, "book.list")}</legend>
          <div className="react-bookshelf-list-options">
            {listNames.map((list) => (
              <label key={list}>
                <input
                  checked={lists.includes(list)}
                  onChange={(event) =>
                    setLists((current) =>
                      event.currentTarget.checked
                        ? [...new Set([...current, list])]
                        : current.filter((value) => value !== list)
                    )
                  }
                  type="checkbox"
                />
                <span>{list}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="react-bookshelf-edit-grid">
        <Select
          data={[
            { label: t(lang, "book.rackToRead"), value: "tbr" },
            { label: t(lang, "book.rackCompleted"), value: "read" },
          ]}
          label={t(lang, "book.readingStatus")}
          onChange={(value) =>
            setReadingStatus((value as BookReadingStatus) || "read")
          }
          value={readingStatus}
        />
        <Select
          data={[
            { label: t(lang, "book.ownershipOwned"), value: "owned" },
            { label: t(lang, "book.ownershipUnowned"), value: "unowned" },
          ]}
          label={t(lang, "book.ownership")}
          onChange={(value) =>
            setOwnership((value as BookOwnershipStatus) || "unowned")
          }
          value={ownership}
        />
        <TextInput
          label={t(lang, "book.finished")}
          onChange={(event) => setFinished(event.currentTarget.value)}
          type="date"
          value={finished}
        />
      </div>
      <Select
        data={[
          { label: t(lang, "book.ratingNone"), value: "" },
          ...[1, 2, 3, 4, 5].map((value) => ({
            label: `★${value}`,
            value: String(value),
          })),
        ]}
        label={t(lang, "book.ratingColumn")}
        onChange={(value) => setRating(value ?? "")}
        value={rating}
      />
      {Boolean(error) && <Alert color="red">{error}</Alert>}
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          {t(lang, "action.cancel")}
        </Button>
        <Button
          color="ink"
          disabled={busy || !title.trim()}
          onClick={() => void save()}
        >
          {busy ? t(lang, "action.saving") : t(lang, "action.save")}
        </Button>
      </Group>
    </Stack>
  );
}

export interface BookshelfSurfaceProps {
  addBookContent?: (
    close: () => void,
    requestResultFocus: () => void
  ) => ReactNode;
  bookCategories?: string[];
  books?: Book[];
  calilCityConfigured?: boolean;
  calilSearchHistory?: LibrarySearchHistoryEntry[];
  lang?: Lang;
  libraryApiConfigured?: boolean;
  listNames?: string[];
  onAddBook?: () => void;
  onBulkEditBooks?: (
    updates: BookshelfBulkUpdate[]
  ) => Promise<BookshelfBulkEditResult>;
  onEditBook?: (book: Book, input: BookEditInput) => Promise<void>;
  onLibrarySearchCompleted?: (entry: LibrarySearchHistoryEntry) => void;
  onOpen?: (book: Book) => void;
  onOpenCalilWeb?: (book: Book) => void;
  onRemoveCover?: (book: Book) => void;
  onReplace?: (book: Book) => void;
  onSearchLibraries?: (
    book: Book,
    options?: LibrarySearchOptions
  ) => Promise<LibraryAvailability>;
  onSearchLibrariesBatch?: (
    books: Array<{ id: string; isbn: string; title: string }>,
    options?: LibrarySearchOptions
  ) => Promise<LibraryBatchAvailability>;
  onSupplement?: (book: Book) => void;
  onTogglePin?: (book: Book) => void | Promise<void>;
  replaceContent?: (book: Book, close: () => void) => ReactNode;
  scheme: ColorScheme;
}

export function clearBookshelfSelectionAndRestoreFocus(
  clearSelection: () => void,
  focusTarget: Pick<HTMLElement, "focus"> | null
): void {
  clearSelection();
  focusTarget?.focus();
}

export function calilHistoryForLanguage(
  lang: Lang,
  history: LibrarySearchHistoryEntry[] = EMPTY_CALIL_SEARCH_HISTORY
): LibrarySearchHistoryEntry[] {
  return lang === "ja" ? history : EMPTY_CALIL_SEARCH_HISTORY;
}

export function bookshelfSelectionScopeText(
  lang: Lang,
  librarySearchEnabled: boolean,
  isbnBookCount: number
): string {
  if (lang === "ja" && librarySearchEnabled && isbnBookCount > 0) {
    return t(lang, "book.bulkLibrarySearchScope", {
      count: `${isbnBookCount}`,
    });
  }
  return t(lang, "book.bulkEditScope");
}

export function failPendingLibraryBatchItems(
  items: LibraryBatchItem[],
  error: string
): LibraryBatchItem[] {
  return items.map((item) =>
    item.status === "queued" || item.status === "loading"
      ? { ...item, error, status: "error" }
      : item
  );
}

export function ReactBookshelfSurface({
  lang = "ja",
  scheme,
  books = BOOKS,
  onAddBook,
  addBookContent,
  bookCategories = [
    "フィクション",
    "ノンフィクション",
    "実用・ビジネス",
    "学術・専門",
    "詩歌・エッセイ",
    "マンガ・コミック",
    "未分類",
  ],
  onOpen,
  onReplace,
  replaceContent,
  onSupplement,
  onTogglePin,
  onRemoveCover,
  onBulkEditBooks,
  onEditBook,
  onSearchLibraries,
  onSearchLibrariesBatch,
  onOpenCalilWeb,
  onLibrarySearchCompleted,
  calilCityConfigured = false,
  calilSearchHistory,
  libraryApiConfigured = false,
  listNames = [],
}: BookshelfSurfaceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const calilUiEnabled = lang === "ja";
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [activeMenuBook, setActiveMenuBook] = useState<Book | null>(null);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(
    null
  );
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [bookRows, setBookRows] = useState(books);
  const [statusFilter, setStatusFilter] = useState<"all" | BookReadingStatus>(
    "all"
  );
  const [ownershipFilter, setOwnershipFilter] = useState<
    "all" | BookOwnershipStatus
  >("all");
  const [ratingFilter, setRatingFilter] = useState<
    "all" | "none" | "1" | "2" | "3" | "4" | "5"
  >("all");
  const [sort, setSort] = useState("updated");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addFocusVersion, setAddFocusVersion] = useState(0);
  const addBookTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bookActionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bulkEditTriggerRef = useRef<HTMLButtonElement | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectVisibleTriggerRef = useRef<HTMLButtonElement | null>(null);
  const batchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const batchRunIdRef = useRef(0);
  const librarySearchRunIdRef = useRef(0);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditSaving, setBulkEditSaving] = useState(false);
  const [coverPath, setCoverPath] = useState("Seiton/assets/cover.jpg");
  const [feedback, setFeedback] = useState("");
  const [libraryBook, setLibraryBook] = useState<Book | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryResult, setLibraryResult] =
    useState<LibraryAvailability | null>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(
    () => new Set()
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchItems, setBatchItems] = useState<LibraryBatchItem[]>([]);
  const [batchError, setBatchError] = useState("");
  const [view, setView] = useState<BookshelfView>("cards");
  const [searchHistory, setSearchHistory] = useState(() =>
    calilHistoryForLanguage(lang, calilSearchHistory)
  );
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (rootRef.current) {
      // Keep floating layers outside the clipped content surface. The menu
      // position is calculated in viewport coordinates, so the sibling mount
      // point must not introduce the bookshelf root as a positioning context.
      setPortalTarget(rootRef.current.parentElement ?? rootRef.current);
    }
    return () => {
      batchRunIdRef.current += 1;
      librarySearchRunIdRef.current += 1;
    };
  }, []);
  const closeActionsMenu = useCallback((restoreFocus = false): void => {
    const anchor = menuAnchorRef.current;
    setActiveMenuBook(null);
    setMenuPosition(null);
    menuAnchorRef.current = null;
    if (restoreFocus) {
      window.requestAnimationFrame(() => anchor?.focus());
    }
  }, []);
  const toggleActionsMenu = useCallback(
    (book: Book, anchor: HTMLButtonElement): void => {
      if (activeMenuBook?.id === book.id) {
        closeActionsMenu(true);
        return;
      }
      menuAnchorRef.current = anchor;
      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.width > 0 && anchorRect.height > 0) {
        const menuWidth = Math.min(260, window.innerWidth - 24);
        const margin = 12;
        const gap = 8;
        const left = Math.min(
          window.innerWidth - menuWidth - margin,
          Math.max(margin, anchorRect.right - menuWidth)
        );
        const estimatedHeight = 300;
        const top =
          anchorRect.bottom + gap + estimatedHeight <=
          window.innerHeight - margin
            ? anchorRect.bottom + gap
            : Math.max(margin, anchorRect.top - estimatedHeight - gap);
        setMenuPosition(toPortalPosition(left, top, rootRef.current));
      } else {
        setMenuPosition(null);
      }
      setActiveMenuBook(book);
    },
    [activeMenuBook, closeActionsMenu]
  );
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const initialAnchor = menuAnchorRef.current;
    if (!activeMenuBook) {
      return;
    }
    if (!menu) {
      return;
    }
    if (!initialAnchor) {
      return;
    }
    const findAnchor = (): HTMLButtonElement | null => {
      const anchor = menuAnchorRef.current;
      const anchorRect = anchor?.getBoundingClientRect();
      if (
        anchor &&
        anchorRect &&
        anchorRect.width > 0 &&
        anchorRect.height > 0
      ) {
        return anchor;
      }
      const candidates = rootRef.current?.querySelectorAll<HTMLButtonElement>(
        ".react-bookshelf-more[data-seiton-menu-anchor]"
      );
      const current = Array.from(candidates ?? []).find(
        (candidate) => candidate.dataset.seitonMenuAnchor === activeMenuBook.id
      );
      if (current) {
        menuAnchorRef.current = current;
      }
      return current ?? null;
    };
    const updatePosition = (): void => {
      const anchor = findAnchor();
      if (!anchor) {
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.width <= 0 || anchorRect.height <= 0) {
        return;
      }
      const menuRect = menu.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const fitsBelow =
        anchorRect.bottom + gap + menuRect.height <=
        window.innerHeight - margin;
      let top = fitsBelow
        ? anchorRect.bottom + gap
        : anchorRect.top - menuRect.height - gap;
      let left = anchorRect.right - menuRect.width;
      if (top < margin) {
        top = margin;
      }
      if (top + menuRect.height > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - menuRect.height - margin);
      }
      if (left < margin) {
        left = anchorRect.left;
      }
      if (left + menuRect.width > window.innerWidth - margin) {
        left = window.innerWidth - menuRect.width - margin;
      }
      setMenuPosition(
        toPortalPosition(
          Math.max(margin, left),
          Math.max(margin, top),
          rootRef.current
        )
      );
    };
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeMenuBook]);
  useEffect(() => {
    if (!activeMenuBook) {
      return;
    }
    const handlePointerDown = (event: PointerEvent): void => {
      const path = event.composedPath();
      if (
        (menuRef.current && path.includes(menuRef.current)) ||
        (menuAnchorRef.current && path.includes(menuAnchorRef.current))
      ) {
        return;
      }
      closeActionsMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeActionsMenu(true);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenuBook, closeActionsMenu]);
  const announce = (message: string): void => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  };

  const togglePin = async (book: Book): Promise<void> => {
    const nextPinned = !book.pinned;
    try {
      await onTogglePin?.({ ...book, pinned: nextPinned });
      setBookRows((rows) =>
        rows.map((candidate) =>
          candidate.id === book.id
            ? { ...candidate, pinned: nextPinned }
            : candidate
        )
      );
      announce(
        `${t(lang, nextPinned ? "action.pin" : "action.unpin")}: ${book.title}`
      );
      closeActionsMenu();
    } catch {
      announce(t(lang, "search.pinUpdateFailed"));
    }
  };
  useEffect(() => {
    setBookRows(books);
  }, [books]);
  useEffect(() => {
    setSearchHistory(calilHistoryForLanguage(lang, calilSearchHistory));
  }, [calilSearchHistory, lang]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const visibleBooks = useMemo(
    () =>
      bookRows
        .filter((book) => {
          const searchText = [
            book.title,
            book.author,
            book.isbn,
            book.note,
            book.category,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ja");
          const matchesQuery =
            !normalizedQuery || searchText.includes(normalizedQuery);
          const matchesStatus =
            statusFilter === "all" || book.readingStatus === statusFilter;
          const matchesOwnership =
            ownershipFilter === "all" || book.ownership === ownershipFilter;
          const matchesRating =
            ratingFilter === "all" ||
            (ratingFilter === "none"
              ? book.rating === undefined
              : book.rating === Number(ratingFilter));
          const matchesCategory =
            categoryFilter === "all" ||
            (book.category ?? "未分類") === categoryFilter;
          return (
            matchesQuery &&
            matchesStatus &&
            matchesOwnership &&
            matchesRating &&
            matchesCategory
          );
        })
        .sort((left, right) => {
          if (sort === "title") {
            return left.title.localeCompare(right.title, "ja");
          }
          if (sort === "rating") {
            return (right.rating ?? 0) - (left.rating ?? 0);
          }
          return right.finished.localeCompare(left.finished);
        }),
    [
      bookRows,
      categoryFilter,
      normalizedQuery,
      ratingFilter,
      ownershipFilter,
      sort,
      statusFilter,
    ]
  );
  useEffect(() => {
    if (
      activeMenuBook &&
      !visibleBooks.some((book) => book.id === activeMenuBook.id)
    ) {
      closeActionsMenu();
    }
  }, [activeMenuBook, closeActionsMenu, visibleBooks]);
  const categories = useMemo(
    () => [
      ...new Set([
        ...bookCategories,
        ...bookRows.map((book) => book.category ?? "未分類"),
      ]),
    ],
    [bookCategories, bookRows]
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const category of categories) {
      counts.set(category, 0);
    }
    for (const book of bookRows) {
      const category = book.category ?? "未分類";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [bookRows, categories]);
  const selectedRows = useMemo(
    () => bookRows.filter((book) => selectedBookIds.has(book.id)),
    [bookRows, selectedBookIds]
  );
  const selectedBooks = useMemo(
    () => selectedRows.filter((book) => book.isbn),
    [selectedRows]
  );
  const visibleBookIds = useMemo(
    () => new Set(visibleBooks.map((book) => book.id)),
    [visibleBooks]
  );
  const hiddenSelectedBooks = useMemo(
    () => selectedRows.filter((book) => !visibleBookIds.has(book.id)),
    [selectedRows, visibleBookIds]
  );
  const allVisibleSelected =
    visibleBooks.length > 0 &&
    visibleBooks.every((book) => selectedBookIds.has(book.id));
  const latestHistory = searchHistory[0];
  const saveEdit = async (book: Book, input: BookEditInput): Promise<void> => {
    if (onEditBook) {
      await onEditBook(book, input);
    }
    setBookRows((rows) =>
      rows.map((row) =>
        row.id === book.id
          ? {
              ...row,
              author: input.author,
              category: input.category,
              finished: input.finished.replace(/-/g, "."),
              lists: input.lists,
              ownership: input.ownership ?? book.ownership,
              rating: input.rating,
              readingStatus: input.readingStatus,
              series: input.series,
              title: input.title,
            }
          : row
      )
    );
    announce(t(lang, "book.saved"));
  };
  const runLibrarySearch = async (
    book: Book,
    options?: LibrarySearchOptions
  ): Promise<void> => {
    if (!(onSearchLibraries && book.isbn)) {
      return;
    }
    const runId = librarySearchRunIdRef.current + 1;
    librarySearchRunIdRef.current = runId;
    setLibraryBook(book);
    setLibraryError("");
    setLibraryResult(null);
    setLibraryLoading(true);
    try {
      const result = await onSearchLibraries(book, options);
      if (librarySearchRunIdRef.current !== runId) {
        return;
      }
      setLibraryResult(result);
      const historyEntry = {
        availableCount: result.libraries.length,
        bookId: book.id,
        bookUrl: result.bookUrl,
        checkedAt: result.checkedAt,
        isbn: result.isbn,
        title: book.title,
      } satisfies LibrarySearchHistoryEntry;
      setSearchHistory((current) =>
        [
          historyEntry,
          ...current.filter((entry) => entry.bookId !== historyEntry.bookId),
        ].slice(0, 20)
      );
      onLibrarySearchCompleted?.(historyEntry);
    } catch {
      if (librarySearchRunIdRef.current === runId) {
        setLibraryError(t(lang, "book.librarySearchError"));
      }
    } finally {
      if (librarySearchRunIdRef.current === runId) {
        setLibraryLoading(false);
      }
    }
  };
  const searchLibraries = (book: Book): void => {
    if (!(calilUiEnabled && book.isbn)) {
      return;
    }
    if (!libraryApiConfigured && onOpenCalilWeb) {
      onOpenCalilWeb(book);
      return;
    }
    if (!onSearchLibraries) {
      return;
    }
    setLibraryBook(book);
    setLibraryError("");
    setLibraryResult(null);
    if (calilCityConfigured) {
      void runLibrarySearch(book);
    }
  };
  const searchLibrariesFromAddress = (referenceAddress: string): void => {
    if (!libraryBook) {
      return;
    }
    void runLibrarySearch(libraryBook, { referenceAddress });
  };
  const closeLibrarySearch = (): void => {
    librarySearchRunIdRef.current += 1;
    setLibraryBook(null);
    setLibraryError("");
    setLibraryResult(null);
    setLibraryLoading(false);
  };

  const closeBatchSearch = (): void => {
    batchRunIdRef.current += 1;
    setBatchOpen(false);
    setBatchError("");
    setBatchLoading(false);
  };

  const toggleBookSelection = (book: Book, checked: boolean): void => {
    setSelectedBookIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(book.id);
      } else {
        next.delete(book.id);
      }
      return next;
    });
  };

  const toggleVisibleSelection = (): void => {
    const visibleIds = visibleBooks.map((book) => book.id);
    if (visibleIds.length === 0) {
      return;
    }
    setSelectedBookIds((current) => {
      const next = new Set(current);
      const allSelected = visibleIds.every((id) => next.has(id));
      for (const id of visibleIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const applyBulkEdit = async (change: BulkBookChange): Promise<void> => {
    const updates = selectedRows.map((book) => ({
      book,
      input: bulkEditInputForBook(book, change),
    }));
    if (updates.length === 0) {
      return;
    }
    setBulkEditSaving(true);
    try {
      let result: BookshelfBulkEditResult;
      if (onBulkEditBooks) {
        result = await onBulkEditBooks(updates);
      } else if (onEditBook) {
        const settled = await Promise.allSettled(
          updates.map((update) => onEditBook(update.book, update.input))
        );
        result = {
          failedIds: updates.flatMap((update, index) =>
            settled[index]?.status === "rejected" ? [update.book.id] : []
          ),
          updatedIds: updates.flatMap((update, index) =>
            settled[index]?.status === "fulfilled" ? [update.book.id] : []
          ),
        };
      } else {
        return;
      }
      const updatedIds = new Set(result.updatedIds);
      const failedIds = new Set(result.failedIds);
      setBookRows((rows) =>
        rows.map((book) => {
          if (!updatedIds.has(book.id)) {
            return book;
          }
          const update = updates.find(
            (candidate) => candidate.book.id === book.id
          );
          if (!update) {
            return book;
          }
          return {
            ...book,
            category: update.input.category,
            finished: update.input.finished.replace(/-/g, "."),
            lists: update.input.lists,
            ownership: update.input.ownership ?? book.ownership,
            readingStatus: update.input.readingStatus,
          };
        })
      );
      setSelectedBookIds(failedIds);
      if (result.failedIds.length === 0) {
        setBulkEditOpen(false);
        announce(
          t(lang, "book.bulkEditUpdated", {
            count: `${result.updatedIds.length}`,
          })
        );
      } else {
        announce(
          t(lang, "book.bulkEditPartial", {
            failed: `${result.failedIds.length}`,
            updated: `${result.updatedIds.length}`,
          })
        );
      }
    } catch (cause) {
      announce(
        cause instanceof Error
          ? cause.message
          : "一括編集を適用できませんでした"
      );
    } finally {
      setBulkEditSaving(false);
    }
  };

  const retryLibrarySearch = (entry: LibrarySearchHistoryEntry): void => {
    if (!calilUiEnabled) {
      return;
    }
    const book = bookRows.find((candidate) => candidate.id === entry.bookId);
    if (!book) {
      return;
    }
    if (!libraryApiConfigured && onOpenCalilWeb) {
      onOpenCalilWeb(book);
      return;
    }
    void runLibrarySearch(book, { forceRefresh: true });
  };

  const updateBatchItem = (item: LibraryBatchItem): void => {
    setBatchItems((current) => {
      const index = current.findIndex(
        (candidate) => candidate.bookId === item.bookId
      );
      if (index < 0) {
        return [...current, item];
      }
      const next = [...current];
      next[index] = item;
      return next;
    });
  };

  const startBatchSearch = (): void => {
    if (!calilUiEnabled) {
      return;
    }
    const booksForSearch = selectedBooks.map((book) => ({
      id: book.id,
      isbn: book.isbn ?? "",
      title: book.title,
    }));
    if (booksForSearch.length === 0) {
      announce(t(lang, "book.noIsbn"));
      return;
    }
    const queued = booksForSearch.map((book) => ({
      bookId: book.id,
      isbn: book.isbn,
      status: "queued" as const,
      title: book.title,
    }));
    const runId = batchRunIdRef.current + 1;
    batchRunIdRef.current = runId;
    setBatchItems(queued);
    setBatchError("");
    setBatchOpen(true);
    if (!(libraryApiConfigured && onSearchLibrariesBatch)) {
      return;
    }
    setBatchLoading(true);
    void onSearchLibrariesBatch(booksForSearch, {
      onProgress: (item) => {
        if (batchRunIdRef.current === runId) {
          updateBatchItem(item);
        }
      },
    })
      .then((result) => {
        if (batchRunIdRef.current !== runId) {
          return;
        }
        setBatchItems(result.items);
        for (const item of result.items) {
          if (item.result) {
            onLibrarySearchCompleted?.({
              availableCount: item.result.libraries.length,
              bookId: item.bookId,
              bookUrl: item.result.bookUrl,
              checkedAt: item.result.checkedAt,
              isbn: item.result.isbn,
              title: item.title,
            });
          }
        }
      })
      .catch((cause) => {
        if (batchRunIdRef.current !== runId) {
          return;
        }
        const error =
          cause instanceof Error ? cause.message : t(lang, "book.searchFailed");
        setBatchItems((current) =>
          failPendingLibraryBatchItems(current, error)
        );
        setBatchError(error);
      })
      .finally(() => {
        if (batchRunIdRef.current === runId) {
          setBatchLoading(false);
        }
      });
  };
  const librarySearchEnabled =
    calilUiEnabled && Boolean(onSearchLibraries || onOpenCalilWeb);
  const renderBookCard = (book: Book, index: number): ReactNode => (
    <BookCard
      book={book}
      index={index}
      key={book.id}
      lang={lang}
      menuOpen={activeMenuBook?.id === book.id}
      onOpen={(selected) =>
        onOpen
          ? onOpen(selected)
          : announce(t(lang, "book.openTitle", { title: selected.title }))
      }
      onToggleMenu={toggleActionsMenu}
      onToggleSelect={toggleBookSelection}
      selected={selectedBookIds.has(book.id)}
    />
  );
  const renderBookListRow = (book: Book): ReactNode => (
    <BookListRow
      book={book}
      key={book.id}
      lang={lang}
      menuOpen={activeMenuBook?.id === book.id}
      onOpen={(selected) =>
        onOpen
          ? onOpen(selected)
          : announce(t(lang, "book.openTitle", { title: selected.title }))
      }
      onToggleMenu={toggleActionsMenu}
      onToggleSelect={toggleBookSelection}
      selected={selectedBookIds.has(book.id)}
    />
  );

  return (
    <div
      className="seiton-react-bookshelf-prototype"
      data-scheme={scheme}
      onKeyDownCapture={(event) => {
        if (!activeMenuBook || event.key !== "Escape") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeActionsMenu(true);
      }}
      ref={rootRef}
    >
      <header className="react-bookshelf-header">
        <div className="react-bookshelf-header-title">
          <Title
            className="react-bookshelf-heading"
            id="react-bookshelf-title"
            order={1}
          >
            {t(lang, "bookshelf.title")}
          </Title>
        </div>
        <div className="react-bookshelf-header-actions">
          {calilUiEnabled && searchHistory.length > 0 ? (
            <Button
              aria-expanded={historyModalOpen}
              aria-haspopup="dialog"
              aria-label={`${t(lang, "bookshelf.history")} (${searchHistory.length})`}
              className="react-bookshelf-history-trigger"
              onClick={(event) => {
                historyTriggerRef.current = event.currentTarget;
                setHistoryModalOpen(true);
              }}
              variant="default"
            >
              <span>{t(lang, "bookshelf.history")}</span>
              <span
                aria-hidden="true"
                className="react-bookshelf-history-trigger-count"
              >
                {searchHistory.length}
              </span>
            </Button>
          ) : null}
          <Button
            color="ink"
            onClick={(event) => {
              if (addBookContent || !onAddBook) {
                addBookTriggerRef.current = event.currentTarget;
                setAddOpen(true);
              } else {
                onAddBook();
              }
            }}
            ref={addBookTriggerRef}
          >
            {t(lang, "book.add")}
          </Button>
        </div>
      </header>

      <div className="react-bookshelf-browse-layout">
        <aside
          aria-label={t(lang, "book.category")}
          className="react-bookshelf-category-rail"
        >
          <Title className="react-bookshelf-category-title" order={2} size="h3">
            {t(lang, "book.category")}
          </Title>
          <nav
            aria-label={t(lang, "book.category")}
            className="react-bookshelf-category-nav"
          >
            <button
              aria-pressed={categoryFilter === "all"}
              className={
                categoryFilter === "all"
                  ? "is-active react-bookshelf-category-button"
                  : "react-bookshelf-category-button"
              }
              onClick={() => setCategoryFilter("all")}
              type="button"
            >
              <span>{t(lang, "library.filterAll")}</span>
              <span className="react-bookshelf-category-count">
                {bookRows.length}
              </span>
            </button>
            {categories.map((category) => (
              <button
                aria-pressed={categoryFilter === category}
                className={
                  categoryFilter === category
                    ? "is-active react-bookshelf-category-button"
                    : "react-bookshelf-category-button"
                }
                key={category}
                onClick={() => setCategoryFilter(category)}
                type="button"
              >
                <span>{category}</span>
                <span className="react-bookshelf-category-count">
                  {categoryCounts.get(category) ?? 0}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main
          aria-labelledby="react-bookshelf-title"
          className="react-bookshelf-content"
        >
          <section
            aria-label={t(lang, "book.list")}
            className="react-bookshelf-results"
          >
            <div className="react-bookshelf-controls">
              <label className="react-bookshelf-search">
                <svg
                  aria-hidden="true"
                  className="react-bookshelf-search-icon"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4.5 4.5" />
                </svg>
                <input
                  aria-label={t(lang, "book.searchPlaceholder")}
                  className="react-bookshelf-search-input"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder={t(lang, "book.searchPlaceholder")}
                  type="search"
                  value={query}
                />
              </label>
              <Select
                aria-label={t(lang, "book.changeStatus")}
                data={[
                  { label: t(lang, "library.filterAll"), value: "all" },
                  { label: t(lang, "book.rackToRead"), value: "tbr" },
                  { label: t(lang, "book.rackCompleted"), value: "read" },
                ]}
                onChange={(value) =>
                  setStatusFilter((value as "all" | BookReadingStatus) || "all")
                }
                value={statusFilter}
              />
              <Select
                aria-label={t(lang, "book.ownershipFilter")}
                data={[
                  { label: t(lang, "book.ownershipFilterAll"), value: "all" },
                  { label: t(lang, "book.ownershipOwned"), value: "owned" },
                  {
                    label: t(lang, "book.ownershipUnowned"),
                    value: "unowned",
                  },
                ]}
                onChange={(value) =>
                  setOwnershipFilter(
                    (value as "all" | BookOwnershipStatus) || "all"
                  )
                }
                value={ownershipFilter}
              />
              <Select
                aria-label={t(lang, "book.ratingFilter")}
                data={[
                  { label: t(lang, "book.ratingFilterAll"), value: "all" },
                  { label: t(lang, "book.ratingNone"), value: "none" },
                  ...[5, 4, 3, 2, 1].map((value) => ({
                    label: `★${value}`,
                    value: String(value),
                  })),
                ]}
                onChange={(value) =>
                  setRatingFilter((value as typeof ratingFilter) || "all")
                }
                value={ratingFilter}
              />
              <Select
                aria-label={t(lang, "library.sortLabel")}
                data={[
                  { label: t(lang, "library.sortNewest"), value: "updated" },
                  { label: t(lang, "library.sortTitle"), value: "title" },
                  { label: t(lang, "book.rating"), value: "rating" },
                ]}
                onChange={(value) => setSort(value ?? "updated")}
                value={sort}
              />
            </div>
            <div className="react-bookshelf-toolbar-note">
              <Text size="xs">
                {categoryFilter === "all" &&
                !query.trim() &&
                statusFilter === "all" &&
                ownershipFilter === "all" &&
                ratingFilter === "all"
                  ? t(lang, "book.rackTitle")
                  : `${visibleBooks.length} · ${t(lang, "search.title")}`}
              </Text>
              <Button
                className="react-bookshelf-clear-filters"
                onClick={() => {
                  setCategoryFilter("all");
                  setQuery("");
                  setRatingFilter("all");
                  setSort("updated");
                  setStatusFilter("all");
                  setOwnershipFilter("all");
                }}
                size="xs"
                variant="subtle"
              >
                {t(lang, "search.clear")}
              </Button>
            </div>
            {selectedRows.length > 0 ? (
              <div className="react-bookshelf-selection-bar">
                <div>
                  <strong>
                    {t(lang, "book.selectedCount", {
                      count: `${selectedRows.length}`,
                    })}
                  </strong>
                  <Text size="xs">
                    {bookshelfSelectionScopeText(
                      lang,
                      librarySearchEnabled,
                      selectedBooks.length
                    )}
                  </Text>
                  {hiddenSelectedBooks.length > 0 ? (
                    <Text role="status" size="xs">
                      {t(lang, "book.hiddenSelection", {
                        count: `${hiddenSelectedBooks.length}`,
                      })}
                    </Text>
                  ) : null}
                  <SelectedBooksDisclosure
                    books={selectedRows}
                    label={t(lang, "book.reviewSelection")}
                  />
                </div>
                <div className="react-bookshelf-selection-actions">
                  <Button
                    onClick={(event) => {
                      bulkEditTriggerRef.current = event.currentTarget;
                      setBulkEditOpen(true);
                    }}
                    size="sm"
                    variant="default"
                  >
                    {t(lang, "book.bulkEdit")}
                  </Button>
                  {librarySearchEnabled && selectedBooks.length > 0 ? (
                    <Button
                      onClick={(event) => {
                        batchTriggerRef.current = event.currentTarget;
                        startBatchSearch();
                      }}
                      size="sm"
                      variant="default"
                    >
                      {t(lang, "book.bulkLibrarySearch")}
                    </Button>
                  ) : null}
                  <Button
                    onClick={() =>
                      clearBookshelfSelectionAndRestoreFocus(
                        () => setSelectedBookIds(new Set()),
                        selectVisibleTriggerRef.current
                      )
                    }
                    size="sm"
                    variant="subtle"
                  >
                    {t(lang, "book.clearSelection")}
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="react-bookshelf-results-heading">
              <Title
                aria-label={t(lang, "book.resultsSummary", {
                  count: `${visibleBooks.length}`,
                })}
                order={2}
                size="h4"
              >
                {t(lang, "book.resultsTitle")}{" "}
                <span className="react-bookshelf-results-count">
                  {t(lang, "book.resultsCount", {
                    count: `${visibleBooks.length}`,
                  })}
                </span>
              </Title>
              <div className="react-bookshelf-results-meta">
                <Button
                  aria-label={
                    allVisibleSelected
                      ? t(lang, "book.deselectVisible")
                      : t(lang, "book.selectVisible")
                  }
                  className="react-bookshelf-select-visible"
                  onClick={toggleVisibleSelection}
                  ref={selectVisibleTriggerRef}
                  size="xs"
                  variant="subtle"
                >
                  {allVisibleSelected
                    ? t(lang, "book.deselectVisible")
                    : t(lang, "book.selectVisible")}
                </Button>
                <fieldset className="react-bookshelf-view-toggle">
                  <legend>{t(lang, "new.catalogView")}</legend>
                  <button
                    aria-pressed={view === "cards"}
                    className={view === "cards" ? "is-active" : undefined}
                    onClick={() => setView("cards")}
                    type="button"
                  >
                    <span aria-hidden="true">▦</span>
                    {t(lang, "view.card")}
                  </button>
                  <button
                    aria-pressed={view === "list"}
                    className={view === "list" ? "is-active" : undefined}
                    onClick={() => setView("list")}
                    type="button"
                  >
                    <span aria-hidden="true">☰</span>
                    {t(lang, "view.list")}
                  </button>
                </fieldset>
              </div>
            </div>
            {visibleBooks.length === 0 ? (
              <div className="react-bookshelf-empty" role="status">
                <strong>{t(lang, "book.noFilterMatches")}</strong>
                <Text size="sm">{t(lang, "book.noFilterMatchesHint")}</Text>
              </div>
            ) : view === "list" ? (
              <div className="react-bookshelf-list">
                <div className="react-bookshelf-list-head">
                  <span>{t(lang, "book.list.columnSelection")}</span>
                  <span>{t(lang, "book.list.columnCover")}</span>
                  <span>{t(lang, "book.list.columnBook")}</span>
                  <span>{t(lang, "book.category")}</span>
                  <span>{t(lang, "book.status")}</span>
                  <span>{t(lang, "book.ownership")}</span>
                  <span>{t(lang, "book.ratingColumn")}</span>
                  <span />
                </div>
                {visibleBooks.map(renderBookListRow)}
              </div>
            ) : (
              <div className="react-bookshelf-grid">
                {visibleBooks.map(renderBookCard)}
              </div>
            )}
          </section>
        </main>
      </div>

      <AnimatePresence initial={false}>
        {Boolean(feedback) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-bookshelf-feedback"
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            role="status"
          >
            <Alert
              closeButtonLabel={t(lang, "notify.close")}
              color="accent"
              onClose={() => setFeedback("")}
              variant="light"
              withCloseButton
            >
              {feedback}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="react-bookshelf-footer">
        <Text className="react-bookshelf-muted" size="xs">
          本番とハーネスで同じ本棚UIを表示しています。
        </Text>
      </footer>

      {Boolean(portalTarget) && (
        <>
          {activeMenuBook ? (
            <div
              aria-label={t(lang, "book.moreActionsFor", {
                title: activeMenuBook.title,
              })}
              className="react-bookshelf-floating-menu"
              id="react-bookshelf-actions-menu"
              ref={menuRef}
              role="menu"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                visibility: menuPosition ? "visible" : "hidden",
              }}
            >
              <Button
                className="react-bookshelf-floating-menu-item"
                onClick={() => void togglePin(activeMenuBook)}
                role="menuitem"
                variant="subtle"
              >
                {t(lang, activeMenuBook.pinned ? "menu.unpin" : "menu.pin")}
              </Button>
              <Button
                className="react-bookshelf-floating-menu-item"
                onClick={() => {
                  const selected = activeMenuBook;
                  closeActionsMenu();
                  if (onOpen) {
                    onOpen(selected);
                  } else {
                    announce(`${selected.title}を開きます`);
                  }
                }}
                role="menuitem"
                variant="subtle"
              >
                {t(lang, "book.openTitle", { title: activeMenuBook.title })}
              </Button>
              <Button
                className="react-bookshelf-floating-menu-item"
                onClick={() => {
                  const selected = activeMenuBook;
                  bookActionTriggerRef.current = menuAnchorRef.current;
                  setEditBook(selected);
                  closeActionsMenu();
                }}
                role="menuitem"
                variant="subtle"
              >
                {t(lang, "action.edit")}
              </Button>
              <Button
                aria-label={
                  activeMenuBook.isbn
                    ? t(lang, "book.supplement")
                    : `${t(lang, "book.supplement")} (${t(lang, "book.noIsbn")})`
                }
                className="react-bookshelf-floating-menu-item"
                disabled={!activeMenuBook.isbn}
                onClick={() => {
                  const selected = activeMenuBook;
                  closeActionsMenu();
                  if (onSupplement) {
                    onSupplement(selected);
                  } else {
                    announce(t(lang, "book.supplement"));
                  }
                }}
                role="menuitem"
                title={activeMenuBook.isbn ? undefined : t(lang, "book.noIsbn")}
                variant="subtle"
              >
                {t(lang, "book.supplement")}
              </Button>
              <Button
                className="react-bookshelf-floating-menu-item"
                onClick={() => {
                  const selected = activeMenuBook;
                  bookActionTriggerRef.current = menuAnchorRef.current;
                  closeActionsMenu();
                  if (replaceContent) {
                    setActiveBook(selected);
                  } else if (onReplace) {
                    onReplace(selected);
                  } else {
                    setActiveBook(selected);
                  }
                }}
                role="menuitem"
                variant="subtle"
              >
                {t(lang, "book.replaceCover")}
              </Button>
              <Button
                aria-label={
                  activeMenuBook.cover || activeMenuBook.coverUrl
                    ? t(lang, "book.removeCover")
                    : `${t(lang, "book.removeCover")} (${t(lang, "book.noCover")})`
                }
                className="react-bookshelf-floating-menu-item"
                disabled={!(activeMenuBook.cover || activeMenuBook.coverUrl)}
                onClick={() => {
                  const selected = activeMenuBook;
                  closeActionsMenu();
                  if (onRemoveCover) {
                    onRemoveCover(selected);
                  } else {
                    announce(t(lang, "book.removeCover"));
                  }
                }}
                role="menuitem"
                title={
                  activeMenuBook.cover || activeMenuBook.coverUrl
                    ? undefined
                    : t(lang, "book.noCover")
                }
                variant="subtle"
              >
                {t(lang, "book.removeCover")}
              </Button>
              {librarySearchEnabled ? (
                <Button
                  aria-label={`図書館で探す${activeMenuBook.isbn ? "" : "（ISBNがないため利用できません）"}`}
                  className="react-bookshelf-floating-menu-item"
                  disabled={!activeMenuBook.isbn}
                  onClick={() => {
                    const selected = activeMenuBook;
                    bookActionTriggerRef.current = menuAnchorRef.current;
                    closeActionsMenu();
                    searchLibraries(selected);
                  }}
                  role="menuitem"
                  title={
                    activeMenuBook.isbn
                      ? undefined
                      : "ISBNがないため利用できません"
                  }
                  variant="subtle"
                >
                  図書館で探す
                </Button>
              ) : null}
            </div>
          ) : null}
          <Modal
            centered
            classNames={{
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            lang={lang}
            onClose={() => setActiveBook(null)}
            opened={Boolean(activeBook)}
            portalProps={{ target: portalTarget }}
            returnFocusRef={bookActionTriggerRef}
            title={
              activeBook
                ? `${t(lang, "book.replaceCover")} · ${activeBook.title}`
                : t(lang, "book.replaceCover")
            }
            withinPortal
          >
            {activeBook && replaceContent ? (
              replaceContent(activeBook, () => setActiveBook(null))
            ) : (
              <Stack gap="md">
                <TextInput
                  description={t(lang, "book.coverPathHint")}
                  label={t(lang, "book.coverPath")}
                  onChange={(event) => setCoverPath(event.currentTarget.value)}
                  value={coverPath}
                />
                <Group justify="flex-end">
                  <Button onClick={() => setActiveBook(null)} variant="default">
                    {t(lang, "action.cancel")}
                  </Button>
                  <Button
                    color="ink"
                    onClick={() => {
                      setActiveBook(null);
                      announce(t(lang, "book.saved"));
                    }}
                  >
                    {t(lang, "action.save")}
                  </Button>
                </Group>
              </Stack>
            )}
          </Modal>
          <Modal
            centered
            classNames={{
              body: "react-bookshelf-history-modal-body",
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={() => setHistoryModalOpen(false)}
            opened={calilUiEnabled && historyModalOpen}
            portalProps={{ target: portalTarget }}
            returnFocusRef={historyTriggerRef}
            size={760}
            title={t(lang, "bookshelf.history")}
            withinPortal
          >
            <div className="react-bookshelf-history-modal-summary">
              <div className="react-bookshelf-history-modal-summary-copy">
                <strong>確認した本 {searchHistory.length}冊</strong>
                {latestHistory ? (
                  <Text size="xs">
                    最終確認 {historyDateLabel(latestHistory.checkedAt)}
                  </Text>
                ) : null}
              </div>
            </div>
            <div className="react-bookshelf-history-modal-list">
              <div className="react-bookshelf-history-list">
                {searchHistory.map((entry) => {
                  const book = bookRows.find(
                    (candidate) => candidate.id === entry.bookId
                  );
                  return (
                    <div
                      className="react-bookshelf-history-row"
                      key={`${entry.bookId}:${entry.checkedAt}`}
                    >
                      <div className="react-bookshelf-history-row-copy">
                        <strong>{entry.title}</strong>
                        <Text size="xs">
                          {entry.availableCount}館で蔵書あり ·{" "}
                          {historyDateLabel(entry.checkedAt)}に確認
                        </Text>
                      </div>
                      <div className="react-bookshelf-history-row-actions">
                        {book ? (
                          <Button
                            onClick={() => retryLibrarySearch(entry)}
                            size="xs"
                            variant="subtle"
                          >
                            再検索
                          </Button>
                        ) : null}
                        <a
                          href={entry.bookUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          本の情報 ↗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Modal>
          <Modal
            centered
            classNames={{
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={() => setBulkEditOpen(false)}
            opened={bulkEditOpen}
            portalProps={{ target: portalTarget }}
            returnFocusRef={bulkEditTriggerRef}
            title={t(lang, "book.bulkEditTitle")}
            withinPortal
          >
            <BulkEditPanel
              categories={categories}
              lang={lang}
              listNames={listNames}
              onClose={() => setBulkEditOpen(false)}
              onSave={applyBulkEdit}
              saving={bulkEditSaving}
              selectedBooks={selectedRows}
              selectedBooksLabel={t(lang, "book.selectedBooks")}
              selectedCount={selectedRows.length}
            />
          </Modal>
          <Modal
            centered
            classNames={{
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={() => setEditBook(null)}
            opened={Boolean(editBook)}
            portalProps={{ target: portalTarget }}
            returnFocusRef={bookActionTriggerRef}
            title={
              editBook
                ? t(lang, "book.editTitleFor", { title: editBook.title })
                : t(lang, "action.edit")
            }
            withinPortal
          >
            {editBook ? (
              <EditBookPanel
                book={editBook}
                categories={categories}
                lang={lang}
                listNames={listNames}
                onClose={() => setEditBook(null)}
                onSave={(input) => saveEdit(editBook, input)}
              />
            ) : null}
          </Modal>
          <Modal
            centered
            classNames={{
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            focusKey={addFocusVersion}
            onClose={() => setAddOpen(false)}
            opened={addOpen}
            portalProps={{ target: portalTarget }}
            returnFocusRef={addBookTriggerRef}
            title={t(lang, "book.add")}
            withinPortal
          >
            {addBookContent ? (
              addBookContent(
                () => setAddOpen(false),
                () => setAddFocusVersion((version) => version + 1)
              )
            ) : (
              <AddBookPanel
                lang={lang}
                onClose={() => setAddOpen(false)}
                onSaved={() => announce(t(lang, "book.saved"))}
              />
            )}
          </Modal>
          <Modal
            centered
            classNames={{
              body: "react-bookshelf-library-modal-body",
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={closeLibrarySearch}
            opened={calilUiEnabled && Boolean(libraryBook)}
            portalProps={{ target: portalTarget }}
            returnFocusRef={bookActionTriggerRef}
            size={760}
            title={
              libraryBook
                ? `図書館で探す · ${libraryBook.title}`
                : "図書館で探す"
            }
            withinPortal
          >
            <LibrarySearchPanel
              error={libraryError}
              lang={lang}
              loading={libraryLoading}
              onClose={closeLibrarySearch}
              onRetry={() => {
                if (libraryBook) {
                  void runLibrarySearch(libraryBook);
                }
              }}
              onSearch={searchLibrariesFromAddress}
              requiresAddress={libraryApiConfigured && !calilCityConfigured}
              result={libraryResult}
            />
          </Modal>
          <Modal
            centered
            classNames={{
              body: "react-bookshelf-batch-modal-body",
              content: "react-bookshelf-modal-content",
              header: "react-bookshelf-modal-header",
              root: "react-bookshelf-modal",
            }}
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={closeBatchSearch}
            opened={calilUiEnabled && batchOpen}
            portalProps={{ target: portalTarget }}
            returnFocusRef={batchTriggerRef}
            size={760}
            title="図書館でまとめて探す"
            withinPortal
          >
            <LibraryBatchPanel
              error={batchError}
              items={batchItems}
              loading={batchLoading}
              onClose={closeBatchSearch}
            />
          </Modal>
        </>
      )}
    </div>
  );
}

function PrototypeApp({
  lang,
  bookCategories,
  books,
  onAddBook,
  addBookContent,
  onOpen,
  onReplace,
  replaceContent,
  onSupplement,
  onTogglePin,
  onRemoveCover,
  onBulkEditBooks,
  onEditBook,
  onSearchLibraries,
  onSearchLibrariesBatch,
  onOpenCalilWeb,
  onLibrarySearchCompleted,
  calilCityConfigured,
  calilSearchHistory,
  libraryApiConfigured,
  listNames,
}: Omit<BookshelfSurfaceProps, "scheme">) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactBookshelfSurface
        addBookContent={addBookContent}
        bookCategories={bookCategories}
        books={books}
        calilCityConfigured={calilCityConfigured}
        calilSearchHistory={calilSearchHistory}
        lang={lang}
        libraryApiConfigured={libraryApiConfigured}
        listNames={listNames}
        onAddBook={onAddBook}
        onBulkEditBooks={onBulkEditBooks}
        onEditBook={onEditBook}
        onLibrarySearchCompleted={onLibrarySearchCompleted}
        onOpen={onOpen}
        onOpenCalilWeb={onOpenCalilWeb}
        onRemoveCover={onRemoveCover}
        onReplace={onReplace}
        onSearchLibraries={onSearchLibraries}
        onSearchLibrariesBatch={onSearchLibrariesBatch}
        onSupplement={onSupplement}
        onTogglePin={onTogglePin}
        replaceContent={replaceContent}
        scheme={scheme}
      />
    </SeitonUIProvider>
  );
}

export function mountReactBookshelfPrototype(
  root: HTMLElement,
  options: Omit<BookshelfSurfaceProps, "scheme"> = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      addBookContent={options.addBookContent}
      bookCategories={options.bookCategories}
      books={options.books}
      calilCityConfigured={options.calilCityConfigured}
      calilSearchHistory={options.calilSearchHistory}
      lang={options.lang}
      libraryApiConfigured={options.libraryApiConfigured}
      listNames={options.listNames}
      onAddBook={options.onAddBook}
      onBulkEditBooks={options.onBulkEditBooks}
      onEditBook={options.onEditBook}
      onLibrarySearchCompleted={options.onLibrarySearchCompleted}
      onOpen={options.onOpen}
      onOpenCalilWeb={options.onOpenCalilWeb}
      onRemoveCover={options.onRemoveCover}
      onReplace={options.onReplace}
      onSearchLibraries={options.onSearchLibraries}
      onSearchLibrariesBatch={options.onSearchLibrariesBatch}
      onSupplement={options.onSupplement}
      onTogglePin={options.onTogglePin}
      replaceContent={options.replaceContent}
    />
  );
  return () => reactRoot.unmount();
}
