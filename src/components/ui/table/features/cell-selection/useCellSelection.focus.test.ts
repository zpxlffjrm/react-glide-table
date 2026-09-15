import type { Row } from "@tanstack/react-table"
import { act, renderHook } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useCellSelection } from "@/components/ui/table/features/cell-selection/useCellSelection"

type TestRow = { id: string; name: string }

function createVisibleRows(data: TestRow[]): Row<TestRow>[] {
  return data.map((original, index) => ({
    id: original.id,
    index,
    original,
    getVisibleCells: () => [
      {
        column: { id: "name", columnDef: { accessorKey: "name", id: "name" } },
        getValue: () => original.name,
      },
    ],
  })) as unknown as Row<TestRow>[]
}

function dispatchCtrlC() {
  const event = new KeyboardEvent("keydown", {
    key: "c",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
}

describe("useCellSelection focus scoping", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it("copies the selection when nothing outside the table has focus", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const tableRoot = document.createElement("div")
    document.body.appendChild(tableRoot)
    const rootRef = createRef<HTMLDivElement | null>()
    rootRef.current = tableRoot

    const rows = createVisibleRows([{ id: "1", name: "table-value" }])
    const { result } = renderHook(() =>
      useCellSelection({ data: [{ id: "1", name: "table-value" }], rows, rootRef }),
    )

    act(() => {
      result.current.handleCellMouseDown(0, 0)
    })

    dispatchCtrlC()
    await act(async () => {
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith("table-value")
  })

  it("does not hijack copy when focus has moved into a modal outside the table", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const tableRoot = document.createElement("div")
    document.body.appendChild(tableRoot)
    const rootRef = createRef<HTMLDivElement | null>()
    rootRef.current = tableRoot

    // Simulates a dialog/modal mounted outside the table, e.g. a focus-trapped
    // Radix DialogContent, receiving focus while the table stays mounted behind it.
    const modalField = document.createElement("div")
    modalField.tabIndex = -1
    document.body.appendChild(modalField)

    const rows = createVisibleRows([{ id: "1", name: "table-value" }])
    const { result } = renderHook(() =>
      useCellSelection({ data: [{ id: "1", name: "table-value" }], rows, rootRef }),
    )

    act(() => {
      result.current.handleCellMouseDown(0, 0)
    })

    modalField.focus()
    expect(document.activeElement).toBe(modalField)

    dispatchCtrlC()
    await act(async () => {
      await Promise.resolve()
    })

    expect(writeText).not.toHaveBeenCalled()
  })
})
