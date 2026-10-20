/** @jsxImportSource react */

import {
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, t } from "../../shared/i18n";
import { mostFrequentTags, normalizeTagInput } from "../../shared/tags";
import { AnimatePresence, motion, useReducedMotion } from "../motion";
import { TagSuggestionChips } from "../patterns/TagSuggestionChips";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

export interface MemoItem {
  content: string;
  date: string;
  id: string;
  lineIndex?: number;
  month: string;
  path?: string;
  tags: string[];
  time: string;
}

const MEMOS: MemoItem[] = [
  {
    content: "カードの主操作は内容の長さで動かさない。",
    date: "2026-08-26",
    id: "memo-26",
    month: "2026-08",
    tags: ["UI", "設計"],
    time: "08:06",
  },
  {
    content: "検索の結果はタイトルと一致箇所が最初に見えると確認しやすい。",
    date: "2026-08-25",
    id: "memo-25",
    month: "2026-08",
    tags: ["検索"],
    time: "19:40",
  },
  {
    content: "本棚は読了した本の記録に集中する。",
    date: "2026-08-24",
    id: "memo-24",
    month: "2026-08",
    tags: ["読書"],
    time: "12:18",
  },
  {
    content: "一言メモは保存を早くし、振り返りで必要なものを残す。",
    date: "2026-08-22",
    id: "memo-22",
    month: "2026-08",
    tags: ["運用"],
    time: "22:14",
  },
  {
    content: "既存VaultのMarkdownを正本として扱う。",
    date: "2026-08-18",
    id: "memo-18",
    month: "2026-08",
    tags: ["Vault", "設計"],
    time: "10:32",
  },
  {
    content: "書誌情報は取得元と失敗時の状態を画面に残す。",
    date: "2026-08-12",
    id: "memo-12",
    month: "2026-08",
    tags: ["本棚"],
    time: "17:02",
  },
  {
    content: "新しい画面は既存の役割を確認してから追加する。",
    date: "2026-08-08",
    id: "memo-08",
    month: "2026-08",
    tags: ["開発"],
    time: "09:15",
  },
  {
    content: "行内タグは検索と再発見に必要なときだけ使う。",
    date: "2026-08-07",
    id: "memo-07",
    month: "2026-08",
    tags: ["タグ"],
    time: "21:30",
  },
  {
    content: "次の月も検索結果の表示を見直す。",
    date: "2026-07-29",
    id: "memo-29",
    month: "2026-07",
    tags: ["検索"],
    time: "14:20",
  },
  {
    content: "今月の記録を開始する。",
    date: "2026-09-01",
    id: "memo-01",
    month: "2026-09",
    tags: ["運用"],
    time: "08:00",
  },
];

interface MemoDraft {
  day: string;
  tags: string[];
  text: string;
  time: string;
}
type MemoEditHandler = (
  memo: MemoItem,
  next: MemoDraft
) => Promise<string | undefined>;
type MemoHandler = (memo: MemoItem) => void | Promise<void>;

function MemoRow({
  lang,
  memo,
  onEdit,
  onKeepAsNote,
}: {
  lang: Lang;
  memo: MemoItem;
  onEdit: (memo: MemoItem, trigger: HTMLButtonElement) => void;
  onKeepAsNote: (memo: MemoItem) => void;
}) {
  return (
    <article className="react-memo-row">
      <div className="react-memo-row-time">
        <time dateTime={`${memo.date}T${memo.time}`}>
          {memo.date.replace(/-/g, ".")} · {memo.time}
        </time>
      </div>
      <p className="react-memo-row-content">{memo.content}</p>
      <section
        aria-label={t(lang, "menu.tags")}
        className="react-memo-row-tags"
      >
        {memo.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </section>
      <div className="react-memo-row-actions" data-action-count="2">
        <Button
          onClick={(event) => onEdit(memo, event.currentTarget)}
          size="sm"
          variant="default"
        >
          {t(lang, "action.edit")}
        </Button>
        <Button onClick={() => onKeepAsNote(memo)} size="sm" variant="default">
          {t(lang, "memoReview.keepAsNote")}
        </Button>
      </div>
    </article>
  );
}

export function ReactMemoSurface({
  lang = "ja",
  scheme,
  memos = MEMOS,
  initialReference,
  onEdit,
  onDelete,
  onKeepAsNote,
}: {
  lang?: Lang;
  scheme: ColorScheme;
  memos?: MemoItem[];
  initialReference?: Date;
  onEdit?: MemoEditHandler;
  onDelete?: MemoHandler;
  onKeepAsNote?: MemoHandler;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [reference, setReference] = useState(initialReference ?? new Date());
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [localMemos, setLocalMemos] = useState(memos);
  const [activeMemo, setActiveMemo] = useState<MemoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemoItem | null>(null);
  const [draftDay, setDraftDay] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [saving, setSaving] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (rootRef.current) {
      setPortalTarget(rootRef.current);
    }
  }, []);
  useEffect(() => setLocalMemos(memos), [memos]);
  const interval =
    period === "week"
      ? {
          end: endOfWeek(reference, { weekStartsOn: 1 }),
          start: startOfWeek(reference, { weekStartsOn: 1 }),
        }
      : { end: endOfMonth(reference), start: startOfMonth(reference) };
  const range = `${format(interval.start, "yyyy.MM.dd")} – ${format(interval.end, "yyyy.MM.dd")}`;
  const visible = useMemo(
    () =>
      localMemos.filter(
        (memo) =>
          isWithinInterval(parseISO(memo.date), interval) &&
          `${memo.content} ${memo.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
      ),
    [localMemos, query, interval]
  );
  const enteredTags = useMemo(
    () =>
      draftTags
        .split(/[\s,]+/)
        .map(normalizeTagInput)
        .filter(Boolean),
    [draftTags]
  );
  const frequentTags = useMemo(
    () =>
      mostFrequentTags(
        localMemos.map((memo) => memo.tags),
        5
      ),
    [localMemos]
  );

  const announce = (message: string): void => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 3200);
  };

  const shift = (amount: -1 | 1): void =>
    setReference((date) =>
      period === "week" ? addWeeks(date, amount) : addMonths(date, amount)
    );

  const openEditor = (memo: MemoItem, trigger: HTMLButtonElement): void => {
    editTriggerRef.current = trigger;
    setActiveMemo(memo);
    setDraftDay(memo.date);
    setDraftTime(memo.time);
    setDraftText(memo.content);
    setDraftTags(memo.tags.join(", "));
  };

  const parsedTags = (): string[] => [
    ...new Set(
      draftTags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean)
    ),
  ];

  const addTag = (tag: string): void => {
    const normalized = normalizeTagInput(tag);
    if (!normalized || enteredTags.includes(normalized)) {
      return;
    }
    setDraftTags([...enteredTags, normalized].join(", "));
  };

  const saveEdit = async (): Promise<void> => {
    if (!(activeMemo && draftDay && draftTime && draftText.trim())) {
      announce(t(lang, "memoReview.requiredFields"));
      return;
    }
    const next = {
      day: draftDay,
      tags: parsedTags(),
      text: draftText.trim(),
      time: draftTime,
    };
    setSaving(true);
    try {
      const updatedPath = await onEdit?.(activeMemo, next);
      setLocalMemos((current) =>
        current.map((memo) =>
          memo.id === activeMemo.id
            ? {
                ...memo,
                content: next.text,
                date: next.day,
                month: next.day.slice(0, 7),
                ...(updatedPath ? { path: updatedPath } : {}),
                tags: next.tags,
                time: next.time,
              }
            : memo
        )
      );
      setActiveMemo(null);
      announce(t(lang, "memoReview.saveSuccess"));
    } catch {
      announce(t(lang, "memoReview.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    setSaving(true);
    try {
      await onDelete?.(deleteTarget);
      setLocalMemos((current) =>
        current.filter((memo) => memo.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
      setActiveMemo(null);
      announce(t(lang, "memoReview.deleteSuccess"));
    } catch {
      announce(t(lang, "memoReview.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const keepAsNote = async (memo: MemoItem): Promise<void> => {
    try {
      await onKeepAsNote?.(memo);
      announce(t(lang, "memoReview.keepSuccess"));
    } catch {
      announce(t(lang, "memoReview.keepFailed"));
    }
  };

  return (
    <div
      className="seiton-react-memo-prototype"
      data-scheme={scheme}
      ref={rootRef}
    >
      <header className="react-memo-header">
        <div>
          <Title className="react-memo-heading" order={1}>
            {t(lang, "memoReview.title")}
          </Title>
        </div>
      </header>

      <main>
        <section
          aria-label={t(lang, "memoReview.title")}
          className="react-memo-controls"
        >
          <div className="react-memo-section-heading">
            <Badge color="ink" variant="outline">
              {t(
                lang,
                visible.length === 1
                  ? "memoReview.countOne"
                  : "memoReview.countMany",
                { count: String(visible.length) }
              )}
            </Badge>
          </div>
          <div className="react-memo-period-row">
            <Button
              aria-label={t(lang, "memoReview.previous")}
              onClick={() => shift(-1)}
              variant="default"
            >
              ←
            </Button>
            <strong>{range}</strong>
            <Button
              aria-label={t(lang, "memoReview.next")}
              onClick={() => shift(1)}
              variant="default"
            >
              →
            </Button>
            <SegmentedControl
              aria-label={t(lang, "memoReview.title")}
              data={[
                { label: t(lang, "tab.week"), value: "week" },
                { label: t(lang, "tab.month"), value: "month" },
              ]}
              onChange={(value) => setPeriod(value as "week" | "month")}
              value={period}
            />
          </div>
          <TextInput
            aria-label={t(lang, "memoReview.search")}
            label={t(lang, "memoReview.search")}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t(lang, "memoReview.searchPlaceholder")}
            value={query}
          />
        </section>

        <section
          aria-labelledby="react-memo-results-title"
          className="react-memo-results"
        >
          <div className="react-memo-section-heading">
            <div>
              <Title id="react-memo-results-title" order={2} size="h3">
                {t(lang, "memoReview.results")}
              </Title>
            </div>
          </div>
          <AnimatePresence initial={false} mode="wait">
            {visible.length > 0 ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="react-memo-list"
                exit={reduceMotion ? undefined : { opacity: 0 }}
                initial={reduceMotion ? false : { opacity: 0 }}
                key={`${period}-${range}-${query}`}
              >
                {visible.map((memo) => (
                  <MemoRow
                    key={memo.id}
                    lang={lang}
                    memo={memo}
                    onEdit={openEditor}
                    onKeepAsNote={(item) => void keepAsNote(item)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1 }}
                className="react-memo-empty"
                exit={reduceMotion ? undefined : { opacity: 0 }}
                initial={reduceMotion ? false : { opacity: 0 }}
                key="empty"
                role="status"
              >
                <strong>{t(lang, "empty.noMemos")}</strong>
                <span>{t(lang, "memoReview.emptyHint")}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <AnimatePresence initial={false}>
        {Boolean(feedback) && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="react-memo-feedback"
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
      {Boolean(portalTarget) && (
        <>
          <Modal
            centered
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={() => setActiveMemo(null)}
            opened={Boolean(activeMemo)}
            portalProps={{ target: portalTarget }}
            returnFocusRef={editTriggerRef}
            title={t(lang, "edit.title")}
            withinPortal
          >
            <Stack gap="md">
              <Textarea
                autoFocus
                autosize
                label={t(lang, "edit.content")}
                minRows={4}
                onChange={(event) => setDraftText(event.currentTarget.value)}
                value={draftText}
              />
              <Group grow>
                <TextInput
                  label={t(lang, "edit.date")}
                  lang={lang}
                  onChange={(event) => setDraftDay(event.currentTarget.value)}
                  type="date"
                  value={draftDay}
                />
                <TextInput
                  label={t(lang, "edit.time")}
                  lang={lang}
                  onChange={(event) => setDraftTime(event.currentTarget.value)}
                  type="time"
                  value={draftTime}
                />
              </Group>
              <TextInput
                label={t(lang, "edit.tags")}
                onChange={(event) => setDraftTags(event.currentTarget.value)}
                ref={tagInputRef}
                value={draftTags}
              />
              <TagSuggestionChips
                focusTargetRef={tagInputRef}
                lang={lang}
                onSelect={addTag}
                selected={enteredTags}
                tags={frequentTags}
              />
              <Group justify="space-between">
                <Button
                  color="red"
                  disabled={saving}
                  onClick={(event) => {
                    deleteTriggerRef.current = event.currentTarget;
                    if (activeMemo) {
                      setDeleteTarget(activeMemo);
                    }
                  }}
                  variant="subtle"
                >
                  {t(lang, "action.delete")}
                </Button>
                <Group gap="xs">
                  <Button onClick={() => setActiveMemo(null)} variant="default">
                    {t(lang, "action.cancel")}
                  </Button>
                  <Button
                    color="ink"
                    loading={saving}
                    onClick={() => void saveEdit()}
                  >
                    {t(lang, "action.save")}
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Modal>
          <Modal
            centered
            closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
            onClose={() => setDeleteTarget(null)}
            opened={Boolean(deleteTarget)}
            portalProps={{ target: portalTarget }}
            returnFocusRef={deleteTriggerRef}
            title={t(lang, "confirm.deleteMemo")}
            withinPortal
          >
            <Stack gap="md">
              <Text>{t(lang, "confirm.deleteMemo")}</Text>
              <Text className="react-memo-muted" size="sm">
                {t(lang, "confirm.deleteMemoHint")}
              </Text>
              <Group justify="flex-end">
                <Button
                  data-seiton-autofocus=""
                  onClick={() => setDeleteTarget(null)}
                  variant="default"
                >
                  {t(lang, "action.cancel")}
                </Button>
                <Button
                  color="red"
                  loading={saving}
                  onClick={() => void confirmDelete()}
                >
                  {t(lang, "action.delete")}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </div>
  );
}

function PrototypeApp({
  lang = "ja",
  memos,
  initialReference,
  onEdit,
  onDelete,
  onKeepAsNote,
}: {
  lang?: Lang;
  memos?: MemoItem[];
  initialReference?: Date;
  onEdit?: MemoEditHandler;
  onDelete?: MemoHandler;
  onKeepAsNote?: MemoHandler;
}) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactMemoSurface
        initialReference={initialReference}
        lang={lang}
        memos={memos}
        onDelete={onDelete}
        onEdit={onEdit}
        onKeepAsNote={onKeepAsNote}
        scheme={scheme}
      />
    </SeitonUIProvider>
  );
}

export function mountReactMemoPrototype(
  root: HTMLElement,
  options: {
    lang?: Lang;
    memos?: MemoItem[];
    initialReference?: Date;
    onEdit?: MemoEditHandler;
    onDelete?: MemoHandler;
    onKeepAsNote?: MemoHandler;
  } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      initialReference={options.initialReference}
      lang={options.lang}
      memos={options.memos}
      onDelete={options.onDelete}
      onEdit={options.onEdit}
      onKeepAsNote={options.onKeepAsNote}
    />
  );
  return () => reactRoot.unmount();
}
