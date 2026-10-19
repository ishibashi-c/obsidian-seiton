import { describe, expect, it } from "vitest";
import {
  buildFolderTree,
  isInArchivedContext,
  isInLibraryFolder,
  isVisibleLibraryItem,
  libraryFolderOptions,
  libraryFolderPath,
  libraryItemWithArchiveContext,
  rewriteFolderPath,
  sortLibraryItems,
} from "../src/shared/library";
import type { IndexedItem } from "../src/shared/types";

const make = (
  path: string,
  title: string,
  type: IndexedItem["item"]["type"],
  created: string,
  modified: number
): IndexedItem => ({
  body: "",
  item: { created, status: "active", type },
  modified,
  path,
  title,
});

const items = [
  make("a.md", "Beta", "task", "2026-01-01", 30),
  make("b.md", "Alpha", "idea", "2026-02-01", 10),
];

describe("library sorting", () => {
  it("更新順・作成順・タイトル順・タイプ順を提供する", () => {
    expect(
      sortLibraryItems(items, "modified").map((item) => item.path)
    ).toEqual(["a.md", "b.md"]);
    expect(sortLibraryItems(items, "created").map((item) => item.path)).toEqual(
      ["b.md", "a.md"]
    );
    expect(sortLibraryItems(items, "title").map((item) => item.path)).toEqual([
      "b.md",
      "a.md",
    ]);
    expect(sortLibraryItems(items, "type").map((item) => item.path)).toEqual([
      "b.md",
      "a.md",
    ]);
  });
});

describe("library visibility", () => {
  it("未整理の新規ノートもライブラリに含め、アーカイブと一言メモは除外する", () => {
    expect(
      isVisibleLibraryItem({
        item: { status: "inbox", type: "class" },
      } as Pick<IndexedItem, "item">)
    ).toBe(true);
    expect(
      isVisibleLibraryItem({
        item: { status: "archive", type: "class" },
      } as Pick<IndexedItem, "item">)
    ).toBe(false);
    expect(
      isVisibleLibraryItem({
        item: { status: "active", type: "memo" },
      } as Pick<IndexedItem, "item">)
    ).toBe(false);
  });
});

describe("library folder filtering", () => {
  const paths = [
    { path: "Seiton/classes/学習テーマ/20260610.md" },
    { path: "Seiton/classes/学習テーマ/20260617.md" },
    { path: "Seiton/clips/学習/学習テーマ/参考資料.md" },
  ];

  it("ファイルパスから保存先フォルダを導出する", () => {
    expect(libraryFolderPath(paths[0].path)).toBe("Seiton/classes/学習テーマ");
    expect(libraryFolderPath("ルートノート.md")).toBe("");
  });

  it("親フォルダを含む選択肢と配下の件数を作る", () => {
    const options = libraryFolderOptions(paths);
    expect(
      options.find((option) => option.path === "Seiton/classes")
    ).toMatchObject({
      count: 2,
      depth: 1,
      name: "classes",
    });
    expect(
      options.find((option) => option.path === "Seiton/clips/学習/学習テーマ")
        ?.count
    ).toBe(1);
  });

  it("フォルダ候補を階層化し、候補にない中間フォルダも補う", () => {
    const options = [
      { path: "Seiton/clips/10_整理" },
      { path: "Seiton/clips/20_技術/03_運用" },
      { path: "Seiton/classes/社会デザイン" },
    ];
    const tree = buildFolderTree(options);

    expect(tree).toMatchObject([
      {
        children: [
          {
            children: [{ name: "社会デザイン", option: options[2] }],
            name: "classes",
          },
          {
            children: [
              { name: "10_整理", option: options[0] },
              {
                children: [{ name: "03_運用", option: options[1] }],
                name: "20_技術",
                option: null,
              },
            ],
            name: "clips",
          },
        ],
        name: "Seiton",
        option: null,
      },
    ]);
  });

  it("空のフォルダも件数0で表示候補に含める", () => {
    expect(
      libraryFolderOptions(paths, ["Seiton/projects/終了済み"])
    ).toContainEqual({
      count: 0,
      depth: 2,
      name: "終了済み",
      path: "Seiton/projects/終了済み",
    });
  });

  it("選択したフォルダとその配下だけを含める", () => {
    expect(
      isInLibraryFolder(
        "Seiton/classes/学習テーマ/20260610.md",
        "Seiton/classes"
      )
    ).toBe(true);
    expect(
      isInLibraryFolder(
        "Seiton/clips/学習/学習テーマ/参考資料.md",
        "Seiton/classes"
      )
    ).toBe(false);
    expect(isInLibraryFolder("ルートノート.md", "")).toBe(true);
  });

  it("アーカイブ文脈は配下だけに適用し、似た名前の別フォルダには適用しない", () => {
    const archived = ["Seiton/classes/2024年度"];
    expect(
      isInArchivedContext("Seiton/classes/2024年度/授業1/ノート.md", archived)
    ).toBe(true);
    expect(
      isInArchivedContext("Seiton/classes/2024年度末/ノート.md", archived)
    ).toBe(false);
    expect(isInArchivedContext("Seiton/projects/アーカイブ.md", archived)).toBe(
      false
    );
  });

  it("フォルダ名変更に合わせて配下のパスだけを置換する", () => {
    expect([
      rewriteFolderPath(
        "Seiton/projects/旧名",
        "Seiton/projects/新名",
        "Seiton/projects/旧名"
      ),
      rewriteFolderPath(
        "Seiton/projects/旧名/資料/ノート.md",
        "Seiton/projects/新名",
        "Seiton/projects/旧名"
      ),
      rewriteFolderPath(
        "Seiton/projects/旧名2/ノート.md",
        "Seiton/projects/新名",
        "Seiton/projects/旧名"
      ),
    ]).toEqual([
      "Seiton/projects/新名",
      "Seiton/projects/新名/資料/ノート.md",
      "Seiton/projects/旧名2/ノート.md",
    ]);
  });
});

describe("library archive scope state", () => {
  it("フォルダ復元後もノート自身のlegacyアーカイブ状態を保つ", () => {
    expect(
      libraryItemWithArchiveContext(
        {
          archived: true,
          archiveState: "context",
          contextArchived: true,
          legacyArchived: true,
        },
        false
      )
    ).toMatchObject({
      archived: true,
      archiveState: "legacy",
      contextArchived: false,
      legacyArchived: true,
    });
  });

  it("フォルダのアーカイブ・解除後にactive/archivedの値を再計算する", () => {
    const item = {
      archived: false,
      archiveState: undefined,
      contextArchived: false,
      legacyArchived: false,
    };
    const archived = libraryItemWithArchiveContext(item, true);
    const restored = libraryItemWithArchiveContext(archived, false);

    expect(archived).toMatchObject({
      archived: true,
      archiveState: "context",
      contextArchived: true,
    });
    expect(restored).toMatchObject({
      archived: false,
      archiveState: undefined,
      contextArchived: false,
    });
  });
});
