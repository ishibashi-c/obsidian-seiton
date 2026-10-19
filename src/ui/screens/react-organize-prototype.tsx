/** @jsxImportSource react */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import {
  applyOrganizationProposalBatch,
  type OrganizationProposalDocument,
  type OrganizationProposalOperationRef,
  organizationProposalCounts,
} from "../../shared/organizationProposal";
import { mostFrequentTags, normalizeTagInput } from "../../shared/tags";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { TagSuggestionChips } from "../patterns/TagSuggestionChips";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  IconButton,
  SegmentedControl,
  Select,
  Text,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";
import { ReactOrganizeProposals } from "./react-organize-proposals";

export type OrganizeType =
  | "class"
  | "task"
  | "reading"
  | "idea"
  | "article"
  | "collection"
  | "project"
  | "webclip"
  | "memo"
  | "profile";

export interface OrganizeItem {
  body: string;
  id: string;
  lists: string[];
  path: string;
  pinned?: boolean;
  source?: string;
  tags: string[];
  title: string;
  type: OrganizeType;
}

export interface OrganizeDestination {
  id: string;
  label: string;
  path: string;
  tags: string[];
  type: OrganizeType;
}

export interface OrganizePatch {
  destinationId: string | null;
  lists: string[];
  status: "active" | "archive";
  tags: string[];
  type: OrganizeType;
  typeChanged: boolean;
}

const TYPE_LABEL_KEYS: Record<OrganizeType, MessageKey> = {
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

const ORGANIZE_TYPES = Object.keys(TYPE_LABEL_KEYS) as OrganizeType[];
const LISTS = ["お気に入り", "今週見る", "あとで読む"];

function typeLabel(lang: Lang, type: OrganizeType): string {
  return t(lang, TYPE_LABEL_KEYS[type]);
}

const INITIAL_QUEUE: OrganizeItem[] = [
  {
    body: "READMEへ操作例を追加する。GIFの保存場所と、容量の上限を確認してから作業する。",
    id: "organize-readme",
    lists: ["今週見る"],
    path: "Seiton/inbox/READMEにデモGIFを追加.md",
    tags: ["開発"],
    title: "READMEにデモGIFを追加",
    type: "task",
  },
  {
    body: "保存した記事の本文プレビュー。必要な情報を確認し、タイプとタグを決めてから整理する。",
    id: "organize-article",
    lists: [],
    path: "Seiton/inbox/長い記事タイトルをあとで分類する.md",
    source: "https://example.com/article",
    tags: ["資料", "未確認"],
    title: "長い記事タイトルをあとで分類して必要な部分を再利用できるようにする",
    type: "article",
  },
  {
    body: "AIには候補の提示までを任せ、最終的なタイプ、タグ、リストの決定は人間が確認する。",
    id: "organize-idea",
    lists: ["お気に入り"],
    path: "Seiton/inbox/AIに任せる整理の範囲.md",
    tags: [],
    title: "AIに任せる整理の範囲",
    type: "idea",
  },
  {
    body: "frontmatterがない既存ノート。本文を確認して、必要ならタイプとタグを追加する。",
    id: "organize-no-metadata",
    lists: [],
    path: "Seiton/inbox/会議メモ.md",
    tags: [],
    title: "会議メモ",
    type: "memo",
  },
];

export function ReactOrganizeSurface({
  lang = "ja",
  scheme,
  destinations = [],
  typeFolderPaths = {},
  initialQueue = INITIAL_QUEUE,
  lists: availableLists = LISTS,
  frequentTags: frequentTagOptions,
  onOrganize,
  onReload,
  onOpen,
  onTogglePin,
  initialProposals = [],
  proposalFolder = "",
  onApplyProposal,
  onReloadProposals,
  onOpenProposal,
}: {
  lang?: Lang;
  scheme: ColorScheme;
  destinations?: OrganizeDestination[];
  typeFolderPaths?: Partial<Record<OrganizeType, string>>;
  initialQueue?: OrganizeItem[];
  lists?: string[];
  frequentTags?: string[];
  onOrganize?: (
    item: OrganizeItem,
    patch: OrganizePatch
  ) => void | Promise<void>;
  onReload?: () => Promise<OrganizeItem[]>;
  onOpen?: (item: OrganizeItem) => void | Promise<void>;
  onTogglePin?: (item: OrganizeItem) => void | Promise<void>;
  initialProposals?: OrganizationProposalDocument[];
  proposalFolder?: string;
  onApplyProposal?: (
    operation: OrganizationProposalOperationRef
  ) => void | Promise<void>;
  onReloadProposals?: () => Promise<OrganizationProposalDocument[]>;
  onOpenProposal?: (path: string) => void | Promise<void>;
}) {
  const [queue, setQueue] = useState<OrganizeItem[]>(initialQueue);
  const [proposals, setProposals] = useState(initialProposals);
  const [workspaceTab, setWorkspaceTab] = useState<"inbox" | "proposals">(
    "inbox"
  );
  const [applyingProposal, setApplyingProposal] = useState<string | null>(null);
  const [reloadingProposals, setReloadingProposals] = useState(false);
  const current = queue[0] ?? null;
  const [typeOverride, setTypeOverride] = useState<OrganizeType | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [tags, setTags] = useState(initialQueue[0]?.tags.join(", ") ?? "");
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const pendingActionFocusRef = useRef<"organize" | "later" | "archive" | null>(
    null
  );
  const organizeButtonRef = useRef<HTMLButtonElement | null>(null);
  const laterButtonRef = useRef<HTMLButtonElement | null>(null);
  const archiveButtonRef = useRef<HTMLButtonElement | null>(null);
  const reloadButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyStateRef = useRef<HTMLDivElement | null>(null);
  const [selectedLists, setSelectedLists] = useState<string[]>(
    initialQueue[0]?.lists ?? []
  );
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const reduceMotion = useReducedMotion();
  const enteredTags = useMemo(
    () => tags.split(",").map(normalizeTagInput).filter(Boolean),
    [tags]
  );
  const frequentTags = useMemo(
    () =>
      frequentTagOptions ??
      mostFrequentTags(
        initialQueue.map((item) => item.tags),
        5
      ),
    [frequentTagOptions, initialQueue]
  );
  const availableDestinations = useMemo(() => {
    const type = typeOverride ?? current?.type;
    return type
      ? destinations.filter((destination) => destination.type === type)
      : [];
  }, [current?.type, destinations, typeOverride]);
  const selectedDestination = availableDestinations.find(
    (destination) => destination.id === destinationId
  );
  const typeChanged = typeOverride !== null && typeOverride !== current?.type;
  const showDestinationOptions =
    availableDestinations.length > 0 || typeChanged;

  const togglePin = async (item: OrganizeItem): Promise<void> => {
    const nextPinned = !item.pinned;
    try {
      await onTogglePin?.({ ...item, pinned: nextPinned });
      setQueue((items) =>
        items.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, pinned: nextPinned }
            : candidate
        )
      );
      announce(
        `${t(lang, nextPinned ? "action.pin" : "action.unpin")}: ${item.title}`
      );
    } catch {
      announce("ピン留めを更新できませんでした");
    }
  };

  useEffect(() => {
    if (!current) {
      return;
    }
    setTypeOverride(null);
    setDestinationId(null);
    setTags(current.tags.join(", "));
    setSelectedLists(current.lists);
  }, [current?.id, current]);

  useEffect(() => {
    const action = pendingActionFocusRef.current;
    if (!action) {
      return;
    }
    pendingActionFocusRef.current = null;
    window.requestAnimationFrame(() => {
      const actionButton =
        action === "organize"
          ? organizeButtonRef.current
          : action === "later"
            ? laterButtonRef.current
            : archiveButtonRef.current;
      (
        actionButton ??
        reloadButtonRef.current ??
        emptyStateRef.current
      )?.focus();
    });
  });

  const announce = useCallback((message: string): void => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  }, []);

  const moveNext = useCallback(
    async (
      status: "active" | "archive",
      messageKey: "organize.saved" | "organize.archived"
    ): Promise<void> => {
      if (!current || saving) {
        return;
      }
      setSaving(true);
      try {
        await onOrganize?.(current, {
          destinationId,
          lists: selectedLists,
          status,
          tags: enteredTags,
          type: typeOverride ?? current.type,
          typeChanged,
        });
        pendingActionFocusRef.current =
          status === "active" ? "organize" : "archive";
        setQueue((items) => items.slice(1));
        announce(t(lang, messageKey));
      } catch {
        announce(t(lang, "organize.saveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [
      announce,
      current,
      destinationId,
      enteredTags,
      lang,
      onOrganize,
      saving,
      selectedLists,
      typeChanged,
      typeOverride,
    ]
  );

  const reloadQueue = useCallback(async (): Promise<void> => {
    if (!onReload || reloading) {
      return;
    }
    setReloading(true);
    try {
      const nextQueue = await onReload();
      setQueue(nextQueue);
      announce(
        t(lang, "organize.reloadCount", { count: `${nextQueue.length}` })
      );
    } catch {
      announce(t(lang, "organize.reloadFailed"));
    } finally {
      setReloading(false);
    }
  }, [announce, lang, onReload, reloading]);

  useEffect(() => {
    setProposals(initialProposals);
  }, [initialProposals]);

  const reloadProposals = async (): Promise<void> => {
    if (!onReloadProposals || reloadingProposals) {
      return;
    }
    setReloadingProposals(true);
    try {
      setProposals(await onReloadProposals());
    } catch {
      announce(t(lang, "organize.proposalReloadFailed"));
    } finally {
      setReloadingProposals(false);
    }
  };

  const applyProposal = async (
    operation: OrganizationProposalOperationRef
  ): Promise<void> => {
    if (!onApplyProposal || applyingProposal) {
      return;
    }
    const operationKey = `${operation.proposalPath}:${operation.operationId}`;
    setApplyingProposal(operationKey);
    try {
      await onApplyProposal(operation);
      let reloadFailed = false;
      if (onReloadProposals) {
        try {
          setProposals(await onReloadProposals());
        } catch {
          reloadFailed = true;
        }
      }
      announce(
        reloadFailed
          ? `${t(lang, "organize.proposalAppliedResult")} · ${t(lang, "organize.proposalReloadFailed")}`
          : t(lang, "organize.proposalAppliedResult")
      );
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : t(lang, "organize.proposalApplyFailed")
      );
      if (onReloadProposals) {
        setProposals(await onReloadProposals().catch(() => proposals));
      }
    } finally {
      setApplyingProposal(null);
    }
  };

  const applyProposalBatch = async (
    operations: readonly OrganizationProposalOperationRef[]
  ): Promise<{ appliedCount: number; failedCount: number }> => {
    if (!onApplyProposal || applyingProposal) {
      return { appliedCount: 0, failedCount: operations.length };
    }
    setApplyingProposal("batch");
    try {
      const result = await applyOrganizationProposalBatch(
        operations,
        async (operation) => {
          await onApplyProposal(operation);
        }
      );
      let reloadFailed = false;
      if (onReloadProposals) {
        try {
          setProposals(await onReloadProposals());
        } catch {
          reloadFailed = true;
        }
      }
      announce(
        `${t(lang, "organize.proposalBatchResult", {
          applied: `${result.appliedCount}`,
          failed: `${result.failedCount}`,
        })}${reloadFailed ? ` · ${t(lang, "organize.proposalReloadFailed")}` : ""}`
      );
      return result;
    } catch (error) {
      announce(
        error instanceof Error
          ? error.message
          : t(lang, "organize.proposalApplyFailed")
      );
      return { appliedCount: 0, failedCount: operations.length };
    } finally {
      setApplyingProposal(null);
    }
  };

  const later = useCallback((): void => {
    if (queue.length <= 1) {
      announce(t(lang, "organize.laterNoChange"));
      return;
    }
    pendingActionFocusRef.current = "later";
    setQueue((items) =>
      items.length > 1 ? [...items.slice(1), items[0]] : items
    );
    announce(t(lang, "organize.laterMoved"));
  }, [announce, lang, queue.length]);

  const addTag = (tag: string): void => {
    const normalized = normalizeTagInput(tag);
    if (!normalized || enteredTags.includes(normalized)) {
      return;
    }
    setTags([...enteredTags, normalized].join(", "));
  };

  const applyDestination = (destination: OrganizeDestination): void => {
    setDestinationId(destination.id);
    setTags([...new Set([...enteredTags, ...destination.tags])].join(", "));
  };

  const pendingProposalCount = proposals
    .filter((proposal) => proposal.status !== "invalid")
    .reduce(
      (total, proposal) =>
        total + organizationProposalCounts(proposal).pendingCount,
      0
    );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (event.key === "Enter" && current) {
        void moveNext("active", "organize.saved");
      }
      if (event.key.toLowerCase() === "l" && current) {
        later();
      }
      if (event.key.toLowerCase() === "a" && current) {
        void moveNext("archive", "organize.archived");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, later, moveNext]);

  return (
    <div className="seiton-react-organize-prototype" data-scheme={scheme}>
      <header className="react-organize-header">
        <div>
          <Title className="react-organize-heading" order={1}>
            {t(lang, "organize.title")}
          </Title>
        </div>
      </header>

      <main>
        <section
          aria-labelledby="react-organize-title"
          className="react-organize-workspace"
        >
          <div className="react-organize-section-heading">
            <div>
              <Title id="react-organize-title" order={2} size="h3">
                {t(
                  lang,
                  workspaceTab === "inbox"
                    ? "organize.inbox"
                    : "organize.proposalTitle"
                )}
              </Title>
            </div>
            <SegmentedControl
              aria-label={t(lang, "organize.workspaceTabs")}
              data={[
                { label: t(lang, "organize.inbox"), value: "inbox" },
                {
                  label: t(lang, "organize.proposals", {
                    count: `${pendingProposalCount}`,
                  }),
                  value: "proposals",
                },
              ]}
              onChange={(value) =>
                setWorkspaceTab(value as "inbox" | "proposals")
              }
              value={workspaceTab}
            />
            <Badge color="ink" variant="outline">
              {workspaceTab === "inbox"
                ? t(lang, "organize.remaining", { count: `${queue.length}` })
                : t(lang, "organize.proposalCount", {
                    count: `${pendingProposalCount}`,
                  })}
            </Badge>
          </div>

          {workspaceTab === "proposals" ? (
            <div className="react-organize-proposal-review">
              <div className="react-organize-proposal-review-toolbar">
                <div>
                  <Text size="sm">{t(lang, "organize.proposalFolder")}</Text>
                  {proposalFolder ? (
                    <Text size="sm">{proposalFolder}</Text>
                  ) : null}
                </div>
                <Button
                  disabled={!onReloadProposals || reloadingProposals}
                  loading={reloadingProposals}
                  onClick={() => void reloadProposals()}
                  variant="default"
                >
                  {t(lang, "organize.proposalReload")}
                </Button>
              </div>
              <ReactOrganizeProposals
                applyingOperation={applyingProposal}
                lang={lang}
                onApply={onApplyProposal ? applyProposal : undefined}
                onApplyBatch={onApplyProposal ? applyProposalBatch : undefined}
                onOpen={onOpenProposal}
                proposals={proposals}
                typeFolderPaths={typeFolderPaths}
              />
            </div>
          ) : (
            <AnimatePresence initial={false} mode="wait">
              {current ? (
                <motion.article
                  animate={{ opacity: 1, y: 0 }}
                  className="react-organize-card"
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  key={current.id}
                >
                  <header className="react-organize-card-header">
                    <div>
                      <button
                        className="react-organize-title-button"
                        onClick={() =>
                          onOpen
                            ? void onOpen(current)
                            : announce(
                                t(lang, "home.openItem", {
                                  title: current.title,
                                })
                              )
                        }
                        type="button"
                      >
                        {current.title}
                      </button>
                    </div>
                    <div className="react-organize-card-header-actions">
                      <Badge color="accent" variant="light">
                        {t(lang, "organize.inbox")}
                      </Badge>
                      <IconButton
                        disabled={saving}
                        filled={Boolean(current.pinned)}
                        icon="pin"
                        label={`${current.title}: ${t(lang, "menu.pin")}`}
                        onClick={() => void togglePin(current)}
                        pressed={Boolean(current.pinned)}
                        size="compact-sm"
                        title={t(
                          lang,
                          current.pinned ? "menu.unpin" : "menu.pin"
                        )}
                        variant="subtle"
                      />
                    </div>
                  </header>
                  {Boolean(current.source) && (
                    <a className="react-organize-source" href={current.source}>
                      {current.source}
                    </a>
                  )}
                  <pre className="react-organize-preview">{current.body}</pre>

                  <div className="react-organize-fields">
                    <div className="react-organize-tag-field">
                      <span>{t(lang, "organize.tags")}</span>
                      <TextInput
                        aria-label={t(lang, "organize.tags")}
                        id="organize-tag-input"
                        onChange={(event) => setTags(event.currentTarget.value)}
                        placeholder={t(lang, "organize.tagsPlaceholder")}
                        ref={tagInputRef}
                        value={tags}
                      />
                      <Text className="react-organize-field-hint" size="xs">
                        {t(lang, "organize.tagsHint")}
                      </Text>
                      <TagSuggestionChips
                        focusTargetRef={tagInputRef}
                        lang={lang}
                        onSelect={addTag}
                        selected={enteredTags}
                        tags={frequentTags}
                      />
                    </div>
                    <fieldset className="react-organize-type-field">
                      <legend>{t(lang, "organize.typeOptional")}</legend>
                      <Text className="react-organize-current-type" size="sm">
                        {t(lang, "organize.currentType", {
                          type: typeLabel(lang, current.type),
                        })}
                      </Text>
                      <Select
                        aria-label={t(lang, "organize.typeOptional")}
                        clearable
                        comboboxProps={{ withinPortal: false }}
                        data={ORGANIZE_TYPES.map((type) => ({
                          label: typeLabel(lang, type),
                          value: type,
                        }))}
                        onChange={(value) => {
                          const nextType = value
                            ? (value as OrganizeType)
                            : current.type;
                          const previousType = typeOverride ?? current.type;
                          setTypeOverride(
                            value ? (value as OrganizeType) : null
                          );
                          if (nextType !== previousType) {
                            setDestinationId(null);
                          }
                        }}
                        placeholder={t(lang, "organize.typePlaceholder")}
                        searchable
                        value={typeOverride}
                      />
                    </fieldset>
                  </div>
                  {showDestinationOptions ? (
                    <fieldset className="react-organize-destinations">
                      <legend>{t(lang, "organize.destination")}</legend>
                      <Text
                        className="react-organize-destination-hint"
                        size="sm"
                      >
                        {t(
                          lang,
                          typeChanged
                            ? "organize.typeFolderHint"
                            : "organize.destinationHint"
                        )}
                      </Text>
                      <div className="react-organize-destination-options">
                        <Button
                          aria-pressed={destinationId === null}
                          className="react-organize-destination-option"
                          disabled={saving}
                          onClick={() => setDestinationId(null)}
                          size="sm"
                          variant={destinationId === null ? "light" : "default"}
                        >
                          <strong>
                            {t(
                              lang,
                              typeChanged
                                ? "organize.typeFolder"
                                : "organize.keepLocation"
                            )}
                          </strong>
                          <span>
                            {typeChanged
                              ? (typeFolderPaths[
                                  typeOverride ?? current.type
                                ] ?? "")
                              : current.path}
                          </span>
                        </Button>
                        {availableDestinations.map((destination) => (
                          <Button
                            aria-pressed={destination.id === destinationId}
                            className="react-organize-destination-option"
                            disabled={saving}
                            key={destination.id}
                            onClick={() => applyDestination(destination)}
                            size="sm"
                            variant={
                              destination.id === destinationId
                                ? "light"
                                : "default"
                            }
                          >
                            <strong>{destination.label}</strong>
                            <span>{destination.path}</span>
                            {destination.tags.length > 0 && (
                              <span>
                                {destination.tags
                                  .map((tag) => `#${tag}`)
                                  .join(" ")}
                              </span>
                            )}
                          </Button>
                        ))}
                      </div>
                      {selectedDestination && (
                        <Text
                          className="react-organize-destination-applied"
                          size="xs"
                        >
                          {t(lang, "organize.destinationApplied")}
                        </Text>
                      )}
                    </fieldset>
                  ) : null}
                  <fieldset className="react-organize-lists">
                    <legend>{t(lang, "organize.lists")}</legend>
                    <Text className="react-organize-field-hint" size="xs">
                      {t(lang, "organize.listsHint")}
                    </Text>
                    <div>
                      {availableLists.map((list) => (
                        <Checkbox
                          checked={selectedLists.includes(list)}
                          key={list}
                          label={list}
                          onChange={() =>
                            setSelectedLists((values) =>
                              values.includes(list)
                                ? values.filter((value) => value !== list)
                                : [...values, list]
                            )
                          }
                        />
                      ))}
                    </div>
                  </fieldset>

                  <footer
                    className="react-organize-actions"
                    data-action-count="3"
                  >
                    <Button
                      aria-label={t(lang, "organize.applyItem", {
                        title: current.title,
                      })}
                      color="ink"
                      disabled={saving}
                      loading={saving}
                      onClick={() => void moveNext("active", "organize.saved")}
                      ref={organizeButtonRef}
                    >
                      {t(lang, "organize.apply")}
                    </Button>
                    <Button
                      aria-label={t(lang, "organize.laterItem", {
                        title: current.title,
                      })}
                      disabled={saving}
                      onClick={later}
                      ref={laterButtonRef}
                      variant="default"
                    >
                      {t(lang, "organize.later")}
                    </Button>
                    <Button
                      aria-label={t(lang, "organize.archiveItem", {
                        title: current.title,
                      })}
                      disabled={saving}
                      loading={saving}
                      onClick={() =>
                        void moveNext("archive", "organize.archived")
                      }
                      ref={archiveButtonRef}
                      variant="default"
                    >
                      {t(lang, "organize.archive")}
                    </Button>
                  </footer>
                  <Text className="react-organize-keyboard" size="xs">
                    {t(lang, "organize.keyboardHint")}
                  </Text>
                </motion.article>
              ) : (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="react-organize-empty"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  key="empty"
                  ref={emptyStateRef}
                  role="status"
                  tabIndex={-1}
                >
                  <strong>{t(lang, "organize.empty")}</strong>
                  {onReload ? (
                    <>
                      <span>{t(lang, "organize.emptyHint")}</span>
                      <Button
                        disabled={reloading}
                        loading={reloading}
                        onClick={() => void reloadQueue()}
                        ref={reloadButtonRef}
                        variant="default"
                      >
                        {t(lang, "organize.reload")}
                      </Button>
                    </>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </section>
      </main>

      <AnimatePresence initial={false}>
        {Boolean(feedback) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-organize-feedback"
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            role="status"
          >
            <Alert
              closeButtonLabel={t(lang, "notify.close")}
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
    </div>
  );
}

function PrototypeApp({
  lang,
  initialQueue,
  lists,
  frequentTags,
  onOrganize,
  onReload,
  onOpen,
  onTogglePin,
  destinations,
  typeFolderPaths,
  initialProposals,
  proposalFolder,
  onApplyProposal,
  onReloadProposals,
  onOpenProposal,
}: {
  lang?: Lang;
  initialQueue?: OrganizeItem[];
  lists?: string[];
  frequentTags?: string[];
  onOrganize?: (
    item: OrganizeItem,
    patch: OrganizePatch
  ) => void | Promise<void>;
  onReload?: () => Promise<OrganizeItem[]>;
  onOpen?: (item: OrganizeItem) => void | Promise<void>;
  onTogglePin?: (item: OrganizeItem) => void | Promise<void>;
  destinations?: OrganizeDestination[];
  typeFolderPaths?: Partial<Record<OrganizeType, string>>;
  initialProposals?: OrganizationProposalDocument[];
  proposalFolder?: string;
  onApplyProposal?: (
    operation: OrganizationProposalOperationRef
  ) => void | Promise<void>;
  onReloadProposals?: () => Promise<OrganizationProposalDocument[]>;
  onOpenProposal?: (path: string) => void | Promise<void>;
}) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactOrganizeSurface
        destinations={destinations}
        frequentTags={frequentTags}
        initialProposals={initialProposals}
        initialQueue={initialQueue}
        lang={lang}
        lists={lists}
        onApplyProposal={onApplyProposal}
        onOpen={onOpen}
        onOpenProposal={onOpenProposal}
        onOrganize={onOrganize}
        onReload={onReload}
        onReloadProposals={onReloadProposals}
        onTogglePin={onTogglePin}
        proposalFolder={proposalFolder}
        scheme={scheme}
        typeFolderPaths={typeFolderPaths}
      />
    </SeitonUIProvider>
  );
}

export function mountReactOrganizePrototype(
  root: HTMLElement,
  options: {
    lang?: Lang;
    initialQueue?: OrganizeItem[];
    lists?: string[];
    frequentTags?: string[];
    destinations?: OrganizeDestination[];
    typeFolderPaths?: Partial<Record<OrganizeType, string>>;
    onOrganize?: (
      item: OrganizeItem,
      patch: OrganizePatch
    ) => void | Promise<void>;
    onReload?: () => Promise<OrganizeItem[]>;
    onOpen?: (item: OrganizeItem) => void | Promise<void>;
    onTogglePin?: (item: OrganizeItem) => void | Promise<void>;
    initialProposals?: OrganizationProposalDocument[];
    proposalFolder?: string;
    onApplyProposal?: (
      operation: OrganizationProposalOperationRef
    ) => void | Promise<void>;
    onReloadProposals?: () => Promise<OrganizationProposalDocument[]>;
    onOpenProposal?: (path: string) => void | Promise<void>;
  } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      destinations={options.destinations}
      frequentTags={options.frequentTags}
      initialProposals={options.initialProposals}
      initialQueue={options.initialQueue}
      lang={options.lang}
      lists={options.lists}
      onApplyProposal={options.onApplyProposal}
      onOpen={options.onOpen}
      onOpenProposal={options.onOpenProposal}
      onOrganize={options.onOrganize}
      onReload={options.onReload}
      onReloadProposals={options.onReloadProposals}
      onTogglePin={options.onTogglePin}
      proposalFolder={options.proposalFolder}
      typeFolderPaths={options.typeFolderPaths}
    />
  );
  return () => reactRoot.unmount();
}
