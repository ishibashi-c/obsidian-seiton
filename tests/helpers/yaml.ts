/**
 * テスト用の簡易YAMLパーサー（Obsidian parseYaml のサブセット再現）
 * frontmatter.ts に注入して使う。
 */
export function testParseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  for (const line of lines) {
    const blockItem = /^\s*-\s+(.*)$/.exec(line);
    if (blockItem && currentKey) {
      const arr = result[currentKey];
      if (Array.isArray(arr)) {
        arr.push(parseScalar(blockItem[1]));
      }
      continue;
    }
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) {
      continue;
    }
    currentKey = m[1];
    const valueRaw = m[2].trim();
    if (valueRaw.startsWith("[") && valueRaw.endsWith("]")) {
      result[currentKey] = splitFlowList(valueRaw.slice(1, -1));
    } else if (valueRaw.length === 0) {
      result[currentKey] = [];
    } else {
      result[currentKey] = parseScalar(valueRaw);
    }
  }
  return result;
}

function splitFlowList(raw: string): string[] {
  const items: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const ch of raw) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ",") {
      items.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) {
    items.push(cur.trim());
  }
  return items;
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s.length === 0) {
    return "";
  }
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }
  if (s === "true") {
    return true;
  }
  if (s === "false") {
    return false;
  }
  if (s === "null" || s === "~") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return Number(s);
  }
  return s;
}
