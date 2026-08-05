import type { Row } from "@tanstack/react-table"
import type { ReactNode } from "react"

/**
 * Built-in cell kinds inspired by Glide Data Grid All Cell Kinds.
 * Custom kinds are plain strings registered via `cellRenderers`.
 */
export type BuiltinCellKind =
  | "text"
  | "number"
  | "boolean"
  | "uri"
  | "image"
  | "bubble"
  | "markdown"
  | "drilldown"
  | "loading"
  | "protected"
  | "row-id"

export type CellKind = BuiltinCellKind | (string & {})

export type CellRenderContext<
  T extends Record<string, unknown> = Record<string, unknown>,
  V = unknown,
> = {
  value: V
  row: Row<T>
  index: number
  columnId: string
  /** Kind-specific props from `Column.cellProps` / `meta.cellProps` */
  cellProps?: Record<string, unknown>
  /**
   * Commit a cell value through the table's `onCellChange` / `onDataChange` pipeline.
   * Prefer this over calling `setData` directly from custom renders.
   */
  update: (next: V) => void
}

export type CellRenderer<
  T extends Record<string, unknown> = Record<string, unknown>,
  V = unknown,
> = {
  kind: CellKind
  render: (ctx: CellRenderContext<T, V>) => ReactNode
  /** Optional extra match when resolving custom renderers */
  isMatch?: (ctx: CellRenderContext<T, V>) => boolean
}

export type CellRenderFn<
  T extends Record<string, unknown> = Record<string, unknown>,
  V = unknown,
> = (ctx: CellRenderContext<T, V>) => ReactNode
