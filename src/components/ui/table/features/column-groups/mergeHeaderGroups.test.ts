import { describe, expect, it } from "vitest"

import { getMergedHeaderGroups } from "@/components/ui/table/features/column-groups/mergeHeaderGroups"

type FakeHeader = {
  id: string
  isPlaceholder: boolean
  column: { id: string }
  colSpan: number
  depth: number
}

type FakeHeaderGroup = {
  id: string
  depth: number
  headers: FakeHeader[]
}

describe("getMergedHeaderGroups", () => {
  it("leaves a single header row unchanged with mergedRowSpan 1", () => {
    const groups = [
      {
        id: "0",
        depth: 0,
        headers: [
          {
            id: "name",
            isPlaceholder: false,
            column: { id: "name" },
            colSpan: 1,
            depth: 0,
          },
        ],
      },
    ] as unknown as FakeHeaderGroup[]

    const merged = getMergedHeaderGroups(groups as never)

    expect(merged).toHaveLength(1)
    expect(merged[0]!.headers).toHaveLength(1)
    expect(merged[0]!.headers[0]!.mergedRowSpan).toBe(1)
    expect(merged[0]!.headers[0]!.isPlaceholder).toBe(false)
  })

  it("merges placeholder chains for shallow leaf columns", () => {
    const groups = [
      {
        id: "0",
        depth: 0,
        headers: [
          {
            id: "group:Identity",
            isPlaceholder: false,
            column: { id: "group:Identity" },
            colSpan: 2,
            depth: 0,
          },
          {
            id: "note_placeholder",
            isPlaceholder: true,
            column: { id: "note" },
            colSpan: 1,
            depth: 0,
          },
        ],
      },
      {
        id: "1",
        depth: 1,
        headers: [
          {
            id: "name",
            isPlaceholder: false,
            column: { id: "name" },
            colSpan: 1,
            depth: 1,
          },
          {
            id: "amount",
            isPlaceholder: false,
            column: { id: "amount" },
            colSpan: 1,
            depth: 1,
          },
          {
            id: "note",
            isPlaceholder: false,
            column: { id: "note" },
            colSpan: 1,
            depth: 1,
          },
        ],
      },
    ] as unknown as FakeHeaderGroup[]

    const merged = getMergedHeaderGroups(groups as never)

    expect(merged[0]!.headers).toHaveLength(2)
    expect(merged[0]!.headers[0]!.mergedRowSpan).toBe(1)
    expect(merged[0]!.headers[1]!.column.id).toBe("note")
    expect(merged[0]!.headers[1]!.isPlaceholder).toBe(false)
    expect(merged[0]!.headers[1]!.mergedRowSpan).toBe(2)

    expect(merged[1]!.headers.map((header) => header.column.id)).toEqual([
      "name",
      "amount",
    ])
    expect(merged[1]!.headers.every((header) => header.mergedRowSpan === 1)).toBe(
      true,
    )
  })
})
