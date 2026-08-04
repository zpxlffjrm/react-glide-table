import type { Header, HeaderGroup, RowData } from "@tanstack/react-table"

export type MergedHeader<TData extends RowData> = Header<TData, unknown> & {
  /** Effective vertical span after placeholder-chain merge */
  mergedRowSpan: number
}

export type MergedHeaderGroup<TData extends RowData> = Omit<
  HeaderGroup<TData>,
  "headers"
> & {
  headers: MergedHeader<TData>[]
}

/**
 * Collapse placeholder chains for uneven column trees so shallow leaf columns
 * render once with `rowSpan` covering the empty cells above them.
 *
 * TanStack's built-in `header.rowSpan` stays 0 for leaves in v8, so we derive
 * spans from `isPlaceholder` + header-group depth instead.
 */
export function getMergedHeaderGroups<TData extends RowData>(
  headerGroups: HeaderGroup<TData>[],
): MergedHeaderGroup<TData>[] {
  if (headerGroups.length <= 1) {
    return headerGroups.map((group) => ({
      ...group,
      headers: group.headers.map((header) => ({
        ...header,
        mergedRowSpan: 1,
      })),
    }))
  }

  const seenColumnIds = new Set<string>()
  const fullDepth = headerGroups.length

  return headerGroups.map((group, depth) => ({
    ...group,
    headers: group.headers
      .filter((header) => !seenColumnIds.has(header.column.id))
      .map((header) => {
        seenColumnIds.add(header.column.id)

        if (header.isPlaceholder) {
          return {
            ...header,
            isPlaceholder: false,
            mergedRowSpan: fullDepth - depth,
          }
        }

        return {
          ...header,
          mergedRowSpan: 1,
        }
      }),
  }))
}
