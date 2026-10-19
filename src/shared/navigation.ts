import {
  VIEW_TYPE_BOOKSHELF,
  VIEW_TYPE_CREATE,
  VIEW_TYPE_HOME,
  VIEW_TYPE_LIBRARY,
  VIEW_TYPE_MEMO_REVIEW,
  VIEW_TYPE_ORGANIZE,
  VIEW_TYPE_SEARCH,
} from "./constants";

export type SeitonDestination =
  | "home"
  | "search"
  | "library"
  | "organize"
  | "memoReview"
  | "bookshelf"
  | "create";

export const VIEW_TYPE_BY_DESTINATION = Object.fromEntries([
  ["home", VIEW_TYPE_HOME],
  ["search", VIEW_TYPE_SEARCH],
  ["library", VIEW_TYPE_LIBRARY],
  ["organize", VIEW_TYPE_ORGANIZE],
  ["memoReview", VIEW_TYPE_MEMO_REVIEW],
  ["bookshelf", VIEW_TYPE_BOOKSHELF],
  ["create", VIEW_TYPE_CREATE],
]) as Record<SeitonDestination, string>;

/** 全画面が共有する小さなnavigation interface。 */
export interface SeitonNavigationOptions {
  createPresetId?: string;
  createType?: import("./types").ItemType;
  libraryList?: string;
}

export interface SeitonNavigator {
  open: (
    destination: SeitonDestination,
    options?: SeitonNavigationOptions
  ) => Promise<void>;
}
