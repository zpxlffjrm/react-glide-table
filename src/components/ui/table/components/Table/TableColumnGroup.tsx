import { TABLE_COLUMN_GROUP_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"
import type { TableColumnGroupProps } from "@/components/ui/table/types"

/** Used only inside Table.Header. Groups leaf columns under a multi-row header; does not render DOM. */
function TableColumnGroup(props: TableColumnGroupProps) {
  void props

  return null
}

TableColumnGroup.displayName = TABLE_COLUMN_GROUP_DISPLAY_NAME

export { TableColumnGroup }
