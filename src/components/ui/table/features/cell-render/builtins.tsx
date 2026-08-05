import type { ReactNode } from "react"

import type {
  BuiltinCellKind,
  CellRenderContext,
  CellRenderer,
} from "@/components/ui/table/features/cell-render/types"

function asString(value: unknown): string {
  if (value == null) return ""
  return String(value)
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean)
  }
  if (value == null || value === "") return []
  return [asString(value)]
}

type DrilldownItem = {
  text: string
  img?: string
}

function asDrilldownItems(value: unknown): DrilldownItem[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (item == null) return []
    if (typeof item === "string") return [{ text: item }]
    if (typeof item === "object") {
      const record = item as Record<string, unknown>
      const text = asString(record.text ?? record.label ?? "")
      if (!text) return []
      const img = record.img ?? record.image
      return [{ text, ...(typeof img === "string" ? { img } : {}) }]
    }
    return [{ text: asString(item) }]
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Minimal markdown → safe HTML (bold, italic, code, line breaks). */
function simpleMarkdownToHtml(source: string): string {
  const escaped = escapeHtml(source)
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />")
}

function TextCell({ value }: CellRenderContext) {
  return asString(value)
}

function NumberCell({ value }: CellRenderContext) {
  if (value == null || value === "") return null
  return asString(value)
}

function BooleanCell({ value, update, cellProps }: CellRenderContext) {
  const checked = Boolean(value)
  const readonly = Boolean(cellProps?.readonly)

  return (
    <input
      type="checkbox"
      className="data-table-cell-boolean"
      checked={checked}
      disabled={readonly}
      aria-checked={checked}
      onChange={(event) => {
        if (readonly) return
        update(event.target.checked)
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      onMouseDown={(event) => {
        event.stopPropagation()
      }}
    />
  )
}

function UriCell({ value }: CellRenderContext) {
  const href = asString(value)
  if (!href) return null

  return (
    <a
      className="data-table-cell-uri"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {href}
    </a>
  )
}

function ImageCell({ value }: CellRenderContext) {
  const urls = asStringList(value)
  if (urls.length === 0) return null

  return (
    <span className="data-table-cell-image">
      {urls.map((url) => (
        <img key={url} src={url} alt="" className="data-table-cell-image-item" />
      ))}
    </span>
  )
}

function BubbleCell({ value }: CellRenderContext) {
  const items = asStringList(value)
  if (items.length === 0) return null

  return (
    <span className="data-table-cell-bubble">
      {items.map((item) => (
        <span key={item} className="data-table-cell-bubble-item">
          {item}
        </span>
      ))}
    </span>
  )
}

function MarkdownCell({ value }: CellRenderContext) {
  const source = asString(value)
  if (!source) return null

  return (
    <span
      className="data-table-cell-markdown"
      dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(source) }}
    />
  )
}

function DrilldownCell({ value }: CellRenderContext) {
  const items = asDrilldownItems(value)
  if (items.length === 0) return null

  return (
    <span className="data-table-cell-drilldown">
      {items.map((item) => (
        <span key={`${item.text}:${item.img ?? ""}`} className="data-table-cell-drilldown-item">
          {item.img ? (
            <img
              src={item.img}
              alt=""
              className="data-table-cell-drilldown-image"
            />
          ) : null}
          <span className="data-table-cell-drilldown-text">{item.text}</span>
        </span>
      ))}
    </span>
  )
}

function LoadingCell() {
  return <span className="data-table-cell-loading" aria-busy="true" />
}

function ProtectedCell() {
  return (
    <span className="data-table-cell-protected" aria-label="protected">
      ****
    </span>
  )
}

function RowIdCell({ value }: CellRenderContext) {
  return <span className="data-table-cell-row-id">{asString(value)}</span>
}

const BUILTIN_RENDER_MAP: Record<
  BuiltinCellKind,
  (ctx: CellRenderContext) => ReactNode
> = {
  text: TextCell,
  number: NumberCell,
  boolean: BooleanCell,
  uri: UriCell,
  image: ImageCell,
  bubble: BubbleCell,
  markdown: MarkdownCell,
  drilldown: DrilldownCell,
  loading: LoadingCell,
  protected: ProtectedCell,
  "row-id": RowIdCell,
}

export const BUILTIN_CELL_RENDERERS: CellRenderer[] = (
  Object.keys(BUILTIN_RENDER_MAP) as BuiltinCellKind[]
).map((kind) => ({
  kind,
  render: BUILTIN_RENDER_MAP[kind],
}))
