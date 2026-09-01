import { describe, expect, it, vi } from "vitest"

import type { ColumnDef } from "@tanstack/react-table"

import {
  buildColumnRowSpanMap,
  collectRowSpanColumns,
  computeRowSpans,
} from "@/components/ui/table/features/row-span/rowSpan"

type LotRow = {
  id: string
  date: string
  dateId: string
  partNo: string
  partId: string
  rev: string
  revId: string
  lot: string
}

const nestedLots: LotRow[] = [
  {
    id: "1",
    date: "2026-07-01",
    dateId: "d1",
    partNo: "TR253023A",
    partId: "p-a",
    rev: "B",
    revId: "r-b",
    lot: "21",
  },
  {
    id: "2",
    date: "2026-07-01",
    dateId: "d1",
    partNo: "TR253023A",
    partId: "p-a",
    rev: "B",
    revId: "r-b",
    lot: "22",
  },
  {
    id: "3",
    date: "2026-07-01",
    dateId: "d1",
    partNo: "TR25X013",
    partId: "p-b",
    rev: "A",
    revId: "r-a",
    lot: "23",
  },
  {
    id: "4",
    date: "2026-07-01",
    dateId: "d1",
    partNo: "TR25X013",
    partId: "p-b",
    rev: "A",
    revId: "r-a",
    lot: "11",
  },
  {
    id: "5",
    date: "2026-07-01",
    dateId: "d1",
    partNo: "TR25X013",
    partId: "p-b",
    rev: "C",
    revId: "r-c",
    lot: "13",
  },
  {
    id: "6",
    date: "2026-07-02",
    dateId: "d2",
    partNo: "TR253023A",
    partId: "p-a",
    rev: "B",
    revId: "r-b",
    lot: "01",
  },
]

describe("computeRowSpans", () => {
  it("merges consecutive identical keys", () => {
    const spans = computeRowSpans(nestedLots, "dateId")

    expect(spans.map((info) => info.rowSpan)).toEqual([5, 0, 0, 0, 0, 1])
    expect(spans[0]).toEqual({ rowSpan: 5, isFirstInGroup: true })
    expect(spans[1]).toEqual({ rowSpan: 0, isFirstInGroup: false })
  })

  it("does not merge identical keys across a parent group boundary", () => {
    const dateSpans = computeRowSpans(nestedLots, "dateId")
    const partSpans = computeRowSpans(nestedLots, "partId", dateSpans)

    // Same partId on 2026-07-02 stays a new group even though it matches the first part.
    expect(partSpans.map((info) => info.rowSpan)).toEqual([2, 0, 3, 0, 0, 1])
  })

  it("returns an empty list for empty data", () => {
    expect(computeRowSpans([], "dateId")).toEqual([])
  })
})

describe("buildColumnRowSpanMap", () => {
  it("merges each column independently when rowSpanParent is omitted", () => {
    const rows = [
      { id: "1", dateId: "d1", partId: "same" },
      { id: "2", dateId: "d1", partId: "same" },
      { id: "3", dateId: "d2", partId: "same" },
    ]

    const map = buildColumnRowSpanMap(rows, [
      { columnId: "date", rowSpanKey: "dateId", rowSpanParent: [] },
      { columnId: "part", rowSpanKey: "partId", rowSpanParent: [] },
    ])

    expect(map.get("date")?.map((info) => info.rowSpan)).toEqual([2, 0, 1])
    expect(map.get("part")?.map((info) => info.rowSpan)).toEqual([3, 0, 0])
  })

  it("nests a column inside the parent named by rowSpanParent", () => {
    const map = buildColumnRowSpanMap(nestedLots, [
      { columnId: "date", rowSpanKey: "dateId", rowSpanParent: [] },
      {
        columnId: "partNo",
        rowSpanKey: "partId",
        rowSpanParent: ["date"],
      },
      {
        columnId: "rev",
        rowSpanKey: "revId",
        rowSpanParent: ["partNo"],
      },
    ])

    expect(map.get("date")?.map((info) => info.rowSpan)).toEqual([
      5, 0, 0, 0, 0, 1,
    ])
    expect(map.get("partNo")?.map((info) => info.rowSpan)).toEqual([
      2, 0, 3, 0, 0, 1,
    ])
    expect(map.get("rev")?.map((info) => info.rowSpan)).toEqual([
      2, 0, 2, 0, 1, 1,
    ])
  })

  it("resolves rowSpanParent by the parent's rowSpanKey", () => {
    const rows = [
      { id: "1", dateId: "d1", partId: "same" },
      { id: "2", dateId: "d1", partId: "same" },
      { id: "3", dateId: "d2", partId: "same" },
    ]

    const map = buildColumnRowSpanMap(rows, [
      { columnId: "date", rowSpanKey: "dateId", rowSpanParent: [] },
      {
        columnId: "part",
        rowSpanKey: "partId",
        rowSpanParent: ["dateId"],
      },
    ])

    expect(map.get("part")?.map((info) => info.rowSpan)).toEqual([2, 0, 1])
  })

  it("nests inside a row field that is not itself a rowSpan column", () => {
    const rows = [
      { id: "1", dateId: "d1", partId: "same" },
      { id: "2", dateId: "d1", partId: "same" },
      { id: "3", dateId: "d2", partId: "same" },
    ]

    const map = buildColumnRowSpanMap(rows, [
      {
        columnId: "part",
        rowSpanKey: "partId",
        rowSpanParent: ["dateId"],
      },
    ])

    expect(map.get("part")?.map((info) => info.rowSpan)).toEqual([2, 0, 1])
  })

  it("treats multiple rowSpanParent fields as combined boundaries", () => {
    const rows = [
      { id: "1", dateId: "d1", partId: "p1", revId: "r" },
      { id: "2", dateId: "d1", partId: "p1", revId: "r" },
      { id: "3", dateId: "d1", partId: "p2", revId: "r" },
    ]

    const map = buildColumnRowSpanMap(rows, [
      {
        columnId: "rev",
        rowSpanKey: "revId",
        rowSpanParent: ["dateId", "partId"],
      },
    ])

    expect(map.get("rev")?.map((info) => info.rowSpan)).toEqual([2, 0, 1])
  })

  it("breaks a parent cycle by computing the nested column without that parent", () => {
    const rows = [
      { id: "1", a: "x", b: "y" },
      { id: "2", a: "x", b: "y" },
    ]

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const map = buildColumnRowSpanMap(rows, [
      { columnId: "a", rowSpanKey: "a", rowSpanParent: ["b"] },
      { columnId: "b", rowSpanKey: "b", rowSpanParent: ["a"] },
    ])

    expect(map.get("a")?.map((info) => info.rowSpan)).toEqual([2, 0])
    expect(map.get("b")?.map((info) => info.rowSpan)).toEqual([2, 0])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cycle detected"))

    warn.mockRestore()
  })

  it("accepts a legacy spec with no rowSpanParent (backwards compatible)", () => {
    const rows = [
      { id: "1", dateId: "d1", partId: "same" },
      { id: "2", dateId: "d1", partId: "same" },
      { id: "3", dateId: "d2", partId: "same" },
    ]

    // Callers of the exported headless API used `{ columnId, rowSpanKey }`
    // before `rowSpanParent` existed. That shape must still merge independently.
    const map = buildColumnRowSpanMap(rows, [
      { columnId: "date", rowSpanKey: "dateId" },
      { columnId: "part", rowSpanKey: "partId" },
    ])

    expect(map.get("date")?.map((info) => info.rowSpan)).toEqual([2, 0, 1])
    expect(map.get("part")?.map((info) => info.rowSpan)).toEqual([3, 0, 0])
  })
})

describe("collectRowSpanColumns", () => {
  it("walks leaf columns in declaration order including grouped columns", () => {
    const columns: ColumnDef<LotRow, unknown>[] = [
      {
        id: "date",
        accessorKey: "date",
        meta: { rowSpan: true, rowSpanKey: "dateId" },
      },
      {
        id: "identity",
        columns: [
          {
            id: "partNo",
            accessorKey: "partNo",
            meta: {
              rowSpan: true,
              rowSpanKey: "partId",
              rowSpanParent: "date",
            },
          },
          { id: "lot", accessorKey: "lot" },
        ],
      },
    ]

    expect(collectRowSpanColumns(columns)).toEqual([
      { columnId: "date", rowSpanKey: "dateId", rowSpanParent: [] },
      {
        columnId: "partNo",
        rowSpanKey: "partId",
        rowSpanParent: ["date"],
      },
    ])
  })
})
