import type { FeatureModules, ItemType } from "../../shared/types";

export type OnboardingPreset =
  | "basic"
  | "study"
  | "create"
  | "research"
  | "all";
export interface PresetDefinition {
  modules: Partial<FeatureModules>;
  types: ItemType[];
}

export const ONBOARDING_PRESETS: Record<OnboardingPreset, PresetDefinition> = {
  all: {
    modules: {
      agentGuide: true,
      bookshelf: true,
      editorToolbar: true,
      memos: true,
      richCards: true,
    },
    types: [
      "class",
      "task",
      "reading",
      "idea",
      "article",
      "project",
      "webclip",
      "memo",
      "profile",
      "collection",
    ],
  },
  basic: {
    modules: { bookshelf: false },
    types: ["task", "idea", "article", "webclip", "memo"],
  },
  create: {
    modules: { bookshelf: false },
    types: ["task", "idea", "article", "project", "memo"],
  },
  research: {
    modules: { bookshelf: true, richCards: true },
    types: ["reading", "idea", "article", "webclip", "collection", "memo"],
  },
  study: {
    modules: { bookshelf: true },
    types: ["class", "task", "reading", "idea", "webclip", "memo"],
  },
};
