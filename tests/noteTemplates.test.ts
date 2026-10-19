import { describe, expect, it } from "vitest";
import { buildNewNote, templateForType } from "../src/shared/noteTemplates";

describe("collection note template", () => {
  it("creates an extensible long-lived curation note", () => {
    expect(templateForType("collection")).toBe("## 項目");
    expect(
      buildNewNote("collection", "良かったアート", "2026-09-24")
    ).toContain("type: collection");
    expect(
      buildNewNote("collection", "良かったアート", "2026-09-24")
    ).toContain("## 項目");
  });
});
