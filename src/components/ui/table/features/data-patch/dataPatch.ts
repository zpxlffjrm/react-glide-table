/**
 * Maps a row the table renders back to its position in the consumer's
 * original `data`, so every `onDataChange` write patches the full original
 * array instead of the flattened / sorted / paged rows the table shows.
 */

/**
 * Hidden marker the tree conversion attaches to every row it builds.
 * A symbol keeps it out of `Object.keys` / JSON, while object spread still
 * carries it through the later copies the tree pipeline makes.
 */
export const TREE_SOURCE = Symbol("react-glide-table.treeSource")

export type TreeSource = {
  /** `[index in data, index in children, index in grandchildren, …]` */
  path: readonly number[]
  /** Field that holds nested children in the original data. */
  childrenField: string
}

export function getTreeSource(row: unknown): TreeSource | undefined {
  if (!row || typeof row !== "object") return undefined

  return (row as { [TREE_SOURCE]?: TreeSource })[TREE_SOURCE]
}

/** Stable key for a tree row: its path in the original (possibly nested) data. */
export function getTreeRowKey(row: unknown): string | undefined {
  const source = getTreeSource(row)
  if (!source) return undefined

  return `tree:${source.path.join(".")}`
}

/**
 * Immutable write of `value` at `accessorKey`. A dotted key (`"address.city"`)
 * writes the nested field, matching how TanStack reads a dotted `accessorKey`.
 */
export function setValueAtAccessor<T extends Record<string, unknown>>(
  record: T,
  accessorKey: string,
  value: unknown,
): T {
  if (!accessorKey.includes(".") || accessorKey in record) {
    return { ...record, [accessorKey]: value }
  }

  const [head, ...rest] = accessorKey.split(".")
  const current = record[head as keyof T]
  const child =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {}

  return {
    ...record,
    [head as string]: setValueAtAccessor(child, rest.join("."), value),
  }
}

export type CellDataChange<T> = {
  /** `row.original` of the rendered row being written. */
  original: T
  /** `row.index`: position in the array the table was given. */
  index: number
  accessorKey: string
  value: unknown
}

function patchAtPath(
  nodes: readonly unknown[],
  path: readonly number[],
  childrenField: string,
  accessorKey: string,
  value: unknown,
): unknown[] | null {
  const [head, ...rest] = path
  if (head === undefined || head < 0 || head >= nodes.length) return null

  const node = nodes[head]
  if (!node || typeof node !== "object") return null

  const record = node as Record<string, unknown>
  let nextNode: Record<string, unknown>

  if (rest.length === 0) {
    nextNode = setValueAtAccessor(record, accessorKey, value)
  } else {
    const children = record[childrenField]
    if (!Array.isArray(children)) return null

    const nextChildren = patchAtPath(children, rest, childrenField, accessorKey, value)
    if (!nextChildren) return null

    nextNode = { ...record, [childrenField]: nextChildren }
  }

  const next = nodes.slice()
  next[head] = nextNode

  return next
}

/**
 * Apply cell writes to the consumer's original `data`. Only the rows (and,
 * for nested trees, the ancestors) that change are copied; every other row
 * keeps its identity, so callers can tell which rows were touched.
 */
export function applyCellChangesToData<T extends Record<string, unknown>>(
  data: readonly T[],
  changes: readonly CellDataChange<T>[],
): T[] {
  let next = data as unknown[]

  for (const change of changes) {
    const source = getTreeSource(change.original)
    const path = source ? source.path : [change.index]
    const childrenField = source?.childrenField ?? ""
    const patched = patchAtPath(next, path, childrenField, change.accessorKey, change.value)
    if (patched) next = patched
  }

  return (next === data ? data.slice() : next) as T[]
}
