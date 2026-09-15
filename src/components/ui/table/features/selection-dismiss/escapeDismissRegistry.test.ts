import { describe, expect, it, vi } from "vitest";

import { registerEscapeDismiss } from "@/components/ui/table/features/selection-dismiss/escapeDismissRegistry";

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
}

describe("registerEscapeDismiss", () => {
  it("invokes each owner's callback exactly once per Escape press, even when one owner synchronously re-registers itself mid-dispatch", () => {
    const ownerA = Symbol("a");
    const ownerB = Symbol("b");
    let aCallCount = 0;
    let bCallCount = 0;
    let unregisterA: () => void;

    const clearA = () => {
      aCallCount += 1;
      // Mirrors a controlled table whose onRowSelectionChange causes a
      // synchronous React update (e.g. via flushSync): the effect owning
      // this registration tears down and re-runs — unregister, then
      // register again — while this very callback is still executing.
      unregisterA();
      unregisterA = registerEscapeDismiss(ownerA, clearA);
    };
    const clearB = () => {
      bCallCount += 1;
    };

    unregisterA = registerEscapeDismiss(ownerA, clearA);
    const unregisterB = registerEscapeDismiss(ownerB, clearB);

    pressEscape();

    expect(aCallCount).toBe(1);
    expect(bCallCount).toBe(1);

    unregisterA();
    unregisterB();
  });

  it("still clears every other table when one owner's callback throws, and reports the failure", () => {
    const ownerA = Symbol("a");
    const ownerB = Symbol("b");
    const ownerC = Symbol("c");
    const clearB = vi.fn();
    const clearC = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const unregisterA = registerEscapeDismiss(ownerA, () => {
      throw new Error("boom");
    });
    const unregisterB = registerEscapeDismiss(ownerB, clearB);
    const unregisterC = registerEscapeDismiss(ownerC, clearC);

    expect(() => pressEscape()).not.toThrow();

    // The throw must not have aborted the loop: both later tables still ran.
    expect(clearB).toHaveBeenCalledTimes(1);
    expect(clearC).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    unregisterA();
    unregisterB();
    unregisterC();
    consoleErrorSpy.mockRestore();
  });

  it("removes the shared listener once every owner has unregistered", () => {
    const owner = Symbol("solo");
    const clear = vi.fn();

    const unregister = registerEscapeDismiss(owner, clear);
    unregister();

    pressEscape();

    expect(clear).not.toHaveBeenCalled();
  });
});
