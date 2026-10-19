/** @jsxImportSource react */

import { useState } from "react";
import type { CoverGateway } from "../../platform/ports";
import { type Lang, t } from "../../shared/i18n";
import { Button, Group, Stack, TextInput } from "../primitives";
import { openProductionDialog } from "./ProductionDialog";

export function ReactCoverForm({
  gateway,
  notePath,
  lang,
  onClose,
  onSaved,
  notify,
}: {
  gateway: CoverGateway;
  notePath: string;
  lang: Lang;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string) => void;
}) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    const normalized = path.trim();
    if (!normalized) {
      return;
    }
    setBusy(true);
    try {
      await gateway.save(notePath, normalized);
      onSaved();
      onClose();
    } catch {
      notify(t(lang, "notify.saveError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack className="seiton-react-cover-form" gap="md">
      <TextInput
        autoFocus
        description={t(lang, "book.coverPathHint")}
        label={t(lang, "book.coverPath")}
        onChange={(event) => setPath(event.currentTarget.value)}
        value={path}
      />
      <Group justify="flex-end">
        <Button onClick={onClose} variant="default">
          {t(lang, "action.cancel")}
        </Button>
        <Button
          color="ink"
          disabled={busy || !path.trim()}
          onClick={() => void save()}
        >
          {t(lang, "action.save")}
        </Button>
      </Group>
    </Stack>
  );
}

export function openReactCoverDialog(
  gateway: CoverGateway,
  notePath: string,
  lang: Lang,
  onSaved: () => void,
  notify: (message: string) => void
): () => void {
  return openProductionDialog({
    closeButtonLabel: t(lang, "notify.close"),
    render: (close) => (
      <ReactCoverForm
        gateway={gateway}
        lang={lang}
        notePath={notePath}
        notify={notify}
        onClose={close}
        onSaved={onSaved}
      />
    ),
    size: "md",
    title: t(lang, "book.coverPath"),
  });
}
