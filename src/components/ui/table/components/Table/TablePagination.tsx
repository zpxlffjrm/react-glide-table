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
}

function TablePagination({
  page,
  pageSize = 10,
  totalCount = 0,
  onChange,
  className,
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
        aria-label="Previous page">
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
        aria-label="Next page">
        <ChevronRight className="pagination-button-icon" />
      </button>
    </div>
  )
}

TablePagination.displayName = TABLE_PAGINATION_DISPLAY_NAME

export { TablePagination }
