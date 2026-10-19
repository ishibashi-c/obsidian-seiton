/**
 * Keep Escape inside Seiton's React surface after its local handlers have run.
 * Obsidian also handles Escape at the workspace level, which can unexpectedly
 * navigate away from a Seiton view when focus is not inside a native control.
 */
export function stopEscapeFromReachingObsidian(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
  }
}
