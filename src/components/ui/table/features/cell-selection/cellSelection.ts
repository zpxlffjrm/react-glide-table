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

export function getRowIndexInMergedCell(
  clientY: number,
  cellElement: HTMLElement,
  rowIndex: number,
  rowSpan: number,
): number {
  if (rowSpan <= 1) return rowIndex;

  const rect = cellElement.getBoundingClientRect();
  const relativeY = clientY - rect.top;
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
  /** Partial vertical border for merged-cell step (stair) segments */
  ["--selection-edge-gradients"]?: string;
  ["--selection-edge-sizes"]?: string;
  ["--selection-edge-positions"]?: string;
  /** Hide internal horizontal grid lines inside the selection with background color */
  borderBottomColor?: string;
};

type PartialVerticalEdge = {
  side: "left" | "right";
  /** Start position as a ratio of cell height (0~1) */
  offsetRatio: number;
  /** Length as a ratio of cell height (0~1) */
  heightRatio: number;
};

/**
 * When a merged cell protrudes above/below the logical selection range,
 * compute only the vertical borders (step corners) for segments whose
 * neighboring cells are not visually selected.
 *
 * If multiple columns have rowSpan, adjacent merged cells may paint past the
 * range, so internal boundaries are not drawn in that case.
 */
export function getMergedCellStepEdges(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds,
  rowSpan: number,
  isVisuallySelectedAt?: (row: number, col: number) => boolean,
): PartialVerticalEdge[] {
  const cellEndRow = rowIndex + rowSpan - 1;
  const span = cellEndRow - rowIndex + 1;
  if (span <= 1) return [];

  const edges: PartialVerticalEdge[] = [];

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
        edges.push({
          side,
          offsetRatio: (runStart - rowIndex) / span,
          heightRatio: (row - runStart) / span,
        });
        runStart = null;
      }
    }

    if (runStart !== null) {
      edges.push({
        side,
        offsetRatio: (runStart - rowIndex) / span,
        heightRatio: (toRowExclusive - runStart) / span,
      });
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

function buildPartialVerticalGradient(
  edge: PartialVerticalEdge,
): Array<{ image: string; size: string; position: string }> {
  const startPct = edge.offsetRatio * 100;
  const endPct = (edge.offsetRatio + edge.heightRatio) * 100;
  /**
   * Extend toward the joint so the step corner overlaps the adjacent cell's
   * horizontal border (stroke width). +1px corrects subpixel rounding gaps.
   */
  const overlapPx = SELECTION_EDGE_WIDTH_PX + 1;
  const isTopProtrusion = edge.offsetRatio === 0 && edge.heightRatio < 1;
  const isBottomProtrusion = edge.offsetRatio > 0;

  const startStop = isBottomProtrusion
    ? `calc(${startPct}% - ${overlapPx}px)`
    : `${startPct}%`;
  const endStop = isTopProtrusion
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

  // Place a stroke-width corner cap at the step joint so it meets the horizontal border seamlessly
  if (isTopProtrusion || isBottomProtrusion) {
    const capTop = isTopProtrusion
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
 * @param isVisuallySelectedAt Whether a logical cell is visually selected
 *   (including adjacent merged cells). Used to suppress internal step borders
 *   when multiple columns have rowSpan.
 */
export function getCellSelectionEdgeStyle(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds | null,
  rowSpan = 1,
  isVisuallySelectedAt?: (row: number, col: number) => boolean,
): CellSelectionEdgeStyle | undefined {
  if (!isCellInSelection(rowIndex, colIndex, bounds, rowSpan) || !bounds)
    return undefined;

  const cellEndRow = rowIndex + rowSpan - 1;
  const isTopEdge =
    bounds.startRow >= rowIndex && bounds.startRow <= cellEndRow;
  const isBottomEdge = bounds.endRow >= rowIndex && bounds.endRow <= cellEndRow;
  const isLeftEdge = colIndex === bounds.startCol;
  const isRightEdge = colIndex === bounds.endCol;
  /** Hide the internal horizontal line when the selection continues below this cell */
  const selectionContinuesBelow = cellEndRow < bounds.endRow;

  const shadows: string[] = [];

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

  const stepEdges = getMergedCellStepEdges(
    rowIndex,
    colIndex,
    bounds,
    rowSpan,
    isVisuallySelectedAt,
  );
  const gradients: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  for (const edge of stepEdges) {
    for (const partial of buildPartialVerticalGradient(edge)) {
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
    style?.["--selection-edge-shadows"] || style?.["--selection-edge-gradients"],
  );
}
