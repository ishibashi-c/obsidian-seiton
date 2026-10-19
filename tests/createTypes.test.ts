import { describe, expect, it } from "vitest";
import { getCreateTypeSections } from "../src/shared/createTypes";

const baseSettings = {
  enabledTypes: ["memo", "article", "task", "idea"] as const,
  modules: { memos: true },
  pinnedTypes: ["idea", "task"] as const,
  recentTypes: ["task", "memo"] as const,
  typeOrder: ["article", "memo", "idea", "task"] as const,
};

describe("getCreateTypeSections", () => {
  it("enabledTypesとtypeOrderを使い、固定・最近・残りを分ける", () => {
    expect(getCreateTypeSections(baseSettings)).toEqual({
      all: ["article"],
      pinned: ["idea", "task"],
      recent: ["memo"],
    });
  });

  it("memos moduleが無効ならmemoを候補から除外する", () => {
    expect(
      getCreateTypeSections({
        ...baseSettings,
        modules: { memos: false },
      })
    ).toEqual({
      all: ["article"],
      pinned: ["idea", "task"],
      recent: [],
    });
  });

  it("無効タイプ、typeOrderにないタイプ、重複した優先指定を表示しない", () => {
    expect(
      getCreateTypeSections({
        enabledTypes: ["idea", "task", "reading"],
        modules: { memos: true },
        pinnedTypes: ["task", "task", "memo"],
        recentTypes: ["task", "profile", "profile"],
        typeOrder: ["profile", "idea", "task", "task"],
      })
    ).toEqual({
      all: ["idea"],
      pinned: ["task"],
      recent: [],
    });
  });
});
