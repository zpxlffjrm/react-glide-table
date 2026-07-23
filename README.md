# react-glide-table

A high-performance React data table built on [@tanstack/react-table](https://tanstack.com/table) and [@tanstack/react-virtual](https://tanstack.com/virtual).

It ships a declarative compound `Table` API and a lower-level `DataTable` for column-def driven usage, with row virtualization, selection, inline editing, cell fill, row spanning, tree expand, sorting, and pagination.

## Inspired by Glide Data Grid

[Glide Data Grid](https://github.com/glideapps/glide-data-grid) (`@glideapps/glide-data-grid`) is a Canvas-based spreadsheet-style grid. This library is **not** a wrapper around it — it reimplements the basic interaction patterns on top of a normal HTML `<table>` + TanStack stack, so you keep DOM accessibility, CSS styling, and a React-friendly column API.

### Glide-inspired capabilities layered in

| Capability | What Glide provides | How `react-glide-table` adopts it |
| --- | --- | --- |
| **Cell range selection** | Drag / keyboard ranges (`gridSelection`, `rangeSelect`) | Click a cell, drag across cells to select a rectangular range |
| **Fill handle** | `fillHandle` — copy values into adjacent cells | Selection corner handle fills neighboring cells; commits via `onDataChange` |
| **Inline editing** | Built-in double-click edit with commit / cancel | Double-click editable cells; **Enter** commits, **Escape** cancels (`editable` / `editType`) |
| **Row selection** | `rowSelect`: none / single / multi | `rowSelectionMode`: `"none"` \| `"single"` \| `"multi"` (controlled or uncontrolled) |
| **Large-list scrolling** | Canvas lazy paint for millions of rows | DOM **row virtualization** via `@tanstack/react-virtual` (spacer rows inside `<tbody>`) |
| **Merged cells** | Span / merge support | `enableRowSpan` + column `rowSpan` / `rowSpanKey` for consecutive vertical merges |

### Intentionally different from Glide

- **Rendering**: HTML table DOM instead of HTML5 Canvas — easier theming, custom React cell renderers, and standard CSS.
- **Column model**: TanStack `ColumnDef` or declarative `Table.Column` / `createTable`, not Glide’s canvas cell draw API.
- **Extra app-table features** (beyond the Glide interaction set): compound components, sorting, controlled pagination, toolbar slots, and tree / expandable rows.

### Not ported (yet)

These Glide features are **not** included: Canvas custom cell drawing, frozen/pinned columns, column reorder / resize as first-class APIs, multi-rect / column-range selection stacks, markdown / bubble / image / sparkline cell types, and million-row Canvas-level scale. Use this library when you want Glide-like **edit / select / fill** UX on a conventional React table.

## Features

- **Declarative columns** via `Table` / `createTable` compound components
- **Low-level API** via `DataTable` + TanStack `ColumnDef`
- **Row virtualization** (HTML table + spacer rows; disabled automatically when row spanning is on)
- **Row selection** — none / single / multi *(Glide-inspired)*
- **Inline cell editing** — double-click to edit (`text` | `number`) *(Glide-inspired)*
- **Cell range selection & fill handle** — drag to select, fill adjacent cells (Excel-like) *(Glide-inspired)*
- **Row spanning** — merge consecutive cells by key *(Glide-inspired)*
- **Tree / expandable rows** — nested or flat parent–child data
- **Sorting** — clickable headers through `Table.Column sortable`
- **Pagination** — controlled `Table.Pagination`
- **Toolbar slots** — counts, summary, custom actions

## Requirements

| Package | Version | Notes |
| --- | --- | --- |
| `react` | `^18` or `^19` | Peer dependency — provided by your app |
| `react-dom` | `^18` or `^19` | Peer dependency — provided by your app |

`@tanstack/react-table` and `@tanstack/react-virtual` are installed automatically with this package.

## Installation

```bash
npm install react-glide-table
# or
pnpm add react-glide-table
# or
yarn add react-glide-table
```

Import styles once at your app entry (or layout):

```ts
import "react-glide-table/style.css"
```

## Quick start

### Recommended: typed compound table with `createTable`

`createTable<T>()` returns a typed compound component (`Header`, `Column`, `Body`, `Pagination`) so `field` and `render` stay type-safe.

```tsx
import { useState } from "react"
import { createTable } from "react-glide-table"
import "react-glide-table/style.css"

type Product = {
  id: string
  name: string
  qty: number
  price: number
}

const ProductTable = createTable<Product>()

const INITIAL: Product[] = [
  { id: "1", name: "Widget", qty: 10, price: 1200 },
  { id: "2", name: "Gadget", qty: 4, price: 3400 },
]

export function ProductList() {
  const [data, setData] = useState(INITIAL)

  return (
    <ProductTable
      data={data}
      getRowId={(row) => row.id}
      onDataChange={setData}
      rowSelectionMode="multi"
      filteredCount={data.length}
      totalCount={data.length}
      toolbar={<button type="button">Export</button>}
    >
      <ProductTable.Header>
        <ProductTable.Column field="name" sortable editable>
          Name
        </ProductTable.Column>
        <ProductTable.Column field="qty" sortable align="right" editable editType="number">
          Qty
        </ProductTable.Column>
        <ProductTable.Column
          field="price"
          align="right"
          render={(value) => `$${Number(value).toLocaleString()}`}
        >
          Price
        </ProductTable.Column>
      </ProductTable.Header>
    </ProductTable>
  )
}
```

### Alternative: untyped `Table`

```tsx
import { Table } from "react-glide-table"

<Table data={rows} getRowId={(row) => String(row.id)}>
  <Table.Header>
    <Table.Column field="name">Name</Table.Column>
    <Table.Column field="amount" sortable>
      Amount
    </Table.Column>
  </Table.Header>
</Table>
```

### Low-level: `DataTable` + `ColumnDef`

Use this when you already build TanStack column definitions yourself.

```tsx
import { DataTable, type ColumnDef } from "react-glide-table"

type Row = { id: string; name: string; amount: number }

const columns: ColumnDef<Row, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  {
    id: "amount",
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right", editable: true, editType: "number" },
  },
]

<DataTable data={rows} columns={columns} getRowId={(row) => row.id} />
```

---

## APIs

### `createTable<T>()` / `Table`

Compound wrapper around `DataTable`. It:

1. Reads `Table.Column` children inside `Table.Header` and builds column defs
2. Applies client-side sorting when a column is `sortable`
3. Applies client-side pagination when `Table.Pagination` is present
4. Forwards the rest of the props to `DataTable`

| Subcomponent | Role |
| --- | --- |
| `Table.Header` | Container for column definitions |
| `Table.Column` | Declares a column (renders nothing to the DOM) |
| `Table.Body` | Reserved slot (optional; columns come from `Header`) |
| `Table.Pagination` | Controlled pager under the table |

> Always put at least one `Table.Column` inside `Table.Header`.

---

### `Table.Column` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `field` | `string` | — | Column id / accessor key |
| `virtual` | `boolean` | `false` | If `true`, no `accessorKey` (for checkbox / index columns) |
| `children` | `ReactNode` | — | Header label |
| `sortable` | `boolean` | `false` | Clickable sort header (asc → desc → clear) |
| `width` | `number` | `150` | Column width (px) |
| `align` | `"left" \| "center" \| "right"` | — | Cell / header alignment |
| `rowSpan` | `boolean` | — | Enable vertical merge for this column |
| `rowSpanKey` | `string` | column `field` | Field used to decide merge groups |
| `editable` | `boolean` | — | Double-click to edit |
| `editType` | `"text" \| "number"` | `"text"` | Input type while editing |
| `className` | `string` | — | Body cell class |
| `headerClassName` | `string` | — | Header cell class |
| `render` | `(value, row, index) => ReactNode` | — | Custom cell renderer |

---

### Shared table props (`Table` / `DataTable`)

All of these (except `columns` / `children`) work on both APIs.

#### Data & identity

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | — | Row data |
| `getRowId` | `(row, index) => string` | index as string | Stable row id (recommended) |
| `columns` | `ColumnDef[]` | — | **`DataTable` only** |
| `children` | `ReactNode` | — | **`Table` only** — Header / Pagination |
| `onDataChange` | `(data: T[]) => void` | — | Called after cell edit or fill |

#### Loading & empty

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `isPending` | `boolean` | `false` | Shows a loading placeholder instead of the table |
| `emptyText` | `string` | `"데이터가 없습니다."` | Message when there are no rows |
| `className` | `string` | — | Root class name |

#### Toolbar

| Prop | Type | Description |
| --- | --- | --- |
| `totalCount` | `number` | Total count before filter (shown as `/ N`) |
| `filteredCount` | `number` | Current visible count (defaults to current data length) |
| `summary` | `ReactNode` | Left-side summary slot |
| `toolbar` | `ReactNode` | Right-side actions (export, delete, …) |
| `selectionLabel` | `(count) => ReactNode` | Custom selection label (default: `"N개 선택됨"`) |

#### Row selection

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rowSelectionMode` | `"none" \| "single" \| "multi"` | `"none"` | Selection mode |
| `rowSelection` | `RowSelectionState` | — | Controlled selection map (`{ [rowId]: true }`) |
| `onRowSelectionChange` | `(updater) => void` | — | Controlled selection updater |
| `getRowCanSelect` | `(row, index) => boolean` | all selectable | Return `false` to disable selection for a row |
| `selectOnRowClick` | `boolean` | `true` | If `false`, only checkbox / explicit controls select |
| `preserveRowSelection` | `boolean` | `false` | If `true`, clicking a selected row does not deselect it |
| `onRowClick` | `(row, index) => void` | — | Extra row click handler |
| `getRowClassName` | `(row, index) => string \| undefined` | — | Per-row class names |

```tsx
const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

<ProductTable
  data={data}
  getRowId={(row) => row.id}
  rowSelectionMode="multi"
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  getRowCanSelect={(row) => row.qty > 0}
  selectOnRowClick={false}
/>
```

#### Row spanning

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `enableRowSpan` | `boolean` | `false` | Turn on vertical cell merge |

Mark columns with `rowSpan` (and optionally `rowSpanKey`):

```tsx
<ProductTable data={rows} enableRowSpan getRowId={(r) => r.id}>
  <ProductTable.Header>
    <ProductTable.Column field="group" rowSpan rowSpanKey="groupId">
      Group
    </ProductTable.Column>
    <ProductTable.Column field="name">Name</ProductTable.Column>
  </ProductTable.Header>
</ProductTable>
```

> When `enableRowSpan` is `true`, virtualization is **forced off** so merged cells stay correct.

#### Tree / expandable rows

Enable expand UI by setting `toggleField`. Nested children are read from `flattenField` (default `assemblyMaterials`). Flat parent links use `childField` (default `assemblyCode`).

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `toggleField` | `string` | — | Key used as expand id (e.g. `materialCode`). Presence enables tree mode |
| `childField` | `string` | `"assemblyCode"` | Parent reference field for flat trees |
| `flattenField` | `string` | `"assemblyMaterials"` | Nested children array field |
| `expandedRows` | `Set<string>` | — | Controlled expanded keys |
| `onExpandedRowsChange` | `(next: Set<string>) => void` | — | Controlled expand updater |
| `preventExpand` | `boolean` | `false` | Always show children; hide toggle |

```tsx
type BomRow = {
  id: string
  materialCode: string
  materialName: string
  assemblyMaterials?: BomRow[]
}

const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())

<Table
  data={bom}
  toggleField="materialCode"
  flattenField="assemblyMaterials"
  expandedRows={expandedRows}
  onExpandedRowsChange={setExpandedRows}
  getRowId={(row) => row.id}
>
  <Table.Header>
    <Table.Column field="materialCode">Code</Table.Column>
    <Table.Column field="materialName">Name</Table.Column>
  </Table.Header>
</Table>
```

On first load, root rows with children are expanded by default.

#### Virtualization

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `enableVirtualization` | `boolean` | `true` | Virtualize body rows for large lists |
| `estimateRowHeight` | `number` | `44` | Estimated row height (px); measured and corrected at runtime |
| `virtualOverscan` | `number` | `8` | Extra rows rendered above/below the viewport |

```tsx
<ProductTable
  data={largeDataset}
  enableVirtualization
  estimateRowHeight={44}
  virtualOverscan={12}
  getRowId={(row) => row.id}
>
  ...
</ProductTable>
```

---

## Sorting

Set `sortable` on a column. Click cycle: **ascending → descending → unsorted**.

Sorting is applied client-side inside `Table` / `createTable` before pagination.

```tsx
<ProductTable.Column field="name" sortable>
  Name
</ProductTable.Column>
```

---

## Pagination

`Table.Pagination` is **controlled**. Pass `page`, `onChange`, and usually `pageSize` / `totalCount`.

The table slices `data` client-side to the current page. The toolbar still uses `filteredCount` / `totalCount` for the full dataset size.

```tsx
const [page, setPage] = useState(1)

<ProductTable
  data={allRows}
  filteredCount={allRows.length}
  totalCount={allRows.length}
  getRowId={(row) => row.id}
>
  <ProductTable.Header>
    <ProductTable.Column field="name">Name</ProductTable.Column>
  </ProductTable.Header>
  <ProductTable.Pagination
    page={page}
    pageSize={10}
    totalCount={allRows.length}
    onChange={setPage}
  />
</ProductTable>
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number` | — | Current page (1-based) |
| `pageSize` | `number` | `10` | Rows per page |
| `totalCount` | `number` | `0` | Total items for page math |
| `onChange` | `(page: number) => void` | — | Page change handler |
| `className` | `string` | — | Wrapper class |

For server-side pagination, pass only the current page’s `data` and set `totalCount` / `filteredCount` from the server; keep `page` / `onChange` in sync with your fetch.

---

## Inline editing

1. Mark a column with `editable` (and optional `editType`)
2. Provide `onDataChange` so edits update your state
3. **Double-click** a cell to edit
4. Press **Enter** to commit, **Escape** to cancel

```tsx
const [data, setData] = useState(rows)

<ProductTable data={data} onDataChange={setData} getRowId={(r) => r.id}>
  <ProductTable.Header>
    <ProductTable.Column field="name" editable editType="text">
      Name
    </ProductTable.Column>
    <ProductTable.Column field="qty" editable editType="number">
      Qty
    </ProductTable.Column>
  </ProductTable.Header>
</ProductTable>
```

With `DataTable`, set the same flags on `columnDef.meta`:

```ts
meta: { editable: true, editType: "number" }
```

---

## Cell selection & fill

When `onDataChange` is provided, users can:

1. Click a cell to select it
2. Drag across cells to select a range
3. Use the fill handle on the selection to copy values into adjacent cells

This mirrors spreadsheet-style fill behavior. Keep `data` controlled via `onDataChange`.

---

## Column meta (`DataTable` / TanStack)

When using `DataTable` directly, configure columns through TanStack `ColumnDef` and `meta`:

```ts
import type { ColumnDef } from "react-glide-table"

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    size: 200,
    meta: {
      align: "left",
      editable: true,
      editType: "text",
      rowSpan: false,
      className: "my-cell",
      headerClassName: "my-header",
    },
  },
]
```

| `meta` key | Type | Description |
| --- | --- | --- |
| `align` | `"left" \| "center" \| "right"` | Alignment |
| `className` | `string` | Body cell class |
| `headerClassName` | `string` | Header class |
| `editable` | `boolean` | Inline edit |
| `editType` | `"text" \| "number"` | Edit input type |
| `rowSpan` | `boolean` | Vertical merge |
| `rowSpanKey` | `string` | Merge key field |

---

## Exports

```ts
import {
  createTable,
  Table,
  DataTable,
  type TableCompoundComponent,
  type TableProps,
  type TableColumnProps,
  type DataTableProps,
  type ColumnDef,
  type RowSelectionState,
  type RowSelectionMode,
} from "react-glide-table"

import "react-glide-table/style.css"
```

---

## Tips

1. **Always pass `getRowId`** for stable selection, expand, and edit behavior when rows reorder or paginate.
2. Prefer **`createTable<YourRowType>()`** for end-to-end TypeScript safety.
3. Import **`react-glide-table/style.css`** or the table will be unstyled.
4. Prefer **virtualization on** for large lists; turn **`enableRowSpan` off** if you need virtualization.
5. Keep **`data` immutable** when handling `onDataChange` (replace the array / row objects).
6. For checkbox-only selection, set **`selectOnRowClick={false}`** and render a virtual checkbox column with your own UI if needed.

---

## Development

```bash
pnpm install
pnpm build
```

Build output:

- `dist/index.js` / `dist/index.cjs` — ESM / CJS bundles
- `dist/index.d.ts` — TypeScript declarations
- `dist/style.css` — bundled styles (`react-glide-table/style.css`)

---

## License

Check the repository for license information.
