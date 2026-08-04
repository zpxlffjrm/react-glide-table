import { createContext, use, type ReactNode } from "react"

import type { EditingCell } from "@/components/ui/table/features/cell-edit/cellEdit"
import type {
  CellMouseDownOptions,
  CellSelectionBounds,
  DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
import type { ColumnFreezeOffset } from "@/components/ui/table/features/column-freeze/columnFreeze"
import type { SearchResultItem } from "@/components/ui/table/features/inline-search/inlineSearch"
import type { ColumnRowSpanMap } from "@/components/ui/table/features/row-span/rowSpan"
import type { DataTableClassNames, RowSelectionMode } from "@/components/ui/table/types"

type RowData = Record<string, unknown>

export type DataTableRowContextValue = {
  classNames?: DataTableClassNames
  rowSpan: {
    enableRowSpan: boolean
    primaryRowSpanKey?: string
    primaryRowSpanColumnId?: string
    columnRowSpanMap: ColumnRowSpanMap
    hoveredRowIndex: number | null
    selectedRowIndices: Set<number>
    onRowHover: (rowIndex: number, rowData: RowData) => void
  }
  selection: {
    rowSelectionMode: RowSelectionMode
    selectOnRowClick: boolean
    onRowClick?: (row: RowData, index: number) => void
    getRowClassName?: (row: RowData, index: number) => string | undefined
  }
  cellSelection: {
    enableCellSelection: boolean
    activeSelectionBounds: CellSelectionBounds | null
    dragState: DragState
    onCellMouseDown: (
      rowIndex: number,
      colIndex: number,
      options?: CellMouseDownOptions,
    ) => void
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
    expandRowLabel: string
    collapseRowLabel: string
  }
  columnResize: {
    enableColumnResize: boolean
  }
  columnFreeze: {
    enableColumnFreeze: boolean
    offsets: Map<string, ColumnFreezeOffset>
  }
  inlineSearch: {
    enabled: boolean
    matchKeys: Set<string>
    activeMatch: SearchResultItem | null
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
