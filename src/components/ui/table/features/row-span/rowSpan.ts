import type { ColumnDef } from "@tanstack/react-table"

export type RowSpanInfo = {
  /** 0 means skip render (merged into a parent row) */
  rowSpan: number
  isFirstInGroup: boolean
}

export type RowSpanColumnSpec = {
  columnId: string
  rowSpanKey: string
  /** Column ids, rowSpanKeys, or row fields this merge cannot cross. */
  rowSpanParent: string[]
}

function getRowFieldValue<T extends Record<string, unknown>>(row: T, key: string): unknown {
  return row[key]
}

export function normalizeRowSpanParent(
  value: string | readonly string[] | undefined,
): string[] {
  if (!value) return []
  return typeof value === "string" ? [value] : [...value]
}

function toParentSpanList(
  parentSpans?: RowSpanInfo[] | readonly RowSpanInfo[][],
): RowSpanInfo[][] {
  if (!parentSpans?.length) return []

  const first = parentSpans[0]
  if (first && typeof first === "object" && "rowSpan" in first) {
    return [parentSpans as RowSpanInfo[]]
  }

  return parentSpans as RowSpanInfo[][]
}

/**
 * True when `rowIndex` belongs to the same parent merge as the previous row.
 * The first row, or a column with no parent spans, is always a valid group start.
 */
function sharesParentGroup(
  parentSpans: RowSpanInfo[][],
  rowIndex: number,
): boolean {
  if (parentSpans.length === 0 || rowIndex <= 0) return true

  return parentSpans.every((spans) => {
    const previous = resolveRowSpanAt(spans, rowIndex - 1)
    const current = resolveRowSpanAt(spans, rowIndex)
    return previous.startRow === current.startRow
  })
}

/**
 * Computes vertical merge info from consecutive identical rowSpanKey values.
 * When `parentSpans` is given, groups cannot cross those parent merge boundaries.
 */
export function computeRowSpans<T extends Record<string, unknown>>(
  data: T[],
  rowSpanKey: string,
  parentSpans?: RowSpanInfo[] | readonly RowSpanInfo[][],
): RowSpanInfo[] {
  if (data.length === 0) return []

  const parents = toParentSpanList(parentSpans)
  const result: RowSpanInfo[] = []

  for (let index = 0; index < data.length; index++) {
    const currentValue = getRowFieldValue(data[index], rowSpanKey)
    const previousValue = index > 0 ? getRowFieldValue(data[index - 1], rowSpanKey) : undefined

    if (
      index > 0 &&
      currentValue === previousValue &&
      sharesParentGroup(parents, index)
    ) {
      result.push({ rowSpan: 0, isFirstInGroup: false })
      continue
    }

    let span = 1
    for (let nextIndex = index + 1; nextIndex < data.length; nextIndex++) {
      if (getRowFieldValue(data[nextIndex], rowSpanKey) !== currentValue) break
      if (!sharesParentGroup(parents, nextIndex)) break
      span++
    }

    result.push({ rowSpan: span, isFirstInGroup: true })
  }

  return result
}

export type ColumnRowSpanMap = Map<string, RowSpanInfo[]>

/**
 * Returns the start row and rowSpan of the merged cell covering a given row.
 * Rows with rowSpan === 0 walk up to the merge origin.
 */
export function resolveRowSpanAt(
  rowSpans: RowSpanInfo[] | undefined,
  rowIndex: number,
): { startRow: number; rowSpan: number } {
  if (!rowSpans?.[rowIndex]) {
    return { startRow: rowIndex, rowSpan: 1 };
  }

  const current = rowSpans[rowIndex];
  if (current.rowSpan > 0) {
    return { startRow: rowIndex, rowSpan: current.rowSpan };
  }

  for (let row = rowIndex - 1; row >= 0; row--) {
    const info = rowSpans[row];
    if (info && info.rowSpan > 0) {
      return { startRow: row, rowSpan: info.rowSpan };
    }
  }

  return { startRow: rowIndex, rowSpan: 1 };
}

function findRowSpanColumn(
  spec: RowSpanColumnSpec[],
  ref: string,
): RowSpanColumnSpec | undefined {
  return (
    spec.find((column) => column.columnId === ref) ??
    spec.find((column) => column.rowSpanKey === ref)
  )
}

/**
 * Computes merge info for every column that has rowSpan meta.
 * Columns without `rowSpanParent` merge independently. Columns with a parent
 * only merge inside that parent field / column's groups.
 */
export function buildColumnRowSpanMap<T extends Record<string, unknown>>(
  data: T[],
  columnKeys: RowSpanColumnSpec[],
): ColumnRowSpanMap {
  const map: ColumnRowSpanMap = new Map()
  const visiting = new Set<string>()
  const virtualParents = new Map<string, RowSpanInfo[]>()

  const spansForColumn = (columnId: string): RowSpanInfo[] | undefined => {
    const cached = map.get(columnId)
    if (cached) return cached

    const column = columnKeys.find((item) => item.columnId === columnId)
    if (!column) return undefined

    if (visiting.has(columnId)) {
      return computeRowSpans(data, column.rowSpanKey)
    }

    visiting.add(columnId)
    const parentSpans = column.rowSpanParent
      .map((ref) => spansForParentRef(ref))
      .filter((spans): spans is RowSpanInfo[] => Boolean(spans))
    visiting.delete(columnId)

    const spans = computeRowSpans(
      data,
      column.rowSpanKey,
      parentSpans.length > 0 ? parentSpans : undefined,
    )
    map.set(columnId, spans)
    return spans
  }

  const spansForParentRef = (ref: string): RowSpanInfo[] | undefined => {
    const parentColumn = findRowSpanColumn(columnKeys, ref)
    if (parentColumn) return spansForColumn(parentColumn.columnId)

    const cached = virtualParents.get(ref)
    if (cached) return cached

    const spans = computeRowSpans(data, ref)
    virtualParents.set(ref, spans)
    return spans
  }

  for (const column of columnKeys) {
    spansForColumn(column.columnId)
  }

  return map
}

export function collectRowSpanColumns<T extends Record<string, unknown>>(
  columns: ColumnDef<T, unknown>[],
): RowSpanColumnSpec[] {
  const result: RowSpanColumnSpec[] = []

  const visit = (defs: ColumnDef<T, unknown>[]) => {
    for (const columnDef of defs) {
      if ("columns" in columnDef && columnDef.columns?.length) {
        visit(columnDef.columns as ColumnDef<T, unknown>[])
        continue
      }

      const columnId =
        columnDef.id ??
        ("accessorKey" in columnDef && columnDef.accessorKey
          ? String(columnDef.accessorKey)
          : undefined)

      if (!columnId || !columnDef.meta?.rowSpan) continue

      result.push({
        columnId,
        rowSpanKey: columnDef.meta.rowSpanKey ?? columnId,
        rowSpanParent: normalizeRowSpanParent(columnDef.meta.rowSpanParent),
      })
    }
  }

  visit(columns)

  return result
}
