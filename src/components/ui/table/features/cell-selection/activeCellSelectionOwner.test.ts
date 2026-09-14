import { afterEach, describe, expect, it, vi } from "vitest"

import {
  claimCellSelectionOwner,
  createCellSelectionOwner,
  isActiveCellSelectionOwner,
  registerCellSelectionOwner,
  releaseCellSelectionOwner,
} from "@/components/ui/table/features/cell-selection/activeCellSelectionOwner"

describe("activeCellSelectionOwner", () => {
  afterEach(() => {
    const owner = createCellSelectionOwner()
    const unregister = registerCellSelectionOwner(owner, () => {})
    claimCellSelectionOwner(owner)
    releaseCellSelectionOwner(owner)
    unregister()
  })

  it("routes ownership to the last claimed table and clears the previous", () => {
    const first = createCellSelectionOwner()
    const second = createCellSelectionOwner()
    const clearFirst = vi.fn()
    const clearSecond = vi.fn()

    const unregisterFirst = registerCellSelectionOwner(first, clearFirst)
    claimCellSelectionOwner(first)
    expect(isActiveCellSelectionOwner(first)).toBe(true)
    expect(clearFirst).not.toHaveBeenCalled()

    const unregisterSecond = registerCellSelectionOwner(second, clearSecond)
    claimCellSelectionOwner(second)
    expect(isActiveCellSelectionOwner(second)).toBe(true)
    expect(clearFirst).toHaveBeenCalledTimes(1)
    expect(clearSecond).not.toHaveBeenCalled()

    unregisterFirst()
    unregisterSecond()
  })
})
