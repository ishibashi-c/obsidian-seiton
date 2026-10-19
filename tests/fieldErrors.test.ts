import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Select, Textarea, TextInput } from "../src/ui/primitives";

describe("field errors", () => {
  it("associates a text input error and preserves existing descriptions", () => {
    const html = renderToStaticMarkup(
      createElement(TextInput, {
        "aria-describedby": "existing-help",
        error: "A list with this name already exists. Enter a different name.",
        id: "list-name",
        label: "List name",
      })
    );

    expect(html).toContain('aria-describedby="existing-help list-name-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="list-name-error" role="alert"');
  });

  it("associates textarea errors with their controls", () => {
    const html = renderToStaticMarkup(
      createElement(Textarea, {
        error: "A note is required.",
        id: "note",
        label: "Note",
      })
    );

    expect(html).toContain('aria-describedby="note-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("associates select errors with their controls", () => {
    const html = renderToStaticMarkup(
      createElement(Select, {
        data: ["First", "Second"],
        error: "Choose an option.",
        id: "choice",
        label: "Choice",
      })
    );

    expect(html).toContain('aria-describedby="choice-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("styles red alerts differently from the default accent alert", () => {
    const tokens = readFileSync(
      new URL("../src/ui/tokens.css", import.meta.url),
      "utf8"
    );

    expect(tokens).toMatch(
      /\.seiton-ui-alert-light\.seiton-color-red\s*\{[^}]*background:\s*var\(--seiton-color-red-1\);[^}]*border-inline-start:\s*3px solid var\(--seiton-color-red-7\);/s
    );
  });
});
