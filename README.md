# react-glide-table

Headless React table built on [@tanstack/react-table](https://tanstack.com/table) and [@tanstack/react-virtual](https://tanstack.com/virtual).

Primary DX is a **compound API** (`createTable` / `Table.Column`) with an unstyled semantic HTML shell. Customize with `className`, **`classNames` (Tailwind-friendly part map)**, `slots`, and column `render`. `useGlideTable` remains the lower-level escape hatch when you need full control of markup.

The package ships **no CSS** — class names like `DataTableJSX` / `data-table` are opt-in hooks for your own styles.

## Installation

```bash
npm install react-glide-table
# or
pnpm add react-glide-table
```

Peer dependencies: `react` and `react-dom` (`^18` or `^19`).

The package is marked `"sideEffects": false` for tree-shaking. Prefer subpath imports when you only need one surface:

| Import                       | Contents                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `react-glide-table`          | Full barrel (compound + core)                            |
| `react-glide-table/compound` | `createTable` / `Table` / `DataTable` + related types    |
| `react-glide-table/core`     | `useGlideTable` + feature hooks/helpers (no compound UI) |

## Quick start (compound)

```tsx
import { createTable } from "react-glide-table/compound";
import { useState } from "react";

type Product = { id: string; name: string; qty: number };

const ProductTable = createTable<Product>();

export function Products({ data }: { data: Product[] }) {
  const [page, setPage] = useState(1);

  return (
    <ProductTable
      data={data}
      getRowId={(row) => row.id}
      className="rounded-lg border"
      classNames={{
        scroll: "max-h-[480px] overflow-auto",
        head: "sticky top-0 z-10 bg-neutral-50",
        headCell: "px-3 text-xs font-semibold text-neutral-500",
        row: "hover:bg-neutral-100 data-[selected]:bg-blue-600 data-[selected]:text-white",
        cell: "border-b border-neutral-200 px-3 text-sm",
        toolbar: "flex items-center justify-between gap-2 p-2",
      }}
    >
      <ProductTable.Header>
        <ProductTable.Column field="name">Name</ProductTable.Column>
        <ProductTable.Column field="qty" editable>
          Qty
        </ProductTable.Column>
      </ProductTable.Header>
      <ProductTable.Pagination page={page} pageSize={10} onChange={setPage} />
    </ProductTable>
  );
}
```

### Customization surface

| Slot / prop                                          | Role                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `classNames`                                         | Per-part Tailwind/utility classes (`root`, `scroll`, `row`, `cell`, `toolbar`, …) |
| `slots.Toolbar`                                      | Top summary / actions region                                                      |
| `slots.Row`                                          | Full row replacement (cells, selection, edit UI)                                  |
| `slots.Pending` / `slots.Empty`                      | Loading and empty states                                                          |
| `className` / column `className` / `headerClassName` | Extra class hooks                                                                 |
| `labels` / `summary` / `toolbar`                     | Copy and slot nodes                                                               |
| `Column.render`                                      | Cell content custom render                                                        |

Row/cell **state** is exposed as `data-*` attributes for Tailwind variants:

- row: `data-selected`, `data-hovered`, `data-expandable`, `data-expanded`
- cell: `data-merged`, `data-selection-fill`, `data-editable`, `data-editing`, `data-frozen`, …

Example: `row: "data-[selected]:bg-blue-600"`.

Row-level UI → `slots.Row`. Cell content → `Column.render`. Header/Cell are not separate slots.

## Escape hatch (`useGlideTable`)

```tsx
import { flexRender } from "@tanstack/react-table";
import { useGlideTable } from "react-glide-table/core";
import type { ColumnDef } from "react-glide-table/core";

type Product = { id: string; name: string; qty: number };

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "qty", header: "Qty" },
];

export function ProductTable({ data }: { data: Product[] }) {
  const { table, rows, scrollRef } = useGlideTable({
    data,
    columns,
    getRowId: (row) => row.id,
    rowSelectionMode: "multi",
  });

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
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
  );
}
```

Wire `rowContextValue` into your own row/cell components for edit, selection, expand, and row-span behavior.

## Clipboard copy & paste

Cell selection ships with clipboard shortcuts. The table parses TSV and emits structured payloads; **your app applies domain conversion and updates data**.

| Shortcut         | Behavior                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| Ctrl/Cmd+C       | Copy the active selection (visible rows)                                               |
| Ctrl/Cmd+Shift+C | Copy including collapsed tree descendants (`enableSubtreeCopy`)                        |
| Ctrl/Cmd+V       | Paste **overwrite** into the selection (`onRowsPaste`, `mode: "overwrite"`)            |
| Ctrl/Cmd+Shift+V | Paste **insert** rows after the selection (`mode: "insert"`, when `enableInsertPaste`) |

Subtree copy encodes relative tree depth as leading tabs in the TSV so paste can rebuild parent/child nesting via `payload.depths`. Depth is only inferred when the clipboard looks like subtree indentation (first row unindented, at least one later row indented). Otherwise leading empty cells are kept as real values (e.g. Excel/Sheets blank first column) and `depths` stay `0`.

```tsx
import type { RowsPastePayload } from "react-glide-table/compound";

<ProductTable
  data={data}
  getRowId={(row) => row.id}
  enableCellSelection
  onRowsPaste={(payload: RowsPastePayload) => {
    // overwrite: update cells from startRow using payload.values / columnIds
    // insert: create rows after payload.endRow (or payload.anchorRowId for trees)
    setData((prev) => applyMyPaste(prev, payload));
  }}
>
  {/* columns… */}
</ProductTable>;
```

Related props: `onRowsPaste`, `enableInsertPaste`, `enableSubtreeCopy`, `onCopyActionsReady`.  
Helpers (`/core`): `buildRowsPastePayload`, `parseClipboardTSV`, `parseClipboardTSVWithDepths`, `serializeSelectionToTSV`, …

## Column resize

Opt in with `enableColumnResize`. Drag the handle on the right edge of a header cell; double-click resets to the column’s default `width` / `size`.

```tsx
<ProductTable
  data={data}
  enableColumnResize
  // optional controlled sizing
  // columnSizing={sizing}
  // onColumnSizingChange={setSizing}
>
  <ProductTable.Header>
    <ProductTable.Column field="name" width={200} minWidth={80} maxWidth={480}>
      Name
    </ProductTable.Column>
    <ProductTable.Column field="sku" resizable={false}>
      SKU
    </ProductTable.Column>
  </ProductTable.Header>
</ProductTable>
```

| Prop                                     | Role                                         |
| ---------------------------------------- | -------------------------------------------- |
| `enableColumnResize`                     | Turn on header drag resize (default `false`) |
| `columnSizing` / `onColumnSizingChange`  | Controlled width map `{ [columnId]: px }`    |
| `columnResizeMode`                       | `"onChange"` (live) or `"onEnd"`             |
| `Column.width` / `minWidth` / `maxWidth` | Default / clamp sizes                        |
| `Column.resizable={false}`               | Disable resize for one column                |
| `classNames.resizeHandle`                | Style hook for the drag handle               |

## Column freeze

Opt in with `enableColumnFreeze`. Mark columns with `frozen` — sticky insets are stacked so frozen cells never overlap, and **column order is unchanged** (middle columns may also freeze).

```tsx
<ProductTable data={data} enableColumnFreeze>
  <ProductTable.Header>
    <ProductTable.Column field="name" frozen width={200}>
      Name
    </ProductTable.Column>
    <ProductTable.Column field="sku">SKU</ProductTable.Column>
    <ProductTable.Column field="qty" frozen="left">
      Qty
    </ProductTable.Column>
    <ProductTable.Column field="status" frozen="right">
      Status
    </ProductTable.Column>
  </ProductTable.Header>
</ProductTable>
```

| Prop                               | Role                                    |
| ---------------------------------- | --------------------------------------- |
| `enableColumnFreeze`               | Turn on sticky freeze (default `false`) |
| `Column.frozen` / `meta.frozen`    | `true` / `"left"` or `"right"`          |
| `data-frozen`                      | `"left"` / `"right"` on frozen cells    |
| `data-freeze-edge`                 | `"left"` / `"right"` / `"both"` on island boundaries |

Helpers (`/core`): `buildColumnFreezeOffsets`, `getColumnFreezeEdgeAttr`, `getColumnFreezeStyle`, `resolveColumnFreezeSide`.

Contiguous same-side freezes share one island (shadow only on the outer boundary). A gap between frozen columns creates separate islands, so both sides of the gap get an edge shadow.

## Public API

| Export                                                                                | Path        | Role                                                              |
| ------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `createTable` / `Table`                                                               | `/compound` | Compound column DSL (`Header` / `Column` / `Body` / `Pagination`) |
| `DataTable`                                                                           | `/compound` | Unstyled default renderer (semantic HTML + slots/props)           |
| `useGlideTable`                                                                       | `/core`     | Headless engine escape hatch                                      |
| `useCellEdit` / `useCellSelection` / `useConvertTreeData`                             | `/core`     | Feature hooks                                                     |
| `applyCellEdit`, `applyFillData`, `buildRowsPastePayload`, `buildColumnRowSpanMap`, … | `/core`     | Pure helpers                                                      |
| `DEFAULT_DATA_TABLE_LABELS` / `resolveDataTableLabels`                                | `/core`     | Optional English UI copy helpers                                  |
| Tree field defaults                                                                   | `/core`     | `id` / `parentId` / `children` / `qty`                            |

Root `react-glide-table` re-exports both surfaces. Related types: `TableProps`, `TableColumnProps`, `DataTableProps`, `DataTableSlots`, `TableCompoundComponent`, `ColumnDef`, `RowsPastePayload`, `PasteMode`, …

## Notable constraints

- **Row span + virtualization**: when `enableRowSpan` is on, virtualization is forced off (HTML `<table>` + `rowspan` cannot safely share a virtual window).
- **Paste is app-owned**: the library does not mutate `data` on paste — handle `onRowsPaste` (coerce types, ids, tree shape, row-span keys).
- **Flat tree parent order**: `useConvertTreeData` attaches each child to the nearest _preceding_ row whose toggle key matches `parentId` (duplicate keys after paste resolve this way). Flat inputs must list parents before their children; a child whose parent appears later becomes a root. Nested `children` arrays are flattened parent-before-child automatically.
- **No shipped CSS**: the default renderer emits class hooks only. Bring your own styles (see playground for a CSS-skinned example).

## Local playground

```bash
pnpm install
pnpm dev
```

The playground uses `createTable` with a local CSS skin (`src/styles/index.css`) to exercise the compound API and headless core — including cell copy/paste (overwrite + insert) on flat and tree (BOM) tables.

## License

MIT
