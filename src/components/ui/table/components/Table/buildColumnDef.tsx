import type { ColumnDef } from "@tanstack/react-table";
import { createContext, use, type ReactNode } from "react";

import type { ColumnTreeNode } from "@/components/ui/table/components/Table/parseTableChildren";
import type { TableSortState } from "@/components/ui/table/components/Table/tableDataPipeline";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "@/components/ui/table/components/icons";
import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants";
import { ResolvedTableCell } from "@/components/ui/table/features/cell-render/ResolvedTableCell";
import type { CellRenderFn } from "@/components/ui/table/features/cell-render/types";
import type {
  ColumnCopyValue,
  ColumnSearchValue,
  TableColumnGroupProps,
  TableColumnProps,
} from "@/components/ui/table/types";
import { cn } from "@/lib/cn";

/**
 * Sort state for compound `Table` headers. Read from context so the header
 * component keeps its identity across sorts: a new header function per sort
 * would remount the button and drop keyboard focus.
 */
export const TableSortContext = createContext<{
  sort: TableSortState | null;
  onSort: (field: string) => void;
} | null>(null);

function SortableHeader({
  label,
  field,
  sort: sortProp,
  onSort: onSortProp,
}: {
  label: ReactNode;
  field: string;
  sort: TableSortState | null;
  onSort: (field: string) => void;
}) {
  const context = use(TableSortContext);
  const sort = context ? context.sort : sortProp;
  const onSort = context ? context.onSort : onSortProp;
  const isActive = sort?.field === field;
  const Icon = isActive
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      className={cn(
        "SortableHeaderJSX",
        isActive ? "is-active" : "is-inactive",
      )}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      <Icon className="sortable-header-icon" />
    </button>
  );
}

type HeaderRenderer = () => ReactNode;

/** Reuses a column's header function while its label and sortability stay the same. */
export type HeaderRendererCache = Map<
  string,
  { label: ReactNode; sortable: boolean; render: HeaderRenderer }
>;

export function buildColumnDef<T extends Record<string, unknown>>(
  props: TableColumnProps<T>,
  sort: TableSortState | null,
  onSort: (field: string) => void,
  headerCache?: HeaderRendererCache,
): ColumnDef<T, unknown> {
  const {
    field,
    virtual = false,
    children,
    sortable = false,
    width,
    minWidth,
    maxWidth,
    minResizeWidth,
    maxResizeWidth,
    resizable,
    reorderable,
    frozen,
    align,
    rowSpan,
    rowSpanKey,
    rowSpanParent,
    editable,
    editType,
    editInputProps,
    kind,
    cellProps,
    className,
    headerClassName,
    render,
    copyValue,
    searchValue,
  } = props;

  const createHeader = (): HeaderRenderer =>
    sortable
      ? () => (
          <SortableHeader
            label={children}
            field={field}
            sort={sort}
            onSort={onSort}
          />
        )
      : // eslint-disable-next-line @typescript-eslint/promise-function-async
        () => children;
  const cached = headerCache?.get(field);
  let header: HeaderRenderer;
  if (cached && cached.label === children && cached.sortable === sortable) {
    header = cached.render;
  } else {
    header = createHeader();
    headerCache?.set(field, { label: children, sortable, render: header });
  }

  return {
    id: field,
    ...(!virtual ? { accessorKey: field as keyof T & string } : {}),
    size: width ?? DATA_TABLE_COLUMN_SIZE,
    ...(minResizeWidth != null ? { minSize: minResizeWidth } : {}),
    ...(maxResizeWidth != null ? { maxSize: maxResizeWidth } : {}),
    ...(resizable === false ? { enableResizing: false } : {}),
    header,
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    cell: (info) => <ResolvedTableCell info={info} />,
    meta: {
      align,
      rowSpan,
      rowSpanKey,
      rowSpanParent,
      editable,
      editType,
      editInputProps,
      kind,
      cellProps,
      cellRender: render as CellRenderFn<Record<string, unknown>> | undefined,
      copyValue: copyValue as ColumnCopyValue | undefined,
      searchValue: searchValue as ColumnSearchValue | undefined,
      sortDirection: sortable
        ? sort?.field === field
          ? sort.direction
          : false
        : undefined,
      frozen,
      reorderable,
      width,
      minWidth,
      maxWidth,
      className,
      headerClassName,
    },
  };
}

function resolveGroupId(props: TableColumnGroupProps, index: number): string {
  if (props.id) return props.id;

  if (typeof props.header === "string" || typeof props.header === "number") {
    return `group:${props.header}:${index}`;
  }

  return `group:${index}`;
}

export function buildColumnDefsFromTree<T extends Record<string, unknown>>(
  nodes: ColumnTreeNode<T>[],
  sort: TableSortState | null,
  onSort: (field: string) => void,
  headerCache?: HeaderRendererCache,
): ColumnDef<T, unknown>[] {
  return nodes.map((node, index) => {
    if (node.type === "leaf") {
      return buildColumnDef(node.props, sort, onSort, headerCache);
    }

    const childDefs = buildColumnDefsFromTree(node.columns, sort, onSort, headerCache);
    const { header, align, headerClassName } = node.props;

    return {
      id: resolveGroupId(node.props, index),
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      header: () => header,
      columns: childDefs,
      enableResizing: false,
      meta: {
        align,
        headerClassName,
      },
    };
  });
}

/** Count leaf columns in a column tree (for empty-state warnings). */
export function countLeafColumns<T extends Record<string, unknown>>(
  nodes: ColumnTreeNode<T>[],
): number {
  let count = 0;

  for (const node of nodes) {
    if (node.type === "leaf") {
      count += 1;
    } else {
      count += countLeafColumns(node.columns);
    }
  }

  return count;
}
