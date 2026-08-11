import type { CellContext } from "@tanstack/react-table"

/**
 * TanStack `CellContext` with a guaranteed `update` commit helper.
 * Prefer this over bare `cell.getContext()`, which does not include `update` at runtime.
 */
export type CellContextWithUpdate<TData, TValue> = CellContext<TData, TValue> & {
  update: (next: TValue) => void
}

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
): CellContextWithUpdate<TData, TValue> {
  return {
    ...context,
    update: (next: TValue) => {
      commitValue(context.row.id, context.column.id, next)
    },
  }
}
