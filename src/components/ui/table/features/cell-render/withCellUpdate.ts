import type { CellContext } from "@tanstack/react-table"

/**
 * Injects `update` into a TanStack `CellContext` so `ColumnDef.cell` can commit
 * through `onCellChange` / `onDataChange` the same way compound `Column.render` does.
 */
export function withCellUpdate<
  TData extends Record<string, unknown>,
  TValue,
>(
  context: CellContext<TData, TValue>,
  commitValue: (rowId: string, columnId: string, value: unknown) => boolean,
): CellContext<TData, TValue> {
  return {
    ...context,
    update: (next: TValue) => {
      commitValue(context.row.id, context.column.id, next)
    },
  }
}
