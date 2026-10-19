import { describe, expect, it } from "vitest";
import {
  archiveFolderDestination,
  archiveNoteDestination,
  folderForType,
  memoFilePath,
  monthsForPeriod,
  newNoteFolder,
  newNotePath,
  normalizeFolder,
  normalizeSubfolder,
  SubfolderValidationError,
  uniquePath,
} from "../src/shared/paths";
import {
  extractMainDomain,
  safeFilename,
  sanitizeFilename,
} from "../src/shared/sanitize";

describe("sanitizeFilename", () => {
  it("禁止文字を除去", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij");
  });

  it("空になったらフォールバック", () => {
    expect(safeFilename("///")).toBe("Untitled");
    expect(safeFilename("", "無題")).toBe("無題");
  });
});

describe("extractMainDomain", () => {
  it("メインドメインのみ", () => {
    expect(extractMainDomain("https://zenn.dev/articles/1")).toBe("zenn.dev");
    expect(extractMainDomain("https://www.github.com/a")).toBe("github.com");
    expect(extractMainDomain("https://news.yahoo.co.jp/x")).toBe("yahoo.co.jp");
  });

  it("不正URLはnull", () => {
    expect(extractMainDomain("not a url")).toBeNull();
  });
});

describe("paths", () => {
  it.each([
    [new Date(2026, 0, 31), ["2025-12", "2026-01", "2026-02"]],
    [new Date(2026, 11, 31), ["2026-11", "2026-12", "2027-01"]],
    [new Date(2024, 1, 29), ["2024-01", "2024-02", "2024-03"]],
  ])("keeps adjacent months in calendar order for %s", (date, expected) => {
    expect(monthsForPeriod(date)).toEqual(expected);
  });

  it("タイプ別文脈を共通アーカイブ内の同じ相対階層へ割り当てる", () => {
    expect(
      archiveFolderDestination(
        "Seiton",
        "Seiton/classes",
        "Seiton/classes/2024/前期"
      )
    ).toBe("Seiton/archive/classes/2024/前期");
    expect(
      archiveFolderDestination(
        "Research",
        "Research/custom-readings",
        "Research/custom-readings/Series/Volume 1"
      )
    ).toBe("Research/archive/custom-readings/Series/Volume 1");
    expect(() =>
      archiveFolderDestination("Seiton", "Seiton/classes", "Seiton/classes")
    ).toThrow();
  });

  it("ノートをタイプ別アーカイブのnotes領域へ相対階層を保って割り当てる", () => {
    expect(
      archiveNoteDestination(
        "Seiton",
        "Seiton/tasks",
        "Seiton/tasks/進行中/計画.md"
      )
    ).toBe("Seiton/archive/tasks/notes/進行中/計画.md");
    expect(
      archiveNoteDestination("Seiton", "Seiton/tasks", "Seiton/inbox/計画.md")
    ).toBe("Seiton/archive/tasks/notes/inbox/計画.md");
    expect(() =>
      archiveNoteDestination("Seiton", "Seiton/tasks", "Outside/計画.md")
    ).toThrow();
  });

  it("normalizeFolderは両端のスラッシュを除去", () => {
    expect(normalizeFolder("/Seiton/")).toBe("Seiton");
  });

  it("normalizeSubfolderはタイプフォルダ内の階層だけを許可", () => {
    expect(normalizeSubfolder(" /学習テーマ/ 第1回 / ")).toBe(
      "学習テーマ/第1回"
    );

    try {
      normalizeSubfolder("../外部");
      expect.fail("親ディレクトリ参照を拒否する必要があります");
    } catch (cause) {
      expect(cause).toBeInstanceOf(SubfolderValidationError);
      expect(cause).toMatchObject({ reason: "parent-directory" });
    }

    try {
      normalizeSubfolder("<>");
      expect.fail("空になるサブフォルダ名を拒否する必要があります");
    } catch (cause) {
      expect(cause).toBeInstanceOf(SubfolderValidationError);
      expect(cause).toMatchObject({ reason: "invalid-name" });
    }
  });

  it("タイプ別フォルダ（デフォルト）", () => {
    const opts = { memosFolder: "Memos", rootFolder: "Seiton" };
    expect(folderForType(opts, "webclip")).toBe("Seiton/clips");
    expect(folderForType(opts, "collection")).toBe("Seiton/collections");
    expect(folderForType(opts, "memo")).toBe("Seiton/Memos");
  });

  it("タイプ別フォルダ（設定上書き）", () => {
    const opts = {
      memosFolder: "Memos",
      rootFolder: "Seiton",
      typeFolders: { idea: "アイデア" },
    };
    expect(folderForType(opts, "idea")).toBe("Seiton/アイデア");
  });

  it("uniquePathは連番を振る", () => {
    const exists = (p: string): boolean =>
      p === "Seiton/clips/x.md" || p === "Seiton/clips/x 2.md";
    expect(uniquePath(exists, "Seiton/clips/x.md")).toBe("Seiton/clips/x 3.md");
    expect(uniquePath(() => false, "Seiton/clips/x.md")).toBe(
      "Seiton/clips/x.md"
    );
  });

  it("newNotePathはサニタイズ+連番", () => {
    const opts = {
      memosFolder: "Memos",
      rootFolder: "Seiton",
      title: "a/b",
      type: "idea" as const,
    };
    expect(newNotePath(() => false, opts)).toBe("Seiton/ideas/ab.md");
  });

  it("newNoteFolderとnewNotePathはサブフォルダをタイプフォルダ配下に置く", () => {
    const opts = {
      memosFolder: "Memos",
      rootFolder: "Seiton",
      subfolder: "学習テーマ",
      title: "第1回ノート",
      type: "class" as const,
    };
    expect(newNoteFolder(opts, opts.type, opts.subfolder)).toBe(
      "Seiton/classes/学習テーマ"
    );
    expect(newNotePath(() => false, opts)).toBe(
      "Seiton/classes/学習テーマ/第1回ノート.md"
    );
  });

  it("月ファイルパス", () => {
    expect(memoFilePath("Seiton", "Memos", "2026-08")).toBe(
      "Seiton/Memos/2026-08.md"
    );
  });
});
