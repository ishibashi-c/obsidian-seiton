import { describe, expect, it, vi } from "vitest";
import { stopEscapeFromReachingObsidian } from "../src/ui/escapeBoundary";

describe("stopEscapeFromReachingObsidian", () => {
  it("stops Escape after local React handlers have run", () => {
    const event = {
      key: "Escape",
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    stopEscapeFromReachingObsidian(event);

    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it("does not interfere with other keyboard events", () => {
    const event = {
      key: "Enter",
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    stopEscapeFromReachingObsidian(event);

    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
