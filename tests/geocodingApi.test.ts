import { describe, expect, it } from "vitest";
import { parseAddressSearchResults } from "../src/platform/obsidian/geocodingApi";

describe("parseAddressSearchResults", () => {
  it("国土地理院APIのGeoJSONから住所と座標を抽出する", () => {
    expect(
      parseAddressSearchResults([
        {
          geometry: { coordinates: [139.691_706, 35.689_487] },
          properties: { title: "東京都千代田区" },
        },
      ])
    ).toEqual([
      {
        address: "東京都千代田区",
        latitude: 35.689_487,
        longitude: 139.691_706,
      },
    ]);
  });

  it("不正な候補と重複候補を除外する", () => {
    expect(
      parseAddressSearchResults([
        {
          geometry: { coordinates: [130.4, 33.5] },
          properties: { title: "同じ住所" },
        },
        {
          geometry: { coordinates: [130.4, 33.5] },
          properties: { title: "同じ住所" },
        },
        {
          geometry: { coordinates: [181, 33.5] },
          properties: { title: "範囲外" },
        },
      ])
    ).toHaveLength(1);
    expect(parseAddressSearchResults({})).toEqual([]);
  });
});
