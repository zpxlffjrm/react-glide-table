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

/** Which outer sides of a freeze island get a divider shadow. */
export type ColumnFreezeEdgeSide = "left" | "right" | "both"

export type ColumnFreezeOffset = {
  side: ColumnFreezeSide
  /** Cumulative sticky inset (`left` or `right` in px). */
  offset: number
  /** True when this cell is on an island boundary (any side). */
  isEdge: boolean
  /** Shadow toward the previous column (scrollable / other island). */
  edgeLeft: boolean
  /** Shadow toward the next column (scrollable / other island). */
  edgeRight: boolean
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

/** Serialize freeze-edge flags for `data-freeze-edge`. */
export function getColumnFreezeEdgeAttr(
  offset: Pick<ColumnFreezeOffset, "edgeLeft" | "edgeRight"> | undefined,
): ColumnFreezeEdgeSide | undefined {
  if (!offset) return undefined
  if (offset.edgeLeft && offset.edgeRight) return "both"
  if (offset.edgeLeft) return "left"
  if (offset.edgeRight) return "right"

  return undefined
}

/**
 * Build sticky insets for frozen columns without changing DOM/column order.
 *
 * - `left`: `left = Σ(widths of left-frozen columns before this one)`
 * - `right`: `right = Σ(widths of right-frozen columns after this one)`
 *
 * Contiguous same-side freezes form one island — only the outer boundaries
 * get edge shadows. Gaps between same-side freezes create separate islands,
 * so both sides of the gap receive a shadow.
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
      edgeLeft: false,
      edgeRight: false,
      stack: 0,
    })
    leftOffset += column.size
  }

  leftIds.forEach((id, index) => {
    const entry = result.get(id)
    if (!entry) return

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
      edgeLeft: false,
      edgeRight: false,
      stack: 0,
    })
    rightOffset += column.size
  }

  rightIds.forEach((id, index) => {
    const entry = result.get(id)
    if (!entry) return

    // Rightmost sticky cells sit above later right-sticky cells while scrolling.
    entry.stack = rightIds.length - index
  })

  // Island boundaries: same-side neighbors share an island; otherwise mark edges.
  columns.forEach((column, index) => {
    if (!column.side) return

    const entry = result.get(column.id)
    if (!entry) return

    const prevSide = index > 0 ? columns[index - 1]?.side : undefined
    const nextSide =
      index < columns.length - 1 ? columns[index + 1]?.side : undefined

    entry.edgeLeft = prevSide !== column.side
    entry.edgeRight = nextSide !== column.side
    // At the table start/end, no shadow toward the missing neighbor.
    if (index === 0) entry.edgeLeft = false
    if (index === columns.length - 1) entry.edgeRight = false
    entry.isEdge = entry.edgeLeft || entry.edgeRight
  })

  return result
}

/** Sticky position styles for a frozen header or body cell. */
export function getColumnFreezeStyle(
  offset: ColumnFreezeOffset | undefined,
  options?: { isHeader?: boolean; headerTop?: number },
): CSSProperties | undefined {
  if (!offset) return undefined

  const zBase = options?.isHeader ? HEADER_Z_BASE : BODY_Z_BASE

  return {
    position: "sticky",
    ...(offset.side === "left" ? { left: offset.offset } : { right: offset.offset }),
    zIndex: zBase + offset.stack,
    ...(options?.isHeader ? { top: options.headerTop ?? 0 } : {}),
  }
}
