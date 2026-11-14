import type { ColumnDef, Row } from "@tanstack/react-table"

import {
  isColumnEditable,
  isProtectedColumn,
} from "@/components/ui/table/features/cell-edit/cellEdit"
import { applyCellChangesToData } from "@/components/ui/table/features/data-patch/dataPatch"
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

export type CellChange = {
  rowId: string
  columnId: string
  value: unknown
}

function collectFillTargets<T extends Record<string, unknown>>(
  rows: Row<T>[],
  sourceBounds: CellSelectionBounds,
  fillBounds: CellSelectionBounds,
): Array<{
  rowIndex: number
  accessorKey: string
  columnId: string
  value: unknown
  rowId: string
}> {
  const targets: Array<{
    rowIndex: number
    accessorKey: string
    columnId: string
    value: unknown
    rowId: string
  }> = []
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

      const targetRow = rows[rowIndex]
      const targetCell = targetRow?.getVisibleCells()[colIndex]
      const sourceCell = rows[sourceRowIndex]?.getVisibleCells()[sourceColIndex]
      if (!targetRow || !targetCell || !sourceCell) continue
      // Fill writes like an edit, so it must respect the same guard: never
      // overwrite read-only (or protected) columns.
      if (!isColumnEditable(targetCell.column.columnDef)) continue
      // A masked source must never be copied out in the clear: filling from
      // a protected column into a plain one would reveal the raw value.
      if (isProtectedColumn(sourceCell.column.columnDef)) continue

      const accessorKey = getColumnAccessorKey(
        targetCell.column.columnDef as ColumnDef<unknown, unknown>,
      )
      if (!accessorKey) continue

      targets.push({
        rowIndex,
        accessorKey,
        columnId: targetCell.column.id,
        value: sourceCell.getValue(),
        rowId: targetRow.id,
      })
    }
  }

  return targets
}

export function collectFillChanges<T extends Record<string, unknown>>(
  rows: Row<T>[],
  sourceBounds: CellSelectionBounds,
  fillBounds: CellSelectionBounds,
): CellChange[] {
  return collectFillTargets(rows, sourceBounds, fillBounds).map(
    ({ rowId, columnId, value }) => ({ rowId, columnId, value }),
  )
}

export function applyFillData<T extends Record<string, unknown>>(
  data: T[],
  rows: Row<T>[],
  sourceBounds: CellSelectionBounds,
  fillBounds: CellSelectionBounds,
): T[] {
  const targets = collectFillTargets(rows, sourceBounds, fillBounds)

  return applyCellChangesToData(
    data,
    targets.flatMap((target) => {
      const row = rows[target.rowIndex]
      if (!row) return []

      return [
        {
          original: row.original,
          index: row.index,
          accessorKey: target.accessorKey,
          value: target.value,
        },
      ]
    }),
  )
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
