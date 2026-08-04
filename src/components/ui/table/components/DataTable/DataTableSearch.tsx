import type { KeyboardEvent, Ref } from "react"

import {
  formatSearchResultLabel,
  type SearchStatus,
} from "@/components/ui/table/features/inline-search/inlineSearch"
import { ChevronDown, ChevronUp } from "@/components/ui/table/components/icons"
import type { DataTableClassNames } from "@/components/ui/table/types"
import { cn } from "@/lib/cn"

export type DataTableSearchProps = {
  showSearch: boolean
  searchValue: string
  searchStatus?: SearchStatus
  searchInputId: string
  searchInputRef: Ref<HTMLInputElement | null>
  canClose: boolean
  placeholder: string
  resultHint: string
  previousLabel: string
  nextLabel: string
  closeLabel: string
  rowsTotal: number
  classNames?: Pick<
    DataTableClassNames,
    | "search"
    | "searchInput"
    | "searchButton"
    | "searchStatus"
    | "searchProgress"
  >
  onSearchValueChange: (value: string) => void
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

function SearchCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * Unstyled find-in-page overlay (Glide Data Grid built-in search UX).
 * Style via `classNames.search*` / `.data-table-search` hooks.
 */
export function DataTableSearch({
  showSearch,
  searchValue,
  searchStatus,
  searchInputId,
  searchInputRef,
  canClose,
  placeholder,
  resultHint,
  previousLabel,
  nextLabel,
  closeLabel,
  rowsTotal,
  classNames,
  onSearchValueChange,
  onClose,
  onNext,
  onPrevious,
}: DataTableSearchProps) {
  if (!showSearch) return null

  const resultString = searchStatus
    ? formatSearchResultLabel(searchStatus)
    : resultHint
  const progress =
    rowsTotal > 0
      ? Math.floor(((searchStatus?.rowsSearched ?? 0) / rowsTotal) * 100)
      : 0

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      ((event.ctrlKey || event.metaKey) && event.code === "KeyF") ||
      event.key === "Escape"
    ) {
      event.preventDefault()
      event.stopPropagation()
      onClose()

      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (event.shiftKey) {
        onPrevious()
      } else {
        onNext()
      }
    }
  }

  return (
    <div
      className={cn("data-table-search", classNames?.search)}
      role="search"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="data-table-search-row">
        <input
          ref={searchInputRef}
          id={searchInputId}
          type="search"
          value={searchValue}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={placeholder}
          className={cn("data-table-search-input", classNames?.searchInput)}
          onChange={(event) => onSearchValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          aria-label={previousLabel}
          className={cn("data-table-search-button", classNames?.searchButton)}
          onClick={(event) => {
            event.stopPropagation()
            onPrevious()
          }}
        >
          <ChevronUp className="data-table-search-icon" />
        </button>
        <button
          type="button"
          aria-label={nextLabel}
          className={cn("data-table-search-button", classNames?.searchButton)}
          onClick={(event) => {
            event.stopPropagation()
            onNext()
          }}
        >
          <ChevronDown className="data-table-search-icon" />
        </button>
        {canClose ? (
          <button
            type="button"
            aria-label={closeLabel}
            className={cn("data-table-search-button", classNames?.searchButton)}
            onClick={(event) => {
              event.stopPropagation()
              onClose()
            }}
          >
            <SearchCloseIcon className="data-table-search-icon" />
          </button>
        ) : null}
      </div>
      <div
        className={cn("data-table-search-status", classNames?.searchStatus)}
        aria-live="polite"
      >
        {resultString}
      </div>
      {searchStatus !== undefined ? (
        <div
          className={cn(
            "data-table-search-progress",
            classNames?.searchProgress,
          )}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="data-table-search-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
