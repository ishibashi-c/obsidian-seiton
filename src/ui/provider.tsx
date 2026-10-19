/** Runtime boundary for Seiton's source-owned UI system. */
import { type ReactNode, useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

export function readHostColorScheme(): ColorScheme {
  return document.body.classList.contains("theme-dark") ? "dark" : "light";
}

export function useHostColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    readHostColorScheme()
  );
  useEffect(() => {
    const update = (): void => setScheme(readHostColorScheme());
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributeFilter: ["class"],
      attributes: true,
    });
    update();
    return () => observer.disconnect();
  }, []);
  return scheme;
}

export function SeitonUIProvider({ children }: { children: ReactNode }) {
  const scheme = useHostColorScheme();
  return (
    <div className="seiton-ui-root" data-seiton-color-scheme={scheme}>
      {children}
    </div>
  );
}
