import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useState } from "react"

import {
  getActiveSelectionBounds,
  getCellSelectionBounds,
  INITIAL_DRAG_STATE,
  type DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
import {
  applyFillData,
  hasFillExtension,
} from "@/components/ui/table/features/cell-selection/fillData"

type UseCellSelectionOptions<T extends Record<string, unknown>> = {
  data: T[]
  rows: Row<T>[]
  onDataChange?: (data: T[]) => void
}

export function useCellSelection<T extends Record<string, unknown>>({
  data,
  rows,
  onDataChange,
}: UseCellSelectionOptions<T>) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)

  const cellSelectionBounds = getCellSelectionBounds(dragState.start, dragState.end)
  const activeSelectionBounds = getActiveSelectionBounds(dragState, cellSelectionBounds)

  const handleCellMouseDown = useCallback((rowIndex: number, colIndex: number) => {
    setDragState({
      isSelecting: true,
      isFillDragging: false,
      start: { row: rowIndex, col: colIndex },
      end: { row: rowIndex, col: colIndex },
      fillAnchor: null,
      fillEnd: null,
    })
  }, [])

  const handleCellMouseEnter = useCallback((rowIndex: number, colIndex: number) => {
    setDragState((prev) => {
      if (prev.isSelecting) {
        return { ...prev, end: { row: rowIndex, col: colIndex } }
      }

      if (prev.isFillDragging) {
        return { ...prev, fillEnd: { row: rowIndex, col: colIndex } }
      }

      return prev
    })
  }, [])

  const handleFillHandleMouseDown = useCallback((rowIndex: number, colIndex: number) => {
    setDragState((prev) => {
      const bounds = getCellSelectionBounds(prev.start, prev.end)
      if (!bounds) return prev

      return {
        ...prev,
        isSelecting: false,
        isFillDragging: true,
        fillAnchor: { row: bounds.startRow, col: bounds.startCol },
        fillEnd: { row: rowIndex, col: colIndex },
      }
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && activeSelectionBounds) {
        const { startRow, endRow, startCol, endCol } = activeSelectionBounds

        const selectedData = rows
          .slice(startRow, endRow + 1)
          .map((row) => {
            const cells = row.getVisibleCells()

            return cells
              .slice(startCol, endCol + 1)
              .map((cell) => cell.getValue() as string)
              .join("\t")
          })
          .join("\n")

        navigator.clipboard.writeText(selectedData)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeSelectionBounds, rows])

  useEffect(() => {
    const handleMouseUp = () => {
      setDragState((prev) => {
        if (prev.isFillDragging && prev.fillAnchor && prev.fillEnd) {
          const sourceBounds = getCellSelectionBounds(prev.start, prev.end)
          const newBounds = getCellSelectionBounds(prev.fillAnchor, prev.fillEnd)

          if (newBounds) {
            if (hasFillExtension(sourceBounds, newBounds) && sourceBounds && onDataChange) {
              onDataChange(applyFillData(data, rows, sourceBounds, newBounds))
            }

            return {
              isSelecting: false,
              isFillDragging: false,
              start: { row: newBounds.startRow, col: newBounds.startCol },
              end: { row: newBounds.endRow, col: newBounds.endCol },
              fillAnchor: null,
              fillEnd: null,
            }
          }
        }

        if (prev.isSelecting) {
          return { ...prev, isSelecting: false }
        }

        if (prev.isFillDragging) {
          return { ...prev, isFillDragging: false, fillAnchor: null, fillEnd: null }
        }

        return prev
      })
    }

    window.addEventListener("mouseup", handleMouseUp)

    return () => window.removeEventListener("mouseup", handleMouseUp)
  }, [data, onDataChange, rows])

  return {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
  }
}
