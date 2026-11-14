import { TABLE_PAGINATION_DISPLAY_NAME } from "@/components/ui/table/components/Table/tableChildTypes"
import { getTotalPages } from "@/components/ui/table/components/Table/tableDataPipeline"
import { ChevronLeft, ChevronRight } from "@/components/ui/table/components/icons"
import { cn } from "@/lib/cn"


export type TablePaginationProps = {
  page: number
  pageSize?: number
  totalCount?: number
  onChange: (page: number) => void
  className?: string
  /**
   * The table's `data` already is this page (server-side pagination): it is
   * shown as-is instead of being sliced again.
   */
  manual?: boolean
  /** Accessible label of the previous-page button. */
  previousLabel?: string
  /** Accessible label of the next-page button. */
  nextLabel?: string
}

function TablePagination({
  page,
  pageSize = 10,
  totalCount = 0,
  onChange,
  className,
  previousLabel = "Previous page",
  nextLabel = "Next page",
}: TablePaginationProps) {
  const totalPages = getTotalPages(totalCount, pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const canGoPrev = safePage > 1
  const canGoNext = safePage < totalPages

  return (
    <div className={cn("TablePaginationJSX", className)}>
      <button
        type="button"
        className="pagination-button"
        disabled={!canGoPrev}
        onClick={() => onChange(safePage - 1)}
        aria-label={previousLabel}>
        <ChevronLeft className="pagination-button-icon" />
      </button>
      <span className="pagination-label">
        {safePage} / {totalPages}
      </span>
      <button
        type="button"
        className="pagination-button"
        disabled={!canGoNext}
        onClick={() => onChange(safePage + 1)}
        aria-label={nextLabel}>
        <ChevronRight className="pagination-button-icon" />
      </button>
    </div>
  )
}

TablePagination.displayName = TABLE_PAGINATION_DISPLAY_NAME

export { TablePagination }
