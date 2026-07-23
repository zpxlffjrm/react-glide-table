# react-glide-table

Headless React table primitives built on [@tanstack/react-table](https://tanstack.com/table) and [@tanstack/react-virtual](https://tanstack.com/virtual).

You own the markup and styles. This package exposes state, handlers, and pure helpers for selection, editing, fill, row spanning, tree expand, and virtualization.

## Installation

```bash
npm install react-glide-table
# or
pnpm add react-glide-table
```

Peer dependencies: `react` and `react-dom` (`^18` or `^19`).

## Quick start

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

Wire `rowContextValue` into your own row/cell components for edit, selection, expand, and row-span behavior. See the `playground/` app for a full reference UI built on top of `useGlideTable`.

## Public API

| Export | Role |
| --- | --- |
| `useGlideTable` | Headless table engine (TanStack instance, virtualization, selection/edit/expand state) |
| `useCellEdit` / `useCellSelection` / `useConvertTreeData` | Feature hooks |
| `applyCellEdit`, `applyFillData`, `buildColumnRowSpanMap`, … | Pure helpers |
| `DEFAULT_DATA_TABLE_LABELS` / `resolveDataTableLabels` | Optional English UI copy helpers |
| Tree field defaults | `id` / `parentId` / `children` / `qty` |

## Notable constraints

- **Row span + virtualization**: when `enableRowSpan` is on, virtualization is forced off (HTML `<table>` + `rowspan` cannot safely share a virtual window).
- **No shipped CSS / opinionated components**: bring your own DOM. The published package does not export the reference UI components under `src/components/ui` (but some feature helpers are re-exported and shipped).

## Local playground

```bash
pnpm install
pnpm dev
```

The playground imports a reference `createTable` / `DataTable` UI from the repo source to exercise the headless core.

## License

MIT
