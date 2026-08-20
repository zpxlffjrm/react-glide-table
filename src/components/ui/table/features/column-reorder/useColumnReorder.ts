import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { DATA_TABLE_COLUMN_REORDER_THRESHOLD } from "@/components/ui/table/constants"
import {
  moveColumnIds,
  parseReorderIds,
  resolveDropEdge,
  type ColumnDropEdge,
} from "@/components/ui/table/features/column-reorder/columnReorder"

export type ColumnReorderDropTarget = {
  columnId: string
  edge: ColumnDropEdge
}

type DragSession = {
  pointerId: number
  startX: number
  startY: number
  columnId: string
  fromIds: string[]
  table: HTMLTableElement
  active: boolean
}

function hitTestReorderHeader(
  table: HTMLTableElement,
  clientX: number,
  clientY: number,
): ColumnReorderDropTarget | null {
  const headers = Array.from(
    table.querySelectorAll<HTMLElement>(
      "thead th[data-column-id][data-reorder-ids]",
    ),
  )

  const containing = headers.find((element) => {
    const rect = element.getBoundingClientRect()
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    )
  })

  if (containing) {
    return {
      columnId: containing.dataset.columnId ?? "",
      edge: resolveDropEdge(clientX, containing.getBoundingClientRect()),
    }
  }

  const leaves = headers.filter((element) =>
    element.hasAttribute("data-reorder-leaf"),
  )
  let match: HTMLElement | undefined

  for (const element of leaves) {
    const rect = element.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) {
      match = element
      break
    }
  }

  if (!match && leaves.length > 0) {
    const first = leaves[0]!.getBoundingClientRect()
    const last = leaves[leaves.length - 1]!.getBoundingClientRect()
    if (clientX < first.left) match = leaves[0]
    else if (clientX > last.right) match = leaves[leaves.length - 1]
  }

  if (!match) return null

  return {
    columnId: match.dataset.columnId ?? "",
    edge: resolveDropEdge(clientX, match.getBoundingClientRect()),
  }
}

function readTargetIds(
  table: HTMLTableElement,
  columnId: string,
): string[] {
  const element = table.querySelector<HTMLElement>(
    `thead th[data-column-id="${CSS.escape(columnId)}"]`,
  )

  return parseReorderIds(element?.getAttribute("data-reorder-ids"))
}

export function useColumnReorder(options: {
  enabled: boolean
  columnOrder: readonly string[]
  onColumnOrderChange: (next: string[]) => void
}) {
  const { enabled, columnOrder, onColumnOrderChange } = options
  const sessionRef = useRef<DragSession | null>(null)
  const columnOrderRef = useRef(columnOrder)
  const onColumnOrderChangeRef = useRef(onColumnOrderChange)
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnReorderDropTarget | null>(
    null,
  )
  const dropTargetRef = useRef(dropTarget)

  columnOrderRef.current = columnOrder
  onColumnOrderChangeRef.current = onColumnOrderChange
  dropTargetRef.current = dropTarget

  const resetDrag = useCallback(() => {
    sessionRef.current = null
    setDraggingColumnId(null)
    setDropTarget(null)
    document.body.style.removeProperty("user-select")
  }, [])

  useEffect(() => {
    if (!enabled) resetDrag()
  }, [enabled, resetDrag])

  useEffect(() => {
    return () => {
      document.body.style.removeProperty("user-select")
    }
  }, [])

  const onHeaderPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLTableCellElement>,
      meta: { columnId: string; leafIds: string[]; canDrag: boolean },
    ) => {
      if (!enabled || !meta.canDrag) return
      if (event.button !== 0) return
      if (event.pointerType === "mouse" && event.ctrlKey) return

      const target = event.target
      if (
        target instanceof Element &&
        target.closest("[data-table-disable-cell-selection]")
      ) {
        return
      }

      const table = event.currentTarget.closest("table")
      if (!(table instanceof HTMLTableElement)) return

      sessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        columnId: meta.columnId,
        fromIds: meta.leafIds,
        table,
        active: false,
      }
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) return

    const onPointerMove = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      const deltaX = event.clientX - session.startX
      const deltaY = event.clientY - session.startY
      const distance = Math.hypot(deltaX, deltaY)

      if (!session.active) {
        if (distance < DATA_TABLE_COLUMN_REORDER_THRESHOLD) return
        session.active = true
        document.body.style.userSelect = "none"
        setDraggingColumnId(session.columnId)
      }

      event.preventDefault()

      const nextTarget = hitTestReorderHeader(
        session.table,
        event.clientX,
        event.clientY,
      )
      if (!nextTarget || !nextTarget.columnId) {
        setDropTarget(null)
        return
      }

      const targetIds = readTargetIds(session.table, nextTarget.columnId)
      const fromSet = new Set(session.fromIds)
      if (targetIds.some((id) => fromSet.has(id))) {
        setDropTarget(null)
        return
      }

      setDropTarget((previous) => {
        if (
          previous?.columnId === nextTarget.columnId &&
          previous.edge === nextTarget.edge
        ) {
          return previous
        }

        return nextTarget
      })
    }

    const onPointerUp = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) {
        return
      }

      if (session.active) {
        event.preventDefault()
        const target = dropTargetRef.current
        if (target) {
          const targetIds = readTargetIds(session.table, target.columnId)
          const next = moveColumnIds(
            columnOrderRef.current,
            session.fromIds,
            targetIds,
            target.edge,
          )
          onColumnOrderChangeRef.current(next)
        }

        const suppressClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault()
          clickEvent.stopPropagation()
          document.removeEventListener("click", suppressClick, true)
        }
        document.addEventListener("click", suppressClick, true)
        window.setTimeout(() => {
          document.removeEventListener("click", suppressClick, true)
        }, 0)
      }

      resetDrag()
    }

    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    document.addEventListener("pointercancel", onPointerUp)

    return () => {
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerup", onPointerUp)
      document.removeEventListener("pointercancel", onPointerUp)
    }
  }, [enabled, resetDrag])

  return {
    isReordering: draggingColumnId != null,
    draggingColumnId,
    dropTarget,
    onHeaderPointerDown,
  }
}
