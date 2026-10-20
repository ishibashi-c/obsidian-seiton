/** @jsxImportSource react */

import { type App, Notice, TFile } from "obsidian";
import {
  buildAgentGuide,
  planAgentGuide,
} from "../../features/onboarding/agentGuide";
import { type Lang, t } from "../../shared/i18n";
import type { SeitonSettings } from "../../shared/types";
import type { OnboardingDraft } from "../../ui/patterns/OnboardingFlow";
import { ReactOnboardingFlow } from "../../ui/patterns/OnboardingFlow";
import { openProductionDialog } from "../../ui/patterns/ProductionDialog";
import { ensureFolder } from "./vaultUtils";

export function ReactOnboardingForm({
  app,
  settings,
  detectedLang,
  onDone,
}: {
  app: App;
  settings: SeitonSettings;
  detectedLang: Lang;
  onDone: (lang: Lang) => Promise<void>;
}) {
  const initialLang =
    settings.uiLanguage === "auto" ? detectedLang : settings.uiLanguage;
  const initialGuideChoice = settings.modules.agentGuide ? "create" : "none";

  const finish = async (draft: OnboardingDraft): Promise<void> => {
    settings.uiLanguage = draft.lang;
    settings.enabledTypes = draft.types;
    settings.modules = draft.modules;
    settings.rootFolder = draft.rootFolder.trim() || "Seiton";
    settings.search.additionalFolders = [
      ...new Set(
        draft.searchFolders
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];
    settings.sharedTextDefault = draft.sharedDefault;
    settings.onboardingCompleted = true;
    const guide = buildAgentGuide(settings, draft.lang);
    const guidePath = `${settings.rootFolder.replace(/^\/+|\/+$/g, "")}/AGENTS.md`;
    const existingFile = app.vault.getAbstractFileByPath(guidePath);
    const existing =
      existingFile instanceof TFile ? await app.vault.read(existingFile) : null;
    const plan = planAgentGuide(
      draft.guideChoice,
      settings.rootFolder,
      existing,
      guide
    );
    if (plan.kind !== "none" && !app.vault.getAbstractFileByPath(plan.path)) {
      const root = settings.rootFolder.replace(/^\/+|\/+$/g, "");
      await ensureFolder(app.vault, root);
      await app.vault.create(plan.path, plan.content);
    }
    await onDone(draft.lang);
    // biome-ignore lint/correctness/noUnusedInstantiation: Obsidian Notice displays the message as a constructor side effect.
    new Notice(t(draft.lang, "onboarding.done"));
  };

  return (
    <ReactOnboardingFlow
      initialGuideChoice={initialGuideChoice}
      initialLang={initialLang}
      initialModules={settings.modules}
      initialRootFolder={settings.rootFolder}
      initialSearchFolders={settings.search.additionalFolders.join(", ")}
      initialSharedDefault={settings.sharedTextDefault}
      initialTypes={settings.enabledTypes}
      onFinish={finish}
      surfaceClassName="seiton-react-onboarding-modal-surface"
    />
  );
}

export function openReactOnboardingDialog(
  app: App,
  settings: SeitonSettings,
  detectedLang: Lang,
  onDone: (lang: Lang) => Promise<void>
): () => void {
  return openProductionDialog({
    closeButtonLabel: t(detectedLang, "notify.close"),
    lang: detectedLang,
    render: (close) => (
      <ReactOnboardingForm
        app={app}
        detectedLang={detectedLang}
        onDone={async (lang) => {
          await onDone(lang);
          close();
        }}
        settings={settings}
      />
    ),
    size: "xl",
    title: "Seiton",
  });
}
