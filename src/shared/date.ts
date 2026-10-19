/**
 * 日付ヘルパー（純関数・Obsidian非依存でテスト可能）
 * date-fns を使った月ファイル（YYYY-MM）・日見出し（YYYY-MM-DD）・時刻（HH:MM）の操作。
 * 決定83: 自前実装の代わりに date-fns を利用する。
 */

import { isValid } from "date-fns";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** YYYY-MM の月キー */
export function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** YYYY-MM-DD の日キー */
export function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** HH:MM の時刻 */
export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** YYYY-MM-DD をパース（実在しない日付は null） */
export function parseDayKey(key: string): Date | null {
  const m = DAY_KEY_RE.exec(key);
  if (!m) {
    return null;
  }
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // オーバーフロー（2026-02-30 等）を検出
  if (!isValid(date)) {
    return null;
  }
  if (
    date.getFullYear() !== Number(m[1]) ||
    date.getMonth() !== Number(m[2]) - 1 ||
    date.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return date;
}

/** HH:MM をパース（不正なら null） */
export function parseTime(time: string): { h: number; m: number } | null {
  const match = TIME_RE.exec(time);
  if (!match) {
    return null;
  }
  const h = Number(match[1]);
  const mi = Number(match[2]);
  if (h > 23 || mi > 59) {
    return null;
  }
  return { h, m: mi };
}

/** 月曜始まりの週 */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dow);
  return r;
}

/** 期間の開始日キー（含む） */
export function periodStartKey(
  d: Date,
  period: "today" | "week" | "month"
): string {
  if (period === "today") {
    return formatDayKey(d);
  }
  if (period === "week") {
    return formatDayKey(startOfWeek(d));
  }
  return `${formatMonthKey(d)}-01`;
}

/** 期間の終了日キー（含む） */
export function periodEndKey(
  d: Date,
  period: "today" | "week" | "month"
): string {
  if (period === "today") {
    return formatDayKey(d);
  }
  if (period === "week") {
    const s = startOfWeek(d);
    s.setDate(s.getDate() + 6);
    return formatDayKey(s);
  }
  return formatDayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** 日キーが期間内か */
export function isInPeriod(
  dayKey: string,
  d: Date,
  period: "today" | "week" | "month"
): boolean {
  const start = periodStartKey(d, period);
  const end = periodEndKey(d, period);
  return dayKey >= start && dayKey <= end;
}
