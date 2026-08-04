import { describe, expect, it } from "vitest"

import {
  buildSearchMatchKey,
  buildSearchMatchKeys,
  buildTreeSearchCorpus,
  cellValueToSearchText,
  collectAncestorKeysToExpand,
  collectSearchMatchesInRange,
  createSearchRegex,
  escapeSearchRegex,
  formatSearchResultLabel,
  mapSearchResultToVisibleItem,
  mapSearchResultsToVisibleKeys,
  nextSearchIndex,
  nextSearchStride,
  previousSearchIndex,
} from "@/components/ui/table/features/inline-search/inlineSearch"

describe("escapeSearchRegex / createSearchRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeSearchRegex("a+b")).toBe("a\\+b")
    expect(createSearchRegex("Item (1)")?.test("Item (1)")).toBe(true)
    expect(createSearchRegex("   ")).toBeNull()
  })

  it("matches case-insensitively", () => {
    expect(createSearchRegex("sku")?.test("SKU-00001")).toBe(true)
  })
})

describe("cellValueToSearchText", () => {
  it("stringifies common cell values", () => {
    expect(cellValueToSearchText(null)).toBeUndefined()
    expect(cellValueToSearchText("hello")).toBe("hello")
    expect(cellValueToSearchText(12)).toBe("12")
    expect(cellValueToSearchText(true)).toBe("true")
    expect(cellValueToSearchText(["a", "b"])).toBe("a b")
  })
})

describe("collectSearchMatchesInRange", () => {
  const grid = [
    ["Apple", "Red"],
    ["Banana", "Yellow"],
    ["apricot", "Orange"],
  ]

  it("finds matches in row-major order as [col, row]", () => {
    const matches = collectSearchMatchesInRange({
      query: "ap",
      startRow: 0,
      rowCount: 3,
      columnCount: 2,
      getCellValue: (row, col) => grid[row]?.[col],
    })

    expect(matches).toEqual([
      [0, 0],
      [0, 2],
    ])
  })

  it("respects maxResults", () => {
    const matches = collectSearchMatchesInRange({
      query: "a",
      startRow: 0,
      rowCount: 3,
      columnCount: 2,
      getCellValue: (row, col) => grid[row]?.[col],
      maxResults: 1,
    })

    expect(matches).toHaveLength(1)
  })
})

describe("tree search corpus", () => {
  it("includes collapsed descendants and records ancestor toggle keys", () => {
    type Node = {
      id: string
      name: string
      level?: number
      children?: Node[]
      materialCode?: string
    }

    const roots: Node[] = [
      {
        id: "root",
        name: "Root",
        level: 0,
        materialCode: "ASM-1",
        children: [
          {
            id: "child",
            name: "Hidden Child",
            level: 1,
            materialCode: "PART-1",
            children: [
              {
                id: "grand",
                name: "Hidden Grandchild",
                level: 2,
                materialCode: "PART-2",
              },
            ],
          },
        ],
      },
    ]

    const corpus = buildTreeSearchCorpus(roots, {
      toggleField: "materialCode",
      getRowId: (row) => row.id,
    })

    expect(corpus.map((row) => row.id)).toEqual(["root", "child", "grand"])
    expect(corpus[1]?.ancestorToggleKeys).toEqual(["ASM-1"])
    expect(corpus[2]?.ancestorToggleKeys).toEqual(["ASM-1", "PART-1"])
  })

  it("maps corpus matches onto visible row indices", () => {
    const corpus = [
      { id: "a", data: { id: "a" }, ancestorToggleKeys: [] },
      { id: "b", data: { id: "b" }, ancestorToggleKeys: ["A"] },
    ]
    const visible = new Map([
      ["a", 0],
      // b is collapsed — not visible
    ])

    expect(
      mapSearchResultsToVisibleKeys(
        [
          [1, 0],
          [2, 1],
        ],
        corpus,
        visible,
      ),
    ).toEqual(new Set(["1:0"]))

    expect(
      mapSearchResultToVisibleItem([2, 1], corpus, visible),
    ).toBeNull()
    expect(
      mapSearchResultToVisibleItem([1, 0], corpus, new Map([["a", 5]])),
    ).toEqual([1, 5])
  })

  it("lists only missing ancestor keys to expand", () => {
    expect(
      collectAncestorKeysToExpand(
        {
          id: "x",
          data: {},
          ancestorToggleKeys: ["A", "B", "C"],
        },
        new Set(["B"]),
      ),
    ).toEqual(["A", "C"])
  })
})

describe("search navigation helpers", () => {
  it("cycles next/previous indices", () => {
    expect(nextSearchIndex(-1, 3)).toBe(0)
    expect(nextSearchIndex(2, 3)).toBe(0)
    expect(previousSearchIndex(0, 3)).toBe(2)
    expect(previousSearchIndex(-1, 3)).toBe(2)
  })

  it("formats result labels like Glide", () => {
    expect(
      formatSearchResultLabel({
        rowsSearched: 10,
        results: 0,
        selectedIndex: -1,
      }),
    ).toBe("0 results")

    expect(
      formatSearchResultLabel({
        rowsSearched: 10,
        results: 1,
        selectedIndex: 0,
      }),
    ).toBe("1 of 1 result")

    expect(
      formatSearchResultLabel({
        rowsSearched: 10,
        results: 1000,
        selectedIndex: 4,
      }),
    ).toBe("5 of over 1000")
  })

  it("builds match key sets", () => {
    expect(buildSearchMatchKey(2, 5)).toBe("2:5")
    expect(buildSearchMatchKeys([[1, 2], [3, 4]])).toEqual(
      new Set(["1:2", "3:4"]),
    )
  })

  it("adapts stride toward the target tick budget", () => {
    expect(nextSearchStride(10, 5)).toBe(20)
    expect(nextSearchStride(10, 20)).toBe(5)
  })
})
