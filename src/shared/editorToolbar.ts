/** Pure Markdown transformations used by the selection toolbar. */

export function toggleDelimitedText(text: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapped = new RegExp(`^${escaped}([\\s\\S]+)${escaped}$`);
  const match = text.match(wrapped);
  return match ? match[1] : `${marker}${text}${marker}`;
}

export function highlightText(text: string, color: string): string {
  return `<mark style="background: ${color};">${withoutHighlightSyntax(text)}</mark>`;
}

export function removeHighlightText(text: string): string {
  return withoutHighlightSyntax(text);
}

function withoutHighlightSyntax(text: string): string {
  return text
    .replace(/<mark(?:\s[^>]*)?>/gi, "")
    .replace(/<\/mark>/gi, "")
    .replace(/^==([\s\S]*)==$/, "$1");
}

export function toggleHeadingLine(line: string, level: number): string {
  const content = line.replace(/^#{1,6}\s+/, "");
  const prefix = `${"#".repeat(Math.max(1, Math.min(6, level)))} `;
  return line.startsWith(prefix) ? content : `${prefix}${content}`;
}

export function clearHeadingLine(line: string): string {
  return line.replace(/^#{1,6}\s+/, "");
}
