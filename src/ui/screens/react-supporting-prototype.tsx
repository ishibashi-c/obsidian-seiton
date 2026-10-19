/** @jsxImportSource react */

import {
  addDays,
  addMonths,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { EDITOR_COLORS } from "../../shared/constants";
import { normalizeTagInput } from "../../shared/tags";
import {
  ColorPaletteEditor,
  StringListEditor,
  TagAliasEditor,
} from "../patterns/SettingsEditors";
import { TagSuggestionChips } from "../patterns/TagSuggestionChips";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

type SurfaceKey =
  | "settings"
  | "new-note"
  | "shortcut"
  | "tags"
  | "memo"
  | "toolbar"
  | "rich-card"
  | "dialogs";
type ModalKey = Exclude<
  SurfaceKey,
  "settings" | "toolbar" | "rich-card"
> | null;

const SURFACES: Array<{ key: SurfaceKey; label: string; production: string }> =
  [
    {
      key: "settings",
      label: "設定",
      production: "src/app/SeitonPlugin.ts · SeitonSettingTab",
    },
    {
      key: "new-note",
      label: "新規作成",
      production: "src/app/mountSeitonApp.tsx",
    },
    {
      key: "shortcut",
      label: "ショートカット追加",
      production: "src/app/mountSeitonApp.tsx",
    },
    {
      key: "tags",
      label: "タグ編集",
      production: "src/app/mountSeitonApp.tsx",
    },
    {
      key: "memo",
      label: "一言メモ編集",
      production: "src/app/mountSeitonApp.tsx",
    },
    {
      key: "toolbar",
      label: "エディター",
      production: "src/platform/obsidian/editorToolbar.ts",
    },
    {
      key: "rich-card",
      label: "リッチカード",
      production: "src/ui/patterns/RichCard.tsx",
    },
    {
      key: "dialogs",
      label: "確認・入力",
      production: "src/ui/patterns/ProductionDialog.tsx",
    },
  ];

const NOTE_TYPES = [
  { group: "学ぶ", key: "lecture", label: "授業・セミナー" },
  { group: "学ぶ", key: "task", label: "タスク" },
  { group: "学ぶ", key: "reading", label: "読書" },
  { group: "創る", key: "idea", label: "アイデア" },
  { group: "創る", key: "project", label: "プロジェクト" },
  { group: "集める", key: "clip", label: "クリップ" },
  { group: "集める", key: "webclip", label: "Webクリップ" },
  { group: "日々の記録", key: "memo", label: "一言メモ" },
  { group: "集める", key: "collection", label: "コレクション" },
  { group: "その他", key: "profile", label: "プロフィール" },
] as const;

const TYPE_GROUPS = ["学ぶ", "創る", "集める", "日々の記録", "その他"] as const;

function SurfaceFrame({
  title,
  production,
  children,
  actions,
}: {
  title: string;
  production: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="supporting-surface-title"
      className="react-supporting-frame"
    >
      <div className="react-supporting-frame-heading">
        <div>
          <Title id="supporting-surface-title" order={2}>
            {title}
          </Title>
          <Text className="react-supporting-production">
            本番対応: {production}
          </Text>
        </div>
        {actions}
      </div>
      <div className="react-supporting-content">{children}</div>
    </section>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Paper
      className="react-supporting-control-group"
      p="md"
      radius="lg"
      withBorder
    >
      <Text fw={700} size="sm">
        {title}
      </Text>
      <div className="react-supporting-control-content">{children}</div>
    </Paper>
  );
}

function DemoCaption({ children }: { children: ReactNode }) {
  return (
    <Text className="react-supporting-demo-caption" size="xs">
      確認状態: {children}
    </Text>
  );
}

function SettingsSurface() {
  const [language, setLanguage] = useState("ja");
  const [archive, setArchive] = useState(true);
  const [history, setHistory] = useState(true);
  const [modules, setModules] = useState({
    bookshelf: true,
    richCard: true,
    shortcuts: true,
    toolbar: true,
  });
  const [saved, setSaved] = useState(false);
  const [pinnedTypes, setPinnedTypes] = useState(["task", "reading", "idea"]);
  const [disabledDomains, setDisabledDomains] = useState([
    "tracking.example",
    "ads.example",
  ]);
  const [tagAliases, setTagAliases] = useState<Record<string, string[]>>({
    development: ["dev"],
    reading: ["books"],
  });
  const [pinnedColors, setPinnedColors] = useState<string[]>([
    EDITOR_COLORS[0],
    EDITOR_COLORS[2],
  ]);
  const toggleModule = (key: keyof typeof modules): void =>
    setModules((current) => ({ ...current, [key]: !current[key] }));

  return (
    <SurfaceFrame
      production="src/app/SeitonPlugin.ts · SeitonSettingTab"
      title="設定"
    >
      <div className="react-supporting-settings-layout">
        <div className="react-supporting-settings-main">
          <ControlGroup title="基本設定">
            <div className="react-supporting-field-grid">
              <Select
                comboboxProps={{ withinPortal: false }}
                data={[
                  { label: "日本語", value: "ja" },
                  { label: "English", value: "en" },
                  { label: "简体中文", value: "zh" },
                  { label: "한국어", value: "ko" },
                  { label: "Español", value: "es" },
                  { label: "Português (Brasil)", value: "pt-BR" },
                  { label: "Français", value: "fr" },
                  { label: "Deutsch", value: "de" },
                ]}
                label="表示言語"
                onChange={(value) => setLanguage(value ?? "ja")}
                value={language}
              />
              <TextInput defaultValue="Seiton" label="Seitonの保存先" />
              <TextInput defaultValue="Seiton/Memos" label="一言メモの保存先" />
              <TextInput defaultValue="Seiton/inbox" label="未整理の保存先" />
            </div>
            <div className="react-supporting-switch-list">
              <Switch
                checked={archive}
                label="アーカイブを検索対象に含める"
                onChange={(event) => setArchive(event.currentTarget.checked)}
              />
              <Switch
                defaultChecked
                label="共有テキストの既定の保存先を一言メモにする"
              />
            </div>
          </ControlGroup>

          <ControlGroup title="検索">
            <div className="react-supporting-field-grid">
              <TextInput
                defaultValue="03_Projects, 05_Knowledge"
                label="追加検索フォルダ"
              />
              <TextInput
                defaultValue="20"
                inputMode="numeric"
                label="検索履歴の最大件数"
              />
            </div>
            <div className="react-supporting-switch-list">
              <Switch
                defaultChecked
                label="一言メモファイルを検索対象に含める"
              />
              <Switch
                checked={history}
                label="検索履歴を保存する"
                onChange={(event) => setHistory(event.currentTarget.checked)}
              />
              <Switch
                checked={archive}
                label="アーカイブを検索結果へ表示する"
                onChange={(event) => setArchive(event.currentTarget.checked)}
              />
            </div>
          </ControlGroup>

          <ControlGroup title="有効なタイプ・表示順">
            <div className="react-supporting-type-checks">
              {NOTE_TYPES.map((item) => (
                <Checkbox
                  defaultChecked={item.key !== "profile"}
                  key={item.key}
                  label={item.label}
                />
              ))}
            </div>
            <Divider my="md" />
            <StringListEditor
              addLabel="追加"
              addPlaceholder="タイプ名"
              duplicateMessage="このタイプはすでにあります。"
              emptyLabel="まだタイプがありません。"
              itemLabel="タイプ"
              moveDownLabel="下へ移動"
              moveUpLabel="上へ移動"
              onChange={setPinnedTypes}
              removeLabel="削除"
              requiredMessage="値を入力してください。"
              values={pinnedTypes}
            />
          </ControlGroup>

          <ControlGroup title="モジュール">
            <div className="react-supporting-module-checks">
              <Switch
                checked={modules.bookshelf}
                label="本棚"
                onChange={() => toggleModule("bookshelf")}
              />
              <Switch
                checked={modules.richCard}
                label="リッチカード"
                onChange={() => toggleModule("richCard")}
              />
              <Switch
                checked={modules.toolbar}
                label="エディターツールバー"
                onChange={() => toggleModule("toolbar")}
              />
              <Switch
                checked={modules.shortcuts}
                label="ショートカット"
                onChange={() => toggleModule("shortcuts")}
              />
            </div>
          </ControlGroup>

          <ControlGroup title="本棚・書誌情報">
            <div className="react-supporting-field-grid">
              <TextInput
                defaultValue="30"
                label="書誌情報のキャッシュ期間（日）"
              />
              <TextInput
                defaultValue="Open Library"
                label="ISBN取得先"
                readOnly
              />
            </div>
            <Text className="react-supporting-muted" size="sm">
              ISBN、書名、著者の入力から書誌情報を取得します。通信失敗時は手入力で登録できます。
            </Text>
          </ControlGroup>

          <ControlGroup title="タイプ別フォルダ・テンプレート">
            <div className="react-supporting-field-grid">
              <Select
                comboboxProps={{ withinPortal: false }}
                data={NOTE_TYPES.map((item) => ({
                  label: item.label,
                  value: item.key,
                }))}
                defaultValue="task"
                label="タイプ"
              />
              <TextInput defaultValue="Seiton/tasks" label="保存フォルダ" />
            </div>
            <Textarea
              defaultValue="## 内容\n\n## 次の一手\n"
              label="テンプレート本文"
              minRows={3}
            />
          </ControlGroup>

          <ControlGroup title="リッチカード・タグ">
            <div className="react-supporting-field-grid">
              <TextInput defaultValue="50" label="画像キャッシュ上限（MB）" />
            </div>
            <StringListEditor
              addLabel="追加"
              addPlaceholder="無効化するドメイン"
              duplicateMessage="このドメインはすでにあります。"
              emptyLabel="まだドメインがありません。"
              itemLabel="ドメイン"
              moveDownLabel="下へ移動"
              moveUpLabel="上へ移動"
              normalize={(value) => value.trim().toLowerCase()}
              onChange={setDisabledDomains}
              removeLabel="削除"
              requiredMessage="値を入力してください。"
              values={disabledDomains}
            />
            <TagAliasEditor
              initialValues={tagAliases}
              labels={{
                addAlias: "別名を追加",
                addMapping: "タグの対応を追加",
                aliasLabel: "別名",
                aliasPlaceholder: "別名タグ",
                canonicalLabel: "正規タグ",
                duplicateMessage: "このタグはすでにあります。",
                emptyLabel: "タグの対応がありません。",
                removeLabel: "削除",
                requiredMessage: "値を入力してください。",
              }}
              onChange={setTagAliases}
            />
          </ControlGroup>

          <ControlGroup title="エディターツールバー">
            <ColorPaletteEditor
              colors={EDITOR_COLORS}
              labels={{
                all: "すべての色を表示",
                hint: "ピン留めした色だけをツールバーに表示します。",
                label: "ツールバーの色",
              }}
              onChange={setPinnedColors}
              values={pinnedColors}
            />
          </ControlGroup>
        </div>
        <aside className="react-supporting-settings-summary">
          <Card padding="md" radius="lg" withBorder>
            <Text fw={700}>保存前の変更</Text>
            <div className="react-supporting-summary-lines">
              <span>
                表示言語{" "}
                <b>{language === "ja" ? "日本語" : <span>{language}</span>}</b>
              </span>
              <span>
                モジュール{" "}
                <b>{Object.values(modules).filter(Boolean).length} / 4</b>
              </span>
              <span>
                検索履歴 <b>{history ? "有効" : "無効"}</b>
              </span>
            </div>
            <Button color="ink" fullWidth onClick={() => setSaved(true)}>
              設定を保存
            </Button>
            {Boolean(saved) && (
              <Alert color="accent" mt="sm" role="status" variant="light">
                設定を保存しました
              </Alert>
            )}
          </Card>
        </aside>
      </div>
      <DemoCaption>設定項目のグループ、保存状態、8言語の選択肢</DemoCaption>
    </SurfaceFrame>
  );
}

function ModalLauncher({
  label,
  description,
  onOpen,
}: {
  label: string;
  description: string;
  onOpen: () => void;
}) {
  return (
    <Card
      className="react-supporting-launcher"
      padding="lg"
      radius="lg"
      withBorder
    >
      <div>
        <Text fw={700}>{label}</Text>
        <Text className="react-supporting-muted" size="sm">
          {description}
        </Text>
      </div>
      <Button onClick={onOpen} variant="default">
        モーダルを開く
      </Button>
    </Card>
  );
}

function NewNoteModal({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const grouped = useMemo(
    () =>
      TYPE_GROUPS.map((group) => ({
        group,
        items: NOTE_TYPES.filter((item) => item.group === group),
      })),
    []
  );
  useEffect(() => {
    if (selected) {
      titleInputRef.current?.focus();
    }
  }, [selected]);
  const submit = (): void => {
    if (!(selected && title.trim())) {
      setError("タイプとタイトルを入力してください");
      return;
    }
    onClose();
    onNotice(`${title.trim()}を作成しました`);
  };
  return (
    <Stack gap="md">
      <div className="react-supporting-modal-section">
        <Text fw={700} size="sm">
          最近使ったタイプ
        </Text>
        <div className="react-supporting-type-grid compact">
          {NOTE_TYPES.slice(0, 4).map((item) => (
            <Button
              aria-pressed={selected === item.key}
              color={selected === item.key ? "accent" : "ink"}
              key={item.key}
              onClick={() => {
                setSelected(item.key);
                setError("");
              }}
              variant={selected === item.key ? "light" : "default"}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {grouped.map(({ group, items }) => (
        <div className="react-supporting-modal-section" key={group}>
          <Text fw={700} size="sm">
            {group}
          </Text>
          <div className="react-supporting-type-grid">
            {items.map((item) => (
              <Button
                aria-pressed={selected === item.key}
                color={selected === item.key ? "accent" : "ink"}
                key={item.key}
                onClick={() => {
                  setSelected(item.key);
                  setError("");
                }}
                variant={selected === item.key ? "light" : "default"}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <TextInput
        disabled={!selected}
        error={error}
        label="タイトル"
        onChange={(event) => setTitle(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          }
        }}
        placeholder={selected ? "タイトルを入力" : "タイプを選択してください"}
        ref={titleInputRef}
        value={title}
      />
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          キャンセル
        </Button>
        <Button
          color="ink"
          disabled={!(selected && title.trim())}
          onClick={submit}
        >
          作成
        </Button>
      </Group>
    </Stack>
  );
}

function ShortcutAddModal({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const valid = Boolean(name.trim() && url.trim());
  return (
    <Stack gap="lg">
      <TextInput
        autoFocus
        label="名前"
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <TextInput
        label="URL"
        onChange={(event) => setUrl(event.currentTarget.value)}
        placeholder="https://example.com"
        value={url}
      />
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          キャンセル
        </Button>
        <Button
          color="ink"
          disabled={!valid}
          onClick={() => {
            onClose();
            onNotice("ショートカットを追加しました");
          }}
        >
          完了
        </Button>
      </Group>
    </Stack>
  );
}

function TagsModal({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const [tags, setTags] = useState(["開発", "UI"]);
  const [input, setInput] = useState("");
  const suggestions = ["開発", "UI", "設計", "デザイン", "AI", "読書", "検索"];
  const add = (tag: string): void => {
    const clean = normalizeTagInput(tag);
    if (clean && !tags.includes(clean)) {
      setTags((current) => [...current, clean]);
    }
    setInput("");
  };
  return (
    <Stack gap="md">
      <Text className="react-supporting-muted" size="sm">
        タグはEnterで追加できます。既存の別名は正規タグへ統合します。
      </Text>
      <div className="react-supporting-tag-chips">
        {tags.map((tag) => (
          <Badge
            color="accent"
            key={tag}
            rightSection={
              <button
                aria-label={`${tag}を削除`}
                onClick={() =>
                  setTags((current) => current.filter((value) => value !== tag))
                }
                type="button"
              >
                ×
              </button>
            }
            variant="light"
          >
            #{tag}
          </Badge>
        ))}
      </div>
      <TextInput
        label="タグ"
        onChange={(event) => setInput(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(input);
          }
        }}
        placeholder="タグを入力"
        value={input}
      />
      <TagSuggestionChips onSelect={add} selected={tags} tags={suggestions} />
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          キャンセル
        </Button>
        <Button
          color="ink"
          onClick={() => {
            onClose();
            onNotice("タグを保存しました");
          }}
        >
          保存
        </Button>
      </Group>
    </Stack>
  );
}

function MockDateField() {
  const [value, setValue] = useState("2026-08-27");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    startOfMonth(new Date("2026-08-27T00:00:00"))
  );
  const fieldRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverOffset, setPopoverOffset] = useState(0);
  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) {
      setPopoverOffset(0);
      return;
    }
    const updatePopoverPosition = (): void => {
      if (!popoverRef.current) {
        return;
      }
      const rect = popoverRef.current.getBoundingClientRect();
      const bottomOverflow = Math.max(0, rect.bottom - window.innerHeight + 12);
      const topOverflow = Math.max(0, 12 - rect.top);
      const nextOffset = bottomOverflow > 0 ? -bottomOverflow : topOverflow;
      setPopoverOffset((current) =>
        current === nextOffset ? current : nextOffset
      );
    };
    updatePopoverPosition();
    const settleTimer = window.setTimeout(updatePopoverPosition, 260);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open]);
  const days = Array.from({ length: 42 }, (_, index) =>
    addDays(startOfWeek(month, { weekStartsOn: 1 }), index)
  );
  return (
    <div
      className="react-supporting-date-field"
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
      ref={fieldRef}
    >
      <TextInput
        aria-expanded={open}
        aria-haspopup="dialog"
        label="日付"
        onClick={() => setOpen((current) => !current)}
        readOnly
        rightSection={<span aria-hidden="true">▣</span>}
        value={value}
      />
      {Boolean(open) && (
        <div
          aria-label="日付を選択"
          className="react-supporting-date-popover"
          ref={popoverRef}
          role="dialog"
          style={{ transform: `translateY(${popoverOffset}px)` }}
        >
          <div className="react-supporting-date-header">
            <Button
              aria-label="前の月"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              size="compact-sm"
              variant="subtle"
            >
              ‹
            </Button>
            <strong>{format(month, "yyyy年M月")}</strong>
            <Button
              aria-label="次の月"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              size="compact-sm"
              variant="subtle"
            >
              ›
            </Button>
          </div>
          <div className="react-supporting-date-weekdays">
            {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="react-supporting-date-grid">
            {days.map((day) => (
              <button
                className={`${isSameMonth(day, month) ? "" : "is-outside"} ${value === format(day, "yyyy-MM-dd") ? "is-selected" : ""}`}
                key={day.toISOString()}
                onClick={() => {
                  setValue(format(day, "yyyy-MM-dd"));
                  setOpen(false);
                }}
                type="button"
              >
                {format(day, "d")}
              </button>
            ))}
          </div>
          <div className="react-supporting-date-footer">
            <Button
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
              size="compact-sm"
              variant="subtle"
            >
              削除
            </Button>
            <Button
              onClick={() => {
                setValue(format(new Date(), "yyyy-MM-dd"));
                setOpen(false);
              }}
              size="compact-sm"
              variant="subtle"
            >
              今日
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoModal({
  onClose,
  onNotice,
  portalTarget,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
  portalTarget: HTMLElement | null;
}) {
  const [text, setText] = useState("会議で出たキーワードを整理する");
  const [tags, setTags] = useState("#開発 #整理");
  const [confirm, setConfirm] = useState(false);
  const selectedTags = tags
    .split(/[\s,]+/)
    .map(normalizeTagInput)
    .filter(Boolean);
  const addTag = (tag: string): void => {
    const normalized = normalizeTagInput(tag);
    if (!normalized || selectedTags.includes(normalized)) {
      return;
    }
    setTags([...selectedTags, normalized].join(" "));
  };
  return (
    <>
      <Stack gap="md">
        <Textarea
          label="内容"
          minRows={5}
          onChange={(event) => setText(event.currentTarget.value)}
          value={text}
        />
        <MockDateField />
        <TextInput defaultValue="08:06" label="時刻" type="time" />
        <TextInput
          label="タグ"
          onChange={(event) => setTags(event.currentTarget.value)}
          placeholder="#タグ"
          value={tags}
        />
        <TagSuggestionChips
          onSelect={addTag}
          selected={selectedTags}
          tags={["開発", "整理", "UI", "読書", "検索"]}
        />
        <Group justify="space-between">
          <Button color="red" onClick={() => setConfirm(true)} variant="subtle">
            削除
          </Button>
          <Group>
            <Button onClick={onClose} variant="default">
              キャンセル
            </Button>
            <Button
              color="ink"
              onClick={() => {
                onClose();
                onNotice("一言メモを保存しました");
              }}
            >
              保存
            </Button>
          </Group>
        </Group>
      </Stack>
      <Modal
        centered
        closeButtonProps={{ "aria-label": "閉じる" }}
        onClose={() => setConfirm(false)}
        opened={confirm}
        portalProps={{ target: portalTarget ?? document.body }}
        title="一言メモを削除"
        withinPortal
      >
        <Stack>
          <Text>この一言メモを削除しますか？</Text>
          <Group justify="flex-end">
            <Button onClick={() => setConfirm(false)} variant="default">
              キャンセル
            </Button>
            <Button
              color="red"
              onClick={() => {
                setConfirm(false);
                onClose();
                onNotice("一言メモを削除しました");
              }}
            >
              削除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function ToolbarSurface() {
  const [activeColor, setActiveColor] = useState("#fff3a3");
  const [heading, setHeading] = useState("本文");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const colors = [
    "#fff3a3",
    "#bbfabb",
    "#abf7f7",
    "#ffb8eb",
    "#ffb86c",
    "#d2b3ff",
  ];
  const swatchStyle = (color: string): CSSProperties =>
    ({ "--seiton-highlight-color": color }) as CSSProperties;
  return (
    <SurfaceFrame
      production="src/platform/obsidian/editorToolbar.ts"
      title="エディターツールバー"
    >
      <div className="react-supporting-editor-shell">
        <div className="react-supporting-selection-demo">
          <div
            aria-label="選択範囲の書式"
            className="seiton-selection-toolbar react-supporting-selection-toolbar"
            role="toolbar"
          >
            <button
              aria-label="太字"
              aria-pressed={bold}
              className="seiton-selection-tool"
              onClick={() => setBold((current) => !current)}
              type="button"
            >
              B
            </button>
            <button
              aria-label="斜体"
              aria-pressed={italic}
              className="seiton-selection-tool"
              onClick={() => setItalic((current) => !current)}
              type="button"
            >
              I
            </button>
            <span aria-hidden="true" className="seiton-selection-separator" />
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <button
                aria-label={`見出し ${level}`}
                aria-pressed={heading === `h${level}`}
                className={`seiton-selection-tool${heading === `h${level}` ? "is-active" : ""}`}
                key={level}
                onClick={() =>
                  setHeading(heading === `h${level}` ? "本文" : `h${level}`)
                }
                type="button"
              >
                H{level}
              </button>
            ))}
            <span aria-hidden="true" className="seiton-selection-separator" />
            {colors.map((color) => (
              <button
                aria-label={`ハイライト ${color}`}
                aria-pressed={activeColor === color}
                className="seiton-selection-tool seiton-selection-swatch"
                key={color}
                onClick={() => setActiveColor(color)}
                style={swatchStyle(color)}
                type="button"
              />
            ))}
            <button
              aria-label="書式を解除"
              className="seiton-selection-tool"
              onClick={() => {
                setActiveColor("transparent");
                setBold(false);
                setHeading("本文");
                setItalic(false);
              }}
              type="button"
            >
              ×
            </button>
          </div>
          <article className="react-supporting-editor-preview">
            <Title
              order={
                heading === "本文"
                  ? 3
                  : (Math.min(6, Number(heading.slice(1))) as
                      | 1
                      | 2
                      | 3
                      | 4
                      | 5
                      | 6)
              }
              style={{ fontWeight: bold ? 800 : 600 }}
            >
              <span
                style={{
                  background: activeColor,
                  fontStyle: italic ? "italic" : "normal",
                }}
              >
                選択したテキストの表示
              </span>
            </Title>
            <Text>
              テキストを選択したときだけ、選択範囲の近くに書式ツールバーが現れます。
            </Text>
            <blockquote>
              太字・斜体・見出し・ハイライトを連続して適用できます。
            </blockquote>
          </article>
        </div>
      </div>
      <DemoCaption>
        選択範囲に追従、太字、斜体、H1〜H6、ハイライト、解除
      </DemoCaption>
    </SurfaceFrame>
  );
}

type RichState = "ready" | "loading" | "empty" | "error" | "disabled";
function RichCardSurface() {
  const [state, setState] = useState<RichState>("ready");
  const content = {
    disabled: {
      copy: "無効ドメインはカードを表示しない",
      domain: "",
      title: "",
    },
    empty: {
      copy: "画像なしでもカード骨格を維持",
      domain: "example.com",
      title: "画像なしの記事",
    },
    error: {
      copy: "失敗状態を表示",
      domain: "",
      title: "読み込みに失敗しました",
    },
    loading: {
      copy: "スケルトン表示",
      domain: "",
      title: "メタデータを取得中",
    },
    ready: {
      copy: "画像・タイトル・ドメインを表示",
      domain: "example.com",
      title: "深層学習の最新動向",
    },
  }[state];
  return (
    <SurfaceFrame
      production="src/ui/patterns/RichCard.tsx"
      title="リッチカード"
    >
      <div className="react-supporting-rich-controls">
        {(
          ["ready", "loading", "empty", "error", "disabled"] as RichState[]
        ).map((value) => (
          <Button
            color={state === value ? "accent" : "ink"}
            key={value}
            onClick={() => setState(value)}
            size="sm"
            variant={state === value ? "light" : "default"}
          >
            {value}
          </Button>
        ))}
      </div>
      <section
        aria-label={`リッチカード ${state}`}
        className={`react-supporting-rich-card state-${state}`}
      >
        {state === "disabled" ? (
          <div className="react-supporting-rich-disabled">
            <strong>カード非表示</strong>
            <span>拒否ドメイン: tracking.example</span>
          </div>
        ) : (
          <>
            <div className={`react-supporting-rich-media state-${state}`}>
              {state === "ready" && <span>WEB</span>}
              {state === "empty" && <span>画像なし</span>}
              {state === "loading" && <span>取得中</span>}
              {state === "error" && <span>!</span>}
            </div>
            <div className="react-supporting-rich-copy">
              <strong>{content.title}</strong>
              <span>{content.domain || content.copy}</span>
            </div>
          </>
        )}
      </section>
      <DemoCaption>通常・loading・画像なし・error・拒否ドメイン</DemoCaption>
    </SurfaceFrame>
  );
}

function DialogSurface({
  onOpen,
}: {
  onOpen: (modal: "prompt" | "confirm") => void;
}) {
  return (
    <SurfaceFrame
      production="src/ui/patterns/ProductionDialog.tsx"
      title="確認・入力ダイアログ"
    >
      <div className="react-supporting-launcher-grid">
        <ModalLauncher
          description="URL、フォルダ名、リスト名などの短い文字列を入力"
          label="入力ダイアログ"
          onOpen={() => onOpen("prompt")}
        />
        <ModalLauncher
          description="削除やアーカイブなど、結果を確認してから実行"
          label="確認ダイアログ"
          onOpen={() => onOpen("confirm")}
        />
      </div>
      <DemoCaption>
        画面中央に表示、キャンセル、確定、キーボードフォーカス
      </DemoCaption>
    </SurfaceFrame>
  );
}

function SupportingSurface({ scheme }: { scheme: ColorScheme }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [surface, setSurface] = useState<SurfaceKey>("settings");
  const [modal, setModal] = useState<ModalKey>(null);
  const [dialog, setDialog] = useState<"prompt" | "confirm" | null>(null);
  const [notice, setNotice] = useState("");
  const selected = SURFACES.find((item) => item.key === surface) ?? SURFACES[0];

  useEffect(() => {
    if (rootRef.current) {
      setPortalTarget(rootRef.current);
    }
  }, []);

  const announce = (message: string): void => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const modalPortalProps = { target: portalTarget ?? document.body };
  const modalClassNames = {
    content: "react-supporting-modal-content",
    header: "react-supporting-modal-header",
  };

  return (
    <div
      className="seiton-react-supporting-prototype"
      data-scheme={scheme}
      ref={rootRef}
    >
      <header className="react-supporting-header">
        <div>
          <Title order={1}>補助UI</Title>
          <Text className="react-supporting-lede">
            設定、モーダル、共通部品の状態を本番実装へ対応づけて確認する。
          </Text>
        </div>
      </header>
      <nav aria-label="確認するUI" className="react-supporting-nav">
        <div className="react-supporting-nav-scroll">
          {SURFACES.map((item) => (
            <button
              className={surface === item.key ? "is-active" : ""}
              key={item.key}
              onClick={() => setSurface(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <main>
        {surface === "settings" && <SettingsSurface />}
        {surface === "new-note" && (
          <SurfaceFrame
            production="src/app/mountSeitonApp.tsx"
            title="新規作成"
          >
            <ModalLauncher
              description="タイプ選択、タイトル入力、作成失敗を確認"
              label="新規作成モーダル"
              onOpen={() => setModal("new-note")}
            />
            <div className="react-supporting-state-matrix">
              <span>未選択: タイトル入力 disabled / 作成 disabled</span>
              <span>選択済み: タイトルへ focus / 作成 enabled</span>
              <span>エラー: 作成失敗を入力欄下へ表示</span>
            </div>
            <DemoCaption>
              4グループ、最近使ったタイプ、未選択・選択済み・error
            </DemoCaption>
          </SurfaceFrame>
        )}
        {surface === "shortcut" && (
          <SurfaceFrame
            production="src/app/mountSeitonApp.tsx"
            title="ショートカット追加"
          >
            <ModalLauncher
              description="名前とURLを入力してホームへ追加"
              label="ショートカット追加モーダル"
              onOpen={() => setModal("shortcut")}
            />
            <DemoCaption>名前・URLの必須状態、キャンセル、完了</DemoCaption>
          </SurfaceFrame>
        )}
        {surface === "tags" && (
          <SurfaceFrame
            production="src/app/mountSeitonApp.tsx"
            title="タグ編集"
          >
            <ModalLauncher
              description="タグチップ、候補、別名の正規化、保存"
              label="タグ編集モーダル"
              onOpen={() => setModal("tags")}
            />
            <DemoCaption>既存タグ、入力、候補、削除、保存</DemoCaption>
          </SurfaceFrame>
        )}
        {surface === "memo" && (
          <SurfaceFrame
            production="src/app/mountSeitonApp.tsx"
            title="一言メモ編集"
          >
            <ModalLauncher
              description="内容、日付、時刻、タグ、削除確認を設定"
              label="一言メモ編集モーダル"
              onOpen={() => setModal("memo")}
            />
            <DemoCaption>日付ピッカー、時刻、タグ、保存、削除確認</DemoCaption>
          </SurfaceFrame>
        )}
        {surface === "toolbar" && <ToolbarSurface />}
        {surface === "rich-card" && <RichCardSurface />}
        {surface === "dialogs" && (
          <DialogSurface onOpen={(kind) => setDialog(kind)} />
        )}
      </main>
      {Boolean(notice) && (
        <Alert
          className="react-supporting-notice"
          color="accent"
          role="status"
          variant="light"
        >
          {notice}
        </Alert>
      )}
      <footer className="react-supporting-footer">
        <Text className="react-supporting-muted" size="xs">
          共通React UI · 本番はObsidian API、ハーネスはmock
          APIを接続しています。現在のUI面: {selected.label}
        </Text>
      </footer>
      <Modal
        centered
        classNames={modalClassNames}
        closeButtonProps={{ "aria-label": "閉じる" }}
        onClose={() => setModal(null)}
        opened={modal !== null}
        portalProps={modalPortalProps}
        title={
          modal === "new-note"
            ? "新しく作成"
            : modal === "shortcut"
              ? "追加"
              : modal === "tags"
                ? "タグを編集"
                : "一言メモを編集"
        }
        withinPortal
      >
        {modal === "new-note" && (
          <NewNoteModal onClose={() => setModal(null)} onNotice={announce} />
        )}
        {modal === "shortcut" && (
          <ShortcutAddModal
            onClose={() => setModal(null)}
            onNotice={announce}
          />
        )}
        {modal === "tags" && (
          <TagsModal onClose={() => setModal(null)} onNotice={announce} />
        )}
        {modal === "memo" && (
          <MemoModal
            onClose={() => setModal(null)}
            onNotice={announce}
            portalTarget={portalTarget}
          />
        )}
      </Modal>
      <Modal
        centered
        classNames={modalClassNames}
        closeButtonProps={{ "aria-label": "閉じる" }}
        onClose={() => setDialog(null)}
        opened={dialog === "prompt"}
        portalProps={modalPortalProps}
        title="値を入力"
        withinPortal
      >
        <Stack>
          <TextInput defaultValue="Seiton/items" label="値" />
          <Group justify="flex-end">
            <Button onClick={() => setDialog(null)} variant="default">
              キャンセル
            </Button>
            <Button
              color="ink"
              onClick={() => {
                setDialog(null);
                announce("入力値を保存しました");
              }}
            >
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        classNames={modalClassNames}
        closeButtonProps={{ "aria-label": "閉じる" }}
        onClose={() => setDialog(null)}
        opened={dialog === "confirm"}
        portalProps={modalPortalProps}
        title="削除を確認"
        withinPortal
      >
        <Stack>
          <Text>選択したノートを削除しますか？</Text>
          <Text className="react-supporting-muted" size="sm">
            削除後はObsidianのゴミ箱から復元できます。
          </Text>
          <Group justify="flex-end">
            <Button onClick={() => setDialog(null)} variant="default">
              キャンセル
            </Button>
            <Button
              color="red"
              onClick={() => {
                setDialog(null);
                announce("削除を実行しました");
              }}
            >
              削除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

function PrototypeApp() {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <SupportingSurface scheme={scheme} />
    </SeitonUIProvider>
  );
}

export function mountReactSupportingPrototype(root: HTMLElement): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(<PrototypeApp />);
  return () => reactRoot.unmount();
}
