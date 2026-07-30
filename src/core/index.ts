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

export { getColumnSizeStyle } from "@/components/ui/table/features/column-resize/columnResize"

export {
  buildColumnFreezeOffsets,
  getColumnFreezeStyle,
  resolveColumnFreezeSide,
  type ColumnFreezeColumnInput,
  type ColumnFreezeMeta,
  type ColumnFreezeOffset,
  type ColumnFreezeSide,
} from "@/components/ui/table/features/column-freeze/columnFreeze"

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
  type RowSpanInfo,
} from "@/components/ui/table/features/row-span/rowSpan"
