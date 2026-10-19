import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { loadReactProductionData } from "../src/platform/obsidian/productionData";
import { setYamlParser } from "../src/shared/frontmatter";
import {
  organizationContentFingerprint,
  organizationProposalOperationFingerprint,
  organizationProposalResultLine,
  parseOrganizationProposal,
} from "../src/shared/organizationProposal";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import { testParseYaml } from "./helpers/yaml";

const bookFile = {
  name: "Atomic Habits.md",
  path: "Seiton/readings/2024/Atomic Habits.md",
  stat: { mtime: 1 },
} as TFile;

const bookNote = `---
type: reading
status: active
created: "2026-09-02T21:18:12+09:00"
---
<!-- Seiton: book-cover -->
![[Seiton/assets/covers/9780735211292.jpg|220]]

## 感想

習慣を小さく始める考え方を記録した。
`;

const inboxNote = `---
type: task
status: inbox
created: 2026-09-24T10:00:00+09:00
tags: []
lists: []
---
# Plan
`;

const proposalMarker = {
  created: "2026-09-24",
  holds: [
    {
      reason: "用途が分からず、種類を決められないため",
      source: "Seiton/inbox/Unclear reference.md",
    },
  ],
  operations: [
    {
      changes: { status: "active", tags: ["planning"] },
      expected: {
        lists: [],
        status: "inbox",
        tags: [],
        type: "task",
      },
      id: "plan-01",
      reason: "実行する内容が明確なため",
      source: "Seiton/inbox/Plan.md",
    },
  ],
  version: 2,
};

const archiveProposalMarker = {
  ...proposalMarker,
  operations: [
    {
      ...proposalMarker.operations[0],
      changes: { status: "archive", tags: ["planning"] },
    },
  ],
};

setYamlParser((yaml) => {
  if (yaml.includes("seiton-proposal: archive")) {
    return { "seiton-proposal": archiveProposalMarker };
  }
  return yaml.includes("seiton-proposal: test")
    ? { "seiton-proposal": proposalMarker }
    : testParseYaml(yaml);
});

function appWithNote(
  content = bookNote,
  file = bookFile,
  folders: Array<{ path: string }> = []
): App {
  return {
    vault: {
      cachedRead: async () => content,
      getAllFolders: () => folders,
      getMarkdownFiles: () => [file],
    },
  } as unknown as App;
}

function appWithFiles(files: TFile[], contents: Map<string, string>): App {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  return {
    vault: {
      cachedRead: async (file: TFile) => contents.get(file.path) ?? "",
      getAbstractFileByPath: (path: string) => filesByPath.get(path) ?? null,
      getAllFolders: () => [],
      getMarkdownFiles: () => files,
    },
  } as unknown as App;
}

function proposalFile(path: string): TFile {
  return {
    extension: "md",
    name: path.split("/").at(-1) ?? "note.md",
    path,
    stat: { mtime: 3 },
  } as TFile;
}

describe("loadReactProductionData library previews", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    modules: { ...DEFAULT_SETTINGS.modules, bookshelf: false, memos: false },
    search: {
      ...DEFAULT_SETTINGS.search,
      additionalFolders: [],
      includeMemos: false,
    },
  };

  it("skips the managed book-cover marker and empty section heading", async () => {
    const data = await loadReactProductionData(appWithNote(), settings);

    expect(data.library[0]?.summary).toBe(
      "習慣を小さく始める考え方を記録した。"
    );
  });

  it("returns no preview when a note contains only cover markup and headings", async () => {
    const emptyBookNote = bookNote.replace(
      "習慣を小さく始める考え方を記録した。\n",
      ""
    );
    const data = await loadReactProductionData(
      appWithNote(emptyBookNote),
      settings
    );

    expect(data.library[0]?.summary).toBeUndefined();
  });

  it("文脈アーカイブ配下はライブラリに残し、他の通常画面から除外する", async () => {
    const data = await loadReactProductionData(appWithNote(), {
      ...settings,
      archivedFolders: ["Seiton/readings/2024"],
      modules: { ...settings.modules, bookshelf: true },
    });

    expect(data.library[0]?.contextArchived).toBe(true);
    expect(data.libraryFolders).toContain("Seiton/readings");
    expect(data.books).toEqual([]);
    expect(data.search[0]?.status).toBe("archive");
  });

  it("専用アーカイブへ移したフォルダを一覧に残し、通常の本棚から除外する", async () => {
    const archivedFile = {
      ...bookFile,
      path: "Seiton/archive/readings/2024/Atomic Habits.md",
    } as TFile;
    const archivedPath = "Seiton/archive/readings/2024";
    const data = await loadReactProductionData(
      appWithNote(bookNote, archivedFile, [{ path: archivedPath }]),
      {
        ...settings,
        archivedFolders: [archivedPath],
        archiveFolderMoves: [
          {
            archivedPath,
            originalPath: "Seiton/readings/2024",
            type: "reading",
          },
        ],
        modules: { ...settings.modules, bookshelf: true },
      }
    );

    expect(data.library[0]).toMatchObject({
      contextArchived: true,
      path: archivedFile.path,
    });
    expect(data.libraryFolders).toContain(archivedPath);
    expect(data.archiveFolderMoves[0]?.originalPath).toBe(
      "Seiton/readings/2024"
    );
    expect(data.books).toEqual([]);
    expect(data.search[0]?.status).toBe("archive");
  });

  it("整理案Markdownは整理画面に表示し、通常のライブラリ・検索・Vault選択から除外する", async () => {
    const sourceFile = {
      extension: "md",
      name: "Plan.md",
      path: "Seiton/inbox/Plan.md",
      stat: { mtime: 2 },
    } as TFile;
    const proposalNote = {
      extension: "md",
      name: "2026-09-24.md",
      path: "Seiton/整理案/2026-09-24.md",
      stat: { mtime: 3 },
    } as TFile;
    const heldFile = {
      extension: "md",
      name: "Unclear reference.md",
      path: "Seiton/inbox/Unclear reference.md",
      stat: { mtime: 4 },
    } as TFile;
    const files = [sourceFile, proposalNote, heldFile];
    const contentByPath = new Map([
      [sourceFile.path, inboxNote],
      [proposalNote.path, "---\nseiton-proposal: test\n---\n# Inbox cleanup\n"],
      [
        heldFile.path,
        "---\ntype: memo\nstatus: inbox\ntitle: Unclear reference\n---\n",
      ],
    ]);
    const readCounts = new Map<string, number>();
    const app = {
      vault: {
        cachedRead: async (file: TFile) => {
          readCounts.set(file.path, (readCounts.get(file.path) ?? 0) + 1);
          return contentByPath.get(file.path) ?? "";
        },
        getAbstractFileByPath: (path: string) =>
          files.find((file) => file.path === path) ?? null,
        getAllFolders: () => [],
        getMarkdownFiles: () => files,
      },
    } as unknown as App;

    const data = await loadReactProductionData(app, settings);

    expect(data.organize.proposals).toMatchObject([
      {
        path: "Seiton/整理案/2026-09-24.md",
        status: "pending",
        title: "Inbox cleanup",
      },
    ]);
    expect(data.library.map((item) => item.path)).toEqual([sourceFile.path]);
    expect(data.libraryFolders).not.toContain("Seiton/整理案");
    expect(data.search.map((item) => item.path)).toEqual([sourceFile.path]);
    expect(
      data.home.vaultTargets.some((item) => item.path === proposalNote.path)
    ).toBe(false);
    expect(data.organize.proposals[0]?.operations[0]?.matchesExpected).toBe(
      true
    );
    expect(
      data.organize.proposals[0]?.operations[0]?.current?.contentFingerprint
    ).toBe(organizationContentFingerprint(inboxNote));
    expect(data.organize.proposals[0]?.holds[0]).toMatchObject({
      current: { path: heldFile.path, title: "Unclear reference" },
      reason: "用途が分からず、種類を決められないため",
      source: heldFile.path,
    });
    expect(readCounts).toEqual(
      new Map([
        [sourceFile.path, 1],
        [proposalNote.path, 1],
        [heldFile.path, 1],
      ])
    );
  });

  it("アーカイブ提案のプレビューは衝突後の実際の保存先を示す", async () => {
    const source = proposalFile("Seiton/inbox/Plan.md");
    const proposal = proposalFile("Seiton/整理案/2026-09-24.md");
    const collision = proposalFile("Seiton/archive/tasks/notes/inbox/Plan.md");
    const app = appWithFiles(
      [source, proposal, collision],
      new Map([
        [source.path, inboxNote],
        [proposal.path, "---\nseiton-proposal: archive\n---\n# Archive plan\n"],
        [collision.path, inboxNote.replace("status: inbox", "status: archive")],
      ])
    );

    const data = await loadReactProductionData(app, settings);

    expect(data.organize.proposals[0]?.operations[0]?.current).toMatchObject({
      archiveDestination: "Seiton/archive/tasks/notes/inbox/Plan 2.md",
    });
  });

  it("元パスが再利用されてもアーカイブ記録のファイルを提案対象にする", async () => {
    const sourcePath = "Seiton/inbox/Plan.md";
    const archivedPath = "Seiton/archive/tasks/notes/inbox/Plan.md";
    const replacement = proposalFile(sourcePath);
    const archived = proposalFile(archivedPath);
    const proposal = proposalFile("Seiton/整理案/2026-09-24.md");
    const app = appWithFiles(
      [replacement, archived, proposal],
      new Map([
        [sourcePath, inboxNote],
        [archivedPath, inboxNote.replace("status: inbox", "status: archive")],
        [proposal.path, "---\nseiton-proposal: test\n---\n# Inbox cleanup\n"],
      ])
    );
    const data = await loadReactProductionData(app, {
      ...settings,
      archiveNoteMoves: [
        {
          archivedPath,
          originalPath: sourcePath,
          previousStatus: "inbox",
          type: "task",
        },
      ],
    });

    expect(data.organize.proposals[0]?.operations[0]).toMatchObject({
      applied: false,
      current: { path: archivedPath, status: "archive" },
      matchesExpected: false,
    });
  });

  it("適用済みmarkerは現在のノート状態と一致する場合だけ結果として扱う", async () => {
    const source = proposalFile("Seiton/inbox/Plan.md");
    const proposal = proposalFile("Seiton/整理案/2026-09-24.md");
    const proposalText = "---\nseiton-proposal: test\n---\n# Inbox cleanup\n";
    const operation = parseOrganizationProposal(
      proposal.path,
      proposalText,
      settings.rootFolder
    )?.operations[0];
    if (!operation) {
      throw new Error("Expected the parsed proposal operation");
    }
    const forgedMarker = organizationProposalResultLine({
      at: "2026-09-24T00:00:00.000Z",
      fingerprint: organizationProposalOperationFingerprint(operation),
      message: "Applied",
      operationId: operation.id,
      status: "applied",
    });
    const app = appWithFiles(
      [source, proposal],
      new Map([
        [source.path, inboxNote],
        [proposal.path, `${proposalText}\n${forgedMarker}\n`],
      ])
    );

    const data = await loadReactProductionData(app, settings);
    const loaded = data.organize.proposals[0];

    expect(loaded?.status).toBe("pending");
    expect(loaded?.results[operation.id]).toBeUndefined();
    expect(loaded?.operations[0]).toMatchObject({
      applied: false,
      matchesExpected: true,
    });
  });

  it("結果markerがなくても変更済みノートから適用状態を判定する", async () => {
    const source = proposalFile("Seiton/inbox/Plan.md");
    const proposal = proposalFile("Seiton/整理案/2026-09-24.md");
    const appliedSource = inboxNote
      .replace("status: inbox", "status: active")
      .replace("tags: []", "tags: [planning]");
    const app = appWithFiles(
      [source, proposal],
      new Map([
        [source.path, appliedSource],
        [proposal.path, "---\nseiton-proposal: test\n---\n# Inbox cleanup\n"],
      ])
    );

    const data = await loadReactProductionData(app, settings);
    const loaded = data.organize.proposals[0];

    expect(loaded?.status).toBe("applied");
    expect(loaded?.operations[0]?.applied).toBe(true);
    expect(loaded?.results["plan-01"]).toBeUndefined();
  });

  it("読み書き状態と所持状態を本棚データへ正規化する", async () => {
    const bookshelfSettings = {
      ...settings,
      modules: { ...settings.modules, bookshelf: true },
    };
    const data = await loadReactProductionData(
      appWithNote(
        bookNote.replace(
          'created: "2026-09-02T21:18:12+09:00"',
          'created: "2026-09-02T21:18:12+09:00"\nbookOwnership: owned\nreadingStatus: unread'
        )
      ),
      bookshelfSettings
    );

    expect(data.books[0]).toMatchObject({
      ownership: "owned",
      readingStatus: "tbr",
    });
  });
});
