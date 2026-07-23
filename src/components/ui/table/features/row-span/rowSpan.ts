import type { ColumnDef } from "@tanstack/react-table"

export type RowSpanInfo = {
  /** 0이면 렌더 생략(상위 행에 병합됨) */
  rowSpan: number
  isFirstInGroup: boolean
}

function getRowFieldValue<T extends Record<string, unknown>>(row: T, key: string): unknown {
  return row[key]
}

/**
 * 연속된 동일 rowSpanKey 값을 기준으로 세로 병합 정보를 계산합니다.
 */
export function computeRowSpans<T extends Record<string, unknown>>(
  data: T[],
  rowSpanKey: string,
): RowSpanInfo[] {
  if (data.length === 0) return []

  const result: RowSpanInfo[] = []

  for (let index = 0; index < data.length; index++) {
    const currentValue = getRowFieldValue(data[index], rowSpanKey)
    const previousValue = index > 0 ? getRowFieldValue(data[index - 1], rowSpanKey) : undefined

    if (index > 0 && currentValue === previousValue) {
      result.push({ rowSpan: 0, isFirstInGroup: false })
      continue
    }

    let span = 1
    for (let nextIndex = index + 1; nextIndex < data.length; nextIndex++) {
      if (getRowFieldValue(data[nextIndex], rowSpanKey) === currentValue) {
        span++
      } else {
        break
      }
    }

    result.push({ rowSpan: span, isFirstInGroup: true })
  }

  return result
}

export type ColumnRowSpanMap = Map<string, RowSpanInfo[]>

/**
 * rowSpan meta가 있는 컬럼별 병합 정보를 한 번에 계산합니다.
 */
export function buildColumnRowSpanMap<T extends Record<string, unknown>>(
  data: T[],
  columnKeys: Array<{ columnId: string; rowSpanKey: string }>,
): ColumnRowSpanMap {
  const map: ColumnRowSpanMap = new Map()

  for (const { columnId, rowSpanKey } of columnKeys) {
    map.set(columnId, computeRowSpans(data, rowSpanKey))
  }

  return map
}

export function collectRowSpanColumns<T extends Record<string, unknown>>(
  columns: ColumnDef<T, unknown>[],
): Array<{ columnId: string; rowSpanKey: string }> {
  const result: Array<{ columnId: string; rowSpanKey: string }> = []

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
      })
    }
  }

  visit(columns)

  return result
}
