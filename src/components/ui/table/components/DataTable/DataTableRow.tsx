import { flexRender, type Row } from "@tanstack/react-table"
import { useEffect, useRef } from "react"

import {
  CELL_ALIGN_CLASS,
  CELL_SELECTION_FILL_CLASS,
  ROW_HOVER_CLASS,
  ROW_HOVERED_BG_CLASS,
} from "@/components/ui/table/constants"
import { useDataTableRowContext } from "@/components/ui/table/DataTableContext"
import {
  getColumnEditType,
  isColumnEditable,
} from "@/components/ui/table/features/cell-edit/cellEdit"
import {
  getCellSelectionEdgeStyle,
  getRowIndexInMergedCell,
  isCellInSelection,
} from "@/components/ui/table/features/cell-selection/cellSelection"
import { canExpandRow } from "@/components/ui/table/features/row-expand/row-expand"
import type { RowSpanInfo } from "@/components/ui/table/features/row-span/rowSpan"
import { ChevronDown, ChevronUp } from "@/components/ui/table/components/icons"
import { cn } from "@/lib/cn"


export type DataTableRowProps<T extends Record<string, unknown>> = {
  row: Row<T>
  onToggleSelect: () => void
}

function resolveExpandCellIndex<T extends Record<string, unknown>>(
  cells: ReturnType<Row<T>["getVisibleCells"]>,
  toggleField?: string,
): number {
  if (!toggleField) return 0

  const matchedIndex = cells.findIndex((cell) => cell.column.id === toggleField)
  if (matchedIndex >= 0) return matchedIndex

  const noColumnIndex = cells.findIndex(
    (cell) => cell.column.id === "no" || cell.column.id === "treeNo",
  )
  if (noColumnIndex >= 0 && noColumnIndex + 1 < cells.length) {
    return noColumnIndex + 1
  }

  return 0
}

export function DataTableRow<T extends Record<string, unknown>>({
  row,
  onToggleSelect,
}: DataTableRowProps<T>) {
  const { rowSpan, selection, cellSelection, cellEdit, expand } = useDataTableRowContext()

  const {
    enableRowSpan,
    primaryRowSpanKey,
    columnRowSpanMap,
    hoveredRowIndex,
    hoveredGroupKey,
    selectedGroupKeys,
    onRowHover,
  } = rowSpan

  const { rowSelectionMode, selectOnRowClick, onRowClick, getRowClassName } = selection

  const {
    activeSelectionBounds,
    dragState,
    onCellMouseDown,
    onCellMouseEnter,
    onFillHandleMouseDown,
  } = cellSelection

  const { editingCell, draftValue, onDraftValueChange, onStartEdit, onCommitEdit, onCancelEdit } =
    cellEdit

  const { enableExpand, toggleField, expandedRows, preventExpand, onToggleExpand } = expand

  const rowIndex = row.index
  const rowData = row.original
  const isRowHovered = hoveredRowIndex === rowIndex
  const isRowSelected = row.getIsSelected()
  const rowGroupKey =
    primaryRowSpanKey !== undefined &&
    rowData[primaryRowSpanKey] !== null &&
    rowData[primaryRowSpanKey] !== undefined
      ? String(rowData[primaryRowSpanKey])
      : null
  const isGroupHovered =
    enableRowSpan && hoveredGroupKey !== null && rowGroupKey === hoveredGroupKey
  const isGroupSelected =
    enableRowSpan && rowGroupKey !== null && selectedGroupKeys.has(rowGroupKey)

  const visibleCells = row.getVisibleCells()
  const expandCellIndex = enableExpand ? resolveExpandCellIndex(visibleCells, toggleField) : -1
  const canExpand = enableExpand && !preventExpand && canExpandRow(rowData)
  const expandKey =
    toggleField && rowData[toggleField] !== null && rowData[toggleField] !== undefined
      ? String(rowData[toggleField])
      : null
  const isExpanded = expandKey !== null && Boolean(expandedRows?.has(expandKey))
  const rowLevel = typeof rowData.level === "number" ? rowData.level : 0
  const editInputRef = useRef<HTMLInputElement>(null)
  const isRowEditing = editingCell?.rowIndex === rowIndex

  useEffect(() => {
    if (!isRowEditing) return

    editInputRef.current?.focus()
    editInputRef.current?.select()
  }, [isRowEditing, editingCell?.colIndex])

  return (
    <tr
      className={cn(
        "DataTableRowJSX",
        !enableRowSpan && ROW_HOVER_CLASS,
        enableRowSpan && isRowHovered && !isRowSelected && ROW_HOVERED_BG_CLASS,
        isRowSelected && "is-selected",
        enableExpand && canExpand && "is-expandable",
        getRowClassName?.(rowData, rowIndex),
      )}
      onMouseEnter={() => onRowHover(rowIndex, rowData)}
      onClick={() => {
        if (isRowEditing) return

        onRowClick?.(rowData, rowIndex)
        if (rowSelectionMode !== "none" && selectOnRowClick) {
          onToggleSelect()
        }
      }}>
      {visibleCells.map((cell, cellIndex) => {
        const columnId = cell.column.id
        const meta = cell.column.columnDef.meta
        const align = meta?.align ?? "center"
        const cellClassName = meta?.className
        const isRowSpanColumn = Boolean(enableRowSpan && meta?.rowSpan)
        const isExpandCell = cellIndex === expandCellIndex
        const editable = isColumnEditable(cell.column.columnDef)
        const editType = getColumnEditType(cell.column.columnDef)

        let rowSpanInfo: RowSpanInfo | undefined
        if (isRowSpanColumn) {
          rowSpanInfo = columnRowSpanMap.get(columnId)?.[rowIndex]
          if (rowSpanInfo && rowSpanInfo.rowSpan === 0) {
            return null
          }
        }

        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === cellIndex

        const showCellHover = isRowSpanColumn ? isGroupHovered : isRowHovered
        const showCellSelected = isRowSpanColumn ? isGroupSelected : isRowSelected
        const cellRowSpan = rowSpanInfo?.rowSpan ?? 1
        const isCellDragSelected = isCellInSelection(
          rowIndex,
          cellIndex,
          activeSelectionBounds,
          cellRowSpan,
        )

        const isBottomRightCell =
          !isEditing &&
          activeSelectionBounds &&
          !dragState.isSelecting &&
          activeSelectionBounds.endRow >= rowIndex &&
          activeSelectionBounds.endRow <= rowIndex + cellRowSpan - 1 &&
          cellIndex === activeSelectionBounds.endCol

        const resolveCellRowIndex = (clientY: number, element: HTMLElement) =>
          getRowIndexInMergedCell(clientY, element, rowIndex, cellRowSpan)

        return (
          <td
            key={cell.id}
            rowSpan={rowSpanInfo && rowSpanInfo.rowSpan > 1 ? rowSpanInfo.rowSpan : undefined}
            onMouseDown={(event) => {
              if (isEditing) {
                event.stopPropagation()

                return
              }

              event.preventDefault()
              onCellMouseDown(resolveCellRowIndex(event.clientY, event.currentTarget), cellIndex)
            }}
            onMouseEnter={(event) =>
              onCellMouseEnter(resolveCellRowIndex(event.clientY, event.currentTarget), cellIndex)
            }
            onMouseMove={(event) => {
              if (!dragState.isSelecting && !dragState.isFillDragging) return

              onCellMouseEnter(resolveCellRowIndex(event.clientY, event.currentTarget), cellIndex)
            }}
            onDoubleClick={(event) => {
              if (!editable) return

              event.preventDefault()
              event.stopPropagation()
              onStartEdit(rowIndex, cellIndex)
            }}
            style={getCellSelectionEdgeStyle(
              rowIndex,
              cellIndex,
              activeSelectionBounds,
              cellRowSpan,
            )}
            className={cn(
              "data-table-cell",
              CELL_ALIGN_CLASS[align],
              cellClassName,
              enableRowSpan && showCellSelected && "is-group-selected",
              enableRowSpan && showCellHover && !showCellSelected && "is-group-hovered",
              isCellDragSelected && CELL_SELECTION_FILL_CLASS,
              editable && "is-editable",
            )}>
            {isEditing ? (
              <input
                ref={editInputRef}
                type={editType === "number" ? "number" : "text"}
                defaultValue={draftValue}
                className={cn("cell-edit-input", CELL_ALIGN_CLASS[align])}
                onChange={(event) => onDraftValueChange(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    onCommitEdit(event.currentTarget.value)
                  }

                  if (event.key === "Escape") {
                    event.preventDefault()
                    onCancelEdit()
                  }
                }}
                onBlur={(event) => {
                  onCommitEdit(event.currentTarget.value)
                }}
              />
            ) : isExpandCell && enableExpand ? (
              <div className="expand-cell">
                <div className="expand-cell-content">
                  {rowLevel > 0 && <span className="expand-cell-indent">·</span>}
                  <div className="expand-cell-value">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                </div>
                {canExpand && expandKey && (
                  <button
                    type="button"
                    aria-label={isExpanded ? "행 접기" : "행 펼치기"}
                    className="expand-toggle-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleExpand?.(expandKey)
                    }}
                    onMouseDown={(event) => event.stopPropagation()}>
                    {isExpanded ? (
                      <ChevronUp className="expand-toggle-icon" />
                    ) : (
                      <ChevronDown className="expand-toggle-icon" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}

            {isBottomRightCell && (
              <div
                role="presentation"
                className="fill-handle"
                onMouseDown={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  onFillHandleMouseDown(rowIndex, cellIndex)
                }}
              />
            )}
          </td>
        )
      })}
    </tr>
  )
}
