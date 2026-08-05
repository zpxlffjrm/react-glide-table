import type { CellContext } from "@tanstack/react-table"
import { useCallback } from "react"

import { useDataTableRowContext } from "@/components/ui/table/DataTableContext"
import {
  formatDefaultCellValue,
  resolveCellRenderer,
} from "@/components/ui/table/features/cell-render/registry"
import type {
  CellKind,
  CellRenderContext,
  CellRenderFn,
} from "@/components/ui/table/features/cell-render/types"

type ColumnCellMeta<T extends Record<string, unknown>> = {
  kind?: CellKind
  cellProps?: Record<string, unknown>
  cellRender?: CellRenderFn<T>
}

export function ResolvedTableCell<T extends Record<string, unknown>>({
  info,
}: {
  info: CellContext<T, unknown>
}) {
  const { cellRender } = useDataTableRowContext()
  const { row, column, getValue } = info
  const meta = column.columnDef.meta as ColumnCellMeta<T> | undefined
  const value = getValue()
  const columnId = column.id

  const update = useCallback(
    (next: unknown) => {
      cellRender.commitValue(row.id, columnId, next)
    },
    [cellRender, columnId, row.id],
  )

  const ctx = {
    value,
    row,
    index: row.index,
    columnId,
    cellProps: meta?.cellProps,
    update,
  } as CellRenderContext<T>

  if (meta?.cellRender) {
    return meta.cellRender(ctx)
  }

  const renderer = resolveCellRenderer(cellRender.registry, meta?.kind, ctx)
  if (renderer) {
    return renderer.render(ctx as CellRenderContext)
  }

  return formatDefaultCellValue(value)
}
