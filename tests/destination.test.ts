import { describe, expect, it } from "vitest";
import { destinationFromUiId } from "../src/app/destination";

describe("React UI destination mapping", () => {
  it("maps the home memo entry to the registered review view", () => {
    expect(destinationFromUiId("memo")).toBe("memoReview");
  });

  it("preserves registered view ids and rejects unknown ids", () => {
    expect(destinationFromUiId("search")).toBe("search");
    expect(destinationFromUiId("bookshelf")).toBe("bookshelf");
    expect(destinationFromUiId("new-tab")).toBeNull();
  });
});
