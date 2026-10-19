import { describe, expect, it } from "vitest";
import {
  formatItemFrontmatter,
  parseFrontmatter,
  parseItem,
  rewriteFrontmatter,
  serializeFrontmatter,
  validateItem,
} from "../src/shared/frontmatter";

const NOTE = `---
type: webclip
tags: [テック/AI, 開発手法]
baseTags: [ニュース]
lists: []
status: active
created: 2026-08-11T18:30:00
source: https://example.com/loop-engineering
---
https://example.com/loop-engineering

## メモ
本文`;

describe("parseFrontmatter", () => {
  it("frontmatterと本文を分離する", () => {
    const fm = parseFrontmatter(NOTE);
    expect(fm).not.toBeNull();
    expect(fm?.data.type).toBe("webclip");
    expect(fm?.data.tags).toEqual(["テック/AI", "開発手法"]);
    expect(fm?.body.startsWith("https://example.com")).toBe(true);
  });

  it("frontmatterがない場合はnull", () => {
    expect(parseFrontmatter("本文だけ")).toBeNull();
  });

  it("閉じ区切りがない場合はnull", () => {
    expect(parseFrontmatter("---\ntype: memo\n本文")).toBeNull();
  });
});

describe("validateItem / parseItem", () => {
  it("正しいスキーマを通す", () => {
    const parsed = parseItem(
      NOTE,
      "Seiton/clips/ループエンジニアリング入門.md"
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.item).toMatchObject({
      source: "https://example.com/loop-engineering",
      sourceTags: ["ニュース"],
      status: "active",
      tags: ["テック/AI", "開発手法"],
      type: "webclip",
    });
    expect(parsed.title).toBe("ループエンジニアリング入門");
  });

  it("コレクションタイプを解析・保存する", () => {
    const parsed = parseItem(
      "---\ntype: collection\nstatus: inbox\ncreated: 2026-09-24\ntags: []\n---\n## 良かったアート\n",
      "Seiton/collections/良かったアート.md"
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.item?.type).toBe("collection");
  });

  it("type不正を検出する", () => {
    const errors = validateItem({
      created: "2026-08-21",
      status: "active",
      type: "unknown",
    });
    expect(errors.some((e) => e.startsWith("type"))).toBe(true);
  });

  it("status不正を検出する", () => {
    const errors = validateItem({
      created: "2026-08-21",
      status: "gone",
      type: "memo",
    });
    expect(errors.some((e) => e.startsWith("status"))).toBe(true);
  });

  it("created必須を検出する", () => {
    const errors = validateItem({ status: "inbox", type: "memo" });
    expect(errors.some((e) => e.startsWith("created"))).toBe(true);
  });
});

describe("serializeFrontmatter / formatItemFrontmatter", () => {
  it("空配列も出力する（スキーマ一貫性）", () => {
    const fm = formatItemFrontmatter({
      created: "2026-08-21T10:00:00",
      status: "inbox",
      type: "idea",
    });
    expect(fm).toContain("tags: []");
    expect(fm).toContain("sourceTags: []");
    expect(fm).toContain("lists: []");
  });

  it("特殊文字は引用符で囲む", () => {
    const fm = serializeFrontmatter({ title: "a: b #c" });
    expect(fm).toBe('title: "a: b #c"');
  });
});

describe("rewriteFrontmatter", () => {
  it("一部のキーだけ書き換える", () => {
    const next = rewriteFrontmatter(NOTE, { status: "archive" });
    expect(next).not.toBeNull();
    if (!next) {
      throw new Error("Expected rewritten frontmatter");
    }
    const reparsed = parseItem(next, "x.md");
    expect(reparsed.item?.status).toBe("archive");
    expect(reparsed.item?.type).toBe("webclip");
    expect(reparsed.body.startsWith("https://example.com")).toBe(true);
    expect(next).toContain("sourceTags: [ニュース]");
    expect(next).not.toContain("baseTags:");
  });

  it("sourceTagsがあれば旧baseTagsより優先する", () => {
    const note = NOTE.replace(
      "baseTags: [ニュース]",
      "sourceTags: [公式]\nbaseTags: [旧値]"
    );
    expect(parseItem(note, "x.md").item?.sourceTags).toEqual(["公式"]);
  });

  it("frontmatterがない場合はnull", () => {
    expect(rewriteFrontmatter("本文", { status: "archive" })).toBeNull();
  });
});
