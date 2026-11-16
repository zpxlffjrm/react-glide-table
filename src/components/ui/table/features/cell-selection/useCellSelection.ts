import type { Row } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"

import { isColumnEditable } from "@/components/ui/table/features/cell-edit/cellEdit"
import type { CellRendererRegistry } from "@/components/ui/table/features/cell-render/registry"
import {
  claimCellSelectionOwner,
  createCellSelectionOwner,
  isActiveCellSelectionOwner,
  registerCellSelectionOwner,
  releaseCellSelectionOwner,
} from "@/components/ui/table/features/cell-selection/activeCellSelectionOwner"
import {
  clampCellPosition,
  getActiveSelectionBounds,
  getCellNavigationDelta,
  getCellSelectionBounds,
  type CellSelectionBounds,
  resolveFillBounds,
  INITIAL_DRAG_STATE,
  type CellMouseDownOptions,
  type CellPosition,
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
import { isOwnSubtreeCopy } from "@/components/ui/table/features/cell-selection/subtreeClipboard"
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
  /** Visible leaf column count used to clamp keyboard navigation. */
  columnCount?: number
  /**
   * Visible leaf column ids in order (any stable string). When it changes
   * (columns reordered, added or removed) the index-based selection would
   * point at different columns, so it is cleared.
   */
  columnSignature?: string
  /** Enables Ctrl/Cmd+Shift+C subtree copy. Defaults to true when tree expand is enabled. */
  enableSubtreeCopy?: boolean
  /** Neutralizes spreadsheet formulas in copied cells. Defaults to false. */
  escapeCopyFormulas?: boolean
  /** Enables Ctrl/Cmd+Shift+V insert paste. Defaults to true. */
  enableInsertPaste?: boolean
  onDataChange?: (data: T[]) => void
  onBatchChange?: (
    changes: Array<{ rowId: string; columnId: string; value: unknown }>,
  ) => void
  onRowsPaste?: (payload: RowsPastePayload) => void
  /** Called after keyboard navigation moves the active (end) cell. */
  onCellNavigate?: (position: CellPosition) => void
  /** Resolves `meta.kind` renderers so copied text matches the visible cell. */
  cellRendererRegistry?: CellRendererRegistry
  /** Scopes copy's DOM image-url lookup to this table when several are mounted at once. */
  rootRef?: RefObject<HTMLElement | null>
  /** W/A/S/D act as arrow keys. Defaults to true. */
  enableWasdNavigation?: boolean
  /** Enter / F2 on the active cell (start editing). */
  onEditKey?: (position: CellPosition) => void
  /** Delete / Backspace over the selection (clear editable cells). */
  onClearKey?: (bounds: CellSelectionBounds) => void
}

const INTERACTIVE_FOCUS_SELECTOR =
  "button, a[href], input, textarea, select, [contenteditable]:not([contenteditable='false'])"

/** A focused button / link inside the table keeps Enter, Space and Delete. */
function isInteractiveFocus(): boolean {
  const active = document.activeElement
  return active instanceof Element && active.matches(INTERACTIVE_FOCUS_SELECTOR)
}

/** Text the user selected on the page outside this table (Ctrl+C belongs to it). */
function hasPageTextSelectionOutside(root: HTMLElement | null | undefined): boolean {
  if (typeof window.getSelection !== "function") return false
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
  if (!selection.toString()) return false
  const anchor = selection.anchorNode
  return !(root && anchor && root.contains(anchor))
}

/**
 * True when something outside this table currently holds focus (e.g. a modal's
 * focus-trap moved `document.activeElement` into its own subtree). Keyboard
 * shortcuts must back off in that case even for non-input focus targets that
 * `isEditablePasteTarget` doesn't catch (custom text displays, dialog containers).
 * `document.body` is treated as "no focus" so shortcuts still work right after a
 * plain cell click, which doesn't itself move focus.
 */
function isFocusOutsideRoot(rootRef: RefObject<HTMLElement | null> | undefined): boolean {
  const root = rootRef?.current
  if (!root) return false

  const active = document.activeElement
  if (!active || active === document.body) return false

  return !root.contains(active)
}

export function useCellSelection<T extends Record<string, unknown>>({
  data,
  rows,
  enabled = true,
  columnCount = 0,
  columnSignature,
  enableSubtreeCopy = false,
  escapeCopyFormulas = false,
  enableInsertPaste = true,
  onDataChange,
  onBatchChange,
  onRowsPaste,
  onCellNavigate,
  cellRendererRegistry,
  rootRef,
  enableWasdNavigation = true,
  onEditKey,
  onClearKey,
}: UseCellSelectionOptions<T>) {
  const ownerRef = useRef(createCellSelectionOwner())
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)
  const pendingPasteModeRef = useRef<PasteMode | null>(null)
  const dragStateRef = useRef(dragState)
  const onCellNavigateRef = useRef(onCellNavigate)

  const onEditKeyRef = useRef(onEditKey)
  const onClearKeyRef = useRef(onClearKey)

  dragStateRef.current = dragState
  onCellNavigateRef.current = onCellNavigate
  onEditKeyRef.current = onEditKey
  onClearKeyRef.current = onClearKey

  // Pointer handlers compute from the ref and write it back immediately, so
  // the native window mouseup listener always sees the latest drag state even
  // before React re-renders.
  const updateDragState = useCallback((update: (prev: DragState) => DragState) => {
    const prev = dragStateRef.current
    const next = update(prev)
    if (next === prev) return

    dragStateRef.current = next
    setDragState(next)
  }, [])

  // Memoized so the window listeners below are not torn down and re-added on
  // every render of the table.
  const activeSelectionBounds = useMemo(() => {
    if (!enabled) return null

    return getActiveSelectionBounds(
      dragState,
      getCellSelectionBounds(dragState.start, dragState.end),
    )
  }, [dragState, enabled])

  const handleCellMouseDown = useCallback(
    (rowIndex: number, colIndex: number, options?: CellMouseDownOptions) => {
      if (!enabled) return

      claimCellSelectionOwner(ownerRef.current)

      updateDragState((prev) => {
        if (options?.shiftKey && prev.start) {
          return {
            ...prev,
            isSelecting: true,
            isFillDragging: false,
            end: { row: rowIndex, col: colIndex },
            fillAnchor: null,
            fillEnd: null,
          }
        }

        return {
          isSelecting: true,
          isFillDragging: false,
          start: { row: rowIndex, col: colIndex },
          end: { row: rowIndex, col: colIndex },
          fillAnchor: null,
          fillEnd: null,
        }
      })
    },
    [enabled, updateDragState],
  )

  const handleCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!enabled) return

      updateDragState((prev) => {
        if (prev.isSelecting) {
          if (prev.end?.row === rowIndex && prev.end.col === colIndex) return prev
          return { ...prev, end: { row: rowIndex, col: colIndex } }
        }

        if (prev.isFillDragging) {
          if (prev.fillEnd?.row === rowIndex && prev.fillEnd.col === colIndex) return prev
          return { ...prev, fillEnd: { row: rowIndex, col: colIndex } }
        }

        return prev
      })
    },
    [enabled, updateDragState],
  )

  const handleFillHandleMouseDown = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!enabled) return

      claimCellSelectionOwner(ownerRef.current)

      updateDragState((prev) => {
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
    [enabled, updateDragState],
  )

  const clearSelection = useCallback(() => {
    const prev = dragStateRef.current
    if (
      prev.start === null &&
      prev.end === null &&
      !prev.isSelecting &&
      !prev.isFillDragging
    ) {
      return
    }

    releaseCellSelectionOwner(ownerRef.current)
    dragStateRef.current = INITIAL_DRAG_STATE
    setDragState(INITIAL_DRAG_STATE)
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearSelection()
    }
  }, [clearSelection, enabled])

  useEffect(() => {
    return registerCellSelectionOwner(ownerRef.current, clearSelection)
  }, [clearSelection])

  // Selection is index-based: when rows shrink below it (data replaced, tree
  // collapsed) or the column layout changes, it would silently point at other
  // cells — and copy/paste/fill would act on them. Drop it instead.
  const previousColumnSignatureRef = useRef(columnSignature)
  useEffect(() => {
    const columnsChanged =
      columnSignature !== undefined &&
      previousColumnSignatureRef.current !== undefined &&
      previousColumnSignatureRef.current !== columnSignature
    previousColumnSignatureRef.current = columnSignature

    const prev = dragStateRef.current
    if (!prev.start || !prev.end) return

    const bounds = getCellSelectionBounds(prev.start, prev.end)
    const resolvedColumnCount =
      columnCount > 0 ? columnCount : (rows[0]?.getVisibleCells().length ?? 0)
    const outOfRange =
      bounds !== null &&
      (bounds.endRow >= rows.length ||
        (resolvedColumnCount > 0 && bounds.endCol >= resolvedColumnCount))

    if (columnsChanged || outOfRange) {
      clearSelection()
    }
  }, [clearSelection, columnCount, columnSignature, rows])

  // A press outside the table hands the keyboard back to the page: arrows,
  // Ctrl+C / Ctrl+V and the rest stop acting on this table's selection until
  // the user clicks (or tabs) back into it. The highlight stays.
  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: Event) => {
      const root = rootRef?.current
      if (!root || !isActiveCellSelectionOwner(ownerRef.current)) return
      if (event.target instanceof Node && root.contains(event.target)) return
      releaseCellSelectionOwner(ownerRef.current)
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("mousedown", handlePointerDown, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("mousedown", handlePointerDown, true)
    }
  }, [enabled, rootRef])

  const getColumnCount = useCallback(
    () => (columnCount > 0 ? columnCount : (rows[0]?.getVisibleCells().length ?? 0)),
    [columnCount, rows],
  )

  /** Select one cell (clamped), claim the keyboard and scroll it into view. */
  const selectCell = useCallback(
    (row: number, col: number) => {
      if (!enabled) return
      const resolvedColumnCount = getColumnCount()
      if (rows.length <= 0 || resolvedColumnCount <= 0) return

      const position = clampCellPosition({ row, col }, rows.length, resolvedColumnCount)
      claimCellSelectionOwner(ownerRef.current)
      const nextState: DragState = {
        isSelecting: false,
        isFillDragging: false,
        start: position,
        end: position,
        fillAnchor: null,
        fillEnd: null,
      }
      dragStateRef.current = nextState
      setDragState(nextState)
      onCellNavigateRef.current?.(position)
    },
    [enabled, getColumnCount, rows.length],
  )

  /** Keyboard focus on the table: take the keyboard, select the first cell if none. */
  const focusSelection = useCallback(() => {
    if (!enabled) return
    const prev = dragStateRef.current
    if (prev.start && prev.end) {
      claimCellSelectionOwner(ownerRef.current)
      return
    }
    selectCell(0, 0)
  }, [enabled, selectCell])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveCellSelectionOwner(ownerRef.current)) return
      if (e.altKey) return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }
      if (isFocusOutsideRoot(rootRef)) return

      const prev = dragStateRef.current
      if (!prev.start || !prev.end) return
      if (prev.isSelecting || prev.isFillDragging) return

      const rowCount = rows.length
      const resolvedColumnCount = getColumnCount()
      if (rowCount <= 0 || resolvedColumnCount <= 0) return

      const withModifier = e.ctrlKey || e.metaKey

      if (withModifier && !e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        claimCellSelectionOwner(ownerRef.current)
        const nextState: DragState = {
          isSelecting: false,
          isFillDragging: false,
          start: { row: 0, col: 0 },
          end: { row: rowCount - 1, col: resolvedColumnCount - 1 },
          fillAnchor: null,
          fillEnd: null,
        }
        dragStateRef.current = nextState
        setDragState(nextState)
        return
      }

      if (e.key === "Home" || e.key === "End") {
        e.preventDefault()
        const toEnd = e.key === "End"
        const target = withModifier
          ? toEnd
            ? { row: rowCount - 1, col: resolvedColumnCount - 1 }
            : { row: 0, col: 0 }
          : { row: prev.end.row, col: toEnd ? resolvedColumnCount - 1 : 0 }
        if (e.shiftKey) {
          const nextState: DragState = { ...prev, end: target, fillAnchor: null, fillEnd: null }
          dragStateRef.current = nextState
          setDragState(nextState)
          onCellNavigateRef.current?.(target)
        } else {
          selectCell(target.row, target.col)
        }
        return
      }

      if (withModifier || isInteractiveFocus()) return

      if (e.key === "Enter" || e.key === "F2") {
        if (!onEditKeyRef.current) return
        e.preventDefault()
        onEditKeyRef.current(prev.end)
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const bounds = getCellSelectionBounds(prev.start, prev.end)
        if (!bounds || !onClearKeyRef.current) return
        e.preventDefault()
        onClearKeyRef.current(bounds)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, getColumnCount, rootRef, rows.length, selectCell])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveCellSelectionOwner(ownerRef.current)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }
      if (isFocusOutsideRoot(rootRef)) return

      if (!enableWasdNavigation && e.key.length === 1) return
      const delta = getCellNavigationDelta(e.key)
      if (!delta) return

      const prev = dragStateRef.current
      if (!prev.start || !prev.end) return
      if (prev.isSelecting || prev.isFillDragging) return

      const rowCount = rows.length
      const resolvedColumnCount =
        columnCount > 0
          ? columnCount
          : (rows[0]?.getVisibleCells().length ?? 0)

      if (rowCount <= 0 || resolvedColumnCount <= 0) return

      const nextEnd = clampCellPosition(
        {
          row: prev.end.row + delta.row,
          col: prev.end.col + delta.col,
        },
        rowCount,
        resolvedColumnCount,
      )

      if (nextEnd.row === prev.end.row && nextEnd.col === prev.end.col) return

      e.preventDefault()

      const nextState: DragState = e.shiftKey
        ? {
            ...prev,
            isSelecting: false,
            isFillDragging: false,
            end: nextEnd,
            fillAnchor: null,
            fillEnd: null,
          }
        : {
            isSelecting: false,
            isFillDragging: false,
            start: nextEnd,
            end: nextEnd,
            fillAnchor: null,
            fillEnd: null,
          }

      // Keep the ref in sync immediately so key-repeat events compose
      // before React re-renders and reassigns dragStateRef from state.
      dragStateRef.current = nextState
      setDragState(nextState)

      onCellNavigateRef.current?.(nextEnd)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [columnCount, enableWasdNavigation, enabled, rows])

  const copySelection = useCallback(
    async (options?: CopySelectionOptions) => {
      if (!enabled || !activeSelectionBounds) return false

      const mode: CopySelectionMode =
        options?.includeDescendants && enableSubtreeCopy ? "subtree" : "visible"

      return writeSelectionToClipboard(rows, activeSelectionBounds, mode, {
        registry: cellRendererRegistry,
        root: rootRef?.current,
        escapeFormulas: escapeCopyFormulas,
      })
    },
    [
      activeSelectionBounds,
      cellRendererRegistry,
      enableSubtreeCopy,
      enabled,
      escapeCopyFormulas,
      rootRef,
      rows,
    ],
  )

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveCellSelectionOwner(ownerRef.current)) return
      if (!activeSelectionBounds) return
      if (!(e.ctrlKey || e.metaKey)) return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }
      if (isFocusOutsideRoot(rootRef)) return

      const isSubtreeShortcut =
        enableSubtreeCopy && e.shiftKey && e.key.toLowerCase() === "c"
      const isVisibleCopyShortcut = !e.shiftKey && e.key.toLowerCase() === "c"

      if (!isSubtreeShortcut && !isVisibleCopyShortcut) return
      if (hasPageTextSelectionOutside(rootRef?.current)) return

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
        // Leading blank cells are tree depth only in this table's own subtree
        // copy; from a spreadsheet they are real (empty) cells.
        { treeDepth: isOwnSubtreeCopy(text) ? "auto" : "none" },
      )
      if (!payload) return false

      // Which target columns the table itself would write (same rule as
      // editing and fill), so the app can skip read-only columns.
      const cells = rows[activeSelectionBounds.startRow]?.getVisibleCells() ?? []
      payload.editableColumnIds = payload.columnIds.filter((columnId) => {
        const cell = cells.find((item) => item.column.id === columnId)
        return cell ? isColumnEditable(cell.column.columnDef) : false
      })

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
      if (!isActiveCellSelectionOwner(ownerRef.current)) return
      if (!activeSelectionBounds) return
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== "v") return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }
      if (isFocusOutsideRoot(rootRef)) return

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
          if (pasteHandledRef.current) {
            // The paste event already handled this keystroke; consume the flag.
            pasteHandledRef.current = false
            return
          }
          if (pendingPasteModeRef.current !== mode) return
          if (!isActiveCellSelectionOwner(ownerRef.current)) return
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
      if (!isActiveCellSelectionOwner(ownerRef.current)) return
      if (!activeSelectionBounds) return
      if (isEditablePasteTarget(e.target) || isEditablePasteTarget(document.activeElement)) {
        return
      }
      if (isFocusOutsideRoot(rootRef)) return

      if (ignoreNextPasteRef.current) {
        ignoreNextPasteRef.current = false
        pendingPasteModeRef.current = null
        return
      }

      // keydown sets the mode for Ctrl/Cmd(+Shift)+V; context-menu paste defaults to overwrite
      const mode = pendingPasteModeRef.current ?? "overwrite"

      if (pasteHandledRef.current) {
        // readText already handled this keystroke. Consume the flag so a later
        // context-menu paste is not swallowed.
        pasteHandledRef.current = false
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

    // Commit callbacks run here, outside any state updater: React may invoke
    // updaters twice (StrictMode), which would apply the fill twice.
    const handleMouseUp = () => {
      const prev = dragStateRef.current
      let next: DragState = prev

      if (prev.isFillDragging && prev.fillEnd) {
        const sourceBounds = getCellSelectionBounds(prev.start, prev.end)

        if (sourceBounds) {
          const newBounds = resolveFillBounds(sourceBounds, prev.fillEnd)

          if (hasFillExtension(sourceBounds, newBounds)) {
            if (onBatchChange) {
              const changes = collectFillChanges(rows, sourceBounds, newBounds)
              if (changes.length > 0) {
                onBatchChange(changes)
              }
            } else if (onDataChange) {
              onDataChange(applyFillData(data, rows, sourceBounds, newBounds))
            }
          }

          next = {
            isSelecting: false,
            isFillDragging: false,
            start: { row: newBounds.startRow, col: newBounds.startCol },
            end: { row: newBounds.endRow, col: newBounds.endCol },
            fillAnchor: null,
            fillEnd: null,
          }
        } else {
          next = { ...prev, isFillDragging: false, fillAnchor: null, fillEnd: null }
        }
      } else if (prev.isSelecting) {
        next = { ...prev, isSelecting: false }
      } else if (prev.isFillDragging) {
        next = { ...prev, isFillDragging: false, fillAnchor: null, fillEnd: null }
      }

      if (next === prev) return

      dragStateRef.current = next
      setDragState(next)
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
    clearSelection,
    copySelection,
    selectCell,
    focusSelection,
  }
}
