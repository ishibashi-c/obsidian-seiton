/**
 * ファイル名サニタイズ（spec: ファイル命名規則）
 * `/ \ : * ? " < > |` を除去・重複時は「タイトル 2」の連番（呼び出し側で管理）
 */
export function sanitizeFilename(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "").trim();
}

/** 空になった場合のフォールバック */
export function safeFilename(title: string, fallback = "Untitled"): string {
  const s = sanitizeFilename(title);
  return s.length > 0 ? s : fallback;
}

/** 既知の2ラベルTLD（co.jp等）→ 第3レベルまで取る */
const TWO_LABEL_TLDS = new Set([
  "co.jp",
  "ne.jp",
  "or.jp",
  "com.au",
  "co.uk",
  "org.uk",
  "com.br",
  "co.kr",
  "com.tw",
  "com.cn",
  "com.hk",
  "com.sg",
  "co.in",
  "com.mx",
]);

/** ドメイン抽出（メインドメインのみ・wwwとサブドメインは省略） */
export function extractMainDomain(url: string): string | null {
  try {
    let host = new URL(url).hostname;
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    const parts = host.split(".");
    if (parts.length <= 2) {
      return host;
    }
    const last2 = parts.slice(-2).join(".");
    // co.jp のような2ラベルTLDは第3レベルまで（news.yahoo.co.jp → yahoo.co.jp）
    if (TWO_LABEL_TLDS.has(last2)) {
      return parts.slice(-3).join(".");
    }
    return last2;
  } catch {
    return null;
  }
}
