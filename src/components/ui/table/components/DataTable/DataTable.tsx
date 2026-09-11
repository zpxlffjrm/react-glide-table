import { flexRender } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { DataTableRow } from "@/components/ui/table/components/DataTable/DataTableRow";
import { DataTableSearch } from "@/components/ui/table/components/DataTable/DataTableSearch";
import { DataTableToolbar } from "@/components/ui/table/components/DataTable/DataTableToolbar";
import {
  CELL_ALIGN_CLASS,
  DATA_TABLE_HEADER_ROW_HEIGHT,
} from "@/components/ui/table/constants";
import { DataTableContextProvider } from "@/components/ui/table/DataTableContext";
import {
  buildColumnFreezeOffsets,
  getColumnFreezeEdgeAttr,
  getColumnFreezeStyle,
  resolveColumnFreezeSide,
  resolveHeaderFreezeOffset,
  type ColumnFreezeColumnInput,
} from "@/components/ui/table/features/column-freeze/columnFreeze";
import { getMergedHeaderGroups } from "@/components/ui/table/features/column-groups/mergeHeaderGroups";
import {
  isColumnReorderable,
  serializeReorderIds,
} from "@/components/ui/table/features/column-reorder/columnReorder";
import { useColumnReorder } from "@/components/ui/table/features/column-reorder/useColumnReorder";
import {
  getColumnSizeStyle,
  resolveColumnLayoutWidths,
  type ColumnLayoutInput,
} from "@/components/ui/table/features/column-resize/columnResize";
import type {
  DataTableClassNames,
  DataTableProps,
  DataTableScrollSlotProps,
} from "@/components/ui/table/types";
import { useGlideTable } from "@/core/useGlideTable";
import { cn } from "@/lib/cn";

function DefaultScroll({
  scrollRef,
  children,
  className,
}: DataTableScrollSlotProps) {
  return (
    <div ref={scrollRef} className={cn("data-table-scroll", className)}>
      {children}
    </div>
  );
}

function DefaultPending({
  loadingText,
  className,
  classNames,
}: {
  loadingText: string;
  className?: string;
  classNames?: Pick<DataTableClassNames, "pending" | "loadingText" | "root">;
}) {
  return (
    <div
      className={cn(
        "DataTableJSX",
        "DataTableJSX--pending",
        classNames?.root,
        classNames?.pending,
        className,
      )}
    >
      <span className={cn("data-table-loading-text", classNames?.loadingText)}>
        {loadingText}
      </span>
    </div>
  );
}

function DefaultEmpty({
  emptyText,
  columnCount,
  classNames,
}: {
  emptyText: string;
  columnCount: number;
  classNames?: Pick<DataTableClassNames, "emptyCell">;
}) {
  return (
    <tr>
      <td
        colSpan={columnCount}
        className={cn("data-table-empty-cell", classNames?.emptyCell)}
      >
        {emptyText}
      </td>
    </tr>
  );
}

/**
 * Unstyled DataTable shell: semantic HTML + interaction behavior.
 * Class hooks (`DataTableJSX`, `data-table`, …) are opt-in — no CSS is shipped.
 * Customize via `className`, `classNames` (Tailwind-friendly part map), column
 * `className` / `headerClassName`, `labels`, `summary` / `toolbar`, `Column.render`, and `slots`
 * (`Toolbar`, `Scroll`, `Row`, `Pending`, `Empty`).
 */
function DataTable<T extends Record<string, unknown>>({
  isPending = false,
  summary,
  toolbar,
  filteredCount,
  totalCount,
  className,
  classNames,
  slots,
  ...glideOptions
}: DataTableProps<T>) {
  const {
    table,
    tableData,
    rows,
    columnCount,
    selectedCount,
    labels,
    emptyText,
    loadingText,
    selectionLabel,
    enableCellSelection,
    enableColumnResize,
    enableColumnReorder,
    enableColumnFreeze,
    enableInlineSearch,
    shouldVirtualize,
    scrollRef,
    rootRef,
    rowVirtualizer,
    virtualRows,
    paddingTop,
    paddingBottom,
    rowContextValue,
    handleToggleSelect,
    clearHover,
    setColumnOrder,
    inlineSearch,
  } = useGlideTable(glideOptions);

  const ToolbarSlot = slots?.Toolbar ?? DataTableToolbar;
  const ScrollSlot = slots?.Scroll ?? DefaultScroll;
  const RowSlot = slots?.Row ?? DataTableRow;
  const PendingSlot = slots?.Pending ?? DefaultPending;
  const EmptySlot = slots?.Empty ?? DefaultEmpty;
  const headerGroups = getMergedHeaderGroups(table.getHeaderGroups());
  const leafColumnIds = table
    .getVisibleLeafColumns()
    .map((column) => column.id);
  // Recomputed every render (cheap) so it reflects the current
  // `meta.width`/`minWidth`/`maxWidth` even when a controlled column-def
  // update leaves the column ids (and the tanstack `table` instance, which
  // stays referentially stable across renders) unchanged — a `useMemo`
  // keyed only on `table`/ids would otherwise miss the update.
  const columnLayoutMetaSignature = table
    .getVisibleLeafColumns()
    .map((column) => {
      const meta = column.columnDef.meta;
      return `${column.id}:${meta?.width ?? ""}:${meta?.minWidth ?? ""}:${meta?.maxWidth ?? ""}`;
    })
    .join("|");
  const { isReordering, draggingColumnId, dropTarget, onHeaderPointerDown } =
    useColumnReorder({
      enabled: enableColumnReorder,
      columnOrder: leafColumnIds,
      onColumnOrderChange: setColumnOrder,
    });

  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (enableColumnResize || isPending) return;

    const element = scrollRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(Math.floor(element.clientWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [enableColumnResize, isPending, scrollRef, rows.length, leafColumnIds.join("|")]);

  const layoutWidths = useMemo(() => {
    if (enableColumnResize) return undefined;

    const columns: ColumnLayoutInput[] = table
      .getVisibleLeafColumns()
      .map((column) => ({
        id: column.id,
        width: column.columnDef.meta?.width,
        minWidth: column.columnDef.meta?.minWidth,
        maxWidth: column.columnDef.meta?.maxWidth,
      }));

    return resolveColumnLayoutWidths(containerWidth, columns);
  }, [enableColumnResize, containerWidth, table, columnLayoutMetaSignature]);

  // `useGlideTable`'s own freeze offsets are built from `column.getSize()`,
  // which only matches `layoutWidths` for fixed-width columns — a
  // min/max-only column can resolve to e.g. 160px while `getSize()` stays at
  // the 150px tanstack default, so frozen columns after it would get the
  // wrong sticky inset. Rebuild offsets from the same resolved widths.
  const freezeOffsets = useMemo(() => {
    if (!enableColumnFreeze || enableColumnResize || !layoutWidths) {
      return rowContextValue.columnFreeze.offsets;
    }

    const columns: ColumnFreezeColumnInput[] = table
      .getVisibleLeafColumns()
      .map((column) => ({
        id: column.id,
        size: layoutWidths.get(column.id) ?? column.getSize(),
        side: resolveColumnFreezeSide(column.columnDef.meta?.frozen),
      }));

    return buildColumnFreezeOffsets(columns);
  }, [
    enableColumnFreeze,
    enableColumnResize,
    layoutWidths,
    rowContextValue.columnFreeze.offsets,
    table,
  ]);

  const contextValue = useMemo(
    () => ({
      ...rowContextValue,
      classNames,
      columnFreeze: {
        ...rowContextValue.columnFreeze,
        offsets: freezeOffsets,
      },
      columnResize: {
        ...rowContextValue.columnResize,
        layoutWidths,
      },
    }),
    [rowContextValue, classNames, freezeOffsets, layoutWidths],
  );

  if (isPending) {
    return (
      <PendingSlot
        loadingText={loadingText}
        className={className}
        classNames={classNames}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "DataTableJSX",
        !enableCellSelection && "DataTableJSX--no-cell-selection",
        enableColumnResize && "DataTableJSX--column-resize",
        enableColumnReorder && "DataTableJSX--column-reorder",
        isReordering && "DataTableJSX--column-reordering",
        enableColumnFreeze && "DataTableJSX--column-freeze",
        enableInlineSearch && "DataTableJSX--inline-search",
        classNames?.root,
        className,
      )}
    >
      <ToolbarSlot
        filteredCount={filteredCount ?? tableData.length}
        totalCount={totalCount}
        summary={summary}
        selectedCount={selectedCount}
        selectionLabel={selectionLabel}
        toolbar={toolbar}
        classNames={classNames}
      />

      {enableInlineSearch ? (
        <DataTableSearch
          showSearch={inlineSearch.showSearch}
          searchValue={inlineSearch.searchValue}
          searchStatus={inlineSearch.searchStatus}
          searchInputId={inlineSearch.searchInputId}
          searchInputRef={inlineSearch.searchInputRef}
          canClose={inlineSearch.canClose}
          placeholder={labels.searchPlaceholder}
          resultHint={labels.searchResultHint}
          previousLabel={labels.searchPrevious}
          nextLabel={labels.searchNext}
          closeLabel={labels.searchClose}
          rowsTotal={inlineSearch.searchRowCount}
          classNames={classNames}
          onSearchValueChange={inlineSearch.setSearchValue}
          onClose={inlineSearch.closeSearch}
          onNext={inlineSearch.goToNext}
          onPrevious={inlineSearch.goToPrevious}
        />
      ) : null}
      <ScrollSlot scrollRef={scrollRef} className={classNames?.scroll}>
        <table
          className={cn("data-table", classNames?.table)}
          style={
            enableColumnResize ? { width: table.getTotalSize() } : undefined
          }
          onDragStart={
            enableCellSelection ? (event) => event.preventDefault() : undefined
          }
        >
          <thead className={cn("data-table-head", classNames?.head)}>
            {headerGroups.map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className={cn("data-table-head-row", classNames?.headRow)}
              >
                {headerGroup.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align ?? "center";
                  const headerClassName =
                    header.column.columnDef.meta?.headerClassName;
                  const canResize =
                    enableColumnResize && header.column.getCanResize();
                  const sizeStyle = getColumnSizeStyle(header.getSize(), {
                    force: enableColumnResize,
                    lockMax: enableColumnResize,
                    minWidth: header.column.columnDef.meta?.minWidth,
                    maxWidth: header.column.columnDef.meta?.maxWidth,
                    layoutWidth: layoutWidths?.get(header.column.id),
                  });
                  const freezeOffset = enableColumnFreeze
                    ? resolveHeaderFreezeOffset(header.column, freezeOffsets)
                    : undefined;
                  const freezeStyle = getColumnFreezeStyle(freezeOffset, {
                    isHeader: true,
                    headerTop: header.depth * DATA_TABLE_HEADER_ROW_HEIGHT,
                  });
                  const headerStyle = {
                    ...sizeStyle,
                    ...freezeStyle,
                  };
                  const isPlaceholder = header.isPlaceholder;
                  const leafColumns = header.column.getLeafColumns();
                  const leafIds = leafColumns.map(
                    (leafColumn) => leafColumn.id,
                  );
                  const isLeafHeader =
                    !isPlaceholder && header.subHeaders.length === 0;
                  const canDrag =
                    enableColumnReorder &&
                    !isPlaceholder &&
                    leafIds.length > 0 &&
                    leafColumns.every((leafColumn) =>
                      isColumnReorderable(leafColumn.columnDef.meta),
                    );
                  const isDragging = draggingColumnId === header.column.id;
                  const dropEdge =
                    !isPlaceholder && dropTarget?.columnId === header.column.id
                      ? dropTarget.edge
                      : undefined;

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      rowSpan={header.mergedRowSpan}
                      data-column-id={
                        enableColumnReorder && !isPlaceholder
                          ? header.column.id
                          : undefined
                      }
                      data-reorder-ids={
                        enableColumnReorder && !isPlaceholder
                          ? serializeReorderIds(leafIds)
                          : undefined
                      }
                      data-reorder-leaf={
                        enableColumnReorder && isLeafHeader ? "" : undefined
                      }
                      data-reorderable={canDrag ? "" : undefined}
                      data-reordering={isDragging ? "" : undefined}
                      data-drop-edge={dropEdge}
                      data-resizing={
                        header.column.getIsResizing() ? "" : undefined
                      }
                      data-frozen={freezeOffset?.side}
                      data-freeze-edge={getColumnFreezeEdgeAttr(freezeOffset)}
                      aria-grabbed={isDragging ? true : undefined}
                      title={canDrag ? labels.reorderColumn : undefined}
                      onPointerDown={
                        enableColumnReorder
                          ? (event) =>
                              onHeaderPointerDown(event, {
                                columnId: header.column.id,
                                leafIds,
                                canDrag,
                              })
                          : undefined
                      }
                      style={
                        Object.keys(headerStyle).length > 0
                          ? headerStyle
                          : undefined
                      }
                      className={cn(
                        "data-table-head-cell",
                        freezeOffset &&
                          `data-table-head-cell--frozen-${freezeOffset.side}`,
                        CELL_ALIGN_CLASS[align],
                        classNames?.headCell,
                        dropEdge && classNames?.dropEdge,
                        headerClassName,
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {canResize ? (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={labels.resizeColumn}
                          data-table-disable-cell-selection=""
                          className={cn(
                            "data-table-resize-handle",
                            classNames?.resizeHandle,
                          )}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => {
                            header.column.resetSize();
                          }}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <DataTableContextProvider value={contextValue}>
            <tbody
              onMouseLeave={clearHover}
              className={cn("data-table-body", classNames?.body)}
            >
              {rows.length === 0 ? (
                <EmptySlot
                  emptyText={emptyText}
                  columnCount={columnCount}
                  classNames={classNames}
                />
              ) : shouldVirtualize ? (
                <>
                  {paddingTop > 0 && (
                    <tr
                      aria-hidden
                      className={cn(
                        "data-table-virtual-spacer",
                        classNames?.virtualSpacer,
                      )}
                    >
                      <td
                        colSpan={columnCount}
                        style={{ height: paddingTop }}
                        className={cn(
                          "data-table-virtual-spacer-cell",
                          classNames?.virtualSpacerCell,
                        )}
                      />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) return null;

                    return (
                      <RowSlot
                        key={row.id}
                        row={row}
                        virtualIndex={virtualRow.index}
                        measureElement={rowVirtualizer.measureElement}
                        onToggleSelect={() => handleToggleSelect(row)}
                      />
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr
                      aria-hidden
                      className={cn(
                        "data-table-virtual-spacer",
                        classNames?.virtualSpacer,
                      )}
                    >
                      <td
                        colSpan={columnCount}
                        style={{ height: paddingBottom }}
                        className={cn(
                          "data-table-virtual-spacer-cell",
                          classNames?.virtualSpacerCell,
                        )}
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
      </ScrollSlot>
    </div>
  );
}

export { DataTable };
export type { DataTableProps };
