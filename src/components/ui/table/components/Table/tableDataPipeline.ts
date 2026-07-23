export type TableSortState = {
  field: string
  direction: "asc" | "desc"
}

export function sortTableData<T extends Record<string, unknown>>(
  data: T[],
  sort: TableSortState | null,
): T[] {
  if (!sort) return data

  const { field, direction } = sort
  const multiplier = direction === "asc" ? 1 : -1

  return [...data].sort((left, right) => {
    const leftValue = left[field]
    const rightValue = right[field]

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

    return String(leftValue).localeCompare(String(rightValue), "ko") * multiplier
  })
}

export function paginateTableData<T extends Record<string, unknown>>(
  data: T[],
  page: number,
  pageSize: number,
): T[] {
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * pageSize

  return data.slice(start, start + pageSize)
}

export function getTotalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1

  return Math.max(1, Math.ceil(totalCount / pageSize))
}
