import { createContext, use, type ReactNode } from "react"

import type { EditingCell } from "@/components/ui/table/features/cell-edit/cellEdit"
import type {
  CellSelectionBounds,
  DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
import type { ColumnRowSpanMap } from "@/components/ui/table/features/row-span/rowSpan"
import type { RowSelectionMode } from "@/components/ui/table/types"

type RowData = Record<string, unknown>

export type DataTableRowContextValue = {
  rowSpan: {
    enableRowSpan: boolean
    primaryRowSpanKey?: string
    columnRowSpanMap: ColumnRowSpanMap
    hoveredRowIndex: number | null
    hoveredGroupKey: string | null
    selectedGroupKeys: Set<string>
    onRowHover: (rowIndex: number, rowData: RowData) => void
  }
  selection: {
    rowSelectionMode: RowSelectionMode
    selectOnRowClick: boolean
    onRowClick?: (row: RowData, index: number) => void
    getRowClassName?: (row: RowData, index: number) => string | undefined
  }
  cellSelection: {
    activeSelectionBounds: CellSelectionBounds | null
    dragState: DragState
    onCellMouseDown: (rowIndex: number, colIndex: number) => void
    onCellMouseEnter: (rowIndex: number, colIndex: number) => void
    onFillHandleMouseDown: (rowIndex: number, colIndex: number) => void
  }
  cellEdit: {
    editingCell: EditingCell | null
    draftValue: string
    onDraftValueChange: (value: string) => void
    onStartEdit: (rowIndex: number, colIndex: number) => void
    onCommitEdit: (raw?: string) => boolean
    onCancelEdit: () => void
  }
  expand: {
    enableExpand: boolean
    toggleField?: string
    expandedRows?: Set<string>
    preventExpand: boolean
    onToggleExpand?: (rowKey: string) => void
  }
}

const DataTableContext = createContext<DataTableRowContextValue | null>(null)

export function useDataTableRowContext() {
  const context = use(DataTableContext)

  if (!context) {
    throw new Error("useDataTableRowContext must be used within a DataTableContextProvider")
  }

  return context
}

export function DataTableContextProvider({
  value,
  children,
}: {
  value: DataTableRowContextValue
  children: ReactNode
}) {
  return <DataTableContext value={value}>{children}</DataTableContext>
}
