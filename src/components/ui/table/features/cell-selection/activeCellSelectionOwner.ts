/**
 * When multiple tables mount, each registers window copy/paste listeners.
 * Only the last-interacted table should own clipboard shortcuts; others may
 * still show a stale cell highlight until the next render clears them.
 */

let activeOwner: symbol | null = null
const clearByOwner = new Map<symbol, () => void>()

export function createCellSelectionOwner(): symbol {
  return Symbol("cell-selection-owner")
}

export function registerCellSelectionOwner(
  owner: symbol,
  clearSelection: () => void,
): () => void {
  clearByOwner.set(owner, clearSelection)

  return () => {
    clearByOwner.delete(owner)
    if (activeOwner === owner) {
      activeOwner = null
    }
  }
}

export function claimCellSelectionOwner(owner: symbol): void {
  if (activeOwner === owner) return

  activeOwner = owner

  for (const [id, clearSelection] of clearByOwner) {
    if (id !== owner) {
      clearSelection()
    }
  }
}

export function isActiveCellSelectionOwner(owner: symbol): boolean {
  return activeOwner === owner
}

export function releaseCellSelectionOwner(owner: symbol): void {
  if (activeOwner === owner) {
    activeOwner = null
  }
}
