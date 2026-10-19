import { describe, expect, it } from "vitest";
import { EDITOR_COLORS } from "../src/shared/constants";
import {
  clearHeadingLine,
  highlightText,
  removeHighlightText,
  toggleDelimitedText,
  toggleHeadingLine,
} from "../src/shared/editorToolbar";

describe("selection toolbar color palette", () => {
  it("uses the eight bright Obsidian accent colors", () => {
    expect(EDITOR_COLORS).toEqual([
      "#fb464c",
      "#e9973f",
      "#e0de71",
      "#44cf6e",
      "#53dfdd",
      "#027aff",
      "#a882ff",
      "#fa99cd",
    ]);
    expect(EDITOR_COLORS).toHaveLength(8);
  });
});

describe("selection toolbar Markdown transformations", () => {
  it("toggles bold and italic without losing the selected text", () => {
    expect(toggleDelimitedText("選択範囲", "**")).toBe("**選択範囲**");
    expect(toggleDelimitedText("**選択範囲**", "**")).toBe("選択範囲");
    expect(toggleDelimitedText("選択範囲", "*")).toBe("*選択範囲*");
    expect(toggleDelimitedText("*選択範囲*", "*")).toBe("選択範囲");
  });

  it("toggles the requested heading level and removes the same level", () => {
    expect(toggleHeadingLine("本文", 2)).toBe("## 本文");
    expect(toggleHeadingLine("# 本文", 2)).toBe("## 本文");
    expect(toggleHeadingLine("## 本文", 2)).toBe("本文");
  });

  it("clears an existing heading when formatting is reset", () => {
    expect(clearHeadingLine("### 見出し")).toBe("見出し");
    expect(clearHeadingLine("本文")).toBe("本文");
  });

  it("adds a highlight and clears both HTML and Obsidian highlight syntax", () => {
    const highlighted = highlightText("重要", "#fff3a3");
    expect(highlighted).toBe('<mark style="background: #fff3a3;">重要</mark>');
    expect(removeHighlightText(highlighted)).toBe("重要");
    expect(
      highlightText('<mark style="background: #fff3a3;">重要</mark>', "#bbfabb")
    ).toBe('<mark style="background: #bbfabb;">重要</mark>');
    expect(
      removeHighlightText(
        '<mark style="background: #bbfabb;"><mark style="background: #fff3a3;">重要</mark></mark>'
      )
    ).toBe("重要");
    expect(removeHighlightText("==重要==")).toBe("重要");
  });
});
