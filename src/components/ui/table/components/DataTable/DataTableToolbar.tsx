import type { ReactNode } from "react"

import type { DataTableClassNames } from "@/components/ui/table/types"
import { cn } from "@/lib/cn"

type DataTableToolbarProps = {
  filteredCount?: number
  totalCount?: number
  summary?: ReactNode
  selectedCount: number
  selectionLabel?: (selectedCount: number) => ReactNode
  toolbar?: ReactNode
  className?: string
  classNames?: Pick<
    DataTableClassNames,
    | "toolbar"
    | "toolbarLeft"
    | "toolbarRight"
    | "toolbarCount"
    | "toolbarSelection"
    | "toolbarActions"
  >
}

function DataTableToolbar({
  filteredCount,
  totalCount,
  summary,
  selectedCount,
  selectionLabel,
  toolbar,
  className,
  classNames,
}: DataTableToolbarProps) {
  const displayFiltered = filteredCount ?? totalCount
  const hasCount = displayFiltered !== undefined || totalCount !== undefined
  const hasLeftContent = hasCount || Boolean(summary)
  const hasToolbar = Boolean(toolbar)

  const selectionContent = selectionLabel?.(selectedCount) ?? null
  const hasSelectionContent =
    selectionContent !== null &&
    selectionContent !== false &&
    selectionContent !== undefined &&
    typeof selectionContent !== "boolean"

  if (!hasLeftContent && !hasToolbar && !hasSelectionContent) return null

  return (
    <div className={cn("DataTableToolbarJSX", classNames?.toolbar, className)}>
      <div className={cn("toolbar-left", classNames?.toolbarLeft)}>
        {hasCount && (
          <span className={cn("toolbar-count", classNames?.toolbarCount)}>
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
      <div className={cn("toolbar-right", classNames?.toolbarRight)}>
        {hasSelectionContent &&
          (typeof selectionContent === "string" || typeof selectionContent === "number" ? (
            <span className={cn("toolbar-selection", classNames?.toolbarSelection)}>
              {selectionContent}
            </span>
          ) : (
            selectionContent
          ))}
        {hasToolbar && (
          <div className={cn("toolbar-actions", classNames?.toolbarActions)}>{toolbar}</div>
        )}
      </div>
    </div>
  )
}

export { DataTableToolbar }
export type { DataTableToolbarProps }
