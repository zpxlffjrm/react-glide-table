/** Cell match as `[colIndex, rowIndex]` — same order as Glide Data Grid `Item`.
 * For tree tables, `rowIndex` is the search-corpus index (includes collapsed rows).
 */
export type SearchResultItem = readonly [colIndex: number, rowIndex: number]

export type SearchStatus = {
  rowsSearched: number
  results: number
  selectedIndex: number
}

/** One searchable row, including collapsed tree descendants. */
export type SearchCorpusRow<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  /** Stable row id used to resolve the visible index after expand */
  id: string
  data: T
  /**
   * Toggle-field keys of ancestors that must be in `expandedRows`
   * for this row to become visible.
   */
  ancestorToggleKeys: string[]
}

export const INLINE_SEARCH_MAX_RESULTS = 1000
export const INLINE_SEARCH_TARGET_TICK_MS = 10
export const INLINE_SEARCH_INITIAL_STRIDE = 10

export function escapeSearchRegex(value: string): string {
  return value.replace(/([$()*+.?[\\\]^{|}-])/g, "\\$1")
}

export function createSearchRegex(query: string): RegExp | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  return new RegExp(escapeSearchRegex(trimmed), "i")
}

export function cellValueToSearchText(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => cellValueToSearchText(item) ?? "").join(" ")
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

export function formatSearchResultLabel(status: SearchStatus): string {
  const countLabel =
    status.results >= INLINE_SEARCH_MAX_RESULTS
      ? `over ${INLINE_SEARCH_MAX_RESULTS}`
      : `${status.results} result${status.results !== 1 ? "s" : ""}`

  if (status.selectedIndex >= 0 && status.results > 0) {
    return `${status.selectedIndex + 1} of ${countLabel}`
  }

  return countLabel
}

export function nextSearchIndex(selectedIndex: number, results: number): number {
  if (results <= 0) return -1
  if (selectedIndex < 0) return 0

  return (selectedIndex + 1) % results
}

export function previousSearchIndex(
  selectedIndex: number,
  results: number,
): number {
  if (results <= 0) return -1
  if (selectedIndex < 0) return results - 1

  let next = (selectedIndex - 1) % results
  if (next < 0) next += results

  return next
}

export function buildSearchMatchKey(colIndex: number, rowIndex: number): string {
  return `${colIndex}:${rowIndex}`
}

export function buildSearchMatchKeys(
  results: readonly SearchResultItem[],
): Set<string> {
  const keys = new Set<string>()
  for (const [colIndex, rowIndex] of results) {
    keys.add(buildSearchMatchKey(colIndex, rowIndex))
  }

  return keys
}

/**
 * Scan a contiguous row window for matches.
 * Returns newly found items (appended in row-major, col-major order).
 */
export function collectSearchMatchesInRange(options: {
  query: string
  startRow: number
  rowCount: number
  columnCount: number
  getCellValue: (rowIndex: number, colIndex: number) => unknown
  maxResults?: number
}): SearchResultItem[] {
  const {
    query,
    startRow,
    rowCount,
    columnCount,
    getCellValue,
    maxResults = INLINE_SEARCH_MAX_RESULTS,
  } = options

  const regex = createSearchRegex(query)
  if (!regex || rowCount <= 0 || columnCount <= 0) return []

  const matches: SearchResultItem[] = []

  for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
    const rowIndex = startRow + rowOffset
    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const text = cellValueToSearchText(getCellValue(rowIndex, colIndex))
      if (text !== undefined && regex.test(text)) {
        matches.push([colIndex, rowIndex])
        if (matches.length >= maxResults) {
          return matches
        }
      }
    }
  }

  return matches
}

export function nextSearchStride(
  currentStride: number,
  elapsedMs: number,
  targetMs = INLINE_SEARCH_TARGET_TICK_MS,
): number {
  const rounded = Math.max(elapsedMs, 1)
  const scalar = targetMs / rounded

  return Math.max(1, Math.ceil(currentStride * scalar))
}

/**
 * Flat (non-tree) search corpus — one entry per visible row.
 */
export function buildFlatSearchCorpus<T extends Record<string, unknown>>(
  rows: T[],
  getRowId: (row: T, index: number) => string,
): SearchCorpusRow<T>[] {
  return rows.map((data, index) => ({
    id: getRowId(data, index),
    data,
    ancestorToggleKeys: [],
  }))
}

/**
 * Build a search corpus that includes collapsed tree descendants.
 * Starts from root rows (`level === 0`) and walks each node's `children`.
 */
export function buildTreeSearchCorpus<T extends Record<string, unknown>>(
  visibleRows: T[],
  options: {
    toggleField: string
    getRowId: (row: T, index: number) => string
  },
): SearchCorpusRow<T>[] {
  const { toggleField, getRowId } = options
  const corpus: SearchCorpusRow<T>[] = []
  const seen = new Set<string>()

  const walk = (node: T, ancestorToggleKeys: string[]) => {
    const id = getRowId(node, corpus.length)
    if (seen.has(id)) return
    seen.add(id)

    corpus.push({
      id,
      data: node,
      ancestorToggleKeys,
    })

    const children = node.children
    if (!Array.isArray(children) || children.length === 0) return

    const toggleValue = node[toggleField]
    const childAncestors =
      typeof toggleValue === "string" && toggleValue.length > 0
        ? [...ancestorToggleKeys, toggleValue]
        : ancestorToggleKeys

    for (const child of children) {
      if (child && typeof child === "object") {
        walk(child as T, childAncestors)
      }
    }
  }

  for (const row of visibleRows) {
    const level = row.level
    if (level === 0 || level === undefined) {
      walk(row, [])
    }
  }

  // Orphans / non-root visible rows not reached via a level-0 walk.
  for (const row of visibleRows) {
    const id = getRowId(row, corpus.length)
    if (seen.has(id)) continue
    walk(row, [])
  }

  return corpus
}

/**
 * Map corpus-indexed search results onto currently visible row indices for highlighting.
 */
export function mapSearchResultsToVisibleKeys(
  results: readonly SearchResultItem[],
  corpus: readonly SearchCorpusRow[],
  visibleRowIndexById: Map<string, number>,
): Set<string> {
  const keys = new Set<string>()

  for (const [colIndex, corpusRowIndex] of results) {
    const corpusRow = corpus[corpusRowIndex]
    if (!corpusRow) continue

    const visibleRowIndex = visibleRowIndexById.get(corpusRow.id)
    if (visibleRowIndex === undefined) continue

    keys.add(buildSearchMatchKey(colIndex, visibleRowIndex))
  }

  return keys
}

export function mapSearchResultToVisibleItem(
  item: SearchResultItem,
  corpus: readonly SearchCorpusRow[],
  visibleRowIndexById: Map<string, number>,
): SearchResultItem | null {
  const [colIndex, corpusRowIndex] = item
  const corpusRow = corpus[corpusRowIndex]
  if (!corpusRow) return null

  const visibleRowIndex = visibleRowIndexById.get(corpusRow.id)
  if (visibleRowIndex === undefined) return null

  return [colIndex, visibleRowIndex]
}

export function collectAncestorKeysToExpand(
  corpusRow: SearchCorpusRow,
  expandedRows: Set<string>,
): string[] {
  return corpusRow.ancestorToggleKeys.filter((key) => !expandedRows.has(key))
}
