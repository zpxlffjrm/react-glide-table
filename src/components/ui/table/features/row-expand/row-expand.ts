import { useEffect, useMemo, useRef } from "react"

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
  /** false면 변환 없이 원본 반환 (일반 DataTable) */
  enabled?: boolean
  toggleField?: string
  childField?: string
  flattenField?: string
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
 * flat/중첩 데이터를 트리로 구성한 뒤, expandedRows 기준으로 보이는 행만 flat 반환.
 * enabled=false면 data를 그대로 반환한다.
 */
export const useConvertTreeData = <T extends Record<string, unknown>>({
  data,
  enabled = true,
  toggleField = "materialCode",
  childField = "assemblyCode",
  flattenField = "assemblyMaterials",
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

    const itemMap = new Map<string, TreeRow<T>[]>()
    dataWithLevels.forEach((item) => {
      const key = getFieldValue(item, toggleField)
      if (typeof key !== "string" || !key) return

      if (!itemMap.has(key)) {
        itemMap.set(key, [])
      }
      itemMap.get(key)?.push(item)
    })

    const rootItems: TreeRow<T>[] = []

    dataWithLevels.forEach((item) => {
      if (!getFieldValue(item, childField)) {
        rootItems.push(item)
        item.processed = true
      }
    })

    dataWithLevels.forEach((item) => {
      const parentKey = getFieldValue(item, childField)
      if (!parentKey || item.processed) return

      const parentItems = dataWithLevels.filter(
        (parent) =>
          getFieldValue(parent, toggleField) === parentKey && !getFieldValue(parent, childField),
      )

      if (parentItems.length > 0) {
        const parent = parentItems[0]
        item.level = parent.level + 1
        parent.children.push(item)
        item.processed = true
      } else {
        const otherParents = itemMap.get(String(parentKey)) || []
        if (otherParents.length > 0) {
          const parent = otherParents[0]
          item.level = parent.level + 1
          parent.children.push(item)
          item.processed = true
        } else {
          rootItems.push(item)
          item.processed = true
        }
      }
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

    flattenedData.forEach((item) => {
      if (getFieldValue(item, childField)) {
        const parentItem = flattenedData.find(
          (parent) => getFieldValue(parent, toggleField) === getFieldValue(item, childField),
        )
        const parentAmount = parentItem ? Number(getFieldValue(parentItem, "amount") ?? 1) : 1
        item.parentCount = parentAmount || 1
      } else {
        item.parentCount = 1
      }
    })

    return flattenedData
  }, [enabled, processedData, startIndex, toggleField, childField, preventExpand, expandedRows])

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
