import type { ColumnDef, Row } from "@tanstack/react-table"

import {
  getCellSelectionBounds,
  isCellInSelection,
  type CellSelectionBounds,
} from "@/components/ui/table/features/cell-selection/cellSelection"

function getColumnAccessorKey(columnDef: ColumnDef<unknown, unknown>): string | undefined {
  if ("accessorKey" in columnDef && columnDef.accessorKey) {
    return String(columnDef.accessorKey)
  }

  return columnDef.id
}

export function applyFillData<T extends Record<string, unknown>>(
  data: T[],
  rows: Row<T>[],
  sourceBounds: CellSelectionBounds,
  fillBounds: CellSelectionBounds,
): T[] {
  const newData = data.map((row) => ({ ...row }))
  const sourceHeight = sourceBounds.endRow - sourceBounds.startRow + 1
  const sourceWidth = sourceBounds.endCol - sourceBounds.startCol + 1

  for (let rowIndex = fillBounds.startRow; rowIndex <= fillBounds.endRow; rowIndex += 1) {
    for (let colIndex = fillBounds.startCol; colIndex <= fillBounds.endCol; colIndex += 1) {
      if (isCellInSelection(rowIndex, colIndex, sourceBounds)) continue

      const offsetRow = rowIndex - sourceBounds.startRow
      const offsetCol = colIndex - sourceBounds.startCol
      const sourceRowIndex =
        sourceBounds.startRow + (((offsetRow % sourceHeight) + sourceHeight) % sourceHeight)
      const sourceColIndex =
        sourceBounds.startCol + (((offsetCol % sourceWidth) + sourceWidth) % sourceWidth)

      const targetCell = rows[rowIndex]?.getVisibleCells()[colIndex]
      const sourceCell = rows[sourceRowIndex]?.getVisibleCells()[sourceColIndex]
      if (!targetCell || !sourceCell) continue

      const accessorKey = getColumnAccessorKey(
        targetCell.column.columnDef as ColumnDef<unknown, unknown>,
      )
      if (!accessorKey) continue

      ;(newData[rowIndex] as Record<string, unknown>)[accessorKey] = sourceCell.getValue()
    }
  }

  return newData
}

export function hasFillExtension(
  sourceBounds: CellSelectionBounds | null,
  fillBounds: CellSelectionBounds,
): boolean {
  if (!sourceBounds) return false

  return (
    fillBounds.startRow < sourceBounds.startRow ||
    fillBounds.endRow > sourceBounds.endRow ||
    fillBounds.startCol < sourceBounds.startCol ||
    fillBounds.endCol > sourceBounds.endCol
  )
}

export { getCellSelectionBounds }
