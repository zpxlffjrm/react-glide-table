import { useEffect, useMemo, useRef } from "react"

import {
  DEFAULT_TREE_CHILDREN_FIELD,
  DEFAULT_TREE_ID_FIELD,
  DEFAULT_TREE_PARENT_ID_FIELD,
  DEFAULT_TREE_QTY_FIELD,
} from "@/core/treeDefaults"

export type TreeRow<T extends Record<string, unknown> = Record<string, unknown>> = T & {
  level: number
  children: TreeRow<T>[]
  treeNo?: string
  uniqueId?: string
  parentCount?: number
  processed?: boolean
}

export type UseConvertTreeDataParams<T extends Record<string, unknown>> = {
  data: T[] | null
  /** When false, returns data unchanged (plain DataTable) */
  enabled?: boolean
  /** Row id / expand key field (idField). Defaults to `id` */
  toggleField?: string
  /** Child → parent reference field (parentIdField). Defaults to `parentId` */
  childField?: string
  /** Nested children array field (childrenField). Defaults to `children` */
  flattenField?: string
  /** Parent quantity field (qtyField). Used for parentCount. Defaults to `qty` */
  qtyField?: string
  preventExpand?: boolean
  startIndex?: number
  expandedRows?: Set<string>
  onExpandedRowsChange?: (next: Set<string>) => void
}

function getFieldValue(row: Record<string, unknown>, key: string): unknown {
  return row[key]
}

export function canExpandRow(row: Record<string, unknown>): boolean {
  const children = row.children
  const level = row.level

  return Array.isArray(children) && children.length > 0 && (level === 0 || level === undefined)
}

export function toggleExpandedRowId(rowId: string, previous: Set<string>): Set<string> {
  const next = new Set(previous)
  if (next.has(rowId)) {
    next.delete(rowId)
  } else {
    next.add(rowId)
  }

  return next
}

/**
 * Builds a tree from flat/nested data, then returns only rows visible under expandedRows.
 * When enabled=false, returns data as-is.
 *
 * Flat rows attach to the nearest *preceding* parent with a matching toggle key
 * (so duplicate keys after paste stay under the pasted parent). Parents must appear
 * before their children; a child whose parent is later in the array becomes a root.
 */
export const useConvertTreeData = <T extends Record<string, unknown>>({
  data,
  enabled = true,
  toggleField = DEFAULT_TREE_ID_FIELD,
  childField = DEFAULT_TREE_PARENT_ID_FIELD,
  flattenField = DEFAULT_TREE_CHILDREN_FIELD,
  qtyField = DEFAULT_TREE_QTY_FIELD,
  preventExpand = false,
  startIndex = 1,
  expandedRows,
  onExpandedRowsChange,
}: UseConvertTreeDataParams<T>): T[] => {
  const onExpandedRowsChangeRef = useRef(onExpandedRowsChange)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    onExpandedRowsChangeRef.current = onExpandedRowsChange
  }, [onExpandedRowsChange])

  useEffect(() => {
    if (!data || data.length === 0) {
      hasInitializedRef.current = false

      return
    }

    if (!enabled || hasInitializedRef.current) return

    const ids = data
      .map((item) => getFieldValue(item, toggleField))
      .filter((value): value is string => typeof value === "string" && value.length > 0)

    onExpandedRowsChangeRef.current?.(new Set(ids))
    hasInitializedRef.current = true
  }, [enabled, data, toggleField])

  const processedData = useMemo(() => {
    if (!enabled || !data || data.length === 0) return [] as TreeRow<T>[]

    const flattenedData: Record<string, unknown>[] = []

    const flattenItems = (items: Record<string, unknown>[]) => {
      items.forEach((item) => {
        const newItem = { ...item }
        const nested = newItem[flattenField]

        if (Array.isArray(nested)) {
          const children = nested.map((child) =>
            typeof child === "object" && child !== null
              ? { ...(child as Record<string, unknown>) }
              : child,
          )
          delete newItem[flattenField]
          flattenedData.push(newItem)

          children.forEach((child) => {
            if (typeof child === "object" && child !== null) {
              ;(child as Record<string, unknown>)[childField] = newItem[toggleField]
            }
          })

          flattenItems(children as Record<string, unknown>[])
        } else {
          flattenedData.push(newItem)
        }
      })
    }

    flattenItems(data as Record<string, unknown>[])

    const dataWithLevels = flattenedData.map((item) => ({
      ...item,
      level: 0,
      children: [] as TreeRow<T>[],
      processed: false,
    })) as TreeRow<T>[]

    /** Nearest preceding row whose toggleField matches — handles duplicate codes after paste. */
    const findNearestPrecedingParent = (
      index: number,
      parentKey: unknown,
    ): TreeRow<T> | undefined => {
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = dataWithLevels[i]
        if (!candidate) continue
        if (getFieldValue(candidate, toggleField) === parentKey) {
          return candidate
        }
      }

      return undefined
    }

    const rootItems: TreeRow<T>[] = []

    dataWithLevels.forEach((item) => {
      if (!getFieldValue(item, childField)) {
        rootItems.push(item)
        item.processed = true
      }
    })

    dataWithLevels.forEach((item, index) => {
      const parentKey = getFieldValue(item, childField)
      if (!parentKey || item.processed) return

      const parent = findNearestPrecedingParent(index, parentKey)
      if (parent) {
        item.level = parent.level + 1
        parent.children.push(item)
        item.processed = true
        return
      }

      rootItems.push(item)
      item.processed = true
    })

    return rootItems
  }, [enabled, data, toggleField, childField, flattenField])

  const flattenTree = useMemo(() => {
    if (!enabled) return [] as TreeRow<T>[]

    const flatten = (
      nodes: TreeRow<T>[],
      result: TreeRow<T>[] = [],
      level: number = 0,
    ): TreeRow<T>[] => {
      nodes.forEach((node, index) => {
        const currentIndex = level === 0 ? `${index + startIndex}` : `${level}-${index + 1}`
        const toggleValue = getFieldValue(node, toggleField)
        const uniqueId = `${index}-${String(toggleValue ?? "")}`

        result.push({
          ...node,
          treeNo: currentIndex,
          uniqueId,
          processed: true,
        })

        const shouldExpandChildren =
          node.children.length > 0 &&
          (preventExpand || (typeof toggleValue === "string" && expandedRows?.has(toggleValue)))

        if (shouldExpandChildren) {
          flatten(node.children, result, index + startIndex)
        }
      })

      return result
    }

    const flattenedData = flatten(processedData, [], 0)

    flattenedData.forEach((item, index) => {
      const parentKey = getFieldValue(item, childField)
      if (!parentKey) {
        item.parentCount = 1
        return
      }

      let parentItem: TreeRow<T> | undefined
      for (let i = index - 1; i >= 0; i -= 1) {
        const candidate = flattenedData[i]
        if (!candidate) continue
        if (getFieldValue(candidate, toggleField) === parentKey) {
          parentItem = candidate
          break
        }
      }

      const parentAmount = parentItem ? Number(getFieldValue(parentItem, qtyField) ?? 1) : 1
      item.parentCount = parentAmount || 1
    })

    return flattenedData
  }, [
    enabled,
    processedData,
    startIndex,
    toggleField,
    childField,
    qtyField,
    preventExpand,
    expandedRows,
  ])

  const sortedData = useMemo(() => {
    if (!enabled) {
      return (data ?? []) as T[]
    }

    return [...flattenTree].sort((a, b) => {
      const aParts = String(a.treeNo ?? "")
        .split("-")
        .map(Number)
      const bParts = String(b.treeNo ?? "")
        .split("-")
        .map(Number)

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0
        const bVal = bParts[i] || 0
        if (aVal !== bVal) {
          return aVal - bVal
        }
      }

      return 0
    }) as T[]
  }, [enabled, data, flattenTree])

  return sortedData
}
