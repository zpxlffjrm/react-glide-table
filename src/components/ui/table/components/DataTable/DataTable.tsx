import {
  type Row,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table"
import { useCallback, useMemo, useState } from "react"

import { DataTableRow } from "@/components/ui/table/components/DataTable/DataTableRow"
import { DataTableToolbar } from "@/components/ui/table/components/DataTable/DataTableToolbar"
import { CELL_ALIGN_CLASS } from "@/components/ui/table/constants"
import {
  DataTableContextProvider,
  type DataTableRowContextValue,
} from "@/components/ui/table/DataTableContext"
import { useCellEdit } from "@/components/ui/table/features/cell-edit/useCellEdit"
import { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection"
import {
  toggleExpandedRowId,
  useConvertTreeData,
} from "@/components/ui/table/features/row-expand/row-expand"
import {
  applySelectionUpdater,
  resolveRowSelection,
} from "@/components/ui/table/features/row-selection/rowSelection"
import {
  buildColumnRowSpanMap,
  collectRowSpanColumns,
} from "@/components/ui/table/features/row-span/rowSpan"
import type { DataTableProps } from "@/components/ui/table/types"
import { cn } from "@/lib/cn"


function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowSelectionMode = "none",
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  totalCount,
  filteredCount,
  summary,
  toolbar,
  selectionLabel,
  isPending = false,
  emptyText = "데이터가 없습니다.",
  enableRowSpan = false,
  getRowId,
  onRowClick,
  getRowClassName,
  getRowCanSelect,
  selectOnRowClick = true,
  onDataChange,
  className,
  preserveRowSelection = false,
  toggleField,
  childField,
  flattenField,
  expandedRows: controlledExpandedRows,
  onExpandedRowsChange,
  preventExpand = false,
}: DataTableProps<T>) {
  const enableExpand = Boolean(toggleField)
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(() => new Set())
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null)

  const rowSelection = resolveRowSelection(
    rowSelectionMode,
    controlledRowSelection,
    internalRowSelection,
  )

  const expandedRows = controlledExpandedRows ?? internalExpandedRows

  const handleExpandedRowsChange = useCallback(
    (next: Set<string>) => {
      if (onExpandedRowsChange) {
        onExpandedRowsChange(next)

        return
      }

      setInternalExpandedRows(next)
    },
    [onExpandedRowsChange],
  )

  const tableData = useConvertTreeData({
    data,
    enabled: enableExpand,
    toggleField,
    childField,
    flattenField,
    expandedRows,
    onExpandedRowsChange: enableExpand ? handleExpandedRowsChange : undefined,
    preventExpand,
  })

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      rowSelection: rowSelectionMode === "none" ? {} : rowSelection,
    },
    enableRowSelection:
      rowSelectionMode === "none"
        ? false
        : getRowCanSelect
          ? (row) => getRowCanSelect(row.original as T, row.index)
          : true,
    enableMultiRowSelection: rowSelectionMode === "multi",
    onRowSelectionChange: (updater) => {
      if (onRowSelectionChange) {
        onRowSelectionChange((previous) =>
          applySelectionUpdater(rowSelectionMode, updater, previous),
        )

        return
      }

      setInternalRowSelection((previous) =>
        applySelectionUpdater(rowSelectionMode, updater, previous),
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId
      ? (originalRow, index) => getRowId(originalRow as T, index)
      : (_originalRow, index) => String(index),
  })

  const rowSpanColumnKeys = useMemo(() => {
    if (!enableRowSpan) return []

    return collectRowSpanColumns(columns)
  }, [enableRowSpan, columns])

  const primaryRowSpanKey = rowSpanColumnKeys[0]?.rowSpanKey

  const columnRowSpanMap = useMemo(
    () => buildColumnRowSpanMap(tableData, rowSpanColumnKeys),
    [tableData, rowSpanColumnKeys],
  )

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const rows = table.getRowModel().rows

  const selectedGroupKeys = useMemo(() => {
    if (!enableRowSpan || !primaryRowSpanKey) return new Set<string>()

    const keys = new Set<string>()
    for (const selectedRow of selectedRows) {
      const value = selectedRow.original[primaryRowSpanKey]
      if (value !== null && value !== undefined) keys.add(String(value))
    }

    return keys
  }, [enableRowSpan, primaryRowSpanKey, selectedRows])

  const {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
  } = useCellSelection({ data: tableData, rows, onDataChange })

  const { editingCell, draftValue, setDraftValue, startEdit, commitEdit, cancelEdit } = useCellEdit(
    { data: tableData, rows, onDataChange },
  )

  const handleCellMouseDownWithCommit = useCallback(
    (rowIndex: number, colIndex: number) => {
      const isSameEditingCell =
        editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex

      if (editingCell && !isSameEditingCell && !commitEdit()) {
        return
      }

      handleCellMouseDown(rowIndex, colIndex)
    },
    [commitEdit, editingCell, handleCellMouseDown],
  )

  const clearHover = () => {
    setHoveredRowIndex(null)
    setHoveredGroupKey(null)
  }

  const handleRowHover = useCallback(
    (rowIndex: number, rowData: T) => {
      setHoveredRowIndex(rowIndex)
      if (!primaryRowSpanKey) {
        setHoveredGroupKey(null)

        return
      }

      const groupValue = rowData[primaryRowSpanKey]
      setHoveredGroupKey(
        groupValue === null || groupValue === undefined ? null : String(groupValue),
      )
    },
    [primaryRowSpanKey],
  )

  const handleToggleSelect = useCallback(
    (row: Row<T>) => {
      if (!row.getCanSelect()) return

      if (preserveRowSelection && row.getIsSelected()) {
        return
      }

      row.toggleSelected()
    },
    [preserveRowSelection],
  )

  const handleToggleExpand = useCallback(
    (rowKey: string) => {
      if (preventExpand) return

      handleExpandedRowsChange(toggleExpandedRowId(rowKey, expandedRows))
    },
    [preventExpand, handleExpandedRowsChange, expandedRows],
  )

  const rowContextValue = useMemo((): DataTableRowContextValue => {
    return {
      rowSpan: {
        enableRowSpan,
        primaryRowSpanKey,
        columnRowSpanMap,
        hoveredRowIndex,
        hoveredGroupKey,
        selectedGroupKeys,
        onRowHover: handleRowHover as DataTableRowContextValue["rowSpan"]["onRowHover"],
      },
      selection: {
        rowSelectionMode,
        selectOnRowClick,
        onRowClick: onRowClick as DataTableRowContextValue["selection"]["onRowClick"],
        getRowClassName:
          getRowClassName as DataTableRowContextValue["selection"]["getRowClassName"],
      },
      cellSelection: {
        activeSelectionBounds,
        dragState,
        onCellMouseDown: handleCellMouseDownWithCommit,
        onCellMouseEnter: handleCellMouseEnter,
        onFillHandleMouseDown: handleFillHandleMouseDown,
      },
      cellEdit: {
        editingCell,
        draftValue,
        onDraftValueChange: setDraftValue,
        onStartEdit: startEdit,
        onCommitEdit: commitEdit,
        onCancelEdit: cancelEdit,
      },
      expand: {
        enableExpand,
        toggleField,
        expandedRows,
        preventExpand,
        onToggleExpand: handleToggleExpand,
      },
    }
  }, [
    enableRowSpan,
    primaryRowSpanKey,
    columnRowSpanMap,
    hoveredRowIndex,
    hoveredGroupKey,
    selectedGroupKeys,
    handleRowHover,
    rowSelectionMode,
    selectOnRowClick,
    onRowClick,
    getRowClassName,
    activeSelectionBounds,
    dragState,
    handleCellMouseDownWithCommit,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
    editingCell,
    draftValue,
    setDraftValue,
    startEdit,
    commitEdit,
    cancelEdit,
    enableExpand,
    toggleField,
    expandedRows,
    preventExpand,
    handleToggleExpand,
  ])

  if (isPending) {
    return (
      <div className={cn("DataTableJSX", "DataTableJSX--pending", className)}>
        <span className="data-table-loading-text">로딩 중...</span>
      </div>
    )
  }

  return (
    <div className={cn("DataTableJSX", className)}>
      <DataTableToolbar
        filteredCount={filteredCount ?? tableData.length}
        totalCount={totalCount}
        summary={summary}
        selectedCount={selectedCount}
        selectionLabel={selectionLabel}
        toolbar={toolbar}
      />

      <div className="data-table-scroll">
        <table
          className="data-table"
          onDragStart={(event) => event.preventDefault()}>
          <thead className="data-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="data-table-head-row">
                {headerGroup.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align ?? "center"
                  const headerClassName = header.column.columnDef.meta?.headerClassName

                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        "data-table-head-cell",
                        CELL_ALIGN_CLASS[align],
                        headerClassName,
                      )}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <DataTableContextProvider value={rowContextValue}>
            <tbody onMouseLeave={clearHover} className="data-table-body">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getAllLeafColumns().length || 1}
                    className="data-table-empty-cell">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    onToggleSelect={() => handleToggleSelect(row)}
                  />
                ))
              )}
            </tbody>
          </DataTableContextProvider>
        </table>
      </div>
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
