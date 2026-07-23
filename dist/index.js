// src/components/ui/table/components/DataTable/DataTable.tsx
import {
  flexRender as flexRender2,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback as useCallback3, useEffect as useEffect5, useMemo as useMemo2, useRef as useRef4, useState as useState3 } from "react";

// src/components/ui/table/components/DataTable/DataTableRow.tsx
import { flexRender } from "@tanstack/react-table";
import { useEffect as useEffect2, useRef as useRef2 } from "react";

// src/components/ui/table/constants.ts
var CELL_ALIGN_CLASS = {
  left: "cell-align-left",
  center: "cell-align-center",
  right: "cell-align-right"
};
var ROW_HOVER_CLASS = "row-hoverable";
var ROW_HOVERED_BG_CLASS = "row-hovered";
var CELL_SELECTION_FILL_CLASS = "cell-selection-fill";
var DATA_TABLE_ROW_HEIGHT = 44;
var DATA_TABLE_VIRTUAL_OVERSCAN = 8;

// src/components/ui/table/DataTableContext.tsx
import { createContext, use } from "react";
import { jsx } from "react/jsx-runtime";
var DataTableContext = createContext(null);
function useDataTableRowContext() {
  const context = use(DataTableContext);
  if (!context) {
    throw new Error("useDataTableRowContext must be used within a DataTableContextProvider");
  }
  return context;
}
function DataTableContextProvider({
  value,
  children
}) {
  return /* @__PURE__ */ jsx(DataTableContext, { value, children });
}

// src/components/ui/table/features/cell-edit/cellEdit.ts
function getColumnAccessorKey(columnDef) {
  if (columnDef.accessorKey !== void 0 && columnDef.accessorKey !== null) {
    return String(columnDef.accessorKey);
  }
  return columnDef.id;
}
function isColumnEditable(columnDef) {
  return Boolean(columnDef.meta?.editable);
}
function getColumnEditType(columnDef) {
  return columnDef.meta?.editType ?? "text";
}
function parseCellEditValue(raw, editType) {
  if (editType === "text") {
    return { ok: true, value: raw };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}
function getCellEditDraftValue(value) {
  if (value === null || value === void 0) return "";
  return String(value);
}
function applyCellEdit(data, rows, rowIndex, colIndex, raw) {
  const cell = rows[rowIndex]?.getVisibleCells()[colIndex];
  if (!cell) return null;
  const columnDef = cell.column.columnDef;
  if (!isColumnEditable(columnDef)) return null;
  const accessorKey = getColumnAccessorKey(columnDef);
  if (!accessorKey) return null;
  const parsed = parseCellEditValue(raw, getColumnEditType(columnDef));
  if (!parsed.ok) return null;
  const newData = data.map((row) => ({ ...row }));
  if (!newData[rowIndex]) return null;
  newData[rowIndex][accessorKey] = parsed.value;
  return newData;
}

// src/components/ui/table/features/cell-selection/cellSelection.ts
var INITIAL_DRAG_STATE = {
  isSelecting: false,
  isFillDragging: false,
  start: null,
  end: null,
  fillAnchor: null,
  fillEnd: null
};
function getCellSelectionBounds(start, end) {
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col)
  };
}
function getRowIndexInMergedCell(clientY, cellElement, rowIndex, rowSpan) {
  if (rowSpan <= 1) return rowIndex;
  const rect = cellElement.getBoundingClientRect();
  const relativeY = clientY - rect.top;
  const rowHeight = rect.height / rowSpan;
  const offset = Math.min(Math.max(Math.floor(relativeY / rowHeight), 0), rowSpan - 1);
  return rowIndex + offset;
}
function isCellInSelection(rowIndex, colIndex, bounds, rowSpan = 1) {
  if (!bounds) return false;
  const cellEndRow = rowIndex + rowSpan - 1;
  return cellEndRow >= bounds.startRow && rowIndex <= bounds.endRow && colIndex >= bounds.startCol && colIndex <= bounds.endCol;
}
function getActiveSelectionBounds(dragState, selectionBounds) {
  if (dragState.isFillDragging && dragState.fillAnchor && dragState.fillEnd) {
    return getCellSelectionBounds(dragState.fillAnchor, dragState.fillEnd);
  }
  return selectionBounds;
}
var SELECTION_EDGE_WIDTH_PX = 2;
var SELECTION_EDGE_COLOR = "var(--color-brand-primary)";
function getCellSelectionEdgeStyle(rowIndex, colIndex, bounds, rowSpan = 1) {
  if (!isCellInSelection(rowIndex, colIndex, bounds, rowSpan) || !bounds) return void 0;
  const cellEndRow = rowIndex + rowSpan - 1;
  const isTopEdge = bounds.startRow >= rowIndex && bounds.startRow <= cellEndRow;
  const isBottomEdge = bounds.endRow >= rowIndex && bounds.endRow <= cellEndRow;
  const isLeftEdge = colIndex === bounds.startCol;
  const isRightEdge = colIndex === bounds.endCol;
  const shadows = [];
  if (isTopEdge) {
    shadows.push(`inset 0 ${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`);
  }
  if (isBottomEdge) {
    shadows.push(`inset 0 -${SELECTION_EDGE_WIDTH_PX}px 0 0 ${SELECTION_EDGE_COLOR}`);
  }
  if (isLeftEdge) {
    shadows.push(`inset ${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`);
  }
  if (isRightEdge) {
    shadows.push(`inset -${SELECTION_EDGE_WIDTH_PX}px 0 0 0 ${SELECTION_EDGE_COLOR}`);
  }
  return shadows.length > 0 ? { boxShadow: shadows.join(", ") } : void 0;
}

// src/components/ui/table/features/row-expand/row-expand.ts
import { useEffect, useMemo, useRef } from "react";
function getFieldValue(row, key) {
  return row[key];
}
function canExpandRow(row) {
  const children = row.children;
  const level = row.level;
  return Array.isArray(children) && children.length > 0 && (level === 0 || level === void 0);
}
function toggleExpandedRowId(rowId, previous) {
  const next = new Set(previous);
  if (next.has(rowId)) {
    next.delete(rowId);
  } else {
    next.add(rowId);
  }
  return next;
}
var useConvertTreeData = ({
  data,
  enabled = true,
  toggleField = "materialCode",
  childField = "assemblyCode",
  flattenField = "assemblyMaterials",
  preventExpand = false,
  startIndex = 1,
  expandedRows,
  onExpandedRowsChange
}) => {
  const onExpandedRowsChangeRef = useRef(onExpandedRowsChange);
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    onExpandedRowsChangeRef.current = onExpandedRowsChange;
  }, [onExpandedRowsChange]);
  useEffect(() => {
    if (!data || data.length === 0) {
      hasInitializedRef.current = false;
      return;
    }
    if (!enabled || hasInitializedRef.current) return;
    const ids = data.map((item) => getFieldValue(item, toggleField)).filter((value) => typeof value === "string" && value.length > 0);
    onExpandedRowsChangeRef.current?.(new Set(ids));
    hasInitializedRef.current = true;
  }, [enabled, data, toggleField]);
  const processedData = useMemo(() => {
    if (!enabled || !data || data.length === 0) return [];
    const flattenedData = [];
    const flattenItems = (items) => {
      items.forEach((item) => {
        const newItem = { ...item };
        const nested = newItem[flattenField];
        if (Array.isArray(nested)) {
          const children = nested.map(
            (child) => typeof child === "object" && child !== null ? { ...child } : child
          );
          delete newItem[flattenField];
          flattenedData.push(newItem);
          children.forEach((child) => {
            if (typeof child === "object" && child !== null) {
              ;
              child[childField] = newItem[toggleField];
            }
          });
          flattenItems(children);
        } else {
          flattenedData.push(newItem);
        }
      });
    };
    flattenItems(data);
    const dataWithLevels = flattenedData.map((item) => ({
      ...item,
      level: 0,
      children: [],
      processed: false
    }));
    const itemMap = /* @__PURE__ */ new Map();
    dataWithLevels.forEach((item) => {
      const key = getFieldValue(item, toggleField);
      if (typeof key !== "string" || !key) return;
      if (!itemMap.has(key)) {
        itemMap.set(key, []);
      }
      itemMap.get(key)?.push(item);
    });
    const rootItems = [];
    dataWithLevels.forEach((item) => {
      if (!getFieldValue(item, childField)) {
        rootItems.push(item);
        item.processed = true;
      }
    });
    dataWithLevels.forEach((item) => {
      const parentKey = getFieldValue(item, childField);
      if (!parentKey || item.processed) return;
      const parentItems = dataWithLevels.filter(
        (parent) => getFieldValue(parent, toggleField) === parentKey && !getFieldValue(parent, childField)
      );
      if (parentItems.length > 0) {
        const parent = parentItems[0];
        item.level = parent.level + 1;
        parent.children.push(item);
        item.processed = true;
      } else {
        const otherParents = itemMap.get(String(parentKey)) || [];
        if (otherParents.length > 0) {
          const parent = otherParents[0];
          item.level = parent.level + 1;
          parent.children.push(item);
          item.processed = true;
        } else {
          rootItems.push(item);
          item.processed = true;
        }
      }
    });
    return rootItems;
  }, [enabled, data, toggleField, childField, flattenField]);
  const flattenTree = useMemo(() => {
    if (!enabled) return [];
    const flatten = (nodes, result = [], level = 0) => {
      nodes.forEach((node, index) => {
        const currentIndex = level === 0 ? `${index + startIndex}` : `${level}-${index + 1}`;
        const toggleValue = getFieldValue(node, toggleField);
        const uniqueId = `${index}-${String(toggleValue ?? "")}`;
        result.push({
          ...node,
          treeNo: currentIndex,
          uniqueId,
          processed: true
        });
        const shouldExpandChildren = node.children.length > 0 && (preventExpand || typeof toggleValue === "string" && expandedRows?.has(toggleValue));
        if (shouldExpandChildren) {
          flatten(node.children, result, index + startIndex);
        }
      });
      return result;
    };
    const flattenedData = flatten(processedData, [], 0);
    flattenedData.forEach((item) => {
      if (getFieldValue(item, childField)) {
        const parentItem = flattenedData.find(
          (parent) => getFieldValue(parent, toggleField) === getFieldValue(item, childField)
        );
        const parentAmount = parentItem ? Number(getFieldValue(parentItem, "amount") ?? 1) : 1;
        item.parentCount = parentAmount || 1;
      } else {
        item.parentCount = 1;
      }
    });
    return flattenedData;
  }, [enabled, processedData, startIndex, toggleField, childField, preventExpand, expandedRows]);
  const sortedData = useMemo(() => {
    if (!enabled) {
      return data ?? [];
    }
    return [...flattenTree].sort((a, b) => {
      const aParts = String(a.treeNo ?? "").split("-").map(Number);
      const bParts = String(b.treeNo ?? "").split("-").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
          return aVal - bVal;
        }
      }
      return 0;
    });
  }, [enabled, data, flattenTree]);
  return sortedData;
};

// src/components/ui/table/components/icons.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ChevronDown({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsx2(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx2("path", { d: "m6 9 6 6 6-6" })
    }
  );
}
function ChevronUp({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsx2(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx2("path", { d: "m18 15-6-6-6 6" })
    }
  );
}
function ChevronLeft({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsx2(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx2("path", { d: "m15 18-6-6 6-6" })
    }
  );
}
function ChevronRight({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsx2(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx2("path", { d: "m9 18 6-6-6-6" })
    }
  );
}
function ArrowUp({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx2("path", { d: "m18 15-6-6-6 6" }),
        /* @__PURE__ */ jsx2("path", { d: "M12 21V9" })
      ]
    }
  );
}
function ArrowDown({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx2("path", { d: "m6 9 6 6 6-6" }),
        /* @__PURE__ */ jsx2("path", { d: "M12 3v12" })
      ]
    }
  );
}
function ArrowUpDown({ className, "aria-hidden": ariaHidden = true }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      "aria-hidden": ariaHidden,
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx2("path", { d: "m21 16-4 4-4-4" }),
        /* @__PURE__ */ jsx2("path", { d: "M17 20V4" }),
        /* @__PURE__ */ jsx2("path", { d: "m3 8 4-4 4 4" }),
        /* @__PURE__ */ jsx2("path", { d: "M7 4v16" })
      ]
    }
  );
}

// src/lib/cn.ts
function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

// src/components/ui/table/components/DataTable/DataTableRow.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function resolveExpandCellIndex(cells, toggleField) {
  if (!toggleField) return 0;
  const matchedIndex = cells.findIndex(
    (cell) => cell.column.id === toggleField
  );
  if (matchedIndex >= 0) return matchedIndex;
  const noColumnIndex = cells.findIndex(
    (cell) => cell.column.id === "no" || cell.column.id === "treeNo"
  );
  if (noColumnIndex >= 0 && noColumnIndex + 1 < cells.length) {
    return noColumnIndex + 1;
  }
  return 0;
}
function DataTableRow({
  row,
  onToggleSelect,
  virtualIndex,
  measureElement
}) {
  const { rowSpan, selection, cellSelection, cellEdit, expand } = useDataTableRowContext();
  const {
    enableRowSpan,
    primaryRowSpanKey,
    columnRowSpanMap,
    hoveredRowIndex,
    hoveredGroupKey,
    selectedGroupKeys,
    onRowHover
  } = rowSpan;
  const { rowSelectionMode, selectOnRowClick, onRowClick, getRowClassName } = selection;
  const {
    activeSelectionBounds,
    dragState,
    onCellMouseDown,
    onCellMouseEnter,
    onFillHandleMouseDown
  } = cellSelection;
  const {
    editingCell,
    draftValue,
    onDraftValueChange,
    onStartEdit,
    onCommitEdit,
    onCancelEdit
  } = cellEdit;
  const {
    enableExpand,
    toggleField,
    expandedRows,
    preventExpand,
    onToggleExpand
  } = expand;
  const rowIndex = row.index;
  const rowData = row.original;
  const isRowHovered = hoveredRowIndex === rowIndex;
  const isRowSelected = row.getIsSelected();
  const rowGroupKey = primaryRowSpanKey !== void 0 && rowData[primaryRowSpanKey] !== null && rowData[primaryRowSpanKey] !== void 0 ? String(rowData[primaryRowSpanKey]) : null;
  const isGroupHovered = enableRowSpan && hoveredGroupKey !== null && rowGroupKey === hoveredGroupKey;
  const isGroupSelected = enableRowSpan && rowGroupKey !== null && selectedGroupKeys.has(rowGroupKey);
  const visibleCells = row.getVisibleCells();
  const expandCellIndex = enableExpand ? resolveExpandCellIndex(visibleCells, toggleField) : -1;
  const canExpand = enableExpand && !preventExpand && canExpandRow(rowData);
  const expandKey = toggleField && rowData[toggleField] !== null && rowData[toggleField] !== void 0 ? String(rowData[toggleField]) : null;
  const isExpanded = expandKey !== null && Boolean(expandedRows?.has(expandKey));
  const rowLevel = typeof rowData.level === "number" ? rowData.level : 0;
  const editInputRef = useRef2(null);
  const isRowEditing = editingCell?.rowIndex === rowIndex;
  useEffect2(() => {
    if (!isRowEditing) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [isRowEditing, editingCell?.colIndex]);
  return /* @__PURE__ */ jsx3(
    "tr",
    {
      ref: measureElement,
      "data-index": virtualIndex,
      className: cn(
        "DataTableRowJSX",
        !enableRowSpan && ROW_HOVER_CLASS,
        enableRowSpan && isRowHovered && !isRowSelected && ROW_HOVERED_BG_CLASS,
        isRowSelected && "is-selected",
        enableExpand && canExpand && "is-expandable",
        getRowClassName?.(rowData, rowIndex)
      ),
      onMouseEnter: () => onRowHover(rowIndex, rowData),
      onClick: () => {
        if (isRowEditing) return;
        onRowClick?.(rowData, rowIndex);
        if (rowSelectionMode !== "none" && selectOnRowClick) {
          onToggleSelect();
        }
      },
      children: visibleCells.map((cell, cellIndex) => {
        const columnId = cell.column.id;
        const meta = cell.column.columnDef.meta;
        const align = meta?.align ?? "center";
        const cellClassName = meta?.className;
        const isRowSpanColumn = Boolean(enableRowSpan && meta?.rowSpan);
        const isExpandCell = cellIndex === expandCellIndex;
        const editable = isColumnEditable(cell.column.columnDef);
        const editType = getColumnEditType(cell.column.columnDef);
        let rowSpanInfo;
        if (isRowSpanColumn) {
          rowSpanInfo = columnRowSpanMap.get(columnId)?.[rowIndex];
          if (rowSpanInfo && rowSpanInfo.rowSpan === 0) {
            return null;
          }
        }
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === cellIndex;
        const showCellHover = isRowSpanColumn ? isGroupHovered : isRowHovered;
        const showCellSelected = isRowSpanColumn ? isGroupSelected : isRowSelected;
        const cellRowSpan = rowSpanInfo?.rowSpan ?? 1;
        const isCellDragSelected = isCellInSelection(
          rowIndex,
          cellIndex,
          activeSelectionBounds,
          cellRowSpan
        );
        const isBottomRightCell = !isEditing && activeSelectionBounds && !dragState.isSelecting && activeSelectionBounds.endRow >= rowIndex && activeSelectionBounds.endRow <= rowIndex + cellRowSpan - 1 && cellIndex === activeSelectionBounds.endCol;
        const resolveCellRowIndex = (clientY, element) => getRowIndexInMergedCell(clientY, element, rowIndex, cellRowSpan);
        return /* @__PURE__ */ jsxs2(
          "td",
          {
            rowSpan: rowSpanInfo && rowSpanInfo.rowSpan > 1 ? rowSpanInfo.rowSpan : void 0,
            onMouseDown: (event) => {
              if (isEditing) {
                event.stopPropagation();
                return;
              }
              event.preventDefault();
              onCellMouseDown(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex
              );
            },
            onMouseEnter: (event) => onCellMouseEnter(
              resolveCellRowIndex(event.clientY, event.currentTarget),
              cellIndex
            ),
            onMouseMove: (event) => {
              if (!dragState.isSelecting && !dragState.isFillDragging) return;
              onCellMouseEnter(
                resolveCellRowIndex(event.clientY, event.currentTarget),
                cellIndex
              );
            },
            onDoubleClick: (event) => {
              if (!editable) return;
              event.preventDefault();
              event.stopPropagation();
              onStartEdit(rowIndex, cellIndex);
            },
            style: getCellSelectionEdgeStyle(
              rowIndex,
              cellIndex,
              activeSelectionBounds,
              cellRowSpan
            ),
            className: cn(
              "data-table-cell",
              CELL_ALIGN_CLASS[align],
              cellClassName,
              enableRowSpan && showCellSelected && "is-group-selected",
              enableRowSpan && showCellHover && !showCellSelected && "is-group-hovered",
              isCellDragSelected && CELL_SELECTION_FILL_CLASS,
              editable && "is-editable"
            ),
            children: [
              isEditing ? /* @__PURE__ */ jsx3(
                "input",
                {
                  ref: editInputRef,
                  type: editType === "number" ? "number" : "text",
                  defaultValue: draftValue,
                  className: cn("cell-edit-input", CELL_ALIGN_CLASS[align]),
                  onChange: (event) => onDraftValueChange(event.target.value),
                  onMouseDown: (event) => event.stopPropagation(),
                  onClick: (event) => event.stopPropagation(),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommitEdit(event.currentTarget.value);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelEdit();
                    }
                  },
                  onBlur: (event) => {
                    onCommitEdit(event.currentTarget.value);
                  }
                }
              ) : isExpandCell && enableExpand ? /* @__PURE__ */ jsxs2("div", { className: "expand-cell", children: [
                /* @__PURE__ */ jsxs2("div", { className: "expand-cell-content", children: [
                  rowLevel > 0 && /* @__PURE__ */ jsx3("span", { className: "expand-cell-indent", children: "\xB7" }),
                  /* @__PURE__ */ jsx3("div", { className: "expand-cell-value", children: flexRender(cell.column.columnDef.cell, cell.getContext()) })
                ] }),
                canExpand && expandKey && /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "button",
                    "aria-label": isExpanded ? "\uD589 \uC811\uAE30" : "\uD589 \uD3BC\uCE58\uAE30",
                    className: "expand-toggle-button",
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggleExpand?.(expandKey);
                    },
                    onMouseDown: (event) => event.stopPropagation(),
                    children: isExpanded ? /* @__PURE__ */ jsx3(ChevronUp, { className: "expand-toggle-icon" }) : /* @__PURE__ */ jsx3(ChevronDown, { className: "expand-toggle-icon" })
                  }
                )
              ] }) : flexRender(cell.column.columnDef.cell, cell.getContext()),
              isBottomRightCell && /* @__PURE__ */ jsx3(
                "div",
                {
                  role: "presentation",
                  className: "fill-handle",
                  onMouseDown: (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    onFillHandleMouseDown(rowIndex, cellIndex);
                  }
                }
              )
            ]
          },
          cell.id
        );
      })
    }
  );
}

// src/components/ui/table/components/DataTable/DataTableToolbar.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function DefaultSelectionLabel({ selectedCount }) {
  if (selectedCount <= 0) return null;
  return /* @__PURE__ */ jsxs3("span", { className: "toolbar-selection", children: [
    "\u2713 ",
    selectedCount,
    "\uAC1C \uC120\uD0DD\uB428"
  ] });
}
function DataTableToolbar({
  filteredCount,
  totalCount,
  summary,
  selectedCount,
  selectionLabel,
  toolbar,
  className
}) {
  const displayFiltered = filteredCount ?? totalCount;
  const hasCount = displayFiltered !== void 0 || totalCount !== void 0;
  const hasLeftContent = hasCount || Boolean(summary);
  const hasToolbar = Boolean(toolbar);
  const selectionContent = selectionLabel ? selectionLabel(selectedCount) : /* @__PURE__ */ jsx4(DefaultSelectionLabel, { selectedCount });
  const hasSelectionContent = selectionContent !== null && selectionContent !== false;
  if (!hasLeftContent && !hasToolbar && !hasSelectionContent) return null;
  return /* @__PURE__ */ jsxs3("div", { className: cn("DataTableToolbarJSX", className), children: [
    /* @__PURE__ */ jsxs3("div", { className: "toolbar-left", children: [
      hasCount && /* @__PURE__ */ jsx4("span", { className: "toolbar-count", children: displayFiltered !== void 0 && totalCount !== void 0 ? /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsx4("span", { className: "toolbar-count-primary", children: displayFiltered }),
        /* @__PURE__ */ jsxs3("span", { className: "toolbar-count-placeholder", children: [
          " / ",
          totalCount
        ] })
      ] }) : /* @__PURE__ */ jsx4("span", { className: "toolbar-count-primary", children: displayFiltered ?? totalCount }) }),
      summary
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "toolbar-right", children: [
      selectionContent,
      hasToolbar && /* @__PURE__ */ jsx4("div", { className: "toolbar-actions", children: toolbar })
    ] })
  ] });
}

// src/components/ui/table/features/cell-edit/useCellEdit.ts
import { useCallback, useEffect as useEffect3, useRef as useRef3, useState } from "react";
function useCellEdit({
  data,
  rows,
  onDataChange
}) {
  const [editingCell, setEditingCell] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const draftValueRef = useRef3(draftValue);
  const editingCellRef = useRef3(editingCell);
  useEffect3(() => {
    draftValueRef.current = draftValue;
  }, [draftValue]);
  useEffect3(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setDraftValue("");
  }, []);
  const commitEdit = useCallback(
    (raw) => {
      const current = editingCellRef.current;
      if (!current) return true;
      if (!onDataChange) {
        cancelEdit();
        return true;
      }
      const value = raw ?? draftValueRef.current;
      const next = applyCellEdit(data, rows, current.rowIndex, current.colIndex, value);
      if (!next) return false;
      onDataChange(next);
      cancelEdit();
      return true;
    },
    [cancelEdit, data, onDataChange, rows]
  );
  const startEdit = useCallback(
    (rowIndex, colIndex) => {
      const cell = rows[rowIndex]?.getVisibleCells()[colIndex];
      if (!cell || !isColumnEditable(cell.column.columnDef)) return;
      const current = editingCellRef.current;
      if (current && (current.rowIndex !== rowIndex || current.colIndex !== colIndex) && !commitEdit()) {
        return;
      }
      setEditingCell({ rowIndex, colIndex });
      setDraftValue(getCellEditDraftValue(cell.getValue()));
    },
    [commitEdit, rows]
  );
  return {
    editingCell,
    draftValue,
    setDraftValue,
    startEdit,
    commitEdit,
    cancelEdit
  };
}

// src/components/ui/table/features/cell-selection/useCellSelection.ts
import { useCallback as useCallback2, useEffect as useEffect4, useState as useState2 } from "react";

// src/components/ui/table/features/cell-selection/fillData.ts
function getColumnAccessorKey2(columnDef) {
  if ("accessorKey" in columnDef && columnDef.accessorKey) {
    return String(columnDef.accessorKey);
  }
  return columnDef.id;
}
function applyFillData(data, rows, sourceBounds, fillBounds) {
  const newData = data.map((row) => ({ ...row }));
  const sourceHeight = sourceBounds.endRow - sourceBounds.startRow + 1;
  const sourceWidth = sourceBounds.endCol - sourceBounds.startCol + 1;
  for (let rowIndex = fillBounds.startRow; rowIndex <= fillBounds.endRow; rowIndex += 1) {
    for (let colIndex = fillBounds.startCol; colIndex <= fillBounds.endCol; colIndex += 1) {
      if (isCellInSelection(rowIndex, colIndex, sourceBounds)) continue;
      const offsetRow = rowIndex - sourceBounds.startRow;
      const offsetCol = colIndex - sourceBounds.startCol;
      const sourceRowIndex = sourceBounds.startRow + (offsetRow % sourceHeight + sourceHeight) % sourceHeight;
      const sourceColIndex = sourceBounds.startCol + (offsetCol % sourceWidth + sourceWidth) % sourceWidth;
      const targetCell = rows[rowIndex]?.getVisibleCells()[colIndex];
      const sourceCell = rows[sourceRowIndex]?.getVisibleCells()[sourceColIndex];
      if (!targetCell || !sourceCell) continue;
      const accessorKey = getColumnAccessorKey2(
        targetCell.column.columnDef
      );
      if (!accessorKey) continue;
      newData[rowIndex][accessorKey] = sourceCell.getValue();
    }
  }
  return newData;
}
function hasFillExtension(sourceBounds, fillBounds) {
  if (!sourceBounds) return false;
  return fillBounds.startRow < sourceBounds.startRow || fillBounds.endRow > sourceBounds.endRow || fillBounds.startCol < sourceBounds.startCol || fillBounds.endCol > sourceBounds.endCol;
}

// src/components/ui/table/features/cell-selection/useCellSelection.ts
function useCellSelection({
  data,
  rows,
  onDataChange
}) {
  const [dragState, setDragState] = useState2(INITIAL_DRAG_STATE);
  const cellSelectionBounds = getCellSelectionBounds(dragState.start, dragState.end);
  const activeSelectionBounds = getActiveSelectionBounds(dragState, cellSelectionBounds);
  const handleCellMouseDown = useCallback2((rowIndex, colIndex) => {
    setDragState({
      isSelecting: true,
      isFillDragging: false,
      start: { row: rowIndex, col: colIndex },
      end: { row: rowIndex, col: colIndex },
      fillAnchor: null,
      fillEnd: null
    });
  }, []);
  const handleCellMouseEnter = useCallback2((rowIndex, colIndex) => {
    setDragState((prev) => {
      if (prev.isSelecting) {
        return { ...prev, end: { row: rowIndex, col: colIndex } };
      }
      if (prev.isFillDragging) {
        return { ...prev, fillEnd: { row: rowIndex, col: colIndex } };
      }
      return prev;
    });
  }, []);
  const handleFillHandleMouseDown = useCallback2((rowIndex, colIndex) => {
    setDragState((prev) => {
      const bounds = getCellSelectionBounds(prev.start, prev.end);
      if (!bounds) return prev;
      return {
        ...prev,
        isSelecting: false,
        isFillDragging: true,
        fillAnchor: { row: bounds.startRow, col: bounds.startCol },
        fillEnd: { row: rowIndex, col: colIndex }
      };
    });
  }, []);
  useEffect4(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && activeSelectionBounds) {
        const { startRow, endRow, startCol, endCol } = activeSelectionBounds;
        const selectedData = rows.slice(startRow, endRow + 1).map((row) => {
          const cells = row.getVisibleCells();
          return cells.slice(startCol, endCol + 1).map((cell) => cell.getValue()).join("	");
        }).join("\n");
        navigator.clipboard.writeText(selectedData);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSelectionBounds, rows]);
  useEffect4(() => {
    const handleMouseUp = () => {
      setDragState((prev) => {
        if (prev.isFillDragging && prev.fillAnchor && prev.fillEnd) {
          const sourceBounds = getCellSelectionBounds(prev.start, prev.end);
          const newBounds = getCellSelectionBounds(prev.fillAnchor, prev.fillEnd);
          if (newBounds) {
            if (hasFillExtension(sourceBounds, newBounds) && sourceBounds && onDataChange) {
              onDataChange(applyFillData(data, rows, sourceBounds, newBounds));
            }
            return {
              isSelecting: false,
              isFillDragging: false,
              start: { row: newBounds.startRow, col: newBounds.startCol },
              end: { row: newBounds.endRow, col: newBounds.endCol },
              fillAnchor: null,
              fillEnd: null
            };
          }
        }
        if (prev.isSelecting) {
          return { ...prev, isSelecting: false };
        }
        if (prev.isFillDragging) {
          return { ...prev, isFillDragging: false, fillAnchor: null, fillEnd: null };
        }
        return prev;
      });
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [data, onDataChange, rows]);
  return {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown
  };
}

// src/components/ui/table/features/row-selection/rowSelection.ts
function resolveRowSelection(mode, controlledSelection, internalSelection) {
  if (mode === "none") return {};
  return controlledSelection ?? internalSelection;
}
function normalizeSingleSelection(next) {
  const selectedIds = Object.keys(next).filter((id) => next[id]);
  if (selectedIds.length <= 1) return next;
  return { [selectedIds[selectedIds.length - 1]]: true };
}
function applySelectionUpdater(mode, updater, previous) {
  const next = typeof updater === "function" ? updater(previous) : updater;
  return mode === "single" ? normalizeSingleSelection(next) : next;
}

// src/components/ui/table/features/row-span/rowSpan.ts
function getRowFieldValue(row, key) {
  return row[key];
}
function computeRowSpans(data, rowSpanKey) {
  if (data.length === 0) return [];
  const result = [];
  for (let index = 0; index < data.length; index++) {
    const currentValue = getRowFieldValue(data[index], rowSpanKey);
    const previousValue = index > 0 ? getRowFieldValue(data[index - 1], rowSpanKey) : void 0;
    if (index > 0 && currentValue === previousValue) {
      result.push({ rowSpan: 0, isFirstInGroup: false });
      continue;
    }
    let span = 1;
    for (let nextIndex = index + 1; nextIndex < data.length; nextIndex++) {
      if (getRowFieldValue(data[nextIndex], rowSpanKey) === currentValue) {
        span++;
      } else {
        break;
      }
    }
    result.push({ rowSpan: span, isFirstInGroup: true });
  }
  return result;
}
function buildColumnRowSpanMap(data, columnKeys) {
  const map = /* @__PURE__ */ new Map();
  for (const { columnId, rowSpanKey } of columnKeys) {
    map.set(columnId, computeRowSpans(data, rowSpanKey));
  }
  return map;
}
function collectRowSpanColumns(columns) {
  const result = [];
  const visit = (defs) => {
    for (const columnDef of defs) {
      if ("columns" in columnDef && columnDef.columns?.length) {
        visit(columnDef.columns);
        continue;
      }
      const columnId = columnDef.id ?? ("accessorKey" in columnDef && columnDef.accessorKey ? String(columnDef.accessorKey) : void 0);
      if (!columnId || !columnDef.meta?.rowSpan) continue;
      result.push({
        columnId,
        rowSpanKey: columnDef.meta.rowSpanKey ?? columnId
      });
    }
  };
  visit(columns);
  return result;
}

// src/components/ui/table/components/DataTable/DataTable.tsx
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function DataTable({
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
  emptyText = "\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
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
  enableVirtualization = true,
  estimateRowHeight = DATA_TABLE_ROW_HEIGHT,
  virtualOverscan = DATA_TABLE_VIRTUAL_OVERSCAN
}) {
  const enableExpand = Boolean(toggleField);
  const [internalRowSelection, setInternalRowSelection] = useState3({});
  const [internalExpandedRows, setInternalExpandedRows] = useState3(() => /* @__PURE__ */ new Set());
  const [hoveredRowIndex, setHoveredRowIndex] = useState3(null);
  const [hoveredGroupKey, setHoveredGroupKey] = useState3(null);
  const scrollRef = useRef4(null);
  const shouldVirtualize = enableVirtualization && !enableRowSpan;
  useEffect5(() => {
    if (enableVirtualization && enableRowSpan) {
      console.warn(
        "[DataTable] enableRowSpan\uC774 \uCF1C\uC838 \uC788\uC73C\uBA74 \uC140 \uBCD1\uD569 \uC720\uC9C0\uB97C \uC704\uD574 \uAC00\uC0C1\uD654\uB97C \uBE44\uD65C\uC131\uD654\uD569\uB2C8\uB2E4."
      );
    }
  }, [enableVirtualization, enableRowSpan]);
  const rowSelection = resolveRowSelection(
    rowSelectionMode,
    controlledRowSelection,
    internalRowSelection
  );
  const expandedRows = controlledExpandedRows ?? internalExpandedRows;
  const handleExpandedRowsChange = useCallback3(
    (next) => {
      if (onExpandedRowsChange) {
        onExpandedRowsChange(next);
        return;
      }
      setInternalExpandedRows(next);
    },
    [onExpandedRowsChange]
  );
  const tableData = useConvertTreeData({
    data,
    enabled: enableExpand,
    toggleField,
    childField,
    flattenField,
    expandedRows,
    onExpandedRowsChange: enableExpand ? handleExpandedRowsChange : void 0,
    preventExpand
  });
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      rowSelection: rowSelectionMode === "none" ? {} : rowSelection
    },
    enableRowSelection: rowSelectionMode === "none" ? false : getRowCanSelect ? (row) => getRowCanSelect(row.original, row.index) : true,
    enableMultiRowSelection: rowSelectionMode === "multi",
    onRowSelectionChange: (updater) => {
      if (onRowSelectionChange) {
        onRowSelectionChange(
          (previous) => applySelectionUpdater(rowSelectionMode, updater, previous)
        );
        return;
      }
      setInternalRowSelection(
        (previous) => applySelectionUpdater(rowSelectionMode, updater, previous)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (originalRow, index) => getRowId(originalRow, index) : (_originalRow, index) => String(index)
  });
  const rowSpanColumnKeys = useMemo2(() => {
    if (!enableRowSpan) return [];
    return collectRowSpanColumns(columns);
  }, [enableRowSpan, columns]);
  const primaryRowSpanKey = rowSpanColumnKeys[0]?.rowSpanKey;
  const columnRowSpanMap = useMemo2(
    () => buildColumnRowSpanMap(tableData, rowSpanColumnKeys),
    [tableData, rowSpanColumnKeys]
  );
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length || 1;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: virtualOverscan
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;
  const selectedGroupKeys = useMemo2(() => {
    if (!enableRowSpan || !primaryRowSpanKey) return /* @__PURE__ */ new Set();
    const keys = /* @__PURE__ */ new Set();
    for (const selectedRow of selectedRows) {
      const value = selectedRow.original[primaryRowSpanKey];
      if (value !== null && value !== void 0) keys.add(String(value));
    }
    return keys;
  }, [enableRowSpan, primaryRowSpanKey, selectedRows]);
  const {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown
  } = useCellSelection({ data: tableData, rows, onDataChange });
  const { editingCell, draftValue, setDraftValue, startEdit, commitEdit, cancelEdit } = useCellEdit(
    { data: tableData, rows, onDataChange }
  );
  const handleCellMouseDownWithCommit = useCallback3(
    (rowIndex, colIndex) => {
      const isSameEditingCell = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
      if (editingCell && !isSameEditingCell && !commitEdit()) {
        return;
      }
      handleCellMouseDown(rowIndex, colIndex);
    },
    [commitEdit, editingCell, handleCellMouseDown]
  );
  const clearHover = () => {
    setHoveredRowIndex(null);
    setHoveredGroupKey(null);
  };
  const handleRowHover = useCallback3(
    (rowIndex, rowData) => {
      setHoveredRowIndex(rowIndex);
      if (!primaryRowSpanKey) {
        setHoveredGroupKey(null);
        return;
      }
      const groupValue = rowData[primaryRowSpanKey];
      setHoveredGroupKey(
        groupValue === null || groupValue === void 0 ? null : String(groupValue)
      );
    },
    [primaryRowSpanKey]
  );
  const handleToggleSelect = useCallback3(
    (row) => {
      if (!row.getCanSelect()) return;
      if (preserveRowSelection && row.getIsSelected()) {
        return;
      }
      row.toggleSelected();
    },
    [preserveRowSelection]
  );
  const handleToggleExpand = useCallback3(
    (rowKey) => {
      if (preventExpand) return;
      handleExpandedRowsChange(toggleExpandedRowId(rowKey, expandedRows));
    },
    [preventExpand, handleExpandedRowsChange, expandedRows]
  );
  const rowContextValue = useMemo2(() => {
    return {
      rowSpan: {
        enableRowSpan,
        primaryRowSpanKey,
        columnRowSpanMap,
        hoveredRowIndex,
        hoveredGroupKey,
        selectedGroupKeys,
        onRowHover: handleRowHover
      },
      selection: {
        rowSelectionMode,
        selectOnRowClick,
        onRowClick,
        getRowClassName
      },
      cellSelection: {
        activeSelectionBounds,
        dragState,
        onCellMouseDown: handleCellMouseDownWithCommit,
        onCellMouseEnter: handleCellMouseEnter,
        onFillHandleMouseDown: handleFillHandleMouseDown
      },
      cellEdit: {
        editingCell,
        draftValue,
        onDraftValueChange: setDraftValue,
        onStartEdit: startEdit,
        onCommitEdit: commitEdit,
        onCancelEdit: cancelEdit
      },
      expand: {
        enableExpand,
        toggleField,
        expandedRows,
        preventExpand,
        onToggleExpand: handleToggleExpand
      }
    };
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
    handleToggleExpand
  ]);
  if (isPending) {
    return /* @__PURE__ */ jsx5("div", { className: cn("DataTableJSX", "DataTableJSX--pending", className), children: /* @__PURE__ */ jsx5("span", { className: "data-table-loading-text", children: "\uB85C\uB529 \uC911..." }) });
  }
  return /* @__PURE__ */ jsxs4("div", { className: cn("DataTableJSX", className), children: [
    /* @__PURE__ */ jsx5(
      DataTableToolbar,
      {
        filteredCount: filteredCount ?? tableData.length,
        totalCount,
        summary,
        selectedCount,
        selectionLabel,
        toolbar
      }
    ),
    /* @__PURE__ */ jsx5("div", { ref: scrollRef, className: "data-table-scroll", children: /* @__PURE__ */ jsxs4(
      "table",
      {
        className: "data-table",
        onDragStart: (event) => event.preventDefault(),
        children: [
          /* @__PURE__ */ jsx5("thead", { className: "data-table-head", children: table.getHeaderGroups().map((headerGroup) => /* @__PURE__ */ jsx5("tr", { className: "data-table-head-row", children: headerGroup.headers.map((header) => {
            const align = header.column.columnDef.meta?.align ?? "center";
            const headerClassName = header.column.columnDef.meta?.headerClassName;
            return /* @__PURE__ */ jsx5(
              "th",
              {
                style: { width: header.getSize() !== 150 ? header.getSize() : void 0 },
                className: cn(
                  "data-table-head-cell",
                  CELL_ALIGN_CLASS[align],
                  headerClassName
                ),
                children: header.isPlaceholder ? null : flexRender2(header.column.columnDef.header, header.getContext())
              },
              header.id
            );
          }) }, headerGroup.id)) }),
          /* @__PURE__ */ jsx5(DataTableContextProvider, { value: rowContextValue, children: /* @__PURE__ */ jsx5("tbody", { onMouseLeave: clearHover, className: "data-table-body", children: rows.length === 0 ? /* @__PURE__ */ jsx5("tr", { children: /* @__PURE__ */ jsx5("td", { colSpan: columnCount, className: "data-table-empty-cell", children: emptyText }) }) : shouldVirtualize ? /* @__PURE__ */ jsxs4(Fragment2, { children: [
            paddingTop > 0 && /* @__PURE__ */ jsx5("tr", { "aria-hidden": true, className: "data-table-virtual-spacer", children: /* @__PURE__ */ jsx5(
              "td",
              {
                colSpan: columnCount,
                style: { height: paddingTop },
                className: "data-table-virtual-spacer-cell"
              }
            ) }),
            virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return /* @__PURE__ */ jsx5(
                DataTableRow,
                {
                  row,
                  virtualIndex: virtualRow.index,
                  measureElement: rowVirtualizer.measureElement,
                  onToggleSelect: () => handleToggleSelect(row)
                },
                row.id
              );
            }),
            paddingBottom > 0 && /* @__PURE__ */ jsx5("tr", { "aria-hidden": true, className: "data-table-virtual-spacer", children: /* @__PURE__ */ jsx5(
              "td",
              {
                colSpan: columnCount,
                style: { height: paddingBottom },
                className: "data-table-virtual-spacer-cell"
              }
            ) })
          ] }) : rows.map((row) => /* @__PURE__ */ jsx5(
            DataTableRow,
            {
              row,
              onToggleSelect: () => handleToggleSelect(row)
            },
            row.id
          )) }) })
        ]
      }
    ) })
  ] });
}

// src/components/ui/table/components/Table/Table.tsx
import { useCallback as useCallback4, useMemo as useMemo3, useState as useState4 } from "react";

// src/components/ui/table/components/Table/buildColumnDef.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function SortableHeader({
  label,
  field,
  sort,
  onSort
}) {
  const isActive = sort?.field === field;
  const Icon = isActive ? sort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  return /* @__PURE__ */ jsxs5(
    "button",
    {
      type: "button",
      className: cn("SortableHeaderJSX", isActive ? "is-active" : "is-inactive"),
      onClick: () => onSort(field),
      children: [
        /* @__PURE__ */ jsx6("span", { children: label }),
        /* @__PURE__ */ jsx6(Icon, { className: "sortable-header-icon" })
      ]
    }
  );
}
function buildColumnDef(props, sort, onSort) {
  const {
    field,
    virtual = false,
    children,
    sortable = false,
    width,
    align,
    rowSpan,
    rowSpanKey,
    editable,
    editType,
    className,
    headerClassName,
    render
  } = props;
  return {
    id: field,
    ...!virtual ? { accessorKey: field } : {},
    size: width ?? 150,
    header: sortable ? () => /* @__PURE__ */ jsx6(SortableHeader, { label: children, field, sort, onSort }) : (
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      () => children
    ),
    ...render ? {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      cell: ({ row, getValue }) => render(
        getValue(),
        row,
        row.index
      )
    } : {},
    meta: {
      align,
      rowSpan,
      rowSpanKey,
      editable,
      editType,
      className,
      headerClassName
    }
  };
}

// src/components/ui/table/components/Table/parseTableChildren.ts
import { Children } from "react";

// src/components/ui/table/components/Table/tableChildTypes.ts
import { isValidElement } from "react";
var TABLE_HEADER_DISPLAY_NAME = "Table.Header";
var TABLE_BODY_DISPLAY_NAME = "Table.Body";
var TABLE_COLUMN_DISPLAY_NAME = "Table.Column";
var TABLE_PAGINATION_DISPLAY_NAME = "Table.Pagination";
function getComponentDisplayName(type) {
  if (typeof type === "function" || typeof type === "object" && type !== null) {
    return type.displayName;
  }
  return void 0;
}
function isTableHeaderElement(child) {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_HEADER_DISPLAY_NAME;
}
function isTableBodyElement(child) {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_BODY_DISPLAY_NAME;
}
function isTableColumnElement(child) {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_COLUMN_DISPLAY_NAME;
}
function isTablePaginationElement(child) {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_PAGINATION_DISPLAY_NAME;
}

// src/components/ui/table/components/Table/parseTableChildren.ts
function parseTableChildren(children) {
  const slots = {
    header: null,
    body: null,
    pagination: null
  };
  for (const child of Children.toArray(children)) {
    if (isTableHeaderElement(child)) {
      slots.header = child;
      continue;
    }
    if (isTableBodyElement(child)) {
      slots.body = child;
      continue;
    }
    if (isTablePaginationElement(child)) {
      slots.pagination = child;
    }
  }
  return slots;
}
function extractColumnElements(header) {
  if (!header) return [];
  const { children } = header.props;
  return Children.toArray(children).filter(isTableColumnElement);
}

// src/components/ui/table/components/Table/TableBody.tsx
function TableBody() {
  return null;
}
TableBody.displayName = TABLE_BODY_DISPLAY_NAME;

// src/components/ui/table/components/Table/TableColumn.tsx
function TableColumn(props) {
  void props;
  return null;
}
TableColumn.displayName = TABLE_COLUMN_DISPLAY_NAME;

// src/components/ui/table/components/Table/tableDataPipeline.ts
function sortTableData(data, sort) {
  if (!sort) return data;
  const { field, direction } = sort;
  const multiplier = direction === "asc" ? 1 : -1;
  return [...data].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];
    if ((leftValue === null || leftValue === void 0) && (rightValue === null || rightValue === void 0)) {
      return 0;
    }
    if (leftValue === null || leftValue === void 0) return 1;
    if (rightValue === null || rightValue === void 0) return -1;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * multiplier;
    }
    return String(leftValue).localeCompare(String(rightValue), "ko") * multiplier;
  });
}
function paginateTableData(data, page, pageSize) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return data.slice(start, start + pageSize);
}
function getTotalPages(totalCount, pageSize) {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

// src/components/ui/table/components/Table/TableHeader.tsx
function TableHeader(props) {
  void props;
  return null;
}
TableHeader.displayName = TABLE_HEADER_DISPLAY_NAME;

// src/components/ui/table/components/Table/TablePagination.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function TablePagination({
  page,
  pageSize = 10,
  totalCount = 0,
  onChange,
  className
}) {
  const totalPages = getTotalPages(totalCount, pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;
  return /* @__PURE__ */ jsxs6("div", { className: cn("TablePaginationJSX", className), children: [
    /* @__PURE__ */ jsx7(
      "button",
      {
        type: "button",
        className: "pagination-button",
        disabled: !canGoPrev,
        onClick: () => onChange(safePage - 1),
        "aria-label": "\uC774\uC804 \uD398\uC774\uC9C0",
        children: /* @__PURE__ */ jsx7(ChevronLeft, { className: "pagination-button-icon" })
      }
    ),
    /* @__PURE__ */ jsxs6("span", { className: "pagination-label", children: [
      safePage,
      " / ",
      totalPages
    ] }),
    /* @__PURE__ */ jsx7(
      "button",
      {
        type: "button",
        className: "pagination-button",
        disabled: !canGoNext,
        onClick: () => onChange(safePage + 1),
        "aria-label": "\uB2E4\uC74C \uD398\uC774\uC9C0",
        children: /* @__PURE__ */ jsx7(ChevronRight, { className: "pagination-button-icon" })
      }
    )
  ] });
}
TablePagination.displayName = TABLE_PAGINATION_DISPLAY_NAME;

// src/components/ui/table/components/Table/Table.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function TableRoot({
  data,
  children,
  className,
  totalCount,
  filteredCount,
  ...dataTableProps
}) {
  const { header, pagination: paginationElement } = useMemo3(
    () => parseTableChildren(children),
    [children]
  );
  const [sort, setSort] = useState4(null);
  const handleSort = useCallback4((field) => {
    setSort((previous) => {
      if (previous?.field !== field) {
        return { field, direction: "asc" };
      }
      if (previous.direction === "asc") {
        return { field, direction: "desc" };
      }
      return null;
    });
  }, []);
  const columns = useMemo3(() => {
    return extractColumnElements(header).map(
      (columnElement) => buildColumnDef(columnElement.props, sort, handleSort)
    );
  }, [header, sort, handleSort]);
  const paginationProps = paginationElement?.props;
  const pageSize = paginationProps?.pageSize ?? 10;
  const page = paginationProps?.page ?? 1;
  const resolvedTotalCount = paginationProps?.totalCount ?? totalCount ?? data.length;
  const tableData = useMemo3(() => {
    const sortedData = sortTableData(data, sort);
    if (!paginationProps) return sortedData;
    return paginateTableData(sortedData, page, pageSize);
  }, [data, sort, paginationProps, page, pageSize]);
  if (columns.length === 0) {
    console.warn("[Table] Table.Header \uC548\uC5D0 Table.Column\uC744 \uD558\uB098 \uC774\uC0C1 \uC120\uC5B8\uD574 \uC8FC\uC138\uC694.");
  }
  return /* @__PURE__ */ jsxs7("div", { className: "TableJSX", children: [
    /* @__PURE__ */ jsx8(
      DataTable,
      {
        ...dataTableProps,
        data: tableData,
        columns,
        totalCount: paginationProps ? resolvedTotalCount : totalCount,
        filteredCount: filteredCount ?? data.length,
        className: cn(className, paginationProps && "DataTableJSX--with-pagination")
      }
    ),
    paginationProps && /* @__PURE__ */ jsx8(
      TablePagination,
      {
        page,
        pageSize,
        totalCount: resolvedTotalCount,
        onChange: paginationProps.onChange,
        className: paginationProps.className
      }
    )
  ] });
}
function createTable() {
  function Column(props) {
    void props;
    return null;
  }
  Column.displayName = TABLE_COLUMN_DISPLAY_NAME;
  return Object.assign(
    function BoundTable(props) {
      return /* @__PURE__ */ jsx8(TableRoot, { ...props });
    },
    {
      Header: TableHeader,
      Column,
      Body: TableBody,
      Pagination: TablePagination
    }
  );
}
var Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Column: TableColumn,
  Body: TableBody,
  Pagination: TablePagination
});
export {
  DataTable,
  Table,
  createTable
};
