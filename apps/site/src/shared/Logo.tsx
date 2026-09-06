export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" className="fill-surface" />
      <path d="M9 8h14v4H13v4h8v4h-8v6H9z" className="fill-accent" />
    </svg>
  )
}
