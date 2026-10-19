import { describe, expect, it } from "vitest";
import {
  canonicalizeTags,
  canonicalTag,
  mergeTags,
  mostFrequentTags,
  normalizeTagInput,
  parseTagInput,
  suggestTags,
  suggestTagsForItem,
  toggleInList,
} from "../src/shared/tags";
import type { IndexedItem } from "../src/shared/types";

const ALIASES = {
  AI: ["ai", "人工知能", "A.I."],
  "Next.js": ["Nextjs", "next"],
};

describe("normalizeTagInput", () => {
  it("#を除去する", () => {
    expect(normalizeTagInput("#テック ")).toBe("テック");
  });
});

describe("parseTagInput", () => {
  it("カンマ・読点区切りを重複のないタグ配列へ変換する", () => {
    expect(parseTagInput("#学習/講義, 学習テーマ、#学習/講義")).toEqual([
      "学習/講義",
      "学習テーマ",
    ]);
  });
});

describe("canonicalTag", () => {
  it("エイリアスを正規タグに変換する", () => {
    expect(canonicalTag("ai", ALIASES)).toBe("AI");
    expect(canonicalTag("人工知能", ALIASES)).toBe("AI");
    expect(canonicalTag("Nextjs", ALIASES)).toBe("Next.js");
  });

  it("正規タグはそのまま", () => {
    expect(canonicalTag("AI", ALIASES)).toBe("AI");
    expect(canonicalTag("未知", ALIASES)).toBe("未知");
  });
});

describe("canonicalizeTags / mergeTags", () => {
  it("重複と空を除去する", () => {
    expect(canonicalizeTags(["AI", "ai", "", "#AI"], ALIASES)).toEqual(["AI"]);
  });

  it("マージも正規化される", () => {
    expect(mergeTags(["テック"], ["ai", "テック"], ALIASES)).toEqual([
      "テック",
      "AI",
    ]);
  });
});

describe("toggleInList", () => {
  it("追加と除去", () => {
    expect(toggleInList(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleInList(["a", "b"], "b")).toEqual(["a"]);
  });
});

describe("mostFrequentTags", () => {
  it("頻度順に最大5件を返す", () => {
    expect(
      mostFrequentTags([
        ["#開発", "UI"],
        ["開発", "検索"],
        ["UI", "開発"],
        ["読書"],
      ])
    ).toEqual(["開発", "UI", "検索", "読書"]);
  });

  it("同数なら最初に現れた順で、空の入力は除外する", () => {
    expect(
      mostFrequentTags([["", "#A"], ["B"], ["C"], ["D"], ["E"], ["F"]], 5)
    ).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("suggestTags", () => {
  const known = ["テック/AI", "テック/Web", "社会", "読書"];
  // 漢字タグの読み検索は「エイリアスに読みを登録する」仕様（自動読み変換はしない）
  const withReadings = { ...ALIASES, 社会: ["しゃかい"], 読書: ["どくしょ"] };

  it("1文字から候補を出す", () => {
    expect(suggestTags("て", known).length).toBeGreaterThan(0);
  });

  it("ひらがなクエリでタグにヒット（エイリアス登録分）", () => {
    expect(suggestTags("しゃかい", known, withReadings)).toContain("社会");
    expect(suggestTags("どくしょ", known, withReadings)).toContain("読書");
  });

  it("エイリアス経由で正規タグを出す", () => {
    expect(suggestTags("ai", known, ALIASES)).toContain("テック/AI");
  });

  it("空クエリは空配列", () => {
    expect(suggestTags("", known)).toEqual([]);
  });
});

describe("suggestTagsForItem", () => {
  const item: IndexedItem = {
    body: "開発をループで回す設計思想について",
    item: { created: "2026-08-21", status: "inbox", tags: [], type: "webclip" },
    path: "Seiton/clips/x.md",
    title: "ループエンジニアリング入門",
  };
  const known = ["開発手法", "テック/AI", "社会"];

  it("本文に現れるタグを優先する", () => {
    const suggestions = suggestTagsForItem(item, known, 3);
    expect(suggestions[0]).toBe("開発手法");
  });

  it("既存タグは候補から除く", () => {
    const withTag: IndexedItem = {
      ...item,
      item: { ...item.item, tags: ["開発手法"] },
    };
    expect(suggestTagsForItem(withTag, known, 3)).not.toContain("開発手法");
  });
});
