import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookCandidateEditionNotice } from "../src/ui/patterns/AddBookModal";

describe("book candidate edition notice", () => {
  it("announces a similar existing edition in the selected language", () => {
    const html = renderToStaticMarkup(
      createElement(BookCandidateEditionNotice, { lang: "de", similar: true })
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Eine ähnliche Ausgabe existiert.");
  });

  it("renders nothing when no similar book was found", () => {
    expect(
      renderToStaticMarkup(
        createElement(BookCandidateEditionNotice, {
          lang: "ja",
          similar: false,
        })
      )
    ).toBe("");
  });
});
