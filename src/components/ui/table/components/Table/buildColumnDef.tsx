import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"

import type { TableSortState } from "@/components/ui/table/components/Table/tableDataPipeline"
import { ArrowDown, ArrowUp, ArrowUpDown } from "@/components/ui/table/components/icons"
import type { TableColumnProps } from "@/components/ui/table/types"
import { cn } from "@/lib/cn"


function SortableHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: ReactNode
  field: string
  sort: TableSortState | null
  onSort: (field: string) => void
}) {
  const isActive = sort?.field === field
  const Icon = isActive ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <button
      type="button"
      className={cn("SortableHeaderJSX", isActive ? "is-active" : "is-inactive")}
      onClick={() => onSort(field)}>
      <span>{label}</span>
      <Icon className="sortable-header-icon" />
    </button>
  )
}

export function buildColumnDef<T extends Record<string, unknown>>(
  props: TableColumnProps<T>,
  sort: TableSortState | null,
  onSort: (field: string) => void,
): ColumnDef<T, unknown> {
  const {
    field,
    virtual = false,
    children,
    sortable = false,
    width,
    align,
    rowSpan,
    rowSpanKey,
    editable,
    editType,
    className,
    headerClassName,
    render,
  } = props

  return {
    id: field,
    ...(!virtual ? { accessorKey: field as keyof T & string } : {}),
    size: width ?? 150,
    header: sortable
      ? () => <SortableHeader label={children} field={field} sort={sort} onSort={onSort} />
      : // eslint-disable-next-line @typescript-eslint/promise-function-async
        () => children,
    ...(render
      ? {
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          cell: ({ row, getValue }) =>
            render(
              getValue() as Parameters<NonNullable<TableColumnProps<T>["render"]>>[0],
              row,
              row.index,
            ),
        }
      : {}),
    meta: {
      align,
      rowSpan,
      rowSpanKey,
      editable,
      editType,
      className,
      headerClassName,
    },
  }
}
