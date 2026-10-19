/** @jsxImportSource react */

import { createRoot } from "react-dom/client";
import { type Lang, t } from "../../shared/i18n";
import { DEFAULT_FEATURE_MODULES } from "../../shared/settings";
import { ReactOnboardingFlow } from "../patterns/OnboardingFlow";
import { Text, Title } from "../primitives";
import type { ColorScheme } from "../provider";
import { SeitonUIProvider, useHostColorScheme } from "../provider";

function PrototypeSurface({
  lang,
  scheme,
}: {
  lang: Lang;
  scheme: ColorScheme;
}) {
  return (
    <div className="seiton-react-onboarding-prototype" data-scheme={scheme}>
      <header className="react-onboarding-header">
        <div>
          <Title className="react-onboarding-heading" order={1}>
            {t(lang, "settings.title")}
          </Title>
        </div>
      </header>

      <main>
        <ReactOnboardingFlow
          initialLang={lang}
          initialModules={{
            ...DEFAULT_FEATURE_MODULES,
            agentGuide: false,
            bookshelf: false,
            editorToolbar: false,
          }}
          onFinish={() => undefined}
          surfaceClassName="react-onboarding-panel"
        />
      </main>
      <footer className="react-onboarding-footer">
        <Text className="react-onboarding-muted" size="xs">
          Harness only · オンボーディングページの構成試作。本番コード、Obsidian
          ItemView、test-vaultは変更していません
        </Text>
      </footer>
    </div>
  );
}

function PrototypeApp({ lang = "ja" }: { lang?: Lang }) {
  const scheme = useHostColorScheme();
  return (
    <SeitonUIProvider>
      <PrototypeSurface lang={lang} scheme={scheme} />
    </SeitonUIProvider>
  );
}

export function mountReactOnboardingPrototype(
  root: HTMLElement,
  options: { lang?: Lang } = {}
): () => void {
  root.replaceChildren();
  const mountPoint = document.createElement("div");
  root.appendChild(mountPoint);
  const reactRoot = createRoot(mountPoint);
  reactRoot.render(<PrototypeApp lang={options.lang} />);
  return () => reactRoot.unmount();
}
