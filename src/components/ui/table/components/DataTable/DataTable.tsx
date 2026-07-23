import { flexRender } from "@tanstack/react-table"

import { DataTableRow } from "@/components/ui/table/components/DataTable/DataTableRow"
import { DataTableToolbar } from "@/components/ui/table/components/DataTable/DataTableToolbar"
import { CELL_ALIGN_CLASS } from "@/components/ui/table/constants"
import { DataTableContextProvider } from "@/components/ui/table/DataTableContext"
import type { DataTableProps } from "@/components/ui/table/types"
import { useGlideTable } from "@/core/useGlideTable"
import { cn } from "@/lib/cn"

function DefaultPending({
  loadingText,
  className,
}: {
  loadingText: string
  className?: string
}) {
  return (
    <div className={cn("DataTableJSX", "DataTableJSX--pending", className)}>
      <span className="data-table-loading-text">{loadingText}</span>
    </div>
  )
}

function DefaultEmpty({
  emptyText,
  columnCount,
}: {
  emptyText: string
  columnCount: number
}) {
  return (
    <tr>
      <td colSpan={columnCount} className="data-table-empty-cell">
        {emptyText}
      </td>
    </tr>
  )
}

/**
 * Unstyled DataTable shell: semantic HTML + interaction behavior.
 * Class hooks (`DataTableJSX`, `data-table`, …) are opt-in — no CSS is shipped.
 * Customize via `className`, column `className` / `headerClassName`, `labels`,
 * `summary` / `toolbar`, `Column.render`, and `slots`.
 */
function DataTable<T extends Record<string, unknown>>({
  isPending = false,
  summary,
  toolbar,
  filteredCount,
  totalCount,
  className,
  slots,
  ...glideOptions
}: DataTableProps<T>) {
  const {
    table,
    tableData,
    rows,
    columnCount,
    selectedCount,
    emptyText,
    loadingText,
    selectionLabel,
    enableCellSelection,
    shouldVirtualize,
    scrollRef,
    rowVirtualizer,
    virtualRows,
    paddingTop,
    paddingBottom,
    rowContextValue,
    handleToggleSelect,
    clearHover,
  } = useGlideTable(glideOptions)

  const ToolbarSlot = slots?.Toolbar ?? DataTableToolbar
  const RowSlot = slots?.Row ?? DataTableRow
  const PendingSlot = slots?.Pending ?? DefaultPending
  const EmptySlot = slots?.Empty ?? DefaultEmpty

  if (isPending) {
    return <PendingSlot loadingText={loadingText} className={className} />
  }

  return (
    <div
      className={cn(
        "DataTableJSX",
        !enableCellSelection && "DataTableJSX--no-cell-selection",
        className,
      )}>
      <ToolbarSlot
        filteredCount={filteredCount ?? tableData.length}
        totalCount={totalCount}
        summary={summary}
        selectedCount={selectedCount}
        selectionLabel={selectionLabel}
        toolbar={toolbar}
      />

      <div ref={scrollRef} className="data-table-scroll">
        <table
          className="data-table"
          onDragStart={
            enableCellSelection ? (event) => event.preventDefault() : undefined
          }>
          <thead className="data-table-head">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="data-table-head-row">
                {headerGroup.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align ?? "center"
                  const headerClassName = header.column.columnDef.meta?.headerClassName

                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className={cn(
                        "data-table-head-cell",
                        CELL_ALIGN_CLASS[align],
                        headerClassName,
                      )}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <DataTableContextProvider value={rowContextValue}>
            <tbody onMouseLeave={clearHover} className="data-table-body">
              {rows.length === 0 ? (
                <EmptySlot emptyText={emptyText} columnCount={columnCount} />
              ) : shouldVirtualize ? (
                <>
                  {paddingTop > 0 && (
                    <tr aria-hidden className="data-table-virtual-spacer">
                      <td
                        colSpan={columnCount}
                        style={{ height: paddingTop }}
                        className="data-table-virtual-spacer-cell"
                      />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    if (!row) return null

                    return (
                      <RowSlot
                        key={row.id}
                        row={row}
                        virtualIndex={virtualRow.index}
                        measureElement={rowVirtualizer.measureElement}
                        onToggleSelect={() => handleToggleSelect(row)}
                      />
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden className="data-table-virtual-spacer">
                      <td
                        colSpan={columnCount}
                        style={{ height: paddingBottom }}
                        className="data-table-virtual-spacer-cell"
                      />
                    </tr>
                  )}
                </>
              ) : (
                rows.map((row) => (
                  <RowSlot
                    key={row.id}
                    row={row}
                    onToggleSelect={() => handleToggleSelect(row)}
                  />
                ))
              )}
            </tbody>
          </DataTableContextProvider>
        </table>
      </div>
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
