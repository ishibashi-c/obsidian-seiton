import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { createNewNote } from "../src/platform/obsidian/noteStore";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

function fakeVault(initialFolders: string[] = ["Seiton/tasks"]) {
  const files = new Map<string, TFile>();
  const folders = new Set(initialFolders);
  const created: string[] = [];
  const vault = {
    create: async (path: string) => {
      const file = Object.assign(new TFile(), { path });
      files.set(path, file);
      created.push(path);
    },
    createFolder: async (path: string) => {
      folders.add(path);
    },
    getAbstractFileByPath: (path: string) =>
      files.get(path) ?? (folders.has(path) ? { children: [], path } : null),
  };
  return { created, vault };
}

describe("createNewNote folder destination", () => {
  it("選択したタイプ別フォルダ内にノートを作成する", async () => {
    const { created, vault } = fakeVault(["Seiton/tasks", "Seiton/tasks/2026"]);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: [],
    };

    await createNewNote(vault as never, {
      destinationFolder: "Seiton/tasks/2026",
      settings,
      title: "週次レビュー",
      type: "task",
    });

    expect(created).toEqual(["Seiton/tasks/2026/週次レビュー.md"]);
  });

  it("別タイプの保存領域とアーカイブ済みフォルダへの作成を拒否する", async () => {
    const { vault } = fakeVault([
      "Seiton/tasks",
      "Seiton/tasks/終了",
      "Seiton/clips",
    ]);
    const settings = {
      ...DEFAULT_SETTINGS,
      archivedFolders: ["Seiton/tasks/終了"],
    };

    await expect(
      createNewNote(vault as never, {
        destinationFolder: "Seiton/clips",
        settings,
        title: "不正な保存先",
        type: "task",
      })
    ).rejects.toThrow("保存先は選択したタイプのフォルダ内にしてください");
    await expect(
      createNewNote(vault as never, {
        destinationFolder: "Seiton/tasks/終了",
        settings,
        title: "アーカイブ中",
        type: "task",
      })
    ).rejects.toThrow("アーカイブ済みフォルダには作成できません");
  });
});
