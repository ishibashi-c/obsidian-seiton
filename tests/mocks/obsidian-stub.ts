/**
 * vitest用の最小Obsidianスタブ（requestUrlのみ）
 * ユニットテストは純関数を対象とするため、ネットワーク系は呼ばれない想定。
 * 呼ばれた場合は明示的に失敗させる（結合テストは層2/3で実施）。
 */
export async function requestUrl(_options: unknown): Promise<never> {
  throw new Error(
    "requestUrl called in unit test — use integration tests instead"
  );
}

export const Notice = class {
  constructor(public message: string) {}
};

export const TFile = class {};

export class TFolder {
  children: unknown[] = [];

  constructor(public path = "") {}

  get parent(): { path: string } | null {
    const slash = this.path.lastIndexOf("/");
    return slash < 0 ? null : { path: this.path.slice(0, slash) };
  }
}
