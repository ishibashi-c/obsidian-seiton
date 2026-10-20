import {
  type App,
  type Command,
  editorInfoField,
  editorLivePreviewField,
  getLanguage,
  MarkdownRenderChild,
  Notice,
  Plugin,
  PluginSettingTab,
  parseYaml,
  Setting,
  setTooltip,
  TFile,
  ToggleComponent,
} from "obsidian";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  normalizeSettingsSearchText,
  parsePositiveInt,
  settingsSearchMatches,
} from "../features/settings/settingsForm";
import {
  type BookDetailActionController,
  registerBookDetailActions,
} from "../platform/obsidian/bookDetailActions";
import { EditorToolbar } from "../platform/obsidian/editorToolbar";
import { rewriteSettingsPaths } from "../platform/obsidian/homeActions";
import { openReactOnboardingDialog } from "../platform/obsidian/OnboardingDialog";
import { createObsidianProductionAdapter } from "../platform/obsidian/productionAdapter";
import { loadReactProductionData } from "../platform/obsidian/productionData";
import { createRichCardEditorExtension } from "../platform/obsidian/richCardEditorExtension";
import { getRichCardStore } from "../platform/obsidian/richCardStore";
import {
  ReactBookshelfView,
  ReactCreateView,
  ReactHomeView,
  ReactLibraryView,
  ReactMemoReviewView,
  ReactOrganizeView,
  ReactSearchView,
} from "../platform/obsidian/views";
import {
  saveSharedText,
  saveWebClip,
  updateWebClipTitle,
} from "../platform/obsidian/webClipStore";
import { splitCalilArea } from "../shared/calil";
import {
  DEFAULT_INBOX_FOLDER,
  DEFAULT_MEMOS_FOLDER,
  DEFAULT_RICH_CARD_CACHE_MAX_BYTES,
  DEFAULT_ROOT_FOLDER,
  EDITOR_COLORS,
  ITEM_TYPES,
  VIEW_TYPE_BOOKSHELF,
  VIEW_TYPE_CREATE,
  VIEW_TYPE_HOME,
  VIEW_TYPE_LIBRARY,
  VIEW_TYPE_MEMO_REVIEW,
  VIEW_TYPE_ORGANIZE,
  VIEW_TYPE_SEARCH,
} from "../shared/constants";
import { parseItem, setYamlParser } from "../shared/frontmatter";
import {
  detectLang,
  LANGS,
  type Lang,
  type MessageKey,
  t,
} from "../shared/i18n";
import {
  type SeitonDestination,
  type SeitonNavigationOptions,
  type SeitonNavigator,
  VIEW_TYPE_BY_DESTINATION,
} from "../shared/navigation";
import { DEFAULT_TEMPLATES } from "../shared/noteTemplates";
import { DEFAULT_TYPE_FOLDERS } from "../shared/paths";
import {
  extractFirstHttpUrl,
  isRichCardFolderTarget,
  normalizeRichCardDomains,
} from "../shared/richCard";
import { migrateSettings, normalizeBookCategories } from "../shared/settings";
import { normalizeTagInput } from "../shared/tags";
import type {
  FeatureModules,
  ItemType,
  SeitonSettings,
  TypeFolders,
} from "../shared/types";
import { extractHttpUrl, parseClipParams } from "../shared/webClip";
import { openReactAddBookDialog } from "../ui/patterns/AddBookModal";
import { closeProductionDialogs } from "../ui/patterns/ProductionDialog";
import { ReactRichCard } from "../ui/patterns/RichCard";
import {
  ColorPaletteEditor,
  type ColorPaletteEditorProps,
  StringListEditor,
  type StringListEditorProps,
  TagAliasEditor,
  type TagAliasEditorProps,
} from "../ui/patterns/SettingsEditors";

const LANGUAGE_LABELS: Record<Lang, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  ja: "日本語",
  ko: "한국어",
  "pt-BR": "Português (Brasil)",
  "zh-CN": "简体中文",
};

/** Expose Obsidian Setting controls' visual names as their accessible names. */
function labelSettingsControl<T extends object>(control: T, label: string): T {
  const elements = control as {
    inputEl?: HTMLElement;
    selectEl?: HTMLElement;
    toggleEl?: HTMLElement;
  };
  const element = elements.inputEl ?? elements.selectEl ?? elements.toggleEl;
  element?.setAttribute("aria-label", label);
  return control;
}

function labelSettingsControls(containerEl: HTMLElement): void {
  for (const row of Array.from(containerEl.querySelectorAll(".setting-item"))) {
    const label = row.querySelector(".setting-item-name")?.textContent?.trim();
    if (!label) {
      continue;
    }

    for (const control of Array.from(
      row.querySelectorAll("input:not([type='hidden']), select, textarea")
    )) {
      if (!control.hasAttribute("aria-label")) {
        control.setAttribute("aria-label", label);
      }
    }
  }
}

class ReactCardRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly root: Root
  ) {
    super(containerEl);
  }

  onunload(): void {
    this.root.unmount();
  }
}

function mountSettingsEditor(
  container: HTMLElement,
  roots: Root[],
  component: ReturnType<typeof createElement>
): void {
  const host = container.createDiv({ cls: "seiton-settings-react-editor" });
  const root = createRoot(host);
  roots.push(root);
  root.render(component);
}

function createStringListEditor(
  options: StringListEditorProps & { container: HTMLElement; roots: Root[] }
): void {
  const { container, roots, ...props } = options;
  mountSettingsEditor(container, roots, createElement(StringListEditor, props));
}

function createTagAliasEditor(
  container: HTMLElement,
  roots: Root[],
  props: TagAliasEditorProps
): void {
  mountSettingsEditor(container, roots, createElement(TagAliasEditor, props));
}

function createColorPalette(
  container: HTMLElement,
  roots: Root[],
  props: Omit<ColorPaletteEditorProps, "colors">
): void {
  mountSettingsEditor(
    container,
    roots,
    createElement(ColorPaletteEditor, { ...props, colors: EDITOR_COLORS })
  );
}

export default class SeitonPlugin extends Plugin implements SeitonNavigator {
  settings: SeitonSettings = migrateSettings(null).settings;
  lang: Lang = "en";
  toolbar: EditorToolbar | null = null;
  private refreshTimer: number | null = null;
  private pendingLibraryList: string | undefined;
  private pendingCreatePresetId: string | undefined;
  private pendingCreateType: ItemType | undefined;
  private renderedLanguage: Lang | null = null;
  private localizedCommands: { command: Command; nameKey: MessageKey }[] = [];
  private moduleAvailability: Pick<FeatureModules, "bookshelf" | "memos"> = {
    bookshelf: false,
    memos: false,
  };
  private ribbonIcons: Partial<
    Record<
      "home" | "library" | "search" | "organize" | "bookshelf" | "memoReview",
      HTMLElement
    >
  > = {};
  private bookDetailActions: BookDetailActionController | null = null;

  async onload(): Promise<void> {
    // YAML解析はObsidian内蔵 parseYaml に委譲（決定83）
    setYamlParser(parseYaml);

    const migrated = migrateSettings(await this.loadData());
    this.settings = migrated.settings;
    if (
      !this.settings.modules.memos &&
      this.settings.sharedTextDefault === "memo"
    ) {
      this.settings.sharedTextDefault = "idea";
      migrated.changed = true;
    }
    if (migrated.changed) {
      await this.saveData(this.settings);
    }
    const detectedLang = detectLang(getLanguage());
    this.lang =
      this.settings.uiLanguage === "auto"
        ? detectedLang
        : this.settings.uiLanguage;
    this.renderedLanguage = this.lang;
    this.bookDetailActions = registerBookDetailActions({
      app: this.app,
      getLang: () => this.lang,
      getSettings: () => this.settings,
      onBackToBookshelf: () => void this.open("bookshelf"),
      onRefresh: () => this.scheduleReactRefresh(),
      registerEvent: (event) => this.registerEvent(event),
    });
    this.moduleAvailability = {
      bookshelf: this.settings.modules.bookshelf,
      memos: this.settings.modules.memos,
    };
    // 選択範囲追従ツールバー（編集モードの選択・既存装飾要素の上に表示、設定でON/OFF）
    this.toolbar = new EditorToolbar(this.app, this.settings, this.lang, () =>
      this.saveSettings()
    );
    if (this.settings.modules.editorToolbar) {
      this.toolbar.start();
    }
    this.registerEditorExtension(
      createRichCardEditorExtension(
        (view) => {
          const file = view.state.field(editorInfoField, false)?.file;
          if (
            !(
              file &&
              this.settings.modules.richCards &&
              view.state.field(editorLivePreviewField, false)
            )
          ) {
            return false;
          }
          const type =
            this.app.metadataCache.getFileCache(file)?.frontmatter?.type;
          return (
            ITEM_TYPES.includes(type as ItemType) ||
            isRichCardFolderTarget(file.path, this.settings.richCardFolders)
          );
        },
        this.createRichCardStore(),
        this.lang
      )
    );
    this.app.workspace.onLayoutReady(() => {
      this.closeDisabledModuleViews();
      if (this.settings.modules.editorToolbar) {
        this.toolbar?.start();
      }
      this.bookDetailActions?.update();
      if (!this.settings.onboardingCompleted) {
        openReactOnboardingDialog(
          this.app,
          this.settings,
          detectedLang,
          async (lang) => {
            this.lang = lang;
            await this.saveSettings();
          }
        );
      }
    });
    this.registerView(
      VIEW_TYPE_HOME,
      (leaf) =>
        new ReactHomeView(leaf, this.settings, this.lang, this, () =>
          this.saveSettings()
        )
    );
    this.registerView(
      VIEW_TYPE_LIBRARY,
      (leaf) =>
        new ReactLibraryView(
          leaf,
          this.settings,
          this.lang,
          this,
          () => this.saveSettings(),
          () => {
            const list = this.pendingLibraryList;
            this.pendingLibraryList = undefined;
            return list;
          }
        )
    );
    this.registerView(
      VIEW_TYPE_SEARCH,
      (leaf) =>
        new ReactSearchView(leaf, this.settings, this.lang, this, () =>
          this.saveSettings()
        )
    );
    this.registerView(
      VIEW_TYPE_ORGANIZE,
      (leaf) =>
        new ReactOrganizeView(leaf, this.settings, this.lang, this, () =>
          this.saveSettings()
        )
    );
    // Optional views stay registered for the lifetime of the plugin. Their
    // availability is checked when opened so a setting change takes effect
    // without requiring a plugin reload.
    this.registerView(
      VIEW_TYPE_MEMO_REVIEW,
      (leaf) =>
        new ReactMemoReviewView(leaf, this.settings, this.lang, this, () =>
          this.saveSettings()
        )
    );
    this.registerView(
      VIEW_TYPE_BOOKSHELF,
      (leaf) =>
        new ReactBookshelfView(leaf, this.settings, this.lang, this, () =>
          this.saveSettings()
        )
    );
    this.registerView(
      VIEW_TYPE_CREATE,
      (leaf) =>
        new ReactCreateView(
          leaf,
          this.settings,
          this.lang,
          this,
          () => this.saveSettings(),
          () => {
            const type = this.pendingCreateType;
            this.pendingCreateType = undefined;
            return type;
          },
          () => {
            const presetId = this.pendingCreatePresetId;
            this.pendingCreatePresetId = undefined;
            return presetId;
          }
        )
    );
    this.registerRibbonIcons();
    this.addLocalizedCommand("home.open", {
      callback: () => void this.activateHome(),
      id: "open-home",
    });
    this.addLocalizedCommand("library.open", {
      callback: () => void this.activateLibrary(),
      id: "open-library",
    });
    this.addLocalizedCommand("search.open", {
      callback: () => void this.open("search"),
      id: "open-search",
    });
    this.addLocalizedCommand("organize.open", {
      callback: () => void this.open("organize"),
      id: "open-organize",
    });
    this.addLocalizedCommand("memoReview.open", {
      checkCallback: (checking) => {
        if (!this.settings.modules.memos) {
          return false;
        }
        if (!checking) {
          void this.open("memoReview");
        }
        return true;
      },
      id: "open-memo-review",
    });
    this.addLocalizedCommand("bookshelf.open", {
      checkCallback: (checking) => {
        if (!this.settings.modules.bookshelf) {
          return false;
        }
        if (!checking) {
          void this.open("bookshelf");
        }
        return true;
      },
      id: "open-bookshelf",
    });
    this.addLocalizedCommand("book.addByIsbn", {
      checkCallback: (checking) => {
        if (!this.settings.modules.bookshelf) {
          return false;
        }
        if (!checking) {
          this.openAddBookDialog();
        }
        return true;
      },
      id: "add-book-by-isbn",
    });
    // 入力フロー3系統（spec §5）: URI / ブックマークレット（=URIと同一経路）/ 共有テキスト
    this.registerObsidianProtocolHandler("seiton-clip", (params) => {
      void this.handleCapture(params);
    });
    // リッチカード: 保存後バックグラウンド取得（spec §7）+ ノート内URLのプレビュー表示
    this.registerEvent(
      this.app.vault.on("create", () => this.scheduleReactRefresh())
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.scheduleReactRefresh())
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (rewriteSettingsPaths(this.settings, oldPath, file.path)) {
          void this.saveSettings().catch(() => {
            // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
            new Notice(t(this.lang, "notify.saveError"));
          });
        }
        this.scheduleReactRefresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        this.scheduleReactRefresh();
        if (file instanceof TFile) {
          void this.captureModifiedFile(file);
        }
      })
    );
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      if (!this.settings.modules.richCards) {
        return;
      }
      // Reading ViewはMarkdown post processor、編集ビューはCM6 widgetで表示する。
      // 元のMarkdownを置換せず、編集ビュー側はカードと原文の露出を切り替える。
      if (el.closest(".markdown-source-view")) {
        return;
      }
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!(file instanceof TFile)) {
        return;
      }
      const parsed = parseItem(
        await this.app.vault.cachedRead(file),
        file.path
      );
      const noteUrl =
        parsed.item?.type === "webclip"
          ? (parsed.item.source ?? extractFirstHttpUrl(parsed.body))
          : parsed.item ||
              isRichCardFolderTarget(file.path, this.settings.richCardFolders)
            ? extractFirstHttpUrl(parsed.body)
            : null;
      if (!noteUrl) {
        return;
      }
      // URLを含むブロックごとにカードを追加する。ノート全体で一つに制限すると、複数URLの再発見ができなくなる。
      // Reading ViewではURLの表示テキストから `https://` が省略されることがあるため、
      // textContentだけで判定せず、Obsidianが生成したリンクのhrefも見る。
      const renderedLink = el.matches("a[href]")
        ? (el as HTMLAnchorElement)
        : el.querySelector<HTMLAnchorElement>("a[href]");
      const renderedUrl =
        renderedLink?.href ?? extractFirstHttpUrl(el.textContent ?? "");
      // webclipのURLは本文ではなくfrontmatterのsourceだけに保存されるため、
      // 本文DOMにリンクがない場合はノートコンテナへ一枚だけ追加する。
      if (!renderedUrl && parsed.item?.type === "webclip") {
        const previewRoot =
          (el.closest(".markdown-preview-view") as HTMLElement | null) ?? el;
        if (previewRoot.querySelector(".seiton-rich-card-note")) {
          return;
        }
        const host = previewRoot.createDiv({ cls: "seiton-rich-card-note" });
        const root = createRoot(host);
        ctx.addChild(new ReactCardRenderChild(host, root));
        root.render(
          createElement(ReactRichCard, {
            lang: this.lang,
            store: this.createRichCardStore(),
            url: noteUrl,
          })
        );
        return;
      }
      if (!renderedUrl) {
        return;
      }
      const url = parsed.item?.type === "webclip" ? noteUrl : renderedUrl;
      if (el.querySelector(".seiton-rich-card-note")) {
        return;
      }
      const host = el.createDiv({ cls: "seiton-rich-card-note" });
      const root = createRoot(host);
      ctx.addChild(new ReactCardRenderChild(host, root));
      root.render(
        createElement(ReactRichCard, {
          lang: this.lang,
          store: this.createRichCardStore(),
          url,
        })
      );
    });
    this.addSettingTab(new SeitonSettingTab(this.app, this));
  }

  createRichCardStore(): ReturnType<typeof getRichCardStore> {
    return getRichCardStore(this.app.vault, {
      disabledDomains: this.settings.richCardDisabledDomains,
      maxAgeDays: this.settings.richCardCacheMaxAgeDays,
      maxBytes: this.settings.richCardCacheMaxBytes,
    });
  }

  /** ノート変更時にリッチカード対象URLならバックグラウンド取得（og:title更新も兼ねる） */
  private async captureModifiedFile(file: TFile): Promise<void> {
    if (!this.settings.modules.richCards) {
      return;
    }
    if (file.extension !== "md") {
      return;
    }
    const parsed = parseItem(await this.app.vault.cachedRead(file), file.path);
    const url =
      parsed.item?.type === "webclip"
        ? (parsed.item.source ?? extractFirstHttpUrl(parsed.body))
        : parsed.item ||
            isRichCardFolderTarget(file.path, this.settings.richCardFolders)
          ? extractFirstHttpUrl(parsed.body)
          : null;
    if (!url) {
      return;
    }
    const store = this.createRichCardStore();
    if (store.allows(url)) {
      void store.fetch(url);
    }
  }

  /** obsidian://seiton-clip の受け口。URL→一撃クリップ、テキスト→文字数で振り分け。 */
  private async handleCapture(params: Record<string, string>): Promise<void> {
    try {
      const url = parseClipParams(params);
      if (url) {
        const file = await saveWebClip(this.app.vault, this.settings, url);
        this.startTitleFetch(file, url);
      } else if (typeof params.text === "string" && params.text.trim()) {
        const result = await saveSharedText(
          this.app.vault,
          this.settings,
          params.text
        );
        if (result.kind === "url" && result.file) {
          const sharedUrl = extractHttpUrl(params.text);
          if (sharedUrl) {
            this.startTitleFetch(result.file, sharedUrl);
          }
        }
      } else {
        // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
        new Notice(t(this.lang, "notify.invalidUrl"));
        return;
      }
      // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
      new Notice(t(this.lang, "notify.saveSuccess"));
      await this.refreshHome();
    } catch {
      // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
      new Notice(t(this.lang, "notify.saveError"));
    }
  }

  /** og:titleを後追い取得してファイル名を更新（保存は一撃・spec §5）。 */
  private startTitleFetch(file: TFile, url: string): void {
    if (!this.settings.modules.richCards) {
      return;
    }
    if (!this.createRichCardStore().allows(url)) {
      return;
    }
    const store = this.createRichCardStore();
    void updateWebClipTitle(this.app.vault, file, (source) =>
      store.fetchHtml(source)
    )
      .then(() => this.refreshHome())
      .catch(() => undefined);
  }

  /** 開いていればホームを再描画、なければ開く */
  private async refreshHome(): Promise<void> {
    await this.activateHome();
  }

  private openAddBookDialog(): void {
    if (!this.settings.modules.bookshelf) {
      return;
    }
    const platform = createObsidianProductionAdapter(
      this.app,
      loadReactProductionData,
      () => this.lang
    );
    openReactAddBookDialog(
      platform.bookGateway,
      this.settings,
      this.lang,
      (path) => {
        void this.app.workspace
          .getLeaf(true)
          .setViewState({
            state: { file: path, mode: "source" },
            type: "markdown",
          })
          .then(() => undefined);
      },
      platform.notify
    );
  }

  private isDestinationEnabled(destination: SeitonDestination): boolean {
    if (destination === "bookshelf") {
      return this.settings.modules.bookshelf;
    }
    if (destination === "memoReview") {
      return this.settings.modules.memos;
    }
    return true;
  }

  private closeDisabledModuleViews(): void {
    if (!this.settings.modules.bookshelf) {
      this.bookDetailActions?.clear();
      for (const leaf of this.app.workspace.getLeavesOfType(
        VIEW_TYPE_BOOKSHELF
      )) {
        leaf.detach();
      }
    }
    if (!this.settings.modules.memos) {
      for (const leaf of this.app.workspace.getLeavesOfType(
        VIEW_TYPE_MEMO_REVIEW
      )) {
        leaf.detach();
      }
    }
  }

  async saveSettings(): Promise<void> {
    this.createRichCardStore();
    await this.saveData(this.settings);
    this.toolbar?.setLanguage(this.lang);
    const languageChanged = this.renderedLanguage !== this.lang;
    this.renderedLanguage = this.lang;
    const nextAvailability = {
      bookshelf: this.settings.modules.bookshelf,
      memos: this.settings.modules.memos,
    };
    const moduleChanged =
      nextAvailability.bookshelf !== this.moduleAvailability.bookshelf ||
      nextAvailability.memos !== this.moduleAvailability.memos;
    this.moduleAvailability = nextAvailability;
    this.bookDetailActions?.update();
    if (moduleChanged || languageChanged) {
      if (languageChanged) {
        this.updateLocalizedChrome();
      }
      this.closeDisabledModuleViews();
      this.updateRibbonIconVisibility();
      void this.refreshReactViews(true);
    } else {
      void this.refreshReactViews();
    }
  }

  private registerRibbonIcons(): void {
    this.ribbonIcons.home = this.addRibbonNavigationIcon(
      "layout-dashboard",
      t(this.lang, "home.open"),
      () => void this.activateHome()
    );
    this.ribbonIcons.search = this.addRibbonNavigationIcon(
      "search",
      t(this.lang, "search.open"),
      () => void this.open("search")
    );
    this.ribbonIcons.library = this.addRibbonNavigationIcon(
      "library",
      t(this.lang, "library.open"),
      () => void this.activateLibrary()
    );
    this.ribbonIcons.organize = this.addRibbonNavigationIcon(
      "inbox",
      t(this.lang, "organize.open"),
      () => void this.open("organize")
    );
    this.ribbonIcons.memoReview = this.addRibbonNavigationIcon(
      "calendar",
      t(this.lang, "memoReview.open"),
      () => void this.open("memoReview")
    );
    this.ribbonIcons.bookshelf = this.addRibbonNavigationIcon(
      "book-open",
      t(this.lang, "bookshelf.open"),
      () => void this.open("bookshelf")
    );
    this.updateRibbonIconVisibility();
  }

  private addLocalizedCommand(
    nameKey: MessageKey,
    command: Omit<Command, "name">
  ): void {
    this.localizedCommands.push({
      command: this.addCommand({ ...command, name: t(this.lang, nameKey) }),
      nameKey,
    });
  }

  private updateLocalizedChrome(): void {
    for (const { command, nameKey } of this.localizedCommands) {
      command.name = `${this.manifest.name}: ${t(this.lang, nameKey)}`;
    }
    const labels: Record<string, MessageKey> = {
      bookshelf: "bookshelf.open",
      home: "home.open",
      library: "library.open",
      memoReview: "memoReview.open",
      organize: "organize.open",
      search: "search.open",
    };
    for (const [key, element] of Object.entries(this.ribbonIcons)) {
      const nameKey = labels[key as keyof typeof labels];
      if (!(element && nameKey)) {
        continue;
      }
      const title = t(this.lang, nameKey);
      element.setAttribute("aria-label", title);
      setTooltip(element, title);
    }
  }

  private addRibbonNavigationIcon(
    icon: string,
    title: string,
    callback: () => void
  ): HTMLElement {
    const element = this.addRibbonIcon(icon, title, callback);
    element.setAttribute("aria-label", title);
    return element;
  }

  private updateRibbonIconVisibility(): void {
    if (this.ribbonIcons.memoReview) {
      this.ribbonIcons.memoReview.style.display = this.settings.modules.memos
        ? ""
        : "none";
    }
    if (this.ribbonIcons.bookshelf) {
      this.ribbonIcons.bookshelf.style.display = this.settings.modules.bookshelf
        ? ""
        : "none";
    }
  }

  /** Vaultの変更をまとめて反映し、連続イベントで同じ画面を何度も再構築しない。 */
  private scheduleReactRefresh(): void {
    if (this.refreshTimer !== null) {
      return;
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshReactViews();
    }, 100);
  }

  private async refreshReactViews(includeActive = false): Promise<void> {
    const viewTypes = [
      VIEW_TYPE_HOME,
      VIEW_TYPE_LIBRARY,
      VIEW_TYPE_SEARCH,
      VIEW_TYPE_ORGANIZE,
      VIEW_TYPE_MEMO_REVIEW,
      VIEW_TYPE_BOOKSHELF,
      VIEW_TYPE_CREATE,
    ];
    const activeLeaf = this.app.workspace.activeLeaf;
    for (const viewType of viewTypes) {
      for (const leaf of this.app.workspace.getLeavesOfType(viewType)) {
        // Keep transient UI state (search terms, filters, expanded results, form drafts)
        // in the visible view. Its own action updates local state; remounting it here
        // would erase that state as soon as Obsidian emits the corresponding vault event.
        // The next explicit navigation/open refreshes the active view, while inactive
        // Seiton views still receive the latest vault data in the background.
        const view = leaf.view as unknown as {
          refresh?: () => Promise<void>;
          setLanguage?: (lang: Lang) => void;
        };
        view.setLanguage?.(this.lang);
        if (!includeActive && leaf === activeLeaf) {
          continue;
        }
        await view.refresh?.();
      }
    }
  }

  async activateHome(): Promise<void> {
    await this.open("home");
  }

  async activateLibrary(): Promise<void> {
    await this.open("library");
  }

  async open(
    destination: SeitonDestination,
    options?: SeitonNavigationOptions
  ): Promise<void> {
    if (!this.isDestinationEnabled(destination)) {
      return;
    }
    if (destination === "library") {
      this.pendingLibraryList = options?.libraryList?.trim() || undefined;
    }
    const viewType = VIEW_TYPE_BY_DESTINATION[destination];
    const existing = this.app.workspace.getLeavesOfType(viewType)[0];
    if (existing) {
      if (destination === "create") {
        const createView = existing.view as unknown as {
          setInitialCreateOptions: (
            nextOptions: SeitonNavigationOptions | undefined
          ) => void;
        };
        createView.setInitialCreateOptions(options);
      }
      await existing.setViewState({ active: true, type: viewType });
      const view = existing.view as unknown as {
        refresh?: () => Promise<void>;
      };
      await view.refresh?.();
      this.app.workspace.revealLeaf(existing);
      return;
    }
    if (destination === "create") {
      this.pendingCreatePresetId = options?.createPresetId;
      this.pendingCreateType = options?.createType;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ active: true, type: viewType });
    this.app.workspace.revealLeaf(leaf);
  }

  onunload(): void {
    closeProductionDialogs();
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = null;
    this.bookDetailActions?.dispose();
    this.bookDetailActions = null;
    this.toolbar?.stop();
  }
}

class SeitonSettingTab extends PluginSettingTab {
  private readonly editorRoots: Root[] = [];

  constructor(
    app: App,
    private readonly plugin: SeitonPlugin
  ) {
    super(app, plugin);
    plugin.register(() => this.unmountEditors());
  }

  display(): void {
    const { containerEl } = this;
    this.unmountEditors();
    containerEl.empty();
    containerEl.addClass("seiton-settings");
    containerEl.createEl("h2", { text: t(this.plugin.lang, "settings.title") });
    const searchContainer = containerEl.createDiv({
      cls: "seiton-settings-search",
    });
    const layout = containerEl.createDiv({ cls: "seiton-settings-layout" });
    const navigation = layout.createEl("nav", {
      attr: {
        "aria-label": t(this.plugin.lang, "settings.categoriesLabel"),
      },
      cls: "seiton-settings-navigation",
    });
    const content = layout.createDiv({ cls: "seiton-settings-content" });
    const sections: Array<{ key: string; section: HTMLElement }> = [];
    let selectedSectionKey = "general";
    let filterSettings: (query: string) => void = () => undefined;
    const showSection = (key: string): void => {
      selectedSectionKey = key;
      for (const entry of sections) {
        const active = entry.key === key;
        entry.section.hidden = !active;
        const button = navigation.querySelector<HTMLButtonElement>(
          `[data-settings-section="${entry.key}"]`
        );
        button?.classList.toggle("is-active", active);
        button?.setAttribute("aria-pressed", String(active));
      }
    };
    const createSection = (key: string, title: string): HTMLElement => {
      const button = navigation.createEl("button", {
        attr: {
          "aria-controls": `seiton-settings-section-${key}`,
          "aria-pressed": "false",
          "data-settings-section": key,
          type: "button",
        },
        cls: "seiton-settings-navigation-item",
        text: title,
      });
      button.addEventListener("click", () => showSection(key));
      const section = content.createDiv({
        attr: { id: `seiton-settings-section-${key}` },
        cls: "seiton-settings-section",
      });
      section.createEl("h3", {
        cls: "seiton-settings-section-heading",
        text: title,
      });
      const body = section.createDiv({ cls: "seiton-settings-section-body" });
      sections.push({ key, section });
      return body;
    };
    const createDisclosure = (
      container: HTMLElement,
      summaryText: string
    ): HTMLElement => {
      const disclosure = container.createEl("details", {
        cls: "seiton-settings-disclosure",
      });
      disclosure.createEl("summary", { text: summaryText });
      return disclosure.createDiv({ cls: "seiton-settings-disclosure-body" });
    };

    new Setting(searchContainer)
      .setName(t(this.plugin.lang, "settings.searchSettings"))
      .setDesc(t(this.plugin.lang, "settings.searchSettingsHint"))
      .addText((text) => {
        labelSettingsControl(
          text,
          t(this.plugin.lang, "settings.searchSettings")
        );
        text.inputEl.type = "search";
        text
          .setPlaceholder(
            t(this.plugin.lang, "settings.searchSettingsPlaceholder")
          )
          .onChange((value) => filterSettings(value));
      });

    const generalSection = createSection(
      "general",
      t(this.plugin.lang, "settings.generalHeading")
    );
    new Setting(generalSection)
      .setName(t(this.plugin.lang, "settings.language"))
      .addDropdown((dropdown) =>
        labelSettingsControl(dropdown, t(this.plugin.lang, "settings.language"))
          .addOptions({
            auto: "Auto",
            ...Object.fromEntries(
              LANGS.map((lang) => [lang, LANGUAGE_LABELS[lang]])
            ),
          })
          .setValue(this.plugin.settings.uiLanguage)
          .onChange(async (value) => {
            this.plugin.settings.uiLanguage = LANGS.includes(value as Lang)
              ? (value as Lang)
              : "auto";
            this.plugin.lang =
              this.plugin.settings.uiLanguage === "auto"
                ? detectLang(getLanguage())
                : this.plugin.settings.uiLanguage;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    generalSection.createEl("h4", {
      text: t(this.plugin.lang, "settings.storageHeading"),
    });
    new Setting(generalSection)
      .setName(t(this.plugin.lang, "settings.rootFolder"))
      .addText((text) =>
        labelSettingsControl(text, t(this.plugin.lang, "settings.rootFolder"))
          .setValue(this.plugin.settings.rootFolder)
          .onChange(async (value) => {
            this.plugin.settings.rootFolder =
              value.trim() || DEFAULT_ROOT_FOLDER;
            await this.plugin.saveSettings();
          })
      );
    new Setting(generalSection)
      .setName(t(this.plugin.lang, "settings.memosFolder"))
      .addText((text) =>
        labelSettingsControl(text, t(this.plugin.lang, "settings.memosFolder"))
          .setValue(this.plugin.settings.memosFolder)
          .onChange(async (value) => {
            this.plugin.settings.memosFolder =
              value.trim() || DEFAULT_MEMOS_FOLDER;
            await this.plugin.saveSettings();
          })
      );
    new Setting(generalSection)
      .setName(t(this.plugin.lang, "settings.inboxFolder"))
      .addText((text) =>
        labelSettingsControl(text, t(this.plugin.lang, "settings.inboxFolder"))
          .setValue(this.plugin.settings.inboxFolder)
          .onChange(async (value) => {
            this.plugin.settings.inboxFolder =
              value.trim() || DEFAULT_INBOX_FOLDER;
            await this.plugin.saveSettings();
          })
      );
    new Setting(generalSection)
      .setName(t(this.plugin.lang, "settings.sharedTextDefault"))
      .addDropdown((dropdown) =>
        labelSettingsControl(
          dropdown,
          t(this.plugin.lang, "settings.sharedTextDefault")
        )
          .addOptions({
            idea: t(this.plugin.lang, "type.idea"),
            ...(this.plugin.settings.modules.memos
              ? { memo: t(this.plugin.lang, "type.memo") }
              : {}),
          })
          .setValue(this.plugin.settings.sharedTextDefault)
          .onChange(async (value) => {
            this.plugin.settings.sharedTextDefault =
              value === "idea" ? "idea" : "memo";
            await this.plugin.saveSettings();
          })
      );

    const searchSection = createSection(
      "search",
      t(this.plugin.lang, "settings.searchHeading")
    );
    searchSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.searchFoldersHint"),
    });
    createStringListEditor({
      addLabel: t(this.plugin.lang, "settings.addValue"),
      addPlaceholder: t(this.plugin.lang, "settings.searchFolders"),
      container: searchSection,
      duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
      emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
      itemLabel: t(this.plugin.lang, "settings.searchFolders"),
      moveDownLabel: t(this.plugin.lang, "action.moveDown"),
      moveUpLabel: t(this.plugin.lang, "action.moveUp"),
      normalize: (value) => value.trim().replace(/^\/+|\/+$/g, ""),
      onChange: async (values) => {
        this.plugin.settings.search.additionalFolders = values;
        await this.plugin.saveSettings();
      },
      removeLabel: t(this.plugin.lang, "action.delete"),
      requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
      roots: this.editorRoots,
      values: this.plugin.settings.search.additionalFolders,
    });
    new Setting(searchSection)
      .setName(t(this.plugin.lang, "settings.searchMemos"))
      .addToggle((toggle) =>
        labelSettingsControl(
          toggle,
          t(this.plugin.lang, "settings.searchMemos")
        )
          .setValue(this.plugin.settings.search.includeMemos)
          .onChange(async (value) => {
            this.plugin.settings.search.includeMemos = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(searchSection)
      .setName(t(this.plugin.lang, "settings.searchHistory"))
      .addToggle((toggle) =>
        labelSettingsControl(
          toggle,
          t(this.plugin.lang, "settings.searchHistory")
        )
          .setValue(this.plugin.settings.search.historyEnabled)
          .onChange(async (value) => {
            this.plugin.settings.search.historyEnabled = value;
            if (!value) {
              this.plugin.settings.searchHistory = [];
            }
            await this.plugin.saveSettings();
          })
      );
    new Setting(searchSection)
      .setName(t(this.plugin.lang, "settings.excludeArchivedFromSearch"))
      .addToggle((toggle) =>
        labelSettingsControl(
          toggle,
          t(this.plugin.lang, "settings.excludeArchivedFromSearch")
        )
          .setValue(this.plugin.settings.excludeArchivedFromSearch)
          .onChange(async (value) => {
            this.plugin.settings.excludeArchivedFromSearch = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(searchSection)
      .setName(t(this.plugin.lang, "settings.tagSort"))
      .addDropdown((drop) =>
        labelSettingsControl(drop, t(this.plugin.lang, "settings.tagSort"))
          .addOptions({
            alpha: t(this.plugin.lang, "settings.tagSort.alpha"),
            usage: t(this.plugin.lang, "settings.tagSort.usage"),
          })
          .setValue(this.plugin.settings.tagSort)
          .onChange(async (value) => {
            this.plugin.settings.tagSort = value as "usage" | "alpha";
            await this.plugin.saveSettings();
          })
      );

    const typesSection = createSection(
      "types",
      t(this.plugin.lang, "settings.creationHeading")
    );
    typesSection.createEl("h4", {
      text: t(this.plugin.lang, "settings.enabledTypes"),
    });
    for (const type of this.plugin.settings.typeOrder) {
      const typeLabel = t(this.plugin.lang, `type.${type}`);
      let pinnedToggle: ToggleComponent | undefined;
      const setting = new Setting(typesSection).setName(typeLabel);
      setting.addComponent((control) => {
        const choice = control.createSpan({
          cls: "seiton-settings-type-choice",
        });
        choice.createSpan({
          cls: "seiton-settings-type-choice-label",
          text: t(this.plugin.lang, "settings.enabledTypesShort"),
        });
        const toggle = new ToggleComponent(choice);
        labelSettingsControl(
          toggle,
          `${t(this.plugin.lang, "settings.enabledTypes")}: ${typeLabel}`
        );
        toggle
          .setValue(this.plugin.settings.enabledTypes.includes(type))
          .onChange(async (enabled) => {
            if (!enabled && this.plugin.settings.enabledTypes.length <= 1) {
              this.display();
              return;
            }
            this.plugin.settings.enabledTypes = enabled
              ? [...new Set([...this.plugin.settings.enabledTypes, type])]
              : this.plugin.settings.enabledTypes.filter(
                  (value) => value !== type
                );
            if (enabled) {
              pinnedToggle?.setDisabled(false);
            } else {
              this.plugin.settings.pinnedTypes =
                this.plugin.settings.pinnedTypes.filter(
                  (value) => value !== type
                );
              this.plugin.settings.recentTypes =
                this.plugin.settings.recentTypes.filter(
                  (value) => value !== type
                );
              pinnedToggle?.setValue(false).setDisabled(true);
              if (
                type === "memo" &&
                this.plugin.settings.sharedTextDefault === "memo"
              ) {
                this.plugin.settings.sharedTextDefault = "idea";
              }
            }
            await this.plugin.saveSettings();
          });
        return toggle;
      });
      setting.addComponent((control) => {
        const choice = control.createSpan({
          cls: "seiton-settings-type-choice",
        });
        choice.createSpan({
          cls: "seiton-settings-type-choice-label",
          text: t(this.plugin.lang, "settings.pinnedTypesShort"),
        });
        const toggle = new ToggleComponent(choice);
        pinnedToggle = toggle;
        labelSettingsControl(
          toggle,
          `${t(this.plugin.lang, "settings.pinnedTypes")}: ${typeLabel}`
        );
        toggle
          .setValue(this.plugin.settings.pinnedTypes.includes(type))
          .setDisabled(!this.plugin.settings.enabledTypes.includes(type))
          .onChange(async (enabled) => {
            this.plugin.settings.pinnedTypes = enabled
              ? [...new Set([...this.plugin.settings.pinnedTypes, type])]
              : this.plugin.settings.pinnedTypes.filter(
                  (value) => value !== type
                );
            await this.plugin.saveSettings();
          });
        return toggle;
      });
    }

    const modulesSection = createSection(
      "modules",
      t(this.plugin.lang, "settings.featuresHeading")
    );
    const moduleKeys: (keyof FeatureModules)[] = [
      "bookshelf",
      "richCards",
      "memos",
      "editorToolbar",
    ];
    // agentGuide is an onboarding-only choice and has no runtime switch.
    for (const moduleKey of moduleKeys) {
      const moduleLabel = t(this.plugin.lang, `settings.module.${moduleKey}`);
      new Setting(modulesSection).setName(moduleLabel).addToggle((toggle) =>
        labelSettingsControl(toggle, moduleLabel)
          .setValue(this.plugin.settings.modules[moduleKey])
          .onChange(async (enabled) => {
            this.plugin.settings.modules[moduleKey] = enabled;
            if (
              moduleKey === "memos" &&
              !enabled &&
              this.plugin.settings.sharedTextDefault === "memo"
            ) {
              this.plugin.settings.sharedTextDefault = "idea";
            }
            await this.plugin.saveSettings();
            if (moduleKey === "editorToolbar") {
              if (enabled) {
                this.plugin.toolbar?.start();
              } else {
                this.plugin.toolbar?.stop();
              }
            }
          })
      );
    }
    new Setting(modulesSection)
      .setName(t(this.plugin.lang, "settings.bookDetailTabReuse"))
      .setDesc(t(this.plugin.lang, "settings.bookDetailTabReuseHint"))
      .addToggle((toggle) =>
        labelSettingsControl(
          toggle,
          t(this.plugin.lang, "settings.bookDetailTabReuse")
        )
          .setValue(this.plugin.settings.bookDetailTabReuseEnabled)
          .onChange(async (enabled) => {
            this.plugin.settings.bookDetailTabReuseEnabled = enabled;
            await this.plugin.saveSettings();
          })
      );
    new Setting(modulesSection)
      .setName(t(this.plugin.lang, "settings.bookCoverCache"))
      .addToggle((toggle) =>
        labelSettingsControl(
          toggle,
          t(this.plugin.lang, "settings.bookCoverCache")
        )
          .setValue(this.plugin.settings.bookCoverCacheEnabled)
          .onChange(async (enabled) => {
            this.plugin.settings.bookCoverCacheEnabled = enabled;
            await this.plugin.saveSettings();
          })
      );
    modulesSection.createEl("p", {
      cls: "seiton-settings-note",
      text: `${t(this.plugin.lang, "settings.bookLookupPrivacy")}: ${t(this.plugin.lang, "book.networkNotice")}`,
    });
    if (this.plugin.lang === "ja") {
      const calilSection = createSection(
        "calil",
        t(this.plugin.lang, "settings.calilHeading")
      );
      calilSection.createEl("p", {
        cls: "setting-item-description",
        text: t(this.plugin.lang, "settings.calilNotice"),
      });
      const calilLinks = calilSection.createEl("p", {
        cls: "setting-item-description",
      });
      calilLinks.createEl("a", {
        attr: { rel: "noreferrer", target: "_blank" },
        href: "https://calil.jp/api/dashboard/",
        text: t(this.plugin.lang, "settings.calilGetApiKey"),
      });
      calilLinks.appendText(" / ");
      calilLinks.createEl("a", {
        attr: { rel: "noreferrer", target: "_blank" },
        href: "https://calil.jp/doc/api_license.html",
        text: t(this.plugin.lang, "settings.calilTerms"),
      });
      new Setting(calilSection)
        .setName(t(this.plugin.lang, "settings.calilApiKey"))
        .setDesc(t(this.plugin.lang, "settings.calilApiKeyHint"))
        .addText((text) => {
          labelSettingsControl(
            text,
            t(this.plugin.lang, "settings.calilApiKey")
          );
          text.inputEl.type = "password";
          text
            .setPlaceholder("カーリルから取得したキー")
            .setValue(this.plugin.settings.calilAppKey)
            .onChange(async (value) => {
              this.plugin.settings.calilAppKey = value.trim();
              await this.plugin.saveSettings();
            });
        });
      new Setting(calilSection)
        .setName(t(this.plugin.lang, "settings.calilCity"))
        .setDesc(t(this.plugin.lang, "settings.calilCityHint"))
        .addText((text) =>
          labelSettingsControl(text, t(this.plugin.lang, "settings.calilCity"))
            .setPlaceholder("例: 東京都千代田区")
            .setValue(
              `${this.plugin.settings.calilPrefecture}${this.plugin.settings.calilCity}`
            )
            .onChange(async (value) => {
              const area = splitCalilArea(value);
              this.plugin.settings.calilPrefecture = area.prefecture;
              this.plugin.settings.calilCity = area.city;
              this.plugin.settings.calilReferenceLatitude = null;
              this.plugin.settings.calilReferenceLongitude = null;
              await this.plugin.saveSettings();
            })
        );
    }

    // --- タイプ別設定（必要な場合だけ展開する詳細設定） ---
    if (this.plugin.settings.modules.bookshelf) {
      const bookCategoriesBody = createDisclosure(
        typesSection,
        t(this.plugin.lang, "settings.bookCategories")
      );
      bookCategoriesBody.createEl("p", {
        cls: "setting-item-description",
        text: t(this.plugin.lang, "settings.bookCategoriesHint"),
      });
      createStringListEditor({
        addLabel: t(this.plugin.lang, "settings.addValue"),
        addPlaceholder: t(
          this.plugin.lang,
          "settings.bookCategoriesPlaceholder"
        ),
        container: bookCategoriesBody,
        defaultLabel: t(this.plugin.lang, "common.default"),
        duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
        emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
        itemLabel: t(this.plugin.lang, "settings.bookCategories"),
        moveDownLabel: t(this.plugin.lang, "action.moveDown"),
        moveUpLabel: t(this.plugin.lang, "action.moveUp"),
        normalize: (value) => value.trim(),
        onChange: async (values) => {
          this.plugin.settings.bookCategories = normalizeBookCategories(values);
          await this.plugin.saveSettings();
        },
        removeLabel: t(this.plugin.lang, "action.delete"),
        requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
        requiredValue: "未分類",
        roots: this.editorRoots,
        values: this.plugin.settings.bookCategories,
      });
      const bookCategoriesDisclosure = bookCategoriesBody.parentElement;
      if (bookCategoriesDisclosure instanceof HTMLDetailsElement) {
        bookCategoriesDisclosure.open = true;
      }
    }

    const typeFoldersBody = createDisclosure(
      typesSection,
      t(this.plugin.lang, "settings.typeFolders")
    );
    typeFoldersBody.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.typeFoldersHint"),
    });
    const typeFolderKeys = Object.keys(
      DEFAULT_TYPE_FOLDERS
    ) as (keyof TypeFolders)[];
    for (const typeKey of typeFolderKeys) {
      const typeLabel = t(this.plugin.lang, `type.${typeKey}`);
      new Setting(typeFoldersBody).setName(typeLabel).addText((text) =>
        labelSettingsControl(
          text,
          `${t(this.plugin.lang, "settings.typeFolders")}: ${typeLabel}`
        )
          .setPlaceholder(DEFAULT_TYPE_FOLDERS[typeKey])
          .setValue(this.plugin.settings.typeFolders[typeKey] ?? "")
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.typeFolders[typeKey] = trimmed;
            } else {
              delete this.plugin.settings.typeFolders[typeKey];
            }
            await this.plugin.saveSettings();
          })
      );
    }

    const templatesBody = createDisclosure(
      typesSection,
      t(this.plugin.lang, "settings.templates")
    );
    templatesBody.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.templatesHint"),
    });
    // つぶやきは月ファイルへ保存するため、このノートテンプレート設定の対象外。
    const templateTypes = (Object.keys(DEFAULT_TEMPLATES) as ItemType[]).filter(
      (type) => type !== "memo"
    );
    for (const type of templateTypes) {
      const typeLabel = t(this.plugin.lang, `type.${type}`);
      new Setting(templatesBody).setName(typeLabel).addTextArea((area) =>
        labelSettingsControl(
          area,
          `${t(this.plugin.lang, "settings.templates")}: ${typeLabel}`
        )
          .setPlaceholder(DEFAULT_TEMPLATES[type])
          .setValue(this.plugin.settings.templates[type] ?? "")
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (trimmed) {
              this.plugin.settings.templates[type] = trimmed;
            } else {
              delete this.plugin.settings.templates[type];
            }
            await this.plugin.saveSettings();
          })
      );
    }

    // --- エディタツールバー（spec §8） ---
    const editorSection = createSection(
      "editor",
      t(this.plugin.lang, "settings.editorColors")
    );
    new Setting(editorSection)
      .setName(t(this.plugin.lang, "settings.editorColorOrder"))
      .addDropdown((dropdown) =>
        labelSettingsControl(
          dropdown,
          t(this.plugin.lang, "settings.editorColorOrder")
        )
          .addOptions({
            cool: t(this.plugin.lang, "settings.editorColorOrder.cool"),
            default: t(this.plugin.lang, "settings.editorColorOrder.default"),
            warm: t(this.plugin.lang, "settings.editorColorOrder.warm"),
          })
          .setValue(this.plugin.settings.editorColorOrder)
          .onChange(async (value) => {
            this.plugin.settings.editorColorOrder =
              value === "warm" || value === "cool" ? value : "default";
            await this.plugin.saveSettings();
          })
      );
    editorSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.editorPinnedColors"),
    });
    createColorPalette(editorSection, this.editorRoots, {
      labels: {
        all: t(this.plugin.lang, "settings.editorPinnedColorsAll"),
        hint: t(this.plugin.lang, "settings.editorPinnedColorsHint"),
        label: t(this.plugin.lang, "settings.editorPinnedColors"),
      },
      onChange: async (values) => {
        this.plugin.settings.editorPinnedColors = values;
        await this.plugin.saveSettings();
      },
      values: this.plugin.settings.editorPinnedColors,
    });

    // --- リッチカード（spec §7） ---
    const richCardSection = createSection(
      "rich-card",
      t(this.plugin.lang, "settings.richCardHeading")
    );
    richCardSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.richCardFoldersHint"),
    });
    createStringListEditor({
      addLabel: t(this.plugin.lang, "settings.addValue"),
      addPlaceholder: t(this.plugin.lang, "settings.richCardFolders"),
      container: richCardSection,
      duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
      emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
      itemLabel: t(this.plugin.lang, "settings.richCardFolders"),
      moveDownLabel: t(this.plugin.lang, "action.moveDown"),
      moveUpLabel: t(this.plugin.lang, "action.moveUp"),
      normalize: (value) => value.trim().replace(/^\/+|\/+$/g, ""),
      onChange: async (values) => {
        this.plugin.settings.richCardFolders = values;
        await this.plugin.saveSettings();
      },
      removeLabel: t(this.plugin.lang, "action.delete"),
      requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
      roots: this.editorRoots,
      values: this.plugin.settings.richCardFolders,
    });
    richCardSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.richCardDisabledDomainsHint"),
    });
    createStringListEditor({
      addLabel: t(this.plugin.lang, "settings.addValue"),
      addPlaceholder: t(this.plugin.lang, "settings.richCardDisabledDomains"),
      container: richCardSection,
      duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
      emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
      itemLabel: t(this.plugin.lang, "settings.richCardDisabledDomains"),
      moveDownLabel: t(this.plugin.lang, "action.moveDown"),
      moveUpLabel: t(this.plugin.lang, "action.moveUp"),
      normalize: (value) => normalizeRichCardDomains([value])[0] ?? "",
      onChange: async (values) => {
        this.plugin.settings.richCardDisabledDomains = values;
        await this.plugin.saveSettings();
      },
      removeLabel: t(this.plugin.lang, "action.delete"),
      requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
      roots: this.editorRoots,
      values: this.plugin.settings.richCardDisabledDomains,
    });
    new Setting(richCardSection)
      .setName(t(this.plugin.lang, "settings.richCardCacheMaxBytes"))
      .addText((text) =>
        labelSettingsControl(
          text,
          t(this.plugin.lang, "settings.richCardCacheMaxBytes")
        )
          .setValue(String(this.plugin.settings.richCardCacheMaxBytes))
          .onChange(async (value) => {
            this.plugin.settings.richCardCacheMaxBytes = parsePositiveInt(
              value,
              DEFAULT_RICH_CARD_CACHE_MAX_BYTES
            );
            await this.plugin.saveSettings();
          })
      );
    new Setting(richCardSection)
      .setName(t(this.plugin.lang, "settings.richCardCacheMaxAgeDays"))
      .addText((text) =>
        labelSettingsControl(
          text,
          t(this.plugin.lang, "settings.richCardCacheMaxAgeDays")
        )
          .setValue(String(this.plugin.settings.richCardCacheMaxAgeDays))
          .onChange(async (value) => {
            this.plugin.settings.richCardCacheMaxAgeDays = parsePositiveInt(
              value,
              30
            );
            await this.plugin.saveSettings();
          })
      );
    new Setting(richCardSection)
      .setName(t(this.plugin.lang, "settings.richCardClearCache"))
      .setDesc(t(this.plugin.lang, "settings.richCardClearCacheHint"))
      .addButton((button) =>
        button
          .setButtonText(t(this.plugin.lang, "settings.richCardClearCache"))
          .onClick(async () => {
            await this.plugin.createRichCardStore().clear();
            // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
            new Notice(t(this.plugin.lang, "settings.richCardCacheCleared"));
          })
      );

    // --- タグ候補・エイリアス（spec §9） ---
    const tagsSection = createSection(
      "tags",
      t(this.plugin.lang, "settings.tagsHeading")
    );
    tagsSection.createEl("h4", {
      text: t(this.plugin.lang, "settings.memoTagOptions"),
    });
    tagsSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.memoTagOptionsHint"),
    });
    createStringListEditor({
      addLabel: t(this.plugin.lang, "settings.addValue"),
      addPlaceholder: t(this.plugin.lang, "settings.memoTagOptions"),
      container: tagsSection,
      duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
      emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
      itemLabel: t(this.plugin.lang, "settings.memoTagOptions"),
      moveDownLabel: t(this.plugin.lang, "action.moveDown"),
      moveUpLabel: t(this.plugin.lang, "action.moveUp"),
      normalize: normalizeTagInput,
      onChange: async (values) => {
        this.plugin.settings.memoTagOptions = values;
        await this.plugin.saveSettings();
      },
      removeLabel: t(this.plugin.lang, "action.delete"),
      requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
      roots: this.editorRoots,
      values: this.plugin.settings.memoTagOptions,
    });
    tagsSection.createEl("h4", {
      text: t(this.plugin.lang, "settings.tagAliases"),
    });
    tagsSection.createEl("p", {
      cls: "setting-item-description",
      text: t(this.plugin.lang, "settings.tagAliasesHint"),
    });
    createTagAliasEditor(tagsSection, this.editorRoots, {
      initialValues: this.plugin.settings.tagAliases,
      labels: {
        addAlias: t(this.plugin.lang, "settings.addAlias"),
        addMapping: t(this.plugin.lang, "settings.addMapping"),
        aliasLabel: t(this.plugin.lang, "settings.aliasLabel"),
        aliasPlaceholder: t(this.plugin.lang, "settings.aliasLabel"),
        canonicalLabel: t(this.plugin.lang, "settings.canonicalTag"),
        duplicateMessage: t(this.plugin.lang, "settings.listDuplicate"),
        emptyLabel: t(this.plugin.lang, "settings.listEmpty"),
        removeLabel: t(this.plugin.lang, "action.delete"),
        requiredMessage: t(this.plugin.lang, "settings.valueRequired"),
      },
      onChange: async (values) => {
        this.plugin.settings.tagAliases = values;
        await this.plugin.saveSettings();
      },
    });

    const mergeSection = (sourceKey: string, targetKey: string): void => {
      const sourceIndex = sections.findIndex(
        (entry) => entry.key === sourceKey
      );
      const source = sections[sourceIndex];
      const target = sections.find((entry) => entry.key === targetKey);
      if (!(source && target)) {
        return;
      }
      const sourceBody = source.section.querySelector<HTMLElement>(
        ".seiton-settings-section-body"
      );
      const targetBody = target.section.querySelector<HTMLElement>(
        ".seiton-settings-section-body"
      );
      if (sourceBody && targetBody) {
        for (const child of Array.from(sourceBody.childNodes)) {
          targetBody.appendChild(child);
        }
      }
      navigation
        .querySelector(`[data-settings-section="${sourceKey}"]`)
        ?.remove();
      source.section.remove();
      sections.splice(sourceIndex, 1);
    };

    mergeSection("editor", "modules");
    mergeSection("tags", "search");

    const emptySearchState = content.createEl("p", {
      cls: "seiton-settings-search-empty",
      text: t(this.plugin.lang, "settings.searchSettingsNoResults"),
    });
    emptySearchState.hidden = true;

    filterSettings = (rawQuery: string): void => {
      const query = normalizeSettingsSearchText(rawQuery);
      const matchingKeys: string[] = [];
      for (const entry of sections) {
        const hasMatch =
          query.length === 0 ||
          settingsSearchMatches(query, entry.section.textContent ?? "");
        const navigationButton = navigation.querySelector<HTMLButtonElement>(
          `[data-settings-section="${entry.key}"]`
        );
        if (navigationButton) {
          const isSearchHidden = !hasMatch;
          navigationButton.classList.toggle("is-search-hidden", isSearchHidden);
          navigationButton.style.setProperty(
            "display",
            isSearchHidden ? "none" : "",
            isSearchHidden ? "important" : ""
          );
          navigationButton.setAttribute("aria-hidden", String(!hasMatch));
        }
        if (hasMatch) {
          matchingKeys.push(entry.key);
        }
      }

      emptySearchState.hidden = query.length === 0 || matchingKeys.length > 0;
      if (matchingKeys.length === 0) {
        for (const entry of sections) {
          entry.section.hidden = true;
        }
        return;
      }

      const nextSectionKey = matchingKeys.includes(selectedSectionKey)
        ? selectedSectionKey
        : matchingKeys[0];
      showSection(nextSectionKey);
    };

    labelSettingsControls(this.containerEl);
    requestAnimationFrame(() => labelSettingsControls(this.containerEl));
    showSection("general");
    filterSettings("");
  }

  private unmountEditors(): void {
    for (const root of this.editorRoots) {
      root.unmount();
    }
    this.editorRoots.length = 0;
  }
}
