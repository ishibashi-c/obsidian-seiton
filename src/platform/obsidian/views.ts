import { ItemView, type WorkspaceLeaf } from "obsidian";
import {
  mountSeitonApp,
  type SeitonAppDestination,
} from "../../app/mountSeitonApp";
import {
  VIEW_TYPE_BOOKSHELF,
  VIEW_TYPE_CREATE,
  VIEW_TYPE_HOME,
  VIEW_TYPE_LIBRARY,
  VIEW_TYPE_MEMO_REVIEW,
  VIEW_TYPE_ORGANIZE,
  VIEW_TYPE_SEARCH,
} from "../../shared/constants";
import { type Lang, t } from "../../shared/i18n";
import type {
  SeitonNavigationOptions,
  SeitonNavigator,
} from "../../shared/navigation";
import type { ItemType, SeitonSettings } from "../../shared/types";
import { createSeitonShadowBoundary } from "../../ui/boundary";
import { createObsidianProductionAdapter } from "./productionAdapter";
import { loadReactProductionData } from "./productionData";

abstract class ReactSeitonView extends ItemView {
  private dispose: (() => void) | null = null;
  private lifecycle = 0;
  private isOpen = false;
  protected initialCreateType: ItemType | undefined;
  protected initialCreatePresetId: string | undefined;

  constructor(
    leaf: WorkspaceLeaf,
    readonly settings: SeitonSettings,
    protected lang: Lang,
    readonly navigator: SeitonNavigator,
    readonly saveSettings: () => Promise<void>,
    private readonly destination: SeitonAppDestination,
    private readonly getInitialLibraryList?: () => string | undefined,
    private readonly getInitialCreateType?: () => ItemType | undefined,
    private readonly getInitialCreatePresetId?: () => string | undefined
  ) {
    super(leaf);
    // Read transient navigation options once; refresh may remount this view
    // several times during a single navigation.
    this.initialCreateType = this.getInitialCreateType?.();
    this.initialCreatePresetId = this.getInitialCreatePresetId?.();
  }

  setLanguage(lang: Lang): void {
    this.lang = lang;
  }

  private async mount(): Promise<void> {
    const lifecycle = ++this.lifecycle;
    const boundary = createSeitonShadowBoundary(this.contentEl);
    const platform = createObsidianProductionAdapter(
      this.app,
      loadReactProductionData,
      () => this.lang
    );
    const dispose = await mountSeitonApp(
      boundary.mountPoint,
      this.destination,
      {
        initialCreatePresetId: this.initialCreatePresetId,
        initialCreateType: this.initialCreateType,
        initialLibraryList: this.getInitialLibraryList?.(),
        lang: this.lang,
        navigator: this.navigator,
        platform,
        saveSettings: this.saveSettings,
        settings: this.settings,
      }
    );
    const disposeAll = () => {
      dispose();
      boundary.dispose();
    };
    if (lifecycle === this.lifecycle) {
      this.dispose = disposeAll;
    } else {
      disposeAll();
    }
  }

  async onOpen(): Promise<void> {
    this.isOpen = true;
    await this.mount();
  }

  async refresh(): Promise<void> {
    if (!this.isOpen) {
      return;
    }
    this.dispose?.();
    this.dispose = null;
    await this.mount();
  }

  async onClose(): Promise<void> {
    this.isOpen = false;
    this.lifecycle += 1;
    this.dispose?.();
    this.dispose = null;
    this.contentEl.empty();
  }
}

export class ReactHomeView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>
  ) {
    super(leaf, settings, lang, navigator, saveSettings, "home");
  }
  getViewType(): string {
    return VIEW_TYPE_HOME;
  }
  getDisplayText(): string {
    return t(this.lang, "home.title");
  }
  getIcon(): string {
    return "layout-dashboard";
  }
}

export class ReactLibraryView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>,
    getInitialLibraryList: () => string | undefined
  ) {
    super(
      leaf,
      settings,
      lang,
      navigator,
      saveSettings,
      "library",
      getInitialLibraryList
    );
  }
  getViewType(): string {
    return VIEW_TYPE_LIBRARY;
  }
  getDisplayText(): string {
    return t(this.lang, "library.title");
  }
  getIcon(): string {
    return "library";
  }
}

export class ReactSearchView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>
  ) {
    super(leaf, settings, lang, navigator, saveSettings, "search");
  }
  getViewType(): string {
    return VIEW_TYPE_SEARCH;
  }
  getDisplayText(): string {
    return t(this.lang, "search.title");
  }
  getIcon(): string {
    return "search";
  }
}

export class ReactOrganizeView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>
  ) {
    super(leaf, settings, lang, navigator, saveSettings, "organize");
  }
  getViewType(): string {
    return VIEW_TYPE_ORGANIZE;
  }
  getDisplayText(): string {
    return t(this.lang, "organize.title");
  }
  getIcon(): string {
    return "inbox";
  }
}

export class ReactMemoReviewView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>
  ) {
    super(leaf, settings, lang, navigator, saveSettings, "memoReview");
  }
  getViewType(): string {
    return VIEW_TYPE_MEMO_REVIEW;
  }
  getDisplayText(): string {
    return t(this.lang, "memoReview.title");
  }
  getIcon(): string {
    return "calendar";
  }
}

export class ReactBookshelfView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>
  ) {
    super(leaf, settings, lang, navigator, saveSettings, "bookshelf");
  }
  getViewType(): string {
    return VIEW_TYPE_BOOKSHELF;
  }
  getDisplayText(): string {
    return t(this.lang, "bookshelf.title");
  }
  getIcon(): string {
    return "book-open";
  }
}

export class ReactCreateView extends ReactSeitonView {
  constructor(
    leaf: WorkspaceLeaf,
    settings: SeitonSettings,
    lang: Lang,
    navigator: SeitonNavigator,
    saveSettings: () => Promise<void>,
    getInitialCreateType: () => ItemType | undefined,
    getInitialCreatePresetId: () => string | undefined
  ) {
    super(
      leaf,
      settings,
      lang,
      navigator,
      saveSettings,
      "create",
      undefined,
      getInitialCreateType,
      getInitialCreatePresetId
    );
  }

  setInitialCreateOptions(options: SeitonNavigationOptions | undefined): void {
    this.initialCreateType = options?.createType;
    this.initialCreatePresetId = options?.createPresetId;
  }

  getViewType(): string {
    return VIEW_TYPE_CREATE;
  }
  getDisplayText(): string {
    return t(this.lang, "new.createTitle");
  }
  getIcon(): string {
    return "file-plus-2";
  }
}
