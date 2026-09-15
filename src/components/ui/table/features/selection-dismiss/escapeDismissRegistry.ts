import { isEditablePasteTarget } from "@/components/ui/table/features/cell-selection/pasteData";
import { isOverlayDismissIgnoreTarget } from "@/components/ui/table/features/selection-dismiss/isOutsideDismissTarget";

/**
 * When multiple tables are mounted at once, each used to register its own
 * `window` "keydown" listener for Escape. All of those listeners fire for the
 * same event, but only one table's resulting state update would reliably
 * show up per keypress (registration churn on any single table's listener —
 * e.g. an unstable `onRowSelectionChange` reference — could starve the
 * others), so clearing every table's selection required holding Escape down.
 *
 * Routing every table through this single shared listener guarantees one
 * Escape press synchronously clears every currently-mounted table in one
 * pass, regardless of how many tables are on the page.
 */

type ClearAllSelections = () => void;

const clearAllByOwner = new Map<symbol, ClearAllSelections>();
let isListening = false;

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (event.defaultPrevented) return;
  if (
    isEditablePasteTarget(event.target) ||
    isEditablePasteTarget(document.activeElement)
  ) {
    return;
  }
  if (
    isOverlayDismissIgnoreTarget(event.target) ||
    isOverlayDismissIgnoreTarget(document.activeElement)
  ) {
    return;
  }

  for (const clearAllSelections of clearAllByOwner.values()) {
    clearAllSelections();
  }
}

export function registerEscapeDismiss(
  owner: symbol,
  clearAllSelections: ClearAllSelections,
): () => void {
  clearAllByOwner.set(owner, clearAllSelections);

  if (!isListening) {
    window.addEventListener("keydown", handleEscape);
    isListening = true;
  }

  return () => {
    clearAllByOwner.delete(owner);

    if (clearAllByOwner.size === 0 && isListening) {
      window.removeEventListener("keydown", handleEscape);
      isListening = false;
    }
  };
}
