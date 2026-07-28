import type { Row } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import {
  collectCopyRows,
  flattenSubtreeRows,
  serializeSelectionToTSV,
  writeSelectionToClipboard,
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

  it("includes descendants that lack id/uniqueId (toggleField-only rows)", () => {
    type ToggleOnlyRow = {
      materialCode: string
      name: string
      children?: ToggleOnlyRow[]
    }

    const parent: ToggleOnlyRow = {
      materialCode: "ASM-1000",
      name: "Parent",
      children: [
        { materialCode: "PRT-1", name: "Child 1" },
        { materialCode: "PRT-2", name: "Child 2" },
      ],
    }

    const visibleRows = [
      {
        id: "0",
        original: parent,
        getVisibleCells: () => [
          {
            column: { columnDef: { accessorKey: "name", id: "name" } },
            getValue: () => parent.name,
          },
        ],
      },
    ] as unknown as Row<ToggleOnlyRow>[]

    expect(
      collectCopyRows(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "subtree",
      ).map((row) => row.materialCode),
    ).toEqual(["ASM-1000", "PRT-1", "PRT-2"])
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
    ).toBe("Root\t1\n\tChild\t2")
  })

  it("encodes relative depth for multi-level subtree copy", () => {
    const visibleRows = createVisibleRows([
      {
        id: "root",
        name: "Root",
        qty: 1,
        children: [
          {
            id: "child",
            name: "Child",
            qty: 2,
            children: [{ id: "grand", name: "Grand", qty: 3 }],
          },
        ],
      },
    ])

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 1 },
        "subtree",
      ),
    ).toBe("Root\t1\n\tChild\t2\n\t\tGrand\t3")
  })

  it("resolves dot-path accessorKey values", () => {
    type NestedRow = { id: string; user: { name: string } }

    const data: NestedRow[] = [{ id: "1", user: { name: "Ada" } }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      original,
      getVisibleCells: () => [
        {
          column: { columnDef: { accessorKey: "user.name", id: "user.name" } },
          getValue: () => original.user.name,
        },
      ],
    })) as unknown as Row<NestedRow>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      }),
    ).toBe("Ada")
  })

  it("resolves accessorFn-only columns", () => {
    type RowData = { id: string; name: string; qty: number }

    const data: RowData[] = [{ id: "1", name: "X", qty: 2 }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      original,
      getVisibleCells: () => [
        {
          column: {
            columnDef: {
              id: "label",
              accessorFn: (row: RowData) => `${row.name}-${row.qty}`,
            },
          },
          getValue: () => `${original.name}-${original.qty}`,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      }),
    ).toBe("X-2")
  })
})
describe("writeSelectionToClipboard", () => {
  it("returns false when clipboard write fails", async () => {
    const visibleRows = createVisibleRows([{ id: "1", name: "A", qty: 1 }])
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    })

    await expect(
      writeSelectionToClipboard(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      }),
    ).resolves.toBe(false)
  })
})
