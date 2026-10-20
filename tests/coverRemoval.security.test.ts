import { type App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { removeCachedCover } from "../src/platform/obsidian/bookStore";
import { parseFrontmatter } from "../src/shared/frontmatter";

function fixture(path: string, resolved = path) {
  const note = new TFile();
  note.path = "Seiton/readings/Book.md";
  const cover = new TFile();
  cover.path = resolved;
  let content = `---\ntype: reading\nstatus: active\ncreated: "2026-01-01"\nbookIsbn: "9780000000000"\nbookCover: "${path}"\ncustom: preserved\n---\n<!-- Seiton: book-cover -->\n![[${path}|220]]\nBody stays.\n`;
  const trashFile = vi.fn(async () => undefined);
  const lookup = vi.fn((candidate: string) =>
    candidate === path ? cover : null
  );
  const app = {
    fileManager: { trashFile },
    vault: {
      cachedRead: async () => content,
      getAbstractFileByPath: lookup,
      modify: async (_file: TFile, next: string) => {
        content = next;
      },
      read: async () => content,
    },
  } as unknown as App;
  return { app, content: () => content, lookup, note, trashFile };
}

describe("cover removal security boundary", () => {
  it.each([
    "Private.md",
    "Attachments/custom.jpg",
    "Seiton/assets/covers/note.md",
    "Seiton/assets/covers/../../Private.jpg",
    "Seiton/assets/covers/./x.jpg",
    "Seiton/assets/covers//x.jpg",
    "Seiton/assets/covers-sibling/x.jpg",
    "Seiton/assets/covers/..\\Private.jpg",
    "/Seiton/assets/covers/x.jpg",
  ])("detaches %s without trashing it", async (path) => {
    const f = fixture(path);
    await removeCachedCover(f.app, f.note);
    expect(f.trashFile).not.toHaveBeenCalled();
    expect(parseFrontmatter(f.content())?.data.custom).toBe("preserved");
    expect(f.content()).toContain("Body stays.");
    expect(f.content()).not.toContain("<!-- Seiton: book-cover -->");
  });
  it.each(["Seiton/assets/covers/123.jpg", ".seiton/covers/123.webp"])(
    "trashes managed image %s",
    async (path) => {
      const f = fixture(path);
      await removeCachedCover(f.app, f.note);
      expect(f.trashFile).toHaveBeenCalledOnce();
      expect(f.content()).not.toContain("<!-- Seiton: book-cover -->");
      expect(f.lookup).not.toHaveBeenCalledWith(
        ".seiton/covers/9780000000000.jpg"
      );
    }
  );
  it("does not trash a resolved file outside the managed roots", async () => {
    const f = fixture("Seiton/assets/covers/x.jpg", "Private.jpg");
    await removeCachedCover(f.app, f.note);
    expect(f.trashFile).not.toHaveBeenCalled();
  });
  it("does not clear a reference if trash fails", async () => {
    const f = fixture("Seiton/assets/covers/x.png");
    f.trashFile.mockRejectedValueOnce(new Error("trash failed"));
    await expect(removeCachedCover(f.app, f.note)).rejects.toThrow(
      "trash failed"
    );
    expect(f.content()).toContain("<!-- Seiton: book-cover -->");
  });
});
