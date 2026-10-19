import { describe, expect, it } from "vitest";
import { clearBookshelfSelectionAndRestoreFocus } from "../src/ui/screens/react-bookshelf-prototype";

describe("bookshelf selection focus", () => {
  it("returns focus to the stable selection trigger when clearing all books", () => {
    // Regression: UIUX-36 — clearing bulk selection dropped focus from the bookshelf.
    // Found by /qa on 2026-09-13
    // Report: docs/uiux-audit-2026-09-13.md
    const calls: string[] = [];
    const focusTarget = { focus: () => calls.push("focus") };
    const clearSelection = () => calls.push("clear");

    clearBookshelfSelectionAndRestoreFocus(clearSelection, focusTarget);

    expect(calls).toEqual(["clear", "focus"]);
  });
});
