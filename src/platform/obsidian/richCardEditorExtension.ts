import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Lang } from "../../shared/i18n";
import { ReactRichCard } from "../../ui/patterns/RichCard";
import type { RichCardGateway } from "../ports";

interface EditorLinkRange {
  from: number;
  raw: string;
  to: number;
  url: string;
}

/** URL単独行またはMarkdownリンク単独行を、編集時に復元できるカード候補へ変換する。 */
function standaloneLink(
  lineText: string,
  lineFrom: number
): EditorLinkRange | null {
  const leading = lineText.match(/^\s*/)?.[0].length ?? 0;
  const trailing = lineText.match(/\s*$/)?.[0].length ?? 0;
  const raw = lineText.slice(
    leading,
    Math.max(leading, lineText.length - trailing)
  );
  if (!raw) {
    return null;
  }

  const markdown = /^\[[^\]]+\]\(\s*<?(https?:\/\/[^\s)>]+)>?\s*\)$/i.exec(raw);
  const bare = /^(https?:\/\/[^\s<>()[\]]+)$/i.exec(raw);
  const url = markdown?.[1] ?? bare?.[1];
  if (!url) {
    return null;
  }
  return {
    from: lineFrom + leading,
    raw,
    to: lineFrom + leading + raw.length,
    url,
  };
}

class RichCardWidget extends WidgetType {
  private root: Root | null = null;

  constructor(
    private readonly range: EditorLinkRange,
    private readonly store: RichCardGateway,
    private readonly lang: Lang
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("span");
    host.className = "seiton-rich-card-editor-widget";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "seiton-rich-card-editor-edit";
    edit.setAttribute("aria-label", "URLを編集");
    edit.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.8V20h3.2L18.9 8.3l-3.2-3.2L4 16.8Zm12.4-10.6 1.4-1.4a1.1 1.1 0 0 1 1.6 0l-.2-.2a1.1 1.1 0 0 1 0 1.6l-1.4 1.4-1.4-1.4Z" fill="currentColor"/></svg>';
    edit.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        selection: { anchor: this.range.from, head: this.range.to },
      });
      view.focus();
    });
    host.append(edit);

    const cardHost = document.createElement("span");
    cardHost.className = "seiton-rich-card-editor-card";
    host.append(cardHost);
    this.root = createRoot(cardHost);
    this.root.render(
      createElement(ReactRichCard, {
        lang: this.lang,
        store: this.store,
        url: this.range.url,
      })
    );
    return host;
  }

  eq(widget: WidgetType): boolean {
    return (
      widget instanceof RichCardWidget &&
      widget.range.raw === this.range.raw &&
      widget.range.url === this.range.url
    );
  }

  get lineBreaks(): number {
    return 1;
  }

  destroy(): void {
    this.root?.unmount();
    this.root = null;
  }
}

function selectionContainsRange(
  view: EditorView,
  range: EditorLinkRange
): boolean {
  return view.state.selection.ranges.some(
    (selection) => selection.from <= range.to && selection.to >= range.from
  );
}

function buildDecorations(
  view: EditorView,
  enabled: () => boolean,
  store: RichCardGateway,
  lang: Lang,
  revealSelection: boolean
): DecorationSet {
  if (!enabled()) {
    return Decoration.none;
  }
  const builder = new RangeSetBuilder<Decoration>();
  const seen = new Set<number>();
  for (const range of view.visibleRanges) {
    let position = range.from;
    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      if (!seen.has(line.from)) {
        seen.add(line.from);
        const link = standaloneLink(line.text, line.from);
        if (link && !(revealSelection && selectionContainsRange(view, link))) {
          builder.add(
            link.from,
            link.to,
            Decoration.replace({
              widget: new RichCardWidget(link, store, lang),
            })
          );
        }
      }
      if (line.to >= range.to) {
        break;
      }
      position = line.to + 1;
    }
  }
  return builder.finish();
}

/** Reading Viewと同じURL候補を、編集ビューではカード置換＋編集時の原文露出で表示する。 */
export function createRichCardEditorExtension(
  enabled: () => boolean,
  store: RichCardGateway,
  lang: Lang
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private revealSelection = false;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(
          view,
          enabled,
          store,
          lang,
          this.revealSelection
        );
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) {
          this.revealSelection = false;
        } else if (update.selectionSet) {
          this.revealSelection = true;
        }
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.geometryChanged ||
          update.transactions.length > 0
        ) {
          this.decorations = buildDecorations(
            update.view,
            enabled,
            store,
            lang,
            this.revealSelection
          );
        }
      }
    },
    { decorations: (value) => value.decorations }
  );
}
