export type CellPosition = {
  row: number;
  col: number;
};

export type CellSelectionBounds = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type DragState = {
  isSelecting: boolean;
  isFillDragging: boolean;
  start: CellPosition | null;
  end: CellPosition | null;
  /** Fixed anchor opposite the fill handle (top-left) */
  fillAnchor: CellPosition | null;
  fillEnd: CellPosition | null;
};

export const INITIAL_DRAG_STATE: DragState = {
  isSelecting: false,
  isFillDragging: false,
  start: null,
  end: null,
  fillAnchor: null,
  fillEnd: null,
};

export function getCellSelectionBounds(
  start: CellPosition | null,
  end: CellPosition | null,
): CellSelectionBounds | null {
  if (!start || !end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

/**
 * Reads per-row heights for a merged cell span from the table body.
 * Expand + merge yields unequal row heights (e.g. parent 25px / child 22px);
 * step borders must use these instead of equal-ratio splits.
 */
export function measureMergedSpanRowHeights(
  rowIndex: number,
  rowSpan: number,
  cellElement?: HTMLElement | null,
): number[] | undefined {
  if (rowSpan <= 1) return undefined;

  const tbody =
    cellElement?.closest("tbody") ??
    (typeof document !== "undefined"
      ? document.querySelector("tbody.data-table-body")
      : null);
  if (!tbody) return undefined;

  const rows = tbody.querySelectorAll(":scope > tr");
  if (rows.length < rowIndex + rowSpan) return undefined;

  const heights: number[] = [];
  for (let i = 0; i < rowSpan; i++) {
    const row = rows[rowIndex + i] as HTMLElement | undefined;
    const height = row?.getBoundingClientRect().height ?? 0;
    if (height <= 0) return undefined;
    heights.push(height);
  }

  return heights;
}

export function getRowIndexInMergedCell(
  clientY: number,
  cellElement: HTMLElement,
  rowIndex: number,
  rowSpan: number,
): number {
  if (rowSpan <= 1) return rowIndex;

  const rect = cellElement.getBoundingClientRect();
  const relativeY = clientY - rect.top;
  const heights = measureMergedSpanRowHeights(rowIndex, rowSpan, cellElement);

  if (heights && heights.length === rowSpan) {
    let accrued = 0;
    for (let i = 0; i < rowSpan; i++) {
      accrued += heights[i]!;
      if (relativeY < accrued) {
        return rowIndex + i;
      }
    }

    return rowIndex + rowSpan - 1;
  }

  const rowHeight = rect.height / rowSpan;
  const offset = Math.min(
    Math.max(Math.floor(relativeY / rowHeight), 0),
    rowSpan - 1,
  );

  return rowIndex + offset;
}

export function isCellInSelection(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds | null,
  rowSpan = 1,
): boolean {
  if (!bounds) return false;

  const cellEndRow = rowIndex + rowSpan - 1;

  return (
    cellEndRow >= bounds.startRow &&
    rowIndex <= bounds.endRow &&
    colIndex >= bounds.startCol &&
    colIndex <= bounds.endCol
  );
}

export function getActiveSelectionBounds(
  dragState: DragState,
  selectionBounds: CellSelectionBounds | null,
): CellSelectionBounds | null {
  if (dragState.isFillDragging && dragState.fillAnchor && dragState.fillEnd) {
    return getCellSelectionBounds(dragState.fillAnchor, dragState.fillEnd);
  }

  return selectionBounds;
}

const SELECTION_EDGE_WIDTH_PX = 2;
const SELECTION_EDGE_COLOR = "var(--color-brand-primary)";

export const CELL_SELECTION_EDGES_CLASS = "cell-selection-edges";

export type CellSelectionEdgeStyle = {
  /** Full-side inset border applied via ::after */
  ["--selection-edge-shadows"]?: string;
  /** Partial borders for merged-cell step (stair) segments */
  ["--selection-edge-gradients"]?: string;
  ["--selection-edge-sizes"]?: string;
  ["--selection-edge-positions"]?: string;
  /** Hide internal horizontal grid lines inside the selection with background color */
  borderBottomColor?: string;
};

type PartialEdge = {
  side: "left" | "right";
  /** Start position as a ratio of cell height (0~1) — fallback */
  offsetRatio: number;
  /** Length as a ratio of cell height (0~1) — fallback */
  lengthRatio: number;
  /** Pixel offset from cell top when real row heights are known */
  offsetPx?: number;
  /** Pixel length when real row heights are known */
  lengthPx?: number;
};

/**
 * Maps a logical row range inside a merged cell to height ratios / pixels.
 * When `rowHeights` is omitted, falls back to equal row splits.
 */
export function rowRangeToHeightRatios(
  rowIndex: number,
  span: number,
  fromRow: number,
  toRowExclusive: number,
  rowHeights?: number[],
): {
  offsetRatio: number;
  lengthRatio: number;
  offsetPx?: number;
  lengthPx?: number;
} {
  const clampedFrom = Math.max(fromRow, rowIndex);
  const clampedTo = Math.min(toRowExclusive, rowIndex + span);

  if (clampedTo <= clampedFrom) {
    return { offsetRatio: 0, lengthRatio: 0 };
  }

  if (!rowHeights || rowHeights.length !== span) {
    return {
      offsetRatio: (clampedFrom - rowIndex) / span,
      lengthRatio: (clampedTo - clampedFrom) / span,
    };
  }

  const total = rowHeights.reduce((sum, height) => sum + height, 0) || 1;
  let offsetPx = 0;
  for (let i = 0; i < clampedFrom - rowIndex; i++) {
    offsetPx += rowHeights[i] ?? 0;
  }
  let lengthPx = 0;
  for (let i = clampedFrom - rowIndex; i < clampedTo - rowIndex; i++) {
    lengthPx += rowHeights[i] ?? 0;
  }

  return {
    offsetRatio: offsetPx / total,
    lengthRatio: lengthPx / total,
    offsetPx,
    lengthPx,
  };
}

/**
 * When a merged cell protrudes above/below the logical selection range,
 * compute only the vertical borders (step corners) for segments whose
 * neighboring cells are not visually selected.
 *
 * If multiple columns have rowSpan, adjacent merged cells may paint past the
 * range, so internal boundaries are not drawn in that case.
 *
 * `rowHeights` weights step joints for expand rows with unequal heights.
 */
export function getMergedCellStepEdges(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds,
  rowSpan: number,
  isVisuallySelectedAt?: (row: number, col: number) => boolean,
  rowHeights?: number[],
): PartialEdge[] {
  const cellEndRow = rowIndex + rowSpan - 1;
  const span = cellEndRow - rowIndex + 1;
  if (span <= 1) return [];

  const edges: PartialEdge[] = [];

  const isNeighborSelected = (row: number, neighborCol: number) => {
    if (isVisuallySelectedAt) {
      return isVisuallySelectedAt(row, neighborCol);
    }

    return (
      row >= bounds.startRow &&
      row <= bounds.endRow &&
      neighborCol >= bounds.startCol &&
      neighborCol <= bounds.endCol
    );
  };

  const pushUnselectedRuns = (
    side: "left" | "right",
    neighborCol: number,
    fromRow: number,
    toRowExclusive: number,
  ) => {
    let runStart: number | null = null;

    for (let row = fromRow; row < toRowExclusive; row++) {
      if (!isNeighborSelected(row, neighborCol)) {
        if (runStart === null) runStart = row;
        continue;
      }

      if (runStart !== null) {
        const ratios = rowRangeToHeightRatios(
          rowIndex,
          span,
          runStart,
          row,
          rowHeights,
        );
        if (ratios.lengthRatio > 0) {
          edges.push({ side, ...ratios });
        }
        runStart = null;
      }
    }

    if (runStart !== null) {
      const ratios = rowRangeToHeightRatios(
        rowIndex,
        span,
        runStart,
        toRowExclusive,
        rowHeights,
      );
      if (ratios.lengthRatio > 0) {
        edges.push({ side, ...ratios });
      }
    }
  };

  const collectSide = (side: "left" | "right", neighborCol: number) => {
    if (bounds.startRow > rowIndex) {
      pushUnselectedRuns(
        side,
        neighborCol,
        rowIndex,
        Math.min(bounds.startRow, cellEndRow + 1),
      );
    }

    if (bounds.endRow < cellEndRow) {
      pushUnselectedRuns(
        side,
        neighborCol,
        Math.max(bounds.endRow + 1, rowIndex),
        cellEndRow + 1,
      );
    }
  };

  if (colIndex < bounds.endCol) {
    collectSide("right", colIndex + 1);
  }

  if (colIndex > bounds.startCol) {
    collectSide("left", colIndex - 1);
  }

  return edges;
}

function buildPartialEdgeGradient(
  edge: PartialEdge,
): Array<{ image: string; size: string; position: string }> {
  /**
   * Prefer px stops when available — ::after uses bottom: -1px so % of the
   * overlay box drifts from real row boundaries under expand.
   */
  const usePx = edge.offsetPx != null && edge.lengthPx != null;
  const startPct = edge.offsetRatio * 100;
  const endPct = (edge.offsetRatio + edge.lengthRatio) * 100;
  const startPx = edge.offsetPx ?? 0;
  const endPx = (edge.offsetPx ?? 0) + (edge.lengthPx ?? 0);
  const overlapPx = SELECTION_EDGE_WIDTH_PX;
  const isTopProtrusion =
    (usePx ? startPx === 0 : edge.offsetRatio === 0) && edge.lengthRatio < 1;
  const isBottomProtrusion = usePx ? startPx > 0 : edge.offsetRatio > 0;

  const startStop = usePx
    ? isBottomProtrusion
      ? `${Math.max(0, startPx - overlapPx)}px`
      : `${startPx}px`
    : isBottomProtrusion
      ? `calc(${startPct}% - ${overlapPx}px)`
      : `${startPct}%`;
  const endStop = usePx
    ? isTopProtrusion
      ? `${endPx + overlapPx}px`
      : `${endPx}px`
    : isTopProtrusion
      ? `calc(${endPct}% + ${overlapPx}px)`
      : `${endPct}%`;
  const xPos = edge.side === "left" ? "0" : "100%";

  const layers: Array<{ image: string; size: string; position: string }> = [
    {
      image: `linear-gradient(to bottom, transparent 0%, transparent ${startStop}, ${SELECTION_EDGE_COLOR} ${startStop}, ${SELECTION_EDGE_COLOR} ${endStop}, transparent ${endStop}, transparent 100%)`,
      size: `${SELECTION_EDGE_WIDTH_PX}px 100%`,
      position: `${xPos} 0`,
    },
  ];

  if (isTopProtrusion || isBottomProtrusion) {
    const capTop = usePx
      ? isTopProtrusion
        ? `${Math.max(0, endPx - SELECTION_EDGE_WIDTH_PX)}px`
        : `${Math.max(0, startPx - SELECTION_EDGE_WIDTH_PX)}px`
      : isTopProtrusion
        ? `calc(${endPct}% - ${SELECTION_EDGE_WIDTH_PX}px)`
        : `calc(${startPct}% - ${SELECTION_EDGE_WIDTH_PX}px)`;

    layers.push({
      image: `linear-gradient(${SELECTION_EDGE_COLOR}, ${SELECTION_EDGE_COLOR})`,
      size: `${SELECTION_EDGE_WIDTH_PX}px ${SELECTION_EDGE_WIDTH_PX}px`,
      position: `${xPos} ${capTop}`,
    });
  }

  return layers;
}

/**
 * Draws the selection border with ::after (extended -1px at the bottom) plus
 * inset box-shadow / partial gradients so it does not break on the cell's
 * border-bottom.
 *
 * Merged cells that overlap the selection are filled as a whole, so top/bottom
 * edges follow the cell's visual box when it contains the selection start/end.
 * Step (stair) segments use height-weighted ratios when expand makes rows unequal.
 *
 * @param isVisuallySelectedAt Whether a logical cell is visually selected
 *   (including adjacent merged cells). Used to suppress internal step borders
 *   when multiple columns have rowSpan.
 * @param rowHeights Per-row heights inside this merged span.
 */
export function getCellSelectionEdgeStyle(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds | null,
  rowSpan = 1,
  isVisuallySelectedAt?: (row: number, col: number) => boolean,
  rowHeights?: number[],
): CellSelectionEdgeStyle | undefined {
  if (!isCellInSelection(rowIndex, colIndex, bounds, rowSpan) || !bounds)
    return undefined;

  const cellEndRow = rowIndex + rowSpan - 1;
  /** Visual top when this (possibly merged) cell contains the selection start */
  const isTopEdge =
    bounds.startRow >= rowIndex && bounds.startRow <= cellEndRow;
  /** Visual bottom when this cell contains the selection end */
  const isBottomEdge = bounds.endRow >= rowIndex && bounds.endRow <= cellEndRow;
  const isLeftEdge = colIndex === bounds.startCol;
  const isRightEdge = colIndex === bounds.endCol;
  /** Hide the internal horizontal line when the selection continues below this cell */
  const selectionContinuesBelow = cellEndRow < bounds.endRow;

  const stepEdges = getMergedCellStepEdges(
    rowIndex,
    colIndex,
    bounds,
    rowSpan,
    isVisuallySelectedAt,
    rowHeights,
  );

  const shadows: string[] = [];
  /**
   * A single spread inset draws a continuous ring (smooth corners).
   * Directional shadows are used for partial edges / multi-cell perimeters.
   */
  const hasFullPerimeter =
    isTopEdge &&
    isBottomEdge &&
    isLeftEdge &&
    isRightEdge &&
    stepEdges.length === 0;

  if (hasFullPerimeter) {
    shadows.push(
      `inset 0 0 0 ${SELECTION_EDGE_WIDTH_PX}px ${SELECTION_EDGE_COLOR}`,
    );
  } else {
    if (isTopEdge) {
      shadows.push(
        `inset 0 ${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`,
      );
    }

    if (isBottomEdge) {
      shadows.push(
        `inset 0 -${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`,
      );
    }

    if (isLeftEdge) {
      shadows.push(
        `inset ${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`,
      );
    }

    if (isRightEdge) {
      shadows.push(
        `inset -${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`,
      );
    }
  }

  const gradients: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  for (const edge of stepEdges) {
    for (const partial of buildPartialEdgeGradient(edge)) {
      gradients.push(partial.image);
      sizes.push(partial.size);
      positions.push(partial.position);
    }
  }

  if (
    shadows.length === 0 &&
    gradients.length === 0 &&
    !selectionContinuesBelow
  ) {
    return undefined;
  }

  const style: CellSelectionEdgeStyle = {};

  if (shadows.length > 0) {
    style["--selection-edge-shadows"] = shadows.join(", ");
  }

  if (gradients.length > 0) {
    style["--selection-edge-gradients"] = gradients.join(", ");
    style["--selection-edge-sizes"] = sizes.join(", ");
    style["--selection-edge-positions"] = positions.join(", ");
  }

  if (selectionContinuesBelow) {
    style.borderBottomColor = "var(--color-brand-surface)";
  }

  return style;
}

export function hasCellSelectionEdges(
  style: CellSelectionEdgeStyle | undefined,
): boolean {
  return Boolean(
    style?.["--selection-edge-shadows"] ||
    style?.["--selection-edge-gradients"],
  );
}
