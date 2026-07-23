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
  DataTableProps,
  RowSelectionMode,
  RowSelectionState,
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
  CELL_SELECTION_EDGES_CLASS,
  getCellSelectionEdgeStyle,
  getRowIndexInMergedCell,
  hasCellSelectionEdges,
  isCellInSelection,
  type CellSelectionBounds,
  type DragState,
} from "@/components/ui/table/features/cell-selection/cellSelection"
export { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection"
export { applyFillData, collectFillChanges } from "@/components/ui/table/features/cell-selection/fillData"

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
