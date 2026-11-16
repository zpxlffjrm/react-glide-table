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
 * One plain string per cell, shared by clipboard copy and default display.
 * Avoids `String(object)` → `[object Object]`, joins arrays with `, ` and
 * writes dates as ISO strings (not JSON-quoted).
 */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ""

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatCellValue(item))
      .filter((item) => item.length > 0)
      .join(", ")
  }

  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>)
  }

  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }

  return ""
}
