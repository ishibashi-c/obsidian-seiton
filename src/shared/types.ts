/**
 * Seiton 共通スキーマ（人間中心・AI互換の正本）
 * spec.md セクション3 のデータモデルに対応する型定義。
 */

/** ノートタイプ10種 */
export type ItemType =
  | "class"
  | "task"
  | "reading"
  | "idea"
  | "article"
  | "project"
  | "webclip"
  | "collection"
  | "memo"
  | "profile";

/** 状態 */
export type ItemStatus = "inbox" | "active" | "archive";

/** Archive directory plus the original location needed for safe restoration. */
export interface ArchiveFolderMove {
  archivedPath: string;
  originalPath: string;
  type: Exclude<ItemType, "memo">;
}

/** Individual note moved to the dedicated archive, with its restoration state. */
export interface ArchiveNoteMove {
  archivedPath: string;
  originalPath: string;
  previousStatus: Exclude<ItemStatus, "archive">;
  type: Exclude<ItemType, "memo">;
}

/** 収集物のfrontmatter（全ノート共通スキーマ） */
export interface SeitonItem {
  /** 収集日時 ISO8601 */
  created: string;
  /** リスト（手動キュレーション・主観分類） */
  lists?: string[];
  /** 元URL（webclip のみ） */
  source?: string;
  /** 取得元・形式の補助メタデータ（旧名baseTagsは読込時に移行） */
  sourceTags?: string[];
  /** 状態 */
  status: ItemStatus;
  /** 内容タグ（階層可・いくつでも・客観分類） */
  tags?: string[];
  /** 執筆タイプ（入力時に決まる） */
  type: ItemType;
  /** プラグイン内拡張キー（本棚フィールド等・parseItemが保持する） */
  [key: string]: unknown;
}

/** つぶやき1行（月ファイル内の `- HH:MM 内容 #タグ`） */
export interface MemoLine {
  /** 内容（タグを除く） */
  content: string;
  /** 行内タグ */
  tags: string[];
  /** 時刻 HH:MM */
  time: string;
}

/** つぶやき月ファイルの本文行（ラウンドトリップを保つ表現） */
export type MonthBodyLine =
  | { kind: "heading"; day: string; raw: string }
  | {
      kind: "memo";
      day: string | null;
      time: string;
      content: string;
      tags: string[];
      raw: string;
    }
  | { kind: "other"; raw: string };

/** つぶやき月ファイル全体 */
export interface MonthFile {
  /** 本文行（frontmatter除く・順序保持） */
  lines: MonthBodyLine[];
  /** month: YYYY-MM */
  month: string;
}

/** 今日/今週/今月の期間 */
export type MemoPeriod = "today" | "week" | "month";

/** 表示形式（カード/リスト） */
export type ViewMode = "card" | "list";
export type LibraryBrowseMode = "items" | "tags";
export type LibrarySort = "modified" | "created" | "title" | "type";

/** タグビューの並び順 */
export type TagSort = "usage" | "alpha";

/** ホームのセクション並び順のキー（設定で変更可） */
export type HomeSectionKey =
  | "capture"
  | "today"
  | "pinned"
  | "inbox"
  | "lists"
  | "tags"
  | "shortcuts";

/** ショートカットリンク（ホームのリンク集・spec §6.2） */
export type ShortcutKind = "url" | "note" | "folder" | "command" | "view";

export interface ShortcutLink {
  /** グループ名（空=グループなし） */
  group: string;
  kind: ShortcutKind;
  /** URL、Vault path、command ID、Seiton destinationのいずれか */
  target: string;
  /** 表示名 */
  title: string;
}

/** 新規作成で保存先フォルダとタグをまとめて適用する固定プリセット。 */
export interface CreatePreset {
  id: string;
  label: string;
  subfolder: string;
  tags: string[];
  type: ItemType;
}

/** ツールバーの色並び（設定に保存） */
export type EditorColorOrder = "default" | "warm" | "cool";

/** タイプ別フォルダ名（memoは memosFolder と共通のため除外） */
export type TypeFolders = Record<Exclude<ItemType, "memo">, string>;

/** 個別に無効化できる追加機能 */
export interface FeatureModules {
  agentGuide: boolean;
  bookshelf: boolean;
  editorToolbar: boolean;
  memos: boolean;
  richCards: boolean;
}

/** 検索基盤の設定 */
export interface SearchSettings {
  additionalFolders: string[];
  historyEnabled: boolean;
  includeMemos: boolean;
  maxHistory: number;
}

export type SharedTextDefault = "memo" | "idea";

/** 表示状態の記憶（spec: 決定61・66 — data.jsonに保存・復元） */
export interface ViewState {
  /** 期間タブ（今日/今週/今月） */
  period: MemoPeriod;
  /** スクロール位置 */
  scrollTop: number;
  /** 表示形式（カード/リスト） */
  viewMode: ViewMode;
}

/** プラグイン設定（data.json） */
export interface SeitonSettings {
  /** アーカイブされた文脈フォルダのVault内パス（ノートのfrontmatterは変更しない）。 */
  archivedFolders: string[];
  /** 専用アーカイブフォルダへ移動した文脈と、復元先の記録。 */
  archiveFolderMoves: ArchiveFolderMove[];
  /** Individual notes moved to the dedicated archive and their restoration paths. */
  archiveNoteMoves: ArchiveNoteMove[];
  /** 本棚の基幹カテゴリ（保存先フォルダとデフォルトタグに使う） */
  bookCategories: string[];
  bookCoverCacheEnabled: boolean;
  /** 本棚から開く本の詳細を最初の詳細タブへ再利用する */
  bookDetailTabReuseEnabled: boolean;
  /** カーリル図書館APIのユーザー自身のアプリケーションキー */
  calilAppKey: string;
  /** カーリル検索対象と距離検索の基準地点にする市区町村 */
  calilCity: string;
  /** カーリル検索対象の都道府県 */
  calilPrefecture: string;
  /** カーリルの距離検索に使う基準地点の緯度 */
  calilReferenceLatitude: number | null;
  /** カーリルの距離検索に使う基準地点の経度 */
  calilReferenceLongitude: number | null;
  /** 本棚から行ったカーリル検索の端末内履歴 */
  calilSearchHistory: Array<{
    availableCount: number;
    bookId: string;
    bookUrl: string;
    checkedAt: string;
    isbn: string;
    title: string;
  }>;
  /** ツールバーの色の並び */
  editorColorOrder: EditorColorOrder;
  /** ツールバーに固定表示する色（空なら全色） */
  editorPinnedColors: string[];
  /** 最近使った色 */
  editorRecentColors: string[];
  /** 新規作成UIに表示するタイプ */
  enabledTypes: ItemType[];
  /** 検索からアーカイブも完全に除外 */
  excludeArchivedFromSearch: boolean;
  /** ホームに表示しないセクション（todayはクイックキャプチャ） */
  hiddenHomeSections: HomeSectionKey[];
  /** ホームのセクション並び順（上から順・未指定キーは末尾に既定順で追加） */
  homeSectionOrder: HomeSectionKey[];
  /** 未整理フォルダ */
  inboxFolder: string;
  libraryBrowseMode: LibraryBrowseMode;
  librarySort: LibrarySort;
  libraryViewMode: ViewMode;
  /** リストの折りたたみ開閉状態を記憶する（list名 → open） */
  listFoldState: Record<string, boolean>;
  listNames: string[];
  /** つぶやきフォルダ */
  memosFolder: string;
  /** ホームの一言メモで選択できるタグ候補 */
  memoTagOptions: string[];
  /** 個別に無効化できる追加機能 */
  modules: FeatureModules;
  onboardingCompleted: boolean;
  /** ピン留め（特別なリスト・ファイルパス） */
  pinned: string[];
  /** 新規作成で保存先とタグをまとめて適用するプリセット */
  pinnedCreatePresets: CreatePreset[];
  /** 新規作成で先に表示するタイプ */
  pinnedTypes: ItemType[];
  /** 新規作成で最近使ったタイプ（新しい順） */
  recentTypes: ItemType[];
  /** @deprecated schema v6互換読込専用。同期製品のignore fileは変更しない。 */
  richCardCacheExcludeFromSync?: boolean;
  /** リッチカードキャッシュの保持期間（日） */
  richCardCacheMaxAgeDays: number;
  /** リッチカードキャッシュの上限（バイト） */
  richCardCacheMaxBytes: number;
  /** リッチカード取得を行わないdomain（完全一致またはsubdomain） */
  richCardDisabledDomains: string[];
  /** リッチカードを取得する追加フォルダ（ルートからの相対パス） */
  richCardFolders: string[];
  /** ルートフォルダ（設定で変更可） */
  rootFolder: string;
  /** 設定migrationのversion */
  schemaVersion: number;
  /** 専用検索画面の設定 */
  search: SearchSettings;
  /** 端末内だけに保存する検索履歴 */
  searchHistory: string[];
  /** URLを含まない共有テキストの保存先 */
  sharedTextDefault: SharedTextDefault;
  /** ホームのショートカットフォルダ（空のフォルダも保持する） */
  shortcutGroups: string[];
  /** ホームのショートカットリンク集（Chrome新規タブ風・spec §6.2） */
  shortcuts: ShortcutLink[];
  /** タグ正規化エイリアステーブル */
  tagAliases: Record<string, string[]>;
  /** タグビュー並び順 */
  tagSort: TagSort;
  /** 新規作成画面で使うテンプレート（空なら内蔵値） */
  templates: Partial<Record<ItemType, string>>;
  /** タイプ別フォルダ（空ならデフォルト・設定で変更可） */
  typeFolders: Partial<TypeFolders>;
  /** 新規作成UIのタイプ順 */
  typeOrder: ItemType[];
  uiLanguage:
    | "auto"
    | "ja"
    | "en"
    | "zh-CN"
    | "ko"
    | "es"
    | "pt-BR"
    | "fr"
    | "de";
  /** 表示状態の記憶 */
  viewState: ViewState;
}

/** インデックスされた収集物（ホーム表示用） */
export interface IndexedItem {
  /** 本文（frontmatter除く） */
  body: string;
  /** frontmatter */
  item: SeitonItem;
  /** Vaultの更新時刻。永続frontmatterには書き込まない。 */
  modified?: number;
  /** vault内パス */
  path: string;
  /** タイトル（ファイル名） */
  title: string;
}

/** タグビューのタグセクション */
export interface TagSection {
  count: number;
  items: IndexedItem[];
  tag: string;
}

/** リストセクション */
export interface ListSection {
  count: number;
  items: IndexedItem[];
  name: string;
}
