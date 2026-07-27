import type { ColumnDef, Row } from "@tanstack/react-table"

import type { CellSelectionBounds } from "@/components/ui/table/features/cell-selection/cellSelection"

export type CopySelectionMode = "visible" | "subtree"

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  return String(value)
}

function getColumnAccessorKey(columnDef: ColumnDef<unknown, unknown>): string | undefined {
  if ("accessorKey" in columnDef && columnDef.accessorKey) {
    return String(columnDef.accessorKey)
  }

  return columnDef.id
}

export function flattenSubtreeRows<T extends Record<string, unknown>>(row: T): T[] {
  const children = row.children
  if (!Array.isArray(children) || children.length === 0) return []

  const result: T[] = []

  const walk = (nodes: T[]) => {
    for (const node of nodes) {
      result.push(node)

      const nested = node.children
      if (Array.isArray(nested) && nested.length > 0) {
        walk(nested as T[])
      }
    }
  }

  walk(children as T[])

  return result
}

function hasSubtree(row: Record<string, unknown>): boolean {
  const children = row.children

  return Array.isArray(children) && children.length > 0
}

export function collectCopyRows<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): T[] {
  const { startRow, endRow } = bounds
  const result: T[] = []
  const includedRowIds = new Set<string>()

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = visibleRows[rowIndex]
    if (!row || includedRowIds.has(row.id)) continue

    result.push(row.original)
    includedRowIds.add(row.id)

    if (mode !== "subtree" || !hasSubtree(row.original)) continue

    for (const descendant of flattenSubtreeRows(row.original)) {
      const descendantId = String(descendant.id ?? descendant.uniqueId ?? "")
      if (!descendantId || includedRowIds.has(descendantId)) continue

      result.push(descendant)
      includedRowIds.add(descendantId)
    }
  }

  return result
}

export function serializeCopyRowsToTSV<T extends Record<string, unknown>>(
  copyRows: T[],
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
): string {
  if (copyRows.length === 0) return ""

  const { startCol, endCol } = bounds
  const columnCells = visibleRows[0]?.getVisibleCells().slice(startCol, endCol + 1) ?? []
  if (columnCells.length === 0) return ""

  return copyRows
    .map((rowData) =>
      columnCells
        .map((cell) => {
          const accessorKey = getColumnAccessorKey(
            cell.column.columnDef as ColumnDef<unknown, unknown>,
          )
          if (!accessorKey) return ""

          return formatCellValue(rowData[accessorKey])
        })
        .join("\t"),
    )
    .join("\n")
}

export function serializeSelectionToTSV<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): string {
  const copyRows = collectCopyRows(visibleRows, bounds, mode)

  return serializeCopyRowsToTSV(copyRows, visibleRows, bounds)
}

export async function writeSelectionToClipboard<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): Promise<boolean> {
  const text = serializeSelectionToTSV(visibleRows, bounds, mode)
  if (!text) return false

  await navigator.clipboard.writeText(text)

  return true
}
