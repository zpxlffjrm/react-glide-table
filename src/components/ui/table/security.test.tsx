import { render, waitFor } from "@testing-library/react"
import type { Row } from "@tanstack/react-table"
import { describe, expect, it, vi } from "vitest"

import { isColumnEditable } from "@/components/ui/table/features/cell-edit/cellEdit"
import { sanitizeImageSrc } from "@/components/ui/table/features/cell-render/builtins"
import { createCellRendererRegistry } from "@/components/ui/table/features/cell-render/registry"
import {
  escapeSpreadsheetFormula,
  serializeSelectionToTSV,
} from "@/components/ui/table/features/cell-selection/copyData"
import { applyFillData, collectFillChanges } from "@/components/ui/table/features/cell-selection/fillData"
import { DataTable } from "@/index"
import type { ColumnDef } from "@/index"

type CellStub = { column: { id: string; columnDef: Record<string, unknown> }; getValue: () => unknown }

function stubRows<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{ id: string; meta?: Record<string, unknown> }>,
): Row<T>[] {
  return data.map((original, index) => ({
    id: String(index),
    index,
    original,
    getVisibleCells: (): CellStub[] =>
      columns.map((column) => ({
        column: {
          id: column.id,
          columnDef: { accessorKey: column.id, id: column.id, meta: column.meta },
        },
        getValue: () => original[column.id],
      })),
  })) as unknown as Row<T>[]
}

describe("protected columns", () => {
  it("are never editable, even when marked editable", () => {
    expect(isColumnEditable({ meta: { kind: "protected", editable: true } })).toBe(false)
    expect(isColumnEditable({ meta: { kind: "text", editable: true } })).toBe(true)
  })

  it("copy the masked text even when the value is an object", () => {
    type RowData = { secret: { token: string } }
    const rows = stubRows<RowData>([{ secret: { token: "hidden" } }], [
      { id: "secret", meta: { kind: "protected" } },
    ])

    expect(
      serializeSelectionToTSV(
        rows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry: createCellRendererRegistry() },
      ),
    ).toBe("****")
  })

  it("are excluded from inline search matches", async () => {
    type RowData = { id: string; name: string; secret: string }
    const columns: ColumnDef<RowData, unknown>[] = [
      { id: "name", accessorKey: "name", header: "Name" },
      { id: "secret", accessorKey: "secret", header: "Secret", meta: { kind: "protected" } },
    ]
    const onSearchResultsChanged = vi.fn()

    render(
      <DataTable
        data={[{ id: "1", name: "visible-hit", secret: "s3cret-hit" }]}
        columns={columns}
        getRowId={(row) => row.id}
        enableVirtualization={false}
        enableInlineSearch
        showSearch
        searchValue="hit"
        onSearchResultsChanged={onSearchResultsChanged}
      />,
    )

    await waitFor(() => {
      const calls = onSearchResultsChanged.mock.calls
      const last = calls[calls.length - 1]
      expect(last?.[0]).toEqual([[0, 0]])
    })
  })
})

describe("fill handle", () => {
  it("does not write into non-editable columns", () => {
    type RowData = { a: string; b: string }
    const data: RowData[] = [
      { a: "x", b: "y" },
      { a: "1", b: "2" },
    ]
    const rows = stubRows(data, [
      { id: "a", meta: { editable: true } },
      { id: "b" },
    ])
    const source = { startRow: 0, endRow: 0, startCol: 0, endCol: 1 }
    const fill = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }

    expect(applyFillData(data, rows, source, fill)).toEqual([
      { a: "x", b: "y" },
      { a: "x", b: "2" },
    ])
    expect(collectFillChanges(rows, source, fill)).toEqual([
      { rowId: "1", columnId: "a", value: "x" },
    ])
  })
})

describe("sanitizeImageSrc", () => {
  it("allows http(s), blob, data:image and relative sources", () => {
    expect(sanitizeImageSrc("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png")
    expect(sanitizeImageSrc("blob:https://example.com/123")).toBe("blob:https://example.com/123")
    expect(sanitizeImageSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA")
    expect(sanitizeImageSrc("/img/a.png")).toBe("/img/a.png")
    expect(sanitizeImageSrc("img/a.png")).toBe("img/a.png")
  })

  it("rejects other schemes", () => {
    expect(sanitizeImageSrc("javascript:alert(1)")).toBeNull()
    expect(sanitizeImageSrc("data:text/html,<b>x</b>")).toBeNull()
    expect(sanitizeImageSrc("file:///etc/passwd")).toBeNull()
    expect(sanitizeImageSrc("  ")).toBeNull()
  })
})

describe("escapeSpreadsheetFormula", () => {
  it("prefixes formula-like text and leaves plain values alone", () => {
    expect(escapeSpreadsheetFormula("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")")
    expect(escapeSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(escapeSpreadsheetFormula("+cmd|x")).toBe("'+cmd|x")
    expect(escapeSpreadsheetFormula("-1+2")).toBe("'-1+2")
    expect(escapeSpreadsheetFormula("-12.5")).toBe("-12.5")
    expect(escapeSpreadsheetFormula("hello")).toBe("hello")
  })

  it("is applied to copied cells only when escapeFormulas is set", () => {
    type RowData = { v: string }
    const rows = stubRows<RowData>([{ v: "=1+1" }], [{ id: "v" }])
    const bounds = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }

    expect(serializeSelectionToTSV(rows, bounds)).toBe("=1+1")
    expect(serializeSelectionToTSV(rows, bounds, "visible", { escapeFormulas: true })).toBe("'=1+1")
  })
})
