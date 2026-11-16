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
  locale = "ko",
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
      String(leftValue).localeCompare(String(rightValue), locale, { numeric: true }) * multiplier
    )
  })
}

export function paginateTableData<T>(
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

export type TreeFieldNames = {
  idField: string
  parentIdField: string
}

/**
 * Flat tree rows grouped into one block per root: the root followed by all of
 * its descendants in depth-first order. Siblings are sorted with `sort`
 * (children never move out of their parent). A child attaches to the nearest
 * preceding row whose id matches its parent id, the same rule the tree
 * conversion uses, so the blocks match what the table will show.
 */
export function buildTreeRootBlocks<T extends Record<string, unknown>>(
  data: T[],
  fields: TreeFieldNames,
  sort: TableSortState | null,
  locale?: string,
): T[][] {
  const childrenByRow = new Map<T, T[]>()
  const roots: T[] = []
  const latestById = new Map<unknown, T>()

  for (const row of data) {
    const parentKey = row[fields.parentIdField]
    const parent =
      parentKey !== null && parentKey !== undefined && parentKey !== ""
        ? latestById.get(parentKey)
        : undefined

    if (parent) {
      const siblings = childrenByRow.get(parent)
      if (siblings) siblings.push(row)
      else childrenByRow.set(parent, [row])
    } else {
      roots.push(row)
    }

    latestById.set(row[fields.idField], row)
  }

  const appendSubtree = (row: T, out: T[]) => {
    out.push(row)
    const children = childrenByRow.get(row)
    if (!children) return
    for (const child of sortTableData(children, sort, locale)) {
      appendSubtree(child, out)
    }
  }

  return sortTableData(roots, sort, locale).map((root) => {
    const block: T[] = []
    appendSubtree(root, block)
    return block
  })
}
