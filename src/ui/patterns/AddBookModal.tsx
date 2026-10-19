/** @jsxImportSource react */

import { useRef, useState } from "react";
import {
  type BookMetadata,
  type BookOwnershipStatus,
  isValidIsbn,
  normalizeIsbn,
  splitIsbnInput,
} from "../../domain/book";
import type { BookGateway } from "../../platform/ports";
import { formatDayKey } from "../../shared/date";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import type { SeitonSettings } from "../../shared/types";
import {
  Alert,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "../primitives";
import { BookDataNotice } from "./BookDataNotice";
import { openProductionDialog } from "./ProductionDialog";

type AddMode = "isbn" | "batch" | "search" | "manual";
interface Candidate {
  duplicate?: string;
  error?: string;
  metadata: BookMetadata;
  saved?: boolean;
  selected: boolean;
  similar?: boolean;
}

const blankMetadata = (): BookMetadata => ({
  author: "",
  coverUrl: "",
  isbn: "",
  pages: 0,
  publishDate: "",
  publisher: "",
  title: "",
});

export function BookCandidateEditionNotice({
  lang,
  similar,
}: {
  lang: Lang;
  similar: boolean;
}) {
  if (!similar) {
    return null;
  }
  return (
    <Text aria-live="polite" role="status" size="xs">
      {t(lang, "book.editionWarning")}
    </Text>
  );
}

export function ReactAddBookForm({
  gateway,
  settings,
  lang,
  onClose,
  onCreated,
  onRequestResultFocus,
  notify,
}: {
  gateway: BookGateway;
  settings: SeitonSettings;
  lang: Lang;
  onClose: () => void;
  onCreated: (path: string) => void;
  onRequestResultFocus?: () => void;
  notify: (message: string) => void;
}) {
  const [mode, setMode] = useState<AddMode>("isbn");
  const [input, setInput] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [finished, setFinished] = useState(formatDayKey(new Date()));
  const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(
    settings.bookCategories[0] ?? "未分類"
  );
  const [series, setSeries] = useState("");
  const [ownership, setOwnership] = useState<BookOwnershipStatus>("unowned");
  const [lists, setLists] = useState<string[]>([]);
  const prepareInProgressRef = useRef(false);
  const prepareRunRef = useRef(0);

  const inspect = async (metadata: BookMetadata): Promise<Candidate> => {
    const duplicate = metadata.isbn
      ? await gateway.findByIsbn(metadata.isbn)
      : null;
    const similar = (
      await gateway.findSimilar(metadata.title, metadata.author)
    ).some((file) => file.path !== duplicate);
    return {
      duplicate: duplicate ?? undefined,
      metadata,
      selected: !duplicate,
      similar,
    };
  };

  const prepare = async (): Promise<void> => {
    if (prepareInProgressRef.current) {
      return;
    }
    const run = ++prepareRunRef.current;
    prepareInProgressRef.current = true;
    setBusy(true);
    setFailed(false);
    setSearched(mode === "search");
    try {
      if (mode === "manual") {
        const isbn = normalizeIsbn(manualIsbn);
        const candidate = await inspect({
          ...blankMetadata(),
          author: manualAuthor.trim(),
          isbn,
          title: manualTitle.trim(),
        });
        if (run === prepareRunRef.current) {
          setCandidates([candidate]);
        }
        return;
      }
      if (mode === "search") {
        const metadata = await gateway.search(input);
        if (run !== prepareRunRef.current) {
          return;
        }
        const next = await Promise.all(metadata.map(inspect));
        if (run === prepareRunRef.current) {
          setCandidates(next);
        }
        return;
      }
      const rows: Candidate[] = [];
      for (const isbn of splitIsbnInput(input)) {
        if (run !== prepareRunRef.current) {
          return;
        }
        if (!isValidIsbn(isbn)) {
          rows.push({
            error: t(lang, "book.invalidIsbn"),
            metadata: { ...blankMetadata(), isbn },
            selected: false,
          });
          continue;
        }
        const metadata = await gateway.fetch(isbn);
        if (run !== prepareRunRef.current) {
          return;
        }
        const candidate = metadata
          ? await inspect(metadata)
          : {
              error: t(lang, "book.notFound"),
              metadata: { ...blankMetadata(), isbn },
              selected: false,
            };
        if (run !== prepareRunRef.current) {
          return;
        }
        rows.push(candidate);
      }
      if (run === prepareRunRef.current) {
        setCandidates(rows);
      }
    } catch {
      if (run === prepareRunRef.current) {
        setCandidates([]);
        setFailed(true);
      }
    } finally {
      if (run === prepareRunRef.current) {
        prepareInProgressRef.current = false;
        setBusy(false);
        onRequestResultFocus?.();
      }
    }
  };

  const patchCandidate = (index: number, patch: Partial<BookMetadata>): void =>
    setCandidates((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              error: undefined,
              metadata: { ...row.metadata, ...patch },
              selected: true,
            }
          : row
      )
    );

  const save = async (): Promise<void> => {
    setBusy(true);
    let firstPath = "";
    const next = [...candidates];
    for (let index = 0; index < next.length; index += 1) {
      const row = next[index];
      if (!row.selected || row.saved || row.duplicate) {
        continue;
      }
      const isbn = row.metadata.isbn ? normalizeIsbn(row.metadata.isbn) : "";
      if (!row.metadata.title.trim() || (isbn && !isValidIsbn(isbn))) {
        next[index] = {
          ...row,
          error: isbn
            ? t(lang, "book.invalidIsbn")
            : t(lang, "book.manualTitleRequired"),
        };
        continue;
      }
      try {
        const path = await gateway.create(
          {
            category,
            finished,
            lists,
            metadata: { ...row.metadata, isbn },
            notes,
            ownership,
            rating: Number(rating) || undefined,
            series,
          },
          settings
        );
        firstPath ||= path;
        next[index] = { ...row, saved: true, selected: false };
      } catch {
        next[index] = { ...row, error: t(lang, "notify.saveError") };
      }
    }
    setCandidates(next);
    setBusy(false);
    if (firstPath) {
      notify(t(lang, "notify.saveSuccess"));
      onCreated(firstPath);
    }
  };

  return (
    <Stack className="seiton-react-add-book-form" gap="md">
      <BookDataNotice lang={lang} />
      {Boolean(failed) && (
        <Alert color="red" data-seiton-autofocus="" role="alert" tabIndex={-1}>
          {t(
            lang,
            mode === "manual" ? "notify.loadError" : "book.searchFailed"
          )}
        </Alert>
      )}
      <SegmentedControl
        aria-label={t(lang, "book.add")}
        data={(["isbn", "batch", "search", "manual"] as AddMode[]).map(
          (value) => ({
            label: t(lang, `book.mode.${value}` as MessageKey),
            value,
          })
        )}
        onChange={(value) => {
          if (prepareInProgressRef.current) {
            prepareRunRef.current += 1;
            prepareInProgressRef.current = false;
            setBusy(false);
          }
          if (mode === "isbn" && value === "manual" && input.trim()) {
            setManualIsbn(input);
          }
          setMode(value as AddMode);
          setInput("");
          setCandidates([]);
          setFailed(false);
          setSearched(false);
        }}
        value={mode}
      />
      {mode === "batch" ? (
        <Textarea
          disabled={busy}
          label={t(lang, "book.batchPlaceholder")}
          minRows={3}
          onChange={(event) => setInput(event.currentTarget.value)}
          placeholder={t(lang, "book.batchPlaceholder")}
          value={input}
        />
      ) : mode === "manual" ? (
        <Stack gap="sm">
          <TextInput
            disabled={busy}
            label={t(lang, "book.title")}
            onChange={(event) => setManualTitle(event.currentTarget.value)}
            placeholder={t(lang, "book.title")}
            required
            value={manualTitle}
          />
          <TextInput
            disabled={busy}
            label={t(lang, "book.authorOptional")}
            onChange={(event) => setManualAuthor(event.currentTarget.value)}
            placeholder={t(lang, "book.author")}
            value={manualAuthor}
          />
          <TextInput
            disabled={busy}
            label={t(lang, "book.isbnOptional")}
            onChange={(event) => setManualIsbn(event.currentTarget.value)}
            placeholder={t(lang, "book.isbnPlaceholder")}
            value={manualIsbn}
          />
        </Stack>
      ) : (
        <TextInput
          disabled={busy}
          label={mode === "search" ? t(lang, "book.searchPlaceholder") : "ISBN"}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            if (mode === "search") {
              setSearched(false);
            }
          }}
          placeholder={
            mode === "search"
              ? t(lang, "book.searchPlaceholder")
              : t(lang, "book.isbnPlaceholder")
          }
          value={input}
        />
      )}
      <Button
        disabled={
          busy || (mode === "manual" ? !manualTitle.trim() : !input.trim())
        }
        onClick={() => void prepare()}
        variant="default"
      >
        {failed ? t(lang, "notify.retry") : t(lang, "book.preview")}
      </Button>
      {busy ? (
        <Text aria-live="polite" role="status" size="sm">
          {t(lang, "book.fetching")}
        </Text>
      ) : null}
      {mode === "search" &&
        searched &&
        !busy &&
        !failed &&
        candidates.length === 0 && (
          <Alert
            color="gray"
            data-seiton-autofocus=""
            role="status"
            tabIndex={-1}
          >
            {t(lang, "book.noCandidates")}
          </Alert>
        )}
      {candidates.length > 0 && (
        <div className="seiton-react-book-candidates">
          {candidates.map((row, index) => (
            <article
              className="seiton-react-book-candidate"
              key={`${row.metadata.isbn}:${row.metadata.title}:${row.metadata.author ?? ""}`}
            >
              <label className="seiton-react-book-select">
                <input
                  checked={row.selected}
                  data-seiton-autofocus={
                    index === 0 && !row.duplicate && !row.saved ? "" : undefined
                  }
                  disabled={Boolean(row.duplicate || row.saved)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setCandidates((rows) =>
                      rows.map((candidate, rowIndex) =>
                        rowIndex === index
                          ? { ...candidate, selected: checked }
                          : candidate
                      )
                    );
                  }}
                  type="checkbox"
                />
                <span>
                  {row.metadata.title ||
                    row.metadata.isbn ||
                    t(lang, "book.candidateNumber", {
                      count: String(index + 1),
                    })}
                </span>
              </label>
              <Badge
                color={row.error ? "red" : row.saved ? "green" : "accent"}
                variant="light"
              >
                {row.error ??
                  (row.duplicate
                    ? t(lang, "book.duplicate")
                    : row.saved
                      ? t(lang, "book.saved")
                      : t(lang, "book.candidate"))}
              </Badge>
              <BookCandidateEditionNotice
                lang={lang}
                similar={row.similar ?? false}
              />
              <TextInput
                data-seiton-autofocus={
                  index === 0 && (row.duplicate || row.saved) ? "" : undefined
                }
                label={t(lang, "book.title")}
                onChange={(event) =>
                  patchCandidate(index, { title: event.currentTarget.value })
                }
                value={row.metadata.title}
              />
              <TextInput
                label={t(lang, "book.author")}
                onChange={(event) =>
                  patchCandidate(index, { author: event.currentTarget.value })
                }
                value={row.metadata.author}
              />
              <TextInput
                label="ISBN"
                onChange={(event) =>
                  patchCandidate(index, { isbn: event.currentTarget.value })
                }
                value={row.metadata.isbn}
              />
            </article>
          ))}
          <TextInput
            label={t(lang, "book.finished")}
            onChange={(event) => setFinished(event.currentTarget.value)}
            type="date"
            value={finished}
          />
          <TextInput
            label={t(lang, "book.rating")}
            max={5}
            min={1}
            onChange={(event) => setRating(event.currentTarget.value)}
            type="number"
            value={rating}
          />
          <Textarea
            label={t(lang, "book.notes")}
            onChange={(event) => setNotes(event.currentTarget.value)}
            value={notes}
          />
          <div className="seiton-react-book-create-grid">
            <Select
              data={settings.bookCategories.map((value) => ({
                label: value,
                value,
              }))}
              label={t(lang, "book.category")}
              onChange={(value) => setCategory(value ?? "未分類")}
              value={category}
            />
            <TextInput
              label={t(lang, "book.seriesOptional")}
              onChange={(event) => setSeries(event.currentTarget.value)}
              placeholder={t(lang, "book.seriesPlaceholder")}
              value={series}
            />
            <Select
              data={[
                { label: t(lang, "book.ownershipOwned"), value: "owned" },
                {
                  label: t(lang, "book.ownershipUnowned"),
                  value: "unowned",
                },
              ]}
              label={t(lang, "book.ownership")}
              onChange={(value) =>
                setOwnership((value as BookOwnershipStatus) || "unowned")
              }
              value={ownership}
            />
          </div>
          {settings.listNames.length > 0 ? (
            <fieldset className="seiton-react-book-list-picker">
              <legend>{t(lang, "book.listsOptional")}</legend>
              <div>
                {settings.listNames.map((list) => (
                  <label key={list}>
                    <input
                      checked={lists.includes(list)}
                      onChange={(event) =>
                        setLists((current) =>
                          event.currentTarget.checked
                            ? [...new Set([...current, list])]
                            : current.filter((value) => value !== list)
                        )
                      }
                      type="checkbox"
                    />
                    <span>{list}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
      )}
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          {t(lang, "action.cancel")}
        </Button>
        <Button
          color="ink"
          disabled={busy || !candidates.some((row) => row.selected)}
          onClick={() => void save()}
        >
          {t(lang, "action.save")}
        </Button>
      </Group>
    </Stack>
  );
}

export function openReactAddBookDialog(
  gateway: BookGateway,
  settings: SeitonSettings,
  lang: Lang,
  onCreated: (path: string) => void,
  notify: (message: string) => void
): () => void {
  return openProductionDialog({
    closeButtonLabel: t(lang, "notify.close"),
    render: (close, onRequestResultFocus) => (
      <ReactAddBookForm
        gateway={gateway}
        lang={lang}
        notify={notify}
        onClose={close}
        onCreated={(path) => {
          onCreated(path);
          close();
        }}
        onRequestResultFocus={onRequestResultFocus}
        settings={settings}
      />
    ),
    title: t(lang, "book.add"),
  });
}
