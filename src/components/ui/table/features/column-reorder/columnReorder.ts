import type { ColumnDef } from "@tanstack/react-table"

export type ColumnDropEdge = "before" | "after"

export type ColumnGroupSlot<T> = {
  id: string
  def: ColumnDef<T, unknown>
}

export type ColumnLeafSlot<T> = {
  id: string
  def: ColumnDef<T, unknown>
  group?: ColumnGroupSlot<T>
}

export function getColumnDefId<T>(
  column: ColumnDef<T, unknown>,
): string | undefined {
  if (column.id != null && column.id !== "") return column.id
  if ("accessorKey" in column && column.accessorKey != null) {
    return String(column.accessorKey)
  }

  return undefined
}

function getColumnDefChildren<T>(
  column: ColumnDef<T, unknown>,
): ColumnDef<T, unknown>[] | undefined {
  if (!("columns" in column) || !Array.isArray(column.columns)) return undefined
  if (column.columns.length === 0) return undefined

  return column.columns as ColumnDef<T, unknown>[]
}

export function collectLeafColumnIds<T>(
  columns: readonly ColumnDef<T, unknown>[],
): string[] {
  const ids: string[] = []

  for (const column of columns) {
    const children = getColumnDefChildren(column)
    if (children) {
      ids.push(...collectLeafColumnIds(children))
      continue
    }

    const id = getColumnDefId(column)
    if (id) ids.push(id)
  }

  return ids
}

export function areColumnOrdersEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false

  return left.every((id, index) => id === right[index])
}

/** Keep known ids in the given order and append any new leaves at the end. */
export function resolveLeafColumnOrder<T>(
  columns: readonly ColumnDef<T, unknown>[],
  order: readonly string[] | undefined,
): string[] {
  const leafIds = collectLeafColumnIds(columns)
  if (!order?.length) return leafIds

  const leafSet = new Set(leafIds)
  const seen = new Set<string>()
  const next = order.filter((id) => {
    if (!leafSet.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })

  for (const id of leafIds) {
    if (!seen.has(id)) next.push(id)
  }

  return next
}

export function flattenColumnSlots<T>(
  columns: readonly ColumnDef<T, unknown>[],
  group?: ColumnGroupSlot<T>,
): ColumnLeafSlot<T>[] {
  const slots: ColumnLeafSlot<T>[] = []

  for (const column of columns) {
    const id = getColumnDefId(column)
    const children = getColumnDefChildren(column)

    if (children) {
      const nestedGroup: ColumnGroupSlot<T> | undefined = id
        ? { id, def: column }
        : group
      slots.push(...flattenColumnSlots(children, nestedGroup))
      continue
    }

    if (!id) continue
    slots.push({ id, def: column, group })
  }

  return slots
}

export function rebuildColumnTree<T>(
  slots: readonly ColumnLeafSlot<T>[],
): ColumnDef<T, unknown>[] {
  const result: ColumnDef<T, unknown>[] = []
  let index = 0

  while (index < slots.length) {
    const slot = slots[index]!

    if (!slot.group) {
      result.push(slot.def)
      index += 1
      continue
    }

    const groupId = slot.group.id
    const children: ColumnDef<T, unknown>[] = []

    while (index < slots.length && slots[index]?.group?.id === groupId) {
      children.push(slots[index]!.def)
      index += 1
    }

    const firstChildId = children[0] ? getColumnDefId(children[0]) : groupId

    result.push({
      ...slot.group.def,
      id: `${groupId}::${firstChildId}`,
      columns: children,
    })
  }

  return result
}

/**
 * Reorder nested `ColumnDef`s by leaf id list.
 * Consecutive leaves that still share a parent group stay wrapped together;
 * interleaved groups split (Glide-style).
 */
export function applyLeafColumnOrder<T>(
  columns: readonly ColumnDef<T, unknown>[],
  order: readonly string[] | undefined,
): ColumnDef<T, unknown>[] {
  const resolved = resolveLeafColumnOrder(columns, order)
  const defaultOrder = collectLeafColumnIds(columns)
  if (areColumnOrdersEqual(resolved, defaultOrder)) {
    return columns as ColumnDef<T, unknown>[]
  }

  const byId = new Map(
    flattenColumnSlots(columns as ColumnDef<T, unknown>[]).map((slot) => [
      slot.id,
      slot,
    ]),
  )
  const ordered: ColumnLeafSlot<T>[] = []

  for (const id of resolved) {
    const slot = byId.get(id)
    if (slot) ordered.push(slot)
  }

  return rebuildColumnTree(ordered)
}

export function moveColumnIds(
  order: readonly string[],
  fromIds: readonly string[],
  targetIds: readonly string[],
  edge: ColumnDropEdge,
): string[] {
  if (fromIds.length === 0 || targetIds.length === 0) return [...order]

  const fromSet = new Set(fromIds)
  if (targetIds.some((id) => fromSet.has(id))) return [...order]

  const rest = order.filter((id) => !fromSet.has(id))
  const anchorId =
    edge === "before" ? targetIds[0]! : targetIds[targetIds.length - 1]!
  const anchorIndex = rest.indexOf(anchorId)
  if (anchorIndex < 0) return [...order]

  const insertAt = edge === "before" ? anchorIndex : anchorIndex + 1

  return [...rest.slice(0, insertAt), ...fromIds, ...rest.slice(insertAt)]
}

export function resolveDropEdge(
  clientX: number,
  rect: Pick<DOMRect, "left" | "width">,
): ColumnDropEdge {
  return clientX < rect.left + rect.width / 2 ? "before" : "after"
}

export function parseReorderIds(value: string | null | undefined): string[] {
  if (!value) return []

  return value.split(",").filter(Boolean)
}

export function serializeReorderIds(ids: readonly string[]): string {
  return ids.join(",")
}

export function isColumnReorderable(meta?: { reorderable?: boolean }): boolean {
  return meta?.reorderable !== false
}
