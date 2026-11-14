import type { Row } from "@tanstack/react-table"

import { getColumnAccessorKey } from "@/components/ui/table/features/cell-edit/cellEdit"
import { applyCellChangesToData } from "@/components/ui/table/features/data-patch/dataPatch"

type CommitCellValueOptions<T extends Record<string, unknown>> = {
  data: T[]
  rows: Row<T>[]
  rowId: string
  columnId: string
  value: unknown
  onCellChange?: (rowId: string, columnId: string, value: unknown) => void
  onDataChange?: (data: T[]) => void
}

/**
 * `data` is the consumer's original array (not the flattened tree rows).
 *
 * Shared commit path for custom `render` updates and built-in cell kinds.
 * Prefers `onCellChange`; falls back to immutable `onDataChange` patch.
 */
export function commitCellValue<T extends Record<string, unknown>>({
  data,
  rows,
  rowId,
  columnId,
  value,
  onCellChange,
  onDataChange,
}: CommitCellValueOptions<T>): boolean {
  if (!onCellChange && !onDataChange) return true

  if (onCellChange) {
    onCellChange(rowId, columnId, value)
    return true
  }

  // Prefer id lookup + TanStack `row.index` (original data index). The position
  // in the current row model can differ under sort/filter.
  const row = rows.find((item) => item.id === rowId)
  if (!row) return false

  const cell =
    row.getAllCells().find((item) => item.column.id === columnId) ??
    row.getVisibleCells().find((item) => item.column.id === columnId)
  if (!cell) return false

  const accessorKey = getColumnAccessorKey(cell.column.columnDef)
  if (!accessorKey) return false

  // Tree rows carry their path into the original (nested) data; plain rows
  // use `row.index`. Either way the full original array is patched.
  const next = applyCellChangesToData(data, [
    { original: row.original, index: row.index, accessorKey, value },
  ])
  if (next === data || next.every((item, index) => item === data[index])) {
    return false
  }

  onDataChange?.(next)

  return true
}
