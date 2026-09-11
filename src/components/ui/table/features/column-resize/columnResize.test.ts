import { describe, expect, it } from "vitest"

import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants"
import { getColumnSizeStyle } from "@/components/ui/table/features/column-resize/columnResize"

describe("getColumnSizeStyle", () => {
  it("skips the default size when resize is not forcing styles", () => {
    expect(getColumnSizeStyle(DATA_TABLE_COLUMN_SIZE)).toBeUndefined()
  })

  it("locks width to the current size while resizing", () => {
    expect(getColumnSizeStyle(240, { force: true, lockMax: true })).toEqual({
      width: 240,
      minWidth: 240,
      maxWidth: 240,
    })
  })

  it("ignores cell min/max while resize lock is on", () => {
    expect(
      getColumnSizeStyle(240, {
        force: true,
        lockMax: true,
        minWidth: 80,
        maxWidth: 120,
      }),
    ).toEqual({
      width: 240,
      minWidth: 240,
      maxWidth: 240,
    })
  })

  it("applies cell min/max without a definite column size", () => {
    expect(
      getColumnSizeStyle(DATA_TABLE_COLUMN_SIZE, {
        minWidth: 80,
        maxWidth: 240,
      }),
    ).toEqual({
      minWidth: 80,
      maxWidth: 240,
    })
  })

  it("keeps an explicit width and overlays cell min/max", () => {
    expect(
      getColumnSizeStyle(200, { minWidth: 80, maxWidth: 300 }),
    ).toEqual({
      width: 200,
      minWidth: 80,
      maxWidth: 300,
    })
  })

  it("locks minWidth to size when only width is set", () => {
    expect(getColumnSizeStyle(200)).toEqual({
      width: 200,
      minWidth: 200,
    })
  })
})
