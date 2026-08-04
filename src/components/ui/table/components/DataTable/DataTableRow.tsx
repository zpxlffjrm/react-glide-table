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
import {
  getColumnFreezeEdgeAttr,
  getColumnFreezeStyle,
} from "@/components/ui/table/features/column-freeze/columnFreeze";
import { getColumnSizeStyle } from "@/components/ui/table/features/column-resize/columnResize";
import {
  buildSearchMatchKey,
} from "@/components/ui/table/features/inline-search/inlineSearch";
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

function isInteractiveMouseTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const interactiveSelector = [
    "input",
    "textarea",
    "select",
    "button",
    "a[href]",
    "[contenteditable]:not([contenteditable='false'])",
    "[data-table-disable-cell-selection]",
  ].join(",");

  return target.closest(interactiveSelector) !== null;
}

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
  const {
    classNames,
    rowSpan,
    selection,
    cellSelection,
    cellEdit,
    expand,
    columnResize,
    columnFreeze,
    inlineSearch,
  } = useDataTableRowContext();

  const { enableColumnResize } = columnResize;
  const { enableColumnFreeze, offsets: freezeOffsets } = columnFreeze;
  const {
    enabled: enableInlineSearch,
    matchKeys: searchMatchKeys,
    activeMatch,
  } = inlineSearch;

  const {
    enableRowSpan,
    primaryRowSpanColumnId,
    columnRowSpanMap,
    hoveredRowIndex,
    selectedRowIndices,
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
  const { startRow: primaryGroupStart, rowSpan: primaryGroupSpan } =
    resolveRowSpanAt(
      primaryRowSpanColumnId
        ? columnRowSpanMap.get(primaryRowSpanColumnId)
        : undefined,
      rowIndex,
    );
  const isGroupHovered =
    enableRowSpan &&
    hoveredRowIndex !== null &&
    hoveredRowIndex >= primaryGroupStart &&
    hoveredRowIndex <= primaryGroupStart + primaryGroupSpan - 1;

  const visibleCells = row.getVisibleCells();
  const columnIdsByIndex = visibleCells.map((cell) => cell.column.id);
  row.getIsCellDragSelected = (columnId?: string) => {
    if (!activeSelectionBounds) return false;

    if (columnId) {
      const colIndex = columnIdsByIndex.indexOf(columnId);
      if (colIndex < 0) return false;

      const { startRow, rowSpan } = resolveRowSpanAt(
        columnRowSpanMap.get(columnIdsByIndex[colIndex]),
        rowIndex,
      );

      return isCellInSelection(
        startRow,
        colIndex,
        activeSelectionBounds,
        rowSpan,
      );
    }

    for (let colIndex = 0; colIndex < columnIdsByIndex.length; colIndex += 1) {
      const { startRow, rowSpan } = resolveRowSpanAt(
        columnRowSpanMap.get(columnIdsByIndex[colIndex]),
        rowIndex,
      );

      if (
        isCellInSelection(startRow, colIndex, activeSelectionBounds, rowSpan)
      ) {
        return true;
      }
    }

    return false;
  };
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
        const editInputProps = meta?.editInputProps;
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
        let isMergedCellSelected = false;
        if (isRowSpanColumn) {
          for (let r = rowIndex; r < rowIndex + cellRowSpan; r += 1) {
            if (selectedRowIndices.has(r)) {
              isMergedCellSelected = true;
              break;
            }
          }
        }
        const showCellSelected = isRowSpanColumn
          ? isMergedCellSelected
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
          enableCellSelection &&
          activeSelectionBounds &&
          isCellDragSelected &&
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
        const sizeStyle = getColumnSizeStyle(cell.column.getSize(), {
          force: enableColumnResize,
          lockMax: enableColumnResize,
        });
        const freezeOffset = enableColumnFreeze
          ? freezeOffsets.get(columnId)
          : undefined;
        const freezeStyle = getColumnFreezeStyle(freezeOffset);
        const cellStyle = {
          ...sizeStyle,
          ...freezeStyle,
          ...(selectionEdgeStyle as CSSProperties | undefined),
        } as CSSProperties;

        const searchMatchKey = buildSearchMatchKey(cellIndex, rowIndex);
        const isSearchMatch =
          enableInlineSearch && searchMatchKeys.has(searchMatchKey);
        const isSearchActive =
          isSearchMatch &&
          activeMatch !== null &&
          activeMatch[0] === cellIndex &&
          activeMatch[1] === rowIndex;

        return (
          <td
            key={cell.id}
            data-row-index={rowIndex}
            data-col-index={cellIndex}
            rowSpan={
              rowSpanInfo && rowSpanInfo.rowSpan > 1
                ? rowSpanInfo.rowSpan
                : undefined
            }
            data-merged={isMerged && cellIndex > 0 ? "" : undefined}
            data-merged-edge-right={showMergedRightEdge ? "" : undefined}
            data-merged-row-first={
              isMerged && cellIndex === 0 && showMergedRightEdge
                ? ""
                : undefined
            }
            data-selected={!enableRowSpan && showCellSelected ? "" : undefined}
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
            data-search-match={isSearchMatch ? "" : undefined}
            data-search-active={isSearchActive ? "" : undefined}
            data-editable={editable ? "" : undefined}
            data-editing={isEditing ? "" : undefined}
            data-frozen={freezeOffset?.side}
            data-freeze-edge={getColumnFreezeEdgeAttr(freezeOffset)}
            onMouseDown={(event) => {
              if (isEditing) {
                event.stopPropagation();

                return;
              }

              if (!enableCellSelection) return;
              if (isInteractiveMouseTarget(event.target)) return;

              event.preventDefault();
              onCellMouseDown(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex,
                { shiftKey: event.shiftKey },
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
            style={Object.keys(cellStyle).length > 0 ? cellStyle : undefined}
            className={cn(
              "data-table-cell",
              freezeOffset && `data-table-cell--frozen-${freezeOffset.side}`,
              CELL_ALIGN_CLASS[align],
              cellClassName,
              isMerged && "is-merged",
              isMerged &&
                cellIndex === 0 &&
                showMergedRightEdge &&
                "is-merged-row-first",
              showMergedRightEdge && "is-merged-edge-right",
              enableRowSpan && showCellSelected && "is-group-selected",
              enableRowSpan &&
                showCellHover &&
                !showCellSelected &&
                "is-group-hovered",
              isCellDragSelected && CELL_SELECTION_FILL_CLASS,
              hasSelectionEdges && CELL_SELECTION_EDGES_CLASS,
              isSearchMatch && "is-search-match",
              isSearchActive && "is-search-active",
              editable && "is-editable",
              classNames?.cell,
            )}
          >
            {isEditing ? (
              <input
                {...editInputProps}
                ref={editInputRef}
                type={editType === "number" ? "number" : "text"}
                defaultValue={draftValue}
                className={cn(
                  "cell-edit-input",
                  CELL_ALIGN_CLASS[align],
                  editInputProps?.className,
                  classNames?.cellEditInput,
                )}
                onChange={(event) => {
                  editInputProps?.onChange?.(event);
                  onDraftValueChange(event.target.value);
                }}
                onMouseDown={(event) => {
                  editInputProps?.onMouseDown?.(event);
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  editInputProps?.onClick?.(event);
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  editInputProps?.onKeyDown?.(event);
                  if (event.defaultPrevented) return;

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
                  editInputProps?.onBlur?.(event);
                  if (event.defaultPrevented) return;
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
