import type { Row } from "@tanstack/react-table"
import { describe, expect, it } from "vitest"

import {
  collectCopyRows,
  flattenSubtreeRows,
  serializeSelectionToTSV,
} from "@/components/ui/table/features/cell-selection/copyData"

type TestRow = {
  id: string
  name: string
  qty: number
  children?: TestRow[]
  uniqueId?: string
}

function createVisibleRows(data: TestRow[], useIndexId = false): Row<TestRow>[] {
  return data.map((original, index) => ({
    id: useIndexId ? String(index) : original.id,
    original,
    getVisibleCells: () => [
      {
        column: {
          columnDef: { accessorKey: "name", id: "name" },
        },
        getValue: () => original.name,
      },
      {
        column: {
          columnDef: { accessorKey: "qty", id: "qty" },
        },
        getValue: () => original.qty,
      },
    ],
  })) as unknown as Row<TestRow>[]
}

describe("flattenSubtreeRows", () => {
  it("returns all descendants in depth-first order", () => {
    const parent: TestRow = {
      id: "root",
      name: "Root",
      qty: 1,
      children: [
        {
          id: "child-1",
          name: "Child 1",
          qty: 2,
          children: [{ id: "grandchild", name: "Grandchild", qty: 3 }],
        },
        { id: "child-2", name: "Child 2", qty: 4 },
      ],
    }

    expect(flattenSubtreeRows(parent).map((row) => row.id)).toEqual([
      "child-1",
      "grandchild",
      "child-2",
    ])
  })
})

describe("collectCopyRows", () => {
  const treeRows: TestRow[] = [
    {
      id: "root",
      name: "Root",
      qty: 1,
      children: [
        { id: "child-1", name: "Child 1", qty: 2 },
        { id: "child-2", name: "Child 2", qty: 3 },
      ],
    },
  ]

  it("copies only visible rows by default", () => {
    const visibleRows = createVisibleRows(treeRows)
    const bounds = { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }

    expect(collectCopyRows(visibleRows, bounds, "visible")).toEqual([treeRows[0]])
  })

  it("includes collapsed descendants when mode is subtree", () => {
    const visibleRows = createVisibleRows(treeRows)
    const bounds = { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }

    expect(collectCopyRows(visibleRows, bounds, "subtree").map((row) => row.id)).toEqual([
      "root",
      "child-1",
      "child-2",
    ])
  })

  it("does not duplicate descendants that are already in the visible selection (data-id)", () => {
    const expandedRows: TestRow[] = [
      treeRows[0]!,
      { id: "child-1", name: "Child 1", qty: 2 },
    ]
    const visibleRows = createVisibleRows(expandedRows)
    const bounds = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }

    expect(collectCopyRows(visibleRows, bounds, "subtree").map((row) => row.id)).toEqual([
      "root",
      "child-1",
      "child-2",
    ])
  })

  it("does not duplicate descendants when row.id is index-based (default getRowId)", () => {
    const expandedRows: TestRow[] = [
      treeRows[0]!,
      { id: "child-1", name: "Child 1", qty: 2 },
    ]
    // useIndexId=true: row.id = "0", "1" (matches default useGlideTable getRowId)
    const visibleRows = createVisibleRows(expandedRows, true)
    const bounds = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }

    expect(collectCopyRows(visibleRows, bounds, "subtree").map((row) => row.id)).toEqual([
      "root",
      "child-1",
      "child-2",
    ])
  })
})

describe("serializeSelectionToTSV", () => {
  it("serializes visible selection only", () => {
    const visibleRows = createVisibleRows([
      { id: "1", name: "A", qty: 10 },
      { id: "2", name: "B", qty: 20 },
    ])

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 1,
      }),
    ).toBe("A\t10\nB\t20")
  })

  it("serializes subtree rows including collapsed children", () => {
    const visibleRows = createVisibleRows([
      {
        id: "root",
        name: "Root",
        qty: 1,
        children: [{ id: "child", name: "Child", qty: 2 }],
      },
    ])

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 1 },
        "subtree",
      ),
    ).toBe("Root\t1\nChild\t2")
  })
})
