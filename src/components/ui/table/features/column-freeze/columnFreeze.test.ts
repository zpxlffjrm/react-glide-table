import { describe, expect, it } from "vitest"

import {
  buildColumnFreezeOffsets,
  getColumnFreezeStyle,
  resolveColumnFreezeSide,
} from "@/components/ui/table/features/column-freeze/columnFreeze"

describe("resolveColumnFreezeSide", () => {
  it("maps true to left and passes through sides", () => {
    expect(resolveColumnFreezeSide(true)).toBe("left")
    expect(resolveColumnFreezeSide("left")).toBe("left")
    expect(resolveColumnFreezeSide("right")).toBe("right")
    expect(resolveColumnFreezeSide(false)).toBeUndefined()
    expect(resolveColumnFreezeSide(undefined)).toBeUndefined()
  })
})

describe("buildColumnFreezeOffsets", () => {
  it("keeps column order and stacks left offsets without overlap", () => {
    const offsets = buildColumnFreezeOffsets([
      { id: "a", size: 100, side: "left" },
      { id: "b", size: 80 },
      { id: "c", size: 120, side: "left" },
      { id: "d", size: 90 },
    ])

    expect(offsets.get("a")).toMatchObject({
      side: "left",
      offset: 0,
      isEdge: false,
    })
    expect(offsets.get("c")).toMatchObject({
      side: "left",
      offset: 100,
      isEdge: true,
    })
    expect(offsets.has("b")).toBe(false)
    expect(offsets.has("d")).toBe(false)
  })

  it("stacks right offsets from the trailing edge", () => {
    const offsets = buildColumnFreezeOffsets([
      { id: "a", size: 100 },
      { id: "b", size: 80, side: "right" },
      { id: "c", size: 60 },
      { id: "d", size: 90, side: "right" },
    ])

    expect(offsets.get("d")).toMatchObject({
      side: "right",
      offset: 0,
      isEdge: false,
    })
    expect(offsets.get("b")).toMatchObject({
      side: "right",
      offset: 90,
      isEdge: true,
    })
  })

  it("allows a middle column to freeze alone", () => {
    const offsets = buildColumnFreezeOffsets([
      { id: "a", size: 100 },
      { id: "b", size: 80, side: "left" },
      { id: "c", size: 60 },
    ])

    expect(offsets.get("b")).toMatchObject({
      side: "left",
      offset: 0,
      isEdge: true,
    })
  })
})

describe("getColumnFreezeStyle", () => {
  it("returns sticky left/right styles with z-index", () => {
    expect(
      getColumnFreezeStyle({
        side: "left",
        offset: 40,
        isEdge: true,
        stack: 2,
      }),
    ).toEqual({
      position: "sticky",
      left: 40,
      zIndex: 7,
    })

    expect(
      getColumnFreezeStyle(
        {
          side: "right",
          offset: 20,
          isEdge: true,
          stack: 1,
        },
        { isHeader: true },
      ),
    ).toEqual({
      position: "sticky",
      right: 20,
      zIndex: 31,
      top: 0,
    })
  })
})
