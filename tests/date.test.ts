import { describe, expect, it } from "vitest";
import {
  formatDayKey,
  formatMonthKey,
  formatTime,
  isInPeriod,
  parseDayKey,
  parseTime,
  periodEndKey,
  periodStartKey,
  startOfWeek,
} from "../src/shared/date";

describe("format/parse", () => {
  it("月・日・時刻のフォーマット", () => {
    const d = new Date(2026, 7, 5, 9, 5);
    expect(formatMonthKey(d)).toBe("2026-08");
    expect(formatDayKey(d)).toBe("2026-08-05");
    expect(formatTime(d)).toBe("09:05");
  });

  it("実在しない日はnull", () => {
    expect(parseDayKey("2026-02-30")).toBeNull();
    expect(parseDayKey("2026-13-01")).toBeNull();
    expect(parseDayKey("abc")).toBeNull();
  });

  it("実在する日はパースできる", () => {
    expect(parseDayKey("2026-08-21")).toEqual(new Date(2026, 7, 21));
  });

  it("時刻の境界", () => {
    expect(parseTime("23:59")).toEqual({ h: 23, m: 59 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("12:60")).toBeNull();
    expect(parseTime("9:5")).toBeNull();
  });
});

describe("週（月曜始まり）", () => {
  it("水曜→月曜", () => {
    expect(formatDayKey(startOfWeek(new Date(2026, 7, 19)))).toBe("2026-08-17");
  });

  it("日曜→同じ週の月曜", () => {
    expect(formatDayKey(startOfWeek(new Date(2026, 7, 23)))).toBe("2026-08-17");
  });
});

describe("期間の境界", () => {
  const ref = new Date(2026, 7, 19); // 水

  it("today", () => {
    expect(periodStartKey(ref, "today")).toBe("2026-08-19");
    expect(periodEndKey(ref, "today")).toBe("2026-08-19");
  });

  it("week（月〜日）", () => {
    expect(periodStartKey(ref, "week")).toBe("2026-08-17");
    expect(periodEndKey(ref, "week")).toBe("2026-08-23");
  });

  it("month（月末日を含む）", () => {
    expect(periodStartKey(ref, "month")).toBe("2026-08-01");
    expect(periodEndKey(ref, "month")).toBe("2026-08-31");
  });

  it("isInPeriod", () => {
    expect(isInPeriod("2026-08-19", ref, "today")).toBe(true);
    expect(isInPeriod("2026-08-18", ref, "today")).toBe(false);
    expect(isInPeriod("2026-08-17", ref, "week")).toBe(true);
    expect(isInPeriod("2026-08-16", ref, "week")).toBe(false);
  });

  it("週が月をまたぐ", () => {
    const sat = new Date(2026, 7, 1); // 土
    expect(periodStartKey(sat, "week")).toBe("2026-07-27");
    expect(isInPeriod("2026-07-28", sat, "week")).toBe(true);
  });
});
