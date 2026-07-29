import type { ColumnDef, Row, RowSelectionState, Updater } from "@tanstack/react-table"
import type { ComponentType, InputHTMLAttributes, ReactNode } from "react"

import type { DataTableLabels } from "@/core/labels"

export type RowSelectionMode = "none" | "single" | "multi"

export type CellEditType = "text" | "number"
export type DataTableEditInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue"
>

export type { DataTableLabels }

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Whether this column participates in vertical row spanning */
    rowSpan?: boolean
    /** Merge key field. Falls back to the column id when omitted */
    rowSpanKey?: string
    align?: "left" | "center" | "right"
    className?: string
    headerClassName?: string
    /** When true, double-click starts inline editing */
    editable?: boolean
    /** Inline editor input type. Defaults to text */
    editType?: CellEditType
    /** Inline editor input attribute overrides */
    editInputProps?: DataTableEditInputProps
  }

  interface Row<TData> {
    /**
     * Returns whether this row's cell is inside the active drag selection.
     * - `columnId` omitted: true when any visible cell in the row is selected.
     * - `columnId` provided: checks only that column.
     */
    getIsCellDragSelected: (columnId?: string) => boolean
  }
}

export type DataTableCopyActions = {
  /** Copies the active cell selection. Defaults to visible rows only. */
  copySelection: (options?: { includeDescendants?: boolean }) => Promise<boolean>
}

export type PasteMode = "overwrite" | "insert"

export type RowsPastePayload = {
  mode: PasteMode
  /** Top-left of the active selection (visible row / col index) */
  startRow: number
  startCol: number
  /** Bottom row of the active selection (visible row index) */
  endRow: number
  /**
   * Visible row ids from `startRow` for each clipboard row (overwrite targets).
   * Shorter than `values` when the paste runs past the last visible row.
   */
  rowIds: string[]
  /**
   * Row id at `endRow` (selection bottom).
   * Use as the insert-after anchor for tree / nested data.
   */
  anchorRowId: string
  /** Visible column ids from startCol for clipboard width */
  columnIds: string[]
  /** Parsed TSV matrix (rows × cols) */
  values: string[][]
  /**
   * Relative tree depth per clipboard row (from leading tabs in subtree copy).
   * All zeros when the paste has no hierarchy markers.
   */
  depths?: number[]
}

export type DataTableProps<T extends Record<string, unknown>> = {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  rowSelectionMode?: RowSelectionMode
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (updater: Updater<RowSelectionState>) => void
  /** Total row count before filtering */
  totalCount?: number
  /** Visible row count after filtering */
  filteredCount?: number
  /** Left-side summary slot */
  summary?: ReactNode
  /** Right-side action slot */
  toolbar?: ReactNode
  /**
   * UI copy overrides.
   * Takes precedence over `emptyText` / `selectionLabel`.
   */
  labels?: Partial<DataTableLabels>
  /** @deprecated Prefer `labels.selection` */
  selectionLabel?: (selectedCount: number) => ReactNode
  isPending?: boolean
  /** @deprecated Prefer `labels.empty` */
  emptyText?: string
  /** @deprecated Prefer `labels.loading` */
  loadingText?: string
  enableRowSpan?: boolean
  getRowId?: (row: T, index: number) => string
  onRowClick?: (row: T, index: number) => void
  preserveRowSelection?: boolean
  getRowClassName?: (row: T, index: number) => string | undefined
  /** Return false to make the row unselectable (row click and checkbox) */
  getRowCanSelect?: (row: T, index: number) => boolean
  /** When false, row click does not toggle selection (checkbox-only) */
  selectOnRowClick?: boolean
  /**
   * Enable cell drag selection and fill handle. Defaults to true.
   * When false, browser text selection is allowed and cell selection UI is off.
   */
  enableCellSelection?: boolean
  /**
   * @deprecated Combining with paged/tree-transformed data can corrupt the source.
   * Prefer onCellChange / onBatchChange.
   */
  onDataChange?: (data: T[]) => void
  /** Single-cell change (edit commit). Takes precedence over onDataChange */
  onCellChange?: (rowId: string, columnId: string, value: unknown) => void
  /** Multi-cell change (fill handle, etc.). Takes precedence over onDataChange */
  onBatchChange?: (
    changes: Array<{ rowId: string; columnId: string; value: unknown }>,
  ) => void
  /**
   * Root className hook (combined with `DataTableJSX`).
   * The package ships no CSS — style these hooks yourself or leave unstyled.
   */
  className?: string
  /**
   * Per-part class hooks for Tailwind / utility CSS.
   * Combined with semantic hooks (`DataTableJSX`, `data-table-cell`, …).
   * Prefer `data-*` state variants, e.g. `row: "data-[selected]:bg-blue-600"`.
   */
  classNames?: DataTableClassNames

  /** Expand key field. Enables tree conversion / expand UI when set. Default `id` */
  toggleField?: string
  /** Child → parent reference field. Default `parentId` */
  childField?: string
  /** Nested children array field. Default `children` */
  flattenField?: string
  /** Parent quantity field used for parentCount. Default `qty` */
  qtyField?: string
  /** Expanded row key set (controlled) */
  expandedRows?: Set<string>
  onExpandedRowsChange?: (next: Set<string>) => void
  /** When true, expand is disabled (children always visible) */
  preventExpand?: boolean
  /**
   * Enables Ctrl/Cmd+Shift+C and programmatic subtree copy for collapsed tree rows.
   * Defaults to true when `toggleField` is set.
   */
  enableSubtreeCopy?: boolean
  /** Receives copy helpers once the table mounts or updates. */
  onCopyActionsReady?: (actions: DataTableCopyActions) => void
  /**
   * Clipboard paste into the active cell selection.
   * Ctrl/Cmd+V → overwrite; Ctrl/Cmd+Shift+V → insert (when `enableInsertPaste`).
   * The app applies domain conversion and data updates.
   */
  onRowsPaste?: (payload: RowsPastePayload) => void
  /**
   * Enables Ctrl/Cmd+Shift+V insert paste. Defaults to true when `onRowsPaste` is set.
   */
  enableInsertPaste?: boolean

  /**
   * Enable row virtualization. Defaults to true.
   * Forced off when enableRowSpan is true to preserve merges
   * (HTML table + spacer rows; no absolute/translateY positioning).
   */
  enableVirtualization?: boolean
  /** Estimated virtual row height in px. Default 44; refined via measureElement */
  estimateRowHeight?: number
  /** Virtualization overscan row count. Default 8 */
  virtualOverscan?: number

  /**
   * Optional UI part replacements for the unstyled DataTable renderer.
   * Use with `createTable` / `Table.Column`, or pass columns directly to `DataTable`.
   */
  slots?: DataTableSlots<T>
}

/**
 * Named class hooks for the default DataTable shell.
 * Pass Tailwind utilities directly without writing a separate CSS mapping file.
 */
export type DataTableClassNames = {
  root?: string
  pending?: string
  loadingText?: string
  toolbar?: string
  toolbarLeft?: string
  toolbarRight?: string
  toolbarCount?: string
  toolbarSelection?: string
  toolbarActions?: string
  scroll?: string
  table?: string
  head?: string
  headRow?: string
  headCell?: string
  body?: string
  emptyCell?: string
  virtualSpacer?: string
  virtualSpacerCell?: string
  row?: string
  cell?: string
  cellEditInput?: string
  expandCell?: string
  expandCellContent?: string
  expandCellIndent?: string
  expandCellValue?: string
  expandToggle?: string
  expandToggleIcon?: string
  fillHandle?: string
}

export type DataTableToolbarSlotProps = {
  filteredCount?: number
  totalCount?: number
  summary?: ReactNode
  selectedCount: number
  selectionLabel?: (selectedCount: number) => ReactNode
  toolbar?: ReactNode
  className?: string
  classNames?: Pick<
    DataTableClassNames,
    | "toolbar"
    | "toolbarLeft"
    | "toolbarRight"
    | "toolbarCount"
    | "toolbarSelection"
    | "toolbarActions"
  >
}

export type DataTableRowSlotProps<T extends Record<string, unknown>> = {
  row: Row<T>
  onToggleSelect: () => void
  virtualIndex?: number
  measureElement?: (node: Element | null) => void
}

/**
 * Slot replacements for the default DataTable shell (semantic HTML + behavior only).
 * Row-level custom UI → `Row`; cell content → `Table.Column` / column `render`.
 * Header/Cell are not split into separate slots in this contract.
 */
export type DataTableSlots<T extends Record<string, unknown>> = {
  /** Top summary / actions region */
  Toolbar?: ComponentType<DataTableToolbarSlotProps>
  /** Full row replacement (cells, selection, edit UI) */
  Row?: ComponentType<DataTableRowSlotProps<T>>
  /** Replace the pending state view */
  Pending?: ComponentType<{
    loadingText: string
    className?: string
    classNames?: Pick<DataTableClassNames, "pending" | "loadingText" | "root">
  }>
  /** Replace the empty-state cell content */
  Empty?: ComponentType<{
    emptyText: string
    columnCount: number
    classNames?: Pick<DataTableClassNames, "emptyCell">
  }>
}

export type TableColumnProps<
  T extends Record<string, unknown>,
  K extends string = keyof T & string,
> = {
  /** Column id: data field name, or an arbitrary id for virtual columns */
  field: K
  /** When true, uses id only (no accessorKey) — e.g. checkbox / No. columns */
  virtual?: boolean
  children?: ReactNode
  sortable?: boolean
  width?: number
  align?: "left" | "center" | "right"
  rowSpan?: boolean
  rowSpanKey?: string
  editable?: boolean
  editType?: CellEditType
  /** Inline editor input attribute overrides */
  editInputProps?: DataTableEditInputProps
  className?: string
  headerClassName?: string
  render?: (value: K extends keyof T ? T[K] : unknown, row: Row<T>, index: number) => ReactNode
}

export type TableProps<T extends Record<string, unknown>> = Omit<DataTableProps<T>, "columns"> & {
  children: ReactNode
}

export type { ColumnDef, RowSelectionState }
