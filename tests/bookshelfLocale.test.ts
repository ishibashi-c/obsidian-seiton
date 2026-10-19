import { describe, expect, it } from "vitest";
import type { LibrarySearchHistoryEntry } from "../src/domain/library";
import { LANGS, t } from "../src/shared/i18n";
import {
  bookshelfSelectionScopeText,
  calilHistoryForLanguage,
  failPendingLibraryBatchItems,
} from "../src/ui/screens/react-bookshelf-prototype";

const HISTORY_ENTRY: LibrarySearchHistoryEntry = {
  availableCount: 2,
  bookId: "reading/kirawareru-yuki",
  bookUrl: "https://calil.jp/book/4478025819",
  checkedAt: "2026-09-14T00:00:00.000Z",
  isbn: "9784478025819",
  title: "嫌われる勇気",
};

describe("language-specific bookshelf features", () => {
  it("provides a localized, user-facing library-search failure message", () => {
    for (const lang of LANGS) {
      expect(t(lang, "book.librarySearchError")).not.toBe(
        "book.librarySearchError"
      );
    }

    expect(t("ja", "book.librarySearchError")).toBe(
      "蔵書状況を取得できませんでした。カーリルの設定と通信環境を確認して、もう一度お試しください。"
    );
    expect(t("de", "book.librarySearchError")).toBe(
      "Bibliotheksbestände konnten nicht abgerufen werden. Prüfen Sie die Calil-Einstellungen und Ihre Verbindung und versuchen Sie es erneut."
    );
  });

  it("reuses the empty Calil history when no history is configured", () => {
    expect(calilHistoryForLanguage("ja")).toBe(calilHistoryForLanguage("ja"));
    expect(calilHistoryForLanguage("de")).toBe(calilHistoryForLanguage("de"));
  });

  it("keeps Calil search history in the Japanese UI", () => {
    expect(calilHistoryForLanguage("ja", [HISTORY_ENTRY])).toEqual([
      HISTORY_ENTRY,
    ]);
  });

  it.each(LANGS.filter((lang) => lang !== "ja"))(
    "hides Japanese library-search content in the %s UI",
    (lang) => {
      expect(calilHistoryForLanguage(lang, [HISTORY_ENTRY])).toEqual([]);
      expect(bookshelfSelectionScopeText(lang, true, 1)).toBe(
        t(lang, "book.bulkEditScope")
      );
    }
  );

  it("shows the library-search scope only when Japanese users can search", () => {
    expect(bookshelfSelectionScopeText("ja", true, 1)).toBe(
      "図書館検索はISBNありの1冊が対象です。"
    );
    expect(bookshelfSelectionScopeText("ja", false, 1)).toBe(
      "読書状態・カテゴリ・リストをまとめて変更できます。"
    );
    expect(bookshelfSelectionScopeText("ja", true, 0)).toBe(
      "読書状態・カテゴリ・リストをまとめて変更できます。"
    );
  });

  it("marks unfinished batch-search rows as errors after a request failure", () => {
    expect(
      failPendingLibraryBatchItems(
        [
          {
            bookId: "reading/queued",
            isbn: "9784478025819",
            status: "queued",
            title: "待機中の本",
          },
          {
            bookId: "reading/loading",
            isbn: "9784478025819",
            status: "loading",
            title: "検索中の本",
          },
          {
            bookId: "reading/success",
            isbn: "9784101006012",
            status: "success",
            title: "完了した本",
          },
        ],
        "network unavailable"
      )
    ).toEqual([
      {
        bookId: "reading/queued",
        error: "network unavailable",
        isbn: "9784478025819",
        status: "error",
        title: "待機中の本",
      },
      {
        bookId: "reading/loading",
        error: "network unavailable",
        isbn: "9784478025819",
        status: "error",
        title: "検索中の本",
      },
      {
        bookId: "reading/success",
        isbn: "9784101006012",
        status: "success",
        title: "完了した本",
      },
    ]);
  });
});
