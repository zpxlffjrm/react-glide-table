import type { ColumnDef } from "@tanstack/react-table"
import type { ReactNode } from "react"

import type { TableSortState } from "@/components/ui/table/components/Table/tableDataPipeline"
import { ArrowDown, ArrowUp, ArrowUpDown } from "@/components/ui/table/components/icons"
import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants"
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
    minWidth,
    maxWidth,
    resizable,
    frozen,
    align,
    rowSpan,
    rowSpanKey,
    editable,
    editType,
    editInputProps,
    className,
    headerClassName,
    render,
  } = props

  return {
    id: field,
    ...(!virtual ? { accessorKey: field as keyof T & string } : {}),
    size: width ?? DATA_TABLE_COLUMN_SIZE,
    ...(minWidth != null ? { minSize: minWidth } : {}),
    ...(maxWidth != null ? { maxSize: maxWidth } : {}),
    ...(resizable === false ? { enableResizing: false } : {}),
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
      editInputProps,
      frozen,
      className,
      headerClassName,
    },
  }
}
