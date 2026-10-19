import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconButton } from "../src/ui/primitives";

describe("icon button accessibility", () => {
  it("exposes its label, tooltip, and pressed state while hiding the icon", () => {
    const html = renderToStaticMarkup(
      createElement(IconButton, {
        icon: "pin",
        label: "項目: ピン留め",
        pressed: true,
        title: "ピン留め解除",
      })
    );

    expect(html).toContain('aria-label="項目: ピン留め"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('title="ピン留め解除"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<svg");
  });

  it("does not expose toggle state for a one-way action", () => {
    const html = renderToStaticMarkup(
      createElement(IconButton, {
        icon: "filter-clear",
        label: "条件をクリア",
      })
    );

    expect(html).toContain('aria-label="条件をクリア"');
    expect(html).not.toContain("aria-pressed");
  });
});
