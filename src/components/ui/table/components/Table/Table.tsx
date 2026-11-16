import { useCallback, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"

import { DataTable } from "@/components/ui/table/components/DataTable/DataTable"
import {
  buildColumnDefsFromTree,
  countLeafColumns,
  TableSortContext,
  type HeaderRendererCache,
} from "@/components/ui/table/components/Table/buildColumnDef"
import {
  extractColumnTree,
  parseTableChildren,
} from "@/components/ui/table/components/Table/parseTableChildren"
import { TableBody } from "@/components/ui/table/components/Table/TableBody"
import {
  TABLE_COLUMN_DISPLAY_NAME,
  TABLE_COLUMN_GROUP_DISPLAY_NAME,
} from "@/components/ui/table/components/Table/tableChildTypes"
import { TableColumn } from "@/components/ui/table/components/Table/TableColumn"
import { TableColumnGroup } from "@/components/ui/table/components/Table/TableColumnGroup"
import {
  buildTreeRootBlocks,
  paginateTableData,
  sortTableData,
  type TableSortState,
} from "@/components/ui/table/components/Table/tableDataPipeline"
import { TableHeader } from "@/components/ui/table/components/Table/TableHeader"
import {
  TablePagination,
  type TablePaginationProps,
} from "@/components/ui/table/components/Table/TablePagination"
import type {
  TableColumnGroupProps,
  TableColumnProps,
  TableProps,
} from "@/components/ui/table/types"
import { DEFAULT_TREE_PARENT_ID_FIELD } from "@/core/treeDefaults"
import { cn } from "@/lib/cn"


type TableCompoundComponent<T extends Record<string, unknown>> = ((
  props: TableProps<T>,
) => ReactElement) & {
  Header: typeof TableHeader
  Column: <K extends string>(props: TableColumnProps<T, K>) => null
  ColumnGroup: (props: TableColumnGroupProps) => null
  Body: typeof TableBody
  Pagination: typeof TablePagination
}

function TableRoot<T extends Record<string, unknown>>({
  data,
  children,
  className,
  classNames,
  totalCount,
  filteredCount,
  onDataChange,
  getRowId,
  sort: controlledSort,
  defaultSort = null,
  onSortChange,
  sortLocale,
  ...dataTableProps
}: TableProps<T>) {
  const { header, pagination: paginationElement } = useMemo(
    () => parseTableChildren(children),
    [children],
  )

  const [internalSort, setInternalSort] = useState<TableSortState | null>(defaultSort)
  const sort = controlledSort !== undefined ? controlledSort : internalSort

  const handleSort = useCallback(
    (field: string) => {
      let next: TableSortState | null
      if (sort?.field !== field) {
        next = { field, direction: "asc" }
      } else if (sort.direction === "asc") {
        next = { field, direction: "desc" }
      } else {
        next = null
      }

      if (controlledSort === undefined) setInternalSort(next)
      onSortChange?.(next)
    },
    [controlledSort, onSortChange, sort],
  )

  const columnTree = useMemo(() => extractColumnTree<T>(header), [header])

  const headerCacheRef = useRef<HeaderRendererCache>(new Map())
  const columns = useMemo(
    () => buildColumnDefsFromTree(columnTree, sort, handleSort, headerCacheRef.current),
    [columnTree, sort, handleSort],
  )
  const sortContextValue = useMemo(() => ({ sort, onSort: handleSort }), [sort, handleSort])

  const paginationProps = paginationElement?.props as TablePaginationProps | undefined
  const pageSize = paginationProps?.pageSize ?? 10
  const page = paginationProps?.page ?? 1
  const resolvedTotalCount = paginationProps?.totalCount ?? totalCount ?? data.length

  const isManualPagination = Boolean(paginationProps?.manual)

  const treeIdField = dataTableProps.toggleField ?? dataTableProps.idField
  const isTree = Boolean(treeIdField)
  const treeParentIdField =
    dataTableProps.childField ?? dataTableProps.parentIdField ?? DEFAULT_TREE_PARENT_ID_FIELD

  // Tree tables sort siblings and page by root rows, so a child never shows
  // up apart from its parent (or ahead of it, which would make it a root).
  const treeBlocks = useMemo(() => {
    if (!isTree || !treeIdField) return null
    if (!sort && (!paginationProps || isManualPagination)) return null

    return buildTreeRootBlocks(
      data,
      { idField: treeIdField, parentIdField: treeParentIdField },
      sort,
      sortLocale,
    )
  }, [data, isManualPagination, isTree, paginationProps, sort, sortLocale, treeIdField, treeParentIdField])

  const pageTotalCount =
    paginationProps?.totalCount ?? totalCount ?? (treeBlocks ? treeBlocks.length : data.length)

  const tableData = useMemo(() => {
    if (treeBlocks) {
      const blocks =
        !paginationProps || isManualPagination
          ? treeBlocks
          : paginateTableData(treeBlocks, page, pageSize)
      return blocks.flat()
    }

    const sortedData = sortTableData(data, sort, sortLocale)

    if (!paginationProps || isManualPagination) return sortedData

    return paginateTableData(sortedData, page, pageSize)
  }, [treeBlocks, data, sort, sortLocale, paginationProps, isManualPagination, page, pageSize])

  // The DataTable below only sees the sorted / paged rows. Map them back to
  // their index in the consumer's `data` so ids and writes stay correct.
  const originalIndexByRow = useMemo(() => {
    const map = new Map<T, number>()
    data.forEach((row, index) => map.set(row, index))
    return map
  }, [data])

  const resolvedGetRowId = useMemo<TableProps<T>["getRowId"]>(() => {
    if (getRowId) return getRowId
    // Tree tables get stable ids from the tree conversion itself.
    if (isTree) return undefined

    return (row: T, index: number) => String(originalIndexByRow.get(row) ?? index)
  }, [isTree, getRowId, originalIndexByRow])

  const handleDataChange = useMemo<TableProps<T>["onDataChange"]>(() => {
    if (!onDataChange) return undefined

    return (next: T[]) => {
      // `next` is the visible slice with only the edited rows replaced.
      const merged = data.slice()
      tableData.forEach((row, index) => {
        const nextRow = next[index]
        if (nextRow === undefined || nextRow === row) return

        const originalIndex = originalIndexByRow.get(row)
        if (originalIndex !== undefined) merged[originalIndex] = nextRow
      })
      onDataChange(merged)
    }
  }, [data, onDataChange, originalIndexByRow, tableData])

  if (countLeafColumns(columnTree) === 0) {
    console.warn("[Table] Declare at least one Table.Column inside Table.Header.")
  }

  return (
    <div className={cn("TableJSX", classNames?.tableRoot)}>
      <TableSortContext value={sortContextValue}>
      <DataTable
        {...dataTableProps}
        classNames={classNames}
        getRowId={resolvedGetRowId}
        onDataChange={handleDataChange}
        data={tableData}
        columns={columns}
        totalCount={paginationProps ? resolvedTotalCount : totalCount}
        filteredCount={filteredCount ?? data.length}
        className={cn(className, paginationProps && "DataTableJSX--with-pagination")}
      />
      </TableSortContext>
      {paginationProps && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={pageTotalCount}
          onChange={paginationProps.onChange}
          className={cn(classNames?.pagination, paginationProps.className)}
          previousLabel={paginationProps.previousLabel ?? dataTableProps.labels?.paginationPrevious}
          nextLabel={paginationProps.nextLabel ?? dataTableProps.labels?.paginationNext}
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

  function ColumnGroup(props: TableColumnGroupProps) {
    void props

    return null
  }
  ColumnGroup.displayName = TABLE_COLUMN_GROUP_DISPLAY_NAME

  return Object.assign(
    function BoundTable(props: TableProps<T>) {
      return <TableRoot<T> {...props} />
    },
    {
      Header: TableHeader,
      Column,
      ColumnGroup,
      Body: TableBody,
      Pagination: TablePagination,
    },
  ) as TableCompoundComponent<T>
}

const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Column: TableColumn,
  ColumnGroup: TableColumnGroup,
  Body: TableBody,
  Pagination: TablePagination,
})

export {
  createTable,
  Table,
  TableBody,
  TableColumn,
  TableColumnGroup,
  TableHeader,
  TablePagination,
  TableRoot,
}
export type {
  TableCompoundComponent,
  TablePaginationProps,
  TableProps,
  TableColumnGroupProps,
  TableColumnProps,
}
