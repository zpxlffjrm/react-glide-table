type IconProps = {
  className?: string
  "aria-hidden"?: boolean
}

export function ChevronDown({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ChevronUp({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

export function ChevronLeft({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function ArrowUp({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
      <path d="M12 21V9" />
    </svg>
  )
}

export function ArrowDown({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
      <path d="M12 3v12" />
    </svg>
  )
}

export function ArrowUpDown({ className, "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden={ariaHidden}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  )
}
