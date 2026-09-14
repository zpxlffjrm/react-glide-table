/**
 * Portaled overlays (modals, menus, …) render outside the table root.
 * Escape there must not dismiss table selection, or cell-owned UI
 * (e.g. a modal opened from a virtual cell) loses its row/selection props.
 */
const OVERLAY_DISMISS_IGNORE_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tooltip"]',
  '[aria-modal="true"]',
  "[data-radix-portal]",
  "[data-radix-popper-content-wrapper]",
  "[data-floating-ui-portal]",
  "[data-table-ignore-outside-dismiss]",
].join(",");

export function isOverlayDismissIgnoreTarget(
  target: EventTarget | null,
): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element) return false;

  return element.closest(OVERLAY_DISMISS_IGNORE_SELECTOR) !== null;
}
