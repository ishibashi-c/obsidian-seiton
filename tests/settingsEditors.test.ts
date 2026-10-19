import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EDITOR_COLORS } from "../src/shared/constants";
import {
  ColorPaletteEditor,
  StringListEditor,
  TagAliasEditor,
} from "../src/ui/patterns/SettingsEditors";

describe("settings editor shared components", () => {
  it("renders list controls with labels and protected default item", () => {
    const html = renderToStaticMarkup(
      createElement(StringListEditor, {
        addLabel: "追加",
        addPlaceholder: "カテゴリ名",
        defaultLabel: "既定",
        duplicateMessage: "重複しています",
        emptyLabel: "項目なし",
        itemLabel: "カテゴリ",
        moveDownLabel: "下へ",
        moveUpLabel: "上へ",
        onChange: vi.fn(),
        removeLabel: "削除",
        requiredMessage: "必須です",
        requiredValue: "未分類",
        values: ["未分類", "読書"],
      })
    );

    expect(html).toContain('aria-label="カテゴリ 1"');
    expect(html).toContain('aria-label="上へ: カテゴリ 1"');
    expect(html).toContain('aria-label="下へ: カテゴリ 2"');
    expect(html).toContain('aria-label="削除: カテゴリ 1"');
    expect(html).toContain("既定");
    expect(html).toContain('placeholder="カテゴリ名"');
    expect(html).toContain('disabled=""');
  });

  it("renders tag aliases as separate labeled inputs", () => {
    const html = renderToStaticMarkup(
      createElement(TagAliasEditor, {
        initialValues: { development: ["dev"] },
        labels: {
          addAlias: "別名を追加",
          addMapping: "対応を追加",
          aliasLabel: "別名",
          aliasPlaceholder: "別名タグ",
          canonicalLabel: "正規タグ",
          duplicateMessage: "重複しています",
          emptyLabel: "対応なし",
          removeLabel: "削除",
          requiredMessage: "必須です",
        },
        onChange: vi.fn(),
      })
    );

    expect(html).toContain('aria-label="正規タグ"');
    expect(html).toContain('aria-label="別名 1"');
    expect(html).toContain('placeholder="別名タグ"');
    expect(html).toContain("development");
    expect(html).toContain("dev");
  });

  it("exposes selected toolbar colors as pressed buttons", () => {
    const html = renderToStaticMarkup(
      createElement(ColorPaletteEditor, {
        colors: EDITOR_COLORS,
        labels: {
          all: "すべて表示",
          hint: "表示する色を選択",
          label: "ツールバーの色",
        },
        onChange: vi.fn(),
        values: [EDITOR_COLORS[0]],
      })
    );

    expect(html).toContain(`aria-label="ツールバーの色: ${EDITOR_COLORS[0]}"`);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("すべて表示");
  });
});
