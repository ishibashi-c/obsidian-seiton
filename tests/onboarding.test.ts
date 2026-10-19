import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AGENT_GUIDE_SCHEMA_VERSION,
  agentGuideVersion,
  buildAgentGuide,
  planAgentGuide,
} from "../src/features/onboarding/agentGuide";
import { ONBOARDING_PRESETS } from "../src/features/onboarding/presets";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import { AgentGuideChoiceField } from "../src/ui/patterns/OnboardingFlow";

describe("onboarding flow radio choices", () => {
  it("renders the default guide choice as the sole member of one radio group", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentGuideChoiceField, {
        guideChoice: "create",
        lang: "ja",
        onChange: () => undefined,
      })
    );
    const radios = Array.from(
      markup.matchAll(/<input\b(?=[^>]*type="radio")[^>]*>/g),
      ([radio]) => radio
    );
    const selectedValues = radios.flatMap((radio) => {
      const value = radio.match(/\bvalue="([^"]+)"/)?.[1];
      return /\bchecked=""/.test(radio) && value ? [value] : [];
    });

    expect(radios).toHaveLength(3);
    expect(
      radios.every((radio) => /\bname="agent-guide-choice"/.test(radio))
    ).toBe(true);
    expect(selectedValues).toEqual(["create"]);
  });
});

describe("onboarding presets", () => {
  it("5 presets provide understandable type selections", () => {
    expect(Object.keys(ONBOARDING_PRESETS)).toHaveLength(5);
    expect(ONBOARDING_PRESETS.study.types).toContain("reading");
    expect(ONBOARDING_PRESETS.create.types).toContain("project");
    expect(ONBOARDING_PRESETS.all.types).toContain("collection");
    expect(ONBOARDING_PRESETS.research.types).toContain("collection");
  });
});

describe("agent guide", () => {
  const guide = buildAgentGuide(DEFAULT_SETTINGS);

  it("records schema, safety, and bibliographic-tool route", () => {
    expect(agentGuideVersion(guide)).toBe(AGENT_GUIDE_SCHEMA_VERSION);
    expect(guide).toContain("Do not delete notes");
    expect(guide).toContain("bibliographic-search tool or connector first");
    expect(guide).toContain("ISBN-10 to ISBN-13");
    expect(guide).toContain("collection");
    expect(guide).toContain("long-lived curated reference");
    expect(guide).toContain("`collection`: `Seiton/collections`");
  });

  it("writes inbox organization as a language-specific proposal, not a source edit", () => {
    const japaneseGuide = buildAgentGuide(DEFAULT_SETTINGS, "ja");
    expect(japaneseGuide).toContain("Seiton/整理案/");
    expect(japaneseGuide).toContain("Do not edit source notes directly");
    expect(japaneseGuide).toContain("expected:");
    expect(japaneseGuide).toContain("version: 2");
    expect(japaneseGuide).toContain("account for every inbox note");
    expect(japaneseGuide).toContain("holds:");
    expect(japaneseGuide).toContain(
      "They may select several and confirm them together"
    );
    expect(japaneseGuide).toContain("YYYY-MM-DD-02.md");
    expect(buildAgentGuide(DEFAULT_SETTINGS, "de")).toContain(
      "Seiton/Sortiervorschläge/"
    );
  });

  it("never overwrites AGENTS.md and writes updates to a proposal path", () => {
    expect(planAgentGuide("create", "Seiton", null, guide)).toMatchObject({
      kind: "create",
      path: "Seiton/AGENTS.md",
    });
    expect(planAgentGuide("create", "Seiton", "existing", guide)).toEqual({
      kind: "none",
    });
    expect(
      planAgentGuide("propose", "Seiton", "existing", guide)
    ).toMatchObject({
      kind: "proposal",
      path: "Seiton/AGENTS.seiton-proposed.md",
    });
    expect(planAgentGuide("propose", "Seiton", guide, guide)).toEqual({
      kind: "none",
    });
    const previousGuide = guide.replace(
      `seiton-agent-guide-schema: ${AGENT_GUIDE_SCHEMA_VERSION}`,
      "seiton-agent-guide-schema: 2"
    );
    expect(
      planAgentGuide("propose", "Seiton", previousGuide, guide)
    ).toMatchObject({
      kind: "proposal",
      path: "Seiton/AGENTS.seiton-proposed.md",
    });
  });
});
