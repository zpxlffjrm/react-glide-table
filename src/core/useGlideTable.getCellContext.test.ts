import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useGlideTable } from "@/core/useGlideTable"
import type { ColumnDef } from "@/components/ui/table/types"

type Row = { id: string; name: string }

describe("useGlideTable getCellContext", () => {
  it("injects update that commits through onCellChange", () => {
    const changes: Array<{ rowId: string; columnId: string; value: unknown }> =
      []

    const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "name", header: "Name" },
    ]

    const { result } = renderHook(() =>
      useGlideTable({
        data: [{ id: "1", name: "Alpha" }],
        columns,
        getRowId: (row) => row.id,
        onCellChange: (rowId, columnId, value) => {
          changes.push({ rowId, columnId, value })
        },
      }),
    )

    const cell = result.current.rows[0]?.getVisibleCells()[0]
    expect(cell).toBeDefined()
    if (!cell) return

    const bare = cell.getContext()
    expect(bare.update).toBeUndefined()

    const wrapped = result.current.getCellContext(cell)
    expect(typeof wrapped.update).toBe("function")
    wrapped.update("Done")
    expect(changes).toEqual([{ rowId: "1", columnId: "name", value: "Done" }])
  })
})
