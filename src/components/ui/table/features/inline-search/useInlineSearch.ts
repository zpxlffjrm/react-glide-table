import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"

import {
  buildSearchMatchKeys,
  collectSearchMatchesInRange,
  INLINE_SEARCH_INITIAL_STRIDE,
  INLINE_SEARCH_MAX_RESULTS,
  nextSearchIndex,
  nextSearchStride,
  previousSearchIndex,
  type SearchResultItem,
  type SearchStatus,
} from "@/components/ui/table/features/inline-search/inlineSearch"

export type UseInlineSearchOptions = {
  enabled?: boolean
  rowCount: number
  columnCount: number
  getCellValue: (rowIndex: number, colIndex: number) => unknown
  /** Prefer starting the scan near the visible window (virtualized tables). */
  initialStartRow?: number
  showSearch?: boolean
  searchValue?: string
  searchResults?: readonly SearchResultItem[]
  onSearchValueChange?: (value: string) => void
  onSearchClose?: () => void
  onSearchResultsChanged?: (
    results: readonly SearchResultItem[],
    navIndex: number,
  ) => void
  /** Select / scroll to the active match cell (corpus-indexed). */
  onNavigateToResult?: (item: SearchResultItem) => void
  /** Scope Ctrl/Cmd+F to this element when provided. */
  rootRef?: RefObject<HTMLElement | null>
}

export type UseInlineSearchResult = {
  enabled: boolean
  showSearch: boolean
  searchValue: string
  searchResults: readonly SearchResultItem[]
  searchStatus: SearchStatus | undefined
  searchMatchKeys: Set<string>
  activeMatch: SearchResultItem | null
  searchInputRef: RefObject<HTMLInputElement | null>
  searchInputId: string
  /** Close button is shown when uncontrolled, or when `onSearchClose` is provided. */
  canClose: boolean
  openSearch: () => void
  closeSearch: () => void
  setSearchValue: (value: string) => void
  goToNext: () => void
  goToPrevious: () => void
}

const EMPTY_MATCH_KEYS = new Set<string>()

export function useInlineSearch({
  enabled = false,
  rowCount,
  columnCount,
  getCellValue,
  initialStartRow = 0,
  showSearch: controlledShowSearch,
  searchValue: controlledSearchValue,
  searchResults: controlledSearchResults,
  onSearchValueChange,
  onSearchClose,
  onSearchResultsChanged,
  onNavigateToResult,
  rootRef,
}: UseInlineSearchOptions): UseInlineSearchResult {
  const searchInputId = useId()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [internalShowSearch, setInternalShowSearch] = useState(false)
  const [internalSearchValue, setInternalSearchValue] = useState("")
  const [internalResults, setInternalResults] = useState<SearchResultItem[]>(
    [],
  )
  const [searchStatus, setSearchStatus] = useState<SearchStatus | undefined>()
  const searchStatusRef = useRef(searchStatus)
  searchStatusRef.current = searchStatus

  const abortControllerRef = useRef<AbortController | null>(null)
  const searchHandleRef = useRef<number | undefined>(undefined)
  const initialStartRowRef = useRef(initialStartRow)
  initialStartRowRef.current = initialStartRow
  const getCellValueRef = useRef(getCellValue)
  getCellValueRef.current = getCellValue

  const showSearch = controlledShowSearch ?? internalShowSearch
  const searchValue = controlledSearchValue ?? internalSearchValue
  const searchResults = controlledSearchResults ?? internalResults

  const setSearchValue = useCallback(
    (value: string) => {
      setInternalSearchValue(value)
      onSearchValueChange?.(value)
    },
    [onSearchValueChange],
  )

  const cancelSearch = useCallback(() => {
    if (searchHandleRef.current !== undefined) {
      window.cancelAnimationFrame(searchHandleRef.current)
      searchHandleRef.current = undefined
    }
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
  }, [])

  const emitResultsChanged = useCallback(
    (results: readonly SearchResultItem[], navIndex: number) => {
      onSearchResultsChanged?.(results, navIndex)
    },
    [onSearchResultsChanged],
  )

  const navigateToIndex = useCallback(
    (results: readonly SearchResultItem[], navIndex: number) => {
      // When the consumer observes results, they own scrolling / selection.
      if (onSearchResultsChanged) return
      if (navIndex < 0 || navIndex >= results.length) return

      const item = results[navIndex]
      if (!item) return

      onNavigateToResult?.(item)
    },
    [onNavigateToResult, onSearchResultsChanged],
  )

  const beginSearch = useCallback(
    (query: string) => {
      if (controlledSearchResults !== undefined) return

      const totalRows = rowCount
      if (totalRows === 0 || columnCount === 0) {
        setSearchStatus(undefined)
        setInternalResults([])
        emitResultsChanged([], -1)

        return
      }

      let startY = Math.min(
        Math.max(0, initialStartRowRef.current),
        totalRows - 1,
      )
      let searchStride = Math.min(INLINE_SEARCH_INITIAL_STRIDE, totalRows)
      let rowsSearched = 0
      const runningResult: SearchResultItem[] = []

      setSearchStatus(undefined)
      setInternalResults([])

      const tick = () => {
        if (abortControllerRef.current?.signal.aborted) return

        const tStart = performance.now()
        const rowsLeft = totalRows - rowsSearched
        const height = Math.min(searchStride, rowsLeft, totalRows - startY)
        if (height <= 0) {
          return
        }

        const chunk = collectSearchMatchesInRange({
          query,
          startRow: startY,
          rowCount: height,
          columnCount,
          getCellValue: (rowIndex, colIndex) =>
            getCellValueRef.current(rowIndex, colIndex),
          maxResults: INLINE_SEARCH_MAX_RESULTS - runningResult.length,
        })

        if (chunk.length > 0) {
          runningResult.push(...chunk)
          setInternalResults([...runningResult])
        }

        rowsSearched += height
        const selectedIndex = searchStatusRef.current?.selectedIndex ?? -1
        setSearchStatus({
          results: runningResult.length,
          rowsSearched,
          selectedIndex,
        })
        emitResultsChanged(runningResult, selectedIndex)

        if (startY + height >= totalRows) {
          startY = 0
        } else {
          startY += height
        }

        searchStride = nextSearchStride(
          searchStride,
          performance.now() - tStart,
        )

        if (
          rowsSearched < totalRows &&
          runningResult.length < INLINE_SEARCH_MAX_RESULTS
        ) {
          searchHandleRef.current = window.requestAnimationFrame(tick)
        }
      }

      cancelSearch()
      searchHandleRef.current = window.requestAnimationFrame(tick)
    },
    [
      cancelSearch,
      columnCount,
      controlledSearchResults,
      emitResultsChanged,
      rowCount,
    ],
  )

  const openSearch = useCallback(() => {
    if (controlledShowSearch === undefined) {
      setInternalShowSearch(true)
    }
  }, [controlledShowSearch])

  const closeSearch = useCallback(() => {
    if (onSearchClose) {
      onSearchClose()
    } else if (controlledShowSearch === undefined) {
      setInternalShowSearch(false)
    }

    setSearchStatus(undefined)
    setInternalResults([])
    emitResultsChanged([], -1)
    cancelSearch()
  }, [
    cancelSearch,
    controlledShowSearch,
    emitResultsChanged,
    onSearchClose,
  ])

  const goToNext = useCallback(() => {
    if (!searchStatus || searchStatus.results === 0) return

    const newIndex = nextSearchIndex(
      searchStatus.selectedIndex,
      searchStatus.results,
    )
    setSearchStatus({ ...searchStatus, selectedIndex: newIndex })
    emitResultsChanged(searchResults, newIndex)
    navigateToIndex(searchResults, newIndex)
  }, [emitResultsChanged, navigateToIndex, searchResults, searchStatus])

  const goToPrevious = useCallback(() => {
    if (!searchStatus || searchStatus.results === 0) return

    const newIndex = previousSearchIndex(
      searchStatus.selectedIndex,
      searchStatus.results,
    )
    setSearchStatus({ ...searchStatus, selectedIndex: newIndex })
    emitResultsChanged(searchResults, newIndex)
    navigateToIndex(searchResults, newIndex)
  }, [emitResultsChanged, navigateToIndex, searchResults, searchStatus])

  useEffect(() => {
    if (controlledSearchResults === undefined) return

    if (controlledSearchResults.length > 0) {
      setSearchStatus((current) => ({
        rowsSearched: rowCount,
        results: controlledSearchResults.length,
        selectedIndex: current?.selectedIndex ?? -1,
      }))
    } else {
      setSearchStatus(undefined)
    }
  }, [controlledSearchResults, rowCount])

  useEffect(() => {
    if (!enabled) return

    setSearchValue("")
    setSearchStatus(undefined)
    setInternalResults([])
    emitResultsChanged([], -1)

    if (showSearch) {
      queueMicrotask(() => {
        searchInputRef.current?.focus({ preventScroll: true })
      })
    } else {
      cancelSearch()
    }
    // Only re-run when visibility toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, showSearch])

  useEffect(() => {
    if (!enabled || !showSearch) return
    if (controlledSearchResults !== undefined) return

    if (searchValue.trim() === "") {
      setSearchStatus(undefined)
      setInternalResults([])
      cancelSearch()
      emitResultsChanged([], -1)

      return
    }

    beginSearch(searchValue)
  }, [
    beginSearch,
    cancelSearch,
    controlledSearchResults,
    emitResultsChanged,
    enabled,
    searchValue,
    showSearch,
  ])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() !== "f") return

      const root = rootRef?.current
      if (root) {
        const active = document.activeElement
        const focusInside =
          active === root || (active instanceof Node && root.contains(active))
        if (!focusInside && active !== document.body) {
          return
        }
      }

      event.preventDefault()
      event.stopPropagation()

      if (showSearch) {
        searchInputRef.current?.focus({ preventScroll: true })
        searchInputRef.current?.select()

        return
      }

      if (controlledShowSearch === undefined) {
        setInternalShowSearch(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)

    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [controlledShowSearch, enabled, rootRef, showSearch])

  useEffect(() => () => cancelSearch(), [cancelSearch])

  const searchMatchKeys = useMemo(
    () => buildSearchMatchKeys(searchResults),
    [searchResults],
  )

  const activeMatch = useMemo(() => {
    if (!searchStatus || searchStatus.selectedIndex < 0) return null

    return searchResults[searchStatus.selectedIndex] ?? null
  }, [searchResults, searchStatus])

  if (!enabled) {
    return {
      enabled: false,
      showSearch: false,
      searchValue: "",
      searchResults: [],
      searchStatus: undefined,
      searchMatchKeys: EMPTY_MATCH_KEYS,
      activeMatch: null,
      searchInputRef,
      searchInputId,
      canClose: false,
      openSearch,
      closeSearch,
      setSearchValue,
      goToNext,
      goToPrevious,
    }
  }

  return {
    enabled: true,
    showSearch,
    searchValue,
    searchResults,
    searchStatus,
    searchMatchKeys,
    activeMatch,
    searchInputRef,
    searchInputId,
    canClose: controlledShowSearch === undefined || onSearchClose !== undefined,
    openSearch,
    closeSearch,
    setSearchValue,
    goToNext,
    goToPrevious,
  }
}
