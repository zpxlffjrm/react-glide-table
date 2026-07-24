import { flexRender, type Row } from "@tanstack/react-table";
import { useEffect, useRef, type CSSProperties } from "react";

import {
  CELL_ALIGN_CLASS,
  CELL_SELECTION_FILL_CLASS,
  ROW_HOVER_CLASS,
  ROW_HOVERED_BG_CLASS,
} from "@/components/ui/table/constants";
import { useDataTableRowContext } from "@/components/ui/table/DataTableContext";
import {
  getColumnEditType,
  isColumnEditable,
} from "@/components/ui/table/features/cell-edit/cellEdit";
import {
  CELL_SELECTION_EDGES_CLASS,
  getCellSelectionEdgeStyle,
  getRowIndexInMergedCell,
  hasCellSelectionEdges,
  isCellInSelection,
  measureMergedSpanRowHeights,
} from "@/components/ui/table/features/cell-selection/cellSelection";
import { canExpandRow } from "@/components/ui/table/features/row-expand/row-expand";
import {
  resolveRowSpanAt,
  type RowSpanInfo,
} from "@/components/ui/table/features/row-span/rowSpan";
import { ChevronDown, ChevronUp } from "@/components/ui/table/components/icons";
import { cn } from "@/lib/cn";

export type DataTableRowProps<T extends Record<string, unknown>> = {
  row: Row<T>;
  onToggleSelect: () => void;
  /** Virtual item index, used for measureElement tracking */
  virtualIndex?: number;
  /** Callback to measure dynamic row height (useVirtualizer.measureElement) */
  measureElement?: (node: Element | null) => void;
};

function resolveExpandCellIndex<T extends Record<string, unknown>>(
  cells: ReturnType<Row<T>["getVisibleCells"]>,
  toggleField?: string,
): number {
  if (!toggleField) return 0;

  const matchedIndex = cells.findIndex(
    (cell) => cell.column.id === toggleField,
  );
  if (matchedIndex >= 0) return matchedIndex;

  const noColumnIndex = cells.findIndex(
    (cell) => cell.column.id === "no" || cell.column.id === "treeNo",
  );
  if (noColumnIndex >= 0 && noColumnIndex + 1 < cells.length) {
    return noColumnIndex + 1;
  }

  return 0;
}

export function DataTableRow<T extends Record<string, unknown>>({
  row,
  onToggleSelect,
  virtualIndex,
  measureElement,
}: DataTableRowProps<T>) {
  const { classNames, rowSpan, selection, cellSelection, cellEdit, expand } =
    useDataTableRowContext();

  const {
    enableRowSpan,
    primaryRowSpanKey,
    columnRowSpanMap,
    hoveredRowIndex,
    hoveredGroupKey,
    selectedGroupKeys,
    onRowHover,
  } = rowSpan;

  const { rowSelectionMode, selectOnRowClick, onRowClick, getRowClassName } =
    selection;

  const {
    enableCellSelection,
    activeSelectionBounds,
    dragState,
    onCellMouseDown,
    onCellMouseEnter,
    onFillHandleMouseDown,
  } = cellSelection;

  const {
    editingCell,
    draftValue,
    onDraftValueChange,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
  } = cellEdit;

  const {
    enableExpand,
    toggleField,
    expandedRows,
    preventExpand,
    onToggleExpand,
    expandRowLabel,
    collapseRowLabel,
  } = expand;

  const rowIndex = row.index;
  const rowData = row.original;
  const isRowHovered = hoveredRowIndex === rowIndex;
  const isRowSelected = row.getIsSelected();
  const rowGroupKey =
    primaryRowSpanKey !== undefined &&
    rowData[primaryRowSpanKey] !== null &&
    rowData[primaryRowSpanKey] !== undefined
      ? String(rowData[primaryRowSpanKey])
      : null;
  const isGroupHovered =
    enableRowSpan &&
    hoveredGroupKey !== null &&
    rowGroupKey === hoveredGroupKey;
  const isGroupSelected =
    enableRowSpan && rowGroupKey !== null && selectedGroupKeys.has(rowGroupKey);

  const visibleCells = row.getVisibleCells();
  const columnIdsByIndex = visibleCells.map((cell) => cell.column.id);
  const isVisuallySelectedAt = activeSelectionBounds
    ? (targetRow: number, targetCol: number) => {
        if (
          targetCol < activeSelectionBounds.startCol ||
          targetCol > activeSelectionBounds.endCol
        ) {
          return false;
        }

        const columnId = columnIdsByIndex[targetCol];
        const { startRow, rowSpan: span } = resolveRowSpanAt(
          columnId ? columnRowSpanMap.get(columnId) : undefined,
          targetRow,
        );

        return isCellInSelection(
          startRow,
          targetCol,
          activeSelectionBounds,
          span,
        );
      }
    : undefined;
  const expandCellIndex = enableExpand
    ? resolveExpandCellIndex(visibleCells, toggleField)
    : -1;
  const canExpand = enableExpand && !preventExpand && canExpandRow(rowData);
  const expandKey =
    toggleField &&
    rowData[toggleField] !== null &&
    rowData[toggleField] !== undefined
      ? String(rowData[toggleField])
      : null;
  const isExpanded =
    expandKey !== null && Boolean(expandedRows?.has(expandKey));
  const rowLevel = typeof rowData.level === "number" ? rowData.level : 0;
  const editInputRef = useRef<HTMLInputElement>(null);
  const isRowEditing = editingCell?.rowIndex === rowIndex;

  useEffect(() => {
    if (!isRowEditing) return;

    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [isRowEditing, editingCell?.colIndex]);

  return (
    <tr
      ref={measureElement}
      data-index={virtualIndex}
      data-selected={isRowSelected ? "" : undefined}
      data-hovered={isRowHovered || isGroupHovered ? "" : undefined}
      data-expandable={enableExpand && canExpand ? "" : undefined}
      data-expanded={isExpanded ? "" : undefined}
      className={cn(
        "DataTableRowJSX",
        !enableRowSpan && ROW_HOVER_CLASS,
        enableRowSpan && isRowHovered && !isRowSelected && ROW_HOVERED_BG_CLASS,
        isRowSelected && "is-selected",
        enableExpand && canExpand && "is-expandable",
        classNames?.row,
        getRowClassName?.(rowData, rowIndex),
      )}
      onMouseEnter={() => onRowHover(rowIndex, rowData)}
      onClick={() => {
        if (isRowEditing) return;

        onRowClick?.(rowData, rowIndex);
        if (rowSelectionMode !== "none" && selectOnRowClick) {
          onToggleSelect();
        }
      }}
    >
      {visibleCells.map((cell, cellIndex) => {
        const columnId = cell.column.id;
        const meta = cell.column.columnDef.meta;
        const align = meta?.align ?? "center";
        const cellClassName = meta?.className;
        const isRowSpanColumn = Boolean(enableRowSpan && meta?.rowSpan);
        const isExpandCell = cellIndex === expandCellIndex;
        const editable = isColumnEditable(cell.column.columnDef);
        const editType = getColumnEditType(cell.column.columnDef);

        let rowSpanInfo: RowSpanInfo | undefined;
        if (isRowSpanColumn) {
          rowSpanInfo = columnRowSpanMap.get(columnId)?.[rowIndex];
          if (rowSpanInfo && rowSpanInfo.rowSpan === 0) {
            return null;
          }
        }

        const isEditing =
          editingCell?.rowIndex === rowIndex &&
          editingCell?.colIndex === cellIndex;

        const cellRowSpan = rowSpanInfo?.rowSpan ?? 1;
        // Nested merges (category/region) start on different rows — check span range, not primary group key.
        const isMergedCellHovered =
          hoveredRowIndex !== null &&
          hoveredRowIndex >= rowIndex &&
          hoveredRowIndex <= rowIndex + cellRowSpan - 1;
        const showCellHover = isRowSpanColumn
          ? isMergedCellHovered
          : isRowHovered;
        const showCellSelected = isRowSpanColumn
          ? isGroupSelected
          : isRowSelected;
        const isMerged = cellRowSpan > 1;
        /** Draw the right edge only when the next column is not merged, so vertical lines do not stack with adjacent merged cells. */
        const showMergedRightEdge =
          isMerged &&
          (cellIndex === visibleCells.length - 1 ||
            resolveRowSpanAt(
              columnRowSpanMap.get(columnIdsByIndex[cellIndex + 1]),
              rowIndex,
            ).rowSpan <= 1);
        const isCellDragSelected = isCellInSelection(
          rowIndex,
          cellIndex,
          activeSelectionBounds,
          cellRowSpan,
        );

        const isBottomRightCell =
          !isEditing &&
          activeSelectionBounds &&
          !dragState.isSelecting &&
          activeSelectionBounds.endRow >= rowIndex &&
          activeSelectionBounds.endRow <= rowIndex + cellRowSpan - 1 &&
          cellIndex === activeSelectionBounds.endCol;

        const spanRowHeights =
          cellRowSpan > 1
            ? measureMergedSpanRowHeights(rowIndex, cellRowSpan)
            : undefined;
        const selectionEdgeStyle = getCellSelectionEdgeStyle(
          rowIndex,
          cellIndex,
          activeSelectionBounds,
          cellRowSpan,
          isVisuallySelectedAt,
          spanRowHeights,
        );

        const resolveCellRowIndex = (clientY: number, element: HTMLElement) =>
          getRowIndexInMergedCell(clientY, element, rowIndex, cellRowSpan);

        const hasSelectionEdges = hasCellSelectionEdges(selectionEdgeStyle);

        return (
          <td
            key={cell.id}
            rowSpan={
              rowSpanInfo && rowSpanInfo.rowSpan > 1
                ? rowSpanInfo.rowSpan
                : undefined
            }
            data-merged={isMerged && cellIndex > 0 ? "" : undefined}
            data-merged-edge-right={showMergedRightEdge ? "" : undefined}
            data-merged-row-first={cellIndex === 0 ? "" : undefined}
            data-group-selected={
              enableRowSpan && showCellSelected ? "" : undefined
            }
            data-group-hovered={
              enableRowSpan && showCellHover && !showCellSelected
                ? ""
                : undefined
            }
            data-selection-fill={isCellDragSelected ? "" : undefined}
            data-selection-edges={hasSelectionEdges ? "" : undefined}
            data-editable={editable ? "" : undefined}
            data-editing={isEditing ? "" : undefined}
            onMouseDown={(event) => {
              if (isEditing) {
                event.stopPropagation();

                return;
              }

              if (!enableCellSelection) return;

              event.preventDefault();
              onCellMouseDown(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex,
              );
            }}
            onMouseEnter={(event) => {
              if (!enableCellSelection) return;

              onCellMouseEnter(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex,
              );
            }}
            onMouseMove={(event) => {
              if (!enableCellSelection) return;
              if (!dragState.isSelecting && !dragState.isFillDragging) return;

              onCellMouseEnter(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex,
              );
            }}
            onDoubleClick={(event) => {
              if (!editable) return;

              event.preventDefault();
              event.stopPropagation();
              onStartEdit(rowIndex, cellIndex);
            }}
            style={selectionEdgeStyle as CSSProperties | undefined}
            className={cn(
              "data-table-cell",
              CELL_ALIGN_CLASS[align],
              cellClassName,
              isMerged && "is-merged",
              cellIndex === 0 && "is-merged-row-first",
              showMergedRightEdge && "is-merged-edge-right",
              enableRowSpan && showCellSelected && "is-group-selected",
              enableRowSpan &&
                showCellHover &&
                !showCellSelected &&
                "is-group-hovered",
              isCellDragSelected && CELL_SELECTION_FILL_CLASS,
              hasSelectionEdges && CELL_SELECTION_EDGES_CLASS,
              editable && "is-editable",
              classNames?.cell,
            )}
          >
            {isEditing ? (
              <input
                ref={editInputRef}
                type={editType === "number" ? "number" : "text"}
                defaultValue={draftValue}
                className={cn(
                  "cell-edit-input",
                  CELL_ALIGN_CLASS[align],
                  classNames?.cellEditInput,
                )}
                onChange={(event) => onDraftValueChange(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommitEdit(event.currentTarget.value);
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                  }
                }}
                onBlur={(event) => {
                  onCommitEdit(event.currentTarget.value);
                }}
              />
            ) : isExpandCell && enableExpand ? (
              <div className={cn("expand-cell", classNames?.expandCell)}>
                <div
                  className={cn(
                    "expand-cell-content",
                    classNames?.expandCellContent,
                  )}
                >
                  {rowLevel > 0 && (
                    <span
                      className={cn(
                        "expand-cell-indent",
                        classNames?.expandCellIndent,
                      )}
                    >
                      ·
                    </span>
                  )}
                  <div
                    className={cn(
                      "expand-cell-value",
                      classNames?.expandCellValue,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                </div>
                {canExpand && expandKey && (
                  <button
                    type="button"
                    aria-label={isExpanded ? collapseRowLabel : expandRowLabel}
                    className={cn(
                      "expand-toggle-button",
                      classNames?.expandToggle,
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleExpand?.(expandKey);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {isExpanded ? (
                      <ChevronUp
                        className={cn(
                          "expand-toggle-icon",
                          classNames?.expandToggleIcon,
                        )}
                      />
                    ) : (
                      <ChevronDown
                        className={cn(
                          "expand-toggle-icon",
                          classNames?.expandToggleIcon,
                        )}
                      />
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
                className={cn("fill-handle", classNames?.fillHandle)}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();
                  onFillHandleMouseDown(rowIndex, cellIndex);
                }}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}
