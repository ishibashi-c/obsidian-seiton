/** @jsxImportSource react */

import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { installSeitonStyles } from "../boundary";
import { stopEscapeFromReachingObsidian } from "../escapeBoundary";
import { Modal } from "../primitives";

interface ProductionDialogOptions {
  closeButtonLabel?: string;
  render: (close: () => void, requestResultFocus: () => void) => ReactNode;
  size?: string | number;
  title: ReactNode;
}

function ProductionDialogRoot({
  close,
  closeButtonLabel,
  host,
  render,
  size,
  title,
}: ProductionDialogOptions & { close: () => void; host: HTMLElement }) {
  const [focusKey, setFocusKey] = useState(0);

  return (
    <Modal
      centered
      closeButtonProps={{ "aria-label": closeButtonLabel ?? "閉じる" }}
      focusKey={focusKey}
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
  closeButtonLabel = "閉じる",
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
    host.removeEventListener("keydown", stopEscapeFromReachingObsidian);
    root.unmount();
    host.remove();
  };

  root.render(
    <ProductionDialogRoot
      close={close}
      closeButtonLabel={closeButtonLabel}
      host={host}
      render={render}
      size={size}
      title={title}
    />
  );
  host.addEventListener("keydown", stopEscapeFromReachingObsidian);
  return close;
}
