/**
 * tagAliasesテキスト（1行=「正規タグ: エイリアス1, エイリアス2」）をパース
 * 不正行は無視。空行OK。コメント(#)は値の一部として扱わない（タグに#は含まれないため単純にトリム）
 */
export function parseTagAliasesInput(raw: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const sep = trimmed.indexOf(":");
    if (sep <= 0) {
      continue;
    }
    const canonical = trimmed.slice(0, sep).trim().replace(/^#+/, "");
    const aliases = trimmed
      .slice(sep + 1)
      .split(",")
      .map((a) => a.trim().replace(/^#+/, ""))
      .filter((a) => a.length > 0);
    if (canonical.length === 0 || aliases.length === 0) {
      continue;
    }
    out[canonical] = aliases;
  }
  return out;
}

/** tagAliasesをテキストへ逆変換（設定UIの初期値） */
export function stringifyTagAliases(aliases: Record<string, string[]>): string {
  return Object.entries(aliases)
    .map(([canonical, list]) => `${canonical}: ${list.join(", ")}`)
    .join("\n");
}

/**
 * カンマ区切り入力 → パス配列（トリム・空除去・重複除去・先頭/末尾のスラッシュ除去）
 * richCardFolders等で使用
 */
export function parsePathList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const p = part.trim().replace(/^\/+|\/+$/g, "");
    if (p.length === 0 || seen.has(p)) {
      continue;
    }
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** 数値入力の安全なパース（NaN/負値ならデフォルトへフォールバック） */
export function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** 設定画面の検索語と表示テキストを比較するための正規化。 */
export function normalizeSettingsSearchText(raw: string): string {
  return raw.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/** 設定画面内検索が表示テキストに一致するか判定する。 */
export function settingsSearchMatches(query: string, text: string): boolean {
  const normalizedQuery = normalizeSettingsSearchText(query);
  return (
    normalizedQuery.length === 0 ||
    normalizeSettingsSearchText(text).includes(normalizedQuery)
  );
}
