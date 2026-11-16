import { describe, expect, it, vi } from "vitest";

import {
  createRowHoverStore,
  isRowGroupHovered,
  isRowHovered,
} from "@/components/ui/table/features/row-hover/rowHover";

describe("createRowHoverStore", () => {
  it("starts with no hovered row", () => {
    const store = createRowHoverStore();

    expect(store.getHoveredRowIndex()).toBeNull();
  });

  it("notifies subscribers when the hovered row changes", () => {
    const store = createRowHoverStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setHoveredRowIndex(3);

    expect(store.getHoveredRowIndex()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify subscribers when set to the same value", () => {
    const store = createRowHoverStore();
    store.setHoveredRowIndex(3);
    const listener = vi.fn();
    store.subscribe(listener);

    store.setHoveredRowIndex(3);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const store = createRowHoverStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.setHoveredRowIndex(5);

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple independent subscribers", () => {
    const store = createRowHoverStore();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    const unsubscribeB = store.subscribe(b);

    store.setHoveredRowIndex(1);
    unsubscribeB();
    store.setHoveredRowIndex(2);

    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("isRowHovered", () => {
  it("is true only for the exact hovered row", () => {
    expect(isRowHovered(4, 4)).toBe(true);
    expect(isRowHovered(4, 5)).toBe(false);
    expect(isRowHovered(null, 4)).toBe(false);
  });
});

describe("isRowGroupHovered", () => {
  it("is false when rowSpan is disabled, even if the index is within range", () => {
    expect(isRowGroupHovered(2, false, 0, 5)).toBe(false);
  });

  it("is false when nothing is hovered", () => {
    expect(isRowGroupHovered(null, true, 0, 5)).toBe(false);
  });

  it("is true when the hovered row falls inside the group's span", () => {
    expect(isRowGroupHovered(0, true, 0, 3)).toBe(true);
    expect(isRowGroupHovered(1, true, 0, 3)).toBe(true);
    expect(isRowGroupHovered(2, true, 0, 3)).toBe(true);
  });

  it("is false when the hovered row falls outside the group's span", () => {
    expect(isRowGroupHovered(3, true, 0, 3)).toBe(false);
    expect(isRowGroupHovered(-1, true, 0, 3)).toBe(false);
  });
});
