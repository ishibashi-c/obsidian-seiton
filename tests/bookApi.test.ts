import { describe, expect, it } from "vitest";
import {
  bookIsbnValue,
  isbn13To10,
  isValidIsbn,
  normalizeIsbn,
  splitIsbnInput,
} from "../src/domain/book";
import { calilBookUrl } from "../src/domain/library";
import {
  fetchBookMetadata,
  searchBookMetadata,
} from "../src/platform/obsidian/bookApi";

// requestUrlはObsidian APIのためユニットテストでは明示的に失敗する。
// API層が通信失敗を「検索結果0件」と混同せず呼び出し元へ返すことも確認する。

describe("normalizeIsbn", () => {
  it("ハイフンと空白を除去する", () => {
    expect(normalizeIsbn("978-4-478-02581-9")).toBe("9784478025819");
    expect(normalizeIsbn(" 9784101010014 ")).toBe("9784101010014");
    expect(normalizeIsbn("978 4 10101001 9")).toBe("9784101010019");
  });

  it("ISBN10をISBN13へ変換する", () => {
    expect(normalizeIsbn("4-478-02581-9")).toBe("9784478025819");
  });
});

describe("bookIsbnValue", () => {
  it("YAMLで数値になったISBNも選択対象にできる文字列へ戻す", () => {
    expect(bookIsbnValue(9_784_478_025_819)).toBe("9784478025819");
    expect(bookIsbnValue("978-4-478-02581-9")).toBe("9784478025819");
  });
});

describe("isValidIsbn", () => {
  it("ISBN13（978/979始まり13桁）は有効", () => {
    expect(isValidIsbn("9784101010014")).toBe(true);
    expect(isValidIsbn("978-4-10-101001-4")).toBe(true);
    expect(isValidIsbn("9791234567890")).toBe(false);
  });

  it("ISBN10は13へ変換した上で有効", () => {
    expect(isValidIsbn("4478025819")).toBe(true);
    expect(isValidIsbn("4-478-02581-9")).toBe(true);
    expect(isValidIsbn("043942089X")).toBe(true);
    expect(isValidIsbn("4478025818")).toBe(false);
  });

  it("一括入力を改行・カンマで分割して重複排除する", () => {
    expect(
      splitIsbnInput("978-4-10-101001-4\n4-10-101001-X, 9784101010014")
    ).toEqual(["9784101010014"]);
  });

  it("不正な形式は無効", () => {
    expect(isValidIsbn("")).toBe(false);
    expect(isValidIsbn("abc")).toBe(false);
    expect(isValidIsbn("97841010100145")).toBe(false); // 14桁
    expect(isValidIsbn("978410101001")).toBe(false); // 12桁
    expect(isValidIsbn("1234567890123")).toBe(false); // 13桁だが978/979以外
  });
});

describe("isbn13To10", () => {
  it("978系ISBNをカーリル用のISBN10へ変換する", () => {
    expect(isbn13To10("978-4-478-02581-9")).toBe("4478025819");
    expect(isbn13To10("9791234567890")).toBeNull();
  });
});

describe("searchBookMetadata", () => {
  it("Open Libraryへの接続失敗を空の検索結果に変換しない", async () => {
    await expect(searchBookMetadata("Seiton")).rejects.toThrow(
      "requestUrl called in unit test"
    );
  });

  it("ISBN検索で両方の書誌APIに接続できない場合は取得失敗を返す", async () => {
    await expect(fetchBookMetadata("9784478025819")).rejects.toThrow(
      "requestUrl called in unit test"
    );
  });
});

describe("calilBookUrl", () => {
  it("ハイフン付きISBNをカーリルのISBN10 URLへ変換する", () => {
    expect(calilBookUrl("978-4-478-02581-9")).toBe(
      "https://calil.jp/book/4478025819"
    );
  });

  it("979系や不正値は入力値を壊さずURL化する", () => {
    expect(calilBookUrl("9791234567890")).toBe(
      "https://calil.jp/book/9791234567890"
    );
  });
});
