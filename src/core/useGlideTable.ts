import {
  type Row,
  type Table,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_VIRTUAL_OVERSCAN,
} from "@/components/ui/table/constants";
import type { DataTableRowContextValue } from "@/components/ui/table/DataTableContext";
import { useCellEdit } from "@/components/ui/table/features/cell-edit/useCellEdit";
import { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection";
import {
  toggleExpandedRowId,
  useConvertTreeData,
} from "@/components/ui/table/features/row-expand/row-expand";
import {
  applySelectionUpdater,
  resolveRowSelection,
} from "@/components/ui/table/features/row-selection/rowSelection";
import {
  buildColumnRowSpanMap,
  collectRowSpanColumns,
} from "@/components/ui/table/features/row-span/rowSpan";
import type { DataTableProps } from "@/components/ui/table/types";
import type { DataTableLabels } from "@/core/labels";
import { resolveDataTableLabels } from "@/core/labels";

export type UseGlideTableOptions<T extends Record<string, unknown>> = Omit<
  DataTableProps<T>,
  | "className"
  | "classNames"
  | "slots"
  | "summary"
  | "toolbar"
  | "isPending"
  | "totalCount"
  | "filteredCount"
>;

export type UseGlideTableResult<T extends Record<string, unknown>> = {
  table: Table<T>;
  tableData: T[];
  rows: Row<T>[];
  columnCount: number;
  selectedCount: number;
  labels: DataTableLabels;
  emptyText: string;
  loadingText: string;
  selectionLabel: DataTableLabels["selection"];
  enableCellSelection: boolean;
  shouldVirtualize: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRows: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  rowContextValue: DataTableRowContextValue;
  handleToggleSelect: (row: Row<T>) => void;
  clearHover: () => void;
};

export function useGlideTable<T extends Record<string, unknown>>(
  options: UseGlideTableOptions<T>,
): UseGlideTableResult<T> {
  const {
    data,
    columns,
    rowSelectionMode = "none",
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    selectionLabel,
    emptyText,
    loadingText,
    labels: labelsProp,
    enableRowSpan = false,
    getRowId,
    onRowClick,
    getRowClassName,
    getRowCanSelect,
    selectOnRowClick = true,
    enableCellSelection = true,
    onDataChange,
    onCellChange,
    onBatchChange,
    preserveRowSelection = false,
    toggleField,
    childField,
    flattenField,
    qtyField,
    expandedRows: controlledExpandedRows,
    onExpandedRowsChange,
    preventExpand = false,
    enableVirtualization = true,
    estimateRowHeight = DATA_TABLE_ROW_HEIGHT,
    virtualOverscan = DATA_TABLE_VIRTUAL_OVERSCAN,
  } = options;

  const labels = useMemo(() => {
    const resolved = resolveDataTableLabels(labelsProp);

    return {
      ...resolved,
      empty: labelsProp?.empty ?? emptyText ?? resolved.empty,
      loading: labelsProp?.loading ?? loadingText ?? resolved.loading,
      selection: labelsProp?.selection ?? selectionLabel ?? resolved.selection,
    };
  }, [labelsProp, emptyText, loadingText, selectionLabel]);

  const enableExpand = Boolean(toggleField);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const shouldVirtualize = enableVirtualization && !enableRowSpan;

  useEffect(() => {
    if (enableVirtualization && enableRowSpan) {
      console.warn(
        "[useGlideTable] enableRowSpan is on; virtualization is disabled to preserve cell merges.",
      );
    }
  }, [enableVirtualization, enableRowSpan]);

  const rowSelection = resolveRowSelection(
    rowSelectionMode,
    controlledRowSelection,
    internalRowSelection,
  );

  const expandedRows = controlledExpandedRows ?? internalExpandedRows;

  const handleExpandedRowsChange = useCallback(
    (next: Set<string>) => {
      if (onExpandedRowsChange) {
        onExpandedRowsChange(next);

        return;
      }

      setInternalExpandedRows(next);
    },
    [onExpandedRowsChange],
  );

  const tableData = useConvertTreeData({
    data,
    enabled: enableExpand,
    toggleField,
    childField,
    flattenField,
    qtyField,
    expandedRows,
    onExpandedRowsChange: enableExpand ? handleExpandedRowsChange : undefined,
    preventExpand,
  });

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
        );

        return;
      }

      setInternalRowSelection((previous) =>
        applySelectionUpdater(rowSelectionMode, updater, previous),
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId
      ? (originalRow, index) => getRowId(originalRow as T, index)
      : (_originalRow, index) => String(index),
  });

  const rowSpanColumnKeys = useMemo(() => {
    if (!enableRowSpan) return [];

    return collectRowSpanColumns(columns);
  }, [enableRowSpan, columns]);

  const primaryRowSpanKey = rowSpanColumnKeys[0]?.rowSpanKey;

  const columnRowSpanMap = useMemo(
    () => buildColumnRowSpanMap(tableData, rowSpanColumnKeys),
    [tableData, rowSpanColumnKeys],
  );

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length || 1;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: virtualOverscan,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const selectedGroupKeys = useMemo(() => {
    if (!enableRowSpan || !primaryRowSpanKey) return new Set<string>();

    const keys = new Set<string>();
    for (const selectedRow of selectedRows) {
      const value = selectedRow.original[primaryRowSpanKey];
      if (value !== null && value !== undefined) keys.add(String(value));
    }

    return keys;
  }, [enableRowSpan, primaryRowSpanKey, selectedRows]);

  const {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
  } = useCellSelection({
    data: tableData,
    rows,
    enabled: enableCellSelection,
    onDataChange,
    onBatchChange,
  });

  const {
    editingCell,
    draftValue,
    setDraftValue,
    startEdit,
    commitEdit,
    cancelEdit,
  } = useCellEdit({ data: tableData, rows, onDataChange, onCellChange });

  const handleCellMouseDownWithCommit = useCallback(
    (rowIndex: number, colIndex: number) => {
      const isSameEditingCell =
        editingCell?.rowIndex === rowIndex &&
        editingCell?.colIndex === colIndex;

      if (editingCell && !isSameEditingCell && !commitEdit()) {
        return;
      }

      handleCellMouseDown(rowIndex, colIndex);
    },
    [commitEdit, editingCell, handleCellMouseDown],
  );

  const clearHover = useCallback(() => {
    setHoveredRowIndex(null);
    setHoveredGroupKey(null);
  }, []);

  const handleRowHover = useCallback(
    (rowIndex: number, rowData: T) => {
      setHoveredRowIndex(rowIndex);
      if (!primaryRowSpanKey) {
        setHoveredGroupKey(null);

        return;
      }

      const groupValue = rowData[primaryRowSpanKey];
      setHoveredGroupKey(
        groupValue === null || groupValue === undefined
          ? null
          : String(groupValue),
      );
    },
    [primaryRowSpanKey],
  );

  const handleToggleSelect = useCallback(
    (row: Row<T>) => {
      if (!row.getCanSelect()) return;

      if (preserveRowSelection && row.getIsSelected()) {
        return;
      }

      row.toggleSelected();
    },
    [preserveRowSelection],
  );

  const handleToggleExpand = useCallback(
    (rowKey: string) => {
      if (preventExpand) return;

      handleExpandedRowsChange(toggleExpandedRowId(rowKey, expandedRows));
    },
    [preventExpand, handleExpandedRowsChange, expandedRows],
  );

  const rowContextValue = useMemo((): DataTableRowContextValue => {
    return {
      rowSpan: {
        enableRowSpan,
        primaryRowSpanKey,
        columnRowSpanMap,
        hoveredRowIndex,
        hoveredGroupKey,
        selectedGroupKeys,
        onRowHover:
          handleRowHover as DataTableRowContextValue["rowSpan"]["onRowHover"],
      },
      selection: {
        rowSelectionMode,
        selectOnRowClick,
        onRowClick:
          onRowClick as DataTableRowContextValue["selection"]["onRowClick"],
        getRowClassName:
          getRowClassName as DataTableRowContextValue["selection"]["getRowClassName"],
      },
      cellSelection: {
        enableCellSelection,
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
        expandRowLabel: labels.expandRow,
        collapseRowLabel: labels.collapseRow,
      },
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
    enableCellSelection,
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
    labels.expandRow,
    labels.collapseRow,
  ]);

  return {
    table,
    tableData,
    rows,
    columnCount,
    selectedCount,
    labels,
    emptyText: labels.empty,
    loadingText: labels.loading,
    selectionLabel: labels.selection,
    enableCellSelection,
    shouldVirtualize,
    scrollRef,
    rowVirtualizer,
    virtualRows,
    paddingTop,
    paddingBottom,
    rowContextValue,
    handleToggleSelect,
    clearHover,
  };
}
