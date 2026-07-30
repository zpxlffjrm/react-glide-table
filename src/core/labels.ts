import type { ReactNode } from "react"

export type DataTableLabels = {
  empty: string
  loading: string
  selection: (selectedCount: number) => ReactNode
  expandRow: string
  collapseRow: string
  /** Accessible label for the column resize handle */
  resizeColumn: string
}

/** Default copy. Override via the `labels` option. */
export const DEFAULT_DATA_TABLE_LABELS: DataTableLabels = {
  empty: "No data",
  loading: "Loading...",
  selection: (selectedCount) =>
    selectedCount > 0 ? `✓ ${selectedCount} selected` : null,
  expandRow: "Expand row",
  collapseRow: "Collapse row",
  resizeColumn: "Resize column",
}

export function resolveDataTableLabels(
  partial?: Partial<DataTableLabels>,
): DataTableLabels {
  return {
    ...DEFAULT_DATA_TABLE_LABELS,
    ...partial,
  }
}
