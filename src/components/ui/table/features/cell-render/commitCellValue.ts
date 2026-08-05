import type { Row } from "@tanstack/react-table"

import { getColumnAccessorKey } from "@/components/ui/table/features/cell-edit/cellEdit"

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

  const rowIndex = rows.findIndex((row) => row.id === rowId)
  if (rowIndex < 0) return false

  const row = rows[rowIndex]
  const cell =
    row?.getAllCells().find((item) => item.column.id === columnId) ??
    row?.getVisibleCells().find((item) => item.column.id === columnId)
  if (!cell) return false

  const accessorKey = getColumnAccessorKey(cell.column.columnDef)
  if (!accessorKey) return false

  const next = data.map((item) => ({ ...item }))
  const target = next[rowIndex]
  if (!target) return false

  ;(target as Record<string, unknown>)[accessorKey] = value
  onDataChange?.(next)

  return true
}
