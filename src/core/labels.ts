import type { ReactNode } from "react"

import {
  formatSearchResultLabel,
  type SearchStatus,
} from "@/components/ui/table/features/inline-search/inlineSearch"

export type DataTableLabels = {
  empty: string
  loading: string
  selection: (selectedCount: number) => ReactNode
  expandRow: string
  collapseRow: string
  /** Accessible label for the column resize handle */
  resizeColumn: string
  /** Accessible label for a draggable column header */
  reorderColumn: string
  /** Built-in find-in-page search overlay */
  searchPlaceholder: string
  searchResultHint: string
  searchPrevious: string
  searchNext: string
  searchClose: string
  /** Search status line ("2 of 5 results") */
  searchResultCount: (status: SearchStatus) => string
  /** Accessible label of a `kind: "protected"` cell */
  protectedCell: string
  /** Compound `Table.Pagination` buttons (the Pagination props win when set) */
  paginationPrevious: string
  paginationNext: string
  /**
   * Toolbar row count. When omitted the toolbar shows the bare numbers
   * (`filtered / total`).
   */
  count?: (filteredCount: number | undefined, totalCount: number | undefined) => ReactNode
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
  reorderColumn: "Reorder column",
  searchPlaceholder: "Search…",
  searchResultHint: "Type to search",
  searchPrevious: "Previous result",
  searchNext: "Next result",
  searchClose: "Close search",
  searchResultCount: formatSearchResultLabel,
  protectedCell: "protected",
  paginationPrevious: "Previous page",
  paginationNext: "Next page",
}

export function resolveDataTableLabels(
  partial?: Partial<DataTableLabels>,
): DataTableLabels {
  return {
    ...DEFAULT_DATA_TABLE_LABELS,
    ...partial,
  }
}
