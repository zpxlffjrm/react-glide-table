/**
 * Expected behavior for the issues found in the 2026-11 bug hunt.
 * Each test names the report item it covers (H = high, M = medium, L = low).
 */
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { StrictMode, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { computeRowSpans } from "@/components/ui/table/features/row-span/rowSpan"
import { DataTable, Table, parseClipboardTSV } from "@/index"
import type { ColumnDef, DataTableCopyActions, RowsPastePayload } from "@/index"

type AnyRow = Record<string, unknown>

function cellAt(container: HTMLElement, row: number, col: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-row-index="${row}"][data-col-index="${col}"]`,
  )
  if (!cell) throw new Error(`no cell at ${row},${col}`)
  return cell
}

function columnTexts(container: HTMLElement, col = 0): string[] {
  return Array.from(container.querySelectorAll("tbody tr")).map(
    (tr) => tr.querySelectorAll("td")[col]?.textContent?.replace("·", "").trim() ?? "",
  )
}

function editCell(container: HTMLElement, row: number, col: number, value: string) {
  fireEvent.doubleClick(cellAt(container, row, col))
  const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")
  if (!input) throw new Error("editor did not open")
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: "Enter" })
}

function selectRange(container: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.mouseDown(cellAt(container, from[0], from[1]))
  if (from[0] !== to[0] || from[1] !== to[1]) {
    fireEvent.mouseEnter(cellAt(container, to[0], to[1]))
  }
  fireEvent.mouseUp(window)
}

function dragFillHandleTo(container: HTMLElement, row: number, col: number) {
  const handle = container.querySelector(".fill-handle")
  if (!handle) throw new Error("no fill handle")
  fireEvent.mouseDown(handle)
  fireEvent.mouseEnter(cellAt(container, row, col))
  fireEvent.mouseUp(window)
}

function mockClipboard(extra: Record<string, unknown> = {}) {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText, readText: vi.fn().mockRejectedValue(new Error("denied")), ...extra },
  })
  return writeText
}

function firePaste(text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", { value: { getData: () => text } })
  act(() => {
    window.dispatchEvent(event)
  })
}

describe("tree tables", () => {
  it("H1: expands rows whose toggle id is a number", () => {
    const data = [{ id: 1, name: "root", children: [{ id: 2, name: "child" }] }]
    const { container } = render(
      <Table data={data} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    // Auto-expanded on load like string ids.
    expect(columnTexts(container)).toEqual(["root", "child"])

    const toggle = container.querySelector<HTMLElement>(".expand-toggle-button")!
    fireEvent.click(toggle) // collapse
    expect(columnTexts(container)).toEqual(["root"])
    fireEvent.click(container.querySelector<HTMLElement>(".expand-toggle-button")!) // expand
    expect(columnTexts(container)).toEqual(["root", "child"])
  })

  it("H6: keeps grandchildren under their own parent (flat parentId data)", () => {
    const data = [
      { id: "A", name: "A" },
      { id: "A1", parentId: "A", name: "A1" },
      { id: "A1x", parentId: "A1", name: "A1x" },
      { id: "B", name: "B" },
      { id: "B1", parentId: "B", name: "B1" },
      { id: "B1x", parentId: "B1", name: "B1x" },
    ]
    const { container } = render(
      <Table data={data} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(columnTexts(container)).toEqual(["A", "A1", "A1x", "B", "B1", "B1x"])
  })

  it("H6: shows and toggles grandchildren of nested data", () => {
    const data = [
      { id: "A", name: "A", children: [{ id: "A1", name: "A1", children: [{ id: "A1x", name: "A1x" }] }] },
      { id: "B", name: "B", children: [{ id: "B1", name: "B1", children: [{ id: "B1x", name: "B1x" }] }] },
    ]
    const { container } = render(
      <Table data={data} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(columnTexts(container)).toEqual(["A", "A1", "A1x", "B", "B1", "B1x"])

    // The level-1 parent has its own toggle.
    const a1Row = container.querySelectorAll("tbody tr")[1]!
    const a1Toggle = a1Row.querySelector<HTMLElement>(".expand-toggle-button")
    expect(a1Toggle).not.toBeNull()
    fireEvent.click(a1Toggle!)
    expect(columnTexts(container)).toEqual(["A", "A1", "B", "B1", "B1x"])
  })

  it("M4: respects a controlled expandedRows value on mount", () => {
    const onExpandedRowsChange = vi.fn()
    const { container } = render(
      <Table
        data={[{ id: "A", name: "A", children: [{ id: "A1", name: "child" }] }]}
        toggleField="id"
        expandedRows={new Set<string>()}
        onExpandedRowsChange={onExpandedRowsChange}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(onExpandedRowsChange).not.toHaveBeenCalled()
    expect(columnTexts(container)).toEqual(["A"])
  })

  it("M11: builds a large tree of orphan rows in roughly linear time", () => {
    const data = Array.from({ length: 20000 }, (_, i) => ({
      id: `n${i}`,
      parentId: `missing${i}`,
      name: "x",
    }))
    const started = performance.now()
    render(
      <Table data={data} toggleField="id">
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe("onDataChange keeps the full original data", () => {
  it("H2: tree edit patches the nested original data only", () => {
    const onDataChange = vi.fn()
    const data = [
      { id: "A", name: "A", children: [{ id: "A1", name: "A1" }] },
      { id: "B", name: "B", children: [{ id: "B1", name: "B1" }] },
    ]
    function Harness() {
      const [expanded, setExpanded] = useState(new Set<string>(["A"]))
      return (
        <Table
          data={data}
          toggleField="id"
          expandedRows={expanded}
          onExpandedRowsChange={setExpanded}
          onDataChange={onDataChange}
          enableVirtualization={false}
        >
          <Table.Header>
            <Table.Column field="name" editable>
              name
            </Table.Column>
          </Table.Header>
        </Table>
      )
    }
    const { container } = render(<Harness />)
    expect(columnTexts(container)).toEqual(["A", "A1", "B"])

    editCell(container, 1, 0, "A1!")

    expect(onDataChange).toHaveBeenCalledTimes(1)
    const next = onDataChange.mock.calls[0]![0]
    expect(next).toEqual([
      { id: "A", name: "A", children: [{ id: "A1", name: "A1!" }] },
      { id: "B", name: "B", children: [{ id: "B1", name: "B1" }] },
    ])
    // Untouched rows keep their identity.
    expect(next[1]).toBe(data[1])
  })

  it("H2: tree fill patches the original flat data", () => {
    const onDataChange = vi.fn()
    const data = [
      { id: "A", name: "A", note: "n" },
      { id: "A1", parentId: "A", name: "A1", note: "" },
      { id: "B", name: "B", note: "" },
    ]
    const { container } = render(
      <Table data={data} toggleField="id" onDataChange={onDataChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
          <Table.Column field="note" editable>
            note
          </Table.Column>
        </Table.Header>
      </Table>,
    )

    selectRange(container, [0, 1], [0, 1])
    dragFillHandleTo(container, 2, 1)

    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: "A", name: "A", note: "n" },
      { id: "A1", parentId: "A", name: "A1", note: "n" },
      { id: "B", name: "B", note: "n" },
    ])
  })

  it("H3: paginated Table edit returns every row, not just the page", () => {
    const onDataChange = vi.fn()
    const data = Array.from({ length: 5 }, (_, i) => ({ name: `n${i}` }))
    const { container } = render(
      <Table data={data} onDataChange={onDataChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" editable>
            name
          </Table.Column>
        </Table.Header>
        <Table.Pagination page={2} pageSize={2} onChange={() => {}} />
      </Table>,
    )
    expect(columnTexts(container)).toEqual(["n2", "n3"])

    editCell(container, 0, 0, "X")

    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { name: "n0" },
      { name: "n1" },
      { name: "X" },
      { name: "n3" },
      { name: "n4" },
    ])
  })

  it("H3: sorted Table edit writes the row that was edited, in original order", () => {
    const onDataChange = vi.fn()
    const data = [{ name: "c" }, { name: "a" }, { name: "b" }]
    const { container } = render(
      <Table data={data} onDataChange={onDataChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" editable sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    expect(columnTexts(container)).toEqual(["a", "b", "c"])

    editCell(container, 0, 0, "a!")

    expect(onDataChange.mock.calls[0]![0]).toEqual([{ name: "c" }, { name: "a!" }, { name: "b" }])
  })

  it("L2: editing a dotted accessorKey writes the nested field", () => {
    const onDataChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [
      { id: "city", accessorKey: "address.city", meta: { editable: true } },
    ]
    const { container } = render(
      <DataTable
        data={[{ address: { city: "Seoul", zip: "01" } }]}
        columns={columns}
        onDataChange={onDataChange}
        enableVirtualization={false}
      />,
    )

    editCell(container, 0, 0, "Busan")

    expect(onDataChange.mock.calls[0]![0]).toEqual([{ address: { city: "Busan", zip: "01" } }])
  })
})

describe("row identity", () => {
  it("H4: default row ids in a sorted Table point at the original data index", () => {
    const onCellChange = vi.fn()
    const data = [{ name: "c" }, { name: "a" }, { name: "b" }]
    const { container } = render(
      <Table data={data} onCellChange={onCellChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" editable sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)

    editCell(container, 0, 0, "Z")

    const [rowId] = onCellChange.mock.calls[0]!
    expect(data[Number(rowId)]).toEqual({ name: "a" })
  })

  it("H4: row selection stays on the same row after sorting", () => {
    const { container } = render(
      <Table
        data={[{ name: "c" }, { name: "a" }, { name: "b" }]}
        rowSelectionMode="single"
        enableCellSelection={false}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelectorAll("tbody tr")[0]!) // "c"
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)

    const selected = Array.from(container.querySelectorAll("tbody tr[data-selected]")).map(
      (row) => row.textContent,
    )
    expect(selected).toEqual(["c"])
  })

  it("H5: an open editor stays on its row when rows are inserted above", () => {
    const onCellChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "name", meta: { editable: true } }]
    const props = {
      columns,
      getRowId: (row: AnyRow) => String(row.id),
      onCellChange,
      enableVirtualization: false,
    }
    const { container, rerender } = render(
      <DataTable data={[{ id: "a", name: "A" }, { id: "b", name: "B" }]} {...props} />,
    )
    fireEvent.doubleClick(cellAt(container, 1, 0))

    rerender(
      <DataTable
        data={[{ id: "new", name: "NEW" }, { id: "a", name: "A" }, { id: "b", name: "B" }]}
        {...props}
      />,
    )

    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    expect(input.closest("td")?.getAttribute("data-row-index")).toBe("2")
    fireEvent.change(input, { target: { value: "B!" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onCellChange).toHaveBeenCalledWith("b", "name", "B!")
  })

  it("M13: clears the cell selection when the selected rows disappear", async () => {
    mockClipboard()
    let actions: DataTableCopyActions | undefined
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "name" }]
    const { container, rerender } = render(
      <DataTable
        data={[{ name: "a" }, { name: "b" }, { name: "c" }]}
        columns={columns}
        enableVirtualization={false}
        onCopyActionsReady={(next) => (actions = next)}
      />,
    )
    selectRange(container, [2, 0], [2, 0])

    rerender(
      <DataTable
        data={[{ name: "a" }]}
        columns={columns}
        enableVirtualization={false}
        onCopyActionsReady={(next) => (actions = next)}
      />,
    )

    expect(container.querySelectorAll("[data-selection-fill]")).toHaveLength(0)
    await expect(actions!.copySelection()).resolves.toBe(false)
  })

  it("M13: clears the cell selection when columns are reordered", () => {
    const a: ColumnDef<AnyRow> = { accessorKey: "a" }
    const b: ColumnDef<AnyRow> = { accessorKey: "b" }
    const data = [{ a: "1", b: "2" }]
    const { container, rerender } = render(
      <DataTable data={data} columns={[a, b]} enableVirtualization={false} />,
    )
    selectRange(container, [0, 0], [0, 0])
    expect(container.querySelectorAll("[data-selection-fill]")).toHaveLength(1)

    rerender(<DataTable data={data} columns={[b, a]} enableVirtualization={false} />)

    expect(container.querySelectorAll("[data-selection-fill]")).toHaveLength(0)
  })

  it("L1: does not open a text editor over an object value", () => {
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "tags", meta: { editable: true } }]
    const { container } = render(
      <DataTable data={[{ tags: ["a", "b"] }]} columns={columns} enableVirtualization={false} />,
    )
    fireEvent.doubleClick(cellAt(container, 0, 0))
    expect(container.querySelector("input.cell-edit-input")).toBeNull()
  })
})

describe("fill handle", () => {
  it("H9: never copies a protected column's raw value into another column", () => {
    const onBatchChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [
      { accessorKey: "secret", meta: { kind: "protected" } },
      { accessorKey: "note", meta: { editable: true } },
    ]
    const { container } = render(
      <DataTable
        data={[{ secret: "TOPSECRET", note: "" }]}
        columns={columns}
        onBatchChange={onBatchChange}
        enableVirtualization={false}
      />,
    )
    selectRange(container, [0, 0], [0, 0])
    dragFillHandleTo(container, 0, 1)

    const written = onBatchChange.mock.calls.flatMap((call) => call[0])
    expect(written).not.toContainEqual(expect.objectContaining({ value: "TOPSECRET" }))
  })

  it("M1: commits a fill once under StrictMode", () => {
    const onBatchChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "a", meta: { editable: true } }]
    const { container } = render(
      <StrictMode>
        <DataTable
          data={[{ a: "1" }, { a: "2" }, { a: "3" }]}
          columns={columns}
          onBatchChange={onBatchChange}
          enableVirtualization={false}
        />
      </StrictMode>,
    )
    selectRange(container, [0, 0], [0, 0])
    dragFillHandleTo(container, 2, 0)

    expect(onBatchChange).toHaveBeenCalledTimes(1)
  })

  it("M3: a downward fill keeps the full source width", () => {
    const onBatchChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = ["a", "b", "c"].map((key) => ({
      accessorKey: key,
      meta: { editable: true },
    }))
    const data = Array.from({ length: 3 }, (_, i) => ({ a: `a${i}`, b: `b${i}`, c: `c${i}` }))
    const { container } = render(
      <DataTable
        data={data}
        columns={columns}
        getRowId={(_row, index) => `r${index}`}
        onBatchChange={onBatchChange}
        enableVirtualization={false}
      />,
    )
    selectRange(container, [0, 0], [0, 2])
    dragFillHandleTo(container, 2, 1) // pointer over the middle column

    const changes = onBatchChange.mock.calls[0]![0]
    expect(changes).toEqual(
      expect.arrayContaining([
        { rowId: "r1", columnId: "c", value: "c0" },
        { rowId: "r2", columnId: "c", value: "c0" },
      ]),
    )
    expect(changes).toHaveLength(6)
  })
})

describe("built-in cells", () => {
  it("M2: a boolean column with editable={false} is read-only", () => {
    const onCellChange = vi.fn()
    const { container } = render(
      <Table data={[{ ok: false }]} onCellChange={onCellChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="ok" kind="boolean" editable={false}>
            ok
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    const checkbox = container.querySelector<HTMLInputElement>("input[type=checkbox]")!
    expect(checkbox.disabled).toBe(true)
    fireEvent.click(checkbox)
    expect(onCellChange).not.toHaveBeenCalled()
  })

  it("M2: a boolean column without editable stays clickable", () => {
    const onCellChange = vi.fn()
    const { container } = render(
      <Table data={[{ ok: false }]} onCellChange={onCellChange} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="ok" kind="boolean">
            ok
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelector<HTMLInputElement>("input[type=checkbox]")!)
    expect(onCellChange).toHaveBeenCalledWith("0", "ok", true)
  })

  it("L8: shows object and array values as readable text", () => {
    const { container } = render(
      <Table data={[{ obj: { label: "Label" }, list: ["a", "b"] }]} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="obj">obj</Table.Column>
          <Table.Column field="list">list</Table.Column>
        </Table.Header>
      </Table>,
    )
    expect(columnTexts(container, 0)).toEqual(["Label"])
    expect(columnTexts(container, 1)).toEqual(["a, b"])
  })
})

describe("copy", () => {
  async function copyRange(
    data: AnyRow[],
    columns: ColumnDef<AnyRow>[],
    to: [number, number],
    extra: Record<string, unknown> = {},
  ) {
    const writeText = mockClipboard()
    let actions: DataTableCopyActions | undefined
    const { container } = render(
      <DataTable
        data={data}
        columns={columns}
        enableVirtualization={false}
        onCopyActionsReady={(next) => (actions = next)}
        {...extra}
      />,
    )
    selectRange(container, [0, 0], to)
    await act(async () => {
      await actions!.copySelection()
    })
    return writeText.mock.calls[0]?.[0] as string
  }

  it("H7: quotes cells containing tabs, newlines or quotes so the TSV stays aligned", async () => {
    const text = await copyRange(
      [{ a: "line1\nline2", b: 'say "hi"\tnow' }],
      [{ accessorKey: "a" }, { accessorKey: "b" }],
      [0, 1],
    )
    expect(text).toBe('"line1\nline2"\t"say ""hi""\tnow"')
    expect(parseClipboardTSV(text)).toEqual([["line1\nline2", 'say "hi"\tnow']])
  })

  it("M5: copies every selected row even when ids repeat", async () => {
    const text = await copyRange(
      [
        { id: 7, name: "x" },
        { id: 7, name: "y" },
        { id: 8, name: "z" },
      ],
      [{ accessorKey: "id" }, { accessorKey: "name" }],
      [2, 1],
    )
    expect(text).toBe("7\tx\n7\ty\n8\tz")
  })

  it("M10: copies a Date as an ISO string without JSON quotes", async () => {
    const text = await copyRange(
      [{ when: new Date("2024-01-02T00:00:00.000Z") }],
      [{ accessorKey: "when" }],
      [0, 0],
    )
    expect(text).toBe("2024-01-02T00:00:00.000Z")
  })

  it("M6: a plain copy of tree rows has no indentation tabs", async () => {
    const writeText = mockClipboard()
    let actions: DataTableCopyActions | undefined
    const { container } = render(
      <Table
        data={[{ id: "A", name: "parent", children: [{ id: "A1", name: "child" }] }]}
        toggleField="id"
        enableVirtualization={false}
        onCopyActionsReady={(next) => (actions = next)}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    selectRange(container, [0, 0], [1, 0])
    await act(async () => {
      await actions!.copySelection()
    })
    expect(writeText.mock.calls[0]![0]).toBe("parent\nchild")
  })
})

describe("paste", () => {
  it("H8: keeps a blank first column from a spreadsheet in place", () => {
    mockClipboard()
    const onRowsPaste = vi.fn<(payload: RowsPastePayload) => void>()
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "a" }, { accessorKey: "b" }, { accessorKey: "c" }]
    const { container } = render(
      <DataTable
        data={[{ a: "", b: "", c: "" }, { a: "", b: "", c: "" }]}
        columns={columns}
        onRowsPaste={onRowsPaste}
        enableVirtualization={false}
      />,
    )
    selectRange(container, [0, 0], [0, 0])

    firePaste("A\tB\tC\n\tB2\tC2")

    expect(onRowsPaste).toHaveBeenCalledTimes(1)
    expect(onRowsPaste.mock.calls[0]![0].values).toEqual([
      ["A", "B", "C"],
      ["", "B2", "C2"],
    ])
    expect(onRowsPaste.mock.calls[0]![0].depths).toEqual([0, 0])
  })

  it("H8: still recovers tree depth from this table's own subtree copy", async () => {
    const writeText = mockClipboard()
    const onRowsPaste = vi.fn<(payload: RowsPastePayload) => void>()
    let actions: DataTableCopyActions | undefined
    const { container } = render(
      <Table
        data={[{ id: "A", name: "parent", children: [{ id: "A1", name: "child" }] }]}
        toggleField="id"
        enableVirtualization={false}
        onCopyActionsReady={(next) => (actions = next)}
        onRowsPaste={onRowsPaste}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    selectRange(container, [0, 0], [0, 0])
    await act(async () => {
      await actions!.copySelection({ includeDescendants: true })
    })
    const copied = writeText.mock.calls[0]![0] as string

    firePaste(copied)

    expect(onRowsPaste).toHaveBeenCalledTimes(1)
    expect(onRowsPaste.mock.calls[0]![0].depths).toEqual([0, 1])
    expect(onRowsPaste.mock.calls[0]![0].values).toEqual([["parent"], ["child"]])
  })

  it("L11: parses quoted spreadsheet cells with newlines and quotes", () => {
    expect(parseClipboardTSV('"a\nb"\tc\n"x""y"\tz')).toEqual([
      ["a\nb", "c"],
      ['x"y', "z"],
    ])
  })

  it("L7: a context-menu paste after a handled Ctrl+V still reaches onRowsPaste", async () => {
    mockClipboard({ readText: vi.fn().mockResolvedValue("first") })
    const onRowsPaste = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "name" }]
    const { container } = render(
      <DataTable
        data={[{ name: "a" }]}
        columns={columns}
        onRowsPaste={onRowsPaste}
        enableVirtualization={false}
      />,
    )
    selectRange(container, [0, 0], [0, 0])

    fireEvent.keyDown(window, { key: "v", ctrlKey: true })
    await waitFor(() => expect(onRowsPaste).toHaveBeenCalledTimes(1))
    firePaste("first") // the browser's paste event for the same keystroke
    expect(onRowsPaste).toHaveBeenCalledTimes(1)

    firePaste("second") // later, from the context menu
    expect(onRowsPaste).toHaveBeenCalledTimes(2)
    expect(onRowsPaste.mock.calls[1]![0].values).toEqual([["second"]])
  })
})

describe("inline search", () => {
  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
  const highlighted = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("[data-search-match]")).map((cell) => cell.textContent)

  it("M7: re-runs after the rows are re-sorted", async () => {
    const { container } = render(
      <Table
        data={[{ name: "zeta" }, { name: "alpha" }, { name: "mid" }]}
        enableVirtualization={false}
        enableInlineSearch
        showSearch
        searchValue="zeta"
      >
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    await wait(60)
    expect(highlighted(container)).toEqual(["zeta"])

    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    await wait(60)
    expect(highlighted(container)).toEqual(["zeta"])
  })

  it("M8: counts each tree cell once when rows have no id field", async () => {
    let lastResults: readonly (readonly [number, number])[] = []
    render(
      <Table
        data={[{ code: "A", name: "alpha", children: [{ code: "A1", name: "needle" }] }]}
        toggleField="code"
        enableVirtualization={false}
        enableInlineSearch
        showSearch
        searchValue="needle"
        onSearchResultsChanged={(results) => {
          lastResults = results
        }}
      >
        <Table.Header>
          <Table.Column field="code">code</Table.Column>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    await wait(80)
    expect(lastResults).toHaveLength(1)
  })

  it("M12: Enter during IME composition does not jump to the next result", async () => {
    const onSearchResultsChanged = vi.fn()
    const { container } = render(
      <Table
        data={[{ name: "가나" }, { name: "가다" }]}
        enableVirtualization={false}
        enableInlineSearch
        showSearch
        searchValue="가"
        onSearchResultsChanged={onSearchResultsChanged}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    await wait(60)
    onSearchResultsChanged.mockClear()

    const input = container.querySelector<HTMLInputElement>(".data-table-search-input")!
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 })

    expect(onSearchResultsChanged).not.toHaveBeenCalled()
  })

  it("L5: Ctrl+F opens only the table the user last interacted with", () => {
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "name" }]
    const { container } = render(
      <div>
        <DataTable data={[{ name: "one" }]} columns={columns} enableInlineSearch enableVirtualization={false} />
        <DataTable data={[{ name: "two" }]} columns={columns} enableInlineSearch enableVirtualization={false} />
      </div>,
    )
    const tables = container.querySelectorAll<HTMLElement>(".DataTableJSX")
    const secondCell = tables[1]!.querySelector<HTMLElement>("tbody td")!
    fireEvent.pointerDown(secondCell)
    fireEvent.mouseDown(secondCell)
    fireEvent.mouseUp(window)

    fireEvent.keyDown(window, { key: "f", ctrlKey: true })

    expect(tables[0]!.querySelector(".data-table-search")).toBeNull()
    expect(tables[1]!.querySelector(".data-table-search")).not.toBeNull()
  })
})

describe("cell editing", () => {
  it("M12: Enter during IME composition does not commit the edit", () => {
    const onCellChange = vi.fn()
    const columns: ColumnDef<AnyRow>[] = [{ accessorKey: "name", meta: { editable: true } }]
    const { container } = render(
      <DataTable
        data={[{ name: "a" }]}
        columns={columns}
        onCellChange={onCellChange}
        enableVirtualization={false}
      />,
    )
    fireEvent.doubleClick(cellAt(container, 0, 0))
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    fireEvent.change(input, { target: { value: "한" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 })

    expect(onCellChange).not.toHaveBeenCalled()
    expect(container.querySelector("input.cell-edit-input")).not.toBeNull()
  })
})

describe("compound Table sorting and pagination", () => {
  it("L3: sorts numeric strings numerically", () => {
    const { container } = render(
      <Table data={[{ code: "10" }, { code: "9" }, { code: "2" }]} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="code" sortable>
            code
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    expect(columnTexts(container)).toEqual(["2", "9", "10"])
  })

  it("M9: manual pagination shows the given (server) page as-is", () => {
    const { container } = render(
      <Table data={[{ name: "p2-a" }, { name: "p2-b" }]} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={2} pageSize={2} totalCount={10} manual onChange={() => {}} />
      </Table>,
    )
    expect(columnTexts(container)).toEqual(["p2-a", "p2-b"])
  })

  it("L10: an out-of-range page shows the last page's rows", () => {
    const { container } = render(
      <Table data={[{ name: "a" }, { name: "b" }, { name: "c" }]} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={5} pageSize={2} onChange={() => {}} />
      </Table>,
    )
    expect(columnTexts(container)).toEqual(["c"])
  })

  it("L10: pagination button labels can be customized", () => {
    const { container } = render(
      <Table data={[{ name: "a" }]} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination
          page={1}
          pageSize={2}
          onChange={() => {}}
          previousLabel="이전 페이지"
          nextLabel="다음 페이지"
        />
      </Table>,
    )
    expect(container.querySelector('[aria-label="이전 페이지"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="다음 페이지"]')).not.toBeNull()
  })
})

describe("row span", () => {
  it("L9: merges consecutive NaN values like any other equal value", () => {
    expect(computeRowSpans([{ v: Number.NaN }, { v: Number.NaN }], "v")).toEqual([
      { rowSpan: 2, isFirstInGroup: true },
      { rowSpan: 0, isFirstInGroup: false },
    ])
  })
})
