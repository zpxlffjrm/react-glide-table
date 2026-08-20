export const CELL_ALIGN_CLASS = {
  left: "cell-align-left",
  center: "cell-align-center",
  right: "cell-align-right",
} as const

export const ROW_HOVER_CLASS = "row-hoverable"
export const ROW_HOVERED_BG_CLASS = "row-hovered"
export const CELL_SELECTION_FILL_CLASS = "cell-selection-fill"

/** Fixed DataTable row height (.DataTableRowJSX height) */
export const DATA_TABLE_ROW_HEIGHT = 44
/** Header row height used for multi-row sticky `top` offsets (.data-table-head-row) */
export const DATA_TABLE_HEADER_ROW_HEIGHT = 40
/** Extra rows to pre-render outside the viewport when virtualizing */
export const DATA_TABLE_VIRTUAL_OVERSCAN = 8
/** Default column size when `width` is omitted (TanStack Table default) */
export const DATA_TABLE_COLUMN_SIZE = 150
/** Minimum column width when column resize is enabled */
export const DATA_TABLE_COLUMN_MIN_SIZE = 40
/** Maximum column width when column resize is enabled */
export const DATA_TABLE_COLUMN_MAX_SIZE = 800
/** Pointer movement (px) before a header press becomes a column reorder drag */
export const DATA_TABLE_COLUMN_REORDER_THRESHOLD = 4
