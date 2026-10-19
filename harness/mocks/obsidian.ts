/**
 * モックObsidian API（spec 12.6章 層2）
 *
 * 本物のObsidianプラグインAPIのうち、UIコンポーネントが使う面だけを
 * ブラウザで再現する。実装は実機Obsidianと同じ見た目・挙動になるよう
 * Obsidian公式のデフォルトCSSクラス（menu/modal/suggestion）を模倣する。
 *
 * ⚠️ このファイルはハーネス専用。プロダクトコードからは直接 import しない
 * （プロダクトは esbuild でビルド時に実物の "obsidian" を解決する）。
 */

// ---------------------------------------------------------------------------
// 型（プロダクトコードが期待する表面だけ定義）
// ---------------------------------------------------------------------------

interface MockVaultReference {
  modify: (file: { path: string }, content: string) => Promise<void>;
  read: (file: { path: string }) => Promise<string>;
}

export class TFile {
  constructor(
    public path: string,
    public basename: string,
    public extension = "md"
  ) {}
  stat = { ctime: Date.now(), mtime: Date.now(), size: 8 };

  get name(): string {
    return this.path.split("/").pop() ?? this.path;
  }

  get parent(): TFolder | null {
    const slash = this.path.lastIndexOf("/");
    return slash >= 0 ? new TFolder(this.path.slice(0, slash)) : null;
  }

  get vault(): MockVaultReference {
    return mockApp.vault;
  }
}

export class TFolder {
  constructor(
    public path: string,
    public children: (TFile | TFolder)[] = []
  ) {}
}

export interface MockNote {
  /** frontmatter込みのファイル内容 */
  content: string;
  path: string;
}

// ---------------------------------------------------------------------------
// インメモリvault（ハーネス側から操作する）
// ---------------------------------------------------------------------------

const files = new Map<string, MockNote>();
const listeners: ((type: string, file: TFile) => void)[] = [];

export const mockVault = {
  async create(path: string, content: string): Promise<TFile> {
    files.set(path, { content, path });
    emit("create", path);
    return new TFile(path, path.split("/").pop() ?? path);
  },
  async delete(path: string): Promise<void> {
    files.delete(path);
    emit("delete", path);
  },
  list(): string[] {
    return [...files.keys()];
  },
  offChange(fn: (type: string, file: TFile) => void): void {
    const index = listeners.indexOf(fn);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  },
  onChange(fn: (type: string, file: TFile) => void): void {
    listeners.push(fn);
  },
  async read(path: string): Promise<string> {
    return files.get(path)?.content ?? "";
  },
  async rename(path: string, newPath: string): Promise<void> {
    const note = files.get(path);
    if (!note) {
      return;
    }
    files.delete(path);
    files.set(newPath, { ...note, path: newPath });
    emit("rename", path, newPath);
  },
  /** シードデータ投入 */
  seed(notes: MockNote[]): void {
    files.clear();
    for (const note of notes) {
      files.set(note.path, note);
    }
  },
  async write(path: string, content: string): Promise<void> {
    files.set(path, { content, path });
    emit("modify", path);
  },
};

declare global {
  interface Window {
    __mockVault?: typeof mockVault;
  }
}
window.__mockVault = mockVault;

function emit(type: string, path: string, newPath?: string): void {
  const file = new TFile(newPath ?? path, path.split("/").pop() ?? path);
  for (const fn of listeners) {
    fn(type, file);
  }
}

// ---------------------------------------------------------------------------
// 設定ストア（data.json相当）
// ---------------------------------------------------------------------------

export const mockSettings = {
  data: {} as Record<string, unknown>,
  load(defaults: Record<string, unknown>): void {
    try {
      const stored = sessionStorage.getItem("seiton-harness-settings");
      this.data = stored
        ? { ...defaults, ...(JSON.parse(stored) as Record<string, unknown>) }
        : { ...defaults };
    } catch {
      this.data = { ...defaults };
    }
  },
  async save(): Promise<void> {
    try {
      sessionStorage.setItem(
        "seiton-harness-settings",
        JSON.stringify(this.data)
      );
    } catch {
      /* ハーネスではメモリのみ */
    }
  },
};

// ---------------------------------------------------------------------------
// Notice
// ---------------------------------------------------------------------------

/** Notice風モック（Obsidianの右上通知の簡易再現） */
export class Notice {
  constructor(
    public message: string | DocumentFragment,
    _duration?: number
  ) {
    showNotice(typeof message === "string" ? message : "notice");
  }
}

export function showNotice(message: string): void {
  const el = document.createElement("div");
  el.className = "mock-notice";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ---------------------------------------------------------------------------
// Menu（ネイティブ風・DOM実装）
// ---------------------------------------------------------------------------

interface MenuItemSpec {
  checked?: boolean;
  icon?: string;
  onClick?: (evt: MouseEvent) => void;
  separator?: boolean;
  title?: string;
}

export class Menu {
  private readonly items: MenuItemSpec[] = [];

  addItem(cb: (item: MenuItemBuilder) => unknown): this {
    const builder = new MenuItemBuilder();
    cb(builder);
    this.items.push(builder.spec);
    return this;
  }

  addSeparator(): this {
    this.items.push({ separator: true });
    return this;
  }

  /** ハーネスではクリック座標付近にDOMで描画する */
  showAtMouseEvent(evt: MouseEvent): void {
    const menuEl = document.createElement("div");
    menuEl.className = "mock-menu";
    for (const item of this.items) {
      if (item.separator) {
        const sep = document.createElement("hr");
        menuEl.appendChild(sep);
        continue;
      }
      const row = document.createElement("div");
      row.className = "mock-menu-item";
      row.textContent = `${item.checked ? "✓ " : ""}${item.title ?? ""}`;
      row.addEventListener("click", (e) => {
        item.onClick?.(e);
        menuEl.remove();
      });
      menuEl.appendChild(row);
    }
    menuEl.style.left = `${evt.clientX}px`;
    menuEl.style.top = `${evt.clientY}px`;
    document.body.appendChild(menuEl);
    const dismiss = (e: MouseEvent) => {
      if (!menuEl.contains(e.target as Node)) {
        menuEl.remove();
        document.removeEventListener("mousedown", dismiss);
      }
    };
    document.addEventListener("mousedown", dismiss);
  }
}

class MenuItemBuilder {
  spec: MenuItemSpec = {};

  setTitle(title: string): this {
    this.spec.title = title;
    return this;
  }
  setIcon(icon: string): this {
    this.spec.icon = icon;
    return this;
  }
  setChecked(checked: boolean): this {
    this.spec.checked = checked;
    return this;
  }
  onClick(fn: (evt: MouseEvent) => void): this {
    this.spec.onClick = fn;
    return this;
  }
}

// ---------------------------------------------------------------------------
// Modal（ネイティブ風・DOM実装）
// ---------------------------------------------------------------------------

/** ObsidianのHTMLElement拡張（empty/createEl/createDiv/addClass/setText）を付与する */
type AugmentedEl = HTMLElement & Record<string, unknown>;

function augment(el: AugmentedEl): AugmentedEl {
  el.empty =
    el.empty ??
    (() => {
      el.innerHTML = "";
    });
  el.addClass =
    el.addClass ??
    ((c: string) => {
      el.classList.add(c);
    });
  el.removeClass =
    el.removeClass ??
    ((c: string) => {
      el.classList.remove(c);
    });
  el.setText =
    el.setText ??
    ((text: string) => {
      el.textContent = text;
    });
  el.createEl =
    el.createEl ??
    ((
      tag: string,
      opts?: { text?: string; cls?: string; attr?: Record<string, string> }
    ) => {
      const node = document.createElement(tag) as AugmentedEl;
      augment(node);
      if (opts?.text) {
        node.textContent = opts.text;
      }
      if (opts?.cls) {
        node.className = opts.cls;
      }
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) {
          node.setAttribute(k, v);
        }
      }
      el.appendChild(node);
      return node;
    });
  el.createDiv =
    el.createDiv ??
    ((opts?: { cls?: string; text?: string }) => el.createEl("div", opts));
  el.createSpan =
    el.createSpan ??
    ((opts?: { cls?: string; text?: string }) => el.createEl("span", opts));
  return el;
}

export class Modal {
  app: unknown;
  modalEl: HTMLElement;
  private readonly resolveClose!: () => void;

  constructor(app?: unknown) {
    this.app = app ?? null;
    this.modalEl = document.createElement("div");
    this.modalEl.className = "mock-modal-backdrop";
    const dialog = document.createElement("div");
    dialog.className = "mock-modal";
    this.modalEl.appendChild(dialog);
    this.modalEl.addEventListener("mousedown", (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  get contentEl(): HTMLElement {
    // ObsidianのcontentElはempty()/createEl()/createDiv()/addClass()等のヘルパーを持つ
    const dialog = this.modalEl.querySelector(".mock-modal");
    if (!dialog) {
      throw new Error("Mock modal element is missing");
    }
    return augment(dialog as AugmentedEl);
  }

  open(): void {
    document.body.appendChild(this.modalEl);
    this.onOpen();
  }

  close(): void {
    this.modalEl.remove();
    this.onClose();
    this.resolveClose?.();
  }

  onOpen(): void {}
  onClose(): void {}
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// サジェスト（AbstractInputSuggest風の最小再現）
// ---------------------------------------------------------------------------

/**
 * Obsidian AbstractInputSuggest のモック。
 * 入力イベントで候補をDOM表示し、クリックで選択する。
 */
export abstract class AbstractInputSuggest<T> {
  protected inputEl: HTMLInputElement;
  private containerEl: HTMLElement | null = null;
  /** 選択コールバック（onSelect相当） */
  private selectHandler:
    | ((value: T, evt: MouseEvent | KeyboardEvent) => unknown)
    | null = null;

  constructor(_app: unknown, textInputEl: HTMLInputElement) {
    this.inputEl = textInputEl;
    this.inputEl.addEventListener("input", () => this.open());
    this.inputEl.addEventListener("blur", () =>
      setTimeout(() => this.close(), 150)
    );
  }

  /** Obsidian API互換: 選択時のコールバック登録 */
  onSelect(
    callback: (value: T, evt: MouseEvent | KeyboardEvent) => unknown
  ): this {
    this.selectHandler = callback;
    return this;
  }

  /** Obsidian API互換: 入力欄に値を設定 */
  setValue(value: string): void {
    this.inputEl.value = value;
  }

  /** Obsidian API互換: 入力欄の値を取得 */
  getValue(): string {
    return this.inputEl.value;
  }

  open(): void {
    this.close();
    const query = this.inputEl.value;
    let items: T[];
    try {
      const result = this.getSuggestions(query);
      items = Array.isArray(result) ? result : [];
    } catch {
      items = [];
    }
    if (items.length === 0) {
      return;
    }
    this.containerEl = document.createElement("div");
    this.containerEl.className = "mock-suggest";
    const rect = this.inputEl.getBoundingClientRect();
    this.containerEl.style.left = `${rect.left}px`;
    this.containerEl.style.top = `${rect.bottom + 4}px`;
    for (const item of items.slice(0, 10)) {
      const row = document.createElement("div");
      row.className = "mock-suggest-item";
      this.renderSuggestion(item, row);
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.selectSuggestion(item, e);
        this.selectHandler?.(item, e);
        this.close();
      });
      this.containerEl.appendChild(row);
    }
    document.body.appendChild(this.containerEl);
  }

  close(): void {
    this.containerEl?.remove();
    this.containerEl = null;
  }

  protected abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void;
}

/** TextComponent のモック（TextComponent(contentEl).setPlaceholder(...) の面だけ） */
export class TextComponent {
  inputEl: HTMLInputElement;

  constructor(container?: HTMLElement) {
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    if (container) {
      container.appendChild(this.inputEl);
    }
  }

  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  getValue(): string {
    return this.inputEl.value;
  }

  onChanged(cb: (value: string) => unknown): this {
    this.inputEl.addEventListener("change", () => cb(this.inputEl.value));
    return this;
  }
}

// ---------------------------------------------------------------------------
// アイコン（Lucide風の代替グリフ）
// ---------------------------------------------------------------------------

const FALLBACK_GLYPHS: Record<string, string> = {
  archive: "▤",
  "archive-restore": "▥",
  "chevron-right": "›",
  ellipsis: "…",
  "external-link": "↗",
  inbox: "↓",
  "layout-dashboard": "▣",
  "layout-grid": "▦",
  "list-plus": "≡+",
  "list-tree": "⑃",
  pencil: "✎",
  pin: "◎",
  plus: "+",
  repeat: "↻",
  "rows-3": "☰",
  search: "⌕",
  send: "➤",
  sparkles: "✦",
  tags: "#",
  "trash-2": "🗑",
  x: "✕",
};

export function setIcon(el: HTMLElement, iconId: string): void {
  el.textContent = FALLBACK_GLYPHS[iconId] ?? "•";
  el.dataset.icon = iconId;
}

export function getIconIds(): string[] {
  return Object.keys(FALLBACK_GLYPHS);
}

// ---------------------------------------------------------------------------
// その他の軽量スタブ
// ---------------------------------------------------------------------------

export function parseYaml(yaml: string): unknown {
  // ハーネス用の最小実装: フロントマターの単純な key: value / 配列のみ
  const result: Record<string, unknown> = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) {
      continue;
    }
    const [, key, raw] = m;
    if (raw.startsWith("[")) {
      result[key] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (raw.startsWith("{")) {
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    } else if (raw.length === 0) {
      result[key] = [];
    } else if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
      // ObsidianのparseYamlはクォートされていない数値をnumberとして返す。
      // ISBNのように文字列として扱う値は、実装側で正規化して受け取る。
      result[key] = Number(raw);
    } else {
      result[key] = raw;
    }
  }
  return result;
}

// window経由でも参照できるようにする（harness/index.ts から使う）
declare global {
  interface Window {
    __mockParseYaml?: typeof parseYaml;
  }
}
window.__mockParseYaml = parseYaml;

export function stringifyYaml(obj: unknown): string {
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}: [${v.join(", ")}]` : `${k}: ${String(v)}`
    )
    .join("\n");
}

export class Plugin {
  app: unknown = null;
}

/** ItemView風モック（HomeViewのクラス定義に必要・leaf/app依存を最小限に再現） */
export class ItemView {
  app: unknown;
  leaf: unknown;
  contentEl: HTMLElement;
  navigation = false;
  constructor(leaf: unknown) {
    this.leaf = leaf;
    this.app = (leaf as { view?: unknown }) ?? null;
    this.contentEl = document.createElement("div");
  }
  getViewType(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  getIcon(): string {
    return "";
  }
  onOpen(): Promise<void> | void {}
  onClose(): Promise<void> | void {}
}

export class PluginSettingTab {
  constructor(
    public app: unknown,
    public plugin: unknown
  ) {}
  display(): void {}
}

/** requestUrl風モック（ハーネスでは外部通信しない・常に失敗） */
export async function requestUrl(_opts: {
  url: string;
  method?: string;
}): Promise<{ text: string; status: number }> {
  throw new Error("network unavailable in harness");
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  addText(_cb: (text: unknown) => unknown): this {
    return this;
  }
  addToggle(_cb: (toggle: unknown) => unknown): this {
    return this;
  }
  addDropdown(_cb: (drop: unknown) => unknown): this {
    return this;
  }
  addTextArea(_cb: (text: unknown) => unknown): this {
    return this;
  }
  addButton(cb: (button: unknown) => unknown): this {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    this.containerEl.appendChild(buttonEl);
    interface ButtonBuilder {
      onClick: (handler: () => unknown) => ButtonBuilder;
      setButtonText: (text: string) => ButtonBuilder;
      setCta: () => ButtonBuilder;
    }
    const button: ButtonBuilder = {
      onClick: (handler: () => unknown): ButtonBuilder => {
        buttonEl.addEventListener("click", () => {
          void handler();
        });
        return button;
      },
      setButtonText: (text: string): ButtonBuilder => {
        buttonEl.textContent = text;
        return button;
      },
      setCta: (): ButtonBuilder => {
        buttonEl.classList.add("mod-cta");
        return button;
      },
    };
    cb(button);
    return this;
  }
}

export class SuggestModal<_T> {}

export class FuzzySuggestModal<T> extends SuggestModal<T> {}

// ---------------------------------------------------------------------------
// モックApp（HomeView が app.vault / app.workspace / app.metadataCache を使う面）
// ---------------------------------------------------------------------------

const workspaceLeaf = {
  openFile: async (file: unknown): Promise<unknown> => {
    showNotice(`open: ${(file as { path: string }).path}`);
    return file;
  },
};

export const mockApp = {
  fileManager: {
    renameFile: async (
      file: TFile | TFolder,
      newPath: string
    ): Promise<void> => {
      const previousPath = file.path;
      const movingPaths = mockVault
        .list()
        .filter(
          (path) => path === previousPath || path.startsWith(`${previousPath}/`)
        );
      for (const path of movingPaths) {
        await mockVault.rename(
          path,
          `${newPath}${path.slice(previousPath.length)}`
        );
      }
      file.path = newPath;
      if (file instanceof TFile) {
        file.basename = newPath.split("/").at(-1) ?? newPath;
      }
    },
    trashFile: async (file: TFile): Promise<void> => {
      const basename = file.path.split("/").pop() ?? file.path;
      let path = `.trash/${basename}`;
      let suffix = 2;
      while (mockVault.list().includes(path)) {
        const dot = path.lastIndexOf(".");
        path = `${path.slice(0, dot)} ${suffix}${path.slice(dot)}`;
        suffix += 1;
      }
      await mockVault.rename(file.path, path);
    },
  },
  metadataCache: {
    getFirstLinkpathDest: (_link: string, _source: string): null => null,
  },
  vault: {
    append: async (file: { path: string }, content: string): Promise<void> => {
      await mockVault.write(
        file.path,
        `${await mockVault.read(file.path)}${content}`
      );
    },
    cachedRead: async (file: { path: string }): Promise<string> =>
      mockVault.read(file.path),
    create: async (path: string, content: string): Promise<TFile> =>
      mockVault.create(path, content),
    createBinary: async (path: string, _data: ArrayBuffer): Promise<TFile> => {
      // モックはバイナリを保持しないが、キャッシュ存在確認は通るようにする
      return mockVault.create(path, "");
    },
    createFolder: async (folder: string): Promise<void> => {
      // モックvaultはフラットなMapなので「フォルダ」は存在チェックだけ通す
      if (!mockVault.list().includes(folder)) {
        mockVault.create(`${folder}/.keep`, "");
      }
    },
    delete: async (file: { path: string }): Promise<void> => {
      await mockVault.delete(file.path);
    },
    getAbstractFileByPath: (path: string): unknown => {
      const paths = mockVault.list();
      if (paths.includes(path)) {
        return new TFile(path, path.split("/").pop() ?? path);
      }
      return paths.some((candidate) => candidate.startsWith(`${path}/`))
        ? new TFolder(path)
        : null;
    },
    getAllFolders: (): TFolder[] => {
      const folders = new Set<string>();
      for (const path of mockVault.list()) {
        const segments = path.split("/");
        for (let end = 1; end < segments.length; end += 1) {
          folders.add(segments.slice(0, end).join("/"));
        }
      }
      return [...folders].map((path) => new TFolder(path));
    },
    getFiles: (): TFile[] =>
      mockVault
        .list()
        .filter((path) => !path.endsWith("/.keep"))
        .map((path) => new TFile(path, path.split("/").pop() ?? path)),
    getMarkdownFiles: (): { path: string; basename: string }[] =>
      mockVault
        .list()
        .map(
          (path) =>
            new TFile(
              path,
              (path.split("/").pop() ?? path).replace(/\.md$/, "")
            )
        ),
    getResourcePath: (file: TFile): string => `mock://${file.path}`,
    modify: async (file: { path: string }, content: string): Promise<void> =>
      mockVault.write(file.path, content),
    offref: (listener: (type: string, file: TFile) => void): void => {
      mockVault.offChange(listener);
    },
    on: (
      event: string,
      callback: (file: TFile) => void
    ): ((type: string, file: TFile) => void) => {
      const listener = (type: string, file: TFile): void => {
        if (type === event) {
          callback(file);
        }
      };
      mockVault.onChange(listener);
      return listener;
    },
    read: async (file: { path: string }): Promise<string> =>
      mockVault.read(file.path),
    rename: async (file: { path: string }, newPath: string): Promise<void> => {
      await mockVault.rename(file.path, newPath);
    },
    trash: async (file: { path: string }): Promise<void> => {
      await mockVault.delete(file.path);
    },
  },
  workspace: {
    getLeaf: (_arg: boolean): typeof workspaceLeaf => workspaceLeaf,
  },
};
