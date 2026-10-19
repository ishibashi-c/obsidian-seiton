export type ReactDestination =
  | "home"
  | "search"
  | "library"
  | "organize"
  | "memoReview"
  | "bookshelf"
  | "create";

/** Convert UI identifiers into registered Obsidian view destinations. */
export function destinationFromUiId(value: string): ReactDestination | null {
  if (value === "memo") {
    return "memoReview";
  }
  return [
    "home",
    "search",
    "library",
    "organize",
    "memoReview",
    "bookshelf",
    "create",
  ].includes(value)
    ? (value as ReactDestination)
    : null;
}
