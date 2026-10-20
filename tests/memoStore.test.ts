import { TFile, type Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
  deleteMemo,
  editMemo,
  saveMemo,
} from "../src/platform/obsidian/memoStore";
import type { MemoEntry } from "../src/shared/memoFile";

const monthPath = "Seiton/Memos/2026-09.md";
const targetMonthPath = "Seiton/Memos/2026-10.md";

function fileForPath(path: string): TFile {
  return Object.assign(new TFile(), { basename: path.split("/").at(-1), path });
}
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
      return fileForPath(path);
    }),
    createFolder: vi.fn(async () => undefined),
    delete: vi.fn(async (file: TFile) => {
      files.delete(file.path);
    }),
    getAbstractFileByPath: vi.fn((path: string) =>
      files.has(path) ? fileForPath(path) : null
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

const monthFile = fileForPath(monthPath);
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

describe("editMemo", () => {
  const movedEntry: MemoEntry = {
    ...entry,
    day: "2026-09-13",
    lineIndex: 2,
  };
  const next = {
    day: "2026-10-02",
    tags: ["updated"],
    text: "Moved memo",
    time: "09:30",
  };
  const options = { memosFolder: "Memos", rootFolder: "Seiton" };

  it("refuses to overwrite a non-memo destination and keeps the source", async () => {
    const { files, vault } = createVaultHarness();
    files.set(targetMonthPath, "User-authored note that is not a memo file");

    await expect(
      editMemo(vault, monthFile, movedEntry, next, options)
    ).rejects.toThrow("移動先の月ファイルを読み取れません");

    expect(files.get(targetMonthPath)).toBe(
      "User-authored note that is not a memo file"
    );
    expect(files.get(monthPath)).toBe(monthContent);
    expect(vault.modify).not.toHaveBeenCalled();
  });

  it("refuses to overwrite a memo file for a different month", async () => {
    const { files, vault } = createVaultHarness();
    files.set(
      targetMonthPath,
      "---\ntype: memo\nmonth: 2026-11\n---\n- 10:00 Keep"
    );

    await expect(
      editMemo(vault, monthFile, movedEntry, next, options)
    ).rejects.toThrow("移動先の月ファイルを読み取れません");

    expect(files.get(targetMonthPath)).toContain("month: 2026-11");
    expect(files.get(monthPath)).toBe(monthContent);
    expect(vault.modify).not.toHaveBeenCalled();
  });

  it("moves a memo to the requested month and removes it only after writing the destination", async () => {
    const { files, vault } = createVaultHarness();

    await editMemo(vault, monthFile, movedEntry, next, options);

    expect(files.get(targetMonthPath)).toContain("- 09:30 Moved memo #updated");
    expect(files.get(monthPath)).not.toContain("Remove this");
  });

  it("preserves a pre-existing identical destination memo as a separate entry", async () => {
    const { files, vault } = createVaultHarness();
    files.set(
      targetMonthPath,
      "---\ntype: memo\nmonth: 2026-10\n---\n## 2026-10-02\n- 09:30 Moved memo #updated"
    );

    await editMemo(vault, monthFile, movedEntry, next, options);

    expect(
      files.get(targetMonthPath)?.match(/- 09:30 Moved memo #updated/g)
    ).toHaveLength(2);
    expect(files.get(monthPath)).not.toContain("Remove this");
  });

  it("does not overwrite concurrent destination edits", async () => {
    const { files, vault } = createVaultHarness();
    files.set(
      targetMonthPath,
      "---\ntype: memo\nmonth: 2026-10\n---\n- 08:00 Keep"
    );
    let targetReads = 0;
    vi.mocked(vault.read).mockImplementation(async (file: TFile) => {
      if (file.path === targetMonthPath) {
        targetReads += 1;
        return targetReads === 1
          ? "---\ntype: memo\nmonth: 2026-10\n---\n- 08:00 Keep"
          : "---\ntype: memo\nmonth: 2026-10\n---\n- 08:00 Concurrent edit";
      }
      return files.get(file.path) ?? "";
    });

    await expect(
      editMemo(vault, monthFile, movedEntry, next, options)
    ).rejects.toThrow("移動先の月ファイルが更新されています");

    expect(files.get(targetMonthPath)).toContain("- 08:00 Keep");
    expect(files.get(monthPath)).toBe(monthContent);
    expect(vault.modify).not.toHaveBeenCalled();
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
