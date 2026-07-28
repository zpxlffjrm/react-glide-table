import type { Row } from "@tanstack/react-table"
import { describe, expect, it } from "vitest"

import {
  buildRowsPastePayload,
  isEditablePasteTarget,
  parseClipboardTSV,
  parseClipboardTSVWithDepths,
  resolvePasteColumnIds,
} from "@/components/ui/table/features/cell-selection/pasteData"

type TestRow = {
  id: string
  name: string
  qty: number
}

function createVisibleRows(data: TestRow[]): Row<TestRow>[] {
  return data.map((original) => ({
    id: original.id,
    original,
    getVisibleCells: () => [
      {
        column: { id: "select", columnDef: { id: "select" } },
      },
      {
        column: {
          id: "name",
          columnDef: { accessorKey: "name", id: "name" },
        },
      },
      {
        column: {
          id: "qty",
          columnDef: { accessorKey: "qty", id: "qty" },
        },
      },
    ],
  })) as unknown as Row<TestRow>[]
}

describe("parseClipboardTSV", () => {
  it("parses tab-separated rows", () => {
    expect(parseClipboardTSV("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("ignores trailing newlines and normalizes CR/LF", () => {
    expect(parseClipboardTSV("a\tb\r\n1\t2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("returns empty for blank text", () => {
    expect(parseClipboardTSV("")).toEqual([])
    expect(parseClipboardTSV("\n\n")).toEqual([])
  })

  it("keeps uneven row widths", () => {
    expect(parseClipboardTSV("a\tb\nc")).toEqual([["a", "b"], ["c"]])
  })

  it("strips leading tabs used as tree depth markers", () => {
    expect(parseClipboardTSV("Root\t1\n\tChild\t2")).toEqual([
      ["Root", "1"],
      ["Child", "2"],
    ])
  })

  it("preserves leading empty cells from Excel blank first columns", () => {
    expect(parseClipboardTSV("\tB\tC\n\tE\tF")).toEqual([
      ["", "B", "C"],
      ["", "E", "F"],
    ])
  })
})

describe("parseClipboardTSVWithDepths", () => {
  it("recovers relative depth from leading tabs", () => {
    expect(parseClipboardTSVWithDepths("Root\t1\n\tChild\t2\n\t\tGrand\t3")).toEqual({
      values: [
        ["Root", "1"],
        ["Child", "2"],
        ["Grand", "3"],
      ],
      depths: [0, 1, 2],
    })
  })

  it("does not treat Excel blank first columns as tree depth", () => {
    expect(parseClipboardTSVWithDepths("\tB\tC\n\tE\tF")).toEqual({
      values: [
        ["", "B", "C"],
        ["", "E", "F"],
      ],
      depths: [0, 0],
    })
  })

  it("keeps a single blank-leading row as raw cells", () => {
    expect(parseClipboardTSVWithDepths("\tOnly")).toEqual({
      values: [["", "Only"]],
      depths: [0],
    })
  })
})

describe("resolvePasteColumnIds", () => {
  it("returns visible column ids from startCol for width", () => {
    const rows = createVisibleRows([{ id: "1", name: "Item", qty: 3 }])

    expect(resolvePasteColumnIds(rows, 1, 2)).toEqual(["name", "qty"])
    expect(resolvePasteColumnIds(rows, 0, 1)).toEqual(["select"])
  })

  it("stops when columns run out", () => {
    const rows = createVisibleRows([{ id: "1", name: "Item", qty: 3 }])

    expect(resolvePasteColumnIds(rows, 2, 5)).toEqual(["qty"])
  })

  it("returns empty when width is zero or rows are empty", () => {
    expect(resolvePasteColumnIds([], 0, 2)).toEqual([])
    expect(resolvePasteColumnIds(createVisibleRows([{ id: "1", name: "A", qty: 1 }]), 0, 0)).toEqual(
      [],
    )
  })
})

describe("buildRowsPastePayload", () => {
  it("builds payload from clipboard text and selection anchor", () => {
    const rows = createVisibleRows([
      { id: "1", name: "Item", qty: 3 },
      { id: "2", name: "Item 2", qty: 4 },
      { id: "3", name: "Item 3", qty: 5 },
    ])
    const payload = buildRowsPastePayload(rows, 1, 1, "Alpha\t10\nBeta\t20", "insert", 1)

    expect(payload).toEqual({
      mode: "insert",
      startRow: 1,
      startCol: 1,
      endRow: 1,
      rowIds: ["2", "3"],
      anchorRowId: "2",
      columnIds: ["name", "qty"],
      values: [
        ["Alpha", "10"],
        ["Beta", "20"],
      ],
      depths: [0, 0],
    })
  })

  it("includes tree depths from leading tabs", () => {
    const rows = createVisibleRows([
      { id: "1", name: "Item", qty: 3 },
      { id: "2", name: "Item 2", qty: 4 },
    ])
    const payload = buildRowsPastePayload(
      rows,
      1,
      1,
      "Parent\t1\n\tChild\t2",
      "insert",
      1,
    )

    expect(payload?.values).toEqual([
      ["Parent", "1"],
      ["Child", "2"],
    ])
    expect(payload?.depths).toEqual([0, 1])
  })

  it("preserves endRow from the selection bounds", () => {
    const rows = createVisibleRows([
      { id: "1", name: "Item", qty: 3 },
      { id: "2", name: "Item 2", qty: 4 },
      { id: "3", name: "Item 3", qty: 5 },
      { id: "4", name: "Item 4", qty: 6 },
      { id: "5", name: "Item 5", qty: 7 },
    ])
    const payload = buildRowsPastePayload(rows, 1, 0, "a", "insert", 4)

    expect(payload?.endRow).toBe(4)
    expect(payload?.anchorRowId).toBe("5")
  })

  it("returns null when text is empty", () => {
    const rows = createVisibleRows([{ id: "1", name: "Item", qty: 3 }])

    expect(buildRowsPastePayload(rows, 0, 0, "", "overwrite")).toBeNull()
  })
})

describe("isEditablePasteTarget", () => {
  it("detects input and textarea targets", () => {
    const input = document.createElement("input")
    const textarea = document.createElement("textarea")
    const div = document.createElement("div")

    expect(isEditablePasteTarget(input)).toBe(true)
    expect(isEditablePasteTarget(textarea)).toBe(true)
    expect(isEditablePasteTarget(div)).toBe(false)
  })
})
