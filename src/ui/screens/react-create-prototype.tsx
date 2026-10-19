/** @jsxImportSource react */

import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CreateNoteInput } from "../../shared/createTypes";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import { isWithinFolder } from "../../shared/library";
import {
  folderForType,
  normalizeSubfolder,
  SubfolderValidationError,
} from "../../shared/paths";
import { safeFilename } from "../../shared/sanitize";
import { parseTagInput } from "../../shared/tags";
import type { CreatePreset, ItemType } from "../../shared/types";
import { FolderTreePicker } from "../patterns/FolderTreePicker";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

export interface CreateSurfaceProps {
  baseFolder?: string;
  folderOptions?: readonly string[];
  initialPreset?: CreatePreset;
  lang?: Lang;
  onBack?: () => void | Promise<void>;
  onCreate?: (input: CreateNoteInput) => void | Promise<void>;
  onDeletePreset?: (presetId: string) => void | Promise<void>;
  onSavePreset?: (preset: CreatePreset) => void | Promise<void>;
  pinnedCreatePresets?: readonly CreatePreset[];
  scheme: ColorScheme;
  type: ItemType;
}

export interface CreatePresetManagerProps {
  availableTypes: readonly ItemType[];
  baseFolders?: Partial<Record<ItemType, string>>;
  initialPresetId?: string;
  lang?: Lang;
  onBack?: () => void | Promise<void>;
  onDeletePreset?: (presetId: string) => void | Promise<void>;
  onSavePreset?: (preset: CreatePreset) => void | Promise<void>;
  pinnedCreatePresets?: readonly CreatePreset[];
}

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

function subfolderValidationMessage(lang: Lang, cause: unknown): string {
  if (cause instanceof SubfolderValidationError) {
    return t(
      lang,
      cause.reason === "parent-directory"
        ? "new.subfolderParentError"
        : "new.subfolderInvalidError"
    );
  }
  return t(lang, "new.subfolderInvalidError");
}

/** 保存先とタグだけを管理する、新規作成フロー内のプリセット編集面。 */
export function CreatePresetManager({
  availableTypes,
  baseFolders = {},
  initialPresetId,
  lang = "ja",
  onBack,
  onDeletePreset,
  onSavePreset,
  pinnedCreatePresets = [],
}: CreatePresetManagerProps) {
  const firstType = availableTypes[0] ?? "idea";
  const initialPreset = pinnedCreatePresets.find(
    (preset) => preset.id === initialPresetId
  );
  const [type, setType] = useState<ItemType>(initialPreset?.type ?? firstType);
  const [subfolder, setSubfolder] = useState(initialPreset?.subfolder ?? "");
  const [tagInput, setTagInput] = useState(
    initialPreset?.tags.join(", ") ?? ""
  );
  const [presetLabel, setPresetLabel] = useState(initialPreset?.label ?? "");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    initialPreset?.id ?? null
  );
  const [availablePresets, setAvailablePresets] = useState<CreatePreset[]>(
    () => [...pinnedCreatePresets]
  );
  const [presetMessage, setPresetMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isMemo = type === "memo";
  const tags = parseTagInput(tagInput);

  let normalizedSubfolder = "";
  let subfolderError = "";
  try {
    normalizedSubfolder = isMemo ? "" : normalizeSubfolder(subfolder);
  } catch (cause) {
    subfolderError = subfolderValidationMessage(lang, cause);
  }

  const selectedFolder = baseFolders[type] ?? t(lang, "new.presetRootFolder");
  const matchingPresets = availablePresets.filter(
    (preset) => preset.type === type
  );
  const canSavePreset = Boolean(
    onSavePreset &&
      presetLabel.trim() &&
      (normalizedSubfolder || tags.length > 0) &&
      !subfolderError
  );

  const resetDraft = (nextType: ItemType): void => {
    setType(nextType);
    setSubfolder("");
    setTagInput("");
    setPresetLabel("");
    setSelectedPresetId(null);
    setPresetMessage("");
    setError("");
  };

  const applyPreset = (preset: CreatePreset): void => {
    setType(preset.type);
    setSelectedPresetId(preset.id);
    setPresetLabel(preset.label);
    setSubfolder(preset.subfolder);
    setTagInput(preset.tags.join(", "));
    setPresetMessage("");
    setError("");
  };

  const savePreset = async (): Promise<void> => {
    if (!canSavePreset || saving) {
      return;
    }
    setSaving(true);
    setError("");
    setPresetMessage("");
    const nextPreset: CreatePreset = {
      id:
        selectedPresetId ??
        `create-preset:${type}:${normalizedSubfolder}:${tags.join("|")}`,
      label: presetLabel.trim(),
      subfolder: normalizedSubfolder,
      tags,
      type,
    };
    try {
      await onSavePreset?.(nextPreset);
      setAvailablePresets((current) =>
        [
          nextPreset,
          ...current.filter(
            (existing) =>
              existing.id !== nextPreset.id &&
              !(
                existing.type === nextPreset.type &&
                existing.subfolder === nextPreset.subfolder &&
                existing.tags.join("|") === nextPreset.tags.join("|")
              )
          ),
        ].slice(0, 20)
      );
      setSelectedPresetId(nextPreset.id);
      setPresetMessage(t(lang, "new.presetSaved"));
    } catch {
      setError(t(lang, "new.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const removePreset = async (): Promise<void> => {
    if (!(selectedPresetId && onDeletePreset) || saving) {
      return;
    }
    setSaving(true);
    setError("");
    setPresetMessage("");
    try {
      await onDeletePreset(selectedPresetId);
      setAvailablePresets((current) =>
        current.filter((preset) => preset.id !== selectedPresetId)
      );
      resetDraft(type);
      setPresetMessage(t(lang, "new.presetRemoved"));
    } catch {
      setError(t(lang, "new.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="react-create-preset-manager">
      <div className="react-create-manager-intro">
        <Button
          onClick={() => void onBack?.()}
          size="sm"
          type="button"
          variant="subtle"
        >
          ← {t(lang, "new.back")}
        </Button>
      </div>

      <section
        aria-labelledby="react-create-preset-editor-heading"
        className="react-create-manager-editor"
      >
        <div className="react-create-section-heading">
          <div>
            <Title id="react-create-preset-editor-heading" order={3} size="h4">
              {selectedPresetId
                ? t(lang, "new.presetEditTitle")
                : t(lang, "new.presetAdd")}
            </Title>
            <Text className="react-create-muted" size="sm">
              {t(lang, "new.presetSaveHint")}
            </Text>
          </div>
          <Badge color="accent" size="sm" variant="light">
            {matchingPresets.length}
          </Badge>
        </div>

        <Select
          data={availableTypes.map((value) => ({
            label: typeLabel(lang, value),
            value,
          }))}
          data-seiton-autofocus=""
          description={t(lang, "new.presetsHint")}
          label={t(lang, "new.chooseType")}
          onChange={(value) => {
            if (value && availableTypes.includes(value as ItemType)) {
              resetDraft(value as ItemType);
            }
          }}
          value={type}
        />
        <TextInput
          description={
            isMemo
              ? t(lang, "new.memoFolderHint")
              : t(lang, "new.folderHintWithPath", { folder: selectedFolder })
          }
          disabled={isMemo}
          error={subfolderError || undefined}
          label={t(lang, "new.subfolder")}
          onChange={(event) => {
            setSubfolder(event.currentTarget.value);
            setPresetMessage("");
          }}
          placeholder={
            isMemo
              ? t(lang, "new.memoFolderHint")
              : t(lang, "new.subfolderHint")
          }
          value={subfolder}
        />
        <TextInput
          description={t(lang, "new.tagsHint")}
          label={t(lang, "new.tagsOptional")}
          onChange={(event) => {
            setTagInput(event.currentTarget.value);
            setPresetMessage("");
          }}
          placeholder={t(lang, "new.tagsPlaceholder")}
          value={tagInput}
        />
        {tags.length > 0 && (
          <Group
            aria-label={t(lang, "new.tags")}
            className="react-create-tag-preview"
            gap="xs"
          >
            {tags.map((tag) => (
              <Badge color="accent" key={tag} variant="light">
                #{tag}
              </Badge>
            ))}
          </Group>
        )}
        <TextInput
          label={t(lang, "new.presetName")}
          onChange={(event) => {
            setPresetLabel(event.currentTarget.value);
            setPresetMessage("");
          }}
          placeholder={t(lang, "new.presetNamePlaceholder")}
          value={presetLabel}
        />
        <Group gap="sm" justify="flex-end">
          {Boolean(selectedPresetId) && (
            <Button
              disabled={saving}
              onClick={() => void removePreset()}
              type="button"
              variant="default"
            >
              {t(lang, "new.presetRemove")}
            </Button>
          )}
          <Button
            disabled={!canSavePreset || saving}
            loading={saving}
            onClick={() => void savePreset()}
            type="button"
            variant="outline"
          >
            {selectedPresetId
              ? t(lang, "new.presetUpdate")
              : t(lang, "new.presetPin")}
          </Button>
        </Group>
        {Boolean(presetMessage) && (
          <Text aria-live="polite" className="react-create-preset-message">
            {presetMessage}
          </Text>
        )}
        {Boolean(error) && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
      </section>

      <section
        aria-labelledby="react-create-preset-list-heading"
        className="react-create-manager-list"
      >
        <div className="react-create-section-heading">
          <div>
            <Title id="react-create-preset-list-heading" order={3} size="h4">
              {t(lang, "new.presetRegistered")}
            </Title>
            <Text className="react-create-muted" size="sm">
              {t(lang, "new.presetsHint")}
            </Text>
          </div>
        </div>
        {availablePresets.length > 0 ? (
          <div className="react-create-preset-list">
            {availablePresets.map((preset) => (
              <Button
                className={
                  preset.id === selectedPresetId
                    ? "react-create-preset-button is-selected"
                    : "react-create-preset-button"
                }
                data-create-preset={preset.id}
                key={preset.id}
                onClick={() => applyPreset(preset)}
                type="button"
                variant="default"
              >
                <strong>
                  {preset.label} · {typeLabel(lang, preset.type)}
                </strong>
                <span>
                  {preset.subfolder || t(lang, "new.presetRootFolder")}
                  {preset.tags.length > 0
                    ? ` · ${preset.tags.map((tag) => `#${tag}`).join(" ")}`
                    : ""}
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <Text className="react-create-presets-empty" size="sm">
            {t(lang, "new.presetEmpty")}
          </Text>
        )}
      </section>
    </div>
  );
}

export function ReactCreateSurface({
  baseFolder,
  folderOptions = [],
  initialPreset,
  lang = "ja",
  type,
  onCreate,
  onBack,
}: Omit<CreateSurfaceProps, "scheme"> & { scheme: ColorScheme }) {
  const isMemo = type === "memo";
  const resolvedBaseFolder =
    baseFolder ??
    folderForType({ memosFolder: "Memos", rootFolder: "Seiton" }, type);
  const [title, setTitle] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [subfolder, setSubfolder] = useState(initialPreset?.subfolder ?? "");
  const [destinationFolder, setDestinationFolder] =
    useState(resolvedBaseFolder);
  const [tagInput, setTagInput] = useState(
    initialPreset?.tags.join(", ") ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tags = parseTagInput(tagInput);
  const destinationOptions = [
    ...new Set([
      resolvedBaseFolder,
      ...folderOptions.filter((path) =>
        isWithinFolder(path, resolvedBaseFolder)
      ),
    ]),
  ].sort((left, right) => left.localeCompare(right, lang));

  let normalizedSubfolder = "";
  let subfolderError = "";
  try {
    normalizedSubfolder = isMemo ? "" : normalizeSubfolder(subfolder);
  } catch (cause) {
    subfolderError = subfolderValidationMessage(lang, cause);
  }
  const resolvedFolder = normalizedSubfolder
    ? `${destinationFolder}/${normalizedSubfolder}`
    : destinationFolder;
  const currentMonth = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;
  const memoAppendMarker = `${lang === "ja" || lang === "zh-CN" ? "" : " "}${t(
    lang,
    "new.memoAppendMarker"
  )}`;
  const pathPreview = isMemo
    ? `${resolvedBaseFolder}/${currentMonth}.md${memoAppendMarker}`
    : `${resolvedFolder}/${safeFilename(title, t(lang, "new.untitled"))}.md`;
  const updateSubfolder = (value: string): void => {
    setSubfolder(value);
  };

  const updateTagInput = (value: string): void => {
    setTagInput(value);
  };

  const create = async (): Promise<void> => {
    const value = title.trim();
    if (!value || saving) {
      return;
    }
    if (subfolderError) {
      setError(subfolderError);
      return;
    }
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      await onCreate?.({
        destinationFolder,
        subfolder: normalizedSubfolder,
        tags,
        title: value,
        type,
      });
      if (onCreate && isMemo) {
        setTitle("");
        setSavedMessage(t(lang, "memo.saved"));
        titleInputRef.current?.focus();
      }
    } catch {
      setError(t(lang, "new.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="seiton-react-create-prototype">
      <header className="react-create-header">
        <div>
          <Title className="react-create-heading" order={1}>
            {typeLabel(lang, type)}
          </Title>
        </div>
      </header>

      <main className="react-create-main">
        <Card className="react-create-form" padding="xl" radius="lg" withBorder>
          <Stack gap="lg">
            {!isMemo && (
              <div>
                <Title order={2} size="h3">
                  {t(lang, "new.titlePlaceholder")}
                </Title>
                <Text className="react-create-muted" size="sm">
                  {t(lang, "new.titleHint", { type: typeLabel(lang, type) })}
                </Text>
              </div>
            )}
            <TextInput
              autoFocus
              label={
                isMemo
                  ? t(lang, "edit.content")
                  : t(lang, "new.titlePlaceholder")
              }
              onChange={(event) => {
                setTitle(event.currentTarget.value);
                setSavedMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  void create();
                }
              }}
              placeholder={isMemo ? undefined : t(lang, "new.title")}
              ref={titleInputRef}
              value={title}
            />
            {Boolean(error) && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            {Boolean(savedMessage) && (
              <Alert color="accent" role="status" variant="light">
                {savedMessage}
              </Alert>
            )}
            <section
              aria-labelledby="react-create-location-heading"
              className="react-create-location"
            >
              <div className="react-create-section-heading">
                <div>
                  <Title id="react-create-location-heading" order={3} size="h4">
                    {t(lang, "new.folder")}
                  </Title>
                  <Text className="react-create-muted" size="sm">
                    {isMemo
                      ? t(lang, "new.memoFolderHint")
                      : t(lang, "new.folderHint")}
                  </Text>
                </div>
                <Badge color="accent" size="sm" variant="light">
                  {destinationFolder}
                </Badge>
              </div>
              {!isMemo && (
                <Stack gap="sm">
                  <FolderTreePicker
                    label={t(lang, "organize.destination")}
                    lang={lang}
                    onChange={setDestinationFolder}
                    options={destinationOptions.map((path) => ({ path }))}
                    placeholder={resolvedBaseFolder}
                    value={destinationFolder}
                  />
                  <TextInput
                    description={t(lang, "new.subfolderHint")}
                    error={subfolderError || undefined}
                    label={t(lang, "new.subfolder")}
                    onChange={(event) =>
                      updateSubfolder(event.currentTarget.value)
                    }
                    placeholder={t(lang, "new.subfolderHint")}
                    value={subfolder}
                  />
                </Stack>
              )}
              <div aria-live="polite" className="react-create-path-preview">
                <span>{t(lang, "new.pathPreview")}</span>
                <code>{pathPreview}</code>
              </div>
            </section>
            <section
              aria-labelledby="react-create-tags-heading"
              className="react-create-tags"
            >
              <Title id="react-create-tags-heading" order={3} size="h4">
                {t(lang, "new.tags")}
              </Title>
              <TextInput
                description={t(lang, "new.tagsHint")}
                label={t(lang, "new.tagsOptional")}
                onChange={(event) => {
                  updateTagInput(event.currentTarget.value);
                  setSavedMessage("");
                }}
                placeholder={t(lang, "new.tagsPlaceholder")}
                value={tagInput}
              />
              {tags.length > 0 && (
                <Group
                  aria-label={t(lang, "new.tags")}
                  className="react-create-tag-preview"
                  gap="xs"
                >
                  {tags.map((tag) => (
                    <Badge color="accent" key={tag} variant="light">
                      #{tag}
                    </Badge>
                  ))}
                </Group>
              )}
            </section>
            <Group className="react-create-actions" justify="space-between">
              <Button
                disabled={saving}
                onClick={() => void onBack?.()}
                variant="default"
              >
                {t(lang, "new.back")}
              </Button>
              <Button
                color="ink"
                disabled={!title.trim()}
                loading={saving}
                onClick={() => void create()}
              >
                {t(lang, isMemo ? "memo.save" : "action.create")}
              </Button>
            </Group>
          </Stack>
        </Card>
      </main>
    </div>
  );
}

function PrototypeApp({
  baseFolder,
  folderOptions,
  initialPreset,
  lang,
  type,
  onCreate,
  onDeletePreset,
  onSavePreset,
  pinnedCreatePresets,
  onBack,
}: Omit<CreateSurfaceProps, "scheme">) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <ReactCreateSurface
        baseFolder={baseFolder}
        folderOptions={folderOptions}
        initialPreset={initialPreset}
        lang={lang}
        onBack={onBack}
        onCreate={onCreate}
        onDeletePreset={onDeletePreset}
        onSavePreset={onSavePreset}
        pinnedCreatePresets={pinnedCreatePresets}
        scheme={scheme}
        type={type}
      />
    </SeitonUIProvider>
  );
}

export function mountReactCreatePrototype(
  root: HTMLElement,
  options: Omit<CreateSurfaceProps, "scheme">
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(
    <PrototypeApp
      baseFolder={options.baseFolder}
      folderOptions={options.folderOptions}
      initialPreset={options.initialPreset}
      lang={options.lang}
      onBack={options.onBack}
      onCreate={options.onCreate}
      onDeletePreset={options.onDeletePreset}
      onSavePreset={options.onSavePreset}
      pinnedCreatePresets={options.pinnedCreatePresets}
      type={options.type}
    />
  );
  return () => reactRoot.unmount();
}
