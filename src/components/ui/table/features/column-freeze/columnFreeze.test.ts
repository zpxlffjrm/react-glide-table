import { describe, expect, it } from "vitest"

import {
  buildColumnFreezeOffsets,
  getColumnFreezeEdgeAttr,
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

    // Discontinuous left freezes → separate islands; both get boundary shadows.
    expect(offsets.get("a")).toMatchObject({
      side: "left",
      offset: 0,
      edgeLeft: false,
      edgeRight: true,
      isEdge: true,
    })
    expect(offsets.get("c")).toMatchObject({
      side: "left",
      offset: 100,
      edgeLeft: true,
      edgeRight: true,
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
      edgeLeft: true,
      edgeRight: false,
      isEdge: true,
    })
    expect(offsets.get("b")).toMatchObject({
      side: "right",
      offset: 90,
      edgeLeft: true,
      edgeRight: true,
      isEdge: true,
    })
  })

  it("allows a middle column to freeze alone with both edges", () => {
    const offsets = buildColumnFreezeOffsets([
      { id: "a", size: 100 },
      { id: "b", size: 80, side: "left" },
      { id: "c", size: 60 },
    ])

    expect(offsets.get("b")).toMatchObject({
      side: "left",
      offset: 0,
      edgeLeft: true,
      edgeRight: true,
      isEdge: true,
    })
  })

  it("marks only outer edges for contiguous same-side freezes", () => {
    const offsets = buildColumnFreezeOffsets([
      { id: "a", size: 100, side: "left" },
      { id: "b", size: 80, side: "left" },
      { id: "c", size: 60 },
      { id: "d", size: 90, side: "right" },
      { id: "e", size: 70, side: "right" },
    ])

    expect(offsets.get("a")).toMatchObject({
      edgeLeft: false,
      edgeRight: false,
      isEdge: false,
    })
    expect(offsets.get("b")).toMatchObject({
      edgeLeft: false,
      edgeRight: true,
      isEdge: true,
    })
    expect(offsets.get("d")).toMatchObject({
      edgeLeft: true,
      edgeRight: false,
      isEdge: true,
    })
    expect(offsets.get("e")).toMatchObject({
      edgeLeft: false,
      edgeRight: false,
      isEdge: false,
    })
  })
})

describe("getColumnFreezeEdgeAttr", () => {
  it("serializes edge flags for data-freeze-edge", () => {
    expect(
      getColumnFreezeEdgeAttr({ edgeLeft: true, edgeRight: false }),
    ).toBe("left")
    expect(
      getColumnFreezeEdgeAttr({ edgeLeft: false, edgeRight: true }),
    ).toBe("right")
    expect(
      getColumnFreezeEdgeAttr({ edgeLeft: true, edgeRight: true }),
    ).toBe("both")
    expect(
      getColumnFreezeEdgeAttr({ edgeLeft: false, edgeRight: false }),
    ).toBeUndefined()
  })
})

describe("getColumnFreezeStyle", () => {
  it("returns sticky left/right styles with z-index", () => {
    expect(
      getColumnFreezeStyle({
        side: "left",
        offset: 40,
        isEdge: true,
        edgeLeft: false,
        edgeRight: true,
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
          edgeLeft: true,
          edgeRight: false,
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

    expect(
      getColumnFreezeStyle(
        {
          side: "left",
          offset: 0,
          isEdge: true,
          edgeLeft: false,
          edgeRight: true,
          stack: 0,
        },
        { isHeader: true, headerTop: 40 },
      ),
    ).toEqual({
      position: "sticky",
      left: 0,
      zIndex: 30,
      top: 40,
    })
  })
})
