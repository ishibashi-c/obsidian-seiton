/**
 * frontmatter パース/シリアライズ + 収集物スキーマ検証。
 *
 * 決定83: 読み取りは Obsidian `parseYaml`（エッジケースの処理を内蔵実装に任せる）。
 * 書き込みは自前シリアライザ（フロー配列・決定済みのキー順を保つ）。
 * テストでは parseYaml のモック（harness/mocks/obsidian.ts と同等の挙動）を使うため、
 * このモジュールは YAML パーサーを注入可能にしている。
 */

import { ITEM_TYPES } from "./constants";
import type { ItemStatus, ItemType, SeitonItem } from "./types";

/** YAMLパーサーの型（Obsidian parseYaml と互換） */
export type YamlParser = (yaml: string) => unknown;

/** 既定のパーサー（main.ts / ハーネスで setYamlParser される） */
let yamlParser: YamlParser = (_yaml) => {
  throw new Error("YAML parser not initialized: call setYamlParser() first");
};

/** YAMLパーサーを注入する（プラグイン起動時・テストのセットアップで呼ぶ） */
export function setYamlParser(parser: YamlParser): void {
  yamlParser = parser;
}

/** パース結果 */
export interface FrontmatterResult {
  /** frontmatterを除いた本文 */
  body: string;
  /** frontmatterのキーと値（順序保持） */
  data: Record<string, unknown>;
}

/** YAML エスケープが必要な文字 */
function needsQuote(s: string): boolean {
  return /^[\s[\]#:]|[:#]$|^["'\-?]|\s$/.test(s) || /[:#[\]]/.test(s);
}

/** 値をYAML文字列化（配列はフロー形式） */
export function serializeYamlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serializeYamlValue(v)).join(", ")}]`;
  }
  const s = String(value);
  if (needsQuote(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** frontmatter 本文（--- 囲みなし）のシリアライズ。undefined と空配列は省略可 */
export function serializeFrontmatter(
  data: Record<string, unknown>,
  opts: { skipEmptyArrays?: boolean } = {}
): string {
  const skipEmpty = opts.skipEmptyArrays ?? true;
  const lines: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) {
      continue;
    }
    if (Array.isArray(v) && v.length === 0 && skipEmpty) {
      continue;
    }
    lines.push(`${k}: ${serializeYamlValue(v)}`);
  }
  return lines.join("\n");
}

/** frontmatter をパース（frontmatter がない場合は null）。解析は注入された parseYaml に委譲 */
export function parseFrontmatter(content: string): FrontmatterResult | null {
  const lines = content.split("\n");
  if (lines.length < 3 || lines[0].trim() !== "---") {
    return null;
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  if (endIdx < 0) {
    return null;
  }
  const raw = lines.slice(1, endIdx).join("\n");
  const body = lines.slice(endIdx + 1).join("\n");
  let parsed: unknown;
  try {
    parsed = yamlParser(raw);
  } catch {
    return null;
  }
  if (parsed === null || parsed === undefined || typeof parsed !== "object") {
    return { body, data: {} };
  }
  return { body, data: parsed as Record<string, unknown> };
}

const ITEM_STATUSES: ItemStatus[] = ["inbox", "active", "archive"];

/** 配列化（文字列1つ or 配列 → 文字列配列） */
function toStrArray(v: unknown): string[] | null {
  if (v === undefined || v === null) {
    return [];
  }
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string");
  }
  if (typeof v === "string") {
    return [v];
  }
  return null;
}

/** スキーマ検証（spec 3章の共通スキーマ） */
export function validateItem(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const type = data.type;
  if (typeof type !== "string" || !ITEM_TYPES.includes(type as ItemType)) {
    errors.push(`type: 不正 (${String(type)})`);
  }
  const status = data.status;
  if (
    typeof status !== "string" ||
    !ITEM_STATUSES.includes(status as ItemStatus)
  ) {
    errors.push(`status: 不正 (${String(status)})`);
  }
  const created = data.created;
  if (typeof created !== "string" || created.length === 0) {
    errors.push("created: 必須（ISO8601）");
  }
  for (const key of ["tags", "sourceTags", "baseTags", "lists"]) {
    const v = data[key];
    if (v === undefined || v === null) {
      continue;
    }
    if (!(Array.isArray(v) && v.every((x) => typeof x === "string"))) {
      errors.push(`${key}: 文字列の配列であるべき`);
    }
  }
  return errors;
}

/** 本文のパース（frontmatter + タイトル + 本文） */
export function parseItem(
  content: string,
  path: string
): { item: SeitonItem | null; errors: string[]; body: string; title: string } {
  const title = path.split("/").pop()?.replace(/\.md$/, "") ?? "";
  const fm = parseFrontmatter(content);
  const body = fm ? fm.body : content;
  if (!fm) {
    return { body, errors: ["frontmatter: なし"], item: null, title };
  }
  const data = fm.data;
  const errors = validateItem(data);
  if (errors.length > 0) {
    return { body, errors, item: null, title };
  }
  const item: SeitonItem = {
    created: String(data.created),
    status: data.status as ItemStatus,
    type: data.type as ItemType,
  };
  for (const key of ["tags", "lists"] as const) {
    const arr = toStrArray(data[key]);
    if (arr) {
      item[key] = arr;
    }
  }
  const sourceTags = toStrArray(data.sourceTags ?? data.baseTags);
  if (sourceTags) {
    item.sourceTags = sourceTags;
  }
  if (typeof data.source === "string" && data.source.length > 0) {
    item.source = data.source;
  }
  // 拡張キー（spec §6B 本棚等）を unknown として保持する。
  // parseItemは共通スキーマのみ型付けし、プラグイン内拡張キーは落とさない。
  const knownKeys = new Set([
    "type",
    "status",
    "created",
    "tags",
    "sourceTags",
    "baseTags",
    "lists",
    "source",
  ]);
  for (const [key, value] of Object.entries(data)) {
    if (!knownKeys.has(key)) {
      item[key] = value;
    }
  }
  return { body, errors: [], item, title };
}

/**
 * 収集物のfrontmatter文字列を生成（共通スキーマ・一貫形式・--- 囲みなし。
 * ファイル書き込み時は呼び出し側で `---\n${fm}\n---` と囲む）
 */
export function formatItemFrontmatter(item: SeitonItem): string {
  const data: Record<string, unknown> = {
    created: item.created,
    lists: item.lists ?? [],
    sourceTags: item.sourceTags ?? [],
    status: item.status,
    tags: item.tags ?? [],
    type: item.type,
  };
  if (item.source) {
    data.source = item.source;
  }
  return serializeFrontmatter(data, { skipEmptyArrays: false });
}

/**
 * frontmatter を部分的に書き換えた全文を返す（frontmatter がない場合は null）
 * タグ付け・アーカイブ・type変更などの論理的な変更はこの関数で行う（AIファースト）。
 */
export function rewriteFrontmatter(
  content: string,
  patch: Record<string, unknown>
): string | null {
  const fm = parseFrontmatter(content);
  if (!fm) {
    return null;
  }
  const data = { ...fm.data, ...patch };
  if (!("sourceTags" in data) && "baseTags" in data) {
    data.sourceTags = data.baseTags;
  }
  data.baseTags = undefined;
  return `---\n${serializeFrontmatter(data, { skipEmptyArrays: false })}\n---\n${fm.body}`;
}
