import { beforeAll, describe, expect, it } from "vitest";
import { parseItem, setYamlParser } from "../src/shared/frontmatter";
import { testParseYaml } from "./helpers/yaml";

beforeAll(() => {
  setYamlParser(testParseYaml);
});

describe("本棚ノートのパース（baseTags/lists欠落ケース）", () => {
  const content = `---
type: reading
status: active
created: "2026-08-23T02:10:00"
bookIsbn: "8888888888888"
readingStatus: to-read
bookProgress: 0
---

テスト2`;

  it("baseTags/listsが無くてもパースできる", () => {
    const r = parseItem(content, "Seiton/readings/削除反映テスト2.md");
    expect(r.errors).toEqual([]);
    expect(r.item).not.toBeNull();
    expect((r.item as unknown as Record<string, unknown>).bookIsbn).toBe(
      "8888888888888"
    );
    expect((r.item as unknown as Record<string, unknown>).readingStatus).toBe(
      "to-read"
    );
  });
});
