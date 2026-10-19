import { seitonStyles } from "./stylesText";

interface UiBoundary {
  dispose: () => void;
  mountPoint: HTMLElement;
}

function styleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = seitonStyles;
  return style;
}

/** Creates the production UI boundary so Obsidian selectors cannot leak into it. */
export function createSeitonShadowBoundary(container: HTMLElement): UiBoundary {
  const previousScrollbarGutter = container.style.scrollbarGutter;
  container.style.scrollbarGutter = "stable";
  const host = document.createElement("div");
  host.className = "seiton-ui-shadow-host";
  host.style.display = "block";
  host.style.minHeight = "100%";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(styleElement());
  const mountPoint = document.createElement("div");
  shadow.append(mountPoint);
  container.replaceChildren(host);

  return {
    dispose: () => {
      host.remove();
      container.style.scrollbarGutter = previousScrollbarGutter;
    },
    mountPoint,
  };
}

/** Adds the same source-owned stylesheet to a light-DOM portal root. */
export function installSeitonStyles(container: HTMLElement): void {
  container.prepend(styleElement());
}
