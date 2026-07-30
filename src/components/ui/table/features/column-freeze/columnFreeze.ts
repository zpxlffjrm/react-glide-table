import type { CSSProperties } from "react"

/** Sticky edge for a frozen column. Does not reorder columns. */
export type ColumnFreezeSide = "left" | "right"

/**
 * Per-column freeze flag.
 * `true` is sugar for `"left"`.
 */
export type ColumnFreezeMeta = boolean | ColumnFreezeSide

export type ColumnFreezeColumnInput = {
  id: string
  size: number
  side?: ColumnFreezeSide
}

export type ColumnFreezeOffset = {
  side: ColumnFreezeSide
  /** Cumulative sticky inset (`left` or `right` in px). */
  offset: number
  /** Inner edge of the sticky group (shadow / divider). */
  isEdge: boolean
  /** Relative stack order within the freeze side (higher = closer to the viewport edge). */
  stack: number
}

const HEADER_Z_BASE = 30
const BODY_Z_BASE = 5

/** Normalize column `frozen` meta into a sticky side. */
export function resolveColumnFreezeSide(
  frozen?: ColumnFreezeMeta,
): ColumnFreezeSide | undefined {
  if (frozen === true || frozen === "left") return "left"
  if (frozen === "right") return "right"

  return undefined
}

/**
 * Build sticky insets for frozen columns without changing DOM/column order.
 *
 * - `left`: `left = Σ(widths of left-frozen columns before this one)`
 * - `right`: `right = Σ(widths of right-frozen columns after this one)`
 *
 * Middle columns may be frozen; non-frozen neighbors scroll underneath.
 */
export function buildColumnFreezeOffsets(
  columns: ColumnFreezeColumnInput[],
): Map<string, ColumnFreezeOffset> {
  const result = new Map<string, ColumnFreezeOffset>()

  let leftOffset = 0
  const leftIds: string[] = []

  for (const column of columns) {
    if (column.side !== "left") continue

    leftIds.push(column.id)
    result.set(column.id, {
      side: "left",
      offset: leftOffset,
      isEdge: false,
      stack: 0,
    })
    leftOffset += column.size
  }

  leftIds.forEach((id, index) => {
    const entry = result.get(id)
    if (!entry) return

    entry.isEdge = index === leftIds.length - 1
    // Leftmost sticky cells sit above later left-sticky cells while scrolling.
    entry.stack = leftIds.length - index
  })

  let rightOffset = 0
  const rightIds: string[] = []

  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index]
    if (!column || column.side !== "right") continue

    rightIds.push(column.id)
    result.set(column.id, {
      side: "right",
      offset: rightOffset,
      isEdge: false,
      stack: 0,
    })
    rightOffset += column.size
  }

  rightIds.forEach((id, index) => {
    const entry = result.get(id)
    if (!entry) return

    // Innermost (leftmost among right-frozen) gets the edge shadow.
    entry.isEdge = index === rightIds.length - 1
    // Rightmost sticky cells sit above later right-sticky cells while scrolling.
    entry.stack = rightIds.length - index
  })

  return result
}

/** Sticky position styles for a frozen header or body cell. */
export function getColumnFreezeStyle(
  offset: ColumnFreezeOffset | undefined,
  options?: { isHeader?: boolean },
): CSSProperties | undefined {
  if (!offset) return undefined

  const zBase = options?.isHeader ? HEADER_Z_BASE : BODY_Z_BASE

  return {
    position: "sticky",
    ...(offset.side === "left" ? { left: offset.offset } : { right: offset.offset }),
    zIndex: zBase + offset.stack,
    ...(options?.isHeader ? { top: 0 } : {}),
  }
}
