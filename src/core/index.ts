export {
  DEFAULT_DATA_TABLE_LABELS,
  resolveDataTableLabels,
  type DataTableLabels,
} from "@/core/labels"
export {
  DEFAULT_TREE_CHILDREN_FIELD,
  DEFAULT_TREE_ID_FIELD,
  DEFAULT_TREE_PARENT_ID_FIELD,
  DEFAULT_TREE_QTY_FIELD,
} from "@/core/treeDefaults"
export { useGlideTable, type UseGlideTableOptions, type UseGlideTableResult } from "@/core/useGlideTable"
export type {
  ColumnDef,
  ColumnOrderState,
  ColumnResizeMode,
  ColumnSizingState,
  DataTableCopyActions,
  DataTableProps,
  PasteMode,
  RowSelectionMode,
  RowSelectionState,
  RowsPastePayload,
} from "@/components/ui/table/types"

export {
  applyCellEdit,
  getCellEditDraftValue,
  getColumnEditType,
  isColumnEditable,
  parseCellEditValue,
  type EditingCell,
} from "@/components/ui/table/features/cell-edit/cellEdit"
export { useCellEdit } from "@/components/ui/table/features/cell-edit/useCellEdit"

export {
  BUILTIN_CELL_RENDERERS,
  commitCellValue,
  createCellRendererRegistry,
  formatDefaultCellValue,
  resolveCellRenderer,
  ResolvedTableCell,
  withCellUpdate,
  type BuiltinCellKind,
  type CellContextWithUpdate,
  type CellKind,
  type CellRenderContext,
  type CellRenderFn,
  type CellRenderer,
  type CellRendererRegistry,
} from "@/components/ui/table/features/cell-render"

export { getColumnSizeStyle } from "@/components/ui/table/features/column-resize/columnResize"

export {
  applyLeafColumnOrder,
  collectLeafColumnIds,
  moveColumnIds,
  resolveDropEdge,
  resolveLeafColumnOrder,
  type ColumnDropEdge,
} from "@/components/ui/table/features/column-reorder/columnReorder"
export { useColumnReorder } from "@/components/ui/table/features/column-reorder/useColumnReorder"

export {
  buildColumnFreezeOffsets,
  getColumnFreezeEdgeAttr,
  getColumnFreezeStyle,
  resolveColumnFreezeSide,
  resolveHeaderFreezeOffset,
  type ColumnFreezeColumnInput,
  type ColumnFreezeEdgeSide,
  type ColumnFreezeMeta,
  type ColumnFreezeOffset,
  type ColumnFreezeSide,
} from "@/components/ui/table/features/column-freeze/columnFreeze"

export {
  buildFlatSearchCorpus,
  buildSearchMatchKey,
  buildSearchMatchKeys,
  buildTreeSearchCorpus,
  cellValueToSearchText,
  collectAncestorKeysToExpand,
  collectSearchMatchesInRange,
  createSearchRegex,
  escapeSearchRegex,
  formatSearchResultLabel,
  INLINE_SEARCH_MAX_RESULTS,
  mapSearchResultToVisibleItem,
  mapSearchResultsToVisibleKeys,
  nextSearchIndex,
  nextSearchStride,
  previousSearchIndex,
  type SearchCorpusRow,
  type SearchResultItem,
  type SearchStatus,
} from "@/components/ui/table/features/inline-search/inlineSearch"
export {
  useInlineSearch,
  type UseInlineSearchOptions,
  type UseInlineSearchResult,
} from "@/components/ui/table/features/inline-search/useInlineSearch"

export {
  CELL_SELECTION_EDGES_CLASS,
  getCellSelectionEdgeStyle,
  getRowIndexInMergedCell,
  hasCellSelectionEdges,
  isCellInSelection,
  measureMergedSpanRowHeights,
  rowRangeToHeightRatios,
  type CellSelectionBounds,
  type DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
export { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection"
export {
  collectCopyRows,
  flattenSubtreeRows,
  formatCellValue,
  serializeCopyRowsToTSV,
  serializeSelectionToTSV,
  writeSelectionToClipboard,
  collectCopyRowEntries,
  type CopySelectionMode,
  type CopyRowEntry,
} from "@/components/ui/table/features/cell-selection/copyData"
export { applyFillData, collectFillChanges } from "@/components/ui/table/features/cell-selection/fillData"
export {
  buildRowsPastePayload,
  isEditablePasteTarget,
  parseClipboardTSV,
  parseClipboardTSVWithDepths,
  resolvePasteColumnIds,
} from "@/components/ui/table/features/cell-selection/pasteData"

export {
  canExpandRow,
  toggleExpandedRowId,
  useConvertTreeData,
  type TreeRow,
  type UseConvertTreeDataParams,
} from "@/components/ui/table/features/row-expand/row-expand"

export {
  applySelectionUpdater,
  resolveRowSelection,
} from "@/components/ui/table/features/row-selection/rowSelection"

export {
  buildColumnRowSpanMap,
  collectRowSpanColumns,
  resolveRowSpanAt,
  type ColumnRowSpanMap,
  type RowSpanColumnSpec,
  type RowSpanInfo,
} from "@/components/ui/table/features/row-span/rowSpan"
