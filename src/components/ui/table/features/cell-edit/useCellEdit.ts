import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  getCellEditDraftValue,
  getColumnEditType,
  isColumnEditable,
  parseCellEditValue,
  type EditingCell,
} from "@/components/ui/table/features/cell-edit/cellEdit"
import { commitCellValue } from "@/components/ui/table/features/cell-render/commitCellValue"

type UseCellEditOptions<T extends Record<string, unknown>> = {
  data: T[]
  rows: Row<T>[]
  onDataChange?: (data: T[]) => void
  onCellChange?: (rowId: string, columnId: string, value: unknown) => void
}

export function useCellEdit<T extends Record<string, unknown>>({
  data,
  rows,
  onDataChange,
  onCellChange,
}: UseCellEditOptions<T>) {
  // The edited cell is tracked by row id + column id, not by position:
  // rows inserted above, a re-sort or a collapse must not move the editor
  // (and its draft) onto a different row.
  const [editingKey, setEditingKey] = useState<EditingKey | null>(null)
  const [draftValue, setDraftValue] = useState("")
  const draftValueRef = useRef(draftValue)

  useEffect(() => {
    draftValueRef.current = draftValue
  }, [draftValue])

  const editingCell = useMemo<EditingCell | null>(
    () => resolveEditingCell(rows, editingKey),
    [rows, editingKey],
  )
  const editingCellRef = useRef(editingCell)
  editingCellRef.current = editingCell

  // The edited row (or column) is gone: drop the editor instead of letting it
  // land on whatever now sits at the old position.
  useEffect(() => {
    if (editingKey && !editingCell) {
      setEditingKey(null)
      setDraftValue("")
    }
  }, [editingCell, editingKey])

  const cancelEdit = useCallback(() => {
    editingCellRef.current = null
    setEditingKey(null)
    setDraftValue("")
  }, [])

  const commitEdit = useCallback(
    (raw?: string) => {
      const current = editingCellRef.current
      if (!current) return true

      if (!onCellChange && !onDataChange) {
        cancelEdit()

        return true
      }

      const row = rows[current.rowIndex]
      const cell = row?.getVisibleCells()[current.colIndex]
      if (!row || !cell) {
        cancelEdit()

        return true
      }

      if (!isColumnEditable(cell.column.columnDef)) {
        cancelEdit()

        return true
      }

      const value = raw ?? draftValueRef.current
      const parsed = parseCellEditValue(value, getColumnEditType(cell.column.columnDef))
      if (!parsed.ok) return false

      const committed = commitCellValue({
        data,
        rows,
        rowId: row.id,
        columnId: cell.column.id,
        value: parsed.value,
        onCellChange,
        onDataChange,
      })
      if (!committed) return false

      cancelEdit()

      return true
    },
    [cancelEdit, data, onCellChange, onDataChange, rows],
  )

  const startEdit = useCallback(
    (rowIndex: number, colIndex: number) => {
      const row = rows[rowIndex]
      const cell = row?.getVisibleCells()[colIndex]
      if (!row || !cell || !isColumnEditable(cell.column.columnDef)) return
      // Objects/arrays have no faithful text form: editing them would write
      // "[object Object]" / "a,b" back over the structured value.
      if (!isTextEditableValue(cell.getValue())) return

      const current = editingCellRef.current
      if (
        current &&
        (current.rowIndex !== rowIndex || current.colIndex !== colIndex) &&
        !commitEdit()
      ) {
        return
      }

      setEditingKey({ rowId: row.id, columnId: cell.column.id })
      setDraftValue(getCellEditDraftValue(cell.getValue()))
    },
    [commitEdit, rows],
  )

  return {
    editingCell,
    draftValue,
    setDraftValue,
    startEdit,
    commitEdit,
    cancelEdit,
  }
}

type EditingKey = { rowId: string; columnId: string }

function resolveEditingCell<T extends Record<string, unknown>>(
  rows: Row<T>[],
  key: EditingKey | null,
): EditingCell | null {
  if (!key) return null

  const rowIndex = rows.findIndex((row) => row.id === key.rowId)
  if (rowIndex < 0) return null

  const colIndex = rows[rowIndex]!
    .getVisibleCells()
    .findIndex((cell) => cell.column.id === key.columnId)
  if (colIndex < 0) return null

  return { rowIndex, colIndex }
}

function isTextEditableValue(value: unknown): boolean {
  return value === null || value === undefined || typeof value !== "object"
}

export type { EditingCell }
