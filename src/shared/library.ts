import type { IndexedItem, LibrarySort } from "./types";

export interface LibraryPathItem {
  path: string;
}

export interface LibraryFolderOption {
  count: number;
  depth: number;
  name: string;
  path: string;
}

export interface FolderTreeNode<T extends { path: string }> {
  children: FolderTreeNode<T>[];
  name: string;
  option: T | null;
  path: string;
}

export interface LibraryArchiveContext {
  archived?: boolean;
  archiveState?: "context" | "legacy" | "note";
  contextArchived?: boolean;
  legacyArchived?: boolean;
}

function normalizeVaultPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

/** パスが指定フォルダ自身または配下にあるかを、部分一致を避けて判定する。 */
export function isWithinFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizeVaultPath(path);
  const normalizedFolder = normalizeVaultPath(folder);
  return Boolean(
    normalizedFolder &&
      (normalizedPath === normalizedFolder ||
        normalizedPath.startsWith(`${normalizedFolder}/`))
  );
}

/** アーカイブされた文脈フォルダ配下にファイルがあるかを判定する。 */
export function isInArchivedContext(
  path: string,
  archivedFolders: readonly string[]
): boolean {
  return archivedFolders.some((folder) => isWithinFolder(path, folder));
}

/** Recalculate derived archive flags without losing a note's own legacy status. */
export function libraryItemWithArchiveContext<T extends LibraryArchiveContext>(
  item: T,
  contextArchived: boolean
): T {
  const legacyArchived = item.legacyArchived ?? item.archiveState === "legacy";
  const noteArchived = item.archiveState === "note";
  const archiveState = noteArchived
    ? "note"
    : contextArchived
      ? "context"
      : legacyArchived
        ? "legacy"
        : undefined;
  return {
    ...item,
    archived: noteArchived || contextArchived || legacyArchived,
    archiveState,
    contextArchived,
    legacyArchived,
  };
}

/** フォルダ名変更時に、完全一致または配下のパスだけを新しい場所へ置換する。 */
export function rewriteFolderPath(
  path: string,
  nextFolder: string,
  previousFolder: string
): string {
  const normalizedPath = normalizeVaultPath(path);
  const from = normalizeVaultPath(previousFolder);
  const to = normalizeVaultPath(nextFolder);
  if (!(from && to && isWithinFolder(normalizedPath, from))) {
    return path;
  }
  return `${to}${normalizedPath.slice(from.length)}`;
}

/** 未整理でもライブラリで再発見できるコンテンツだけを通す。 */
export function isVisibleLibraryItem(item: Pick<IndexedItem, "item">): boolean {
  return item.item.status !== "archive" && item.item.type !== "memo";
}

export function libraryFolderPath(path: string): string {
  const normalized = normalizeVaultPath(path);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

export function libraryFolderOptions(
  items: readonly LibraryPathItem[],
  existingFolders: readonly string[] = []
): LibraryFolderOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const folder = libraryFolderPath(item.path);
    if (!folder) {
      continue;
    }
    const segments = folder.split("/");
    for (let end = 1; end <= segments.length; end += 1) {
      const path = segments.slice(0, end).join("/");
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }

  for (const folder of existingFolders) {
    const normalized = normalizeVaultPath(folder);
    if (!normalized) {
      continue;
    }
    const segments = normalized.split("/");
    for (let end = 1; end <= segments.length; end += 1) {
      const path = segments.slice(0, end).join("/");
      if (!counts.has(path)) {
        counts.set(path, 0);
      }
    }
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([path, count]) => {
      const segments = path.split("/");
      return {
        count,
        depth: segments.length - 1,
        name: segments.at(-1) ?? path,
        path,
      };
    });
}

/** フォルダ選択肢を親子構造にし、入力にない中間階層も補う。 */
export function buildFolderTree<T extends { path: string }>(
  options: readonly T[]
): FolderTreeNode<T>[] {
  const roots: FolderTreeNode<T>[] = [];
  const nodes = new Map<string, FolderTreeNode<T>>();

  for (const option of options) {
    const path = normalizeVaultPath(option.path);
    if (!path) {
      continue;
    }
    const segments = path.split("/");
    let parent: FolderTreeNode<T> | null = null;
    for (let index = 0; index < segments.length; index += 1) {
      const nodePath = segments.slice(0, index + 1).join("/");
      let node = nodes.get(nodePath);
      if (!node) {
        node = {
          children: [],
          name: segments[index],
          option: null,
          path: nodePath,
        };
        nodes.set(nodePath, node);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
      parent = node;
    }
    const node = nodes.get(path);
    if (node) {
      node.option = option;
    }
  }

  const sortNodes = (siblings: FolderTreeNode<T>[]): void => {
    siblings.sort((left, right) => left.name.localeCompare(right.name, "ja"));
    for (const node of siblings) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

export function isInLibraryFolder(
  itemPath: string,
  selectedFolder: string
): boolean {
  if (!selectedFolder) {
    return true;
  }
  const folder = libraryFolderPath(itemPath);
  return folder === selectedFolder || folder.startsWith(`${selectedFolder}/`);
}

export function sortLibraryItems(
  items: IndexedItem[],
  key: LibrarySort
): IndexedItem[] {
  const sorted = [...items];
  switch (key) {
    case "created":
      return sorted.sort((a, b) =>
        b.item.created.localeCompare(a.item.created)
      );
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "ja"));
    case "type":
      return sorted.sort(
        (a, b) =>
          a.item.type.localeCompare(b.item.type) ||
          a.title.localeCompare(b.title, "ja")
      );
    default:
      return sorted.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
  }
}
