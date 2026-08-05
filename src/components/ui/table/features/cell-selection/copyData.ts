import type { ColumnDef, Row } from "@tanstack/react-table"

import type { CellSelectionBounds } from "@/components/ui/table/features/cell-selection/cellSelection"

export type CopySelectionMode = "visible" | "subtree"

export type CopyRowEntry<T extends Record<string, unknown>> = {
  row: T
  /** Tree depth relative to the table root (0 = top-level). */
  depth: number
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }

  return ""
}

/** Prefer display fields used by drilldown / similar object cell values. */
function formatObjectValue(value: Record<string, unknown>): string {
  const text = value.text ?? value.label ?? value.name ?? value.title
  if (text != null && text !== "") {
    return formatCellValue(text)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

/**
 * Clipboard / Excel paste expects one plain string per cell.
 * Avoids `String(object)` → `[object Object]` and joins arrays with `, `.
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  if (Array.isArray(value)) {
    return value
      .map((item) => formatCellValue(item))
      .filter((item) => item.length > 0)
      .join(", ")
  }

  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>)
  }

  return formatPrimitive(value)
}

function getNestedValue(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return row[path]

  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, row)
}

function readRowColumnValue(
  rowData: Record<string, unknown>,
  columnDef: ColumnDef<unknown, unknown>,
): unknown {
  if ("accessorFn" in columnDef && typeof columnDef.accessorFn === "function") {
    return columnDef.accessorFn(rowData, 0)
  }

  if ("accessorKey" in columnDef && columnDef.accessorKey != null && columnDef.accessorKey !== "") {
    return getNestedValue(rowData, String(columnDef.accessorKey))
  }

  return undefined
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

function getOriginalRowId(original: Record<string, unknown>): string {
  return String(original.id ?? original.uniqueId ?? "")
}

function getRowDepth(original: Record<string, unknown>): number {
  return typeof original.level === "number" ? original.level : 0
}

/**
 * Collects copy rows with tree depth so paste can rebuild parent/child nesting.
 * Descendant depth is derived from the walk, not only from `level`.
 */
export function collectCopyRowEntries<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): CopyRowEntry<T>[] {
  const { startRow, endRow } = bounds
  const result: CopyRowEntry<T>[] = []
  const includedOriginalIds = new Set<string>()

  const appendSubtree = (node: T, depth: number) => {
    const children = node.children
    if (!Array.isArray(children) || children.length === 0) return

    for (const child of children as T[]) {
      const childId = getOriginalRowId(child)
      if (!(childId && includedOriginalIds.has(childId))) {
        result.push({ row: child, depth })
        if (childId) includedOriginalIds.add(childId)
      }

      appendSubtree(child, depth + 1)
    }
  }

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = visibleRows[rowIndex]
    if (!row) continue

    const originalId = getOriginalRowId(row.original)
    if (originalId && includedOriginalIds.has(originalId)) continue

    const depth = getRowDepth(row.original)
    result.push({ row: row.original, depth })
    if (originalId) includedOriginalIds.add(originalId)

    if (mode !== "subtree" || !hasSubtree(row.original)) continue

    appendSubtree(row.original, depth + 1)
  }

  return result
}

export function collectCopyRows<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): T[] {
  return collectCopyRowEntries(visibleRows, bounds, mode).map((entry) => entry.row)
}

export function serializeCopyRowsToTSV<T extends Record<string, unknown>>(
  copyRows: T[],
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  depths?: number[],
): string {
  if (copyRows.length === 0) return ""

  const { startCol, endCol } = bounds
  const columnCells = visibleRows[0]?.getVisibleCells().slice(startCol, endCol + 1) ?? []
  if (columnCells.length === 0) return ""

  const resolvedDepths =
    depths && depths.length === copyRows.length
      ? depths
      : copyRows.map((row) => getRowDepth(row))
  const minDepth = Math.min(...resolvedDepths)

  return copyRows
    .map((rowData, index) => {
      const relativeDepth = Math.max(0, (resolvedDepths[index] ?? 0) - minDepth)
      const line = columnCells
        .map((cell) =>
          formatCellValue(
            readRowColumnValue(
              rowData,
              cell.column.columnDef as ColumnDef<unknown, unknown>,
            ),
          ),
        )
        .join("\t")

      return `${"\t".repeat(relativeDepth)}${line}`
    })
    .join("\n")
}

export function serializeSelectionToTSV<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): string {
  const entries = collectCopyRowEntries(visibleRows, bounds, mode)

  return serializeCopyRowsToTSV(
    entries.map((entry) => entry.row),
    visibleRows,
    bounds,
    entries.map((entry) => entry.depth),
  )
}

export async function writeSelectionToClipboard<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): Promise<boolean> {
  const text = serializeSelectionToTSV(visibleRows, bounds, mode)
  if (!text) return false

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return false
  }

  return true
}
