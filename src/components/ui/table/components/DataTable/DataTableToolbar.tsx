import type { ReactNode } from "react"

import { cn } from "@/lib/cn"


type DataTableToolbarProps = {
  filteredCount?: number
  totalCount?: number
  summary?: ReactNode
  selectedCount: number
  selectionLabel?: (selectedCount: number) => ReactNode
  toolbar?: ReactNode
  className?: string
}

function DefaultSelectionLabel({ selectedCount }: { selectedCount: number }) {
  if (selectedCount <= 0) return null

  return <span className="toolbar-selection">✓ {selectedCount}개 선택됨</span>
}

function DataTableToolbar({
  filteredCount,
  totalCount,
  summary,
  selectedCount,
  selectionLabel,
  toolbar,
  className,
}: DataTableToolbarProps) {
  const displayFiltered = filteredCount ?? totalCount
  const hasCount = displayFiltered !== undefined || totalCount !== undefined
  const hasLeftContent = hasCount || Boolean(summary)
  const hasToolbar = Boolean(toolbar)

  const selectionContent = selectionLabel ? (
    selectionLabel(selectedCount)
  ) : (
    <DefaultSelectionLabel selectedCount={selectedCount} />
  )
  const hasSelectionContent = selectionContent !== null && selectionContent !== false

  if (!hasLeftContent && !hasToolbar && !hasSelectionContent) return null

  return (
    <div className={cn("DataTableToolbarJSX", className)}>
      <div className="toolbar-left">
        {hasCount && (
          <span className="toolbar-count">
            {displayFiltered !== undefined && totalCount !== undefined ? (
              <>
                <span className="toolbar-count-primary">{displayFiltered}</span>
                <span className="toolbar-count-placeholder"> / {totalCount}</span>
              </>
            ) : (
              <span className="toolbar-count-primary">{displayFiltered ?? totalCount}</span>
            )}
          </span>
        )}
        {summary}
      </div>
      <div className="toolbar-right">
        {selectionContent}
        {hasToolbar && <div className="toolbar-actions">{toolbar}</div>}
      </div>
    </div>
  )
}

export { DataTableToolbar }
export type { DataTableToolbarProps }
