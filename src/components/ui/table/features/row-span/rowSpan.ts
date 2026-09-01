import type { ColumnDef } from "@tanstack/react-table"

export type RowSpanInfo = {
  /** 0 means skip render (merged into a parent row) */
  rowSpan: number
  isFirstInGroup: boolean
}

export type RowSpanColumnSpec = {
  columnId: string
  rowSpanKey: string
  /**
   * Column ids, rowSpanKeys, or row fields this merge cannot cross.
   * Omit (or leave undefined) to merge independently of other rowSpan columns.
   */
  rowSpanParent?: readonly string[]
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
  if (!Array.isArray(first)) {
    return [parentSpans as RowSpanInfo[]]
  }

  return parentSpans as RowSpanInfo[][]
}

/** Pre-computes the merge-origin row index for every row in O(n). */
function buildStartRowLookup(spans: RowSpanInfo[]): number[] {
  const startRows = new Array<number>(spans.length)
  let origin = 0
  for (let i = 0; i < spans.length; i++) {
    if ((spans[i]?.rowSpan ?? 1) > 0) origin = i
    startRows[i] = origin
  }
  return startRows
}

/**
 * True when `rowIndex` belongs to the same parent merge as the previous row.
 * The first row, or a column with no parent spans, is always a valid group start.
 */
function sharesParentGroup(
  parentStartRows: number[][],
  rowIndex: number,
): boolean {
  if (parentStartRows.length === 0 || rowIndex <= 0) return true

  return parentStartRows.every(
    (startRows) => startRows[rowIndex - 1] === startRows[rowIndex],
  )
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

  const parentStartRows = toParentSpanList(parentSpans).map(buildStartRowLookup)
  const result: RowSpanInfo[] = []

  for (let index = 0; index < data.length; index++) {
    const currentValue = getRowFieldValue(data[index], rowSpanKey)
    const previousValue = index > 0 ? getRowFieldValue(data[index - 1], rowSpanKey) : undefined

    if (
      index > 0 &&
      currentValue === previousValue &&
      sharesParentGroup(parentStartRows, index)
    ) {
      result.push({ rowSpan: 0, isFirstInGroup: false })
      continue
    }

    let span = 1
    for (let nextIndex = index + 1; nextIndex < data.length; nextIndex++) {
      if (getRowFieldValue(data[nextIndex], rowSpanKey) !== currentValue) break
      if (!sharesParentGroup(parentStartRows, nextIndex)) break
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
  const warnedCycles = new Set<string>()
  const virtualParents = new Map<string, RowSpanInfo[]>()

  const spansForColumn = (columnId: string): RowSpanInfo[] | undefined => {
    const cached = map.get(columnId)
    if (cached !== undefined) return cached

    const column = columnKeys.find((item) => item.columnId === columnId)
    if (!column) return undefined

    if (visiting.has(columnId)) {
      if (!warnedCycles.has(columnId)) {
        warnedCycles.add(columnId)
        console.warn(
          `[rowSpan] rowSpanParent cycle detected at column "${columnId}"; ` +
            "dropping the cyclic parent reference.",
        )
      }
      // Let the caller's `.filter(Boolean)` drop just this cyclic edge.
      return undefined
    }

    visiting.add(columnId)
    const parentSpans = (column.rowSpanParent ?? [])
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
    if (cached !== undefined) return cached

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
