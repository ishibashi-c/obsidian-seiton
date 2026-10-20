import { describe, expect, it } from "vitest";
import { normalizeShortcut } from "../src/platform/obsidian/productionAdapter";

describe("home shortcut URL boundary", () => {
  const shortcut = (target: string) => ({
    id: "shortcut",
    initial: "S",
    kind: "url" as const,
    target,
    title: "Shortcut",
  });

  it.each(["javascript:alert(1)", "file:///private.txt", "data:text/html,hi"])(
    "rejects unsafe URL scheme %s",
    (target) => {
      expect(normalizeShortcut(shortcut(target))).toBeNull();
    }
  );

  it("normalizes bare hostnames and retains web URLs", () => {
    expect(normalizeShortcut(shortcut("example.com"))?.target).toBe(
      "https://example.com"
    );
    expect(normalizeShortcut(shortcut("http://example.com"))?.target).toBe(
      "http://example.com"
    );
  });
});
