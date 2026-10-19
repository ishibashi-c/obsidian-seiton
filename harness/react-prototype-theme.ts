export type { ColorScheme } from "../src/ui/provider";

/** UI Lab no longer exposes a library-owned theme object. */
export const prototypeTheme = {
  name: "seiton",
  tokens: "src/ui/tokens.css",
} as const;
