import { describe, expect, it } from "vitest";
import { formatDayKey, formatTime } from "../src/shared/date";
import {
  appendMemo,
  extractMemosAcross,
  formatMemoLine,
  parseMemoLine,
  parseMonthFile,
  removeMemo,
  serializeMonthBody,
  updateMemo,
} from "../src/shared/memoFile";

const MONTH_FILE = `---
type: memo
month: 2026-08
---
## 2026-08-19
- 08:06 階級がある国ではインフルエンサーってどの立ち位置なんだろう #疑問
- 22:14 discordの音声サーバーって住み分けかな
## 2026-08-20
- 10:12 SeitonのUI再構築を始めた #開発
`;

describe("parseMemoLine", () => {
  it("行内タグを抽出する", () => {
    const line = parseMemoLine("- 08:06 内容 #疑問 #開発");
    expect(line).toEqual({
      content: "内容",
      tags: ["疑問", "開発"],
      time: "08:06",
    });
  });

  it("タグなし行をパースする", () => {
    expect(parseMemoLine("- 22:14 タグなし")).toEqual({
      content: "タグなし",
      tags: [],
      time: "22:14",
    });
  });

  it("つぶやき行以外はnull", () => {
    expect(parseMemoLine("## 2026-08-19")).toBeNull();
    expect(parseMemoLine("- 空行ではないが時刻がない")).toBeNull();
  });
});

describe("parseMonthFile", () => {
  it("日見出しとメモ行をパースする", () => {
    const file = parseMonthFile(MONTH_FILE);
    expect(file?.month).toBe("2026-08");
    expect(file?.lines.filter((l) => l.kind === "memo")).toHaveLength(3);
    const first = file?.lines.find((l) => l.kind === "memo");
    expect(first && first.kind === "memo" && first.day).toBe("2026-08-19");
  });
});

describe("appendMemo", () => {
  it("当日の見出しの下に追記する", () => {
    const next = appendMemo(MONTH_FILE, "2026-08-20", "23:00", "追記テスト");
    const file = parseMonthFile(next);
    const memos = file?.lines.filter((l) => l.kind === "memo");
    expect(memos?.at(-1)).toMatchObject({
      content: "追記テスト",
      day: "2026-08-20",
      time: "23:00",
    });
  });

  it("作成時に指定したタグを行末へ保存する", () => {
    const next = appendMemo(MONTH_FILE, "2026-08-20", "23:30", "授業メモ", [
      "学習/講義",
      "学習テーマ",
    ]);
    expect(next).toContain("- 23:30 授業メモ #学習/講義 #学習テーマ");
  });

  it("新しい日は見出しごと追加する", () => {
    const next = appendMemo(MONTH_FILE, "2026-08-21", "09:00", "新しい日");
    expect(next).toContain("## 2026-08-21");
    expect(next.endsWith("- 09:00 新しい日\n")).toBe(true);
  });

  it("不正な時刻は変更しない", () => {
    expect(appendMemo(MONTH_FILE, "2026-08-20", "25:00", "x")).toBe(MONTH_FILE);
  });
});

describe("updateMemo / removeMemo", () => {
  it("内容とタグを編集できる", () => {
    const next = updateMemo(MONTH_FILE, 1, {
      day: "2026-08-19",
      tags: ["更新"],
      text: "編集後",
      time: "08:30",
    });
    expect(next).toContain("- 08:30 編集後 #更新");
  });

  it("日をまたぐ編集で移動する", () => {
    const next = updateMemo(MONTH_FILE, 1, {
      day: "2026-08-21",
      tags: [],
      text: "移動後",
      time: "08:30",
    });
    expect(next).toContain("## 2026-08-21");
    expect(next).toContain("- 08:30 移動後");
  });

  it("削除で空見出しも消える", () => {
    // 08-19の2件のメモを削除（lineIndex 1と、削除後の1）
    let next = removeMemo(MONTH_FILE, 1);
    next = removeMemo(next, 1);
    expect(next).not.toContain("## 2026-08-19");
    expect(next).toContain("## 2026-08-20");
    expect(next).toContain("- 10:12 SeitonのUI再構築を始めた #開発");
  });
});

describe("extractMemosAcross", () => {
  const file = parseMonthFile(MONTH_FILE);
  if (!file) {
    throw new Error("Expected month fixture to parse");
  }
  const ref = new Date(2026, 7, 20);

  it("今日だけ抽出（最新が上）", () => {
    const memos = extractMemosAcross([file], ref, "today");
    expect(memos.map((m) => m.time)).toEqual(["10:12"]);
  });

  it("今週は月をまたいでも抽出できる", () => {
    const memos = extractMemosAcross([file], new Date(2026, 7, 19), "week");
    expect(memos.length).toBeGreaterThanOrEqual(2);
  });

  it("今月は全部", () => {
    expect(extractMemosAcross([file], ref, "month")).toHaveLength(3);
  });
});

describe("ラウンドトリップ", () => {
  it("serialize→parseで同じ行が得られる", () => {
    const file = parseMonthFile(MONTH_FILE);
    if (!file) {
      throw new Error("Expected month fixture to parse");
    }
    const serialized = serializeMonthBody(file.lines);
    const reparsed = parseMonthFile(
      `---\ntype: memo\nmonth: 2026-08\n---\n${serialized}\n`
    );
    expect(reparsed?.lines).toEqual(file.lines);
  });

  it("formatMemoLine は parseMemoLine で戻る", () => {
    const raw = formatMemoLine("12:34", "内容", ["a", "b"]);
    expect(parseMemoLine(raw)).toEqual({
      content: "内容",
      tags: ["a", "b"],
      time: "12:34",
    });
  });
});

describe("date ヘルパーとの整合", () => {
  it("formatDayKey/formatTime の形式がそのまま使える", () => {
    const d = new Date(2026, 7, 21, 9, 5);
    expect(formatDayKey(d)).toBe("2026-08-21");
    expect(formatTime(d)).toBe("09:05");
  });
});
