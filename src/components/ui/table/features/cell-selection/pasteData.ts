import type { Row } from "@tanstack/react-table"

import type { PasteMode, RowsPastePayload } from "@/components/ui/table/types"

export type { PasteMode, RowsPastePayload }

export type ParsedClipboardTSV = {
  values: string[][]
  /**
   * Relative tree depth per row when the TSV looks like subtree-copy indentation
   * (first row unindented, at least one later row with leading empty cells).
   * Otherwise all zeros — leading blanks are preserved as real cell values.
   */
  depths: number[]
}

function countLeadingEmptyCells(cells: string[]): number {
  let depth = 0
  while (depth < cells.length && cells[depth] === "") {
    depth += 1
  }

  return depth
}

/**
 * Subtree copy encodes depth as leading empty TSV cells under an unindented root row.
 * Plain Excel/Sheets pastes can also start with `\t` when the first column is blank —
 * those must keep empty cells and depth 0 so column alignment stays correct.
 */
function looksLikeSubtreeIndentation(leadingEmptyCounts: number[]): boolean {
  if (leadingEmptyCounts.length === 0) return false

  const firstDepth = leadingEmptyCounts[0] ?? 0
  if (firstDepth !== 0) return false

  return leadingEmptyCounts.some((depth) => depth > 0)
}

/** Parse Excel/Sheets-style TSV from the clipboard. Trailing newlines are ignored. */
export function parseClipboardTSV(text: string): string[][] {
  return parseClipboardTSVWithDepths(text).values
}

/**
 * Parse TSV and recover relative tree depth from leading tabs
 * (encoded by subtree copy as leading empty cells).
 */
export function parseClipboardTSVWithDepths(text: string): ParsedClipboardTSV {
  if (!text) return { values: [], depths: [] }

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const withoutTrailing = normalized.replace(/\n+$/, "")
  if (!withoutTrailing) return { values: [], depths: [] }

  const rows = withoutTrailing.split("\n").map((line) => line.split("\t"))
  const leadingEmptyCounts = rows.map(countLeadingEmptyCells)
  const treatAsDepth = looksLikeSubtreeIndentation(leadingEmptyCounts)

  const values: string[][] = []
  const depths: number[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const cells = rows[index] ?? []
    const depth = leadingEmptyCounts[index] ?? 0

    if (treatAsDepth) {
      values.push(cells.slice(depth))
      depths.push(depth)
    } else {
      values.push(cells)
      depths.push(0)
    }
  }

  return { values, depths }
}

/** Resolve visible column ids starting at `startCol` for `width` columns. */
export function resolvePasteColumnIds<T extends Record<string, unknown>>(
  rows: Row<T>[],
  startCol: number,
  width: number,
): string[] {
  if (width <= 0) return []

  const cells = rows[0]?.getVisibleCells() ?? []
  const columnIds: string[] = []

  for (let offset = 0; offset < width; offset += 1) {
    const cell = cells[startCol + offset]
    if (!cell) break
    columnIds.push(cell.column.id)
  }

  return columnIds
}

export function buildRowsPastePayload<T extends Record<string, unknown>>(
  rows: Row<T>[],
  startRow: number,
  startCol: number,
  text: string,
  mode: PasteMode,
  endRow: number = startRow,
): RowsPastePayload | null {
  const { values, depths } = parseClipboardTSVWithDepths(text)
  if (values.length === 0) return null

  const width = Math.max(...values.map((row) => row.length), 0)
  if (width === 0) return null

  const columnIds = resolvePasteColumnIds(rows, startCol, width)
  if (columnIds.length === 0) return null

  const rowIds: string[] = []
  for (let offset = 0; offset < values.length; offset += 1) {
    const row = rows[startRow + offset]
    if (!row) break
    rowIds.push(row.id)
  }

  const anchorRow = rows[endRow] ?? rows[startRow]

  return {
    mode,
    startRow,
    startCol,
    endRow,
    rowIds,
    anchorRowId: anchorRow?.id ?? "",
    columnIds,
    values,
    depths,
  }
}

export function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true

  return Boolean(target.isContentEditable)
}
