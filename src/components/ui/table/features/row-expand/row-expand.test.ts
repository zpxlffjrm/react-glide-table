import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/react"

import { useConvertTreeData } from "@/components/ui/table/features/row-expand/row-expand"

type BomNode = {
  id: string
  materialCode: string
  materialName: string
  qty: number
  assemblyMaterials?: BomNode[]
}

describe("useConvertTreeData duplicate toggle keys", () => {
  it("attaches children to the nearest preceding parent when materialCode collides", () => {
    const data: BomNode[] = [
      {
        id: "root-1",
        materialCode: "ASM-1000",
        materialName: "Main assembly",
        qty: 1,
        assemblyMaterials: [
          {
            id: "child-1",
            materialCode: "PRT-1100",
            materialName: "Upper cover",
            qty: 2,
          },
        ],
      },
      {
        id: "root-2",
        materialCode: "ASM-4000",
        materialName: "Packaging kit",
        qty: 1,
      },
      // Pasted duplicate of ASM-1000 + child — must not attach under root-1
      {
        id: "paste-0",
        materialCode: "ASM-1000",
        materialName: "Main assembly",
        qty: 1,
        assemblyMaterials: [
          {
            id: "paste-1",
            materialCode: "PRT-1100",
            materialName: "Upper cover",
            qty: 2,
          },
        ],
      },
    ]

    const { result } = renderHook(() =>
      useConvertTreeData<BomNode>({
        data,
        enabled: true,
        toggleField: "materialCode",
        childField: "assemblyCode",
        flattenField: "assemblyMaterials",
        expandedRows: new Set(["ASM-1000"]),
      }),
    )

    const visible = result.current
    const ids = visible.map((row) => row.id)

    expect(ids).toEqual(["root-1", "child-1", "root-2", "paste-0", "paste-1"])

    const firstParent = visible.find((row) => row.id === "root-1")
    const pastedParent = visible.find((row) => row.id === "paste-0")

    expect(firstParent?.children.map((child) => child.id)).toEqual(["child-1"])
    expect(pastedParent?.children.map((child) => child.id)).toEqual(["paste-1"])
  })
})
