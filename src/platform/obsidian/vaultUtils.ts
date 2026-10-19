import type { Vault } from "obsidian";
import { normalizeFolder } from "../../shared/paths";

/** Obsidian Vault APIの再帰作成を補う。既存フォルダはそのまま使う。 */
export async function ensureFolder(vault: Vault, path: string): Promise<void> {
  let current = "";
  for (const part of normalizeFolder(path).split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current);
    }
  }
}
