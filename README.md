# react-glide-table

Headless React table built on [@tanstack/react-table](https://tanstack.com/table) and [@tanstack/react-virtual](https://tanstack.com/virtual).

Primary DX is a **compound API** (`createTable` / `Table.Column`) with an unstyled semantic HTML shell. Customize with `className` hooks, `slots`, and column `render`. `useGlideTable` remains the lower-level escape hatch when you need full control of markup.

The package ships **no CSS** — class names like `DataTableJSX` / `data-table` are opt-in hooks for your own styles.

## Installation

```bash
npm install react-glide-table
# or
pnpm add react-glide-table
```

Peer dependencies: `react` and `react-dom` (`^18` or `^19`).

## Quick start (compound)

```tsx
import { createTable } from "react-glide-table"
import { useState } from "react"

type Product = { id: string; name: string; qty: number }

const ProductTable = createTable<Product>()

export function Products({ data }: { data: Product[] }) {
  const [page, setPage] = useState(1)

  return (
    <ProductTable
      data={data}
      getRowId={(row) => row.id}
      className="my-table"
      // Optional: replace Toolbar / Row / Pending / Empty
      // slots={{ Toolbar: MyToolbar, Row: MyRow, Empty: MyEmpty }}
    >
      <ProductTable.Header>
        <ProductTable.Column field="name">Name</ProductTable.Column>
        <ProductTable.Column field="qty" editable>
          Qty
        </ProductTable.Column>
      </ProductTable.Header>
      <ProductTable.Pagination page={page} pageSize={10} onChange={setPage} />
    </ProductTable>
  )
}
```

### Customization surface

| Slot / prop | Role |
| --- | --- |
| `slots.Toolbar` | Top summary / actions region |
| `slots.Row` | Full row replacement (cells, selection, edit UI) |
| `slots.Pending` / `slots.Empty` | Loading and empty states |
| `className` / column `className` / `headerClassName` | Class hooks (style yourself) |
| `labels` / `summary` / `toolbar` | Copy and slot nodes |
| `Column.render` | Cell content custom render |

Row-level UI → `slots.Row`. Cell content → `Column.render`. Header/Cell are not separate slots.

## Escape hatch (`useGlideTable`)

```tsx
import { flexRender } from "@tanstack/react-table"
import { useGlideTable } from "react-glide-table"
import type { ColumnDef } from "react-glide-table"

type Product = { id: string; name: string; qty: number }

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "qty", header: "Qty" },
]

export function ProductTable({ data }: { data: Product[] }) {
  const { table, rows, scrollRef } = useGlideTable({
    data,
    columns,
    getRowId: (row) => row.id,
    rowSelectionMode: "multi",
  })

  return (
    <div ref={scrollRef}>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

Wire `rowContextValue` into your own row/cell components for edit, selection, expand, and row-span behavior.

## Public API

| Export | Role |
| --- | --- |
| `createTable` / `Table` | Compound column DSL (`Header` / `Column` / `Body` / `Pagination`) |
| `DataTable` | Unstyled default renderer (semantic HTML + slots/props) |
| `useGlideTable` | Headless engine escape hatch |
| `useCellEdit` / `useCellSelection` / `useConvertTreeData` | Feature hooks |
| `applyCellEdit`, `applyFillData`, `buildColumnRowSpanMap`, … | Pure helpers |
| `DEFAULT_DATA_TABLE_LABELS` / `resolveDataTableLabels` | Optional English UI copy helpers |
| Tree field defaults | `id` / `parentId` / `children` / `qty` |

Related types: `TableProps`, `TableColumnProps`, `DataTableProps`, `DataTableSlots`, `TableCompoundComponent`, `ColumnDef`, …

## Notable constraints

- **Row span + virtualization**: when `enableRowSpan` is on, virtualization is forced off (HTML `<table>` + `rowspan` cannot safely share a virtual window).
- **No shipped CSS**: the default renderer emits class hooks only. Bring your own styles (see playground for a CSS-skinned example).

## Local playground

```bash
pnpm install
pnpm dev
```

The playground uses `createTable` with a local CSS skin (`src/styles/index.css`) to exercise the compound API and headless core.

## License

MIT
