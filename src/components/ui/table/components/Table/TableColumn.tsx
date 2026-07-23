import { TABLE_COLUMN_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"
import type { TableColumnProps } from "@/components/ui/table/types"

/** Used only inside Table.Header. Registers a column definition; does not render DOM. */
function TableColumn<T extends Record<string, unknown>, K extends string = keyof T & string>(
  props: TableColumnProps<T, K>,
) {
  void props

  return null
}

TableColumn.displayName = TABLE_COLUMN_DISPLAY_NAME

export { TableColumn }
