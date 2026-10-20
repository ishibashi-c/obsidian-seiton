/**
 * ブラウザハーネス エントリ（spec 12.6章 層2）
 *
 * URLクエリでビューを選択する:
 *   http://localhost:5178/?view=home  … ホーム
 *   http://localhost:5178/?view=react-home  … Reactページ単位のホームモック
 *   http://localhost:5178/?view=react-library  … Reactライブラリページモック
 *   http://localhost:5178/?view=react-search  … React検索ページモック
 *   http://localhost:5178/?view=react-organize  … React整理ページモック
 *   http://localhost:5178/?view=react-organize&fixture=proposal-review … 整理案・保留・一括確認
 *   http://localhost:5178/?view=react-home&fixture=readme-demo&lang=ja … README用の匿名デモデータ
 *   http://localhost:5178/?view=react-memo  … Reactつぶやき振り返りページモック
 *   http://localhost:5178/?view=react-bookshelf  … React本棚ページモック
 *   http://localhost:5178/?view=react-onboarding  … Reactオンボーディングページモック
 *   http://localhost:5178/?view=react-supporting … 設定・モーダル・共通部品モック
 *   http://localhost:5178/?view=react-bookshelf&fixture=batch-over-10 … 一括検索の大量選択確認
 *   http://localhost:5178/?view=react-search&fixture=archive-search … アーカイブ検索の確認
 *   http://localhost:5178/?view=react-search&fixture=exclude-archives … 設定によるアーカイブ完全除外
 *   http://localhost:5178/?view=react-search&fixture=external-search … 外部フォルダ検索結果の確認
 *   http://localhost:5178/?view=react-bookshelf&fixture=book-api-error … 書誌API失敗と手入力fallback（外部表紙画像なし）
 *   http://localhost:5178/?view=react-bookshelf&fixture=book-finished-empty&lang=de … 明示的な空読了日のローカライズ
 *   http://localhost:5178/?view=react-bookshelf&fixture=book-operation-errors … 本棚操作失敗通知（外部通信・Vault変更なし）
 *   http://localhost:5178/?view=library&fixture=library-update-error&lang=de … リスト更新失敗時の回復（Vault変更なし）
 *   http://localhost:5178/?view=react-home&fixture=home-action-errors&lang=de … ホーム操作の失敗通知（Vault変更なし）
 *   http://localhost:5178/?view=react-home&fixture=home-memo-tags … ホームの一言メモに設定済みタグ候補を表示
 *   http://localhost:5178/?view=react-create&type=memo&fixture=create-error&lang=de … 作成失敗後の再試行（初回だけ失敗）
 *   http://localhost:5178/?view=react-bookshelf&fixture=calil-api-error … カーリル検索の通信失敗（外部通信なし）
 *   http://localhost:5178/?view=react-bookshelf&fixture=calil-address-api-error … 住所を入力したカーリル検索の通信失敗（外部通信なし）
 *   http://localhost:5178/?view=react-bookshelf&fixture=calil-history … 言語別のカーリル履歴表示
 *
 * 本番と同じReact UIをモックObsidian API上で表示する。
 */
import "../src/ui/styles.css";
import "./styles.css";
import {
  mountSeitonApp,
  type SeitonAppDestination,
} from "../src/app/mountSeitonApp";
import { openReactOnboardingDialog } from "../src/platform/obsidian/OnboardingDialog";
import { createObsidianProductionAdapter } from "../src/platform/obsidian/productionAdapter";
import { loadReactProductionData } from "../src/platform/obsidian/productionData";
import { ITEM_TYPES } from "../src/shared/constants";
import { setYamlParser } from "../src/shared/frontmatter";
import { detectLang } from "../src/shared/i18n";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import type { ItemType, SeitonSettings } from "../src/shared/types";
import { createSeitonShadowBoundary } from "../src/ui/boundary";
import {
  type MockNote,
  mockApp,
  mockSettings,
  mockVault,
  parseYaml,
  showNotice,
} from "./mocks/obsidian";

// ---------------------------------------------------------------------------
// シードデータ（test-vaultと同じ構成）
// ---------------------------------------------------------------------------

const SEED: MockNote[] = [
  {
    content: `---
type: webclip
tags: []
sourceTags: [web]
lists: []
status: inbox
created: 2026-08-01T10:00:00
source: https://example.com/baseball
---
野球に関する未整理の記事クリップ。`,
    path: "Seiton/inbox/野球記事.md",
  },
  {
    content: `---
type: webclip
tags: [開発手法, AI]
baseTags: [ニュース]
lists: [お気に入り]
status: active
created: 2026-08-11T18:30:00
source: https://example.com/loop-engineering
---
https://example.com/loop-engineering

## メモ
開発を「一度で終わらせる」のではなく、仮説→実装→検証→学習のループを回し続ける設計思想。`,
    path: "Seiton/clips/ループエンジニアリング入門.md",
  },
  {
    content: `---
type: reading
tags: [デザイン, UI, ノンフィクション]
sourceTags: [book]
lists: [お気に入り]
status: active
created: 2026-08-10T12:00:00
bookAuthor: 岸見 一郎・古賀 史健
bookIsbn: 9784478025819
bookFinished: 2026-08-28
bookRating: 4
bookCategory: ノンフィクション
bookSeries: アドラー心理学
---
嫌われる勇気の読書記録。`,
    path: "Seiton/readings/ノンフィクション/嫌われる勇気.md",
  },
  {
    content: `---
type: reading
tags: [読書, フィクション]
baseTags: []
lists: []
status: active
created: 2026-08-09T12:00:00
bookAuthor: 村田 沙耶香
bookIsbn: 9784163906188
bookFinished: 2026-08-26
bookRating: 4
bookCategory: フィクション
---
コンビニ人間の読書記録。`,
    path: "Seiton/readings/フィクション/コンビニ人間.md",
  },
  {
    content: `---
type: reading
tags: [読書, 設計, フィクション]
baseTags: []
lists: []
status: active
created: 2026-08-08T12:00:00
bookAuthor: 森見 登美彦
bookIsbn: 9784043878024
bookFinished: 2026-08-24
bookRating: 5
bookCategory: フィクション
---
夜は短し歩けよ乙女の読書記録。`,
    path: "Seiton/readings/フィクション/夜は短し歩けよ乙女.md",
  },
  {
    content: `---
type: reading
tags: [習慣, 英語, 実用・ビジネス]
baseTags: []
lists: [あとで読む]
status: active
created: 2026-08-07T12:00:00
bookAuthor: James Clear
bookIsbn: 9780735211292
bookRating: 3
bookCategory: 実用・ビジネス
bookSeries: 設計の基本
---
Atomic Habitsの読書記録。`,
    path: "Seiton/readings/実用・ビジネス/Atomic Habits.md",
  },
  {
    content: `---
type: reading
tags: [デザイン, UX, 学術・専門]
baseTags: []
lists: []
status: active
created: 2026-08-06T12:00:00
bookAuthor: Donald A. Norman
bookIsbn: 9780465050659
bookFinished: ""
bookRating: 4
bookCategory: 学術・専門
bookSeries: 設計の基本
---
The Design of Everyday Thingsの読書記録。`,
    path: "Seiton/readings/学術・専門/The Design of Everyday Things.md",
  },
  {
    content: `---
type: reading
tags: [言葉, 詩歌・エッセイ]
baseTags: []
lists: []
status: active
created: 2026-08-05T12:00:00
bookAuthor: 小川 洋子
bookIsbn: 9784123456789
bookCategory: 詩歌・エッセイ
---
言葉を育てるの読書記録。`,
    path: "Seiton/readings/詩歌・エッセイ/言葉を育てる.md",
  },
  {
    content: `---
type: reading
tags: []
baseTags: []
lists: []
status: active
created: 2026-08-04T12:00:00
---
ISBNを後で確認する本の読書記録。`,
    path: "Seiton/readings/ISBNを後で確認する本.md",
  },
  {
    content: `---
type: class
tags: [学習/講義, 学習テーマ, 学び]
sourceTags: []
lists: []
status: active
created: 2026-08-14T12:00:00
---
授業で扱った社会課題の観察メモ。`,
    path: "Seiton/classes/学習テーマ/第1回ノート.md",
  },
  {
    content: `---
type: class
tags: [学習/講義, 学習テーマ, 新規作成]
sourceTags: []
lists: []
status: inbox
created: 2026-09-04T07:13:44.507Z
---
新規作成で保存された未整理ノート。`,
    path: "Seiton/classes/学習テーマ/20260904.md",
  },
  {
    content: `---
type: webclip
tags: [学習/講義, 学習テーマ, 調査]
sourceTags: [web]
lists: []
status: active
created: 2026-08-13T12:00:00
source: https://example.com/social-design
---
授業内容を補足する参考記事のクリップ。`,
    path: "Seiton/clips/学習/学習テーマ/参考資料.md",
  },
  {
    content: `---
type: idea
tags: [AI]
baseTags: []
lists: []
status: inbox
created: 2026-08-18T10:00:00
---
## 一言で

ノートをAIが自動分類する仕組み

## 背景

未整理がたまる問題

## 次の一手

ルールベース提案UI`,
    path: "Seiton/ideas/自動整理エージェント.md",
  },
  {
    content: `---
type: task
tags: [開発]
baseTags: []
lists: []
status: active
created: 2026-08-19T09:00:00
---
## 締切

2026-08-31

## 内容

UI再構築`,
    path: "Seiton/tasks/リファクタリング計画.md",
  },
  {
    content: `---
type: memo
month: 2026-08
---
## ${new Date().toISOString().slice(0, 10)}
- 08:06 階級がある国ではインフルエンサーってどの立ち位置なんだろう #疑問
- 22:14 discordの音声サーバーって住み分けかな
`,
    path: "Seiton/Memos/2026-08.md",
  },
];

const BATCH_SEARCH_STRESS_SEED: MockNote[] = (
  [
    ["08", "9780000000019", "2026-08-03"],
    ["09", "9780000000026", "2026-08-02"],
    ["10", "9780000000033", "2026-08-01"],
    ["11", "9780000000040", "2026-07-31"],
    ["12", "9780000000057", "2026-07-30"],
  ] as const
).map(([number, isbn, date]) => ({
  content: `---\ntype: reading\ntags: [テスト]\nbaseTags: []\nlists: []\nstatus: active\ncreated: ${date}T12:00:00\nbookAuthor: テスト著者\nbookIsbn: ${isbn}\nbookCategory: 未分類\n---\n一括検索の件数境界を確認するためのUI Lab専用データ。`,
  path: `Seiton/readings/未分類/一括検索テスト書籍 ${number}.md`,
}));

const README_DEMO_SEED: MockNote[] = [
  {
    content: `---
type: idea
tags: [読書会, 進行]
lists: []
status: inbox
created: 2026-09-20T09:00:00
---
読書会の最後に、参加者が一つずつ気づきを共有する時間をつくる。`,
    path: "Seiton/inbox/読書会の進め方.md",
  },
  {
    content: `---
type: task
tags: [準備]
lists: []
status: inbox
created: 2026-09-21T10:30:00
---
## 内容

次回の読書会で使う質問カードを3枚用意する。`,
    path: "Seiton/inbox/質問カードを用意する.md",
  },
  {
    content: `---
type: article
tags: [文章, 伝え方]
lists: [あとで見直す]
status: active
created: 2026-09-18T14:00:00
---
# 説明文を短くする

一つの段落では一つのことを伝える。最初に要点を書き、補足は必要な場合だけ続ける。`,
    path: "Seiton/articles/説明文を短くする.md",
  },
  {
    content: `---
type: webclip
tags: [設計, 参考]
lists: [あとで読む]
status: active
created: 2026-09-16T11:00:00
---
# 入力フォームをわかりやすくする

入力欄を目的ごとにまとめ、必須項目を明示するための参考メモ。`,
    path: "Seiton/clips/入力フォームの設計.md",
  },
];

const ARCHIVE_SEARCH_FIXTURE: MockNote[] = [
  {
    content:
      "---\ntype: article\ntags: [UI Lab]\nstatus: archive\ncreated: 2026-07-28T11:00:00\n---\n検索のアーカイブ条件を確認するためのUI Lab専用データ。",
    path: "Seiton/archive/検索fixture.md",
  },
];

const EXTERNAL_SEARCH_FIXTURE: MockNote[] = [
  {
    content:
      "# 外部フォルダの議事メモ\n検索結果では開く操作だけを提供し、Seitonから内容を変更しないことを確認するfixtureです。",
    path: "03_資料/外部フォルダ検索fixture.md",
  },
];

const ORGANIZATION_PROPOSAL_METADATA = JSON.stringify({
  created: "2026-09-24",
  holds: [
    {
      reason: "メール文面は現在の9タイプに自然に当てはめにくいため",
      source: "Seiton/inbox/メールの下書き.md",
      title: "メールの下書き",
    },
  ],
  operations: [
    {
      changes: {
        destination: "Seiton/clips/20_技術/01_AI",
        lists: ["あとで読む"],
        status: "active",
        tags: ["AI", "評価"],
      },
      expected: {
        lists: [],
        status: "inbox",
        tags: [],
        type: "webclip",
      },
      id: "ai-methods",
      reason: "AI関連の資料としてまとめる",
      source: "Seiton/inbox/AIの評価手法.md",
    },
  ],
  version: 2,
});

const ORGANIZATION_PROPOSAL_FIXTURE: MockNote[] = [
  {
    content: `---
type: webclip
status: inbox
created: 2026-09-24T10:00:00+09:00
tags: []
lists: []
---
# AIの評価手法
評価手法の比較メモです。
`,
    path: "Seiton/inbox/AIの評価手法.md",
  },
  {
    content: `---
type: article
status: inbox
created: 2026-09-24T10:05:00+09:00
tags: [受信箱]
lists: []
---
# メールの下書き
返信文の下書きです。
`,
    path: "Seiton/inbox/メールの下書き.md",
  },
  {
    content: `---
seiton-proposal: ${ORGANIZATION_PROPOSAL_METADATA}
---
# 2026-09-24 の整理案

AI関連ノートを整理案にし、メール文面は保留にします。
`,
    path: "Seiton/整理案/2026-09-24.md",
  },
];

// ---------------------------------------------------------------------------

setYamlParser(parseYaml);
window.__mockVault = mockVault;
const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "home";
const fixture = params.get("fixture");
mockVault.seed([
  ...(fixture === "readme-demo" ? README_DEMO_SEED : SEED),
  ...(fixture === "proposal-review" ? ORGANIZATION_PROPOSAL_FIXTURE : []),
  ...(fixture === "batch-over-10" ? BATCH_SEARCH_STRESS_SEED : []),
  ...(fixture === "archive-search" || fixture === "exclude-archives"
    ? ARCHIVE_SEARCH_FIXTURE
    : []),
  ...(fixture === "external-search" ? EXTERNAL_SEARCH_FIXTURE : []),
]);
mockSettings.load({
  ...DEFAULT_SETTINGS,
  listNames: ["お気に入り", "あとで読む"],
  onboardingCompleted: true,
  pinnedCreatePresets: [
    {
      id: "class-study-topic",
      label: "学習テーマ",
      subfolder: "学習テーマ",
      tags: ["学習/講義", "学習テーマ"],
      type: "class",
    },
    {
      id: "webclip-sports",
      label: "スポーツ記事",
      subfolder: "スポーツ",
      tags: ["スポーツ"],
      type: "webclip",
    },
  ],
  shortcuts: [
    {
      group: "",
      kind: "url",
      target: "https://www.google.com",
      title: "Google",
    },
    {
      group: "仕事",
      kind: "url",
      target: "https://github.com",
      title: "GitHub",
    },
    { group: "Seiton", kind: "view", target: "library", title: "書庫" },
  ],
});
if (fixture === "readme-demo") {
  mockSettings.data = {
    ...DEFAULT_SETTINGS,
    calilAppKey: "",
    calilCity: "",
    calilPrefecture: "",
    calilSearchHistory: [],
    listNames: ["あとで見直す", "あとで読む"],
    modules: { ...DEFAULT_SETTINGS.modules, bookshelf: false },
    onboardingCompleted: true,
    pinned: [],
    pinnedCreatePresets: [],
    searchHistory: [],
    shortcuts: [{ group: "", kind: "view", target: "library", title: "書庫" }],
  };
}
const fixtureSettings = mockSettings.data as unknown as SeitonSettings;
if (fixture === "home-memo-tags") {
  fixtureSettings.memoTagOptions = ["学び", "仕事", "あとで考える"];
}
if (fixture === "exclude-archives") {
  fixtureSettings.excludeArchivedFromSearch = true;
}
if (fixture === "search-history-disabled") {
  fixtureSettings.search.historyEnabled = false;
  fixtureSettings.searchHistory = [];
}
if (fixture === "external-search") {
  fixtureSettings.search.additionalFolders = ["03_資料"];
}
if (fixture === "calil-api-error") {
  fixtureSettings.calilAppKey = "ui-lab-test-only";
  fixtureSettings.calilCity = "千代田区";
  fixtureSettings.calilPrefecture = "東京都";
  fixtureSettings.calilReferenceLatitude = 35.694;
  fixtureSettings.calilReferenceLongitude = 139.754;
}
if (fixture === "calil-address-api-error") {
  fixtureSettings.calilAppKey = "ui-lab-test-only";
  fixtureSettings.calilCity = "";
  fixtureSettings.calilPrefecture = "";
}
if (fixture === "calil-history") {
  fixtureSettings.calilSearchHistory = [
    {
      availableCount: 2,
      bookId: "Seiton/readings/ノンフィクション/嫌われる勇気.md",
      bookUrl: "https://calil.jp/book/4478025819",
      checkedAt: "2026-09-14T00:00:00.000Z",
      isbn: "9784478025819",
      title: "嫌われる勇気",
    },
  ];
}
if (
  fixture === "calil-api-error" ||
  fixture === "calil-address-api-error" ||
  fixture === "calil-history"
) {
  window.open = (url) => {
    (
      window as Window & { __blockedExternalUrl?: string }
    ).__blockedExternalUrl = String(url ?? "");
    showNotice("UI Labでは外部リンクを開かずに遮断しました");
    return null;
  };
}

const requestedCreateType = params.get("type");
const initialCreateType =
  requestedCreateType && ITEM_TYPES.includes(requestedCreateType as ItemType)
    ? (requestedCreateType as ItemType)
    : undefined;
const initialCreatePresetId = params.get("preset") ?? undefined;

const root = document.createElement("div");
root.id = "harness-root";
document.body.appendChild(root);
const theme = params.get("theme") === "dark" ? "theme-dark" : "theme-light";
document.body.classList.add(theme);

const harnessNavigator = {
  open: async (
    destination: Exclude<SeitonAppDestination, "onboarding">,
    options?: {
      createPresetId?: string;
      createType?: ItemType;
      libraryList?: string;
    }
  ): Promise<void> => {
    const viewName = destination === "memoReview" ? "memo" : destination;
    const query = options?.libraryList
      ? `&list=${encodeURIComponent(options.libraryList)}`
      : "";
    const createType = options?.createType
      ? `&type=${encodeURIComponent(options.createType)}`
      : "";
    const createPreset = options?.createPresetId
      ? `&preset=${encodeURIComponent(options.createPresetId)}`
      : "";
    const demoFixture =
      fixture === "readme-demo" ? "&fixture=readme-demo&lang=ja" : "";
    window.location.href = `/?view=${viewName}${query}${createType}${createPreset}${demoFixture}`;
  },
};

// Playwright/Computer Useが本番境界を検証できるよう、全ルートで同じmock Vaultを公開する。
(window as unknown as Record<string, unknown>).__mockApp = mockApp;
(window as unknown as Record<string, unknown>).__harnessSettings =
  mockSettings.data;

const mountProductionRoute = (destination: SeitonAppDestination): void => {
  const settings = mockSettings.data as unknown as SeitonSettings;
  const boundary = createSeitonShadowBoundary(root);
  const loadData = async (
    ...args: Parameters<typeof loadReactProductionData>
  ) => {
    const data = await loadReactProductionData(...args);
    if (destination !== "bookshelf") {
      return data;
    }
    return {
      ...data,
      books: data.books.map((book) => ({
        ...book,
        coverUrl:
          fixture !== "book-api-error" &&
          fixture !== "calil-api-error" &&
          fixture !== "calil-address-api-error" &&
          book.isbn
            ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`
            : undefined,
      })),
    };
  };
  const platform = createObsidianProductionAdapter(mockApp as never, loadData);
  if (fixture === "home-action-errors") {
    const failHomeAction = async (): Promise<void> => {
      throw new Error("UI Lab: simulated home action failure");
    };
    platform.addHomeShortcut = failHomeAction;
    platform.addHomeShortcutFolder = failHomeAction;
    platform.createHomeList = failHomeAction;
    platform.saveHomeOrder = failHomeAction;
    platform.saveMemo = failHomeAction;
  }
  if (fixture === "book-operation-errors") {
    platform.openBook = async () => {
      throw new Error("UI Lab: simulated book-open failure");
    };
    platform.removeBookCover = async () => {
      throw new Error("UI Lab: simulated cover-removal failure");
    };
    platform.supplementBook = async () => {
      throw new Error("UI Lab: simulated metadata-supplement failure");
    };
  }
  if (fixture === "library-update-error") {
    platform.setLibraryLists = async () => {
      throw new Error("UI Lab: simulated list-update failure");
    };
  }
  if (fixture === "create-error") {
    const createFromHome = platform.createFromHome.bind(platform);
    let failFirstCreate = true;
    platform.createFromHome = async (...args) => {
      if (failFirstCreate) {
        failFirstCreate = false;
        throw new Error("UI Lab: simulated first create failure");
      }
      await createFromHome(...args);
    };
  }
  void mountSeitonApp(boundary.mountPoint, destination, {
    initialCreatePresetId,
    initialCreateType,
    initialLibraryList: params.get("list") ?? undefined,
    lang: detectLang(params.get("lang") ?? "ja"),
    navigator: harnessNavigator,
    platform,
    saveSettings: () => mockSettings.save(),
    settings,
  });
};

if (view === "home") {
  mountProductionRoute("home");
} else if (view === "library") {
  mountProductionRoute("library");
} else if (
  view === "search" ||
  view === "organize" ||
  view === "memo" ||
  view === "bookshelf" ||
  view === "create"
) {
  mountProductionRoute(view === "memo" ? "memoReview" : view);
} else if (view === "react-bookshelf") {
  mountProductionRoute("bookshelf");
} else if (view === "react-home") {
  mountProductionRoute("home");
} else if (view === "react-library") {
  mountProductionRoute("library");
} else if (view === "react-search") {
  mountProductionRoute("search");
} else if (view === "react-organize") {
  mountProductionRoute("organize");
} else if (view === "react-memo") {
  mountProductionRoute("memoReview");
} else if (view === "react-create") {
  mountProductionRoute("create");
} else if (view === "react-onboarding") {
  mountProductionRoute("onboarding");
} else if (view === "react-supporting") {
  const boundary = createSeitonShadowBoundary(root);
  void import("./react-supporting-prototype").then(
    ({ mountReactSupportingPrototype }) =>
      mountReactSupportingPrototype(boundary.mountPoint)
  );
} else if (view === "onboarding") {
  const settings = mockSettings.data as unknown as SeitonSettings;
  openReactOnboardingDialog(
    mockApp as never,
    settings,
    detectLang(params.get("lang") ?? navigator.language),
    async () => mockSettings.save()
  );
} else {
  const placeholder = document.createElement("div");
  placeholder.className = "harness-placeholder";
  const title = document.createElement("h1");
  title.textContent = "Seiton UI Harness";
  const message = document.createElement("p");
  message.textContent = `unknown view: ${view}`;
  placeholder.append(title, message);
  root.replaceChildren(placeholder);
}
