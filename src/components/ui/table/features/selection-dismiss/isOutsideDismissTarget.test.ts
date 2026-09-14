import { describe, expect, it } from "vitest";

import { isOverlayDismissIgnoreTarget } from "@/components/ui/table/features/selection-dismiss/isOutsideDismissTarget";

describe("isOverlayDismissIgnoreTarget", () => {
  it("detects dialog and ignore-dismiss markers", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    const marked = document.createElement("div");
    marked.setAttribute("data-table-ignore-outside-dismiss", "");
    const nested = document.createElement("span");
    marked.appendChild(nested);
    document.body.appendChild(marked);

    expect(isOverlayDismissIgnoreTarget(button)).toBe(true);
    expect(isOverlayDismissIgnoreTarget(nested)).toBe(true);
    expect(isOverlayDismissIgnoreTarget(document.createElement("div"))).toBe(
      false,
    );

    dialog.remove();
    marked.remove();
  });
});
