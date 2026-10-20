/** @jsxImportSource react */

import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Lang, t } from "../../shared/i18n";
import { installSeitonStyles } from "../boundary";
import { stopEscapeFromReachingObsidian } from "../escapeBoundary";
import { Modal } from "../primitives";

interface ProductionDialogOptions {
  closeButtonLabel?: string;
  lang?: Lang;
  render: (close: () => void, requestResultFocus: () => void) => ReactNode;
  size?: string | number;
  title: ReactNode;
}

const openDialogs = new Set<() => void>();

export function getProductionDialogCloseButtonLabel(
  lang: Lang,
  label?: string
): string {
  return label ?? t(lang, "notify.close");
}

export function closeProductionDialogs(): void {
  for (const close of [...openDialogs]) {
    close();
  }
}

function ProductionDialogRoot({
  close,
  closeButtonLabel,
  host,
  lang,
  render,
  size,
  title,
}: ProductionDialogOptions & {
  close: () => void;
  host: HTMLElement;
  lang: Lang;
}) {
  const [focusKey, setFocusKey] = useState(0);

  return (
    <Modal
      centered
      closeButtonProps={{
        "aria-label": getProductionDialogCloseButtonLabel(
          lang,
          closeButtonLabel
        ),
      }}
      focusKey={focusKey}
      lang={lang}
      onClose={close}
      opened
      portalProps={{ target: host }}
      size={size ?? "lg"}
      title={title}
      withinPortal={false}
    >
      {render(close, () => setFocusKey((key) => key + 1))}
    </Modal>
  );
}

/** Mounts an opaque, centered dialog inside its own UI boundary. */
export function openProductionDialog({
  title,
  size = "lg",
  closeButtonLabel,
  lang = "en",
  render,
}: ProductionDialogOptions): () => void {
  const host = document.createElement("div");
  host.className = "seiton-ui-root seiton-react-production-dialog-host";
  host.dataset.seitonColorScheme = document.body.classList.contains(
    "theme-dark"
  )
    ? "dark"
    : "light";
  installSeitonStyles(host);
  document.body.appendChild(host);

  const root = createRoot(host);
  let closed = false;
  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    openDialogs.delete(close);
    host.removeEventListener("keydown", stopEscapeFromReachingObsidian);
    root.unmount();
    host.remove();
  };

  root.render(
    <ProductionDialogRoot
      close={close}
      closeButtonLabel={closeButtonLabel}
      host={host}
      lang={lang}
      render={render}
      size={size}
      title={title}
    />
  );
  host.addEventListener("keydown", stopEscapeFromReachingObsidian);
  openDialogs.add(close);
  return close;
}
