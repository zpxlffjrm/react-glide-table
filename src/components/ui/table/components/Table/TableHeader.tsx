import type { ReactNode } from "react"

import { TABLE_HEADER_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"

type TableHeaderProps = {
  children: ReactNode
}

/** 컬럼 선언 슬롯. DOM을 렌더하지 않습니다. */
function TableHeader(props: TableHeaderProps) {
  void props

  return null
}

TableHeader.displayName = TABLE_HEADER_DISPLAY_NAME

export { TableHeader }
export type { TableHeaderProps }
