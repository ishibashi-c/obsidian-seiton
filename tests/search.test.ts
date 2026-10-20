import { describe, expect, it } from "vitest";
import {
  buildSearchHaystack,
  isSearchDateRangeReversed,
  normalizeSearchText,
  parseSearchQuery,
  rankDocuments,
  type SearchDocument,
  SearchIndex,
  searchItems,
} from "../src/shared/search";
import type { IndexedItem } from "../src/shared/types";

function item(
  path: string,
  title: string,
  body: string,
  tags: string[] = [],
  status: IndexedItem["item"]["status"] = "active"
): IndexedItem {
  return {
    body,
    item: {
      created: "2026-08-21",
      lists: ["お気に入り"],
      status,
      tags,
      type: "webclip",
    },
    path,
    title,
  };
}

const items = [
  item("a.md", "ループエンジニアリング入門", "開発をループで回す", [
    "開発手法",
  ]),
  item("b.md", "TypeScript実践講座", "型システムの学習", ["テック/AI"]),
  item("c.md", "アーカイブ済み", "検索では見えるべき", [], "archive"),
];

describe("normalizeSearchText", () => {
  it("カタカナ→ひらがな（長音符は除去）", () => {
    expect(normalizeSearchText("テック")).toBe("てっく");
    expect(normalizeSearchText("コーヒー")).toBe("こひ");
  });

  it("NFKC・小文字化・空白正規化", () => {
    expect(normalizeSearchText("ＡＩ  Ｘ")).toBe("ai x");
  });
});

describe("searchItems", () => {
  it("タイトル横断検索", () => {
    const hits = searchItems(items, "ループ");
    expect(hits.map((i) => i.path)).toEqual(["a.md"]);
  });

  it("ひらがなでカタカナ語にヒット", () => {
    const kata = [item("d.md", "タイプスクリプト入門", "")];
    expect(searchItems(kata, "たいぷすくりぷと")).toHaveLength(1);
  });

  it("タグも検索対象", () => {
    expect(searchItems(items, "開発手法")).toHaveLength(1);
    expect(searchItems(items, "テック/AI")).toHaveLength(1);
  });

  it("リスト名も検索対象", () => {
    expect(searchItems(items, "お気に入り")).toHaveLength(3);
  });

  it("複数トークンはAND", () => {
    expect(searchItems(items, "ループ 開発")).toHaveLength(1);
    expect(searchItems(items, "ループ typescript")).toHaveLength(0);
  });

  it("excludeArchivedで完全除外・デフォルトは検索で見える（決定26）", () => {
    expect(searchItems(items, "検索", { excludeArchived: true })).toHaveLength(
      0
    );
    expect(searchItems(items, "検索")).toHaveLength(1);
  });

  it("空クエリは空配列", () => {
    expect(searchItems(items, "")).toEqual([]);
  });
});

describe("buildSearchHaystack", () => {
  it("タイトル+本文+タグ+リストを含む（正規化済み）", () => {
    const hay = buildSearchHaystack(items[0]);
    expect(hay).toContain(normalizeSearchText("ループエンジニアリング入門"));
    expect(hay).toContain(normalizeSearchText("開発手法"));
    expect(hay).toContain(normalizeSearchText("お気に入り"));
  });
});

const documents: SearchDocument[] = [
  {
    body: "本文にも TypeScript がある",
    id: "1",
    kind: "note",
    lists: ["学習"],
    modified: 10,
    path: "1.md",
    sourceTags: ["github"],
    status: "active",
    tags: ["開発"],
    title: "TypeScript",
    type: "article",
  },
  {
    body: "TypeScript の本文一致",
    id: "2",
    kind: "note",
    lists: [],
    modified: 20,
    path: "2.md",
    sourceTags: [],
    status: "active",
    tags: ["言語"],
    title: "開発メモ",
    type: "memo",
  },
  {
    body: "検索対象",
    id: "3",
    kind: "external",
    lists: [],
    modified: 30,
    path: "3.md",
    sourceTags: [],
    tags: [],
    title: "外部ノート",
  },
];

describe("ranked search", () => {
  it("引用句・除外語・field filterを解析する", () => {
    expect(
      parseSearchQuery('"exact phrase" -draft type:article tag:開発')
    ).toEqual({
      exclude: ["draft"],
      excludeFilters: {},
      filters: { tag: ["開発"], type: ["article"] },
      include: [],
      phrases: ["exact phrase"],
    });
  });

  it("タイトル一致を本文一致より上位にする", () => {
    expect(
      rankDocuments(documents, "typescript").map((result) => result.document.id)
    ).toEqual(["1", "2"]);
  });

  it("異種filterはAND、同種filterはORで扱う", () => {
    expect(
      rankDocuments(documents, "type:article type:memo source:github").map(
        (result) => result.document.id
      )
    ).toEqual(["1"]);
  });

  it("負のfield filterは一致するフィールド値を除外する", () => {
    expect(
      rankDocuments(documents, "-tag:言語").map((result) => result.document.id)
    ).toEqual(["3", "1"]);
    expect(parseSearchQuery("-type:article").excludeFilters).toEqual({
      type: ["article"],
    });
  });

  it("excerpt maps normalized long vowels, full-width text, phrases, and emoji to source offsets", () => {
    const body = `${"ー".repeat(400)} emoji😀 ＡＢＣ word   query`;
    const result = rankDocuments(
      [{ ...documents[0], body, title: "other" }],
      '"word query"'
    )[0];
    expect(result?.excerpt).toContain("emoji😀 ＡＢＣ word query");
  });

  it("handles an emoji query without stalling source offset mapping", () => {
    const body = "😀abc";
    const result = rankDocuments(
      [{ ...documents[0], body, title: "other" }],
      "😀"
    )[0];
    expect(result?.excerpt).toContain("😀abc");
  });

  it("tag filterに一致したタグを結果へ含める", () => {
    const taggedDocument = {
      ...documents[0],
      tags: ["デザイン", "UI", "ノンフィクション", "AI"],
    };

    expect(rankDocuments([taggedDocument], "tag:AI")[0]?.matchedTags).toEqual([
      "AI",
    ]);
  });

  it("作成日の範囲filterを適用する", () => {
    const dated = documents.map((document, index) => ({
      ...document,
      created: `2026-08-${String(index + 20).padStart(2, "0")}`,
    }));
    expect(
      rankDocuments(dated, "after:2026-08-21 before:2026-08-22").map(
        (result) => result.document.id
      )
    ).toEqual(["3", "2"]);
  });

  it("短語と本文にはfuzzyを適用しない", () => {
    expect(rankDocuments(documents, "tz")).toEqual([]);
    expect(rankDocuments(documents, "typescrpt")[0]?.document.id).toBe("1");
  });

  it("incremental indexはupsert/removeできる", () => {
    const index = new SearchIndex();
    index.replace(documents);
    index.remove("1");
    expect(
      index.search("typescript").map((result) => result.document.id)
    ).toEqual(["2"]);
    index.upsert(documents[0]);
    expect(index.size).toBe(3);
  });

  it("一定規模のfixtureを順位付きで検索できる", () => {
    const fixture = Array.from({ length: 2000 }, (_, index) => ({
      ...documents[2],
      id: String(index),
      path: `${index}.md`,
      title: index === 1999 ? "Needle exact" : `Document ${index}`,
    }));
    expect(rankDocuments(fixture, "needle")[0]?.document.id).toBe("1999");
  });
});

describe("search date range", () => {
  it("accepts incomplete, same-day, and ordered ranges but detects reversal", () => {
    expect(isSearchDateRangeReversed("", "2026-09-13")).toBe(false);
    expect(isSearchDateRangeReversed("2026-09-13", "2026-09-13")).toBe(false);
    expect(isSearchDateRangeReversed("2026-09-01", "2026-09-13")).toBe(false);
    expect(isSearchDateRangeReversed("2026-09-14", "2026-09-13")).toBe(true);
  });
});
