/** Ranked, field-aware search engine. Pure and Obsidian-independent. */
import { normalizeSearchText, parseSearchQuery } from "./searchQuery";

// Preserve the existing search API for callers.
export {
  isSearchDateRangeReversed,
  normalizeSearchText,
  type ParsedSearchQuery,
  parseSearchQuery,
} from "./searchQuery";

import type { IndexedItem, ItemStatus, ItemType } from "./types";

export function buildSearchHaystack(item: IndexedItem): string {
  return normalizeSearchText(
    [
      item.title,
      item.item.type,
      ...(item.item.tags ?? []),
      ...(item.item.sourceTags ?? []),
      ...(item.item.lists ?? []),
      item.body,
    ].join(" ")
  );
}

export interface SearchDocument {
  body: string;
  created?: string;
  id: string;
  kind: "note" | "memo" | "external";
  lists: string[];
  modified: number;
  path: string;
  pinned?: boolean;
  sourceTags: string[];
  status?: ItemStatus;
  tags: string[];
  title: string;
  type?: ItemType;
}

export interface RankedSearchResult {
  document: SearchDocument;
  excerpt: string;
  matchedFields: string[];
  matchedTags: string[];
  score: number;
}

export interface RankedSearchOptions {
  allTags?: boolean;
  includeArchived?: boolean;
  limit?: number;
  tagAliases?: Record<string, string[]>;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[b.length];
}

function fuzzyMatch(field: string, token: string): boolean {
  if (token.length < 3) {
    return false;
  }
  const threshold = token.length >= 7 ? 2 : 1;
  return field
    .split(/[\s/,_-]+/)
    .some(
      (word) =>
        Math.abs(word.length - token.length) <= threshold &&
        distance(word, token) <= threshold
    );
}

function normalizedFields(
  document: SearchDocument,
  aliases: Record<string, string[]>
): Record<string, string[]> {
  const expandedTags = document.tags.flatMap((tag) => [
    tag,
    ...(aliases[tag] ?? []),
  ]);
  return {
    body: [normalizeSearchText(document.body)],
    lists: document.lists.map(normalizeSearchText),
    source: document.sourceTags.map(normalizeSearchText),
    tags: expandedTags.map(normalizeSearchText),
    title: [normalizeSearchText(document.title)],
  };
}

function fieldFilter(
  values: string[] | undefined,
  candidates: string[]
): boolean {
  return (
    !values?.length ||
    values.some((value) =>
      candidates.some(
        (candidate) => candidate === value || candidate.includes(value)
      )
    )
  );
}

function excerpt(body: string, tokens: string[]): string {
  const normalized = normalizeSearchText(body);
  const positions = tokens
    .map((token) => normalized.indexOf(token))
    .filter((position) => position >= 0);
  const start =
    positions.length > 0 ? Math.max(0, Math.min(...positions) - 60) : 0;
  const text = body.replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 220)}${text.length > start + 220 ? "…" : ""}`;
}

export function rankDocuments(
  documents: SearchDocument[],
  query: string,
  options: RankedSearchOptions = {}
): RankedSearchResult[] {
  const parsed = parseSearchQuery(query);
  const terms = [...parsed.include, ...parsed.phrases];
  if (terms.length === 0 && Object.keys(parsed.filters).length === 0) {
    return [];
  }
  const aliases = options.tagAliases ?? {};
  const results: RankedSearchResult[] = [];
  for (const document of documents) {
    if (!options.includeArchived && document.status === "archive") {
      continue;
    }
    const fields = normalizedFields(document, aliases);
    const all = Object.values(fields).flat().join(" ");
    if (parsed.exclude.some((term) => all.includes(term))) {
      continue;
    }
    if (
      !fieldFilter(parsed.filters.type, document.type ? [document.type] : [])
    ) {
      continue;
    }
    if (!fieldFilter(parsed.filters.list, fields.lists)) {
      continue;
    }
    if (
      !fieldFilter(
        parsed.filters.status,
        document.status ? [document.status] : []
      )
    ) {
      continue;
    }
    if (!fieldFilter(parsed.filters.source, fields.source)) {
      continue;
    }
    const date = document.created
      ? normalizeSearchText(document.created.slice(0, 10))
      : undefined;
    if (
      parsed.filters.after?.[0] &&
      (!date || date < parsed.filters.after[0])
    ) {
      continue;
    }
    if (
      parsed.filters.before?.[0] &&
      (!date || date > parsed.filters.before[0])
    ) {
      continue;
    }
    const tagFilters = parsed.filters.tag;
    if (tagFilters?.length) {
      const matches = tagFilters.map((tag) =>
        fields.tags.some((value) => value === tag || value.includes(tag))
      );
      if (options.allTags ? !matches.every(Boolean) : !matches.some(Boolean)) {
        continue;
      }
    }
    const matchedTags = tagFilters?.length
      ? document.tags.filter((tag) => {
          const normalizedTagValues = [tag, ...(aliases[tag] ?? [])].map(
            normalizeSearchText
          );
          return tagFilters.some((filter) =>
            normalizedTagValues.some(
              (value) => value === filter || value.includes(filter)
            )
          );
        })
      : [];
    let score = 0;
    const matched = new Set<string>();
    let rejected = false;
    for (const term of terms) {
      let termScore = 0;
      if (fields.title[0] === term) {
        termScore = 1000;
      } else if (fields.title[0].startsWith(term)) {
        termScore = 700;
      } else if (fields.title[0].includes(term)) {
        termScore = 500;
      } else if (
        fields.tags.some((value) => value === term) ||
        fields.lists.some((value) => value === term)
      ) {
        termScore = 350;
      } else if (
        [...fields.tags, ...fields.lists].some((value) => value.includes(term))
      ) {
        termScore = 280;
      } else if (fields.source.some((value) => value.includes(term))) {
        termScore = 220;
      } else if (fields.body[0].includes(term)) {
        termScore = 120;
      } else if (
        fuzzyMatch(fields.title[0], term) ||
        [...fields.tags, ...fields.lists].some((value) =>
          fuzzyMatch(value, term)
        )
      ) {
        termScore = 40;
      }
      if (termScore === 0) {
        rejected = true;
        break;
      }
      score += termScore;
      if (termScore >= 500) {
        matched.add("title");
      } else if (termScore >= 280) {
        matched.add("metadata");
      } else {
        matched.add("body");
      }
    }
    if (rejected) {
      continue;
    }
    results.push({
      document,
      excerpt: excerpt(document.body, terms),
      matchedFields: [...matched],
      matchedTags,
      score,
    });
  }
  return results
    .sort(
      (a, b) => b.score - a.score || b.document.modified - a.document.modified
    )
    .slice(0, options.limit ?? 200);
}

export class SearchIndex {
  private documents = new Map<string, SearchDocument>();
  replace(documents: SearchDocument[]): void {
    this.documents = new Map(
      documents.map((document) => [document.id, document])
    );
  }
  upsert(document: SearchDocument): void {
    this.documents.set(document.id, document);
  }
  remove(id: string): void {
    this.documents.delete(id);
  }
  removePath(path: string): void {
    for (const [id, document] of this.documents) {
      if (document.path === path) {
        this.documents.delete(id);
      }
    }
  }
  search(query: string, options?: RankedSearchOptions): RankedSearchResult[] {
    return rankDocuments([...this.documents.values()], query, options);
  }
  get size(): number {
    return this.documents.size;
  }
}

export interface SearchOptions {
  excludeArchived?: boolean;
}

/** Compatibility wrapper used by compact search surfaces. */
export function searchItems(
  items: IndexedItem[],
  query: string,
  options: SearchOptions = {}
): IndexedItem[] {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const documents = items.map((item) => itemToSearchDocument(item));
  return rankDocuments(documents, query, {
    includeArchived: !options.excludeArchived,
  })
    .map((result) => byPath.get(result.document.path))
    .filter((item): item is IndexedItem => Boolean(item));
}

export function itemToSearchDocument(
  item: IndexedItem,
  modified = 0
): SearchDocument {
  return {
    body: item.body,
    created: item.item.created,
    id: `note:${item.path}`,
    kind: "note",
    lists: item.item.lists ?? [],
    modified,
    path: item.path,
    sourceTags: item.item.sourceTags ?? [],
    status: item.item.status,
    tags: item.item.tags ?? [],
    title: item.title,
    type: item.item.type,
  };
}
