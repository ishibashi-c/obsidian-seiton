import { requestUrl } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectLibraryHoldings,
  extractLibraryRecords,
  searchCalilLibraries,
  searchCalilLibrariesBatch,
} from "../src/platform/obsidian/calilApi";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));

const calilSettings = {
  ...DEFAULT_SETTINGS,
  calilAppKey: "test-app-key",
  calilCity: "",
  calilPrefecture: "福岡県",
  calilReferenceLatitude: null,
  calilReferenceLongitude: null,
};

afterEach(() => {
  vi.mocked(requestUrl).mockReset();
});

describe("collectLibraryHoldings reserve URLs", () => {
  it("keeps only HTTP(S) reservation links from the API response", () => {
    const libraries = collectLibraryHoldings(
      [
        { formal: "Safe", libid: "1", libkey: "safe", systemid: "Safe" },
        { formal: "Unsafe", libid: "2", libkey: "unsafe", systemid: "Unsafe" },
      ],
      {
        Safe: {
          libkey: { safe: "貸出可" },
          reserveurl: "https://example.jp/reserve",
        },
        Unsafe: {
          libkey: { unsafe: "貸出可" },
          reserveurl: "javascript:alert(1)",
        },
      }
    );

    expect(libraries.map((library) => library.reserveUrl)).toEqual([
      "https://example.jp/reserve",
      undefined,
    ]);
  });
});

describe("searchCalilLibraries", () => {
  it("実際のJSON配列形式のlibraryレスポンスを扱う", () => {
    const records = extractLibraryRecords([
      {
        formal: "福岡市総合図書館",
        systemid: "Fukuoka_Fukuoka",
      },
    ]);

    expect(records).toEqual([
      {
        formal: "福岡市総合図書館",
        systemid: "Fukuoka_Fukuoka",
      },
    ]);
  });

  it("従来のLibrariesラッパー形式も扱う", () => {
    expect(
      extractLibraryRecords({
        Libraries: [{ systemid: "Tokyo_Setagaya" }],
      })
    ).toEqual([{ systemid: "Tokyo_Setagaya" }]);
  });

  it("同じシステムの各図書館へ対応するlibkeyだけを割り当てる", () => {
    const holdings = collectLibraryHoldings(
      [
        {
          category: "LARGE",
          distance: 2.4,
          formal: "中央図書館",
          libid: "1",
          libkey: "中央",
          systemid: "Fukuoka_Fukuoka",
          systemname: "福岡市",
        },
        {
          formal: "南図書館",
          libid: "2",
          libkey: "南",
          systemid: "Fukuoka_Fukuoka",
          systemname: "福岡市",
        },
      ],
      {
        Fukuoka_Fukuoka: {
          libkey: { 中央: "貸出中", 南: "貸出可" },
        },
      }
    );

    expect(
      holdings.map(({ formal, libKey, status }) => ({
        formal,
        libKey,
        status,
      }))
    ).toEqual([
      { formal: "中央図書館", libKey: "中央", status: "貸出中" },
      { formal: "南図書館", libKey: "南", status: "貸出可" },
    ]);
    expect(holdings[0]).toMatchObject({ category: "LARGE", distance: 2.4 });
  });

  it("キー未設定では外部リクエストを開始しない", async () => {
    await expect(
      searchCalilLibraries("9784478025819", DEFAULT_SETTINGS)
    ).rejects.toThrow("アプリケーションキー");
  });

  it("不正なISBNでは設定確認より先に失敗する", async () => {
    await expect(
      searchCalilLibraries("not-an-isbn", DEFAULT_SETTINGS)
    ).rejects.toThrow("ISBNの形式");
  });

  it("タイムアウトした蔵書結果を次の検索で再利用しない", async () => {
    let checkRequests = 0;
    vi.mocked(requestUrl).mockImplementation((async (request: unknown) => {
      const url = new URL((request as { url: string }).url);
      if (url.pathname.endsWith("/library")) {
        return {
          status: 200,
          text: JSON.stringify([
            { formal: "中央図書館", libkey: "中央", systemid: "Fukuoka" },
          ]),
        };
      }
      checkRequests++;
      return { status: 200, text: JSON.stringify({ continue: 1 }) };
    }) as never);

    const first = await searchCalilLibraries("9784478025819", calilSettings);
    const second = await searchCalilLibraries("9784478025819", calilSettings);

    expect(first.timedOut).toBe(true);
    expect(second.timedOut).toBe(true);
    expect(checkRequests).toBe(2);
  });

  it("一括検索は少数の検索を並行して処理する", async () => {
    let activeChecks = 0;
    let maximumActiveChecks = 0;
    vi.mocked(requestUrl).mockImplementation((async (request: unknown) => {
      const url = new URL((request as { url: string }).url);
      if (url.pathname.endsWith("/library")) {
        return {
          status: 200,
          text: JSON.stringify([
            { formal: "中央図書館", libkey: "中央", systemid: "Fukuoka" },
          ]),
        };
      }
      activeChecks++;
      maximumActiveChecks = Math.max(maximumActiveChecks, activeChecks);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const isbn = url.searchParams.get("isbn") ?? "";
      activeChecks--;
      return {
        status: 200,
        text: JSON.stringify({
          books: {
            [isbn]: { Fukuoka: { libkey: { 中央: "貸出可" } } },
          },
          continue: 0,
        }),
      };
    }) as never);

    const result = await searchCalilLibrariesBatch(
      [
        { id: "book-a", isbn: "9784478025819", title: "本A" },
        { id: "book-b", isbn: "9784101010014", title: "本B" },
      ],
      calilSettings
    );

    expect(maximumActiveChecks).toBeGreaterThan(1);
    expect(result.items.map((item) => item.status)).toEqual([
      "success",
      "success",
    ]);
  });
});
