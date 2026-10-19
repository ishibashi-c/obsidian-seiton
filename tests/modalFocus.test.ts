import { describe, expect, it } from "vitest";
import {
  getActiveElementWithinRoot,
  getModalInitialFocusTarget,
  getModalTabWrapTarget,
  isTopmostModal,
} from "../src/ui/primitives";

describe("modal focus root", () => {
  it("uses the ShadowRoot active element instead of the document host", () => {
    const trigger = {} as HTMLElement;
    const shadowRoot = { activeElement: trigger };
    const dialog = {
      getRootNode: () => shadowRoot,
    } as unknown as HTMLElement;

    expect(getActiveElementWithinRoot(dialog)).toBe(trigger);
  });

  it("does not wrap Tab from an active descendant inside a ShadowRoot", () => {
    const first = {} as HTMLElement;
    const active = {} as HTMLElement;
    const last = {} as HTMLElement;
    const shadowRoot = { activeElement: active };
    const dialog = {
      contains: (element: Element | null) =>
        element === first || element === active || element === last,
      getRootNode: () => shadowRoot,
    } as unknown as HTMLElement;

    expect(
      getModalTabWrapTarget(
        dialog,
        getActiveElementWithinRoot(dialog),
        first,
        last,
        false
      )
    ).toBeNull();
  });

  it("wraps only when Tab crosses a modal boundary", () => {
    const first = {} as HTMLElement;
    const last = {} as HTMLElement;
    const outside = {} as HTMLElement;
    const dialog = {
      contains: (element: Element | null) =>
        element === first || element === last,
    } as unknown as HTMLElement;

    expect(getModalTabWrapTarget(dialog, last, first, last, false)).toBe(first);
    expect(getModalTabWrapTarget(dialog, first, first, last, true)).toBe(last);
    expect(getModalTabWrapTarget(dialog, outside, first, last, false)).toBe(
      first
    );
    expect(getModalTabWrapTarget(dialog, outside, first, last, true)).toBe(
      last
    );
  });

  it("lets only the last open dialog in a root handle modal keys", () => {
    const root: {
      querySelectorAll: () => Pick<NodeListOf<HTMLElement>, "item" | "length">;
    } = {
      querySelectorAll: () => ({
        item: () => null as unknown as HTMLElement,
        length: 0,
      }),
    };
    const outerDialog = {
      getRootNode: () => root,
    } as unknown as HTMLElement;
    const innerDialog = {
      getRootNode: () => root,
    } as unknown as HTMLElement;
    root.querySelectorAll = () => ({
      item: (index) => [outerDialog, innerDialog][index] as HTMLElement,
      length: 2,
    });

    expect(isTopmostModal(outerDialog)).toBe(false);
    expect(isTopmostModal(innerDialog)).toBe(true);
  });

  it("focuses the explicitly marked control after a dialog view changes", () => {
    const autofocus = {} as HTMLElement;
    const dialog = {
      querySelector: (selector: string) =>
        selector === "[data-seiton-autofocus], [autofocus]" ? autofocus : null,
    } as unknown as HTMLElement;

    expect(getModalInitialFocusTarget(dialog)).toBe(autofocus);
  });

  it("uses the dialog itself when a view has no marked focus control", () => {
    const dialog = {
      querySelector: () => null,
    } as unknown as HTMLElement;

    expect(getModalInitialFocusTarget(dialog)).toBe(dialog);
  });
});
