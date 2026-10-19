/**
 * カバー画像抽出（spec: 決定49・表示形式カード — ノート内の最初の画像リンクをカバー表示）
 * 純関数・Obsidian非依存。
 */

export interface ExtractedImage {
  /** 内部リンク（![[file.png]]）か URL（![alt](url)）か */
  kind: "link" | "url";
  /** リンク先（内部リンクはファイル名 or パス・URLはそのまま） */
  value: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)([?#].*)?$/i;

const IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)|!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** 本文の最初の画像リンクを抽出（内部リンクは拡張子で画像か判定） */
export function extractFirstImage(body: string): ExtractedImage | null {
  IMAGE_RE.lastIndex = 0;
  const m = IMAGE_RE.exec(body);
  if (!m) {
    return null;
  }
  if (m[1] !== undefined) {
    const value = m[1].trim();
    if (value.length > 0) {
      return { kind: "url", value };
    }
    return null;
  }
  if (m[2] !== undefined) {
    const value = m[2].trim();
    if (value.length > 0 && IMAGE_EXT_RE.test(value)) {
      return { kind: "link", value };
    }
    return null;
  }
  return null;
}
