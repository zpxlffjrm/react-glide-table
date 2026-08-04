import { Children, isValidElement, type ReactElement, type ReactNode } from "react"

import {
  isTableBodyElement,
  isTableColumnElement,
  isTableColumnGroupElement,
  isTableHeaderElement,
  isTablePaginationElement,
} from "@/components/ui/table/components/Table/tableChildTypes"
import type { TableColumnGroupProps, TableColumnProps } from "@/components/ui/table/types"

export type ParsedTableChildren = {
  header: ReactElement | null
  body: ReactElement | null
  pagination: ReactElement | null
}

export type ColumnTreeLeaf<T extends Record<string, unknown> = Record<string, unknown>> = {
  type: "leaf"
  props: TableColumnProps<T>
}

export type ColumnTreeGroup<T extends Record<string, unknown> = Record<string, unknown>> = {
  type: "group"
  props: TableColumnGroupProps
  columns: ColumnTreeNode<T>[]
}

export type ColumnTreeNode<T extends Record<string, unknown> = Record<string, unknown>> =
  | ColumnTreeLeaf<T>
  | ColumnTreeGroup<T>

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

function walkColumnTreeNodes<T extends Record<string, unknown>>(
  children: ReactNode,
): ColumnTreeNode<T>[] {
  const result: ColumnTreeNode<T>[] = []

  for (const child of Children.toArray(children)) {
    if (isTableColumnElement(child)) {
      result.push({
        type: "leaf",
        props: child.props as TableColumnProps<T>,
      })
      continue
    }

    if (isTableColumnGroupElement(child)) {
      const groupProps = child.props as TableColumnGroupProps
      result.push({
        type: "group",
        props: groupProps,
        columns: walkColumnTreeNodes<T>(groupProps.children),
      })
      continue
    }

    // Fragments / nested arrays are not columns themselves — walk into them.
    if (isValidElement(child)) {
      const nested = (child.props as { children?: ReactNode }).children
      if (nested != null) {
        result.push(...walkColumnTreeNodes<T>(nested))
      }
    }
  }

  return result
}

/** Preserve Column / ColumnGroup nesting for multi-row headers. */
export function extractColumnTree<T extends Record<string, unknown>>(
  header: ReactElement | null,
): ColumnTreeNode<T>[] {
  if (!header) return []

  const { children } = header.props as { children?: ReactNode }

  return walkColumnTreeNodes<T>(children)
}

/** Flat leaf columns only (ignores group structure). */
export function extractColumnElements(header: ReactElement | null): ReactElement[] {
  if (!header) return []

  const { children } = header.props as { children?: ReactNode }

  return flattenColumnElements(children)
}

function flattenColumnElements(children: ReactNode): ReactElement[] {
  const result: ReactElement[] = []

  for (const child of Children.toArray(children)) {
    if (isTableColumnElement(child)) {
      result.push(child)
      continue
    }

    if (isValidElement(child)) {
      const nested = (child.props as { children?: ReactNode }).children
      if (nested != null) {
        result.push(...flattenColumnElements(nested))
      }
    }
  }

  return result
}
