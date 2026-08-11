import {
  type Cell,
  type CellContext,
  type ColumnSizingState,
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
  DATA_TABLE_COLUMN_MAX_SIZE,
  DATA_TABLE_COLUMN_MIN_SIZE,
  DATA_TABLE_ROW_HEIGHT,
  DATA_TABLE_VIRTUAL_OVERSCAN,
} from "@/components/ui/table/constants";
import type { DataTableRowContextValue } from "@/components/ui/table/DataTableContext";
import { useCellEdit } from "@/components/ui/table/features/cell-edit/useCellEdit";
import { commitCellValue } from "@/components/ui/table/features/cell-render/commitCellValue";
import { createCellRendererRegistry } from "@/components/ui/table/features/cell-render/registry";
import { withCellUpdate } from "@/components/ui/table/features/cell-render/withCellUpdate";
import type { CellPosition } from "@/components/ui/table/features/cell-selection/cellSelection";
import { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection";
import {
  buildColumnFreezeOffsets,
  resolveColumnFreezeSide,
  type ColumnFreezeOffset,
} from "@/components/ui/table/features/column-freeze/columnFreeze";
import type { SearchResultItem } from "@/components/ui/table/features/inline-search/inlineSearch";
import {
  buildFlatSearchCorpus,
  buildTreeSearchCorpus,
  collectAncestorKeysToExpand,
  mapSearchResultToVisibleItem,
  mapSearchResultsToVisibleKeys,
} from "@/components/ui/table/features/inline-search/inlineSearch";
import { useInlineSearch } from "@/components/ui/table/features/inline-search/useInlineSearch";
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
import type {
  DataTableCopyActions,
  DataTableProps,
} from "@/components/ui/table/types";
import type { DataTableLabels } from "@/core/labels";
import { resolveDataTableLabels } from "@/core/labels";

const EMPTY_COLUMN_FREEZE_OFFSETS = new Map<string, ColumnFreezeOffset>();
const EMPTY_SEARCH_MATCH_KEYS = new Set<string>();

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
  enableColumnResize: boolean;
  enableColumnFreeze: boolean;
  enableInlineSearch: boolean;
  shouldVirtualize: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  rootRef: RefObject<HTMLDivElement | null>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRows: VirtualItem[];
  paddingTop: number;
  paddingBottom: number;
  rowContextValue: DataTableRowContextValue;
  /**
   * TanStack `CellContext` with `update` injected for custom `ColumnDef.cell` renders.
   * Prefer this over `cell.getContext()` when calling `flexRender` yourself.
   */
  getCellContext: <TValue>(cell: Cell<T, TValue>) => CellContext<T, TValue>;
  handleToggleSelect: (row: Row<T>) => void;
  clearHover: () => void;
  copySelection: DataTableCopyActions["copySelection"];
  inlineSearch: {
    showSearch: boolean;
    searchValue: string;
    searchStatus: ReturnType<typeof useInlineSearch>["searchStatus"];
    searchInputRef: RefObject<HTMLInputElement | null>;
    searchInputId: string;
    canClose: boolean;
    /** Total searchable rows (includes collapsed tree rows). */
    searchRowCount: number;
    setSearchValue: (value: string) => void;
    closeSearch: () => void;
    goToNext: () => void;
    goToPrevious: () => void;
    openSearch: () => void;
  };
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
    cellRenderers,
    preserveRowSelection = false,
    toggleField,
    childField,
    flattenField,
    qtyField,
    expandedRows: controlledExpandedRows,
    onExpandedRowsChange,
    preventExpand = false,
    enableSubtreeCopy,
    onCopyActionsReady,
    onRowsPaste,
    enableInsertPaste,
    enableVirtualization = true,
    estimateRowHeight = DATA_TABLE_ROW_HEIGHT,
    virtualOverscan = DATA_TABLE_VIRTUAL_OVERSCAN,
    enableColumnResize = false,
    columnSizing: controlledColumnSizing,
    onColumnSizingChange,
    columnResizeMode = "onChange",
    enableColumnFreeze = false,
    enableInlineSearch = false,
    showSearch,
    searchValue,
    onSearchValueChange,
    onSearchClose,
    searchResults,
    onSearchResultsChanged,
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
  const resolvedEnableSubtreeCopy = enableSubtreeCopy ?? enableExpand;
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({});
  const [internalExpandedRows, setInternalExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const columnSizing = controlledColumnSizing ?? internalColumnSizing;

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
    ...(enableColumnResize
      ? {
          defaultColumn: {
            minSize: DATA_TABLE_COLUMN_MIN_SIZE,
            maxSize: DATA_TABLE_COLUMN_MAX_SIZE,
          },
        }
      : {}),
    enableColumnResizing: enableColumnResize,
    columnResizeMode,
    state: {
      rowSelection: rowSelectionMode === "none" ? {} : rowSelection,
      ...(enableColumnResize ? { columnSizing } : {}),
    },
    onColumnSizingChange: enableColumnResize
      ? (updater) => {
          if (onColumnSizingChange) {
            onColumnSizingChange(updater);

            return;
          }

          setInternalColumnSizing((previous) =>
            typeof updater === "function" ? updater(previous) : updater,
          );
        }
      : undefined,
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
  const primaryRowSpanColumnId = rowSpanColumnKeys[0]?.columnId;

  const columnRowSpanMap = useMemo(
    () => buildColumnRowSpanMap(tableData, rowSpanColumnKeys),
    [tableData, rowSpanColumnKeys],
  );

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length || 1;
  const visibleLeafColumns = table.getVisibleLeafColumns();

  const columnFreezeOffsets = useMemo(() => {
    if (!enableColumnFreeze) return EMPTY_COLUMN_FREEZE_OFFSETS;

    return buildColumnFreezeOffsets(
      visibleLeafColumns.map((column) => ({
        id: column.id,
        size: column.getSize(),
        side: resolveColumnFreezeSide(column.columnDef.meta?.frozen),
      })),
    );
  }, [enableColumnFreeze, visibleLeafColumns, columnSizing]);

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

  // Contiguous merge spans can share the same plantId/lineId after paste —
  // highlight by selected row index, not by global key value.
  const selectedRowIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const selectedRow of selectedRows) {
      indices.add(selectedRow.index);
    }
    return indices;
  }, [selectedRows]);

  const scrollCellIntoView = useCallback(
    (
      rowIndex: number,
      colIndex: number,
      options?: { align?: "auto" | "center" | "nearest" },
    ) => {
      const align = options?.align ?? "nearest";
      const blockAlign = align === "center" ? "center" : "nearest";

      if (shouldVirtualize) {
        rowVirtualizer.scrollToIndex(rowIndex, {
          align: align === "nearest" ? "auto" : align,
        });
      }

      const scrollElement = scrollRef.current;
      if (!scrollElement) return;

      const scrollToMatchedCell = () => {
        const cell = scrollElement.querySelector(
          `[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`,
        );
        if (cell instanceof HTMLElement) {
          cell.scrollIntoView({ block: blockAlign, inline: "nearest" });
        }
      };

      if (shouldVirtualize) {
        requestAnimationFrame(scrollToMatchedCell);
        return;
      }

      scrollToMatchedCell();
    },
    [rowVirtualizer, shouldVirtualize],
  );

  const handleCellNavigate = useCallback(
    (position: CellPosition) => {
      scrollCellIntoView(position.row, position.col, { align: "nearest" });
    },
    [scrollCellIntoView],
  );

  const {
    dragState,
    activeSelectionBounds,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
    copySelection,
  } = useCellSelection({
    data: tableData,
    rows,
    enabled: enableCellSelection,
    columnCount: visibleLeafColumns.length,
    enableSubtreeCopy: resolvedEnableSubtreeCopy,
    enableInsertPaste: enableInsertPaste ?? true,
    onDataChange,
    onBatchChange,
    onRowsPaste,
    onCellNavigate: handleCellNavigate,
  });

  const {
    editingCell,
    draftValue,
    setDraftValue,
    startEdit,
    commitEdit,
    cancelEdit,
  } = useCellEdit({ data: tableData, rows, onDataChange, onCellChange });

  const cellRendererRegistry = useMemo(
    () => createCellRendererRegistry(cellRenderers),
    [cellRenderers],
  );

  const commitRenderedCellValue = useCallback(
    (rowId: string, columnId: string, value: unknown) =>
      commitCellValue({
        data: tableData,
        rows,
        rowId,
        columnId,
        value,
        onCellChange,
        onDataChange,
      }),
    [onCellChange, onDataChange, rows, tableData],
  );

  const getCellContext = useCallback(
    <TValue,>(cell: Cell<T, TValue>) =>
      withCellUpdate(cell.getContext(), commitRenderedCellValue),
    [commitRenderedCellValue],
  );

  const handleCellMouseDownWithCommit = useCallback(
    (
      rowIndex: number,
      colIndex: number,
      options?: { shiftKey?: boolean },
    ) => {
      const isSameEditingCell =
        editingCell?.rowIndex === rowIndex &&
        editingCell?.colIndex === colIndex;

      if (editingCell && !isSameEditingCell && !commitEdit()) {
        return;
      }

      handleCellMouseDown(rowIndex, colIndex, options);
    },
    [commitEdit, editingCell, handleCellMouseDown],
  );

  const navigateToSearchResult = useCallback(
    (item: SearchResultItem) => {
      const [colIndex, rowIndex] = item;
      handleCellMouseDownWithCommit(rowIndex, colIndex);
      scrollCellIntoView(rowIndex, colIndex, { align: "center" });
    },
    [handleCellMouseDownWithCommit, scrollCellIntoView],
  );

  const resolveSearchRowId = useCallback(
    (row: T, index: number) => {
      if (getRowId) return getRowId(row, index);

      // Tree corpus includes collapsed rows, so index-based IDs desync from
      // the visible row list. Prefer stable per-row fields; toggleField can
      // collide (duplicate expand keys), so only use it as a last resort.
      if (enableExpand) {
        const record = row as Record<string, unknown>;
        const idValue = record.id;
        if (idValue != null && String(idValue).length > 0) {
          return String(idValue);
        }

        const uniqueId = record.uniqueId;
        if (uniqueId != null && String(uniqueId).length > 0) {
          return String(uniqueId);
        }

        if (toggleField) {
          const toggleValue = record[toggleField];
          if (toggleValue != null && String(toggleValue).length > 0) {
            return String(toggleValue);
          }
        }
      }

      return String(index);
    },
    [enableExpand, getRowId, toggleField],
  );

  const searchCorpus = useMemo(() => {
    if (!enableInlineSearch) return [];

    if (enableExpand && toggleField) {
      return buildTreeSearchCorpus(tableData, {
        toggleField,
        getRowId: resolveSearchRowId,
      });
    }

    return buildFlatSearchCorpus(tableData, resolveSearchRowId);
  }, [
    enableExpand,
    enableInlineSearch,
    resolveSearchRowId,
    tableData,
    toggleField,
  ]);

  const searchCorpusRef = useRef(searchCorpus);
  searchCorpusRef.current = searchCorpus;

  const visibleRowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(resolveSearchRowId(row.original as T, row.index), row.index);
    }
    return map;
  }, [resolveSearchRowId, rows]);

  const getSearchCellValue = useCallback(
    (rowIndex: number, colIndex: number) => {
      const corpusRow = searchCorpusRef.current[rowIndex];
      const column = visibleLeafColumns[colIndex];
      if (!corpusRow || !column) return undefined;

      // Prefer TanStack accessor resolution when the row is currently visible.
      const visibleIndex = visibleRowIndexById.get(corpusRow.id);
      if (visibleIndex !== undefined) {
        const visibleRow = rows[visibleIndex];
        if (visibleRow) {
          return visibleRow.getValue(column.id);
        }
      }

      const columnDef = column.columnDef;
      if (
        "accessorFn" in columnDef &&
        typeof columnDef.accessorFn === "function"
      ) {
        return columnDef.accessorFn(corpusRow.data, rowIndex);
      }

      if (
        "accessorKey" in columnDef &&
        columnDef.accessorKey != null &&
        columnDef.accessorKey !== ""
      ) {
        return corpusRow.data[String(columnDef.accessorKey) as keyof T];
      }

      return corpusRow.data[column.id as keyof T];
    },
    [rows, visibleLeafColumns, visibleRowIndexById],
  );

  const pendingSearchNavRef = useRef<{
    colIndex: number;
    rowId: string;
  } | null>(null);

  const focusSearchResult = useCallback(
    (colIndex: number, visibleRowIndex: number) => {
      navigateToSearchResult([colIndex, visibleRowIndex]);
    },
    [navigateToSearchResult],
  );

  const navigateToCorpusSearchResult = useCallback(
    (item: SearchResultItem) => {
      const [colIndex, corpusRowIndex] = item;
      const corpusRow = searchCorpusRef.current[corpusRowIndex];
      if (!corpusRow) return;

      const missingKeys = collectAncestorKeysToExpand(corpusRow, expandedRows);
      if (missingKeys.length > 0) {
        pendingSearchNavRef.current = {
          colIndex,
          rowId: corpusRow.id,
        };
        const next = new Set(expandedRows);
        for (const key of corpusRow.ancestorToggleKeys) {
          next.add(key);
        }
        handleExpandedRowsChange(next);

        return;
      }

      const visibleItem = mapSearchResultToVisibleItem(
        item,
        searchCorpusRef.current,
        visibleRowIndexById,
      );
      if (!visibleItem) return;

      focusSearchResult(visibleItem[0], visibleItem[1]);
    },
    [
      expandedRows,
      focusSearchResult,
      handleExpandedRowsChange,
      visibleRowIndexById,
    ],
  );

  useEffect(() => {
    const pending = pendingSearchNavRef.current;
    if (!pending) return;

    const visibleRowIndex = visibleRowIndexById.get(pending.rowId);
    if (visibleRowIndex === undefined) return;

    pendingSearchNavRef.current = null;
    focusSearchResult(pending.colIndex, visibleRowIndex);
  }, [focusSearchResult, rows, visibleRowIndexById]);

  const initialSearchStartRow = virtualRows[0]?.index ?? 0;

  const inlineSearch = useInlineSearch({
    enabled: enableInlineSearch,
    rowCount: searchCorpus.length,
    columnCount: visibleLeafColumns.length,
    getCellValue: getSearchCellValue,
    initialStartRow: initialSearchStartRow,
    showSearch,
    searchValue,
    searchResults,
    onSearchValueChange,
    onSearchClose,
    onSearchResultsChanged,
    onNavigateToResult: navigateToCorpusSearchResult,
    rootRef,
  });

  const visibleSearchMatchKeys = useMemo(() => {
    if (!enableInlineSearch) return EMPTY_SEARCH_MATCH_KEYS;

    return mapSearchResultsToVisibleKeys(
      inlineSearch.searchResults,
      searchCorpus,
      visibleRowIndexById,
    );
  }, [
    enableInlineSearch,
    inlineSearch.searchResults,
    searchCorpus,
    visibleRowIndexById,
  ]);

  const visibleActiveMatch = useMemo(() => {
    if (!enableInlineSearch || !inlineSearch.activeMatch) return null;

    return mapSearchResultToVisibleItem(
      inlineSearch.activeMatch,
      searchCorpus,
      visibleRowIndexById,
    );
  }, [
    enableInlineSearch,
    inlineSearch.activeMatch,
    searchCorpus,
    visibleRowIndexById,
  ]);

  const clearHover = useCallback(() => {
    setHoveredRowIndex(null);
  }, []);

  const handleRowHover = useCallback((rowIndex: number, _rowData: T) => {
    setHoveredRowIndex(rowIndex);
  }, []);

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
        primaryRowSpanColumnId,
        columnRowSpanMap,
        hoveredRowIndex,
        selectedRowIndices,
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
      cellRender: {
        registry: cellRendererRegistry,
        commitValue: commitRenderedCellValue,
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
      columnResize: {
        enableColumnResize,
      },
      columnFreeze: {
        enableColumnFreeze,
        offsets: columnFreezeOffsets,
      },
      inlineSearch: {
        enabled: enableInlineSearch,
        matchKeys: visibleSearchMatchKeys,
        activeMatch: visibleActiveMatch,
      },
    };
  }, [
    enableRowSpan,
    primaryRowSpanKey,
    primaryRowSpanColumnId,
    columnRowSpanMap,
    hoveredRowIndex,
    selectedRowIndices,
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
    cellRendererRegistry,
    commitRenderedCellValue,
    enableExpand,
    toggleField,
    expandedRows,
    preventExpand,
    handleToggleExpand,
    labels.expandRow,
    labels.collapseRow,
    enableColumnResize,
    enableColumnFreeze,
    columnFreezeOffsets,
    enableInlineSearch,
    visibleSearchMatchKeys,
    visibleActiveMatch,
  ]);

  const copySelectionRef = useRef(copySelection);
  useEffect(() => {
    copySelectionRef.current = copySelection;
  }, [copySelection]);

  const stableCopySelection = useCallback<
    DataTableCopyActions["copySelection"]
  >((options) => copySelectionRef.current(options), []);

  useEffect(() => {
    onCopyActionsReady?.({ copySelection: stableCopySelection });
  }, [onCopyActionsReady, stableCopySelection]);

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
    enableColumnResize,
    enableColumnFreeze,
    enableInlineSearch,
    shouldVirtualize,
    scrollRef,
    rootRef,
    rowVirtualizer,
    virtualRows,
    paddingTop,
    paddingBottom,
    rowContextValue,
    getCellContext,
    handleToggleSelect,
    clearHover,
    copySelection: stableCopySelection,
    inlineSearch: {
      showSearch: inlineSearch.showSearch,
      searchValue: inlineSearch.searchValue,
      searchStatus: inlineSearch.searchStatus,
      searchInputRef: inlineSearch.searchInputRef,
      searchInputId: inlineSearch.searchInputId,
      canClose: inlineSearch.canClose,
      searchRowCount: searchCorpus.length,
      setSearchValue: inlineSearch.setSearchValue,
      closeSearch: inlineSearch.closeSearch,
      goToNext: inlineSearch.goToNext,
      goToPrevious: inlineSearch.goToPrevious,
      openSearch: inlineSearch.openSearch,
    },
  };
}
