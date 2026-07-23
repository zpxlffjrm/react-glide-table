export const CELL_ALIGN_CLASS = {
  left: "cell-align-left",
  center: "cell-align-center",
  right: "cell-align-right",
} as const

export const ROW_HOVER_CLASS = "row-hoverable"
export const ROW_HOVERED_BG_CLASS = "row-hovered"
export const CELL_SELECTION_FILL_CLASS = "cell-selection-fill"

/** DataTable 행 고정 높이 (.DataTableRowJSX height) */
export const DATA_TABLE_ROW_HEIGHT = 44
/** 가상화 시 뷰포트 밖 미리 렌더할 행 수 */
export const DATA_TABLE_VIRTUAL_OVERSCAN = 8
