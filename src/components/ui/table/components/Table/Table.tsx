import { useCallback, useMemo, useState } from "react"
import type { ReactElement } from "react"

import { DataTable } from "@/components/ui/table/components/DataTable/DataTable"
import { buildColumnDef } from "@/components/ui/table/components/Table/buildColumnDef"
import {
  extractColumnElements,
  parseTableChildren,
} from "@/components/ui/table/components/Table/parseTableChildren"
import { TableBody } from "@/components/ui/table/components/Table/TableBody"
import { TABLE_COLUMN_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"
import { TableColumn } from "@/components/ui/table/components/Table/TableColumn"
import {
  paginateTableData,
  sortTableData,
  type TableSortState,
} from "@/components/ui/table/components/Table/tableDataPipeline"
import { TableHeader } from "@/components/ui/table/components/Table/TableHeader"
import {
  TablePagination,
  type TablePaginationProps,
} from "@/components/ui/table/components/Table/TablePagination"
import type { TableColumnProps, TableProps } from "@/components/ui/table/types"
import { cn } from "@/lib/cn"


type TableCompoundComponent<T extends Record<string, unknown>> = ((
  props: TableProps<T>,
) => ReactElement) & {
  Header: typeof TableHeader
  Column: <K extends string>(props: TableColumnProps<T, K>) => null
  Body: typeof TableBody
  Pagination: typeof TablePagination
}

function TableRoot<T extends Record<string, unknown>>({
  data,
  children,
  className,
  totalCount,
  filteredCount,
  ...dataTableProps
}: TableProps<T>) {
  const { header, pagination: paginationElement } = useMemo(
    () => parseTableChildren(children),
    [children],
  )

  const [sort, setSort] = useState<TableSortState | null>(null)

  const handleSort = useCallback((field: string) => {
    setSort((previous) => {
      if (previous?.field !== field) {
        return { field, direction: "asc" }
      }

      if (previous.direction === "asc") {
        return { field, direction: "desc" }
      }

      return null
    })
  }, [])

  const columns = useMemo(() => {
    return extractColumnElements(header).map((columnElement) =>
      buildColumnDef(columnElement.props as TableColumnProps<T>, sort, handleSort),
    )
  }, [header, sort, handleSort])

  const paginationProps = paginationElement?.props as TablePaginationProps | undefined
  const pageSize = paginationProps?.pageSize ?? 10
  const page = paginationProps?.page ?? 1
  const resolvedTotalCount = paginationProps?.totalCount ?? totalCount ?? data.length

  const tableData = useMemo(() => {
    const sortedData = sortTableData(data, sort)

    if (!paginationProps) return sortedData

    return paginateTableData(sortedData, page, pageSize)
  }, [data, sort, paginationProps, page, pageSize])

  if (columns.length === 0) {
    console.warn("[Table] Declare at least one Table.Column inside Table.Header.")
  }

  return (
    <div className="TableJSX">
      <DataTable
        {...dataTableProps}
        data={tableData}
        columns={columns}
        totalCount={paginationProps ? resolvedTotalCount : totalCount}
        filteredCount={filteredCount ?? data.length}
        className={cn(className, paginationProps && "DataTableJSX--with-pagination")}
      />
      {paginationProps && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={resolvedTotalCount}
          onChange={paginationProps.onChange}
          className={paginationProps.className}
        />
      )}
    </div>
  )
}

function createTable<T extends Record<string, unknown>>(): TableCompoundComponent<T> {
  function Column<K extends string>(props: TableColumnProps<T, K>) {
    void props

    return null
  }
  Column.displayName = TABLE_COLUMN_DISPLAY_NAME

  return Object.assign(
    function BoundTable(props: TableProps<T>) {
      return <TableRoot<T> {...props} />
    },
    {
      Header: TableHeader,
      Column,
      Body: TableBody,
      Pagination: TablePagination,
    },
  ) as TableCompoundComponent<T>
}

const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Column: TableColumn,
  Body: TableBody,
  Pagination: TablePagination,
})

export { createTable, Table, TableBody, TableColumn, TableHeader, TablePagination, TableRoot }
export type { TableCompoundComponent, TablePaginationProps, TableProps, TableColumnProps }
