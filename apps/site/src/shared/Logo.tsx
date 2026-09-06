// An "f" split along a fault line: the top half sits on Ok, the bottom slips onto Err.
export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M12 6h12v4h-8v6h7v-1H12z" className="fill-fg" />
      <path d="M10 17h8v4h-4v6h-4z" className="fill-err" />
      <path d="M4 16h24" className="stroke-fg" strokeWidth="1" />
    </svg>
  )
}
