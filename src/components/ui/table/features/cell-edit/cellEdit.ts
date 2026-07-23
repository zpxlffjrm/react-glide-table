import type { Row } from "@tanstack/react-table"

import type { CellEditType } from "@/components/ui/table/types"

export type EditingCell = {
  rowIndex: number
  colIndex: number
}

type ColumnDefLike = {
  id?: string
  accessorKey?: unknown
  meta?: {
    editable?: boolean
    editType?: CellEditType
  }
}

export function getColumnAccessorKey(columnDef: ColumnDefLike): string | undefined {
  if (columnDef.accessorKey !== undefined && columnDef.accessorKey !== null) {
    return String(columnDef.accessorKey)
  }

  return columnDef.id
}

export function isColumnEditable(columnDef: ColumnDefLike): boolean {
  return Boolean(columnDef.meta?.editable)
}

export function getColumnEditType(columnDef: ColumnDefLike): CellEditType {
  return columnDef.meta?.editType ?? "text"
}

export function parseCellEditValue(
  raw: string,
  editType: CellEditType,
): { ok: true; value: string | number | null } | { ok: false } {
  if (editType === "text") {
    return { ok: true, value: raw }
  }

  const trimmed = raw.trim()
  if (trimmed === "") {
    return { ok: true, value: null }
  }

  const parsed = Number(trimmed)
  if (Number.isNaN(parsed)) {
    return { ok: false }
  }

  return { ok: true, value: parsed }
}

export function getCellEditDraftValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  return String(value)
}

/** 성공 시 갱신된 데이터, 파싱 실패·편집 불가 시 null */
export function applyCellEdit<T extends Record<string, unknown>>(
  data: T[],
  rows: Row<T>[],
  rowIndex: number,
  colIndex: number,
  raw: string,
): T[] | null {
  const cell = rows[rowIndex]?.getVisibleCells()[colIndex]
  if (!cell) return null

  const columnDef = cell.column.columnDef as ColumnDefLike
  if (!isColumnEditable(columnDef)) return null

  const accessorKey = getColumnAccessorKey(columnDef)
  if (!accessorKey) return null

  const parsed = parseCellEditValue(raw, getColumnEditType(columnDef))
  if (!parsed.ok) return null

  const newData = data.map((row) => ({ ...row }))
  if (!newData[rowIndex]) return null

  ;(newData[rowIndex] as Record<string, unknown>)[accessorKey] = parsed.value

  return newData
}
