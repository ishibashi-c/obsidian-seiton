/**
 * タグ正規化・サジェスト（spec: 決定35・51・79 — 既存タグのサジェスト + 読み検索 + エイリアス自動正規化）
 * 純関数・Obsidian非依存。
 */

import { normalizeSearchText } from "./search";
import type { IndexedItem } from "./types";

/** タグ入力の正規化（# 除去・トリム） */
export function normalizeTagInput(raw: string): string {
  return raw.trim().replace(/^#+/, "");
}

/** カンマ区切りの入力欄を、重複のないタグ配列へ変換する。 */
export function parseTagInput(raw: string): string[] {
  return [
    ...new Set(raw.split(/[,、]/).map(normalizeTagInput).filter(Boolean)),
  ];
}

/**
 * タグ入力欄に常時表示する頻出タグを返す。
 * 同数の場合は、最初に現れたタグを先にして表示順を安定させる。
 */
export function mostFrequentTags(
  tagLists: Iterable<readonly string[]>,
  limit = 5
): string[] {
  const counts = new Map<string, { count: number; order: number }>();
  let order = 0;

  for (const tags of tagLists) {
    for (const raw of tags) {
      const tag = normalizeTagInput(raw);
      if (!tag) {
        continue;
      }
      const current = counts.get(tag);
      if (current) {
        current.count += 1;
      } else {
        counts.set(tag, { count: 1, order: order++ });
      }
    }
  }

  return [...counts.entries()]
    .sort(
      (left, right) =>
        right[1].count - left[1].count || left[1].order - right[1].order
    )
    .slice(0, Math.max(0, limit))
    .map(([tag]) => tag);
}

/** エイリアス → 正規タグ（エイリアステーブルは data.json の tagAliases） */
export function canonicalTag(
  tag: string,
  aliases: Record<string, string[]>
): string {
  for (const [canonical, list] of Object.entries(aliases)) {
    if (list.includes(tag)) {
      return canonical;
    }
  }
  return tag;
}

/** タグ配列を正規化（エイリアス→正規タグ・重複除去・空除去） */
export function canonicalizeTags(
  tags: string[],
  aliases: Record<string, string[]>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = canonicalTag(normalizeTagInput(raw), aliases);
    if (tag.length === 0 || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** 追加タグをマージ（既存 + 追加・正規化済み） */
export function mergeTags(
  existing: string[],
  added: string[],
  aliases: Record<string, string[]>
): string[] {
  return canonicalizeTags([...existing, ...added], aliases);
}

/** 配列のtoggle（あれば除く・なければ追加） */
export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * タグサジェスト（1文字入力から・読み正規化でゆれ吸収）
 * @param query 入力文字列（例: 「てっく」「ai」「じんこう」）
 * @param knownTags 既存タグ（使用頻度順）
 * @param aliases エイリアステーブル
 * @param limit 候補数
 */
export function suggestTags(
  query: string,
  knownTags: string[],
  aliases: Record<string, string[]> = {},
  limit = 8
): string[] {
  const q = normalizeSearchText(query);
  if (q.length === 0) {
    return [];
  }
  const scored = new Map<string, { score: number; order: number }>();
  const consider = (
    candidate: string,
    matchText: string,
    order: number
  ): void => {
    const norm = normalizeSearchText(matchText);
    if (norm.length === 0) {
      return;
    }
    let score = 0;
    if (norm === q) {
      score = 3;
    } else if (norm.startsWith(q)) {
      score = 2;
    } else if (norm.includes(q)) {
      score = 1;
    }
    if (score === 0) {
      return;
    }
    const existing = scored.get(candidate);
    if (!existing || score > existing.score) {
      scored.set(candidate, {
        order: existing ? Math.min(existing.order, order) : order,
        score,
      });
    }
  };
  knownTags.forEach((tag, i) => {
    consider(tag, tag, i);
  });
  for (const [canonical, list] of Object.entries(aliases)) {
    list.forEach((alias, i) => {
      const order = knownTags.length + i;
      consider(canonical, canonical, order);
      consider(canonical, alias, order);
    });
  }
  return [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order)
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * ノートに対するタグ候補（ルールベース: タイトル+本文に現れる既存タグを優先）
 * 「テック/AI」のような階層タグはセグメント（/ 区切り）単位でマッチさせる。
 * 整理画面などのタグ候補に使う純粋な頻度集計。
 * @param knownTags 既存タグ（使用頻度順）
 * @param limit 候補数
 */
export function suggestTagsForItem(
  item: IndexedItem,
  knownTags: string[],
  limit = 3
): string[] {
  const existing = new Set(item.item.tags ?? []);
  const hay = normalizeSearchText(`${item.title} ${item.body}`);
  const scored = knownTags
    .filter((tag) => !existing.has(tag))
    .map((tag, order) => {
      const norm = normalizeSearchText(tag);
      const segments = norm.split("/").filter((s) => s.length >= 2);
      const best = segments.reduce(
        (max, s) => (hay.includes(s) ? Math.max(max, s.length) : max),
        0
      );
      return { best, order, tag };
    })
    .filter((s) => s.best > 0);
  if (scored.length === 0) {
    return knownTags.filter((tag) => !existing.has(tag)).slice(0, limit);
  }
  scored.sort((a, b) => b.best - a.best || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.tag);
}
