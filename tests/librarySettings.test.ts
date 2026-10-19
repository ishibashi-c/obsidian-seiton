import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../src/ui/screens/react-library-prototype";
import { sortLibraryTags } from "../src/ui/screens/react-library-prototype";

const item = (id: string, tags: string[]): LibraryItem => ({
  created: "2026.09.01",
  id,
  modified: "2026.09.02",
  path: `Seiton/tasks/${id}.md`,
  tags,
  title: id,
  type: "task",
});

describe("library tag settings", () => {
  const items = [
    item("one", ["#z", "#a"]),
    item("two", ["#z"]),
    item("three", ["#m"]),
  ];

  it("alpha sorts tags by name", () => {
    expect(sortLibraryTags(items, "alpha")).toEqual(["#a", "#m", "#z"]);
  });

  it("usage sorts tags by count, then name", () => {
    expect(sortLibraryTags(items, "usage")).toEqual(["#z", "#a", "#m"]);
  });
});
