import { describe, expect, it } from "vitest"

import {
  createCellRendererRegistry,
  formatDefaultCellValue,
  resolveCellRenderer,
} from "@/components/ui/table/features/cell-render/registry"
import type {
  CellRenderContext,
  CellRenderer,
} from "@/components/ui/table/features/cell-render/types"
import { commitCellValue } from "@/components/ui/table/features/cell-render/commitCellValue"

describe("cell-render registry", () => {
  it("registers builtin kinds", () => {
    const registry = createCellRendererRegistry()

    expect(registry.get("boolean")?.kind).toBe("boolean")
    expect(registry.get("uri")?.kind).toBe("uri")
    expect(registry.get("bubble")?.kind).toBe("bubble")
    expect(registry.get("markdown")?.kind).toBe("markdown")
    expect(registry.get("drilldown")?.kind).toBe("drilldown")
    expect(registry.get("loading")?.kind).toBe("loading")
    expect(registry.get("protected")?.kind).toBe("protected")
    expect(registry.get("row-id")?.kind).toBe("row-id")
  })

  it("lets later custom renderers override the same kind", () => {
    const custom: CellRenderer = {
      kind: "boolean",
      render: () => "custom-boolean",
    }
    const registry = createCellRendererRegistry([custom])

    expect(registry.get("boolean")?.render({} as CellRenderContext)).toBe(
      "custom-boolean",
    )
  })

  it("adds custom kinds", () => {
    const custom: CellRenderer = {
      kind: "my-button",
      render: ({ value }) => `btn:${String(value)}`,
    }
    const registry = createCellRendererRegistry([custom])
    const renderer = resolveCellRenderer(registry, "my-button", {
      value: "go",
    } as CellRenderContext)

    expect(renderer?.render({ value: "go" } as CellRenderContext)).toBe("btn:go")
  })

  it("formats default cell values", () => {
    expect(formatDefaultCellValue(null)).toBeNull()
    expect(formatDefaultCellValue(12)).toBe("12")
    expect(formatDefaultCellValue(true)).toBe("true")
  })
})

describe("commitCellValue", () => {
  it("prefers onCellChange over onDataChange", () => {
    const changes: Array<{ rowId: string; columnId: string; value: unknown }> =
      []
    const onDataChange = () => {
      throw new Error("onDataChange should not run")
    }

    const ok = commitCellValue({
      data: [{ id: "1", name: "A" }],
      rows: [
        {
          id: "1",
          getAllCells: () => [],
          getVisibleCells: () => [],
        } as never,
      ],
      rowId: "1",
      columnId: "name",
      value: "B",
      onCellChange: (rowId, columnId, value) => {
        changes.push({ rowId, columnId, value })
      },
      onDataChange,
    })

    expect(ok).toBe(true)
    expect(changes).toEqual([{ rowId: "1", columnId: "name", value: "B" }])
  })
})
