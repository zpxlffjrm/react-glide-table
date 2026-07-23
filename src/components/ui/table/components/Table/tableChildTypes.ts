import { isValidElement, type ReactElement, type ReactNode } from "react"

export const TABLE_HEADER_DISPLAY_NAME = "Table.Header"
export const TABLE_BODY_DISPLAY_NAME = "Table.Body"
export const TABLE_COLUMN_DISPLAY_NAME = "Table.Column"
export const TABLE_PAGINATION_DISPLAY_NAME = "Table.Pagination"

export function getComponentDisplayName(type: unknown): string | undefined {
  if (typeof type === "function" || (typeof type === "object" && type !== null)) {
    return (type as { displayName?: string }).displayName
  }

  return undefined
}

export function isTableHeaderElement(child: ReactNode): child is ReactElement {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_HEADER_DISPLAY_NAME
}

export function isTableBodyElement(child: ReactNode): child is ReactElement {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_BODY_DISPLAY_NAME
}

export function isTableColumnElement(child: ReactNode): child is ReactElement {
  return isValidElement(child) && getComponentDisplayName(child.type) === TABLE_COLUMN_DISPLAY_NAME
}

export function isTablePaginationElement(child: ReactNode): child is ReactElement {
  return (
    isValidElement(child) && getComponentDisplayName(child.type) === TABLE_PAGINATION_DISPLAY_NAME
  )
}
