export type CellPosition = {
  row: number
  col: number
}

export type CellSelectionBounds = {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

export type DragState = {
  isSelecting: boolean
  isFillDragging: boolean
  start: CellPosition | null
  end: CellPosition | null
  /** 핸들 반대편 고정 앵커 (좌상단) */
  fillAnchor: CellPosition | null
  fillEnd: CellPosition | null
}

export const INITIAL_DRAG_STATE: DragState = {
  isSelecting: false,
  isFillDragging: false,
  start: null,
  end: null,
  fillAnchor: null,
  fillEnd: null,
}

export function getCellSelectionBounds(
  start: CellPosition | null,
  end: CellPosition | null,
): CellSelectionBounds | null {
  if (!start || !end) return null

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  }
}

export function getRowIndexInMergedCell(
  clientY: number,
  cellElement: HTMLElement,
  rowIndex: number,
  rowSpan: number,
): number {
  if (rowSpan <= 1) return rowIndex

  const rect = cellElement.getBoundingClientRect()
  const relativeY = clientY - rect.top
  const rowHeight = rect.height / rowSpan
  const offset = Math.min(Math.max(Math.floor(relativeY / rowHeight), 0), rowSpan - 1)

  return rowIndex + offset
}

export function isCellInSelection(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds | null,
  rowSpan = 1,
): boolean {
  if (!bounds) return false

  const cellEndRow = rowIndex + rowSpan - 1

  return (
    cellEndRow >= bounds.startRow &&
    rowIndex <= bounds.endRow &&
    colIndex >= bounds.startCol &&
    colIndex <= bounds.endCol
  )
}

export function getActiveSelectionBounds(
  dragState: DragState,
  selectionBounds: CellSelectionBounds | null,
): CellSelectionBounds | null {
  if (dragState.isFillDragging && dragState.fillAnchor && dragState.fillEnd) {
    return getCellSelectionBounds(dragState.fillAnchor, dragState.fillEnd)
  }

  return selectionBounds
}

const SELECTION_EDGE_WIDTH_PX = 2
const SELECTION_EDGE_COLOR = "var(--color-brand-primary)"

export type CellSelectionEdgeStyle = {
  boxShadow: string
}

/** border 대신 inset box-shadow를 사용해 선택 테두리가 레이아웃을 밀지 않도록 한다 */
export function getCellSelectionEdgeStyle(
  rowIndex: number,
  colIndex: number,
  bounds: CellSelectionBounds | null,
  rowSpan = 1,
): CellSelectionEdgeStyle | undefined {
  if (!isCellInSelection(rowIndex, colIndex, bounds, rowSpan) || !bounds) return undefined

  const cellEndRow = rowIndex + rowSpan - 1
  const isTopEdge = bounds.startRow >= rowIndex && bounds.startRow <= cellEndRow
  const isBottomEdge = bounds.endRow >= rowIndex && bounds.endRow <= cellEndRow
  const isLeftEdge = colIndex === bounds.startCol
  const isRightEdge = colIndex === bounds.endCol

  const shadows: string[] = []

  if (isTopEdge) {
    shadows.push(`inset 0 ${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`)
  }

  if (isBottomEdge) {
    shadows.push(`inset 0 -${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`)
  }

  if (isLeftEdge) {
    shadows.push(`inset ${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`)
  }

  if (isRightEdge) {
    shadows.push(`inset -${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`)
  }

  return shadows.length > 0 ? { boxShadow: shadows.join(", ") } : undefined
}
