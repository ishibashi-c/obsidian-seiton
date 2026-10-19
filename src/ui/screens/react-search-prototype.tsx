/** @jsxImportSource react */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import {
  isSearchDateRangeReversed,
  type RankedSearchResult,
  rankDocuments,
  type SearchDocument,
} from "../../shared/search";
import { mostFrequentTags, normalizeTagInput } from "../../shared/tags";
import type { ItemType } from "../../shared/types";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { TagSuggestionChips } from "../patterns/TagSuggestionChips";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  IconButton,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

const TYPE_LABEL_KEYS: Record<ItemType, MessageKey> = {
  article: "type.article",
  class: "type.class",
  collection: "type.collection",
  idea: "type.idea",
  memo: "type.memo",
  profile: "type.profile",
  project: "type.project",
  reading: "type.reading",
  task: "type.task",
  webclip: "type.webclip",
};

function typeLabel(lang: Lang, type: ItemType): string {
  return t(lang, TYPE_LABEL_KEYS[type]);
}

function parseTagInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map(normalizeTagInput)
        .filter(Boolean)
    ),
  ];
}

const SEARCH_DOCUMENTS: SearchDocument[] = [
  {
    body: "部品とトークンを一貫させるための読書記録。検索結果ではタイトルと本文の一致箇所を確認できます。",
    created: "2026-08-10T12:00:00",
    id: "note-design-system",
    kind: "note",
    lists: ["お気に入り", "読書メモ"],
    modified: Date.parse("2026-08-25T12:00:00"),
    path: "Seiton/reading/デザインシステム入門.md",
    sourceTags: ["book"],
    status: "active",
    tags: ["デザイン", "UI"],
    title: "デザインシステム入門の読書記録",
    type: "reading",
  },
  {
    body: "TypeScriptの型を機能境界に置く。検索では表記ゆれを正規化して、タイプスクリプトでも TypeScript でも同じ結果を確認する。",
    created: "2026-08-21T09:30:00",
    id: "note-typescript",
    kind: "note",
    lists: ["お気に入り"],
    modified: Date.parse("2026-08-24T09:30:00"),
    path: "Seiton/clips/タイプスクリプト実践メモ.md",
    sourceTags: ["web"],
    status: "active",
    tags: ["テック/AI", "開発"],
    title: "タイプスクリプト実践メモ",
    type: "webclip",
  },
  {
    body: "日本語入力、全角半角、ひらがなとカタカナ、ISBNのハイフンを検索前に正規化する。結果画面では一致したフィールド、最適な抜粋、その他の一致箇所を分けて表示する。",
    created: "2026-08-20T10:00:00",
    id: "note-search-long",
    kind: "note",
    lists: ["今週見る"],
    modified: Date.parse("2026-08-23T10:00:00"),
    path: "Seiton/tasks/検索の読み正規化バグ修正と結果表示の検証項目.md",
    sourceTags: [],
    status: "inbox",
    tags: ["開発", "検索"],
    title: "検索の読み正規化バグ修正と結果表示の検証項目",
    type: "task",
  },
  {
    body: "章ごとの要点と、あとで読み返したい箇所。読書メモとして保存し、生活に関するタグを付けた。",
    created: "2026-08-19T08:00:00",
    id: "note-reading-info",
    kind: "note",
    lists: ["読書メモ"],
    modified: Date.parse("2026-08-22T08:00:00"),
    path: "Seiton/reading/情報は眼により章立てメモ.md",
    sourceTags: ["book"],
    status: "active",
    tags: ["生活", "読書"],
    title: "情報は眼により章立てメモ",
    type: "reading",
  },
  {
    body: "以前の検索仕様。アーカイブを含めると検索結果に表示される。",
    created: "2026-07-28T11:00:00",
    id: "note-archived",
    kind: "note",
    lists: [],
    modified: Date.parse("2026-07-28T11:00:00"),
    path: "Seiton/archive/旧検索仕様.md",
    sourceTags: [],
    status: "archive",
    tags: ["検索", "設計"],
    title: "検索仕様の旧版",
    type: "article",
  },
  {
    body: "検索結果の説明は短くして、必要なら本文の一致箇所を展開する。",
    created: "2026-08-22T22:14:00",
    id: "memo-search-review",
    kind: "memo",
    lists: [],
    modified: Date.parse("2026-08-22T22:14:00"),
    path: "Seiton/Memos/2026-08.md",
    sourceTags: [],
    tags: ["UI", "検索"],
    title: "2026-08-22 22:14",
  },
  {
    body: "Seitonの外部フォルダにあるMarkdown。frontmatterがなくてもファイル名と本文を検索対象にする。",
    id: "external-meeting",
    kind: "external",
    lists: [],
    modified: Date.parse("2026-08-18T15:00:00"),
    path: "03_資料/会議で出たキーワードの羅列.md",
    sourceTags: ["additional-folder"],
    tags: [],
    title: "会議で出たキーワードの羅列",
  },
  {
    body: "AIに自動分類を任せる場合でも、削除ではなく候補提示と確認を先に行う。",
    created: "2026-08-17T13:00:00",
    id: "note-agent",
    kind: "note",
    lists: ["あとで読む"],
    modified: Date.parse("2026-08-17T13:00:00"),
    path: "Seiton/ideas/未整理ノートの候補を提示する仕組み.md",
    sourceTags: [],
    status: "inbox",
    tags: ["AI", "整理"],
    title: "未整理ノートの候補を提示する仕組み",
    type: "idea",
  },
];

const HISTORY = ["タイプスクリプト", "読書", "tag:検索", "外部フォルダ"];

function formatDate(date?: string): string {
  return date ? date.slice(0, 10).replace(/-/g, ".") : "作成日なし";
}

function labelForResult(result: RankedSearchResult, lang: Lang): string {
  if (result.document.kind === "external") {
    return t(lang, "search.external");
  }
  if (result.document.kind === "memo") {
    return t(lang, "search.memo");
  }
  return result.document.type
    ? typeLabel(lang, result.document.type)
    : t(lang, "common.untitled");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const terms =
    query
      .match(/[\p{L}\p{N}_/-]{2,}/gu)
      ?.filter((term) => !term.includes(":")) ?? [];
  if (!terms.length) {
    return <>{text}</>;
  }
  const expression = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "giu"
  );
  let markCount = 0;
  return (
    <>
      {text.split(expression).map((part, index) => {
        if (index % 2 === 0) {
          return part;
        }
        const key = `${part}-${markCount}`;
        markCount += 1;
        return <mark key={key}>{part}</mark>;
      })}
    </>
  );
}

function ResultMatchBadges({ result }: { result: RankedSearchResult }) {
  const labels: Record<string, string> = {
    body: "本文一致",
    metadata: "メタデータ一致",
    title: "タイトル一致",
  };
  return (
    <section aria-label="一致した場所" className="react-search-match-badges">
      {result.matchedFields.map((field) => (
        <Badge
          color={field === "title" ? "accent" : "gray"}
          key={field}
          variant="light"
        >
          {labels[field] ?? field}
        </Badge>
      ))}
    </section>
  );
}

type SearchEditKind = "tags" | "type" | "lists";

function ResultCard({
  lang,
  result,
  query,
  onOpen,
  onAction,
  onEdit,
  onArchive,
  onTogglePin,
}: {
  lang: Lang;
  result: RankedSearchResult;
  query: string;
  onOpen: (result: RankedSearchResult) => void;
  onAction: (message: string) => void;
  onEdit: (
    result: RankedSearchResult,
    kind: SearchEditKind,
    trigger: HTMLButtonElement
  ) => void;
  onArchive?: (result: RankedSearchResult, trigger: HTMLButtonElement) => void;
  archiveDestination?: (result: RankedSearchResult) => string;
  onTogglePin?: (result: RankedSearchResult) => void | Promise<void>;
}) {
  const { document } = result;
  const prioritizedTags = [
    ...result.matchedTags,
    ...document.tags.filter((tag) => !result.matchedTags.includes(tag)),
  ];
  const visibleTags = prioritizedTags.slice(0, 3);
  const additionalTagCount = prioritizedTags.length - visibleTags.length;
  const [expanded, setExpanded] = useState(false);
  const isExternal = document.kind === "external";
  const isMemo = document.kind === "memo";

  return (
    <article className="react-search-result" data-kind={document.kind}>
      <button
        className="react-search-result-open"
        onClick={() => onOpen(result)}
        type="button"
      >
        <div className="react-search-result-topline">
          <Badge color={isExternal ? "gray" : "accent"} variant="light">
            {labelForResult(result, lang)}
          </Badge>
          <time dateTime={document.created}>
            {formatDate(document.created)}
          </time>
          {document.status ? (
            <Badge
              color={document.status === "archive" ? "gray" : "ink"}
              variant="outline"
            >
              {document.status === "archive"
                ? t(lang, "action.archive")
                : document.status === "inbox"
                  ? t(lang, "inbox.section")
                  : t(lang, "action.done")}
            </Badge>
          ) : null}
        </div>
        <h3 className="react-search-result-title">
          <Highlight query={query} text={document.title} />
        </h3>
        <div className="react-search-result-metadata">
          <ResultMatchBadges result={result} />
          {document.tags.length > 0 && (
            <section aria-label="タグ" className="react-search-result-tags">
              {visibleTags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
              {additionalTagCount > 0 && (
                <span className="react-search-result-tags-more">
                  {t(lang, "search.additionalTags", {
                    count: String(additionalTagCount),
                  })}
                </span>
              )}
            </section>
          )}
        </div>
        <p className="react-search-result-excerpt">
          <Highlight query={query} text={result.excerpt} />
        </p>
        <span aria-hidden="true" className="react-search-result-destination">
          ノートを開く <span>→</span>
        </span>
      </button>

      <div className="react-search-result-detail">
        <button
          aria-expanded={expanded}
          className="react-search-detail-toggle"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span>
            {expanded ? "一致箇所と操作を閉じる" : "一致箇所と操作を表示"}
          </span>
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        {Boolean(expanded) && (
          <div className="react-search-detail-body">
            <div className="react-search-detail-copy">
              <Text fw={700} size="sm">
                本文
              </Text>
              <p>
                <Highlight query={query} text={document.body} />
              </p>
            </div>
            <section
              aria-label="結果の操作"
              className="react-search-detail-actions"
            >
              {isExternal ? (
                <Text className="react-search-muted" size="sm">
                  追加検索フォルダのノートです。内容は変更せず、上のカードから元ファイルを開けます。
                </Text>
              ) : isMemo ? (
                <Text className="react-search-muted" size="sm">
                  一言メモの編集は振り返り画面で行います。
                </Text>
              ) : (
                <>
                  <Button
                    onClick={(event) =>
                      onEdit(result, "tags", event.currentTarget)
                    }
                    size="sm"
                    variant="default"
                  >
                    タグ
                  </Button>
                  <Button
                    onClick={(event) =>
                      onEdit(result, "type", event.currentTarget)
                    }
                    size="sm"
                    variant="default"
                  >
                    タイプ
                  </Button>
                  <Button
                    onClick={(event) =>
                      onEdit(result, "lists", event.currentTarget)
                    }
                    size="sm"
                    variant="default"
                  >
                    リスト
                  </Button>
                  <IconButton
                    filled={Boolean(document.pinned)}
                    icon="pin"
                    label={`${document.title}: ${t(lang, "menu.pin")}`}
                    onClick={() => void onTogglePin?.(result)}
                    pressed={Boolean(document.pinned)}
                    size="sm"
                    title={t(lang, document.pinned ? "menu.unpin" : "menu.pin")}
                    variant="default"
                  />
                  <Button
                    onClick={(event) =>
                      onArchive
                        ? onArchive(result, event.currentTarget)
                        : onAction("アーカイブを設定します")
                    }
                    size="sm"
                    variant="default"
                  >
                    アーカイブ
                  </Button>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </article>
  );
}

export function ReactSearchSurface({
  lang = "ja",
  scheme,
  documents = SEARCH_DOCUMENTS,
  history: initialHistory = HISTORY,
  historyEnabled = true,
  maxHistory = 10,
  excludeArchived = false,
  tagAliases,
  listNames,
  typeOptions,
  onOpen,
  onSetTags,
  onChangeType,
  onSetLists,
  onArchive,
  archiveDestination,
  onTogglePin,
  onSaveHistory,
}: {
  lang?: Lang;
  scheme: ColorScheme;
  documents?: SearchDocument[];
  history?: string[];
  historyEnabled?: boolean;
  maxHistory?: number;
  excludeArchived?: boolean;
  tagAliases?: Record<string, string[]>;
  listNames?: string[];
  typeOptions?: ItemType[];
  onOpen?: (result: RankedSearchResult) => void | Promise<void>;
  onSetTags?: (
    result: RankedSearchResult,
    tags: string[]
  ) => void | Promise<void>;
  onChangeType?: (
    result: RankedSearchResult,
    type: ItemType
  ) => string | undefined | Promise<string | undefined>;
  onSetLists?: (
    result: RankedSearchResult,
    lists: string[]
  ) => void | Promise<void>;
  onArchive?: (
    result: RankedSearchResult
  ) => string | void | Promise<string> | Promise<void>;
  archiveDestination?: (result: RankedSearchResult) => string;
  onTogglePin?: (result: RankedSearchResult) => void | Promise<void>;
  onSaveHistory?: (history: string[]) => void | Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dateRangeErrorId = useId();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const searchQueryInputRef = useRef<HTMLInputElement | null>(null);
  const historyRemoveButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const historyFocusTargetRef = useRef<string | null | undefined>(undefined);
  const archiveTriggerRef = useRef<HTMLButtonElement | null>(null);
  const focusQueryAfterArchiveRef = useRef(false);
  const focusArchiveFilterAfterRevealRef = useRef(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [allTags, setAllTags] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState(initialHistory);
  const [historySaving, setHistorySaving] = useState(false);
  const [localDocuments, setLocalDocuments] = useState(documents);
  const [activeAction, setActiveAction] = useState<{
    result: RankedSearchResult;
    kind: SearchEditKind;
  } | null>(null);
  const [draftTags, setDraftTags] = useState("");
  const draftTagsInputRef = useRef<HTMLInputElement | null>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [draftType, setDraftType] = useState<ItemType | null>(null);
  const [draftLists, setDraftLists] = useState<string[]>([]);
  const [actionSaving, setActionSaving] = useState(false);
  const [pendingArchive, setPendingArchive] =
    useState<RankedSearchResult | null>(null);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const reduceMotion = useReducedMotion();
  const dateRangeInvalid = isSearchDateRangeReversed(after, before);

  useEffect(() => {
    if (rootRef.current) {
      setPortalTarget(rootRef.current);
    }
  }, []);
  useEffect(() => setHistory(initialHistory), [initialHistory]);
  useEffect(() => setLocalDocuments(documents), [documents]);
  useEffect(() => {
    if (!focusQueryAfterArchiveRef.current) {
      return;
    }
    focusQueryAfterArchiveRef.current = false;
    window.requestAnimationFrame(() => searchQueryInputRef.current?.focus());
  });
  useEffect(() => {
    if (!focusArchiveFilterAfterRevealRef.current) {
      return;
    }
    focusArchiveFilterAfterRevealRef.current = false;
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLInputElement>(
          ".react-search-option-row input[type='checkbox']"
        )
        ?.focus()
    );
  });
  useEffect(() => {
    const target = historyFocusTargetRef.current;
    if (target === undefined || historySaving) {
      return;
    }
    historyFocusTargetRef.current = undefined;
    const focusTarget =
      typeof target === "string" && history.includes(target) ? target : null;
    window.requestAnimationFrame(() => {
      const targetElement = focusTarget
        ? historyRemoveButtonRefs.current.get(focusTarget)
        : null;
      (targetElement ?? searchQueryInputRef.current)?.focus();
    });
  }, [history, historySaving]);

  const fullQuery = [
    query.trim(),
    type ? `type:${type}` : "",
    after ? `after:${after}` : "",
    before ? `before:${before}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const results = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : rankDocuments(localDocuments, fullQuery, {
            allTags,
            includeArchived: !excludeArchived && includeArchived,
            tagAliases,
          }),
    [
      allTags,
      dateRangeInvalid,
      excludeArchived,
      fullQuery,
      includeArchived,
      localDocuments,
      tagAliases,
    ]
  );
  const hasConditions = Boolean(fullQuery);
  const enteredTags = useMemo(() => parseTagInput(draftTags), [draftTags]);
  const frequentTags = useMemo(
    () =>
      mostFrequentTags(
        localDocuments.map((document) => document.tags),
        5
      ),
    [localDocuments]
  );

  const announce = (message: string): void => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  };

  const persistHistory = async (nextHistory: string[]): Promise<void> => {
    if (historySaving) {
      return;
    }
    const previousHistory = history;
    setHistorySaving(true);
    setHistory(nextHistory);
    try {
      await onSaveHistory?.(nextHistory);
    } catch {
      setHistory(previousHistory);
      announce(t(lang, "search.historySaveFailed"));
    } finally {
      setHistorySaving(false);
    }
  };

  const clearConditions = (): void => {
    setQuery("");
    setType(null);
    setAfter("");
    setBefore("");
    setIncludeArchived(false);
    setAllTags(false);
    window.requestAnimationFrame(() => searchQueryInputRef.current?.focus());
  };

  const availableLists = useMemo(
    () =>
      [
        ...new Set([
          ...(listNames ?? []),
          ...localDocuments.flatMap((document) => document.lists),
        ]),
      ].sort((left, right) => left.localeCompare(right, "ja")),
    [listNames, localDocuments]
  );
  const availableTypes =
    typeOptions ?? (Object.keys(TYPE_LABEL_KEYS) as ItemType[]);

  const openAction = (
    result: RankedSearchResult,
    kind: SearchEditKind,
    trigger: HTMLButtonElement
  ): void => {
    actionTriggerRef.current = trigger;
    setActiveAction({ kind, result });
    setDraftTags(result.document.tags.join(", "));
    setDraftType(result.document.type ?? "idea");
    setDraftLists([...result.document.lists]);
  };

  const saveAction = async (): Promise<void> => {
    if (!activeAction) {
      return;
    }
    setActionSaving(true);
    try {
      const nextTags = parseTagInput(draftTags);
      if (activeAction.kind === "tags") {
        await onSetTags?.(activeAction.result, nextTags);
        setLocalDocuments((current) =>
          current.map((document) =>
            document.id === activeAction.result.document.id
              ? { ...document, tags: nextTags }
              : document
          )
        );
      }
      if (activeAction.kind === "type" && draftType) {
        const nextPath = await onChangeType?.(activeAction.result, draftType);
        setLocalDocuments((current) =>
          current.map((document) =>
            document.id === activeAction.result.document.id
              ? {
                  ...document,
                  path: nextPath ?? document.path,
                  type: draftType,
                }
              : document
          )
        );
      }
      if (activeAction.kind === "lists") {
        await onSetLists?.(activeAction.result, draftLists);
        setLocalDocuments((current) =>
          current.map((document) =>
            document.id === activeAction.result.document.id
              ? { ...document, lists: draftLists }
              : document
          )
        );
      }
      setActiveAction(null);
      announce(
        activeAction.kind === "tags"
          ? "タグを保存しました"
          : activeAction.kind === "type"
            ? "タイプを変更しました"
            : "リストを保存しました"
      );
    } catch {
      announce("変更を保存できませんでした");
    } finally {
      setActionSaving(false);
    }
  };

  const togglePin = async (result: RankedSearchResult): Promise<void> => {
    const nextPinned = !result.document.pinned;
    try {
      await onTogglePin?.({
        ...result,
        document: { ...result.document, pinned: nextPinned },
      });
      setLocalDocuments((current) =>
        current.map((document) =>
          document.id === result.document.id
            ? { ...document, pinned: nextPinned }
            : document
        )
      );
      announce(
        `${t(lang, nextPinned ? "action.pin" : "action.unpin")}: ${result.document.title}`
      );
    } catch {
      announce("ピン留めを更新できませんでした");
    }
  };

  const addDraftTag = (tag: string): void => {
    const normalized = normalizeTagInput(tag);
    if (!normalized || enteredTags.includes(normalized)) {
      return;
    }
    setDraftTags([...enteredTags, normalized].join(", "));
  };

  const recordHistory = (): void => {
    if (!historyEnabled || historySaving) {
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const next = [
      trimmed,
      ...history.filter((value) => value !== trimmed),
    ].slice(0, Math.max(0, maxHistory));
    void persistHistory(next);
  };

  const removeHistoryItem = (value: string): void => {
    if (historySaving) {
      return;
    }
    const index = history.indexOf(value);
    if (index < 0) {
      return;
    }
    const nextHistory = history.filter((item) => item !== value);
    historyFocusTargetRef.current = nextHistory.length
      ? nextHistory[Math.min(index, nextHistory.length - 1)]
      : null;
    void persistHistory(nextHistory);
  };

  const clearSearchHistory = (): void => {
    if (historySaving || history.length === 0) {
      return;
    }
    historyFocusTargetRef.current = null;
    void persistHistory([]);
  };

  const archiveResult = (
    result: RankedSearchResult,
    trigger: HTMLButtonElement
  ): void => {
    if (!onArchive) {
      announce("アーカイブを設定します");
      return;
    }
    archiveTriggerRef.current = trigger;
    setPendingArchive(result);
    setArchiveError("");
  };

  const confirmArchiveResult = async (): Promise<void> => {
    const result = pendingArchive;
    if (!(result && onArchive) || archiveSaving) {
      return;
    }
    setArchiveSaving(true);
    setArchiveError("");
    try {
      const archivedPath = await onArchive(result);
      if (!includeArchived) {
        focusQueryAfterArchiveRef.current = true;
      }
      setLocalDocuments((current) =>
        current.map((document) =>
          document.id === result.document.id
            ? {
                ...document,
                id: archivedPath ?? document.id,
                path: archivedPath ?? document.path,
                status: "archive",
              }
            : document
        )
      );
      announce("アーカイブに移しました");
      setPendingArchive(null);
    } catch (error) {
      setArchiveError(
        error instanceof Error ? error.message : "アーカイブに移せませんでした"
      );
    } finally {
      setArchiveSaving(false);
    }
  };
  const pendingArchiveDestination =
    pendingArchive && archiveDestination
      ? archiveDestination(pendingArchive)
      : "";

  return (
    <div
      className="seiton-react-search-prototype"
      data-scheme={scheme}
      ref={rootRef}
    >
      <header className="react-search-header">
        <div>
          <Title className="react-search-heading" order={1}>
            {t(lang, "search.title")}
          </Title>
        </div>
      </header>

      <main>
        <section
          aria-label={t(lang, "search.title")}
          className="react-search-controls"
        >
          <div className="react-search-section-heading">
            <Text className="react-search-control-note" size="sm">
              {t(lang, "search.indexCount", {
                count: `${localDocuments.length}`,
              })}
            </Text>
          </div>

          <TextInput
            aria-label={t(lang, "search.placeholder")}
            className="react-search-query"
            label={t(lang, "search.placeholder")}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                recordHistory();
              }
            }}
            placeholder={t(lang, "search.placeholder")}
            ref={searchQueryInputRef}
            value={query}
          />
          <div className="react-search-filter-grid">
            <Select
              aria-label={t(lang, "menu.type")}
              clearable
              comboboxProps={{ withinPortal: false }}
              data={availableTypes.map((value) => ({
                label: typeLabel(lang, value),
                value,
              }))}
              label={t(lang, "menu.type")}
              onChange={setType}
              placeholder={t(lang, "search.allTypes")}
              value={type}
            />
            <label className="react-search-date-field">
              <span>{t(lang, "search.after")}</span>
              <input
                aria-describedby={
                  dateRangeInvalid ? dateRangeErrorId : undefined
                }
                aria-invalid={dateRangeInvalid || undefined}
                aria-label={t(lang, "search.after")}
                max={before || undefined}
                onChange={(event) => setAfter(event.currentTarget.value)}
                type="date"
                value={after}
              />
            </label>
            <label className="react-search-date-field">
              <span>{t(lang, "search.before")}</span>
              <input
                aria-describedby={
                  dateRangeInvalid ? dateRangeErrorId : undefined
                }
                aria-invalid={dateRangeInvalid || undefined}
                aria-label={t(lang, "search.before")}
                min={after || undefined}
                onChange={(event) => setBefore(event.currentTarget.value)}
                type="date"
                value={before}
              />
            </label>
          </div>
          {dateRangeInvalid && (
            <p
              className="react-search-date-error seiton-ui-field-error"
              id={dateRangeErrorId}
              role="alert"
            >
              {t(lang, "search.invalidDateRange")}
            </p>
          )}
          <div className="react-search-option-row">
            {!excludeArchived && (
              <Checkbox
                checked={includeArchived}
                label={t(lang, "search.includeArchived")}
                onChange={(event) =>
                  setIncludeArchived(event.currentTarget.checked)
                }
              />
            )}
            <Checkbox
              checked={allTags}
              label={t(lang, "search.allTags")}
              onChange={(event) => setAllTags(event.currentTarget.checked)}
            />
            <Button
              disabled={!(hasConditions || includeArchived || allTags)}
              onClick={clearConditions}
              size="sm"
              variant="default"
            >
              {t(lang, "search.clear")}
            </Button>
          </div>
          <div className="react-search-syntax-note">
            <Text size="sm">
              {t(lang, "search.operatorHint")}:{" "}
              <code>{t(lang, "search.operatorTag")}</code>{" "}
              <code>{t(lang, "search.operatorList")}</code>{" "}
              <code>{t(lang, "search.operatorExclude")}</code>{" "}
              <code>{t(lang, "search.operatorPhrase")}</code>
            </Text>
          </div>
          {Boolean(historyEnabled && history.length > 0) && (
            <section
              aria-label={t(lang, "search.history")}
              className="react-search-history"
            >
              <div className="react-search-history-header">
                <Text fw={700} size="sm">
                  {t(lang, "search.history")}
                </Text>
                {history.length > 0 && (
                  <Button
                    disabled={historySaving}
                    onClick={clearSearchHistory}
                    size="xs"
                    variant="default"
                  >
                    {t(lang, "search.clearHistory")}
                  </Button>
                )}
              </div>
              <div className="react-search-history-items">
                {history.map((value) => (
                  <div className="react-search-history-item" key={value}>
                    <button
                      className="react-search-history-item-query"
                      disabled={historySaving}
                      onClick={() => setQuery(value)}
                      type="button"
                    >
                      {value}
                    </button>
                    <button
                      aria-label={t(lang, "search.removeHistoryItem", {
                        query: value,
                      })}
                      className="react-search-history-item-remove"
                      disabled={historySaving}
                      onClick={() => removeHistoryItem(value)}
                      ref={(element) => {
                        if (element) {
                          historyRemoveButtonRefs.current.set(value, element);
                        } else {
                          historyRemoveButtonRefs.current.delete(value);
                        }
                      }}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <section
          aria-labelledby="react-search-results-title"
          className="react-search-results"
        >
          <div className="react-search-section-heading">
            <div>
              <Title id="react-search-results-title" order={2} size="h3">
                {t(lang, "search.results")}
              </Title>
            </div>
            <Badge color="ink" variant="outline">
              {t(lang, "empty.noSearch", { count: `${results.length}` })}
            </Badge>
          </div>

          {hasConditions ? (
            results.length === 0 ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="react-search-empty"
                initial={reduceMotion ? false : { opacity: 0 }}
                key="no-results"
                role="status"
              >
                <strong>{t(lang, "search.noResults")}</strong>
                <span>{t(lang, "search.noResultsHint")}</span>
                <Group gap="xs">
                  {!(excludeArchived || includeArchived) && (
                    <Button
                      onClick={() => {
                        focusArchiveFilterAfterRevealRef.current = true;
                        setIncludeArchived(true);
                      }}
                      variant="default"
                    >
                      {t(lang, "search.includeArchived")}
                    </Button>
                  )}
                  <Button onClick={clearConditions} variant="default">
                    {t(lang, "search.clear")}
                  </Button>
                </Group>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1 }}
                className="react-search-result-list"
                initial={reduceMotion ? false : { opacity: 0 }}
                key="results"
              >
                {results.map((result) => (
                  <ResultCard
                    key={result.document.id}
                    lang={lang}
                    onAction={announce}
                    onArchive={archiveResult}
                    onEdit={openAction}
                    onOpen={(selected) =>
                      onOpen
                        ? void onOpen(selected)
                        : announce(`${selected.document.title}を開きます`)
                    }
                    onTogglePin={togglePin}
                    query={query}
                    result={result}
                  />
                ))}
              </motion.div>
            )
          ) : (
            <motion.div
              animate={{ opacity: 1 }}
              className="react-search-empty"
              initial={reduceMotion ? false : { opacity: 0 }}
              key="initial"
              role="status"
            >
              <strong>{t(lang, "search.startHint")}</strong>
              <span>{t(lang, "search.placeholder")}</span>
            </motion.div>
          )}
        </section>
      </main>

      <AnimatePresence initial={false}>
        {Boolean(feedback) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-search-feedback"
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            role="status"
          >
            <Alert
              closeButtonLabel="閉じる"
              color="accent"
              onClose={() => setFeedback("")}
              variant="light"
              withCloseButton
            >
              {feedback}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {Boolean(portalTarget) && (
        <Modal
          centered
          classNames={{
            content: "react-search-action-modal-content",
            header: "react-search-action-modal-header",
          }}
          closeButtonProps={{ "aria-label": "閉じる" }}
          onClose={() => setActiveAction(null)}
          opened={Boolean(activeAction)}
          portalProps={{ target: portalTarget }}
          returnFocusRef={actionTriggerRef}
          title={
            activeAction?.kind === "tags"
              ? "タグを編集"
              : activeAction?.kind === "type"
                ? "タイプを変更"
                : "リストを編集"
          }
          withinPortal
        >
          <Stack gap="md">
            {activeAction?.kind === "tags" && (
              <>
                <TextInput
                  autoFocus
                  label={t(lang, "organize.tags")}
                  onChange={(event) => setDraftTags(event.currentTarget.value)}
                  ref={draftTagsInputRef}
                  value={draftTags}
                />
                <TagSuggestionChips
                  focusTargetRef={draftTagsInputRef}
                  lang={lang}
                  onSelect={addDraftTag}
                  selected={enteredTags}
                  tags={frequentTags}
                />
              </>
            )}
            {activeAction?.kind === "type" && (
              <Select
                comboboxProps={{ withinPortal: false }}
                data={availableTypes.map((value) => ({
                  label: typeLabel(lang, value),
                  value,
                }))}
                label="タイプ"
                onChange={(value) => setDraftType(value as ItemType | null)}
                value={draftType}
              />
            )}
            {activeAction?.kind === "lists" && (
              <div className="react-search-action-list-options">
                {availableLists.length > 0 ? (
                  availableLists.map((name) => (
                    <Checkbox
                      checked={draftLists.includes(name)}
                      key={name}
                      label={name}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setDraftLists((current) =>
                          checked
                            ? [...current, name]
                            : current.filter((value) => value !== name)
                        );
                      }}
                    />
                  ))
                ) : (
                  <Text size="sm">利用できるリストがありません。</Text>
                )}
              </div>
            )}
            <Group justify="flex-end">
              <Button onClick={() => setActiveAction(null)} variant="default">
                キャンセル
              </Button>
              <Button
                color="ink"
                disabled={
                  actionSaving || (activeAction?.kind === "type" && !draftType)
                }
                loading={actionSaving}
                onClick={() => void saveAction()}
              >
                保存
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      {Boolean(portalTarget) && (
        <Modal
          centered
          closeButtonProps={{
            "aria-label": t(lang, "notify.close"),
            disabled: archiveSaving,
          }}
          onClose={() => {
            if (!archiveSaving) {
              setPendingArchive(null);
              setArchiveError("");
            }
          }}
          opened={Boolean(pendingArchive)}
          portalProps={{ target: portalTarget }}
          returnFocusRef={archiveTriggerRef}
          title={t(lang, "library.archiveItem")}
        >
          <Stack gap="md">
            <div className="react-search-archive-paths">
              <div>
                <Text size="sm">{t(lang, "library.archiveSource")}</Text>
                <Text>{pendingArchive?.document.path ?? "—"}</Text>
              </div>
              <div>
                <Text size="sm">{t(lang, "library.archiveDestination")}</Text>
                <Text>{pendingArchiveDestination || "—"}</Text>
              </div>
            </div>
            <Text>{t(lang, "library.noteArchiveHint")}</Text>
            {archiveError ? (
              <Alert color="red" role="alert">
                {archiveError}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              <Button
                disabled={archiveSaving}
                onClick={() => setPendingArchive(null)}
                variant="default"
              >
                {t(lang, "action.cancel")}
              </Button>
              <Button
                color="ink"
                disabled={
                  archiveSaving ||
                  !pendingArchive ||
                  (Boolean(archiveDestination) && !pendingArchiveDestination)
                }
                loading={archiveSaving}
                onClick={() => void confirmArchiveResult()}
              >
                {t(lang, "library.archiveMoveConfirm")}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

      <footer className="react-search-footer">
        <Text className="react-search-muted" size="xs">
          Harness only · 検索ページの構成試作。本番コード、Obsidian
          ItemView、test-vaultは変更していません
        </Text>
      </footer>
    </div>
  );
}

function PrototypeApp({
  lang = "ja",
  documents = SEARCH_DOCUMENTS,
  history,
  historyEnabled,
  maxHistory,
  excludeArchived,
  tagAliases,
  listNames,
  typeOptions,
  onOpen,
  onSetTags,
  onChangeType,
  onSetLists,
  onArchive,
  archiveDestination,
  onTogglePin,
  onSaveHistory,
}: {
  lang?: Lang;
  documents?: SearchDocument[];
  history?: string[];
  historyEnabled?: boolean;
  maxHistory?: number;
  excludeArchived?: boolean;
  tagAliases?: Record<string, string[]>;
  listNames?: string[];
  typeOptions?: ItemType[];
  onOpen?: (result: RankedSearchResult) => void | Promise<void>;
  onSetTags?: (
    result: RankedSearchResult,
    tags: string[]
  ) => void | Promise<void>;
  onChangeType?: (
    result: RankedSearchResult,
    type: ItemType
  ) => string | undefined | Promise<string | undefined>;
  onSetLists?: (
    result: RankedSearchResult,
    lists: string[]
  ) => void | Promise<void>;
  onArchive?: (
    result: RankedSearchResult
  ) => string | void | Promise<string> | Promise<void>;
  archiveDestination?: (result: RankedSearchResult) => string;
  onTogglePin?: (result: RankedSearchResult) => void | Promise<void>;
  onSaveHistory?: (history: string[]) => void | Promise<void>;
}) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactSearchSurface
        archiveDestination={archiveDestination}
        documents={documents}
        excludeArchived={excludeArchived}
        history={history}
        historyEnabled={historyEnabled}
        lang={lang}
        listNames={listNames}
        maxHistory={maxHistory}
        onArchive={onArchive}
        onChangeType={onChangeType}
        onOpen={onOpen}
        onSaveHistory={onSaveHistory}
        onSetLists={onSetLists}
        onSetTags={onSetTags}
        onTogglePin={onTogglePin}
        scheme={scheme}
        tagAliases={tagAliases}
        typeOptions={typeOptions}
      />
    </SeitonUIProvider>
  );
}

export function mountReactSearchPrototype(
  root: HTMLElement,
  options: {
    lang?: Lang;
    documents?: SearchDocument[];
    history?: string[];
    historyEnabled?: boolean;
    maxHistory?: number;
    excludeArchived?: boolean;
    tagAliases?: Record<string, string[]>;
    listNames?: string[];
    typeOptions?: ItemType[];
    onOpen?: (result: RankedSearchResult) => void | Promise<void>;
    onSetTags?: (
      result: RankedSearchResult,
      tags: string[]
    ) => void | Promise<void>;
    onChangeType?: (
      result: RankedSearchResult,
      type: ItemType
    ) => string | undefined | Promise<string | undefined>;
    onSetLists?: (
      result: RankedSearchResult,
      lists: string[]
    ) => void | Promise<void>;
    onArchive?: (
      result: RankedSearchResult
    ) => string | void | Promise<string> | Promise<void>;
    archiveDestination?: (result: RankedSearchResult) => string;
    onTogglePin?: (result: RankedSearchResult) => void | Promise<void>;
    onSaveHistory?: (history: string[]) => void | Promise<void>;
  } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      archiveDestination={options.archiveDestination}
      documents={options.documents}
      excludeArchived={options.excludeArchived}
      history={options.history}
      historyEnabled={options.historyEnabled}
      lang={options.lang}
      listNames={options.listNames}
      maxHistory={options.maxHistory}
      onArchive={options.onArchive}
      onChangeType={options.onChangeType}
      onOpen={options.onOpen}
      onSaveHistory={options.onSaveHistory}
      onSetLists={options.onSetLists}
      onSetTags={options.onSetTags}
      onTogglePin={options.onTogglePin}
      tagAliases={options.tagAliases}
      typeOptions={options.typeOptions}
    />
  );
  return () => reactRoot.unmount();
}
