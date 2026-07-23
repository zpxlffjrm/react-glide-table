import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { useState } from "react"
import { describe, expect, it } from "vitest"

import { createTable, DataTable, Table } from "@/components/ui/Table"
import type { ColumnDef } from "@/components/ui/Table"

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
    materialName: "메인 어셈블리",
    assemblyMaterials: [
      {
        id: "child-1",
        materialCode: "PRT-1100",
        materialName: "상부 커버",
      },
      {
        id: "child-2",
        materialCode: "PRT-1200",
        materialName: "하부 베이스",
      },
    ],
  },
  {
    id: "root-2",
    materialCode: "ASM-2000",
    materialName: "서브 어셈블리",
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
    <SimpleTable data={data} getRowId={(row) => row.id} {...rest}>
      <SimpleTable.Header>
        <SimpleTable.Column field="name" sortable>
          이름
        </SimpleTable.Column>
        <SimpleTable.Column field="amount" sortable>
          수량
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
    <SimpleTable data={data} filteredCount={25} totalCount={25} getRowId={(row) => row.id}>
      <SimpleTable.Header>
        <SimpleTable.Column field="name">이름</SimpleTable.Column>
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
      getRowId={(row) => row.id}>
      <Table.Header>
        <Table.Column field="materialCode">부품 Code</Table.Column>
        <Table.Column field="materialName">부품명</Table.Column>
      </Table.Header>
    </Table>
  )
}

function EditableTableHarness() {
  const [data, setData] = useState<SimpleRow[]>([{ id: "1", name: "Alpha", amount: 10 }])

  return (
    <SimpleTable data={data} onDataChange={setData} getRowId={(row) => row.id}>
      <SimpleTable.Header>
        <SimpleTable.Column field="name" editable editType="text">
          이름
        </SimpleTable.Column>
      </SimpleTable.Header>
    </SimpleTable>
  )
}

describe("Table / createTable 동작", () => {
  it("데이터 행을 렌더한다", () => {
    const { container } = renderSimpleTable()

    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Alpha", "Bravo"])
  })

  it("정렬 헤더 클릭 시 행 순서가 바뀐다", async () => {
    const user = userEvent.setup()
    const { container } = renderSimpleTable()

    await user.click(screen.getByRole("button", { name: /이름/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Alpha", "Bravo", "Charlie"])

    await user.click(screen.getByRole("button", { name: /이름/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Bravo", "Alpha"])

    await user.click(screen.getByRole("button", { name: /이름/ }))
    expect(getBodyRowTexts(container, 0)).toEqual(["Charlie", "Alpha", "Bravo"])
  })

  it("데이터가 없으면 emptyText를 표시한다", () => {
    renderSimpleTable({ data: [], emptyText: "표시할 데이터 없음" })

    expect(screen.getByText("표시할 데이터 없음")).toBeInTheDocument()
  })

  it("행 클릭 시 다중 선택 상태가 반영된다", async () => {
    const user = userEvent.setup()

    renderSimpleTable({ rowSelectionMode: "multi" })

    const rows = screen.getAllByRole("row")
    const firstBodyRow = rows[1]

    await user.click(firstBodyRow)

    expect(screen.getByText("✓ 1개 선택됨")).toBeInTheDocument()
  })

  it("getRowCanSelect=false인 행은 선택되지 않는다", async () => {
    const user = userEvent.setup()

    renderSimpleTable({
      rowSelectionMode: "multi",
      getRowCanSelect: (row) => row.id !== "1",
    })

    const rows = screen.getAllByRole("row")

    await user.click(rows[1])

    expect(screen.queryByText(/선택됨/)).not.toBeInTheDocument()
  })

  it("페이지네이션 시 툴바에 전체 filteredCount를 표시하고 현재 페이지 행만 렌더한다", () => {
    const { container } = render(<PaginatedTableHarness />)

    expect(screen.getByText("25")).toBeInTheDocument()
    expect(screen.getByText("/ 25")).toBeInTheDocument()
    expect(getBodyRowTexts(container, 0)).toHaveLength(10)
    expect(getBodyRowTexts(container, 0)[0]).toBe("Item-01")
    expect(getBodyRowTexts(container, 0)[9]).toBe("Item-10")
  })

  it("페이지네이션 버튼으로 다음 페이지를 볼 수 있다", async () => {
    const user = userEvent.setup()
    const { container } = render(<PaginatedTableHarness />)

    await user.click(screen.getByRole("button", { name: "다음 페이지" }))

    expect(screen.getByText("2 / 3")).toBeInTheDocument()
    expect(getBodyRowTexts(container, 0)[0]).toBe("Item-11")
    expect(getBodyRowTexts(container, 0)).toHaveLength(10)
  })
})

describe("Table row-expand 동작", () => {
  it("최초 로드 후 루트 행이 자동 펼쳐지고 자식 행이 보인다", async () => {
    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()
    expect(screen.getByText("PRT-1200")).toBeInTheDocument()
  })

  it("행 접기 버튼 클릭 시 자식 행이 숨겨진다", async () => {
    const user = userEvent.setup()

    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()

    const collapseButtons = screen.getAllByRole("button", { name: "행 접기" })

    await user.click(collapseButtons[0])

    expect(screen.queryByText("PRT-1100")).not.toBeInTheDocument()
    expect(screen.queryByText("PRT-1200")).not.toBeInTheDocument()
    expect(screen.getByText("ASM-2000")).toBeInTheDocument()
  })

  it("접은 뒤 행 펼치기 버튼으로 자식 행을 다시 볼 수 있다", async () => {
    const user = userEvent.setup()

    render(<ExpandTableHarness />)

    expect(await screen.findByText("PRT-1100")).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "행 접기" })[0])
    expect(screen.queryByText("PRT-1100")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "행 펼치기" }))

    expect(screen.getByText("PRT-1100")).toBeInTheDocument()
    expect(screen.getByText("PRT-1200")).toBeInTheDocument()
  })
})

describe("Table 셀 편집 동작", () => {
  it("editable 컬럼 더블클릭 후 Enter로 값을 수정한다", async () => {
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
})

describe("DataTable 직접 사용 동작", () => {
  it("ColumnDef 배열로 데이터를 렌더한다", () => {
    const columns: ColumnDef<SimpleRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "이름",
      },
      {
        id: "amount",
        accessorKey: "amount",
        header: "수량",
      },
    ]

    render(<DataTable data={SIMPLE_ROWS} columns={columns} getRowId={(row) => row.id} />)

    const table = screen.getByRole("table")

    expect(within(table).getByText("Charlie")).toBeInTheDocument()
    expect(within(table).getByText("Alpha")).toBeInTheDocument()
    expect(within(table).getByText("Bravo")).toBeInTheDocument()
  })

  it("filteredCount와 totalCount를 툴바에 표시한다", () => {
    const columns: ColumnDef<SimpleRow, unknown>[] = [
      {
        id: "name",
        accessorKey: "name",
        header: "이름",
      },
    ]

    render(
      <DataTable
        data={SIMPLE_ROWS.slice(0, 2)}
        columns={columns}
        filteredCount={2}
        totalCount={3}
        getRowId={(row) => row.id}
      />,
    )

    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("/ 3")).toBeInTheDocument()
  })
})
