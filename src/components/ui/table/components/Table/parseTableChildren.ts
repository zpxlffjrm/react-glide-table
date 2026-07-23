import { Children, type ReactElement, type ReactNode } from "react"

import {
  isTableBodyElement,
  isTableColumnElement,
  isTableHeaderElement,
  isTablePaginationElement,
} from "@/components/ui/table/components/Table/tableChildTypes"

export type ParsedTableChildren = {
  header: ReactElement | null
  body: ReactElement | null
  pagination: ReactElement | null
}

export function parseTableChildren(children: ReactNode): ParsedTableChildren {
  const slots: ParsedTableChildren = {
    header: null,
    body: null,
    pagination: null,
  }

  for (const child of Children.toArray(children)) {
    if (isTableHeaderElement(child)) {
      slots.header = child
      continue
    }

    if (isTableBodyElement(child)) {
      slots.body = child
      continue
    }

    if (isTablePaginationElement(child)) {
      slots.pagination = child
    }
  }

  return slots
}

export function extractColumnElements(header: ReactElement | null): ReactElement[] {
  if (!header) return []

  const { children } = header.props as { children?: ReactNode }

  return Children.toArray(children).filter(isTableColumnElement)
}
