/**
 * Obsidian selection format toolbar.
 *
 * The toolbar follows a non-empty editor selection, like the MIT-licensed
 * selection-format-toolbar plugin. It intentionally lives outside the
 * CodeMirror DOM so Obsidian's editor layout and scroll behavior stay intact.
 */

import { EditorView } from "@codemirror/view";
import type {
  App,
  Editor,
  EditorPosition,
  EventRef,
  MarkdownView,
} from "obsidian";
import { EDITOR_COLORS } from "../../shared/constants";
import {
  clearHeadingLine,
  highlightText,
  removeHighlightText,
  toggleDelimitedText,
  toggleHeadingLine,
} from "../../shared/editorToolbar";
import { type Lang, t } from "../../shared/i18n";
import type { SeitonSettings } from "../../shared/types";

type EditorColor = (typeof EDITOR_COLORS)[number];

const WARM_COLOR_ORDER = [0, 1, 2, 7, 6, 3, 4, 5] as const;
const COOL_COLOR_ORDER = [6, 5, 4, 3, 2, 1, 0, 7] as const;
const FORMATTED_ELEMENT_SELECTOR =
  "mark, strong, em, del, s, code, h1, h2, h3, h4, h5, h6, .cm-highlight";

interface SelectionContext {
  editor: Editor;
  from: EditorPosition;
  rect: DOMRect;
  source: "selection" | "formatted-element";
  to: EditorPosition;
  view: MarkdownView;
}

function elementForNode(node: Node | null): Element | null {
  if (!node) {
    return null;
  }
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function hasSelection(selection: Selection): boolean {
  return (
    selection.rangeCount > 0 &&
    !selection.isCollapsed &&
    selection.toString().trim().length > 0
  );
}

function positionAfter(position: EditorPosition, text: string): EditorPosition {
  const lines = text.split("\n");
  return lines.length === 1
    ? { ch: position.ch + text.length, line: position.line }
    : {
        ch: (lines.at(-1) ?? "").length,
        line: position.line + lines.length - 1,
      };
}

function isEditorColor(value: unknown): value is EditorColor {
  return (
    typeof value === "string" &&
    (EDITOR_COLORS as readonly string[]).includes(value)
  );
}

function validEditorColors(value: unknown): EditorColor[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter(isEditorColor))];
}

function orderedColors(settings: SeitonSettings): EditorColor[] {
  const order =
    settings.editorColorOrder === "warm"
      ? WARM_COLOR_ORDER
      : settings.editorColorOrder === "cool"
        ? COOL_COLOR_ORDER
        : null;
  const sorted = order
    ? order.map((index) => EDITOR_COLORS[index])
    : [...EDITOR_COLORS];
  const pinned = validEditorColors(settings.editorPinnedColors);

  return pinned.length > 0 ? pinned : sorted;
}

function pickerColors(settings: SeitonSettings): EditorColor[] {
  const recent = validEditorColors(settings.editorRecentColors);
  const ordered = orderedColors(settings);
  const colors = [
    ...recent.filter((color) => ordered.includes(color)),
    ...ordered,
  ];
  return colors.length > 0 ? colors : [...EDITOR_COLORS];
}

export class EditorToolbar {
  private bar: HTMLElement | null = null;
  private current: SelectionContext | null = null;
  private refreshTimer: number | null = null;
  private activeLeafRef: EventRef | null = null;
  private actionInProgress = false;

  constructor(
    private readonly app: App,
    private readonly settings: SeitonSettings,
    private lang: Lang,
    private readonly saveSettings: () => Promise<void>
  ) {}

  setLanguage(lang: Lang): void {
    this.lang = lang;
    if (this.bar) {
      this.hide();
    }
  }

  start(): void {
    this.stop();
    document.body.addClass("seiton-selection-toolbar-active");
    document.addEventListener("mouseup", this.onMouseUp, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    document.addEventListener("selectionchange", this.onSelectionChange, true);
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("mousedown", this.onMouseDown, true);
    document.addEventListener("wheel", this.onWheel, true);
    window.addEventListener("resize", this.onResize, true);
    this.activeLeafRef = this.app.workspace.on("active-leaf-change", this.hide);
  }

  stop(): void {
    document.removeEventListener("mouseup", this.onMouseUp, true);
    document.removeEventListener("keyup", this.onKeyUp, true);
    document.removeEventListener(
      "selectionchange",
      this.onSelectionChange,
      true
    );
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("mousedown", this.onMouseDown, true);
    document.removeEventListener("wheel", this.onWheel, true);
    window.removeEventListener("resize", this.onResize, true);
    if (this.activeLeafRef) {
      this.app.workspace.offref(this.activeLeafRef);
    }
    this.activeLeafRef = null;
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = null;
    this.hide();
    document.body.removeClass("seiton-selection-toolbar-active");
  }

  private readonly onMouseUp = (): void => {
    this.scheduleRefresh();
  };

  private readonly onSelectionChange = (): void => {
    if (this.actionInProgress) {
      return;
    }
    this.scheduleRefresh();
  };

  private readonly onMouseOver = (event: MouseEvent): void => {
    const target =
      event.target instanceof Node ? elementForNode(event.target) : null;
    const formattedElement =
      target?.closest(FORMATTED_ELEMENT_SELECTOR) ?? null;
    if (formattedElement && !this.bar?.contains(formattedElement)) {
      this.scheduleRefresh(formattedElement);
    } else if (
      this.current?.source === "formatted-element" &&
      !(target && this.bar?.contains(target))
    ) {
      this.hide();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.hide();
      return;
    }
    if (
      event.shiftKey ||
      (event.key === "a" && (event.metaKey || event.ctrlKey)) ||
      event.key.startsWith("Arrow")
    ) {
      this.scheduleRefresh();
    }
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.bar?.contains(event.target as Node)) {
      // Keep the CodeMirror selection while a toolbar button is clicked.
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.hide();
  };

  private readonly onWheel = (): void => {
    this.hide();
  };

  private readonly onResize = (): void => {
    this.hide();
  };

  private readonly hide = (): void => {
    this.bar?.remove();
    this.bar = null;
    this.current = null;
  };

  private scheduleRefresh(formattedElement?: Element): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      if (this.actionInProgress) {
        return;
      }
      this.refreshFromSelection(formattedElement);
    }, 10);
  }

  private refreshFromSelection(preferredElement?: Element): void {
    const selection = window.getSelection();
    if (selection && hasSelection(selection)) {
      const range = selection.getRangeAt(0);
      const element = elementForNode(range.commonAncestorContainer);
      const cmEditor = element?.closest(".cm-editor");
      const view = this.viewForElement(cmEditor ?? element);
      if (
        view &&
        view.getMode() !== "preview" &&
        view.editor.somethingSelected()
      ) {
        this.show({
          editor: view.editor,
          from: view.editor.getCursor("from"),
          rect: range.getBoundingClientRect(),
          source: "selection",
          to: view.editor.getCursor("to"),
          view,
        });
        return;
      }
    }

    const caretElement = selection
      ? elementForNode(selection.anchorNode)
      : null;
    const formattedElement =
      preferredElement?.closest(FORMATTED_ELEMENT_SELECTOR) ??
      caretElement?.closest(FORMATTED_ELEMENT_SELECTOR) ??
      null;
    const context = formattedElement
      ? this.contextForFormattedElement(formattedElement)
      : null;
    if (context) {
      this.show(context);
      return;
    }
    this.hide();
  }

  private contextForFormattedElement(
    element: Element
  ): SelectionContext | null {
    const cmEditor = element.closest(".cm-editor");
    const view = this.viewForElement(cmEditor ?? element);
    if (!view || view.getMode() === "preview") {
      return null;
    }
    const editorView = cmEditor
      ? EditorView.findFromDOM(cmEditor as HTMLElement)
      : null;
    if (!editorView) {
      return null;
    }

    try {
      const fromOffset = editorView.posAtDOM(element, 0);
      const toOffset = editorView.posAtDOM(element, element.childNodes.length);
      if (toOffset <= fromOffset) {
        return null;
      }
      return {
        editor: view.editor,
        from: view.editor.offsetToPos(fromOffset),
        rect: element.getBoundingClientRect(),
        source: "formatted-element",
        to: view.editor.offsetToPos(toOffset),
        view,
      };
    } catch {
      // Obsidian may recycle a Live Preview node between mouseover and this callback.
      return null;
    }
  }

  private viewForElement(element: Element | null): MarkdownView | null {
    if (!element) {
      return null;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view as MarkdownView;
      if (view.contentEl?.contains(element)) {
        return view;
      }
    }
    return null;
  }

  private show(context: SelectionContext): void {
    this.hide();
    this.current = context;
    const bar = document.createElement("div");
    bar.className = "seiton-selection-toolbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", t(this.lang, "toolbar.selectionFormat"));
    bar.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.addActionButton(bar, "bold", "B", t(this.lang, "toolbar.bold"), () =>
      this.toggleWrap("**")
    );
    this.addActionButton(
      bar,
      "italic",
      "I",
      t(this.lang, "toolbar.italic"),
      () => this.toggleWrap("*")
    );
    this.addSeparator(bar);
    for (let level = 1; level <= 6; level++) {
      this.addActionButton(
        bar,
        `heading-${level}`,
        `H${level}`,
        `${t(this.lang, "toolbar.heading")} ${level}`,
        () => this.toggleHeading(level)
      );
    }
    this.addSeparator(bar);
    for (const color of pickerColors(this.settings)) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "seiton-selection-tool seiton-selection-swatch";
      swatch.dataset.color = color;
      swatch.style.setProperty("--seiton-highlight-color", color);
      swatch.setAttribute(
        "aria-label",
        `${t(this.lang, "toolbar.background")} ${color}`
      );
      swatch.title = `${t(this.lang, "toolbar.background")} ${color}`;
      swatch.addEventListener("click", () => this.highlight(color));
      bar.appendChild(swatch);
    }
    this.addActionButton(
      bar,
      "clear-formatting",
      "×",
      t(this.lang, "toolbar.clearFormatting"),
      () => this.clearFormatting()
    );
    document.body.appendChild(bar);
    this.bar = bar;
    this.position(context.rect);
  }

  private addActionButton(
    bar: HTMLElement,
    tool: string,
    content: string,
    label: string,
    action: () => void
  ): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "seiton-selection-tool";
    button.dataset.tool = tool;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = content;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      action();
    });
    bar.appendChild(button);
  }

  private addSeparator(bar: HTMLElement): void {
    const separator = document.createElement("span");
    separator.className = "seiton-selection-separator";
    separator.setAttribute("aria-hidden", "true");
    bar.appendChild(separator);
  }

  private withEditor(action: (editor: Editor) => void): boolean {
    const context = this.current;
    if (!context) {
      return false;
    }
    this.actionInProgress = true;
    try {
      context.editor.setSelection(context.from, context.to);
      action(context.editor);
      context.editor.focus();
    } catch {
      this.actionInProgress = false;
      this.hide();
      return false;
    }
    window.setTimeout(() => {
      this.actionInProgress = false;
      if (context.editor.somethingSelected()) {
        const selection = window.getSelection();
        const rect =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).getBoundingClientRect()
            : context.rect;
        this.show({
          ...context,
          from: context.editor.getCursor("from"),
          rect,
          source: "selection",
          to: context.editor.getCursor("to"),
        });
      } else {
        this.hide();
      }
    }, 10);
    return true;
  }

  private toggleWrap(marker: string): void {
    this.withEditor((editor) => {
      const from = editor.getCursor("from");
      const selected = editor.getSelection();
      const replacement = toggleDelimitedText(selected, marker);
      editor.replaceSelection(replacement);
      editor.setSelection(from, positionAfter(from, replacement));
    });
  }

  private toggleHeading(level: number): void {
    this.withEditor((editor) => {
      const from = editor.getCursor("from");
      const to = editor.getCursor("to");
      const fromLine = editor.getLine(from.line);
      const toLine = editor.getLine(to.line);
      const nextFromLine = toggleHeadingLine(fromLine, level);
      const nextToLine =
        from.line === to.line ? nextFromLine : toggleHeadingLine(toLine, level);
      for (let line = from.line; line <= to.line; line++) {
        const position = { ch: 0, line };
        const content = editor.getLine(line);
        editor.replaceRange(toggleHeadingLine(content, level), position, {
          ch: content.length,
          line,
        });
      }
      editor.setSelection(
        {
          ch: Math.max(0, from.ch + nextFromLine.length - fromLine.length),
          line: from.line,
        },
        {
          ch: Math.max(0, to.ch + nextToLine.length - toLine.length),
          line: to.line,
        }
      );
    });
  }

  private highlight(color: string): void {
    if (
      !this.withEditor((editor) => {
        const from = editor.getCursor("from");
        const replacement = highlightText(editor.getSelection(), color);
        editor.replaceSelection(replacement);
        editor.setSelection(from, positionAfter(from, replacement));
      })
    ) {
      return;
    }
    if (isEditorColor(color)) {
      this.settings.editorRecentColors = [
        color,
        ...validEditorColors(this.settings.editorRecentColors).filter(
          (value) => value !== color
        ),
      ].slice(0, 5);
      void this.saveSettings();
    }
  }

  private clearFormatting(): void {
    this.withEditor((editor) => {
      const selected = editor.getSelection();
      const replacement = removeHighlightText(selected);
      if (replacement !== selected) {
        editor.replaceSelection(replacement);
      }

      const from = editor.getCursor("from");
      const to = editor.getCursor("to");
      const fromLine = editor.getLine(from.line);
      const toLine = editor.getLine(to.line);
      const fromHeadingLength =
        fromLine.length - clearHeadingLine(fromLine).length;
      const toHeadingLength = toLine.length - clearHeadingLine(toLine).length;
      for (let line = from.line; line <= to.line; line++) {
        const content = editor.getLine(line);
        const cleared = clearHeadingLine(content);
        if (cleared !== content) {
          editor.replaceRange(
            cleared,
            { ch: 0, line },
            {
              ch: content.length,
              line,
            }
          );
        }
      }
      editor.setSelection(
        {
          ch: Math.max(0, from.ch - fromHeadingLength),
          line: from.line,
        },
        {
          ch: Math.max(0, to.ch - toHeadingLength),
          line: to.line,
        }
      );
    });
  }

  private position(rect: DOMRect): void {
    if (!this.bar) {
      return;
    }
    const toolbarRect = this.bar.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left + (rect.width - toolbarRect.width) / 2),
      Math.max(8, window.innerWidth - toolbarRect.width - 8)
    );
    const above = rect.top - toolbarRect.height - 8;
    const top =
      above >= 8
        ? above
        : Math.min(
            window.innerHeight - toolbarRect.height - 8,
            rect.bottom + 8
          );
    this.bar.style.left = `${left}px`;
    this.bar.style.top = `${Math.max(8, top)}px`;
  }
}
