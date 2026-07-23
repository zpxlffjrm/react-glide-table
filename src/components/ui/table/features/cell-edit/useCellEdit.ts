import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  applyCellEdit,
  getCellEditDraftValue,
  isColumnEditable,
  type EditingCell,
} from "@/components/ui/table/features/cell-edit/cellEdit"

type UseCellEditOptions<T extends Record<string, unknown>> = {
  data: T[]
  rows: Row<T>[]
  onDataChange?: (data: T[]) => void
}

export function useCellEdit<T extends Record<string, unknown>>({
  data,
  rows,
  onDataChange,
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

      if (!onDataChange) {
        cancelEdit()

        return true
      }

      const value = raw ?? draftValueRef.current
      const next = applyCellEdit(data, rows, current.rowIndex, current.colIndex, value)
      if (!next) return false

      onDataChange(next)
      cancelEdit()

      return true
    },
    [cancelEdit, data, onDataChange, rows],
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
