import { describe, expect, it } from "vitest"
import type { ColumnDef } from "@tanstack/react-table"

import {
  applyLeafColumnOrder,
  collectLeafColumnIds,
  moveColumnIds,
  resolveDropEdge,
  resolveLeafColumnOrder,
} from "@/components/ui/table/features/column-reorder/columnReorder"

type Row = { name: string; amount: number; note: string }

function childColumnIds(column: ColumnDef<Row, unknown> | undefined) {
  if (!column || !("columns" in column) || !Array.isArray(column.columns)) {
    return undefined
  }

  return (column.columns as ColumnDef<Row, unknown>[]).map((child) => child.id)
}

const nameCol: ColumnDef<Row, unknown> = { id: "name", accessorKey: "name" }
const amountCol: ColumnDef<Row, unknown> = {
  id: "amount",
  accessorKey: "amount",
}
const noteCol: ColumnDef<Row, unknown> = { id: "note", accessorKey: "note" }

const groupedColumns: ColumnDef<Row, unknown>[] = [
  {
    id: "group:Identity",
    header: "Identity",
    columns: [nameCol, amountCol],
  },
  noteCol,
]

describe("collectLeafColumnIds", () => {
  it("walks nested groups in declaration order", () => {
    expect(collectLeafColumnIds(groupedColumns)).toEqual([
      "name",
      "amount",
      "note",
    ])
  })
})

describe("resolveLeafColumnOrder", () => {
  it("returns declaration order when the stored order is empty", () => {
    expect(resolveLeafColumnOrder(groupedColumns, [])).toEqual([
      "name",
      "amount",
      "note",
    ])
  })

  it("keeps known ids and appends new leaves", () => {
    expect(
      resolveLeafColumnOrder(groupedColumns, ["note", "missing", "name"]),
    ).toEqual(["note", "name", "amount"])
  })

  it("deduplicates repeated ids in controlled order", () => {
    expect(
      resolveLeafColumnOrder(groupedColumns, ["note", "name", "name", "amount"]),
    ).toEqual(["note", "name", "amount"])
  })
})

describe("moveColumnIds", () => {
  it("moves a leaf after another leaf", () => {
    expect(
      moveColumnIds(["name", "amount", "note"], ["name"], ["note"], "after"),
    ).toEqual(["amount", "note", "name"])
  })

  it("moves a leaf before a target", () => {
    expect(
      moveColumnIds(["name", "amount", "note"], ["note"], ["name"], "before"),
    ).toEqual(["note", "name", "amount"])
  })

  it("moves a group block as a unit", () => {
    expect(
      moveColumnIds(
        ["name", "amount", "note"],
        ["name", "amount"],
        ["note"],
        "after",
      ),
    ).toEqual(["note", "name", "amount"])
  })

  it("no-ops when dropping onto a header in the dragged set", () => {
    expect(
      moveColumnIds(
        ["name", "amount", "note"],
        ["name", "amount"],
        ["amount"],
        "after",
      ),
    ).toEqual(["name", "amount", "note"])
  })
})

describe("resolveDropEdge", () => {
  it("uses the midpoint of the header rect", () => {
    const rect = { left: 100, width: 80 }
    expect(resolveDropEdge(130, rect)).toBe("before")
    expect(resolveDropEdge(150, rect)).toBe("after")
  })
})

describe("applyLeafColumnOrder", () => {
  it("returns the original tree when order matches declaration", () => {
    expect(applyLeafColumnOrder(groupedColumns, ["name", "amount", "note"])).toBe(
      groupedColumns,
    )
  })

  it("reorders top-level leaves", () => {
    const columns = [nameCol, amountCol, noteCol]
    const next = applyLeafColumnOrder(columns, ["note", "name", "amount"])

    expect(collectLeafColumnIds(next)).toEqual(["note", "name", "amount"])
    expect(next.map((column) => column.id)).toEqual(["note", "name", "amount"])
  })

  it("keeps a group wrapper when its leaves stay contiguous", () => {
    const next = applyLeafColumnOrder(groupedColumns, [
      "note",
      "name",
      "amount",
    ])

    expect(next).toHaveLength(2)
    expect(next[0]?.id).toBe("note")
    expect(next[1]?.id).toBe("group:Identity::name")
    expect(childColumnIds(next[1])).toEqual(["name", "amount"])
  })

  it("splits a group when its leaves are interleaved", () => {
    const next = applyLeafColumnOrder(groupedColumns, [
      "name",
      "note",
      "amount",
    ])

    expect(collectLeafColumnIds(next)).toEqual(["name", "note", "amount"])
    expect(next).toHaveLength(3)
    expect(next[0]?.id).toBe("group:Identity::name")
    expect(childColumnIds(next[0])).toEqual(["name"])
    expect(next[1]?.id).toBe("note")
    expect(next[2]?.id).toBe("group:Identity::amount")
    expect(childColumnIds(next[2])).toEqual(["amount"])
  })
})
