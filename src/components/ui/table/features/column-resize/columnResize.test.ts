import { describe, expect, it } from "vitest";

import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants";
import {
  getColumnSizeStyle,
  resolveColumnLayoutWidths,
} from "@/components/ui/table/features/column-resize/columnResize";

describe("getColumnSizeStyle", () => {
  it("skips the default size when resize is not forcing styles", () => {
    expect(getColumnSizeStyle(DATA_TABLE_COLUMN_SIZE)).toBeUndefined();
  });

  it("locks width to the current size while resizing", () => {
    expect(getColumnSizeStyle(240, { force: true, lockMax: true })).toEqual({
      width: 240,
      minWidth: 240,
      maxWidth: 240,
    });
  });

  it("ignores cell min/max while resize lock is on", () => {
    expect(
      getColumnSizeStyle(240, {
        force: true,
        lockMax: true,
        minWidth: 80,
        maxWidth: 120,
      }),
    ).toEqual({
      width: 240,
      minWidth: 240,
      maxWidth: 240,
    });
  });

  it("applies cell min/max without a definite column size", () => {
    expect(
      getColumnSizeStyle(DATA_TABLE_COLUMN_SIZE, {
        minWidth: 80,
        maxWidth: 240,
      }),
    ).toEqual({
      minWidth: 80,
      maxWidth: 240,
    });
  });

  it("keeps an explicit width and overlays cell min/max", () => {
    expect(getColumnSizeStyle(200, { minWidth: 80, maxWidth: 300 })).toEqual({
      width: 200,
      minWidth: 80,
      maxWidth: 300,
    });
  });

  it("clamps an explicit width into cell min/max", () => {
    expect(getColumnSizeStyle(200, { minWidth: 110, maxWidth: 160 })).toEqual({
      width: 160,
      minWidth: 110,
      maxWidth: 160,
    });
  });

  it("locks minWidth to size when only width is set", () => {
    expect(getColumnSizeStyle(200)).toEqual({
      width: 200,
      minWidth: 200,
    });
  });

  it("hard-locks width/min/max to a resolved layoutWidth, ignoring the original min/max bounds", () => {
    // Without the lock, `min-width`/`max-width` stay at the original 80/240
    // range and `table-layout: auto` can re-grow the cell past the 150px
    // the layout resolver actually budgeted for it.
    expect(
      getColumnSizeStyle(DATA_TABLE_COLUMN_SIZE, {
        minWidth: 80,
        maxWidth: 240,
        layoutWidth: 150,
      }),
    ).toEqual({
      width: 150,
      minWidth: 150,
      maxWidth: 150,
    });
  });

  it("prefers a resolved layoutWidth over the raw tanstack size", () => {
    expect(getColumnSizeStyle(150, { layoutWidth: 90 })).toEqual({
      width: 90,
      minWidth: 90,
      maxWidth: 90,
    });
  });
});

describe("resolveColumnLayoutWidths", () => {
  it("keeps explicit widths and leaves unconstrained columns unset", () => {
    const widths = resolveColumnLayoutWidths(800, [
      { id: "fixed", width: 100 },
      { id: "flex" },
    ]);

    expect(widths.get("fixed")).toBe(100);
    expect(widths.has("flex")).toBe(false);
  });

  it("prefers maxWidth for bounded columns when space allows, leaving leftover to flex", () => {
    const widths = resolveColumnLayoutWidths(800, [
      { id: "fixed", width: 100 },
      { id: "bounded", minWidth: 110, maxWidth: 160 },
      { id: "flex" },
    ]);

    expect(widths.get("fixed")).toBe(100);
    expect(widths.get("bounded")).toBe(160);
    expect(widths.has("flex")).toBe(false);
  });

  it("shrinks bounded columns toward minWidth when space is tight with flex columns", () => {
    const widths = resolveColumnLayoutWidths(250, [
      { id: "fixed", width: 100 },
      { id: "bounded", minWidth: 110, maxWidth: 160 },
      { id: "flex" },
    ]);

    // remaining 150 — between 110 and 160, so shrink from 160 to 150
    expect(widths.get("bounded")).toBe(150);
    expect(widths.has("flex")).toBe(false);
  });

  it("grows bounded columns toward maxWidth when no unconstrained columns exist", () => {
    const widths = resolveColumnLayoutWidths(500, [
      { id: "fixed", width: 200 },
      { id: "bounded", minWidth: 80, maxWidth: 240 },
    ]);

    expect(widths.get("fixed")).toBe(200);
    expect(widths.get("bounded")).toBe(240);
  });

  it("clamps bounded size to minWidth when remaining is below the preferred max", () => {
    const widths = resolveColumnLayoutWidths(250, [
      { id: "fixed", width: 200 },
      { id: "bounded", minWidth: 110, maxWidth: 160 },
    ]);

    expect(widths.get("bounded")).toBe(110);
  });

  it("falls back to maxWidth when the container is unmeasured", () => {
    const widths = resolveColumnLayoutWidths(0, [
      { id: "bounded", minWidth: 80, maxWidth: 240 },
      { id: "fixed", width: 200 },
    ]);

    expect(widths.get("bounded")).toBe(240);
    expect(widths.get("fixed")).toBe(200);
  });

  it("falls back to maxWidth when unconstrained columns exist and the container is unmeasured", () => {
    const widths = resolveColumnLayoutWidths(0, [
      { id: "bounded", minWidth: 110, maxWidth: 160 },
      { id: "flex" },
    ]);

    expect(widths.get("bounded")).toBe(160);
    expect(widths.has("flex")).toBe(false);
  });
});
