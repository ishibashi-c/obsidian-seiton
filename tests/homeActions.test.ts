import { TFile, TFolder } from "obsidian";
import { describe, expect, it } from "vitest";
import {
  applyOrganization,
  archiveLibraryFolder,
  archiveLibraryItem,
  changeItemType,
  createLibraryFolder,
  moveLibraryItem,
  openItem,
  renameLibraryFolder,
  restoreLibraryFolder,
  restoreLibraryItem,
  rewriteSettingsPaths,
  setItemPinned,
  setLibraryFolderArchived,
} from "../src/platform/obsidian/homeActions";
import { parseFrontmatter } from "../src/shared/frontmatter";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

function fakeFolder(path: string): TFolder {
  const folder = new TFolder();
  Object.defineProperty(folder, "path", {
    configurable: true,
    value: path,
    writable: true,
  });
  return folder;
}

function createFakeApp(initialPath: string, initialContent: string) {
  let content = initialContent;
  const file = {
    name: initialPath.split("/").at(-1) ?? "note.md",
    parent: { path: initialPath.split("/").slice(0, -1).join("/") },
    path: initialPath,
  };
  const entries = new Map<string, unknown>([[initialPath, file]]);
  const vault = {
    createFolder: async (path: string) => {
      entries.set(path, { path });
    },
    getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
    modify: async (_file: unknown, next: string) => {
      content = next;
    },
    read: async () => content,
  };
  const app = {
    fileManager: {
      renameFile: async (target: typeof file, destination: string) => {
        entries.delete(target.path);
        target.path = destination;
        target.parent = { path: destination.split("/").slice(0, -1).join("/") };
        entries.set(destination, target);
      },
    },
    vault,
  };
  return { app, entries, file, getContent: () => content };
}

function createFakeNoteApp(initialPath: string, initialContent: string) {
  let content = initialContent;
  const file = Object.assign(new TFile(), {
    extension: "md",
    name: initialPath.split("/").at(-1) ?? "note.md",
    parent: fakeFolder(initialPath.split("/").slice(0, -1).join("/")),
    path: initialPath,
  });
  const entries = new Map<string, unknown>([[initialPath, file]]);
  const vault = {
    createFolder: async (path: string) => {
      entries.set(path, fakeFolder(path));
    },
    getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
    modify: async (_file: unknown, next: string) => {
      content = next;
    },
    read: async () => content,
  };
  const app = {
    fileManager: {
      renameFile: async (target: typeof file, destination: string) => {
        entries.delete(target.path);
        target.path = destination;
        target.name = destination.split("/").at(-1) ?? target.name;
        target.parent = fakeFolder(
          destination.split("/").slice(0, -1).join("/")
        );
        entries.set(destination, target);
      },
    },
    vault,
  };
  return { app, entries, file, getContent: () => content };
}

function createFakeFolderApp(folderPath: string) {
  const folder = fakeFolder(folderPath);
  const note = {
    extension: "md",
    name: "第1回.md",
    parent: { path: folderPath },
    path: `${folderPath}/第1回.md`,
  };
  const entries = new Map<string, unknown>([
    [folderPath, folder],
    [note.path, note],
  ]);
  const vault = {
    createFolder: async (path: string) => {
      if (entries.has(path)) {
        throw new Error("Folder already exists");
      }
      entries.set(path, fakeFolder(path));
    },
    getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
  };
  const app = {
    fileManager: {
      renameFile: async (target: { path: string }, destination: string) => {
        const previous = target.path;
        const affected = [...entries.entries()].filter(
          ([path]) => path === previous || path.startsWith(`${previous}/`)
        );
        for (const [path] of affected) {
          entries.delete(path);
        }
        for (const [path, entry] of affected) {
          const nextPath = `${destination}${path.slice(previous.length)}`;
          if (entry instanceof TFolder) {
            entry.path = nextPath;
          } else if (entry && typeof entry === "object") {
            const file = entry as typeof note;
            file.path = nextPath;
            file.name = nextPath.split("/").at(-1) ?? file.name;
            file.parent = { path: nextPath.split("/").slice(0, -1).join("/") };
          }
          entries.set(nextPath, entry);
        }
      },
    },
    vault,
  };
  return { app, entries, folder, note };
}

const NOTE = `---
type: task
tags: []
lists: []
status: inbox
created: 2026-08-30T10:00:00
customKey: keep-me
---
本文です。
`;

describe("home actions", () => {
  it("Vault内のノート移動に合わせて保存済みパス参照を更新する", () => {
    const previousPath = "Seiton/readings/未分類/本.md";
    const nextPath = "Seiton/readings/実用・ビジネス/本.md";
    const settings = {
      ...DEFAULT_SETTINGS,
      archiveNoteMoves: [
        {
          archivedPath: "Seiton/archive/readings/本.md",
          originalPath: previousPath,
          previousStatus: "active" as const,
          type: "reading" as const,
        },
      ],
      pinned: [previousPath],
      shortcuts: [
        { group: "", kind: "note" as const, target: previousPath, title: "本" },
      ],
    };

    const changed = rewriteSettingsPaths(
      settings,
      previousPath,
      nextPath,
      false
    );

    expect(changed).toBe(true);
    expect(settings.archiveNoteMoves[0]?.originalPath).toBe(nextPath);
    expect(settings.pinned).toEqual([nextPath]);
    expect(settings.shortcuts[0]?.target).toBe(nextPath);
  });

  it("ピン留めを設定へ保存し、frontmatterには書き込まない", async () => {
    const settings = { ...DEFAULT_SETTINGS, pinned: [] };
    const saves: number[] = [];
    const saveSettings = async (): Promise<void> => {
      saves.push(settings.pinned.length);
    };

    await setItemPinned(settings, "Seiton/ideas/設計.md", true, saveSettings);
    expect(settings.pinned).toEqual(["Seiton/ideas/設計.md"]);
    expect(saves).toEqual([1]);

    await setItemPinned(settings, "Seiton/ideas/設計.md", false, saveSettings);
    expect(settings.pinned).toEqual([]);
    expect(saves).toEqual([1, 0]);
  });

  it("ノートを専用アーカイブへ移動し、frontmatterと参照を復元できる", async () => {
    const source = "Seiton/tasks/進行中/計画.md";
    const fake = createFakeNoteApp(
      source,
      NOTE.replace("status: inbox", "status: active")
    );
    const settings = {
      ...DEFAULT_SETTINGS,
      archiveNoteMoves: [] as typeof DEFAULT_SETTINGS.archiveNoteMoves,
      pinned: [source],
      shortcuts: [
        { group: "", kind: "note" as const, target: source, title: "計画" },
      ],
    };
    const saves: string[][] = [];
    const saveSettings = async (): Promise<void> => {
      saves.push(
        settings.archiveNoteMoves.map((archiveMove) => archiveMove.archivedPath)
      );
    };

    const move = await archiveLibraryItem(
      fake.app as never,
      settings,
      source,
      saveSettings
    );

    expect(move).toEqual({
      archivedPath: "Seiton/archive/tasks/notes/進行中/計画.md",
      originalPath: source,
      previousStatus: "active",
      type: "task",
    });
    expect(fake.file.path).toBe(move.archivedPath);
    expect(parseFrontmatter(fake.getContent())?.data).toMatchObject({
      customKey: "keep-me",
      status: "archive",
      type: "task",
    });
    expect(fake.getContent()).toContain("本文です。");
    expect(settings.pinned).toEqual([move.archivedPath]);
    expect(settings.shortcuts[0]?.target).toBe(move.archivedPath);

    await restoreLibraryItem(
      fake.app as never,
      settings,
      move.archivedPath,
      saveSettings
    );

    expect(fake.file.path).toBe(source);
    expect(parseFrontmatter(fake.getContent())?.data.status).toBe("active");
    expect(settings.archiveNoteMoves).toEqual([]);
    expect(settings.pinned).toEqual([source]);
    expect(settings.shortcuts[0]?.target).toBe(source);
    expect(saves).toEqual([[move.archivedPath], []]);
  });

  it("ノートアーカイブの設定保存に失敗したら移動とfrontmatterを戻す", async () => {
    const source = "Seiton/tasks/計画.md";
    const fake = createFakeNoteApp(
      source,
      NOTE.replace("status: inbox", "status: active")
    );
    const settings = { ...DEFAULT_SETTINGS, archiveNoteMoves: [] };

    await expect(
      archiveLibraryItem(fake.app as never, settings, source, async () => {
        throw new Error("settings write failed");
      })
    ).rejects.toThrow("settings write failed");

    expect(fake.file.path).toBe(source);
    expect(fake.getContent()).toBe(
      NOTE.replace("status: inbox", "status: active")
    );
    expect(settings.archiveNoteMoves).toEqual([]);
  });

  it("復元先に同名ファイルがある場合はアーカイブを維持する", async () => {
    const source = "Seiton/tasks/計画.md";
    const fake = createFakeNoteApp(
      source,
      NOTE.replace("status: inbox", "status: active")
    );
    const settings = { ...DEFAULT_SETTINGS, archiveNoteMoves: [] };
    const move = await archiveLibraryItem(
      fake.app as never,
      settings,
      source,
      async () => {}
    );
    fake.entries.set(source, Object.assign(new TFile(), { path: source }));

    await expect(
      restoreLibraryItem(
        fake.app as never,
        settings,
        move.archivedPath,
        async () => {}
      )
    ).rejects.toThrow("元の場所に同じ名前のファイルまたはフォルダがあります");
    expect(fake.file.path).toBe(move.archivedPath);
    expect(settings.archiveNoteMoves).toEqual([move]);
  });

  it("アーカイブ済みノートの移動・タイプ変更・整理を復元前に拒否する", async () => {
    const source = "Seiton/tasks/計画.md";
    const fake = createFakeNoteApp(
      source,
      NOTE.replace("status: inbox", "status: active")
    );
    const settings = { ...DEFAULT_SETTINGS, archiveNoteMoves: [] };
    const move = await archiveLibraryItem(
      fake.app as never,
      settings,
      source,
      async () => {}
    );

    await expect(
      moveLibraryItem(
        fake.app as never,
        settings,
        move.archivedPath,
        "Seiton/tasks/進行中",
        async () => {}
      )
    ).rejects.toThrow("復元してから変更してください");
    await expect(
      changeItemType(fake.app as never, fake.file, "reading", settings)
    ).rejects.toThrow("復元してから変更してください");
    await expect(
      applyOrganization(
        fake.app as never,
        fake.file,
        {
          lists: [],
          status: "active",
          tags: [],
          type: "task",
          typeChanged: false,
        },
        settings,
        async () => {}
      )
    ).rejects.toThrow("復元してから変更してください");

    expect(fake.file.path).toBe(move.archivedPath);
    expect(settings.archiveNoteMoves).toEqual([move]);
  });

  it("設定保存が失敗しても復元済みファイルとmove記録を整合させる", async () => {
    const source = "Seiton/tasks/計画.md";
    const fake = createFakeNoteApp(
      source,
      NOTE.replace("status: inbox", "status: active")
    );
    const settings = {
      ...DEFAULT_SETTINGS,
      archiveNoteMoves: [] as typeof DEFAULT_SETTINGS.archiveNoteMoves,
      pinned: [source],
      shortcuts: [
        { group: "", kind: "note" as const, target: source, title: "計画" },
      ],
    };
    const move = await archiveLibraryItem(
      fake.app as never,
      settings,
      source,
      async () => {}
    );
    let restoreSaves = 0;
    const renameTargets: string[] = [];
    const renameFile = fake.app.fileManager.renameFile;
    fake.app.fileManager.renameFile = async (file, destination) => {
      renameTargets.push(destination);
      await renameFile(file, destination);
    };

    await expect(
      restoreLibraryItem(
        fake.app as never,
        settings,
        move.archivedPath,
        async () => {
          restoreSaves += 1;
          throw new Error("settings write failed");
        }
      )
    ).rejects.toThrow("復元済みですが、設定の保存に失敗しました");

    expect(renameTargets).toEqual([source]);
    expect(fake.file.path).toBe(source);
    expect(parseFrontmatter(fake.getContent())?.data.status).toBe("active");
    expect(settings.archiveNoteMoves).toEqual([]);
    expect(settings.pinned).toEqual([source]);
    expect(settings.shortcuts[0]?.target).toBe(source);
    expect(restoreSaves).toBe(2);
  });

  it("文脈フォルダをアーカイブ・復元し、ノートの状態は書き換えない", async () => {
    const settings = { ...DEFAULT_SETTINGS, archivedFolders: [] as string[] };
    const saves: string[][] = [];
    const saveSettings = async (): Promise<void> => {
      saves.push([...settings.archivedFolders]);
    };

    await setLibraryFolderArchived(
      settings,
      "Seiton/classes/2024年度",
      true,
      saveSettings
    );
    await setLibraryFolderArchived(
      settings,
      "Seiton/classes/2024年度",
      false,
      saveSettings
    );

    expect(settings.archivedFolders).toEqual([]);
    expect(saves).toEqual([["Seiton/classes/2024年度"], []]);
  });

  it("専用アーカイブへフォルダを移し、復元先と参照パスを往復させる", async () => {
    const source = "Seiton/classes/2024年度";
    const fake = createFakeFolderApp(source);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
      archiveFolderMoves: [],
      pinned: [`${source}/第1回.md`],
      richCardFolders: [source],
      search: {
        ...DEFAULT_SETTINGS.search,
        additionalFolders: [source],
      },
      shortcuts: [
        {
          group: "授業",
          kind: "folder" as const,
          target: source,
          title: "2024年度",
        },
      ],
    };
    const saves: string[][] = [];
    const saveSettings = async (): Promise<void> => {
      saves.push([...settings.archivedFolders]);
    };

    const move = await archiveLibraryFolder(
      fake.app as never,
      settings,
      source,
      saveSettings
    );

    expect(move).toEqual({
      archivedPath: "Seiton/archive/classes/2024年度",
      originalPath: source,
      type: "class",
    });
    expect(fake.folder.path).toBe(move.archivedPath);
    expect(fake.note.path).toBe(`${move.archivedPath}/第1回.md`);
    expect(settings.archivedFolders).toEqual([move.archivedPath]);
    expect(settings.pinned).toEqual([`${move.archivedPath}/第1回.md`]);
    expect(settings.richCardFolders).toEqual([move.archivedPath]);
    expect(settings.search.additionalFolders).toEqual([move.archivedPath]);
    expect(settings.shortcuts[0]?.target).toBe(move.archivedPath);

    await restoreLibraryFolder(
      fake.app as never,
      settings,
      move.archivedPath,
      saveSettings
    );

    expect(fake.folder.path).toBe(source);
    expect(fake.note.path).toBe(`${source}/第1回.md`);
    expect(settings.archiveFolderMoves).toEqual([]);
    expect(settings.archivedFolders).toEqual([]);
    expect(settings.pinned).toEqual([`${source}/第1回.md`]);
    expect(settings.richCardFolders).toEqual([source]);
    expect(settings.search.additionalFolders).toEqual([source]);
    expect(settings.shortcuts[0]?.target).toBe(source);
    expect(saves).toEqual([[move.archivedPath], []]);
  });

  it("アーカイブ先との衝突を拒否し、設定保存失敗時は移動を戻す", async () => {
    const source = "Seiton/projects/終了";
    const fake = createFakeFolderApp(source);
    const destination = "Seiton/archive/projects/終了";
    fake.entries.set(destination, fakeFolder(destination));
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
      archiveFolderMoves: [],
    };

    await expect(
      archiveLibraryFolder(fake.app as never, settings, source, async () => {})
    ).rejects.toThrow("アーカイブ先に同じフォルダが既にあります");
    fake.entries.delete(destination);

    await expect(
      archiveLibraryFolder(fake.app as never, settings, source, async () => {
        throw new Error("settings write failed");
      })
    ).rejects.toThrow("settings write failed");
    expect(fake.folder.path).toBe(source);
    expect(fake.note.path).toBe(`${source}/第1回.md`);
    expect(settings.archiveFolderMoves).toEqual([]);
    expect(settings.archivedFolders).toEqual([]);
  });

  it("復元先に同名フォルダがある場合は何も上書きしない", async () => {
    const source = "Seiton/classes/2023年度";
    const fake = createFakeFolderApp(source);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
      archiveFolderMoves: [],
    };
    const move = await archiveLibraryFolder(
      fake.app as never,
      settings,
      source,
      async () => {}
    );
    fake.entries.set(source, fakeFolder(source));

    await expect(
      restoreLibraryFolder(
        fake.app as never,
        settings,
        move.archivedPath,
        async () => {}
      )
    ).rejects.toThrow("元の場所に同じ名前のファイルまたはフォルダがあります");
    expect(fake.folder.path).toBe(move.archivedPath);
    expect(settings.archiveFolderMoves).toEqual([move]);
  });

  it("保存先設定の変更後も記録済みの元フォルダへ復元する", async () => {
    const source = "Seiton/classes/2023年度";
    const fake = createFakeFolderApp(source);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
      archiveFolderMoves: [],
    };
    const move = await archiveLibraryFolder(
      fake.app as never,
      settings,
      source,
      async () => {}
    );
    settings.rootFolder = "NewRoot";
    settings.typeFolders = { ...settings.typeFolders, class: "courses" };

    await restoreLibraryFolder(
      fake.app as never,
      settings,
      move.archivedPath,
      async () => {}
    );

    expect(fake.folder.path).toBe(source);
    expect(settings.archiveFolderMoves).toEqual([]);
  });

  it("元の親フォルダがなくてもアーカイブを復元する", async () => {
    const source = "Seiton/classes/2023年度";
    const fake = createFakeFolderApp(source);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
      archiveFolderMoves: [],
    };
    const move = await archiveLibraryFolder(
      fake.app as never,
      settings,
      source,
      async () => {}
    );
    fake.entries.delete("Seiton/classes");

    await restoreLibraryFolder(
      fake.app as never,
      settings,
      move.archivedPath,
      async () => {}
    );

    expect(fake.entries.has("Seiton/classes")).toBe(true);
    expect(fake.folder.path).toBe(source);
  });

  it("ライブラリからタイプ別フォルダ内にフォルダを作成する", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);
    const path = await createLibraryFolder(
      fake.app as never,
      DEFAULT_SETTINGS,
      "Seiton/tasks",
      "進行中"
    );
    expect(path).toBe("Seiton/tasks/進行中");
    expect(fake.entries.has(path)).toBe(true);
  });

  it("タイプ別ルートの外ではフォルダを作成できない", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);

    await expect(
      createLibraryFolder(
        fake.app as never,
        DEFAULT_SETTINGS,
        "Seiton/inbox",
        "別タイプ"
      )
    ).rejects.toThrow("タイプの保存先フォルダ内でフォルダを作成してください");
  });

  it("フォルダ名を変更し、参照している設定パスも追従させる", async () => {
    const folder = new TFolder();
    Object.defineProperty(folder, "path", {
      configurable: true,
      value: "Seiton/tasks/2024年度",
    });
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: ["Seiton/tasks/2024年度/春期"],
      pinned: ["Seiton/tasks/2024年度/春期/計画.md"],
      richCardFolders: ["Seiton/tasks/2024年度"],
      search: {
        ...DEFAULT_SETTINGS.search,
        additionalFolders: ["Seiton/tasks/2024年度/春期"],
      },
      shortcuts: [
        {
          group: "保存先",
          kind: "folder" as const,
          target: "Seiton/tasks/2024年度/春期",
          title: "春期",
        },
      ],
    };
    const saves: string[] = [];
    const app = {
      fileManager: {
        renameFile: async (target: TFolder, destinationPath: string) => {
          expect(target).toBe(folder);
          folder.path = destinationPath;
        },
      },
      vault: {
        getAbstractFileByPath: (path: string) =>
          path === "Seiton/tasks/2024年度" ? folder : null,
      },
    };

    const nextPath = await renameLibraryFolder(
      app as never,
      settings,
      folder.path,
      "進行中",
      async (): Promise<void> => {
        saves.push(folder.path);
      }
    );

    expect(nextPath).toBe("Seiton/tasks/進行中");
    expect(settings.archivedFolders).toEqual(["Seiton/tasks/進行中/春期"]);
    expect(settings.pinned).toEqual(["Seiton/tasks/進行中/春期/計画.md"]);
    expect(settings.richCardFolders).toEqual(["Seiton/tasks/進行中"]);
    expect(settings.search.additionalFolders).toEqual([
      "Seiton/tasks/進行中/春期",
    ]);
    expect(settings.shortcuts[0]?.target).toBe("Seiton/tasks/進行中/春期");
    expect(saves).toEqual(["Seiton/tasks/進行中"]);
  });

  it("設定保存に失敗したフォルダ名変更を元に戻す", async () => {
    const fake = createFakeFolderApp("Seiton/tasks/2024年度");
    const settings = {
      ...DEFAULT_SETTINGS,
      pinned: ["Seiton/tasks/2024年度/第1回.md"],
    };

    await expect(
      renameLibraryFolder(
        fake.app as never,
        settings,
        fake.folder.path,
        "進行中",
        async () => {
          throw new Error("settings write failed");
        }
      )
    ).rejects.toThrow("settings write failed");

    expect(fake.folder.path).toBe("Seiton/tasks/2024年度");
    expect(settings.pinned).toEqual(["Seiton/tasks/2024年度/第1回.md"]);
    expect(fake.entries.has("Seiton/tasks/進行中")).toBe(false);
  });

  it("ライブラリからノートを同じタイプの文脈へ移し、ピン留めパスを追従させる", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);
    Object.assign(fake.file, { extension: "md" });
    const settings = {
      ...DEFAULT_SETTINGS,
      pinned: ["Seiton/tasks/計画.md"],
    };
    const saves: string[][] = [];
    const nextPath = await moveLibraryItem(
      fake.app as never,
      settings,
      fake.file.path,
      "Seiton/tasks/進行中",
      async (): Promise<void> => {
        saves.push([...settings.pinned]);
      }
    );

    expect(nextPath).toBe("Seiton/tasks/進行中/計画.md");
    expect(fake.file.path).toBe(nextPath);
    expect(settings.pinned).toEqual([nextPath]);
    expect(saves).toEqual([[nextPath]]);
    expect(parseFrontmatter(fake.getContent())?.data.type).toBe("task");
  });

  it("設定保存に失敗したノート移動を元に戻す", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);
    Object.assign(fake.file, { extension: "md" });
    const settings = {
      ...DEFAULT_SETTINGS,
      pinned: ["Seiton/tasks/計画.md"],
    };

    await expect(
      moveLibraryItem(
        fake.app as never,
        settings,
        fake.file.path,
        "Seiton/tasks/進行中",
        async () => {
          throw new Error("settings write failed");
        }
      )
    ).rejects.toThrow("settings write failed");

    expect(fake.file.path).toBe("Seiton/tasks/計画.md");
    expect(settings.pinned).toEqual(["Seiton/tasks/計画.md"]);
    expect(fake.entries.has("Seiton/tasks/進行中/計画.md")).toBe(false);
  });

  it("別タイプやアーカイブ済みの保存先への移動を拒否する", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);
    Object.assign(fake.file, { extension: "md" });
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: ["Seiton/tasks/終了"],
    };
    const saveSettings = async (): Promise<void> => {};

    await expect(
      moveLibraryItem(
        fake.app as never,
        settings,
        fake.file.path,
        "Seiton/clips",
        saveSettings
      )
    ).rejects.toThrow(
      "移動先は現在のタイプの未アーカイブフォルダにしてください"
    );
    await expect(
      moveLibraryItem(
        fake.app as never,
        settings,
        fake.file.path,
        "Seiton/tasks/終了",
        saveSettings
      )
    ).rejects.toThrow(
      "移動先は現在のタイプの未アーカイブフォルダにしてください"
    );
    expect(fake.file.path).toBe("Seiton/tasks/計画.md");
  });

  it("再利用するleafで開いた項目を開いてからそのタブへ切り替える", async () => {
    const file = {
      extension: "md",
      name: "本.md",
      path: "Seiton/readings/本.md",
    };
    const events: string[] = [];
    const targetLeaf = {
      openFile: async () => {
        events.push("open-start");
        await Promise.resolve();
        events.push("open-end");
      },
    };
    const app = {
      vault: {
        getAbstractFileByPath: () => file,
      },
      workspace: {
        revealLeaf: (leaf: unknown) => {
          expect(leaf).toBe(targetLeaf);
          events.push("reveal");
        },
      },
    };

    await openItem(app as never, file.path, targetLeaf as never);

    expect(events).toEqual(["open-start", "open-end", "reveal"]);
  });

  it("タイプ変更後に実際の移動先パスを返す", async () => {
    const fake = createFakeApp("Seiton/tasks/計画.md", NOTE);

    const nextPath = await changeItemType(
      fake.app as never,
      fake.file as never,
      "reading",
      { ...DEFAULT_SETTINGS, memosFolder: "Memos", rootFolder: "Seiton" }
    );

    expect(nextPath).toBe("Seiton/readings/計画.md");
    expect(fake.file.path).toBe(nextPath);
    expect(fake.entries.has(nextPath)).toBe(true);
    expect(parseFrontmatter(fake.getContent())?.data.type).toBe("reading");
  });

  it("未整理項目のタイプを変更するとタイプ別フォルダへ移動する", async () => {
    const fake = createFakeApp("Seiton/inbox/メモ.md", NOTE);

    await applyOrganization(
      fake.app as never,
      fake.file as never,
      {
        lists: [],
        status: "active",
        tags: [],
        type: "reading",
        typeChanged: true,
      },
      { ...DEFAULT_SETTINGS, memosFolder: "Memos", rootFolder: "Seiton" },
      async () => {}
    );

    expect(fake.file.path).toBe("Seiton/readings/メモ.md");
    expect(parseFrontmatter(fake.getContent())?.data.type).toBe("reading");
  });

  it("タグ中心の整理ではタイプ別フォルダへ移動しない", async () => {
    const fake = createFakeApp("Seiton/inbox/メモ.md", NOTE);

    await applyOrganization(
      fake.app as never,
      fake.file as never,
      {
        lists: [],
        status: "active",
        tags: ["学び"],
        type: "reading",
        typeChanged: false,
      },
      { ...DEFAULT_SETTINGS, memosFolder: "Memos", rootFolder: "Seiton" },
      async () => {}
    );

    expect(fake.file.path).toBe("Seiton/inbox/メモ.md");
    expect(parseFrontmatter(fake.getContent())?.data.tags).toEqual(["学び"]);
    expect(parseFrontmatter(fake.getContent())?.data.type).toBe("task");
  });

  it("保存先プリセットを選ぶとサブフォルダへ移動し既定タグを追加する", async () => {
    const clip = `---
type: webclip
tags: []
lists: []
status: inbox
created: 2026-08-30T10:00:00
source: https://example.com/baseball
customKey: keep-me
---
野球の記事です。
`;
    const fake = createFakeApp("Seiton/inbox/野球の記事.md", clip);

    await applyOrganization(
      fake.app as never,
      fake.file as never,
      {
        destination: {
          subfolder: "スポーツ",
          tags: ["スポーツ"],
          type: "webclip",
        },
        lists: [],
        status: "active",
        tags: ["野球"],
        type: "webclip",
        typeChanged: false,
      },
      { ...DEFAULT_SETTINGS, memosFolder: "Memos", rootFolder: "Seiton" },
      async () => {}
    );

    expect(fake.file.path).toBe("Seiton/clips/スポーツ/野球の記事.md");
    expect(fake.entries.has(fake.file.path)).toBe(true);
    expect(parseFrontmatter(fake.getContent())?.data).toMatchObject({
      customKey: "keep-me",
      status: "active",
      tags: ["スポーツ", "野球"],
      type: "webclip",
    });
  });

  it("タイプと異なる保存先プリセットは保存前に拒否する", async () => {
    const fake = createFakeApp("Seiton/inbox/メモ.md", NOTE);

    await expect(
      applyOrganization(
        fake.app as never,
        fake.file as never,
        {
          destination: {
            subfolder: "スポーツ",
            tags: ["スポーツ"],
            type: "webclip",
          },
          lists: [],
          status: "active",
          tags: ["学び"],
          type: "reading",
          typeChanged: true,
        },
        { ...DEFAULT_SETTINGS, memosFolder: "Memos", rootFolder: "Seiton" },
        async () => {}
      )
    ).rejects.toThrow("保存先プリセットとタイプが一致しません");
    expect(fake.file.path).toBe("Seiton/inbox/メモ.md");
    expect(parseFrontmatter(fake.getContent())?.data.status).toBe("inbox");
  });

  it("整理画面からピン留めノートを移動してもピンとショートカットを保つ", async () => {
    const fake = createFakeApp("Seiton/inbox/計画.md", NOTE);
    const settings = {
      ...DEFAULT_SETTINGS,
      pinned: ["Seiton/inbox/計画.md"],
      shortcuts: [
        {
          group: "よく使う",
          kind: "note" as const,
          target: "Seiton/inbox/計画.md",
          title: "計画",
        },
      ],
    };
    let saved = false;

    await applyOrganization(
      fake.app as never,
      fake.file as never,
      {
        lists: [],
        status: "active",
        tags: [],
        type: "task",
        typeChanged: true,
      },
      settings,
      async () => {
        saved = true;
      }
    );

    expect(fake.file.path).toBe("Seiton/tasks/計画.md");
    expect(settings.pinned).toEqual(["Seiton/tasks/計画.md"]);
    expect(settings.shortcuts[0]?.target).toBe("Seiton/tasks/計画.md");
    expect(saved).toBe(true);
  });
});
