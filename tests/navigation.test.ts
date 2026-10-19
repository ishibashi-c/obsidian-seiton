import { describe, expect, it } from "vitest";
import { VIEW_TYPE_BY_DESTINATION } from "../src/shared/navigation";

describe("Seiton navigation", () => {
  it("maps every major destination to a unique view type", () => {
    expect(Object.keys(VIEW_TYPE_BY_DESTINATION)).toEqual([
      "home",
      "search",
      "library",
      "organize",
      "memoReview",
      "bookshelf",
      "create",
    ]);
    expect(new Set(Object.values(VIEW_TYPE_BY_DESTINATION)).size).toBe(7);
  });
});
