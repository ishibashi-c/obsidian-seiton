/** Search text normalization and query syntax. Pure and Obsidian-independent. */

export function normalizeSearchText(value: string): string {
  return value
    .replace(/[\u30A1-\u30F6]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60)
    )
    .replace(/ー/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?<=\d)[\s-](?=\d)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedSearchQuery {
  exclude: string[];
  filters: Partial<
    Record<
      "type" | "tag" | "list" | "status" | "source" | "after" | "before",
      string[]
    >
  >;
  include: string[];
  phrases: string[];
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const parsed: ParsedSearchQuery = {
    exclude: [],
    filters: {},
    include: [],
    phrases: [],
  };
  const tokens = query.match(/-?"[^"]+"|-?\S+/g) ?? [];
  for (const raw of tokens) {
    const negative = raw.startsWith("-");
    const token = negative ? raw.slice(1) : raw;
    const filter = /^(type|tag|list|status|source|after|before):(.+)$/i.exec(
      token
    );
    if (filter && !negative) {
      const key = filter[1].toLowerCase() as keyof ParsedSearchQuery["filters"];
      const values = parsed.filters[key] ?? [];
      values.push(normalizeSearchText(filter[2].replace(/^"|"$/g, "")));
      parsed.filters[key] = values;
      continue;
    }
    const normalized = normalizeSearchText(token.replace(/^"|"$/g, ""));
    if (!normalized) {
      continue;
    }
    if (negative) {
      parsed.exclude.push(normalized);
    } else if (token.startsWith('"')) {
      parsed.phrases.push(normalized);
    } else {
      parsed.include.push(normalized);
    }
  }
  return parsed;
}

export function isSearchDateRangeReversed(
  after: string,
  before: string
): boolean {
  return Boolean(after && before && after > before);
}
