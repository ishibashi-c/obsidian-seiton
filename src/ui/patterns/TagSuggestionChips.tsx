import type { RefObject } from "react";
import { type Lang, t } from "../../shared/i18n";
import { normalizeTagInput } from "../../shared/tags";

export function TagSuggestionChips({
  lang = "ja",
  tags,
  selected = [],
  onSelect,
  focusTargetRef,
  label,
}: {
  lang?: Lang;
  tags: readonly string[];
  selected?: readonly string[];
  onSelect: (tag: string) => void;
  focusTargetRef?: RefObject<HTMLElement | null>;
  label?: string;
}) {
  const selectedTags = new Set(selected.map(normalizeTagInput));
  const visibleTags = [...new Set(tags.map(normalizeTagInput).filter(Boolean))]
    .filter((tag) => !selectedTags.has(tag))
    .slice(0, 5);
  if (visibleTags.length === 0) {
    return null;
  }
  const suggestionsLabel = label ?? t(lang, "tags.suggestions");

  return (
    <section aria-label={suggestionsLabel} className="seiton-tag-suggestions">
      <span className="seiton-tag-suggestions-label">{suggestionsLabel}</span>
      <div className="seiton-tag-suggestions-list">
        {visibleTags.map((tag) => (
          <button
            aria-label={t(lang, "tags.add", { tag })}
            key={tag}
            onClick={() => {
              onSelect(tag);
              focusTargetRef?.current?.focus();
            }}
            type="button"
          >
            #{tag}
          </button>
        ))}
      </div>
    </section>
  );
}
