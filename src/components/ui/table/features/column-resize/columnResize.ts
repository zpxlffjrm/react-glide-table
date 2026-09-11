import type { CSSProperties } from "react";

import { DATA_TABLE_COLUMN_SIZE } from "@/components/ui/table/constants";

type ColumnSizeStyleOptions = {
  force?: boolean;
  lockMax?: boolean;
  /** CSS min-width for the cell. Ignored when `lockMax` is on. */
  minWidth?: number;
  /** CSS max-width for the cell. Ignored when `lockMax` is on. */
  maxWidth?: number;
  /**
   * Layout-resolved width from `resolveColumnLayoutWidths`.
   * When set (and not resize-locked), applied as the cell `width`.
   */
  layoutWidth?: number;
};

export type ColumnLayoutInput = {
  id: string;
  /** Present when `Column.width` was set. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function floorOf(column: ColumnLayoutInput): number {
  return column.minWidth ?? 0;
}

function ceilOf(column: ColumnLayoutInput): number {
  return column.maxWidth ?? Number.POSITIVE_INFINITY;
}

/** Preferred size inside the min/max range — favor the top so content can fit. */
function preferOf(column: ColumnLayoutInput): number {
  const floor = floorOf(column);
  const ceil = ceilOf(column);
  const preferred = column.maxWidth ?? column.minWidth ?? 0;
  return clamp(preferred, floor, Number.isFinite(ceil) ? ceil : preferred);
}

/**
 * Resolve pixel widths for fixed and bounded columns.
 *
 * - Explicit `width` columns keep that size (clamped by min/max when set).
 * - Columns with only min/max resolve inside that range, preferring `maxWidth`
 *   so content can stay on one line when space allows.
 * - Unconstrained columns (no `width`, no min/max) are omitted so they absorb
 *   leftover space after bounded columns take their preferred size.
 * - When space is tight, bounded columns shrink toward `minWidth` first.
 */
export function resolveColumnLayoutWidths(
  containerWidth: number,
  columns: ColumnLayoutInput[],
): Map<string, number> {
  const widths = new Map<string, number>();

  const fixed: ColumnLayoutInput[] = [];
  const bounded: ColumnLayoutInput[] = [];
  let flexCount = 0;

  for (const column of columns) {
    if (column.width != null) {
      fixed.push(column);
    } else if (column.minWidth != null || column.maxWidth != null) {
      bounded.push(column);
    } else {
      flexCount += 1;
    }
  }

  let used = 0;
  for (const column of fixed) {
    let size = column.width!;
    if (column.minWidth != null) size = Math.max(size, column.minWidth);
    if (column.maxWidth != null) size = Math.min(size, column.maxWidth);
    widths.set(column.id, size);
    used += size;
  }

  if (bounded.length === 0) {
    return widths;
  }

  const boundedSizes = new Map<string, number>();
  let preferredSum = 0;
  let floorSum = 0;

  for (const column of bounded) {
    const preferred = preferOf(column);
    boundedSizes.set(column.id, preferred);
    preferredSum += preferred;
    floorSum += floorOf(column);
  }

  if (containerWidth > 0) {
    const remaining = Math.max(0, containerWidth - used);

    if (remaining >= preferredSum) {
      // Enough room for preferred (max) sizes; flex columns keep the leftover.
    } else if (remaining >= floorSum) {
      // Shrink from preferred toward floor so unconstrained columns still get a share.
      let deficit = preferredSum - remaining;
      const open = bounded.map((column) => ({
        id: column.id,
        current: boundedSizes.get(column.id)!,
        floor: floorOf(column),
      }));

      while (deficit >= 1) {
        const shrinkable = open.filter((entry) => entry.current > entry.floor);
        if (shrinkable.length === 0) break;

        const portion = Math.floor(deficit / shrinkable.length);
        const rem = deficit % shrinkable.length;
        let consumed = 0;

        for (let index = 0; index < shrinkable.length; index += 1) {
          const entry = shrinkable[index]!;
          const reduce = Math.min(
            entry.current - entry.floor,
            portion + (index < rem ? 1 : 0),
          );
          entry.current -= reduce;
          consumed += reduce;
        }

        if (consumed === 0) break;
        deficit -= consumed;
      }

      for (const entry of open) {
        boundedSizes.set(entry.id, entry.current);
      }
    } else {
      // Below floors — keep mins; table may overflow horizontally.
      for (const column of bounded) {
        boundedSizes.set(column.id, floorOf(column));
      }
    }
  }
  // Unmeasured: keep preferred (max) so content can render on one line.

  for (const [id, size] of boundedSizes) {
    widths.set(id, Math.round(size));
  }

  return widths;
}

/** Width styles for header/body cells when column sizing is active. */
export function getColumnSizeStyle(
  size: number,
  options?: ColumnSizeStyleOptions,
): CSSProperties | undefined {
  const {
    force = false,
    lockMax = false,
    minWidth,
    maxWidth,
    layoutWidth,
  } = options ?? {};

  if (lockMax) {
    return {
      width: size,
      minWidth: size,
      maxWidth: size,
    };
  }

  // `layoutWidth` is a `resolveColumnLayoutWidths` result: the exact px
  // budget assigned to this column so the row totals fit the container
  // (already clamped into `minWidth`/`maxWidth` by the resolver, including
  // any shrink toward `minWidth` under a tight viewport). Under the default
  // `table-layout: auto`, a *range* style (`min-width`/`max-width` set to
  // the original bounds) lets wide content re-grow the cell past that
  // budget, silently breaking the "fixed columns stay fixed, bounded
  // columns shrink to fit" contract. Lock all three to the resolved value
  // so the layout is actually enforced.
  if (layoutWidth != null) {
    return {
      width: layoutWidth,
      minWidth: layoutWidth,
      maxWidth: layoutWidth,
    };
  }

  const resolvedSize = size;
  const hasExplicitSize = force || size !== DATA_TABLE_COLUMN_SIZE;
  if (!hasExplicitSize && minWidth == null && maxWidth == null) {
    return undefined;
  }

  const style: CSSProperties = {};

  if (hasExplicitSize) {
    const used =
      minWidth != null || maxWidth != null
        ? clamp(
            resolvedSize,
            minWidth ?? Number.NEGATIVE_INFINITY,
            maxWidth ?? Number.POSITIVE_INFINITY,
          )
        : resolvedSize;
    style.width = used;
    style.minWidth = minWidth ?? used;
  } else if (minWidth != null) {
    style.minWidth = minWidth;
  }

  if (maxWidth != null) {
    style.maxWidth = maxWidth;
  }

  return style;
}
