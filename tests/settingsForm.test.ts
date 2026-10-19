import { describe, expect, it } from "vitest";
import {
  normalizeSettingsSearchText,
  parsePathList,
  parsePositiveInt,
  parseTagAliasesInput,
  settingsSearchMatches,
  stringifyTagAliases,
} from "../src/features/settings/settingsForm";

describe("parseTagAliasesInput", () => {
  it("正規タグ: エイリアス行をパースする", () => {
    expect(parseTagAliasesInput("AI: ai, 人工知能, A.I.")).toEqual({
      AI: ["ai", "人工知能", "A.I."],
    });
  });

  it("複数行・空行を扱える", () => {
    const input = "AI: ai\n\nNext.js: Nextjs, next\n";
    expect(parseTagAliasesInput(input)).toEqual({
      AI: ["ai"],
      "Next.js": ["Nextjs", "next"],
    });
  });

  it("不正行（コロン無し・空正規タグ）は無視する", () => {
    expect(parseTagAliasesInput("no-colon-line\n: alias\nAI:")).toEqual({});
  });

  it("先頭の#を除去し、空エイリアスを除く", () => {
    expect(parseTagAliasesInput("#テック: #tech, , tech2")).toEqual({
      テック: ["tech", "tech2"],
    });
  });

  it("空文字列なら空オブジェクト", () => {
    expect(parseTagAliasesInput("")).toEqual({});
  });
});

describe("stringifyTagAliases", () => {
  it("逆変換で元に戻る（ラウンドトリップ）", () => {
    const aliases = { AI: ["ai", "人工知能"], "Next.js": ["next"] };
    const text = stringifyTagAliases(aliases);
    expect(parseTagAliasesInput(text)).toEqual(aliases);
  });

  it("空オブジェクトなら空文字列", () => {
    expect(stringifyTagAliases({})).toBe("");
  });
});

describe("parsePathList", () => {
  it("カンマ区切りをパースし重複を除去する", () => {
    expect(parsePathList("a, b ,c,a")).toEqual(["a", "b", "c"]);
  });

  it("前後のスラッシュを正規化する", () => {
    expect(parsePathList("/notes/, /blog/")).toEqual(["notes", "blog"]);
  });

  it("空要素を除去する", () => {
    expect(parsePathList("a,,b,")).toEqual(["a", "b"]);
    expect(parsePathList("")).toEqual([]);
  });
});

describe("parsePositiveInt", () => {
  it("正の整数をパースする", () => {
    expect(parsePositiveInt("42", 10)).toBe(42);
    expect(parsePositiveInt("1000", 10)).toBe(1000);
  });

  it("不正値はフォールバック", () => {
    expect(parsePositiveInt("abc", 10)).toBe(10);
    expect(parsePositiveInt("-5", 10)).toBe(10);
    expect(parsePositiveInt("0", 10)).toBe(10);
    expect(parsePositiveInt("", 10)).toBe(10);
  });

  it("小数は切り捨て", () => {
    expect(parsePositiveInt("3.9", 10)).toBe(3);
  });
});

describe("settings search", () => {
  it("全角・大文字・空白を正規化する", () => {
    expect(normalizeSettingsSearchText("  Ｃａｃｈｅ  上限 ")).toBe(
      "cache 上限"
    );
  });

  it("設定名または説明に一致する", () => {
    expect(settingsSearchMatches("タブ", "本の詳細を同じタブで開く")).toBe(
      true
    );
    expect(settingsSearchMatches("folder", "Additional search folders")).toBe(
      true
    );
    expect(settingsSearchMatches("存在しない", "検索履歴を保存する")).toBe(
      false
    );
    expect(settingsSearchMatches("", "任意の設定")).toBe(true);
  });
});
