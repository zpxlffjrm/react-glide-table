import { Children, isValidElement, type ReactElement, type ReactNode } from "react"

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

function flattenColumnElements(children: ReactNode): ReactElement[] {
  const result: ReactElement[] = []

  for (const child of Children.toArray(children)) {
    if (isTableColumnElement(child)) {
      result.push(child)
      continue
    }

    // Fragments / nested arrays are not columns themselves — walk into them.
    if (isValidElement(child)) {
      const nested = (child.props as { children?: ReactNode }).children
      if (nested != null) {
        result.push(...flattenColumnElements(nested))
      }
    }
  }

  return result
}

export function extractColumnElements(header: ReactElement | null): ReactElement[] {
  if (!header) return []

  const { children } = header.props as { children?: ReactNode }

  return flattenColumnElements(children)
}
