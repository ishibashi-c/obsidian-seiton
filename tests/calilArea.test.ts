import { describe, expect, it } from "vitest";
import { splitCalilArea } from "../src/shared/calil";

describe("splitCalilArea", () => {
  it("都道府県と市区町村を一つの入力から分ける", () => {
    expect(splitCalilArea(" 東京都 千代田区 ")).toEqual({
      city: "千代田区",
      prefecture: "東京都",
    });
  });

  it("都道府県がない入力はAPI用の地域として採用しない", () => {
    expect(splitCalilArea("千代田区")).toEqual({ city: "", prefecture: "" });
  });
});
