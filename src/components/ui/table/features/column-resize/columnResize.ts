import type { CSSProperties } from "react"

import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants"

/** Width styles for header/body cells when column sizing is active. */
export function getColumnSizeStyle(
  size: number,
  options?: { force?: boolean; lockMax?: boolean },
): CSSProperties | undefined {
  const { force = false, lockMax = false } = options ?? {}

  if (!force && size === DATA_TABLE_COLUMN_SIZE) {
    return undefined
  }

  return {
    width: size,
    minWidth: size,
    ...(lockMax ? { maxWidth: size } : {}),
  }
}
