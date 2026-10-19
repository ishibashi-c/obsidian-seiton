import { describe, expect, it } from "vitest";
import { buildHomeIndex } from "../src/shared/index";
import type { IndexedItem } from "../src/shared/types";

function item(
  path: string,
  type: string,
  status: string,
  tags: string[] = [],
  lists: string[] = []
): IndexedItem {
  return {
    body: "",
    item: {
      created: "2026-08-21",
      lists,
      status,
      tags,
      type,
    } as IndexedItem["item"],
    path,
    title: path,
  };
}

const items = [
  item("a.md", "webclip", "active", ["テック/AI"], ["お気に入り"]),
  item("b.md", "idea", "inbox", ["テック/AI", "開発"]),
  item("c.md", "memo", "archive", ["社会"]),
  item("d.md", "task", "inbox", [], ["お気に入り"]),
];

describe("buildHomeIndex", () => {
  it("タグセクションを使用頻度順で作る", () => {
    const index = buildHomeIndex(items, { pinned: [] });
    expect(index.tags[0]).toMatchObject({ count: 2, tag: "テック/AI" });
  });

  it("アルファベット順に切り替えられる", () => {
    const index = buildHomeIndex(items, { pinned: [], tagSort: "alpha" });
    const tags = index.tags.map((t) => t.tag);
    expect(tags).toEqual([...tags].sort((a, b) => a.localeCompare(b, "ja")));
  });

  it("アーカイブをデフォルト表示から除外する（タグには残る）", () => {
    const index = buildHomeIndex(items, { pinned: [] });
    expect(index.items.map((i) => i.path)).not.toContain("c.md");
    const social = index.tags.find((t) => t.tag === "社会");
    expect(social?.items).toHaveLength(0);
  });

  it("excludeArchived=falseなら全件", () => {
    const index = buildHomeIndex(items, { excludeArchived: false, pinned: [] });
    expect(index.items).toHaveLength(4);
  });

  it("未整理はstatus: inboxのみ", () => {
    const index = buildHomeIndex(items, { pinned: [] });
    expect(index.inbox.map((i) => i.path)).toEqual(["b.md", "d.md"]);
  });

  it("ピン留めはパス一致", () => {
    const index = buildHomeIndex(items, { pinned: ["a.md"] });
    expect(index.pinned.map((i) => i.path)).toEqual(["a.md"]);
  });

  it("リストは設定名と実データの和集合", () => {
    const index = buildHomeIndex(items, {
      listNames: ["村田TVネタ"],
      pinned: [],
    });
    const names = index.lists.map((l) => l.name);
    expect(names).toContain("お気に入り");
    expect(names).toContain("村田TVネタ");
    const fav = index.lists.find((l) => l.name === "お気に入り");
    expect(fav?.count).toBe(2);
  });
});
