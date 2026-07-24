import { describe, expect, it } from "vitest";

import {
  getCellSelectionEdgeStyle,
  getMergedCellStepEdges,
  rowRangeToHeightRatios,
} from "@/components/ui/table/features/cell-selection/cellSelection";

describe("rowRangeToHeightRatios", () => {
  it("falls back to equal splits without heights", () => {
    expect(rowRangeToHeightRatios(0, 4, 1, 3)).toEqual({
      offsetRatio: 0.25,
      lengthRatio: 0.5,
    });
  });

  it("weights ratios by real row heights (expand parent/child)", () => {
    // parent 25 + children 22+22+22 = 91, matching BOM expand rows
    const heights = [25, 22, 22, 22];
    const mid = rowRangeToHeightRatios(0, 4, 1, 3, heights);
    expect(mid.offsetRatio).toBeCloseTo(25 / 91);
    expect(mid.lengthRatio).toBeCloseTo(44 / 91);
    expect(mid.offsetPx).toBe(25);
    expect(mid.lengthPx).toBe(44);
  });
});

describe("getMergedCellStepEdges with unequal heights", () => {
  it("places step joints on height-weighted boundaries", () => {
    const heights = [25, 22, 22, 22, 25, 22, 22];
    const edges = getMergedCellStepEdges(
      0,
      1,
      { startRow: 2, endRow: 4, startCol: 0, endCol: 2 },
      7,
      undefined,
      heights,
    );

    const rightEdges = edges.filter((edge) => edge.side === "right");
    expect(rightEdges.length).toBeGreaterThan(0);

    const topProtrusion = rightEdges.find((edge) => edge.offsetRatio === 0);
    expect(topProtrusion?.lengthRatio).toBeCloseTo((25 + 22) / 160);
  });
});

describe("getCellSelectionEdgeStyle merged + partial selection", () => {
  it("draws visual top when selection starts mid-merge (fill covers whole merge)", () => {
    const heights = [25, 22, 22, 22, 25, 22, 22];
    const style = getCellSelectionEdgeStyle(
      0,
      1,
      { startRow: 2, endRow: 4, startCol: 0, endCol: 2 },
      7,
      undefined,
      heights,
    );

    const shadows = style?.["--selection-edge-shadows"] ?? "";
    expect(shadows).toContain("inset 0 2px 0 0");
    expect(style?.["--selection-edge-gradients"]).toBeTruthy();
  });

  it("draws full perimeter ring for a single non-merged cell", () => {
    const style = getCellSelectionEdgeStyle(3, 2, {
      startRow: 3,
      endRow: 3,
      startCol: 2,
      endCol: 2,
    });

    expect(style?.["--selection-edge-shadows"]).toBe(
      "inset 0 0 0 2px var(--color-brand-primary)",
    );
  });
});
