import type { ColumnDef, Row } from "@tanstack/react-table"
import { isValidElement, type ReactElement, type ReactNode } from "react"

import { resolveCellRenderer } from "@/components/ui/table/features/cell-render/registry"
import type { CellRendererRegistry } from "@/components/ui/table/features/cell-render/registry"
import type {
  CellKind,
  CellRenderContext,
  CellRenderFn,
} from "@/components/ui/table/features/cell-render/types"
import type { CellSelectionBounds } from "@/components/ui/table/features/cell-selection/cellSelection"
import type { ColumnCopyValue } from "@/components/ui/table/types"

export type CopySelectionMode = "visible" | "subtree"

export type CopyRowEntry<T extends Record<string, unknown>> = {
  row: T
  /** Tree depth relative to the table root (0 = top-level). */
  depth: number
}

/**
 * `registry` resolves `meta.kind` renderers (built-ins like `protected`, plus
 * custom `cellRenderers`) so copy text matches the visible cell instead of the
 * raw value. `root` scopes the DOM image-url lookup to one table when several
 * are mounted at once.
 */
export type CopyRenderOptions = {
  registry?: CellRendererRegistry
  root?: ParentNode | null
}

type ColumnCopyMeta = {
  cellRender?: CellRenderFn<Record<string, unknown>>
  cellProps?: Record<string, unknown>
  kind?: CellKind
  copyValue?: ColumnCopyValue
}

function isReactNodeIterable(node: ReactNode): node is Iterable<ReactNode> {
  return (
    typeof node === "object" &&
    node !== null &&
    !isValidElement(node) &&
    Symbol.iterator in node
  )
}

function getElementTypeName(type: unknown): string {
  if (typeof type === "string") return type

  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string }
    return fn.displayName || fn.name || ""
  }

  if (typeof type === "object" && type !== null) {
    const component = type as {
      displayName?: string
      render?: { displayName?: string; name?: string }
    }
    return (
      component.displayName ||
      component.render?.displayName ||
      component.render?.name ||
      ""
    )
  }

  return ""
}

function isButtonReactElement(node: ReactElement): boolean {
  const typeName = getElementTypeName(node.type)
  if (typeName === "button" || /button/i.test(typeName)) return true

  const props = node.props as { role?: unknown; type?: unknown }
  if (props.role === "button") return true
  if (typeName === "input" && props.type === "button") return true

  return false
}

function isImageReactElement(node: ReactElement): boolean {
  const typeName = getElementTypeName(node.type)
  return typeName === "img" || typeName === "image" || /image/i.test(typeName)
}

const IMAGE_URL_PROP_KEYS = ["src", "url", "href", "imageUrl", "srcUrl"] as const

function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^(https?:|blob:|data:|\/\/)/i.test(trimmed)) return true
  if (trimmed.startsWith("/") && trimmed.includes("/")) return true
  return false
}

function pickUrlFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return isLikelyUrl(value) ? value.trim() : ""
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => pickUrlFromUnknown(item))
      .filter((item) => item.length > 0)
      .join(", ")
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of IMAGE_URL_PROP_KEYS) {
      const candidate = record[key]
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim()
      }
    }
  }

  return ""
}

function imageElementText(node: ReactElement): string {
  const props = node.props as Record<string, unknown>
  for (const key of IMAGE_URL_PROP_KEYS) {
    const candidate = props[key]
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }
  return ""
}

function reactNodeContainsImage(node: ReactNode): boolean {
  if (isValidElement(node)) {
    if (isImageReactElement(node)) return true
    return reactNodeContainsImage((node.props as { children?: ReactNode }).children)
  }

  if (isReactNodeIterable(node)) {
    for (const child of node) {
      if (reactNodeContainsImage(child)) return true
    }
  }

  return false
}

function readImgUrl(img: Element): string {
  const attr = img.getAttribute("src")?.trim() ?? ""
  if (attr) return attr

  if (img instanceof HTMLImageElement) {
    const current = img.currentSrc?.trim() ?? ""
    if (current && current !== img.baseURI) return current
  }

  return ""
}

/**
 * `root` scopes the lookup to one table's DOM subtree. Without it, a
 * row/col-index match on another table mounted on the same page can return
 * that table's image instead (index pairs aren't globally unique).
 */
function readDomImageUrls(
  rowIndex: number,
  colIndex: number,
  root?: ParentNode | null,
): string {
  const scope: ParentNode | null =
    root ?? (typeof document === "undefined" ? null : document)
  if (!scope) return ""

  const cells = scope.querySelectorAll(
    `[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`,
  )

  for (const cell of cells) {
    const urls = Array.from(cell.querySelectorAll("img")).flatMap((img) => {
      const url = readImgUrl(img)
      return url ? [url] : []
    })

    if (urls.length > 0) return urls.join(", ")
  }

  return ""
}

/**
 * Collects visible text from a render result without mounting components.
 * Host/custom elements contribute `children`, then image `src` / `url`.
 * Button hosts and `*Button*` components are omitted from clipboard text.
 */
export function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return String(node)
  }

  if (isReactNodeIterable(node)) {
    let text = ""
    for (const child of node) {
      text += reactNodeToText(child)
    }
    return text
  }

  if (isValidElement(node)) {
    if (isButtonReactElement(node)) return ""

    const props = node.props as {
      children?: ReactNode
      alt?: unknown
      title?: unknown
    }
    const childText = reactNodeToText(props.children)
    if (childText) return childText

    const fromImage = imageElementText(node)
    if (fromImage) return fromImage
    if (isImageReactElement(node)) return ""
    if (typeof props.alt === "string" && props.alt) return props.alt
    if (typeof props.title === "string" && props.title) return props.title
    return ""
  }

  return ""
}

function sanitizeClipboardCell(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function createCopyRenderRow<T extends Record<string, unknown>>(
  rowData: T,
  index: number,
): Row<T> {
  return {
    id: getOriginalRowId(rowData) || String(index),
    index,
    original: rowData,
    getIsCellDragSelected: () => false,
  } as unknown as Row<T>
}

function buildVisibleRowLookup<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
): Map<T, Row<T>> {
  const lookup = new Map<T, Row<T>>()
  for (const row of visibleRows) {
    lookup.set(row.original, row)
  }
  return lookup
}

function resolveCopyColumnId(cell: {
  column: { id?: string; columnDef: { id?: string; accessorKey?: unknown } }
}): string {
  if (cell.column.id) return cell.column.id

  const columnDef = cell.column.columnDef
  if (columnDef.id) return columnDef.id
  if (columnDef.accessorKey != null && columnDef.accessorKey !== "") {
    return String(columnDef.accessorKey)
  }

  return ""
}

/** Array/object values (bubble tags, drilldown chips, …) keep `formatCellValue`'s
 * `, `-joined text — rendering them would lose that separator (each item
 * becomes its own sibling element with no delimiter between them). */
function isPrimitiveCopyValue(value: unknown): boolean {
  return value == null || typeof value !== "object"
}

/** Shared by both render sources: extract clipboard text from a rendered node,
 * preferring a DOM/rendered image URL when the node contains one. */
function extractRenderedCopyText(
  node: ReactNode,
  value: unknown,
  cellPosition: { rowIndex: number; colIndex: number } | undefined,
  root: ParentNode | null | undefined,
): string {
  const rendered = sanitizeClipboardCell(reactNodeToText(node))
  if (reactNodeContainsImage(node)) {
    const fromDom =
      cellPosition != null
        ? sanitizeClipboardCell(
            readDomImageUrls(cellPosition.rowIndex, cellPosition.colIndex, root),
          )
        : ""
    if (fromDom) return fromDom
    if (rendered && isLikelyUrl(rendered)) return rendered
    return sanitizeClipboardCell(pickUrlFromUnknown(value))
  }

  return rendered
}

function formatCopyCellText<T extends Record<string, unknown>>(
  rowData: T,
  columnDef: ColumnDef<unknown, unknown>,
  columnId: string,
  visibleRow: Row<T> | undefined,
  fallbackIndex: number,
  sourceCell?: { getValue: () => unknown },
  cellPosition?: { rowIndex: number; colIndex: number },
  options?: CopyRenderOptions,
): string {
  const meta = columnDef.meta as ColumnCopyMeta | undefined
  const value = sourceCell
    ? sourceCell.getValue()
    : readRowColumnValue(rowData, columnDef)

  const row = visibleRow ?? createCopyRenderRow(rowData, fallbackIndex)
  const ctx = {
    value,
    row: row as Row<Record<string, unknown>>,
    index: row.index,
    columnId,
    cellProps: meta?.cellProps,
    update: () => {},
  } as CellRenderContext

  const copyValue = meta?.copyValue
  if (typeof copyValue === "function") {
    try {
      return sanitizeClipboardCell(copyValue(ctx))
    } catch {
      return formatCellValue(value)
    }
  }

  if (copyValue === "value") {
    return formatCellValue(value)
  }

  // copyValue === "display" | undefined → prefer rendered text when available
  const cellRender = meta?.cellRender
  if (typeof cellRender === "function") {
    try {
      const node = cellRender(ctx)
      return extractRenderedCopyText(node, value, cellPosition, options?.root)
    } catch {
      return formatCellValue(value)
    }
  }

  // No explicit `cellRender`: resolve the same `meta.kind` renderer registry
  // `ResolvedTableCell` uses (built-ins like `protected`, plus custom
  // `cellRenderers`), so copy text matches what the cell actually shows
  // instead of the raw underlying value (e.g. a masked secret).
  if (options?.registry && meta?.kind && isPrimitiveCopyValue(value)) {
    try {
      const renderer = resolveCellRenderer(options.registry, meta.kind, ctx)
      if (renderer) {
        const node = renderer.render(ctx)
        const rendered = extractRenderedCopyText(node, value, cellPosition, options.root)
        // Kinds with no extractable text (a bare checkbox, a loading
        // spinner) fall back to the raw value rather than copying "".
        if (rendered) return rendered
      }
    } catch {
      return formatCellValue(value)
    }
  }

  return formatCellValue(value)
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }

  return ""
}

/** Prefer display fields used by drilldown / similar object cell values. */
function formatObjectValue(value: Record<string, unknown>): string {
  const text = value.text ?? value.label ?? value.name ?? value.title
  if (text != null && text !== "") {
    return formatCellValue(text)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

/**
 * Clipboard / Excel paste expects one plain string per cell.
 * Avoids `String(object)` → `[object Object]` and joins arrays with `, `.
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  if (Array.isArray(value)) {
    return value
      .map((item) => formatCellValue(item))
      .filter((item) => item.length > 0)
      .join(", ")
  }

  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>)
  }

  return formatPrimitive(value)
}

function getNestedValue(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return row[path]

  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, row)
}

function readRowColumnValue(
  rowData: Record<string, unknown>,
  columnDef: ColumnDef<unknown, unknown>,
): unknown {
  if ("accessorFn" in columnDef && typeof columnDef.accessorFn === "function") {
    return columnDef.accessorFn(rowData, 0)
  }

  if ("accessorKey" in columnDef && columnDef.accessorKey != null && columnDef.accessorKey !== "") {
    return getNestedValue(rowData, String(columnDef.accessorKey))
  }

  return undefined
}

export function flattenSubtreeRows<T extends Record<string, unknown>>(row: T): T[] {
  const children = row.children
  if (!Array.isArray(children) || children.length === 0) return []

  const result: T[] = []

  const walk = (nodes: T[]) => {
    for (const node of nodes) {
      result.push(node)

      const nested = node.children
      if (Array.isArray(nested) && nested.length > 0) {
        walk(nested as T[])
      }
    }
  }

  walk(children as T[])

  return result
}

function hasSubtree(row: Record<string, unknown>): boolean {
  const children = row.children

  return Array.isArray(children) && children.length > 0
}

function getOriginalRowId(original: Record<string, unknown>): string {
  return String(original.id ?? original.uniqueId ?? "")
}

function getRowDepth(original: Record<string, unknown>): number {
  return typeof original.level === "number" ? original.level : 0
}

/**
 * Collects copy rows with tree depth so paste can rebuild parent/child nesting.
 * Descendant depth is derived from the walk, not only from `level`.
 */
export function collectCopyRowEntries<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): CopyRowEntry<T>[] {
  const { startRow, endRow } = bounds
  const result: CopyRowEntry<T>[] = []
  const includedOriginalIds = new Set<string>()

  const appendSubtree = (node: T, depth: number) => {
    const children = node.children
    if (!Array.isArray(children) || children.length === 0) return

    for (const child of children as T[]) {
      const childId = getOriginalRowId(child)
      if (!(childId && includedOriginalIds.has(childId))) {
        result.push({ row: child, depth })
        if (childId) includedOriginalIds.add(childId)
      }

      appendSubtree(child, depth + 1)
    }
  }

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = visibleRows[rowIndex]
    if (!row) continue

    const originalId = getOriginalRowId(row.original)
    if (originalId && includedOriginalIds.has(originalId)) continue

    const depth = getRowDepth(row.original)
    result.push({ row: row.original, depth })
    if (originalId) includedOriginalIds.add(originalId)

    if (mode !== "subtree" || !hasSubtree(row.original)) continue

    appendSubtree(row.original, depth + 1)
  }

  return result
}

export function collectCopyRows<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
): T[] {
  return collectCopyRowEntries(visibleRows, bounds, mode).map((entry) => entry.row)
}

export function serializeCopyRowsToTSV<T extends Record<string, unknown>>(
  copyRows: T[],
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  depths?: number[],
  options?: CopyRenderOptions,
): string {
  if (copyRows.length === 0) return ""

  const { startCol, endCol } = bounds
  const columnCells = visibleRows[0]?.getVisibleCells().slice(startCol, endCol + 1) ?? []
  if (columnCells.length === 0) return ""

  const resolvedDepths =
    depths && depths.length === copyRows.length
      ? depths
      : copyRows.map((row) => getRowDepth(row))
  const minDepth = Math.min(...resolvedDepths)
  const visibleRowByOriginal = buildVisibleRowLookup(visibleRows)
  const copyableColumns = columnCells.flatMap((templateCell, colOffset) => {
    const meta = templateCell.column.columnDef.meta as ColumnCopyMeta | undefined
    if (meta?.copyValue === "omit") return []
    return [{ templateCell, colOffset }]
  })

  return copyRows
    .map((rowData, index) => {
      const relativeDepth = Math.max(0, (resolvedDepths[index] ?? 0) - minDepth)
      const visibleRow = visibleRowByOriginal.get(rowData)
      const matchingCells = visibleRow
        ?.getVisibleCells()
        .slice(startCol, endCol + 1)
      const line = copyableColumns
        .map(({ templateCell, colOffset }) => {
          const sourceCell = matchingCells?.[colOffset]
          const column = sourceCell?.column ?? templateCell.column

          return formatCopyCellText(
            rowData,
            column.columnDef as ColumnDef<unknown, unknown>,
            resolveCopyColumnId(sourceCell ?? templateCell),
            visibleRow,
            visibleRow?.index ?? index,
            sourceCell,
            visibleRow != null
              ? { rowIndex: visibleRow.index, colIndex: startCol + colOffset }
              : undefined,
            options,
          )
        })
        .join("\t")

      return `${"\t".repeat(relativeDepth)}${line}`
    })
    .join("\n")
}

export function serializeSelectionToTSV<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
  options?: CopyRenderOptions,
): string {
  const entries = collectCopyRowEntries(visibleRows, bounds, mode)

  return serializeCopyRowsToTSV(
    entries.map((entry) => entry.row),
    visibleRows,
    bounds,
    entries.map((entry) => entry.depth),
    options,
  )
}

export async function writeSelectionToClipboard<T extends Record<string, unknown>>(
  visibleRows: Row<T>[],
  bounds: CellSelectionBounds,
  mode: CopySelectionMode = "visible",
  options?: CopyRenderOptions,
): Promise<boolean> {
  const text = serializeSelectionToTSV(visibleRows, bounds, mode, options)
  if (!text) return false

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return false
  }

  return true
}
