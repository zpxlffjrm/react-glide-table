import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { createTable, DataTable, Table } from "@/index"
import type { ColumnDef } from "@/index"

type SimpleRow = {
  id: string
  name: string
  amount: number
}

type TreeRow = {
  id: string
  materialCode: string
  materialName: string
  assemblyMaterials?: TreeRow[]
}

const SimpleTable = createTable<SimpleRow>()

const SIMPLE_ROWS: SimpleRow[] = [
  { id: "1", name: "Charlie", amount: 30 },
  { id: "2", name: "Alpha", amount: 10 },
  { id: "3", name: "Bravo", amount: 20 },
]

const TREE_ROWS: TreeRow[] = [
  {
    id: "root-1",
    materialCode: "ASM-1000",
    materialName: "Main assembly",
    assemblyMaterials: [
      {
        id: "child-1",
        materialCode: "PRT-1100",
        materialName: "Upper cover",
      },
      {
        id: "child-2",
        materialCode: "PRT-1200",
        materialName: "Lower base",
      },
    ],
  },
  {
    id: "root-2",
    materialCode: "ASM-2000",
    materialName: "Sub assembly",
  },
]

function getBodyRowTexts(container: HTMLElement, columnIndex = 0) {
  const tbody = container.querySelector("tbody")

  if (!tbody) return []

  return Array.from(tbody.querySelectorAll("tr")).map((row) => {
    const cell = row.querySelectorAll("td")[columnIndex]

    return cell?.textContent?.trim() ?? ""
  })
}

function renderSimpleTable(
  props: Partial<ComponentProps<typeof SimpleTable>> & { data?: SimpleRow[] } = {},
) {
  const { data = SIMPLE_ROWS, ...rest } = props

  return render(
    <SimpleTable
      data={data}
      getRowId={(row) => row.id}
      enableVirtualization={false}
      {...rest}
    >
      <SimpleTable.Header>
        <SimpleTable.Column field="name" sortable>
          Name
        </SimpleTable.Column>
        <SimpleTable.Column field="amount" sortable>
          Qty
        </SimpleTable.Column>
      </SimpleTable.Header>
    </SimpleTable>,
  )
}

function PaginatedTableHarness({
  pageSize = 10,
  initialPage = 1,
}: {
  pageSize?: number
  initialPage?: number
}) {
  const [page, setPage] = useState(initialPage)
  const data = Array.from({ length: 25 }, (_, index) => ({
    id: String(index + 1),
    name: `Item-${String(index + 1).padStart(2, "0")}`,
    amount: index + 1,
  }))

  return (
    <SimpleTable
      data={data}
      filteredCount={25}
      totalCount={25}
      getRowId={(row) => row.id}
      enableVirtualization={false}
    >
      <SimpleTable.Header>
        <SimpleTable.Column field="name">Name</SimpleTable.Column>
      </SimpleTable.Header>
      <SimpleTable.Pagination page={page} pageSize={pageSize} totalCount={25} onChange={setPage} />
    </SimpleTable>
  )
}

function ExpandTableHarness() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())
  const [data] = useState(TREE_ROWS)

  return (
    <Table
      data={data}
      toggleField="materialCode"
      childField="assemblyCode"
      flattenField="assemblyMaterials"
      expandedRows={expandedRows}
      onExpandedRowsChange={setExpandedRows}
      getRowId={(row) => row.id}
      enableVirtualization={false}
    >
      <Table.Header>
        <Table.Column field="materialCode">Part code</Table.Column>
        <Table.Column field="materialName">Part name</Table.Column>
      </Table.Header>
    </Table>
  )
}

function EditableTableHarness() {
  const [data, setData] = useState<SimpleRow[]>([{ id: "1", name: "Alpha", amount: 10 }])

  return (
    <SimpleTable
      data={data}
      onDataChange={setData}
      getRowId={(row) => row.id}
      enableVirtualization={false}
    >
      <SimpleTable.Header>
        <SimpleTable.Column field="name" editable editType="text">
          Name
        </SimpleTable.Column>
      </SimpleTable.Header>
    </SimpleTable>
  )
}

function CustomCellInputHarness() {
  const [data] = useState<SimpleRow[]>([{ id: "1", name: "Alpha", amount: 10 }])

  const columns: ColumnDef<SimpleRow, unknown>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: "Name",
      cell: ({ row, getValue }) => (
        <input
          aria-label={`name-inline-input-${row.id}`}
          defaultValue={String(getValue<string>() ?? "")}
        />
      ),
    },
  ]

  return (
    <DataTable
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      enableVirtualization={false}
    />
  )
}

describe("Table / createTable behavior", () => {
  it("renders data rows", () => {
    const { container } = renderSimpleTable()

    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Alpha", "Bravo"])
  })

  it("changes row order when a sortable header is clicked", async () => {
    const user = userEvent.setup()
    const { container } = renderSimpleTable()

    await user.click(screen.getByRole("button", { name: /Name/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Alpha", "Bravo", "Charlie"])

    await user.click(screen.getByRole("button", { name: /Name/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Bravo", "Alpha"])

    await user.click(screen.getByRole("button", { name: /Name/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Alpha", "Bravo"])
  })

  it("shows emptyText when there is no data", () => {
    renderSimpleTable({ data: [], emptyText: "No data to display" })

    expect(screen.getByText("No data to display")).toBeInTheDocument()
  })

  it("reflects multi-select state when a row is clicked", async () => {
    const user = userEvent.setup()

    renderSimpleTable({ rowSelectionMode: "multi" })

    const rows = screen.getAllByRole("row")
    const firstBodyRow = rows[1]

    await user.click(firstBodyRow)

    expect(screen.getByText("✓ 1 selected")).toBeInTheDocument()
  })

  it("does not select a row when getRowCanSelect returns false", async () => {
    const user = userEvent.setup()

    renderSimpleTable({
      rowSelectionMode: "multi",
      getRowCanSelect: (row) => row.id !== "1",
    })

    const rows = screen.getAllByRole("row")

    await user.click(rows[1])

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  })

  it("shows full filteredCount in the toolbar and only renders the current page rows", () => {
    const { container } = render(<PaginatedTableHarness />)

    expect(screen.getByText("25")).toBeInTheDocument()
    expect(screen.getByText("/ 25")).toBeInTheDocument()
    expect(getBodyRowTexts(container, 0)).toHaveLength(10)
    expect(getBodyRowTexts(container, 0)[0]).toBe("Item-01")
    expect(getBodyRowTexts(container, 0)[9]).toBe("Item-10")
  })

  it("navigates to the next page via the pagination button", async () => {
    const user = userEvent.setup()
    const { container } = render(<PaginatedTableHarness />)

    await user.click(screen.getByRole("button", { name: "Next page" }))

    expect(screen.getByText("2 / 3")).toBeInTheDocument()
    expect(getBodyRowTexts(container, 0)[0]).toBe("Item-11")
    expect(getBodyRowTexts(container, 0)).toHaveLength(10)
  })
})

describe("Table row-expand behavior", () => {
  it("auto-expands root rows after load and shows child rows", async () => {
    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()
    expect(screen.getByText("PRT-1200")).toBeInTheDocument()
  })

  it("hides child rows when the collapse button is clicked", async () => {
    const user = userEvent.setup()

    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()

    const collapseButtons = screen.getAllByRole("button", { name: "Collapse row" })

    await user.click(collapseButtons[0])

    expect(screen.queryByText("PRT-1100")).not.toBeInTheDocument()
    expect(screen.queryByText("PRT-1200")).not.toBeInTheDocument()
    expect(screen.getByText("ASM-2000")).toBeInTheDocument()
  })

  it("shows child rows again after collapse via the expand button", async () => {
    const user = userEvent.setup()

    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "Collapse row" })[0])
    expect(screen.queryByText("PRT-1100")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Expand row" }))

    expect(screen.getByText("PRT-1100")).toBeInTheDocument()
    expect(screen.getByText("PRT-1200")).toBeInTheDocument()
  })
})

describe("Table cell-edit behavior", () => {
  it("updates a value after double-clicking an editable column and pressing Enter", async () => {
    const user = userEvent.setup()

    render(<EditableTableHarness />)

    const cell = screen.getByText("Alpha")

    await user.dblClick(cell)

    const input = screen.getByDisplayValue("Alpha")

    await user.clear(input)
    await user.type(input, "Updated")
    await user.keyboard("{Enter}")

    expect(screen.getByText("Updated")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("Updated")).not.toBeInTheDocument()
  })

  it("applies editInputProps on an editable column input", async () => {
    const user = userEvent.setup()

    render(
      <SimpleTable
        data={[{ id: "1", name: "", amount: 10 }]}
        onDataChange={() => undefined}
        getRowId={(row) => row.id}
        enableVirtualization={false}
      >
        <SimpleTable.Header>
          <SimpleTable.Column
            field="name"
            editable
            editType="text"
            editInputProps={{
              placeholder: "이름 입력",
              "aria-label": "name-input",
              maxLength: 10,
            }}
          >
            Name
          </SimpleTable.Column>
        </SimpleTable.Header>
      </SimpleTable>,
    )

    const cell = screen.getByRole("cell")
    await user.dblClick(cell)

    const input = screen.getByPlaceholderText("이름 입력")
    expect(input).toBeInTheDocument()
    expect(screen.getByLabelText("name-input")).toBeInTheDocument()
    expect(input).toHaveAttribute("maxlength", "10")
  })
})

describe("DataTable direct usage behavior", () => {
  it("renders data from a ColumnDef array", () => {
    const columns: ColumnDef<SimpleRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "Qty",
      },
    ]

    render(
      <DataTable
        data={SIMPLE_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        enableVirtualization={false}
      />,
    )

    const table = screen.getByRole("table")

    expect(within(table).getByText("Charlie")).toBeInTheDocument()
    expect(within(table).getByText("Alpha")).toBeInTheDocument()
    expect(within(table).getByText("Bravo")).toBeInTheDocument()
  })

  it("shows filteredCount and totalCount in the toolbar", () => {
    const columns: ColumnDef<SimpleRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
      },
    ]

    render(
      <DataTable
        data={SIMPLE_ROWS.slice(0, 2)}
        columns={columns}
        filteredCount={2}
        totalCount={3}
        getRowId={(row) => row.id}
        enableVirtualization={false}
      />,
    )

    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("/ 3")).toBeInTheDocument()
  })

  it("allows typing in a custom cell input with cell selection enabled", async () => {
    const user = userEvent.setup()

    render(<CustomCellInputHarness />)

    await user.click(screen.getByLabelText("name-inline-input-1"))
    await user.type(screen.getByLabelText("name-inline-input-1"), "Updated")

    expect(screen.getByLabelText("name-inline-input-1")).toHaveValue("AlphaUpdated")
  })

  it("exposes cell drag-selection state via row.getIsCellDragSelected", () => {
    const columns: ColumnDef<SimpleRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <span data-testid={`name-cell-${row.id}`}>
            {String(getValue<string>() ?? "")}:
            {row.getIsCellDragSelected?.("name") ? "selected" : "idle"}
          </span>
        ),
      },
    ]

    const { container } = render(
      <DataTable
        data={SIMPLE_ROWS}
        columns={columns}
        getRowId={(row) => row.id}
        enableVirtualization={false}
      />,
    )

    expect(screen.getByTestId("name-cell-1")).toHaveTextContent("Charlie:idle")

    const firstCell = container.querySelector("tbody tr td")
    expect(firstCell).not.toBeNull()
    if (!firstCell) return

    fireEvent.mouseDown(firstCell, { clientY: 4 })
    fireEvent.mouseUp(window)

    expect(screen.getByTestId("name-cell-1")).toHaveTextContent("Charlie:selected")
  })

  it("reports getIsCellDragSelected for covered rows inside a row-span merge", () => {
    type MergeRow = { id: string; region: string; regionId: string; name: string }

    const mergeRows: MergeRow[] = [
      { id: "1", region: "APAC", regionId: "r-apac", name: "One" },
      { id: "2", region: "APAC", regionId: "r-apac", name: "Two" },
      { id: "3", region: "EMEA", regionId: "r-emea", name: "Three" },
    ]

    const columns: ColumnDef<MergeRow, unknown>[] = [
      {
        id: "region",
        accessorKey: "region",
        header: "Region",
        meta: { rowSpan: true, rowSpanKey: "regionId" },
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        cell: ({ row, getValue }) => (
          <span data-testid={`name-cell-${row.id}`}>
            {String(getValue<string>() ?? "")}:
            {row.getIsCellDragSelected?.("region") ? "region-selected" : "region-idle"}
          </span>
        ),
      },
    ]

    const { container } = render(
      <DataTable
        data={mergeRows}
        columns={columns}
        getRowId={(row) => row.id}
        enableRowSpan
        enableVirtualization={false}
      />,
    )

    const regionOrigin = container.querySelector("tbody tr td")
    expect(regionOrigin).not.toBeNull()
    if (!regionOrigin) return

    fireEvent.mouseDown(regionOrigin, { clientY: 4 })
    fireEvent.mouseUp(window)

    // Covered merge rows still render sibling columns; query region via startRow.
    expect(screen.getByTestId("name-cell-1")).toHaveTextContent("One:region-selected")
    expect(screen.getByTestId("name-cell-2")).toHaveTextContent("Two:region-selected")
    expect(screen.getByTestId("name-cell-3")).toHaveTextContent("Three:region-idle")
  })
})
