import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { deleteMemo, saveMemo } from "../src/platform/obsidian/memoStore";
import type { MemoEntry } from "../src/shared/memoFile";

const monthPath = "Seiton/Memos/2026-09.md";
const monthContent = [
  "---",
  "type: memo",
  "month: 2026-09",
  "---",
  "## 2026-09-13",
  "- 22:14 Keep this #keep",
  "- 22:15 Remove this #remove",
  "",
].join("\n");

function createVaultHarness() {
  const files = new Map([[monthPath, monthContent]]);
  const vault = {
    create: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
      return { basename: path.split("/").at(-1), path } as TFile;
    }),
    createFolder: vi.fn(async () => undefined),
    delete: vi.fn(async (file: TFile) => {
      files.delete(file.path);
    }),
    getAbstractFileByPath: vi.fn((path: string) =>
      files.has(path) ? { path } : null
    ),
    modify: vi.fn(async (file: TFile, content: string) => {
      files.set(file.path, content);
    }),
    read: vi.fn(async (file: TFile) => {
      const content = files.get(file.path);
      if (content === undefined) {
        throw new Error(`Missing mock file: ${file.path}`);
      }
      return content;
    }),
  } as unknown as Vault;

  return { files, vault };
}

const monthFile = { basename: "2026-09", path: monthPath } as TFile;
const entry: MemoEntry = {
  content: "Remove this",
  day: "2026-09-13",
  lineIndex: 2,
  month: "2026-09",
  tags: ["remove"],
  time: "22:15",
};

describe("saveMemo", () => {
  it("saves selected tags with the quick memo", async () => {
    const { files, vault } = createVaultHarness();

    await saveMemo(
      vault,
      { memosFolder: "Memos", rootFolder: "Seiton" },
      "Tag selection test",
      new Date(2026, 7, 12, 9, 30),
      ["学び", "仕事"]
    );

    expect(files.get("Seiton/Memos/2026-08.md")).toContain(
      "Tag selection test #学び #仕事"
    );
  });
});

describe("deleteMemo", () => {
  it("sends the removed memo to Obsidian trash before editing its month file", async () => {
    const { files, vault } = createVaultHarness();
    let trashedContent = "";
    const trashFile = vi.fn(async (file: TFile) => {
      trashedContent = await vault.read(file);
      await vault.delete(file);
    });

    await deleteMemo(
      vault,
      monthFile,
      entry,
      { memosFolder: "Memos", rootFolder: "Seiton" },
      trashFile
    );

    expect(trashFile).toHaveBeenCalledOnce();
    expect(trashedContent).toContain("month: 2026-09");
    expect(trashedContent).toContain("- 22:15 Remove this #remove");
    expect(files.size).toBe(1);
    expect(files.get(monthPath)).toContain("- 22:14 Keep this #keep");
    expect(files.get(monthPath)).not.toContain("Remove this");
  });

  it("keeps the month file unchanged when Obsidian cannot trash the recovery copy", async () => {
    const { files, vault } = createVaultHarness();
    const trashFile = vi
      .fn<(file: TFile) => Promise<void>>()
      .mockRejectedValue(new Error("Trash unavailable"));

    await expect(
      deleteMemo(
        vault,
        monthFile,
        entry,
        { memosFolder: "Memos", rootFolder: "Seiton" },
        trashFile
      )
    ).rejects.toThrow("Trash unavailable");

    expect(vault.modify).not.toHaveBeenCalled();
    expect(vault.delete).toHaveBeenCalledOnce();
    expect(files.get(monthPath)).toBe(monthContent);
    expect(files.size).toBe(1);
  });
});
