/** ノートタイプ10種（メニュー等の列挙用） */
export const ITEM_TYPES = [
  "class",
  "task",
  "reading",
  "idea",
  "article",
  "project",
  "webclip",
  "collection",
  "memo",
  "profile",
] as const;

/** ノートタイプの表示ラベル（日本語）とグループ */
export const ITEM_TYPE_LABELS: Record<string, string> = {
  article: "記事",
  class: "授業・セミナー",
  collection: "コレクション",
  idea: "アイデア",
  memo: "一言メモ",
  profile: "プロフィール",
  project: "プロジェクト",
  reading: "読書",
  task: "タスク",
  webclip: "クリップ",
};

/** ノートタイプのグループ分け（「+新規」の選択UI用） */
export const ITEM_TYPE_GROUPS: { group: string; types: string[] }[] = [
  { group: "学ぶ", types: ["class", "task", "reading"] },
  { group: "創る", types: ["idea", "article", "project"] },
  { group: "集める", types: ["webclip", "collection"] },
  { group: "日々の記録", types: ["memo"] },
  { group: "その他", types: ["profile"] },
];

/** デフォルトルートフォルダ名 */
export const DEFAULT_ROOT_FOLDER = "Seiton";

/** 未整理フォルダ名（言語中立プリセット） */
export const DEFAULT_INBOX_FOLDER = "inbox";

/** つぶやきフォルダ名（言語中立） */
export const DEFAULT_MEMOS_FOLDER = "Memos";

/** 本棚の基幹カテゴリ。カテゴリ名は保存先フォルダとデフォルトタグへ反映する。 */
export const DEFAULT_BOOK_CATEGORIES = [
  "フィクション",
  "ノンフィクション",
  "実用・ビジネス",
  "学術・専門",
  "詩歌・エッセイ",
  "マンガ・コミック",
  "未分類",
] as const;
export const DEFAULT_BOOK_CATEGORY = "未分類";

/** つぶやき月ファイルの日付形式（YYYY-MM） */
export const MONTH_FORMAT = "YYYY-MM";

/** リッチカードの vault 内キャッシュ先（ユーザーのノート領域とは分離する） */
export const RICH_CARD_CACHE_FOLDER = ".seiton/cache";

/** キャッシュ設定の初期値 */
export const DEFAULT_RICH_CARD_CACHE_MAX_BYTES = 50 * 1024 * 1024;
export const DEFAULT_RICH_CARD_CACHE_MAX_AGE_DAYS = 30;

/** ホームビューのview type */
export const VIEW_TYPE_HOME = "seiton-home";

/** 書庫ビュー（作業台/書庫分離 — タグ別の全ノート棚） */
export const VIEW_TYPE_LIBRARY = "seiton-library";

/** 専用検索ビュー */
export const VIEW_TYPE_SEARCH = "seiton-search";

/** 未整理を1件ずつ扱う整理ビュー */
export const VIEW_TYPE_ORGANIZE = "seiton-organize";

/** つぶやき振り返りビュー */
export const VIEW_TYPE_MEMO_REVIEW = "seiton-memo-review";

/** 読書記録専用の本棚ビュー */
export const VIEW_TYPE_BOOKSHELF = "seiton-bookshelf";

/** 一言メモ入力と、互換用の新規作成ビュー */
export const VIEW_TYPE_CREATE = "seiton-create";

/** 期間タブ（今日/今週/今月） */
export const MEMO_PERIODS: {
  value: "today" | "week" | "month";
  labelKey: string;
}[] = [
  { labelKey: "tab.today", value: "today" },
  { labelKey: "tab.week", value: "week" },
  { labelKey: "tab.month", value: "month" },
];

/** Obsidian公式の拡張カラー（暗い背景でも見やすい明るめの8色）。 */
export const EDITOR_COLORS = [
  "#fb464c",
  "#e9973f",
  "#e0de71",
  "#44cf6e",
  "#53dfdd",
  "#027aff",
  "#a882ff",
  "#fa99cd",
] as const;
