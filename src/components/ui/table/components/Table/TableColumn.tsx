import { TABLE_COLUMN_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"
import type { TableColumnProps } from "@/components/ui/table/types"

/** Table.Header 안에서만 사용합니다. DOM을 렌더하지 않고 컬럼 정의만 등록합니다. */
function TableColumn<T extends Record<string, unknown>, K extends string = keyof T & string>(
  props: TableColumnProps<T, K>,
) {
  void props

  return null
}

TableColumn.displayName = TABLE_COLUMN_DISPLAY_NAME

export { TableColumn }
