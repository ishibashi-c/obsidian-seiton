import { describe, expect, it } from "vitest";
import {
  CURRENT_SETTINGS_SCHEMA_VERSION,
  migrateSettings,
} from "../src/shared/settings";

describe("migrateSettings", () => {
  it("設定がない場合に現在の完全な既定値を返す", () => {
    const result = migrateSettings(null);
    expect(result.settings.schemaVersion).toBe(CURRENT_SETTINGS_SCHEMA_VERSION);
    expect(result.settings.enabledTypes).toHaveLength(10);
    expect(result.settings.typeOrder).toHaveLength(10);
    expect(result.settings.memoTagOptions).toEqual([]);
    expect(result.settings.modules).toMatchObject({
      agentGuide: false,
      bookshelf: true,
      editorToolbar: true,
      memos: true,
      richCards: true,
    });
    expect(result.settings.search).toEqual({
      additionalFolders: [],
      historyEnabled: true,
      includeMemos: true,
      maxHistory: 10,
    });
    expect(result.settings.sharedTextDefault).toBe("memo");
    expect(result.settings.pinnedTypes).toEqual(["idea", "task", "article"]);
    expect(result.settings.pinnedCreatePresets).toEqual([]);
    expect(result.settings.libraryViewMode).toBe("card");
    expect(result.settings.libraryBrowseMode).toBe("items");
    expect(result.settings.librarySort).toBe("modified");
    expect(result.settings.bookCoverCacheEnabled).toBe(true);
    expect(result.settings.bookDetailTabReuseEnabled).toBe(true);
    expect(result.settings.calilAppKey).toBe("");
    expect(result.settings.calilPrefecture).toBe("");
    expect(result.settings.calilCity).toBe("");
    expect(result.settings.calilReferenceLatitude).toBeNull();
    expect(result.settings.calilReferenceLongitude).toBeNull();
    expect(result.settings.bookCategories).toContain("フィクション");
    expect(result.settings.bookCategories).toContain("未分類");
    expect(result.settings.calilSearchHistory).toEqual([]);
    expect(result.settings.onboardingCompleted).toBe(false);
    expect(result.settings.uiLanguage).toBe("auto");
    expect(result.settings.richCardDisabledDomains).toEqual([]);
    expect(result.settings.archiveFolderMoves).toEqual([]);
    expect(result.settings.archiveNoteMoves).toEqual([]);
  });

  it("ホームの一言メモ用タグ候補を正規化する", () => {
    const result = migrateSettings({
      memoTagOptions: [" #学び ", "", "学び", 42, "#生活/料理"],
    });

    expect(result.settings.memoTagOptions).toEqual(["学び", "生活/料理"]);
  });

  it("旧editorToolbarEnabledをmodule flagへ移行しaiModeを保存しない", () => {
    const result = migrateSettings({
      aiMode: "auto",
      editorToolbarEnabled: false,
      rootFolder: "My Seiton",
    });
    expect(result.fromVersion).toBe(0);
    expect(result.settings.rootFolder).toBe("My Seiton");
    expect(result.settings.modules.editorToolbar).toBe(false);
    expect(result.settings).not.toHaveProperty("editorToolbarEnabled");
    expect(result.settings).not.toHaveProperty("aiMode");
  });

  it("汎用アーカイブの文脈フォルダを設定として保持する", () => {
    const result = migrateSettings({
      archivedFolders: ["Seiton/classes/2024", " Seiton/projects/終了 ", ""],
    });
    expect(result.settings.archivedFolders).toEqual([
      "Seiton/classes/2024",
      "Seiton/projects/終了",
    ]);
    expect(migrateSettings({}).settings.archivedFolders).toEqual([]);
  });

  it("物理アーカイブの移動先と元の場所を正規化して保持する", () => {
    const result = migrateSettings({
      archiveFolderMoves: [
        {
          archivedPath: "/Seiton/archive/classes/2024/",
          originalPath: "Seiton/classes/2024",
          type: "class",
        },
        {
          archivedPath: "Seiton/archive/tasks/invalid",
          originalPath: "Seiton/tasks/invalid",
          type: "memo",
        },
      ],
    });

    expect(result.settings.archiveFolderMoves).toEqual([
      {
        archivedPath: "Seiton/archive/classes/2024",
        originalPath: "Seiton/classes/2024",
        type: "class",
      },
    ]);
  });

  it("ノート単体のアーカイブ記録を保持し、危険なパスや不正な状態を除く", () => {
    const result = migrateSettings({
      archiveNoteMoves: [
        {
          archivedPath: "Seiton/archive/tasks/notes/計画.md",
          originalPath: "Seiton/tasks/進行中/計画.md",
          previousStatus: "active",
          type: "task",
        },
        {
          archivedPath: "Seiton/archive/tasks/notes/../../secret.md",
          originalPath: "Seiton/tasks/secret.md",
          previousStatus: "inbox",
          type: "task",
        },
        {
          archivedPath: "Seiton/archive/memos/notes/2026-09.md",
          originalPath: "Seiton/memos/2026-09.md",
          previousStatus: "archive",
          type: "memo",
        },
      ],
    });

    expect(result.settings.archiveNoteMoves).toEqual([
      {
        archivedPath: "Seiton/archive/tasks/notes/計画.md",
        originalPath: "Seiton/tasks/進行中/計画.md",
        previousStatus: "active",
        type: "task",
      },
    ]);
  });

  it("選択タイプの空配列を有効な選択として保持し順序には不足タイプを補う", () => {
    const result = migrateSettings({
      enabledTypes: [],
      typeOrder: ["idea", "webclip", "invalid", "idea"],
    });
    expect(result.settings.enabledTypes).toEqual([]);
    expect(result.settings.typeOrder.slice(0, 2)).toEqual(["idea", "webclip"]);
    expect(new Set(result.settings.typeOrder).size).toBe(10);
  });

  it("既存のタイプ選択は維持し、新しいタイプを表示順へ補う", () => {
    const result = migrateSettings({
      enabledTypes: ["idea", "article"],
      typeOrder: ["idea", "article"],
    });

    expect(result.settings.enabledTypes).toEqual(["idea", "article"]);
    expect(result.settings.typeOrder.slice(0, 2)).toEqual(["idea", "article"]);
    expect(result.settings.typeOrder).toContain("collection");
  });

  it("moduleとsearchを正規化して重複folderを除く", () => {
    const result = migrateSettings({
      modules: { bookshelf: false, memos: false },
      search: {
        additionalFolders: ["Notes", " Notes ", "", 42],
        historyEnabled: false,
        includeMemos: false,
        maxHistory: 5.8,
      },
    });
    expect(result.settings.modules.bookshelf).toBe(false);
    expect(result.settings.modules.memos).toBe(false);
    expect(result.settings.modules.richCards).toBe(true);
    expect(result.settings.search).toEqual({
      additionalFolders: ["Notes"],
      historyEnabled: false,
      includeMemos: false,
      maxHistory: 5,
    });
  });

  it("現在設定を再移行しても差分を作らない", () => {
    const first = migrateSettings({
      enabledTypes: ["idea", "webclip"],
    }).settings;
    const second = migrateSettings(first);
    expect(second.changed).toBe(false);
    expect(second.settings).toEqual(first);
  });

  it("本の詳細タブ再利用は既定オンで明示的なオフを保持する", () => {
    const defaultResult = migrateSettings({});
    const disabledResult = migrateSettings({
      bookDetailTabReuseEnabled: false,
    });

    expect(defaultResult.settings.bookDetailTabReuseEnabled).toBe(true);
    expect(disabledResult.settings.bookDetailTabReuseEnabled).toBe(false);
  });

  it("共有テキスト既定先と新規作成履歴を正規化する", () => {
    const result = migrateSettings({
      pinnedTypes: ["task", "invalid", "task"],
      recentTypes: ["idea", "task", "article", "project", "memo", "class"],
      sharedTextDefault: "idea",
    });
    expect(result.settings.sharedTextDefault).toBe("idea");
    expect(result.settings.pinnedTypes).toEqual(["task"]);
    expect(result.settings.recentTypes).toEqual([
      "idea",
      "task",
      "article",
      "project",
      "memo",
    ]);
  });

  it("新規作成の保存先・タグプリセットを正規化し、不正値を除外する", () => {
    const result = migrateSettings({
      pinnedCreatePresets: [
        {
          id: "study-topic",
          label: " 学習テーマ ",
          subfolder: " 学習\\講義/学習テーマ ",
          tags: ["#学習/講義", "学習テーマ", "学習テーマ"],
          type: "class",
        },
        {
          id: "invalid-parent",
          label: "無効",
          subfolder: "../outside",
          tags: [],
          type: "class",
        },
        {
          id: "study-topic",
          label: "重複",
          subfolder: "別の場所",
          tags: [],
          type: "class",
        },
      ],
    });
    expect(result.settings.pinnedCreatePresets).toEqual([
      {
        id: "study-topic",
        label: "学習テーマ",
        subfolder: "学習/講義/学習テーマ",
        tags: ["学習/講義", "学習テーマ"],
        type: "class",
      },
    ]);
  });

  it("旧URLショートカットを型付きショートカットへ移行する", () => {
    const result = migrateSettings({
      shortcuts: [
        { group: "Web", title: "Example", url: "https://example.com" },
      ],
    });
    expect(result.settings.shortcuts).toEqual([
      {
        group: "Web",
        kind: "url",
        target: "https://example.com",
        title: "Example",
      },
    ]);
  });

  it("ショートカットフォルダとVaultフォルダのショートカットを保持する", () => {
    const result = migrateSettings({
      shortcutGroups: ["仕事", " 仕事 ", "学習"],
      shortcuts: [
        {
          group: "開発",
          kind: "folder",
          target: "Seiton/projects",
          title: "プロジェクト",
        },
      ],
    });
    expect(result.settings.shortcutGroups).toEqual(["仕事", "学習", "開発"]);
    expect(result.settings.shortcuts[0]).toMatchObject({ kind: "folder" });
  });

  it("リッチカード無効domainを正規化する", () => {
    const result = migrateSettings({
      richCardDisabledDomains: ["HTTPS://Example.COM/path", ".example.com", ""],
    });
    expect(result.settings.richCardDisabledDomains).toEqual(["example.com"]);
  });

  it("schema v6の同期除外設定を互換期間中は保持する", () => {
    const first = migrateSettings({
      richCardCacheExcludeFromSync: true,
      schemaVersion: 6,
    });
    expect(first.settings.richCardCacheExcludeFromSync).toBe(true);
    expect(
      migrateSettings(first.settings).settings.richCardCacheExcludeFromSync
    ).toBe(true);
  });

  it("カーリルのユーザー設定をtrimして保持する", () => {
    const result = migrateSettings({
      calilAppKey: "  user-key  ",
      calilCity: " 世田谷区 ",
      calilPrefecture: " 東京都 ",
    });
    expect(result.settings.calilAppKey).toBe("user-key");
    expect(result.settings.calilCity).toBe("世田谷区");
    expect(result.settings.calilPrefecture).toBe("東京都");
  });

  it("本棚カテゴリとカーリル検索履歴を正規化する", () => {
    const result = migrateSettings({
      bookCategories: [" フィクション ", "", "フィクション", 42],
      calilSearchHistory: [
        {
          availableCount: 3.9,
          bookId: "book-1",
          bookUrl: "https://calil.jp/book/123",
          checkedAt: "2026-09-05T00:00:00.000Z",
          isbn: "9784101010014",
          title: "テスト本",
        },
        { bookId: "invalid" },
      ],
    });
    expect(result.settings.bookCategories).toEqual(["フィクション", "未分類"]);
    expect(result.settings.calilSearchHistory).toEqual([
      {
        availableCount: 3,
        bookId: "book-1",
        bookUrl: "https://calil.jp/book/123",
        checkedAt: "2026-09-05T00:00:00.000Z",
        isbn: "9784101010014",
        title: "テスト本",
      },
    ]);
  });

  it("本棚カテゴリは20件以内で未分類を必ず保持する", () => {
    const result = migrateSettings({
      bookCategories: [
        ...Array.from({ length: 20 }, (_, index) => `カテゴリ${index + 1}`),
        "未分類",
      ],
    });

    expect(result.settings.bookCategories).toHaveLength(20);
    expect(result.settings.bookCategories).toEqual([
      ...Array.from({ length: 19 }, (_, index) => `カテゴリ${index + 1}`),
      "未分類",
    ]);
  });

  it("個人住所の基準地点を破棄し、市区町村の基準点だけを保持する", () => {
    const result = migrateSettings({
      calilReferenceAddress: " 東京都千代田区 ",
      calilReferenceLatitude: "35.689487",
      calilReferenceLongitude: 139.691_706,
    });
    expect(result.settings).not.toHaveProperty("calilReferenceAddress");
    expect(result.settings.calilReferenceLatitude).toBeNull();
    expect(result.settings.calilReferenceLongitude).toBeNull();
    expect(
      migrateSettings({
        calilReferenceLatitude: 91,
        calilReferenceLongitude: -181,
      }).settings
    ).toMatchObject({
      calilReferenceLatitude: null,
      calilReferenceLongitude: null,
    });
    const current = migrateSettings({
      calilCity: "千代田区",
      calilReferenceLatitude: 35.689_487,
      calilReferenceLongitude: 139.691_706,
      schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
    });
    expect(current.settings.calilReferenceLatitude).toBe(35.689_487);
  });
});
