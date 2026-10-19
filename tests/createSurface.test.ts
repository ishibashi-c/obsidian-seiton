import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReactCreateSurface } from "../src/ui/screens/react-create-prototype";

describe("create surface headings", () => {
  it("does not repeat the memo type or content label", () => {
    const html = renderToStaticMarkup(
      createElement(ReactCreateSurface, {
        lang: "ja",
        scheme: "light",
        type: "memo",
      })
    );
    const header = html.match(
      /<header class="react-create-header">([\s\S]*?)<\/header>/
    )?.[1];
    const main = html.match(
      /<main class="react-create-main">([\s\S]*?)<\/main>/
    )?.[1];

    expect(header?.match(/一言メモ/g)).toHaveLength(1);
    expect(main?.match(/>内容</g)).toHaveLength(1);
    expect(main).not.toContain('placeholder="内容"');
  });
});
