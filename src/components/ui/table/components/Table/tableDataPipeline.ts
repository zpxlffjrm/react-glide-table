export type TableSortState = {
  field: string
  direction: "asc" | "desc"
}

/** Reads `field`, following a dotted path ("address.city") when needed. */
function readField(row: Record<string, unknown>, field: string): unknown {
  if (field in row || !field.includes(".")) return row[field]

  return field.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, row)
}

export function sortTableData<T extends Record<string, unknown>>(
  data: T[],
  sort: TableSortState | null,
): T[] {
  if (!sort) return data

  const { field, direction } = sort
  const multiplier = direction === "asc" ? 1 : -1

  return [...data].sort((left, right) => {
    const leftValue = readField(left, field)
    const rightValue = readField(right, field)

    if (
      (leftValue === null || leftValue === undefined) &&
      (rightValue === null || rightValue === undefined)
    ) {
      return 0
    }
    if (leftValue === null || leftValue === undefined) return 1
    if (rightValue === null || rightValue === undefined) return -1

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * multiplier
    }

    // `numeric` orders "2" < "9" < "10" instead of by character.
    return (
      String(leftValue).localeCompare(String(rightValue), "ko", { numeric: true }) * multiplier
    )
  })
}

export function paginateTableData<T extends Record<string, unknown>>(
  data: T[],
  page: number,
  pageSize: number,
): T[] {
  // Clamp to the last page, matching what TablePagination displays.
  const lastPage = getTotalPages(data.length, pageSize)
  const safePage = Math.min(Math.max(1, page), lastPage)
  const start = (safePage - 1) * pageSize

  return data.slice(start, start + pageSize)
}

export function getTotalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1

  return Math.max(1, Math.ceil(totalCount / pageSize))
}
