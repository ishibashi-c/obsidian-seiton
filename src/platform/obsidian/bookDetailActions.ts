import {
  type App,
  type EventRef,
  MarkdownView,
  Notice,
  type WorkspaceLeaf,
} from "obsidian";
import { createElement } from "react";
import type { Lang } from "../../shared/i18n";
import { t } from "../../shared/i18n";
import type { SeitonSettings } from "../../shared/types";
import { openProductionDialog } from "../../ui/patterns/ProductionDialog";
import { EditBookPanel } from "../../ui/screens/react-bookshelf-prototype";
import { createObsidianProductionAdapter } from "./productionAdapter";
import { loadReactProductionData } from "./productionData";

export interface BookDetailActionController {
  clear: () => void;
  dispose: () => void;
  update: (leaf?: WorkspaceLeaf | null) => void;
}

export function registerBookDetailActions(options: {
  app: App;
  getLang: () => Lang;
  getSettings: () => SeitonSettings;
  onBackToBookshelf: () => void;
  onRefresh: () => void;
  registerEvent: (event: EventRef) => void;
}): BookDetailActionController {
  const { app } = options;
  const adapter = createObsidianProductionAdapter(
    app,
    loadReactProductionData,
    options.getLang
  );
  const actions = new Map<
    MarkdownView,
    { back: HTMLElement; edit: HTMLElement }
  >();

  const remove = (view: MarkdownView): void => {
    const current = actions.get(view);
    current?.back.remove();
    current?.edit.remove();
    actions.delete(view);
  };

  const clear = (): void => {
    for (const view of actions.keys()) {
      remove(view);
    }
  };

  const update = (leaf = app.workspace.activeLeaf): void => {
    const view = leaf?.view;
    if (!(view instanceof MarkdownView)) {
      return;
    }
    const file = view.file;
    const frontmatter = file
      ? app.metadataCache.getFileCache(file)?.frontmatter
      : undefined;
    if (
      !(
        file &&
        options.getSettings().modules.bookshelf &&
        frontmatter?.type === "reading"
      )
    ) {
      remove(view);
      return;
    }

    const backLabel = t(options.getLang(), "bookshelf.back");
    const editLabel = t(options.getLang(), "book.editTitleFor", {
      title: file.basename,
    });
    const existing = actions.get(view);
    if (existing) {
      existing.back.setAttribute("aria-label", backLabel);
      existing.back.setAttribute("title", backLabel);
      existing.edit.setAttribute("aria-label", editLabel);
      existing.edit.setAttribute("title", editLabel);
      return;
    }

    const back = view.addAction(
      "arrow-left",
      backLabel,
      options.onBackToBookshelf
    );
    back.setAttribute("aria-label", backLabel);
    back.setAttribute("title", backLabel);
    const edit = view.addAction("pencil", editLabel, () => {
      void openBookEditor(view);
    });
    edit.setAttribute("aria-label", editLabel);
    edit.setAttribute("title", editLabel);
    actions.set(view, { back, edit });
  };

  const openBookEditor = async (view: MarkdownView): Promise<void> => {
    const file = view.file;
    if (!file) {
      return;
    }
    const settings = options.getSettings();
    const lang = options.getLang();
    try {
      const data = await loadReactProductionData(app, settings);
      const book = data.books.find((candidate) => candidate.id === file.path);
      if (!book) {
        // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
        new Notice(t(lang, "book.openFailed"));
        return;
      }
      openProductionDialog({
        closeButtonLabel: t(lang, "notify.close"),
        lang,
        render: (close) =>
          createElement(EditBookPanel, {
            book,
            categories: settings.bookCategories,
            lang,
            listNames: settings.listNames,
            onClose: close,
            onSave: async (input) => {
              await adapter.bookGateway.update(
                book.id,
                input,
                options.getSettings()
              );
              options.onRefresh();
            },
          }),
        size: "lg",
        title: t(lang, "book.editTitleFor", { title: book.title }),
      });
    } catch {
      // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
      new Notice(t(lang, "book.openFailed"));
    }
  };

  options.registerEvent(
    app.workspace.on("active-leaf-change", (leaf) => update(leaf))
  );
  options.registerEvent(app.workspace.on("file-open", () => update()));
  options.registerEvent(app.metadataCache.on("changed", () => update()));

  return {
    clear,
    dispose: clear,
    update,
  };
}
