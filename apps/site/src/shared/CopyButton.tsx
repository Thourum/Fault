import { useState } from 'react'

const RESET_MS = 1500

export function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false)
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), RESET_MS)
    } catch {
      // clipboard denied — button simply does nothing visible
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={copied ? 'Copied' : 'Copy code'} aria-live="polite"
      className="border border-line bg-surface px-2 py-1 text-xs text-muted hover:border-fg hover:text-fg">
      {copied ? 'copied' : 'copy'}
    </button>
  )
}
