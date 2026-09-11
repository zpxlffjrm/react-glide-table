import type { CSSProperties } from "react"

import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants"

type ColumnSizeStyleOptions = {
  force?: boolean
  lockMax?: boolean
  /** CSS min-width for the cell. Ignored when `lockMax` is on. */
  minWidth?: number
  /** CSS max-width for the cell. Ignored when `lockMax` is on. */
  maxWidth?: number
}

/** Width styles for header/body cells when column sizing is active. */
export function getColumnSizeStyle(
  size: number,
  options?: ColumnSizeStyleOptions,
): CSSProperties | undefined {
  const { force = false, lockMax = false, minWidth, maxWidth } = options ?? {}

  if (lockMax) {
    return {
      width: size,
      minWidth: size,
      maxWidth: size,
    }
  }

  const hasExplicitSize = force || size !== DATA_TABLE_COLUMN_SIZE
  if (!hasExplicitSize && minWidth == null && maxWidth == null) {
    return undefined
  }

  const style: CSSProperties = {}

  if (hasExplicitSize) {
    style.width = size
    style.minWidth = minWidth ?? size
  } else if (minWidth != null) {
    style.minWidth = minWidth
  }

  if (maxWidth != null) {
    style.maxWidth = maxWidth
  }

  return style
}
