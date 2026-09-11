import type { Row } from "@tanstack/react-table"
import { createElement, Fragment, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { createCellRendererRegistry } from "@/components/ui/table/features/cell-render/registry"
import {
  collectCopyRows,
  flattenSubtreeRows,
  formatCellValue,
  reactNodeToText,
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
    index,
    original,
    getVisibleCells: () => [
      {
        column: {
          id: "name",
          columnDef: { accessorKey: "name", id: "name" },
        },
        getValue: () => original.name,
      },
      {
        column: {
          id: "qty",
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

  it("serializes drilldown objects and bubble arrays without [object Object]", () => {
    type RowData = {
      id: string
      tags: string[]
      drilldown: Array<{ text: string; img?: string }>
    }

    const data: RowData[] = [
      {
        id: "1",
        tags: ["alpha", "beta"],
        drilldown: [
          { text: "Parent", img: "https://example.com/a.png" },
          { text: "Child" },
        ],
      },
    ]

    const visibleRows = data.map((original, index) => ({
      id: String(index),
      original,
      getVisibleCells: () => [
        {
          column: {
            columnDef: { accessorKey: "tags", id: "tags" },
          },
          getValue: () => original.tags,
        },
        {
          column: {
            columnDef: { accessorKey: "drilldown", id: "drilldown" },
          },
          getValue: () => original.drilldown,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 1,
      }),
    ).toBe("alpha, beta\tParent, Child")
  })
})

describe("formatCellValue", () => {
  it("uses text/label fields for plain objects", () => {
    expect(formatCellValue({ text: "Parent", img: "x.png" })).toBe("Parent")
    expect(formatCellValue({ label: "Chip" })).toBe("Chip")
  })

  it("joins arrays into a single cell string", () => {
    expect(formatCellValue(["alpha", "beta"])).toBe("alpha, beta")
  })
})

describe("reactNodeToText", () => {
  it("joins host and fragment children", () => {
    expect(
      reactNodeToText(
        createElement(
          "div",
          null,
          createElement("span", null, "3개"),
          " ",
          createElement("span", null, "보기"),
        ),
      ),
    ).toBe("3개 보기")
  })

  it("omits native buttons and Button components", () => {
    function Button({ children }: { children?: ReactNode }) {
      return createElement("button", { type: "button" }, children)
    }
    Button.displayName = "Button"

    expect(reactNodeToText(createElement("button", { type: "button" }, "수정"))).toBe("")
    expect(reactNodeToText(createElement(Button, null, "3개 보기"))).toBe("")
  })

  it("copies image src instead of alt or filename", () => {
    expect(
      reactNodeToText(
        createElement("img", { src: "https://cdn.example/ci.png", alt: "acme-ci.png" }),
      ),
    ).toBe("https://cdn.example/ci.png")
    expect(reactNodeToText(createElement("img", { src: "ci.png", alt: "" }))).toBe("ci.png")
  })
})

describe("serializeSelectionToTSV with cellRender", () => {
  it("copies custom render text instead of the raw field value", () => {
    type RowData = { id: string; price: number; createdAt: string }

    const data: RowData[] = [
      { id: "1", price: 1234, createdAt: "2026-09-11T05:00:00.000Z" },
    ]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "price",
            columnDef: {
              accessorKey: "price",
              id: "price",
              meta: {
                cellRender: ({ value }: { value: unknown }) =>
                  `$${Number(value).toLocaleString("en-US")}`,
              },
            },
          },
          getValue: () => original.price,
        },
        {
          column: {
            id: "createdAt",
            columnDef: {
              accessorKey: "createdAt",
              id: "createdAt",
              meta: {
                cellRender: ({ value }: { value: unknown }) =>
                  createElement(
                    "span",
                    null,
                    String(value).slice(0, 10),
                    " ",
                    String(value).slice(11, 16),
                  ),
              },
            },
          },
          getValue: () => original.createdAt,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 1,
      }),
    ).toBe("$1,234\t2026-09-11 05:00")
  })

  it("copies virtual column render output using row index", () => {
    type RowData = { id: string; name: string }

    const data: RowData[] = [
      { id: "a", name: "Ada" },
      { id: "b", name: "Bob" },
    ]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "indexSeq",
            columnDef: {
              id: "indexSeq",
              meta: {
                cellRender: ({ index: rowIndex }: { index: number }) =>
                  (rowIndex + 1).toLocaleString("en-US"),
              },
            },
          },
          getValue: () => undefined,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 1,
        startCol: 0,
        endCol: 0,
      }),
    ).toBe("1\n2")
  })

  it("does not copy button cells, while keeping neighboring columns aligned", () => {
    function Button({ children }: { children?: ReactNode }) {
      return createElement("button", { type: "button" }, children)
    }
    Button.displayName = "Button"

    type RowData = { id: string; name: string; partCount: number }

    const original: RowData = { id: "1", name: "Ada", partCount: 3 }
    const visibleRows = [
      {
        id: "0",
        index: 0,
        original,
        getVisibleCells: () => [
          {
            column: {
              id: "name",
              columnDef: { accessorKey: "name", id: "name" },
            },
            getValue: () => original.name,
          },
          {
            column: {
              id: "partCount",
              columnDef: {
                accessorKey: "partCount",
                id: "partCount",
                meta: {
                  cellRender: ({ value }: { value: unknown }) =>
                    createElement(Button, null, `${Number(value)}개 보기`),
                },
              },
            },
            getValue: () => original.partCount,
          },
          {
            column: {
              id: "actions",
              columnDef: {
                id: "actions",
                meta: {
                  cellRender: () => createElement(Button, null, "수정"),
                },
              },
            },
            getValue: () => undefined,
          },
        ],
      },
    ] as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 2,
      }),
    ).toBe("Ada\t\t")
  })

  it("copies image cells from src url, not the filename field", () => {
    function CustomerCiImage() {
      return createElement("img", { src: "https://cdn.example/ci.png", alt: "" })
    }
    CustomerCiImage.displayName = "CustomerCiImage"

    type RowData = { id: string; ciFileName: string; logoUrl: string }

    const original: RowData = {
      id: "1",
      ciFileName: "acme-ci.png",
      logoUrl: "https://cdn.example/logo.png",
    }

    document.body.innerHTML =
      '<table><tbody><tr><td data-row-index="0" data-col-index="0"><img src="https://cdn.example/ci.png" alt=""></td></tr></tbody></table>'

    const visibleRows = [
      {
        id: "0",
        index: 0,
        original,
        getVisibleCells: () => [
          {
            column: {
              id: "ciFileName",
              columnDef: {
                accessorKey: "ciFileName",
                id: "ciFileName",
                meta: {
                  cellRender: () => createElement(CustomerCiImage),
                },
              },
            },
            getValue: () => original.ciFileName,
          },
          {
            column: {
              id: "logoUrl",
              columnDef: {
                accessorKey: "logoUrl",
                id: "logoUrl",
                meta: {
                  cellRender: ({ value }: { value: unknown }) =>
                    createElement("img", { src: String(value), alt: "" }),
                },
              },
            },
            getValue: () => original.logoUrl,
          },
        ],
      },
    ] as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 1,
      }),
    ).toBe("https://cdn.example/ci.png\thttps://cdn.example/logo.png")

    document.body.innerHTML = ""
  })

  it("copies nested JSX the way it appears on screen, not [object Object]", () => {
    type Equipment = { equipmentName: string; markingEquipmentIp: string }
    type RowData = { id: string; equipments: Equipment[] }

    const original: RowData = {
      id: "1",
      equipments: [
        { equipmentName: "Marking #1", markingEquipmentIp: "192.168.0.52" },
        { equipmentName: "Tray #2", markingEquipmentIp: "192.168.0.51" },
      ],
    }
    const visibleRows = [
      {
        id: "0",
        index: 0,
        original,
        getVisibleCells: () => [
          {
            column: {
              id: "equipments",
              columnDef: {
                accessorKey: "equipments",
                id: "equipments",
                meta: {
                  cellRender: ({ value }: { value: unknown }) =>
                    createElement(
                      Fragment,
                      null,
                      ...(value as Equipment[]).map((item) =>
                        createElement(
                          "span",
                          { key: item.markingEquipmentIp },
                          `${item.equipmentName} (${item.markingEquipmentIp}) `,
                        ),
                      ),
                    ),
                },
              },
            },
            getValue: () => original.equipments,
          },
        ],
      },
    ] as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      }),
    ).toBe("Marking #1 (192.168.0.52) Tray #2 (192.168.0.51)")
  })

  it("falls back to the raw value when cellRender throws", () => {
    type RowData = { id: string; name: string }

    const original: RowData = { id: "1", name: "Ada" }
    const visibleRows = [
      {
        id: "0",
        index: 0,
        original,
        getVisibleCells: () => [
          {
            column: {
              id: "name",
              columnDef: {
                accessorKey: "name",
                id: "name",
                meta: {
                  cellRender: () => {
                    throw new Error("hooks")
                  },
                },
              },
            },
            getValue: () => original.name,
          },
        ],
      },
    ] as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(visibleRows, {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      }),
    ).toBe("Ada")
  })
})

describe("serializeSelectionToTSV with a cell renderer registry", () => {
  const registry = createCellRendererRegistry()

  it("copies the masked '****' text for a protected column, not the raw secret", () => {
    type RowData = { id: string; secret: string }

    const data: RowData[] = [{ id: "1", secret: "hidden-value" }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "secret",
            columnDef: { accessorKey: "secret", id: "secret", meta: { kind: "protected" } },
          },
          getValue: () => original.secret,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry },
      ),
    ).toBe("****")
  })

  it("still copies the raw value for a protected column without a registry", () => {
    type RowData = { id: string; secret: string }

    const data: RowData[] = [{ id: "1", secret: "hidden-value" }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "secret",
            columnDef: { accessorKey: "secret", id: "secret", meta: { kind: "protected" } },
          },
          getValue: () => original.secret,
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
    ).toBe("hidden-value")
  })

  it("keeps array values ', '-joined for bubble/drilldown-style kinds", () => {
    type RowData = { id: string; tags: string[] }

    const data: RowData[] = [{ id: "1", tags: ["alpha", "beta"] }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "tags",
            columnDef: { accessorKey: "tags", id: "tags", meta: { kind: "bubble" } },
          },
          getValue: () => original.tags,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry },
      ),
    ).toBe("alpha, beta")
  })

  it("falls back to the raw value for kinds with no extractable text (boolean checkbox)", () => {
    type RowData = { id: string; active: boolean }

    const data: RowData[] = [{ id: "1", active: true }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "active",
            columnDef: { accessorKey: "active", id: "active", meta: { kind: "boolean" } },
          },
          getValue: () => original.active,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry },
      ),
    ).toBe("true")
  })

  it("resolves a custom cellRenderers kind the same way as a built-in one", () => {
    type RowData = { id: string; status: string }

    const customRegistry = createCellRendererRegistry([
      {
        kind: "status-pill",
        render: ({ value }) => `[${String(value).toUpperCase()}]`,
      },
    ])

    const data: RowData[] = [{ id: "1", status: "active" }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "status",
            columnDef: {
              accessorKey: "status",
              id: "status",
              meta: { kind: "status-pill" },
            },
          },
          getValue: () => original.status,
        },
      ],
    })) as unknown as Row<RowData>[]

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry: customRegistry },
      ),
    ).toBe("[ACTIVE]")
  })

  it("scopes the DOM image lookup to root so a same-index cell in another table isn't used", () => {
    type RowData = { id: string; image: string }

    const data: RowData[] = [{ id: "1", image: "https://a.example/table-a.png" }]
    const visibleRows = data.map((original, index) => ({
      id: String(index),
      index,
      original,
      getVisibleCells: () => [
        {
          column: {
            id: "image",
            columnDef: { accessorKey: "image", id: "image", meta: { kind: "image" } },
          },
          getValue: () => original.image,
        },
      ],
    })) as unknown as Row<RowData>[]

    document.body.innerHTML = `
      <table id="other-table"><tbody><tr>
        <td data-row-index="0" data-col-index="0"><img src="https://b.example/other-table.png" alt=""></td>
      </tr></tbody></table>
      <table id="scoped-table"><tbody><tr>
        <td data-row-index="0" data-col-index="0"><img src="https://a.example/table-a.png" alt=""></td>
      </tr></tbody></table>
    `
    const scopedRoot = document.getElementById("scoped-table")!

    expect(
      serializeSelectionToTSV(
        visibleRows,
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        "visible",
        { registry, root: scopedRoot },
      ),
    ).toBe("https://a.example/table-a.png")

    document.body.innerHTML = ""
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
