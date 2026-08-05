import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useRef, useState } from "react"

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
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [draftValue, setDraftValue] = useState("")
  const draftValueRef = useRef(draftValue)
  const editingCellRef = useRef(editingCell)

  useEffect(() => {
    draftValueRef.current = draftValue
  }, [draftValue])

  useEffect(() => {
    editingCellRef.current = editingCell
  }, [editingCell])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
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
      const cell = rows[rowIndex]?.getVisibleCells()[colIndex]
      if (!cell || !isColumnEditable(cell.column.columnDef)) return

      const current = editingCellRef.current
      if (
        current &&
        (current.rowIndex !== rowIndex || current.colIndex !== colIndex) &&
        !commitEdit()
      ) {
        return
      }

      setEditingCell({ rowIndex, colIndex })
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

export type { EditingCell }
