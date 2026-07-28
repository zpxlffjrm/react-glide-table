import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  getActiveSelectionBounds,
  getCellSelectionBounds,
  INITIAL_DRAG_STATE,
  type DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
import {
  type CopySelectionMode,
  writeSelectionToClipboard,
} from "@/components/ui/table/features/cell-selection/copyData"
import {
  applyFillData,
  collectFillChanges,
  hasFillExtension,
} from "@/components/ui/table/features/cell-selection/fillData"
import {
  buildRowsPastePayload,
  isEditablePasteTarget,
  type PasteMode,
  type RowsPastePayload,
} from "@/components/ui/table/features/cell-selection/pasteData"

export type CopySelectionOptions = {
  /** When true, collapsed tree descendants are included. Defaults to false. */
  includeDescendants?: boolean
}

type UseCellSelectionOptions<T extends Record<string, unknown>> = {
  data: T[]
  rows: Row<T>[]
  enabled?: boolean
  /** Enables Ctrl/Cmd+Shift+C subtree copy. Defaults to true when tree expand is enabled. */
  enableSubtreeCopy?: boolean
  /** Enables Ctrl/Cmd+Shift+V insert paste. Defaults to true. */
  enableInsertPaste?: boolean
  onDataChange?: (data: T[]) => void
  onBatchChange?: (
    changes: Array<{ rowId: string; columnId: string; value: unknown }>,
  ) => void
  onRowsPaste?: (payload: RowsPastePayload) => void
}

export function useCellSelection<T extends Record<string, unknown>>({
  data,
  rows,
  enabled = true,
  enableSubtreeCopy = false,
  enableInsertPaste = true,
  onDataChange,
  onBatchChange,
  onRowsPaste,
}: UseCellSelectionOptions<T>) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)
  const pendingPasteModeRef = useRef<PasteMode | null>(null)

  const cellSelectionBounds = getCellSelectionBounds(dragState.start, dragState.end)
  const activeSelectionBounds = enabled
    ? getActiveSelectionBounds(dragState, cellSelectionBounds)
    : null

  const handleCellMouseDown = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!enabled) return

      setDragState({
        isSelecting: true,
        isFillDragging: false,
        start: { row: rowIndex, col: colIndex },
        end: { row: rowIndex, col: colIndex },
        fillAnchor: null,
        fillEnd: null,
      })
    },
    [enabled],
  )

  const handleCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!enabled) return

      setDragState((prev) => {
        if (prev.isSelecting) {
          return { ...prev, end: { row: rowIndex, col: colIndex } }
        }

        if (prev.isFillDragging) {
          return { ...prev, fillEnd: { row: rowIndex, col: colIndex } }
        }

        return prev
      })
    },
    [enabled],
  )

  const handleFillHandleMouseDown = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!enabled) return

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
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) {
      setDragState(INITIAL_DRAG_STATE)
    }
  }, [enabled])

  const copySelection = useCallback(
    async (options?: CopySelectionOptions) => {
      if (!enabled || !activeSelectionBounds) return false

      const mode: CopySelectionMode =
        options?.includeDescendants && enableSubtreeCopy ? "subtree" : "visible"

      return writeSelectionToClipboard(rows, activeSelectionBounds, mode)
    },
    [activeSelectionBounds, enableSubtreeCopy, enabled, rows],
  )

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeSelectionBounds) return
      if (!(e.ctrlKey || e.metaKey)) return

      const isSubtreeShortcut =
        enableSubtreeCopy && e.shiftKey && e.key.toLowerCase() === "c"
      const isVisibleCopyShortcut = !e.shiftKey && e.key.toLowerCase() === "c"

      if (!isSubtreeShortcut && !isVisibleCopyShortcut) return

      e.preventDefault()
      void copySelection({ includeDescendants: isSubtreeShortcut })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeSelectionBounds, copySelection, enableSubtreeCopy, enabled])

  const emitRowsPaste = useCallback(
    (text: string, mode: PasteMode) => {
      if (!onRowsPaste || !activeSelectionBounds) return false

      const payload = buildRowsPastePayload(
        rows,
        activeSelectionBounds.startRow,
        activeSelectionBounds.startCol,
        text,
        mode,
        activeSelectionBounds.endRow,
      )
      if (!payload) return false

      onRowsPaste(payload)
      return true
    },
    [activeSelectionBounds, onRowsPaste, rows],
  )

  useEffect(() => {
    if (!enabled || !onRowsPaste) return

    const pasteHandledRef = { current: false }
    const ignoreNextPasteRef = { current: false }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeSelectionBounds) return
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== "v") return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }

      if (e.shiftKey && !enableInsertPaste) {
        ignoreNextPasteRef.current = true
        pendingPasteModeRef.current = null
        return
      }

      const mode: PasteMode = e.shiftKey ? "insert" : "overwrite"
      pasteHandledRef.current = false
      ignoreNextPasteRef.current = false
      pendingPasteModeRef.current = mode

      void (async () => {
        try {
          const text = await navigator.clipboard.readText()
          if (pasteHandledRef.current) return
          if (pendingPasteModeRef.current !== mode) return
          if (!text) return

          pasteHandledRef.current = true
          emitRowsPaste(text, mode)
          pendingPasteModeRef.current = null
        } catch {
          // Fall back to the paste event's clipboardData.
        }
      })()
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (!activeSelectionBounds) return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }

      if (ignoreNextPasteRef.current) {
        ignoreNextPasteRef.current = false
        pendingPasteModeRef.current = null
        return
      }

      // keydown sets the mode for Ctrl/Cmd(+Shift)+V; context-menu paste defaults to overwrite
      const mode = pendingPasteModeRef.current ?? "overwrite"

      if (pasteHandledRef.current) {
        e.preventDefault()
        return
      }

      const text = e.clipboardData?.getData("text/plain")
      if (text == null || text === "") return

      pasteHandledRef.current = true
      e.preventDefault()
      emitRowsPaste(text, mode)
      pendingPasteModeRef.current = null
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("paste", handlePaste)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("paste", handlePaste)
    }
  }, [
    activeSelectionBounds,
    emitRowsPaste,
    enableInsertPaste,
    enabled,
    onRowsPaste,
  ])

  useEffect(() => {
    if (!enabled) return

    const handleMouseUp = () => {
      setDragState((prev) => {
        if (prev.isFillDragging && prev.fillAnchor && prev.fillEnd) {
          const sourceBounds = getCellSelectionBounds(prev.start, prev.end)
          const newBounds = getCellSelectionBounds(prev.fillAnchor, prev.fillEnd)

          if (newBounds) {
            if (hasFillExtension(sourceBounds, newBounds) && sourceBounds) {
              if (onBatchChange) {
                const changes = collectFillChanges(rows, sourceBounds, newBounds)
                if (changes.length > 0) {
                  onBatchChange(changes)
                }
              } else if (onDataChange) {
                onDataChange(applyFillData(data, rows, sourceBounds, newBounds))
              }
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
  }, [data, enabled, onBatchChange, onDataChange, rows])

  return {
    dragState: enabled ? dragState : INITIAL_DRAG_STATE,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
    copySelection,
  }
}
