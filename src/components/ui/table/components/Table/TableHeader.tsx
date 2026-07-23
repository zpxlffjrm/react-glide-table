import type { ReactNode } from "react"

import { TABLE_HEADER_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"

type TableHeaderProps = {
  children: ReactNode
}

/** Column declaration slot. Does not render DOM. */
function TableHeader(props: TableHeaderProps) {
  void props

  return null
}

TableHeader.displayName = TABLE_HEADER_DISPLAY_NAME

export { TableHeader }
export type { TableHeaderProps }
