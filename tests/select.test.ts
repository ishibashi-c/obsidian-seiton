import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select } from "../src/ui/primitives";

describe("Select value mode", () => {
  it("uses defaultValue without also controlling the native select", () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        data: [
          { label: "授業・セミナー", value: "lecture" },
          { label: "タスク", value: "task" },
        ],
        defaultValue: "task",
        label: "タイプ",
      })
    );
    const selectTag = html.match(/<select[^>]*>/)?.[0] ?? "";

    expect(selectTag).not.toContain("value=");
    expect(html).toContain('value="task" selected=""');
  });

  it("prefers value when both controlled and initial values are provided", () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        data: [
          { label: "授業・セミナー", value: "lecture" },
          { label: "タスク", value: "task" },
        ],
        defaultValue: "task",
        label: "タイプ",
        value: "lecture",
      })
    );

    expect(html).toContain('value="lecture" selected=""');
    expect(html).not.toContain('value="task" selected=""');
  });
});
