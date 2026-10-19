/**
 * つぶやき月ファイルのパース・編集（純関数・Obsidian非依存）
 * 形式（spec: 決定9・43・79・80）:
 *   ---
 *   type: memo
 *   month: 2026-08
 *   ---
 *   ## 2026-08-15        ← 日見出し（任意・今日ビュー/期間抽出用）
 *   - 08:06 内容 #タグ
 *
 * 日見出しは仕様の行内タグ形式を保ったまま期間抽出（今日/今週/今月）を
 * 可能にするための拡張。日見出しがないレガシーファイルもパース可能。
 */

import { isInPeriod, parseDayKey, parseTime } from "./date";
import { parseFrontmatter } from "./frontmatter";
import type { MemoLine, MemoPeriod, MonthBodyLine, MonthFile } from "./types";

const HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const MEMO_RE = /^\s*-\s+(\d{1,2}:\d{2})\s+(.+)$/;
const TAG_RE = /(?:^|\s)#([^\s#]+)/g;

/** 1行のつぶやき行をパース（タグは行内 `#タグ` から抽出） */
export function parseMemoLine(line: string): MemoLine | null {
  const m = MEMO_RE.exec(line);
  if (!m) {
    return null;
  }
  const time = m[1];
  const rest = m[2];
  const tags: string[] = [];
  const content = rest
    .replace(TAG_RE, (_full, tag: string) => {
      tags.push(tag);
      return "";
    })
    .trim();
  if (content.length === 0) {
    return null;
  }
  return { content, tags, time };
}

/** つぶやき行の生成（保存時） */
export function formatMemoLine(
  time: string,
  content: string,
  tags: string[] = []
): string {
  const tagPart =
    tags.length > 0 ? ` ${tags.map((t) => `#${t}`).join(" ")}` : "";
  return `- ${time} ${content}${tagPart}`;
}

/** 月ファイル全体をパース（frontmatter + 本文行） */
export function parseMonthFile(content: string): MonthFile | null {
  const fm = parseFrontmatter(content);
  if (!fm) {
    return null;
  }
  const data = fm.data;
  if (data.type !== "memo") {
    return null;
  }
  const month = typeof data.month === "string" ? data.month : "";
  const lines: MonthBodyLine[] = [];
  let currentDay: string | null = null;
  for (const raw of fm.body.split("\n")) {
    const h = HEADING_RE.exec(raw);
    if (h) {
      if (!parseDayKey(h[1])) {
        lines.push({ kind: "other", raw });
        continue;
      }
      currentDay = h[1];
      lines.push({ day: h[1], kind: "heading", raw });
      continue;
    }
    const memo = parseMemoLine(raw);
    if (memo) {
      lines.push({ day: currentDay, kind: "memo", ...memo, raw });
      continue;
    }
    if (raw.trim().length === 0) {
      continue;
    }
    lines.push({ kind: "other", raw });
  }
  return { lines, month };
}

/** 月ファイルのつぶやき一覧（day付き・表示用） */
export interface MemoEntry extends MemoLine {
  /** 日キー YYYY-MM-DD（日見出しがない場合は null） */
  day: string | null;
  /** 本文行のインデックス（編集・削除用） */
  lineIndex: number;
  /** 月キー */
  month: string;
}

/** 月ファイルからつぶやきエントリを抽出 */
export function listMemos(file: MonthFile): MemoEntry[] {
  const result: MemoEntry[] = [];
  file.lines.forEach((line, i) => {
    if (line.kind !== "memo") {
      return;
    }
    result.push({
      content: line.content,
      day: line.day,
      lineIndex: i,
      month: file.month,
      tags: [...line.tags],
      time: line.time,
    });
  });
  return result;
}

/** 期間で抽出（最新が上） */
export function extractMemos(
  file: MonthFile,
  ref: Date,
  period: MemoPeriod
): MemoEntry[] {
  return extractMemosAcross([file], ref, period);
}

/** 複数月ファイルを横断して期間抽出（最新が上・週が月をまたぐ場合に対応） */
export function extractMemosAcross(
  files: MonthFile[],
  ref: Date,
  period: MemoPeriod
): MemoEntry[] {
  return files
    .flatMap((f) => listMemos(f))
    .filter((m) => m.day !== null && isInPeriod(m.day as string, ref, period))
    .sort((a, b) => {
      if (a.day !== b.day) {
        return (b.day ?? "") < (a.day ?? "") ? -1 : 1;
      }
      return b.time < a.time ? -1 : b.time > a.time ? 1 : 0;
    });
}

/** つぶやきのファイル先頭部分（frontmatter）を生成 */
export function buildMonthFrontmatter(month: string): string {
  return `---\ntype: memo\nmonth: ${month}\n---\n`;
}

/** つぶやき行の末尾を「日付キー + 時刻」にする（時刻の整合チェック） */
function validTime(time: string): boolean {
  return parseTime(time) !== null;
}

/** 本文行の文字列表現（ラウンドトリップ） */
function lineToRaw(line: MonthBodyLine): string {
  if (line.kind === "memo") {
    return formatMemoLine(line.time, line.content, line.tags);
  }
  return line.raw;
}

/** 月ファイル本文を文字列化 */
export function serializeMonthBody(lines: MonthBodyLine[]): string {
  return lines.map(lineToRaw).join("\n");
}

/** 追記: 当日の日見出しがなければ作成し、その下に追記（先頭追記はしない） */
export function appendMemo(
  content: string,
  day: string,
  time: string,
  text: string,
  tags: string[] = []
): string {
  const file = parseMonthFile(content) ?? {
    lines: [],
    month: day.slice(0, 7),
  };
  if (!validTime(time)) {
    return content;
  }
  const body = file.lines;
  const headingIdx = body.findIndex(
    (l) => l.kind === "heading" && l.day === day
  );
  const newLine: MonthBodyLine = {
    content: text,
    day,
    kind: "memo",
    raw: "",
    tags: [...tags],
    time,
  };
  if (headingIdx >= 0) {
    let insertAt = headingIdx + 1;
    while (insertAt < body.length && body[insertAt].kind !== "heading") {
      insertAt++;
    }
    body.splice(insertAt, 0, newLine);
  } else {
    body.push({ day, kind: "heading", raw: `## ${day}` }, newLine);
  }
  const head = serializeMonthBody(body);
  return (
    buildMonthFrontmatter(file.month) + (head.length > 0 ? `${head}\n` : "")
  );
}

/** 編集: 内容+日時+タグ（日時変更で別の日のブロックへ移動） */
export function updateMemo(
  content: string,
  lineIndex: number,
  next: { day: string; time: string; text: string; tags: string[] }
): string {
  const file = parseMonthFile(content);
  if (!file) {
    return content;
  }
  if (!validTime(next.time)) {
    return content;
  }
  const body = file.lines;
  const line = body[lineIndex];
  if (line?.kind !== "memo") {
    return content;
  }
  body.splice(lineIndex, 1);
  const updated: MonthBodyLine = {
    content: next.text,
    day: next.day,
    kind: "memo",
    raw: "",
    tags: [...next.tags],
    time: next.time,
  };
  if (next.day === line.day) {
    body.splice(lineIndex, 0, updated);
  } else {
    const headingIdx = body.findIndex(
      (l) => l.kind === "heading" && l.day === next.day
    );
    if (headingIdx >= 0) {
      let insertAt = headingIdx + 1;
      while (insertAt < body.length && body[insertAt].kind !== "heading") {
        insertAt++;
      }
      body.splice(insertAt, 0, updated);
    } else {
      body.push(
        { day: next.day, kind: "heading", raw: `## ${next.day}` },
        updated
      );
    }
  }
  cleanEmptyHeadings(body);
  const head = serializeMonthBody(body);
  return (
    buildMonthFrontmatter(file.month) + (head.length > 0 ? `${head}\n` : "")
  );
}

/** 削除: 空になった日見出しも除去 */
export function removeMemo(content: string, lineIndex: number): string {
  const file = parseMonthFile(content);
  if (!file) {
    return content;
  }
  const body = file.lines;
  const line = body[lineIndex];
  if (line?.kind !== "memo") {
    return content;
  }
  body.splice(lineIndex, 1);
  cleanEmptyHeadings(body);
  const head = serializeMonthBody(body);
  return (
    buildMonthFrontmatter(file.month) + (head.length > 0 ? `${head}\n` : "")
  );
}

/** つぶやきが1件もない日見出しを除去 */
function cleanEmptyHeadings(body: MonthBodyLine[]): void {
  const target = body.findIndex((l) => l.kind === "heading");
  if (target < 0) {
    return;
  }
  const candidates: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i].kind !== "heading") {
      continue;
    }
    let hasMemo = false;
    let j = i + 1;
    while (j < body.length && body[j].kind !== "heading") {
      if (body[j].kind === "memo") {
        hasMemo = true;
      }
      if (body[j].kind === "other") {
        hasMemo = true;
      }
      j++;
    }
    if (!hasMemo) {
      candidates.push(i);
    }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    body.splice(candidates[i], 1);
  }
}
