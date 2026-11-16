/**
 * Expected behavior for the 2026-11 UX / consistency review.
 * Each test names the report item it covers (U1 … U28).
 */
import { act, fireEvent, render } from "@testing-library/react"
import { useState, type ReactElement } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { DataTable, Table, createTable } from "@/index"
import type { ColumnDef, RowsPastePayload } from "@/index"

type AnyRow = Record<string, unknown>

beforeAll(() => {
  // jsdom has no layout; keyboard navigation scrolls the active cell into view.
  Element.prototype.scrollIntoView = function scrollIntoView() {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

function cellAt(container: HTMLElement, row: number, col: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-row-index="${row}"][data-col-index="${col}"]`,
  )
  if (!cell) throw new Error(`no cell at ${row},${col}`)
  return cell
}

function clickCell(container: HTMLElement, row: number, col: number) {
  const cell = cellAt(container, row, col)
  fireEvent.mouseDown(cell)
  fireEvent.mouseUp(window)
  fireEvent.click(cell)
}

function selectedCells(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("td[data-selection-fill]")).map(
    (cell) => `${cell.dataset.rowIndex},${cell.dataset.colIndex}`,
  )
}

function rowTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody tr")).map(
    (tr) => tr.querySelectorAll("td")[0]?.textContent?.replace("·", "").trim() ?? "",
  )
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText, readText: vi.fn().mockRejectedValue(new Error("denied")) },
  })
  return writeText
}

function keyOn(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

const ROWS: AnyRow[] = [
  { id: "1", name: "a", qty: 1 },
  { id: "2", name: "b", qty: 2 },
  { id: "3", name: "c", qty: 3 },
]

const COLUMNS: ColumnDef<AnyRow, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "qty", header: "Qty", meta: { editable: true } },
]

describe("U1: cell clicks and row selection", () => {
  it("does not toggle row selection from a cell click while cell selection is on", () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={(row) => String(row.id)}
        rowSelectionMode="multi"
        enableVirtualization={false}
      />,
    )

    clickCell(container, 0, 0)

    expect(container.querySelectorAll("tbody tr[data-selected]")).toHaveLength(0)
    expect(selectedCells(container)).toEqual(["0,0"])
  })

  it("keeps row-click selection when cell selection is off", () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={(row) => String(row.id)}
        rowSelectionMode="multi"
        enableCellSelection={false}
        enableVirtualization={false}
      />,
    )

    clickCell(container, 0, 0)

    expect(container.querySelectorAll("tbody tr[data-selected]")).toHaveLength(1)
  })

  it("still calls onRowClick for a cell click", () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        rowSelectionMode="multi"
        onRowClick={onRowClick}
        enableVirtualization={false}
      />,
    )

    clickCell(container, 1, 0)

    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0]![0]).toEqual(ROWS[1])
  })
})

describe("U2: shortcuts after clicking outside the table", () => {
  it("stops handling arrow keys once the user clicks outside", () => {
    const { container } = render(
      <div>
        <p data-testid="outside">page text</p>
        <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />
      </div>,
    )
    clickCell(container, 0, 0)

    const outside = container.querySelector('[data-testid="outside"]')!
    fireEvent.pointerDown(outside)
    fireEvent.mouseDown(outside)
    fireEvent.mouseUp(outside)

    const event = keyOn(document.body, { key: "ArrowDown" })
    expect(event.defaultPrevented).toBe(false)
  })

  it("lets Ctrl+C copy page text after clicking outside", async () => {
    const writeText = mockClipboard()
    const { container } = render(
      <div>
        <p data-testid="outside">page text</p>
        <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />
      </div>,
    )
    clickCell(container, 0, 0)

    const outside = container.querySelector('[data-testid="outside"]')!
    fireEvent.pointerDown(outside)
    fireEvent.mouseDown(outside)

    const event = keyOn(document.body, { key: "c", ctrlKey: true })
    await act(async () => {})

    expect(event.defaultPrevented).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })

  it("keeps Ctrl+C on the table after clicking back into it", async () => {
    const writeText = mockClipboard()
    const { container } = render(
      <div>
        <p data-testid="outside">page text</p>
        <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />
      </div>,
    )
    clickCell(container, 0, 0)
    fireEvent.pointerDown(container.querySelector('[data-testid="outside"]')!)
    fireEvent.pointerDown(cellAt(container, 1, 0))
    clickCell(container, 1, 0)

    keyOn(document.body, { key: "c", ctrlKey: true })
    await act(async () => {})

    expect(writeText).toHaveBeenCalledWith("b")
  })

  it("does not take Ctrl+C when page text outside the table is selected", async () => {
    const writeText = mockClipboard()
    const { container } = render(
      <div>
        <p data-testid="outside">page text</p>
        <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />
      </div>,
    )
    clickCell(container, 0, 0)

    // Text selected by keyboard (no pointer event) outside the table.
    const outside = container.querySelector('[data-testid="outside"]')!
    const range = document.createRange()
    range.selectNodeContents(outside)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    keyOn(document.body, { key: "c", ctrlKey: true })
    await act(async () => {})
    selection.removeAllRanges()

    expect(writeText).not.toHaveBeenCalled()
  })
})

describe("U3: tree tables with sort and pagination", () => {
  const FLAT_TREE: AnyRow[] = [
    { id: "A", name: "A" },
    { id: "A1", parentId: "A", name: "x-child" },
    { id: "A2", parentId: "A", name: "a-child" },
    { id: "B", name: "B" },
  ]

  it("pages by root rows and keeps children with their parent", () => {
    const { container } = render(
      <Table data={FLAT_TREE} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={1} pageSize={1} onChange={() => {}} />
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["A", "x-child", "a-child"])
    expect(container.querySelector(".pagination-label")?.textContent).toBe("1 / 2")
  })

  it("shows the next root block on the next page", () => {
    const { container } = render(
      <Table data={FLAT_TREE} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={2} pageSize={1} onChange={() => {}} />
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["B"])
  })

  it("sorts siblings without lifting children out of their parent", () => {
    const { container } = render(
      <Table data={FLAT_TREE} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    const sortButton = container.querySelector(".SortableHeaderJSX")!

    fireEvent.click(sortButton) // asc
    expect(rowTexts(container)).toEqual(["A", "a-child", "x-child", "B"])

    fireEvent.click(sortButton) // desc
    expect(rowTexts(container)).toEqual(["B", "A", "x-child", "a-child"])
  })

  it("still writes the edited child back to the full data after a tree sort", () => {
    const onDataChange = vi.fn()
    const { container } = render(
      <Table
        data={FLAT_TREE}
        toggleField="id"
        onDataChange={onDataChange}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name" sortable editable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!) // asc

    fireEvent.doubleClick(cellAt(container, 1, 0)) // "a-child"
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    fireEvent.change(input, { target: { value: "edited" } })
    fireEvent.keyDown(input, { key: "Enter" })

    const next = onDataChange.mock.calls[0]![0] as AnyRow[]
    expect(next).toHaveLength(4)
    expect(next.map((row) => row.name)).toEqual(["A", "x-child", "edited", "B"])
  })
})

describe("U4: fill handle only where fill can write", () => {
  it("hides the fill handle in a read-only table", () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={[{ accessorKey: "name", header: "Name" }]}
        onCellChange={() => {}}
        enableVirtualization={false}
      />,
    )
    clickCell(container, 0, 0)

    expect(selectedCells(container)).toEqual(["0,0"])
    expect(container.querySelector(".fill-handle")).toBeNull()
  })

  it("hides the fill handle when no write callback is given", () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />,
    )
    clickCell(container, 0, 1)

    expect(container.querySelector(".fill-handle")).toBeNull()
  })

  it("fills through onCellChange when onBatchChange is absent", () => {
    const onCellChange = vi.fn()
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={(row) => String(row.id)}
        onCellChange={onCellChange}
        enableVirtualization={false}
      />,
    )
    clickCell(container, 0, 1)

    fireEvent.mouseDown(container.querySelector(".fill-handle")!)
    fireEvent.mouseEnter(cellAt(container, 2, 1))
    fireEvent.mouseUp(window)

    expect(onCellChange.mock.calls).toEqual([
      ["2", "qty", 1],
      ["3", "qty", 1],
    ])
  })
})

describe("U5: write callbacks fall back to each other", () => {
  it("commits an edit through onBatchChange when it is the only callback", () => {
    const onBatchChange = vi.fn()
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={(row) => String(row.id)}
        onBatchChange={onBatchChange}
        enableVirtualization={false}
      />,
    )

    fireEvent.doubleClick(cellAt(container, 1, 1))
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    fireEvent.change(input, { target: { value: "9" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onBatchChange).toHaveBeenCalledWith([{ rowId: "2", columnId: "qty", value: "9" }])
  })

  it("commits a render update through onBatchChange when it is the only callback", () => {
    const onBatchChange = vi.fn()
    const T = createTable<AnyRow>()
    const { getByRole } = render(
      <T data={ROWS} getRowId={(row) => String(row.id)} onBatchChange={onBatchChange} enableVirtualization={false}>
        <T.Header>
          <T.Column
            field="name"
            render={({ row, update }) =>
              row.index === 0 ? (
                <button type="button" onClick={() => update("done")}>
                  go
                </button>
              ) : null
            }
          >
            Name
          </T.Column>
        </T.Header>
      </T>,
    )

    fireEvent.click(getByRole("button", { name: "go" }))

    expect(onBatchChange).toHaveBeenCalledWith([{ rowId: "1", columnId: "name", value: "done" }])
  })
})

describe("U6: boolean columns without an explicit editable", () => {
  it("warns once in development that the checkbox writes without editable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const T = createTable<AnyRow>()
    const { rerender } = render(
      <T data={[{ ok: true }, { ok: false }]} onCellChange={() => {}} enableVirtualization={false}>
        <T.Header>
          <T.Column field="ok" kind="boolean">
            OK
          </T.Column>
        </T.Header>
      </T>,
    )
    rerender(
      <T data={[{ ok: false }, { ok: false }]} onCellChange={() => {}} enableVirtualization={false}>
        <T.Header>
          <T.Column field="ok" kind="boolean">
            OK
          </T.Column>
        </T.Header>
      </T>,
    )

    const messages = warn.mock.calls.map((call) => String(call[0])).filter((text) => text.includes('"ok"'))
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("editable")
  })

  it("does not warn when editable is set either way", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const T = createTable<AnyRow>()
    render(
      <T data={[{ ok: true, done: false }]} onCellChange={() => {}} enableVirtualization={false}>
        <T.Header>
          <T.Column field="ok" kind="boolean" editable>
            OK
          </T.Column>
          <T.Column field="done" kind="boolean" editable={false}>
            Done
          </T.Column>
        </T.Header>
      </T>,
    )

    expect(warn.mock.calls.some((call) => String(call[0]).includes("editable"))).toBe(false)
  })
})

describe("U7: keyboard use", () => {
  function renderKeyboardTable(props: Partial<Parameters<typeof DataTable<AnyRow>>[0]> = {}) {
    const utils = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={(row) => String(row.id)}
        enableVirtualization={false}
        {...props}
      />,
    )
    const root = utils.container.querySelector<HTMLElement>(".DataTableJSX")!
    return { ...utils, root }
  }

  it("makes the table reachable with Tab and selects the first cell on focus", () => {
    const { container, root } = renderKeyboardTable()

    expect(root.tabIndex).toBe(0)
    act(() => root.focus())

    expect(selectedCells(container)).toEqual(["0,0"])
  })

  it("moves with arrow keys after keyboard focus", () => {
    const { container, root } = renderKeyboardTable()
    act(() => root.focus())

    keyOn(root, { key: "ArrowDown" })

    expect(selectedCells(container)).toEqual(["1,0"])
  })

  it("starts editing the active cell with Enter or F2", () => {
    const { container, root } = renderKeyboardTable({ onCellChange: () => {} })
    clickCell(container, 0, 1)

    keyOn(root, { key: "Enter" })
    expect(container.querySelector("input.cell-edit-input")).not.toBeNull()

    fireEvent.keyDown(container.querySelector("input.cell-edit-input")!, { key: "Escape" })
    expect(container.querySelector("input.cell-edit-input")).toBeNull()

    keyOn(root, { key: "F2" })
    expect(container.querySelector("input.cell-edit-input")).not.toBeNull()
  })

  it("moves the selection down after Enter commits an edit", () => {
    const onCellChange = vi.fn()
    const { container } = renderKeyboardTable({ onCellChange })

    fireEvent.doubleClick(cellAt(container, 0, 1))
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    fireEvent.change(input, { target: { value: "5" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onCellChange).toHaveBeenCalledWith("1", "qty", "5")
    expect(selectedCells(container)).toEqual(["1,1"])
  })

  it("commits with Tab and moves to the next cell", () => {
    const onCellChange = vi.fn()
    const { container } = renderKeyboardTable({ onCellChange })

    fireEvent.doubleClick(cellAt(container, 0, 1))
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    fireEvent.change(input, { target: { value: "5" } })
    const tab = fireEvent.keyDown(input, { key: "Tab", shiftKey: true })

    expect(tab).toBe(false) // default prevented: focus stays in the table
    expect(onCellChange).toHaveBeenCalledWith("1", "qty", "5")
    expect(container.querySelector("input.cell-edit-input")).toBeNull()
    expect(selectedCells(container)).toEqual(["0,0"])
  })

  it("clears editable cells in the selection with Delete", () => {
    const onBatchChange = vi.fn()
    const { container, root } = renderKeyboardTable({ onBatchChange })
    fireEvent.mouseDown(cellAt(container, 0, 0))
    fireEvent.mouseEnter(cellAt(container, 1, 1))
    fireEvent.mouseUp(window)

    keyOn(root, { key: "Delete" })

    expect(onBatchChange).toHaveBeenCalledWith([
      { rowId: "1", columnId: "qty", value: null },
      { rowId: "2", columnId: "qty", value: null },
    ])
  })

  it("jumps with Home / End and Ctrl+Home / Ctrl+End", () => {
    const { container, root } = renderKeyboardTable()
    clickCell(container, 1, 0)

    keyOn(root, { key: "End" })
    expect(selectedCells(container)).toEqual(["1,1"])
    keyOn(root, { key: "Home" })
    expect(selectedCells(container)).toEqual(["1,0"])
    keyOn(root, { key: "End", ctrlKey: true })
    expect(selectedCells(container)).toEqual(["2,1"])
    keyOn(root, { key: "Home", ctrlKey: true })
    expect(selectedCells(container)).toEqual(["0,0"])
  })

  it("selects every cell with Ctrl+A", () => {
    const { container, root } = renderKeyboardTable()
    clickCell(container, 1, 0)

    const event = keyOn(root, { key: "a", ctrlKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(selectedCells(container)).toHaveLength(6)
  })
})

describe("U8: accessibility attributes", () => {
  it("exposes the sort state on sortable headers", () => {
    const { container } = render(
      <Table data={ROWS} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
          <Table.Column field="qty">qty</Table.Column>
        </Table.Header>
      </Table>,
    )
    const [nameHeader, qtyHeader] = Array.from(container.querySelectorAll("th"))

    expect(nameHeader!.getAttribute("aria-sort")).toBe("none")
    expect(qtyHeader!.hasAttribute("aria-sort")).toBe(false)

    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    expect(nameHeader!.getAttribute("aria-sort")).toBe("ascending")
    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    expect(nameHeader!.getAttribute("aria-sort")).toBe("descending")
  })

  it("marks the expand toggle with aria-expanded", () => {
    const { container } = render(
      <Table data={[{ id: "A", name: "A", children: [{ id: "A1", name: "A1" }] }]} toggleField="id" enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )
    const toggle = container.querySelector(".expand-toggle-button")!

    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(toggle)
    expect(container.querySelector(".expand-toggle-button")!.getAttribute("aria-expanded")).toBe("false")
  })

  it("resizes a column from the keyboard", () => {
    const onColumnSizingChange = vi.fn()
    function Harness() {
      const [sizing, setSizing] = useState<Record<string, number>>({})
      return (
        <DataTable
          data={ROWS}
          columns={[{ id: "name", accessorKey: "name", header: "Name", size: 100 }]}
          enableColumnResize
          columnSizing={sizing}
          onColumnSizingChange={(updater) => {
            onColumnSizingChange(updater)
            setSizing((previous) => (typeof updater === "function" ? updater(previous) : updater))
          }}
          enableVirtualization={false}
        />
      )
    }
    const { container } = render(<Harness />)
    const handle = container.querySelector<HTMLElement>(".data-table-resize-handle")!

    expect(handle.tabIndex).toBe(0)
    fireEvent.keyDown(handle, { key: "ArrowRight" })

    expect(container.querySelector("th")!.style.width).toBe("110px")
  })
})

describe("U9: tree depth is exposed for styling", () => {
  it("puts data-level on tree rows", () => {
    const { container } = render(
      <Table
        data={[{ id: "A", name: "A", children: [{ id: "A1", name: "A1", children: [{ id: "A1x", name: "A1x" }] }] }]}
        toggleField="id"
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    const levels = Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
      tr.getAttribute("data-level"),
    )
    expect(levels).toEqual(["0", "1", "2"])
  })
})

describe("U10: searching what the cell shows", () => {
  async function searchResults(column: ReactElement, query: string) {
    const onSearchResultsChanged = vi.fn()
    render(
      <Table
        data={[{ n: 3 }]}
        enableInlineSearch
        showSearch
        searchValue={query}
        onSearchResultsChanged={onSearchResultsChanged}
        enableVirtualization={false}
      >
        <Table.Header>{column}</Table.Header>
      </Table>,
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const calls = onSearchResultsChanged.mock.calls
    return calls[calls.length - 1]?.[0]
  }

  it("matches the rendered text with searchValue=\"display\"", async () => {
    const results = await searchResults(
      <Table.Column field="n" searchValue="display" render={({ value }) => <span>{String(value)}개 보기</span>}>
        n
      </Table.Column>,
      "보기",
    )

    expect(results).toEqual([[0, 0]])
  })

  it("matches a custom search string", async () => {
    const results = await searchResults(
      <Table.Column field="n" searchValue={({ value }) => `item ${String(value)}`}>
        n
      </Table.Column>,
      "item 3",
    )

    expect(results).toEqual([[0, 0]])
  })

  it("keeps searching the raw value by default", async () => {
    const results = await searchResults(
      <Table.Column field="n" render={({ value }) => <span>{String(value)}개 보기</span>}>
        n
      </Table.Column>,
      "보기",
    )

    expect(results ?? []).toEqual([])
  })
})

describe("U11: Ctrl+F with a single searchable table", () => {
  it("leaves the browser's find alone until the table has been used", () => {
    render(
      <div>
        <p>page</p>
        <DataTable data={ROWS} columns={COLUMNS} enableInlineSearch enableVirtualization={false} />
      </div>,
    )

    const event = keyOn(document.body, { key: "f", ctrlKey: true })

    expect(event.defaultPrevented).toBe(false)
    expect(document.querySelector(".data-table-search")).toBeNull()
  })

  it("opens the table search after the table was pointed at", () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLUMNS} enableInlineSearch enableVirtualization={false} />,
    )
    fireEvent.pointerDown(cellAt(container, 0, 0))

    const event = keyOn(document.body, { key: "f", ctrlKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(document.querySelector(".data-table-search")).not.toBeNull()
  })
})

describe("U12: toolbar count label", () => {
  it("renders the count through labels.count when given", () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        totalCount={10}
        labels={{ count: (filtered, total) => `${filtered}건 / 전체 ${total}건` }}
        enableVirtualization={false}
      />,
    )

    expect(container.querySelector(".toolbar-count")?.textContent).toBe("3건 / 전체 10건")
  })
})

describe("U13: invalid number input", () => {
  it("keeps the editor open and marks it invalid instead of clearing the value", () => {
    const onCellChange = vi.fn()
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={[{ accessorKey: "qty", header: "Qty", meta: { editable: true, editType: "number" } }]}
        onCellChange={onCellChange}
        enableVirtualization={false}
      />,
    )
    fireEvent.doubleClick(cellAt(container, 0, 0))
    const input = container.querySelector<HTMLInputElement>("input.cell-edit-input")!
    // What a browser reports for "1-2" in <input type="number">.
    Object.defineProperty(input, "value", { configurable: true, get: () => "" })
    Object.defineProperty(input, "validity", { configurable: true, get: () => ({ badInput: true }) })

    fireEvent.keyDown(input, { key: "Enter" })

    expect(onCellChange).not.toHaveBeenCalled()
    const stillOpen = container.querySelector<HTMLInputElement>("input.cell-edit-input")
    expect(stillOpen).not.toBeNull()
    expect(stillOpen!.getAttribute("aria-invalid")).toBe("true")
  })
})

describe("U14: paste payload says which columns are writable", () => {
  it("lists editable, non-protected target columns", () => {
    const onRowsPaste = vi.fn()
    const columns: ColumnDef<AnyRow, unknown>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "qty", header: "Qty", meta: { editable: true } },
      { accessorKey: "secret", header: "Secret", meta: { editable: true, kind: "protected" } },
    ]
    const { container } = render(
      <DataTable data={ROWS} columns={columns} onRowsPaste={onRowsPaste} enableVirtualization={false} />,
    )
    clickCell(container, 0, 0)

    const event = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "clipboardData", { value: { getData: () => "x\t1\ty" } })
    act(() => {
      window.dispatchEvent(event)
    })

    const payload = onRowsPaste.mock.calls[0]![0] as RowsPastePayload
    expect(payload.columnIds).toEqual(["name", "qty", "secret"])
    expect(payload.editableColumnIds).toEqual(["qty"])
  })
})

describe("U16: frozen columns without a width", () => {
  it("offsets later frozen columns by the measured width", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.tagName === "TH" && this.getAttribute("data-leaf-column-id") === "name" ? 200 : 0
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect
    })
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={[
          { accessorKey: "name", header: "Name", meta: { frozen: "left" } },
          { accessorKey: "qty", header: "Qty", meta: { frozen: "left", width: 80 } },
        ]}
        enableColumnFreeze
        enableVirtualization={false}
      />,
    )

    expect(cellAt(container, 0, 1).style.left).toBe("200px")
  })
})

describe("U17: WASD navigation can be turned off", () => {
  it("ignores W/A/S/D when enableWasdNavigation is false", () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLUMNS} enableWasdNavigation={false} enableVirtualization={false} />,
    )
    clickCell(container, 0, 0)

    const event = keyOn(document.body, { key: "s" })

    expect(event.defaultPrevented).toBe(false)
    expect(selectedCells(container)).toEqual(["0,0"])
  })

  it("keeps WASD on by default", () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLUMNS} enableVirtualization={false} />,
    )
    clickCell(container, 0, 0)

    keyOn(document.body, { key: "s" })

    expect(selectedCells(container)).toEqual(["1,0"])
  })
})

describe("U18: controlled sort", () => {
  it("follows a controlled sort and reports clicks through onSortChange", () => {
    const onSortChange = vi.fn()
    const { container } = render(
      <Table
        data={ROWS}
        sort={{ field: "name", direction: "desc" }}
        onSortChange={onSortChange}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["c", "b", "a"])

    fireEvent.click(container.querySelector(".SortableHeaderJSX")!)
    expect(onSortChange).toHaveBeenCalledWith(null)
    // Still controlled: the order only changes when the parent passes a new sort.
    expect(rowTexts(container)).toEqual(["c", "b", "a"])
  })

  it("starts from defaultSort when uncontrolled", () => {
    const { container } = render(
      <Table data={ROWS} defaultSort={{ field: "name", direction: "desc" }} enableVirtualization={false}>
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["c", "b", "a"])
  })

  it("uses sortLocale for string comparison", () => {
    const { container } = render(
      <Table
        data={[{ name: "b" }, { name: "B" }, { name: "a" }]}
        defaultSort={{ field: "name", direction: "asc" }}
        sortLocale="en"
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name" sortable>
            name
          </Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["a", "b", "B"])
  })
})

describe("U19: tree field names", () => {
  it("accepts idField / parentIdField / childrenField", () => {
    const { container } = render(
      <Table
        data={[
          { code: "A", name: "A", kids: [{ code: "A1", name: "A1" }] },
          { code: "B", name: "B" },
          { code: "B1", owner: "B", name: "B1" },
        ]}
        idField="code"
        parentIdField="owner"
        childrenField="kids"
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
      </Table>,
    )

    expect(rowTexts(container)).toEqual(["A", "A1", "B", "B1"])
    expect(container.querySelectorAll(".expand-toggle-button")).toHaveLength(2)
  })
})

describe("U22: UI strings come from labels", () => {
  it("formats the search result count with labels.searchResultCount", async () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        enableInlineSearch
        showSearch
        searchValue="a"
        labels={{ searchResultCount: ({ results }) => `${results}건` }}
        enableVirtualization={false}
      />,
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(container.querySelector(".data-table-search-status")?.textContent).toMatch(/건$/)
  })

  it("labels the protected cell with labels.protectedCell", () => {
    const T = createTable<AnyRow>()
    const { container } = render(
      <T data={[{ pw: "x" }]} labels={{ protectedCell: "숨김" }} enableVirtualization={false}>
        <T.Header>
          <T.Column field="pw" kind="protected">
            pw
          </T.Column>
        </T.Header>
      </T>,
    )

    expect(container.querySelector(".data-table-cell-protected")?.getAttribute("aria-label")).toBe("숨김")
  })

  it("takes pagination button labels from labels", () => {
    const { container } = render(
      <Table
        data={ROWS}
        labels={{ paginationPrevious: "이전", paginationNext: "다음" }}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={1} pageSize={2} onChange={() => {}} />
      </Table>,
    )
    const labels = Array.from(container.querySelectorAll(".pagination-button")).map((button) =>
      button.getAttribute("aria-label"),
    )

    expect(labels).toEqual(["이전", "다음"])
  })
})

describe("U23: expand column", () => {
  it("puts the expand toggle in the column named by expandColumn", () => {
    const { container } = render(
      <Table
        data={[{ id: "A", name: "A", note: "n", children: [{ id: "A1", name: "A1", note: "m" }] }]}
        toggleField="id"
        expandColumn="note"
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
          <Table.Column field="note">note</Table.Column>
        </Table.Header>
      </Table>,
    )
    const firstRowCells = container.querySelectorAll("tbody tr")[0]!.querySelectorAll("td")

    expect(firstRowCells[0]!.querySelector(".expand-toggle-button")).toBeNull()
    expect(firstRowCells[1]!.querySelector(".expand-toggle-button")).not.toBeNull()
  })
})

describe("U24: row selection checkbox", () => {
  it("offers a built-in row-select kind", () => {
    const T = createTable<AnyRow>()
    const { container } = render(
      <T data={ROWS} getRowId={(row) => String(row.id)} rowSelectionMode="multi" enableVirtualization={false}>
        <T.Header>
          <T.Column field="select" virtual kind="row-select">
            {""}
          </T.Column>
          <T.Column field="name">name</T.Column>
        </T.Header>
      </T>,
    )
    const checkboxes = container.querySelectorAll<HTMLInputElement>("input.data-table-cell-row-select")

    fireEvent.click(checkboxes[1]!)

    expect(container.querySelectorAll("tbody tr[data-selected]")).toHaveLength(1)
    expect(container.querySelectorAll<HTMLInputElement>("input.data-table-cell-row-select")[1]!.checked).toBe(true)
  })
})

describe("U28: class hooks around the compound table", () => {
  it("applies classNames.tableRoot and classNames.pagination", () => {
    const { container } = render(
      <Table
        data={ROWS}
        classNames={{ tableRoot: "my-root", pagination: "my-pagination" }}
        enableVirtualization={false}
      >
        <Table.Header>
          <Table.Column field="name">name</Table.Column>
        </Table.Header>
        <Table.Pagination page={1} pageSize={2} onChange={() => {}} />
      </Table>,
    )

    expect(container.querySelector(".TableJSX")?.classList.contains("my-root")).toBe(true)
    expect(container.querySelector(".TablePaginationJSX")?.classList.contains("my-pagination")).toBe(true)
  })
})
