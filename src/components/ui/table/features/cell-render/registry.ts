import { BUILTIN_CELL_RENDERERS } from "@/components/ui/table/features/cell-render/builtins"
import type {
  CellKind,
  CellRenderContext,
  CellRenderer,
} from "@/components/ui/table/features/cell-render/types"

export type CellRendererRegistry = Map<string, CellRenderer>

/** Later entries with the same `kind` override earlier ones (including builtins). */
export function createCellRendererRegistry(
  customRenderers: readonly CellRenderer[] = [],
): CellRendererRegistry {
  const registry: CellRendererRegistry = new Map()

  for (const renderer of BUILTIN_CELL_RENDERERS) {
    registry.set(renderer.kind, renderer)
  }

  for (const renderer of customRenderers) {
    registry.set(renderer.kind, renderer as CellRenderer)
  }

  return registry
}

export function resolveCellRenderer<T extends Record<string, unknown>>(
  registry: CellRendererRegistry,
  kind: CellKind | undefined,
  ctx: CellRenderContext<T>,
): CellRenderer | undefined {
  if (!kind) return undefined

  const renderer = registry.get(kind)
  if (!renderer) return undefined

  if (
    renderer.isMatch &&
    !renderer.isMatch(ctx as CellRenderContext<Record<string, unknown>>)
  ) {
    return undefined
  }

  return renderer
}

export function formatDefaultCellValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (typeof value === "bigint") return value.toString()
  return String(value)
}
