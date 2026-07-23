import type { RowSelectionState, Updater } from "@tanstack/react-table"

import type { RowSelectionMode } from "@/components/ui/table/types"

export function resolveRowSelection(
  mode: RowSelectionMode,
  controlledSelection: RowSelectionState | undefined,
  internalSelection: RowSelectionState,
): RowSelectionState {
  if (mode === "none") return {}

  return controlledSelection ?? internalSelection
}

function normalizeSingleSelection(next: RowSelectionState): RowSelectionState {
  const selectedIds = Object.keys(next).filter((id) => next[id])
  if (selectedIds.length <= 1) return next

  return { [selectedIds[selectedIds.length - 1]]: true }
}

export function applySelectionUpdater(
  mode: RowSelectionMode,
  updater: Updater<RowSelectionState>,
  previous: RowSelectionState,
): RowSelectionState {
  const next = typeof updater === "function" ? updater(previous) : updater

  return mode === "single" ? normalizeSingleSelection(next) : next
}
