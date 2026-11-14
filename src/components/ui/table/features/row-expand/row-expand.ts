import { useEffect, useMemo, useRef } from "react"

import {
  TREE_SOURCE,
  type TreeSource,
} from "@/components/ui/table/features/data-patch/dataPatch"
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
  /**
   * Expand every parent once when data first arrives. Defaults to true.
   * Pass false when the consumer controls `expandedRows`, so its initial
   * value is respected.
   */
  autoExpandOnLoad?: boolean
}

function getFieldValue(row: Record<string, unknown>, key: string): unknown {
  return row[key]
}

/** Any row with children can expand, at every depth. */
export function canExpandRow(row: Record<string, unknown>): boolean {
  const children = row.children

  return Array.isArray(children) && children.length > 0
}

/**
 * Expand keys are always strings: the toggle button builds them with
 * `String(value)`, so numeric ids must be compared the same way.
 */
export function toTreeToggleKey(value: unknown): string | null {
  if (value === null || value === undefined) return null

  const key = String(value)
  return key.length > 0 ? key : null
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
  autoExpandOnLoad = true,
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

    hasInitializedRef.current = true
    if (!autoExpandOnLoad) return

    // Every parent at every depth (nested children included), keyed as strings.
    const ids = new Set<string>()
    const collect = (items: unknown[]) => {
      for (const item of items) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, unknown>
        const key = toTreeToggleKey(getFieldValue(record, toggleField))
        if (key) ids.add(key)
        const nested = record[flattenField]
        if (Array.isArray(nested)) collect(nested)
      }
    }
    collect(data)

    onExpandedRowsChangeRef.current?.(ids)
  }, [enabled, data, toggleField, flattenField, autoExpandOnLoad])

  const processedData = useMemo(() => {
    if (!enabled || !data || data.length === 0) return [] as TreeRow<T>[]

    const flattenedData: Record<string, unknown>[] = []

    // Each row remembers where it lives in the original data (TREE_SOURCE),
    // so writes can patch the consumer's nested/flat array in place.
    const flattenItems = (items: Record<string, unknown>[], parentPath: number[]) => {
      items.forEach((item, itemIndex) => {
        if (!item || typeof item !== "object") return

        const source: TreeSource = {
          path: [...parentPath, itemIndex],
          childrenField: flattenField,
        }
        const newItem: Record<string | symbol, unknown> = { ...item, [TREE_SOURCE]: source }
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

          flattenItems(children as Record<string, unknown>[], source.path as number[])
        } else {
          flattenedData.push(newItem)
        }
      })
    }

    flattenItems(data as Record<string, unknown>[], [])

    const dataWithLevels = flattenedData.map((item) => ({
      ...item,
      level: 0,
      children: [] as TreeRow<T>[],
      processed: false,
    })) as TreeRow<T>[]

    // Nearest *preceding* row whose toggleField matches (handles duplicate
    // codes after paste). One forward pass with a key → latest row map keeps
    // this O(n) instead of a backward scan per row.
    const rootItems: TreeRow<T>[] = []
    const latestByKey = new Map<unknown, TreeRow<T>>()

    dataWithLevels.forEach((item) => {
      const parentKey = getFieldValue(item, childField)
      const parent = parentKey ? latestByKey.get(parentKey) : undefined

      if (parent) {
        item.level = parent.level + 1
        parent.children.push(item)
      } else {
        rootItems.push(item)
      }
      item.processed = true

      latestByKey.set(getFieldValue(item, toggleField), item)
    })

    return rootItems
  }, [enabled, data, toggleField, childField, flattenField])

  const flattenTree = useMemo(() => {
    if (!enabled) return [] as TreeRow<T>[]

    // Rows come out in depth-first order, which already is display order.
    // treeNo carries the full path ("2-1-3") so it stays unique at any depth.
    const flatten = (
      nodes: TreeRow<T>[],
      result: TreeRow<T>[],
      parentTreeNo: string | null,
    ): TreeRow<T>[] => {
      nodes.forEach((node, index) => {
        const currentIndex =
          parentTreeNo === null ? `${index + startIndex}` : `${parentTreeNo}-${index + 1}`
        const toggleValue = getFieldValue(node, toggleField)
        const uniqueId = `${currentIndex}-${String(toggleValue ?? "")}`

        result.push({
          ...node,
          treeNo: currentIndex,
          uniqueId,
          processed: true,
        })

        const toggleKey = toTreeToggleKey(toggleValue)
        const shouldExpandChildren =
          node.children.length > 0 &&
          (preventExpand || (toggleKey !== null && Boolean(expandedRows?.has(toggleKey))))

        if (shouldExpandChildren) {
          flatten(node.children, result, currentIndex)
        }
      })

      return result
    }

    const flattenedData = flatten(processedData, [], null)

    const latestByKey = new Map<unknown, TreeRow<T>>()
    flattenedData.forEach((item) => {
      const parentKey = getFieldValue(item, childField)
      if (!parentKey) {
        item.parentCount = 1
      } else {
        const parentItem = latestByKey.get(parentKey)
        const parentAmount = parentItem ? Number(getFieldValue(parentItem, qtyField) ?? 1) : 1
        item.parentCount = parentAmount || 1
      }

      latestByKey.set(getFieldValue(item, toggleField), item)
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

    return flattenTree as unknown as T[]
  }, [enabled, data, flattenTree])

  return sortedData
}
